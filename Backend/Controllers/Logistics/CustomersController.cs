using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;
using System.Globalization;
using System.Text.Json;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/customers")]
    public class CustomersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CustomersController> _logger;
        private readonly CustomerAddressCleanupService _cleanupService;

        public CustomersController(
            ApplicationDbContext context, 
            ILogger<CustomersController> logger,
            CustomerAddressCleanupService cleanupService)
        {
            _context = context;
            _logger = logger;
            _cleanupService = cleanupService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<CustomerDto>>> GetCustomers(
            [FromQuery] string? status,
            [FromQuery] string? search,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _context.LogisticsCustomers.AsQueryable();

            if (!string.IsNullOrEmpty(status))
                query = query.Where(c => c.Status == status);

            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(c =>
                    c.Name.ToLower().Contains(searchLower) ||
                    (c.CustomerCode != null && c.CustomerCode.ToLower().Contains(searchLower)) ||
                    (c.ShortName != null && c.ShortName.ToLower().Contains(searchLower)) ||
                    (c.Email != null && c.Email.ToLower().Contains(searchLower)) ||
                    (c.ContactPerson != null && c.ContactPerson.ToLower().Contains(searchLower)));
            }

            var totalCount = await query.CountAsync();

            var customers = await query
                .OrderBy(c => c.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => MapToCustomerDto(c))
                .ToListAsync();

            Response.Headers.Append("X-Total-Count", totalCount.ToString());
            Response.Headers.Append("X-Page", page.ToString());
            Response.Headers.Append("X-Page-Size", pageSize.ToString());

            return Ok(customers);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CustomerDto>> GetCustomer(int id)
        {
            var customer = await _context.LogisticsCustomers
                .Where(c => c.Id == id)
                .Select(c => MapToCustomerDto(c))
                .FirstOrDefaultAsync();

            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            return Ok(customer);
        }

        [HttpGet("by-code/{customerCode}")]
        public async Task<ActionResult<CustomerDto>> GetCustomerByCode(string customerCode)
        {
            var customer = await _context.LogisticsCustomers
                .Where(c => c.CustomerCode == customerCode)
                .Select(c => MapToCustomerDto(c))
                .FirstOrDefaultAsync();

            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            return Ok(customer);
        }

        [HttpPost]
        public async Task<ActionResult<CustomerDto>> CreateCustomer(CreateCustomerDto dto)
        {
            // Check for duplicate customer code
            if (!string.IsNullOrEmpty(dto.CustomerCode))
            {
                var existing = await _context.LogisticsCustomers
                    .AnyAsync(c => c.CustomerCode == dto.CustomerCode);
                if (existing)
                    return BadRequest(new { error = $"Customer with code {dto.CustomerCode} already exists" });
            }

            var customer = new Customer
            {
                CustomerCode = dto.CustomerCode,
                Name = dto.Name,
                ShortName = dto.ShortName,
                CompanyRegistration = dto.CompanyRegistration,
                VatNumber = dto.VatNumber,
                ContactPerson = dto.ContactPerson,
                Email = dto.Email,
                ContactEmail = dto.ContactEmail,
                PhoneNumber = dto.PhoneNumber,
                MobileNumber = dto.MobileNumber,
                Fax = dto.Fax,
                ContactPhone = dto.ContactPhone,
                ContactFax = dto.ContactFax,
                PhysicalAddress = dto.PhysicalAddress,
                PostalAddress = dto.PostalAddress,
                City = dto.City,
                PostalCode = dto.PostalCode,
                Province = dto.Province,
                Country = dto.Country ?? "South Africa",
                AddressLinesJson = dto.AddressLines != null ? JsonSerializer.Serialize(dto.AddressLines) : null,
                PaymentTerms = dto.PaymentTerms,
                CreditLimit = dto.CreditLimit,
                Status = "Active",
                CreatedAt = DateTime.UtcNow
            };

            // Build address from address lines if provided
            if (dto.AddressLines != null && dto.AddressLines.Any())
            {
                customer.Address = string.Join(", ", dto.AddressLines);
                customer.PhysicalAddress ??= customer.Address;
                customer.DeliveryAddress ??= customer.Address;
            }

            _context.LogisticsCustomers.Add(customer);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created customer {CustomerCode} - {Name}", customer.CustomerCode, customer.Name);

            return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id },
                await GetCustomerDtoById(customer.Id));
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<CustomerDto>> UpdateCustomer(int id, CreateCustomerDto dto)
        {
            var customer = await _context.LogisticsCustomers.FindAsync(id);
            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            // Check for duplicate customer code (excluding current)
            if (!string.IsNullOrEmpty(dto.CustomerCode) && dto.CustomerCode != customer.CustomerCode)
            {
                var existing = await _context.LogisticsCustomers
                    .AnyAsync(c => c.CustomerCode == dto.CustomerCode && c.Id != id);
                if (existing)
                    return BadRequest(new { error = $"Customer with code {dto.CustomerCode} already exists" });
            }

            customer.CustomerCode = dto.CustomerCode ?? customer.CustomerCode;
            customer.Name = dto.Name;
            customer.ShortName = dto.ShortName ?? customer.ShortName;
            customer.CompanyRegistration = dto.CompanyRegistration ?? customer.CompanyRegistration;
            customer.VatNumber = dto.VatNumber ?? customer.VatNumber;
            customer.ContactPerson = dto.ContactPerson ?? customer.ContactPerson;
            customer.Email = dto.Email ?? customer.Email;
            customer.ContactEmail = dto.ContactEmail ?? customer.ContactEmail;
            customer.PhoneNumber = dto.PhoneNumber ?? customer.PhoneNumber;
            customer.MobileNumber = dto.MobileNumber ?? customer.MobileNumber;
            customer.Fax = dto.Fax ?? customer.Fax;
            customer.ContactPhone = dto.ContactPhone ?? customer.ContactPhone;
            customer.ContactFax = dto.ContactFax ?? customer.ContactFax;
            customer.PhysicalAddress = dto.PhysicalAddress ?? customer.PhysicalAddress;
            customer.PostalAddress = dto.PostalAddress ?? customer.PostalAddress;
            customer.City = dto.City ?? customer.City;
            customer.PostalCode = dto.PostalCode ?? customer.PostalCode;
            customer.Province = dto.Province ?? customer.Province;
            customer.Country = dto.Country ?? customer.Country;
            customer.PaymentTerms = dto.PaymentTerms ?? customer.PaymentTerms;
            customer.CreditLimit = dto.CreditLimit ?? customer.CreditLimit;
            customer.UpdatedAt = DateTime.UtcNow;

            if (dto.AddressLines != null)
            {
                customer.AddressLinesJson = JsonSerializer.Serialize(dto.AddressLines);
                customer.Address = string.Join(", ", dto.AddressLines);
            }

            await _context.SaveChangesAsync();

            return Ok(await GetCustomerDtoById(id));
        }

        /// <summary>
        /// Import a single customer from ERP
        /// </summary>
        [HttpPost("import")]
        public async Task<ActionResult<CustomerDto>> ImportSingleCustomer([FromBody] ImportCustomerDto dto)
        {
            try
            {
                var batchId = Guid.NewGuid().ToString("N")[..12].ToUpper();
                var (customer, isNew) = await ImportOrUpdateCustomer(dto, batchId, null);

                await _context.SaveChangesAsync();

                _logger.LogInformation("{Action} customer {CustomerCode} - {Name}",
                    isNew ? "Imported" : "Updated", customer.CustomerCode, customer.Name);

                return isNew
                    ? CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, await GetCustomerDtoById(customer.Id))
                    : Ok(await GetCustomerDtoById(customer.Id));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing customer {CustomerNumber}", dto.CustomerNumber);
                return BadRequest(new { error = "Failed to import customer", details = ex.Message });
            }
        }

        /// <summary>
        /// Bulk import multiple customers from ERP
        /// </summary>
        [HttpPost("import/bulk")]
        public async Task<ActionResult<CustomerImportResultDto>> BulkImportCustomers([FromBody] BulkImportCustomersDto dto)
        {
            var batchId = Guid.NewGuid().ToString("N")[..12].ToUpper();
            var result = new CustomerImportResultDto
            {
                BatchId = batchId,
                TotalRecords = dto.Customers.Count
            };

            foreach (var customerDto in dto.Customers)
            {
                try
                {
                    var (customer, isNew) = await ImportOrUpdateCustomer(customerDto, batchId, dto.SourceSystem);

                    if (isNew)
                        result.CreatedRecords++;
                    else
                        result.UpdatedRecords++;
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"Failed to import customer {customerDto.CustomerNumber}: {ex.Message}");
                    result.FailedRecords++;
                }
            }

            await _context.SaveChangesAsync();

            result.Success = result.FailedRecords == 0 || (result.CreatedRecords + result.UpdatedRecords) > 0;

            _logger.LogInformation("Bulk customer import completed. Batch: {BatchId}, Created: {Created}, Updated: {Updated}, Failed: {Failed}",
                batchId, result.CreatedRecords, result.UpdatedRecords, result.FailedRecords);

            return Ok(result);
        }

        /// <summary>
        /// Get customer summary statistics
        /// </summary>
        [HttpGet("summary")]
        public async Task<ActionResult<CustomerSummaryDto>> GetSummary()
        {
            var summary = await _context.LogisticsCustomers
                .GroupBy(c => 1)
                .Select(g => new CustomerSummaryDto
                {
                    TotalCustomers = g.Count(),
                    ActiveCustomers = g.Count(c => c.Status == "Active"),
                    InactiveCustomers = g.Count(c => c.Status != "Active"),
                    CustomersWithEmail = g.Count(c => c.Email != null),
                    CustomersWithPhone = g.Count(c => c.PhoneNumber != null),
                    CustomersFromERP = g.Count(c => c.SourceSystem != null)
                })
                .FirstOrDefaultAsync();

            return Ok(summary ?? new CustomerSummaryDto());
        }

        /// <summary>
        /// Delete a customer
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCustomer(int id)
        {
            var customer = await _context.LogisticsCustomers.FindAsync(id);
            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            // Check if customer has loads
            var hasLoads = await _context.Loads.AnyAsync(l => l.CustomerId == id);
            if (hasLoads)
                return BadRequest(new { error = "Cannot delete customer with existing loads" });

            // Check if customer has invoices
            var hasInvoices = await _context.Invoices.AnyAsync(i => i.CustomerId == id);
            if (hasInvoices)
                return BadRequest(new { error = "Cannot delete customer with existing invoices" });

            _context.LogisticsCustomers.Remove(customer);
            await _context.SaveChangesAsync();

            return Ok(new { success = true, message = "Customer deleted successfully" });
        }

        /// <summary>
        /// Update customer status
        /// </summary>
        [HttpPatch("{id}/status")]
        public async Task<ActionResult<CustomerDto>> UpdateStatus(int id, [FromBody] string status)
        {
            var customer = await _context.LogisticsCustomers.FindAsync(id);
            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            customer.Status = status;
            customer.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(await GetCustomerDtoById(id));
        }

        // Contracts
        [HttpGet("{customerId}/contracts")]
        public async Task<ActionResult<IEnumerable<CustomerContractDto>>> GetCustomerContracts(int customerId)
        {
            var contracts = await _context.CustomerContracts
                .Include(c => c.Customer)
                .Where(c => c.CustomerId == customerId)
                .Select(c => new CustomerContractDto
                {
                    Id = c.Id,
                    ContractNumber = c.ContractNumber,
                    CustomerId = c.CustomerId,
                    CustomerName = c.Customer.Name,
                    ContractName = c.ContractName,
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    Status = c.Status,
                    MonthlyValue = c.MonthlyValue,
                    TotalValue = c.TotalValue,
                    BillingFrequency = c.BillingFrequency,
                    RatePerKm = c.RatePerKm,
                    RatePerLoad = c.RatePerLoad,
                    MinimumCharge = c.MinimumCharge,
                    Terms = c.Terms,
                    DocumentUrl = c.DocumentUrl,
                    SignedBy = c.SignedBy,
                    SignedDate = c.SignedDate
                })
                .ToListAsync();

            return Ok(contracts);
        }

        [HttpPost("contracts")]
        public async Task<ActionResult<CustomerContractDto>> CreateContract(CreateCustomerContractDto dto)
        {
            // Generate contract number
            var lastContract = await _context.CustomerContracts.OrderByDescending(c => c.Id).FirstOrDefaultAsync();
            var contractNumber = $"CT{DateTime.Now:yyyyMMdd}{(lastContract?.Id ?? 0) + 1:D4}";

            var contract = new CustomerContract
            {
                ContractNumber = contractNumber,
                CustomerId = dto.CustomerId,
                ContractName = dto.ContractName,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                MonthlyValue = dto.MonthlyValue,
                TotalValue = dto.TotalValue,
                BillingFrequency = dto.BillingFrequency,
                RatePerKm = dto.RatePerKm,
                RatePerLoad = dto.RatePerLoad,
                MinimumCharge = dto.MinimumCharge,
                Terms = dto.Terms,
                DocumentUrl = dto.DocumentUrl,
                Status = "Draft"
            };

            _context.CustomerContracts.Add(contract);
            await _context.SaveChangesAsync();

            return Ok(contract);
        }

        #region Helper Methods

        private async Task<(Customer customer, bool isNew)> ImportOrUpdateCustomer(
            ImportCustomerDto dto, string batchId, string? sourceSystem)
        {
            // Try to find existing customer by CustomerCode
            var customer = await _context.LogisticsCustomers
                .FirstOrDefaultAsync(c => c.CustomerCode == dto.CustomerNumber);

            bool isNew = customer == null;

            if (isNew)
            {
                customer = new Customer
                {
                    CustomerCode = dto.CustomerNumber,
                    CreatedAt = DateTime.UtcNow
                };
                _context.LogisticsCustomers.Add(customer);
            }

            // Map ERP fields to customer
            customer!.Name = dto.Description;
            customer.ShortName = dto.ShortName;
            customer.Email = dto.Email;
            customer.ContactEmail = dto.ContactEmail;
            customer.PhoneNumber = dto.Phone;
            customer.Fax = dto.Fax;
            customer.ContactPerson = dto.Contact;
            customer.ContactPhone = dto.ContactPhone;
            customer.ContactFax = dto.ContactFax;
            customer.VatNumber = dto.VatNo;
            customer.ImportBatchId = batchId;
            customer.SourceSystem = sourceSystem;
            customer.UpdatedAt = DateTime.UtcNow;

            // Parse LastMaintained date
            if (!string.IsNullOrEmpty(dto.LastMaintained))
            {
                if (DateTime.TryParse(dto.LastMaintained, out var lastMaintained))
                    customer.LastMaintained = lastMaintained;
                else if (DateTime.TryParseExact(dto.LastMaintained, new[] { "yyyy-MM-dd", "dd/MM/yyyy" },
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out lastMaintained))
                    customer.LastMaintained = lastMaintained;
            }

            // Handle address lines
            if (dto.AddressLines != null && dto.AddressLines.Any())
            {
                customer.AddressLinesJson = JsonSerializer.Serialize(dto.AddressLines);
                customer.Address = string.Join(", ", dto.AddressLines);
                customer.PhysicalAddress = customer.Address;
                customer.DeliveryAddress = customer.Address;

                // Try to extract city from last address line
                if (dto.AddressLines.Count >= 1)
                {
                    customer.City = dto.AddressLines.Last();
                }
            }

            return (customer, isNew);
        }

        private static CustomerDto MapToCustomerDto(Customer c)
        {
            List<string>? addressLines = null;
            if (!string.IsNullOrEmpty(c.AddressLinesJson))
            {
                try
                {
                    addressLines = JsonSerializer.Deserialize<List<string>>(c.AddressLinesJson);
                }
                catch { }
            }

            return new CustomerDto
            {
                Id = c.Id,
                CustomerCode = c.CustomerCode,
                Name = c.Name,
                ShortName = c.ShortName,
                CompanyRegistration = c.CompanyRegistration,
                VatNumber = c.VatNumber,
                ContactPerson = c.ContactPerson,
                Email = c.Email,
                ContactEmail = c.ContactEmail,
                PhoneNumber = c.PhoneNumber,
                MobileNumber = c.MobileNumber,
                Fax = c.Fax,
                ContactPhone = c.ContactPhone,
                ContactFax = c.ContactFax,
                Address = c.Address,
                PhysicalAddress = c.PhysicalAddress,
                PostalAddress = c.PostalAddress,
                City = c.City,
                PostalCode = c.PostalCode,
                Province = c.Province,
                Country = c.Country,
                AddressLines = addressLines,
                DeliveryAddress = c.DeliveryAddress,
                DeliveryCity = c.DeliveryCity,
                DeliveryProvince = c.DeliveryProvince,
                DeliveryPostalCode = c.DeliveryPostalCode,
                Status = c.Status,
                PaymentTerms = c.PaymentTerms,
                CreditLimit = c.CreditLimit,
                LastMaintained = c.LastMaintained,
                SourceSystem = c.SourceSystem,
                Latitude = c.Latitude,
                Longitude = c.Longitude,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            };
        }

        private async Task<CustomerDto?> GetCustomerDtoById(int id)
        {
            return await _context.LogisticsCustomers
                .Where(c => c.Id == id)
                .Select(c => MapToCustomerDto(c))
                .FirstOrDefaultAsync();
        }

        #endregion

        #region Customer Delivery Addresses

        /// <summary>
        /// Get all delivery addresses for a customer
        /// </summary>
        [HttpGet("{customerId}/delivery-addresses")]
        public async Task<ActionResult<IEnumerable<CustomerDeliveryAddressDto>>> GetDeliveryAddresses(int customerId)
        {
            var addresses = await _context.CustomerDeliveryAddresses
                .Where(a => a.CustomerId == customerId && a.IsActive)
                .OrderByDescending(a => a.IsDefault)
                .ThenByDescending(a => a.UsageCount)
                .ThenByDescending(a => a.LastUsedAt)
                .Select(a => new CustomerDeliveryAddressDto
                {
                    Id = a.Id,
                    CustomerId = a.CustomerId,
                    CustomerName = a.Customer != null ? a.Customer.Name : null,
                    AddressLabel = a.AddressLabel,
                    Address = a.Address,
                    City = a.City,
                    Province = a.Province,
                    PostalCode = a.PostalCode,
                    Country = a.Country,
                    ContactPerson = a.ContactPerson,
                    ContactPhone = a.ContactPhone,
                    Latitude = a.Latitude,
                    Longitude = a.Longitude,
                    GooglePlaceId = a.GooglePlaceId,
                    FormattedAddress = a.FormattedAddress,
                    IsDefault = a.IsDefault,
                    IsActive = a.IsActive,
                    DeliveryInstructions = a.DeliveryInstructions,
                    UsageCount = a.UsageCount,
                    LastUsedAt = a.LastUsedAt,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(addresses);
        }

        /// <summary>
        /// Get delivery addresses for multiple customers (for batch loading in tripsheet creation)
        /// </summary>
        [HttpGet("delivery-addresses/batch")]
        public async Task<ActionResult<Dictionary<int, List<CustomerDeliveryAddressDto>>>> GetDeliveryAddressesBatch(
            [FromQuery] List<int> customerIds)
        {
            if (customerIds == null || !customerIds.Any())
                return Ok(new Dictionary<int, List<CustomerDeliveryAddressDto>>());

            var addresses = await _context.CustomerDeliveryAddresses
                .Where(a => customerIds.Contains(a.CustomerId) && a.IsActive)
                .OrderByDescending(a => a.IsDefault)
                .ThenByDescending(a => a.UsageCount)
                .Select(a => new CustomerDeliveryAddressDto
                {
                    Id = a.Id,
                    CustomerId = a.CustomerId,
                    CustomerName = a.Customer != null ? a.Customer.Name : null,
                    AddressLabel = a.AddressLabel,
                    Address = a.Address,
                    City = a.City,
                    Province = a.Province,
                    PostalCode = a.PostalCode,
                    Country = a.Country,
                    ContactPerson = a.ContactPerson,
                    ContactPhone = a.ContactPhone,
                    Latitude = a.Latitude,
                    Longitude = a.Longitude,
                    GooglePlaceId = a.GooglePlaceId,
                    FormattedAddress = a.FormattedAddress,
                    IsDefault = a.IsDefault,
                    IsActive = a.IsActive,
                    DeliveryInstructions = a.DeliveryInstructions,
                    UsageCount = a.UsageCount,
                    LastUsedAt = a.LastUsedAt,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            var result = addresses.GroupBy(a => a.CustomerId)
                .ToDictionary(g => g.Key, g => g.ToList());

            return Ok(result);
        }

        /// <summary>
        /// Create a new delivery address for a customer
        /// </summary>
        [HttpPost("{customerId}/delivery-addresses")]
        public async Task<ActionResult<CustomerDeliveryAddressDto>> CreateDeliveryAddress(
            int customerId,
            [FromBody] CreateCustomerDeliveryAddressDto dto)
        {
            // Verify customer exists
            var customer = await _context.LogisticsCustomers.FindAsync(customerId);
            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            // If setting as default, unset other defaults
            if (dto.IsDefault)
            {
                var existingDefaults = await _context.CustomerDeliveryAddresses
                    .Where(a => a.CustomerId == customerId && a.IsDefault)
                    .ToListAsync();
                existingDefaults.ForEach(a => a.IsDefault = false);
            }

            // Check for duplicate address
            var existingAddress = await _context.CustomerDeliveryAddresses
                .FirstOrDefaultAsync(a => 
                    a.CustomerId == customerId && 
                    a.Address.ToLower() == dto.Address.ToLower() &&
                    a.IsActive);

            if (existingAddress != null)
            {
                // Update existing address instead of creating duplicate
                existingAddress.UsageCount++;
                existingAddress.LastUsedAt = DateTime.UtcNow;
                if (dto.Latitude.HasValue) existingAddress.Latitude = dto.Latitude;
                if (dto.Longitude.HasValue) existingAddress.Longitude = dto.Longitude;
                if (!string.IsNullOrEmpty(dto.FormattedAddress)) existingAddress.FormattedAddress = dto.FormattedAddress;
                if (!string.IsNullOrEmpty(dto.GooglePlaceId)) existingAddress.GooglePlaceId = dto.GooglePlaceId;
                existingAddress.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new CustomerDeliveryAddressDto
                {
                    Id = existingAddress.Id,
                    CustomerId = existingAddress.CustomerId,
                    CustomerName = customer.Name,
                    AddressLabel = existingAddress.AddressLabel,
                    Address = existingAddress.Address,
                    City = existingAddress.City,
                    Province = existingAddress.Province,
                    Latitude = existingAddress.Latitude,
                    Longitude = existingAddress.Longitude,
                    FormattedAddress = existingAddress.FormattedAddress,
                    IsDefault = existingAddress.IsDefault,
                    IsActive = existingAddress.IsActive,
                    UsageCount = existingAddress.UsageCount,
                    LastUsedAt = existingAddress.LastUsedAt,
                    CreatedAt = existingAddress.CreatedAt
                });
            }

            // Get user ID from token
            var userIdClaim = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdClaim, out int createdByUserId);

            var address = new CustomerDeliveryAddress
            {
                CustomerId = customerId,
                AddressLabel = dto.AddressLabel,
                Address = dto.Address,
                City = dto.City,
                Province = dto.Province,
                PostalCode = dto.PostalCode,
                Country = dto.Country ?? "South Africa",
                ContactPerson = dto.ContactPerson,
                ContactPhone = dto.ContactPhone,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                GooglePlaceId = dto.GooglePlaceId,
                FormattedAddress = dto.FormattedAddress,
                IsDefault = dto.IsDefault,
                IsActive = true,
                DeliveryInstructions = dto.DeliveryInstructions,
                UsageCount = 1,
                LastUsedAt = DateTime.UtcNow,
                CreatedByUserId = createdByUserId > 0 ? createdByUserId : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.CustomerDeliveryAddresses.Add(address);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Created delivery address for customer {CustomerId}: {Address}", customerId, dto.Address);

            return CreatedAtAction(nameof(GetDeliveryAddresses), new { customerId }, new CustomerDeliveryAddressDto
            {
                Id = address.Id,
                CustomerId = address.CustomerId,
                CustomerName = customer.Name,
                AddressLabel = address.AddressLabel,
                Address = address.Address,
                City = address.City,
                Province = address.Province,
                PostalCode = address.PostalCode,
                Country = address.Country,
                ContactPerson = address.ContactPerson,
                ContactPhone = address.ContactPhone,
                Latitude = address.Latitude,
                Longitude = address.Longitude,
                GooglePlaceId = address.GooglePlaceId,
                FormattedAddress = address.FormattedAddress,
                IsDefault = address.IsDefault,
                IsActive = address.IsActive,
                DeliveryInstructions = address.DeliveryInstructions,
                UsageCount = address.UsageCount,
                LastUsedAt = address.LastUsedAt,
                CreatedAt = address.CreatedAt
            });
        }

        /// <summary>
        /// Save delivery address during tripsheet creation (finds or creates customer)
        /// </summary>
        [HttpPost("delivery-addresses/save")]
        public async Task<ActionResult<CustomerDeliveryAddressDto>> SaveDeliveryAddress([FromBody] SaveDeliveryAddressDto dto)
        {
            // Find customer by ID, code, or name
            Customer? customer = null;
            
            if (dto.CustomerId > 0)
            {
                customer = await _context.LogisticsCustomers.FindAsync(dto.CustomerId);
            }
            else if (!string.IsNullOrEmpty(dto.CustomerCode))
            {
                customer = await _context.LogisticsCustomers
                    .FirstOrDefaultAsync(c => c.CustomerCode == dto.CustomerCode);
            }
            else if (!string.IsNullOrEmpty(dto.CustomerName))
            {
                customer = await _context.LogisticsCustomers
                    .FirstOrDefaultAsync(c => c.Name == dto.CustomerName || c.ShortName == dto.CustomerName);
            }

            if (customer == null)
            {
                // Create new customer if not found
                if (!string.IsNullOrEmpty(dto.CustomerName))
                {
                    customer = new Customer
                    {
                        Name = dto.CustomerName,
                        CustomerCode = dto.CustomerCode,
                        City = dto.City,
                        Province = dto.Province,
                        Status = "Active",
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.LogisticsCustomers.Add(customer);
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Created new customer from tripsheet: {CustomerName}", dto.CustomerName);
                }
                else
                {
                    return BadRequest(new { error = "Customer not found and no customer name provided" });
                }
            }

            // Check for existing address
            var existingAddress = await _context.CustomerDeliveryAddresses
                .FirstOrDefaultAsync(a => 
                    a.CustomerId == customer.Id && 
                    (a.Address.ToLower() == dto.Address.ToLower() ||
                     (a.FormattedAddress != null && a.FormattedAddress.ToLower() == dto.Address.ToLower())) &&
                    a.IsActive);

            if (existingAddress != null)
            {
                // Update existing address usage
                existingAddress.UsageCount++;
                existingAddress.LastUsedAt = DateTime.UtcNow;
                if (dto.Latitude.HasValue && dto.Latitude != 0) existingAddress.Latitude = dto.Latitude;
                if (dto.Longitude.HasValue && dto.Longitude != 0) existingAddress.Longitude = dto.Longitude;
                if (!string.IsNullOrEmpty(dto.FormattedAddress)) existingAddress.FormattedAddress = dto.FormattedAddress;
                if (!string.IsNullOrEmpty(dto.GooglePlaceId)) existingAddress.GooglePlaceId = dto.GooglePlaceId;
                existingAddress.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new CustomerDeliveryAddressDto
                {
                    Id = existingAddress.Id,
                    CustomerId = existingAddress.CustomerId,
                    CustomerName = customer.Name,
                    AddressLabel = existingAddress.AddressLabel,
                    Address = existingAddress.Address,
                    City = existingAddress.City,
                    Province = existingAddress.Province,
                    Latitude = existingAddress.Latitude,
                    Longitude = existingAddress.Longitude,
                    FormattedAddress = existingAddress.FormattedAddress,
                    IsDefault = existingAddress.IsDefault,
                    IsActive = existingAddress.IsActive,
                    UsageCount = existingAddress.UsageCount,
                    LastUsedAt = existingAddress.LastUsedAt,
                    CreatedAt = existingAddress.CreatedAt
                });
            }

            // Get user ID from token
            var userIdClaim = User.FindFirst("sub")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdClaim, out int createdByUserId);

            // Check if this is the first address for the customer
            var addressCount = await _context.CustomerDeliveryAddresses
                .CountAsync(a => a.CustomerId == customer.Id && a.IsActive);

            var address = new CustomerDeliveryAddress
            {
                CustomerId = customer.Id,
                AddressLabel = dto.AddressLabel ?? "Delivery Address",
                Address = dto.Address,
                City = dto.City,
                Province = dto.Province,
                Country = "South Africa",
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                GooglePlaceId = dto.GooglePlaceId,
                FormattedAddress = dto.FormattedAddress ?? dto.Address,
                IsDefault = addressCount == 0, // First address is default
                IsActive = true,
                UsageCount = 1,
                LastUsedAt = DateTime.UtcNow,
                CreatedByUserId = createdByUserId > 0 ? createdByUserId : null,
                CreatedAt = DateTime.UtcNow
            };

            _context.CustomerDeliveryAddresses.Add(address);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Saved delivery address for customer {CustomerName}: {Address}", customer.Name, dto.Address);

            return Ok(new CustomerDeliveryAddressDto
            {
                Id = address.Id,
                CustomerId = address.CustomerId,
                CustomerName = customer.Name,
                AddressLabel = address.AddressLabel,
                Address = address.Address,
                City = address.City,
                Province = address.Province,
                PostalCode = address.PostalCode,
                Country = address.Country,
                Latitude = address.Latitude,
                Longitude = address.Longitude,
                GooglePlaceId = address.GooglePlaceId,
                FormattedAddress = address.FormattedAddress,
                IsDefault = address.IsDefault,
                IsActive = address.IsActive,
                UsageCount = address.UsageCount,
                LastUsedAt = address.LastUsedAt,
                CreatedAt = address.CreatedAt
            });
        }

        /// <summary>
        /// Batch save delivery addresses (for tripsheet creation)
        /// </summary>
        [HttpPost("delivery-addresses/batch-save")]
        public async Task<ActionResult<List<CustomerDeliveryAddressDto>>> BatchSaveDeliveryAddresses(
            [FromBody] BatchSaveDeliveryAddressesDto dto)
        {
            var results = new List<CustomerDeliveryAddressDto>();
            var errors = new List<string>();

            foreach (var addressDto in dto.Addresses)
            {
                try
                {
                    // Find customer
                    Customer? customer = null;
                    
                    if (addressDto.CustomerId > 0)
                    {
                        customer = await _context.LogisticsCustomers.FindAsync(addressDto.CustomerId);
                    }
                    else if (!string.IsNullOrEmpty(addressDto.CustomerCode))
                    {
                        customer = await _context.LogisticsCustomers
                            .FirstOrDefaultAsync(c => c.CustomerCode == addressDto.CustomerCode);
                    }
                    else if (!string.IsNullOrEmpty(addressDto.CustomerName))
                    {
                        customer = await _context.LogisticsCustomers
                            .FirstOrDefaultAsync(c => c.Name == addressDto.CustomerName || c.ShortName == addressDto.CustomerName);
                    }

                    if (customer == null)
                    {
                        // Create new customer
                        if (!string.IsNullOrEmpty(addressDto.CustomerName))
                        {
                            customer = new Customer
                            {
                                Name = addressDto.CustomerName,
                                CustomerCode = addressDto.CustomerCode,
                                City = addressDto.City,
                                Province = addressDto.Province,
                                Status = "Active",
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.LogisticsCustomers.Add(customer);
                            await _context.SaveChangesAsync();
                        }
                        else
                        {
                            errors.Add($"Customer not found for address: {addressDto.Address}");
                            continue;
                        }
                    }

                    // Check for existing address
                    var existingAddress = await _context.CustomerDeliveryAddresses
                        .FirstOrDefaultAsync(a => 
                            a.CustomerId == customer.Id && 
                            a.Address.ToLower() == addressDto.Address.ToLower() &&
                            a.IsActive);

                    if (existingAddress != null)
                    {
                        // Update existing
                        existingAddress.UsageCount++;
                        existingAddress.LastUsedAt = DateTime.UtcNow;
                        if (addressDto.Latitude.HasValue) existingAddress.Latitude = addressDto.Latitude;
                        if (addressDto.Longitude.HasValue) existingAddress.Longitude = addressDto.Longitude;
                        if (!string.IsNullOrEmpty(addressDto.FormattedAddress)) existingAddress.FormattedAddress = addressDto.FormattedAddress;
                        existingAddress.UpdatedAt = DateTime.UtcNow;

                        results.Add(new CustomerDeliveryAddressDto
                        {
                            Id = existingAddress.Id,
                            CustomerId = existingAddress.CustomerId,
                            CustomerName = customer.Name,
                            Address = existingAddress.Address,
                            City = existingAddress.City,
                            Province = existingAddress.Province,
                            Latitude = existingAddress.Latitude,
                            Longitude = existingAddress.Longitude,
                            UsageCount = existingAddress.UsageCount
                        });
                    }
                    else
                    {
                        // Create new
                        var addressCount = await _context.CustomerDeliveryAddresses
                            .CountAsync(a => a.CustomerId == customer.Id && a.IsActive);

                        var address = new CustomerDeliveryAddress
                        {
                            CustomerId = customer.Id,
                            AddressLabel = addressDto.AddressLabel ?? "Delivery Address",
                            Address = addressDto.Address,
                            City = addressDto.City,
                            Province = addressDto.Province,
                            Latitude = addressDto.Latitude,
                            Longitude = addressDto.Longitude,
                            FormattedAddress = addressDto.FormattedAddress,
                            GooglePlaceId = addressDto.GooglePlaceId,
                            IsDefault = addressCount == 0,
                            IsActive = true,
                            UsageCount = 1,
                            LastUsedAt = DateTime.UtcNow,
                            CreatedAt = DateTime.UtcNow
                        };

                        _context.CustomerDeliveryAddresses.Add(address);
                        await _context.SaveChangesAsync();

                        results.Add(new CustomerDeliveryAddressDto
                        {
                            Id = address.Id,
                            CustomerId = address.CustomerId,
                            CustomerName = customer.Name,
                            Address = address.Address,
                            City = address.City,
                            Province = address.Province,
                            Latitude = address.Latitude,
                            Longitude = address.Longitude,
                            UsageCount = address.UsageCount
                        });
                    }
                }
                catch (Exception ex)
                {
                    errors.Add($"Error saving address '{addressDto.Address}': {ex.Message}");
                }
            }

            _logger.LogInformation("Batch saved {Count} delivery addresses, {Errors} errors", results.Count, errors.Count);

            return Ok(new { saved = results, errors });
        }

        /// <summary>
        /// Update a delivery address
        /// </summary>
        [HttpPut("delivery-addresses/{id}")]
        public async Task<ActionResult<CustomerDeliveryAddressDto>> UpdateDeliveryAddress(
            int id,
            [FromBody] UpdateCustomerDeliveryAddressDto dto)
        {
            var address = await _context.CustomerDeliveryAddresses
                .Include(a => a.Customer)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (address == null)
                return NotFound(new { error = "Delivery address not found" });

            // If setting as default, unset other defaults
            if (dto.IsDefault == true && !address.IsDefault)
            {
                var existingDefaults = await _context.CustomerDeliveryAddresses
                    .Where(a => a.CustomerId == address.CustomerId && a.IsDefault && a.Id != id)
                    .ToListAsync();
                existingDefaults.ForEach(a => a.IsDefault = false);
            }

            // Update fields
            if (!string.IsNullOrEmpty(dto.AddressLabel)) address.AddressLabel = dto.AddressLabel;
            if (!string.IsNullOrEmpty(dto.Address)) address.Address = dto.Address;
            if (dto.City != null) address.City = dto.City;
            if (dto.Province != null) address.Province = dto.Province;
            if (dto.PostalCode != null) address.PostalCode = dto.PostalCode;
            if (dto.ContactPerson != null) address.ContactPerson = dto.ContactPerson;
            if (dto.ContactPhone != null) address.ContactPhone = dto.ContactPhone;
            if (dto.Latitude.HasValue) address.Latitude = dto.Latitude;
            if (dto.Longitude.HasValue) address.Longitude = dto.Longitude;
            if (dto.GooglePlaceId != null) address.GooglePlaceId = dto.GooglePlaceId;
            if (dto.FormattedAddress != null) address.FormattedAddress = dto.FormattedAddress;
            if (dto.IsDefault.HasValue) address.IsDefault = dto.IsDefault.Value;
            if (dto.IsActive.HasValue) address.IsActive = dto.IsActive.Value;
            if (dto.DeliveryInstructions != null) address.DeliveryInstructions = dto.DeliveryInstructions;
            
            address.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated delivery address {Id} for customer {CustomerId}", id, address.CustomerId);

            return Ok(new CustomerDeliveryAddressDto
            {
                Id = address.Id,
                CustomerId = address.CustomerId,
                CustomerName = address.Customer?.Name,
                AddressLabel = address.AddressLabel,
                Address = address.Address,
                City = address.City,
                Province = address.Province,
                PostalCode = address.PostalCode,
                Country = address.Country,
                ContactPerson = address.ContactPerson,
                ContactPhone = address.ContactPhone,
                Latitude = address.Latitude,
                Longitude = address.Longitude,
                GooglePlaceId = address.GooglePlaceId,
                FormattedAddress = address.FormattedAddress,
                IsDefault = address.IsDefault,
                IsActive = address.IsActive,
                DeliveryInstructions = address.DeliveryInstructions,
                UsageCount = address.UsageCount,
                LastUsedAt = address.LastUsedAt,
                CreatedAt = address.CreatedAt
            });
        }

        /// <summary>
        /// Delete (soft-delete) a delivery address
        /// </summary>
        [HttpDelete("delivery-addresses/{id}")]
        public async Task<ActionResult> DeleteDeliveryAddress(int id)
        {
            var address = await _context.CustomerDeliveryAddresses.FindAsync(id);

            if (address == null)
                return NotFound(new { error = "Delivery address not found" });

            // Soft delete
            address.IsActive = false;
            address.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Deleted delivery address {Id}", id);

            return NoContent();
        }

        /// <summary>
        /// Record usage of a delivery address (increment usage count)
        /// </summary>
        [HttpPost("delivery-addresses/{id}/use")]
        public async Task<ActionResult> RecordAddressUsage(int id)
        {
            var address = await _context.CustomerDeliveryAddresses.FindAsync(id);

            if (address == null)
                return NotFound(new { error = "Delivery address not found" });

            address.UsageCount++;
            address.LastUsedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { usageCount = address.UsageCount });
        }

        #endregion

        #region Address Cleanup

        /// <summary>
        /// Clean up and enrich customer addresses using Google Maps Geocoding API
        /// </summary>
        /// <param name="batchSize">Number of customers to process (default: all)</param>
        /// <param name="dryRun">If true, only preview changes without saving</param>
        [HttpPost("cleanup-addresses")]
        public async Task<ActionResult<CustomerAddressCleanupService.CleanupResult>> CleanupAddresses(
            [FromQuery] int? batchSize = null,
            [FromQuery] bool dryRun = false)
        {
            _logger.LogInformation($"Starting address cleanup. BatchSize: {batchSize}, DryRun: {dryRun}");
            
            var result = await _cleanupService.CleanupCustomerAddresses(batchSize, updateDatabase: !dryRun);
            
            return Ok(result);
        }

        /// <summary>
        /// Map customer provinces using code prefixes and name keywords (no Google API required)
        /// </summary>
        /// <param name="limit">Number of customers to process (default: all)</param>
        /// <param name="dryRun">If true, only preview changes without saving</param>
        [HttpPost("map-provinces")]
        public async Task<ActionResult<CustomerProvinceMapperService.MappingResult>> MapProvinces(
            [FromQuery] int? limit = null,
            [FromQuery] bool dryRun = false,
            [FromServices] CustomerProvinceMapperService mapperService = null!)
        {
            _logger.LogInformation($"Starting province mapping. Limit: {limit}, DryRun: {dryRun}");
            
            var result = await mapperService.MapCustomerProvinces(updateDatabase: !dryRun, limit: limit);
            
            return Ok(result);
        }

        /// <summary>
        /// Get statistics about customer address data quality
        /// </summary>
        [HttpGet("address-stats")]
        public async Task<ActionResult> GetAddressStats()
        {
            var total = await _context.LogisticsCustomers.CountAsync();
            var withProvince = await _context.LogisticsCustomers.CountAsync(c => c.Province != null && c.Province != "");
            var withCity = await _context.LogisticsCustomers.CountAsync(c => c.City != null && c.City != "");
            var withAddressLines = await _context.LogisticsCustomers.CountAsync(c => c.AddressLinesJson != null && c.AddressLinesJson != "");
            var withDeliveryProvince = await _context.LogisticsCustomers.CountAsync(c => c.DeliveryProvince != null && c.DeliveryProvince != "");

            // Get breakdown by province
            var provinceBreakdown = await _context.LogisticsCustomers
                .Where(c => c.Province != null && c.Province != "")
                .GroupBy(c => c.Province)
                .Select(g => new { Province = g.Key, Count = g.Count() })
                .ToListAsync();

            return Ok(new
            {
                total,
                withProvince,
                withCity,
                withAddressLines,
                withDeliveryProvince,
                missingProvince = total - withProvince,
                missingCity = total - withCity,
                provinceBreakdown
            });
        }

        #endregion
    }
}
