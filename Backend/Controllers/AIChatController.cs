using Microsoft.AspNetCore.Mvc;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using System.Text;
using System.Text.Json;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AIChatController : ControllerBase
    {
        private readonly ILogger<AIChatController> _logger;
        private readonly ILlamaAIService _aiService;
        private readonly IOllamaAIService _ollamaService;
        private readonly IConfiguration _configuration;

        public AIChatController(
            ILogger<AIChatController> logger, 
            ILlamaAIService aiService,
            IOllamaAIService ollamaService,
            IConfiguration configuration)
        {
            _logger = logger;
            _aiService = aiService;
            _ollamaService = ollamaService;
            _configuration = configuration;
        }

        /// <summary>
        /// Check if AI service is available
        /// </summary>
        [HttpGet("health")]
        public async Task<IActionResult> Health()
        {
            var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", true);
            var ollamaAvailable = ollamaEnabled && await _ollamaService.IsAvailableAsync();
            var model = ollamaAvailable ? _configuration["Ollama:Model"] ?? "llama3.2" : "rule-based-fallback";
            
            return Ok(new 
            { 
                status = "ready",
                model = model,
                provider = ollamaAvailable ? "ollama" : "fallback",
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
                var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", true);
                var useOllama = ollamaEnabled && await _ollamaService.IsAvailableAsync();

                if (useOllama)
                {
                    // Use Ollama for AI responses
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
                        await WriteSSEToken(token);
                    }
                }
                else
                {
                    // Fallback to rule-based service
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
                        await WriteSSEToken(token);
                    }
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
                var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", true);
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
                
                if (string.IsNullOrWhiteSpace(userMessage))
                {
                    await WriteSSEMessage("Please provide a message.");
                    await WriteSSEDone();
                    return;
                }

                var ollamaEnabled = _configuration.GetValue<bool>("Ollama:Enabled", true);
                var useOllama = ollamaEnabled && await _ollamaService.IsAvailableAsync();

                if (useOllama)
                {
                    // Use session-based streaming with conversation memory
                    await foreach (var token in _ollamaService.ChatStreamingWithSessionAsync(sessionId, userMessage, HttpContext.RequestAborted))
                    {
                        await WriteSSEToken(token);
                    }
                    
                    // Send session ID in final message so frontend can track it
                    await WriteSSESessionId(sessionId);
                }
                else
                {
                    // Fallback - no session support
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
                        await WriteSSEToken(token);
                    }
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
        /// Upload a PDF and get AI analysis
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

                if (file.ContentType != "application/pdf")
                {
                    return BadRequest(new { error = "Only PDF files are supported" });
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

                // Extract text from PDF
                var pdfText = await ExtractTextFromPdf(file);

                if (string.IsNullOrWhiteSpace(pdfText))
                {
                    return BadRequest(new { error = "No text could be extracted from the PDF" });
                }

                // Truncate if too long (keep to ~4000 chars for better analysis)
                if (pdfText.Length > 4000)
                {
                    pdfText = pdfText.Substring(0, 4000) + "\n\n[Document truncated due to length...]";
                }

                // Prepare the enhanced prompt for AI with clear markers
                var userQuestion = string.IsNullOrWhiteSpace(message) ? "Analyze this document" : message;
                var enhancedPrompt = $@"[Document: {file.FileName}]
{userQuestion}

--- DOCUMENT CONTENT ---
{pdfText}";

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
                    extractedTextLength = pdfText.Length
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
}
