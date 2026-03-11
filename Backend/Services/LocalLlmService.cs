using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectTracker.API.Services
{
    public interface ILocalLlmService
    {
        Task<string> ChatAsync(string userMessage, CancellationToken cancellationToken = default);
        Task<string> ChatAsync(string userMessage, ChatUserContext? userContext, CancellationToken cancellationToken = default);
        Task<string> ChatWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingAsync(string userMessage, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingAsync(string userMessage, ChatUserContext? userContext, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingWithSessionAsync(string sessionId, string userMessage, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingWithSessionAsync(string sessionId, string userMessage, ChatUserContext? userContext, CancellationToken cancellationToken = default);
        Task<string> AnalyzeDocumentAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default);
        Task<bool> IsAvailableAsync();
    }

    public class LocalLlmService : ILocalLlmService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<LocalLlmService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly IConversationMemoryService _conversationMemory;
        private readonly string _baseUrl;
        private readonly string _model;
        private string _systemPrompt = string.Empty;

        // Token budget — Qwen2.5-14B supports 32K context, we use 16K with 2 parallel (8K per slot)
        // System prompt (~2500 tokens) + DB context + KB context + conversation history must fit within this
        private const int MaxContextTokens = 7500;
        private const int ApproxCharsPerToken = 4;
        private const int MaxResponseTokens = 1024;

        public LocalLlmService(
            ILogger<LocalLlmService> logger,
            IConfiguration configuration,
            IServiceScopeFactory scopeFactory,
            IConversationMemoryService conversationMemory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _conversationMemory = conversationMemory;
            _baseUrl = configuration["LocalLlm:BaseUrl"] ?? "http://localhost:8090";
            _model = configuration["LocalLlm:Model"] ?? "qwen2.5-14b-instruct";

            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(_baseUrl),
                Timeout = TimeSpan.FromMinutes(5) // CPU inference can be slow for long responses
            };

            // Load system prompt — same multi-path approach as other services
            var promptPaths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "ai-data", "prompts", "system.txt"),
                "/app/ai-data/prompts/system.txt",
                Path.Combine(AppContext.BaseDirectory, "ai-data", "prompts", "system.txt"),
            };

            foreach (var path in promptPaths)
            {
                if (File.Exists(path))
                {
                    _systemPrompt = File.ReadAllText(path);
                    _logger.LogInformation("LocalLLM: Loaded system prompt from: {Path}", path);
                    break;
                }
            }

            if (string.IsNullOrEmpty(_systemPrompt))
            {
                _logger.LogWarning("LocalLLM: System prompt file not found. Using fallback.");
                _systemPrompt = @"You are Welly, a helpful AI assistant for the ProMed Technologies intranet.
Your role is to help employees with customer lookups, attendance tracking, IT support,
logistics inquiries, employee information, stock/inventory, invoices, meetings, and announcements.
Be concise, professional, and friendly. Use the provided database context when available.";
            }

            _logger.LogInformation("LocalLLM Service initialized - BaseUrl: {BaseUrl}, Model: {Model}", _baseUrl, _model);
        }

        public async Task<bool> IsAvailableAsync()
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                var response = await _httpClient.GetAsync("/health", cts.Token);

                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync(cts.Token);
                    // llama.cpp returns {"status":"ok"} when model is loaded
                    if (content.Contains("ok") || content.Contains("no slot available"))
                    {
                        return true;
                    }
                    // Also accept if the server responds at all — it might be loading
                    _logger.LogInformation("LocalLLM health response: {Content}", content);
                    return content.Contains("loading");
                }
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "LocalLLM is not reachable at {BaseUrl}", _baseUrl);
                return false;
            }
        }

        /// <summary>
        /// Get RAG context for the user's query from the database AND knowledge base documents
        /// </summary>
        private async Task<string?> GetContextForQueryAsync(string query)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var sb = new StringBuilder();

                // 1. Live database context (employees, attendance, customers, etc.)
                var contextService = scope.ServiceProvider.GetService<IAIContextService>();
                if (contextService != null)
                {
                    var dbContext = await contextService.GetContextForQueryAsync(query);
                    if (!string.IsNullOrEmpty(dbContext))
                    {
                        sb.Append(dbContext);
                    }
                }

                // 2. Knowledge base document search (policies, procedures, guides)
                var kbService = scope.ServiceProvider.GetService<IKnowledgeBaseService>();
                if (kbService != null)
                {
                    var kbContext = await kbService.GetContextForQueryAsync(query, topK: 3);
                    if (!string.IsNullOrEmpty(kbContext))
                    {
                        if (sb.Length > 0) sb.AppendLine();
                        sb.Append(kbContext);
                        _logger.LogInformation("LocalLLM: Added KB context ({Length} chars)", kbContext.Length);
                    }
                }

                return sb.Length > 0 ? sb.ToString() : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get AI context for LocalLLM");
                return null;
            }
        }



        /// <summary>
        /// Build a user identity block to inject into the system prompt
        /// </summary>
        private string BuildUserContextBlock(ChatUserContext? user)
        {
            if (user == null) return "";
            var sb = new StringBuilder();
            sb.AppendLine("\n## Current User");
            sb.AppendLine($"- Name: {user.FullName}");
            sb.AppendLine($"- Email: {user.Email}");
            sb.AppendLine($"- Role: {user.Role}");
            if (!string.IsNullOrEmpty(user.Department))
                sb.AppendLine($"- Department: {user.Department}");
            return sb.ToString();
        }

        public Task<string> ChatAsync(string userMessage, CancellationToken cancellationToken = default)
            => ChatAsync(userMessage, null, cancellationToken);

        public async Task<string> ChatAsync(string userMessage, ChatUserContext? userContext, CancellationToken cancellationToken = default)
        {
            var systemContent = _systemPrompt + BuildUserContextBlock(userContext);

            var dbContext = await GetContextForQueryAsync(userMessage);
            if (!string.IsNullOrEmpty(dbContext))
            {
                systemContent += $"\n\n{dbContext}";
                _logger.LogInformation("LocalLLM: Added database context ({Length} chars)", dbContext.Length);
            }

            var request = new OpenAIChatRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                Stream = false,
                Temperature = 0.7f,
                Messages = new List<OpenAIChatMessage>
                {
                    new() { Role = "system", Content = systemContent },
                    new() { Role = "user", Content = userMessage }
                }
            };

            var json = JsonSerializer.Serialize(request, _jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            _logger.LogDebug("LocalLLM ChatAsync request body: {Json}", json);

            var response = await _httpClient.PostAsync("/v1/chat/completions", content, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogError("LocalLLM ChatAsync failed with {StatusCode}: {ErrorBody}", response.StatusCode, errorBody);
            }
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<OpenAIChatResponse>(responseBody, _jsonOptions);

            var answer = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "";
            return answer;
        }

        public IAsyncEnumerable<string> ChatStreamingAsync(
            string userMessage,
            CancellationToken cancellationToken = default)
            => ChatStreamingAsync(userMessage, null, cancellationToken);

        public async IAsyncEnumerable<string> ChatStreamingAsync(
            string userMessage,
            ChatUserContext? userContext,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var systemContent = _systemPrompt + BuildUserContextBlock(userContext);

            var dbContext = await GetContextForQueryAsync(userMessage);
            if (!string.IsNullOrEmpty(dbContext))
            {
                systemContent += $"\n\n{dbContext}";
            }

            var request = new OpenAIChatRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                Stream = true,
                Temperature = 0.7f,
                Messages = new List<OpenAIChatMessage>
                {
                    new() { Role = "system", Content = systemContent },
                    new() { Role = "user", Content = userMessage }
                }
            };

            var json = JsonSerializer.Serialize(request, _jsonOptions);
            var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v1/chat/completions")
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
                    if (string.IsNullOrEmpty(line)) continue;
                    if (!line.StartsWith("data: ")) continue;

                    var data = line.Substring(6);
                    if (data == "[DONE]") break;

                    string? token = null;
                    try
                    {
                        var eventDoc = JsonDocument.Parse(data);
                        var choices = eventDoc.RootElement.GetProperty("choices");
                        if (choices.GetArrayLength() > 0)
                        {
                            var delta = choices[0].GetProperty("delta");
                            if (delta.TryGetProperty("content", out var contentProp))
                            {
                                token = contentProp.GetString();
                            }
                        }
                    }
                    catch (JsonException) { }

                    if (!string.IsNullOrEmpty(token))
                    {
                        yield return token;
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

            var dbContext = await GetContextForQueryAsync(userMessage);
            if (!string.IsNullOrEmpty(dbContext))
            {
                systemContent += $"\n\n{dbContext}";
            }

            var messages = BuildMessages(systemContent, history);

            var request = new OpenAIChatRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                Stream = false,
                Temperature = 0.7f,
                Messages = messages
            };

            var json = JsonSerializer.Serialize(request, _jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("/v1/chat/completions", content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<OpenAIChatResponse>(responseBody, _jsonOptions);

            var responseText = result?.Choices?.FirstOrDefault()?.Message?.Content ?? "";

            if (!string.IsNullOrEmpty(responseText))
            {
                _conversationMemory.AddMessage(sessionId, "assistant", responseText);
            }

            return responseText;
        }

        public IAsyncEnumerable<string> ChatStreamingWithSessionAsync(
            string sessionId,
            string userMessage,
            CancellationToken cancellationToken = default)
            => ChatStreamingWithSessionAsync(sessionId, userMessage, null, cancellationToken);

        public async IAsyncEnumerable<string> ChatStreamingWithSessionAsync(
            string sessionId,
            string userMessage,
            ChatUserContext? userContext,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            _conversationMemory.AddMessage(sessionId, "user", userMessage);

            var history = _conversationMemory.GetHistory(sessionId);
            var systemContent = _systemPrompt + BuildUserContextBlock(userContext);

            var dbContext = await GetContextForQueryAsync(userMessage);
            if (!string.IsNullOrEmpty(dbContext))
            {
                systemContent += $"\n\n{dbContext}";
            }

            var messages = BuildMessages(systemContent, history);

            var request = new OpenAIChatRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                Stream = true,
                Temperature = 0.7f,
                Messages = messages
            };

            var json = JsonSerializer.Serialize(request, _jsonOptions);
            var httpContent = new StringContent(json, Encoding.UTF8, "application/json");
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v1/chat/completions")
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

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogError("LocalLLM session chat returned {StatusCode}: {ErrorBody}", response.StatusCode, errorBody);
                    yield return $"AI service returned an error. Please try again.";
                    _conversationMemory.AddMessage(sessionId, "assistant", "Sorry, I encountered an error. Please try again.");
                    yield break;
                }

                stream = await response.Content.ReadAsStreamAsync(cancellationToken);
                reader = new StreamReader(stream);

                string? line;
                while ((line = await reader.ReadLineAsync(cancellationToken)) != null && !cancellationToken.IsCancellationRequested)
                {
                    if (string.IsNullOrEmpty(line) || !line.StartsWith("data: ")) continue;

                    var data = line.Substring(6);
                    if (data == "[DONE]") break;

                    string? rawToken = null;
                    try
                    {
                        var eventDoc = JsonDocument.Parse(data);
                        var choices = eventDoc.RootElement.GetProperty("choices");
                        if (choices.GetArrayLength() > 0)
                        {
                            var delta = choices[0].GetProperty("delta");
                            if (delta.TryGetProperty("content", out var contentProp))
                            {
                                rawToken = contentProp.GetString();
                            }
                        }
                    }
                    catch (JsonException) { }

                    if (!string.IsNullOrEmpty(rawToken))
                    {
                        fullResponse.Append(rawToken);
                        yield return rawToken;
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
            var request = new OpenAIChatRequest
            {
                Model = _model,
                MaxTokens = MaxResponseTokens,
                Stream = false,
                Temperature = 0.3f, // Lower temperature for document analysis
                Messages = new List<OpenAIChatMessage>
                {
                    new() { Role = "system", Content = systemPrompt },
                    new() { Role = "user", Content = userPrompt }
                }
            };

            var json = JsonSerializer.Serialize(request, _jsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("/v1/chat/completions", content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            var result = JsonSerializer.Deserialize<OpenAIChatResponse>(responseBody, _jsonOptions);

            return result?.Choices?.FirstOrDefault()?.Message?.Content ?? "";
        }

        /// <summary>
        /// Build OpenAI-format messages from conversation history with token management
        /// </summary>
        private List<OpenAIChatMessage> BuildMessages(string systemContent, List<ConversationMessage> history)
        {
            var messages = new List<OpenAIChatMessage>
            {
                new() { Role = "system", Content = systemContent }
            };

            var maxChars = MaxContextTokens * ApproxCharsPerToken;
            var currentChars = systemContent.Length;

            // Take messages from newest to oldest, then reverse
            var selected = new List<OpenAIChatMessage>();
            foreach (var msg in history.AsEnumerable().Reverse())
            {
                if (msg.Role != "user" && msg.Role != "assistant") continue;
                if (currentChars + msg.Content.Length > maxChars && selected.Count > 0) break;

                selected.Insert(0, new OpenAIChatMessage { Role = msg.Role, Content = msg.Content });
                currentChars += msg.Content.Length;
            }

            messages.AddRange(selected);
            return messages;
        }

        // JSON options for OpenAI-compatible API
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };
    }

    // OpenAI-compatible request/response models for llama.cpp server
    public class OpenAIChatRequest
    {
        public string Model { get; set; } = string.Empty;
        public List<OpenAIChatMessage> Messages { get; set; } = new();
        public int? MaxTokens { get; set; }
        public float? Temperature { get; set; }
        public bool? Stream { get; set; }
    }

    public class OpenAIChatMessage
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class OpenAIChatResponse
    {
        public string? Id { get; set; }
        public List<OpenAIChatChoice>? Choices { get; set; }
        public OpenAIUsage? Usage { get; set; }
    }

    public class OpenAIChatChoice
    {
        public int Index { get; set; }
        public OpenAIChatMessage? Message { get; set; }
        public OpenAIChatDelta? Delta { get; set; }
        public string? FinishReason { get; set; }
    }

    public class OpenAIChatDelta
    {
        public string? Role { get; set; }
        public string? Content { get; set; }
    }

    public class OpenAIUsage
    {
        public int PromptTokens { get; set; }
        public int CompletionTokens { get; set; }
        public int TotalTokens { get; set; }
    }
}
