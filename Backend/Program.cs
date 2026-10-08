using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Data;
using ProjectTracker.API.Extensions;
using ProjectTracker.API.HealthChecks;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.Services;

// Force BouncyCastle adapter registration for iText PDF generation.
// The adapter assembly must be loaded before any iText code runs, otherwise the
// BouncyCastleFactoryCreator static constructor falls back to BouncyCastleDefaultFactory.
iText.Bouncycastleconnector.BouncyCastleFactoryCreator.SetFactory(new iText.Bouncycastle.BouncyCastleFactory());

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------------------
// Framework services
// ---------------------------------------------------------------------------
builder.Services.AddAppCompression();

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    })
    .ConfigureApiBehaviorOptions(options =>
    {
        // Customize automatic model validation response to include logging
        options.InvalidModelStateResponseFactory = context =>
        {
            var logger = context.HttpContext.RequestServices.GetRequiredService<ILogger<Program>>();

            var errors = context.ModelState
                .Where(x => x.Value?.Errors.Count > 0)
                .Select(x => new {
                    Field = x.Key,
                    Errors = x.Value?.Errors.Select(e => string.IsNullOrEmpty(e.ErrorMessage) ? e.Exception?.Message : e.ErrorMessage)
                })
                .ToList();

            logger.LogWarning("API Model Validation Failed for {Path}: {Errors}",
                context.HttpContext.Request.Path,
                System.Text.Json.JsonSerializer.Serialize(errors));

            return new BadRequestObjectResult(new ValidationProblemDetails(context.ModelState));
        };
    });
builder.Services.AddEndpointsApiExplorer();

// DbContext. SECURITY: no hardcoded fallback — the connection string must come
// from configuration (appsettings/user secrets/env vars).
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "ConnectionStrings:DefaultConnection is not configured. Set it via appsettings.json " +
        "(gitignored), user secrets, or the CONNECTIONSTRINGS__DEFAULTCONNECTION environment variable.");
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));

// Auth (fails fast if JwtSettings:SecretKey is missing) + explicit-origin CORS
builder.Services.AddAppAuthentication(builder.Configuration);
builder.Services.AddAppCors(builder.Configuration);

// Health checks — /health (liveness) and /health/ready (DB readiness).
// Required for load-balanced / blue-green deployments.
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("database", tags: new[] { "ready" });

// ---------------------------------------------------------------------------
// Application services (grouped in Extensions/ServiceCollectionExtensions.cs)
// ---------------------------------------------------------------------------
builder.Services.AddCoreServices();
builder.Services.AddIntegrationServices(builder.Configuration);
builder.Services.AddLogisticsServices();
builder.Services.AddAiServices();
builder.Services.AddFinanceAndEmailServices();

var app = builder.Build();

// ---------------------------------------------------------------------------
// Database migrations
// NOTE: auto-migrate on boot is convenient for a single-instance deployment but
// is NOT safe for multi-instance / blue-green (two instances racing to alter the
// schema). Set Database:MigrateOnStartup=false and run migrations as an explicit
// deploy step when moving to that model.
// ---------------------------------------------------------------------------
if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
{
    using var scope = app.Services.CreateScope();
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();

        // Log exactly which migrations are pending BEFORE applying them, so a
        // failure can never again be hidden. A previous version caught SQL error
        // 2705 and logged a benign "Migration skipped" warning, which silently
        // aborted every remaining migration and left the Finance/PBX/POD tables
        // uncreated for months.
        var pending = context.Database.GetPendingMigrations().ToList();
        if (pending.Count == 0)
        {
            logger.LogInformation("Database schema is up to date - no pending migrations.");
        }
        else
        {
            logger.LogInformation(
                "Applying {Count} pending migration(s): {Migrations}",
                pending.Count, string.Join(", ", pending));
            context.Database.Migrate();
            logger.LogInformation("Successfully applied {Count} pending migration(s).", pending.Count);
        }
    }
    catch (Exception ex)
    {
        // NEVER swallow a migration failure as a warning. If migrations cannot be
        // applied (commonly schema drift: an object a migration creates already
        // exists from manual SQL), the app may run against an out-of-date schema
        // and whole modules will silently fail. Surface it loudly instead.
        logger.LogCritical(ex,
            "DATABASE MIGRATION FAILED - the schema may be out of date and some features " +
            "will not work. Do NOT ignore. Reconcile the schema and __EFMigrationsHistory " +
            "(e.g. via an idempotent migration script) before relying on affected modules.");
    }
}

// ---------------------------------------------------------------------------
// HTTP pipeline
// ---------------------------------------------------------------------------
app.UseResponseCompression();
app.UseCors("AppCors");

// Serve static files for uploads
var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<BoardHub>("/hubs/board");
app.MapHub<AttendanceHub>("/hubs/attendance");
app.MapHub<ChatHub>("/hubs/chat");
app.MapHub<CollaborativeDocsHub>("/hubs/collaborative-docs");
app.MapHub<ProjectTracker.API.Hubs.NotificationHub>("/hubs/notifications");

// Health endpoints: /health = process liveness, /health/ready = DB reachable.
app.MapHealthChecks("/health", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false // liveness only — no dependency checks
});
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
});

// Auto-ingest knowledge base documents on startup
_ = Task.Run(async () =>
{
    try
    {
        // Wait for DB migrations to complete
        await Task.Delay(5000);
        var kbService = app.Services.GetRequiredService<IKnowledgeBaseService>();
        var kbLogger = app.Services.GetRequiredService<ILogger<Program>>();
        var kbPaths = new[] { "/app/kb-docs", Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "kb-docs") };
        foreach (var kbPath in kbPaths)
        {
            if (Directory.Exists(kbPath))
            {
                var count = await kbService.IngestFolderAsync(kbPath);
                kbLogger.LogInformation("[KB] Auto-ingested {Count} documents from {Path}", count, kbPath);
                break;
            }
        }
    }
    catch (Exception ex)
    {
        app.Services.GetRequiredService<ILogger<Program>>()
            .LogWarning(ex, "[KB] Auto-ingest failed");
    }
});

app.Run();
