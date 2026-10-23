namespace ProjectTracker.API.Services.Google
{
    /// <summary>
    /// Configuration class for Google Maps API services
    /// </summary>
    public static class GoogleMapsConfig
    {
        /// <summary>Built-in fallback key (used until an admin saves one under Admin Settings → Client Locations).</summary>
        public const string DefaultApiKey = "AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k";

        private static string? _override;

        /// <summary>
        /// Effective Google Maps API key. Resolved from the SystemSettings table at startup
        /// (and whenever an admin updates it) with the built-in key as fallback.
        /// </summary>
        public static string ApiKey => string.IsNullOrWhiteSpace(_override) ? DefaultApiKey : _override!;

        public static bool IsOverridden => !string.IsNullOrWhiteSpace(_override);

        public static void SetApiKey(string? key) => _override = string.IsNullOrWhiteSpace(key) ? null : key.Trim();
        
        // API Endpoints
        public const string GeocodingApiUrl = "https://maps.googleapis.com/maps/api/geocode/json";
        public const string AddressValidationApiUrl = "https://addressvalidation.googleapis.com/v1:validateAddress";
        public const string RoutesApiUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";
        public const string RouteOptimizationApiUrl = "https://routeoptimization.googleapis.com/v1/projects";
        public const string DistanceMatrixApiUrl = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";
        
        // Project ID for Route Optimization API
        public const string ProjectId = "your-google-cloud-project-id"; // Update this with your actual project ID
        
        // Default settings
        public const string DefaultRegionCode = "ZA"; // South Africa
        public const string DefaultLanguage = "en";
        
        // Rate limiting (requests per second)
        public const int MaxRequestsPerSecond = 10;
        
        // Retry settings
        public const int MaxRetries = 3;
        public const int RetryDelayMs = 1000;
    }
}
