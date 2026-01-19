using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.DTOs;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
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

// Add Memory Cache for PBX session management
builder.Services.AddMemoryCache();

// Configure PBX Settings
builder.Services.Configure<PbxSettings>(builder.Configuration.GetSection("PbxSettings"));

// Add HttpClient for AI service
builder.Services.AddHttpClient();

// Add Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IDatabaseSeederService, DatabaseSeederService>();

// Add PBX Service (singleton to maintain session cache)
builder.Services.AddSingleton<IPbxService, PbxService>();

// Add CarTrack Service for logistics GPS tracking
builder.Services.AddHttpClient<ICarTrackService, CarTrackService>();

// Add Knowledge Base Service (must be registered before LlamaAIService)
builder.Services.AddSingleton<IKnowledgeBaseService, KnowledgeBaseService>();

// Add LLaMA AI Service (singleton so model is loaded once)
builder.Services.AddSingleton<ILlamaAIService, LlamaAIService>();

// Add Azure Sync Background Service
builder.Services.AddHostedService<AzureSyncService>();

var app = builder.Build();

// Apply migrations and seed data automatically
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<ApplicationDbContext>();
        context.Database.Migrate();
    }
    catch (Exception ex)
    {
        var logger = services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "An error occurred while migrating the database.");
    }
}

// Configure the HTTP request pipeline
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<BoardHub>("/hubs/board");
app.MapHub<AttendanceHub>("/hubs/attendance");
app.MapHub<ChatHub>("/hubs/chat");

app.Run();
