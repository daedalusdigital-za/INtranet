using System.Security.Claims;

namespace ProjectTracker.API.Authorization
{
    /// <summary>
    /// Role names as stored in Users.Role and issued in the JWT role claim.
    /// Use the combined constants with [Authorize(Roles = ...)].
    /// </summary>
    public static class AppRoles
    {
        public const string SuperAdmin = "Super Admin";
        public const string Admin = "Admin";
        public const string Manager = "Manager";
        public const string Director = "Director";
        public const string Treasurer = "Treasurer";
        public const string Accountant = "Accountant";
        public const string Clerk = "Clerk";

        /// <summary>Admin or Super Admin.</summary>
        public const string Admins = "Super Admin,Admin";

        /// <summary>Admin, Super Admin, Manager, Director or Treasurer (anyone with line/exec authority).</summary>
        public const string AdminsAndManagers = "Super Admin,Admin,Manager,Director,Treasurer";

        /// <summary>Directors and the Treasurer – the executive tier.</summary>
        public const string Executives = "Director,Treasurer";
    }

    public static class ClaimsPrincipalExtensions
    {
        /// <summary>The caller's UserId from the JWT, or null when absent/invalid.</summary>
        public static int? GetUserId(this ClaimsPrincipal user)
        {
            var raw = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(raw, out var id) ? id : null;
        }

        public static bool IsAdmin(this ClaimsPrincipal user) =>
            user.IsInRole(AppRoles.Admin) || user.IsInRole(AppRoles.SuperAdmin);

        public static bool IsSuperAdmin(this ClaimsPrincipal user) =>
            user.IsInRole(AppRoles.SuperAdmin);

        /// <summary>True when the caller is the given user or an Admin/Super Admin.</summary>
        public static bool IsSelfOrAdmin(this ClaimsPrincipal user, int userId) =>
            user.GetUserId() == userId || user.IsAdmin();
    }
}
