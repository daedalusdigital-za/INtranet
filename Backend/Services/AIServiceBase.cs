using System.Text;
using System.Text.Json;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Base class for AI services providing shared functionality:
    /// - System prompt loading
    /// - Context retrieval (DB + Knowledge Base)
    /// - User context building
    /// - Page label mapping
    /// - SSE stream parsing
    /// </summary>
    public abstract class AIServiceBase
    {
        protected readonly ILogger _logger;
        protected readonly IServiceScopeFactory _scopeFactory;
        protected readonly IConversationMemoryService _conversationMemory;
        protected string _systemPrompt = string.Empty;

        // Token budgets - can be overridden by derived classes
        protected virtual int MaxContextTokens => 6000;
        protected virtual int ApproxCharsPerToken => 4;
        protected virtual int MaxResponseTokens => 2048;

        protected static readonly string[] SystemPromptPaths = new[]
        {
            Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "ai-data", "prompts", "system.txt"),
            "/app/ai-data/prompts/system.txt",
            Path.Combine(AppContext.BaseDirectory, "ai-data", "prompts", "system.txt"),
        };

        protected static readonly string FallbackSystemPrompt = @"You are Welly, a helpful AI assistant for the ProMed Technologies intranet.
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

        protected AIServiceBase(
            ILogger logger,
            IServiceScopeFactory scopeFactory,
            IConversationMemoryService conversationMemory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _conversationMemory = conversationMemory;
        }

        /// <summary>
        /// Load system prompt from predefined paths with fallback
        /// </summary>
        protected void LoadSystemPrompt(string serviceName)
        {
            foreach (var path in SystemPromptPaths)
            {
                if (File.Exists(path))
                {
                    _systemPrompt = File.ReadAllText(path);
                    _logger.LogInformation("{Service}: Loaded system prompt from: {Path}", serviceName, path);
                    return;
                }
            }

            _logger.LogWarning("{Service}: System prompt file not found. Using fallback.", serviceName);
            _systemPrompt = FallbackSystemPrompt;
        }

        /// <summary>
        /// Get RAG context for the user's query from the database AND knowledge base documents.
        /// Enforces a character budget to prevent context window overflow.
        /// </summary>
        protected async Task<string?> GetContextForQueryAsync(string query, string? pageContext = null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var sb = new StringBuilder();

                // Budget: leave room for system prompt, user context, user msg, history
                var maxContextChars = (MaxContextTokens - 1500) * ApproxCharsPerToken;

                // 1. Live database context (employees, attendance, customers, etc.)
                var contextService = scope.ServiceProvider.GetService<IAIContextService>();
                if (contextService != null)
                {
                    var dbContext = await contextService.GetContextForQueryAsync(query, pageContext);
                    if (!string.IsNullOrEmpty(dbContext))
                    {
                        sb.Append(dbContext);
                        _logger.LogDebug("AI Context: DB {Length} chars (page: {Page})", dbContext.Length, pageContext ?? "none");
                    }
                }

                // 2. Knowledge base document search (policies, procedures, guides)
                var remainingBudget = maxContextChars - sb.Length;
                if (remainingBudget > 500)
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
                            _logger.LogDebug("AI Context: KB {Length} chars", kbContext.Length);
                        }
                    }
                }

                if (sb.Length > 0)
                {
                    _logger.LogDebug("AI Context: Total {Length} chars (~{Tokens} tokens)",
                        sb.Length, sb.Length / ApproxCharsPerToken);
                }

                return sb.Length > 0 ? sb.ToString() : null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get AI context");
                return null;
            }
        }

        /// <summary>
        /// Build a user identity block to inject into the system prompt
        /// </summary>
        protected static string BuildUserContextBlock(ChatUserContext? user)
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
        protected static string GetPageLabel(string? pageContext)
        {
            if (string.IsNullOrEmpty(pageContext)) return "Unknown Page";

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

        /// <summary>
        /// Parse SSE stream data line and extract the content token.
        /// Returns null if the line doesn't contain content or is malformed.
        /// </summary>
        protected string? ParseSseToken(string line)
        {
            if (string.IsNullOrEmpty(line)) return null;
            if (!line.StartsWith("data: ")) return null;

            var data = line.Substring(6);
            if (data == "[DONE]") return null;

            try
            {
                var eventDoc = JsonDocument.Parse(data);
                var choices = eventDoc.RootElement.GetProperty("choices");
                if (choices.GetArrayLength() > 0)
                {
                    var delta = choices[0].GetProperty("delta");
                    if (delta.TryGetProperty("content", out var contentProp))
                    {
                        return contentProp.GetString();
                    }
                }
            }
            catch (JsonException ex)
            {
                // SSE streams can have malformed lines during streaming - this is expected
                _logger.LogTrace(ex, "JSON parse failed for SSE line (expected for partial data)");
            }

            return null;
        }

        /// <summary>
        /// Parse Claude-style SSE events (content_block_delta with text_delta)
        /// </summary>
        protected string? ParseClaudeSseToken(string line)
        {
            if (string.IsNullOrEmpty(line)) return null;
            if (!line.StartsWith("data: ")) return null;

            var data = line.Substring(6);

            try
            {
                var eventDoc = JsonDocument.Parse(data);
                var root = eventDoc.RootElement;

                if (root.TryGetProperty("type", out var typeProp))
                {
                    var eventType = typeProp.GetString();
                    if (eventType == "content_block_delta" &&
                        root.TryGetProperty("delta", out var delta) &&
                        delta.TryGetProperty("type", out var deltaType) &&
                        deltaType.GetString() == "text_delta" &&
                        delta.TryGetProperty("text", out var textProp))
                    {
                        return textProp.GetString();
                    }
                }
            }
            catch (JsonException ex)
            {
                _logger.LogTrace(ex, "JSON parse failed for Claude SSE line (expected for partial data)");
            }

            return null;
        }
    }
}
