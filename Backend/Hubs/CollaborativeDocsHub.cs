using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace ProjectTracker.API.Hubs
{
    [Authorize]
    public class CollaborativeDocsHub : Hub
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CollaborativeDocsHub> _logger;

        // Track active users per document
        private static readonly ConcurrentDictionary<int, ConcurrentDictionary<string, UserPresenceDto>> DocumentPresence = new();

        // Track which document each connection is in
        private static readonly ConcurrentDictionary<string, int> ConnectionDocuments = new();

        // User colors for presence indicators
        private static readonly string[] Colors = new[]
        {
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
            "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
        };

        public CollaborativeDocsHub(ApplicationDbContext context, ILogger<CollaborativeDocsHub> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out int userId) ? userId : 0;
        }

        private async Task<string> GetUserName(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            return user?.FullName ?? "Unknown";
        }

        private string GetUserColor(int userId)
        {
            return Colors[userId % Colors.Length];
        }

        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var connectionId = Context.ConnectionId;

            // Remove user from document presence
            if (ConnectionDocuments.TryRemove(connectionId, out int documentId))
            {
                if (DocumentPresence.TryGetValue(documentId, out var presence))
                {
                    presence.TryRemove(connectionId, out _);

                    // Notify others that user left
                    await Clients.Group($"doc_{documentId}").SendAsync("UserLeft", connectionId);

                    // If no more users, remove document from tracking
                    if (presence.IsEmpty)
                    {
                        DocumentPresence.TryRemove(documentId, out _);
                    }
                }
            }

            _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);
            await base.OnDisconnectedAsync(exception);
        }

        // Join a document room
        public async Task JoinDocument(int documentId)
        {
            var userId = GetCurrentUserId();
            var connectionId = Context.ConnectionId;

            // Verify access to document
            var document = await _context.CollaborativeDocuments
                .Include(d => d.Collaborators)
                .FirstOrDefaultAsync(d => d.Id == documentId && !d.IsDeleted);

            if (document == null)
            {
                await Clients.Caller.SendAsync("Error", "Document not found");
                return;
            }

            // Check access
            if (!document.IsPublic &&
                document.CreatedById != userId &&
                !document.Collaborators.Any(c => c.UserId == userId))
            {
                await Clients.Caller.SendAsync("Error", "Access denied");
                return;
            }

            // Leave previous document if any
            if (ConnectionDocuments.TryGetValue(connectionId, out int prevDocId))
            {
                await Groups.RemoveFromGroupAsync(connectionId, $"doc_{prevDocId}");
                if (DocumentPresence.TryGetValue(prevDocId, out var prevPresence))
                {
                    prevPresence.TryRemove(connectionId, out _);
                    await Clients.Group($"doc_{prevDocId}").SendAsync("UserLeft", connectionId);
                }
            }

            // Join document group
            await Groups.AddToGroupAsync(connectionId, $"doc_{documentId}");
            ConnectionDocuments[connectionId] = documentId;

            // Add to presence tracking
            var userName = await GetUserName(userId);
            var userPresence = new UserPresenceDto
            {
                UserId = userId,
                UserName = userName,
                Color = GetUserColor(userId)
            };

            var docPresence = DocumentPresence.GetOrAdd(documentId, _ => new ConcurrentDictionary<string, UserPresenceDto>());
            docPresence[connectionId] = userPresence;

            // Send current presence to joining user
            var currentPresence = docPresence.Values.ToList();
            await Clients.Caller.SendAsync("PresenceSync", currentPresence);

            // Notify others that user joined
            await Clients.OthersInGroup($"doc_{documentId}").SendAsync("UserJoined", connectionId, userPresence);

            _logger.LogInformation("User {UserId} joined document {DocumentId}", userId, documentId);
        }

        // Leave document room
        public async Task LeaveDocument(int documentId)
        {
            var connectionId = Context.ConnectionId;

            await Groups.RemoveFromGroupAsync(connectionId, $"doc_{documentId}");
            ConnectionDocuments.TryRemove(connectionId, out _);

            if (DocumentPresence.TryGetValue(documentId, out var presence))
            {
                presence.TryRemove(connectionId, out _);
                await Clients.Group($"doc_{documentId}").SendAsync("UserLeft", connectionId);
            }
        }

        // Broadcast document update to all users in the document
        public async Task BroadcastUpdate(int documentId, string update)
        {
            var connectionId = Context.ConnectionId;

            // Verify connection is in this document
            if (!ConnectionDocuments.TryGetValue(connectionId, out int docId) || docId != documentId)
            {
                return;
            }

            // Broadcast to all OTHER users in the document (not sender)
            await Clients.OthersInGroup($"doc_{documentId}").SendAsync("DocumentUpdate", update);
        }

        // Update cursor position
        public async Task UpdateCursor(int documentId, int from, int to)
        {
            var connectionId = Context.ConnectionId;

            if (!ConnectionDocuments.TryGetValue(connectionId, out int docId) || docId != documentId)
            {
                return;
            }

            if (DocumentPresence.TryGetValue(documentId, out var presence))
            {
                if (presence.TryGetValue(connectionId, out var userPresence))
                {
                    userPresence.Cursor = new CursorPosition { From = from, To = to };

                    await Clients.OthersInGroup($"doc_{documentId}").SendAsync("CursorUpdate", connectionId, userPresence);
                }
            }
        }

        // Request sync from other clients (for reconnection)
        public async Task RequestSync(int documentId)
        {
            var connectionId = Context.ConnectionId;

            // Ask one other client to send their current state
            await Clients.OthersInGroup($"doc_{documentId}").SendAsync("SyncRequested", connectionId);
        }

        // Send sync data to requesting client
        public async Task SendSyncData(string targetConnectionId, string yjsState)
        {
            await Clients.Client(targetConnectionId).SendAsync("SyncData", yjsState);
        }

        // Save awareness/presence state
        public async Task UpdateAwareness(int documentId, string awarenessState)
        {
            var connectionId = Context.ConnectionId;

            if (!ConnectionDocuments.TryGetValue(connectionId, out int docId) || docId != documentId)
            {
                return;
            }

            await Clients.OthersInGroup($"doc_{documentId}").SendAsync("AwarenessUpdate", connectionId, awarenessState);
        }
    }
}
