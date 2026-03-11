using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectTracker.API.Services
{
    public interface IClaudeAIService
    {
        Task<string> ChatAsync(string userMessage, CancellationToken cancellationToken = default);
        Task<string> ChatWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingAsync(string userMessage, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default);
        Task<string> AnalyzeDocumentAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default);
        Task<bool> IsAvailableAsync();
    }

    public class ClaudeAIService : IClaudeAIService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<ClaudeAIService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConversationMemoryService _conversationMemory;
        private readonly string _apiKey;
        private readonly string _model;
        private string _systemPrompt = string.Empty;
        private const string ApiUrl = "https://api.anthropic.com/v1/messages";
        private const string ApiVersion = "2023-06-01";

        // Token limit management
        private const int MaxContextTokens = 8000;
        private const int ApproxCharsPerToken = 4;
        private const int MaxResponseTokens = 4096;

        public ClaudeAIService(
            ILogger<ClaudeAIService> logger,
            IConfiguration configuration,
            IServiceScopeFactory scopeFactory,
            IConversationMemoryService conversationMemory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _conversationMemory = conversationMemory;
            _apiKey = configuration["Claude:ApiKey"] ?? "";
            _model = configuration["Claude:Model"] ?? "claude-sonnet-4-20250514";

            _httpClient = new HttpClient
            {
                Timeout = TimeSpan.FromMinutes(3)
            };
            _httpClient.DefaultRequestHeaders.Add("x-api-key", _apiKey);
            _httpClient.DefaultRequestHeaders.Add("anthropic-version", ApiVersion);

            // Load system prompt from file - check multiple paths (local dev + Docker)
            var promptPaths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "ai-data", "prompts", "system.txt"),
                "/app/ai-data/prompts/system.txt",
                Path.Combine(AppContext.BaseDirectory, "ai-data", "prompts", "system.txt"),
            };

            var loadedPrompt = false;
            foreach (var path in promptPaths)
            {
                if (File.Exists(path))
                {
                    _systemPrompt = File.ReadAllText(path);
                    _logger.LogInformation("Claude: Loaded system prompt from: {Path}", path);
                    loadedPrompt = true;
                    break;
                }
            }

            if (!loadedPrompt)
            {
                _logger.LogWarning("Claude: System prompt file not found. Using fallback.");
                _systemPrompt = @"You are Welly, a helpful AI assistant for the ProMed Technologies intranet.
Your role is to help employees with:
- Customer lookups and account queries
- Attendance and time tracking inquiries
- IT support and troubleshooting
- Logistics inquiries (loads, tripsheets, deliveries, drivers, vehicles)
- Employee information and extensions
- Stock and inventory information
- Invoice and sales transaction queries
- Meeting schedules and support tickets
- Company announcements

Guidelines:
- Be concise and helpful
- Use bullet points for step-by-step instructions
- Never share passwords or help bypass security
- If unsure, suggest contacting IT, HR, or the relevant manager
- Be professional but friendly
- When answering questions, use the provided database context if available";
            }

            if (string.IsNullOrEmpty(_apiKey))
            {
                _logger.LogWarning("Claude API key is not configured. Claude AI will not be available.");
            }
            else
            {
                _logger.LogInformation("Claude AI Service initialized with model: {Model}", _model);
            }
        }

        public async Task<bool> IsAvailableAsync()
        {
            if (string.IsNullOrEmpty(_apiKey))
                return false;

            try
            {
                // Send a minimal request to verify the API key works
                var request = new
                {
                    model = _model,
                    max_tokens = 10,
                    messages = new[] { new { role = "user", content = "hi" } }
                };

                var json = JsonSerializer.Serialize(request);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                var response = await _httpClient.PostAsync(ApiUrl, content, cts.Token);
                
                if (response.IsSuccessStatusCode)
                    return true;

                var errorBody = await response.Content.ReadAsStringAsync();
                _logger.LogWarning("Claude API check failed with status {Status}: {Error}", response.StatusCode, errorBody);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Claude API is not reachable");
                return false;
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

                return await contextService.GetContextForQueryAsync(query);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get AI context for Claude");
                return null;
            }
        }

        public async Task<string> ChatAsync(string userMessage, CancellationToken cancellationToken = default)
        {
            var systemContent = _systemPrompt;

            // Get database context
            if (!string.IsNullOrEmpty(userMessage))
            {
                var dbContext = await GetContextForQueryAsync(userMessage);
                if (!string.IsNullOrEmpty(dbContext))
                {
                    systemContent += $"\n\n{dbContext}";
                    _logger.LogInformation("Claude: Added database context ({Length} chars)", dbContext.Length);
                }
            }

            var request = new ClaudeRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                System = systemContent,
                Messages = new List<ClaudeMessage>
                {
                    new() { Role = "user", Content = userMessage }
                }
            };

            try
            {
                var json = JsonSerializer.Serialize(request, ClaudeJsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(ApiUrl, content, cancellationToken);
                
                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                var claudeResponse = JsonSerializer.Deserialize<ClaudeResponse>(responseBody, ClaudeJsonOptions);

                return claudeResponse?.Content?.FirstOrDefault()?.Text ?? "";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Claude chat request failed");
                throw;
            }
        }

        public async IAsyncEnumerable<string> ChatStreamingAsync(
            string userMessage,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var systemContent = _systemPrompt;

            if (!string.IsNullOrEmpty(userMessage))
            {
                var dbContext = await GetContextForQueryAsync(userMessage);
                if (!string.IsNullOrEmpty(dbContext))
                {
                    systemContent += $"\n\n{dbContext}";
                    _logger.LogInformation("Claude: Added database context for streaming query");
                }
            }

            var request = new ClaudeRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                System = systemContent,
                Stream = true,
                Messages = new List<ClaudeMessage>
                {
                    new() { Role = "user", Content = userMessage }
                }
            };

            var json = JsonSerializer.Serialize(request, ClaudeJsonOptions);
            var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, ApiUrl)
            {
                Content = httpContent
            };

            HttpResponseMessage? response = null;
            Stream? stream = null;
            StreamReader? reader = null;

            try
            {
                response = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                response.EnsureSuccessStatusCode();

                stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                reader = new StreamReader(stream);

                string? line;
                while ((line = await reader.ReadLineAsync(cancellationToken)) != null && !cancellationToken.IsCancellationRequested)
                {
                    if (string.IsNullOrEmpty(line) || !line.StartsWith("data: "))
                        continue;

                    var data = line.Substring(6); // Remove "data: " prefix

                    if (data == "[DONE]")
                        break;

                    string? tokenToYield = null;
                    try
                    {
                        var eventDoc = JsonDocument.Parse(data);
                        var type = eventDoc.RootElement.GetProperty("type").GetString();

                        if (type == "content_block_delta")
                        {
                            if (eventDoc.RootElement.TryGetProperty("delta", out var delta))
                            {
                                if (delta.TryGetProperty("text", out var text))
                                {
                                    tokenToYield = text.GetString();
                                }
                            }
                        }
                        else if (type == "error")
                        {
                            var errorMsg = eventDoc.RootElement.GetProperty("error").GetProperty("message").GetString();
                            _logger.LogError("Claude streaming error: {Error}", errorMsg);
                            break;
                        }
                    }
                    catch (JsonException)
                    {
                        // Skip invalid JSON
                    }

                    if (!string.IsNullOrEmpty(tokenToYield))
                    {
                        yield return tokenToYield;
                    }
                }
            }
            finally
            {
                reader?.Dispose();
                stream?.Dispose();
                response?.Dispose();
            }
        }

        public async Task<string> ChatWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default)
        {
            _conversationMemory.AddMessage(sessionId, "user", userMessage);

            var history = _conversationMemory.GetHistory(sessionId);
            var systemContent = _systemPrompt;

            // Get database context for the current query
            var dbContext = await GetContextForQueryAsync(userMessage);
            if (!string.IsNullOrEmpty(dbContext))
            {
                systemContent += $"\n\n{dbContext}";
            }

            // Build Claude messages from history
            var messages = BuildClaudeMessages(history);

            var request = new ClaudeRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                System = systemContent,
                Messages = messages
            };

            try
            {
                var json = JsonSerializer.Serialize(request, ClaudeJsonOptions);
                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync(ApiUrl, content, cancellationToken);

                response.EnsureSuccessStatusCode();

                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                var claudeResponse = JsonSerializer.Deserialize<ClaudeResponse>(responseBody, ClaudeJsonOptions);

                var result = claudeResponse?.Content?.FirstOrDefault()?.Text ?? "";

                if (!string.IsNullOrEmpty(result))
                {
                    _conversationMemory.AddMessage(sessionId, "assistant", result);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Claude ChatWithSessionAsync failed for session {SessionId}", sessionId);
                throw;
            }
        }

        public async IAsyncEnumerable<string> ChatStreamingWithSessionAsync(
            string sessionId,
            string userMessage,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            _conversationMemory.AddMessage(sessionId, "user", userMessage);

            var history = _conversationMemory.GetHistory(sessionId);
            var systemContent = _systemPrompt;

            var dbContext = await GetContextForQueryAsync(userMessage);
            if (!string.IsNullOrEmpty(dbContext))
            {
                systemContent += $"\n\n{dbContext}";
            }

            var messages = BuildClaudeMessages(history);

            var request = new ClaudeRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                System = systemContent,
                Stream = true,
                Messages = messages
            };

            var json = JsonSerializer.Serialize(request, ClaudeJsonOptions);
            var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, ApiUrl)
            {
                Content = httpContent
            };

            var fullResponse = new StringBuilder();
            HttpResponseMessage? response = null;
            Stream? stream = null;
            StreamReader? reader = null;

            try
            {
                response = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
                response.EnsureSuccessStatusCode();

                stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                reader = new StreamReader(stream);

                string? line;
                while ((line = await reader.ReadLineAsync(cancellationToken)) != null && !cancellationToken.IsCancellationRequested)
                {
                    if (string.IsNullOrEmpty(line) || !line.StartsWith("data: "))
                        continue;

                    var data = line.Substring(6);
                    if (data == "[DONE]")
                        break;

                    string? tokenToYield = null;
                    try
                    {
                        var eventDoc = JsonDocument.Parse(data);
                        var type = eventDoc.RootElement.GetProperty("type").GetString();

                        if (type == "content_block_delta")
                        {
                            if (eventDoc.RootElement.TryGetProperty("delta", out var delta))
                            {
                                if (delta.TryGetProperty("text", out var text))
                                {
                                    tokenToYield = text.GetString();
                                }
                            }
                        }
                        else if (type == "message_stop")
                        {
                            break;
                        }
                    }
                    catch (JsonException) { }

                    if (!string.IsNullOrEmpty(tokenToYield))
                    {
                        fullResponse.Append(tokenToYield);
                        yield return tokenToYield;
                    }
                }
            }
            finally
            {
                reader?.Dispose();
                stream?.Dispose();
                response?.Dispose();
            }

            if (fullResponse.Length > 0)
            {
                _conversationMemory.AddMessage(sessionId, "assistant", fullResponse.ToString());
            }
        }

        public async Task<string> AnalyzeDocumentAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            var request = new ClaudeRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                System = systemPrompt,
                Messages = new List<ClaudeMessage>
                {
                    new() { Role = "user", Content = userPrompt }
                }
            };

            var json = JsonSerializer.Serialize(request, ClaudeJsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(ApiUrl, content, cancellationToken);

            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var claudeResponse = JsonSerializer.Deserialize<ClaudeResponse>(responseBody, ClaudeJsonOptions);

            return claudeResponse?.Content?.FirstOrDefault()?.Text ?? "";
        }

        /// <summary>
        /// Build Claude-compatible messages from conversation history.
        /// Claude requires alternating user/assistant messages starting with user.
        /// </summary>
        private List<ClaudeMessage> BuildClaudeMessages(List<ConversationMessage> history)
        {
            var messages = new List<ClaudeMessage>();
            var maxChars = MaxContextTokens * ApproxCharsPerToken;
            var currentChars = 0;

            // Process from newest to oldest, then reverse
            var reversedHistory = history.AsEnumerable().Reverse().ToList();
            var selected = new List<ClaudeMessage>();

            foreach (var msg in reversedHistory)
            {
                if (msg.Role != "user" && msg.Role != "assistant")
                    continue;

                if (currentChars + msg.Content.Length > maxChars && selected.Count > 0)
                    break;

                selected.Insert(0, new ClaudeMessage { Role = msg.Role, Content = msg.Content });
                currentChars += msg.Content.Length;
            }

            // Ensure messages start with "user" (Claude requirement)
            if (selected.Any() && selected[0].Role != "user")
            {
                selected.RemoveAt(0);
            }

            // Merge consecutive same-role messages (Claude requirement: must alternate)
            for (int i = 0; i < selected.Count; i++)
            {
                if (messages.Count > 0 && messages.Last().Role == selected[i].Role)
                {
                    messages.Last().Content += "\n" + selected[i].Content;
                }
                else
                {
                    messages.Add(selected[i]);
                }
            }

            return messages;
        }

        // JSON serialization options
        private static readonly JsonSerializerOptions ClaudeJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }

    // Claude API request/response models
    public class ClaudeRequest
    {
        public string Model { get; set; } = string.Empty;
        public int MaxTokens { get; set; } = 4096;
        public string? System { get; set; }
        public bool? Stream { get; set; }
        public List<ClaudeMessage> Messages { get; set; } = new();
    }

    public class ClaudeMessage
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class ClaudeResponse
    {
        public string? Id { get; set; }
        public string? Type { get; set; }
        public string? Role { get; set; }
        public List<ClaudeContentBlock>? Content { get; set; }
        public string? Model { get; set; }
        public ClaudeUsage? Usage { get; set; }
    }

    public class ClaudeContentBlock
    {
        public string? Type { get; set; }
        public string? Text { get; set; }
    }

    public class ClaudeUsage
    {
        public int InputTokens { get; set; }
        public int OutputTokens { get; set; }
    }
}
