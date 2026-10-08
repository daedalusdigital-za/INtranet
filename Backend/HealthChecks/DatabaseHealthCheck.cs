using Microsoft.Extensions.Diagnostics.HealthChecks;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.HealthChecks
{
    /// <summary>
    /// Liveness/readiness check that verifies the SQL Server database is
    /// reachable. Used by /health/ready so load balancers and blue-green
    /// deploy flips only route traffic to instances that can actually serve.
    /// </summary>
    public class DatabaseHealthCheck : IHealthCheck
    {
        private readonly ApplicationDbContext _db;

        public DatabaseHealthCheck(ApplicationDbContext db) => _db = db;

        public async Task<HealthCheckResult> CheckHealthAsync(
            HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                return await _db.Database.CanConnectAsync(cancellationToken)
                    ? HealthCheckResult.Healthy("Database reachable")
                    : HealthCheckResult.Unhealthy("Database not reachable");
            }
            catch (Exception ex)
            {
                return HealthCheckResult.Unhealthy("Database check threw", ex);
            }
        }
    }
}
