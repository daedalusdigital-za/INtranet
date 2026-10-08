import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, normalize, basename, join, extname } from 'node:path';
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
    'Fetch the actual proof-of-delivery file (PDF or image) for a POD by its Id, returned as an embedded resource so it can be viewed/analysed. Use pod_summary first to find the POD Id. When analysing the scan, cross-check it against the load: compare the signature presence, delivery date and received quantities on the document against the invoice lines (load_timeline / get_load) and the load\'s actual delivery date, and flag any mismatch.',
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

  // ===========================================================================
  // Phase 3 — composed lookups, scorecards and exception sweeps.
  // ===========================================================================

  // ---- Where is a vehicle right now? ----------------------------------------
  server.tool(
    'where_is_vehicle',
    "A vehicle's current situation: last known position (CarTrack-synced address + timestamp), its most recent movement/trip, and any active load with the scheduled next delivery (as an ETA proxy). Look up by registration number.",
    {
      registration: z.string().describe('Vehicle registration number, e.g. "JND553MP".'),
    },
    async ({ registration }) => {
      const [vehicle] = await query(
        `SELECT Id, RegistrationNumber, Make, Model, Status, CurrentOdometer,
                Province, LastKnownAddress, LastLocationUpdate
         FROM dbo.vw_mcp_vehicles WHERE RegistrationNumber = @registration`,
        { registration }
      );
      if (!vehicle) return textResult({ error: 'Vehicle not found', registration });

      const [lastTrip] = await query(
        `SELECT TOP 1 MovementDate, StartTimestamp, EndTimestamp, StartLocation, EndLocation,
                TripDistance, MaxSpeed, IdleTimeSeconds
         FROM dbo.vw_mcp_vehicle_movements
         WHERE RegistrationNumber = @registration
         ORDER BY EndTimestamp DESC`,
        { registration }
      );

      const activeLoads = await query(
        `SELECT TOP 5 LoadNumber, Status, ScheduledPickupDate, ScheduledDeliveryDate,
                PickupLocation, DeliveryLocation, DriverName
         FROM dbo.vw_mcp_loads
         WHERE VehicleReg = @registration AND ActualDeliveryDate IS NULL
           AND Status NOT IN ('Cancelled')
         ORDER BY ScheduledDeliveryDate ASC`,
        { registration }
      );

      return textResult({
        vehicle,
        lastKnownPosition: {
          address: (vehicle as any).LastKnownAddress,
          updatedAt: (vehicle as any).LastLocationUpdate,
        },
        lastTrip: lastTrip ?? null,
        activeLoads,
        note: 'Position is the last CarTrack sync, not a live GPS ping. ETA = ScheduledDeliveryDate of the active load.',
      });
    }
  );

  // ---- Full load timeline ----------------------------------------------------
  server.tool(
    'load_timeline',
    'One load end-to-end: the load record, its invoices, the originating trip sheet (if converted from one), CarTrack trips of the assigned vehicle between pickup and delivery, and POD documents. Answers "where did this load go wrong?" in one call.',
    {
      loadNumber: z.string().describe('The load number, e.g. "L-2026-0012".'),
    },
    async ({ loadNumber }) => {
      const [load] = await query(
        `SELECT * FROM dbo.vw_mcp_loads WHERE LoadNumber = @loadNumber`,
        { loadNumber }
      );
      if (!load) return textResult({ error: 'Load not found', loadNumber });
      const L = load as any;

      const [invoices, tripsheet, pods] = await Promise.all([
        query(
          `SELECT TransactionNumber, CustomerName, ProductDescription, Quantity, DeliveredQuantity,
                  NetSales, DeliveryCity, DeliveryProvince, Status
           FROM dbo.vw_mcp_load_invoices WHERE LoadId = @id`,
          { id: L.Id }
        ),
        query(
          `SELECT TripSheetNumber, Status, RouteArea, ScheduledDate, CreatedByName,
                  CheckedByName, ApproverName, SignedByName, SignedAt
           FROM dbo.vw_mcp_tripsheets WHERE ConvertedLoadNumber = @loadNumber`,
          { loadNumber }
        ),
        query(
          `SELECT Id, PodNumber, DriverName, DeliveryDate, Region, OriginalFileName, UploadedAt,
                  DATEDIFF(hour, DeliveryDate, UploadedAt) AS PodTurnaroundHours
           FROM dbo.vw_mcp_pods WHERE LoadId = @id`,
          { id: L.Id }
        ),
      ]);

      let movements: any[] = [];
      if (L.VehicleReg && L.ScheduledPickupDate) {
        movements = await query(
          `SELECT MovementDate, StartTimestamp, EndTimestamp, StartLocation, EndLocation,
                  TripDistance, MaxSpeed, IdleTimeSeconds,
                  HarshBrakingEvents, HarshCorneringEvents, HarshAccelerationEvents
           FROM dbo.vw_mcp_vehicle_movements
           WHERE RegistrationNumber = @reg
             AND MovementDate >= CAST(@fromD AS date)
             AND MovementDate <= CAST(COALESCE(@toD, GETDATE()) AS date)
           ORDER BY StartTimestamp ASC`,
          { reg: L.VehicleReg, fromD: L.ScheduledPickupDate, toD: L.ActualDeliveryDate ?? L.ScheduledDeliveryDate }
        );
      }

      return textResult({
        load,
        originatingTripsheet: tripsheet[0] ?? null,
        invoices,
        vehicleTripsDuringLoad: movements,
        pods,
        analysisHints: 'Compare ActualDeliveryDate vs ScheduledDeliveryDate; check movements for late depot departure, excessive idle, or off-route locations; check POD turnaround hours.',
      });
    }
  );

  // ---- Customer scorecard ----------------------------------------------------
  server.tool(
    'customer_scorecard',
    "One customer's performance scorecard: on-time delivery %, average POD turnaround, monthly sales trend, recent sales total vs credit limit, and pending (undelivered) value. Look up by name/code search.",
    {
      search: z.string().describe('Customer name, short name or code.'),
      months: z.number().int().min(1).max(24).default(6).describe('How many months of sales trend.'),
    },
    async ({ search, months }) => {
      const [customer] = await query(
        `SELECT TOP 1 Id, CustomerCode, Name, PaymentTerms, CreditLimit, Status
         FROM dbo.vw_mcp_customers
         WHERE Name LIKE '%' + @search + '%' OR ShortName LIKE '%' + @search + '%' OR CustomerCode LIKE '%' + @search + '%'
         ORDER BY CASE WHEN Name = @search THEN 0 WHEN Name LIKE @search + '%' THEN 1 ELSE 2 END, LEN(Name)`,
        { search }
      );
      if (!customer) return textResult({ error: 'Customer not found', search });
      const cname = (customer as any).Name;

      const [delivery] = await query(
        `SELECT COUNT(DISTINCT l.Id) AS TotalLoads,
                SUM(CASE WHEN l.ActualDeliveryDate IS NOT NULL AND CAST(l.ActualDeliveryDate AS date) <= CAST(l.ScheduledDeliveryDate AS date) THEN 1 ELSE 0 END) AS OnTime,
                SUM(CASE WHEN l.ActualDeliveryDate IS NOT NULL THEN 1 ELSE 0 END) AS Delivered
         FROM dbo.vw_mcp_loads l
         WHERE l.Id IN (SELECT DISTINCT LoadId FROM dbo.vw_mcp_pending_invoices WHERE CustomerName = @cname AND LoadId IS NOT NULL)`,
        { cname }
      );

      const [podStats] = await query(
        `SELECT COUNT(*) AS PodCount,
                CAST(AVG(CAST(DATEDIFF(hour, p.DeliveryDate, p.UploadedAt) AS float)) AS decimal(10,1)) AS AvgPodTurnaroundHours
         FROM dbo.vw_mcp_pods p
         WHERE p.LoadId IN (SELECT DISTINCT LoadId FROM dbo.vw_mcp_pending_invoices WHERE CustomerName = @cname AND LoadId IS NOT NULL)`,
        { cname }
      );

      const salesTrend = await query(
        `SELECT YEAR(InvoiceDate) AS Yr, MONTH(InvoiceDate) AS Mo,
                CAST(SUM(SalesAmount) AS decimal(14,2)) AS Sales,
                CAST(SUM(GrossProfit) AS decimal(14,2)) AS GrossProfit
         FROM dbo.vw_mcp_sales_history
         WHERE CustomerName = @cname AND InvoiceDate >= DATEADD(month, -@months, GETDATE())
         GROUP BY YEAR(InvoiceDate), MONTH(InvoiceDate)
         ORDER BY Yr, Mo`,
        { cname, months }
      );

      const [pendingValue] = await query(
        `SELECT CAST(SUM(NetSales) AS decimal(14,2)) AS PendingNetSales, COUNT(*) AS PendingLines
         FROM dbo.vw_mcp_pending_invoices
         WHERE CustomerName = @cname AND (LoadId IS NULL OR Status = 'Pending')`,
        { cname }
      );

      const d = delivery as any;
      const recentSales = salesTrend.reduce((s: number, r: any) => s + Number(r.Sales ?? 0), 0);
      const creditLimit = Number((customer as any).CreditLimit ?? 0);

      return textResult({
        customer,
        delivery: {
          totalLoads: d.TotalLoads,
          delivered: d.Delivered,
          onTime: d.OnTime,
          onTimePct: d.Delivered > 0 ? Math.round((d.OnTime / d.Delivered) * 1000) / 10 : null,
        },
        pod: podStats,
        salesTrendByMonth: salesTrend,
        pending: pendingValue,
        credit: {
          creditLimit,
          recentSalesTotal: Math.round(recentSales * 100) / 100,
          note: 'Outstanding balance is not tracked in the logistics DB; recent sales vs credit limit is a proxy only.',
        },
      });
    }
  );

  // ---- Driver scorecard -------------------------------------------------------
  server.tool(
    'driver_scorecard',
    "One driver's scorecard: licence status, on-time delivery %, missing PODs, fuel efficiency (TFN), and driving behaviour (harsh events from CarTrack on vehicles they drove). Look up by name search.",
    {
      search: z.string().describe('Driver first/last name (partial ok).'),
      days: z.number().int().min(7).max(365).default(90).describe('Look-back window in days.'),
    },
    async ({ search, days }) => {
      const [driver] = await query(
        `SELECT TOP 1 Id, FirstName, LastName, LicenseNumber, LicenseType, LicenseExpiryDate, Status,
                DATEDIFF(day, CAST(GETDATE() AS date), LicenseExpiryDate) AS DaysUntilLicenceExpiry
         FROM dbo.vw_mcp_drivers
         WHERE FirstName + ' ' + LastName LIKE '%' + @search + '%'
         ORDER BY LEN(FirstName + LastName)`,
        { search }
      );
      if (!driver) return textResult({ error: 'Driver not found', search });
      const D = driver as any;

      const [loads] = await query(
        `SELECT COUNT(*) AS TotalLoads,
                SUM(CASE WHEN ActualDeliveryDate IS NOT NULL THEN 1 ELSE 0 END) AS Delivered,
                SUM(CASE WHEN ActualDeliveryDate IS NOT NULL AND CAST(ActualDeliveryDate AS date) <= CAST(ScheduledDeliveryDate AS date) THEN 1 ELSE 0 END) AS OnTime
         FROM dbo.vw_mcp_loads
         WHERE DriverId = @id AND ScheduledDeliveryDate >= DATEADD(day, -@days, GETDATE())`,
        { id: D.Id, days }
      );

      const missingPods = await query(
        `SELECT LoadNumber, ActualDeliveryDate, HoursSinceDelivery
         FROM dbo.vw_mcp_outstanding_pods WHERE DriverName = @dn ORDER BY HoursSinceDelivery DESC`,
        { dn: `${D.FirstName} ${D.LastName}` }
      );

      const [fuel] = await query(
        `SELECT COUNT(*) AS FillCount, CAST(SUM(Litres) AS decimal(12,1)) AS TotalLitres,
                CAST(SUM(TotalAmount) AS decimal(14,2)) AS TotalSpend,
                CAST(AVG(NULLIF(FuelEfficiency,0)) AS decimal(8,2)) AS AvgKmPerLitre,
                SUM(CASE WHEN IsAnomaly = 1 THEN 1 ELSE 0 END) AS Anomalies
         FROM dbo.vw_mcp_tfn_transactions
         WHERE DriverId = @id AND TransactionDate >= DATEADD(day, -@days, GETDATE())`,
        { id: D.Id, days }
      );

      const behaviour = await query(
        `SELECT m.RegistrationNumber, COUNT(*) AS Trips,
                CAST(SUM(m.TripDistance) AS decimal(12,1)) AS DistanceKm,
                SUM(m.HarshBrakingEvents + m.HarshCorneringEvents + m.HarshAccelerationEvents) AS HarshEvents
         FROM dbo.vw_mcp_vehicle_movements m
         WHERE m.RegistrationNumber IN (
                 SELECT DISTINCT VehicleReg FROM dbo.vw_mcp_loads WHERE DriverId = @id AND VehicleReg IS NOT NULL)
           AND m.MovementDate >= DATEADD(day, -@days, GETDATE())
         GROUP BY m.RegistrationNumber`,
        { id: D.Id, days }
      );

      const l = loads as any;
      return textResult({
        driver,
        periodDays: days,
        deliveries: {
          totalLoads: l.TotalLoads, delivered: l.Delivered, onTime: l.OnTime,
          onTimePct: l.Delivered > 0 ? Math.round((l.OnTime / l.Delivered) * 1000) / 10 : null,
        },
        missingPods: { count: missingPods.length, items: missingPods },
        fuel,
        behaviourByVehicle: behaviour,
        note: 'Behaviour is per-vehicle (CarTrack has no driver dimension) over vehicles this driver was assigned loads on — treat as indicative when vehicles are shared.',
      });
    }
  );

  // ---- Cost per km -------------------------------------------------------------
  server.tool(
    'cost_per_km',
    'Per-vehicle running cost over a date range: fuel spend (TFN + fuel transactions), maintenance cost, CarTrack distance, and cost-per-km. Shows which trucks cost the most to run. NOTE: tolls and general expenses are not in the logistics DB yet, so this covers fuel + maintenance only.',
    {
      fromDate: z.string().describe('Start date yyyy-mm-dd.'),
      toDate: z.string().describe('End date yyyy-mm-dd.'),
      registration: z.string().optional().describe('Optionally limit to one vehicle.'),
    },
    async ({ fromDate, toDate, registration }) => {
      const rows = await query(
        `WITH dist AS (
           SELECT RegistrationNumber AS Reg, SUM(TripDistance) AS Km
           FROM dbo.vw_mcp_vehicle_movements
           WHERE MovementDate >= @fromDate AND MovementDate <= @toDate
           GROUP BY RegistrationNumber
         ), fuel AS (
           SELECT VehicleReg AS Reg, SUM(TotalAmount) AS FuelSpend, SUM(Litres) AS Litres
           FROM dbo.vw_mcp_tfn_transactions
           WHERE TransactionDate >= @fromDate AND TransactionDate <= @toDate
           GROUP BY VehicleReg
         ), fuel2 AS (
           SELECT RegistrationNumber AS Reg, SUM(AmountSpent) AS FuelSpend2
           FROM dbo.vw_mcp_fuel_transactions
           WHERE TransactionDate >= @fromDate AND TransactionDate <= @toDate
           GROUP BY RegistrationNumber
         ), maint AS (
           SELECT VehicleReg AS Reg, SUM(COALESCE(Cost, EstimatedCost, 0)) AS MaintCost
           FROM dbo.vw_mcp_maintenance
           WHERE COALESCE(CompletedDate, ScheduledDate) >= @fromDate
             AND COALESCE(CompletedDate, ScheduledDate) <= @toDate
           GROUP BY VehicleReg
         )
         SELECT COALESCE(d.Reg, f.Reg, f2.Reg, m.Reg) AS Registration,
                CAST(d.Km AS decimal(12,1)) AS DistanceKm,
                CAST(COALESCE(f.FuelSpend, f2.FuelSpend2, 0) AS decimal(14,2)) AS FuelSpend,
                CAST(f.Litres AS decimal(12,1)) AS Litres,
                CAST(COALESCE(m.MaintCost, 0) AS decimal(14,2)) AS MaintenanceCost,
                CAST(COALESCE(f.FuelSpend, f2.FuelSpend2, 0) + COALESCE(m.MaintCost, 0) AS decimal(14,2)) AS TotalCost,
                CAST(CASE WHEN d.Km > 0 THEN (COALESCE(f.FuelSpend, f2.FuelSpend2, 0) + COALESCE(m.MaintCost, 0)) / d.Km END AS decimal(10,2)) AS CostPerKm
         FROM dist d
         FULL OUTER JOIN fuel f ON f.Reg = d.Reg
         FULL OUTER JOIN fuel2 f2 ON f2.Reg = COALESCE(d.Reg, f.Reg)
         FULL OUTER JOIN maint m ON m.Reg = COALESCE(d.Reg, f.Reg, f2.Reg)
         WHERE (@registration IS NULL OR COALESCE(d.Reg, f.Reg, f2.Reg, m.Reg) = @registration)
         ORDER BY CostPerKm DESC`,
        { fromDate, toDate, registration: registration ?? null }
      );
      return textResult({ fromDate, toDate, count: rows.length, vehicles: rows,
        note: 'Fuel = TFN card spend (falls back to fuel-transaction spend where no TFN rows). Excludes tolls/other expenses (not in this DB).' });
    }
  );

  // ---- Exceptions today ---------------------------------------------------------
  server.tool(
    'exceptions_today',
    'Everything needing attention right now, in one call: late/undelivered loads, outstanding PODs, fuel anomalies (last 7 days), licences expiring within 30 days, overdue vehicle services, stock below reorder, and trip sheets waiting for signature/approval.',
    {},
    async () => {
      const [lateLoads, pods, anomalies, licences, services, stock, sheets] = await Promise.all([
        query(
          `SELECT TOP 25 LoadNumber, Status, ScheduledDeliveryDate, DeliveryLocation, DriverName, VehicleReg,
                  DATEDIFF(hour, ScheduledDeliveryDate, GETDATE()) AS HoursLate
           FROM dbo.vw_mcp_loads
           WHERE ActualDeliveryDate IS NULL AND ScheduledDeliveryDate < GETDATE()
             AND Status NOT IN ('Cancelled', 'Delivered')
           ORDER BY ScheduledDeliveryDate ASC`
        ),
        query(
          `SELECT TOP 25 LoadNumber, DriverName, VehicleReg, ActualDeliveryDate, HoursSinceDelivery
           FROM dbo.vw_mcp_outstanding_pods WHERE HoursSinceDelivery >= 48 ORDER BY HoursSinceDelivery DESC`
        ),
        query(
          `SELECT TOP 25 TransactionDate, VehicleReg, DriverName, Litres, TotalAmount, AnomalyReason
           FROM dbo.vw_mcp_tfn_transactions
           WHERE IsAnomaly = 1 AND TransactionDate >= DATEADD(day, -7, GETDATE())
           ORDER BY TransactionDate DESC`
        ),
        query(
          `SELECT FirstName, LastName, LicenseExpiryDate,
                  DATEDIFF(day, CAST(GETDATE() AS date), LicenseExpiryDate) AS DaysUntilExpiry
           FROM dbo.vw_mcp_drivers
           WHERE LicenseExpiryDate IS NOT NULL AND LicenseExpiryDate <= DATEADD(day, 30, CAST(GETDATE() AS date))
           ORDER BY LicenseExpiryDate ASC`
        ),
        query(
          `SELECT TOP 25 VehicleReg, MaintenanceType, Status, Priority,
                  COALESCE(ScheduledDate, NextServiceDate) AS DueDate
           FROM dbo.vw_mcp_maintenance
           WHERE Status <> 'Complete' AND COALESCE(ScheduledDate, NextServiceDate) < CAST(GETDATE() AS date)
           ORDER BY COALESCE(ScheduledDate, NextServiceDate) ASC`
        ),
        query(
          `SELECT TOP 25 WarehouseName, CommodityName, QuantityOnHand, ReorderLevel
           FROM dbo.vw_mcp_stock_on_hand WHERE BelowReorder = 1 ORDER BY WarehouseName, CommodityName`
        ),
        query(
          `SELECT TOP 25 TripSheetNumber, Status, RouteArea, ScheduledDate, CreatedByName
           FROM dbo.vw_mcp_tripsheets
           WHERE Status IN ('PendingSignature', 'PendingApproval')
           ORDER BY ScheduledDate ASC`
        ),
      ]);
      return textResult({
        asOf: new Date().toISOString(),
        lateLoads: { count: lateLoads.length, items: lateLoads },
        outstandingPods: { count: pods.length, items: pods },
        fuelAnomaliesLast7Days: { count: anomalies.length, items: anomalies },
        licencesExpiring30Days: { count: licences.length, items: licences },
        overdueServices: { count: services.length, items: services },
        stockBelowReorder: { count: stock.length, items: stock },
        tripsheetsAwaitingAction: { count: sheets.length, items: sheets },
      });
    }
  );

  // ---- Incident history -----------------------------------------------------
  server.tool(
    'incident_history',
    'Logged logistics security incidents (Speeding, CurfewMovement, GeofenceExit) per vehicle or driver over a date range, alongside harsh-driving event totals from CarTrack for the same vehicle/period.',
    {
      registration: z.string().optional().describe('Filter by vehicle registration.'),
      driver: z.string().optional().describe('Filter by driver name (partial match).'),
      fromDate: z.string().optional().describe('From date yyyy-mm-dd (default 30 days ago).'),
      toDate: z.string().optional().describe('To date yyyy-mm-dd (default today).'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ registration, driver, fromDate, toDate, limit }) => {
      const from = fromDate ?? new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const to = toDate ?? new Date().toISOString().slice(0, 10);
      const incidents = await query(
        `SELECT TOP (@limit) Id, Type, Severity, Registration, Driver, Address, Speed, Zone,
                DuringCurfew, Details, IncidentDate
         FROM dbo.vw_mcp_incidents
         WHERE IncidentDate >= @from AND IncidentDate < DATEADD(day, 1, CAST(@to AS date))
           AND (@registration IS NULL OR Registration = @registration)
           AND (@driver IS NULL OR Driver LIKE '%' + @driver + '%')
         ORDER BY IncidentDate DESC`,
        { limit, from, to, registration: registration ?? null, driver: driver ?? null }
      );
      let harsh: any[] = [];
      if (registration) {
        harsh = await query(
          `SELECT CAST(SUM(HarshBrakingEvents) AS int) AS HarshBraking,
                  CAST(SUM(HarshCorneringEvents) AS int) AS HarshCornering,
                  CAST(SUM(HarshAccelerationEvents) AS int) AS HarshAcceleration
           FROM dbo.vw_mcp_vehicle_movements
           WHERE RegistrationNumber = @registration AND MovementDate >= @from AND MovementDate <= @to`,
          { registration, from, to }
        );
      }
      return textResult({ period: { from, to }, incidentCount: incidents.length, incidents,
        harshEventsSamePeriod: harsh[0] ?? null });
    }
  );

  // ---- Driver availability -----------------------------------------------------
  server.tool(
    'driver_availability',
    'Which drivers are free, busy, or unavailable on a given date. Busy = assigned to a load scheduled that day. Unavailable = driver status not Active. NOTE: HR leave records are not in the logistics DB, so leave is not reflected — treat "free" as "no load booked and status Active".',
    {
      date: z.string().optional().describe('Date yyyy-mm-dd (default today).'),
    },
    async ({ date }) => {
      const day = date ?? new Date().toISOString().slice(0, 10);
      const drivers = await query(
        `SELECT d.Id, d.FirstName, d.LastName, d.Status, d.LicenseExpiryDate,
                (SELECT STRING_AGG(l.LoadNumber, ', ')
                 FROM dbo.vw_mcp_loads l
                 WHERE l.DriverId = d.Id
                   AND (CAST(l.ScheduledPickupDate AS date) = @day OR CAST(l.ScheduledDeliveryDate AS date) = @day)
                   AND l.Status NOT IN ('Cancelled', 'Delivered')) AS LoadsThatDay
         FROM dbo.vw_mcp_drivers d
         ORDER BY d.LastName, d.FirstName`,
        { day }
      );
      const classed = drivers.map((d: any) => ({
        ...d,
        Availability: d.Status !== 'Active' ? 'Unavailable (' + d.Status + ')'
          : d.LoadsThatDay ? 'Busy' : 'Free',
      }));
      return textResult({
        date: day,
        free: classed.filter((d: any) => d.Availability === 'Free'),
        busy: classed.filter((d: any) => d.Availability === 'Busy'),
        unavailable: classed.filter((d: any) => d.Availability.startsWith('Unavailable')),
        note: 'Leave/attendance is not in the logistics DB; confirm leave with HR before assigning.',
      });
    }
  );

  // ---- SOP / document search -----------------------------------------------------
  server.tool(
    'search_sop',
    'Full-text search over SOP / knowledge-base documents (.md/.txt) stored in the document share, so answers can quote the exact rule. Returns matching files with surrounding context snippets.',
    {
      searchText: z.string().min(2).describe('Text to search for (case-insensitive).'),
      maxFiles: z.number().int().min(1).max(20).default(5),
    },
    async ({ searchText, maxFiles }) => {
      const root = resolve(DOCS_ROOT);
      const needle = searchText.toLowerCase();
      const hits: { file: string; snippets: string[] }[] = [];
      const MAX_SCAN = 2000; // file-count safety cap
      let scanned = 0;

      async function walk(dir: string): Promise<void> {
        if (hits.length >= maxFiles || scanned >= MAX_SCAN) return;
        let entries: string[];
        try { entries = await readdir(dir); } catch { return; }
        for (const e of entries) {
          if (hits.length >= maxFiles || scanned >= MAX_SCAN) return;
          const p = join(dir, e);
          if (!normalize(p).startsWith(root)) continue;
          let s;
          try { s = await stat(p); } catch { continue; }
          if (s.isDirectory()) { await walk(p); continue; }
          const ext = extname(e).toLowerCase();
          if (!['.md', '.txt'].includes(ext) || s.size > 2_000_000) continue;
          scanned++;
          let text: string;
          try { text = await readFile(p, 'utf8'); } catch { continue; }
          const lower = text.toLowerCase();
          if (!lower.includes(needle)) continue;
          const snippets: string[] = [];
          let idx = 0;
          while (snippets.length < 3 && (idx = lower.indexOf(needle, idx)) !== -1) {
            snippets.push(text.slice(Math.max(0, idx - 150), idx + needle.length + 150).replace(/\s+/g, ' ').trim());
            idx += needle.length;
          }
          hits.push({ file: p.slice(root.length + 1), snippets });
        }
      }
      await walk(root);
      return textResult({ searchText, filesScanned: scanned, matchCount: hits.length, matches: hits,
        note: hits.length === 0 ? 'No .md/.txt documents matched under the document share.' : undefined });
    }
  );

  // ---- Compare periods ------------------------------------------------------------
  server.tool(
    'compare_periods',
    'Compare a key figure between two periods (e.g. this week vs last week, or this month vs the same month last year). Metrics: loads (count/delivered/on-time%), sales (amount/GP), fuel (litres/spend), distance (km). Provide the current period; the comparison period defaults to the immediately preceding period of the same length, or pass explicit dates.',
    {
      metric: z.enum(['loads', 'sales', 'fuel', 'distance']).describe('Which figure to compare.'),
      fromDate: z.string().describe('Current period start yyyy-mm-dd.'),
      toDate: z.string().describe('Current period end yyyy-mm-dd.'),
      compareFromDate: z.string().optional().describe('Comparison period start (default: preceding period of equal length).'),
      compareToDate: z.string().optional().describe('Comparison period end.'),
    },
    async ({ metric, fromDate, toDate, compareFromDate, compareToDate }) => {
      const msDay = 864e5;
      const curFrom = new Date(fromDate + 'T00:00:00Z');
      const curTo = new Date(toDate + 'T00:00:00Z');
      const lenDays = Math.round((curTo.getTime() - curFrom.getTime()) / msDay) + 1;
      const prevTo = compareToDate ?? new Date(curFrom.getTime() - msDay).toISOString().slice(0, 10);
      const prevFrom = compareFromDate ?? new Date(curFrom.getTime() - lenDays * msDay).toISOString().slice(0, 10);

      async function measure(f: string, t: string): Promise<any> {
        switch (metric) {
          case 'loads': {
            const [r] = await query(
              `SELECT COUNT(*) AS TotalLoads,
                      SUM(CASE WHEN ActualDeliveryDate IS NOT NULL THEN 1 ELSE 0 END) AS Delivered,
                      SUM(CASE WHEN ActualDeliveryDate IS NOT NULL AND CAST(ActualDeliveryDate AS date) <= CAST(ScheduledDeliveryDate AS date) THEN 1 ELSE 0 END) AS OnTime
               FROM dbo.vw_mcp_loads
               WHERE ScheduledDeliveryDate >= @f AND ScheduledDeliveryDate < DATEADD(day, 1, CAST(@t AS date))`,
              { f, t });
            const x = r as any;
            return { ...x, OnTimePct: x.Delivered > 0 ? Math.round((x.OnTime / x.Delivered) * 1000) / 10 : null };
          }
          case 'sales': {
            const [r] = await query(
              `SELECT CAST(SUM(SalesAmount) AS decimal(14,2)) AS Sales,
                      CAST(SUM(GrossProfit) AS decimal(14,2)) AS GrossProfit, COUNT(*) AS Invoices
               FROM dbo.vw_mcp_sales_history
               WHERE InvoiceDate >= @f AND InvoiceDate < DATEADD(day, 1, CAST(@t AS date))`,
              { f, t });
            return r;
          }
          case 'fuel': {
            const [r] = await query(
              `SELECT CAST(SUM(Litres) AS decimal(12,1)) AS Litres,
                      CAST(SUM(TotalAmount) AS decimal(14,2)) AS Spend, COUNT(*) AS Fills
               FROM dbo.vw_mcp_tfn_transactions
               WHERE TransactionDate >= @f AND TransactionDate < DATEADD(day, 1, CAST(@t AS date))`,
              { f, t });
            return r;
          }
          case 'distance': {
            const [r] = await query(
              `SELECT CAST(SUM(TripDistance) AS decimal(14,1)) AS DistanceKm, COUNT(*) AS Trips
               FROM dbo.vw_mcp_vehicle_movements
               WHERE MovementDate >= @f AND MovementDate <= @t`,
              { f, t });
            return r;
          }
        }
      }

      const [current, previous] = await Promise.all([measure(fromDate, toDate), measure(prevFrom, prevTo)]);
      const deltas: Record<string, number | null> = {};
      for (const k of Object.keys(current ?? {})) {
        const c = Number((current as any)[k]); const p = Number((previous as any)[k]);
        deltas[k] = Number.isFinite(c) && Number.isFinite(p) && p !== 0
          ? Math.round(((c - p) / p) * 1000) / 10 : null;
      }
      return textResult({
        metric,
        currentPeriod: { fromDate, toDate, values: current },
        comparisonPeriod: { fromDate: prevFrom, toDate: prevTo, values: previous },
        percentChange: deltas,
      });
    }
  );

  // ===========================================================================
  // Built-in prompts — one-click workflows in Claude.
  // ===========================================================================
  server.prompt(
    'morning_briefing',
    'Daily operations briefing: yesterday\'s performance plus everything needing attention today.',
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text:
        'Give me a morning operations briefing for Rocket Freight. 1) Run daily_ops_briefing for yesterday. 2) Run exceptions_today. 3) Summarise concisely: how yesterday went (loads, on-time %), then a prioritised action list for today (late loads first, then missing PODs, fuel anomalies, expiring licences, overdue services, low stock, trip sheets awaiting approval). Use bullet points and flag anything critical in bold.' } }],
    })
  );

  server.prompt(
    'weekly_fleet_review',
    'Weekly fleet review: delivery performance, driving behaviour, fuel efficiency and incidents for the past 7 days.',
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text:
        'Run a weekly fleet review covering the last 7 days. Use delivery_performance_summary (byWarehouse true), driving_behaviour_summary, fuel_efficiency_summary, incident_history and compare_periods (metric loads, this week vs last week). For each late delivery pattern, check list_vehicle_movements for likely causes: late depot departure, excessive idle time, or off-route trips. End with the 3 most important actions for next week.' } }],
    })
  );

  server.prompt(
    'month_end_fuel_audit',
    'Month-end fuel audit: spend, efficiency, anomalies and possible theft indicators.',
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text:
        'Do a month-end fuel audit for the current month. Use fuel_efficiency_summary, list_fuel_orders, cost_per_km and compare_periods (metric fuel, this month vs last month). For every anomaly flagged in the TFN data, cross-check list_vehicle_movements for the same vehicle around the transaction time — a fill-up at a time or place where CarTrack shows the truck was not moving or elsewhere is a theft indicator. Report: total spend, best/worst vehicles by km/l, anomaly list with your assessment, and recommended follow-ups.' } }],
    })
  );

  server.prompt(
    'customer_dispute_pack',
    'Everything needed to handle a customer delivery dispute in one pack.',
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text:
        'I need a customer dispute pack. Ask me for the customer name and (if known) the invoice or load number. Then: run customer_scorecard and get_customer; use load_timeline for the disputed load; fetch the POD with get_pod_file and CHECK IT — compare the signature, delivery date and received quantities on the scanned document against the invoice lines and the load\'s actual delivery date, and point out any mismatch. Summarise the facts chronologically and give an assessment of whether the dispute looks valid.' } }],
    })
  );

  server.prompt(
    'compliance_sweep',
    'Compliance sweep: licences, services, missing PODs and incidents.',
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text:
        'Run a compliance sweep: driver_licence_expiry (90 days ahead), list_maintenance (upcomingOnly and overdue via exceptions_today), outstanding_pods, and incident_history for the last 30 days. If SOP rules are relevant, use search_sop to quote the exact rule being breached. Output a compliance register: item, owner, severity, SOP reference, recommended deadline.' } }],
    })
  );

  server.prompt(
    'driver_performance_review',
    'A structured performance review for one driver.',
    () => ({
      messages: [{ role: 'user', content: { type: 'text', text:
        'Prepare a driver performance review. Ask me which driver, then run driver_scorecard (90 days) and incident_history filtered to that driver. Structure the review as: deliveries & punctuality, POD discipline, fuel efficiency, driving behaviour, incidents, licence status. Compare against fleet averages where tools allow (driving_behaviour_summary / fuel_efficiency_summary for the same period). Be factual and fair — note where data is per-vehicle rather than per-driver.' } }],
    })
  );
}
