namespace ProjectTracker.API.Constants
{
    /// <summary>
    /// Application role constants
    /// </summary>
    public static class Roles
    {
        public const string SuperAdmin = "Super Admin";
        public const string Admin = "Admin";
        public const string Manager = "Manager";
        public const string Employee = "Employee";
        public const string HR = "HR";
        public const string ITSupport = "IT Support";

        public static readonly string[] All = 
        {
            SuperAdmin, Admin, Manager, Employee, HR, ITSupport
        };

        public static readonly string[] AdminRoles = 
        {
            SuperAdmin, Admin
        };

        public static bool IsAdmin(string role)
        {
            return role == SuperAdmin || role == Admin;
        }
    }

    /// <summary>
    /// Application permission constants
    /// </summary>
    public static class Permissions
    {
        // User permissions
        public const string UsersView = "users.view";
        public const string UsersCreate = "users.create";
        public const string UsersEdit = "users.edit";
        public const string UsersDelete = "users.delete";

        // Board permissions
        public const string BoardsView = "boards.view";
        public const string BoardsCreate = "boards.create";
        public const string BoardsEdit = "boards.edit";
        public const string BoardsDelete = "boards.delete";

        // Attendance permissions
        public const string AttendanceView = "attendance.view";
        public const string AttendanceManage = "attendance.manage";

        // Report permissions
        public const string ReportsView = "reports.view";
        public const string ReportsExport = "reports.export";

        // Document permissions
        public const string DocumentsView = "documents.view";
        public const string DocumentsUpload = "documents.upload";

        // Messaging permissions
        public const string MessagesView = "messages.view";
        public const string MessagesSend = "messages.send";

        // Knowledge Base permissions
        public const string KnowledgeBaseView = "kb.view";
        public const string KnowledgeBaseEdit = "kb.edit";

        // Support permissions
        public const string SupportView = "support.view";
        public const string SupportManage = "support.manage";

        public static readonly PermissionInfo[] AllPermissions =
        {
            new(UsersView, "View Users", "Users"),
            new(UsersCreate, "Create Users", "Users"),
            new(UsersEdit, "Edit Users", "Users"),
            new(UsersDelete, "Delete Users", "Users"),
            new(BoardsView, "View Boards", "Boards"),
            new(BoardsCreate, "Create Boards", "Boards"),
            new(BoardsEdit, "Edit Boards", "Boards"),
            new(BoardsDelete, "Delete Boards", "Boards"),
            new(AttendanceView, "View Attendance", "Attendance"),
            new(AttendanceManage, "Manage Attendance", "Attendance"),
            new(ReportsView, "View Reports", "Reports"),
            new(ReportsExport, "Export Reports", "Reports"),
            new(DocumentsView, "View Documents", "Documents"),
            new(DocumentsUpload, "Upload Documents", "Documents"),
            new(MessagesView, "View Messages", "Messages"),
            new(MessagesSend, "Send Messages", "Messages"),
            new(KnowledgeBaseView, "View Knowledge Base", "Knowledge Base"),
            new(KnowledgeBaseEdit, "Edit Knowledge Base", "Knowledge Base"),
            new(SupportView, "View Support Tickets", "Support"),
            new(SupportManage, "Manage Support Tickets", "Support")
        };
    }

    public record PermissionInfo(string Code, string Name, string Category);
}
