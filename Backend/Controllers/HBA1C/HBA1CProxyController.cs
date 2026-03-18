using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.DTOs.HBA1C;
using ProjectTracker.API.Services.HBA1C;

namespace ProjectTracker.API.Controllers.HBA1C
{
    [Authorize]
    [ApiController]
    [Route("api/hba1c")]
    public class HBA1CProxyController : ControllerBase
    {
        private readonly IHBA1CApiService _api;
        private readonly ILogger<HBA1CProxyController> _logger;

        public HBA1CProxyController(IHBA1CApiService api, ILogger<HBA1CProxyController> logger)
        {
            _api = api;
            _logger = logger;
        }

        // ====================================================================
        // Aggregated Dashboard - single call for the frontend
        // ====================================================================
        [HttpGet("dashboard")]
        public async Task<ActionResult<HBA1CProjectDashboard>> GetDashboard()
        {
            _logger.LogInformation("Fetching HBA1C project dashboard");

            // Fire all requests in parallel for speed
            var trainingStatsTask = _api.GetAsync<HBA1CTrainingStats>("api/Dashboard/GetTrainingStats");
            var nationalTotalsTask = _api.GetAsync<HBA1CNationalTotals>("api/Dashboard/GetNationalTotals");
            var provinceStatsTask = _api.GetAsync<HBA1CProvinceStatsWrapper>("api/Dashboard/GetProvinceStats");
            var equipmentStatsTask = _api.GetAsync<HBA1CEquipmentStatsWrapper>("api/Dashboard/GetEquipmentStats");
            var salesStatsTask = _api.GetAsync<HBA1CSalesStats>("api/Sales/GetDashboardStats");
            var recentSalesTask = _api.GetAsync<List<HBA1CSale>>("api/Sales/GetRecentSales", new() { { "limit", "10" } });
            var provincialDataTask = _api.GetAsync<List<HBA1CProvincialSalesData>>("api/Sales/GetProvincialData");
            var topProductsTask = _api.GetAsync<List<HBA1CTopProduct>>("api/Sales/GetTopProducts", new() { { "limit", "10" } });
            var inventoryStatsTask = _api.GetAsync<HBA1CInventoryStats>("api/Inventory/GetStats");
            var lowStockTask = _api.GetAsync<List<HBA1CInventoryItem>>("api/Inventory/GetLowStock");
            var recentTrainingsTask = _api.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetAll");

            await Task.WhenAll(
                trainingStatsTask, nationalTotalsTask, provinceStatsTask,
                equipmentStatsTask, salesStatsTask, recentSalesTask,
                provincialDataTask, topProductsTask, inventoryStatsTask,
                lowStockTask, recentTrainingsTask
            );

            var dashboard = new HBA1CProjectDashboard
            {
                TrainingStats = await trainingStatsTask,
                NationalTotals = await nationalTotalsTask,
                ProvinceStats = (await provinceStatsTask)?.ProvinceBreakdowns,
                EquipmentStats = (await equipmentStatsTask)?.Distributions,
                SalesStats = await salesStatsTask,
                RecentSales = await recentSalesTask,
                ProvincialData = await provincialDataTask,
                TopProducts = await topProductsTask,
                InventoryStats = await inventoryStatsTask,
                LowStockItems = await lowStockTask,
                RecentTrainings = (await recentTrainingsTask)?.OrderByDescending(t => t.StartDate).Take(10).ToList()
            };

            return Ok(dashboard);
        }

        // ====================================================================
        // Training Endpoints
        // ====================================================================
        [HttpGet("training")]
        public async Task<ActionResult> GetAllTraining()
        {
            var result = await _api.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetAll");
            return Ok(result ?? new List<HBA1CTrainingSession>());
        }

        [HttpGet("training/{id}")]
        public async Task<ActionResult> GetTraining(int id)
        {
            var result = await _api.GetAsync<HBA1CTrainingSession>("api/Training/GetById", new() { { "id", id.ToString() } });
            return result != null ? Ok(result) : NotFound();
        }

        [HttpGet("training/stats")]
        public async Task<ActionResult> GetTrainingStats()
        {
            var result = await _api.GetAsync<HBA1CTrainingStats>("api/Dashboard/GetTrainingStats");
            return Ok(result ?? new HBA1CTrainingStats());
        }

        [HttpGet("training/by-province")]
        public async Task<ActionResult> GetTrainingByProvince([FromQuery] string provinceName)
        {
            var result = await _api.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetByProvince", new() { { "provinceName", provinceName } });
            return Ok(result ?? new List<HBA1CTrainingSession>());
        }

        [HttpGet("training/by-status")]
        public async Task<ActionResult> GetTrainingByStatus([FromQuery] string status)
        {
            var result = await _api.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetByStatus", new() { { "status", status } });
            return Ok(result ?? new List<HBA1CTrainingSession>());
        }

        // ====================================================================
        // Inventory Endpoints
        // ====================================================================
        [HttpGet("inventory")]
        public async Task<ActionResult> GetAllInventory()
        {
            var result = await _api.GetAsync<List<HBA1CInventoryItem>>("api/Inventory/GetAll");
            return Ok(result ?? new List<HBA1CInventoryItem>());
        }

        [HttpGet("inventory/{id}")]
        public async Task<ActionResult> GetInventoryItem(int id)
        {
            var result = await _api.GetAsync<HBA1CInventoryItem>("api/Inventory/GetById", new() { { "id", id.ToString() } });
            return result != null ? Ok(result) : NotFound();
        }

        [HttpGet("inventory/stats")]
        public async Task<ActionResult> GetInventoryStats()
        {
            var result = await _api.GetAsync<HBA1CInventoryStats>("api/Inventory/GetStats");
            return Ok(result ?? new HBA1CInventoryStats());
        }

        [HttpGet("inventory/low-stock")]
        public async Task<ActionResult> GetLowStock()
        {
            var result = await _api.GetAsync<List<HBA1CInventoryItem>>("api/Inventory/GetLowStock");
            return Ok(result ?? new List<HBA1CInventoryItem>());
        }

        // ====================================================================
        // Sales Endpoints
        // ====================================================================
        [HttpGet("sales")]
        public async Task<ActionResult> GetAllSales()
        {
            var result = await _api.GetAsync<List<HBA1CSale>>("api/Sales/GetAll");
            return Ok(result ?? new List<HBA1CSale>());
        }

        [HttpGet("sales/{id}")]
        public async Task<ActionResult> GetSale(int id)
        {
            var result = await _api.GetAsync<HBA1CSale>("api/Sales/GetById", new() { { "id", id.ToString() } });
            return result != null ? Ok(result) : NotFound();
        }

        [HttpGet("sales/stats")]
        public async Task<ActionResult> GetSalesStats()
        {
            var result = await _api.GetAsync<HBA1CSalesStats>("api/Sales/GetDashboardStats");
            return Ok(result ?? new HBA1CSalesStats());
        }

        [HttpGet("sales/recent")]
        public async Task<ActionResult> GetRecentSales([FromQuery] int limit = 10)
        {
            var result = await _api.GetAsync<List<HBA1CSale>>("api/Sales/GetRecentSales", new() { { "limit", limit.ToString() } });
            return Ok(result ?? new List<HBA1CSale>());
        }

        [HttpGet("sales/provincial")]
        public async Task<ActionResult> GetProvincialData()
        {
            var result = await _api.GetAsync<List<HBA1CProvincialSalesData>>("api/Sales/GetProvincialData");
            return Ok(result ?? new List<HBA1CProvincialSalesData>());
        }

        [HttpGet("sales/top-products")]
        public async Task<ActionResult> GetTopProducts([FromQuery] int limit = 10)
        {
            var result = await _api.GetAsync<List<HBA1CTopProduct>>("api/Sales/GetTopProducts", new() { { "limit", limit.ToString() } });
            return Ok(result ?? new List<HBA1CTopProduct>());
        }

        [HttpGet("sales/by-date-range")]
        public async Task<ActionResult> GetSalesByDateRange([FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            var result = await _api.GetAsync<List<HBA1CSale>>("api/Sales/GetByDateRange", new()
            {
                { "startDate", startDate.ToString("yyyy-MM-dd") },
                { "endDate", endDate.ToString("yyyy-MM-dd") }
            });
            return Ok(result ?? new List<HBA1CSale>());
        }

        // ====================================================================
        // Credit Notes Endpoints
        // ====================================================================
        [HttpGet("credit-notes")]
        public async Task<ActionResult> GetCreditNotes([FromQuery] string? status, [FromQuery] DateTime? dateFrom, [FromQuery] DateTime? dateTo)
        {
            var qp = new Dictionary<string, string>();
            if (!string.IsNullOrEmpty(status)) qp["status"] = status;
            if (dateFrom.HasValue) qp["dateFrom"] = dateFrom.Value.ToString("yyyy-MM-dd");
            if (dateTo.HasValue) qp["dateTo"] = dateTo.Value.ToString("yyyy-MM-dd");

            var result = await _api.GetAsync<List<HBA1CCreditNote>>("api/CreditNotes", qp.Count > 0 ? qp : null);
            return Ok(result ?? new List<HBA1CCreditNote>());
        }

        [HttpGet("credit-notes/{id}")]
        public async Task<ActionResult> GetCreditNote(int id)
        {
            var result = await _api.GetAsync<HBA1CCreditNote>($"api/CreditNotes/{id}");
            return result != null ? Ok(result) : NotFound();
        }

        // ====================================================================
        // Location Endpoints
        // ====================================================================
        [HttpGet("provinces")]
        public async Task<ActionResult> GetProvinces()
        {
            var result = await _api.GetAsync<List<HBA1CProvince>>("api/Location/GetProvinces");
            return Ok(result ?? new List<HBA1CProvince>());
        }

        [HttpGet("clinics")]
        public async Task<ActionResult> GetClinics([FromQuery] string? province)
        {
            if (!string.IsNullOrEmpty(province))
            {
                var result = await _api.GetAsync<List<HBA1CClinic>>("api/Location/GetClinicsByProvince", new() { { "province", province } });
                return Ok(result ?? new List<HBA1CClinic>());
            }
            else
            {
                var result = await _api.GetAsync<List<HBA1CClinic>>("api/Location/GetClinics");
                return Ok(result ?? new List<HBA1CClinic>());
            }
        }

        // ====================================================================
        // Trainers
        // ====================================================================
        [HttpGet("trainers")]
        public async Task<ActionResult> GetTrainers()
        {
            var result = await _api.GetAsync<List<HBA1CTrainer>>("api/Trainer/GetAll");
            return Ok(result ?? new List<HBA1CTrainer>());
        }

        // ====================================================================
        // Health check (no auth needed on external API)
        // ====================================================================
        [HttpGet("health")]
        [AllowAnonymous]
        public async Task<ActionResult> Health()
        {
            var token = await _api.LoginAsync();
            return Ok(new
            {
                status = token != null ? "connected" : "disconnected",
                api = "ngcanduapi.azurewebsites.net",
                timestamp = DateTime.UtcNow
            });
        }
    }
}
