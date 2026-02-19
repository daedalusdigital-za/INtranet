using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CompaniesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public CompaniesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/companies/all
        [HttpGet("all")]
        public async Task<ActionResult> GetAllOperatingCompanies()
        {
            var companies = await _context.OperatingCompanies
                .Where(oc => oc.IsActive)
                .OrderBy(oc => oc.Name)
                .Select(oc => new
                {
                    oc.OperatingCompanyId,
                    oc.Name,
                    oc.Code,
                    oc.Description,
                    oc.LogoUrl,
                    oc.PrimaryColor,
                    oc.IsActive
                })
                .ToListAsync();

            return Ok(companies);
        }
    }
}
