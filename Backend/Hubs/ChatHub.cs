using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace ProjectTracker.API.Hubs
{
    // SECURITY: message/edit/delete/read events are broadcast by MessagesController
    // via IHubContext after the change is persisted and authorised. Clients may only
    // join conversations they participate in and send typing indicators there.
    [Authorize]
    public class ChatHub : Hub
    {
        private static readonly Dictionary<int, HashSet<string>> _userConnections = new();
        private static readonly Dictionary<string, int> _connectionUsers = new();

        // Conversations each connection has been verified to participate in.
        private static readonly ConcurrentDictionary<string, ConcurrentDictionary<int, byte>> _joinedConversations = new();

        private readonly ApplicationDbContext _context;

        public ChatHub(ApplicationDbContext context)
        {
            _context = context;
        }

        private int? AuthenticatedUserId()
        {
            var raw = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? Context.User?.FindFirst("sub")?.Value;
            return int.TryParse(raw, out var id) ? id : null;
        }

        public override async Task OnConnectedAsync()
        {
            // Join the personal group immediately so messages arrive even if the
            // client has not called RegisterUser yet.
            var uid = AuthenticatedUserId();
            if (uid.HasValue)
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{uid.Value}");
            await base.OnConnectedAsync();
        }

        public async Task JoinConversation(int conversationId)
        {
            var uid = AuthenticatedUserId();
            if (uid == null) return;

            var isParticipant = await _context.ConversationParticipants
                .AnyAsync(p => p.ConversationId == conversationId && p.UserId == uid.Value);
            if (!isParticipant)
                throw new HubException("You are not a participant in this conversation.");

            _joinedConversations.GetOrAdd(Context.ConnectionId, _ => new ConcurrentDictionary<int, byte>())[conversationId] = 0;
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
        }

        public async Task LeaveConversation(int conversationId)
        {
            if (_joinedConversations.TryGetValue(Context.ConnectionId, out var joined))
                joined.TryRemove(conversationId, out _);
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
        }

        public async Task RegisterUser(int userId)
        {
            // Never trust the client-supplied id when the token identifies the user.
            userId = AuthenticatedUserId() ?? userId;
            var connectionId = Context.ConnectionId;

            lock (_userConnections)
            {
                if (!_userConnections.ContainsKey(userId))
                {
                    _userConnections[userId] = new HashSet<string>();
                }
                _userConnections[userId].Add(connectionId);
                _connectionUsers[connectionId] = userId;
            }

            // Add user to their personal notification group
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");

            // Notify others that user is online
            await Clients.Others.SendAsync("UserOnline", new OnlineStatus
            {
                UserId = userId,
                IsOnline = true
            });
        }

        public async Task SendTypingIndicator(int conversationId, bool isTyping)
        {
            if (!_joinedConversations.TryGetValue(Context.ConnectionId, out var joined) || !joined.ContainsKey(conversationId))
                return;

            var userId = AuthenticatedUserId() ?? 0;
            var userName = Context.User?.FindFirst(ClaimTypes.Name)?.Value ?? "Someone";
            await Clients.OthersInGroup($"conversation_{conversationId}")
                .SendAsync("UserTyping", new TypingIndicator
                {
                    ConversationId = conversationId,
                    UserId = userId,
                    UserName = userName,
                    IsTyping = isTyping
                });
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            _joinedConversations.TryRemove(Context.ConnectionId, out _);
            int? userId = null;

            lock (_userConnections)
            {
                if (_connectionUsers.TryGetValue(Context.ConnectionId, out var uid))
                {
                    userId = uid;
                    _connectionUsers.Remove(Context.ConnectionId);

                    if (_userConnections.TryGetValue(uid, out var connections))
                    {
                        connections.Remove(Context.ConnectionId);
                        if (connections.Count == 0)
                        {
                            _userConnections.Remove(uid);
                        }
                        else
                        {
                            userId = null; // User still has other connections
                        }
                    }
                }
            }

            // Remove from user notification group
            if (userId.HasValue)
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId.Value}");
                
                await Clients.Others.SendAsync("UserOffline", new OnlineStatus
                {
                    UserId = userId.Value,
                    IsOnline = false,
                    LastSeen = DateTime.UtcNow
                });
            }

            await base.OnDisconnectedAsync(exception);
        }

        public List<int> GetOnlineUsers()
        {
            lock (_userConnections)
            {
                return _userConnections.Keys.ToList();
            }
        }

        public async Task GetOnlineUsersList()
        {
            var onlineUsers = GetOnlineUsers();
            await Clients.Caller.SendAsync("OnlineUsersList", onlineUsers);
        }
    }
}
