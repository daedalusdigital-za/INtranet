using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace ProjectTracker.API.Security
{
    /// <summary>
    /// Public-edge guard for the client portal.
    ///
    /// The on-prem API is reached from the internet only through the Azure edge proxy
    /// (portal-edge/), which forwards nothing but /api/portal/* and stamps every request with
    /// the shared secret in <c>X-Portal-Edge-Key</c> (config <c>Portal:EdgeKey</c>).
    ///
    /// When that header is present and valid the request is treated as PUBLIC:
    ///   • anything outside /api/portal (and /health) is answered 404 – defence in depth should the
    ///     edge ever be misconfigured;
    ///   • the real client address is taken from X-Forwarded-For so rate limiting and lockouts
    ///     apply per customer connection, not per proxy.
    /// Requests without the header (LAN, nginx, tray app, clocking device) are untouched, and the
    /// forwarded header is deliberately NOT trusted from them (spoof protection).
    ///
    /// When <c>Portal:EdgeKey</c> is unset nothing is public yet and the middleware is a no-op.
    /// </summary>
    public sealed class PortalEdgeMiddleware
    {
        public const string HeaderName = "X-Portal-Edge-Key";
        public const string ItemKey = "PortalEdge";

        private static readonly PathString PortalPath = new("/api/portal");
        private static readonly PathString HealthPath = new("/health");

        private readonly RequestDelegate _next;
        private readonly byte[]? _key;
        private readonly ILogger<PortalEdgeMiddleware> _logger;

        public PortalEdgeMiddleware(RequestDelegate next, IConfiguration config, ILogger<PortalEdgeMiddleware> logger)
        {
            _next = next;
            _logger = logger;
            var k = config["Portal:EdgeKey"];
            _key = string.IsNullOrWhiteSpace(k) ? null : Encoding.UTF8.GetBytes(k.Trim());
        }

        public async Task InvokeAsync(HttpContext ctx)
        {
            if (_key == null || !ctx.Request.Headers.TryGetValue(HeaderName, out var presented) || presented.Count == 0)
            {
                await _next(ctx);
                return;
            }

            var ok = CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(presented[0] ?? string.Empty), _key);
            if (!ok)
            {
                _logger.LogWarning("Portal edge: bad edge key from {Ip} for {Path}", ctx.Connection.RemoteIpAddress, ctx.Request.Path);
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                return;
            }

            // Public request. Only the portal surface exists from here.
            if (!ctx.Request.Path.StartsWithSegments(PortalPath) && !ctx.Request.Path.StartsWithSegments(HealthPath))
            {
                ctx.Response.StatusCode = StatusCodes.Status404NotFound;
                return;
            }

            ctx.Items[ItemKey] = true;

            // Real client IP (first hop in X-Forwarded-For, which the edge sets from its own connection).
            if (ctx.Request.Headers.TryGetValue("X-Forwarded-For", out var xff) && xff.Count > 0)
            {
                var first = (xff[0] ?? string.Empty).Split(',')[0].Trim();
                if (IPAddress.TryParse(first, out var ip)) ctx.Connection.RemoteIpAddress = ip;
            }
            ctx.Request.Scheme = "https";

            await _next(ctx);
        }
    }

    public static class PortalRateLimiting
    {
        /// <summary>General portal traffic: 120 requests / minute per client IP.</summary>
        public const string Policy = "portal";
        /// <summary>Credential endpoints (login, forgot/reset): 10 requests / minute per client IP, no queue.</summary>
        public const string AuthPolicy = "portal-auth";

        public static IServiceCollection AddPortalRateLimiting(this IServiceCollection services)
        {
            services.AddRateLimiter(o =>
            {
                o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
                o.OnRejected = async (ctx, ct) =>
                {
                    ctx.HttpContext.Response.Headers.RetryAfter = "60";
                    await ctx.HttpContext.Response.WriteAsJsonAsync(new { message = "Too many requests. Please wait a minute and try again." }, ct);
                };

                o.AddPolicy(Policy, ctx => RateLimitPartition.GetSlidingWindowLimiter(ClientKey(ctx), _ => new SlidingWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    SegmentsPerWindow = 6,
                    QueueLimit = 0
                }));

                o.AddPolicy(AuthPolicy, ctx => RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0
                }));
            });
            return services;
        }

        private static string ClientKey(HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }
}
