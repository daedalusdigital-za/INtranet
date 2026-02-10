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
        /// Get customers with address issues (missing address, city, province, or coordinates)
        /// </summary>
        [HttpGet("address-issues")]
        public async Task<ActionResult<AddressIssuesResponseDto>> GetAddressIssues(
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            // Only find customers that TRULY have no address data at all
            var query = _context.LogisticsCustomers
                .Where(c => c.Status == "Active")
                .Where(c => 
                    // Missing ALL address fields (no address anywhere)
                    (string.IsNullOrEmpty(c.Address) && 
                     string.IsNullOrEmpty(c.PhysicalAddress) && 
                     string.IsNullOrEmpty(c.DeliveryAddress) &&
                     string.IsNullOrEmpty(c.AddressLinesJson)) ||
                    // Missing ALL city fields
                    (string.IsNullOrEmpty(c.City) && string.IsNullOrEmpty(c.DeliveryCity)) ||
                    // Missing ALL province fields
                    (string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince)) ||
                    // Missing BOTH coordinates (need both for geocoding)
                    (c.Latitude == null && c.Longitude == null)
                );

            if (!string.IsNullOrEmpty(search))
            {
                var searchLower = search.ToLower();
                query = query.Where(c =>
                    c.Name.ToLower().Contains(searchLower) ||
                    (c.CustomerCode != null && c.CustomerCode.ToLower().Contains(searchLower)) ||
                    (c.ShortName != null && c.ShortName.ToLower().Contains(searchLower)));
            }

            var totalCount = await query.CountAsync();

            var customers = await query
                .OrderBy(c => c.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new CustomerAddressIssueDto
                {
                    Id = c.Id,
                    CustomerCode = c.CustomerCode,
                    Name = c.Name,
                    ShortName = c.ShortName,
                    Address = c.Address,
                    PhysicalAddress = c.PhysicalAddress,
                    DeliveryAddress = c.DeliveryAddress,
                    City = c.City,
                    DeliveryCity = c.DeliveryCity,
                    Province = c.Province,
                    DeliveryProvince = c.DeliveryProvince,
                    PostalCode = c.PostalCode,
                    DeliveryPostalCode = c.DeliveryPostalCode,
                    Latitude = c.Latitude,
                    Longitude = c.Longitude,
                    // Only flag as missing if ALL address fields are empty
                    HasMissingAddress = string.IsNullOrEmpty(c.Address) && 
                                       string.IsNullOrEmpty(c.PhysicalAddress) && 
                                       string.IsNullOrEmpty(c.DeliveryAddress) &&
                                       string.IsNullOrEmpty(c.AddressLinesJson),
                    HasMissingCity = string.IsNullOrEmpty(c.City) && string.IsNullOrEmpty(c.DeliveryCity),
                    HasMissingProvince = string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince),
                    // Only flag if BOTH coordinates are missing
                    HasMissingCoordinates = c.Latitude == null && c.Longitude == null
                })
                .ToListAsync();

            return Ok(new AddressIssuesResponseDto
            {
                Customers = customers,
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            });
        }

        /// <summary>
        /// Get count of customers with address issues
        /// </summary>
        [HttpGet("address-issues/count")]
        public async Task<ActionResult<int>> GetAddressIssuesCount()
        {
            var count = await _context.LogisticsCustomers
                .Where(c => c.Status == "Active")
                .Where(c => 
                    // Missing ALL address fields
                    (string.IsNullOrEmpty(c.Address) && 
                     string.IsNullOrEmpty(c.PhysicalAddress) && 
                     string.IsNullOrEmpty(c.DeliveryAddress) &&
                     string.IsNullOrEmpty(c.AddressLinesJson)) ||
                    // Missing ALL city fields
                    (string.IsNullOrEmpty(c.City) && string.IsNullOrEmpty(c.DeliveryCity)) ||
                    // Missing ALL province fields
                    (string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince)) ||
                    // Missing BOTH coordinates
                    (c.Latitude == null && c.Longitude == null)
                )
                .CountAsync();

            return Ok(count);
        }

        /// <summary>
        /// Update customer address information
        /// </summary>
        [HttpPatch("{id}/address")]
        public async Task<ActionResult<CustomerDto>> UpdateCustomerAddress(int id, [FromBody] UpdateCustomerAddressDto dto)
        {
            var customer = await _context.LogisticsCustomers.FindAsync(id);
            if (customer == null)
                return NotFound(new { error = "Customer not found" });

            // Update address fields
            if (dto.DeliveryAddress != null)
                customer.DeliveryAddress = dto.DeliveryAddress;
            if (dto.DeliveryCity != null)
                customer.DeliveryCity = dto.DeliveryCity;
            if (dto.DeliveryProvince != null)
                customer.DeliveryProvince = dto.DeliveryProvince;
            if (dto.DeliveryPostalCode != null)
                customer.DeliveryPostalCode = dto.DeliveryPostalCode;
            if (dto.City != null)
                customer.City = dto.City;
            if (dto.Province != null)
                customer.Province = dto.Province;
            if (dto.PostalCode != null)
                customer.PostalCode = dto.PostalCode;
            if (dto.Latitude.HasValue)
                customer.Latitude = dto.Latitude;
            if (dto.Longitude.HasValue)
                customer.Longitude = dto.Longitude;

            // Also update physical address if delivery address is provided
            if (!string.IsNullOrEmpty(dto.DeliveryAddress) && string.IsNullOrEmpty(customer.PhysicalAddress))
                customer.PhysicalAddress = dto.DeliveryAddress;

            customer.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Updated address for customer {Id} - {Name}", customer.Id, customer.Name);

            return Ok(await GetCustomerDtoById(id));
        }

        /// <summary>
        /// Sync addresses from tripsheet stops to customer delivery addresses.
        /// Scans all load stops and saves unique addresses for customers.
        /// </summary>
        [AllowAnonymous]
        [HttpPost("sync-addresses-from-tripsheets")]
        public async Task<ActionResult<SyncAddressesResult>> SyncAddressesFromTripsheets()
        {
            var result = new SyncAddressesResult();

            try
            {
                // Get all load stops with addresses
                var allStops = await _context.LoadStops
                    .Include(s => s.Load)
                    .Where(s => !string.IsNullOrEmpty(s.Address) && s.Address.Length > 5)
                    .ToListAsync();

                _logger.LogInformation("Found {Count} stops with addresses to process", allStops.Count);
                result.TotalStopsProcessed = allStops.Count;

                // Get all customers for matching
                var allCustomers = await _context.LogisticsCustomers.ToListAsync();
                var customersByName = allCustomers
                    .GroupBy(c => NormalizeCustomerName(c.Name))
                    .ToDictionary(g => g.Key, g => g.First());
                var customersByShortName = allCustomers
                    .Where(c => !string.IsNullOrEmpty(c.ShortName))
                    .GroupBy(c => NormalizeCustomerName(c.ShortName!))
                    .ToDictionary(g => g.Key, g => g.First());

                // Get existing delivery addresses for all customers
                var existingAddresses = await _context.CustomerDeliveryAddresses
                    .Where(a => a.IsActive)
                    .ToListAsync();
                var existingAddressLookup = existingAddresses
                    .GroupBy(a => a.CustomerId)
                    .ToDictionary(g => g.Key, g => g.ToList());

                // Track which customers we've already added addresses to (to avoid duplicates)
                var addedAddressesTracker = new Dictionary<int, HashSet<string>>();

                foreach (var stop in allStops)
                {
                    // Try to find matching customer
                    Customer? customer = null;

                    // First try by CustomerId if set
                    if (stop.CustomerId.HasValue && stop.CustomerId > 0)
                    {
                        customer = allCustomers.FirstOrDefault(c => c.Id == stop.CustomerId.Value);
                    }

                    // If not found, try by CompanyName
                    if (customer == null && !string.IsNullOrEmpty(stop.CompanyName))
                    {
                        var normalizedCompanyName = NormalizeCustomerName(stop.CompanyName);
                        if (customersByName.TryGetValue(normalizedCompanyName, out var matchedCustomer))
                        {
                            customer = matchedCustomer;
                        }
                        else if (customersByShortName.TryGetValue(normalizedCompanyName, out matchedCustomer))
                        {
                            customer = matchedCustomer;
                        }
                        else
                        {
                            // Try partial match (company name contains customer name or vice versa)
                            customer = allCustomers.FirstOrDefault(c =>
                                NormalizeCustomerName(c.Name).Contains(normalizedCompanyName) ||
                                normalizedCompanyName.Contains(NormalizeCustomerName(c.Name)) ||
                                (!string.IsNullOrEmpty(c.ShortName) && (
                                    NormalizeCustomerName(c.ShortName).Contains(normalizedCompanyName) ||
                                    normalizedCompanyName.Contains(NormalizeCustomerName(c.ShortName)))));
                        }
                    }

                    // If still not found, try by LocationName
                    if (customer == null && !string.IsNullOrEmpty(stop.LocationName))
                    {
                        var normalizedLocationName = NormalizeCustomerName(stop.LocationName);
                        customer = allCustomers.FirstOrDefault(c =>
                            NormalizeCustomerName(c.Name).Contains(normalizedLocationName) ||
                            normalizedLocationName.Contains(NormalizeCustomerName(c.Name)));
                    }

                    if (customer == null)
                    {
                        // No matching customer found, skip this stop
                        continue;
                    }

                    // Check if we already have this address for this customer
                    var normalizedAddress = NormalizeAddress(stop.Address);
                    
                    if (!addedAddressesTracker.ContainsKey(customer.Id))
                    {
                        addedAddressesTracker[customer.Id] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    }

                    if (addedAddressesTracker[customer.Id].Contains(normalizedAddress))
                    {
                        continue; // Already processed this address in this batch
                    }

                    // Check against existing addresses in database
                    var customerExistingAddresses = existingAddressLookup.TryGetValue(customer.Id, out var existing)
                        ? existing : new List<CustomerDeliveryAddress>();

                    var existsInDb = customerExistingAddresses.Any(ea =>
                        NormalizeAddress(ea.Address) == normalizedAddress ||
                        (ea.FormattedAddress != null && NormalizeAddress(ea.FormattedAddress) == normalizedAddress));

                    if (existsInDb)
                    {
                        result.SkippedExisting++;
                        addedAddressesTracker[customer.Id].Add(normalizedAddress);
                        continue;
                    }

                    // Check against customer's main addresses
                    if (!string.IsNullOrEmpty(customer.Address) &&
                        NormalizeAddress(customer.Address) == normalizedAddress)
                    {
                        result.SkippedExisting++;
                        addedAddressesTracker[customer.Id].Add(normalizedAddress);
                        continue;
                    }
                    if (!string.IsNullOrEmpty(customer.DeliveryAddress) &&
                        NormalizeAddress(customer.DeliveryAddress) == normalizedAddress)
                    {
                        result.SkippedExisting++;
                        addedAddressesTracker[customer.Id].Add(normalizedAddress);
                        continue;
                    }

                    // Create new delivery address
                    var isFirstAddress = customerExistingAddresses.Count == 0 &&
                                        !result.AddedAddresses.Any(a => a.CustomerId == customer.Id);

                    var newAddress = new CustomerDeliveryAddress
                    {
                        CustomerId = customer.Id,
                        AddressLabel = !string.IsNullOrEmpty(stop.LocationName)
                            ? stop.LocationName
                            : (!string.IsNullOrEmpty(stop.City) ? $"Delivery - {stop.City}" : "Delivery Address"),
                        Address = stop.Address,
                        City = stop.City,
                        Province = stop.Province,
                        PostalCode = stop.PostalCode,
                        Country = "South Africa",
                        ContactPerson = stop.ContactPerson,
                        ContactPhone = stop.ContactPhone,
                        Latitude = stop.Latitude.HasValue ? (double)stop.Latitude.Value : null,
                        Longitude = stop.Longitude.HasValue ? (double)stop.Longitude.Value : null,
                        FormattedAddress = stop.Address,
                        IsDefault = isFirstAddress,
                        IsActive = true,
                        UsageCount = 1,
                        LastUsedAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.CustomerDeliveryAddresses.Add(newAddress);
                    addedAddressesTracker[customer.Id].Add(normalizedAddress);

                    result.AddedAddresses.Add(new SyncedAddressInfo
                    {
                        CustomerId = customer.Id,
                        CustomerName = customer.Name,
                        Address = stop.Address,
                        City = stop.City,
                        Province = stop.Province,
                        FromLoadNumber = stop.Load?.LoadNumber
                    });

                    // Also update customer's main delivery address if not set
                    if (string.IsNullOrEmpty(customer.DeliveryAddress))
                    {
                        customer.DeliveryAddress = stop.Address;
                        customer.DeliveryCity = stop.City;
                        customer.DeliveryProvince = stop.Province;
                        customer.DeliveryPostalCode = stop.PostalCode;
                        customer.UpdatedAt = DateTime.UtcNow;
                        result.CustomersUpdated++;
                    }
                }

                await _context.SaveChangesAsync();

                result.Success = true;
                result.TotalAddressesSaved = result.AddedAddresses.Count;
                _logger.LogInformation("Synced {Count} addresses from tripsheets, skipped {Skipped} existing", 
                    result.TotalAddressesSaved, result.SkippedExisting);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing addresses from tripsheets");
                result.Success = false;
                result.ErrorMessage = ex.Message;
            }

            return Ok(result);
        }

        /// <summary>
        /// Normalize customer name for matching (lowercase, remove extra spaces, common suffixes)
        /// </summary>
        private static string NormalizeCustomerName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
                return "";

            return name
                .ToLowerInvariant()
                .Replace("(pty) ltd", "")
                .Replace("pty ltd", "")
                .Replace("(pty)", "")
                .Replace("ltd", "")
                .Replace("cc", "")
                .Replace(",", " ")
                .Replace(".", " ")
                .Replace("  ", " ")
                .Replace("  ", " ")
                .Trim();
        }

        /// <summary>
        /// Normalize address for comparison (lowercase, remove extra spaces, punctuation)
        /// </summary>
        private static string NormalizeAddress(string? address)
        {
            if (string.IsNullOrWhiteSpace(address))
                return "";

            return address
                .ToLowerInvariant()
                .Replace(",", " ")
                .Replace(".", " ")
                .Replace("  ", " ")
                .Replace("  ", " ")
                .Trim();
        }

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
        /// Use Gemini AI to map customer addresses to South African provinces
        /// </summary>
        /// <param name="batchSize">Number of customers to process (default: all with missing provinces)</param>
        [HttpPost("map-provinces-gemini")]
        public async Task<ActionResult<GeminiProvinceService.ProvinceMappingResult>> MapProvincesWithGemini(
            [FromQuery] int? batchSize = null,
            [FromServices] GeminiProvinceService geminiService = null!)
        {
            _logger.LogInformation($"Starting Gemini AI province mapping. BatchSize: {batchSize}");
            
            var result = await geminiService.MapProvincesWithGemini(batchSize);
            
            return Ok(result);
        }

        /// <summary>
        /// Get AI suggestions for fixing address issues using Gemini
        /// </summary>
        /// <param name="limit">Maximum number of customers to analyze (default: 50)</param>
        [HttpPost("address-suggestions")]
        public async Task<ActionResult<GeminiProvinceService.AddressSuggestionsResult>> GetAddressSuggestions(
            [FromQuery] int limit = 50,
            [FromServices] GeminiProvinceService geminiService = null!)
        {
            _logger.LogInformation($"Getting AI address suggestions. Limit: {limit}");

            // Get customers with address issues - prioritize those with coordinates but missing province
            // (these are easy wins since we can use GPS to determine province accurately)
            var customersWithCoords = await _context.LogisticsCustomers
                .Where(c => c.Status == "Active")
                .Where(c => 
                    // Has coordinates but missing province - PRIORITY
                    c.Latitude != null && c.Longitude != null &&
                    string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince))
                .Take(limit)
                .Select(c => new GeminiProvinceService.CustomerAddressInfo
                {
                    CustomerId = c.Id,
                    CustomerName = c.Name,
                    CustomerCode = c.CustomerCode,
                    Address = c.DeliveryAddress ?? c.Address ?? c.PhysicalAddress,
                    City = c.DeliveryCity ?? c.City,
                    Province = c.DeliveryProvince ?? c.Province,
                    PostalCode = c.DeliveryPostalCode ?? c.PostalCode,
                    Latitude = c.Latitude,
                    Longitude = c.Longitude,
                    HasMissingAddress = string.IsNullOrEmpty(c.Address) && string.IsNullOrEmpty(c.PhysicalAddress) && 
                                        string.IsNullOrEmpty(c.DeliveryAddress) && string.IsNullOrEmpty(c.AddressLinesJson),
                    HasMissingCity = string.IsNullOrEmpty(c.City) && string.IsNullOrEmpty(c.DeliveryCity),
                    HasMissingProvince = true,
                    HasMissingCoordinates = false
                })
                .ToListAsync();

            // If we still have room, add other customers with issues
            var remaining = limit - customersWithCoords.Count;
            var otherCustomers = new List<GeminiProvinceService.CustomerAddressInfo>();
            
            if (remaining > 0)
            {
                var coordsIds = customersWithCoords.Select(c => c.CustomerId).ToList();
                otherCustomers = await _context.LogisticsCustomers
                    .Where(c => c.Status == "Active")
                    .Where(c => !coordsIds.Contains(c.Id))
                    .Where(c =>
                        // Missing address
                        (string.IsNullOrEmpty(c.Address) && string.IsNullOrEmpty(c.PhysicalAddress) && 
                         string.IsNullOrEmpty(c.DeliveryAddress) && string.IsNullOrEmpty(c.AddressLinesJson)) ||
                        // Missing city
                        (string.IsNullOrEmpty(c.City) && string.IsNullOrEmpty(c.DeliveryCity)) ||
                        // Missing province (without coords - already got those above)
                        (string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince)) ||
                        // Missing coordinates
                        (c.Latitude == null || c.Longitude == null))
                    .Take(remaining)
                    .Select(c => new GeminiProvinceService.CustomerAddressInfo
                    {
                        CustomerId = c.Id,
                        CustomerName = c.Name,
                        CustomerCode = c.CustomerCode,
                        Address = c.DeliveryAddress ?? c.Address ?? c.PhysicalAddress,
                        City = c.DeliveryCity ?? c.City,
                        Province = c.DeliveryProvince ?? c.Province,
                        PostalCode = c.DeliveryPostalCode ?? c.PostalCode,
                        Latitude = c.Latitude,
                        Longitude = c.Longitude,
                        HasMissingAddress = string.IsNullOrEmpty(c.Address) && string.IsNullOrEmpty(c.PhysicalAddress) && 
                                            string.IsNullOrEmpty(c.DeliveryAddress) && string.IsNullOrEmpty(c.AddressLinesJson),
                        HasMissingCity = string.IsNullOrEmpty(c.City) && string.IsNullOrEmpty(c.DeliveryCity),
                        HasMissingProvince = string.IsNullOrEmpty(c.Province) && string.IsNullOrEmpty(c.DeliveryProvince),
                        HasMissingCoordinates = c.Latitude == null || c.Longitude == null
                    })
                    .ToListAsync();
            }

            var customers = customersWithCoords.Concat(otherCustomers).ToList();
            
            _logger.LogInformation("Found {WithCoords} customers with coords but missing province, {Other} other issues", 
                customersWithCoords.Count, otherCustomers.Count);

            if (!customers.Any())
            {
                return Ok(new GeminiProvinceService.AddressSuggestionsResult
                {
                    Success = true,
                    TotalProcessed = 0,
                    Suggestions = new List<GeminiProvinceService.AddressSuggestion>()
                });
            }

            var result = await geminiService.GetAddressSuggestions(customers);
            
            return Ok(result);
        }

        /// <summary>
        /// Apply a single AI suggestion to a customer
        /// </summary>
        [HttpPost("apply-suggestion")]
        public async Task<ActionResult> ApplySuggestion([FromBody] ApplySuggestionRequest request)
        {
            var customer = await _context.LogisticsCustomers.FindAsync(request.CustomerId);
            if (customer == null)
            {
                return NotFound(new { error = "Customer not found" });
            }

            if (!string.IsNullOrEmpty(request.Province))
            {
                customer.Province = request.Province;
                customer.DeliveryProvince = request.Province;
            }
            if (!string.IsNullOrEmpty(request.City))
            {
                customer.City = request.City;
                customer.DeliveryCity = request.City;
            }
            if (!string.IsNullOrEmpty(request.Address))
            {
                customer.DeliveryAddress = request.Address;
                if (string.IsNullOrEmpty(customer.Address))
                    customer.Address = request.Address;
            }
            if (request.Latitude.HasValue)
            {
                customer.Latitude = request.Latitude;
            }
            if (request.Longitude.HasValue)
            {
                customer.Longitude = request.Longitude;
            }

            customer.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Applied AI suggestion to customer {Id}: {Name}", customer.Id, customer.Name);

            return Ok(new { success = true, message = $"Updated {customer.Name}" });
        }

        /// <summary>
        /// Match customers by name and return their address info
        /// </summary>
        [HttpPost("match-by-names")]
        public async Task<ActionResult> MatchByNames([FromBody] List<string> customerNames)
        {
            if (customerNames == null || customerNames.Count == 0)
            {
                return BadRequest(new { error = "No customer names provided" });
            }

            _logger.LogInformation("Matching {Count} customer names", customerNames.Count);

            var results = new List<object>();
            var customers = await _context.LogisticsCustomers.ToListAsync();

            foreach (var name in customerNames.Distinct())
            {
                if (string.IsNullOrWhiteSpace(name)) continue;

                var nameLower = name.Trim().ToLower();
                
                // Find best match by name
                var match = customers.FirstOrDefault(c => 
                    c.Name?.ToLower() == nameLower ||
                    c.Name?.ToLower().Contains(nameLower) == true ||
                    nameLower.Contains(c.Name?.ToLower() ?? ""));

                if (match != null && (
                    !string.IsNullOrEmpty(match.DeliveryAddress) ||
                    !string.IsNullOrEmpty(match.Address) ||
                    match.Latitude.HasValue))
                {
                    results.Add(new
                    {
                        id = match.Id,
                        name = match.Name,
                        deliveryAddress = match.DeliveryAddress ?? match.Address ?? match.PhysicalAddress,
                        deliveryCity = match.DeliveryCity ?? match.City,
                        deliveryProvince = match.DeliveryProvince ?? match.Province,
                        province = match.Province,
                        latitude = match.Latitude,
                        longitude = match.Longitude
                    });
                    
                    _logger.LogInformation("Matched '{Name}' to customer '{Match}'", name, match.Name);
                }
            }

            _logger.LogInformation("Found {Count} matches", results.Count);
            return Ok(results);
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

        /// <summary>
        /// Match customer names to addresses using database first, then Gemini AI for unmatched
        /// </summary>
        [HttpPost("match-addresses-ai")]
        public async Task<ActionResult> MatchAddressesWithAI(
            [FromBody] List<string> customerNames,
            [FromServices] GeminiProvinceService geminiService = null!)
        {
            if (customerNames == null || customerNames.Count == 0)
            {
                return BadRequest(new { error = "No customer names provided" });
            }

            _logger.LogInformation("Matching {Count} customer names with AI", customerNames.Count);

            var results = new List<object>();
            var unmatchedNames = new List<string>();
            var customers = await _context.LogisticsCustomers.ToListAsync();

            // First try database matching
            foreach (var name in customerNames.Distinct())
            {
                if (string.IsNullOrWhiteSpace(name)) continue;

                var nameLower = name.Trim().ToLower();
                
                // Find best match by name
                var match = customers.FirstOrDefault(c => 
                    c.Name?.ToLower() == nameLower ||
                    c.Name?.ToLower().Contains(nameLower) == true ||
                    nameLower.Contains(c.Name?.ToLower() ?? ""));

                if (match != null && (
                    !string.IsNullOrEmpty(match.DeliveryAddress) ||
                    !string.IsNullOrEmpty(match.Address) ||
                    !string.IsNullOrEmpty(match.DeliveryCity) ||
                    !string.IsNullOrEmpty(match.City) ||
                    match.Latitude.HasValue))
                {
                    results.Add(new
                    {
                        customerName = name,
                        id = match.Id,
                        matchedName = match.Name,
                        deliveryAddress = match.DeliveryAddress ?? match.Address ?? match.PhysicalAddress,
                        city = match.DeliveryCity ?? match.City,
                        province = match.DeliveryProvince ?? match.Province,
                        latitude = match.Latitude,
                        longitude = match.Longitude,
                        confidence = 0.9,
                        source = "Database",
                        reasoning = $"Matched to existing customer: {match.Name}"
                    });
                    
                    _logger.LogInformation("DB Matched '{Name}' to customer '{Match}'", name, match.Name);
                }
                else
                {
                    unmatchedNames.Add(name);
                }
            }

            // Use Gemini AI for unmatched names
            if (unmatchedNames.Count > 0 && geminiService != null)
            {
                _logger.LogInformation("Using Gemini AI for {Count} unmatched customer names", unmatchedNames.Count);

                try
                {
                    var aiResults = await geminiService.LookupCustomerAddresses(unmatchedNames);
                    
                    foreach (var aiResult in aiResults.Where(r => r.Confidence > 0.3))
                    {
                        results.Add(new
                        {
                            customerName = aiResult.CustomerName,
                            id = (int?)null,
                            matchedName = (string?)null,
                            deliveryAddress = aiResult.Address,
                            city = aiResult.City,
                            province = aiResult.Province,
                            latitude = (double?)null,
                            longitude = (double?)null,
                            confidence = aiResult.Confidence,
                            source = "GeminiAI",
                            reasoning = aiResult.Reasoning
                        });
                        
                        _logger.LogInformation("AI found address for '{Name}': {City}, {Province}", 
                            aiResult.CustomerName, aiResult.City, aiResult.Province);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error calling Gemini AI for address lookup");
                }
            }

            _logger.LogInformation("Total matches: {Count} (DB: {DB}, AI: {AI})", 
                results.Count, 
                results.Count(r => ((dynamic)r).source == "Database"),
                results.Count(r => ((dynamic)r).source == "GeminiAI"));

            return Ok(new
            {
                success = true,
                totalRequested = customerNames.Count,
                totalMatched = results.Count,
                databaseMatches = results.Count(r => ((dynamic)r).source == "Database"),
                aiMatches = results.Count(r => ((dynamic)r).source == "GeminiAI"),
                results
            });
        }

        #endregion
    }

    /// <summary>
    /// Result of syncing addresses from tripsheets
    /// </summary>
    public class SyncAddressesResult
    {
        public bool Success { get; set; }
        public int TotalStopsProcessed { get; set; }
        public int TotalAddressesSaved { get; set; }
        public int SkippedExisting { get; set; }
        public int CustomersUpdated { get; set; }
        public string? ErrorMessage { get; set; }
        public List<SyncedAddressInfo> AddedAddresses { get; set; } = new();
    }

    /// <summary>
    /// Information about a synced address
    /// </summary>
    public class SyncedAddressInfo
    {
        public int CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? FromLoadNumber { get; set; }
    }

    /// <summary>
    /// Request to apply an AI suggestion
    /// </summary>
    public class ApplySuggestionRequest
    {
        public int CustomerId { get; set; }
        public string? Province { get; set; }
        public string? City { get; set; }
        public string? Address { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
    }
}
