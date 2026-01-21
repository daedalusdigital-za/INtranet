using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using System.Globalization;
using System.Text.Json;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CustomersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CustomersController> _logger;

        public CustomersController(ApplicationDbContext context, ILogger<CustomersController> logger)
        {
            _context = context;
            _logger = logger;
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
    }
}
