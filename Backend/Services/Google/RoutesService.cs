using System.Text;
using System.Text.Json;

namespace ProjectTracker.API.Services.Google
{
    /// <summary>
    /// Routes Service using Google Routes API
    /// Provides route calculation, distance matrix, and ETA computation
    /// </summary>
    public class RoutesService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<RoutesService> _logger;

        public RoutesService(IHttpClientFactory httpClientFactory, ILogger<RoutesService> logger)
        {
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;
        }

        #region DTOs

        public class RouteRequest
        {
            public Location Origin { get; set; } = new();
            public Location Destination { get; set; } = new();
            public List<Location> Waypoints { get; set; } = new();
            public TravelMode TravelMode { get; set; } = TravelMode.Drive;
            public bool OptimizeWaypoints { get; set; } = true;
            public DateTime? DepartureTime { get; set; }
            public bool AvoidTolls { get; set; } = false;
            public bool AvoidHighways { get; set; } = false;
        }

        public class Location
        {
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
            public string? Address { get; set; }
            public string? PlaceId { get; set; }
            public string? Label { get; set; } // For display purposes
            public int? ReferenceId { get; set; } // For linking back to stops/customers
        }

        public enum TravelMode
        {
            Drive,
            Walk,
            Bicycle,
            TwoWheeler
        }

        public class RouteResult
        {
            public bool Success { get; set; }
            public string? Error { get; set; }
            public int DistanceMeters { get; set; }
            public int DurationSeconds { get; set; }
            public string DistanceText { get; set; } = "";
            public string DurationText { get; set; } = "";
            public string? EncodedPolyline { get; set; }
            public List<RouteLeg> Legs { get; set; } = new();
            public List<int>? OptimizedWaypointOrder { get; set; }
            public DateTime? EstimatedArrival { get; set; }
            public List<RouteWarning> Warnings { get; set; } = new();
        }

        public class RouteLeg
        {
            public int LegIndex { get; set; }
            public Location StartLocation { get; set; } = new();
            public Location EndLocation { get; set; } = new();
            public int DistanceMeters { get; set; }
            public int DurationSeconds { get; set; }
            public string DistanceText { get; set; } = "";
            public string DurationText { get; set; } = "";
            public DateTime? EstimatedArrival { get; set; }
        }

        public class RouteWarning
        {
            public string Type { get; set; } = "";
            public string Message { get; set; } = "";
        }

        public class DistanceMatrixResult
        {
            public bool Success { get; set; }
            public string? Error { get; set; }
            public List<DistanceMatrixRow> Rows { get; set; } = new();
        }

        public class DistanceMatrixRow
        {
            public int OriginIndex { get; set; }
            public Location Origin { get; set; } = new();
            public List<DistanceMatrixElement> Elements { get; set; } = new();
        }

        public class DistanceMatrixElement
        {
            public int DestinationIndex { get; set; }
            public Location Destination { get; set; } = new();
            public bool Success { get; set; }
            public int DistanceMeters { get; set; }
            public int DurationSeconds { get; set; }
            public string DistanceText { get; set; } = "";
            public string DurationText { get; set; } = "";
            public string? Error { get; set; }
        }

        public class MultiRouteResult
        {
            public bool Success { get; set; }
            public string? Error { get; set; }
            public int TotalDistanceMeters { get; set; }
            public int TotalDurationSeconds { get; set; }
            public string TotalDistanceText { get; set; } = "";
            public string TotalDurationText { get; set; } = "";
            public List<RouteStop> OptimizedRoute { get; set; } = new();
            public List<int> OriginalToOptimizedMapping { get; set; } = new();
        }

        public class RouteStop
        {
            public int Sequence { get; set; }
            public int OriginalIndex { get; set; }
            public Location Location { get; set; } = new();
            public int DistanceFromPreviousMeters { get; set; }
            public int DurationFromPreviousSeconds { get; set; }
            public int CumulativeDistanceMeters { get; set; }
            public int CumulativeDurationSeconds { get; set; }
            public DateTime? EstimatedArrival { get; set; }
            public string DistanceFromPreviousText { get; set; } = "";
            public string DurationFromPreviousText { get; set; } = "";
        }

        #endregion

        /// <summary>
        /// Calculate a route between origin and destination with optional waypoints
        /// </summary>
        public async Task<RouteResult> ComputeRouteAsync(RouteRequest request)
        {
            try
            {
                var requestBody = BuildRouteRequest(request);
                var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions 
                { 
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
                });

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                var httpRequest = new HttpRequestMessage(HttpMethod.Post, GoogleMapsConfig.RoutesApiUrl)
                {
                    Content = content
                };
                httpRequest.Headers.Add("X-Goog-Api-Key", GoogleMapsConfig.ApiKey);
                httpRequest.Headers.Add("X-Goog-FieldMask", 
                    "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.optimizedIntermediateWaypointIndex,routes.warnings");

                var response = await _httpClient.SendAsync(httpRequest);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Routes API error: {StatusCode} - {Error}", response.StatusCode, errorBody);
                    return new RouteResult { Success = false, Error = $"API error: {response.StatusCode}" };
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                return ParseRouteResponse(responseJson, request);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error computing route");
                return new RouteResult { Success = false, Error = ex.Message };
            }
        }

        /// <summary>
        /// Compute distance matrix between multiple origins and destinations
        /// </summary>
        public async Task<DistanceMatrixResult> ComputeDistanceMatrixAsync(
            List<Location> origins, 
            List<Location> destinations,
            TravelMode travelMode = TravelMode.Drive)
        {
            try
            {
                var requestBody = new
                {
                    origins = origins.Select(o => BuildWaypoint(o)).ToList(),
                    destinations = destinations.Select(d => BuildWaypoint(d)).ToList(),
                    travelMode = travelMode.ToString().ToUpperInvariant(),
                    routingPreference = "TRAFFIC_AWARE"
                };

                var json = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions 
                { 
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase 
                });

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                
                var httpRequest = new HttpRequestMessage(HttpMethod.Post, GoogleMapsConfig.DistanceMatrixApiUrl)
                {
                    Content = content
                };
                httpRequest.Headers.Add("X-Goog-Api-Key", GoogleMapsConfig.ApiKey);
                httpRequest.Headers.Add("X-Goog-FieldMask", "originIndex,destinationIndex,duration,distanceMeters,status,condition");

                var response = await _httpClient.SendAsync(httpRequest);

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Distance Matrix API error: {StatusCode} - {Error}", response.StatusCode, errorBody);
                    return new DistanceMatrixResult { Success = false, Error = $"API error: {response.StatusCode}" };
                }

                var responseJson = await response.Content.ReadAsStringAsync();
                return ParseDistanceMatrixResponse(responseJson, origins, destinations);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error computing distance matrix");
                return new DistanceMatrixResult { Success = false, Error = ex.Message };
            }
        }

        /// <summary>
        /// Optimize a multi-stop route for minimum travel time
        /// </summary>
        public async Task<MultiRouteResult> OptimizeRouteAsync(
            Location origin, 
            List<Location> stops, 
            Location? destination = null,
            DateTime? departureTime = null)
        {
            try
            {
                // If no explicit destination, return to origin
                destination ??= origin;

                var request = new RouteRequest
                {
                    Origin = origin,
                    Destination = destination,
                    Waypoints = stops,
                    OptimizeWaypoints = true,
                    DepartureTime = departureTime
                };

                var routeResult = await ComputeRouteAsync(request);

                if (!routeResult.Success)
                {
                    return new MultiRouteResult { Success = false, Error = routeResult.Error };
                }

                var result = new MultiRouteResult
                {
                    Success = true,
                    TotalDistanceMeters = routeResult.DistanceMeters,
                    TotalDurationSeconds = routeResult.DurationSeconds,
                    TotalDistanceText = routeResult.DistanceText,
                    TotalDurationText = routeResult.DurationText,
                    OriginalToOptimizedMapping = routeResult.OptimizedWaypointOrder ?? 
                        Enumerable.Range(0, stops.Count).ToList()
                };

                // Build optimized route stops
                var currentTime = departureTime ?? DateTime.Now;
                var cumulativeDistance = 0;
                var cumulativeDuration = 0;
                var sequence = 0;

                // Add origin
                result.OptimizedRoute.Add(new RouteStop
                {
                    Sequence = sequence++,
                    OriginalIndex = -1,
                    Location = origin,
                    EstimatedArrival = currentTime
                });

                // Add waypoints in optimized order
                var optimizedOrder = routeResult.OptimizedWaypointOrder ?? 
                    Enumerable.Range(0, stops.Count).ToList();

                for (int i = 0; i < optimizedOrder.Count; i++)
                {
                    var originalIndex = optimizedOrder[i];
                    var leg = routeResult.Legs.Count > i ? routeResult.Legs[i] : null;

                    cumulativeDistance += leg?.DistanceMeters ?? 0;
                    cumulativeDuration += leg?.DurationSeconds ?? 0;
                    currentTime = currentTime.AddSeconds(leg?.DurationSeconds ?? 0);

                    result.OptimizedRoute.Add(new RouteStop
                    {
                        Sequence = sequence++,
                        OriginalIndex = originalIndex,
                        Location = stops[originalIndex],
                        DistanceFromPreviousMeters = leg?.DistanceMeters ?? 0,
                        DurationFromPreviousSeconds = leg?.DurationSeconds ?? 0,
                        DistanceFromPreviousText = leg?.DistanceText ?? "",
                        DurationFromPreviousText = leg?.DurationText ?? "",
                        CumulativeDistanceMeters = cumulativeDistance,
                        CumulativeDurationSeconds = cumulativeDuration,
                        EstimatedArrival = currentTime
                    });
                }

                // Add destination if different from origin
                if (destination != origin && routeResult.Legs.Any())
                {
                    var lastLeg = routeResult.Legs.LastOrDefault();
                    cumulativeDistance += lastLeg?.DistanceMeters ?? 0;
                    cumulativeDuration += lastLeg?.DurationSeconds ?? 0;
                    currentTime = currentTime.AddSeconds(lastLeg?.DurationSeconds ?? 0);

                    result.OptimizedRoute.Add(new RouteStop
                    {
                        Sequence = sequence,
                        OriginalIndex = -2,
                        Location = destination,
                        DistanceFromPreviousMeters = lastLeg?.DistanceMeters ?? 0,
                        DurationFromPreviousSeconds = lastLeg?.DurationSeconds ?? 0,
                        CumulativeDistanceMeters = cumulativeDistance,
                        CumulativeDurationSeconds = cumulativeDuration,
                        EstimatedArrival = currentTime
                    });
                }

                _logger.LogInformation("Route optimized: {Stops} stops, {Distance} km, {Duration}", 
                    stops.Count, result.TotalDistanceMeters / 1000.0, result.TotalDurationText);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error optimizing route");
                return new MultiRouteResult { Success = false, Error = ex.Message };
            }
        }

        /// <summary>
        /// Get quick distance and duration between two points
        /// </summary>
        public async Task<(int distanceMeters, int durationSeconds, string? error)> GetDistanceAsync(
            Location origin, 
            Location destination)
        {
            var result = await ComputeRouteAsync(new RouteRequest
            {
                Origin = origin,
                Destination = destination,
                OptimizeWaypoints = false
            });

            if (!result.Success)
                return (0, 0, result.Error);

            return (result.DistanceMeters, result.DurationSeconds, null);
        }

        #region Private Methods

        private object BuildRouteRequest(RouteRequest request)
        {
            // Build intermediates with correct format for Routes API
            var waypoints = request.Waypoints
                .Select(w => BuildWaypoint(w))
                .ToList();

            var routeModifiers = new Dictionary<string, bool>();
            if (request.AvoidTolls) routeModifiers["avoidTolls"] = true;
            if (request.AvoidHighways) routeModifiers["avoidHighways"] = true;

            var body = new Dictionary<string, object>
            {
                ["origin"] = BuildWaypoint(request.Origin),
                ["destination"] = BuildWaypoint(request.Destination),
                ["travelMode"] = request.TravelMode.ToString().ToUpperInvariant(),
                ["routingPreference"] = "TRAFFIC_AWARE",
                ["computeAlternativeRoutes"] = false,
                ["languageCode"] = "en"
            };

            if (waypoints.Any())
            {
                body["intermediates"] = waypoints;
            }

            if (request.OptimizeWaypoints && waypoints.Any())
            {
                body["optimizeWaypointOrder"] = true;
            }

            // Only include departureTime if it's in the future
            if (request.DepartureTime.HasValue && request.DepartureTime.Value > DateTime.UtcNow)
            {
                body["departureTime"] = request.DepartureTime.Value.ToUniversalTime()
                    .ToString("yyyy-MM-ddTHH:mm:ssZ");
            }

            if (routeModifiers.Any())
            {
                body["routeModifiers"] = routeModifiers;
            }

            return body;
        }

        private object BuildWaypoint(Location location)
        {
            if (!string.IsNullOrEmpty(location.PlaceId))
            {
                return new { placeId = location.PlaceId };
            }
            
            if (location.Latitude.HasValue && location.Longitude.HasValue)
            {
                return new
                {
                    location = new
                    {
                        latLng = new
                        {
                            latitude = location.Latitude.Value,
                            longitude = location.Longitude.Value
                        }
                    }
                };
            }
            
            if (!string.IsNullOrEmpty(location.Address))
            {
                return new
                {
                    address = location.Address
                };
            }

            throw new ArgumentException("Location must have coordinates, placeId, or address");
        }

        private RouteResult ParseRouteResponse(string json, RouteRequest request)
        {
            var result = new RouteResult { Success = true };

            try
            {
                var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (!root.TryGetProperty("routes", out var routes) || routes.GetArrayLength() == 0)
                {
                    result.Success = false;
                    result.Error = "No routes found";
                    return result;
                }

                var route = routes[0];

                // Distance and duration
                if (route.TryGetProperty("distanceMeters", out var dist))
                {
                    result.DistanceMeters = dist.GetInt32();
                    result.DistanceText = FormatDistance(result.DistanceMeters);
                }

                if (route.TryGetProperty("duration", out var dur))
                {
                    var durationStr = dur.GetString() ?? "0s";
                    result.DurationSeconds = ParseDuration(durationStr);
                    result.DurationText = FormatDuration(result.DurationSeconds);
                }

                // Polyline
                if (route.TryGetProperty("polyline", out var polyline))
                {
                    if (polyline.TryGetProperty("encodedPolyline", out var encoded))
                        result.EncodedPolyline = encoded.GetString();
                }

                // Optimized waypoint order
                if (route.TryGetProperty("optimizedIntermediateWaypointIndex", out var optimizedOrder))
                {
                    result.OptimizedWaypointOrder = optimizedOrder.EnumerateArray()
                        .Select(i => i.GetInt32())
                        .ToList();
                }

                // Legs
                if (route.TryGetProperty("legs", out var legs))
                {
                    int legIndex = 0;
                    foreach (var leg in legs.EnumerateArray())
                    {
                        var routeLeg = new RouteLeg { LegIndex = legIndex++ };

                        if (leg.TryGetProperty("distanceMeters", out var legDist))
                        {
                            routeLeg.DistanceMeters = legDist.GetInt32();
                            routeLeg.DistanceText = FormatDistance(routeLeg.DistanceMeters);
                        }

                        if (leg.TryGetProperty("duration", out var legDur))
                        {
                            routeLeg.DurationSeconds = ParseDuration(legDur.GetString() ?? "0s");
                            routeLeg.DurationText = FormatDuration(routeLeg.DurationSeconds);
                        }

                        result.Legs.Add(routeLeg);
                    }
                }

                // Warnings
                if (route.TryGetProperty("warnings", out var warnings))
                {
                    foreach (var warning in warnings.EnumerateArray())
                    {
                        result.Warnings.Add(new RouteWarning
                        {
                            Type = "ROUTE_WARNING",
                            Message = warning.GetString() ?? ""
                        });
                    }
                }

                // Calculate ETA
                if (request.DepartureTime.HasValue)
                {
                    result.EstimatedArrival = request.DepartureTime.Value.AddSeconds(result.DurationSeconds);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing route response");
                result.Success = false;
                result.Error = "Error parsing response";
            }

            return result;
        }

        private DistanceMatrixResult ParseDistanceMatrixResponse(
            string json, 
            List<Location> origins, 
            List<Location> destinations)
        {
            var result = new DistanceMatrixResult { Success = true };

            try
            {
                var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                // Initialize rows
                for (int i = 0; i < origins.Count; i++)
                {
                    result.Rows.Add(new DistanceMatrixRow
                    {
                        OriginIndex = i,
                        Origin = origins[i],
                        Elements = new List<DistanceMatrixElement>()
                    });
                }

                // Parse elements
                foreach (var element in root.EnumerateArray())
                {
                    var originIndex = element.TryGetProperty("originIndex", out var oi) ? oi.GetInt32() : 0;
                    var destIndex = element.TryGetProperty("destinationIndex", out var di) ? di.GetInt32() : 0;

                    var matrixElement = new DistanceMatrixElement
                    {
                        DestinationIndex = destIndex,
                        Destination = destIndex < destinations.Count ? destinations[destIndex] : new Location()
                    };

                    if (element.TryGetProperty("condition", out var condition))
                    {
                        var condStr = condition.GetString();
                        matrixElement.Success = condStr == "ROUTE_EXISTS";
                        if (!matrixElement.Success)
                            matrixElement.Error = condStr;
                    }
                    else
                    {
                        matrixElement.Success = true;
                    }

                    if (element.TryGetProperty("distanceMeters", out var dist))
                    {
                        matrixElement.DistanceMeters = dist.GetInt32();
                        matrixElement.DistanceText = FormatDistance(matrixElement.DistanceMeters);
                    }

                    if (element.TryGetProperty("duration", out var dur))
                    {
                        matrixElement.DurationSeconds = ParseDuration(dur.GetString() ?? "0s");
                        matrixElement.DurationText = FormatDuration(matrixElement.DurationSeconds);
                    }

                    if (originIndex < result.Rows.Count)
                    {
                        result.Rows[originIndex].Elements.Add(matrixElement);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error parsing distance matrix response");
                result.Success = false;
                result.Error = "Error parsing response";
            }

            return result;
        }

        private int ParseDuration(string duration)
        {
            // Format: "123s" or "1234.5s"
            if (string.IsNullOrEmpty(duration)) return 0;
            
            duration = duration.TrimEnd('s');
            if (double.TryParse(duration, out var seconds))
                return (int)seconds;
            
            return 0;
        }

        private string FormatDistance(int meters)
        {
            if (meters < 1000)
                return $"{meters} m";
            return $"{meters / 1000.0:F1} km";
        }

        private string FormatDuration(int seconds)
        {
            if (seconds < 60)
                return $"{seconds} sec";
            if (seconds < 3600)
                return $"{seconds / 60} min";
            
            var hours = seconds / 3600;
            var mins = (seconds % 3600) / 60;
            return mins > 0 ? $"{hours} hr {mins} min" : $"{hours} hr";
        }

        #endregion
    }
}
