namespace ProjectTracker.API.Services.Google
{
    /// <summary>
    /// Configuration class for Google Maps API services
    /// </summary>
    public static class GoogleMapsConfig
    {
        public const string ApiKey = "AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k";
        
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
