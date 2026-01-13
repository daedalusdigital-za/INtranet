using Microsoft.AspNetCore.SignalR;
using ProjectTracker.API.DTOs;

namespace ProjectTracker.API.Hubs
{
    public class ChatHub : Hub
    {
        private static readonly Dictionary<int, HashSet<string>> _userConnections = new();
        private static readonly Dictionary<string, int> _connectionUsers = new();

        public async Task JoinConversation(int conversationId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
        }

        public async Task LeaveConversation(int conversationId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"conversation_{conversationId}");
        }

        public async Task RegisterUser(int userId)
        {
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

        public async Task SendMessage(MessageDto message)
        {
            await Clients.Group($"conversation_{message.ConversationId}")
                .SendAsync("ReceiveMessage", message);
        }

        public async Task MessageEdited(int conversationId, int messageId, string newContent)
        {
            await Clients.Group($"conversation_{conversationId}")
                .SendAsync("MessageEdited", new { messageId, newContent, editedAt = DateTime.UtcNow });
        }

        public async Task MessageDeleted(int conversationId, int messageId)
        {
            await Clients.Group($"conversation_{conversationId}")
                .SendAsync("MessageDeleted", messageId);
        }

        public async Task SendTypingIndicator(int conversationId, int userId, string userName, bool isTyping)
        {
            await Clients.OthersInGroup($"conversation_{conversationId}")
                .SendAsync("UserTyping", new TypingIndicator
                {
                    ConversationId = conversationId,
                    UserId = userId,
                    UserName = userName,
                    IsTyping = isTyping
                });
        }

        public async Task MarkMessagesAsRead(int conversationId, int userId, int lastReadMessageId)
        {
            await Clients.Group($"conversation_{conversationId}")
                .SendAsync("MessagesRead", new { conversationId, userId, lastReadMessageId, readAt = DateTime.UtcNow });
        }

        public async Task NotifyNewConversation(int[] participantUserIds, ConversationDto conversation)
        {
            foreach (var userId in participantUserIds)
            {
                if (_userConnections.TryGetValue(userId, out var connections))
                {
                    foreach (var connectionId in connections)
                    {
                        await Clients.Client(connectionId).SendAsync("NewConversation", conversation);
                    }
                }
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
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
