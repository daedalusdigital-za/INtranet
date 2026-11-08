using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Yarp.ReverseProxy.Transforms;

// ---------------------------------------------------------------------------------------------
// Rocket Freight client portal – public edge (Azure App Service).
//
//   browser (Static Web App)  →  https://<this app>/api/portal/…  →  Hybrid Connection  →  on-prem API :5143
//
// App settings (Azure → Configuration → Application settings):
//   PORTAL_EDGE_KEY        shared secret; must equal PORTAL_EDGE_KEY in the on-prem .env
//   UPSTREAM               http://sage-svr:5143   (host:port MUST match the Hybrid Connection endpoint)
//   ALLOWED_ORIGINS        comma list, e.g. https://portal.rocketfreight.co.za,https://xyz.azurestaticapps.net
//   RATE_PER_MINUTE        optional, default 120 (per client IP)
//   AUTH_RATE_PER_MINUTE   optional, default 10  (login / forgot / reset, per client IP)
// ---------------------------------------------------------------------------------------------

var builder = WebApplication.CreateBuilder(args);

string Req(string name) => builder.Configuration[name] ?? throw new InvalidOperationException($"App setting {name} is required.");
var edgeKey = Req("PORTAL_EDGE_KEY");
var upstream = Req("UPSTREAM").TrimEnd('/');
var origins = (builder.Configuration["ALLOWED_ORIGINS"] ?? "")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
var perMinute = int.TryParse(builder.Configuration["RATE_PER_MINUTE"], out var r) ? r : 120;
var authPerMinute = int.TryParse(builder.Configuration["AUTH_RATE_PER_MINUTE"], out var ar) ? ar : 10;

// App Service terminates TLS and fronts us; take the client IP from X-Forwarded-For.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear(); o.KnownProxies.Clear(); // App Service front-ends are not enumerable; the platform strips spoofed XFF.
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (origins.Length > 0) p.WithOrigins(origins);
    p.AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithExposedHeaders("Content-Disposition");
}));

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = async (ctx, ct) =>
    {
        ctx.HttpContext.Response.Headers.RetryAfter = "60";
        await ctx.HttpContext.Response.WriteAsJsonAsync(new { message = "Too many requests. Please wait a minute and try again." }, ct);
    };
    string Key(HttpContext c) => c.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    o.AddPolicy("portal", c => RateLimitPartition.GetSlidingWindowLimiter(Key(c), _ => new SlidingWindowRateLimiterOptions
    { PermitLimit = perMinute, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0 }));
    o.AddPolicy("portal-auth", c => RateLimitPartition.GetFixedWindowLimiter(Key(c), _ => new FixedWindowRateLimiterOptions
    { PermitLimit = authPerMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// Routes are code-defined so nothing but the portal surface can ever be exposed by a config slip.
var routes = new[]
{
    new Yarp.ReverseProxy.Configuration.RouteConfig
    {
        RouteId = "portal-auth",
        ClusterId = "intranet",
        RateLimiterPolicy = "portal-auth",
        Match = new Yarp.ReverseProxy.Configuration.RouteMatch { Path = "/api/portal/auth/{action}", Methods = new[] { "POST", "OPTIONS" } }
    },
    new Yarp.ReverseProxy.Configuration.RouteConfig
    {
        RouteId = "portal",
        ClusterId = "intranet",
        RateLimiterPolicy = "portal",
        Match = new Yarp.ReverseProxy.Configuration.RouteMatch { Path = "/api/portal/{**rest}" }
    }
};
var clusters = new[]
{
    new Yarp.ReverseProxy.Configuration.ClusterConfig
    {
        ClusterId = "intranet",
        Destinations = new Dictionary<string, Yarp.ReverseProxy.Configuration.DestinationConfig>
        {
            ["onprem"] = new() { Address = upstream }
        },
        HttpRequest = new Yarp.ReverseProxy.Forwarder.ForwarderRequestConfig { ActivityTimeout = TimeSpan.FromSeconds(100) }
    }
};

builder.Services.AddReverseProxy()
    .LoadFromMemory(routes, clusters)
    .AddTransforms(ctx =>
    {
        ctx.AddRequestHeader("X-Portal-Edge-Key", edgeKey, append: false);
        ctx.AddXForwardedFor(); // original client IP → on-prem API (used there for lockouts / limits)
        ctx.AddRequestHeader("X-Forwarded-Proto", "https", append: false);
        ctx.AddOriginalHost(false);
        ctx.AddResponseHeader("X-Content-Type-Options", "nosniff", append: false);
        ctx.AddResponseHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains", append: false);
    });

var app = builder.Build();

app.UseForwardedHeaders();
app.UseCors();
app.UseRateLimiter();

// Health for App Service "Health check" and for you.
app.MapGet("/health", () => Results.Ok(new { status = "ok", upstream }));

app.MapReverseProxy();

// Anything else does not exist.
app.MapFallback(() => Results.NotFound());

app.Run();
