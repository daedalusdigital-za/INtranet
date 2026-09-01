# API Route Conventions

This document defines the standardized routing conventions for the ProjectTracker API.

## Current Patterns (Documented)

The API uses the following route patterns based on functional grouping:

### 1. Standard Controller Routes (`api/[controller]`)
Used for top-level resources that don't belong to a specific module:

```csharp
[Route("api/[controller]")]
```

**Examples:**
- `/api/auth` - AuthController
- `/api/announcements` - AnnouncementsController
- `/api/books` - BooksController
- `/api/boards` - BoardsController
- `/api/compliance` - ComplianceController
- `/api/departments` - DepartmentsController
- `/api/documents` - DocumentsController
- `/api/email` - EmailController
- `/api/extensions` - ExtensionsController
- `/api/finance` - FinanceController
- `/api/lists` - ListsController
- `/api/meetings` - MeetingsController
- `/api/messages` - MessagesController
- `/api/todo` - TodoController
- `/api/users` - UsersController

### 2. Grouped Module Routes (`api/{module}/[controller]`)
Used for controllers that belong to a specific business module:

```csharp
[Route("api/logistics/[controller]")]
```

**Logistics Module (`/api/logistics/...`):**
- `/api/logistics/customers` - CustomersController
- `/api/logistics/drivers` - DriversController  
- `/api/logistics/loads` - LoadsController
- `/api/logistics/reports` - ReportsController
- `/api/logistics/requisitions` - RequisitionsController
- `/api/logistics/tfn` - TfnController
- `/api/logistics/tripsheets` - TripSheetsController
- `/api/logistics/vehicles` - VehiclesController
- `/api/logistics/googlemaps` - GoogleMapsController
- `/api/logistics/controller` - ControllerMonitoringController

**HBA1C Module (`/api/hba1c/...`):**
- `/api/hba1c/condoms` - CondomsController
- `/api/hba1c/sanitary-pads` - SanitaryPadsController
- `/api/hba1c/cartrack` - CarTrackController

**Finance Module (`/api/finance/...`):**
- `/api/finance` - FinanceController (main)
- `/api/finance/purchase-orders` - PurchaseOrdersController

### 3. Explicit Kebab-Case Routes
Used when the controller name doesn't match the desired URL:

```csharp
[Route("api/hr-dashboard")]
[Route("api/hr-employees")]
[Route("api/leave-requests")]
[Route("api/asset-register")]
```

**Examples:**
- `/api/hr-dashboard` - HrDashboardController
- `/api/hr-employees` - HrEmployeesController
- `/api/hr-registers` - HrRegistersController
- `/api/hr-disciplinary` - HrDisciplinaryController
- `/api/leave-requests` - LeaveRequestsController
- `/api/stationery-requests` - StationeryRequestsController
- `/api/asset-register` - AssetRegisterController
- `/api/knowledge-base` - KnowledgeBaseController
- `/api/school-delivery` - SchoolDeliveryController

### 4. Special Purpose Routes
```csharp
[Route("api/device")] // ClockingDeviceController - short for biometric devices
[Route("api/download")] // DownloadController - file downloads
[Route("api/seed")] // SeedController - database seeding (dev only)
```

## Authorization Patterns

### Class-Level Authorization (Default)
Most controllers use class-level `[Authorize]`:
```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MyController : ControllerBase
```

### Mixed Authorization
Some controllers allow anonymous access to specific endpoints:
```csharp
[Authorize]
public class AuthController : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(...) { }
}
```

### Anonymous Controllers (Use Sparingly)
Used only for public endpoints or device APIs with token auth:
```csharp
[ApiController]
[Route("api/device")]
// No [Authorize] - uses custom API key authentication
public class ClockingDeviceController : ControllerBase
```

## Best Practices

1. **New Module Controllers**: Use `[Route("api/{module}/[controller]")]`
2. **Standalone Controllers**: Use `[Route("api/[controller]")]`
3. **Multi-word Names**: Use kebab-case in explicit routes (`api/my-resource`)
4. **Action Routes**: Use lowercase with hyphens (`[HttpGet("by-status")]`)
5. **IDs in Routes**: Use `{id:int}` for integer IDs, `{id:guid}` for GUIDs

## Adding New Controllers

### For a new module feature:
```csharp
namespace ProjectTracker.API.Controllers.NewModule
{
    [ApiController]
    [Route("api/newmodule/[controller]")]
    [Authorize]
    public class WidgetsController : ControllerBase
    {
        // Results in: /api/newmodule/widgets
    }
}
```

### For a standalone feature:
```csharp
namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WidgetsController : ControllerBase
    {
        // Results in: /api/widgets
    }
}
```
