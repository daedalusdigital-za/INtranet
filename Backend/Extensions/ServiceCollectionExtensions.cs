using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.IdentityModel.Tokens;
using System.IO.Compression;
using System.Text;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Extensions
{
    /// <summary>
    /// Groups the application's DI registrations into focused, self-documenting
    /// modules so Program.cs stays a readable pipeline instead of a 70-line
    /// registration dump. Each method returns IServiceCollection for chaining.
    /// </summary>
    public static class ServiceCollectionExtensions
    {
        // ------------------------------------------------------------------
        // Response compression (Brotli + Gzip, HTTPS included)
        // ------------------------------------------------------------------
        public static IServiceCollection AddAppCompression(this IServiceCollection services)
        {
            services.AddResponseCompression(options =>
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
            services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Optimal);
            services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Optimal);
            return services;
        }

        // ------------------------------------------------------------------
        // JWT bearer auth. SECURITY: the signing key is REQUIRED — there is
        // deliberately no fallback. A hardcoded default key would let anyone
        // forge tokens if the environment variable is ever missing.
        // ------------------------------------------------------------------
        public static IServiceCollection AddAppAuthentication(this IServiceCollection services, IConfiguration config)
        {
            var secretKey = config["JwtSettings:SecretKey"];
            if (string.IsNullOrWhiteSpace(secretKey) || secretKey.StartsWith("${"))
            {
                throw new InvalidOperationException(
                    "JwtSettings:SecretKey is not configured. Set it via appsettings.json (gitignored), " +
                    "user secrets, or the JWTSETTINGS__SECRETKEY environment variable. " +
                    "Refusing to start with a missing/placeholder JWT signing key.");
            }

            services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = config["JwtSettings:Issuer"],
                        ValidAudience = config["JwtSettings:Audience"],
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey))
                    };

                    // Allow SignalR hubs to authenticate via access_token query string.
                    // WebSockets cannot send custom HTTP headers, so SignalR passes the
                    // JWT as a query parameter instead of an Authorization header.
                    options.Events = new JwtBearerEvents
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
                })
                // Rocket Freight client portal. Same signing key, DIFFERENT audience: a portal
                // token fails the default scheme above (wrong audience), so a client login can
                // never reach the intranet APIs, and intranet tokens are refused by /api/portal.
                .AddJwtBearer(PortalAuth.Scheme, options =>
                {
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = config["JwtSettings:Issuer"],
                        ValidAudience = PortalAuth.Audience(config),
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(PortalAuth.SigningKey(config))),
                        ClockSkew = TimeSpan.FromMinutes(1)
                    };
                });

            // SECURITY: deny-by-default. Any endpoint (controller, hub, health check) without
            // its own [Authorize]/[AllowAnonymous] requires a signed-in user, so a forgotten
            // attribute no longer exposes an endpoint to anonymous callers.
            services.AddAuthorization(options =>
            {
                options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                    .RequireAuthenticatedUser()
                    .Build();
            });
            return services;
        }

        // ------------------------------------------------------------------
        // CORS. SECURITY: allow-any-origin combined with AllowCredentials()
        // lets any website make authenticated calls on a logged-in user's
        // behalf. Origins are now an explicit allow-list from configuration
        // (Cors:AllowedOrigins), with safe intranet defaults.
        // ------------------------------------------------------------------
        public static IServiceCollection AddAppCors(this IServiceCollection services, IConfiguration config)
        {
            var configured = config.GetSection("Cors:AllowedOrigins").Get<string[]>();
            var allowedOrigins = (configured != null && configured.Length > 0)
                ? configured
                : new[]
                {
                    "http://localhost:4200",
                    "http://localhost",
                    "http://192.168.10.151",
                    "http://192.168.10.151:4200",
                    "https://192.168.10.151"
                };

            services.AddCors(options =>
            {
                options.AddPolicy("AppCors", policy =>
                {
                    policy.SetIsOriginAllowed(origin => IsAllowedOrigin(origin, allowedOrigins))
                          .AllowAnyMethod()
                          .AllowAnyHeader()
                          .AllowCredentials();
                });
            });
            return services;
        }

        /// <summary>
        /// An origin is allowed if it is in the configured list, or if it is a
        /// loopback / RFC1918 private-network address on any port (the intranet dev
        /// server runs with --host 0.0.0.0 and is opened from many LAN addresses).
        /// Public internet origins are still rejected.
        /// </summary>
        private static bool IsAllowedOrigin(string origin, string[] allowedOrigins)
        {
            if (string.IsNullOrWhiteSpace(origin)) return false;
            if (allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
            if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;

            var host = uri.Host;
            if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase)) return true;
            if (!System.Net.IPAddress.TryParse(host, out var ip))
            {
                // Plain single-label machine names (e.g. http://intranet-pc:4200) are LAN-only.
                return !host.Contains('.');
            }
            if (System.Net.IPAddress.IsLoopback(ip)) return true;
            if (ip.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork) return false;
            var b = ip.GetAddressBytes();
            return b[0] == 10
                || (b[0] == 172 && b[1] >= 16 && b[1] <= 31)
                || (b[0] == 192 && b[1] == 168);
        }

        // ------------------------------------------------------------------
        // Core cross-cutting services: auth, auditing, seeding, storage,
        // notifications, caching.
        // ------------------------------------------------------------------
        public static IServiceCollection AddCoreServices(this IServiceCollection services)
        {
            services.AddSignalR();
            services.AddMemoryCache();
            services.AddHttpClient();

            services.AddScoped<INotificationBroadcaster, NotificationBroadcaster>();
            services.AddSingleton<IAttachmentStorageService, AttachmentStorageService>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<ITokenService, TokenService>();
            services.AddScoped<IAuditLogService, AuditLogService>();
            services.AddScoped<IDatabaseSeederService, DatabaseSeederService>();

            // Server-side intensive OCR (tesseract) for POD invoice-number extraction
            services.AddScoped<ServerOcrService>();

            // Electronic signatures (reusable across modules) + requisition-invoice workflow
            services.AddScoped<Services.Signatures.ISignatureService, Services.Signatures.SignatureService>();

            // Client bookings & shipment lifecycle (status engine, waybills, notifications)
            services.AddScoped<Services.Logistics.INumberSequenceService, Services.Logistics.NumberSequenceService>();
            services.AddScoped<Services.Logistics.IShipmentLifecycleService, Services.Logistics.ShipmentLifecycleService>();
            services.AddScoped<Services.Logistics.IShipmentNotificationService, Services.Logistics.ShipmentNotificationService>();
            services.AddScoped<Services.Logistics.IWaybillService, Services.Logistics.WaybillService>();
            // Booking intake shared by ops, CSV, API and the client portal (same validation everywhere)
            services.AddScoped<Services.Logistics.IBookingIntakeService, Services.Logistics.BookingIntakeService>();
            // Rocket Freight client portal tokens (separate audience, see AddAppAuthentication)
            services.AddScoped<Services.Logistics.IPortalTokenService, Services.Logistics.PortalTokenService>();
            services.AddSingleton<Services.Logistics.ISmsService, Services.Logistics.LoggingSmsService>();
            return services;
        }

        // ------------------------------------------------------------------
        // External integrations: CarTrack GPS, School Delivery (SDM),
        // HBA1C medical API, TFN fuel, Google Maps.
        // ------------------------------------------------------------------
        public static IServiceCollection AddIntegrationServices(this IServiceCollection services, IConfiguration config)
        {
            // CarTrack GPS tracking
            services.AddHttpClient<ICarTrackService, CarTrackService>();

            // School Delivery Management (SDM) integration for the Sanitary Pads project
            services.Configure<Services.SchoolDelivery.SchoolDeliveryOptions>(
                config.GetSection("SchoolDelivery"));
            services.AddHttpClient<
                Services.SchoolDelivery.ISchoolDeliveryService,
                Services.SchoolDelivery.SchoolDeliveryService>();

            // HBA1C API for the medical management project
            services.AddHttpClient<Services.HBA1C.IHBA1CApiService, Services.HBA1C.HBA1CApiService>();

            // TFN (TruckFuelNet) fuel management.
            // TfnTokenService must be Singleton so all clients share the same token.
            services.AddSingleton<Services.TFN.TfnTokenService>();
            services.AddHttpClient<Services.TFN.Clients.TfnVehiclesClient>();
            services.AddHttpClient<Services.TFN.Clients.TfnDriversClient>();
            services.AddHttpClient<Services.TFN.Clients.TfnOrdersClient>();
            services.AddHttpClient<Services.TFN.Clients.TfnTransactionsClient>();
            services.AddHttpClient<Services.TFN.Clients.TfnAccountsClient>();
            services.AddHttpClient<Services.TFN.Clients.TfnDepotsClient>();
            services.AddScoped<Services.TFN.TfnSyncService>();
            // Tracks freshness/outcome of the last TFN sync (singleton so it survives scoped sync runs)
            services.AddSingleton<Services.TFN.TfnSyncStatus>();
            services.AddHostedService<Services.TFN.TfnSyncBackgroundService>();

            // Google Maps APIs
            services.AddScoped<Services.Google.GeocodingService>();
            services.AddScoped<Services.Google.AddressValidationService>();
            services.AddScoped<Services.Google.RoutesService>();
            services.AddScoped<Services.Google.RouteOptimizationService>();
            services.AddScoped<Services.Google.WebSearchService>();
            return services;
        }

        // ------------------------------------------------------------------
        // Logistics domain: movement history persistence, fuel analysis,
        // incident monitoring, load/tripsheet optimisation.
        // ------------------------------------------------------------------
        public static IServiceCollection AddLogisticsServices(this IServiceCollection services)
        {
            // Persist CarTrack movements daily so history is retained permanently
            // (CarTrack only exposes a limited live window).
            services.AddScoped<Services.Logistics.IMovementHistoryPersistenceService, Services.Logistics.MovementHistoryPersistenceService>();
            services.AddSingleton<Services.Logistics.MovementBackfillStatus>();
            services.AddScoped<Services.Logistics.IFuelAnalysisService, Services.Logistics.FuelAnalysisService>();
            services.AddHostedService<Services.Logistics.MovementHistoryBackgroundService>();

            // Always-on (24/7) fleet incident monitor — speeding/curfew/geofence into Reports log
            services.AddHostedService<Services.Logistics.IncidentMonitoringService>();

            services.AddScoped<ILogisticsAIService, LogisticsAIService>();
            services.AddScoped<LoadOptimizationService>();
            services.AddScoped<InvoiceDeliveryPriorityService>();
            services.AddScoped<ITripSheetWorkflowService, TripSheetWorkflowService>();

            // Customer data cleanup + province mapping
            services.AddScoped<CustomerAddressCleanupService>();
            services.AddScoped<CustomerProvinceMapperService>();
            services.AddScoped<GeminiProvinceService>();

            // Flows: automated business processes (engine, data sources, event bus, scheduler)
            services.AddScoped<Services.Flows.IFlowEngine, Services.Flows.FlowEngine>();
            services.AddScoped<Services.Flows.IFlowDataSources, Services.Flows.FlowDataSources>();
            services.AddSingleton<Services.Flows.IFlowEventPublisher, Services.Flows.FlowEventPublisher>();
            services.AddHostedService<Services.Flows.FlowSchedulerService>();
            return services;
        }

        // ------------------------------------------------------------------
        // AI stack: knowledge base, memory, LLM providers, actions, context.
        // ------------------------------------------------------------------
        public static IServiceCollection AddAiServices(this IServiceCollection services)
        {
            // Knowledge Base must be registered before LlamaAIService
            services.AddSingleton<IKnowledgeBaseService, KnowledgeBaseService>();
            services.AddSingleton<IWellyMemoryService, WellyMemoryService>();
            services.AddScoped<IAssetInvoiceMatchingService, AssetInvoiceMatchingService>();
            services.AddSingleton<ILlamaAIService, LlamaAIService>();     // singleton: model loaded once
            services.AddScoped<IAIContextService, AIContextService>();
            services.AddSingleton<IConversationMemoryService, ConversationMemoryService>();
            services.AddSingleton<IClaudeAIService, ClaudeAIService>();
            services.AddSingleton<ILocalLlmService, LocalLlmService>();
            services.AddScoped<IAIActionService, AIActionService>();
            return services;
        }

        // ------------------------------------------------------------------
        // Finance / sales imports, report caching, email.
        // ------------------------------------------------------------------
        public static IServiceCollection AddFinanceAndEmailServices(this IServiceCollection services)
        {
            services.AddScoped<SalesReportImportService>();
            services.AddScoped<IReportCacheService, ReportCacheService>();
            services.AddScoped<StockOnHandImportService>();
            services.AddScoped<TripSheetImportService>();

            services.AddScoped<IEmailService, EmailService>();
            services.AddScoped<EmailSearchService>();

            // Persistent sales mailbox monitor (single login per mailbox + IMAP IDLE) —
            // avoids the repeated connect/login/logout churn that got the IP blacklisted.
            services.AddSingleton<SalesMailboxMonitorService>();
            services.AddHostedService(sp => sp.GetRequiredService<SalesMailboxMonitorService>());

            // Azure sync background service
            services.AddHostedService<AzureSyncService>();
            return services;
        }
    }
}
