using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Data;
using ProjectTracker.API.Extensions;
using ProjectTracker.API.HealthChecks;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.Security;
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
// Client portal: per-IP rate limits (general + credential endpoints). Policies are applied on PortalController.
builder.Services.AddPortalRateLimiting();

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

        // Human-flow owners that still need an intranet account (seeded flows carry the email in their blueprint).
        // Idempotent: once OwnerUserId is set nothing happens. Uses BCrypt, which raw-SQL migrations cannot.
        try
        {
            var unlinked = context.FlowDefinitions.Where(f => f.OwnerUserId == null && f.OwnerEmployeeId != null && f.BlueprintJson != null && f.BlueprintJson.Contains("\"email\"")).ToList();
            foreach (var f in unlinked)
            {
                string? email = null;
                try { using var bp = System.Text.Json.JsonDocument.Parse(f.BlueprintJson!); if (bp.RootElement.TryGetProperty("email", out var e)) email = e.GetString(); } catch { }
                if (string.IsNullOrWhiteSpace(email)) continue;
                email = email.Trim().ToLowerInvariant();
                // Resolution order — never create what already exists:
                //  1. an active intranet user with this email (exact, then a close typo variant by name + domain);
                //  2. the HR employee file (by email, then employee number) — keep HR and the register in step;
                //  3. only then create a login.
                var user = context.Users.FirstOrDefault(u => u.IsActive && u.Email.ToLower() == email)
                        ?? context.Users.FirstOrDefault(u => u.Email.ToLower() == email);
                var emp = context.EmpRegistrations.FirstOrDefault(e => e.EmpId == f.OwnerEmployeeId);
                if (user == null && !string.IsNullOrWhiteSpace(f.OwnerName))
                {
                    var first = f.OwnerName.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries)[0].ToLowerInvariant();
                    var domain = email.Contains('@') ? email[email.IndexOf('@')..] : "";
                    var byName = context.Users.Where(u => u.IsActive && u.Email.ToLower().EndsWith(domain) && u.Name.ToLower().StartsWith(first)).ToList();
                    if (byName.Count == 1) { user = byName[0]; logger.LogInformation("Human-flow owner {Owner}: matched existing user {Email} by name.", f.OwnerName, user.Email); }
                }
                var hr = context.HrEmployees.FirstOrDefault(h => h.Email != null && h.Email.ToLower() == email)
                      ?? context.HrEmployees.FirstOrDefault(h => h.EmployeeNumber == f.OwnerEmployeeId);
                if (hr != null)
                {
                    if (string.IsNullOrWhiteSpace(hr.Email)) hr.Email = email;
                    if (string.IsNullOrWhiteSpace(hr.EmployeeNumber)) hr.EmployeeNumber = f.OwnerEmployeeId;
                    if ((string.IsNullOrWhiteSpace(hr.JobTitle) || hr.JobTitle == "Other") && !string.IsNullOrWhiteSpace(f.OwnerTitle)) hr.JobTitle = f.OwnerTitle;
                }
                if (user == null)
                {
                    var parts = (f.OwnerName ?? "Employee").Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
                    var deptId = context.Departments.Where(x => x.Name == f.DepartmentName).Select(x => (int?)x.DepartmentId).FirstOrDefault();
                    var dn = (f.DepartmentName ?? "").ToLowerInvariant();
                    var perms = "flows" + (dn.Contains("finance") || dn.Contains("account") ? ",finance" : "") + (dn.Contains("sales") ? ",sales" : "") + (dn.Contains("logistic") ? ",logistics" : "");
                    user = new ProjectTracker.API.Models.User
                    {
                        Name = parts.Length > 0 ? parts[0] : "Employee", Surname = parts.Length > 1 ? parts[1] : "", Email = email,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome123!"), Role = "Employee", Title = f.OwnerTitle,
                        DepartmentId = deptId, LinkedEmpId = emp?.EmpId, Permissions = perms, IsActive = true, CreatedAt = DateTime.UtcNow
                    };
                    context.Users.Add(user);
                    context.SaveChanges();
                    logger.LogInformation("Created intranet user {Email} for human-flow owner {Owner} (emp {Emp}).", email, f.OwnerName, f.OwnerEmployeeId);
                }
                else
                {
                    if (emp != null && string.IsNullOrWhiteSpace(user.LinkedEmpId)) user.LinkedEmpId = emp.EmpId;
                    // Existing account: give it a proper title if it only carries a department-ish placeholder, and make sure it can open Flows.
                    if (!string.IsNullOrWhiteSpace(f.OwnerTitle) && (string.IsNullOrWhiteSpace(user.Title) || user.Title is "Finance" or "Accounts" or "Employee" or "Other")) user.Title = f.OwnerTitle;
                    var permList = (user.Permissions ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
                    if (!permList.Contains("flows", StringComparer.OrdinalIgnoreCase)) { permList.Add("flows"); user.Permissions = string.Join(",", permList); }
                }
                if (emp != null)
                {
                    if ((string.IsNullOrWhiteSpace(emp.JobTitle) || emp.JobTitle == "Other") && !string.IsNullOrWhiteSpace(f.OwnerTitle)) emp.JobTitle = f.OwnerTitle;
                    if ((string.IsNullOrWhiteSpace(emp.Department) || emp.Department == "Other") && !string.IsNullOrWhiteSpace(f.DepartmentName)) emp.Department = f.DepartmentName;
                }
                f.OwnerUserId = user.UserId;
                context.SaveChanges();
                logger.LogInformation("Linked human flow '{Flow}' to user {Email}.", f.Name, email);
            }
        }
        catch (Exception ex) { logger.LogWarning(ex, "Could not link human-flow owners to users."); }
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

// Load admin-editable runtime settings (Admin Settings → Client Locations → Google API key)
using (var settingsScope = app.Services.CreateScope())
{
    var logger = settingsScope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    ProjectTracker.API.Services.Google.GoogleMapsConfig.SetConfiguredKey(app.Configuration["GoogleMaps:ApiKey"]);
    try
    {
        var db = settingsScope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var googleKey = db.SystemSettings.AsNoTracking()
            .Where(s => s.Key == ProjectTracker.API.Models.SystemSettingKeys.GoogleMapsApiKey)
            .Select(s => s.Value).FirstOrDefault();
        ProjectTracker.API.Services.Google.GoogleMapsConfig.SetApiKey(googleKey);
        logger.LogInformation("Google Maps API key source: {Source}",
            ProjectTracker.API.Services.Google.GoogleMapsConfig.IsOverridden ? "SystemSettings (admin)"
            : string.IsNullOrEmpty(ProjectTracker.API.Services.Google.GoogleMapsConfig.ApiKey) ? "NOT CONFIGURED" : "configuration (GoogleMaps:ApiKey)");
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Could not load Google Maps API key from SystemSettings; using GoogleMaps:ApiKey from configuration.");
    }
}

// ---------------------------------------------------------------------------
// HTTP pipeline
// ---------------------------------------------------------------------------
app.UseResponseCompression();
// Public edge guard: requests stamped by the Azure portal edge may only reach /api/portal (+ /health),
// and get their real client IP from X-Forwarded-For. LAN traffic is untouched. Must run before the
// rate limiter so limits key on the customer's address, not the proxy's.
app.UseMiddleware<ProjectTracker.API.Security.PortalEdgeMiddleware>();
app.UseCors("AppCors");
app.UseRateLimiter();

app.UseAuthentication();

// Serve uploaded files. SECURITY: signed-in users only, and never rendered as active
// content on the API origin — an uploaded .html/.svg must not run script (stored XSS).
var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
Directory.CreateDirectory(uploadsPath);
app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/uploads"), uploads =>
{
    uploads.Use(async (ctx, next) =>
    {
        if (ctx.User.Identity?.IsAuthenticated != true)
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }
        await next();
    });
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads",
    OnPrepareResponse = ctx =>
    {
        var headers = ctx.Context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["Content-Security-Policy"] = "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'";
        var ext = Path.GetExtension(ctx.File.Name).ToLowerInvariant();
        if (ext is not (".png" or ".jpg" or ".jpeg" or ".gif" or ".webp" or ".pdf"))
            headers["Content-Disposition"] = "attachment";
    }
});

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
}).AllowAnonymous();
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready")
}).AllowAnonymous();

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
