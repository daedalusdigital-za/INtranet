namespace ProjectTracker.API.DTOs.Boards
{
    public class DepartmentDto
    {
        public int DepartmentId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ManagerName { get; set; }
        public int BoardCount { get; set; }
        public int UserCount { get; set; }
    }

    public class BoardMemberDto
    {
        public int BoardMemberId { get; set; }
        public int BoardId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string? UserEmail { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string Role { get; set; } = "Member";
        public DateTime InvitedAt { get; set; }
        public int? InvitedByUserId { get; set; }
        public string? InvitedByName { get; set; }
    }

    public class BoardDto
    {
        public int BoardId { get; set; }
        public int DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? CreatedByUserId { get; set; }
        public string? CreatedByName { get; set; }
        public string Status { get; set; } = "Planning";
        public int Progress { get; set; } = 0;
        public int TotalChecklistItems { get; set; } = 0;
        public int CompletedChecklistItems { get; set; } = 0;
        public DateTime CreatedAt { get; set; }
        public List<ListDto> Lists { get; set; } = new();
        public List<BoardChecklistItemDto> ChecklistItems { get; set; } = new();
        public List<BoardMemberDto> Members { get; set; } = new();
    }

    public class BoardChecklistItemDto
    {
        public int ChecklistItemId { get; set; }
        public int BoardId { get; set; }
        public string Title { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public int Position { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public int? CompletedByUserId { get; set; }
        public string? CompletedByName { get; set; }
    }

    public class ListDto
    {
        public int ListId { get; set; }
        public int BoardId { get; set; }
        public string Title { get; set; } = string.Empty;
        public int Position { get; set; }
        public List<CardDto> Cards { get; set; } = new();
    }

    public class CardDto
    {
        public int CardId { get; set; }
        public int ListId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? CreatedByUserId { get; set; }
        public string? CreatedByName { get; set; }
        public int? AssignedToUserId { get; set; }
        public string? AssignedToName { get; set; }
        public DateTime? DueDate { get; set; }
        public string Status { get; set; } = string.Empty;
        public int Position { get; set; }
        public int CommentCount { get; set; }
        public int AttachmentCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CardDetailDto : CardDto
    {
        public List<CommentDto> Comments { get; set; } = new();
        public List<AttachmentDto> Attachments { get; set; } = new();
    }

    public class CommentDto
    {
        public int CommentId { get; set; }
        public int CardId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class AttachmentDto
    {
        public int AttachmentId { get; set; }
        public int CardId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string FileUrl { get; set; } = string.Empty;
        public string? FileType { get; set; }
        public long FileSize { get; set; }
        public string UploadedByUserName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class CreateBoardDto
    {
        public int DepartmentId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? CreatedByUserId { get; set; }
        public List<int> InvitedUserIds { get; set; } = new();
    }

    public class InviteBoardMemberDto
    {
        public int UserId { get; set; }
        public string Role { get; set; } = "Member";
        public int? InvitedByUserId { get; set; }
    }

    public class UpdateBoardStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    public class CreateChecklistItemDto
    {
        public string Title { get; set; } = string.Empty;
        public int Position { get; set; } = 0;
    }

    public class UpdateChecklistItemDto
    {
        public bool IsCompleted { get; set; }
        public int? CompletedByUserId { get; set; }
    }

    public class CreateListDto
    {
        public int BoardId { get; set; }
        public string Title { get; set; } = string.Empty;
        public int Position { get; set; }
    }

    public class CreateCardDto
    {
        public int ListId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? CreatedByUserId { get; set; }
        public int? AssignedToUserId { get; set; }
        public DateTime? DueDate { get; set; }
        public int Position { get; set; }
        public List<int> InviteUserIds { get; set; } = new();  // Users to invite to the board when creating card
    }

    public class MoveCardDto
    {
        public int TargetListId { get; set; }
        public int Position { get; set; }
    }

    public class CreateCommentDto
    {
        public int CardId { get; set; }
        public string Content { get; set; } = string.Empty;
    }
}
