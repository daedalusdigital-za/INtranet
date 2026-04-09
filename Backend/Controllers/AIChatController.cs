using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ClosedXML.Excel;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using System.Diagnostics;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AIChatController : ControllerBase
    {
        private readonly ILogger<AIChatController> _logger;
        private readonly ILlamaAIService _aiService;
        private readonly IOllamaAIService _ollamaService;
        private readonly IClaudeAIService _claudeService;
        private readonly ILocalLlmService _localLlmService;
        private readonly IAIActionService _actionService;
        private readonly IConfiguration _configuration;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IReportCacheService _reportCacheService;

        public AIChatController(
            ILogger<AIChatController> logger, 
            ILlamaAIService aiService,
            IOllamaAIService ollamaService,
            IClaudeAIService claudeService,
            ILocalLlmService localLlmService,
            IAIActionService actionService,
            IConfiguration configuration,
            IServiceScopeFactory scopeFactory,
            IReportCacheService reportCacheService)
        {
            _logger = logger;
            _aiService = aiService;
            _ollamaService = ollamaService;
            _claudeService = claudeService;
            _localLlmService = localLlmService;
            _actionService = actionService;
            _configuration = configuration;
            _scopeFactory = scopeFactory;
            _reportCacheService = reportCacheService;
        }

        /// <summary>
        /// Check if AI service is available
        /// </summary>
        [AllowAnonymous]
        [HttpGet("health")]
        public async Task<IActionResult> Health()
        {
            var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
            var localLlmAvailable = localLlmEnabled && await _localLlmService.IsAvailableAsync();

            var claudeEnabled = _configuration.GetValue<bool>("Claude:Enabled", false);
            var claudeAvailable = claudeEnabled && await _claudeService.IsAvailableAsync();

            var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", false);
            var ollamaAvailable = ollamaEnabled && await _ollamaService.IsAvailableAsync();

            string model;
            string provider;

            if (localLlmAvailable)
            {
                model = _configuration["LocalLlm:Model"] ?? "gemma-4-27b-it";
                provider = "local-llm";
            }
            else if (claudeAvailable)
            {
                model = _configuration["Claude:Model"] ?? "claude-sonnet-4-20250514";
                provider = "claude";
            }
            else if (ollamaAvailable)
            {
                model = _configuration["Ollama:Model"] ?? "phi3:mini";
                provider = "ollama";
            }
            else
            {
                model = "rule-based-fallback";
                provider = "fallback";
            }
            
            return Ok(new 
            { 
                status = "ready",
                model = model,
                provider = provider,
                localLlmEnabled = localLlmEnabled,
                localLlmAvailable = localLlmAvailable,
                claudeEnabled = claudeEnabled,
                claudeAvailable = claudeAvailable,
                ollamaEnabled = ollamaEnabled,
                ollamaAvailable = ollamaAvailable,
                timestamp = DateTime.UtcNow
            });
        }

        /// <summary>
        /// Get available Ollama models
        /// </summary>
        [HttpGet("models")]
        public async Task<IActionResult> GetModels()
        {
            var models = await _ollamaService.GetModelsAsync();
            return Ok(new { models, currentModel = _configuration["Ollama:Model"] ?? "llama3.2" });
        }

        /// <summary>
        /// Send a chat message and get a streaming response
        /// </summary>
        [HttpPost("chat")]
        public async Task Chat([FromBody] ChatRequest request)
        {
            Response.ContentType = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";

            try
            {
                var userMessage = request.Prompt ?? request.Messages?.LastOrDefault(m => m.Role == "user")?.Content ?? "";
                var userContext = await GetCurrentUserContext();

                // Provider priority: LocalLLM -> Claude -> Ollama -> Rule-based fallback
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                var fullResponse = new StringBuilder();

                if (useLocalLlm)
                {
                    _logger.LogInformation("Chat: Using Local LLM (Gemma 4) for user {User}", userContext?.FullName ?? "unknown");
                    await foreach (var token in _localLlmService.ChatStreamingAsync(userMessage, userContext, HttpContext.RequestAborted))
                    {
                        fullResponse.Append(token);
                        await WriteSSEToken(token);
                    }
                }
                else
                {
                    var claudeEnabled = _configuration.GetValue<bool>("Claude:Enabled", false);
                    var useClaude = claudeEnabled && await _claudeService.IsAvailableAsync();

                    if (useClaude)
                    {
                        _logger.LogInformation("Chat: Using Claude provider");
                        await foreach (var token in _claudeService.ChatStreamingAsync(userMessage, HttpContext.RequestAborted))
                        {
                            fullResponse.Append(token);
                            await WriteSSEToken(token);
                        }
                    }
                    else
                    {
                    var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", false);
                    var useOllama = ollamaEnabled && await _ollamaService.IsAvailableAsync();

                    if (useOllama)
                    {
                        _logger.LogInformation("Chat: Using Ollama provider");
                        var messages = request.Messages?.Select(m => new OllamaMessage
                        {
                            Role = m.Role,
                            Content = m.Content
                        }).ToList() ?? new List<OllamaMessage>();

                        if (messages.Count == 0 && !string.IsNullOrEmpty(request.Prompt))
                        {
                            messages.Add(new OllamaMessage { Role = "user", Content = request.Prompt });
                        }

                        await foreach (var token in _ollamaService.ChatStreamingAsync(messages, HttpContext.RequestAborted))
                        {
                            fullResponse.Append(token);
                            await WriteSSEToken(token);
                        }
                    }
                    else
                    {
                        // Fallback to rule-based service
                        _logger.LogInformation("Chat: Using rule-based fallback");
                        if (!_aiService.IsModelLoaded)
                        {
                            await WriteSSEMessage("AI service is still loading. Please wait a moment and try again.");
                            await WriteSSEDone();
                            return;
                        }

                        var messages = request.Messages?.Select(m => new ChatMessage
                        {
                            Role = m.Role,
                            Content = m.Content
                        }).ToList() ?? new List<ChatMessage>();

                        if (messages.Count == 0 && !string.IsNullOrEmpty(request.Prompt))
                        {
                            messages.Add(new ChatMessage { Role = "user", Content = request.Prompt });
                        }

                        await foreach (var token in _aiService.ChatStreamingAsync(messages, HttpContext.RequestAborted))
                        {
                            fullResponse.Append(token);
                            await WriteSSEToken(token);
                        }
                    }
                    }
                }

                // Process any AI-requested actions from the response
                if (userContext != null)
                {
                    await ProcessAndStreamActions(fullResponse.ToString(), userContext);
                }

                await WriteSSEDone();
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Chat request was cancelled");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during chat");
                await WriteSSEMessage("An error occurred while processing your request.");
                await WriteSSEDone();
            }
        }

        /// <summary>
        /// Simple non-streaming chat endpoint
        /// </summary>
        [HttpPost("chat/simple")]
        public async Task<IActionResult> ChatSimple([FromBody] ChatRequest request)
        {
            try
            {
                var userMessage = request.Prompt ?? request.Messages?.LastOrDefault(m => m.Role == "user")?.Content ?? "";

                // Provider priority: LocalLLM -> Claude -> Ollama -> Rule-based fallback
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                if (useLocalLlm)
                {
                    var response = await _localLlmService.ChatAsync(userMessage);
                    return Ok(new { response = response, provider = "local-llm" });
                }

                var claudeEnabled = _configuration.GetValue<bool>("Claude:Enabled", false);
                var useClaude = claudeEnabled && await _claudeService.IsAvailableAsync();

                if (useClaude)
                {
                    var response = await _claudeService.ChatAsync(userMessage);
                    return Ok(new { response = response, provider = "claude" });
                }

                var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", false);
                var useOllama = ollamaEnabled && await _ollamaService.IsAvailableAsync();

                if (useOllama)
                {
                    var messages = request.Messages?.Select(m => new OllamaMessage
                    {
                        Role = m.Role,
                        Content = m.Content
                    }).ToList() ?? new List<OllamaMessage>();

                    if (messages.Count == 0 && !string.IsNullOrEmpty(request.Prompt))
                    {
                        messages.Add(new OllamaMessage { Role = "user", Content = request.Prompt });
                    }

                    var response = await _ollamaService.ChatAsync(messages);
                    return Ok(new { response = response, provider = "ollama" });
                }
                else
                {
                    if (!_aiService.IsModelLoaded)
                    {
                        return Ok(new { response = "AI service is still loading. Please wait a moment and try again." });
                    }

                    var messages = request.Messages?.Select(m => new ChatMessage
                    {
                        Role = m.Role,
                        Content = m.Content
                    }).ToList() ?? new List<ChatMessage>();

                    if (messages.Count == 0 && !string.IsNullOrEmpty(request.Prompt))
                    {
                        messages.Add(new ChatMessage { Role = "user", Content = request.Prompt });
                    }

                    var response = await _aiService.ChatAsync(messages);
                    return Ok(new { response = response, provider = "fallback" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during chat");
                return StatusCode(500, new { error = "An error occurred while processing your request." });
            }
        }

        /// <summary>
        /// Session-based chat with conversation memory (streaming)
        /// Uses sessionId to maintain chat history across requests
        /// </summary>
        [HttpPost("chat/session")]
        public async Task ChatWithSession([FromBody] ChatRequest request)
        {
            Response.ContentType = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";

            try
            {
                // Generate session ID if not provided
                var sessionId = request.SessionId ?? Guid.NewGuid().ToString();
                
                // Get the user message and page context
                var userMessage = request.Prompt ?? request.Messages?.LastOrDefault(m => m.Role == "user")?.Content ?? "";
                var userContext = await GetCurrentUserContext();
                var pageContext = request.PageContext;
                
                if (string.IsNullOrWhiteSpace(userMessage))
                {
                    await WriteSSEMessage("Please provide a message.");
                    await WriteSSEDone();
                    return;
                }

                var fullResponse = new StringBuilder();

                // Provider priority: LocalLLM -> Claude -> Ollama -> Rule-based fallback
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                if (useLocalLlm)
                {
                    _logger.LogInformation("Session chat: Using Local LLM (Qwen2.5) for session {SessionId}, user {User}, page {Page}", sessionId, userContext?.FullName ?? "unknown", pageContext ?? "none");
                    await foreach (var token in _localLlmService.ChatStreamingWithSessionAsync(sessionId, userMessage, userContext, pageContext, HttpContext.RequestAborted))
                    {
                        fullResponse.Append(token);
                        await WriteSSEToken(token);
                    }
                    await WriteSSESessionId(sessionId);
                }
                else
                {
                    var claudeEnabled = _configuration.GetValue<bool>("Claude:Enabled", false);
                    var useClaude = claudeEnabled && await _claudeService.IsAvailableAsync();

                    if (useClaude)
                    {
                        _logger.LogInformation("Session chat: Using Claude provider for session {SessionId}", sessionId);
                        await foreach (var token in _claudeService.ChatStreamingWithSessionAsync(sessionId, userMessage, HttpContext.RequestAborted))
                        {
                            fullResponse.Append(token);
                            await WriteSSEToken(token);
                        }
                        await WriteSSESessionId(sessionId);
                    }
                    else
                    {
                    var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", false);
                    var useOllama = ollamaEnabled && await _ollamaService.IsAvailableAsync();

                    if (useOllama)
                    {
                        _logger.LogInformation("Session chat: Using Ollama provider for session {SessionId}", sessionId);
                        await foreach (var token in _ollamaService.ChatStreamingWithSessionAsync(sessionId, userMessage, HttpContext.RequestAborted))
                        {
                            fullResponse.Append(token);
                            await WriteSSEToken(token);
                        }
                        await WriteSSESessionId(sessionId);
                    }
                    else
                    {
                        // Fallback - no session support
                        _logger.LogInformation("Session chat: Using rule-based fallback");
                        if (!_aiService.IsModelLoaded)
                        {
                            await WriteSSEMessage("AI service is still loading. Please wait a moment and try again.");
                            await WriteSSEDone();
                            return;
                        }

                        var messages = new List<ChatMessage>
                        {
                            new ChatMessage { Role = "user", Content = userMessage }
                        };

                        await foreach (var token in _aiService.ChatStreamingAsync(messages, HttpContext.RequestAborted))
                        {
                            fullResponse.Append(token);
                            await WriteSSEToken(token);
                        }
                    }
                    }
                }

                // Process any AI-requested actions from the response
                if (userContext != null)
                {
                    await ProcessAndStreamActions(fullResponse.ToString(), userContext);
                }

                await WriteSSEDone();
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("Session chat request was cancelled");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during session chat");
                await WriteSSEMessage("An error occurred while processing your request.");
                await WriteSSEDone();
            }
        }

        /// <summary>
        /// Clear a chat session's history
        /// </summary>
        [HttpDelete("chat/session/{sessionId}")]
        public IActionResult ClearSession(string sessionId, [FromServices] IConversationMemoryService memoryService)
        {
            memoryService.ClearConversation(sessionId);
            return Ok(new { success = true, message = "Session cleared" });
        }

        /// <summary>
        /// Analyze a tender document with AI
        /// </summary>
        [HttpPost("analyze-document")]
        public async Task<IActionResult> AnalyzeDocument([FromForm] IFormFile file, [FromForm] string prompt, [FromForm] string? context)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "No file uploaded" });
                }

                var allowedTypes = new[]
                {
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
                    "application/vnd.ms-excel", // .xls
                    "text/csv",
                    "application/csv"
                };
                var allowedExtensions = new[] { ".pdf", ".xlsx", ".xls", ".csv" };
                var fileExt = Path.GetExtension(file.FileName).ToLowerInvariant();

                if (!allowedTypes.Contains(file.ContentType) && !allowedExtensions.Contains(fileExt))
                {
                    return BadRequest(new { error = "Only PDF, Excel (.xlsx/.xls), and CSV files are supported" });
                }

                // Max file size: 50MB for tender documents
                if (file.Length > 50 * 1024 * 1024)
                {
                    return BadRequest(new { error = "File size must be less than 50MB" });
                }

                // Extract text based on file type
                string documentText;
                if (fileExt == ".csv" || file.ContentType == "text/csv" || file.ContentType == "application/csv")
                {
                    documentText = await ExtractTextFromCsv(file);
                }
                else if (fileExt == ".xlsx" || fileExt == ".xls" || file.ContentType.Contains("spreadsheet") || file.ContentType.Contains("excel"))
                {
                    documentText = await ExtractTextFromExcel(file);
                }
                else
                {
                    documentText = await ExtractTextFromPdf(file);
                }

                if (string.IsNullOrWhiteSpace(documentText))
                {
                    return BadRequest(new { error = "No text could be extracted from the document" });
                }

                // Allow more text for tender analysis (up to 8000 chars)
                if (documentText.Length > 8000)
                {
                    documentText = documentText.Substring(0, 8000) + "\n\n[Document truncated for analysis...]";
                }

                // Build the analysis prompt
                var systemPrompt = @"You are an expert document analyzer. When analyzing documents, you can handle: 
- PDF documents (tenders, contracts, reports)
- Excel spreadsheets (data tables, financial reports, inventory lists)
- CSV files (data exports, lists, records)

For tender/procurement documents, focus on:
- Tender reference numbers and titles
- Issuing organization/department
- Key dates (closing date, briefing sessions, validity periods)
- Required compliance documents (CSD, Tax Clearance, B-BBEE, CIDB, COIDA, etc.)
- Mandatory requirements and specifications
- Evaluation criteria and weightings
- Budget/estimated values
- Special conditions or requirements

For Excel/CSV data, focus on:
- Summarizing the data structure (columns, row count)
- Key statistics (totals, averages, min/max)
- Identifying patterns or notable entries
- Answering the user's specific questions about the data

Format your responses clearly with sections and bullet points where appropriate.
Be specific and extract actual values from the document when available.";

                var userPrompt = $@"Document: {file.FileName}

{prompt}

--- DOCUMENT CONTENT ---
{documentText}";

                string aiResponse;
                string usedProvider;

                // Provider priority: LocalLLM -> Claude -> Ollama -> Rule-based fallback
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                if (useLocalLlm)
                {
                    aiResponse = await _localLlmService.AnalyzeDocumentAsync(systemPrompt, userPrompt);
                    usedProvider = "local-llm";
                }
                else
                {
                    var claudeEnabled = _configuration.GetValue<bool>("Claude:Enabled", false);
                    var useClaude = claudeEnabled && await _claudeService.IsAvailableAsync();

                    if (useClaude)
                    {
                        aiResponse = await _claudeService.AnalyzeDocumentAsync(systemPrompt, userPrompt);
                        usedProvider = "claude";
                    }
                    else
                    {
                    var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", false);
                    var useOllama = ollamaEnabled && await _ollamaService.IsAvailableAsync();

                    if (useOllama)
                    {
                        var messages = new List<OllamaMessage>
                        {
                            new OllamaMessage { Role = "system", Content = systemPrompt },
                            new OllamaMessage { Role = "user", Content = userPrompt }
                        };

                        aiResponse = await _ollamaService.ChatAsync(messages);
                        usedProvider = "ollama";
                    }
                    else
                    {
                        if (!_aiService.IsModelLoaded)
                        {
                            return Ok(new 
                            { 
                                response = "AI service is still loading. Please try again in a moment.",
                                provider = "none"
                            });
                        }

                        var messages = new List<ChatMessage>
                        {
                            new ChatMessage { Role = "user", Content = systemPrompt + "\n\n" + userPrompt }
                        };

                        aiResponse = await _aiService.ChatAsync(messages);
                        usedProvider = "fallback";
                    }
                    }
                }

                return Ok(new 
                { 
                    response = aiResponse,
                    fileName = file.FileName,
                    fileSize = file.Length,
                    provider = usedProvider
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing tender document");
                return StatusCode(500, new { error = "Failed to analyze document", details = ex.Message });
            }
        }

        /// <summary>
        /// Upload a PDF, Excel, or CSV file and get AI analysis
        /// </summary>
        [HttpPost("upload-pdf")]
        public async Task<IActionResult> UploadPdf([FromForm] IFormFile file, [FromForm] string message)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "No file uploaded" });
                }

                var allowedExtensions = new[] { ".pdf", ".xlsx", ".xls", ".csv" };
                var fileExt = Path.GetExtension(file.FileName).ToLowerInvariant();

                if (!allowedExtensions.Contains(fileExt))
                {
                    return BadRequest(new { error = "Only PDF, Excel (.xlsx/.xls), and CSV files are supported" });
                }

                // Max file size: 10MB
                if (file.Length > 10 * 1024 * 1024)
                {
                    return BadRequest(new { error = "File size must be less than 10MB" });
                }

                if (!_aiService.IsModelLoaded)
                {
                    return Ok(new 
                    { 
                        success = true, 
                        response = "AI service is still loading. The PDF was uploaded successfully but analysis is not yet available. Please try again in a moment.",
                        fileName = file.FileName,
                        fileSize = file.Length
                    });
                }

                // Extract text based on file type
                string documentText;
                if (fileExt == ".csv" || file.ContentType == "text/csv" || file.ContentType == "application/csv")
                {
                    documentText = await ExtractTextFromCsv(file);
                }
                else if (fileExt == ".xlsx" || fileExt == ".xls")
                {
                    documentText = await ExtractTextFromExcel(file);
                }
                else
                {
                    documentText = await ExtractTextFromPdf(file);
                }

                if (string.IsNullOrWhiteSpace(documentText))
                {
                    return BadRequest(new { error = "No text could be extracted from the document" });
                }

                // Truncate if too long (keep to ~4000 chars for better analysis)
                if (documentText.Length > 4000)
                {
                    documentText = documentText.Substring(0, 4000) + "\n\n[Document truncated due to length...]";
                }

                // Prepare the enhanced prompt for AI with clear markers
                var userQuestion = string.IsNullOrWhiteSpace(message) ? "Analyze this document" : message;
                var enhancedPrompt = $@"[Document: {file.FileName}]
{userQuestion}

--- DOCUMENT CONTENT ---
{documentText}";

                var messages = new List<ChatMessage>
                {
                    new ChatMessage { Role = "user", Content = enhancedPrompt }
                };

                var aiResponse = await _aiService.ChatAsync(messages);

                return Ok(new 
                { 
                    success = true, 
                    response = aiResponse,
                    fileName = file.FileName,
                    fileSize = file.Length,
                    extractedTextLength = documentText.Length
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing PDF");
                return StatusCode(500, new { error = "Failed to process PDF", details = ex.Message });
            }
        }

        private async Task<string> ExtractTextFromPdf(IFormFile file)
        {
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            var text = new StringBuilder();

            using (var pdfReader = new PdfReader(memoryStream))
            using (var pdfDocument = new PdfDocument(pdfReader))
            {
                for (int pageNum = 1; pageNum <= pdfDocument.GetNumberOfPages(); pageNum++)
                {
                    var page = pdfDocument.GetPage(pageNum);
                    var strategy = new SimpleTextExtractionStrategy();
                    var pageText = PdfTextExtractor.GetTextFromPage(page, strategy);
                    
                    text.AppendLine($"--- Page {pageNum} ---");
                    text.AppendLine(pageText);
                    text.AppendLine();
                }
            }

            return text.ToString();
        }

        private async Task<string> ExtractTextFromExcel(IFormFile file)
        {
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            var text = new StringBuilder();

            using (var workbook = new XLWorkbook(memoryStream))
            {
                foreach (var worksheet in workbook.Worksheets)
                {
                    text.AppendLine($"--- Sheet: {worksheet.Name} ---");

                    var usedRange = worksheet.RangeUsed();
                    if (usedRange == null)
                    {
                        text.AppendLine("(empty sheet)");
                        text.AppendLine();
                        continue;
                    }

                    var rows = usedRange.RowsUsed().ToList();
                    text.AppendLine($"Rows: {rows.Count}, Columns: {usedRange.ColumnCount()}");
                    text.AppendLine();

                    // Read header row
                    var firstRow = rows.FirstOrDefault();
                    if (firstRow != null)
                    {
                        var headers = new List<string>();
                        foreach (var cell in firstRow.CellsUsed())
                        {
                            headers.Add(cell.GetFormattedString());
                        }
                        text.AppendLine("| " + string.Join(" | ", headers) + " |");
                        text.AppendLine("| " + string.Join(" | ", headers.Select(_ => "---")) + " |");
                    }

                    // Read data rows (limit to first 200 rows to avoid token overflow)
                    var maxRows = Math.Min(rows.Count, 201); // 1 header + 200 data
                    for (int i = 1; i < maxRows; i++)
                    {
                        var row = rows[i];
                        var cells = new List<string>();
                        for (int col = usedRange.FirstColumn().ColumnNumber(); col <= usedRange.LastColumn().ColumnNumber(); col++)
                        {
                            cells.Add(row.Cell(col).GetFormattedString());
                        }
                        text.AppendLine("| " + string.Join(" | ", cells) + " |");
                    }

                    if (rows.Count > 201)
                    {
                        text.AppendLine($"\n[...{rows.Count - 201} more rows truncated...]");
                    }

                    text.AppendLine();
                }
            }

            return text.ToString();
        }

        private async Task<string> ExtractTextFromCsv(IFormFile file)
        {
            using var reader = new StreamReader(file.OpenReadStream());
            var text = new StringBuilder();
            text.AppendLine($"--- CSV: {file.FileName} ---");

            int rowCount = 0;
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                rowCount++;
                if (rowCount <= 201) // header + 200 rows
                {
                    // Convert CSV to markdown table
                    var cells = ParseCsvLine(line);
                    text.AppendLine("| " + string.Join(" | ", cells) + " |");

                    // Add separator after header row
                    if (rowCount == 1)
                    {
                        text.AppendLine("| " + string.Join(" | ", cells.Select(_ => "---")) + " |");
                    }
                }
            }

            if (rowCount > 201)
            {
                text.AppendLine($"\n[...{rowCount - 201} more rows truncated...]");
            }

            text.AppendLine($"\nTotal rows: {rowCount}");

            return text.ToString();
        }

        private static List<string> ParseCsvLine(string line)
        {
            var cells = new List<string>();
            bool inQuotes = false;
            var current = new StringBuilder();

            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                if (c == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++; // skip escaped quote
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == ',' && !inQuotes)
                {
                    cells.Add(current.ToString().Trim());
                    current.Clear();
                }
                else
                {
                    current.Append(c);
                }
            }
            cells.Add(current.ToString().Trim());

            return cells;
        }

        /// <summary>
        /// Analyze tender documents with Welly — reads uploaded files, extracts text, combines with BOQ data
        /// </summary>
        [HttpPost("tender-document-analyze")]
        public async Task<IActionResult> TenderDocumentAnalyze([FromBody] TenderDocumentAnalyzeRequest request)
        {
            try
            {
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                if (!useLocalLlm)
                    return StatusCode(503, new { error = "AI service is not available. Please try again later." });

                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var tender = await context.Tenders
                    .Include(t => t.Documents)
                    .Include(t => t.BOQItems)
                    .FirstOrDefaultAsync(t => t.Id == request.TenderId);

                if (tender == null)
                    return NotFound(new { error = "Tender not found" });

                // Get documents to analyze — if specific IDs provided, use those; otherwise use pricing-relevant types
                var documents = tender.Documents?.AsEnumerable() ?? Enumerable.Empty<Models.Tenders.TenderDocument>();
                if (request.DocumentIds != null && request.DocumentIds.Any())
                {
                    documents = documents.Where(d => request.DocumentIds.Contains(d.Id));
                }
                else
                {
                    // Auto-select pricing-relevant document types
                    var pricingTypes = new[] { "BOQ", "RFQ", "RFP", "FinancialProposal", "Pricing", "Addendum" };
                    documents = documents.Where(d => pricingTypes.Contains(d.DocumentType));
                    // If no pricing docs, try all documents
                    if (!documents.Any())
                        documents = tender.Documents?.AsEnumerable() ?? Enumerable.Empty<Models.Tenders.TenderDocument>();
                }

                var documentTexts = new StringBuilder();
                int docCount = 0;
                int totalChars = 0;
                const int maxTotalChars = 12000; // Leave room for BOQ data and system prompt

                foreach (var doc in documents)
                {
                    if (string.IsNullOrEmpty(doc.FilePath) || !System.IO.File.Exists(doc.FilePath))
                        continue;

                    try
                    {
                        string extractedText = string.Empty;
                        var ext = Path.GetExtension(doc.FileName).ToLowerInvariant();

                        if (ext == ".pdf")
                        {
                            extractedText = ExtractTextFromPdfFile(doc.FilePath);
                        }
                        else if (ext is ".xlsx" or ".xls")
                        {
                            extractedText = ExtractTextFromExcelFile(doc.FilePath);
                        }
                        else if (ext is ".csv")
                        {
                            extractedText = await ExtractTextFromCsvFile(doc.FilePath);
                        }
                        else if (ext is ".txt" or ".md" or ".text")
                        {
                            extractedText = await System.IO.File.ReadAllTextAsync(doc.FilePath);
                        }

                        if (!string.IsNullOrWhiteSpace(extractedText))
                        {
                            // Truncate if adding this would exceed limit
                            var available = maxTotalChars - totalChars;
                            if (available <= 200) break;

                            if (extractedText.Length > available)
                                extractedText = extractedText[..available] + "\n[...document truncated...]";

                            documentTexts.AppendLine($"\n══════ DOCUMENT: {doc.FileName} (Type: {doc.DocumentType}) ══════");
                            documentTexts.AppendLine(extractedText);
                            totalChars += extractedText.Length;
                            docCount++;
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to extract text from tender document {DocId}: {FileName}", doc.Id, doc.FileName);
                        documentTexts.AppendLine($"\n[Could not extract text from: {doc.FileName}]");
                    }
                }

                // Build BOQ summary
                var boqSummary = new StringBuilder();
                var boqItems = tender.BOQItems?.OrderBy(b => b.LineNumber).ToList() ?? new List<Models.Tenders.TenderBOQItem>();
                if (boqItems.Any())
                {
                    boqSummary.AppendLine("\n══════ CURRENT BOQ LINE ITEMS ══════");
                    foreach (var item in boqItems)
                    {
                        boqSummary.AppendLine($"Line {item.LineNumber}: {item.Description} | Code: {item.ItemCode ?? "N/A"} | Qty: {item.Quantity} {item.Unit} | Cost: R{item.UnitCost?.ToString("N2") ?? "N/A"} | Price: R{item.UnitPrice:N2} | Margin: {item.MarginPercent?.ToString("N1") ?? "N/A"}% | Total: R{item.TotalPrice:N2}");
                    }
                    var total = boqItems.Sum(b => b.TotalPrice);
                    var avgMargin = boqItems.Where(b => b.MarginPercent.HasValue).Select(b => b.MarginPercent!.Value).DefaultIfEmpty(0).Average();
                    boqSummary.AppendLine($"\nBOQ Total: R{total:N2} | Avg Margin: {avgMargin:N1}%");
                }

                // Choose analysis type and system prompt
                string systemPrompt;
                if (request.AnalysisType == "extract-boq")
                {
                    systemPrompt = @"You are Welly, an AI tender analyst for ProMed Technologies. You have been given the content of uploaded tender documents. 
Your task is to EXTRACT Bill of Quantities (BOQ) line items from these documents.

For each line item found, output it in this EXACT format (one per line):
[BOQ_ITEM] LineNumber | ItemCode | Description | Unit | Quantity | UnitCost | UnitPrice | MarginPercent

Rules:
- Use the line numbers from the document if available, otherwise number sequentially
- If a field is unknown, use 'N/A'
- UnitCost, UnitPrice should be numbers without currency symbols
- MarginPercent should be calculated as ((UnitPrice - UnitCost) / UnitPrice * 100) if both values are known
- After listing all items, provide a brief summary of what you found

Example:
[BOQ_ITEM] 1 | MED-001 | Surgical Gloves (Box of 100) | box | 500 | 45.00 | 65.00 | 30.8
[BOQ_ITEM] 2 | MED-002 | Disposable Masks (Box of 50) | box | 1000 | 22.00 | 35.00 | 37.1

Use ZAR for currency in summaries.";
                }
                else if (request.AnalysisType == "pricing-review")
                {
                    systemPrompt = @"You are Welly, an AI tender pricing specialist for ProMed Technologies. You have been given:
1. The actual tender documents (RFQ/RFP/BOQ files uploaded by the user)
2. The current BOQ line items entered in the system

Analyze the documents and provide a comprehensive pricing review:
1. **Document Insights** — Key pricing requirements, terms, or constraints found in the tender documents
2. **Price Comparison** — Compare document prices with current BOQ entries (if both exist)
3. **Missing Items** — BOQ items mentioned in documents but not yet in the system
4. **Pricing Risks** — Items that seem underpriced, overpriced, or have unusual quantities
5. **Margin Optimization** — Suggestions to improve overall margins while staying competitive
6. **Compliance Notes** — Any pricing format requirements or special conditions in the tender docs

Format with clear headings. Use ZAR for currency.";
                }
                else
                {
                    systemPrompt = @"You are Welly, an AI tender analyst for ProMed Technologies. You have been given:
1. The actual tender documents uploaded for this tender
2. The current BOQ line items

Analyze everything and provide insights:
1. **Document Summary** — Key information from the uploaded tender documents
2. **Pricing Analysis** — Are unit prices competitive? Flag any issues
3. **Margin Review** — Evaluate profit margins and suggest adjustments
4. **Risk Items** — Items with thin margins or high exposure
5. **Compliance** — Are required documents present? Any gaps?
6. **Recommendations** — Actionable next steps

Format with clear headings. Use ZAR for currency.";
                }

                var fullContent = new StringBuilder();
                fullContent.AppendLine($"Tender: {tender.TenderNumber} — {tender.Title}");
                fullContent.AppendLine($"Issuing Department: {tender.IssuingDepartment}");
                fullContent.AppendLine($"Status: {tender.Status} | Closing Date: {tender.ClosingDate:dd MMM yyyy}");
                fullContent.AppendLine($"Company: {tender.CompanyCode} | Province: {tender.Province}");
                
                if (docCount > 0)
                {
                    fullContent.AppendLine($"\n📄 {docCount} document(s) analyzed:");
                    fullContent.Append(documentTexts);
                }
                else
                {
                    fullContent.AppendLine("\n[No readable documents found for this tender]");
                }

                fullContent.Append(boqSummary);

                if (!string.IsNullOrWhiteSpace(request.UserQuestion))
                {
                    fullContent.AppendLine($"\n══════ USER QUESTION ══════\n{request.UserQuestion}");
                }

                var result = await _localLlmService.AnalyzeDocumentAsync(systemPrompt, fullContent.ToString(), HttpContext.RequestAborted);

                return Ok(new { 
                    result, 
                    analysisType = request.AnalysisType,
                    documentsAnalyzed = docCount,
                    boqItemCount = boqItems.Count
                });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { error = "Request was cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TenderDocumentAnalyze: Error analyzing tender {TenderId}", request.TenderId);
                return StatusCode(500, new { error = "Failed to analyze tender documents. Please try again." });
            }
        }

        /// <summary>
        /// Extract text from a PDF file on disk
        /// </summary>
        private string ExtractTextFromPdfFile(string filePath)
        {
            var text = new StringBuilder();
            using var pdfReader = new PdfReader(filePath);
            using var pdfDocument = new PdfDocument(pdfReader);

            for (int pageNum = 1; pageNum <= pdfDocument.GetNumberOfPages(); pageNum++)
            {
                var page = pdfDocument.GetPage(pageNum);
                var strategy = new SimpleTextExtractionStrategy();
                var pageText = PdfTextExtractor.GetTextFromPage(page, strategy);
                text.AppendLine($"--- Page {pageNum} ---");
                text.AppendLine(pageText);
                text.AppendLine();
            }

            return text.ToString();
        }

        /// <summary>
        /// Extract text from an Excel file on disk
        /// </summary>
        private string ExtractTextFromExcelFile(string filePath)
        {
            var text = new StringBuilder();
            using var workbook = new XLWorkbook(filePath);

            foreach (var worksheet in workbook.Worksheets)
            {
                text.AppendLine($"--- Sheet: {worksheet.Name} ---");
                var usedRange = worksheet.RangeUsed();
                if (usedRange == null)
                {
                    text.AppendLine("(empty sheet)");
                    continue;
                }

                var rows = usedRange.RowsUsed().ToList();
                var firstRow = rows.FirstOrDefault();
                if (firstRow != null)
                {
                    var headers = new List<string>();
                    foreach (var cell in firstRow.CellsUsed())
                        headers.Add(cell.GetFormattedString());
                    text.AppendLine("| " + string.Join(" | ", headers) + " |");
                    text.AppendLine("| " + string.Join(" | ", headers.Select(_ => "---")) + " |");
                }

                var maxRows = Math.Min(rows.Count, 201);
                for (int i = 1; i < maxRows; i++)
                {
                    var row = rows[i];
                    var cells = new List<string>();
                    for (int col = usedRange.FirstColumn().ColumnNumber(); col <= usedRange.LastColumn().ColumnNumber(); col++)
                        cells.Add(row.Cell(col).GetFormattedString());
                    text.AppendLine("| " + string.Join(" | ", cells) + " |");
                }

                if (rows.Count > 201)
                    text.AppendLine($"\n[...{rows.Count - 201} more rows truncated...]");
                text.AppendLine();
            }

            return text.ToString();
        }

        /// <summary>
        /// Extract text from a CSV file on disk
        /// </summary>
        private async Task<string> ExtractTextFromCsvFile(string filePath)
        {
            var text = new StringBuilder();
            text.AppendLine($"--- CSV ---");

            int rowCount = 0;
            using var reader = new StreamReader(filePath);
            string? line;
            while ((line = await reader.ReadLineAsync()) != null)
            {
                rowCount++;
                if (rowCount <= 201)
                {
                    var cells = ParseCsvLine(line);
                    text.AppendLine("| " + string.Join(" | ", cells) + " |");
                    if (rowCount == 1)
                        text.AppendLine("| " + string.Join(" | ", cells.Select(_ => "---")) + " |");
                }
            }

            if (rowCount > 201)
                text.AppendLine($"\n[...{rowCount - 201} more rows truncated...]");
            text.AppendLine($"\nTotal rows: {rowCount}");

            return text.ToString();
        }

        /// <summary>
        /// Generic Welly Assist endpoint for Doc Editor, Stock, Tenders, Messages
        /// </summary>
        [HttpPost("welly-assist")]
        public async Task<IActionResult> WellyAssist([FromBody] WellyAssistRequest request)
        {
            try
            {
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                if (!useLocalLlm)
                {
                    return StatusCode(503, new { error = "AI service is not available. Please try again later." });
                }

                var systemPrompt = request.AssistType switch
                {
                    // Document Editor actions
                    "grammar" => "You are Welly, an AI writing assistant. Fix all grammar, spelling, and punctuation errors in the provided text. Return ONLY the corrected text without any explanations or preamble.",
                    "summarize" => "You are Welly, an AI writing assistant. Provide a clear, concise summary of the following text. Use bullet points for key takeaways.",
                    "rewrite" => "You are Welly, an AI writing assistant. Rewrite the following text to be more professional, clear, and well-structured. Maintain the original meaning.",
                    "translate" => $"You are Welly, an AI translator. Translate the following text to {request.TargetLanguage ?? "Afrikaans"}. Return ONLY the translated text.",
                    "generate" => "You are Welly, an AI writing assistant for ProMed Technologies. Generate professional content based on the user's description. Be detailed and well-structured.",
                    "improve" => "You are Welly, an AI writing assistant. Improve the following text by enhancing clarity, flow, and professional tone while preserving the original meaning.",

                    // Stock Management actions
                    "analyze-stock" => @"You are Welly, an AI inventory analyst for ProMed Technologies. Analyze the provided warehouse stock data and provide actionable insights. Include:
1. **Critical Items** — Items below reorder level that need immediate restocking
2. **Slow-Moving Stock** — Items that may be overstocked based on quantity vs reorder patterns
3. **Reorder Recommendations** — Suggested reorder quantities
4. **Anomalies** — Any unusual patterns in the stock levels
Format your response with clear headings and bullet points. Use ZAR for currency.",

                    // Tender/BOQ actions
                    "analyze-boq" => @"You are Welly, an AI tender analyst for ProMed Technologies. Analyze the provided Bill of Quantities (BOQ) data and provide insights:
1. **Pricing Analysis** — Are unit prices competitive? Flag any unusually high or low items
2. **Margin Review** — Evaluate profit margins and suggest adjustments
3. **Risk Items** — Items with thin margins or high total cost exposure
4. **Recommendations** — Overall BOQ optimization suggestions
Format with clear headings. Use ZAR for currency.",
                    "check-compliance" => @"You are Welly, an AI compliance assistant for ProMed Technologies. Review the tender details and check for compliance readiness:
1. **Documentation Status** — Are all required documents in place?
2. **Team Readiness** — Is the team properly assigned?
3. **Timeline Risks** — Any deadline concerns?
4. **Missing Requirements** — What might be missing for submission?
Be specific and actionable.",

                    // Messages actions
                    "draft-message" => "You are Welly, an AI assistant helping compose internal messages at ProMed Technologies. Draft a professional yet friendly message based on the user's description. Keep it concise and appropriate for workplace communication.",
                    "translate-message" => $"You are Welly, an AI translator. Translate the following message to {request.TargetLanguage ?? "Afrikaans"}. Keep the tone appropriate for workplace messaging. Return ONLY the translated text.",
                    "summarize-messages" => "You are Welly, an AI assistant. Summarize the following conversation thread, highlighting key decisions, action items, and important information. Use bullet points.",

                    // OCR cleanup
                    "ocr-cleanup" => @"You are Welly, an AI document assistant. The following text was extracted from a scanned document using OCR and may contain errors, garbled characters, or formatting issues. Please:
1. Fix any obvious OCR errors, misspellings, and garbled text
2. Reconstruct proper paragraphs and sentence structure
3. Preserve the original meaning and content as closely as possible
4. Format the output as clean, well-structured HTML using <h1>, <h2>, <h3> for headings, <p> for paragraphs, <ul>/<li> for lists, and <strong> for emphasis
5. Remove any artifacts like random symbols, repeated characters, or page numbers
6. If the text contains tables, try to reconstruct them using <table>, <tr>, <td> tags
Return ONLY the cleaned HTML content, no explanations or preamble.",

                    // Document email compose
                    "compose-email" => @"You are Welly, an AI assistant for ProMed Technologies. Help compose a professional email to accompany a document being shared. The user will describe what they want to say and may include context about the document. Write a clear, concise, professional email body. Do NOT include subject lines, greetings like 'Dear', or sign-offs — just the message content. Keep it workplace-appropriate and friendly.",

                    _ => "You are Welly, a helpful AI assistant for ProMed Technologies. Help the user with their request."
                };

                var result = await _localLlmService.AnalyzeDocumentAsync(systemPrompt, request.Content, HttpContext.RequestAborted);

                return Ok(new { result = result, assistType = request.AssistType });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { error = "Request was cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WellyAssist: Error processing {AssistType} request", request.AssistType);
                return StatusCode(500, new { error = "Failed to process AI request. Please try again." });
            }
        }

        /// <summary>
        /// Comprehensive stock analysis with charts — pulls BuildingInventory + Invoices + TripSheets
        /// </summary>
        [HttpPost("welly-stock-comprehensive")]
        public async Task<IActionResult> WellyStockComprehensive([FromBody] ComprehensiveStockRequest request)
        {
            try
            {
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                if (!useLocalLlm)
                    return StatusCode(503, new { error = "AI service is not available. Please try again later." });

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // 1. Get warehouse
                var warehouse = await db.Warehouses.FindAsync(request.WarehouseId);
                if (warehouse == null)
                    return NotFound(new { error = "Warehouse not found" });

                // 2. Get buildings with inventory
                var buildings = await db.WarehouseBuildings
                    .Where(b => b.WarehouseId == request.WarehouseId && b.IsActive)
                    .Include(b => b.Inventory)
                    .ToListAsync();

                var allInventory = buildings.SelectMany(b => b.Inventory).ToList();

                // 3. Get loads/tripsheets for this warehouse
                var loads = await db.Loads
                    .Where(l => l.WarehouseId == request.WarehouseId)
                    .ToListAsync();

                // 4. Get invoices linked to loads for this warehouse
                var invoices = await db.Invoices
                    .Where(i => i.Load != null && i.Load.WarehouseId == request.WarehouseId)
                    .Include(i => i.LineItems)
                    .ToListAsync();

                // Also get invoices from ImportedInvoices linked to this warehouse's loads
                var loadIds = loads.Select(l => l.Id).ToList();
                var importedInvoices = loadIds.Any()
                    ? await db.ImportedInvoices
                        .Where(ii => ii.LoadId != null && loadIds.Contains(ii.LoadId.Value))
                        .ToListAsync()
                    : new List<Models.Logistics.ImportedInvoice>();

                // ─── Compute chart data ───

                // Chart 1: Stock Value by Building (pie)
                var stockByBuilding = buildings
                    .Select(b => new
                    {
                        label = b.Name,
                        value = Math.Round((double)b.Inventory.Sum(i => i.QuantityOnHand * (i.UnitCost ?? 0m)), 2)
                    })
                    .Where(x => x.value > 0)
                    .OrderByDescending(x => x.value)
                    .ToList();

                // Chart 2: Top 10 Items by Stock Value (bar)
                var topItems = allInventory
                    .Where(i => i.QuantityOnHand > 0 && (i.UnitCost ?? 0) > 0)
                    .OrderByDescending(i => i.QuantityOnHand * (i.UnitCost ?? 0))
                    .Take(10)
                    .Select(i => new
                    {
                        label = i.ItemCode.Length > 15 ? i.ItemCode.Substring(0, 15) : i.ItemCode,
                        value = Math.Round((double)(i.QuantityOnHand * (i.UnitCost ?? 0)), 2)
                    })
                    .ToList();

                // Chart 3: Invoice Status (pie)
                var invoiceStatus = invoices
                    .GroupBy(i => i.Status ?? "Unknown")
                    .Select(g => new { label = g.Key, value = (double)g.Count() })
                    .OrderByDescending(x => x.value)
                    .ToList();

                // Chart 4: TripSheet/Load Status (pie)
                var loadStatus = loads
                    .GroupBy(l => l.Status ?? "Unknown")
                    .Select(g => new { label = g.Key, value = (double)g.Count() })
                    .OrderByDescending(x => x.value)
                    .ToList();

                // ─── Build LLM context ───
                var contentBuilder = new StringBuilder();
                contentBuilder.AppendLine($"=== WAREHOUSE: {warehouse.Name} ===");
                contentBuilder.AppendLine($"Province: {warehouse.Province ?? "N/A"}");
                contentBuilder.AppendLine($"City: {warehouse.City ?? "N/A"}");
                contentBuilder.AppendLine($"Buildings: {buildings.Count}");

                // Inventory summary
                var totalValue = allInventory.Sum(i => i.QuantityOnHand * (i.UnitCost ?? 0m));
                var itemsWithStock = allInventory.Count(i => i.QuantityOnHand > 0);
                var lowStockItems = allInventory.Where(i => i.ReorderLevel.HasValue && i.ReorderLevel > 0 && i.QuantityOnHand <= i.ReorderLevel).ToList();

                contentBuilder.AppendLine($"\n=== INVENTORY SUMMARY ===");
                contentBuilder.AppendLine($"Total SKUs: {allInventory.Count}");
                contentBuilder.AppendLine($"Items with stock: {itemsWithStock}");
                contentBuilder.AppendLine($"Total stock value: R{totalValue:N2}");
                contentBuilder.AppendLine($"Low stock items (at or below reorder level): {lowStockItems.Count}");

                if (lowStockItems.Any())
                {
                    contentBuilder.AppendLine("\nCritical low-stock items:");
                    foreach (var item in lowStockItems.Take(20))
                    {
                        var bldg = buildings.FirstOrDefault(b => b.Id == item.BuildingId);
                        contentBuilder.AppendLine($"  - [{bldg?.Code ?? "?"}] {item.ItemCode}: {item.ItemDescription ?? "N/A"}, QTY={item.QuantityOnHand}, Reorder={item.ReorderLevel}, UOM={item.Uom}");
                    }
                }

                // Per-building breakdown
                foreach (var building in buildings)
                {
                    var inv = building.Inventory;
                    var bldgValue = inv.Sum(i => i.QuantityOnHand * (i.UnitCost ?? 0m));
                    contentBuilder.AppendLine($"\n--- {building.Name} ({building.Code}) ---");
                    contentBuilder.AppendLine($"  Total items: {inv.Count}, With stock: {inv.Count(i => i.QuantityOnHand > 0)}, Value: R{bldgValue:N2}");
                }

                // Invoice data
                contentBuilder.AppendLine($"\n=== INVOICES ({invoices.Count} total) ===");
                if (invoices.Any())
                {
                    foreach (var grp in invoices.GroupBy(i => i.Status))
                    {
                        contentBuilder.AppendLine($"  {grp.Key}: {grp.Count()} invoices, total R{grp.Sum(i => i.Total):N2}");
                    }
                    contentBuilder.AppendLine($"  Outstanding amount: R{invoices.Where(i => i.Status == "Unpaid" || i.Status == "Overdue" || i.Status == "Partially Paid").Sum(i => i.Total - i.AmountPaid):N2}");
                }
                else
                {
                    contentBuilder.AppendLine("  No invoices linked to this warehouse.");
                }

                // TripSheet/Load data
                contentBuilder.AppendLine($"\n=== TRIPSHEETS / LOADS ({loads.Count} total) ===");
                if (loads.Any())
                {
                    foreach (var grp in loads.GroupBy(l => l.Status))
                    {
                        contentBuilder.AppendLine($"  {grp.Key}: {grp.Count()} loads");
                    }
                    var delivered = loads.Count(l => l.Status == "Delivered");
                    var total = loads.Count;
                    contentBuilder.AppendLine($"  Delivery rate: {(total > 0 ? (delivered * 100.0 / total).ToString("F1") : "0")}%");
                }
                else
                {
                    contentBuilder.AppendLine("  No tripsheets linked to this warehouse.");
                }

                // Imported invoices summary
                if (importedInvoices.Any())
                {
                    contentBuilder.AppendLine($"\n=== IMPORTED ERP INVOICES ({importedInvoices.Count} total) ===");
                    contentBuilder.AppendLine($"  Total sales value: R{importedInvoices.Sum(ii => ii.SalesAmount):N2}");
                    contentBuilder.AppendLine($"  Net sales: R{importedInvoices.Sum(ii => ii.NetSales):N2}");
                }

                // ─── Call LLM ───
                var systemPrompt = @"You are Welly, an AI inventory and logistics analyst for ProMed Technologies (medical supplies). Analyze the comprehensive warehouse data below covering inventory, invoices, and tripsheets/deliveries.

Provide a structured analysis with these sections:
1. **Stock Health Overview** — Overall inventory status, utilization rate, stock coverage
2. **Critical Items** — Items below reorder level needing immediate restocking
3. **Stock Value Analysis** — Value distribution across buildings, high-value items to watch
4. **Invoice & Revenue Insights** — Payment status, outstanding amounts, collection priorities
5. **Logistics Performance** — Delivery completion rate, pending dispatches, fulfillment efficiency
6. **Top Recommendations** — 3-5 actionable steps to improve operations

Use ZAR (R) for currency. Be concise, use bullet points. Focus on actionable insights.";

                var analysis = await _localLlmService.AnalyzeDocumentAsync(systemPrompt, contentBuilder.ToString(), HttpContext.RequestAborted);

                // ─── Return response ───
                return Ok(new
                {
                    analysis,
                    charts = new
                    {
                        stockByBuilding = new { labels = stockByBuilding.Select(x => x.label), values = stockByBuilding.Select(x => x.value) },
                        topItems = new { labels = topItems.Select(x => x.label), values = topItems.Select(x => x.value) },
                        invoiceStatus = new { labels = invoiceStatus.Select(x => x.label), values = invoiceStatus.Select(x => x.value) },
                        loadStatus = new { labels = loadStatus.Select(x => x.label), values = loadStatus.Select(x => x.value) }
                    },
                    summary = new
                    {
                        totalSkus = allInventory.Count,
                        itemsWithStock,
                        totalStockValue = Math.Round((double)totalValue, 2),
                        lowStockCount = lowStockItems.Count,
                        totalInvoices = invoices.Count,
                        invoiceValue = Math.Round((double)invoices.Sum(i => i.Total), 2),
                        outstandingAmount = Math.Round((double)invoices.Where(i => i.Status == "Unpaid" || i.Status == "Overdue" || i.Status == "Partially Paid").Sum(i => i.Total - i.AmountPaid), 2),
                        totalLoads = loads.Count,
                        deliveredLoads = loads.Count(l => l.Status == "Delivered"),
                        deliveryRate = loads.Count > 0 ? Math.Round(loads.Count(l => l.Status == "Delivered") * 100.0 / loads.Count, 1) : 0
                    }
                });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { error = "Request was cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WellyStockComprehensive: Error processing comprehensive stock analysis");
                return StatusCode(500, new { error = "Failed to analyze stock data. Please try again." });
            }
        }

        /// <summary>
        /// Welly Sales Report — generates AI-powered sales reports with charts
        /// </summary>
        [HttpPost("welly-sales-report")]
        public async Task<IActionResult> WellySalesReport([FromBody] SalesReportRequest request)
        {
            try
            {
                var localLlmEnabled = _configuration.GetValue<bool>("LocalLlm:Enabled", true);
                var useLocalLlm = localLlmEnabled && await _localLlmService.IsAvailableAsync();

                if (!useLocalLlm)
                    return StatusCode(503, new { error = "AI service is not available. Please try again later." });

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var fromDate = request.FromDate ?? DateTime.UtcNow.AddDays(-30);
                var toDate = request.ToDate ?? DateTime.UtcNow;
                var reportType = request.ReportType ?? "sales-summary";

                // ─── Check report cache first ───
                try
                {
                    var cached = await _reportCacheService.GetCachedReportAsync(reportType, fromDate, toDate);
                    if (cached != null)
                    {
                        _logger.LogInformation("WellySalesReport: Cache HIT for {ReportType} ({From:dd MMM} → {To:dd MMM}). Original generation took {Ms}ms, hit #{HitCount}",
                            reportType, fromDate, toDate, cached.OriginalGenerationTimeMs, cached.HitCount);

                        var cachedResult = JsonSerializer.Deserialize<JsonElement>(cached.ResultJson);
                        return Ok(new
                        {
                            analysis = cachedResult.GetProperty("analysis").GetString(),
                            reportType = cachedResult.GetProperty("reportType").GetString(),
                            charts = cachedResult.GetProperty("charts"),
                            summary = cachedResult.GetProperty("summary"),
                            fromCache = true,
                            cachedAt = cached.GeneratedAt,
                            originalGenerationMs = cached.OriginalGenerationTimeMs,
                            cacheHitCount = cached.HitCount
                        });
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "WellySalesReport: Cache lookup failed, proceeding with fresh generation");
                }

                // ─── Cache MISS — generate fresh report ───
                var stopwatch = Stopwatch.StartNew();

                // Pull all imported invoices within the date range
                var invoices = await db.ImportedInvoices
                    .Where(i => i.TransactionDate >= fromDate && i.TransactionDate <= toDate)
                    .ToListAsync();

                // Pull customers
                var customers = await db.LogisticsCustomers
                    .ToListAsync();

                // Pull order cancellations within range
                var cancellations = await db.OrderCancellations
                    .Where(c => c.CancelledAt >= fromDate && c.CancelledAt <= toDate)
                    .ToListAsync();

                // ─── Compute data per report type ───

                // Chart 1: Sales by Company (always computed)
                var salesByCompany = invoices
                    .GroupBy(i => i.SourceCompany ?? "Unknown")
                    .Select(g => new { label = MapCompanyCode(g.Key), value = Math.Round((double)g.Sum(i => i.SalesAmount), 2) })
                    .Where(x => x.value > 0)
                    .OrderByDescending(x => x.value)
                    .ToList();

                // Chart 2: Top 10 Customers by Revenue
                var topCustomers = invoices
                    .GroupBy(i => i.CustomerName ?? "Unknown")
                    .Select(g => new { label = g.Key.Length > 25 ? g.Key.Substring(0, 25) + "…" : g.Key, value = Math.Round((double)g.Sum(i => i.SalesAmount), 2) })
                    .OrderByDescending(x => x.value)
                    .Take(10)
                    .ToList();

                // Chart 3: Sales by Province
                var customerProvinceMap = customers
                    .Where(c => !string.IsNullOrEmpty(c.CustomerCode))
                    .GroupBy(c => c.CustomerCode!)
                    .ToDictionary(g => g.Key, g => g.First().Province ?? "Unknown");
                var salesByProvince = invoices
                    .GroupBy(i => {
                        if (!string.IsNullOrEmpty(i.DeliveryProvince)) return i.DeliveryProvince;
                        customerProvinceMap.TryGetValue(i.CustomerNumber, out var province);
                        return province ?? "Unknown";
                    })
                    .Select(g => new { label = g.Key, value = Math.Round((double)g.Sum(i => i.SalesAmount), 2) })
                    .Where(x => x.label != "Unknown" || x.value > 0)
                    .OrderByDescending(x => x.value)
                    .ToList();

                // Chart 4: Top 10 Products by Revenue
                var topProducts = invoices
                    .GroupBy(i => i.ProductDescription ?? "Unknown")
                    .Select(g => new { label = g.Key.Length > 30 ? g.Key.Substring(0, 30) + "…" : g.Key, value = Math.Round((double)g.Sum(i => i.SalesAmount), 2) })
                    .OrderByDescending(x => x.value)
                    .Take(10)
                    .ToList();

                // Chart 5: Daily Sales Trend
                var dailySales = invoices
                    .GroupBy(i => i.TransactionDate.Date)
                    .OrderBy(g => g.Key)
                    .Select(g => new { label = g.Key.ToString("dd MMM"), value = Math.Round((double)g.Sum(i => i.SalesAmount), 2) })
                    .ToList();

                // Chart 6: Cancellation Stats (pie)
                var cancellationsByReason = cancellations
                    .GroupBy(c => c.CancellationReason ?? "Other")
                    .Select(g => new { label = g.Key, value = (double)g.Count() })
                    .OrderByDescending(x => x.value)
                    .ToList();

                // ─── Build LLM context ───
                var contentBuilder = new StringBuilder();
                contentBuilder.AppendLine($"=== SALES REPORT: {reportType.ToUpper()} ===");
                contentBuilder.AppendLine($"Period: {fromDate:dd MMM yyyy} to {toDate:dd MMM yyyy}");
                contentBuilder.AppendLine($"Total Invoices: {invoices.Count}");
                contentBuilder.AppendLine($"Total Revenue: R{invoices.Sum(i => i.SalesAmount):N2}");
                contentBuilder.AppendLine($"Net Sales: R{invoices.Sum(i => i.SalesAmount - i.SalesReturns):N2}");
                contentBuilder.AppendLine($"Cost of Sales: R{invoices.Sum(i => i.CostOfSales):N2}");
                contentBuilder.AppendLine($"Gross Profit: R{invoices.Sum(i => i.SalesAmount - i.SalesReturns - i.CostOfSales):N2}");
                contentBuilder.AppendLine($"Total Returns: R{invoices.Sum(i => i.SalesReturns):N2}");
                contentBuilder.AppendLine($"Total Customers Transacted: {invoices.Select(i => i.CustomerNumber).Distinct().Count()}");
                contentBuilder.AppendLine($"Total Products Sold: {invoices.Select(i => i.ProductCode).Distinct().Count()}");

                // Company breakdown
                contentBuilder.AppendLine("\n=== SALES BY DIVISION ===");
                foreach (var grp in invoices.GroupBy(i => i.SourceCompany ?? "Unknown").OrderByDescending(g => g.Sum(i => i.SalesAmount)))
                {
                    var companyName = MapCompanyCode(grp.Key);
                    contentBuilder.AppendLine($"  {companyName}: R{grp.Sum(i => i.SalesAmount):N2} ({grp.Count()} invoices), Returns: R{grp.Sum(i => i.SalesReturns):N2}");
                }

                // Top customers
                contentBuilder.AppendLine("\n=== TOP 10 CUSTOMERS ===");
                foreach (var cust in invoices.GroupBy(i => i.CustomerName).OrderByDescending(g => g.Sum(i => i.SalesAmount)).Take(10))
                {
                    contentBuilder.AppendLine($"  {cust.Key}: R{cust.Sum(i => i.SalesAmount):N2} ({cust.Count()} transactions)");
                }

                // Province breakdown
                if (salesByProvince.Any(x => x.label != "Unknown"))
                {
                    contentBuilder.AppendLine("\n=== SALES BY PROVINCE ===");
                    foreach (var prov in salesByProvince.Where(x => x.label != "Unknown"))
                    {
                        contentBuilder.AppendLine($"  {prov.label}: R{prov.value:N2}");
                    }
                }

                // Top products
                contentBuilder.AppendLine("\n=== TOP 10 PRODUCTS ===");
                foreach (var prod in invoices.GroupBy(i => i.ProductDescription).OrderByDescending(g => g.Sum(i => i.SalesAmount)).Take(10))
                {
                    contentBuilder.AppendLine($"  {prod.Key}: R{prod.Sum(i => i.SalesAmount):N2} ({prod.Sum(i => i.Quantity)} units)");
                }

                // Cancellations
                if (cancellations.Any())
                {
                    contentBuilder.AppendLine($"\n=== ORDER CANCELLATIONS ({cancellations.Count}) ===");
                    contentBuilder.AppendLine($"  Total cancellation value: R{cancellations.Sum(c => c.OrderAmount):N2}");
                    contentBuilder.AppendLine($"  Pending approval: {cancellations.Count(c => c.ApprovalStatus == "Pending")}");
                    contentBuilder.AppendLine($"  Approved: {cancellations.Count(c => c.ApprovalStatus == "Approved")}");
                    foreach (var reason in cancellations.GroupBy(c => c.CancellationReason).OrderByDescending(g => g.Count()))
                    {
                        contentBuilder.AppendLine($"  {reason.Key ?? "Other"}: {reason.Count()} cancellations");
                    }
                }

                // ─── Select LLM prompt based on report type ───
                var systemPrompt = reportType switch
                {
                    "sales-summary" => @"You are Welly, an AI sales analyst for ProMed Technologies (medical supplies, 4 divisions: Promed Technologies, Access Medical, Pharmatech, Sebenzani Trading). Generate a comprehensive Sales Summary Report.

Include:
1. **Executive Summary** — Key figures, overall trend
2. **Division Performance** — How each company is performing, relative strengths
3. **Revenue Analysis** — Total vs net sales, margins, returns impact
4. **Key Highlights** — Notable achievements or concerns
5. **Recommendations** — 3-5 actionable steps to boost sales

Use ZAR (R) currency. Be concise with bullet points. Focus on insights, not just restating numbers.",

                    "customer-analysis" => @"You are Welly, an AI sales analyst for ProMed Technologies. Generate a Customer Analysis Report.

Include:
1. **Customer Overview** — Total active customers, concentration risk
2. **Top Customers** — Revenue leaders, dependency analysis
3. **Customer Segments** — Group by revenue tiers (platinum, gold, silver, bronze)
4. **Growth Opportunities** — Under-penetrated customers, cross-sell potential
5. **Risk Factors** — Customer concentration, any declining accounts
6. **Recommendations** — Customer retention and growth strategies

Use ZAR (R) currency. Focus on strategic insights.",

                    "province-breakdown" => @"You are Welly, an AI sales analyst for ProMed Technologies. Generate a Geographic/Province Sales Breakdown Report.

Include:
1. **Provincial Overview** — Sales distribution across South African provinces
2. **Regional Performance** — Top and bottom performing regions
3. **Market Penetration** — Coverage gaps, underserved areas
4. **Division by Region** — Which companies are strong/weak in which provinces
5. **Growth Opportunities** — Expansion targets
6. **Recommendations** — Regional sales strategy

Use ZAR (R) currency. Reference SA province names.",

                    "product-performance" => @"You are Welly, an AI sales analyst for ProMed Technologies (medical supplies). Generate a Product Performance Report.

Include:
1. **Product Overview** — Total unique products sold, revenue concentration
2. **Top Performers** — Best-selling products by revenue and volume
3. **Margin Analysis** — Products with best/worst cost-of-sales ratio
4. **Product Mix** — Distribution across product categories
5. **Slow Movers** — Products with declining or low sales
6. **Recommendations** — Product strategy, stock optimization

Use ZAR (R) currency. Focus on actionable product insights.",

                    _ => @"You are Welly, an AI sales analyst for ProMed Technologies. Analyze the sales data and provide a comprehensive report with key insights, trends, and recommendations. Use ZAR (R) currency."
                };

                var analysis = await _localLlmService.AnalyzeDocumentAsync(systemPrompt, contentBuilder.ToString(), HttpContext.RequestAborted);

                stopwatch.Stop();
                var generationTimeMs = (int)stopwatch.ElapsedMilliseconds;

                // ─── Compute summary metrics ───
                var totalRevenue = (double)invoices.Sum(i => i.SalesAmount);
                var netSales = (double)invoices.Sum(i => i.SalesAmount - i.SalesReturns);
                var grossProfit = (double)invoices.Sum(i => i.SalesAmount - i.SalesReturns - i.CostOfSales);
                var marginPct = netSales > 0 ? Math.Round(grossProfit / netSales * 100, 1) : 0;

                var result = new
                {
                    analysis,
                    reportType,
                    charts = new
                    {
                        salesByCompany = new { labels = salesByCompany.Select(x => x.label), values = salesByCompany.Select(x => x.value) },
                        topCustomers = new { labels = topCustomers.Select(x => x.label), values = topCustomers.Select(x => x.value) },
                        salesByProvince = new { labels = salesByProvince.Select(x => x.label), values = salesByProvince.Select(x => x.value) },
                        topProducts = new { labels = topProducts.Select(x => x.label), values = topProducts.Select(x => x.value) },
                        dailySales = new { labels = dailySales.Select(x => x.label), values = dailySales.Select(x => x.value) },
                        cancellationsByReason = new { labels = cancellationsByReason.Select(x => x.label), values = cancellationsByReason.Select(x => x.value) }
                    },
                    summary = new
                    {
                        totalInvoices = invoices.Count,
                        totalRevenue = Math.Round(totalRevenue, 2),
                        netSales = Math.Round(netSales, 2),
                        grossProfit = Math.Round(grossProfit, 2),
                        marginPercent = marginPct,
                        totalReturns = Math.Round((double)invoices.Sum(i => i.SalesReturns), 2),
                        uniqueCustomers = invoices.Select(i => i.CustomerNumber).Distinct().Count(),
                        uniqueProducts = invoices.Select(i => i.ProductCode).Distinct().Count(),
                        totalCancellations = cancellations.Count,
                        cancellationValue = Math.Round((double)cancellations.Sum(c => c.OrderAmount), 2)
                    }
                };

                // ─── Store in cache for next time ───
                try
                {
                    var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "system";
                    await _reportCacheService.StoreCachedReportAsync(reportType, fromDate, toDate, result, generationTimeMs, userName);
                    _logger.LogInformation("WellySalesReport: Cached {ReportType} report ({From:dd MMM} → {To:dd MMM}). Generation took {Ms}ms",
                        reportType, fromDate, toDate, generationTimeMs);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "WellySalesReport: Failed to cache report, returning fresh result anyway");
                }

                return Ok(new
                {
                    result.analysis,
                    result.reportType,
                    result.charts,
                    result.summary,
                    fromCache = false,
                    generationTimeMs
                });
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { error = "Request was cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "WellySalesReport: Error processing {ReportType} report", request.ReportType);
                return StatusCode(500, new { error = "Failed to generate sales report. Please try again." });
            }
        }

        private static string MapCompanyCode(string code) => code switch
        {
            "PMT" => "Promed Technologies",
            "ACM" => "Access Medical",
            "PHT" => "Pharmatech",
            "SBT" => "Sebenzani Trading",
            _ => code
        };

        private async Task WriteSSEToken(string token)
        {
            var data = JsonSerializer.Serialize(new { token = token });
            await Response.WriteAsync($"data: {data}\n\n");
            await Response.Body.FlushAsync();
        }

        private async Task WriteSSEMessage(string message)
        {
            var data = JsonSerializer.Serialize(new { message = message });
            await Response.WriteAsync($"data: {data}\n\n");
            await Response.Body.FlushAsync();
        }

        private async Task WriteSSEDone()
        {
            await Response.WriteAsync("data: [DONE]\n\n");
            await Response.Body.FlushAsync();
        }

        private async Task WriteSSESessionId(string sessionId)
        {
            var data = JsonSerializer.Serialize(new { sessionId = sessionId });
            await Response.WriteAsync($"data: {data}\n\n");
            await Response.Body.FlushAsync();
        }

        /// <summary>
        /// Extract the logged-in user's details from JWT claims + database
        /// </summary>
        private async Task<ChatUserContext?> GetCurrentUserContext()
        {
            try
            {
                var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdStr) || !int.TryParse(userIdStr, out var userId))
                    return null;

                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                var user = await db.Users
                    .Include(u => u.Department)
                    .FirstOrDefaultAsync(u => u.UserId == userId);

                if (user == null) return null;

                return new ChatUserContext
                {
                    UserId = user.UserId,
                    Name = user.Name,
                    Surname = user.Surname,
                    Email = user.Email,
                    Role = user.Role,
                    DepartmentId = user.DepartmentId,
                    Department = user.Department?.Name ?? ""
                };
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve user context from JWT");
                return null;
            }
        }

        /// <summary>
        /// Process action tags in AI response and stream action results as SSE events
        /// </summary>
        private async Task ProcessAndStreamActions(string fullResponse, ChatUserContext userContext)
        {
            try
            {
                var actions = await _actionService.ProcessActionsAsync(fullResponse, userContext);
                foreach (var action in actions)
                {
                    var data = JsonSerializer.Serialize(new
                    {
                        action = new
                        {
                            type = action.ActionType,
                            success = action.Success,
                            message = action.Message,
                            entityId = action.EntityId
                        }
                    });
                    await Response.WriteAsync($"data: {data}\n\n");
                    await Response.Body.FlushAsync();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing AI actions");
            }
        }
    }

    public class ChatRequest
    {
        public string? Prompt { get; set; }
        public string? SessionId { get; set; }
        public string? PageContext { get; set; }
        public List<ChatMessageDto>? Messages { get; set; }
        public ChatOptions? Options { get; set; }
    }

    public class ChatMessageDto
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class ChatOptions
    {
        public float Temperature { get; set; } = 0.7f;
        public int MaxTokens { get; set; } = 512;
    }

    public class WellyAssistRequest
    {
        public string AssistType { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? TargetLanguage { get; set; }
    }

    public class ComprehensiveStockRequest
    {
        public int WarehouseId { get; set; }
    }

    public class SalesReportRequest
    {
        public string? ReportType { get; set; } // sales-summary, customer-analysis, province-breakdown, product-performance
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }

    public class TenderDocumentAnalyzeRequest
    {
        public int TenderId { get; set; }
        public List<int>? DocumentIds { get; set; } // Specific docs to analyze; null = auto-select pricing docs
        public string AnalysisType { get; set; } = "analyze"; // analyze, extract-boq, pricing-review
        public string? UserQuestion { get; set; } // Optional question from user
    }
}
