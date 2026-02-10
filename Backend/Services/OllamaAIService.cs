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
        Task<string> ChatWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingAsync(List<OllamaMessage> messages, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default);
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
        private readonly IConversationMemoryService _conversationMemory;
        private readonly string _baseUrl;
        private readonly string _model;
        private readonly string _systemPrompt;
        
        // Token limit management
        private const int MaxContextTokens = 6000;  // Reserve tokens for response
        private const int ApproxCharsPerToken = 4;

        public OllamaAIService(
            ILogger<OllamaAIService> logger, 
            IConfiguration configuration,
            IServiceScopeFactory scopeFactory,
            IConversationMemoryService conversationMemory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _conversationMemory = conversationMemory;
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

        /// <summary>
        /// Chat with session-based conversation memory (non-streaming)
        /// </summary>
        public async Task<string> ChatWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default)
        {
            // Add user message to history
            _conversationMemory.AddMessage(sessionId, "user", userMessage);
            
            // Get conversation history and convert to OllamaMessages
            var history = _conversationMemory.GetHistory(sessionId);
            var messages = history.Select(h => new OllamaMessage 
            { 
                Role = h.Role, 
                Content = h.Content 
            }).ToList();
            
            // Truncate to fit within token limits
            messages = TruncateConversation(messages);
            
            try
            {
                var response = await ChatAsync(messages, cancellationToken);
                
                // Add assistant response to history
                if (!string.IsNullOrEmpty(response))
                {
                    _conversationMemory.AddMessage(sessionId, "assistant", response);
                }
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ChatWithSessionAsync failed for session {SessionId}", sessionId);
                throw;
            }
        }

        /// <summary>
        /// Chat with session-based conversation memory (streaming)
        /// </summary>
        public async IAsyncEnumerable<string> ChatStreamingWithSessionAsync(
            string sessionId, 
            string userMessage,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Add user message to history
            _conversationMemory.AddMessage(sessionId, "user", userMessage);
            
            // Get conversation history and convert to OllamaMessages
            var history = _conversationMemory.GetHistory(sessionId);
            var messages = history.Select(h => new OllamaMessage 
            { 
                Role = h.Role, 
                Content = h.Content 
            }).ToList();
            
            // Truncate to fit within token limits
            messages = TruncateConversation(messages);
            
            var fullResponse = new StringBuilder();
            
            await foreach (var token in ChatStreamingAsync(messages, cancellationToken))
            {
                fullResponse.Append(token);
                yield return token;
            }
            
            // Add complete assistant response to history
            if (fullResponse.Length > 0)
            {
                _conversationMemory.AddMessage(sessionId, "assistant", fullResponse.ToString());
            }
        }

        /// <summary>
        /// Truncate conversation history to fit within token limits
        /// Keeps most recent messages, always preserving the latest user message
        /// </summary>
        private List<OllamaMessage> TruncateConversation(List<OllamaMessage> messages)
        {
            var maxChars = MaxContextTokens * ApproxCharsPerToken;
            var totalChars = messages.Sum(m => m.Content.Length);
            
            if (totalChars <= maxChars)
                return messages;
            
            // Always keep the last message (current user query)
            var result = new List<OllamaMessage>();
            var currentChars = 0;
            
            // Process from newest to oldest
            for (int i = messages.Count - 1; i >= 0; i--)
            {
                var msg = messages[i];
                if (currentChars + msg.Content.Length > maxChars && result.Count > 0)
                {
                    // Add a truncation notice if we're cutting messages
                    _logger.LogInformation("Truncating conversation history from {Total} to {Kept} messages", 
                        messages.Count, result.Count);
                    break;
                }
                
                result.Insert(0, msg);
                currentChars += msg.Content.Length;
            }
            
            return result;
        }
    }
}
