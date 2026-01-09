using System.Text;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services
{
    public interface ILlamaAIService
    {
        Task<string> GenerateResponseAsync(string prompt, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> GenerateStreamingResponseAsync(string prompt, CancellationToken cancellationToken = default);
        Task<string> ChatAsync(List<ChatMessage> messages, CancellationToken cancellationToken = default);
        IAsyncEnumerable<string> ChatStreamingAsync(List<ChatMessage> messages, CancellationToken cancellationToken = default);
        bool IsModelLoaded { get; }
    }

    public class ChatMessage
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class DocumentAnalysis
    {
        public string FileName { get; set; } = "";
        public int WordCount { get; set; }
        public int CharacterCount { get; set; }
        public int LineCount { get; set; }
        public int ParagraphCount { get; set; }
        public int SentenceCount { get; set; }
        public string DocumentType { get; set; } = "General Document";
        public List<string> KeyTopics { get; set; } = new();
        public List<string> KeyPhrases { get; set; } = new();
        public double ReadingTimeMinutes { get; set; }
        public string Summary { get; set; } = "";
    }

    /// <summary>
    /// Simple rule-based AI service that provides helpful responses for common intranet queries.
    /// This is a lightweight fallback when LLamaSharp is not available.
    /// 
    /// Behavioral Guidelines:
    /// - Give concise step-by-step help for IT, intranet, files, and messaging
    /// - Do not invent company facts
    /// - Do not ask for passwords/OTPs
    /// - Do not help bypass security
    /// - If unsure, ask 1 clarifying question then suggest contacting IT/HR/manager
    /// - Use bullets and end with next steps
    /// </summary>
    public class LlamaAIService : ILlamaAIService
    {
        private readonly ILogger<LlamaAIService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly Dictionary<string, string[]> _responses;
        private readonly string[] _greetings;
        private readonly string[] _securityKeywords;
        private readonly Random _random = new();

        public bool IsModelLoaded => true; // Always ready

        public LlamaAIService(ILogger<LlamaAIService> logger, IConfiguration configuration, IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            
            // Security-sensitive keywords that Welly should not help with
            _securityKeywords = new[]
            {
                "bypass", "hack", "crack", "break into", "get around", "skip verification",
                "otp", "one-time", "verification code", "give me password", "tell me password",
                "admin access", "root access", "override", "disable security", "turn off security"
            };
            
            _greetings = new[]
            {
                "Hello! I'm Welly, your intranet support assistant. How can I help you today?",
                "Hi there! I'm Welly. What can I assist you with?",
                "Greetings! I'm Welly, here to help with IT, files, and messaging questions.",
                "Hello! Welly here. What do you need help with?"
            };

            _responses = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                // Password related - Never ask for or provide actual passwords
                ["password"] = new[]
                {
                    "**Password Reset Steps:**\n• Go to the login page\n• Click 'Forgot Password'\n• Enter your work email\n• Check inbox for reset link\n\n**Next steps:** Follow the email instructions. If no email arrives within 5 minutes, contact IT Support.",
                    "**For password issues:**\n• Use the 'Forgot Password' link on login page\n• Never share your password with anyone\n\n**Next steps:** If the reset doesn't work, contact IT Support directly."
                },
                
                // Attendance related
                ["attendance|clock|time"] = new[]
                {
                    "**Clock In/Out:**\n• Open Attendance from the sidebar\n• Click 'Clock In' at shift start\n• Click 'Clock Out' when done\n• View history in the same section\n\n**Next steps:** If you missed a clock-in, contact your manager to correct the record.",
                    "**Attendance System:**\n• Access via sidebar → Attendance\n• Records are saved automatically\n• Check your history anytime\n\n**Next steps:** For attendance corrections, speak with your manager or HR."
                },
                
                // Project/Board related
                ["project|board|kanban|task|card"] = new[]
                {
                    "**Project Management:**\n• Go to Project Management in sidebar\n• Select or create a board\n• Add lists (To Do, In Progress, Done)\n• Create cards for tasks\n• Drag cards to update status\n\n**Next steps:** Click any card to add details, comments, or attachments.",
                    "**Using Kanban Boards:**\n• Access via sidebar → Project Management\n• Create boards for different projects\n• Add task cards and drag between lists\n\n**Next steps:** Need to add team members? Click the board settings icon."
                },
                
                // Leave/Holiday related
                ["leave|holiday|vacation|time off|pto"] = new[]
                {
                    "**Request Leave:**\n• Go to Attendance section\n• Click 'Request Leave'\n• Select leave type and dates\n• Submit for approval\n\n**Next steps:** Your manager will be notified. Check request status in the Attendance section.",
                    "**Leave Requests:**\n• Submit via Attendance → Request Leave\n• Choose dates and leave type\n• Manager receives notification\n\n**Next steps:** For urgent leave, also notify your manager directly."
                },
                
                // IT Support
                ["computer|laptop|printer|network|wifi|internet|slow|not working|broken|error"] = new[]
                {
                    "**Basic Troubleshooting:**\n• Restart your device\n• Check cable connections\n• Clear browser cache\n• Try a different browser\n\n**Next steps:** If issue persists, submit a support ticket via IT Help Desk or contact IT Support directly for urgent issues.",
                    "**IT Issue Steps:**\n• Restart the device first\n• Check network/cable connections\n• Note any error messages\n\n**Next steps:** Submit a help desk ticket with the error details, or call IT Support for urgent problems."
                },
                
                // Messages/Chat
                ["message|chat|communicate|contact"] = new[]
                {
                    "**Send Messages:**\n• Click Messages in the sidebar\n• Select a contact or start new conversation\n• Type and press Enter to send\n\n**Next steps:** Use team channels for group discussions. Messages sync in real-time.",
                    "**Messaging Features:**\n• Direct messages to colleagues\n• Team channels for groups\n• Real-time delivery\n\n**Next steps:** Click the + icon to start a new conversation."
                },
                
                // Reports
                ["report|analytics|dashboard|statistics"] = new[]
                {
                    "**Available Reports:**\n• Attendance: time tracking data\n• Projects: task completion metrics\n• Department: team overview\n\n**Next steps:** Go to Reports section, select type and date range, then export to Excel if needed.",
                    "**Accessing Reports:**\n• Open Reports from sidebar\n• Choose report type\n• Set date range\n• View or export data\n\n**Next steps:** Most reports can be exported to Excel for further analysis."
                },
                
                // Profile
                ["profile|account|settings|photo|picture"] = new[]
                {
                    "**Update Your Profile:**\n• Click your avatar (top right)\n• Select Profile or Settings\n• Edit your information\n• Click Save\n\n**Next steps:** You can update your photo, contact details, and notification preferences.",
                    "**Profile Settings:**\n• Access via avatar in header\n• Update personal info\n• Change profile photo\n• Adjust notifications\n\n**Next steps:** Click Save after making changes."
                },
                
                // Help
                ["help|support|how do i|how to|what is|tutorial"] = new[]
                {
                    "**I can help with:**\n• Attendance: clock in/out, leave requests\n• Projects: boards and task management\n• Messages: team communication\n• IT Issues: basic troubleshooting\n• Reports: accessing data\n• Files: uploading and sharing\n\n**Next steps:** Ask me a specific question, or contact IT/HR for complex issues.",
                    "**How I can assist:**\n• Navigate the intranet\n• Use attendance, projects, messaging\n• Basic IT troubleshooting\n• Find the right department\n\n**Next steps:** Tell me what you need help with!"
                },
                
                // Thank you
                ["thank|thanks"] = new[]
                {
                    "You're welcome! Is there anything else I can help you with?",
                    "Happy to help! Let me know if you have any other questions.",
                    "Glad I could assist! Feel free to ask if you need anything else."
                },
                
                // Goodbye
                ["bye|goodbye|see you|that's all"] = new[]
                {
                    "Goodbye! Have a great day. I'm here whenever you need assistance.",
                    "Take care! Don't hesitate to reach out if you have more questions.",
                    "Bye! Wishing you a productive day ahead."
                }
            };
        }

        public Task<string> GenerateResponseAsync(string prompt, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(GetResponse(prompt));
        }

        public async IAsyncEnumerable<string> GenerateStreamingResponseAsync(string prompt, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var response = GetResponse(prompt);
            var words = response.Split(' ');
            
            foreach (var word in words)
            {
                if (cancellationToken.IsCancellationRequested) yield break;
                yield return word + " ";
                await Task.Delay(30, cancellationToken); // Simulate typing
            }
        }

        public async Task<string> ChatAsync(List<ChatMessage> messages, CancellationToken cancellationToken = default)
        {
            var lastUserMessage = messages.LastOrDefault(m => m.Role.Equals("user", StringComparison.OrdinalIgnoreCase));
            var prompt = lastUserMessage?.Content ?? "";
            
            // Check if this is a document analysis request
            if (IsDocumentAnalysisRequest(prompt))
            {
                return AnalyzeDocument(prompt);
            }
            
            // Try to get context from knowledge base (RAG)
            var kbResponse = await GetKnowledgeBaseResponseAsync(prompt);
            if (!string.IsNullOrEmpty(kbResponse))
            {
                return kbResponse;
            }
            
            return GetResponse(prompt);
        }

        public async IAsyncEnumerable<string> ChatStreamingAsync(List<ChatMessage> messages, [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var lastUserMessage = messages.LastOrDefault(m => m.Role.Equals("user", StringComparison.OrdinalIgnoreCase));
            var prompt = lastUserMessage?.Content ?? "";
            
            // Get response (with RAG if available)
            var response = await GetResponseWithRagAsync(prompt);
            var words = response.Split(' ');
            
            foreach (var word in words)
            {
                if (cancellationToken.IsCancellationRequested) yield break;
                yield return word + " ";
                await Task.Delay(25, cancellationToken); // Simulate typing
            }
        }

        private async Task<string> GetResponseWithRagAsync(string input)
        {
            // Check for document analysis
            if (IsDocumentAnalysisRequest(input))
            {
                return AnalyzeDocument(input);
            }
            
            // Try knowledge base first
            var kbResponse = await GetKnowledgeBaseResponseAsync(input);
            if (!string.IsNullOrEmpty(kbResponse))
            {
                return kbResponse;
            }
            
            return GetResponse(input);
        }

        private async Task<string?> GetKnowledgeBaseResponseAsync(string query)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var kbService = scope.ServiceProvider.GetService<IKnowledgeBaseService>();
                
                if (kbService == null)
                {
                    return null;
                }

                var results = await kbService.SearchAsync(query, 3);
                
                if (results == null || results.Count == 0 || results.Max(r => r.Score) < 2.0)
                {
                    return null; // No relevant results found
                }

                // Build response from knowledge base
                var sb = new StringBuilder();
                sb.AppendLine("📚 **From the Knowledge Base:**\n");

                var topResult = results.First();
                var allSources = results.Select(r => r.FileName).Distinct().ToList();

                // Format the content nicely
                var content = topResult.Content;
                
                // Check if content has natural bullet points or numbered lists
                if (content.Contains("•") || content.Contains("-") || Regex.IsMatch(content, @"\d+\."))
                {
                    sb.AppendLine(content);
                }
                else
                {
                    // Break into sentences and format as bullets
                    var sentences = Regex.Split(content, @"(?<=[.!?])\s+")
                        .Where(s => s.Trim().Length > 10)
                        .Take(5)
                        .ToList();

                    if (sentences.Count > 1)
                    {
                        foreach (var sentence in sentences)
                        {
                            sb.AppendLine($"• {sentence.Trim()}");
                        }
                    }
                    else
                    {
                        sb.AppendLine(content);
                    }
                }

                sb.AppendLine();
                sb.AppendLine($"📄 **Source:** {string.Join(", ", allSources)}");
                sb.AppendLine();
                sb.AppendLine("**Next steps:** For more details, check the original document or contact the relevant department.");

                return sb.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to query knowledge base");
                return null;
            }
        }

        private string GetResponse(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
            {
                return _greetings[_random.Next(_greetings.Length)];
            }

            var lowered = input.ToLower().Trim();

            // Security check - do not help bypass security or provide sensitive info
            foreach (var securityKeyword in _securityKeywords)
            {
                if (lowered.Contains(securityKeyword))
                {
                    return "I'm sorry, but I can't help with that request. For security-related issues, please contact IT Support directly.\n\n**Next steps:** Reach out to IT Support or your manager for assistance with security matters.";
                }
            }

            // Check for greetings
            if (Regex.IsMatch(lowered, @"^(hi|hello|hey|good morning|good afternoon|good evening|greetings)[\s!.,]*$"))
            {
                return _greetings[_random.Next(_greetings.Length)];
            }

            // Search for matching keywords
            foreach (var kvp in _responses)
            {
                var keywords = kvp.Key.Split('|');
                foreach (var keyword in keywords)
                {
                    if (lowered.Contains(keyword.ToLower()))
                    {
                        var possibleResponses = kvp.Value;
                        return possibleResponses[_random.Next(possibleResponses.Length)];
                    }
                }
            }

            // Default response for unrecognized queries
            return GetDefaultResponse(input);
        }

        private string GetDefaultResponse(string input)
        {
            var responses = new[]
            {
                $"I don't have specific information about \"{TruncateText(input, 40)}\".\n\n**Can you tell me more?** Is this related to:\n• IT or technical issues\n• Attendance or leave\n• Projects or tasks\n• Something else\n\n**Next steps:** If I can't help, please contact IT Support, HR, or your manager.",
                
                $"I'm not sure I understand your question about \"{TruncateText(input, 40)}\".\n\n**I can help with:**\n• Intranet navigation\n• Attendance and leave\n• Project management\n• Basic IT troubleshooting\n• Files and messaging\n\n**Next steps:** Try rephrasing, or contact IT/HR for complex issues.",
                
                "I don't have information on that specific topic.\n\n**Who can help:**\n• **IT Support**: Technical issues\n• **HR**: Personnel matters\n• **Your Manager**: Work-related questions\n\n**Next steps:** Contact the appropriate department above, or ask me about a different topic."
            };

            return responses[_random.Next(responses.Length)];
        }

        private static string TruncateText(string text, int maxLength)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength)
                return text;
            
            return text.Substring(0, maxLength) + "...";
        }

        private bool IsDocumentAnalysisRequest(string prompt)
        {
            // Check for markers that indicate a document was uploaded
            return prompt.Contains("--- DOCUMENT CONTENT ---") || 
                   prompt.Contains("DOCUMENT CONTENT:") ||
                   prompt.Contains("[Document:") ||
                   (prompt.Length > 1000 && ContainsDocumentPatterns(prompt));
        }

        private bool ContainsDocumentPatterns(string text)
        {
            // Check for patterns that suggest this is document content
            var documentIndicators = new[]
            {
                "page ", "section ", "chapter ", "table of contents",
                "introduction", "conclusion", "abstract", "summary",
                "figure ", "appendix", "references", "document"
            };
            
            var lowered = text.ToLower();
            var matches = documentIndicators.Count(indicator => lowered.Contains(indicator));
            return matches >= 2;
        }

        private string AnalyzeDocument(string prompt)
        {
            // Extract document content and any user question
            var (documentContent, userQuestion, fileName) = ParseDocumentPrompt(prompt);
            
            if (string.IsNullOrWhiteSpace(documentContent))
            {
                return "I couldn't find any document content to analyze. Please try uploading the file again.";
            }

            var analysis = PerformDocumentAnalysis(documentContent, fileName);
            
            // If user asked a specific question, try to answer it
            if (!string.IsNullOrWhiteSpace(userQuestion))
            {
                return AnswerDocumentQuestion(userQuestion, documentContent, analysis);
            }
            
            // Otherwise, provide a full analysis
            return FormatDocumentAnalysis(analysis, documentContent);
        }

        private (string content, string question, string fileName) ParseDocumentPrompt(string prompt)
        {
            string content = "";
            string question = "";
            string fileName = "document";

            // Try to extract filename
            var fileMatch = Regex.Match(prompt, @"\[Document:\s*([^\]]+)\]", RegexOptions.IgnoreCase);
            if (fileMatch.Success)
            {
                fileName = fileMatch.Groups[1].Value.Trim();
            }

            // Look for document content markers
            var contentMarkers = new[] { "--- DOCUMENT CONTENT ---", "DOCUMENT CONTENT:", "Content:" };
            foreach (var marker in contentMarkers)
            {
                var idx = prompt.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (idx >= 0)
                {
                    question = prompt.Substring(0, idx).Trim();
                    content = prompt.Substring(idx + marker.Length).Trim();
                    
                    // Clean up the question
                    question = Regex.Replace(question, @"\[Document:[^\]]+\]", "").Trim();
                    question = Regex.Replace(question, @"^(analyze|summarize|read|review)\s+this\s+(document|file|pdf)\s*:?\s*", "", RegexOptions.IgnoreCase).Trim();
                    
                    break;
                }
            }

            // If no markers found, treat the whole thing as content
            if (string.IsNullOrEmpty(content) && prompt.Length > 500)
            {
                content = prompt;
            }

            return (content, question, fileName);
        }

        private DocumentAnalysis PerformDocumentAnalysis(string content, string fileName)
        {
            var analysis = new DocumentAnalysis { FileName = fileName };

            // Basic statistics
            analysis.CharacterCount = content.Length;
            analysis.WordCount = Regex.Matches(content, @"\b\w+\b").Count;
            analysis.LineCount = content.Split('\n').Length;
            analysis.ParagraphCount = Regex.Matches(content, @"\n\s*\n").Count + 1;
            analysis.SentenceCount = Regex.Matches(content, @"[.!?]+\s+").Count + 1;
            
            // Reading time (average 200 words per minute)
            analysis.ReadingTimeMinutes = Math.Round(analysis.WordCount / 200.0, 1);

            // Detect document type
            analysis.DocumentType = DetectDocumentType(content);

            // Extract key topics
            analysis.KeyTopics = ExtractKeyTopics(content);

            // Extract key phrases
            analysis.KeyPhrases = ExtractKeyPhrases(content);

            // Generate summary
            analysis.Summary = GenerateSimpleSummary(content);

            return analysis;
        }

        private string DetectDocumentType(string content)
        {
            var lowered = content.ToLower();

            var typePatterns = new Dictionary<string, string[]>
            {
                ["Policy Document"] = new[] { "policy", "compliance", "regulation", "guideline", "must comply", "requirement" },
                ["Meeting Minutes"] = new[] { "minutes", "attendees", "agenda", "action items", "meeting", "discussed" },
                ["Technical Report"] = new[] { "methodology", "results", "analysis", "findings", "data", "conclusion" },
                ["Project Proposal"] = new[] { "proposal", "objective", "scope", "timeline", "budget", "deliverables" },
                ["Employee Handbook"] = new[] { "employee", "benefits", "leave", "conduct", "hr", "human resources" },
                ["Procedure Document"] = new[] { "procedure", "step 1", "step 2", "process", "instructions", "how to" },
                ["Contract/Agreement"] = new[] { "agreement", "parties", "terms", "conditions", "effective date", "signature" },
                ["Financial Report"] = new[] { "revenue", "expenses", "profit", "loss", "budget", "financial", "quarter" },
                ["Email/Memo"] = new[] { "dear", "regards", "sincerely", "from:", "to:", "subject:" }
            };

            var bestMatch = "General Document";
            var bestScore = 0;

            foreach (var kvp in typePatterns)
            {
                var score = kvp.Value.Count(pattern => lowered.Contains(pattern));
                if (score > bestScore)
                {
                    bestScore = score;
                    bestMatch = kvp.Key;
                }
            }

            return bestScore >= 2 ? bestMatch : "General Document";
        }

        private List<string> ExtractKeyTopics(string content)
        {
            var topics = new List<string>();
            var lowered = content.ToLower();

            // Business/work-related topics
            var topicKeywords = new Dictionary<string, string[]>
            {
                ["Project Management"] = new[] { "project", "milestone", "deadline", "deliverable", "task" },
                ["Human Resources"] = new[] { "employee", "hiring", "onboarding", "performance", "training" },
                ["Finance"] = new[] { "budget", "cost", "revenue", "expense", "financial" },
                ["IT/Technology"] = new[] { "software", "system", "database", "network", "security" },
                ["Compliance"] = new[] { "compliance", "regulation", "audit", "policy", "legal" },
                ["Marketing"] = new[] { "marketing", "campaign", "brand", "customer", "sales" },
                ["Operations"] = new[] { "operations", "process", "efficiency", "workflow", "procedure" },
                ["Strategy"] = new[] { "strategy", "goal", "objective", "vision", "mission" },
                ["Customer Service"] = new[] { "customer", "support", "service", "satisfaction", "feedback" },
                ["Health & Safety"] = new[] { "safety", "health", "hazard", "emergency", "risk" }
            };

            foreach (var kvp in topicKeywords)
            {
                var score = kvp.Value.Count(keyword => lowered.Contains(keyword));
                if (score >= 2)
                {
                    topics.Add(kvp.Key);
                }
            }

            return topics.Take(5).ToList();
        }

        private List<string> ExtractKeyPhrases(string content)
        {
            var phrases = new List<string>();
            
            // Look for section headers (lines that are short and might be titles)
            var lines = content.Split('\n');
            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                // Headers are typically short, may be all caps or title case
                if (trimmed.Length > 3 && trimmed.Length < 60 && 
                    !trimmed.EndsWith(".") && 
                    (trimmed == trimmed.ToUpper() || char.IsUpper(trimmed[0])))
                {
                    // Skip if it's mostly numbers or special characters
                    if (Regex.IsMatch(trimmed, @"^[A-Za-z\s]{3,}"))
                    {
                        var cleaned = trimmed.Trim(':').Trim();
                        if (!phrases.Contains(cleaned) && cleaned.Split(' ').Length <= 6)
                        {
                            phrases.Add(cleaned);
                        }
                    }
                }
            }

            return phrases.Take(8).ToList();
        }

        private string GenerateSimpleSummary(string content)
        {
            // Get the first few sentences as a basic summary
            var sentences = Regex.Split(content, @"(?<=[.!?])\s+")
                                 .Where(s => s.Trim().Length > 20)
                                 .Take(3)
                                 .ToList();

            if (sentences.Count > 0)
            {
                return string.Join(" ", sentences);
            }

            // Fallback: first 200 characters
            return TruncateText(content.Trim(), 200);
        }

        private string AnswerDocumentQuestion(string question, string content, DocumentAnalysis analysis)
        {
            var loweredQuestion = question.ToLower();
            var sb = new StringBuilder();

            // Summary request
            if (Regex.IsMatch(loweredQuestion, @"summar|overview|about|what is this|describe"))
            {
                sb.AppendLine($"📄 **Document Summary: {analysis.FileName}**\n");
                sb.AppendLine($"**Type:** {analysis.DocumentType}");
                sb.AppendLine($"**Length:** {analysis.WordCount} words ({analysis.ReadingTimeMinutes} min read)\n");
                
                if (analysis.KeyTopics.Count > 0)
                {
                    sb.AppendLine($"**Main Topics:** {string.Join(", ", analysis.KeyTopics)}\n");
                }
                
                sb.AppendLine("**Overview:**");
                sb.AppendLine(analysis.Summary);
                
                return sb.ToString();
            }

            // Key points request
            if (Regex.IsMatch(loweredQuestion, @"key point|main point|highlight|important"))
            {
                sb.AppendLine($"📌 **Key Points from {analysis.FileName}:**\n");
                
                if (analysis.KeyPhrases.Count > 0)
                {
                    foreach (var phrase in analysis.KeyPhrases.Take(6))
                    {
                        sb.AppendLine($"• {phrase}");
                    }
                }
                else
                {
                    sb.AppendLine("• " + TruncateText(analysis.Summary, 100));
                }
                
                return sb.ToString();
            }

            // Length/stats request
            if (Regex.IsMatch(loweredQuestion, @"how long|word count|length|size|pages"))
            {
                sb.AppendLine($"📊 **Document Statistics:**\n");
                sb.AppendLine($"• **Words:** {analysis.WordCount:N0}");
                sb.AppendLine($"• **Characters:** {analysis.CharacterCount:N0}");
                sb.AppendLine($"• **Lines:** {analysis.LineCount:N0}");
                sb.AppendLine($"• **Paragraphs:** {analysis.ParagraphCount:N0}");
                sb.AppendLine($"• **Sentences:** {analysis.SentenceCount:N0}");
                sb.AppendLine($"• **Reading Time:** ~{analysis.ReadingTimeMinutes} minutes");
                
                return sb.ToString();
            }

            // Search for specific content
            if (Regex.IsMatch(loweredQuestion, @"find|search|look for|where|mention|contain|does it"))
            {
                // Extract search terms from question
                var searchTerms = ExtractSearchTerms(question);
                var foundSnippets = new List<string>();

                foreach (var term in searchTerms)
                {
                    var matches = FindContentMentions(content, term);
                    foundSnippets.AddRange(matches);
                }

                if (foundSnippets.Count > 0)
                {
                    sb.AppendLine($"🔍 **Found in document:**\n");
                    foreach (var snippet in foundSnippets.Take(5))
                    {
                        sb.AppendLine($"• \"{snippet}\"");
                    }
                    return sb.ToString();
                }
                else
                {
                    return $"I searched the document but couldn't find specific mentions of what you're looking for. The document is a {analysis.DocumentType} with {analysis.WordCount} words.";
                }
            }

            // Default: provide overview with the question in mind
            return FormatDocumentAnalysis(analysis, content);
        }

        private List<string> ExtractSearchTerms(string question)
        {
            // Remove common question words
            var cleaned = Regex.Replace(question.ToLower(), 
                @"\b(find|search|look|for|where|is|are|the|a|an|does|it|this|document|mention|contain|about|any)\b", " ");
            
            var terms = cleaned.Split(new[] { ' ', ',', '?' }, StringSplitOptions.RemoveEmptyEntries)
                              .Where(t => t.Length > 2)
                              .Distinct()
                              .ToList();
            
            return terms;
        }

        private List<string> FindContentMentions(string content, string term)
        {
            var mentions = new List<string>();
            var lowered = content.ToLower();
            var termLower = term.ToLower();
            
            var idx = 0;
            while ((idx = lowered.IndexOf(termLower, idx)) != -1)
            {
                // Extract surrounding context (40 chars before and after)
                var start = Math.Max(0, idx - 40);
                var end = Math.Min(content.Length, idx + term.Length + 40);
                var snippet = content.Substring(start, end - start).Trim();
                
                // Clean up snippet
                snippet = Regex.Replace(snippet, @"\s+", " ");
                if (start > 0) snippet = "..." + snippet;
                if (end < content.Length) snippet = snippet + "...";
                
                mentions.Add(snippet);
                idx += term.Length;
                
                if (mentions.Count >= 3) break;
            }
            
            return mentions;
        }

        private string FormatDocumentAnalysis(DocumentAnalysis analysis, string content)
        {
            var sb = new StringBuilder();
            
            sb.AppendLine($"📄 **Document Analysis: {analysis.FileName}**\n");
            
            sb.AppendLine("**📊 Statistics:**");
            sb.AppendLine($"• Type: {analysis.DocumentType}");
            sb.AppendLine($"• Words: {analysis.WordCount:N0}");
            sb.AppendLine($"• Reading Time: ~{analysis.ReadingTimeMinutes} minutes\n");
            
            if (analysis.KeyTopics.Count > 0)
            {
                sb.AppendLine("**🏷️ Key Topics:**");
                sb.AppendLine($"• {string.Join(", ", analysis.KeyTopics)}\n");
            }
            
            if (analysis.KeyPhrases.Count > 0)
            {
                sb.AppendLine("**📌 Sections/Headers Found:**");
                foreach (var phrase in analysis.KeyPhrases.Take(5))
                {
                    sb.AppendLine($"• {phrase}");
                }
                sb.AppendLine();
            }
            
            sb.AppendLine("---");
            sb.AppendLine("💡 *You can ask me to:*");
            sb.AppendLine("• \"Summarize this document\"");
            sb.AppendLine("• \"What are the key points?\"");
            sb.AppendLine("• \"Find mentions of [topic]\"");
            sb.AppendLine("• \"How long is this document?\"");
            
            return sb.ToString();
        }
    }
}
