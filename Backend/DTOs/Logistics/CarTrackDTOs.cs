namespace ProjectTracker.API.DTOs.Logistics
{
    // CarTrack Integration DTOs
    public class VehicleLocationDto
    {
        public string VehicleId { get; set; } = string.Empty;
        public string? VehicleName { get; set; }
        public int? LocalVehicleId { get; set; }
        public string? RegistrationNumber { get; set; }
        public string? CurrentDriverName { get; set; }
        public LocationDto? Location { get; set; }
        public double Speed { get; set; }
        public double Heading { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? LastUpdate { get; set; }
    }

    public class LocationDto
    {
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? Address { get; set; }
        public DateTime Updated { get; set; }
    }

    public class CarTrackVehicleDto
    {
        public string VehicleId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? RegistrationNumber { get; set; }
        public string? Make { get; set; }
        public string? Model { get; set; }
        public LocationDto? CurrentLocation { get; set; }
        public double? Speed { get; set; }
        public double? Heading { get; set; }
        public DateTime? LastUpdate { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class FleetStatusDto
    {
        public int TotalVehicles { get; set; }
        public int VehiclesMoving { get; set; }
        public int VehiclesStopped { get; set; }
        public int VehiclesIdling { get; set; }
        public int VehiclesOffline { get; set; }
        public int MovingCount => VehiclesMoving;
        public int StationaryCount => VehiclesStopped + VehiclesIdling;
        public List<VehicleLocationDto> Vehicles { get; set; } = new();
        public DateTime LastUpdate { get; set; }
    }

    public class TripTrackingDto
    {
        public int LoadId { get; set; }
        public string LoadNumber { get; set; } = string.Empty;
        public int VehicleId { get; set; }
        public string VehicleRegistration { get; set; } = string.Empty;
        public string? DriverName { get; set; }
        public VehicleLocationDto? CurrentLocation { get; set; }
        public List<LoadStopDto> Stops { get; set; } = new();
        public LoadStopDto? NextStop { get; set; }
        public double? DistanceToNextStop { get; set; }
        public TimeSpan? EtaToNextStop { get; set; }
        public string TripStatus { get; set; } = string.Empty;
    }

    public class VehicleTypeDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal? MaxLoadWeight { get; set; }
        public decimal? MaxLoadVolume { get; set; }
        public string? FuelType { get; set; }
    }

    public class CreateVehicleTypeDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal? MaxLoadWeight { get; set; }
        public decimal? MaxLoadVolume { get; set; }
        public string? FuelType { get; set; }
    }

    // Vision API DTOs
    public class LivestreamRequestDto
    {
        public int[]? Cameras { get; set; }
    }

    public class LivestreamResponseDto
    {
        public string VehicleRegistration { get; set; } = string.Empty;
        public List<LivestreamUrlDto> Streams { get; set; } = new();
        public string? Error { get; set; }
        public string? ErrorCode { get; set; }
    }

    public class LivestreamUrlDto
    {
        public int CameraId { get; set; }
        public string CameraName { get; set; } = string.Empty;
        public string StreamUrl { get; set; } = string.Empty;
        public string? ThumbnailUrl { get; set; }
    }

    public class VisionVehicleDto
    {
        public string VehicleId { get; set; } = string.Empty;
        public string Registration { get; set; } = string.Empty;
        public string? VehicleName { get; set; }
        public bool HasVision { get; set; }
        public List<int> AvailableCameras { get; set; } = new();
    }
}
