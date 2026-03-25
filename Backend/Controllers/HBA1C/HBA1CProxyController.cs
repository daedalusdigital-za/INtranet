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

        // Province ID → Name mapping (matches the external HBA1C system)
        private static readonly Dictionary<int, string> ProvinceNames = new()
        {
            { 1, "Eastern Cape" },
            { 2, "Free State" },
            { 3, "Gauteng" },
            { 4, "KwaZulu-Natal" },
            { 5, "Limpopo" },
            { 6, "Mpumalanga" },
            { 7, "North West" },
            { 8, "Northern Cape" },
            { 9, "Western Cape" }
        };

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
            var equipmentOrderStatsTask = _api.GetAsync<HBA1CAllEquipmentOrderStats>("api/Delivery/GetAllEquipmentOrderStats");
            var salesStatsTask = _api.GetAsync<HBA1CSalesStats>("api/Sales/GetDashboardStats");
            var recentSalesTask = _api.GetAsync<List<HBA1CSale>>("api/Sales/GetRecentSales", new() { { "limit", "10" } });
            var allSalesTask = _api.GetAsync<List<HBA1CSale>>("api/Sales/GetAll");
            var allInventoryTask = _api.GetAsync<List<HBA1CInventoryItem>>("api/Inventory/GetAll");
            var provincialDataTask = _api.GetAsync<List<HBA1CProvincialSalesData>>("api/Sales/GetProvincialData");
            var topProductsTask = _api.GetAsync<List<HBA1CTopProduct>>("api/Sales/GetTopProducts", new() { { "limit", "10" } });
            var inventoryStatsTask = _api.GetAsync<HBA1CInventoryStats>("api/Inventory/GetStats");
            var lowStockTask = _api.GetAsync<List<HBA1CInventoryItem>>("api/Inventory/GetLowStock");
            var recentTrainingsTask = _api.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetAll");
            var trainersTask = _api.GetAsync<List<HBA1CTrainer>>("api/Trainer/GetAll");

            await Task.WhenAll(
                trainingStatsTask, nationalTotalsTask, provinceStatsTask,
                equipmentOrderStatsTask,
                salesStatsTask, recentSalesTask, allSalesTask, allInventoryTask,
                provincialDataTask, topProductsTask, inventoryStatsTask,
                lowStockTask, recentTrainingsTask, trainersTask
            );

            var allTrainings = await recentTrainingsTask ?? new List<HBA1CTrainingSession>();
            var allTrainers = await trainersTask ?? new List<HBA1CTrainer>();
            var trainingStats = await trainingStatsTask ?? new HBA1CTrainingStats();
            var nationalTotals = await nationalTotalsTask ?? new HBA1CNationalTotals();

            // Enrich training sessions with province names and trainer info
            EnrichTrainingSessions(allTrainings, allTrainers);

            // The external API returns incorrect aggregate stats — compute from actual session data
            if (trainingStats.TotalParticipants == 0 && allTrainings.Count > 0)
            {
                trainingStats.TotalParticipants = allTrainings.Sum(t => t.NumberOfParticipants);
            }
            if (nationalTotals.TotalParticipants == 0 && allTrainings.Count > 0)
            {
                nationalTotals.TotalParticipants = allTrainings.Sum(t => t.NumberOfParticipants);
            }

            // The API also reports inflated totalTrainers — compute unique trainers from sessions
            if (allTrainings.Count > 0)
            {
                var uniqueTrainerCount = allTrainings
                    .Where(t => t.TrainerId > 0)
                    .Select(t => t.TrainerId)
                    .Distinct()
                    .Count();
                if (uniqueTrainerCount > 0)
                {
                    nationalTotals.TotalTrainers = uniqueTrainerCount;
                }
            }

            // The API returns all-zero province breakdowns — compute from actual training sessions
            var apiProvinceStats = (await provinceStatsTask)?.ProvinceBreakdowns;
            var allZeroProvinces = apiProvinceStats == null
                || !apiProvinceStats.Any()
                || apiProvinceStats.All(p => p.Sessions == 0 && p.Participants == 0 && p.Trainers == 0);

            List<HBA1CProvinceBreakdown> computedProvinceStats;
            if (allZeroProvinces && allTrainings.Count > 0)
            {
                computedProvinceStats = allTrainings
                    .GroupBy(t => t.ProvinceId)
                    .Select(g => new HBA1CProvinceBreakdown
                    {
                        Province = ProvinceNames.TryGetValue(g.Key, out var name) ? name : $"Province {g.Key}",
                        Sessions = g.Count(),
                        Participants = g.Sum(t => t.NumberOfParticipants),
                        Trainers = g.Select(t => t.TrainerId).Where(id => id > 0).Distinct().Count(),
                        Revenue = 0,
                        Deliveries = 0
                    })
                    .OrderByDescending(p => p.Sessions)
                    .ToList();
            }
            else
            {
                computedProvinceStats = apiProvinceStats ?? new List<HBA1CProvinceBreakdown>();
            }

            // ── Equipment: compute from Sales × Inventory, or use Delivery endpoint if available ──
            var equipmentOrderStats = await equipmentOrderStatsTask;
            List<HBA1CEquipmentDistribution>? equipmentList = null;
            int equipmentTypesCount = 0;
            int totalItemsOrdered = 0;
            int totalItemsDelivered = 0;
            double overallDeliveryRate = 0;
            decimal totalEquipmentOrderValue = 0;

            if (equipmentOrderStats?.EquipmentBreakdown != null && equipmentOrderStats.EquipmentBreakdown.Count > 0)
            {
                // Delivery endpoint succeeded — use its richer data
                equipmentList = equipmentOrderStats.EquipmentBreakdown;
                equipmentTypesCount = equipmentOrderStats.TotalEquipmentTypes;
                totalItemsOrdered = equipmentOrderStats.TotalItemsOrdered;
                totalItemsDelivered = equipmentOrderStats.TotalItemsDelivered;
                overallDeliveryRate = equipmentOrderStats.OverallDeliveryRate;
                totalEquipmentOrderValue = equipmentOrderStats.TotalOrderValue;
                _logger.LogInformation("Using Delivery/GetAllEquipmentOrderStats: {Types} types", equipmentTypesCount);
            }
            else
            {
                // Compute equipment stats from Sales × Inventory
                var allSales = await allSalesTask ?? new List<HBA1CSale>();
                var allInventory = await allInventoryTask ?? new List<HBA1CInventoryItem>();
                var invMap = allInventory.ToDictionary(i => i.Id ?? 0, i => i);

                // Flatten all sale items
                var allSaleItems = allSales
                    .Where(s => s.SaleItems != null)
                    .SelectMany(s => s.SaleItems!)
                    .ToList();

                if (allSaleItems.Count > 0 && allInventory.Count > 0)
                {
                    equipmentList = allSaleItems
                        .GroupBy(si => si.InventoryItemId)
                        .Select(g =>
                        {
                            var invItem = invMap.GetValueOrDefault(g.Key);
                            var orderCount = g.Count();
                            var totalQty = g.Sum(si => si.Quantity);
                            var totalValue = g.Sum(si => si.TotalPrice);

                            return new HBA1CEquipmentDistribution
                            {
                                EquipmentType = invItem?.Name?.Trim() ?? $"Item #{g.Key}",
                                Category = invItem?.CategoryText ?? "Unknown",
                                TotalOrdered = orderCount,
                                TotalDelivered = 0, // Delivery data unavailable
                                PendingDelivery = orderCount,
                                DeliveryRate = 0,
                                TotalOrderValue = totalValue,
                                DeliveredValue = 0,
                                ProvinceDistribution = new List<HBA1CProvinceDistribution>(),
                                ItemBreakdown = new List<HBA1CItemBreakdown>
                                {
                                    new()
                                    {
                                        ItemType = invItem?.Name?.Trim() ?? $"Item #{g.Key}",
                                        Quantity = totalQty,
                                        Value = totalValue
                                    }
                                }
                            };
                        })
                        .OrderByDescending(e => e.TotalOrdered)
                        .ToList();

                    equipmentTypesCount = equipmentList.Count;
                    totalItemsOrdered = equipmentList.Sum(e => e.TotalOrdered);
                    totalItemsDelivered = 0;
                    overallDeliveryRate = 0;
                    totalEquipmentOrderValue = equipmentList.Sum(e => e.TotalOrderValue);

                    _logger.LogInformation(
                        "Computed equipment from Sales×Inventory: {Types} types, {Orders} orders, R{Value}",
                        equipmentTypesCount, totalItemsOrdered, totalEquipmentOrderValue);
                }
                else
                {
                    _logger.LogWarning("No sales or inventory data to compute equipment stats");
                }
            }

            var dashboard = new HBA1CProjectDashboard
            {
                TrainingStats = trainingStats,
                NationalTotals = nationalTotals,
                ProvinceStats = computedProvinceStats,
                EquipmentStats = equipmentList,
                EquipmentTypesCount = equipmentTypesCount,
                TotalItemsOrdered = totalItemsOrdered,
                TotalItemsDelivered = totalItemsDelivered,
                OverallDeliveryRate = overallDeliveryRate,
                TotalEquipmentOrderValue = totalEquipmentOrderValue,
                SalesStats = await salesStatsTask,
                RecentSales = await recentSalesTask,
                ProvincialData = await provincialDataTask,
                TopProducts = await topProductsTask,
                InventoryStats = await inventoryStatsTask,
                LowStockItems = await lowStockTask,
                RecentTrainings = allTrainings.OrderByDescending(t => t.StartDate).Take(10).ToList()
            };

            return Ok(dashboard);
        }

        // ====================================================================
        // Training Endpoints
        // ====================================================================
        [HttpGet("training")]
        public async Task<ActionResult> GetAllTraining()
        {
            var trainingsTask = _api.GetAsync<List<HBA1CTrainingSession>>("api/Training/GetAll");
            var trainersTask = _api.GetAsync<List<HBA1CTrainer>>("api/Trainer/GetAll");
            await Task.WhenAll(trainingsTask, trainersTask);

            var trainings = await trainingsTask ?? new List<HBA1CTrainingSession>();
            var trainers = await trainersTask ?? new List<HBA1CTrainer>();
            EnrichTrainingSessions(trainings, trainers);

            return Ok(trainings);
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

        [HttpPost("training")]
        public async Task<ActionResult> CreateTraining([FromBody] HBA1CTrainingSession training)
        {
            _logger.LogInformation("Creating HBA1C training session: {Name}", training.TrainingName);
            var result = await _api.PostAsync<HBA1CTrainingSession>("api/Training/Create", training);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to create training session" });
        }

        [HttpPut("training/{id}")]
        public async Task<ActionResult> UpdateTraining(int id, [FromBody] HBA1CTrainingSession training)
        {
            _logger.LogInformation("Updating HBA1C training session {Id}", id);
            training.Id = id;
            var result = await _api.PatchAsync<HBA1CTrainingSession>($"api/Training/Update/{id}", training);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to update training session" });
        }

        [HttpDelete("training/{id}")]
        public async Task<ActionResult> DeleteTraining(int id)
        {
            _logger.LogInformation("Deleting HBA1C training session {Id}", id);
            var success = await _api.DeleteAsync($"api/Training/Delete/{id}");
            return success ? Ok(new { message = "Training session deleted" }) : StatusCode(500, new { message = "Failed to delete training session" });
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

        [HttpPost("inventory")]
        public async Task<ActionResult> CreateInventoryItem([FromBody] HBA1CInventoryItem item)
        {
            _logger.LogInformation("Creating HBA1C inventory item: {Name}", item.Name);
            var result = await _api.PostAsync<HBA1CInventoryItem>("api/Inventory/Create", item);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to create inventory item" });
        }

        [HttpPut("inventory/{id}")]
        public async Task<ActionResult> UpdateInventoryItem(int id, [FromBody] HBA1CInventoryItem item)
        {
            _logger.LogInformation("Updating HBA1C inventory item {Id}", id);
            item.Id = id;
            var result = await _api.PatchAsync<HBA1CInventoryItem>($"api/Inventory/Update/{id}", item);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to update inventory item" });
        }

        [HttpDelete("inventory/{id}")]
        public async Task<ActionResult> DeleteInventoryItem(int id)
        {
            _logger.LogInformation("Deleting HBA1C inventory item {Id}", id);
            var success = await _api.DeleteAsync($"api/Inventory/Delete/{id}");
            return success ? Ok(new { message = "Inventory item deleted" }) : StatusCode(500, new { message = "Failed to delete inventory item" });
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

        [HttpPost("sales")]
        public async Task<ActionResult> CreateSale([FromBody] HBA1CSale sale)
        {
            _logger.LogInformation("Creating HBA1C sale: {SaleNumber}", sale.SaleNumber);
            var result = await _api.PostAsync<HBA1CSale>("api/Sales/Create", sale);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to create sale" });
        }

        [HttpPut("sales/{id}")]
        public async Task<ActionResult> UpdateSale(int id, [FromBody] HBA1CSale sale)
        {
            _logger.LogInformation("Updating HBA1C sale {Id}", id);
            sale.Id = id;
            var result = await _api.PatchAsync<HBA1CSale>($"api/Sales/Update/{id}", sale);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to update sale" });
        }

        [HttpDelete("sales/{id}")]
        public async Task<ActionResult> DeleteSale(int id)
        {
            _logger.LogInformation("Deleting HBA1C sale {Id}", id);
            var success = await _api.DeleteAsync($"api/Sales/Delete/{id}");
            return success ? Ok(new { message = "Sale deleted" }) : StatusCode(500, new { message = "Failed to delete sale" });
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

        [HttpPost("credit-notes")]
        public async Task<ActionResult> CreateCreditNote([FromBody] HBA1CCreditNote creditNote)
        {
            _logger.LogInformation("Creating HBA1C credit note for invoice {InvoiceId}", creditNote.InvoiceId);
            var result = await _api.PostAsync<HBA1CCreditNote>("api/CreditNotes/Create", creditNote);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to create credit note" });
        }

        [HttpPut("credit-notes/{id}")]
        public async Task<ActionResult> UpdateCreditNote(int id, [FromBody] HBA1CCreditNote creditNote)
        {
            _logger.LogInformation("Updating HBA1C credit note {Id}", id);
            creditNote.Id = id;
            var result = await _api.PatchAsync<HBA1CCreditNote>($"api/CreditNotes/Update/{id}", creditNote);
            return result != null ? Ok(result) : StatusCode(500, new { message = "Failed to update credit note" });
        }

        [HttpDelete("credit-notes/{id}")]
        public async Task<ActionResult> DeleteCreditNote(int id)
        {
            _logger.LogInformation("Deleting HBA1C credit note {Id}", id);
            var success = await _api.DeleteAsync($"api/CreditNotes/Delete/{id}");
            return success ? Ok(new { message = "Credit note deleted" }) : StatusCode(500, new { message = "Failed to delete credit note" });
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
        // Helper: enrich training sessions with province names & trainer info
        // ====================================================================
        private static void EnrichTrainingSessions(List<HBA1CTrainingSession> sessions, List<HBA1CTrainer> trainers)
        {
            var trainerMap = trainers.Where(t => t.Id > 0).ToDictionary(t => t.Id, t => t);

            foreach (var s in sessions)
            {
                // Fill ProvinceName from the static dictionary if missing
                if (string.IsNullOrEmpty(s.ProvinceName) && s.ProvinceId > 0)
                {
                    s.ProvinceName = ProvinceNames.TryGetValue(s.ProvinceId, out var name) ? name : $"Province {s.ProvinceId}";
                }

                // Attach Trainer object if missing
                if (s.Trainer == null && s.TrainerId > 0 && trainerMap.TryGetValue(s.TrainerId, out var trainer))
                {
                    s.Trainer = trainer;
                }
            }
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
