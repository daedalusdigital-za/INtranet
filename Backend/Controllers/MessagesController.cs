using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MessagesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<MessagesController> _logger;
        private readonly IHubContext<ChatHub> _hubContext;

        public MessagesController(ApplicationDbContext context, ILogger<MessagesController> logger, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _logger = logger;
            _hubContext = hubContext;
        }

        // GET: api/messages/conversations
        [HttpGet("conversations")]
        public async Task<ActionResult<IEnumerable<ConversationDto>>> GetConversations([FromQuery] int userId)
        {
            var conversations = await _context.Conversations
                .Include(c => c.Participants)
                    .ThenInclude(p => p.User)
                .Include(c => c.Messages.OrderByDescending(m => m.SentAt).Take(1))
                    .ThenInclude(m => m.Sender)
                .Where(c => c.Participants.Any(p => p.UserId == userId && !p.HasLeft))
                .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                .ToListAsync();

            var result = conversations.Select(c => MapConversationToDto(c, userId)).ToList();
            return Ok(result);
        }

        // GET: api/messages/conversations/{id}
        [HttpGet("conversations/{id}")]
        public async Task<ActionResult<ConversationDto>> GetConversation(int id, [FromQuery] int userId)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                    .ThenInclude(p => p.User)
                .Include(c => c.Messages.OrderByDescending(m => m.SentAt).Take(1))
                    .ThenInclude(m => m.Sender)
                .FirstOrDefaultAsync(c => c.ConversationId == id);

            if (conversation == null)
                return NotFound();

            if (!conversation.Participants.Any(p => p.UserId == userId))
                return Forbid();

            return Ok(MapConversationToDto(conversation, userId));
        }

        // GET: api/messages/conversations/{id}/messages
        [HttpGet("conversations/{id}/messages")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> GetMessages(
            int id, 
            [FromQuery] int userId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.ConversationId == id);

            if (conversation == null)
                return NotFound();

            if (!conversation.Participants.Any(p => p.UserId == userId))
                return Forbid();

            var messages = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Attachments)
                .Include(m => m.ReadReceipts)
                    .ThenInclude(r => r.User)
                .Include(m => m.ReplyToMessage)
                    .ThenInclude(r => r!.Sender)
                .Where(m => m.ConversationId == id && !m.IsDeleted)
                .OrderByDescending(m => m.SentAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var result = messages.Select(m => MapMessageToDto(m, userId)).Reverse().ToList();
            return Ok(result);
        }

        // POST: api/messages/conversations
        [HttpPost("conversations")]
        public async Task<ActionResult<ConversationDto>> CreateConversation([FromBody] CreateConversationRequest request, [FromQuery] int userId)
        {
            // Check if direct conversation already exists between two users
            if (!request.IsGroupChat && request.ParticipantUserIds.Count == 1)
            {
                var existingConversation = await _context.Conversations
                    .Include(c => c.Participants)
                    .Where(c => !c.IsGroupChat)
                    .Where(c => c.Participants.Count == 2)
                    .Where(c => c.Participants.Any(p => p.UserId == userId))
                    .Where(c => c.Participants.Any(p => p.UserId == request.ParticipantUserIds[0]))
                    .FirstOrDefaultAsync();

                if (existingConversation != null)
                {
                    return Ok(MapConversationToDto(existingConversation, userId));
                }
            }

            var conversation = new Conversation
            {
                Subject = request.Subject,
                IsGroupChat = request.IsGroupChat,
                GroupName = request.GroupName,
                CreatedAt = DateTime.UtcNow
            };

            _context.Conversations.Add(conversation);
            await _context.SaveChangesAsync();

            // Add creator as participant
            var creatorParticipant = new ConversationParticipant
            {
                ConversationId = conversation.ConversationId,
                UserId = userId,
                IsAdmin = request.IsGroupChat,
                JoinedAt = DateTime.UtcNow
            };
            _context.ConversationParticipants.Add(creatorParticipant);

            // Add other participants
            foreach (var participantId in request.ParticipantUserIds.Where(id => id != userId))
            {
                var participant = new ConversationParticipant
                {
                    ConversationId = conversation.ConversationId,
                    UserId = participantId,
                    JoinedAt = DateTime.UtcNow
                };
                _context.ConversationParticipants.Add(participant);
            }

            // Add initial message if provided
            if (!string.IsNullOrEmpty(request.InitialMessage))
            {
                var message = new Message
                {
                    ConversationId = conversation.ConversationId,
                    SenderId = userId,
                    Content = request.InitialMessage,
                    SentAt = DateTime.UtcNow
                };
                _context.Messages.Add(message);
                conversation.LastMessageAt = message.SentAt;
            }

            await _context.SaveChangesAsync();

            // Reload with includes
            var result = await _context.Conversations
                .Include(c => c.Participants)
                    .ThenInclude(p => p.User)
                .FirstOrDefaultAsync(c => c.ConversationId == conversation.ConversationId);

            return CreatedAtAction(nameof(GetConversation), 
                new { id = conversation.ConversationId }, 
                MapConversationToDto(result!, userId));
        }

        // POST: api/messages/send
        [HttpPost("send")]
        public async Task<ActionResult<MessageDto>> SendMessage([FromBody] SendMessageRequest request, [FromQuery] int userId)
        {
            var conversation = await _context.Conversations
                .Include(c => c.Participants)
                .FirstOrDefaultAsync(c => c.ConversationId == request.ConversationId);

            if (conversation == null)
                return NotFound("Conversation not found");

            if (!conversation.Participants.Any(p => p.UserId == userId && !p.HasLeft))
                return Forbid();

            var message = new Message
            {
                ConversationId = request.ConversationId,
                SenderId = userId,
                Content = request.Content,
                MessageType = request.MessageType,
                ReplyToMessageId = request.ReplyToMessageId,
                SentAt = DateTime.UtcNow
            };

            _context.Messages.Add(message);
            conversation.LastMessageAt = message.SentAt;
            await _context.SaveChangesAsync();

            // Reload with includes
            var result = await _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Attachments)
                .Include(m => m.ReplyToMessage)
                    .ThenInclude(r => r!.Sender)
                .FirstOrDefaultAsync(m => m.MessageId == message.MessageId);

            var messageDto = MapMessageToDto(result!, userId);

            // Send SignalR notification to all participants in the conversation
            try
            {
                await _hubContext.Clients.Group($"conversation_{request.ConversationId}")
                    .SendAsync("ReceiveMessage", messageDto);
                
                _logger.LogInformation("SignalR notification sent for message {MessageId} in conversation {ConversationId}", 
                    message.MessageId, request.ConversationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send SignalR notification for message {MessageId}", message.MessageId);
            }

            return CreatedAtAction(nameof(GetMessages), 
                new { id = request.ConversationId }, 
                messageDto);
        }

        // POST: api/messages/send-direct
        [HttpPost("send-direct")]
        public async Task<ActionResult<MessageDto>> SendDirectMessage([FromBody] SendDirectMessageRequest request, [FromQuery] int userId)
        {
            // Find or create conversation
            var existingConversation = await _context.Conversations
                .Include(c => c.Participants)
                .Where(c => !c.IsGroupChat)
                .Where(c => c.Participants.Count == 2)
                .Where(c => c.Participants.Any(p => p.UserId == userId))
                .Where(c => c.Participants.Any(p => p.UserId == request.RecipientUserId))
                .FirstOrDefaultAsync();

            int conversationId;
            if (existingConversation != null)
            {
                conversationId = existingConversation.ConversationId;
            }
            else
            {
                var conversation = new Conversation
                {
                    Subject = request.Subject,
                    IsGroupChat = false,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Conversations.Add(conversation);
                await _context.SaveChangesAsync();

                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversation.ConversationId,
                    UserId = userId,
                    JoinedAt = DateTime.UtcNow
                });
                _context.ConversationParticipants.Add(new ConversationParticipant
                {
                    ConversationId = conversation.ConversationId,
                    UserId = request.RecipientUserId,
                    JoinedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                conversationId = conversation.ConversationId;
            }

            var sendRequest = new SendMessageRequest
            {
                ConversationId = conversationId,
                Content = request.Content
            };

            return await SendMessage(sendRequest, userId);
        }

        // PUT: api/messages/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> EditMessage(int id, [FromBody] EditMessageRequest request, [FromQuery] int userId)
        {
            var message = await _context.Messages.FindAsync(id);
            if (message == null)
                return NotFound();

            if (message.SenderId != userId)
                return Forbid();

            message.Content = request.Content;
            message.IsEdited = true;
            message.EditedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/messages/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteMessage(int id, [FromQuery] int userId)
        {
            var message = await _context.Messages.FindAsync(id);
            if (message == null)
                return NotFound();

            if (message.SenderId != userId)
                return Forbid();

            message.IsDeleted = true;
            message.Content = "This message was deleted";
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/messages/mark-read
        [HttpPost("mark-read")]
        public async Task<IActionResult> MarkAsRead([FromBody] MarkAsReadRequest request, [FromQuery] int userId)
        {
            var participant = await _context.ConversationParticipants
                .FirstOrDefaultAsync(p => p.ConversationId == request.ConversationId && p.UserId == userId);

            if (participant == null)
                return NotFound();

            participant.LastReadAt = DateTime.UtcNow;

            // Create read receipts for unread messages
            var unreadMessages = await _context.Messages
                .Where(m => m.ConversationId == request.ConversationId)
                .Where(m => m.SenderId != userId)
                .Where(m => !m.ReadReceipts.Any(r => r.UserId == userId))
                .Where(m => request.UpToMessageId == null || m.MessageId <= request.UpToMessageId)
                .ToListAsync();

            foreach (var message in unreadMessages)
            {
                _context.MessageReadReceipts.Add(new MessageReadReceipt
                {
                    MessageId = message.MessageId,
                    UserId = userId,
                    ReadAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/messages/{id}/attachments
        [HttpPost("{id}/attachments")]
        public async Task<ActionResult<MessageAttachmentDto>> AddAttachment(int id, [FromBody] UploadAttachmentRequest request, [FromQuery] int userId)
        {
            var message = await _context.Messages.FindAsync(id);
            if (message == null)
                return NotFound();

            if (message.SenderId != userId)
                return Forbid();

            var attachment = new MessageAttachment
            {
                MessageId = id,
                FileName = request.FileName,
                MimeType = request.MimeType,
                FileData = Convert.FromBase64String(request.Base64Data),
                FileSize = Convert.FromBase64String(request.Base64Data).Length,
                UploadedAt = DateTime.UtcNow
            };

            _context.MessageAttachments.Add(attachment);
            await _context.SaveChangesAsync();

            return Ok(new MessageAttachmentDto
            {
                AttachmentId = attachment.AttachmentId,
                FileName = attachment.FileName,
                MimeType = attachment.MimeType,
                FileSize = attachment.FileSize,
                UploadedAt = attachment.UploadedAt
            });
        }

        // GET: api/messages/attachments/{id}
        [HttpGet("attachments/{id}")]
        public async Task<IActionResult> GetAttachment(int id)
        {
            var attachment = await _context.MessageAttachments.FindAsync(id);
            if (attachment == null || attachment.FileData == null)
                return NotFound();

            return File(attachment.FileData, attachment.MimeType, attachment.FileName);
        }

        // GET: api/messages/search
        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<MessageDto>>> SearchMessages([FromQuery] MessageSearchRequest request, [FromQuery] int userId)
        {
            var query = _context.Messages
                .Include(m => m.Sender)
                .Include(m => m.Conversation)
                    .ThenInclude(c => c.Participants)
                .Include(m => m.Attachments)
                .Where(m => m.Conversation.Participants.Any(p => p.UserId == userId))
                .Where(m => !m.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrEmpty(request.SearchTerm))
                query = query.Where(m => m.Content.Contains(request.SearchTerm));

            if (request.ConversationId.HasValue)
                query = query.Where(m => m.ConversationId == request.ConversationId);

            if (request.SenderId.HasValue)
                query = query.Where(m => m.SenderId == request.SenderId);

            if (request.FromDate.HasValue)
                query = query.Where(m => m.SentAt >= request.FromDate);

            if (request.ToDate.HasValue)
                query = query.Where(m => m.SentAt <= request.ToDate);

            if (request.HasAttachments == true)
                query = query.Where(m => m.Attachments.Any());

            var messages = await query
                .OrderByDescending(m => m.SentAt)
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToListAsync();

            return Ok(messages.Select(m => MapMessageToDto(m, userId)));
        }

        // GET: api/messages/stats
        [HttpGet("stats")]
        public async Task<ActionResult<MessagingStatsDto>> GetStats([FromQuery] int userId)
        {
            var userConversations = await _context.Conversations
                .Include(c => c.Participants)
                .Include(c => c.Messages)
                .Where(c => c.Participants.Any(p => p.UserId == userId && !p.HasLeft))
                .ToListAsync();

            var conversationIds = userConversations.Select(c => c.ConversationId).ToList();

            var unreadCount = await _context.Messages
                .Where(m => conversationIds.Contains(m.ConversationId))
                .Where(m => m.SenderId != userId)
                .Where(m => !m.ReadReceipts.Any(r => r.UserId == userId))
                .CountAsync();

            var last7Days = DateTime.UtcNow.AddDays(-7);
            var messagesByDay = await _context.Messages
                .Where(m => conversationIds.Contains(m.ConversationId))
                .Where(m => m.SentAt >= last7Days)
                .GroupBy(m => m.SentAt.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Date.ToString("yyyy-MM-dd"), x => x.Count);

            return Ok(new MessagingStatsDto
            {
                TotalConversations = userConversations.Count,
                UnreadConversations = userConversations.Count(c => 
                    c.Messages.Any(m => m.SenderId != userId && 
                        !_context.MessageReadReceipts.Any(r => r.MessageId == m.MessageId && r.UserId == userId))),
                TotalMessages = userConversations.Sum(c => c.Messages.Count),
                UnreadMessages = unreadCount,
                TotalAttachments = await _context.MessageAttachments
                    .Where(a => conversationIds.Contains(a.Message.ConversationId))
                    .CountAsync(),
                MessagesByDay = messagesByDay
            });
        }

        // GET: api/messages/unread-count
        [HttpGet("unread-count")]
        public async Task<ActionResult<int>> GetUnreadCount([FromQuery] int userId)
        {
            var conversationIds = await _context.ConversationParticipants
                .Where(p => p.UserId == userId && !p.HasLeft)
                .Select(p => p.ConversationId)
                .ToListAsync();

            var count = await _context.Messages
                .Where(m => conversationIds.Contains(m.ConversationId))
                .Where(m => m.SenderId != userId)
                .Where(m => !m.IsDeleted)
                .Where(m => !m.ReadReceipts.Any(r => r.UserId == userId))
                .CountAsync();

            return Ok(count);
        }

        // GET: api/messages/users/search
        [HttpGet("users/search")]
        public async Task<ActionResult<IEnumerable<UserSearchDto>>> SearchUsers([FromQuery] string? query = "", [FromQuery] int excludeUserId = 0)
        {
            var usersQuery = _context.Users
                .Include(u => u.Department)
                .Where(u => u.IsActive)
                .AsQueryable();

            if (excludeUserId > 0)
            {
                usersQuery = usersQuery.Where(u => u.UserId != excludeUserId);
            }

            if (!string.IsNullOrWhiteSpace(query))
            {
                var searchTerm = query.ToLower();
                usersQuery = usersQuery.Where(u => 
                    u.Name.ToLower().Contains(searchTerm) ||
                    u.Surname.ToLower().Contains(searchTerm) ||
                    u.Email.ToLower().Contains(searchTerm) ||
                    (u.Title != null && u.Title.ToLower().Contains(searchTerm)) ||
                    (u.Department != null && u.Department.Name.ToLower().Contains(searchTerm)));
            }

            var users = await usersQuery
                .OrderBy(u => u.Name)
                .ThenBy(u => u.Surname)
                .Take(50)
                .ToListAsync();

            var result = users.Select(u => new UserSearchDto
            {
                UserId = u.UserId,
                Name = u.Name,
                Surname = u.Surname,
                Email = u.Email,
                Title = u.Title,
                Department = u.Department?.Name,
                ProfilePictureUrl = u.ProfilePictureUrl,
                ProfilePictureData = u.ProfilePictureData != null ? Convert.ToBase64String(u.ProfilePictureData) : null,
                ProfilePictureMimeType = u.ProfilePictureMimeType
            }).ToList();

            return Ok(result);
        }

        // Helper methods
        private ConversationDto MapConversationToDto(Conversation conversation, int currentUserId)
        {
            var lastMessage = conversation.Messages.OrderByDescending(m => m.SentAt).FirstOrDefault();
            var participant = conversation.Participants.FirstOrDefault(p => p.UserId == currentUserId);
            
            var unreadCount = conversation.Messages
                .Where(m => m.SenderId != currentUserId)
                .Count(m => participant?.LastReadAt == null || m.SentAt > participant.LastReadAt);

            return new ConversationDto
            {
                ConversationId = conversation.ConversationId,
                Subject = conversation.Subject,
                IsGroupChat = conversation.IsGroupChat,
                GroupName = conversation.GroupName,
                CreatedAt = conversation.CreatedAt,
                LastMessageAt = conversation.LastMessageAt,
                Participants = conversation.Participants.Select(p => new ParticipantDto
                {
                    UserId = p.UserId,
                    Name = p.User.Name,
                    Surname = p.User.Surname,
                    ProfilePictureUrl = p.User.ProfilePictureUrl,
                    IsAdmin = p.IsAdmin,
                    LastReadAt = p.LastReadAt
                }).ToList(),
                LastMessage = lastMessage != null ? new MessageDto
                {
                    MessageId = lastMessage.MessageId,
                    SenderId = lastMessage.SenderId,
                    SenderName = lastMessage.Sender?.Name ?? "Unknown",
                    Content = lastMessage.IsDeleted ? "Message deleted" : lastMessage.Content,
                    SentAt = lastMessage.SentAt
                } : null,
                UnreadCount = unreadCount
            };
        }

        private MessageDto MapMessageToDto(Message message, int currentUserId)
        {
            return new MessageDto
            {
                MessageId = message.MessageId,
                ConversationId = message.ConversationId,
                SenderId = message.SenderId,
                SenderName = message.Sender?.Name ?? "Unknown",
                SenderFullName = message.Sender != null ? $"{message.Sender.Name} {message.Sender.Surname}" : "Unknown",
                SenderProfilePicture = message.Sender?.ProfilePictureUrl,
                Content = message.IsDeleted ? "This message was deleted" : message.Content,
                MessageType = message.MessageType,
                IsEdited = message.IsEdited,
                EditedAt = message.EditedAt,
                IsDeleted = message.IsDeleted,
                ReplyToMessageId = message.ReplyToMessageId,
                ReplyToMessage = message.ReplyToMessage != null ? new MessageDto
                {
                    MessageId = message.ReplyToMessage.MessageId,
                    SenderId = message.ReplyToMessage.SenderId,
                    SenderName = message.ReplyToMessage.Sender?.Name ?? "Unknown",
                    Content = message.ReplyToMessage.IsDeleted ? "Message deleted" : 
                        (message.ReplyToMessage.Content.Length > 100 ? 
                            message.ReplyToMessage.Content.Substring(0, 100) + "..." : 
                            message.ReplyToMessage.Content),
                    SentAt = message.ReplyToMessage.SentAt
                } : null,
                SentAt = message.SentAt,
                Attachments = message.Attachments.Select(a => new MessageAttachmentDto
                {
                    AttachmentId = a.AttachmentId,
                    FileName = a.FileName,
                    MimeType = a.MimeType,
                    FileSize = a.FileSize,
                    FileUrl = $"/api/messages/attachments/{a.AttachmentId}",
                    ThumbnailUrl = a.ThumbnailUrl,
                    UploadedAt = a.UploadedAt
                }).ToList(),
                ReadReceipts = message.ReadReceipts.Select(r => new ReadReceiptDto
                {
                    UserId = r.UserId,
                    UserName = r.User?.Name ?? "Unknown",
                    ReadAt = r.ReadAt
                }).ToList(),
                IsRead = message.SenderId == currentUserId || 
                    message.ReadReceipts.Any(r => r.UserId == currentUserId)
            };
        }
    }
}
