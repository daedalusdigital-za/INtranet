import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { resolve, normalize, basename } from 'node:path';
import { query } from './db.js';

const DOCS_ROOT = process.env.DOCS_ROOT ?? '/app/documents';

function textResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Registers all read-only logistics tools on the given MCP server.
 * Every query is a parameterized SELECT — no writes, no DDL.
 */
export function registerTools(server: McpServer) {
  // ---- Pending / unallocated invoices -------------------------------------
  server.tool(
    'list_pending_invoices',
    'List imported delivery invoices that are not yet allocated to a load (pending delivery). Optionally filter by source company (e.g. PMT, SBT) or delivery province, and limit the number of rows. Includes full financials: sales, returns, net sales, cost of sales, margin % and gross profit.',
    {
      sourceCompany: z.string().optional().describe('Filter by source company, e.g. "PMT" or "SBT".'),
      province: z.string().optional().describe('Filter by delivery province.'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return.'),
    },
    async ({ sourceCompany, province, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, TransactionNumber, CustomerName, CustomerNumber, CustomerId,
            ProductCode, ProductDescription, Quantity, DeliveredQuantity,
            SalesAmount, SalesReturns, NetSales, CostOfSales, MarginPercent, GrossProfit,
            SourceCompany, Location, DeliveryAddress, DeliveryCity, DeliveryProvince,
            DeliveryPostalCode, ContactPerson, ContactPhone, ContactEmail,
            ScheduledDeliveryDate, DeliveryDeadline, DeliveryPriority, Status, TransactionDate
         FROM dbo.vw_mcp_pending_invoices
         WHERE (LoadId IS NULL OR Status = 'Pending')
           AND (@sourceCompany IS NULL OR SourceCompany = @sourceCompany)
           AND (@province IS NULL OR DeliveryProvince = @province)
         ORDER BY ScheduledDeliveryDate ASC, TransactionDate DESC`,
        { limit, sourceCompany: sourceCompany ?? null, province: province ?? null }
      );
      return textResult({ count: rows.length, invoices: rows });
    }
  );

  // ---- Active loads --------------------------------------------------------
  server.tool(
    'list_active_loads',
    'List logistics loads with their status, assigned driver/vehicle and schedule. Optionally filter by status (e.g. Pending, Scheduled, InTransit, Delivered).',
    {
      status: z.string().optional().describe('Filter by load status.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ status, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, LoadNumber, Status, Priority,
            ScheduledPickupDate, ScheduledDeliveryDate, ActualDeliveryDate,
            PickupLocation, DeliveryLocation, DriverName, VehicleReg, WarehouseName
         FROM dbo.vw_mcp_loads
         WHERE (@status IS NULL OR Status = @status)
         ORDER BY ScheduledDeliveryDate ASC`,
        { limit, status: status ?? null }
      );
      return textResult({ count: rows.length, loads: rows });
    }
  );

  server.tool(
    'get_load',
    'Get full detail for a single load by its load number, including assigned driver, vehicle and linked invoices.',
    {
      loadNumber: z.string().describe('The load number, e.g. "L-2026-0012".'),
    },
    async ({ loadNumber }) => {
      const [load] = await query(
        `SELECT * FROM dbo.vw_mcp_loads WHERE LoadNumber = @loadNumber`,
        { loadNumber }
      );
      if (!load) return textResult({ error: 'Load not found', loadNumber });
      const invoices = await query(
        `SELECT Id, TransactionNumber, CustomerName, CustomerNumber,
                ProductCode, ProductDescription, Quantity, DeliveredQuantity,
                SalesAmount, SalesReturns, NetSales, CostOfSales, MarginPercent, GrossProfit,
                DeliveryCity, DeliveryProvince, Status
         FROM dbo.vw_mcp_load_invoices WHERE LoadId = @loadId`,
        { loadId: (load as any).Id }
      );
      return textResult({ load, invoices });
    }
  );

  // ---- Warehouses ----------------------------------------------------------
  server.tool(
    'list_warehouses',
    'List all warehouses with location, capacity and manager contact details.',
    {},
    async () => {
      const rows = await query(
        `SELECT Id, Name, Code, City, Province, Address,
                TotalCapacity, AvailableCapacity, ManagerName, PhoneNumber, Status
         FROM dbo.vw_mcp_warehouses ORDER BY Name`
      );
      return textResult({ count: rows.length, warehouses: rows });
    }
  );

  // ---- Drivers -------------------------------------------------------------
  server.tool(
    'list_drivers',
    'List drivers with licence details and status. Optionally filter by status (e.g. Active).',
    {
      status: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    },
    async ({ status, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, FirstName, LastName, LicenseNumber, LicenseType,
            LicenseExpiryDate, PhoneNumber, Status
         FROM dbo.vw_mcp_drivers
         WHERE (@status IS NULL OR Status = @status)
         ORDER BY LastName, FirstName`,
        { limit, status: status ?? null }
      );
      return textResult({ count: rows.length, drivers: rows });
    }
  );

  // ---- Vehicles ------------------------------------------------------------
  server.tool(
    'list_vehicles',
    'List fleet vehicles with registration, make/model, status and last known location. Optionally filter by status.',
    {
      status: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(200),
    },
    async ({ status, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, RegistrationNumber, Make, Model, Year, Status,
            CurrentOdometer, Province, LastKnownAddress, LastLocationUpdate
         FROM dbo.vw_mcp_vehicles
         WHERE (@status IS NULL OR Status = @status)
         ORDER BY RegistrationNumber`,
        { limit, status: status ?? null }
      );
      return textResult({ count: rows.length, vehicles: rows });
    }
  );

  // ---- Sales history summary ----------------------------------------------
  server.tool(
    'sales_history_summary',
    'Summarise reconciled sales history totals grouped by source company (and optionally by month) between two dates. Dates are ISO yyyy-mm-dd.',
    {
      fromDate: z.string().describe('Start date, inclusive, yyyy-mm-dd.'),
      toDate: z.string().describe('End date, inclusive, yyyy-mm-dd.'),
      byMonth: z.boolean().default(false).describe('If true, also group by year-month.'),
    },
    async ({ fromDate, toDate, byMonth }) => {
      const monthCol = byMonth ? `, FORMAT(InvoiceDate, 'yyyy-MM') AS Month` : '';
      const monthGroup = byMonth ? `, FORMAT(InvoiceDate, 'yyyy-MM')` : '';
      const rows = await query(
        `SELECT SourceCompany ${monthCol},
                COUNT(*) AS InvoiceCount,
                SUM(SalesAmount) AS TotalSales,
                SUM(TotalCost) AS TotalCost,
                SUM(GrossProfit) AS TotalGrossProfit,
                CAST(CASE WHEN SUM(SalesAmount) > 0
                     THEN SUM(GrossProfit) / SUM(SalesAmount) * 100 END AS decimal(6,2)) AS MarginPercent,
                SUM(CAST(IsReconciled AS int)) AS ReconciledCount
         FROM dbo.vw_mcp_sales_history
         WHERE InvoiceDate >= @fromDate AND InvoiceDate <= @toDate
         GROUP BY SourceCompany ${monthGroup}
         ORDER BY SourceCompany ${byMonth ? ', 2' : ''}`,
        { fromDate, toDate }
      );
      return textResult({ fromDate, toDate, rows });
    }
  );

  // ---- POD summary ---------------------------------------------------------
  server.tool(
    'pod_summary',
    'List proof-of-delivery (POD) documents, optionally filtered by region or delivery date range. Returns POD metadata including the stored file name, content type and size. Use get_pod_file with a POD Id to fetch the actual PDF/image bytes.',
    {
      region: z.string().optional(),
      fromDate: z.string().optional().describe('Delivery date from, yyyy-mm-dd.'),
      toDate: z.string().optional().describe('Delivery date to, yyyy-mm-dd.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ region, fromDate, toDate, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, PodNumber, DriverName, DriverId, DeliveryDate, Region,
            LoadId, InvoiceId, OriginalFileName, FileName, ContentType, FileSize, UploadedAt
         FROM dbo.vw_mcp_pods
         WHERE (@region IS NULL OR Region = @region)
           AND (@fromDate IS NULL OR DeliveryDate >= @fromDate)
           AND (@toDate IS NULL OR DeliveryDate <= @toDate)
         ORDER BY DeliveryDate DESC`,
        {
          limit,
          region: region ?? null,
          fromDate: fromDate ?? null,
          toDate: toDate ?? null,
        }
      );
      return textResult({ count: rows.length, pods: rows });
    }
  );

  // ---- POD file (actual PDF/image bytes) -----------------------------------
  server.tool(
    'get_pod_file',
    'Fetch the actual proof-of-delivery file (PDF or image) for a POD by its Id, returned as an embedded resource so it can be viewed/analysed. Use pod_summary first to find the POD Id.',
    {
      podId: z.number().int().describe('The PodDocuments Id (from pod_summary).'),
    },
    async ({ podId }) => {
      const [pod] = await query(
        `SELECT Id, PodNumber, FilePath, FileName, OriginalFileName, ContentType, FileSize
         FROM dbo.vw_mcp_pods WHERE Id = @podId`,
        { podId }
      );
      if (!pod) return textResult({ error: 'POD not found', podId });
      const p = pod as any;

      // Resolve the file safely inside DOCS_ROOT (defend against path traversal).
      // Stored FilePath is an absolute container path; fall back to the known
      // POD subfolder + filename if it doesn't resolve under DOCS_ROOT.
      const root = resolve(DOCS_ROOT);
      const candidates = [
        p.FilePath ? resolve(p.FilePath) : null,
        resolve(root, 'Logistics', 'POD-Documents', basename(p.FileName ?? '')),
      ].filter((c): c is string => !!c && normalize(c).startsWith(root));

      let bytes: Buffer | null = null;
      let usedPath: string | null = null;
      for (const c of candidates) {
        try {
          bytes = await readFile(c);
          usedPath = c;
          break;
        } catch {
          /* try next candidate */
        }
      }
      if (!bytes) {
        return textResult({
          error: 'File not found on disk for this POD',
          podId,
          fileName: p.FileName,
          triedPaths: candidates,
        });
      }

      const mimeType = p.ContentType || 'application/pdf';
      const name = p.OriginalFileName || p.FileName || `POD_${podId}`;
      return {
        content: [
          {
            type: 'text' as const,
            text: `POD ${p.PodNumber ?? podId} — ${name} (${mimeType}, ${bytes.length} bytes)`,
          },
          {
            type: 'resource' as const,
            resource: {
              uri: `pod://${podId}/${encodeURIComponent(name)}`,
              mimeType,
              blob: bytes.toString('base64'),
            },
          },
        ],
      };
    }
  );

  // ---- Driver licence expiry ----------------------------------------------
  server.tool(
    'driver_licence_expiry',
    'List drivers whose licence expires within the next N days (default 30), including already-expired ones. Useful for compliance follow-up (SOP 1).',
    {
      daysAhead: z.number().int().min(0).max(365).default(30).describe('Look-ahead window in days.'),
      includeExpired: z.boolean().default(true).describe('Include licences that have already expired.'),
    },
    async ({ daysAhead, includeExpired }) => {
      const rows = await query(
        `SELECT Id, FirstName, LastName, LicenseNumber, LicenseType,
                LicenseExpiryDate, PhoneNumber, Status,
                DATEDIFF(day, CAST(GETDATE() AS date), LicenseExpiryDate) AS DaysUntilExpiry
         FROM dbo.vw_mcp_drivers
         WHERE LicenseExpiryDate IS NOT NULL
           AND LicenseExpiryDate <= DATEADD(day, @daysAhead, CAST(GETDATE() AS date))
           AND (@includeExpired = 1 OR LicenseExpiryDate >= CAST(GETDATE() AS date))
         ORDER BY LicenseExpiryDate ASC`,
        { daysAhead, includeExpired: includeExpired ? 1 : 0 }
      );
      return textResult({ count: rows.length, daysAhead, drivers: rows });
    }
  );

  // ---- Maintenance ---------------------------------------------------------
  server.tool(
    'list_maintenance',
    'List vehicle maintenance/service records. Filter by vehicle, status (e.g. Scheduled, InProgress, Complete) or only upcoming/overdue services.',
    {
      vehicleId: z.number().int().optional().describe('Filter to one vehicle by its Id.'),
      status: z.string().optional().describe('Filter by maintenance status.'),
      upcomingOnly: z.boolean().default(false).describe('Only records scheduled/next-service dated today or later that are not yet complete.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ vehicleId, status, upcomingOnly, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, VehicleId, VehicleReg, MaintenanceType, Description, Status, Priority,
            ScheduledDate, CompletedDate, NextServiceDate,
            Cost, EstimatedCost, ServiceProvider, Province, ActionOwner
         FROM dbo.vw_mcp_maintenance
         WHERE (@vehicleId IS NULL OR VehicleId = @vehicleId)
           AND (@status IS NULL OR Status = @status)
           AND (@upcomingOnly = 0 OR (
                 Status <> 'Complete'
                 AND COALESCE(ScheduledDate, NextServiceDate) >= CAST(GETDATE() AS date)))
         ORDER BY COALESCE(ScheduledDate, NextServiceDate) ASC`,
        { vehicleId: vehicleId ?? null, status: status ?? null, upcomingOnly: upcomingOnly ? 1 : 0, limit }
      );
      return textResult({ count: rows.length, maintenance: rows });
    }
  );

  // ---- Outstanding PODs ----------------------------------------------------
  server.tool(
    'outstanding_pods',
    'List loads that were delivered but have no proof-of-delivery captured after a threshold number of hours (default 48). Helps chase missing PODs (SOP 3).',
    {
      thresholdHours: z.number().int().min(1).max(720).default(48).describe('Hours since delivery after which a missing POD is "outstanding".'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ thresholdHours, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            LoadId, LoadNumber, Status, ActualDeliveryDate, DeliveryLocation,
            DriverName, VehicleReg, HoursSinceDelivery
         FROM dbo.vw_mcp_outstanding_pods
         WHERE HoursSinceDelivery >= @thresholdHours
         ORDER BY ActualDeliveryDate ASC`,
        { thresholdHours, limit }
      );
      return textResult({ count: rows.length, thresholdHours, outstanding: rows });
    }
  );

  // ---- Sales trip sheets ---------------------------------------------------
  server.tool(
    'list_tripsheets',
    'List sales trip sheets with status, route/warehouse and schedule. Optionally filter by status (e.g. Draft, PendingSignature, PendingApproval, Approved, Rejected) or a scheduled-date range.',
    {
      status: z.string().optional(),
      fromDate: z.string().optional().describe('Scheduled date from, yyyy-mm-dd.'),
      toDate: z.string().optional().describe('Scheduled date to, yyyy-mm-dd.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ status, fromDate, toDate, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, TripSheetNumber, Status, RouteArea, WarehouseCode, ScheduledDate,
            CreatedByName, CreatedAt, CheckedByName, CheckedAt,
            ApproverName, SignedByName, SignedAt,
            ConvertedLoadNumber
         FROM dbo.vw_mcp_tripsheets
         WHERE (@status IS NULL OR Status = @status)
           AND (@fromDate IS NULL OR ScheduledDate >= @fromDate)
           AND (@toDate IS NULL OR ScheduledDate <= @toDate)
         ORDER BY ScheduledDate DESC, CreatedAt DESC`,
        { status: status ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, limit }
      );
      return textResult({ count: rows.length, tripsheets: rows });
    }
  );

  server.tool(
    'get_tripsheet',
    'Get full detail for one sales trip sheet by its trip sheet number, including all delivery lines (stops) and sign-off/approval status.',
    {
      tripSheetNumber: z.string().describe('The trip sheet number.'),
    },
    async ({ tripSheetNumber }) => {
      const [sheet] = await query(
        `SELECT * FROM dbo.vw_mcp_tripsheet_detail WHERE TripSheetNumber = @tripSheetNumber`,
        { tripSheetNumber }
      );
      if (!sheet) return textResult({ error: 'Trip sheet not found', tripSheetNumber });
      const lines = await query(
        `SELECT Sequence, CustomerName, InvoiceNumber, Address, City, Province,
                ContactPerson, ContactPhone, ProductDescription, Quantity, Value
         FROM dbo.vw_mcp_tripsheet_lines
         WHERE SalesTripSheetId = @id
         ORDER BY Sequence ASC`,
        { id: (sheet as any).Id }
      );
      return textResult({ tripsheet: sheet, lines });
    }
  );

  // ---- Fuel transactions ---------------------------------------------------
  server.tool(
    'list_fuel_transactions',
    'List fuel transactions (TFN/Puma card draws and manual entries) with litres and amount spent, optionally filtered by vehicle registration or report month/year (SOP 1 §E fuel discipline).',
    {
      registration: z.string().optional().describe('Filter by vehicle registration number.'),
      reportMonth: z.number().int().min(1).max(12).optional().describe('Filter by report month (1-12).'),
      reportYear: z.number().int().min(2020).max(2100).optional().describe('Filter by report year.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ registration, reportMonth, reportYear, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, VehicleId, RegistrationNumber, CardNumber, DepotName, DepotAssignment,
            AllocationLitres, LitresUsed, AmountSpent, TransactionDate,
            ReportMonth, ReportYear, Source
         FROM dbo.vw_mcp_fuel_transactions
         WHERE (@registration IS NULL OR RegistrationNumber = @registration)
           AND (@reportMonth IS NULL OR ReportMonth = @reportMonth)
           AND (@reportYear IS NULL OR ReportYear = @reportYear)
         ORDER BY TransactionDate DESC`,
        { registration: registration ?? null, reportMonth: reportMonth ?? null, reportYear: reportYear ?? null, limit }
      );
      return textResult({ count: rows.length, fuelTransactions: rows });
    }
  );

  // ---- Fuel efficiency summary --------------------------------------------
  server.tool(
    'fuel_efficiency_summary',
    'Summarise per-vehicle fuel efficiency from TFN card transactions between two dates: total litres, total spend, average km/l, and count of flagged anomalies (possible theft/leak, SOP 1 §E). If TFN card data is unavailable for the period, falls back to litres/spend from fuel transactions. Dates are yyyy-mm-dd.',
    {
      fromDate: z.string().describe('Start date, inclusive, yyyy-mm-dd.'),
      toDate: z.string().describe('End date, inclusive, yyyy-mm-dd.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ fromDate, toDate, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            VehicleReg,
            COUNT(*) AS FillCount,
            SUM(Litres) AS TotalLitres,
            SUM(TotalAmount) AS TotalSpend,
            AVG(NULLIF(FuelEfficiency, 0)) AS AvgKmPerLitre,
            SUM(CASE WHEN IsAnomaly = 1 THEN 1 ELSE 0 END) AS AnomalyCount
         FROM dbo.vw_mcp_tfn_transactions
         WHERE TransactionDate >= @fromDate AND TransactionDate <= @toDate
           AND VehicleReg IS NOT NULL
         GROUP BY VehicleReg
         ORDER BY AnomalyCount DESC, TotalSpend DESC`,
        { fromDate, toDate, limit }
      );
      if (rows.length > 0) {
        return textResult({ fromDate, toDate, source: 'TfnTransactions', count: rows.length, vehicles: rows });
      }
      // Fallback: TFN card data not synced yet — summarise from FuelTransactions
      // (litres & spend available; efficiency/anomaly not tracked there).
      const fallback = await query(
        `SELECT TOP (@limit)
            RegistrationNumber AS VehicleReg,
            COUNT(*) AS FillCount,
            SUM(LitresUsed) AS TotalLitres,
            SUM(AmountSpent) AS TotalSpend,
            NULL AS AvgKmPerLitre,
            0 AS AnomalyCount
         FROM dbo.vw_mcp_fuel_transactions
         WHERE TransactionDate >= @fromDate AND TransactionDate <= @toDate
           AND RegistrationNumber IS NOT NULL
         GROUP BY RegistrationNumber
         ORDER BY TotalSpend DESC`,
        { fromDate, toDate, limit }
      );
      return textResult({
        fromDate,
        toDate,
        source: 'FuelTransactions',
        note: 'TFN card transactions (efficiency/anomaly) not available for this period; showing litres and spend from fuel transactions instead.',
        count: fallback.length,
        vehicles: fallback,
      });
    }
  );

  // ---- Fuel orders ---------------------------------------------------------
  server.tool(
    'list_fuel_orders',
    'List TFN fuel orders with allocated vs used litres/amount and remaining balance, optionally filtered by vehicle registration or status (SOP 1 fuel/TFN).',
    {
      registration: z.string().optional().describe('Filter by vehicle registration.'),
      status: z.string().optional().describe('Filter by order status.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ registration, status, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, OrderNumber, OrderDate, Status, VehicleReg, DriverName, FuelType,
            OrderedLitres, AllocatedLitres, AllocatedAmount,
            UsedLitres, UsedAmount, RemainingLitres, RemainingAmount,
            IsPlanned, ExpiryDate, LoadId
         FROM dbo.vw_mcp_fuel_orders
         WHERE (@registration IS NULL OR VehicleReg = @registration)
           AND (@status IS NULL OR Status = @status)
         ORDER BY OrderDate DESC`,
        { registration: registration ?? null, status: status ?? null, limit }
      );
      return textResult({ count: rows.length, fuelOrders: rows });
    }
  );

  // ---- Vehicle movement history -------------------------------------------
  server.tool(
    'list_vehicle_movements',
    'List CarTrack vehicle movement/trip records (distance, duration, max speed, idle time, harsh braking/cornering/acceleration events, geofences), optionally filtered by vehicle registration and date range.',
    {
      registration: z.string().optional().describe('Filter by vehicle registration.'),
      fromDate: z.string().optional().describe('Movement date from, yyyy-mm-dd.'),
      toDate: z.string().optional().describe('Movement date to, yyyy-mm-dd.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ registration, fromDate, toDate, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, VehicleId, RegistrationNumber, MovementDate,
            StartTimestamp, EndTimestamp, TripDuration,
            StartLocation, EndLocation, StartGeofence, EndGeofence,
            TripDistance, MaxSpeed, IdleTimeSeconds,
            HarshBrakingEvents, HarshCorneringEvents, HarshAccelerationEvents
         FROM dbo.vw_mcp_vehicle_movements
         WHERE (@registration IS NULL OR RegistrationNumber = @registration)
           AND (@fromDate IS NULL OR MovementDate >= @fromDate)
           AND (@toDate IS NULL OR MovementDate <= @toDate)
         ORDER BY MovementDate DESC`,
        { registration: registration ?? null, fromDate: fromDate ?? null, toDate: toDate ?? null, limit }
      );
      return textResult({ count: rows.length, movements: rows });
    }
  );

  // ---- Driving behaviour / fuel-behaviour score ---------------------------
  server.tool(
    'driving_behaviour_summary',
    'Summarise per-vehicle driving behaviour from CarTrack movement history between two dates: total trips, distance, idle time, max speed, and harsh braking/cornering/acceleration counts, plus a simple behaviour score (100 minus penalties for harsh events and idling per 100km). Lower harsh-event rates = higher score. Useful as a fuel-efficiency/driver-behaviour proxy (SOP 1). Dates are yyyy-mm-dd.',
    {
      fromDate: z.string().describe('Start date, inclusive, yyyy-mm-dd.'),
      toDate: z.string().describe('End date, inclusive, yyyy-mm-dd.'),
      registration: z.string().optional().describe('Optionally limit to one vehicle registration.'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ fromDate, toDate, registration, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            RegistrationNumber,
            COUNT(*) AS TripCount,
            SUM(TripDistance) AS TotalDistanceKm,
            SUM(IdleTimeSeconds) / 3600.0 AS TotalIdleHours,
            MAX(MaxSpeed) AS TopSpeed,
            SUM(HarshBrakingEvents) AS HarshBraking,
            SUM(HarshCorneringEvents) AS HarshCornering,
            SUM(HarshAccelerationEvents) AS HarshAcceleration,
            CAST(
              100.0
              - 2.0 * (SUM(HarshBrakingEvents) + SUM(HarshCorneringEvents) + SUM(HarshAccelerationEvents))
                    / NULLIF(SUM(TripDistance), 0) * 100.0
              - 0.5 * (SUM(IdleTimeSeconds) / 3600.0) / NULLIF(SUM(TripDistance), 0) * 100.0
            AS DECIMAL(6,1)) AS BehaviourScore
         FROM dbo.vw_mcp_vehicle_movements
         WHERE MovementDate >= @fromDate AND MovementDate <= @toDate
           AND RegistrationNumber IS NOT NULL
           AND (@registration IS NULL OR RegistrationNumber = @registration)
         GROUP BY RegistrationNumber
         ORDER BY BehaviourScore ASC`,
        { fromDate, toDate, registration: registration ?? null, limit }
      );
      return textResult({
        fromDate,
        toDate,
        note: 'BehaviourScore is a computed proxy: 100 minus 2 points per harsh event per 100km and 0.5 per idle-hour per 100km. Not a stored value; ordered worst-first.',
        count: rows.length,
        vehicles: rows,
      });
    }
  );

  // ---- Customers -----------------------------------------------------------
  server.tool(
    'list_customers',
    'Search/list logistics customers with contact details, physical + delivery addresses (geocoded), and financial terms: payment terms, credit limit, VAT and company registration numbers. Filter by a name/code search term or province.',
    {
      search: z.string().optional().describe('Case-insensitive match on customer name, short name or code.'),
      province: z.string().optional().describe('Filter by delivery or physical province.'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ search, province, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, CustomerCode, Name, ShortName, ContactPerson,
            ContactEmail, ContactPhone, MobileNumber,
            CompanyRegistration, VatNumber, PaymentTerms, CreditLimit,
            PhysicalAddress, City, Province, PostalCode,
            DeliveryAddress, DeliveryCity, DeliveryProvince, DeliveryPostalCode,
            Latitude, Longitude, AddressVerified, Status
         FROM dbo.vw_mcp_customers
         WHERE (@search IS NULL OR Name LIKE '%' + @search + '%'
                 OR ShortName LIKE '%' + @search + '%'
                 OR CustomerCode LIKE '%' + @search + '%')
           AND (@province IS NULL OR Province = @province OR DeliveryProvince = @province)
         ORDER BY Name`,
        { search: search ?? null, province: province ?? null, limit }
      );
      return textResult({ count: rows.length, customers: rows });
    }
  );

  // ---- Customer delivery addresses ----------------------------------------
  server.tool(
    'customer_delivery_addresses',
    'List saved, geocoded delivery addresses. Provide a customerId to get all addresses for one customer, or filter by city/province. Includes contact, delivery instructions, default flag and usage count.',
    {
      customerId: z.number().int().optional().describe('Get all delivery addresses for one customer by Id.'),
      city: z.string().optional(),
      province: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ customerId, city, province, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            Id, CustomerId, AddressLabel, Address, City, Province, PostalCode,
            ContactPerson, ContactPhone, Latitude, Longitude, FormattedAddress,
            IsDefault, IsActive, DeliveryInstructions, UsageCount, LastUsedAt
         FROM dbo.vw_mcp_customer_addresses
         WHERE (@customerId IS NULL OR CustomerId = @customerId)
           AND (@city IS NULL OR City = @city)
           AND (@province IS NULL OR Province = @province)
         ORDER BY IsDefault DESC, UsageCount DESC`,
        { customerId: customerId ?? null, city: city ?? null, province: province ?? null, limit }
      );
      return textResult({ count: rows.length, addresses: rows });
    }
  );

  // ---- Get customer bundle (customer + addresses + recent invoices/loads) --
  server.tool(
    'get_customer',
    'Get a full bundle for one customer: their details (including payment terms, credit limit, VAT/registration numbers), all saved delivery addresses, recent imported invoices with full financials (sales, cost, margin), and any loads those invoices are on. Look up by customerId, or by a name/code search (best/most-exact match used). Handy for support/dispute lookups.',
    {
      customerId: z.number().int().optional().describe('The LogisticsCustomers Id.'),
      search: z.string().optional().describe('Name/short-name/code search if customerId is not known (first match used).'),
      invoiceLimit: z.number().int().min(1).max(100).default(20).describe('Max recent invoices to include.'),
    },
    async ({ customerId, search, invoiceLimit }) => {
      if (customerId == null && !search) {
        return textResult({ error: 'Provide either customerId or search.' });
      }
      const [customer] = await query(
        `SELECT TOP 1 * FROM dbo.vw_mcp_customers
         WHERE (@customerId IS NOT NULL AND Id = @customerId)
            OR (@customerId IS NULL AND (
                 Name LIKE '%' + @search + '%'
                 OR ShortName LIKE '%' + @search + '%'
                 OR CustomerCode LIKE '%' + @search + '%'))
         ORDER BY
           -- Prefer the most relevant match: exact, then prefix, then contains.
           CASE
             WHEN Name = @search OR ShortName = @search OR CustomerCode = @search THEN 0
             WHEN Name LIKE @search + '%' OR ShortName LIKE @search + '%' THEN 1
             ELSE 2
           END,
           LEN(Name),
           Name`,
        { customerId: customerId ?? null, search: search ?? null }
      );
      if (!customer) return textResult({ error: 'Customer not found', customerId, search });
      const cid = (customer as any).Id;
      const cname = (customer as any).Name;

      const addresses = await query(
        `SELECT Id, AddressLabel, Address, City, Province, PostalCode,
                ContactPerson, ContactPhone, Latitude, Longitude,
                IsDefault, IsActive, DeliveryInstructions, UsageCount, LastUsedAt
         FROM dbo.vw_mcp_customer_addresses
         WHERE CustomerId = @cid
         ORDER BY IsDefault DESC, UsageCount DESC`,
        { cid }
      );

      // Invoices link to customers most reliably by name.
      const invoices = await query(
        `SELECT TOP (@invoiceLimit)
            Id, TransactionNumber, ProductDescription, Quantity, DeliveredQuantity,
            SalesAmount, SalesReturns, NetSales, CostOfSales, MarginPercent, GrossProfit,
            SourceCompany, DeliveryCity, DeliveryProvince,
            ScheduledDeliveryDate, Status, TransactionDate, LoadId
         FROM dbo.vw_mcp_pending_invoices
         WHERE CustomerName = @cname
         ORDER BY TransactionDate DESC`,
        { cname, invoiceLimit }
      );

      const loadIds = Array.from(new Set(invoices.map((i: any) => i.LoadId).filter((x: any) => x != null)));
      let loads: any[] = [];
      if (loadIds.length > 0) {
        loads = await query(
          `SELECT Id, LoadNumber, Status, ScheduledDeliveryDate, ActualDeliveryDate,
                  DeliveryLocation, DriverName, VehicleReg
           FROM dbo.vw_mcp_loads
           WHERE Id IN (${loadIds.map((_, idx) => `@l${idx}`).join(', ')})`,
          Object.fromEntries(loadIds.map((id, idx) => [`l${idx}`, id]))
        );
      }

      return textResult({
        customer,
        addresses,
        invoiceCount: invoices.length,
        invoices,
        relatedLoads: loads,
      });
    }
  );

  // ===========================================================================
  // Phase 2 — analytics / KPI tools.
  // NOTE: The enhancement plan suggested proxying the backend Reports API, but
  // the app has no live delivery-performance/route-efficiency endpoints (the
  // "reports" it computes are sales narratives). To keep a single security model
  // (least-privilege mcp_readonly on vw_mcp_* views, no service account / API
  // hop) these KPIs are derived directly from the same load/POD data the app
  // uses. Definitions here should be cross-checked if the app later ships its
  // own computed KPI endpoints, per the enhancement doc.
  // ===========================================================================

  // ---- Delivery performance KPI ---------------------------------------------
  server.tool(
    'delivery_performance_summary',
    'Delivery performance KPIs over a date range: total loads, delivered count, on-time vs late (Actual vs Scheduled delivery date), on-time %, and average delay. Optionally broken down by warehouse. NOTE: the Loads data has no explicit failure/short-delivery reason field, so this covers on-time/late/pending only, not failure reasons.',
    {
      fromDate: z.string().optional().describe('Start date (YYYY-MM-DD), filters on ScheduledDeliveryDate. Defaults to 30 days ago.'),
      toDate: z.string().optional().describe('End date (YYYY-MM-DD). Defaults to today.'),
      byWarehouse: z.boolean().default(false).describe('If true, also return a per-warehouse breakdown.'),
    },
    async ({ fromDate, toDate, byWarehouse }) => {
      const from = fromDate ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const to = toDate ?? new Date().toISOString().slice(0, 10);
      const where = `ScheduledDeliveryDate >= @from AND ScheduledDeliveryDate < DATEADD(day, 1, CAST(@to AS date))`;
      const metrics = `
        COUNT(*) AS TotalLoads,
        SUM(CASE WHEN ActualDeliveryDate IS NOT NULL THEN 1 ELSE 0 END) AS Delivered,
        SUM(CASE WHEN ActualDeliveryDate IS NOT NULL
                  AND CAST(ActualDeliveryDate AS date) <= CAST(ScheduledDeliveryDate AS date)
                 THEN 1 ELSE 0 END) AS OnTime,
        SUM(CASE WHEN ActualDeliveryDate IS NOT NULL
                  AND CAST(ActualDeliveryDate AS date) > CAST(ScheduledDeliveryDate AS date)
                 THEN 1 ELSE 0 END) AS Late,
        SUM(CASE WHEN ActualDeliveryDate IS NULL THEN 1 ELSE 0 END) AS NotYetDelivered,
        CAST(AVG(CASE WHEN ActualDeliveryDate IS NOT NULL
                 THEN CAST(DATEDIFF(hour, ScheduledDeliveryDate, ActualDeliveryDate) AS float) END)
             AS decimal(10,1)) AS AvgDelayHours`;

      const [overall] = await query(
        `SELECT ${metrics} FROM dbo.vw_mcp_loads WHERE ${where}`,
        { from, to }
      );
      const o = overall as any;
      const onTimePct = o.Delivered > 0 ? Math.round((o.OnTime / o.Delivered) * 1000) / 10 : null;

      let warehouses: any[] | undefined;
      if (byWarehouse) {
        warehouses = await query(
          `SELECT ISNULL(WarehouseName, '(unassigned)') AS WarehouseName, ${metrics}
           FROM dbo.vw_mcp_loads WHERE ${where}
           GROUP BY WarehouseName ORDER BY COUNT(*) DESC`,
          { from, to }
        );
        warehouses = warehouses.map((w: any) => ({
          ...w,
          OnTimePct: w.Delivered > 0 ? Math.round((w.OnTime / w.Delivered) * 1000) / 10 : null,
        }));
      }

      return textResult({
        period: { fromDate: from, toDate: to },
        totalLoads: o.TotalLoads,
        delivered: o.Delivered,
        onTime: o.OnTime,
        late: o.Late,
        notYetDelivered: o.NotYetDelivered,
        onTimePct,
        avgDelayHours: o.AvgDelayHours,
        byWarehouse: warehouses,
      });
    }
  );

  // ---- Route / capacity efficiency KPI --------------------------------------
  server.tool(
    'route_efficiency_summary',
    'Route & capacity efficiency KPIs over a date range: estimated vs actual distance and cost, average distance/weight/volume per load, and a distance-accuracy ratio (actual ÷ estimated). Helps spot routing drift and cost overruns.',
    {
      fromDate: z.string().optional().describe('Start date (YYYY-MM-DD), filters on ScheduledDeliveryDate. Defaults to 30 days ago.'),
      toDate: z.string().optional().describe('End date (YYYY-MM-DD). Defaults to today.'),
    },
    async ({ fromDate, toDate }) => {
      const from = fromDate ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const to = toDate ?? new Date().toISOString().slice(0, 10);
      const [r] = await query(
        `SELECT
            COUNT(*) AS TotalLoads,
            CAST(SUM(EstimatedDistance) AS decimal(14,1)) AS TotalEstimatedDistance,
            CAST(SUM(ActualDistance) AS decimal(14,1)) AS TotalActualDistance,
            CAST(SUM(EstimatedCost) AS decimal(14,2)) AS TotalEstimatedCost,
            CAST(SUM(ActualCost) AS decimal(14,2)) AS TotalActualCost,
            CAST(AVG(ActualDistance) AS decimal(12,1)) AS AvgDistancePerLoad,
            CAST(AVG(TotalWeight) AS decimal(12,1)) AS AvgWeightPerLoad,
            CAST(AVG(TotalVolume) AS decimal(12,1)) AS AvgVolumePerLoad
         FROM dbo.vw_mcp_loads
         WHERE ScheduledDeliveryDate >= @from
           AND ScheduledDeliveryDate < DATEADD(day, 1, CAST(@to AS date))`,
        { from, to }
      );
      const x = r as any;
      const distanceAccuracy = x.TotalEstimatedDistance > 0
        ? Math.round((x.TotalActualDistance / x.TotalEstimatedDistance) * 1000) / 1000
        : null;
      const costVariance = x.TotalEstimatedCost != null && x.TotalActualCost != null
        ? Math.round((x.TotalActualCost - x.TotalEstimatedCost) * 100) / 100
        : null;

      return textResult({
        period: { fromDate: from, toDate: to },
        totalLoads: x.TotalLoads,
        distance: {
          estimated: x.TotalEstimatedDistance,
          actual: x.TotalActualDistance,
          actualOverEstimatedRatio: distanceAccuracy,
          avgPerLoad: x.AvgDistancePerLoad,
        },
        cost: {
          estimated: x.TotalEstimatedCost,
          actual: x.TotalActualCost,
          variance: costVariance,
        },
        avgWeightPerLoad: x.AvgWeightPerLoad,
        avgVolumePerLoad: x.AvgVolumePerLoad,
      });
    }
  );

  // ---- Stock on hand summary ------------------------------------------------
  server.tool(
    'stock_on_hand_summary',
    'Warehouse stock on hand: quantity per commodity by warehouse, with reorder/maximum levels and a below-reorder flag. Filter by warehouse or commodity, or set belowReorderOnly to list only lines needing a restock.',
    {
      warehouse: z.string().optional().describe('Warehouse name/code contains this text.'),
      commodity: z.string().optional().describe('Commodity name/code contains this text.'),
      belowReorderOnly: z.boolean().default(false).describe('If true, only return lines at/below reorder level.'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows.'),
    },
    async ({ warehouse, commodity, belowReorderOnly, limit }) => {
      const rows = await query(
        `SELECT TOP (@limit)
            WarehouseName, WarehouseCode, WarehouseProvince,
            CommodityName, CommodityCode, Category, UnitOfMeasure,
            QuantityOnHand, ReorderLevel, MaximumLevel, BinLocation,
            LastCountDate, LastRestockDate, BelowReorder
         FROM dbo.vw_mcp_stock_on_hand
         WHERE (@warehouse IS NULL OR WarehouseName LIKE '%' + @warehouse + '%' OR WarehouseCode LIKE '%' + @warehouse + '%')
           AND (@commodity IS NULL OR CommodityName LIKE '%' + @commodity + '%' OR CommodityCode LIKE '%' + @commodity + '%')
           AND (@belowReorderOnly = 0 OR BelowReorder = 1)
         ORDER BY BelowReorder DESC, WarehouseName, CommodityName`,
        {
          warehouse: warehouse ?? null,
          commodity: commodity ?? null,
          belowReorderOnly: belowReorderOnly ? 1 : 0,
          limit,
        }
      );
      const belowReorderCount = rows.filter((r: any) => r.BelowReorder === 1).length;
      return textResult({ count: rows.length, belowReorderCount, items: rows });
    }
  );

  // ---- Daily ops briefing (composed) ----------------------------------------
  server.tool(
    'daily_ops_briefing',
    'A composed one-day operations snapshot: loads scheduled/delivered that day, on-time %, still-pending loads, and outstanding PODs older than the threshold. Great for a "summarise yesterday" or "how did today go" question.',
    {
      date: z.string().optional().describe('Day to summarise (YYYY-MM-DD). Defaults to today.'),
      outstandingPodHours: z.number().int().min(1).max(336).default(24).describe('POD is "outstanding" if not captured within this many hours of delivery.'),
    },
    async ({ date, outstandingPodHours }) => {
      const day = date ?? new Date().toISOString().slice(0, 10);
      const [loads] = await query(
        `SELECT
            COUNT(*) AS Scheduled,
            SUM(CASE WHEN ActualDeliveryDate IS NOT NULL THEN 1 ELSE 0 END) AS Delivered,
            SUM(CASE WHEN ActualDeliveryDate IS NOT NULL
                      AND CAST(ActualDeliveryDate AS date) <= CAST(ScheduledDeliveryDate AS date)
                     THEN 1 ELSE 0 END) AS OnTime,
            SUM(CASE WHEN ActualDeliveryDate IS NULL THEN 1 ELSE 0 END) AS StillPending
         FROM dbo.vw_mcp_loads
         WHERE CAST(ScheduledDeliveryDate AS date) = @day`,
        { day }
      );
      const l = loads as any;
      const onTimePct = l.Delivered > 0 ? Math.round((l.OnTime / l.Delivered) * 1000) / 10 : null;

      const outstanding = await query(
        `SELECT TOP 20 LoadNumber, DriverName, VehicleReg, DeliveryLocation,
                ActualDeliveryDate, HoursSinceDelivery
         FROM dbo.vw_mcp_outstanding_pods
         WHERE HoursSinceDelivery >= @hours
         ORDER BY HoursSinceDelivery DESC`,
        { hours: outstandingPodHours }
      );

      return textResult({
        date: day,
        loads: {
          scheduled: l.Scheduled,
          delivered: l.Delivered,
          onTime: l.OnTime,
          onTimePct,
          stillPending: l.StillPending,
        },
        outstandingPods: {
          thresholdHours: outstandingPodHours,
          count: outstanding.length,
          items: outstanding,
        },
      });
    }
  );
}
