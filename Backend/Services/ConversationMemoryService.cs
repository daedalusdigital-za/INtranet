using System.Collections.Concurrent;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Service to manage conversation history for AI chat sessions.
    /// Stores conversations in memory with automatic expiration.
    /// </summary>
    public interface IConversationMemoryService
    {
        /// <summary>
        /// Add a message to a conversation
        /// </summary>
        void AddMessage(string sessionId, string role, string content);
        
        /// <summary>
        /// Get conversation history for a session
        /// </summary>
        List<ConversationMessage> GetHistory(string sessionId, int? maxMessages = null);
        
        /// <summary>
        /// Clear a conversation
        /// </summary>
        void ClearConversation(string sessionId);
        
        /// <summary>
        /// Get or create a session ID for a user
        /// </summary>
        string GetOrCreateSession(int userId);
        
        /// <summary>
        /// Get conversation summary for context compression
        /// </summary>
        string GetConversationSummary(string sessionId);
    }

    public class ConversationMessage
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public class ConversationSession
    {
        public string SessionId { get; set; } = string.Empty;
        public int UserId { get; set; }
        public List<ConversationMessage> Messages { get; set; } = new();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
    }

    public class ConversationMemoryService : IConversationMemoryService, IDisposable
    {
        private readonly ConcurrentDictionary<string, ConversationSession> _sessions = new();
        private readonly ConcurrentDictionary<int, string> _userSessions = new();
        private readonly ILogger<ConversationMemoryService> _logger;
        private readonly Timer _cleanupTimer;
        
        // Configuration
        private const int MaxMessagesPerSession = 20;  // Keep last 20 messages
        private const int MaxMessageLength = 4000;      // Truncate long messages
        private const int SessionExpirationMinutes = 60; // Expire after 1 hour of inactivity
        private const int CleanupIntervalMinutes = 10;   // Run cleanup every 10 minutes

        public ConversationMemoryService(ILogger<ConversationMemoryService> logger)
        {
            _logger = logger;
            
            // Start cleanup timer
            _cleanupTimer = new Timer(
                CleanupExpiredSessions,
                null,
                TimeSpan.FromMinutes(CleanupIntervalMinutes),
                TimeSpan.FromMinutes(CleanupIntervalMinutes)
            );
        }

        public string GetOrCreateSession(int userId)
        {
            // Check if user has an existing active session
            if (_userSessions.TryGetValue(userId, out var existingSessionId))
            {
                if (_sessions.TryGetValue(existingSessionId, out var existingSession))
                {
                    // Check if session is still valid (not expired)
                    if (DateTime.UtcNow - existingSession.LastActivityAt < TimeSpan.FromMinutes(SessionExpirationMinutes))
                    {
                        existingSession.LastActivityAt = DateTime.UtcNow;
                        return existingSessionId;
                    }
                    
                    // Session expired, remove it
                    _sessions.TryRemove(existingSessionId, out _);
                }
            }

            // Create new session
            var sessionId = $"session_{userId}_{Guid.NewGuid():N}";
            var session = new ConversationSession
            {
                SessionId = sessionId,
                UserId = userId,
                Messages = new List<ConversationMessage>(),
                CreatedAt = DateTime.UtcNow,
                LastActivityAt = DateTime.UtcNow
            };

            _sessions[sessionId] = session;
            _userSessions[userId] = sessionId;
            
            _logger.LogInformation("Created new conversation session {SessionId} for user {UserId}", sessionId, userId);
            
            return sessionId;
        }

        public void AddMessage(string sessionId, string role, string content)
        {
            if (string.IsNullOrEmpty(sessionId) || string.IsNullOrEmpty(content))
                return;

            if (!_sessions.TryGetValue(sessionId, out var session))
            {
                _logger.LogWarning("Session {SessionId} not found when adding message", sessionId);
                return;
            }

            // Truncate long messages
            var truncatedContent = content.Length > MaxMessageLength
                ? content.Substring(0, MaxMessageLength) + "..."
                : content;

            var message = new ConversationMessage
            {
                Role = role,
                Content = truncatedContent,
                Timestamp = DateTime.UtcNow
            };

            session.Messages.Add(message);
            session.LastActivityAt = DateTime.UtcNow;

            // Trim old messages if exceeding limit
            while (session.Messages.Count > MaxMessagesPerSession)
            {
                session.Messages.RemoveAt(0);
            }

            _logger.LogDebug("Added {Role} message to session {SessionId}. Total messages: {Count}", 
                role, sessionId, session.Messages.Count);
        }

        public List<ConversationMessage> GetHistory(string sessionId, int? maxMessages = null)
        {
            if (string.IsNullOrEmpty(sessionId))
                return new List<ConversationMessage>();

            if (!_sessions.TryGetValue(sessionId, out var session))
                return new List<ConversationMessage>();

            session.LastActivityAt = DateTime.UtcNow;

            var limit = maxMessages ?? MaxMessagesPerSession;
            
            // Return the most recent messages
            return session.Messages
                .TakeLast(limit)
                .ToList();
        }

        public void ClearConversation(string sessionId)
        {
            if (_sessions.TryGetValue(sessionId, out var session))
            {
                session.Messages.Clear();
                session.LastActivityAt = DateTime.UtcNow;
                _logger.LogInformation("Cleared conversation for session {SessionId}", sessionId);
            }
        }

        public string GetConversationSummary(string sessionId)
        {
            if (!_sessions.TryGetValue(sessionId, out var session))
                return string.Empty;

            if (session.Messages.Count == 0)
                return string.Empty;

            // Build a brief summary of the conversation topics
            var userMessages = session.Messages
                .Where(m => m.Role == "user")
                .Select(m => m.Content.Length > 100 ? m.Content.Substring(0, 100) + "..." : m.Content)
                .ToList();

            if (userMessages.Count == 0)
                return string.Empty;

            var summary = $"Previous conversation topics ({userMessages.Count} messages):\n";
            summary += string.Join("\n", userMessages.TakeLast(5).Select((m, i) => $"- {m}"));
            
            return summary;
        }

        private void CleanupExpiredSessions(object? state)
        {
            var expiredSessions = _sessions
                .Where(s => DateTime.UtcNow - s.Value.LastActivityAt > TimeSpan.FromMinutes(SessionExpirationMinutes))
                .Select(s => s.Key)
                .ToList();

            foreach (var sessionId in expiredSessions)
            {
                if (_sessions.TryRemove(sessionId, out var session))
                {
                    _userSessions.TryRemove(session.UserId, out _);
                    _logger.LogInformation("Expired conversation session {SessionId}", sessionId);
                }
            }

            if (expiredSessions.Count > 0)
            {
                _logger.LogInformation("Cleaned up {Count} expired conversation sessions", expiredSessions.Count);
            }
        }

        public void Dispose()
        {
            _cleanupTimer?.Dispose();
        }
    }
}
