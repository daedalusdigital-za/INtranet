using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ClosedXML.Excel;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
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

        public AIChatController(
            ILogger<AIChatController> logger, 
            ILlamaAIService aiService,
            IOllamaAIService ollamaService,
            IClaudeAIService claudeService,
            ILocalLlmService localLlmService,
            IAIActionService actionService,
            IConfiguration configuration,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _aiService = aiService;
            _ollamaService = ollamaService;
            _claudeService = claudeService;
            _localLlmService = localLlmService;
            _actionService = actionService;
            _configuration = configuration;
            _scopeFactory = scopeFactory;
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
                model = _configuration["LocalLlm:Model"] ?? "qwen2.5-14b-instruct";
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
                    _logger.LogInformation("Chat: Using Local LLM (Qwen2.5) for user {User}", userContext?.FullName ?? "unknown");
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
                
                // Get the user message
                var userMessage = request.Prompt ?? request.Messages?.LastOrDefault(m => m.Role == "user")?.Content ?? "";
                var userContext = await GetCurrentUserContext();
                
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
                    _logger.LogInformation("Session chat: Using Local LLM (Qwen2.5) for session {SessionId}, user {User}", sessionId, userContext?.FullName ?? "unknown");
                    await foreach (var token in _localLlmService.ChatStreamingWithSessionAsync(sessionId, userMessage, userContext, HttpContext.RequestAborted))
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
}
