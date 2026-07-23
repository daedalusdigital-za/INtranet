using ProjectTracker.API.Services.TFN;

namespace ProjectTracker.API.Services.TFN
{
    /// <summary>
    /// Background service that periodically syncs TFN (TruckFuelNet) fuel data
    /// (depots, vehicles, drivers, orders, transactions, balances) into the local
    /// database. Without this, TFN data only updated when the manual
    /// /api/logistics/tfn/sync endpoint was hit, which caused orders to become
    /// stale (e.g. stuck on February data).
    ///
    /// Controlled by config:
    ///   TFN:AutoSync:Enabled          (bool, default true)
    ///   TFN:AutoSync:IntervalMinutes  (int, default 60)
    /// </summary>
    public class TfnSyncBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TfnSyncBackgroundService> _logger;
        private readonly IConfiguration _configuration;

        public TfnSyncBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<TfnSyncBackgroundService> logger,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_configuration.GetValue<bool>("TFN:AutoSync:Enabled", true))
            {
                _logger.LogInformation("TFN Auto-Sync is disabled (TFN:AutoSync:Enabled=false). Not starting.");
                return;
            }

            var intervalMinutes = _configuration.GetValue<int>("TFN:AutoSync:IntervalMinutes", 60);
            if (intervalMinutes < 5) intervalMinutes = 5; // guardrail
            var interval = TimeSpan.FromMinutes(intervalMinutes);

            _logger.LogInformation("TFN Sync Background Service starting (interval: {Interval} min)...", intervalMinutes);

            // Initial sync shortly after startup (give DB/HTTP a moment to be ready)
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
                await RunSyncAsync();
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("TFN Sync Background Service cancelled during initial sync.");
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during initial TFN sync - continuing with periodic sync");
            }

            // Periodic sync
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(interval, stoppingToken);
                    await RunSyncAsync();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during scheduled TFN sync");
                }
            }

            _logger.LogInformation("TFN Sync Background Service stopped.");
        }

        private async Task RunSyncAsync()
        {
            _logger.LogInformation("Starting scheduled TFN sync...");

            // TfnSyncService is scoped (depends on ApplicationDbContext), so create a scope.
            using var scope = _serviceProvider.CreateScope();
            var syncService = scope.ServiceProvider.GetRequiredService<TfnSyncService>();

            var result = await syncService.SyncAllAsync();

            _logger.LogInformation(
                "TFN sync completed. Orders: {OrdersSynced}, FuelHistory: {FuelSynced}, Vehicles: {VehSynced}, Drivers: {DrvSynced}",
                result.OrdersResult?.Synced ?? 0,
                result.FuelHistoryResult?.Synced ?? 0,
                result.VehiclesResult?.Synced ?? 0,
                result.DriversResult?.Synced ?? 0);
        }
    }
}
