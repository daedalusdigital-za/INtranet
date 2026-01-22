using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Models.Logistics.TFN;
using ProjectTracker.API.Services.TFN.Clients;

namespace ProjectTracker.API.Services.TFN
{
    /// <summary>
    /// Service to sync data from TFN to local database
    /// </summary>
    public class TfnSyncService
    {
        private readonly ApplicationDbContext _context;
        private readonly TfnVehiclesClient _vehiclesClient;
        private readonly TfnDriversClient _driversClient;
        private readonly TfnOrdersClient _ordersClient;
        private readonly TfnTransactionsClient _transactionsClient;
        private readonly TfnAccountsClient _accountsClient;
        private readonly TfnDepotsClient _depotsClient;
        private readonly ILogger<TfnSyncService> _logger;

        public TfnSyncService(
            ApplicationDbContext context,
            TfnVehiclesClient vehiclesClient,
            TfnDriversClient driversClient,
            TfnOrdersClient ordersClient,
            TfnTransactionsClient transactionsClient,
            TfnAccountsClient accountsClient,
            TfnDepotsClient depotsClient,
            ILogger<TfnSyncService> logger)
        {
            _context = context;
            _vehiclesClient = vehiclesClient;
            _driversClient = driversClient;
            _ordersClient = ordersClient;
            _transactionsClient = transactionsClient;
            _accountsClient = accountsClient;
            _depotsClient = depotsClient;
            _logger = logger;
        }

        /// <summary>
        /// Sync all TFN data
        /// </summary>
        public async Task<TfnSyncResult> SyncAllAsync()
        {
            var result = new TfnSyncResult();

            try
            {
                _logger.LogInformation("Starting full TFN sync...");

                // Sync in order of dependencies
                result.DepotsResult = await SyncDepotsAsync();
                result.VehiclesResult = await SyncVehiclesAsync();
                result.DriversResult = await SyncDriversAsync();
                result.OrdersResult = await SyncOrdersAsync();
                result.TransactionsResult = await SyncTransactionsAsync();
                result.BalancesResult = await SyncAccountBalancesAsync();

                _logger.LogInformation("TFN sync completed. Vehicles: {Vehicles}, Drivers: {Drivers}, Orders: {Orders}, Transactions: {Transactions}",
                    result.VehiclesResult.Synced, result.DriversResult.Synced, result.OrdersResult.Synced, result.TransactionsResult.Synced);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during TFN sync");
                result.HasError = true;
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        /// <summary>
        /// Sync vehicles from TFN and link to our Vehicle table
        /// Uses normalized registration numbers (no dashes/spaces) for matching
        /// </summary>
        public async Task<SyncResult> SyncVehiclesAsync()
        {
            var result = new SyncResult();

            try
            {
                var tfnVehicles = await _vehiclesClient.GetVehiclesAsync();
                if (tfnVehicles == null)
                {
                    result.ErrorMessage = "Failed to retrieve vehicles from TFN";
                    return result;
                }

                _logger.LogInformation("Retrieved {Count} vehicles from TFN for syncing", tfnVehicles.Count);

                // Get all our vehicles once for normalized matching
                var allVehicles = await _context.Vehicles.ToListAsync();
                
                foreach (var tfnVehicle in tfnVehicles)
                {
                    // Get normalized TFN registration (no dashes/spaces, uppercase)
                    var tfnRegNormalized = tfnVehicle.NormalizedRegistration;
                    
                    if (string.IsNullOrEmpty(tfnRegNormalized))
                    {
                        _logger.LogWarning("Skipping TFN vehicle with empty registration");
                        continue;
                    }

                    // Find our Vehicle by normalized registration
                    var vehicle = allVehicles.FirstOrDefault(v => 
                        (v.RegistrationNumber?.Replace("-", "").Replace(" ", "").ToUpper() ?? "") == tfnRegNormalized);

                    if (vehicle == null)
                    {
                        // Don't auto-create vehicles - only link to existing ones
                        _logger.LogDebug("No matching vehicle found for TFN registration: {Reg}", tfnVehicle.Registration);
                        continue;
                    }
                    
                    result.Updated++;

                    // Update TFN-specific fields
                    vehicle.TfnVehicleId = tfnVehicle.Registration;  // Store original TFN registration
                    vehicle.TfnFleetNumber = tfnVehicle.FleetNumber;
                    vehicle.TfnExternalNumber = tfnVehicle.ExternalNumber;
                    vehicle.TfnStatus = tfnVehicle.Status;
                    vehicle.TankSize = tfnVehicle.TankSize;
                    vehicle.TfnLastSyncedAt = DateTime.UtcNow;
                    vehicle.IsLinkedToTfn = true;
                    
                    _logger.LogDebug("Linked TFN vehicle {TfnReg} to DB vehicle {DbReg}", 
                        tfnVehicle.Registration, vehicle.RegistrationNumber);
                }

                await _context.SaveChangesAsync();
                result.Synced = result.Updated;

                _logger.LogInformation("Synced {Count} vehicles from TFN ({Updated} linked to existing vehicles)",
                    result.Synced, result.Updated);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing vehicles from TFN");
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        /// <summary>
        /// Sync drivers from TFN and link to our Driver table
        /// </summary>
        public async Task<SyncResult> SyncDriversAsync()
        {
            var result = new SyncResult();

            try
            {
                var tfnDrivers = await _driversClient.GetDriversAsync();
                if (tfnDrivers == null)
                {
                    result.ErrorMessage = "Failed to retrieve drivers from TFN";
                    return result;
                }

                foreach (var tfnDriver in tfnDrivers)
                {
                    // Find or create our Driver record
                    var driver = await _context.Drivers
                        .FirstOrDefaultAsync(d => d.LicenseNumber == tfnDriver.LicenseNumber);

                    if (driver == null)
                    {
                        // Create new driver - split name into first/last
                        var nameParts = (tfnDriver.DriverName ?? "Unknown").Split(' ', 2);
                        driver = new Driver
                        {
                            FirstName = nameParts[0],
                            LastName = nameParts.Length > 1 ? nameParts[1] : "",
                            LicenseNumber = tfnDriver.LicenseNumber,
                            PhoneNumber = tfnDriver.CellNumber,
                            Email = tfnDriver.Email,
                            Status = tfnDriver.IsActive ? "Active" : "Inactive"
                        };
                        _context.Drivers.Add(driver);
                        result.Created++;
                    }
                    else
                    {
                        driver.PhoneNumber = tfnDriver.CellNumber ?? driver.PhoneNumber;
                        driver.Email = tfnDriver.Email ?? driver.Email;
                        result.Updated++;
                    }
                }

                await _context.SaveChangesAsync();
                result.Synced = result.Created + result.Updated;

                _logger.LogInformation("Synced {Count} drivers from TFN ({Created} created, {Updated} updated)",
                    result.Synced, result.Created, result.Updated);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing drivers from TFN");
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        /// <summary>
        /// Sync fuel depots
        /// </summary>
        public async Task<SyncResult> SyncDepotsAsync()
        {
            var result = new SyncResult();

            try
            {
                var tfnDepots = await _depotsClient.GetDepotsAsync();
                if (tfnDepots == null)
                {
                    result.ErrorMessage = "Failed to retrieve depots from TFN";
                    return result;
                }

                foreach (var tfnDepot in tfnDepots)
                {
                    var depot = await _context.TfnDepots
                        .FirstOrDefaultAsync(d => d.TfnDepotId == tfnDepot.DepotCode);

                    if (depot == null)
                    {
                        depot = new TfnDepot
                        {
                            TfnDepotId = tfnDepot.DepotCode,
                            Name = tfnDepot.DepotName,
                            Code = tfnDepot.DepotCode,
                            Address = tfnDepot.Address,
                            City = tfnDepot.City,
                            Province = tfnDepot.Province,
                            PostalCode = tfnDepot.PostalCode,
                            Latitude = tfnDepot.Latitude,
                            Longitude = tfnDepot.Longitude,
                            ContactPerson = tfnDepot.ContactPerson,
                            ContactPhone = tfnDepot.ContactNumber,
                            IsActive = tfnDepot.IsActive
                        };
                        _context.TfnDepots.Add(depot);
                        result.Created++;
                    }
                    else
                    {
                        depot.Name = tfnDepot.DepotName;
                        depot.Address = tfnDepot.Address;
                        depot.City = tfnDepot.City;
                        depot.Province = tfnDepot.Province;
                        depot.IsActive = tfnDepot.IsActive;
                        depot.UpdatedAt = DateTime.UtcNow;
                        result.Updated++;
                    }

                    depot.LastSyncedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                result.Synced = result.Created + result.Updated;

                _logger.LogInformation("Synced {Count} depots from TFN ({Created} created, {Updated} updated)",
                    result.Synced, result.Created, result.Updated);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing depots from TFN");
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        /// <summary>
        /// Sync fuel orders
        /// </summary>
        public async Task<SyncResult> SyncOrdersAsync(DateTime? fromDate = null)
        {
            var result = new SyncResult();

            try
            {
                fromDate ??= DateTime.UtcNow.AddDays(-13); // TFN API requires date within 14 days
                var tfnOrders = await _ordersClient.GetOrdersAsync(fromDate);
                
                if (tfnOrders == null)
                {
                    result.ErrorMessage = "Failed to retrieve orders from TFN";
                    return result;
                }

                foreach (var tfnOrder in tfnOrders)
                {
                    // Skip deleted orders
                    if (tfnOrder.IsDeleted)
                        continue;
                        
                    var order = await _context.TfnOrders
                        .FirstOrDefaultAsync(o => o.TfnOrderId == tfnOrder.OrderNumber);

                    // Get first entry for vehicle/product info
                    var firstEntry = tfnOrder.Entries.FirstOrDefault(e => !e.IsDeleted);
                    var vehicleReg = firstEntry?.VehicleRegistration ?? tfnOrder.VehicleRegistration;
                    var productCode = firstEntry?.ProductCode ?? tfnOrder.ProductCode;
                    var validStart = firstEntry?.ValidDateStart ?? tfnOrder.ValidDateStart;
                    var validEnd = firstEntry?.ValidDateEnd ?? tfnOrder.ValidDateEnd;
                    var virtualCard = firstEntry?.CurrentVirtualCardNumber ?? tfnOrder.VirtualCardNumber;
                    var totalAllocation = tfnOrder.Entries.Where(e => !e.IsDeleted).Sum(e => e.MaxAllocation);
                    if (totalAllocation == 0) totalAllocation = tfnOrder.MaxAllocation;

                    if (order == null)
                    {
                        // Find vehicle by registration
                        Vehicle? vehicle = null;
                        if (!string.IsNullOrEmpty(vehicleReg))
                        {
                            vehicle = await _context.Vehicles
                                .FirstOrDefaultAsync(v => v.RegistrationNumber == vehicleReg);
                        }
                        
                        // Find driver by cell number if available
                        Driver? driver = null;
                        var driverCell = firstEntry?.DriverCellNumber ?? tfnOrder.DriverCellNumber;
                        if (!string.IsNullOrEmpty(driverCell))
                        {
                            driver = await _context.Drivers
                                .FirstOrDefaultAsync(d => d.PhoneNumber == driverCell);
                        }

                        order = new TfnOrder
                        {
                            TfnOrderId = tfnOrder.OrderNumber,
                            OrderNumber = tfnOrder.OrderNumber,
                            VehicleId = vehicle?.Id,
                            DriverId = driver?.Id,
                            VirtualCardNumber = virtualCard,
                            VehicleRegistration = vehicleReg,  // Store directly from TFN
                            ProductCode = productCode,         // Store directly from TFN
                            AllocatedLitres = totalAllocation,
                            AllocatedAmount = null, // Not in this API response
                            FuelType = productCode,
                            OrderDate = validStart ?? DateTime.UtcNow,
                            ExpiryDate = validEnd,
                            Status = tfnOrder.StatusTitle ?? "Active",
                            UsedLitres = 0, // Will be updated from transactions
                            RemainingLitres = totalAllocation,
                            Notes = tfnOrder.Planned ? $"Planned: {tfnOrder.PlannedReasons}" : tfnOrder.CustomerReference
                        };
                        _context.TfnOrders.Add(order);
                        result.Created++;
                    }
                    else
                    {
                        // Update existing order
                        order.AllocatedLitres = totalAllocation;
                        order.Status = tfnOrder.StatusTitle ?? order.Status;
                        order.ExpiryDate = validEnd ?? order.ExpiryDate;
                        order.VirtualCardNumber = virtualCard ?? order.VirtualCardNumber;
                        order.VehicleRegistration = vehicleReg ?? order.VehicleRegistration;  // Update vehicle registration
                        order.ProductCode = productCode ?? order.ProductCode;                 // Update product code
                        order.FuelType = productCode ?? order.FuelType;
                        order.UpdatedAt = DateTime.UtcNow;
                        result.Updated++;
                    }

                    order.LastSyncedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                result.Synced = result.Created + result.Updated;

                _logger.LogInformation("Synced {Count} orders from TFN ({Created} created, {Updated} updated)",
                    result.Synced, result.Created, result.Updated);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing orders from TFN");
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        /// <summary>
        /// Sync fuel transactions
        /// </summary>
        public async Task<SyncResult> SyncTransactionsAsync(DateTime? fromDate = null)
        {
            var result = new SyncResult();

            try
            {
                fromDate ??= DateTime.UtcNow.AddDays(-7);
                var tfnTransactions = await _transactionsClient.GetTransactionsWithOrdersAsync(fromDate);
                
                if (tfnTransactions == null)
                {
                    result.ErrorMessage = "Failed to retrieve transactions from TFN";
                    return result;
                }

                foreach (var tfnTrans in tfnTransactions)
                {
                    var transaction = await _context.TfnTransactions
                        .FirstOrDefaultAsync(t => t.TfnTransactionId == tfnTrans.TransactionId);

                    if (transaction == null)
                    {
                        // Find linked entities
                        var vehicle = await _context.Vehicles
                            .FirstOrDefaultAsync(v => v.RegistrationNumber == tfnTrans.VehicleRegistration);
                        
                        var driver = await _context.Drivers
                            .FirstOrDefaultAsync(d => d.LicenseNumber == tfnTrans.DriverCode);
                        
                        var depot = await _context.TfnDepots
                            .FirstOrDefaultAsync(d => d.Code == tfnTrans.DepotCode);
                        
                        var order = await _context.TfnOrders
                            .FirstOrDefaultAsync(o => o.OrderNumber == tfnTrans.OrderNumber);

                        transaction = new TfnTransaction
                        {
                            TfnTransactionId = tfnTrans.TransactionId,
                            TransactionNumber = tfnTrans.TransactionNumber,
                            TransactionDate = tfnTrans.TransactionDate,
                            VehicleId = vehicle?.Id,
                            DriverId = driver?.Id,
                            TfnDepotId = depot?.Id,
                            TfnOrderId = order?.Id,
                            FuelType = tfnTrans.ProductCode,
                            Litres = tfnTrans.Litres,
                            PricePerLitre = tfnTrans.PricePerLitre,
                            TotalAmount = tfnTrans.TotalAmount,
                            VatAmount = tfnTrans.VatAmount,
                            OdometerReading = tfnTrans.OdometerReading,
                            VirtualCardNumber = tfnTrans.VirtualCardNumber,
                            AttendantName = tfnTrans.AttendantName
                        };

                        // Calculate fuel efficiency if we have distance data
                        if (tfnTrans.OdometerReading.HasValue && vehicle != null)
                        {
                            var previousTransaction = await _context.TfnTransactions
                                .Where(t => t.VehicleId == vehicle.Id && t.OdometerReading.HasValue)
                                .OrderByDescending(t => t.TransactionDate)
                                .FirstOrDefaultAsync();

                            if (previousTransaction != null && previousTransaction.OdometerReading.HasValue)
                            {
                                var distance = tfnTrans.OdometerReading.Value - previousTransaction.OdometerReading.Value;
                                if (distance > 0 && previousTransaction.Litres > 0)
                                {
                                    transaction.DistanceSinceLastFill = distance;
                                    transaction.FuelEfficiency = distance / previousTransaction.Litres;
                                }
                            }
                        }

                        _context.TfnTransactions.Add(transaction);
                        result.Created++;
                    }

                    transaction.LastSyncedAt = DateTime.UtcNow;
                }

                await _context.SaveChangesAsync();
                result.Synced = result.Created;

                _logger.LogInformation("Synced {Count} transactions from TFN ({Created} new)",
                    result.Synced, result.Created);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing transactions from TFN");
                result.ErrorMessage = ex.Message;
                return result;
            }
        }

        /// <summary>
        /// Sync account balances and credit limits
        /// </summary>
        public async Task<SyncResult> SyncAccountBalancesAsync()
        {
            var result = new SyncResult();

            try
            {
                // Get all credit limits
                var creditLimits = await _accountsClient.GetAllCreditLimitsAsync();
                if (creditLimits == null)
                {
                    result.ErrorMessage = "Failed to retrieve credit limits from TFN";
                    return result;
                }

                foreach (var limit in creditLimits)
                {
                    // Find vehicle with this sub-account
                    var vehicle = await _context.Vehicles
                        .FirstOrDefaultAsync(v => v.TfnSubAccountNumber == limit.SubAccountNumber);

                    // Get balance for this sub-account
                    var balance = await _accountsClient.GetBalanceAsync(limit.SubAccountNumber);

                    var accountBalance = await _context.TfnAccountBalances
                        .FirstOrDefaultAsync(a => a.SubAccountNumber == limit.SubAccountNumber);

                    if (accountBalance == null)
                    {
                        accountBalance = new TfnAccountBalance
                        {
                            VehicleId = vehicle?.Id,
                            SubAccountNumber = limit.SubAccountNumber,
                            CreditLimit = limit.CreditLimit,
                            IsActive = limit.IsActive
                        };
                        _context.TfnAccountBalances.Add(accountBalance);
                        result.Created++;
                    }
                    else
                    {
                        result.Updated++;
                    }

                    if (balance != null)
                    {
                        accountBalance.CurrentBalance = balance.Balance;
                        accountBalance.CreditLimit = balance.CreditLimit;
                        accountBalance.AvailableCredit = balance.AvailableCredit;
                        accountBalance.BalanceDate = balance.BalanceDate;
                    }

                    accountBalance.UpdatedAt = DateTime.UtcNow;
                    accountBalance.LastSyncedAt = DateTime.UtcNow;

                    // Update vehicle credit info
                    if (vehicle != null)
                    {
                        vehicle.TfnCreditLimit = accountBalance.CreditLimit;
                        vehicle.TfnCurrentBalance = accountBalance.CurrentBalance;
                        vehicle.TfnLastSyncedAt = DateTime.UtcNow;
                    }
                }

                await _context.SaveChangesAsync();
                result.Synced = result.Created + result.Updated;

                _logger.LogInformation("Synced {Count} account balances from TFN ({Created} created, {Updated} updated)",
                    result.Synced, result.Created, result.Updated);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing account balances from TFN");
                result.ErrorMessage = ex.Message;
                return result;
            }
        }
    }

    public class TfnSyncResult
    {
        public SyncResult DepotsResult { get; set; } = new();
        public SyncResult VehiclesResult { get; set; } = new();
        public SyncResult DriversResult { get; set; } = new();
        public SyncResult OrdersResult { get; set; } = new();
        public SyncResult TransactionsResult { get; set; } = new();
        public SyncResult BalancesResult { get; set; } = new();
        public bool HasError { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public class SyncResult
    {
        public int Synced { get; set; }
        public int Created { get; set; }
        public int Updated { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
