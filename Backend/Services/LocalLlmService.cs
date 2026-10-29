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
        IAsyncEnumerable<string> ChatStreamingWithSessionAsync(string sessionId, string userMessage, ChatUserContext? userContext, string? pageContext, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingWithSessionAsync(string sessionId, string userMessage, ChatUserContext? userContext, string? pageContext, string? pageContent, CancellationToken cancellationToken = default);
        Task<string> AnalyzeDocumentAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default);
        Task<bool> IsAvailableAsync();

        /// <summary>
        /// Rich streaming: yields content tokens AND (when enabled) the model's reasoning tokens separately.
        /// Thinking is switched on automatically for analytical questions (see <see cref="LocalLlmService.ShouldThink"/>).
        /// </summary>
        IAsyncEnumerable<LlmStreamEvent> ChatStreamingWithSessionRichAsync(string sessionId, string userMessage, ChatUserContext? userContext, string? pageContext, string? pageContent, CancellationToken cancellationToken = default);

        /// <summary>
        /// Tool loop: feed the results of executed [ACTION] tags back to the model so it can
        /// reason over them and produce a final, natural answer (or request another step).
        /// </summary>
        IAsyncEnumerable<LlmStreamEvent> ContinueWithToolResultsAsync(string sessionId, string toolResults, ChatUserContext? userContext, bool enableThinking, CancellationToken cancellationToken = default);
    }

    public enum LlmStreamEventKind { Content, Thinking }

    public readonly record struct LlmStreamEvent(LlmStreamEventKind Kind, string Text)
    {
        public static LlmStreamEvent ContentOf(string t) => new(LlmStreamEventKind.Content, t);
        public static LlmStreamEvent ThinkingOf(string t) => new(LlmStreamEventKind.Thinking, t);
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

        // Token budget — Gemma 4 26B MoE with 16K context (--ctx-size 16384, --parallel 2 = 8K per slot)
        // System prompt (~600 tokens) + DB context + KB context + conversation history must fit
        private const int MaxContextTokens = 6000;
        private const int ApproxCharsPerToken = 4;
        private const int MaxResponseTokens = 2048;
        // When reasoning is enabled the budget must cover thinking + the visible answer
        private const int MaxResponseTokensWithThinking = 4096;

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
            _model = configuration["LocalLlm:Model"] ?? "gemma-4-27b-it";

            _httpClient = new HttpClient
            {
                BaseAddress = new Uri(_baseUrl),
                Timeout = TimeSpan.FromMinutes(5) // CPU inference can be slow for long responses
            };

            // llama-server started with --api-key requires this bearer token on every request.
            var apiKey = configuration["LocalLlm:ApiKey"];
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                _httpClient.DefaultRequestHeaders.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey.Trim());
            }

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
        /// Get RAG context for the user's query from the database AND knowledge base documents.
        /// Enforces a character budget to prevent context window overflow.
        /// </summary>
        private async Task<string?> GetContextForQueryAsync(string query, string? pageContext = null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var sb = new StringBuilder();

                // Budget: leave room for system prompt (~2400 chars), user context (~200), user msg (~400), history
                var maxContextChars = (MaxContextTokens - 1500) * ApproxCharsPerToken; // ~18000 chars for DB+KB

                // 1. Live database context (employees, attendance, customers, etc.)
                var contextService = scope.ServiceProvider.GetService<IAIContextService>();
                if (contextService != null)
                {
                    var dbContext = await contextService.GetContextForQueryAsync(query, pageContext);
                    if (!string.IsNullOrEmpty(dbContext))
                    {
                        sb.Append(dbContext);
                        _logger.LogInformation("LocalLLM: DB context {Length} chars (page: {Page})", dbContext.Length, pageContext ?? "none");
                    }
                }

                // 2. Knowledge base document search (policies, procedures, guides)
                // Only add KB if we have budget remaining AND the message looks like a
                // real question — skip greetings/small-talk so Welly doesn't recite its
                // own capability guides during normal conversation.
                var remainingBudget = maxContextChars - sb.Length;
                if (remainingBudget > 500 && ShouldSearchKnowledgeBase(query))
                {
                    var kbService = scope.ServiceProvider.GetService<IKnowledgeBaseService>();
                    if (kbService != null)
                    {
                        var kbContext = await kbService.GetContextForQueryAsync(query, topK: 2);
                        if (!string.IsNullOrEmpty(kbContext))
                        {
                            // Truncate KB if needed
                            if (kbContext.Length > remainingBudget)
                            {
                                kbContext = kbContext.Substring(0, remainingBudget - 50) + "\n[KB truncated]";
                            }
                            if (sb.Length > 0) sb.AppendLine();
                            sb.Append(kbContext);
                            _logger.LogInformation("LocalLLM: KB context {Length} chars", kbContext.Length);
                        }
                    }
                }

                // 3. Welly Memory recall (past tasks/analyses Welly has performed)
                var memoryBudget = maxContextChars - sb.Length;
                if (memoryBudget > 400)
                {
                    var memoryService = scope.ServiceProvider.GetService<IWellyMemoryService>();
                    if (memoryService != null)
                    {
                        var memoryContext = await memoryService.GetContextForQueryAsync(query, topK: 3);
                        if (!string.IsNullOrEmpty(memoryContext))
                        {
                            if (memoryContext.Length > memoryBudget)
                                memoryContext = memoryContext.Substring(0, memoryBudget - 40) + "\n[memory truncated]";
                            if (sb.Length > 0) sb.AppendLine();
                            sb.Append(memoryContext);
                            _logger.LogInformation("LocalLLM: Welly memory context {Length} chars", memoryContext.Length);
                        }
                    }
                }

                if (sb.Length > 0)
                {
                    _logger.LogInformation("LocalLLM: Total context {Length} chars (~{Tokens} tokens)", 
                        sb.Length, sb.Length / ApproxCharsPerToken);
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
        /// Decide whether a message warrants a knowledge-base lookup. Greetings,
        /// thanks, and very short small-talk are skipped so Welly doesn't recite
        /// its own capability guides during ordinary conversation.
        /// </summary>
        private static bool ShouldSearchKnowledgeBase(string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return false;
            var q = query.Trim().ToLowerInvariant();

            // Too short to be a real question (e.g. "hi", "ok", "cool").
            var wordCount = q.Split(new[] { ' ', '\t', '\n' }, StringSplitOptions.RemoveEmptyEntries).Length;
            if (q.Length < 12 && wordCount <= 2) return false;

            // Pure greeting / small-talk openers.
            string[] smallTalk =
            {
                "hi", "hey", "hello", "howzit", "yo", "sup", "good morning",
                "good afternoon", "good evening", "morning", "afternoon", "evening",
                "how are you", "how's it going", "hows it going", "thanks", "thank you",
                "thx", "ok", "okay", "cool", "nice", "great", "lol", "haha",
                "bye", "goodbye", "cheers", "no", "yes", "yep", "nope"
            };
            if (smallTalk.Any(s => q == s || q == s + "!" || q == s + ".")) return false;

            return true;
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

        /// <summary>
        /// Convert a frontend route path to a friendly page label for the system prompt
        /// </summary>
        private static string GetPageLabel(string pageContext)
        {
            var route = pageContext.ToLower().TrimStart('/').Split('?')[0].Split('#')[0];
            return route switch
            {
                "" or "dashboard" => "Dashboard (Home)",
                "logistics" => "Logistics (Loads, Drivers, Vehicles)",
                "people" => "People / Human Resources",
                "sales" => "Sales (Customers, Invoices)",
                "stock-management" => "Stock Management (Inventory, Warehouses)",
                "tenders" => "Tenders",
                "calendar" => "Calendar (Meetings, Events)",
                "company-projects" => "Company Projects",
                "books" => "Books (Invoices, Credit Notes)",
                var r when r.StartsWith("finance") => "Finance (Payments, Expenses, Purchase Orders)",
                var r when r.StartsWith("knowledge") => "Knowledge Base",
                _ => pageContext
            };
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
                    catch (JsonException ex)
                    {
                        // Malformed SSE chunk from llama.cpp — skip it but leave a trace
                        _logger.LogDebug(ex, "Skipping malformed LLM stream event: {Data}", data);
                    }

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
            await foreach (var token in ChatStreamingWithSessionAsync(sessionId, userMessage, userContext, null, cancellationToken))
            {
                yield return token;
            }
        }

        public async IAsyncEnumerable<string> ChatStreamingWithSessionAsync(
            string sessionId,
            string userMessage,
            ChatUserContext? userContext,
            string? pageContext,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await foreach (var token in ChatStreamingWithSessionAsync(sessionId, userMessage, userContext, pageContext, null, cancellationToken))
            {
                yield return token;
            }
        }

        public async IAsyncEnumerable<string> ChatStreamingWithSessionAsync(
            string sessionId,
            string userMessage,
            ChatUserContext? userContext,
            string? pageContext,
            string? pageContent,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            await foreach (var ev in ChatStreamingWithSessionRichAsync(sessionId, userMessage, userContext, pageContext, pageContent, cancellationToken))
            {
                if (ev.Kind == LlmStreamEventKind.Content)
                    yield return ev.Text;
            }
        }

        /// <summary>
        /// Heuristic: enable model reasoning for analytical / multi-step requests only,
        /// so simple chat stays fast on CPU inference.
        /// </summary>
        public static bool ShouldThink(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return false;
            var q = message.ToLowerInvariant();
            var words = q.Split(new[] { ' ', '\t', '\n' }, StringSplitOptions.RemoveEmptyEntries).Length;
            if (words >= 40) return true;

            string[] triggers =
            {
                "analy", "compare", "comparison", "why ", "plan", "summar", "report", "calculate",
                "how many", "trend", "best ", "optimi", "tripsheet", "trip sheet", "suggest", "recommend",
                "explain", "breakdown", "break down", "forecast", "which ", "should i", "should we",
                "what if", "risk", "prioriti", "schedule", "route", "efficien", "cost", "total", "average"
            };
            return triggers.Any(t => q.Contains(t));
        }

        public async IAsyncEnumerable<LlmStreamEvent> ChatStreamingWithSessionRichAsync(
            string sessionId,
            string userMessage,
            ChatUserContext? userContext,
            string? pageContext,
            string? pageContent,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            _conversationMemory.AddMessage(sessionId, "user", userMessage);

            var history = _conversationMemory.GetHistory(sessionId);
            var systemContent = _systemPrompt + BuildDateBlock() + BuildUserContextBlock(userContext);

            // Add page awareness to system prompt
            if (!string.IsNullOrEmpty(pageContext))
            {
                systemContent += $"\n## Current Page (context only)\nThe user is currently on the **{GetPageLabel(pageContext)}** page. This is background awareness only — do NOT bring up the page unless the user's message is clearly about it.\n";
            }

            // Add visible page content so Welly can see what the user sees
            if (!string.IsNullOrEmpty(pageContent))
            {
                systemContent += $"\n## Visible Page Content (reference ONLY when asked)\nThis is a snapshot of what is on the user's screen. Use it ONLY when the user explicitly asks about the current page/screen (e.g. \"what's on this page\", \"explain this\", \"how do I do this here\"). For all other messages, hold a normal conversation and do NOT mention or quote this content.\n```\n{pageContent}\n```\n";
            }

            var dbContext = await GetContextForQueryAsync(userMessage, pageContext);
            if (!string.IsNullOrEmpty(dbContext))
            {
                systemContent += $"\n\n{dbContext}";
            }

            var messages = BuildMessages(systemContent, history);
            var think = ShouldThink(userMessage);
            _logger.LogInformation("LocalLLM: session {SessionId} thinking={Think}", sessionId, think);

            await foreach (var ev in StreamCompletionAsync(sessionId, messages, think, cancellationToken))
                yield return ev;
        }

        public async IAsyncEnumerable<LlmStreamEvent> ContinueWithToolResultsAsync(
            string sessionId,
            string toolResults,
            ChatUserContext? userContext,
            bool enableThinking,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            // Tool results are injected as a user-role message (Gemma's chat template has no
            // tool role). It is clearly framed so the model treats it as data, not as the user.
            var toolMessage =
                "[TOOL RESULTS — not visible to the user]\n" +
                "These are the results of the action(s) you just requested. Use them to answer the user's " +
                "ORIGINAL request naturally and concisely: summarise, highlight what matters, keep IDs/numbers/names " +
                "the user needs, and use a table for lists. Do not mention 'tool results' or repeat raw JSON. " +
                "Only emit another [ACTION:...] tag if a further step is genuinely required to complete the request.\n\n" +
                toolResults;

            _conversationMemory.AddMessage(sessionId, "user", toolMessage);

            var history = _conversationMemory.GetHistory(sessionId);
            var systemContent = _systemPrompt + BuildDateBlock() + BuildUserContextBlock(userContext);
            var messages = BuildMessages(systemContent, history);

            await foreach (var ev in StreamCompletionAsync(sessionId, messages, enableThinking, cancellationToken))
                yield return ev;
        }

        private static string BuildDateBlock()
        {
            var now = DateTime.Now;
            return $"\n## Current Date/Time\n{now:dddd, dd MMMM yyyy HH:mm} (South Africa). Use this for 'today', 'tomorrow', 'this week', etc.\n";
        }

        /// <summary>
        /// Core streaming call. Separates reasoning (<c>reasoning_content</c> deltas or inline
        /// &lt;think&gt; blocks) from visible content, and stores the visible answer in session memory.
        /// </summary>
        private async IAsyncEnumerable<LlmStreamEvent> StreamCompletionAsync(
            string sessionId,
            List<OpenAIChatMessage> messages,
            bool enableThinking,
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            if (enableThinking)
            {
                // Gemma 4's template puts <|think|> at the top of the system turn; with a long system
                // prompt the model usually ignores it. Repeating the token at the very end of the
                // last user turn reliably opens the thought channel. Done on a copy so session
                // memory never contains the control token.
                var last = messages.LastOrDefault(m => m.Role == "user");
                if (last != null)
                {
                    messages = messages.Select(m => ReferenceEquals(m, last)
                        ? new OpenAIChatMessage { Role = m.Role, Content = m.Content.TrimEnd() + "\n<|think|>" }
                        : m).ToList();
                }
            }

            var request = new OpenAIChatRequest
            {
                Model = _model,
                MaxTokens = enableThinking ? MaxResponseTokensWithThinking : MaxResponseTokens,
                Stream = true,
                Temperature = enableThinking ? 0.5f : 0.7f,
                Messages = messages,
                // llama.cpp: per-request override of the server's --reasoning default
                ChatTemplateKwargs = enableThinking ? new Dictionary<string, object> { ["enable_thinking"] = true } : null,
                ReasoningFormat = enableThinking ? "deepseek" : null
            };

            var json = JsonSerializer.Serialize(request, _jsonOptions);
            var httpRequest = new HttpRequestMessage(HttpMethod.Post, "/v1/chat/completions")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };

            var fullResponse = new StringBuilder();
            var thinkingChars = 0;
            HttpResponseMessage? response = null;
            Stream? stream = null;
            StreamReader? reader = null;

            // Inline <think>...</think> handling (in case the server doesn't split reasoning for us)
            var inThink = false;
            var pending = new StringBuilder();

            try
            {
                response = await _httpClient.SendAsync(httpRequest, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogError("LocalLLM session chat returned {StatusCode}: {ErrorBody}", response.StatusCode, errorBody);
                    yield return LlmStreamEvent.ContentOf("AI service returned an error. Please try again.");
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
                    string? reasoningToken = null;
                    try
                    {
                        using var eventDoc = JsonDocument.Parse(data);
                        var choices = eventDoc.RootElement.GetProperty("choices");
                        if (choices.GetArrayLength() > 0)
                        {
                            var delta = choices[0].GetProperty("delta");
                            if (delta.TryGetProperty("content", out var contentProp))
                                rawToken = contentProp.GetString();
                            if (delta.TryGetProperty("reasoning_content", out var reasoningProp))
                                reasoningToken = reasoningProp.GetString();
                        }
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogDebug(ex, "Skipping malformed LLM stream event: {Data}", data);
                    }

                    if (!string.IsNullOrEmpty(reasoningToken))
                    {
                        thinkingChars += reasoningToken.Length;
                        yield return LlmStreamEvent.ThinkingOf(reasoningToken);
                    }

                    if (string.IsNullOrEmpty(rawToken)) continue;

                    // Route inline <think> blocks to the thinking channel
                    pending.Append(rawToken);
                    while (pending.Length > 0)
                    {
                        var text = pending.ToString();
                        if (!inThink)
                        {
                            var open = text.IndexOf("<think>", StringComparison.Ordinal);
                            if (open < 0)
                            {
                                // Hold back a possible partial "<think" prefix at the tail
                                var hold = PartialTagSuffix(text, "<think>");
                                var emit = text.Substring(0, text.Length - hold);
                                if (emit.Length > 0)
                                {
                                    fullResponse.Append(emit);
                                    yield return LlmStreamEvent.ContentOf(emit);
                                }
                                pending.Clear();
                                pending.Append(text.Substring(text.Length - hold));
                                break;
                            }
                            var before = text.Substring(0, open);
                            if (before.Length > 0)
                            {
                                fullResponse.Append(before);
                                yield return LlmStreamEvent.ContentOf(before);
                            }
                            pending.Clear();
                            pending.Append(text.Substring(open + 7));
                            inThink = true;
                        }
                        else
                        {
                            var close = text.IndexOf("</think>", StringComparison.Ordinal);
                            if (close < 0)
                            {
                                var hold = PartialTagSuffix(text, "</think>");
                                var emit = text.Substring(0, text.Length - hold);
                                if (emit.Length > 0)
                                {
                                    thinkingChars += emit.Length;
                                    yield return LlmStreamEvent.ThinkingOf(emit);
                                }
                                pending.Clear();
                                pending.Append(text.Substring(text.Length - hold));
                                break;
                            }
                            var inner = text.Substring(0, close);
                            if (inner.Length > 0)
                            {
                                thinkingChars += inner.Length;
                                yield return LlmStreamEvent.ThinkingOf(inner);
                            }
                            pending.Clear();
                            pending.Append(text.Substring(close + 8));
                            inThink = false;
                        }
                    }
                }

                // Flush any held-back tail
                if (pending.Length > 0)
                {
                    var tail = pending.ToString();
                    if (inThink) yield return LlmStreamEvent.ThinkingOf(tail);
                    else { fullResponse.Append(tail); yield return LlmStreamEvent.ContentOf(tail); }
                }
            }
            finally
            {
                reader?.Dispose();
                stream?.Dispose();
                response?.Dispose();
            }

            if (thinkingChars > 0)
                _logger.LogInformation("LocalLLM: session {SessionId} reasoned for ~{Tokens} tokens", sessionId, thinkingChars / ApproxCharsPerToken);

            if (fullResponse.Length == 0 && thinkingChars > 0)
            {
                const string note = "I ran out of room while working through that — could you narrow the question a little?";
                fullResponse.Append(note);
                yield return LlmStreamEvent.ContentOf(note);
            }

            if (fullResponse.Length > 0)
            {
                _conversationMemory.AddMessage(sessionId, "assistant", fullResponse.ToString());
            }
        }

        /// <summary>Length of the longest suffix of <paramref name="text"/> that is a proper prefix of <paramref name="tag"/>.</summary>
        private static int PartialTagSuffix(string text, string tag)
        {
            var max = Math.Min(text.Length, tag.Length - 1);
            for (var len = max; len > 0; len--)
            {
                if (string.CompareOrdinal(text, text.Length - len, tag, 0, len) == 0) return len;
            }
            return 0;
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
        // llama.cpp extensions (ignored by servers that don't support them)
        public Dictionary<string, object>? ChatTemplateKwargs { get; set; }
        public string? ReasoningFormat { get; set; }
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
