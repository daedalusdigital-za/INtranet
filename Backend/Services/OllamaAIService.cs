using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services
{
    public interface IOllamaAIService
    {
        Task<string> ChatAsync(List<OllamaMessage> messages, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingAsync(List<OllamaMessage> messages, CancellationToken cancellationToken = default);
        Task<bool> IsAvailableAsync();
        Task<List<string>> GetModelsAsync();
    }

    public class OllamaMessage
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;
        
        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;
    }

    public class OllamaAIService : IOllamaAIService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<OllamaAIService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly string _baseUrl;
        private readonly string _model;
        private readonly string _systemPrompt;

        public OllamaAIService(
            ILogger<OllamaAIService> logger, 
            IConfiguration configuration,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _baseUrl = configuration["Ollama:BaseUrl"] ?? "http://localhost:11434";
            _model = configuration["Ollama:Model"] ?? "llama3.2";
            
            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(_baseUrl),
                Timeout = TimeSpan.FromMinutes(5)
            };

            // Load system prompt from file if available
            var promptPath = Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "ai-data", "prompts", "system.txt");
            if (File.Exists(promptPath))
            {
                _systemPrompt = File.ReadAllText(promptPath);
            }
            else
            {
                _systemPrompt = @"You are Welly, a helpful AI assistant for the company intranet. 
Your role is to help employees with:
- IT support and troubleshooting
- Using intranet features (attendance, projects, messaging)
- Finding information and resources
- General workplace questions
- Logistics and delivery information

Guidelines:
- Be concise and helpful
- Use bullet points for step-by-step instructions
- Never share passwords or help bypass security
- If unsure, suggest contacting IT, HR, or the relevant manager
- Be professional but friendly
- When answering questions, use the provided database context if available";
            }
        }

        /// <summary>
        /// Get comprehensive context for the query from all relevant data sources
        /// </summary>
        private async Task<string?> GetContextForQueryAsync(string query)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var contextService = scope.ServiceProvider.GetService<IAIContextService>();
                
                if (contextService == null)
                {
                    _logger.LogWarning("AIContextService not available");
                    return null;
                }

                var context = await contextService.GetContextForQueryAsync(query);
                return context;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get AI context");
                return null;
            }
        }

        public async Task<bool> IsAvailableAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/api/tags");
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Ollama is not available at {BaseUrl}", _baseUrl);
                return false;
            }
        }

        public async Task<List<string>> GetModelsAsync()
        {
            try
            {
                var response = await _httpClient.GetAsync("/api/tags");
                if (response.IsSuccessStatusCode)
                {
                    var json = await response.Content.ReadFromJsonAsync<JsonDocument>();
                    var models = new List<string>();
                    if (json?.RootElement.TryGetProperty("models", out var modelsArray) == true)
                    {
                        foreach (var model in modelsArray.EnumerateArray())
                        {
                            if (model.TryGetProperty("name", out var name))
                            {
                                models.Add(name.GetString() ?? "");
                            }
                        }
                    }
                    return models;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get Ollama models");
            }
            return new List<string>();
        }

        public async Task<string> ChatAsync(List<OllamaMessage> messages, CancellationToken cancellationToken = default)
        {
            // Build system prompt with relevant database context
            var systemContent = _systemPrompt;
            
            // Get context for the user's query
            var lastUserMessage = messages.LastOrDefault(m => m.Role == "user")?.Content ?? "";
            _logger.LogInformation("ChatAsync called with user message: {Message}", lastUserMessage.Substring(0, Math.Min(100, lastUserMessage.Length)));
            
            if (!string.IsNullOrEmpty(lastUserMessage))
            {
                var dbContext = await GetContextForQueryAsync(lastUserMessage);
                if (!string.IsNullOrEmpty(dbContext))
                {
                    systemContent += $"\n\n{dbContext}";
                    _logger.LogInformation("Added database context ({Length} chars) for query: {Query}", dbContext.Length, lastUserMessage.Substring(0, Math.Min(50, lastUserMessage.Length)));
                }
                else
                {
                    _logger.LogWarning("No database context returned for query: {Query}", lastUserMessage.Substring(0, Math.Min(50, lastUserMessage.Length)));
                }
            }

            var allMessages = new List<OllamaMessage>
            {
                new OllamaMessage { Role = "system", Content = systemContent }
            };
            allMessages.AddRange(messages);

            var request = new
            {
                model = _model,
                messages = allMessages,
                stream = false
            };

            try
            {
                var response = await _httpClient.PostAsJsonAsync("/api/chat", request, cancellationToken);
                response.EnsureSuccessStatusCode();

                var json = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: cancellationToken);
                if (json?.RootElement.TryGetProperty("message", out var message) == true)
                {
                    if (message.TryGetProperty("content", out var content))
                    {
                        return content.GetString() ?? "";
                    }
                }
                return "";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ollama chat request failed");
                throw;
            }
        }

        public async IAsyncEnumerable<string> ChatStreamingAsync(
            List<OllamaMessage> messages, 
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Build system prompt with relevant database context
            var systemContent = _systemPrompt;
            
            // Get context for the user's query
            var lastUserMessage = messages.LastOrDefault(m => m.Role == "user")?.Content ?? "";
            if (!string.IsNullOrEmpty(lastUserMessage))
            {
                var dbContext = await GetContextForQueryAsync(lastUserMessage);
                if (!string.IsNullOrEmpty(dbContext))
                {
                    systemContent += $"\n\n{dbContext}";
                    _logger.LogInformation("Added database context for streaming query");
                }
            }

            var allMessages = new List<OllamaMessage>
            {
                new OllamaMessage { Role = "system", Content = systemContent }
            };
            allMessages.AddRange(messages);

            var request = new
            {
                model = _model,
                messages = allMessages,
                stream = true
            };

            var jsonContent = new StringContent(
                JsonSerializer.Serialize(request),
                Encoding.UTF8,
                "application/json");

            var requestMessage = new HttpRequestMessage(HttpMethod.Post, "/api/chat")
            {
                Content = jsonContent
            };

            HttpResponseMessage? response = null;
            Stream? stream = null;
            StreamReader? reader = null;
            
            response = await _httpClient.SendAsync(
                requestMessage,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            response.EnsureSuccessStatusCode();

            stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            reader = new StreamReader(stream);

            string? line;
            while ((line = await reader.ReadLineAsync(cancellationToken)) != null && !cancellationToken.IsCancellationRequested)
            {
                if (string.IsNullOrEmpty(line)) continue;

                string? tokenToYield = null;
                try
                {
                    var json = JsonDocument.Parse(line);
                    if (json.RootElement.TryGetProperty("message", out var message))
                    {
                        if (message.TryGetProperty("content", out var content))
                        {
                            tokenToYield = content.GetString();
                        }
                    }
                }
                catch (JsonException)
                {
                    // Skip invalid JSON lines
                }

                if (!string.IsNullOrEmpty(tokenToYield))
                {
                    yield return tokenToYield;
                }
            }

            reader?.Dispose();
            stream?.Dispose();
            response?.Dispose();
        }
    }
}
