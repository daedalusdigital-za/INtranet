using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.CRM;

namespace ProjectTracker.API.Services
{
    public interface IDatabaseSeederService
    {
        Task SeedEmployeesAsync();
    }

    public class DatabaseSeederService : IDatabaseSeederService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DatabaseSeederService> _logger;

        public DatabaseSeederService(ApplicationDbContext context, ILogger<DatabaseSeederService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task SeedEmployeesAsync()
        {
            _logger.LogInformation("Starting employee seed process...");

            // Default password hash for "Welcome123!"
            var defaultPasswordHash = BCrypt.Net.BCrypt.HashPassword("Welcome123!");

            // Step 1: Create Departments
            await CreateDepartmentsAsync();

            // Step 2: Create Operating Companies
            await CreateOperatingCompaniesAsync();

            // Step 3: Create Employees
            var employees = GetEmployeeData();
            var createdCount = 0;
            var updatedCount = 0;

            foreach (var emp in employees)
            {
                try
                {
                    var result = await CreateOrUpdateEmployeeAsync(emp, defaultPasswordHash);
                    if (result == "created") createdCount++;
                    else if (result == "updated") updatedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error creating employee {Name}", emp.Name);
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Seed complete: {Created} created, {Updated} updated", createdCount, updatedCount);
        }

        private async Task CreateDepartmentsAsync()
        {
            var departments = new[] { "Reception", "Accounts", "Sales", "Stock", "Logistics", "Production", "Marketing", "Finance", "Training" };

            foreach (var name in departments)
            {
                if (!await _context.Departments.AnyAsync(d => d.Name == name))
                {
                    _context.Departments.Add(new Department { Name = name });
                    _logger.LogInformation("Created department: {Name}", name);
                }
            }
            await _context.SaveChangesAsync();
        }

        private async Task CreateOperatingCompaniesAsync()
        {
            var companies = new[]
            {
                ("Access Medical", "ACCESS", "Access Medical supplies and equipment"),
                ("Promed Technologies", "PROMED", "Promed Technologies healthcare solutions"),
                ("Promed Pharmacare", "PHARMA", "Promed Pharmacare pharmaceutical products"),
                ("Sebenzani Trading", "SEBENZANI", "Sebenzani Trading distribution"),
                ("SA Wellness", "SAWELLNESS", "SA Wellness health and wellness")
            };

            foreach (var (name, code, description) in companies)
            {
                if (!await _context.OperatingCompanies.AnyAsync(c => c.Code == code))
                {
                    _context.OperatingCompanies.Add(new OperatingCompany
                    {
                        Name = name,
                        Code = code,
                        Description = description,
                        IsActive = true
                    });
                    _logger.LogInformation("Created company: {Name}", name);
                }
            }
            await _context.SaveChangesAsync();
        }

        private async Task<string> CreateOrUpdateEmployeeAsync(EmployeeSeedData emp, string passwordHash)
        {
            var existingUser = await _context.Users
                .Include(u => u.Extensions)
                .FirstOrDefaultAsync(u => u.Email == emp.Email);

            var department = await _context.Departments.FirstOrDefaultAsync(d => d.Name == emp.Department);

            if (existingUser == null)
            {
                // Create new user
                var user = new User
                {
                    Name = emp.Name,
                    Surname = emp.Surname ?? "",
                    Email = emp.Email,
                    PasswordHash = passwordHash,
                    Role = "Employee",
                    Title = emp.Title,
                    DepartmentId = department?.DepartmentId,
                    IsActive = true
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                // Create extensions
                await CreateExtensionsForUserAsync(user.UserId, emp.Extensions);

                // Link to companies
                await LinkUserToCompaniesAsync(user.UserId, emp.Companies);

                _logger.LogInformation("Created user: {Name} {Surname} ({Email})", emp.Name, emp.Surname, emp.Email);
                return "created";
            }
            else
            {
                // Update extensions if needed
                await CreateExtensionsForUserAsync(existingUser.UserId, emp.Extensions);

                // Update company links if needed
                await LinkUserToCompaniesAsync(existingUser.UserId, emp.Companies);

                return "updated";
            }
        }

        private async Task CreateExtensionsForUserAsync(int userId, string[]? extensions)
        {
            if (extensions == null || extensions.Length == 0) return;

            var isPrimary = true;
            foreach (var extNum in extensions)
            {
                if (string.IsNullOrWhiteSpace(extNum)) continue;

                var existing = await _context.Extensions
                    .FirstOrDefaultAsync(e => e.ExtensionNumber == extNum);

                if (existing == null)
                {
                    _context.Extensions.Add(new Extension
                    {
                        ExtensionNumber = extNum,
                        Label = "Direct Line",
                        ExtensionType = "Phone",
                        UserId = userId,
                        IsActive = true,
                        IsPrimary = isPrimary
                    });
                    _logger.LogInformation("Created extension {Ext} for user {UserId}", extNum, userId);
                }
                else if (existing.UserId == null)
                {
                    existing.UserId = userId;
                    existing.IsPrimary = isPrimary;
                    existing.UpdatedAt = DateTime.UtcNow;
                }

                isPrimary = false;
            }
            await _context.SaveChangesAsync();
        }

        private async Task LinkUserToCompaniesAsync(int userId, string[]? companyCodes)
        {
            if (companyCodes == null || companyCodes.Length == 0) return;

            var isPrimary = true;
            foreach (var code in companyCodes)
            {
                if (string.IsNullOrWhiteSpace(code)) continue;

                var company = await _context.OperatingCompanies.FirstOrDefaultAsync(c => c.Code == code);
                if (company == null) continue;

                var existing = await _context.StaffOperatingCompanies
                    .FirstOrDefaultAsync(s => s.StaffMemberId == userId && s.OperatingCompanyId == company.OperatingCompanyId);

                if (existing == null)
                {
                    _context.StaffOperatingCompanies.Add(new StaffOperatingCompany
                    {
                        StaffMemberId = userId,
                        OperatingCompanyId = company.OperatingCompanyId,
                        IsActive = true,
                        IsPrimaryCompany = isPrimary
                    });
                    _logger.LogInformation("Linked user {UserId} to company {Company}", userId, company.Name);
                }

                isPrimary = false;
            }
            await _context.SaveChangesAsync();
        }

        private List<EmployeeSeedData> GetEmployeeData()
        {
            return new List<EmployeeSeedData>
            {
                new("Reception", "Desk", "reception@accessmedical.co.za", "Receptionist", "Reception", new[] { "100", "200", "300", "700" }, new[] { "ACCESS", "PROMED" }),
                new("Ashveer", "", "ashveer@promedtechnologies.co.za", "Staff", "Sales", new[] { "102" }, new[] { "PROMED", "PHARMA" }),
                new("Velosha", "", "orders@promedtechnologies.co.za", "Orders", "Sales", new[] { "703" }, new[] { "PROMED" }),
                new("Shanice", "", "stock@promedpharmacare.co.za", "Stock Controller", "Stock", new[] { "103" }, new[] { "PHARMA" }),
                new("Mamo", "", "acconts11@promedtechnologies.co.za", "Accounts", "Accounts", new[] { "104" }, new[] { "PROMED", "ACCESS" }),
                new("Nhlonipho", "", "accounts1@promedtechnologies.co.za", "Accounts", "Accounts", new[] { "105" }, new[] { "PROMED" }),
                new("Nduduzo", "", "accounts5@promedtechnologies.co.za", "Accounts", "Accounts", new[] { "107" }, new[] { "PROMED" }),
                new("Karishma", "", "production1@promedpharmare.co.za", "Production", "Production", new[] { "108" }, new[] { "PROMED" }),
                new("Calvin", "", "marketing@promedtechnologie.co.za", "Marketing", "Marketing", new[] { "109" }, new[] { "PROMED" }),
                new("Norel", "", "norel@accessmedical.co.za", "Staff", "Sales", new[] { "110" }, new[] { "ACCESS" }),
                new("Xoli", "", "logistics1@promedtechnologies.co.za", "Logistics", "Logistics", new[] { "111" }, new[] { "PROMED" }),
                new("Abby", "", "abbigail@promedtechnologies.co.za", "Staff", "Sales", new[] { "112" }, new[] { "PROMED" }),
                new("Karusha", "", "karusha@promedtechnologies.co.za", "Staff", "Sales", new[] { "113" }, new[] { "PROMED" }),
                new("Buancha", "", "buancha@promedtechnologies.co.za", "Staff", "Sales", new[] { "114" }, new[] { "PROMED" }),
                new("Deon", "", "logistics3@promedtechnologies.co.za", "Logistics", "Logistics", new[] { "115" }, new[] { "PROMED" }),
                new("Coleen", "", "coleen@promedtechnologies.co.za", "Accounts", "Accounts", new[] { "116" }, new[] { "PROMED" }),
                new("Anesh", "", "logistics2@promedtechnologies.co.za", "Logistics", "Logistics", new[] { "117" }, new[] { "PROMED" }),
                new("Jennifer", "Stock", "stock@accessmedical.co.za", "Stock Controller", "Stock", new[] { "118" }, new[] { "PROMED" }),
                new("Mbali", "Finance", "accounts10@promedtechnologies.co.za", "Finance", "Finance", new[] { "201" }, new[] { "ACCESS", "PROMED" }),
                new("Mandy", "", "mandy@accessmedical.co.za", "Staff", "Sales", new[] { "707" }, new[] { "ACCESS", "PROMED" }),
                new("Ahistar", "", "sales1@promedpharmacare.co.za", "Sales", "Sales", new[] { "203" }, new[] { "ACCESS", "SEBENZANI" }),
                new("Maksooda", "", "maksooda@promedtechnologies.co.za", "Staff", "Sales", new[] { "206" }, new[] { "PROMED" }),
                new("Nash", "", "nash22.govender@gmail.com", "Staff", "Sales", new[] { "911" }, new[] { "PROMED" }),
                new("Duran", "", "duran24govender@gmail.com", "Staff", "Sales", new[] { "666" }, new[] { "ACCESS" }),
                new("Jerwayne", "", "jerwaynegovender@gmail.com", "Staff", "Sales", Array.Empty<string>(), new[] { "SEBENZANI" }),
                new("Kajal", "", "acconts2@accessmedical.co.za", "Accounts", "Accounts", new[] { "205" }, new[] { "PROMED" }),
                new("Noori", "", "accounts8@promedtechnologies.co.za", "Accounts", "Accounts", new[] { "207" }, new[] { "PROMED" }),
                new("Hlengiwe", "", "hlengiwe@promedtechnologies.co.za", "Staff", "Sales", new[] { "208" }, new[] { "PROMED" }),
                new("Mpilo", "", "mpilo@promedtechnologies.co.za", "Staff", "Sales", new[] { "210" }, new[] { "PROMED" }),
                new("Pearl", "", "pearl@accessmedical.co.za", "Staff", "Sales", new[] { "209" }, new[] { "ACCESS" }),
                new("Thando", "", "ryan@promedtechnologies.co.za", "Staff", "Sales", new[] { "212" }, new[] { "ACCESS" }),
                new("Sisanda", "", "stock1@sebenzanitrading.com", "Stock Controller", "Stock", new[] { "301" }, new[] { "ACCESS", "PHARMA" }),
                new("Mabaso", "", "wonder@sawellness.prop.sa", "Staff", "Sales", new[] { "302" }, new[] { "SAWELLNESS" }),
                new("Jennifer", "", "jennifer@accessmedical.co.za", "Staff", "Sales", new[] { "303" }, new[] { "ACCESS", "PROMED" }),
                new("Sydney", "", "stock@promedtechnologies.co.za", "Stock Controller", "Stock", new[] { "304" }, new[] { "PROMED" }),
                new("Vinola", "", "accounts7@promedtechnologies.co.za", "Accounts", "Accounts", new[] { "305" }, new[] { "PROMED" }),
                new("Joyce", "", "sales1@accessmedical.co.za", "Sales", "Sales", new[] { "704" }, new[] { "PROMED" }),
                new("Maggie", "", "maggie@promedtechnologies.co.za", "Staff", "Sales", new[] { "705" }, new[] { "PROMED" }),
                new("Trisha", "", "trisha@promedechnologies.co.za", "Staff", "Sales", new[] { "401" }, new[] { "PROMED" }),
                new("Sphindile", "", "sphindile@promedtechnologies.co.za", "Staff", "Sales", new[] { "404" }, new[] { "PROMED" }),
                new("Nomvelo", "", "sales2@promedtechnologies.co.za", "Sales", "Sales", new[] { "714" }, new[] { "ACCESS" }),
                new("Thabile", "", "thabile@promedtechnologies.co.za", "Staff", "Sales", new[] { "403" }, new[] { "PROMED", "ACCESS" }),
                new("Mpume", "", "sales3@promedtechnologies.co.za", "Sales", "Sales", new[] { "706" }, new[] { "PROMED" }),
                new("Nelly", "", "sales2@accessmedical.co.za", "Sales", "Sales", new[] { "710" }, new[] { "PROMED" }),
                new("Anisha", "", "anisha@promedtechnologies.co.za", "Staff", "Sales", new[] { "409" }, new[] { "PROMED" }),
                new("Akhona", "", "akhona@promedtechnologies.co.za", "Staff", "Sales", new[] { "701" }, new[] { "PROMED" }),
                new("Aldrisha", "", "aldrisha@promedtechnologies.co.za", "Staff", "Sales", new[] { "708" }, new[] { "PROMED" }),
                new("Nkosikhona", "", "sales7@promedtechnologies.co.za", "Sales", "Sales", new[] { "712" }, new[] { "PROMED" }),
                new("Swelihle", "", "swelihle@promedtechnologies.co.za", "Staff", "Sales", new[] { "713" }, new[] { "PROMED" }),
                new("Keith", "", "sales1@promedtechnologies.co.za", "Sales", "Sales", new[] { "715" }, new[] { "PROMED" }),
                new("Nkosikhona", "B", "sales10@promedtechnologies.co.za", "Sales", "Sales", new[] { "716" }, new[] { "PROMED" }),
                new("Nosipho", "", "sales16@promedtechnologies.co.za", "Sales", "Sales", new[] { "718" }, new[] { "PROMED" }),
                new("Sthabile", "", "sales5@accessmedical.co.za", "Sales", "Sales", new[] { "725" }, new[] { "ACCESS" }),
                new("Emeline", "", "sales4@promedtechnologies.co.za", "Sales", "Sales", new[] { "726" }, new[] { "SEBENZANI" }),
                new("Mandisa", "", "sales11@promedtechnologies.co.za", "Sales", "Sales", new[] { "728" }, new[] { "PROMED" }),
                new("Vuyiswa", "", "sales3@sebenzanitrading.com", "Sales", "Sales", new[] { "724" }, new[] { "SEBENZANI" }),
                new("Zandile", "Msomi", "sales1@sebenzanitrading.com", "Sales", "Sales", new[] { "730" }, new[] { "SEBENZANI" }),
                new("Zandile", "Mkhize", "sales9@promedtechnologies.co.za", "Sales", "Sales", new[] { "729" }, new[] { "SEBENZANI" }),
                new("Cynthia", "", "sales8@accessmedical.co.za", "Sales", "Sales", new[] { "702" }, new[] { "PROMED" }),
                new("Thabsile", "", "thabsile@accessmedical.co.za", "Staff", "Sales", new[] { "727" }, new[] { "ACCESS" }),
                new("Hlaka", "", "training@promedtechnlogies.co.za", "Training", "Training", new[] { "722" }, new[] { "PROMED" }),
                new("Pinky", "", "sales4@accessmedical.co.za", "Sales", "Sales", new[] { "721" }, new[] { "ACCESS" }),
                new("Smangele", "", "sales3@accessmedical.co.za", "Sales", "Sales", new[] { "732" }, new[] { "ACCESS" }),
                new("Amanda", "", "sales10@accessmedical.co.za", "Sales", "Sales", new[] { "709" }, new[] { "ACCESS" }),
                new("Lisa", "", "sales6@promedtechnologies.co.za", "Sales", "Sales", new[] { "731" }, new[] { "ACCESS" })
            };
        }

        private record EmployeeSeedData(
            string Name,
            string? Surname,
            string Email,
            string Title,
            string Department,
            string[]? Extensions,
            string[]? Companies
        );
    }
}
