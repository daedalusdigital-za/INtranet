using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using System.Text.Json;

namespace ProjectTracker.API.Services
{
    public class CustomerProvinceMapperService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CustomerProvinceMapperService> _logger;

        // Province code mapping based on customer number prefix
        private static readonly Dictionary<string, (string Code, string Name)> PrefixToProvince = new()
        {
            { "01-", ("KZN", "KwaZulu-Natal") },
            { "02-", ("LP", "Limpopo") },
            { "03-", ("NW", "North West") },
            { "04-", ("FS", "Free State") },
            { "05-", ("WC", "Western Cape") },
            { "06-", ("EC", "Eastern Cape") },
            { "07-", ("NC", "Northern Cape") },
            { "08-", ("GP", "Gauteng") },
            { "09-", ("MP", "Mpumalanga") }
        };

        // Keywords in customer names that indicate provinces
        private static readonly Dictionary<string, (string Code, string Name, string City)> KeywordMappings = new()
        {
            // KZN
            { "wentworth", ("KZN", "KwaZulu-Natal", "Durban") },
            { "king cetshwayo", ("KZN", "KwaZulu-Natal", "Empangeni") },
            { "harry gwala", ("KZN", "KwaZulu-Natal", "Pietermaritzburg") },
            { "edendale", ("KZN", "KwaZulu-Natal", "Pietermaritzburg") },
            { "g.j crookes", ("KZN", "KwaZulu-Natal", "Scottburgh") },
            { "gj crookes", ("KZN", "KwaZulu-Natal", "Scottburgh") },
            { "gjgm", ("KZN", "KwaZulu-Natal", "Scottburgh") },
            { "mseleni", ("KZN", "KwaZulu-Natal", "Ingwavuma") },
            { "st margarets", ("KZN", "KwaZulu-Natal", "Durban") },
            { "durban", ("KZN", "KwaZulu-Natal", "Durban") },
            { "pietermaritzburg", ("KZN", "KwaZulu-Natal", "Pietermaritzburg") },
            { "newcastle", ("KZN", "KwaZulu-Natal", "Newcastle") },
            { "ladysmith", ("KZN", "KwaZulu-Natal", "Ladysmith") },
            { "greytown", ("KZN", "KwaZulu-Natal", "Greytown") },
            { "empangeni", ("KZN", "KwaZulu-Natal", "Empangeni") },
            { "eshowe", ("KZN", "KwaZulu-Natal", "Eshowe") },
            { "richards bay", ("KZN", "KwaZulu-Natal", "Richards Bay") },
            { "dundee", ("KZN", "KwaZulu-Natal", "Dundee") },
            { "glencoe", ("KZN", "KwaZulu-Natal", "Glencoe") },
            { "stanger", ("KZN", "KwaZulu-Natal", "Stanger") },
            { "tongaat", ("KZN", "KwaZulu-Natal", "Tongaat") },
            { "verulam", ("KZN", "KwaZulu-Natal", "Verulam") },
            { "kzn", ("KZN", "KwaZulu-Natal", "") },
            
            // LP
            { "mankweng", ("LP", "Limpopo", "Polokwane") },
            { "lppd", ("LP", "Limpopo", "Polokwane") },
            { "polokwane", ("LP", "Limpopo", "Polokwane") },
            { "pietersburg", ("LP", "Limpopo", "Polokwane") },
            { "tzaneen", ("LP", "Limpopo", "Tzaneen") },
            { "thohoyandou", ("LP", "Limpopo", "Thohoyandou") },
            { "mokopane", ("LP", "Limpopo", "Mokopane") },
            { "phalaborwa", ("LP", "Limpopo", "Phalaborwa") },
            { "lebowakgomo", ("LP", "Limpopo", "Lebowakgomo") },
            { "giyani", ("LP", "Limpopo", "Giyani") },
            
            // FS
            { "pelonomi", ("FS", "Free State", "Bloemfontein") },
            { "universitas", ("FS", "Free State", "Bloemfontein") },
            { "bloemfontein", ("FS", "Free State", "Bloemfontein") },
            { "fs health", ("FS", "Free State", "Bloemfontein") },
            { "free state", ("FS", "Free State", "Bloemfontein") },
            { "welkom", ("FS", "Free State", "Welkom") },
            { "kroonstad", ("FS", "Free State", "Kroonstad") },
            { "bethlehem", ("FS", "Free State", "Bethlehem") },
            { "sasolburg", ("FS", "Free State", "Sasolburg") },
            
            // EC
            { "port elizabeth", ("EC", "Eastern Cape", "Port Elizabeth") },
            { "gqeberha", ("EC", "Eastern Cape", "Gqeberha") },
            { "east london", ("EC", "Eastern Cape", "East London") },
            { "lukhanji", ("EC", "Eastern Cape", "Queenstown") },
            { "queenstown", ("EC", "Eastern Cape", "Queenstown") },
            { "mthatha", ("EC", "Eastern Cape", "Mthatha") },
            { "umtata", ("EC", "Eastern Cape", "Mthatha") },
            { "frere", ("EC", "Eastern Cape", "East London") },
            { "eastern cape", ("EC", "Eastern Cape", "") },
            
            // NC
            { "pixley", ("NC", "Northern Cape", "De Aar") },
            { "nc health", ("NC", "Northern Cape", "Kimberley") },
            { "kimberley", ("NC", "Northern Cape", "Kimberley") },
            { "upington", ("NC", "Northern Cape", "Upington") },
            { "northern cape", ("NC", "Northern Cape", "Kimberley") },
            
            // GP
            { "pholosong", ("GP", "Gauteng", "Tembisa") },
            { "tembisa", ("GP", "Gauteng", "Tembisa") },
            { "charlotte maxeke", ("GP", "Gauteng", "Johannesburg") },
            { "chris hani baragwanath", ("GP", "Gauteng", "Soweto") },
            { "steve biko", ("GP", "Gauteng", "Pretoria") },
            { "kalafong", ("GP", "Gauteng", "Pretoria") },
            { "johannesburg", ("GP", "Gauteng", "Johannesburg") },
            { "pretoria", ("GP", "Gauteng", "Pretoria") },
            { "tshwane", ("GP", "Gauteng", "Pretoria") },
            { "sandton", ("GP", "Gauteng", "Sandton") },
            { "centurion", ("GP", "Gauteng", "Centurion") },
            { "midrand", ("GP", "Gauteng", "Midrand") },
            { "benoni", ("GP", "Gauteng", "Benoni") },
            { "boksburg", ("GP", "Gauteng", "Boksburg") },
            { "gauteng", ("GP", "Gauteng", "") },
            
            // MP
            { "nelspruit", ("MP", "Mpumalanga", "Nelspruit") },
            { "mbombela", ("MP", "Mpumalanga", "Mbombela") },
            { "witbank", ("MP", "Mpumalanga", "Emalahleni") },
            { "emalahleni", ("MP", "Mpumalanga", "Emalahleni") },
            { "secunda", ("MP", "Mpumalanga", "Secunda") },
            { "mpumalanga", ("MP", "Mpumalanga", "") },
            
            // NW
            { "rustenburg", ("NW", "North West", "Rustenburg") },
            { "potchefstroom", ("NW", "North West", "Potchefstroom") },
            { "klerksdorp", ("NW", "North West", "Klerksdorp") },
            { "mafikeng", ("NW", "North West", "Mafikeng") },
            { "mahikeng", ("NW", "North West", "Mahikeng") },
            { "north west", ("NW", "North West", "") },
            
            // WC
            { "cape town", ("WC", "Western Cape", "Cape Town") },
            { "stellenbosch", ("WC", "Western Cape", "Stellenbosch") },
            { "tygerberg", ("WC", "Western Cape", "Cape Town") },
            { "groote schuur", ("WC", "Western Cape", "Cape Town") },
            { "george", ("WC", "Western Cape", "George") },
            { "paarl", ("WC", "Western Cape", "Paarl") },
            { "worcester", ("WC", "Western Cape", "Worcester") },
            { "western cape", ("WC", "Western Cape", "Cape Town") },
        };

        public CustomerProvinceMapperService(
            ApplicationDbContext context,
            ILogger<CustomerProvinceMapperService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public class MappingResult
        {
            public int TotalCustomers { get; set; }
            public int Updated { get; set; }
            public int AlreadyMapped { get; set; }
            public int NoMatch { get; set; }
            public Dictionary<string, int> ProvinceBreakdown { get; set; } = new();
            public List<CustomerMapping> Mappings { get; set; } = new();
        }

        public class CustomerMapping
        {
            public int Id { get; set; }
            public string CustomerCode { get; set; } = "";
            public string CustomerName { get; set; } = "";
            public string MatchMethod { get; set; } = "";
            public string ProvinceCode { get; set; } = "";
            public string ProvinceName { get; set; } = "";
            public string City { get; set; } = "";
        }

        public async Task<MappingResult> MapCustomerProvinces(bool updateDatabase = true, int? limit = null)
        {
            var result = new MappingResult();
            
            var query = _context.LogisticsCustomers
                .Where(c => c.Province == null || c.Province == "");
                
            if (limit.HasValue)
                query = query.Take(limit.Value);

            var customers = await query.ToListAsync();
            result.TotalCustomers = customers.Count;

            _logger.LogInformation($"Processing {customers.Count} customers without province data");

            foreach (var customer in customers)
            {
                var mapping = new CustomerMapping
                {
                    Id = customer.Id,
                    CustomerCode = customer.CustomerCode ?? "",
                    CustomerName = customer.Name
                };

                // Try to match by customer code prefix first
                if (!string.IsNullOrEmpty(customer.CustomerCode))
                {
                    foreach (var (prefix, provinceInfo) in PrefixToProvince)
                    {
                        if (customer.CustomerCode.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        {
                            mapping.MatchMethod = "Prefix";
                            mapping.ProvinceCode = provinceInfo.Code;
                            mapping.ProvinceName = provinceInfo.Name;
                            
                            // Try to get city from keywords in name
                            var cityInfo = GetCityFromName(customer.Name);
                            mapping.City = cityInfo ?? "";
                            break;
                        }
                    }
                }

                // If no match by prefix, try keywords in customer name
                if (string.IsNullOrEmpty(mapping.ProvinceCode))
                {
                    var nameLower = customer.Name.ToLower();
                    
                    foreach (var (keyword, provinceInfo) in KeywordMappings)
                    {
                        if (nameLower.Contains(keyword))
                        {
                            mapping.MatchMethod = "Keyword";
                            mapping.ProvinceCode = provinceInfo.Code;
                            mapping.ProvinceName = provinceInfo.Name;
                            mapping.City = provinceInfo.City;
                            break;
                        }
                    }
                }

                // Also check addressLines for keywords
                if (string.IsNullOrEmpty(mapping.ProvinceCode) && !string.IsNullOrEmpty(customer.AddressLinesJson))
                {
                    try
                    {
                        var addressLines = JsonSerializer.Deserialize<List<string>>(customer.AddressLinesJson);
                        if (addressLines != null)
                        {
                            var fullAddress = string.Join(" ", addressLines).ToLower();
                            
                            foreach (var (keyword, provinceInfo) in KeywordMappings)
                            {
                                if (fullAddress.Contains(keyword))
                                {
                                    mapping.MatchMethod = "AddressLine";
                                    mapping.ProvinceCode = provinceInfo.Code;
                                    mapping.ProvinceName = provinceInfo.Name;
                                    mapping.City = provinceInfo.City;
                                    break;
                                }
                            }
                        }
                    }
                    catch { }
                }

                if (!string.IsNullOrEmpty(mapping.ProvinceCode))
                {
                    result.Updated++;
                    
                    if (!result.ProvinceBreakdown.ContainsKey(mapping.ProvinceCode))
                        result.ProvinceBreakdown[mapping.ProvinceCode] = 0;
                    result.ProvinceBreakdown[mapping.ProvinceCode]++;

                    if (updateDatabase)
                    {
                        customer.Province = mapping.ProvinceName;
                        customer.DeliveryProvince = mapping.ProvinceName;
                        if (!string.IsNullOrEmpty(mapping.City))
                        {
                            customer.City = mapping.City;
                            customer.DeliveryCity = mapping.City;
                        }
                        customer.UpdatedAt = DateTime.UtcNow;
                    }

                    _logger.LogInformation($"Mapped {customer.CustomerCode} to {mapping.ProvinceCode} ({mapping.MatchMethod})");
                }
                else
                {
                    result.NoMatch++;
                    mapping.MatchMethod = "NoMatch";
                }

                result.Mappings.Add(mapping);
            }

            if (updateDatabase)
            {
                await _context.SaveChangesAsync();
            }

            _logger.LogInformation($"Province mapping complete. Updated: {result.Updated}, NoMatch: {result.NoMatch}");
            return result;
        }

        private string? GetCityFromName(string name)
        {
            var nameLower = name.ToLower();
            
            foreach (var (keyword, provinceInfo) in KeywordMappings)
            {
                if (nameLower.Contains(keyword) && !string.IsNullOrEmpty(provinceInfo.City))
                {
                    return provinceInfo.City;
                }
            }
            
            return null;
        }
    }
}
