namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Periodically snapshots CarTrack movement data into the database so it is
    /// retained permanently and can be back-dated. Refreshes "today" on an
    /// interval (live data trickles in) and backfills the previous day shortly
    /// after midnight to capture late-arriving trips.
    ///
    /// Config:
    ///   MovementHistory:AutoSave:Enabled          (bool, default true)
    ///   MovementHistory:AutoSave:IntervalMinutes  (int, default 30)
    ///
    /// One-time historical backfill (runs once on startup, then set flag back to false):
    ///   MovementHistory:Backfill:Enabled          (bool, default false)
    ///   MovementHistory:Backfill:FromDate         (yyyy-MM-dd, default Jan 1 this year)
    /// </summary>
    public class MovementHistoryBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MovementHistoryBackgroundService> _logger;
        private readonly IConfiguration _configuration;

        private DateTime _lastBackfillDate = DateTime.MinValue;

        public MovementHistoryBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<MovementHistoryBackgroundService> logger,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            if (!_configuration.GetValue<bool>("MovementHistory:AutoSave:Enabled", true))
            {
                _logger.LogInformation("Movement History auto-save is disabled. Not starting.");
                return;
            }

            var intervalMinutes = _configuration.GetValue<int>("MovementHistory:AutoSave:IntervalMinutes", 30);
            if (intervalMinutes < 5) intervalMinutes = 5; // guardrail
            var interval = TimeSpan.FromMinutes(intervalMinutes);

            _logger.LogInformation("Movement History Background Service starting (interval: {Interval} min)...", intervalMinutes);

            // Give the DB/HTTP a moment after startup
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(40), stoppingToken);
                await MaybeRunHistoricalBackfillAsync(stoppingToken);
                await RunAsync(stoppingToken);
            }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during initial movement history save - continuing with periodic saves");
            }

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(interval, stoppingToken);
                    await RunAsync(stoppingToken);
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during scheduled movement history save");
                }
            }

            _logger.LogInformation("Movement History Background Service stopped.");
        }

        /// <summary>
        /// One-time historical backfill from a configured start date up to yesterday.
        /// Enable via config, let it run once, then disable. Idempotent regardless.
        /// </summary>
        private async Task MaybeRunHistoricalBackfillAsync(CancellationToken ct)
        {
            if (!_configuration.GetValue<bool>("MovementHistory:Backfill:Enabled", false))
                return;

            var fromStr = _configuration.GetValue<string>("MovementHistory:Backfill:FromDate");
            var from = DateTime.TryParse(fromStr, out var f)
                ? f.Date
                : new DateTime(DateTime.UtcNow.Year, 1, 1);
            var to = DateTime.UtcNow.Date.AddDays(-1); // today is handled by RunAsync

            if (to < from) return;

            _logger.LogWarning("Starting ONE-TIME historical movement backfill {From}..{To}. " +
                "This can take a while. Disable MovementHistory:Backfill:Enabled after it completes.",
                from.ToString("yyyy-MM-dd"), to.ToString("yyyy-MM-dd"));

            using var scope = _serviceProvider.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<IMovementHistoryPersistenceService>();
            var status = scope.ServiceProvider.GetService<MovementBackfillStatus>();

            var created = await svc.BackfillRangeAsync(from, to, status, ct);
            _logger.LogWarning("Historical movement backfill complete: {Created} new rows created.", created);
        }

        private async Task RunAsync(CancellationToken ct)
        {
            using var scope = _serviceProvider.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<IMovementHistoryPersistenceService>();

            var today = DateTime.UtcNow.Date;
            await svc.PersistDayAsync(today, ct);

            // Backfill yesterday once per day, in the early-morning window, to catch
            // late-arriving CarTrack records for the day that just ended.
            var nowHour = DateTime.UtcNow.Hour;
            if (nowHour < 3 && _lastBackfillDate != today)
            {
                await svc.PersistDayAsync(today.AddDays(-1), ct);
                _lastBackfillDate = today;
            }
        }
    }
}
