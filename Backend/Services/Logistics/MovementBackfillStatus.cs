namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Tracks progress of a long-running historical movement-history backfill so
    /// the UI/API can poll status without blocking the triggering request.
    /// </summary>
    public class MovementBackfillStatus
    {
        private readonly object _lock = new();

        public bool IsRunning { get; private set; }
        public DateTime? StartedUtc { get; private set; }
        public DateTime? FinishedUtc { get; private set; }
        public DateTime? FromDate { get; private set; }
        public DateTime? ToDate { get; private set; }
        public int TotalDays { get; private set; }
        public int DaysProcessed { get; private set; }
        public DateTime? CurrentDay { get; private set; }
        public int RowsCreated { get; private set; }
        public string? Error { get; private set; }

        public bool TryStart(DateTime from, DateTime to)
        {
            lock (_lock)
            {
                if (IsRunning) return false;
                IsRunning = true;
                StartedUtc = DateTime.UtcNow;
                FinishedUtc = null;
                FromDate = from.Date;
                ToDate = to.Date;
                TotalDays = (int)(to.Date - from.Date).TotalDays + 1;
                DaysProcessed = 0;
                CurrentDay = null;
                RowsCreated = 0;
                Error = null;
                return true;
            }
        }

        public void ReportDay(DateTime day, int created)
        {
            lock (_lock)
            {
                CurrentDay = day.Date;
                DaysProcessed++;
                RowsCreated += created;
            }
        }

        public void Finish(string? error = null)
        {
            lock (_lock)
            {
                IsRunning = false;
                FinishedUtc = DateTime.UtcNow;
                Error = error;
            }
        }

        public object Snapshot()
        {
            lock (_lock)
            {
                return new
                {
                    isRunning = IsRunning,
                    startedUtc = StartedUtc,
                    finishedUtc = FinishedUtc,
                    fromDate = FromDate,
                    toDate = ToDate,
                    totalDays = TotalDays,
                    daysProcessed = DaysProcessed,
                    currentDay = CurrentDay,
                    rowsCreated = RowsCreated,
                    percent = TotalDays > 0 ? (int)(DaysProcessed * 100.0 / TotalDays) : 0,
                    error = Error
                };
            }
        }
    }
}
