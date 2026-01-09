using Microsoft.AspNetCore.Mvc;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;
using System.Text;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AIChatController : ControllerBase
    {
        private readonly ILogger<AIChatController> _logger;
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;

        public AIChatController(ILogger<AIChatController> logger, IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _configuration = configuration;
            _httpClient = httpClientFactory.CreateClient();
        }

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

                // Extract text from PDF
                var pdfText = await ExtractTextFromPdf(file);

                if (string.IsNullOrWhiteSpace(pdfText))
                {
                    return BadRequest(new { error = "No text could be extracted from the PDF" });
                }

                // Prepare the enhanced prompt for AI
                var enhancedPrompt = $@"A user has uploaded a PDF document and asked: ""{message}""

Here is the content of the PDF:

---
{pdfText}
---

Please analyze this document and respond to the user's request. Be specific and reference parts of the document when relevant.";

                // Send to Ollama/AI service
                var aiResponse = await SendToAI(enhancedPrompt);

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

        private async Task<string> SendToAI(string prompt)
        {
            try
            {
                var ollamaUrl = _configuration["Ollama:Url"] ?? "http://localhost:11434";
                var modelName = _configuration["Ollama:ModelName"] ?? "mistral:latest";

                var requestBody = new
                {
                    model = modelName,
                    prompt = prompt,
                    stream = false,
                    options = new
                    {
                        temperature = 0.7,
                        num_predict = 1024
                    }
                };

                var response = await _httpClient.PostAsJsonAsync($"{ollamaUrl}/api/generate", requestBody);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("AI service returned status code: {StatusCode}", response.StatusCode);
                    return "I processed the PDF, but the AI service is currently unavailable. Please try again later.";
                }

                var result = await response.Content.ReadFromJsonAsync<OllamaGenerateResponse>();
                return result?.Response ?? "No response from AI service";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling AI service");
                return "I processed the PDF, but encountered an error communicating with the AI service. Please try again.";
            }
        }

        private class OllamaGenerateResponse
        {
            public string? Model { get; set; }
            public string? Response { get; set; }
            public bool Done { get; set; }
        }
    }
}
