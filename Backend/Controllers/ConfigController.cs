using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services.Google;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Client-side configuration that must not be baked into the public frontend bundle.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ConfigController : ControllerBase
    {
        // GET: api/config/google-maps-key
        // The Maps JavaScript API needs the key in the browser, so it can never be fully
        // secret — serving it only to signed-in users keeps it off the public login page
        // and out of the JS bundle. Restrict the key by HTTP referrer in Google Cloud.
        [HttpGet("google-maps-key")]
        public IActionResult GetGoogleMapsKey()
        {
            var key = GoogleMapsConfig.ApiKey;
            if (string.IsNullOrWhiteSpace(key))
                return NotFound(new { message = "Google Maps API key is not configured." });

            return Ok(new { apiKey = key });
        }
    }
}
