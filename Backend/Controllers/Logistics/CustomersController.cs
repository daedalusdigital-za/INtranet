using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;

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
        public async Task<ActionResult<IEnumerable<CustomerDto>>> GetCustomers()
        {
            var customers = await _context.LogisticsCustomers
                .Select(c => new CustomerDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    CompanyRegistration = c.CompanyRegistration,
                    VatNumber = c.VatNumber,
                    ContactPerson = c.ContactPerson,
                    Email = c.Email,
                    PhoneNumber = c.PhoneNumber,
                    MobileNumber = c.MobileNumber,
                    PhysicalAddress = c.PhysicalAddress,
                    PostalAddress = c.PostalAddress,
                    City = c.City,
                    PostalCode = c.PostalCode,
                    Province = c.Province,
                    Country = c.Country,
                    Status = c.Status,
                    PaymentTerms = c.PaymentTerms,
                    CreditLimit = c.CreditLimit
                })
                .ToListAsync();

            return Ok(customers);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CustomerDto>> GetCustomer(int id)
        {
            var customer = await _context.LogisticsCustomers
                .Where(c => c.Id == id)
                .Select(c => new CustomerDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    CompanyRegistration = c.CompanyRegistration,
                    VatNumber = c.VatNumber,
                    ContactPerson = c.ContactPerson,
                    Email = c.Email,
                    PhoneNumber = c.PhoneNumber,
                    MobileNumber = c.MobileNumber,
                    PhysicalAddress = c.PhysicalAddress,
                    PostalAddress = c.PostalAddress,
                    City = c.City,
                    PostalCode = c.PostalCode,
                    Province = c.Province,
                    Country = c.Country,
                    Status = c.Status,
                    PaymentTerms = c.PaymentTerms,
                    CreditLimit = c.CreditLimit
                })
                .FirstOrDefaultAsync();

            if (customer == null)
                return NotFound();

            return Ok(customer);
        }

        [HttpPost]
        public async Task<ActionResult<CustomerDto>> CreateCustomer(CreateCustomerDto dto)
        {
            var customer = new Customer
            {
                Name = dto.Name,
                CompanyRegistration = dto.CompanyRegistration,
                VatNumber = dto.VatNumber,
                ContactPerson = dto.ContactPerson,
                Email = dto.Email,
                PhoneNumber = dto.PhoneNumber,
                MobileNumber = dto.MobileNumber,
                PhysicalAddress = dto.PhysicalAddress,
                PostalAddress = dto.PostalAddress,
                City = dto.City,
                PostalCode = dto.PostalCode,
                Province = dto.Province,
                Country = dto.Country ?? "South Africa",
                PaymentTerms = dto.PaymentTerms,
                CreditLimit = dto.CreditLimit,
                Status = "Active"
            };

            _context.LogisticsCustomers.Add(customer);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, customer);
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
    }
}
