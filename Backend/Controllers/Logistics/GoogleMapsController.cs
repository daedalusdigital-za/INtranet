using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services.Google;
using System.Text.Json;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class GoogleMapsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<GoogleMapsController> _logger;
        private readonly GeocodingService _geocodingService;
        private readonly AddressValidationService _addressValidationService;
        private readonly RoutesService _routesService;
        private readonly RouteOptimizationService _routeOptimizationService;

        public GoogleMapsController(
            ApplicationDbContext context,
            ILogger<GoogleMapsController> logger,
            GeocodingService geocodingService,
            AddressValidationService addressValidationService,
            RoutesService routesService,
            RouteOptimizationService routeOptimizationService)
        {
            _context = context;
            _logger = logger;
            _geocodingService = geocodingService;
            _addressValidationService = addressValidationService;
            _routesService = routesService;
            _routeOptimizationService = routeOptimizationService;
        }

        #region Geocoding Endpoints

        /// <summary>
        /// Geocode an address to get coordinates and structured components
        /// </summary>
        [HttpGet("geocode")]
        public async Task<IActionResult> GeocodeAddress([FromQuery] string address)
        {
            if (string.IsNullOrWhiteSpace(address))
                return BadRequest(new { error = "Address is required" });

            var result = await _geocodingService.GeocodeAddressAsync(address);
            return Ok(result);
        }

        /// <summary>
        /// Reverse geocode coordinates to get address
        /// </summary>
        [HttpGet("reverse-geocode")]
        public async Task<IActionResult> ReverseGeocode([FromQuery] double latitude, [FromQuery] double longitude)
        {
            var result = await _geocodingService.ReverseGeocodeAsync(latitude, longitude);
            return Ok(result);
        }

        /// <summary>
        /// Geocode and update a specific customer's address
        /// </summary>
        [HttpPost("geocode-customer/{customerId}")]
        public async Task<IActionResult> GeocodeCustomer(int customerId, [FromQuery] bool updateDatabase = false)
        {
            var customer = await _context.LogisticsCustomers.FindAsync(customerId);
            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            // Build search query from customer data
            var addressParts = new List<string>();
            
            if (!string.IsNullOrEmpty(customer.AddressLinesJson))
            {
                try
                {
                    var lines = JsonSerializer.Deserialize<List<string>>(customer.AddressLinesJson);
                    if (lines != null) addressParts.AddRange(lines);
                }
                catch { }
            }

            if (!string.IsNullOrEmpty(customer.PhysicalAddress))
                addressParts.Add(customer.PhysicalAddress);
            
            addressParts.Add("South Africa");

            var searchQuery = string.Join(", ", addressParts.Where(p => !string.IsNullOrWhiteSpace(p)).Distinct());

            if (string.IsNullOrWhiteSpace(searchQuery))
                return BadRequest(new { error = "Customer has no address data to geocode" });

            var result = await _geocodingService.GeocodeAddressAsync(searchQuery);

            if (result.Success && updateDatabase)
            {
                customer.Province = result.Province;
                customer.City = result.City;
                customer.PostalCode = result.PostalCode;
                customer.Latitude = result.Latitude;
                customer.Longitude = result.Longitude;
                customer.DeliveryProvince = result.Province;
                customer.DeliveryCity = result.City;
                customer.DeliveryPostalCode = result.PostalCode;
                customer.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                customerId,
                customerName = customer.Name,
                searchQuery,
                result,
                databaseUpdated = result.Success && updateDatabase
            });
        }

        /// <summary>
        /// Batch geocode customers missing province/city data
        /// </summary>
        [HttpPost("geocode-customers")]
        public async Task<IActionResult> BatchGeocodeCustomers(
            [FromQuery] int limit = 50,
            [FromQuery] bool updateDatabase = false)
        {
            var customers = await _context.LogisticsCustomers
                .Where(c => c.Province == null || c.Province == "" || c.City == null || c.City == "")
                .Take(limit)
                .ToListAsync();

            var results = new List<object>();
            int updated = 0, failed = 0;

            foreach (var customer in customers)
            {
                // Build search query
                var addressParts = new List<string>();
                
                if (!string.IsNullOrEmpty(customer.AddressLinesJson))
                {
                    try
                    {
                        var lines = JsonSerializer.Deserialize<List<string>>(customer.AddressLinesJson);
                        if (lines != null) addressParts.AddRange(lines);
                    }
                    catch { }
                }

                if (!string.IsNullOrEmpty(customer.PhysicalAddress))
                    addressParts.Add(customer.PhysicalAddress);
                
                if (!string.IsNullOrEmpty(customer.Name))
                    addressParts.Add(customer.Name);
                    
                addressParts.Add("South Africa");

                var searchQuery = string.Join(", ", addressParts.Where(p => !string.IsNullOrWhiteSpace(p)).Distinct());

                if (string.IsNullOrWhiteSpace(searchQuery) || searchQuery == "South Africa")
                {
                    results.Add(new { customerId = customer.Id, success = false, error = "No address data" });
                    failed++;
                    continue;
                }

                var geocodeResult = await _geocodingService.GeocodeAddressAsync(searchQuery);

                if (geocodeResult.Success)
                {
                    if (updateDatabase)
                    {
                        customer.Province = geocodeResult.Province;
                        customer.City = geocodeResult.City;
                        customer.PostalCode = geocodeResult.PostalCode;
                        customer.Latitude = geocodeResult.Latitude;
                        customer.Longitude = geocodeResult.Longitude;
                        customer.DeliveryProvince = geocodeResult.Province;
                        customer.DeliveryCity = geocodeResult.City;
                        customer.DeliveryPostalCode = geocodeResult.PostalCode;
                        customer.UpdatedAt = DateTime.UtcNow;
                    }

                    results.Add(new
                    {
                        customerId = customer.Id,
                        customerCode = customer.CustomerCode,
                        success = true,
                        province = geocodeResult.Province,
                        city = geocodeResult.City,
                        formattedAddress = geocodeResult.FormattedAddress
                    });
                    updated++;
                }
                else
                {
                    results.Add(new
                    {
                        customerId = customer.Id,
                        customerCode = customer.CustomerCode,
                        success = false,
                        error = geocodeResult.Error
                    });
                    failed++;
                }

                // Rate limiting
                await Task.Delay(100);
            }

            if (updateDatabase)
            {
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                totalProcessed = customers.Count,
                updated,
                failed,
                databaseUpdated = updateDatabase,
                results
            });
        }

        /// <summary>
        /// Deep geocode customers by searching their name as a place/business
        /// Useful for customers where address data is incomplete but name is recognizable
        /// </summary>
        [HttpPost("geocode-by-name")]
        public async Task<IActionResult> GeocodeCustomersByName(
            [FromQuery] int limit = 50,
            [FromQuery] bool updateDatabase = false,
            [FromQuery] bool onlyMissingProvince = true)
        {
            var query = _context.LogisticsCustomers.AsQueryable();
            
            if (onlyMissingProvince)
            {
                query = query.Where(c => c.Province == null || c.Province == "");
            }
            
            var customers = await query.Take(limit).ToListAsync();

            var results = new List<object>();
            int updated = 0, failed = 0, skipped = 0;

            foreach (var customer in customers)
            {
                if (string.IsNullOrWhiteSpace(customer.Name))
                {
                    results.Add(new { customerId = customer.Id, customerCode = customer.CustomerCode, success = false, error = "No name" });
                    skipped++;
                    continue;
                }

                // Try multiple search strategies
                GeocodingService.GeocodingResult? bestResult = null;
                string? successfulQuery = null;

                // Build list of search queries to try
                var searchQueries = new List<string>();
                
                // Strategy 1: Name + any existing address info + South Africa
                var addressParts = new List<string> { customer.Name };
                if (!string.IsNullOrEmpty(customer.City)) addressParts.Add(customer.City);
                if (!string.IsNullOrEmpty(customer.Address)) addressParts.Add(customer.Address);
                addressParts.Add("South Africa");
                searchQueries.Add(string.Join(", ", addressParts));

                // Strategy 2: Just name + South Africa
                searchQueries.Add($"{customer.Name}, South Africa");

                // Strategy 3: Clean up name (remove PTY LTD, CC, etc.) + South Africa  
                var cleanName = CleanCompanyName(customer.Name);
                if (cleanName != customer.Name)
                {
                    searchQueries.Add($"{cleanName}, South Africa");
                }

                // Strategy 4: For SAPS, hospitals, etc. - add institution type hints
                if (customer.Name.Contains("SAPS", StringComparison.OrdinalIgnoreCase) || 
                    customer.CustomerCode?.StartsWith("SAP") == true)
                {
                    var stationName = customer.Name.Replace("SAPS", "").Replace("SUPPLY CHAIN", "").Trim();
                    searchQueries.Add($"SAPS Police Station {stationName}, South Africa");
                    searchQueries.Add($"{stationName} Police Station, South Africa");
                }
                
                if (customer.Name.Contains("HOSPITAL", StringComparison.OrdinalIgnoreCase))
                {
                    searchQueries.Add($"{customer.Name} Hospital, South Africa");
                }
                
                if (customer.Name.Contains("CORRECTIONAL", StringComparison.OrdinalIgnoreCase) ||
                    customer.CustomerCode?.StartsWith("DCS") == true)
                {
                    var prisonName = customer.Name.Replace("CORRECTIONAL SERVICE", "").Trim();
                    searchQueries.Add($"{prisonName} Correctional Centre, South Africa");
                    searchQueries.Add($"{prisonName} Prison, South Africa");
                }

                // Strategy 5: If address contains country hints (Namibia, Eswatini, Botswana)
                var fullText = $"{customer.Address} {customer.City} {customer.Name}".ToUpper();
                if (fullText.Contains("NAMIBIA"))
                {
                    searchQueries.Add($"{customer.Name}, Windhoek, Namibia");
                    searchQueries.Add($"{customer.Name}, Namibia");
                }
                if (fullText.Contains("ESWATINI") || fullText.Contains("SWAZILAND"))
                {
                    searchQueries.Add($"{customer.Name}, Mbabane, Eswatini");
                    searchQueries.Add($"{customer.Name}, Eswatini");
                }
                if (fullText.Contains("BOTSWANA") || fullText.Contains("GABORONE"))
                {
                    searchQueries.Add($"{customer.Name}, Gaborone, Botswana");
                    searchQueries.Add($"{customer.Name}, Botswana");
                }

                // Remove duplicates
                searchQueries = searchQueries.Distinct().ToList();

                // Try each search query until we get a result with province
                foreach (var searchQuery in searchQueries)
                {
                    try
                    {
                        var geocodeResult = await _geocodingService.GeocodeAddressAsync(searchQuery);
                        
                        if (geocodeResult.Success && !string.IsNullOrEmpty(geocodeResult.Province))
                        {
                            bestResult = geocodeResult;
                            successfulQuery = searchQuery;
                            break; // Found a good result with province
                        }
                        else if (geocodeResult.Success && bestResult == null)
                        {
                            // Keep this as a fallback if we don't find anything with province
                            bestResult = geocodeResult;
                            successfulQuery = searchQuery;
                        }
                        
                        // Rate limiting between queries
                        await Task.Delay(100);
                    }
                    catch
                    {
                        // Continue to next query
                    }
                }

                if (bestResult != null && bestResult.Success)
                {
                    if (updateDatabase)
                    {
                        if (!string.IsNullOrEmpty(bestResult.Province))
                            customer.Province = bestResult.Province;
                        if (!string.IsNullOrEmpty(bestResult.City))
                            customer.City = bestResult.City;
                        if (!string.IsNullOrEmpty(bestResult.PostalCode))
                            customer.PostalCode = bestResult.PostalCode;
                        customer.Latitude = bestResult.Latitude;
                        customer.Longitude = bestResult.Longitude;
                        if (!string.IsNullOrEmpty(bestResult.Province))
                            customer.DeliveryProvince = bestResult.Province;
                        if (!string.IsNullOrEmpty(bestResult.City))
                            customer.DeliveryCity = bestResult.City;
                        if (!string.IsNullOrEmpty(bestResult.PostalCode))
                            customer.DeliveryPostalCode = bestResult.PostalCode;
                        customer.UpdatedAt = DateTime.UtcNow;
                    }

                    results.Add(new
                    {
                        customerId = customer.Id,
                        customerCode = customer.CustomerCode,
                        customerName = customer.Name,
                        success = true,
                        province = bestResult.Province,
                        city = bestResult.City,
                        formattedAddress = bestResult.FormattedAddress,
                        searchQuery = successfulQuery,
                        queriesAttempted = searchQueries.Count
                    });
                    updated++;
                }
                else
                {
                    results.Add(new
                    {
                        customerId = customer.Id,
                        customerCode = customer.CustomerCode,
                        customerName = customer.Name,
                        success = false,
                        error = "Could not geocode with any strategy",
                        queriesAttempted = searchQueries
                    });
                    failed++;
                }

                // Rate limiting between customers
                await Task.Delay(150);
            }

            if (updateDatabase)
            {
                await _context.SaveChangesAsync();
            }

            return Ok(new
            {
                totalProcessed = customers.Count,
                updated,
                failed,
                skipped,
                databaseUpdated = updateDatabase,
                results
            });
        }

        private static string CleanCompanyName(string name)
        {
            if (string.IsNullOrEmpty(name)) return name;
            
            var cleaned = name
                .Replace("(PTY) LTD", "", StringComparison.OrdinalIgnoreCase)
                .Replace("PTY LTD", "", StringComparison.OrdinalIgnoreCase)
                .Replace("(PTY)", "", StringComparison.OrdinalIgnoreCase)
                .Replace("PTY", "", StringComparison.OrdinalIgnoreCase)
                .Replace("LTD", "", StringComparison.OrdinalIgnoreCase)
                .Replace("CC", "", StringComparison.OrdinalIgnoreCase)
                .Replace("**MISSING DESCRIPTION**", "", StringComparison.OrdinalIgnoreCase)
                .Trim();
            
            // Remove trailing punctuation
            cleaned = cleaned.TrimEnd(',', '.', '-', ' ');
            
            return cleaned;
        }

        #endregion

        #region Address Validation Endpoints

        /// <summary>
        /// Validate a single address
        /// </summary>
        [HttpPost("validate-address")]
        public async Task<IActionResult> ValidateAddress([FromBody] AddressValidationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Address) && string.IsNullOrWhiteSpace(request.AddressLine1))
                return BadRequest(new { error = "Address is required" });

            if (!string.IsNullOrWhiteSpace(request.Address))
            {
                var result = await _addressValidationService.ValidateAddressStringAsync(request.Address);
                return Ok(result);
            }
            else
            {
                var input = new AddressValidationService.AddressInput
                {
                    AddressLine1 = request.AddressLine1,
                    AddressLine2 = request.AddressLine2,
                    City = request.City,
                    Province = request.Province,
                    PostalCode = request.PostalCode,
                    Country = request.Country ?? "ZA"
                };
                var result = await _addressValidationService.ValidateAddressAsync(input);
                return Ok(result);
            }
        }

        /// <summary>
        /// Check if an address is deliverable
        /// </summary>
        [HttpGet("is-deliverable")]
        public async Task<IActionResult> IsDeliverable([FromQuery] string address)
        {
            if (string.IsNullOrWhiteSpace(address))
                return BadRequest(new { error = "Address is required" });

            var (isDeliverable, issue) = await _addressValidationService.IsDeliverableAsync(address);
            return Ok(new { isDeliverable, issue });
        }

        #endregion

        #region Route Calculation Endpoints

        /// <summary>
        /// Calculate route between two points
        /// </summary>
        [HttpPost("calculate-route")]
        public async Task<IActionResult> CalculateRoute([FromBody] RouteCalculationRequest request)
        {
            if (request.Origin == null || request.Destination == null)
                return BadRequest(new { error = "Origin and destination are required" });

            var routeRequest = new RoutesService.RouteRequest
            {
                Origin = MapLocation(request.Origin),
                Destination = MapLocation(request.Destination),
                Waypoints = request.Waypoints?.Select(MapLocation).ToList() ?? new List<RoutesService.Location>(),
                OptimizeWaypoints = request.OptimizeWaypoints,
                DepartureTime = request.DepartureTime,
                AvoidTolls = request.AvoidTolls,
                AvoidHighways = request.AvoidHighways
            };

            var result = await _routesService.ComputeRouteAsync(routeRequest);
            return Ok(result);
        }

        /// <summary>
        /// Calculate distance matrix between multiple points
        /// </summary>
        [HttpPost("distance-matrix")]
        public async Task<IActionResult> CalculateDistanceMatrix([FromBody] DistanceMatrixRequest request)
        {
            if (request.Origins == null || !request.Origins.Any())
                return BadRequest(new { error = "Origins are required" });
            if (request.Destinations == null || !request.Destinations.Any())
                return BadRequest(new { error = "Destinations are required" });

            var origins = request.Origins.Select(MapLocation).ToList();
            var destinations = request.Destinations.Select(MapLocation).ToList();

            var result = await _routesService.ComputeDistanceMatrixAsync(origins, destinations);
            return Ok(result);
        }

        /// <summary>
        /// Get quick distance between two points
        /// </summary>
        [HttpGet("distance")]
        public async Task<IActionResult> GetDistance(
            [FromQuery] string originAddress,
            [FromQuery] string destinationAddress)
        {
            if (string.IsNullOrWhiteSpace(originAddress) || string.IsNullOrWhiteSpace(destinationAddress))
                return BadRequest(new { error = "Origin and destination addresses are required" });

            var origin = new RoutesService.Location { Address = originAddress };
            var destination = new RoutesService.Location { Address = destinationAddress };

            var (distanceMeters, durationSeconds, error) = await _routesService.GetDistanceAsync(origin, destination);

            if (error != null)
                return Ok(new { success = false, error });

            return Ok(new
            {
                success = true,
                distanceMeters,
                distanceKm = Math.Round(distanceMeters / 1000.0, 2),
                durationSeconds,
                durationMinutes = Math.Round(durationSeconds / 60.0, 1),
                durationText = FormatDuration(durationSeconds)
            });
        }

        #endregion

        #region Route Optimization Endpoints

        /// <summary>
        /// Optimize delivery route for a load
        /// </summary>
        [HttpPost("optimize-load/{loadId}")]
        public async Task<IActionResult> OptimizeLoadRoute(int loadId, [FromQuery] DateTime? departureTime = null)
        {
            var load = await _context.Loads
                .Include(l => l.Warehouse)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Customer)
                .FirstOrDefaultAsync(l => l.Id == loadId);

            if (load == null)
                return NotFound(new { error = "Load not found" });

            if (!load.Stops.Any())
                return BadRequest(new { error = "Load has no stops to optimize" });

            // Get warehouse as depot
            var depot = new RouteOptimizationService.DepotLocation
            {
                Name = load.Warehouse?.Name ?? "Warehouse",
                Address = load.Warehouse?.Address ?? load.PickupLocation ?? "Durban, South Africa"
            };

            // Geocode depot if needed
            var depotGeocode = await _geocodingService.GeocodeAddressAsync(depot.Address);
            if (depotGeocode.Success)
            {
                depot.Latitude = depotGeocode.Latitude ?? 0;
                depot.Longitude = depotGeocode.Longitude ?? 0;
            }

            // Build delivery stops
            var stops = new List<RouteOptimizationService.DeliveryStop>();
            foreach (var stop in load.Stops)
            {
                var address = stop.Address ?? stop.Customer?.DeliveryAddress ?? stop.Customer?.PhysicalAddress;
                if (string.IsNullOrEmpty(address)) continue;

                var deliveryStop = new RouteOptimizationService.DeliveryStop
                {
                    Id = stop.Id,
                    Name = stop.CompanyName ?? stop.Customer?.Name ?? $"Stop {stop.StopSequence}",
                    Address = address,
                    ServiceTimeMinutes = 15,
                    Notes = stop.Notes
                };

                // Try to get coordinates
                var stopGeocode = await _geocodingService.GeocodeAddressAsync(address + ", South Africa");
                if (stopGeocode.Success)
                {
                    deliveryStop.Latitude = stopGeocode.Latitude;
                    deliveryStop.Longitude = stopGeocode.Longitude;
                }

                stops.Add(deliveryStop);
            }

            if (!stops.Any())
                return BadRequest(new { error = "No valid stops with addresses found" });

            var request = new RouteOptimizationService.DeliveryOptimizationRequest
            {
                Depot = depot,
                Stops = stops,
                DepartureTime = departureTime ?? DateTime.Now.AddHours(1),
                ReturnToDepot = true
            };

            var result = await _routeOptimizationService.OptimizeDeliveryRouteAsync(request);

            return Ok(result);
        }

        /// <summary>
        /// Optimize route for selected invoices (create optimized tripsheet)
        /// </summary>
        [HttpPost("optimize-invoices")]
        public async Task<IActionResult> OptimizeInvoiceDeliveries([FromBody] OptimizeInvoicesRequest request)
        {
            if (request.InvoiceIds == null || !request.InvoiceIds.Any())
                return BadRequest(new { error = "Invoice IDs are required" });

            var invoices = await _context.ImportedInvoices
                .Include(i => i.Customer)
                .Where(i => request.InvoiceIds.Contains(i.Id))
                .ToListAsync();

            if (!invoices.Any())
                return NotFound(new { error = "No invoices found" });

            // Get warehouse as depot (use first active warehouse)
            var warehouse = await _context.Warehouses
                .Where(w => w.Status == "Active")
                .FirstOrDefaultAsync();

            var depot = new RouteOptimizationService.DepotLocation
            {
                Name = warehouse?.Name ?? "Main Warehouse",
                Address = warehouse?.Address ?? request.DepotAddress ?? "Durban, South Africa"
            };

            // Geocode depot
            var depotGeocode = await _geocodingService.GeocodeAddressAsync(depot.Address);
            if (depotGeocode.Success)
            {
                depot.Latitude = depotGeocode.Latitude ?? 0;
                depot.Longitude = depotGeocode.Longitude ?? 0;
            }

            // Group invoices by customer and build stops
            var customerGroups = invoices.GroupBy(i => i.CustomerNumber).ToList();
            var stops = new List<RouteOptimizationService.DeliveryStop>();

            foreach (var group in customerGroups)
            {
                var firstInvoice = group.First();
                var customer = firstInvoice.Customer;
                
                var address = firstInvoice.DeliveryAddress 
                           ?? customer?.DeliveryAddress 
                           ?? customer?.PhysicalAddress
                           ?? firstInvoice.CustomerName;

                if (string.IsNullOrEmpty(address)) continue;

                var deliveryStop = new RouteOptimizationService.DeliveryStop
                {
                    Id = customer?.Id ?? firstInvoice.Id,
                    Name = firstInvoice.CustomerName ?? customer?.Name ?? "Unknown",
                    Address = address,
                    ServiceTimeMinutes = 10 + (group.Count() * 2), // Base + 2 min per invoice
                    Value = group.Sum(i => i.SalesAmount - i.SalesReturns),
                    Priority = group.Max(i => i.SalesAmount) > 50000 ? 2 : 1,
                    Notes = $"{group.Count()} invoice(s): {string.Join(", ", group.Select(i => i.TransactionNumber).Take(5))}"
                };

                // Try to get coordinates
                if (customer?.Latitude.HasValue == true && customer?.Longitude.HasValue == true)
                {
                    deliveryStop.Latitude = customer.Latitude;
                    deliveryStop.Longitude = customer.Longitude;
                }
                else
                {
                    var stopGeocode = await _geocodingService.GeocodeAddressAsync(address + ", South Africa");
                    if (stopGeocode.Success)
                    {
                        deliveryStop.Latitude = stopGeocode.Latitude;
                        deliveryStop.Longitude = stopGeocode.Longitude;
                    }
                }

                stops.Add(deliveryStop);
            }

            if (!stops.Any())
                return BadRequest(new { error = "No valid delivery addresses found" });

            // Ensure departure time is in the future
            var departureTime = request.DepartureTime;
            if (!departureTime.HasValue || departureTime.Value <= DateTime.UtcNow)
            {
                // Default to tomorrow 7 AM or 1 hour from now, whichever is later
                var tomorrow7am = DateTime.UtcNow.Date.AddDays(1).AddHours(7);
                var oneHourFromNow = DateTime.UtcNow.AddHours(1);
                departureTime = tomorrow7am > oneHourFromNow ? tomorrow7am : oneHourFromNow;
            }

            var optimizationRequest = new RouteOptimizationService.DeliveryOptimizationRequest
            {
                Depot = depot,
                Stops = stops,
                DepartureTime = departureTime,
                ReturnToDepot = true
            };

            var result = await _routeOptimizationService.OptimizeDeliveryRouteAsync(optimizationRequest);

            // Add invoice details to the response
            if (result.Success)
            {
                return Ok(new
                {
                    success = true,
                    optimization = result,
                    invoiceSummary = new
                    {
                        totalInvoices = invoices.Count,
                        totalValue = invoices.Sum(i => i.SalesAmount - i.SalesReturns),
                        uniqueCustomers = customerGroups.Count,
                        invoiceNumbers = invoices.Select(i => i.TransactionNumber).ToList()
                    }
                });
            }

            return Ok(result);
        }

        /// <summary>
        /// Get suggested optimized loads from pending invoices
        /// </summary>
        [HttpGet("suggest-optimized-loads")]
        public async Task<IActionResult> SuggestOptimizedLoads(
            [FromQuery] string? province = null,
            [FromQuery] int maxLoads = 5)
        {
            var query = _context.ImportedInvoices
                .Include(i => i.Customer)
                .Where(i => i.LoadId == null && i.Status == "Pending");

            if (!string.IsNullOrEmpty(province))
            {
                query = query.Where(i => 
                    (i.DeliveryProvince ?? i.Customer.Province ?? "").Contains(province));
            }

            var invoices = await query.ToListAsync();

            if (!invoices.Any())
                return Ok(new { message = "No pending invoices found", loads = new List<object>() });

            // Group by province and city
            var groups = invoices
                .GroupBy(i => new 
                { 
                    Province = i.DeliveryProvince ?? i.Customer?.Province ?? "Unknown",
                    City = i.DeliveryCity ?? i.Customer?.City ?? "Unknown"
                })
                .OrderByDescending(g => g.Sum(i => i.SalesAmount - i.SalesReturns))
                .Take(maxLoads)
                .ToList();

            var suggestions = new List<object>();

            foreach (var group in groups)
            {
                var groupInvoices = group.ToList();
                var customers = groupInvoices
                    .GroupBy(i => i.CustomerNumber)
                    .Select(cg => new
                    {
                        customerNumber = cg.Key,
                        customerName = cg.First().CustomerName,
                        invoiceCount = cg.Count(),
                        totalValue = cg.Sum(i => i.SalesAmount - i.SalesReturns)
                    })
                    .ToList();

                suggestions.Add(new
                {
                    province = group.Key.Province,
                    city = group.Key.City,
                    totalInvoices = groupInvoices.Count,
                    totalValue = groupInvoices.Sum(i => i.SalesAmount - i.SalesReturns),
                    uniqueCustomers = customers.Count,
                    estimatedStops = customers.Count,
                    invoiceIds = groupInvoices.Select(i => i.Id).ToList(),
                    customers
                });
            }

            return Ok(new
            {
                totalPendingInvoices = invoices.Count,
                suggestedLoads = suggestions
            });
        }

        #endregion

        #region Helper Methods

        private RoutesService.Location MapLocation(LocationDto dto)
        {
            return new RoutesService.Location
            {
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                Address = dto.Address,
                PlaceId = dto.PlaceId,
                Label = dto.Label
            };
        }

        private string FormatDuration(int seconds)
        {
            if (seconds < 60) return $"{seconds} sec";
            if (seconds < 3600) return $"{seconds / 60} min";
            var hours = seconds / 3600;
            var mins = (seconds % 3600) / 60;
            return mins > 0 ? $"{hours} hr {mins} min" : $"{hours} hr";
        }

        #endregion

        #region Request DTOs

        public class AddressValidationRequest
        {
            public string? Address { get; set; }
            public string? AddressLine1 { get; set; }
            public string? AddressLine2 { get; set; }
            public string? City { get; set; }
            public string? Province { get; set; }
            public string? PostalCode { get; set; }
            public string? Country { get; set; }
        }

        public class LocationDto
        {
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
            public string? Address { get; set; }
            public string? PlaceId { get; set; }
            public string? Label { get; set; }
        }

        public class RouteCalculationRequest
        {
            public LocationDto Origin { get; set; } = new();
            public LocationDto Destination { get; set; } = new();
            public List<LocationDto>? Waypoints { get; set; }
            public bool OptimizeWaypoints { get; set; } = true;
            public DateTime? DepartureTime { get; set; }
            public bool AvoidTolls { get; set; }
            public bool AvoidHighways { get; set; }
        }

        public class DistanceMatrixRequest
        {
            public List<LocationDto> Origins { get; set; } = new();
            public List<LocationDto> Destinations { get; set; } = new();
        }

        public class OptimizeInvoicesRequest
        {
            public List<int> InvoiceIds { get; set; } = new();
            public string? DepotAddress { get; set; }
            public DateTime? DepartureTime { get; set; }
        }

        #endregion
    }
}
