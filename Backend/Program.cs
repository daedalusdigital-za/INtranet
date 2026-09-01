using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.IO.Compression;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.DTOs;

// Force BouncyCastle adapter registration for iText PDF generation.
// The adapter assembly must be loaded before any iText code runs, otherwise the
// BouncyCastleFactoryCreator static constructor falls back to BouncyCastleDefaultFactory.
iText.Bouncycastleconnector.BouncyCastleFactoryCreator.SetFactory(new iText.Bouncycastle.BouncyCastleFactory());

var builder = WebApplication.CreateBuilder(args);

// Add Response Compression for better performance
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "application/json",
        "application/javascript",
        "text/css",
        "text/html",
        "text/json",
        "text/plain"
    });
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Optimal;
});

// Add services to the container
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

// Add DbContext
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection") ??
        "Server=(localdb)\\mssqllocaldb;Database=ProjectTrackerDb;Trusted_Connection=true;MultipleActiveResultSets=true"));

// Add JWT Authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:SecretKey"] ??
                "YourSuperSecretKeyForJWTTokenGeneration123!"))
        };

        // Allow SignalR hubs to authenticate via access_token query string
        // WebSockets cannot send custom HTTP headers, so SignalR passes the JWT token
        // as a query parameter instead of an Authorization header
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(origin => true) // Allow any origin
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Add SignalR
builder.Services.AddSignalR();

// Real-time notification broadcaster (used by the Windows tray notifier)
builder.Services.AddScoped<ProjectTracker.API.Services.INotificationBroadcaster, ProjectTracker.API.Services.NotificationBroadcaster>();
builder.Services.AddSingleton<ProjectTracker.API.Services.IAttachmentStorageService, ProjectTracker.API.Services.AttachmentStorageService>();
// Add Memory Cache
builder.Services.AddMemoryCache();

// Add HttpClient for AI service
builder.Services.AddHttpClient();

// Add Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IDatabaseSeederService, DatabaseSeederService>();

// Add CarTrack Service for logistics GPS tracking
builder.Services.AddHttpClient<ICarTrackService, CarTrackService>();

// Add School Delivery Management (SDM) integration for the Sanitary Pads project
builder.Services.Configure<ProjectTracker.API.Services.SchoolDelivery.SchoolDeliveryOptions>(
    builder.Configuration.GetSection("SchoolDelivery"));
builder.Services.AddHttpClient<
    ProjectTracker.API.Services.SchoolDelivery.ISchoolDeliveryService,
    ProjectTracker.API.Services.SchoolDelivery.SchoolDeliveryService>();

// Add HBA1C API Service for medical management project
builder.Services.AddHttpClient<ProjectTracker.API.Services.HBA1C.IHBA1CApiService, ProjectTracker.API.Services.HBA1C.HBA1CApiService>();

// Add TFN (TruckFuelNet) Services for fuel management
// TfnTokenService must be Singleton so all clients share the same token
builder.Services.AddSingleton<ProjectTracker.API.Services.TFN.TfnTokenService>();
builder.Services.AddHttpClient<ProjectTracker.API.Services.TFN.Clients.TfnVehiclesClient>();
builder.Services.AddHttpClient<ProjectTracker.API.Services.TFN.Clients.TfnDriversClient>();
builder.Services.AddHttpClient<ProjectTracker.API.Services.TFN.Clients.TfnOrdersClient>();
builder.Services.AddHttpClient<ProjectTracker.API.Services.TFN.Clients.TfnTransactionsClient>();
builder.Services.AddHttpClient<ProjectTracker.API.Services.TFN.Clients.TfnAccountsClient>();
builder.Services.AddHttpClient<ProjectTracker.API.Services.TFN.Clients.TfnDepotsClient>();
builder.Services.AddScoped<ProjectTracker.API.Services.TFN.TfnSyncService>();
// Tracks freshness/outcome of the last TFN sync for the dashboard (singleton so it survives across scoped sync runs)
builder.Services.AddSingleton<ProjectTracker.API.Services.TFN.TfnSyncStatus>();
// Periodically sync TFN fuel data (orders/transactions/etc.) so it doesn't go stale
builder.Services.AddHostedService<ProjectTracker.API.Services.TFN.TfnSyncBackgroundService>();

// Persist CarTrack movements daily into the DB so movement history is retained
// permanently and can be back-dated (CarTrack only exposes a limited live window).
builder.Services.AddScoped<ProjectTracker.API.Services.Logistics.IMovementHistoryPersistenceService, ProjectTracker.API.Services.Logistics.MovementHistoryPersistenceService>();
builder.Services.AddSingleton<ProjectTracker.API.Services.Logistics.MovementBackfillStatus>();
builder.Services.AddScoped<ProjectTracker.API.Services.Logistics.IFuelAnalysisService, ProjectTracker.API.Services.Logistics.FuelAnalysisService>();
builder.Services.AddHostedService<ProjectTracker.API.Services.Logistics.MovementHistoryBackgroundService>();

// Electronic signatures (reusable across modules) + requisition-invoice workflow
builder.Services.AddScoped<ProjectTracker.API.Services.Signatures.ISignatureService, ProjectTracker.API.Services.Signatures.SignatureService>();

// Always-on (24/7) fleet incident monitor — records speeding (all day, all cars),
// curfew movement and warehouse geofence exits into the daily Reports log,
// independently of whether anyone has the Controller / Open Map screen open.
builder.Services.AddHostedService<ProjectTracker.API.Services.Logistics.IncidentMonitoringService>();

// Add Knowledge Base Service (must be registered before LlamaAIService)
builder.Services.AddSingleton<IKnowledgeBaseService, KnowledgeBaseService>();

// Add Welly Memory Service (central task cache / long-term recall)
builder.Services.AddSingleton<IWellyMemoryService, WellyMemoryService>();

// Add Asset↔Invoice AI matching service
builder.Services.AddScoped<IAssetInvoiceMatchingService, AssetInvoiceMatchingService>();// Add LLaMA AI Service (singleton so model is loaded once)
builder.Services.AddSingleton<ILlamaAIService, LlamaAIService>();

// Add Logistics AI Service for load/tripsheet querying
builder.Services.AddScoped<ILogisticsAIService, LogisticsAIService>();
builder.Services.AddScoped<LoadOptimizationService>();
builder.Services.AddScoped<InvoiceDeliveryPriorityService>();

// Add Customer Address Cleanup Service
builder.Services.AddScoped<CustomerAddressCleanupService>();
builder.Services.AddScoped<CustomerProvinceMapperService>();

// Add Gemini AI Province Mapping Service
builder.Services.AddScoped<GeminiProvinceService>();

// Add Google Maps API Services
builder.Services.AddScoped<ProjectTracker.API.Services.Google.GeocodingService>();
builder.Services.AddScoped<ProjectTracker.API.Services.Google.AddressValidationService>();
builder.Services.AddScoped<ProjectTracker.API.Services.Google.RoutesService>();
builder.Services.AddScoped<ProjectTracker.API.Services.Google.RouteOptimizationService>();
builder.Services.AddScoped<ProjectTracker.API.Services.Google.WebSearchService>();

// Sales Report Import Service
builder.Services.AddScoped<SalesReportImportService>();

// Report Cache Service — caches generated sales reports for fast repeat lookups
builder.Services.AddScoped<IReportCacheService, ReportCacheService>();

// Stock on Hand Import Service
builder.Services.AddScoped<StockOnHandImportService>();

// Trip Sheet Import Service
builder.Services.AddScoped<TripSheetImportService>();

// Email Service
builder.Services.AddScoped<IEmailService, EmailService>();

// IMAP Email Search Service
builder.Services.AddScoped<EmailSearchService>();

// Persistent sales mailbox monitor (single login per mailbox + IMAP IDLE) —
// avoids the repeated connect/login/logout churn that got the IP blacklisted.
builder.Services.AddSingleton<ProjectTracker.API.Services.SalesMailboxMonitorService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<ProjectTracker.API.Services.SalesMailboxMonitorService>());

// Add comprehensive AI Context Service for database access
builder.Services.AddScoped<IAIContextService, AIContextService>();

// Add Conversation Memory Service for AI chat history
builder.Services.AddSingleton<IConversationMemoryService, ConversationMemoryService>();

// Add Ollama AI Service for local LLM support
builder.Services.AddSingleton<IOllamaAIService, OllamaAIService>();

// Add Claude AI Service for cloud LLM support (primary provider)
builder.Services.AddSingleton<IClaudeAIService, ClaudeAIService>();

// Add Local LLM Service for Qwen2.5-14B via llama.cpp (primary provider)
builder.Services.AddSingleton<ILocalLlmService, LocalLlmService>();

// Add AI Action Service for executing AI-requested actions (create tickets, meetings, etc.)
builder.Services.AddScoped<IAIActionService, AIActionService>();

// Add TripSheet Workflow Service for AI-guided TripSheet creation
builder.Services.AddScoped<ITripSheetWorkflowService, TripSheetWorkflowService>();

// Add Azure Sync Background Service
builder.Services.AddHostedService<AzureSyncService>();

var app = builder.Build();

// Apply migrations and seed data automatically
using (var scope = app.Services.CreateScope())
{
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

// Configure the HTTP request pipeline
app.UseResponseCompression(); // Enable response compression
app.UseCors("AllowAll");

// Create uploads directory if it doesn't exist
var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}

// Serve static files for uploads
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

// Auto-ingest knowledge base documents on startup
_ = Task.Run(async () =>
{
    try
    {
        // Wait for DB migrations to complete
        await Task.Delay(5000);
        var kbService = app.Services.GetRequiredService<IKnowledgeBaseService>();
        var kbPaths = new[] { "/app/kb-docs", Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "kb-docs") };
        foreach (var kbPath in kbPaths)
        {
            if (Directory.Exists(kbPath))
            {
                var count = await kbService.IngestFolderAsync(kbPath);
                Console.WriteLine($"[KB] Auto-ingested {count} documents from {kbPath}");
                break;
            }
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[KB] Auto-ingest failed: {ex.Message}");
    }
});

app.Run();
