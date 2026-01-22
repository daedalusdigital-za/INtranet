using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ContractsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ContractsController> _logger;

    public ContractsController(ApplicationDbContext context, ILogger<ContractsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get all government contracts with optional filtering
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ContractsResponse>> GetContracts(
        [FromQuery] string? companyCode = null,
        [FromQuery] string? status = null,
        [FromQuery] string? category = null,
        [FromQuery] bool? activeOnly = null)
    {
        var query = _context.GovernmentContracts.AsQueryable();

        if (!string.IsNullOrEmpty(companyCode))
        {
            query = query.Where(c => c.CompanyCode == companyCode);
        }

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(c => c.Status == status);
        }

        if (!string.IsNullOrEmpty(category))
        {
            query = query.Where(c => c.Category == category);
        }

        if (activeOnly == true)
        {
            query = query.Where(c => c.IsActive);
        }

        var contracts = await query
            .OrderByDescending(c => c.IsActive)
            .ThenBy(c => c.ExpiryDate)
            .ToListAsync();

        // Calculate summary statistics
        var activeContracts = contracts.Where(c => c.IsActive).ToList();
        var expiringContracts = activeContracts
            .Where(c => c.ExpiryDate.HasValue && c.ExpiryDate.Value <= DateTime.UtcNow.AddMonths(6))
            .ToList();

        var response = new ContractsResponse
        {
            Contracts = contracts.Select(c => MapToDto(c)).ToList(),
            Summary = new ContractsSummary
            {
                TotalContracts = contracts.Count,
                ActiveContracts = activeContracts.Count,
                ExpiredContracts = contracts.Count(c => !c.IsActive),
                ExpiringSoon = expiringContracts.Count,
                Categories = contracts
                    .Where(c => !string.IsNullOrEmpty(c.Category))
                    .GroupBy(c => c.Category)
                    .Select(g => new CategoryCount { Category = g.Key!, Count = g.Count() })
                    .ToList(),
                CompaniesSummary = contracts
                    .GroupBy(c => new { c.CompanyCode, c.CompanyName })
                    .Select(g => new CompanyContractSummary
                    {
                        CompanyCode = g.Key.CompanyCode,
                        CompanyName = g.Key.CompanyName,
                        TotalContracts = g.Count(),
                        ActiveContracts = g.Count(c => c.IsActive)
                    })
                    .ToList()
            }
        };

        return Ok(response);
    }

    /// <summary>
    /// Get contracts by company code
    /// </summary>
    [HttpGet("company/{companyCode}")]
    public async Task<ActionResult<List<ContractDto>>> GetContractsByCompany(string companyCode)
    {
        var contracts = await _context.GovernmentContracts
            .Where(c => c.CompanyCode == companyCode.ToUpper())
            .OrderByDescending(c => c.IsActive)
            .ThenBy(c => c.ExpiryDate)
            .ToListAsync();

        return Ok(contracts.Select(c => MapToDto(c)).ToList());
    }

    /// <summary>
    /// Get contracts expiring within specified months
    /// </summary>
    [HttpGet("expiring")]
    public async Task<ActionResult<List<ContractDto>>> GetExpiringContracts([FromQuery] int months = 6)
    {
        var cutoffDate = DateTime.UtcNow.AddMonths(months);
        
        var contracts = await _context.GovernmentContracts
            .Where(c => c.IsActive && c.ExpiryDate.HasValue && c.ExpiryDate.Value <= cutoffDate)
            .OrderBy(c => c.ExpiryDate)
            .ToListAsync();

        return Ok(contracts.Select(c => MapToDto(c)).ToList());
    }

    /// <summary>
    /// Get a single contract by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ContractDto>> GetContract(int id)
    {
        var contract = await _context.GovernmentContracts.FindAsync(id);
        
        if (contract == null)
        {
            return NotFound();
        }

        return Ok(MapToDto(contract));
    }

    /// <summary>
    /// Create a new contract
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<ContractDto>> CreateContract([FromBody] CreateContractDto dto)
    {
        var contract = new GovernmentContract
        {
            CompanyCode = dto.CompanyCode.ToUpper(),
            CompanyName = dto.CompanyName,
            TenderNumber = dto.TenderNumber,
            Commodity = dto.Commodity,
            ContractDurationYears = dto.ContractDurationYears,
            StartDate = dto.StartDate,
            ExpiryDate = dto.ExpiryDate,
            IsActive = dto.IsActive,
            Status = DetermineStatus(dto.IsActive, dto.ExpiryDate),
            IssuingAuthority = dto.IssuingAuthority,
            Notes = dto.Notes,
            EstimatedAnnualValue = dto.EstimatedAnnualValue,
            Category = dto.Category,
            CreatedAt = DateTime.UtcNow
        };

        _context.GovernmentContracts.Add(contract);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created contract {TenderNumber} for {Company}", contract.TenderNumber, contract.CompanyName);

        return CreatedAtAction(nameof(GetContract), new { id = contract.Id }, MapToDto(contract));
    }

    /// <summary>
    /// Update an existing contract
    /// </summary>
    [HttpPut("{id}")]
    public async Task<ActionResult<ContractDto>> UpdateContract(int id, [FromBody] UpdateContractDto dto)
    {
        var contract = await _context.GovernmentContracts.FindAsync(id);
        
        if (contract == null)
        {
            return NotFound();
        }

        if (!string.IsNullOrEmpty(dto.CompanyCode)) contract.CompanyCode = dto.CompanyCode.ToUpper();
        if (!string.IsNullOrEmpty(dto.CompanyName)) contract.CompanyName = dto.CompanyName;
        if (!string.IsNullOrEmpty(dto.TenderNumber)) contract.TenderNumber = dto.TenderNumber;
        if (!string.IsNullOrEmpty(dto.Commodity)) contract.Commodity = dto.Commodity;
        if (dto.ContractDurationYears.HasValue) contract.ContractDurationYears = dto.ContractDurationYears.Value;
        if (dto.StartDate.HasValue) contract.StartDate = dto.StartDate;
        if (dto.ExpiryDate.HasValue) contract.ExpiryDate = dto.ExpiryDate;
        if (dto.IsActive.HasValue) contract.IsActive = dto.IsActive.Value;
        if (!string.IsNullOrEmpty(dto.IssuingAuthority)) contract.IssuingAuthority = dto.IssuingAuthority;
        if (dto.Notes != null) contract.Notes = dto.Notes;
        if (dto.EstimatedAnnualValue.HasValue) contract.EstimatedAnnualValue = dto.EstimatedAnnualValue;
        if (!string.IsNullOrEmpty(dto.Category)) contract.Category = dto.Category;

        contract.Status = DetermineStatus(contract.IsActive, contract.ExpiryDate);
        contract.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        _logger.LogInformation("Updated contract {Id} - {TenderNumber}", id, contract.TenderNumber);

        return Ok(MapToDto(contract));
    }

    /// <summary>
    /// Delete a contract
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteContract(int id)
    {
        var contract = await _context.GovernmentContracts.FindAsync(id);
        
        if (contract == null)
        {
            return NotFound();
        }

        _context.GovernmentContracts.Remove(contract);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Deleted contract {Id} - {TenderNumber}", id, contract.TenderNumber);

        return NoContent();
    }

    /// <summary>
    /// Get available categories
    /// </summary>
    [HttpGet("categories")]
    public async Task<ActionResult<List<string>>> GetCategories()
    {
        var categories = await _context.GovernmentContracts
            .Where(c => !string.IsNullOrEmpty(c.Category))
            .Select(c => c.Category!)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync();

        return Ok(categories);
    }

    /// <summary>
    /// Refresh contract statuses (mark expired contracts)
    /// </summary>
    [HttpPost("refresh-status")]
    public async Task<ActionResult> RefreshStatuses()
    {
        var now = DateTime.UtcNow;
        var updated = 0;

        // Mark expired contracts
        var expiredContracts = await _context.GovernmentContracts
            .Where(c => c.IsActive && c.ExpiryDate.HasValue && c.ExpiryDate.Value < now)
            .ToListAsync();

        foreach (var contract in expiredContracts)
        {
            contract.IsActive = false;
            contract.Status = "Expired";
            contract.UpdatedAt = now;
            updated++;
        }

        // Update status for expiring soon contracts
        var expiringContracts = await _context.GovernmentContracts
            .Where(c => c.IsActive && c.ExpiryDate.HasValue && 
                   c.ExpiryDate.Value >= now && 
                   c.ExpiryDate.Value <= now.AddMonths(6))
            .ToListAsync();

        foreach (var contract in expiringContracts)
        {
            contract.Status = "Expiring Soon";
            contract.UpdatedAt = now;
            updated++;
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("Refreshed status for {Count} contracts", updated);

        return Ok(new { message = $"Updated {updated} contract(s)", updated });
    }

    private static string DetermineStatus(bool isActive, DateTime? expiryDate)
    {
        if (!isActive) return "Expired";
        if (!expiryDate.HasValue) return "Active";
        if (expiryDate.Value < DateTime.UtcNow) return "Expired";
        if (expiryDate.Value <= DateTime.UtcNow.AddMonths(6)) return "Expiring Soon";
        return "Active";
    }

    private static ContractDto MapToDto(GovernmentContract c)
    {
        return new ContractDto
        {
            Id = c.Id,
            CompanyCode = c.CompanyCode,
            CompanyName = c.CompanyName,
            TenderNumber = c.TenderNumber,
            Commodity = c.Commodity,
            ContractDurationYears = c.ContractDurationYears,
            StartDate = c.StartDate,
            ExpiryDate = c.ExpiryDate,
            IsActive = c.IsActive,
            Status = c.Status,
            IssuingAuthority = c.IssuingAuthority,
            Notes = c.Notes,
            EstimatedAnnualValue = c.EstimatedAnnualValue,
            Category = c.Category,
            DaysUntilExpiry = c.ExpiryDate.HasValue 
                ? (int)(c.ExpiryDate.Value - DateTime.UtcNow).TotalDays 
                : null
        };
    }
}

// DTOs
public class ContractDto
{
    public int Id { get; set; }
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string TenderNumber { get; set; } = string.Empty;
    public string Commodity { get; set; } = string.Empty;
    public int ContractDurationYears { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public bool IsActive { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? IssuingAuthority { get; set; }
    public string? Notes { get; set; }
    public decimal? EstimatedAnnualValue { get; set; }
    public string? Category { get; set; }
    public int? DaysUntilExpiry { get; set; }
}

public class CreateContractDto
{
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public string TenderNumber { get; set; } = string.Empty;
    public string Commodity { get; set; } = string.Empty;
    public int ContractDurationYears { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public bool IsActive { get; set; } = true;
    public string? IssuingAuthority { get; set; }
    public string? Notes { get; set; }
    public decimal? EstimatedAnnualValue { get; set; }
    public string? Category { get; set; }
}

public class UpdateContractDto
{
    public string? CompanyCode { get; set; }
    public string? CompanyName { get; set; }
    public string? TenderNumber { get; set; }
    public string? Commodity { get; set; }
    public int? ContractDurationYears { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public bool? IsActive { get; set; }
    public string? IssuingAuthority { get; set; }
    public string? Notes { get; set; }
    public decimal? EstimatedAnnualValue { get; set; }
    public string? Category { get; set; }
}

public class ContractsResponse
{
    public List<ContractDto> Contracts { get; set; } = new();
    public ContractsSummary Summary { get; set; } = new();
}

public class ContractsSummary
{
    public int TotalContracts { get; set; }
    public int ActiveContracts { get; set; }
    public int ExpiredContracts { get; set; }
    public int ExpiringSoon { get; set; }
    public List<CategoryCount> Categories { get; set; } = new();
    public List<CompanyContractSummary> CompaniesSummary { get; set; } = new();
}

public class CategoryCount
{
    public string Category { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class CompanyContractSummary
{
    public string CompanyCode { get; set; } = string.Empty;
    public string CompanyName { get; set; } = string.Empty;
    public int TotalContracts { get; set; }
    public int ActiveContracts { get; set; }
}
