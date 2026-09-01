namespace ProjectTracker.API.Services.TFN
{
    /// <summary>
    /// Singleton that tracks the outcome of the most recent TFN sync run so the
    /// dashboard can surface how fresh the data is (and whether the last run had
    /// errors). Registered as a singleton because it must persist across scoped
    /// sync runs for the lifetime of the process.
    /// </summary>
    public class TfnSyncStatus
    {
        private readonly object _lock = new();

        /// <summary>UTC time of the last sync run that completed without errors.</summary>
        public DateTime? LastSuccessfulSyncUtc { get; private set; }

        /// <summary>UTC time of the last sync run attempt, regardless of outcome.</summary>
        public DateTime? LastAttemptUtc { get; private set; }

        /// <summary>Whether the most recent run reported any errors.</summary>
        public bool LastRunHadError { get; private set; }

        /// <summary>Error detail from the most recent run, if any.</summary>
        public string? LastErrorMessage { get; private set; }

        /// <summary>Orders synced on the most recent successful run.</summary>
        public int LastOrdersSynced { get; private set; }

        public void RecordResult(bool hasError, string? errorMessage, int ordersSynced)
        {
            lock (_lock)
            {
                var now = DateTime.UtcNow;
                LastAttemptUtc = now;
                LastRunHadError = hasError;
                LastErrorMessage = errorMessage;

                if (!hasError)
                {
                    LastSuccessfulSyncUtc = now;
                    LastOrdersSynced = ordersSynced;
                }
            }
        }
    }
}
