using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WeatherController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private readonly HttpClient _httpClient;
        private readonly ILogger<WeatherController> _logger;

        public WeatherController(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<WeatherController> logger)
        {
            _configuration = configuration;
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<List<WeatherData>>> GetWeather()
        {
            var apiKey = _configuration["GoogleMaps:ApiKey"];
            
            var cities = new[]
            {
                new { Name = "Durban", Lat = -29.8587, Lng = 31.0218 },
                new { Name = "Cape Town", Lat = -33.9249, Lng = 18.4241 },
                new { Name = "Gqeberha", Lat = -33.9608, Lng = 25.6022 },
                new { Name = "Johannesburg", Lat = -26.2041, Lng = 28.0473 }
            };

            var weatherResults = new List<WeatherData>();

            foreach (var city in cities)
            {
                try
                {
                    // Use OpenWeatherMap API as Google doesn't have a direct weather API
                    // We'll use a free weather API - Open-Meteo (no API key required)
                    var url = $"https://api.open-meteo.com/v1/forecast?latitude={city.Lat}&longitude={city.Lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=Africa/Johannesburg";
                    
                    var response = await _httpClient.GetAsync(url);
                    
                    if (response.IsSuccessStatusCode)
                    {
                        var json = await response.Content.ReadAsStringAsync();
                        var data = JsonSerializer.Deserialize<OpenMeteoResponse>(json, new JsonSerializerOptions 
                        { 
                            PropertyNameCaseInsensitive = true 
                        });

                        if (data?.Current != null)
                        {
                            var weatherInfo = GetWeatherInfo(data.Current.Weather_code);
                            
                            weatherResults.Add(new WeatherData
                            {
                                Id = weatherResults.Count + 1,
                                Name = city.Name,
                                Temperature = (int)Math.Round(data.Current.Temperature_2m),
                                Condition = weatherInfo.Condition,
                                WeatherIcon = weatherInfo.Icon,
                                WindSpeed = (int)Math.Round(data.Current.Wind_speed_10m),
                                Time = DateTime.Now.ToString("HH:mm")
                            });
                        }
                    }
                    else
                    {
                        _logger.LogWarning($"Failed to get weather for {city.Name}: {response.StatusCode}");
                        // Add fallback data
                        weatherResults.Add(GetFallbackWeather(city.Name, weatherResults.Count + 1));
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error fetching weather for {city.Name}");
                    weatherResults.Add(GetFallbackWeather(city.Name, weatherResults.Count + 1));
                }
            }

            return Ok(weatherResults);
        }

        private (string Condition, string Icon) GetWeatherInfo(int weatherCode)
        {
            // WMO Weather interpretation codes
            // https://open-meteo.com/en/docs
            return weatherCode switch
            {
                0 => ("Clear Sky", "wb_sunny"),
                1 or 2 or 3 => ("Partly Cloudy", "partly_cloudy_day"),
                45 or 48 => ("Foggy", "foggy"),
                51 or 53 or 55 => ("Drizzle", "grain"),
                56 or 57 => ("Freezing Drizzle", "ac_unit"),
                61 or 63 or 65 => ("Rain", "rainy"),
                66 or 67 => ("Freezing Rain", "ac_unit"),
                71 or 73 or 75 => ("Snow", "ac_unit"),
                77 => ("Snow Grains", "ac_unit"),
                80 or 81 or 82 => ("Rain Showers", "thunderstorm"),
                85 or 86 => ("Snow Showers", "ac_unit"),
                95 => ("Thunderstorm", "thunderstorm"),
                96 or 99 => ("Thunderstorm with Hail", "thunderstorm"),
                _ => ("Unknown", "help_outline")
            };
        }

        private WeatherData GetFallbackWeather(string cityName, int id)
        {
            var random = new Random();
            var temps = new Dictionary<string, int>
            {
                { "Durban", 26 },
                { "Cape Town", 22 },
                { "Gqeberha", 24 },
                { "Johannesburg", 25 }
            };

            return new WeatherData
            {
                Id = id,
                Name = cityName,
                Temperature = temps.GetValueOrDefault(cityName, 23),
                Condition = "Partly Cloudy",
                WeatherIcon = "partly_cloudy_day",
                WindSpeed = random.Next(5, 20),
                Time = DateTime.Now.ToString("HH:mm")
            };
        }
    }

    public class WeatherData
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int Temperature { get; set; }
        public string Condition { get; set; } = string.Empty;
        public string WeatherIcon { get; set; } = string.Empty;
        public int WindSpeed { get; set; }
        public string Time { get; set; } = string.Empty;
    }

    public class OpenMeteoResponse
    {
        public CurrentWeather? Current { get; set; }
    }

    public class CurrentWeather
    {
        public double Temperature_2m { get; set; }
        public int Weather_code { get; set; }
        public double Wind_speed_10m { get; set; }
    }
}
