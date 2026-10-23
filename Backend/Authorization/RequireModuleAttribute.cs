using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Authorization
{
    /// <summary>
    /// Server-side enforcement of the per-module permissions managed under
    /// Admin Settings → Users (the same rule the Angular moduleGuard applies):
    /// Admin/Super Admin always pass; otherwise the user's Permissions must contain
    /// one of the given module keys (or "all"). Roles listed in <see cref="AlsoAllowRoles"/>
    /// also pass. Permissions are read from the database (cached briefly) so changes
    /// take effect without waiting for the JWT to expire.
    /// Usage: [RequireModule("finance", AlsoAllowRoles = "Finance")]
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false)]
    public sealed class RequireModuleAttribute : Attribute, IAsyncAuthorizationFilter
    {
        private static readonly TimeSpan CacheDuration = TimeSpan.FromSeconds(60);

        public string[] Modules { get; }

        /// <summary>Comma-separated roles that pass without the module permission.</summary>
        public string? AlsoAllowRoles { get; set; }

        public RequireModuleAttribute(params string[] modules)
        {
            Modules = modules;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            // Explicitly anonymous actions (e.g. image endpoints used by <img> tags) are exempt.
            if (context.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
                return;

            var user = context.HttpContext.User;
            if (user.Identity?.IsAuthenticated != true)
            {
                context.Result = new UnauthorizedResult();
                return;
            }

            var userId = user.GetUserId();
            if (userId == null)
            {
                context.Result = new ForbidResult();
                return;
            }

            var services = context.HttpContext.RequestServices;
            var cache = services.GetRequiredService<IMemoryCache>();
            var access = await cache.GetOrCreateAsync($"module-access:{userId.Value}", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = CacheDuration;
                var db = services.GetRequiredService<ApplicationDbContext>();
                return await db.Users.AsNoTracking()
                    .Where(u => u.UserId == userId.Value && u.IsActive)
                    .Select(u => new UserAccess(u.Role, u.Permissions))
                    .FirstOrDefaultAsync();
            });

            if (access == null || !HasAccess(access))
            {
                context.Result = new ObjectResult(new { message = "You do not have access to this module." })
                {
                    StatusCode = StatusCodes.Status403Forbidden
                };
            }
        }

        private bool HasAccess(UserAccess access)
        {
            var role = access.Role?.Trim() ?? string.Empty;
            if (role.Equals(AppRoles.Admin, StringComparison.OrdinalIgnoreCase) ||
                role.Equals(AppRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase))
                return true;

            if (!string.IsNullOrWhiteSpace(AlsoAllowRoles) &&
                AlsoAllowRoles.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
                    .Any(r => r.Equals(role, StringComparison.OrdinalIgnoreCase)))
                return true;

            var granted = ParsePermissions(access.Permissions);
            return granted.Contains("all") || Modules.Any(m => granted.Contains(m.ToLowerInvariant()));
        }

        // Permissions are stored comma-separated, or as a JSON array by older clients.
        private static HashSet<string> ParsePermissions(string? raw)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(raw)) return set;

            IEnumerable<string> items;
            try
            {
                items = raw.TrimStart().StartsWith('[')
                    ? JsonSerializer.Deserialize<string[]>(raw) ?? Array.Empty<string>()
                    : raw.Split(',');
            }
            catch (JsonException)
            {
                items = raw.Split(',');
            }

            foreach (var item in items)
            {
                var p = item?.Trim().ToLowerInvariant();
                if (!string.IsNullOrEmpty(p)) set.Add(p);
            }
            return set;
        }

        private sealed record UserAccess(string? Role, string? Permissions);
    }
}
