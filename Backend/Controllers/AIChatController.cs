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

        public AIChatController(ILogger<AIChatController> logger, ILlamaAIService aiService)
        {
            _logger = logger;
            _aiService = aiService;
        }

        /// <summary>
        /// Check if AI service is available
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new 
            { 
                status = _aiService.IsModelLoaded ? "ready" : "loading",
                model = "tinyllama-1.1b-chat",
                timestamp = DateTime.UtcNow
            });
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

                // If no messages but we have a prompt, use that
                if (messages.Count == 0 && !string.IsNullOrEmpty(request.Prompt))
                {
                    messages.Add(new ChatMessage { Role = "user", Content = request.Prompt });
                }

                await foreach (var token in _aiService.ChatStreamingAsync(messages, HttpContext.RequestAborted))
                {
                    await WriteSSEToken(token);
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

                return Ok(new { response = response });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during chat");
                return StatusCode(500, new { error = "An error occurred while processing your request." });
            }
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
    }

    public class ChatRequest
    {
        public string? Prompt { get; set; }
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
