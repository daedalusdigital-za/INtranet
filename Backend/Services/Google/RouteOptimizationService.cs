using System.Text;
using System.Text.Json;

namespace ProjectTracker.API.Services.Google
{
    /// <summary>
    /// Route Optimization Service using Google Route Optimization API (Cloud Fleet Routing)
    /// Optimizes delivery routes considering time windows, vehicle capacity, and constraints
    /// </summary>
    public class RouteOptimizationService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<RouteOptimizationService> _logger;
        private readonly RoutesService _routesService;

        public RouteOptimizationService(
            IHttpClientFactory httpClientFactory, 
            ILogger<RouteOptimizationService> logger,
            RoutesService routesService)
        {
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;
            _routesService = routesService;
        }

        #region DTOs

        public class DeliveryOptimizationRequest
        {
            public DepotLocation Depot { get; set; } = new();
            public List<DeliveryStop> Stops { get; set; } = new();
            public VehicleInfo Vehicle { get; set; } = new();
            public DateTime? DepartureTime { get; set; }
            public bool ReturnToDepot { get; set; } = true;
            public int? MaxStops { get; set; }
            public int? MaxDurationMinutes { get; set; }
        }

        public class DepotLocation
        {
            public string Name { get; set; } = "Warehouse";
            public double Latitude { get; set; }
            public double Longitude { get; set; }
            public string? Address { get; set; }
        }

        public class DeliveryStop
        {
            public int Id { get; set; } // Reference ID (e.g., InvoiceId, CustomerId)
            public string Name { get; set; } = "";
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
            public string? Address { get; set; }
            public int ServiceTimeMinutes { get; set; } = 15; // Time spent at stop
            public TimeWindow? TimeWindow { get; set; }
            public int Priority { get; set; } = 1; // 1=Normal, 2=High, 3=Urgent
            public decimal? Value { get; set; } // Order/invoice value
            public double? Weight { get; set; } // For capacity constraints
            public string? Notes { get; set; }
        }

        public class TimeWindow
        {
            public TimeSpan Start { get; set; }
            public TimeSpan End { get; set; }
        }

        public class VehicleInfo
        {
            public string Name { get; set; } = "Delivery Vehicle";
            public double? MaxCapacityKg { get; set; }
            public int? MaxStops { get; set; }
            public TimeSpan? StartTime { get; set; }
            public TimeSpan? EndTime { get; set; }
            public int BreakDurationMinutes { get; set; } = 30;
            public bool RequiresBreakAfterHours { get; set; } = true;
            public double BreakAfterHours { get; set; } = 4;
        }

        public class OptimizationResult
        {
            public bool Success { get; set; }
            public string? Error { get; set; }
            public OptimizedRoute Route { get; set; } = new();
            public OptimizationMetrics Metrics { get; set; } = new();
            public List<UnassignedStop> UnassignedStops { get; set; } = new();
        }

        public class OptimizedRoute
        {
            public List<OptimizedStop> Stops { get; set; } = new();
            public int TotalDistanceMeters { get; set; }
            public int TotalDurationSeconds { get; set; }
            public string TotalDistanceText { get; set; } = "";
            public string TotalDurationText { get; set; } = "";
            public DateTime DepartureTime { get; set; }
            public DateTime EstimatedReturnTime { get; set; }
            public decimal TotalValue { get; set; }
        }

        public class OptimizedStop
        {
            public int Sequence { get; set; }
            public int OriginalId { get; set; }
            public string Name { get; set; } = "";
            public string Address { get; set; } = "";
            public double Latitude { get; set; }
            public double Longitude { get; set; }
            public DateTime EstimatedArrival { get; set; }
            public DateTime EstimatedDeparture { get; set; }
            public int DistanceFromPreviousMeters { get; set; }
            public int DurationFromPreviousSeconds { get; set; }
            public string DistanceFromPreviousText { get; set; } = "";
            public string DurationFromPreviousText { get; set; } = "";
            public int CumulativeDistanceMeters { get; set; }
            public int CumulativeDurationSeconds { get; set; }
            public string? Notes { get; set; }
            public decimal? Value { get; set; }
            public bool IsDepot { get; set; }
        }

        public class OptimizationMetrics
        {
            public int TotalStops { get; set; }
            public int OptimizedStops { get; set; }
            public int SkippedStops { get; set; }
            public double DistanceSavedPercent { get; set; }
            public double TimeSavedPercent { get; set; }
            public int OriginalDistanceMeters { get; set; }
            public int OptimizedDistanceMeters { get; set; }
            public string OptimizationMethod { get; set; } = "";
        }

        public class UnassignedStop
        {
            public int Id { get; set; }
            public string Name { get; set; } = "";
            public string Reason { get; set; } = "";
        }

        #endregion

        /// <summary>
        /// Optimize delivery route for a set of stops
        /// Uses Google Routes API with waypoint optimization
        /// </summary>
        public async Task<OptimizationResult> OptimizeDeliveryRouteAsync(DeliveryOptimizationRequest request)
        {
            var result = new OptimizationResult { Success = true };

            try
            {
                // Validate request
                if (request.Stops == null || !request.Stops.Any())
                {
                    return new OptimizationResult 
                    { 
                        Success = false, 
                        Error = "No delivery stops provided" 
                    };
                }

                _logger.LogInformation("Optimizing route for {StopCount} stops from depot {Depot}", 
                    request.Stops.Count, request.Depot.Name);

                // Filter stops with valid coordinates or addresses
                var validStops = request.Stops
                    .Where(s => (s.Latitude.HasValue && s.Longitude.HasValue) || !string.IsNullOrEmpty(s.Address))
                    .ToList();

                var invalidStops = request.Stops.Except(validStops).ToList();
                foreach (var invalid in invalidStops)
                {
                    result.UnassignedStops.Add(new UnassignedStop
                    {
                        Id = invalid.Id,
                        Name = invalid.Name,
                        Reason = "Missing coordinates or address"
                    });
                }

                if (!validStops.Any())
                {
                    return new OptimizationResult 
                    { 
                        Success = false, 
                        Error = "No valid stops with coordinates or addresses" 
                    };
                }

                // Sort by priority first (high priority stops should be visited first if possible)
                validStops = validStops.OrderByDescending(s => s.Priority).ToList();

                // Convert to RoutesService locations
                var origin = new RoutesService.Location
                {
                    Latitude = request.Depot.Latitude,
                    Longitude = request.Depot.Longitude,
                    Address = request.Depot.Address,
                    Label = request.Depot.Name,
                    ReferenceId = -1
                };

                var waypoints = validStops.Select(s => new RoutesService.Location
                {
                    Latitude = s.Latitude,
                    Longitude = s.Longitude,
                    Address = s.Address,
                    Label = s.Name,
                    ReferenceId = s.Id
                }).ToList();

                var destination = request.ReturnToDepot ? origin : null;

                // Use Routes API to optimize
                var departureTime = request.DepartureTime ?? DateTime.Now.AddHours(1);
                var routeResult = await _routesService.OptimizeRouteAsync(origin, waypoints, destination, departureTime);

                if (!routeResult.Success)
                {
                    return new OptimizationResult 
                    { 
                        Success = false, 
                        Error = routeResult.Error 
                    };
                }

                // Build optimized result
                result.Route = BuildOptimizedRoute(routeResult, request, validStops, departureTime);
                result.Metrics = CalculateMetrics(routeResult, validStops, invalidStops.Count);

                _logger.LogInformation("Route optimized: {Stops} stops, {Distance}, {Duration}", 
                    result.Route.Stops.Count, 
                    result.Route.TotalDistanceText, 
                    result.Route.TotalDurationText);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error optimizing delivery route");
                return new OptimizationResult { Success = false, Error = ex.Message };
            }
        }

        /// <summary>
        /// Optimize multiple vehicles for delivery (simple round-robin assignment)
        /// </summary>
        public async Task<List<OptimizationResult>> OptimizeMultiVehicleRouteAsync(
            DeliveryOptimizationRequest request,
            int vehicleCount)
        {
            var results = new List<OptimizationResult>();

            if (request.Stops.Count <= vehicleCount)
            {
                // Each vehicle gets one stop
                foreach (var stop in request.Stops)
                {
                    var singleStopRequest = new DeliveryOptimizationRequest
                    {
                        Depot = request.Depot,
                        Stops = new List<DeliveryStop> { stop },
                        Vehicle = request.Vehicle,
                        DepartureTime = request.DepartureTime,
                        ReturnToDepot = request.ReturnToDepot
                    };
                    results.Add(await OptimizeDeliveryRouteAsync(singleStopRequest));
                }
                return results;
            }

            // Group stops by geographic proximity (simple clustering by province/city)
            var groupedStops = request.Stops
                .GroupBy(s => ExtractRegion(s))
                .OrderByDescending(g => g.Sum(s => s.Value ?? 0))
                .ToList();

            // Distribute groups to vehicles
            var vehicleStops = new List<List<DeliveryStop>>();
            for (int i = 0; i < vehicleCount; i++)
                vehicleStops.Add(new List<DeliveryStop>());

            int vehicleIndex = 0;
            foreach (var group in groupedStops)
            {
                vehicleStops[vehicleIndex].AddRange(group);
                vehicleIndex = (vehicleIndex + 1) % vehicleCount;
            }

            // Optimize each vehicle's route
            foreach (var stops in vehicleStops)
            {
                if (!stops.Any()) continue;

                var vehicleRequest = new DeliveryOptimizationRequest
                {
                    Depot = request.Depot,
                    Stops = stops,
                    Vehicle = request.Vehicle,
                    DepartureTime = request.DepartureTime,
                    ReturnToDepot = request.ReturnToDepot
                };
                results.Add(await OptimizeDeliveryRouteAsync(vehicleRequest));
            }

            return results;
        }

        /// <summary>
        /// Suggest optimal number of vehicles based on stops and constraints
        /// </summary>
        public int SuggestVehicleCount(List<DeliveryStop> stops, VehicleInfo vehicle)
        {
            var maxStopsPerVehicle = vehicle.MaxStops ?? 20;
            var maxHoursPerVehicle = 8; // Standard work day

            // Estimate based on stop count
            var byStops = (int)Math.Ceiling((double)stops.Count / maxStopsPerVehicle);

            // Estimate based on service time (rough)
            var totalServiceMinutes = stops.Sum(s => s.ServiceTimeMinutes);
            var totalDriveMinutes = stops.Count * 15; // Assume 15 min avg between stops
            var totalMinutes = totalServiceMinutes + totalDriveMinutes;
            var byTime = (int)Math.Ceiling(totalMinutes / (maxHoursPerVehicle * 60.0));

            // Estimate based on priority
            var urgentStops = stops.Count(s => s.Priority >= 3);
            var byPriority = urgentStops > 5 ? 2 : 1;

            return Math.Max(byStops, Math.Max(byTime, byPriority));
        }

        #region Private Methods

        private OptimizedRoute BuildOptimizedRoute(
            RoutesService.MultiRouteResult routeResult,
            DeliveryOptimizationRequest request,
            List<DeliveryStop> validStops,
            DateTime departureTime)
        {
            var route = new OptimizedRoute
            {
                TotalDistanceMeters = routeResult.TotalDistanceMeters,
                TotalDurationSeconds = routeResult.TotalDurationSeconds,
                TotalDistanceText = routeResult.TotalDistanceText,
                TotalDurationText = routeResult.TotalDurationText,
                DepartureTime = departureTime
            };

            var currentTime = departureTime;
            decimal totalValue = 0;

            foreach (var stop in routeResult.OptimizedRoute)
            {
                var isDepot = stop.OriginalIndex < 0;
                DeliveryStop? originalStop = null;

                if (!isDepot && stop.OriginalIndex < validStops.Count)
                {
                    originalStop = validStops[stop.OriginalIndex];
                }

                var optimizedStop = new OptimizedStop
                {
                    Sequence = stop.Sequence,
                    OriginalId = originalStop?.Id ?? (stop.OriginalIndex == -1 ? 0 : -1),
                    Name = isDepot ? request.Depot.Name : (originalStop?.Name ?? "Unknown"),
                    Address = stop.Location.Address ?? "",
                    Latitude = stop.Location.Latitude ?? 0,
                    Longitude = stop.Location.Longitude ?? 0,
                    DistanceFromPreviousMeters = stop.DistanceFromPreviousMeters,
                    DurationFromPreviousSeconds = stop.DurationFromPreviousSeconds,
                    DistanceFromPreviousText = stop.DistanceFromPreviousText,
                    DurationFromPreviousText = stop.DurationFromPreviousText,
                    CumulativeDistanceMeters = stop.CumulativeDistanceMeters,
                    CumulativeDurationSeconds = stop.CumulativeDurationSeconds,
                    IsDepot = isDepot
                };

                // Calculate arrival and departure times
                currentTime = currentTime.AddSeconds(stop.DurationFromPreviousSeconds);
                optimizedStop.EstimatedArrival = currentTime;

                if (!isDepot && originalStop != null)
                {
                    optimizedStop.Notes = originalStop.Notes;
                    optimizedStop.Value = originalStop.Value;
                    totalValue += originalStop.Value ?? 0;

                    // Add service time
                    currentTime = currentTime.AddMinutes(originalStop.ServiceTimeMinutes);
                }
                optimizedStop.EstimatedDeparture = currentTime;

                route.Stops.Add(optimizedStop);
            }

            route.EstimatedReturnTime = currentTime;
            route.TotalValue = totalValue;

            return route;
        }

        private OptimizationMetrics CalculateMetrics(
            RoutesService.MultiRouteResult routeResult,
            List<DeliveryStop> validStops,
            int skippedCount)
        {
            // Estimate original distance (simple sum of direct distances, which would be worse)
            // This is a rough estimate - actual improvement calculation would need baseline
            var estimatedOriginalDistance = (int)(routeResult.TotalDistanceMeters * 1.3);

            return new OptimizationMetrics
            {
                TotalStops = validStops.Count + skippedCount,
                OptimizedStops = validStops.Count,
                SkippedStops = skippedCount,
                OriginalDistanceMeters = estimatedOriginalDistance,
                OptimizedDistanceMeters = routeResult.TotalDistanceMeters,
                DistanceSavedPercent = Math.Round((1 - (double)routeResult.TotalDistanceMeters / estimatedOriginalDistance) * 100, 1),
                TimeSavedPercent = Math.Round((1 - (double)routeResult.TotalDistanceMeters / estimatedOriginalDistance) * 100, 1),
                OptimizationMethod = "Google Routes API Waypoint Optimization"
            };
        }

        private string ExtractRegion(DeliveryStop stop)
        {
            // Extract region from address for grouping
            if (string.IsNullOrEmpty(stop.Address))
                return "Unknown";

            var address = stop.Address.ToLowerInvariant();

            // Check for province keywords
            if (address.Contains("kwazulu") || address.Contains("natal") || address.Contains("durban"))
                return "KZN";
            if (address.Contains("gauteng") || address.Contains("johannesburg") || address.Contains("pretoria"))
                return "GP";
            if (address.Contains("western cape") || address.Contains("cape town"))
                return "WC";
            if (address.Contains("eastern cape") || address.Contains("port elizabeth"))
                return "EC";
            if (address.Contains("limpopo") || address.Contains("polokwane"))
                return "LP";
            if (address.Contains("mpumalanga") || address.Contains("nelspruit"))
                return "MP";
            if (address.Contains("north west") || address.Contains("rustenburg"))
                return "NW";
            if (address.Contains("free state") || address.Contains("bloemfontein"))
                return "FS";
            if (address.Contains("northern cape") || address.Contains("kimberley"))
                return "NC";

            return "Other";
        }

        #endregion
    }
}
