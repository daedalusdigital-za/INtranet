import { Component, OnInit, signal, computed, AfterViewInit, OnDestroy, ViewChild, ElementRef, Inject, Injector, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatStepperModule } from '@angular/material/stepper';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { WellyActivityService } from '../../services/welly-activity.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { GoogleMapsModule } from '@angular/google-maps';
import { ControllerMonitoringComponent } from './controller-monitoring.component';
import { PumaGarageDialog } from './puma-garage-dialog.component';
import { OpenMapComponent } from './open-map.component';
import { OpenMapDialogComponent } from './open-map-dialog.component';
import { LogisticsReportsComponent } from './logistics-reports.component';
import { AssetTrackingService, ResolveResult } from '../../services/asset-tracking.service';
import { DashboardStats, ActiveLoad, Vehicle, ImportedInvoice, MaintenanceRecord, DeliveryRequest, DeliveryRequestSummary, DeliveredWithoutPodRow } from './logistics.models';
import { UploadPODDialog, UploadPodDocumentDialog, LinkTripsheetDialog, EditPodDialog, LinkInvoiceDialog, InvoiceDetailsDialog, FleetMapDialogComponent, NewLoadDialogComponent, LogisticsPodInvoicesDialog, TripSheetPreviewDialog, TripsheetDocumentPreviewDialog, TripsheetEmailRecipientsDialog, MaintenanceExportScopeDialog, SyncResultDialogComponent, SuggestedTripsDialog, TfnOrdersListDialog, TfnOrderDetailsDialog, IncomingRequestsDialog, AddressIssuesDialog, TfnDepotsMapDialog, AddDeliveryNoteDialog, CreateTripsheetDialog, TripsheetTypeDialog, ManualTripsheetDialog, InternalTransferDialog, ImportTripsheetDialog, AddMaintenanceDialog, VehicleDialogComponent, AssignDriverDialogComponent, LinkVehicleDialogComponent, AssignTripsheetDialog, CompleteMaintenanceDialog, UpdateLoadStatusDialog, ViewLoadDetailsDialog, ViewRouteMapDialog, LogisticsReportsDialog, LiveStreamingDialog, ReassignLoadDialog, RescheduleTripsheetDialog, ReassignProvinceDialog, VehicleStatusDialog, WellyTripsheetWizardDialog, WellySuggestsDialog, AiTripsheetBuilderDialog, FuelHistoryDialog, VehicleMaintenanceHistoryDialog, TodayHistoryDialog, FuelHealthDialog, BarcodeLookupDialog } from './logistics-dashboard-dialogs.component';

@Component({
  selector: 'app-logistics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatBadgeModule,
    MatMenuModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    MatPaginatorModule,
    MatButtonToggleModule,
    FormsModule,
    NavbarComponent,
    ControllerMonitoringComponent,
    OpenMapComponent,
    LogisticsReportsComponent,
    PumaGarageDialog
  ],
  templateUrl: './logistics-dashboard.component.html',
  styleUrls: ['./logistics-dashboard.component.scss']
})
export class LogisticsDashboardComponent implements OnInit {
  apiUrl = environment.apiUrl;
  Math = Math; // Expose Math for template

  loading = signal(true);

  // Initial loading progress
  initialLoading = signal(true);
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing...';
  private progressInterval: any;
  private loadedSections = 0;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Connecting', detail: 'Securing connection...' },
    { icon: 'local_shipping', label: 'Fleet', detail: 'Loading fleet & vehicles...' },
    { icon: 'route', label: 'Loads', detail: 'Fetching active loads & tripsheets...' },
    { icon: 'dashboard', label: 'Ready', detail: 'Building logistics dashboard...' }
  ];

  stats = signal<DashboardStats>({
    activeLoads: 0,
    inTransit: 0,
    delivered: 0,
    pending: 0,
    totalVehicles: 0,
    availableVehicles: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    vehiclesInMaintenance: 0,
    upcomingMaintenance: 0,
    pendingInvoices: 0,
    overdueInvoices: 0
  });

  activeLoads = signal<ActiveLoad[]>([]);
  vehicles = signal<Vehicle[]>([]);
  fleetSearch = signal<string>('');
  /** Vehicles filtered by the fleet toolbar search (reg, vehicle ID, driver, type, CarTrack/TFN id, location). */
  filteredVehicles = computed(() => {
    const q = this.fleetSearch().trim().toLowerCase();
    const list = this.vehicles();
    if (!q) return list;
    return list.filter(v =>
      (v.registrationNumber || '').toLowerCase().includes(q) ||
      String(v.id ?? '').toLowerCase().includes(q) ||
      (v.carTrackId || '').toLowerCase().includes(q) ||
      (v.tfnVehicleId || '').toLowerCase().includes(q) ||
      (v.currentDriver || '').toLowerCase().includes(q) ||
      (v.currentDriverName || '').toLowerCase().includes(q) ||
      (v.type || '').toLowerCase().includes(q) ||
      (v.vehicleTypeName || '').toLowerCase().includes(q) ||
      (v.lastLocation || '').toLowerCase().includes(q)
    );
  });
  maintenanceRecords = signal<MaintenanceRecord[]>([]);
  drivers = signal<any[]>([]);
  customers = signal<any[]>([]);
  warehouses = signal<any[]>([]);
  syncing = signal(false);
  tfnSyncing = signal(false);
  carTrackSyncing = signal(false);

  // Maintenance filters & table
  maintenanceSearch = '';
  maintenanceVehicleFilter = 'all';
  maintenanceStatusFilter = 'all';
  maintenanceTypeFilter = 'all';
  maintenanceAssignedToFilter = 'all';
  maintenanceColumns = ['vehicleReg', 'maintenanceType', 'description', 'scheduledDate', 'cost', 'priority', 'status', 'assignedTo', 'files', 'actions'];

  // Maintenance attachments
  showMaintenanceAttachmentPanel = false;
  selectedMaintenanceRecord: MaintenanceRecord | null = null;
  maintenanceAttachments = signal<any[]>([]);
  maintenanceAttachmentCounts = signal<{[key: number]: number}>({});
  maintenanceUploading = false;
  maintenanceDragOver = false;

  // Tripsheets
  tripsheets = signal<any[]>([]);
  tripsheetSearch = '';
  tripsheetStatusFilter = 'all';
  tripsheetWarehouseFilter = 'all';
  tripsheetFromDate: Date | null = null;
  tripsheetToDate: Date | null = null;
  tripsheetColumns = ['loadNumber', 'driver', 'vehicle', 'route', 'warehouse', 'stops', 'distance', 'date', 'createdBy', 'status', 'actions'];

  // Imported Invoices
  importedInvoices = signal<ImportedInvoice[]>([]);
  invoiceSearch = signal('');
  invoiceStatusFilter = signal('all');
  invoiceSourceFilter = signal('all');
  invoiceProvinceFilter = signal('all');
  invoiceColumns = ['transactionNumber', 'date', 'customer', 'product', 'quantity', 'salesAmount', 'status', 'actions'];

  // Invoice pagination
  invoicePageIndex = signal(0);
  invoicePageSize = signal(25);

  // Tripsheet pagination
  tripsheetPageIndex = signal(0);
  tripsheetPageSize = signal(25);

  loadColumns = ['loadNumber', 'date', 'customer', 'route', 'vehicle', 'driver', 'status', 'actions'];

  // Part Delivered Tracking


  // Completed Tripsheets
  completedTripsheets = signal<any[]>([]);
  completedSearch = '';
  completedDateFilter: Date | null = null;
  completedColumns = ['loadNumber', 'customer', 'driver', 'vehicle', 'completedDate', 'stops', 'distance', 'hasPOD', 'actions'];

  // Fuel Management (TFN) - kept for API compatibility
  fuelSummary = signal<any>(null);
  syncingFuel = signal(false);
  tfnOrdersCount = signal(0);
  tfnOrders = signal<any[]>([]);
  tfnDepotsCount = signal(0);
  tfnDepots = signal<any[]>([]);

  // Puma Garage (Bronkhorstspruit, GP) - alternative fuel source to TFN
  pumaOrdersCount = signal(0);
  pumaOrders = signal<any[]>([]);
  pumaSummary = signal<any>(null);

  // Fuel History (Monthly Reports)
  fuelPeriods = signal<any[]>([]);
  fuelReport = signal<any>(null);
  fuelTransactions = signal<any[]>([]);
  filteredFuelTransactions = signal<any[]>([]);
  fuelGroupData = signal<any[]>([]);
  fuelAssignmentGroups = signal<string[]>([]);
  fuelLoading = signal(false);
  fuelSyncing = false;
  selectedFuelPeriod: any = null;
  fuelViewMode = 'summary';
  fuelSearchTerm = '';
  fuelAssignmentFilter = '';
  fuelSourceFilter = '';
  fuelDisplayedColumns = ['source', 'registrationNumber', 'depotName', 'litresUsed', 'amountSpent', 'transactionDate', 'depotAssignment'];

  // Fuel Export Dialog
  showFuelExportDialog = false;
  fuelExportFromDate = new Date(2026, 0, 1);
  fuelExportToDate = new Date();
  fuelExportGenerating = false;
  fuelExportQuickSelect = '';

  // Sleep Out
  sleepOuts = signal<any[]>([]);
  sleepOutSummary = signal<any>(null);
  sleepOutLoading = signal(false);
  sleepOutSearch = signal('');
  sleepOutStatusFilter = signal('all');
  sleepOutColumns = ['date', 'tripNumber', 'driver', 'vehicle', 'amount', 'status', 'reason', 'createdBy', 'actions'];
  showSleepOutDialog = false;
  editingSleepOut: any = null;
  sleepOutForm: any = {
    tripSheetId: null,
    driverId: null,
    driverName: '',
    vehicleReg: '',
    tripNumber: '',
    amount: null,
    date: new Date(),
    reason: '',
    notes: ''
  };

  filteredSleepOuts = computed(() => {
    let data = this.sleepOuts();
    const statusFilter = this.sleepOutStatusFilter();
    if (statusFilter && statusFilter !== 'all') {
      data = data.filter(s => s.status === statusFilter);
    }
    const search = this.sleepOutSearch();
    if (search) {
      const term = search.toLowerCase();
      data = data.filter(s =>
        (s.driverName || '').toLowerCase().includes(term) ||
        (s.tripNumber || '').toLowerCase().includes(term) ||
        (s.vehicleReg || '').toLowerCase().includes(term) ||
        (s.reason || '').toLowerCase().includes(term)
      );
    }
    return data;
  });

  // Requisitions / Petty Cash
  requisitions = signal<any[]>([]);
  reqSummary = signal<any>(null);
  reqPeriods = signal<any[]>([]);
  reqLoading = signal(false);
  reqSearch = signal('');
  reqStatusFilter = signal('all');
  reqPeriod = signal<string>('');
  reqColumns = ['rfNumber', 'date', 'paidTo', 'cellNumber', 'amountEwallet', 'reason', 'dieselAmount', 'status', 'actions'];
  showRequisitionDialog = false;
  editingRequisition: any = null;
  requisitionForm: any = {
    rfNumber: '',
    date: new Date(),
    paidTo: '',
    cellNumber: '',
    amountEwallet: null,
    dieselAmount: null,
    reason: '',
    paymentMethod: 'E-Wallet',
    status: 'Active'
  };

  filteredRequisitions = computed(() => {
    let data = this.requisitions();
    const statusFilter = this.reqStatusFilter();
    if (statusFilter && statusFilter !== 'all') {
      data = data.filter(r => r.status === statusFilter);
    }
    const search = this.reqSearch();
    if (search) {
      const term = search.toLowerCase();
      data = data.filter(r =>
        (r.paidTo || '').toLowerCase().includes(term) ||
        (r.reason || '').toLowerCase().includes(term) ||
        (r.rfNumber || '').toLowerCase().includes(term) ||
        (r.cellNumber || '').toLowerCase().includes(term)
      );
    }
    return data;
  });

  // POD Documents
  podDocuments: any[] = [];
  podSummary: any = null;
  podLoading = false;
  podRegionFilter = '';
  podMonthFilter = '';
  podDriverFilter = '';
  podLinkFilter = '';
  podDriverList: string[] = [];
  podViewMode = 'grid';
  podReconciling = false;
  podCurrentPage = 1;
  podPageSize = 50;
  podTotalCount = 0;
  podTableColumns = ['driverName', 'deliveryDate', 'region', 'linkStatus', 'fileName', 'fileSize', 'actions'];

  // Delivered loads with no proof of delivery (unbillable backlog)
  noPodLoads: DeliveredWithoutPodRow[] = [];
  noPodTotalValue = 0;
  noPodDeliveredTotal = 0;
  noPodLoading = false;
  noPodExpanded = false;
  noPodMinDays = 0;

  // Incoming Delivery Requests
  deliveryRequests = signal<DeliveryRequest[]>([]);
  deliveryRequestsCount = signal(0);

  // Address Issues (Customers without addresses)
  addressIssuesCount = signal(0);

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  private readonly router = inject(Router);
  private readonly assetTracking = inject(AssetTrackingService);

  // Quick barcode lookup (header search bar)
  barcodeQuery = '';
  readonly barcodeBusy = signal(false);

  /** Look up a barcode number and pop up the linked tripsheet / item / active load. */
  lookupBarcode(): void {
    const code = (this.barcodeQuery || '').trim();
    if (!code) return;
    this.barcodeBusy.set(true);
    this.assetTracking.resolve(code, true).subscribe({
      next: (res) => {
        this.barcodeBusy.set(false);
        this.dialog.open(BarcodeLookupDialog, {
          width: '560px',
          maxWidth: '94vw',
          panelClass: 'barcode-lookup-panel',
          data: res
        });
      },
      error: () => {
        this.barcodeBusy.set(false);
        this.snackBar.open('Barcode lookup failed. Check your connection.', 'Dismiss', { duration: 4000 });
      }
    });
  }

  /** Navigate to the Scan & Track (barcode / QR) page. */
  openScanTrack(): void {
    this.router.navigate(['/logistics/scan']);
  }

  /** Open the live fleet map in a large dialog (map's own Maximize still works). */
  openLiveMap(): void {
    this.dialog.open(OpenMapDialogComponent, {
      width: '96vw',
      height: '94vh',
      maxWidth: '96vw',
      panelClass: 'open-map-dialog-panel',
      autoFocus: false,
      restoreFocus: false
    });
  }

  ngOnInit(): void {
    this.startLoadingProgress();
    this.loadDashboardData();
    this.loadTripsheets();
    this.loadImportedInvoices();
    this.loadCompletedTripsheets();
    this.loadTfnOrders();
    this.loadTfnDepots();
    this.loadPumaOrders();
    this.loadDrivers();
    this.loadCustomers();
    this.loadMaintenanceRecords();
    this.loadWarehouses();
    this.loadDeliveryRequests();
    this.loadAddressIssuesCount();
    this.loadFuelPeriods();
    this.loadPodSummary();
    this.loadPodDocuments();
    this.loadDeliveredWithoutPod();
    this.loadSleepOuts();
    this.loadRequisitionPeriods();
  }

  private checkInitialLoadComplete(): void {
    this.loadedSections++;
    // Track 4 major sections: dashboard/fleet, tripsheets, invoices, maintenance
    if (this.loadedSections >= 4) {
      this.finishLoadingProgress(() => {
        this.initialLoading.set(false);
      });
    }
  }

  private startLoadingProgress(): void {
    this.loadingProgress = 0;
    this.loadingStage = 0;
    this.loadingMessage = this.loadingSteps[0].detail;
    this.progressInterval = setInterval(() => {
      const max = 88;
      if (this.loadingProgress < max) {
        const increment = Math.max(0.3, (max - this.loadingProgress) * 0.06);
        this.loadingProgress = Math.min(max, this.loadingProgress + increment);
      }
      const newStage = this.loadingProgress < 20 ? 0 : this.loadingProgress < 45 ? 1 : this.loadingProgress < 70 ? 2 : 3;
      if (newStage !== this.loadingStage) {
        this.loadingStage = newStage;
        this.loadingMessage = this.loadingSteps[newStage].detail;
      }
    }, 120);
  }

  private finishLoadingProgress(callback: () => void): void {
    clearInterval(this.progressInterval);
    this.loadingStage = 3;
    this.loadingMessage = 'Almost there...';
    const finish = setInterval(() => {
      this.loadingProgress = Math.min(100, this.loadingProgress + 4);
      if (this.loadingProgress >= 100) {
        clearInterval(finish);
        this.loadingMessage = 'Complete!';
        setTimeout(() => callback(), 300);
      }
    }, 30);
  }

  // Pagination handlers
  onInvoicePageChange(event: PageEvent): void {
    this.invoicePageIndex.set(event.pageIndex);
    this.invoicePageSize.set(event.pageSize);
  }

  onTripsheetPageChange(event: PageEvent): void {
    this.tripsheetPageIndex.set(event.pageIndex);
    this.tripsheetPageSize.set(event.pageSize);
  }

  loadWarehouses(): void {
    this.http.get<any[]>(`${this.apiUrl}/warehouses`).subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
      },
      error: () => {
        // Use fallback data with all 4 warehouses
        this.warehouses.set([
          { id: 1, name: 'Gauteng Warehouse', code: 'GP', city: 'Johannesburg', latitude: -26.2041, longitude: 28.0473, address: 'Johannesburg, Gauteng' },
          { id: 2, name: 'KZN Warehouse', code: 'KZN', city: 'Durban', latitude: -29.8587, longitude: 31.0218, address: 'Durban, KwaZulu-Natal' },
          { id: 3, name: 'Cape Town Warehouse', code: 'CPT', city: 'Cape Town', latitude: -33.9249, longitude: 18.4241, address: 'Cape Town, Western Cape' },
          { id: 4, name: 'PE Warehouse', code: 'PE', city: 'Gqeberha', latitude: -33.9608, longitude: 25.6022, address: 'Gqeberha, Eastern Cape' }
        ]);
      }
    });
  }

  loadDrivers(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/drivers`).subscribe({
      next: (drivers) => {
        // Only active drivers count toward the dashboard card (exclude Inactive/Terminated).
        const activeDrivers = drivers.filter(d => (d.status ?? '').toLowerCase() !== 'inactive' && (d.status ?? '').toLowerCase() !== 'terminated');
        this.drivers.set(drivers);
        this.stats.update(s => ({
          ...s,
          totalDrivers: activeDrivers.length,
          availableDrivers: activeDrivers.filter(d => d.status === 'Available' || !d.currentLoadId).length
        }));
      },
      error: () => {
        // Use sample data
        this.drivers.set([
          { id: 1, firstName: 'John', lastName: 'Smith', phoneNumber: '082-123-4567', licenseNumber: 'DL12345', status: 'Available' },
          { id: 2, firstName: 'Peter', lastName: 'Nkosi', phoneNumber: '083-456-7890', licenseNumber: 'DL23456', status: 'OnDuty' },
          { id: 3, firstName: 'Mike', lastName: 'Johnson', phoneNumber: '084-789-0123', licenseNumber: 'DL34567', status: 'Available' }
        ]);
      }
    });
  }

  loadCustomers(): void {
    // Load ALL customers (not just the default first 50) so trip-sheet address
    // matching can resolve any customer from the database.
    this.http.get<any[]>(`${this.apiUrl}/logistics/customers?pageSize=100000`).subscribe({
      next: (customers) => {
        this.customers.set(customers);
      },
      error: () => {
        this.customers.set([]);
      }
    });
  }

  // Maintenance Methods
  loadMaintenanceRecords(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/maintenance`).subscribe({
      next: (records) => {
        // Map API field names to our interface and normalize status
        const mapped = records.map(r => ({
          ...r,
          vehicleReg: r.vehicleRegistration || r.vehicleReg || '',
          status: (r.status || '').toLowerCase().replace(/\s+/g, '-'),
          priority: r.priority || 'medium',
          assignedTo: r.assignedTo || r.serviceProvider || '',
          actionOwner: r.actionOwner || '',
          province: r.province || '',
          feedback: r.feedback || '',
          daysStanding: r.daysStanding ?? null
        }));
        this.maintenanceRecords.set(mapped);
        this.updateMaintenanceStats();
        this.loadMaintenanceAttachmentCounts();
        this.checkInitialLoadComplete();
      },
      error: () => {
        // Load sample maintenance data
        this.loadSampleMaintenanceData();
        this.checkInitialLoadComplete();
      }
    });
  }

  /**
   * Download the fleet-repair list + status dashboard as a formatted Excel workbook.
   * Honours the currently selected status filter (open items only by default).
   */
  exportMaintenanceToExcel(): void {
    const hasActiveFilters =
      !!this.maintenanceSearch ||
      this.maintenanceVehicleFilter !== 'all' ||
      this.maintenanceStatusFilter !== 'all' ||
      this.maintenanceTypeFilter !== 'all' ||
      this.maintenanceAssignedToFilter !== 'all';

    const dialogRef = this.dialog.open(MaintenanceExportScopeDialog, {
      width: '420px',
      data: {
        hasActiveFilters,
        filteredCount: this.getFilteredMaintenanceRecords().length,
        totalCount: this.maintenanceRecords().filter(r => !!r).length
      }
    });

    dialogRef.afterClosed().subscribe((scope: 'all' | 'filtered' | undefined) => {
      if (!scope) return;
      this.downloadMaintenanceExcel(scope);
    });
  }

  private downloadMaintenanceExcel(scope: 'all' | 'filtered'): void {
    const params: string[] = [];

    if (scope === 'filtered') {
      // Map the UI status filter to the backend status vocabulary where sensible.
      const status = this.maintenanceStatusFilter;
      if (status && status !== 'all' && status !== 'overdue') {
        const map: Record<string, string> = {
          'scheduled': 'Scheduled',
          'in-progress': 'In Progress',
          'completed': 'Completed'
        };
        if (map[status]) params.push(`status=${encodeURIComponent(map[status])}`);
      }
      if (this.maintenanceVehicleFilter !== 'all') {
        params.push(`vehicleReg=${encodeURIComponent(this.maintenanceVehicleFilter)}`);
      }
      if (this.maintenanceTypeFilter !== 'all') {
        params.push(`maintenanceType=${encodeURIComponent(this.maintenanceTypeFilter)}`);
      }
      if (this.maintenanceAssignedToFilter !== 'all' && this.maintenanceAssignedToFilter !== 'Unassigned') {
        params.push(`assignedTo=${encodeURIComponent(this.maintenanceAssignedToFilter)}`);
      }
      // When filtering, don't restrict to open-only so completed matches also export.
      params.push('openOnly=false');
    } else {
      // Export everything, including completed/cancelled records.
      params.push('openOnly=false');
    }

    const qs = params.length ? `?${params.join('&')}` : '';

    this.http.get(`${this.apiUrl}/logistics/maintenance/export${qs}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const stamp = new Date().toISOString().slice(0, 10);
          const suffix = scope === 'filtered' ? '_Filtered' : '';
          a.download = `RocketFreight_FleetRepairs${suffix}_${stamp}.xlsx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.snackBar.open(
            scope === 'filtered' ? 'Filtered fleet repairs exported to Excel' : 'All fleet repairs exported to Excel',
            'Close', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Failed to export maintenance records', 'Close', { duration: 4000 });
        }
      });
  }

  private loadSampleMaintenanceData(): void {
    const sampleRecords: MaintenanceRecord[] = [
      {
        id: 1,
        vehicleId: 1,
        vehicleReg: 'GP 123 ABC',
        vehicleType: 'Truck - 8 Ton',
        maintenanceType: 'scheduled',
        description: 'Regular 50,000km service - oil change, filters, brake inspection',
        status: 'scheduled',
        priority: 'medium',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        estimatedCost: 4500,
        assignedTo: 'Fleet Services'
      },
      {
        id: 2,
        vehicleId: 2,
        vehicleReg: 'GP 456 DEF',
        vehicleType: 'Truck - 14 Ton',
        maintenanceType: 'repair',
        description: 'Gearbox repair - difficulty shifting gears reported by driver',
        status: 'in-progress',
        priority: 'high',
        scheduledDate: new Date(),
        estimatedCost: 12000,
        assignedTo: 'Heavy Duty Repairs'
      },
      {
        id: 3,
        vehicleId: 3,
        vehicleReg: 'GP 789 GHI',
        vehicleType: 'Bakkie',
        maintenanceType: 'license',
        description: 'Vehicle license renewal',
        status: 'overdue',
        priority: 'critical',
        scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        licenseExpiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: -5
      },
      {
        id: 4,
        vehicleId: 4,
        vehicleReg: 'GP 321 JKL',
        vehicleType: 'Truck - 8 Ton',
        maintenanceType: 'inspection',
        description: 'Annual roadworthy certificate inspection',
        status: 'scheduled',
        priority: 'high',
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        estimatedCost: 1200,
        assignedTo: 'Testing Station'
      },
      {
        id: 5,
        vehicleId: 5,
        vehicleReg: 'GP 654 MNO',
        vehicleType: 'Truck - 14 Ton',
        maintenanceType: 'license',
        description: 'Vehicle license expiring soon',
        status: 'scheduled',
        priority: 'medium',
        scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        licenseExpiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 14
      }
    ];
    this.maintenanceRecords.set(sampleRecords);
    this.updateMaintenanceStats();
  }

  private updateMaintenanceStats(): void {
    const records = this.maintenanceRecords();
    this.stats.update(s => ({
      ...s,
      vehiclesInMaintenance: records.filter(r => r.status === 'in-progress' || r.status === 'scheduled').length,
      upcomingMaintenance: records.filter(r => r.status === 'scheduled').length
    }));
  }

  getMaintenanceByStatus(status: string): MaintenanceRecord[] {
    return this.maintenanceRecords().filter(r => r && r.status === status);
  }

  getExpiringLicenses(): MaintenanceRecord[] {
    return this.maintenanceRecords()
      .filter(r => r.maintenanceType === 'license' && r.daysUntilExpiry !== undefined && r.daysUntilExpiry <= 30)
      .sort((a, b) => (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0));
  }

  getCompletedMaintenance(): MaintenanceRecord[] {
    // Get all completed maintenance records, sorted by completion date (most recent first)
    return this.maintenanceRecords()
      .filter(r => r && r.status === 'completed')
      .sort((a, b) => {
        const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
        const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
        return dateB - dateA; // Most recent first
      });
  }

  getCompleteBeforeLicenseExpiring(): MaintenanceRecord[] {
    // Get all maintenance records (non-license) that are not completed
    // and have a vehicle with an expiring license (within 30 days)
    const expiringLicenseVehicles = this.maintenanceRecords()
      .filter(r => r.maintenanceType === 'license' && r.daysUntilExpiry !== undefined && r.daysUntilExpiry <= 30)
      .map(r => r.vehicleId);

    return this.maintenanceRecords()
      .filter(r => 
        r.maintenanceType !== 'license' && // Not a license renewal itself
        r.status !== 'completed' && // Not already completed
        r.daysUntilExpiry !== undefined && // Has license expiry data
        r.daysUntilExpiry <= 30 && // License expires within 30 days
        expiringLicenseVehicles.includes(r.vehicleId) // Vehicle has expiring license
      )
      .sort((a, b) => (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0));
  }

  openAddMaintenanceDialog(): void {
    const dialogRef = this.dialog.open(AddMaintenanceDialog, {
      width: '600px',
      data: { vehicles: this.vehicles() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const payload = this.buildMaintenancePayload(result);
        this.http.post<MaintenanceRecord>(`${this.apiUrl}/logistics/maintenance`, payload).subscribe({
          next: (record) => {
            this.maintenanceRecords.update(records => [...records, this.normalizeMaintenanceRecord(record)]);
            this.updateMaintenanceStats();
          },
          error: () => {
            // Add to local list with generated ID
            const newRecord: MaintenanceRecord = {
              ...result,
              id: Math.max(0, ...this.maintenanceRecords().map(r => r?.id ?? 0)) + 1
            };
            this.maintenanceRecords.update(records => [...records, this.normalizeMaintenanceRecord(newRecord)]);
            this.updateMaintenanceStats();
          }
        });
      }
    });
  }

  /**
   * The add/edit dialog captures `assignedTo`, but the backend persists this as
   * `serviceProvider`. Map it (and mirror it into actionOwner) so it actually saves.
   */
  private buildMaintenancePayload(result: any): any {
    const payload: any = { ...result };
    const assigned = (result.assignedTo ?? '').toString().trim();
    if (assigned) {
      payload.serviceProvider = payload.serviceProvider || assigned;
      payload.actionOwner = payload.actionOwner || assigned;
    }
    return payload;
  }

  /** Ensure a record from the API has the lowercase status + assignedTo the UI expects. */
  private normalizeMaintenanceRecord(r: any): MaintenanceRecord {
    return {
      ...r,
      vehicleReg: r.vehicleRegistration || r.vehicleReg || '',
      status: (r.status || 'scheduled').toString().toLowerCase().replace(/\s+/g, '-'),
      priority: r.priority || 'medium',
      assignedTo: r.assignedTo || r.actionOwner || r.serviceProvider || ''
    } as MaintenanceRecord;
  }

  startMaintenance(record: MaintenanceRecord): void {
    this.http.patch(`${this.apiUrl}/logistics/maintenance/${record.id}/start`, {}).subscribe({
      next: () => {
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === record.id ? { ...r, status: 'in-progress' as const } : r)
        );
        this.updateMaintenanceStats();
      },
      error: () => {
        // Update locally
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === record.id ? { ...r, status: 'in-progress' as const } : r)
        );
        this.updateMaintenanceStats();
      }
    });
  }

  completeMaintenance(record: MaintenanceRecord): void {
    const dialogRef = this.dialog.open(CompleteMaintenanceDialog, {
      width: '1100px',
      maxWidth: '95vw',
      data: { record }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const formData = new FormData();
        
        if (result.odometerReading) formData.append('odometerReading', result.odometerReading.toString());
        if (result.cost) formData.append('cost', result.cost.toString());
        if (result.notes) formData.append('notes', result.notes);
        
        // First, upload files if provided
        if (result.proofOfWork || result.proofOfPayment) {
          const uploadData = new FormData();
          if (result.proofOfWork) uploadData.append('proofOfWork', result.proofOfWork);
          if (result.proofOfPayment) uploadData.append('proofOfPayment', result.proofOfPayment);
          
          this.http.post(`${this.apiUrl}/logistics/maintenance/${record.id}/upload`, uploadData).subscribe({
            next: (uploadResponse: any) => {
              // Then mark as complete with the file paths
              const completePayload = {
                odometerReading: result.odometerReading,
                cost: result.cost,
                notes: result.notes,
                proofOfWorkPath: uploadResponse.proofOfWorkPath,
                proofOfPaymentPath: uploadResponse.proofOfPaymentPath
              };
              
              this.markMaintenanceComplete(record.id, completePayload);
            },
            error: (err) => {
              console.error('File upload error:', err);
              this.snackBar.open('Failed to upload files', 'Close', { duration: 3000 });
            }
          });
        } else {
          // No files, just mark as complete
          this.markMaintenanceComplete(record.id, {
            odometerReading: result.odometerReading,
            cost: result.cost,
            notes: result.notes
          });
        }
      }
    });
  }

  private markMaintenanceComplete(recordId: number, payload: any): void {
    this.http.post(`${this.apiUrl}/logistics/maintenance/${recordId}/complete`, payload).subscribe({
      next: () => {
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === recordId ? { 
            ...r, 
            status: 'completed' as const, 
            completedDate: new Date(),
            ...payload
          } : r)
        );
        this.updateMaintenanceStats();
        this.snackBar.open('Maintenance marked as complete', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Complete error:', err);
        this.snackBar.open('Failed to mark maintenance as complete', 'Close', { duration: 3000 });
      }
    });
  }

  editMaintenance(record: MaintenanceRecord): void {
    const dialogRef = this.dialog.open(AddMaintenanceDialog, {
      width: '600px',
      data: { vehicles: this.vehicles(), record }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const payload = this.buildMaintenancePayload(result);
        this.http.put<MaintenanceRecord>(`${this.apiUrl}/logistics/maintenance/${record.id}`, payload).subscribe({
          next: (updated) => {
            this.maintenanceRecords.update(records =>
              records.map(r => r.id === record.id ? this.normalizeMaintenanceRecord(updated ?? { ...record, ...payload }) : r)
            );
          },
          error: () => {
            this.maintenanceRecords.update(records =>
              records.map(r => r.id === record.id ? this.normalizeMaintenanceRecord({ ...r, ...payload }) : r)
            );
          }
        });
      }
    });
  }

  deleteMaintenance(record: MaintenanceRecord): void {
    if (confirm(`Are you sure you want to delete this maintenance record for ${record.vehicleReg}?`)) {
      this.http.delete(`${this.apiUrl}/logistics/maintenance/${record.id}`).subscribe({
        next: () => {
          this.maintenanceRecords.update(records => records.filter(r => r.id !== record.id));
          this.updateMaintenanceStats();
        },
        error: () => {
          this.maintenanceRecords.update(records => records.filter(r => r.id !== record.id));
          this.updateMaintenanceStats();
        }
      });
    }
  }

  changeMaintenanceStatus(record: MaintenanceRecord, newStatus: 'scheduled' | 'in-progress' | 'overdue' | 'completed'): void {
    // If changing to completed, use the complete maintenance dialog
    if (newStatus === 'completed') {
      this.completeMaintenance(record);
      return;
    }

    // For other status changes, just update the status
    const updatePayload = { status: newStatus };
    
    this.http.put(`${this.apiUrl}/logistics/maintenance/${record.id}`, updatePayload).subscribe({
      next: () => {
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === record.id ? { ...r, status: newStatus } : r)
        );
        this.updateMaintenanceStats();
        this.snackBar.open(`Maintenance status changed to ${newStatus}`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Status change error:', err);
        this.snackBar.open('Failed to change status', 'Close', { duration: 3000 });
      }
    });
  }

  viewMaintenanceHistory(record: MaintenanceRecord): void {
    // Open maintenance history dialog using record's vehicle info
    const vehicle = {
      id: record.vehicleId,
      registrationNumber: record.vehicleReg || record.vehicleRegistration,
      type: record.vehicleType
    };
    this.dialog.open(VehicleMaintenanceHistoryDialog, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'maintenance-history-dialog-panel',
      data: { vehicle, apiUrl: environment.apiUrl }
    });
  }

  viewMaintenanceDetails(record: MaintenanceRecord): void {
    // Show details of completed maintenance
    const details = `
Vehicle: ${record.vehicleReg}
Type: ${record.maintenanceType}
Description: ${record.description}
Scheduled Date: ${record.scheduledDate ? new Date(record.scheduledDate).toLocaleDateString() : 'N/A'}
Completed Date: ${record.completedDate ? new Date(record.completedDate).toLocaleDateString() : 'N/A'}
Assigned To: ${record.assignedTo || 'N/A'}
Cost: ${record.cost ? 'R' + record.cost.toFixed(2) : 'N/A'}
Notes: ${record.notes || 'No notes'}
    `.trim();
    
    this.snackBar.open(details, 'Close', { 
      duration: 10000,
      panelClass: 'maintenance-details-snackbar'
    });
  }

  scheduleLicenseRenewal(record: MaintenanceRecord): void {
    // Quick action to schedule license renewal
    const renewalRecord: Partial<MaintenanceRecord> = {
      vehicleId: record.vehicleId,
      vehicleReg: record.vehicleReg,
      vehicleType: record.vehicleType,
      maintenanceType: 'license',
      description: 'License renewal',
      status: 'scheduled',
      priority: record.daysUntilExpiry! <= 7 ? 'critical' : 'high',
      scheduledDate: new Date()
    };
    this.openAddMaintenanceDialog();
  }

  scrollToMaintenanceTab(): void {
    // This would scroll to and select the maintenance tab
    // For now, just load the data
    this.loadMaintenanceRecords();
  }

  // === Maintenance Filtering ===
  getUniqueMaintenanceVehicles(): string[] {
    const vehicles = this.maintenanceRecords().map(r => r.vehicleReg).filter(Boolean);
    return [...new Set(vehicles)].sort();
  }

  getUniqueMaintenanceAssignees(): string[] {
    const assignees = this.maintenanceRecords()
      .filter(r => !!r)
      .map(r => (r.assignedTo && r.assignedTo.trim()) ? r.assignedTo.trim() : 'Unassigned');
    return [...new Set(assignees)].sort();
  }

  getFilteredMaintenanceRecords(): MaintenanceRecord[] {
    let records = this.maintenanceRecords().filter(r => !!r);

    if (this.maintenanceStatusFilter !== 'all') {
      records = records.filter(r => r.status === this.maintenanceStatusFilter);
    }
    if (this.maintenanceVehicleFilter !== 'all') {
      records = records.filter(r => r.vehicleReg === this.maintenanceVehicleFilter);
    }
    if (this.maintenanceTypeFilter !== 'all') {
      records = records.filter(r => r.maintenanceType === this.maintenanceTypeFilter);
    }
    if (this.maintenanceAssignedToFilter !== 'all') {
      records = records.filter(r => (r.assignedTo || 'Unassigned') === this.maintenanceAssignedToFilter);
    }
    if (this.maintenanceSearch) {
      const search = this.maintenanceSearch.toLowerCase();
      records = records.filter(r =>
        (r.vehicleReg || '').toLowerCase().includes(search) ||
        (r.vehicleType || '').toLowerCase().includes(search) ||
        (r.description || '').toLowerCase().includes(search) ||
        (r.maintenanceType || '').toLowerCase().includes(search) ||
        (r.assignedTo || '').toLowerCase().includes(search)
      );
    }
    // Sort: overdue first, then in-progress, scheduled, completed
    const statusOrder: Record<string, number> = { 'overdue': 0, 'in-progress': 1, 'scheduled': 2, 'completed': 3 };
    return records.sort((a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4));
  }

  clearMaintenanceFilters(): void {
    this.maintenanceSearch = '';
    this.maintenanceVehicleFilter = 'all';
    this.maintenanceStatusFilter = 'all';
    this.maintenanceTypeFilter = 'all';
    this.maintenanceAssignedToFilter = 'all';
  }

  // === Maintenance Attachments ===
  loadMaintenanceAttachmentCounts(): void {
    const ids = this.maintenanceRecords().map(r => r.id);
    if (ids.length === 0) return;

    this.http.post<{[key: number]: number}>(`${this.apiUrl}/logistics/maintenance-attachments/counts`, ids).subscribe({
      next: (counts) => this.maintenanceAttachmentCounts.set(counts),
      error: () => {} // silent fail
    });
  }

  openMaintenanceAttachments(record: MaintenanceRecord): void {
    this.selectedMaintenanceRecord = record;
    this.showMaintenanceAttachmentPanel = true;
    this.loadMaintenanceAttachmentsForRecord(record.id);
  }

  closeMaintenanceAttachments(): void {
    this.showMaintenanceAttachmentPanel = false;
    this.selectedMaintenanceRecord = null;
    this.maintenanceAttachments.set([]);
  }

  loadMaintenanceAttachmentsForRecord(recordId: number): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/maintenance-attachments/${recordId}`).subscribe({
      next: (attachments) => this.maintenanceAttachments.set(attachments),
      error: () => this.maintenanceAttachments.set([])
    });
  }

  onMaintenanceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadMaintenanceFiles(Array.from(input.files));
      input.value = '';
    }
  }

  onMaintenanceFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.maintenanceDragOver = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.uploadMaintenanceFiles(Array.from(event.dataTransfer.files));
    }
  }

  uploadMaintenanceFiles(files: File[]): void {
    if (!this.selectedMaintenanceRecord) return;

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    formData.append('maintenanceRecordId', this.selectedMaintenanceRecord.id.toString());
    formData.append('vehicleRegistration', this.selectedMaintenanceRecord.vehicleReg || '');
    formData.append('uploadedBy', 'Admin');

    this.maintenanceUploading = true;
    this.http.post<any[]>(`${this.apiUrl}/logistics/maintenance-attachments/upload`, formData).subscribe({
      next: (result) => {
        this.maintenanceUploading = false;
        this.loadMaintenanceAttachmentsForRecord(this.selectedMaintenanceRecord!.id);
        this.loadMaintenanceAttachmentCounts();
        this.snackBar.open(`${files.length} file(s) uploaded successfully`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.maintenanceUploading = false;
        this.snackBar.open('Failed to upload files', 'Close', { duration: 3000 });
      }
    });
  }

  downloadMaintenanceAttachment(att: any): void {
    this.http.get(`${this.apiUrl}/logistics/maintenance-attachments/download/${att.id}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Failed to download file', 'Close', { duration: 3000 })
    });
  }

  deleteMaintenanceAttachment(att: any): void {
    if (!confirm(`Delete "${att.fileName}"?`)) return;

    this.http.delete(`${this.apiUrl}/logistics/maintenance-attachments/${att.id}`).subscribe({
      next: () => {
        this.maintenanceAttachments.update(list => list.filter(a => a.id !== att.id));
        this.loadMaintenanceAttachmentCounts();
        this.snackBar.open('File deleted', 'Close', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to delete file', 'Close', { duration: 3000 })
    });
  }

  getFileIcon(fileName: string): string {
    if (!fileName) return 'insert_drive_file';
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return 'picture_as_pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '')) return 'image';
    if (['doc', 'docx'].includes(ext || '')) return 'description';
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'table_chart';
    if (['zip', 'rar', '7z'].includes(ext || '')) return 'folder_zip';
    return 'insert_drive_file';
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
    return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }

  async loadDashboardData(): Promise<void> {
    this.loading.set(true);

    try {
      // Load active loads from tracking controller
      this.http.get<any[]>(`${this.apiUrl}/tracking/active-loads`).subscribe({
        next: (loads) => {
          const mapped = loads.map(l => ({
            ...l,
            scheduledDate: l.scheduledDeliveryDate || l.scheduledPickupDate || l.scheduledDate || l.createdAt,
            origin: this.abbreviateLocation(l.warehouseName || l.origin || l.pickupLocation || 'N/A'),
            destination: this.abbreviateLocation(l.destination || l.deliveryLocation || 'N/A'),
            progress: this.calculateProgress(l.status)
          }));
          // Sort newest first (most recent dates on top)
          mapped.sort((a, b) => {
            const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
            const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
            return dateB - dateA;
          });
          this.activeLoads.set(mapped);
          this.stats.update(s => ({
            ...s,
            activeLoads: loads.length,
            inTransit: loads.filter(l => l.status === 'InTransit').length,
            pending: loads.filter(l => l.status === 'Pending' || l.status === 'Scheduled').length
          }));
          this.checkInitialLoadComplete();
        },
        error: () => {
          // Use sample data if API fails
          this.loadSampleData();
          this.checkInitialLoadComplete();
        }
      });

      // Load fleet data with live CarTrack + TFN data merged
      this.loadVehiclesFromDatabase();

      this.loading.set(false);
    } catch (error) {
      this.loadSampleData();
      this.loading.set(false);
    }
  }

  loadVehiclesFromDatabase(): void {
    // Use the live endpoint that merges database + CarTrack + TFN data
    this.http.get<any[]>(`${this.apiUrl}/fleet/vehicles/live`).subscribe({
      next: (fleet) => {
        const mappedVehicles = fleet.map(v => ({
          id: v.id,
          registrationNumber: v.registrationNumber,
          type: v.vehicleTypeName || 'Truck',
          vehicleTypeName: v.vehicleTypeName,
          vehicleTypeId: v.vehicleTypeId,
          // Core details needed by the edit dialog to populate correctly
          make: v.make,
          model: v.model,
          year: v.year,
          color: v.color,
          vinNumber: v.vinNumber,
          currentOdometer: v.currentOdometer,
          status: v.status,
          currentDriver: v.currentDriverName || '',
          currentDriverId: v.currentDriverId,
          currentDriverName: v.currentDriverName,
          // Live tracking data from CarTrack
          lastLocation: v.lastLocation || 'Unknown',
          latitude: v.latitude,
          longitude: v.longitude,
          speed: v.speed ?? 0,
          heading: v.heading,
          lastUpdate: v.lastUpdate,
          liveStatus: v.liveStatus || 'offline',
          // Real fuel level only if the tracking provider supplies one (no fake default)
          fuelLevel: v.fuelLevel ?? null,
          fuelCapacity: v.fuelCapacity,
          // CarTrack integration
          carTrackId: v.carTrackId,
          isLinkedToCarTrack: v.isLinkedToCarTrack,
          // TFN integration
          tfnVehicleId: v.tfnVehicleId,
          tfnSubAccountNumber: v.tfnSubAccountNumber,
          tfnVirtualCardNumber: v.tfnVirtualCardNumber,
          tfnCreditLimit: v.tfnCreditLimit,
          tfnCurrentBalance: v.tfnCurrentBalance,
          tfnLastSyncedAt: v.tfnLastSyncedAt,
          tankSize: v.tankSize,
          fuelType: v.fuelType,
          averageFuelConsumption: v.averageFuelConsumption,
          isLinkedToTfn: v.isLinkedToTfn
        }));
        
        // Sort: moving > idle > stationary/stopped > offline > unlinked
        mappedVehicles.sort((a, b) => {
          // First check if linked to CarTrack
          const aLinked = a.isLinkedToCarTrack || a.carTrackId ? 1 : 0;
          const bLinked = b.isLinkedToCarTrack || b.carTrackId ? 1 : 0;
          
          // Unlinked vehicles go to the bottom
          if (aLinked !== bLinked) return bLinked - aLinked;
          
          // For linked vehicles, sort by status: moving > idling > stopped > offline
          const statusOrder: Record<string, number> = { 'moving': 0, 'idling': 1, 'stopped': 2, 'offline': 3 };
          const aStatus = statusOrder[a.liveStatus] ?? 4;
          const bStatus = statusOrder[b.liveStatus] ?? 4;
          if (aStatus !== bStatus) return aStatus - bStatus;
          
          // Within same status, sort by speed (higher speed first)
          return (b.speed ?? 0) - (a.speed ?? 0);
        });
        
        this.vehicles.set(mappedVehicles);
        this.stats.update(s => ({
          ...s,
          totalVehicles: fleet.length,
          availableVehicles: fleet.filter(v => v.status === 'Available').length
        }));
        this.checkInitialLoadComplete();
      },
      error: () => {
        this.checkInitialLoadComplete();
      }
    });
  }

  // TFN Sync - Link vehicles by registration number
  syncTfnVehicles(): void {
    this.tfnSyncing.set(true);
    this.http.post<any>(`${this.apiUrl}/logistics/tfn/sync/vehicles`, {}).subscribe({
      next: (result) => {
        this.tfnSyncing.set(false);
        this.loadVehiclesFromDatabase();
      },
      error: (err) => {
        this.tfnSyncing.set(false);
        console.error('TFN sync failed:', err);
      }
    });
  }

  // CarTrack Sync - Link vehicles by registration number
  syncCarTrackVehicles(): void {
    this.carTrackSyncing.set(true);
    this.http.post<any>(`${this.apiUrl}/fleet/sync/cartrack`, {}).subscribe({
      next: (result) => {
        this.carTrackSyncing.set(false);
        this.loadVehiclesFromDatabase();
      },
      error: (err) => {
        this.carTrackSyncing.set(false);
        console.error('CarTrack sync failed:', err);
      }
    });
  }

  // Get count of vehicles linked to TFN or CarTrack
  getLinkedVehicleCount(): number {
    return this.vehicles().filter(v => v.isLinkedToTfn || v.isLinkedToCarTrack || v.tfnVehicleId || v.carTrackId).length;
  }

  // Get vehicles available for load assignment (not under maintenance or decommissioned)
  getAvailableVehicles(): any[] {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    return this.vehicles().filter((v: any) => 
      !unavailableStatuses.includes(v.status)
    );
  }

  loadSampleData(): void {
    // NOTE: On API failure we intentionally show an empty/zeroed state rather than
    // fabricated demo data. Never present invented numbers as if they were real.
    this.stats.set({
      activeLoads: 0,
      inTransit: 0,
      delivered: 0,
      pending: 0,
      totalVehicles: 0,
      availableVehicles: 0,
      totalDrivers: 0,
      availableDrivers: 0,
      vehiclesInMaintenance: 0,
      upcomingMaintenance: 0,
      pendingInvoices: 0,
      overdueInvoices: 0
    });

    this.activeLoads.set([]);
    this.vehicles.set([]);
    this.loading.set(false);
  }

  calculateProgress(status: string): number {
    switch (status) {
      case 'Pending': return 0;
      case 'Scheduled': return 10;
      case 'Loading': return 25;
      case 'InTransit': return 50;
      case 'Arrived': return 85;
      case 'Delivered': return 100;
      case 'Completed': return 100;
      default: return 0;
    }
  }

  abbreviateLocation(location: string): string {
    if (!location || location === 'N/A') return location;
    const lower = location.toLowerCase();

    // Warehouse abbreviations
    if (lower.includes('gauteng main') || lower.includes('gauteng warehouse')) return 'GP';
    if (lower.includes('kzn distribution') || lower.includes('kzn warehouse')) return 'KZN';
    if (lower.includes('cape town warehouse')) return 'CPT';
    if (lower.includes('pe distribution') || lower.includes('pe warehouse')) return 'PE';
    if (lower.includes('private division')) return 'Private';
    if (lower.includes('bond store')) return 'Bond Store';

    // City/region abbreviations for delivery addresses
    if (lower.includes('johannesburg') || lower.includes('sandton') || lower.includes('soweto') || lower.includes('randburg') || lower.includes('midrand')) return 'GP';
    if (lower.includes('pretoria') || lower.includes('centurion') || lower.includes('tshwane')) return 'GP';
    if (lower.includes('ga-rankuwa') || lower.includes('krugersdorp') || lower.includes('germiston') || lower.includes('edenvale') || lower.includes('springs') || lower.includes('carletonville') || lower.includes('benoni')) return 'GP';
    if (lower.includes('durban') || lower.includes('pietermaritzburg') || lower.includes('umhlanga') || lower.includes('pinetown') || lower.includes('kwazulu') || lower.includes('newcastle') || lower.includes('ladysmith') || lower.includes('madadeni') || lower.includes('empangeni') || lower.includes('eshowe') || lower.includes('stanger')) return 'KZN';
    if (lower.includes('cape town') || lower.includes('stellenbosch') || lower.includes('paarl') || lower.includes('atlantis') || lower.includes('khayelitsha') || lower.includes('mitchell') || lower.includes('tygerberg') || lower.includes('western cape')) return 'CPT';
    if (lower.includes('gqeberha') || lower.includes('port elizabeth') || lower.includes('uitenhage')) return 'PE';
    if (lower.includes('bloemfontein') || lower.includes('free state')) return 'FS';
    if (lower.includes('polokwane') || lower.includes('limpopo')) return 'LP';
    if (lower.includes('nelspruit') || lower.includes('mpumalanga') || lower.includes('middelburg') || lower.includes('witbank') || lower.includes('kwamhlanga') || lower.includes('emakhazeni') || lower.includes('barberton')) return 'MP';
    if (lower.includes('north west') || lower.includes('rustenburg') || lower.includes('mahikeng') || lower.includes('klerksdorp')) return 'NW';
    if (lower.includes('northern cape') || lower.includes('kimberley') || lower.includes('douglas') || lower.includes('upington') || lower.includes('vredendal')) return 'NC';
    if (lower.includes('east london') || lower.includes('mthatha') || lower.includes('eastern cape') || lower.includes('bhisho')) return 'EC';

    // Fallback: return first meaningful part (before first comma)
    const parts = location.split(',');
    if (parts.length > 1) {
      // Try to get a short name - take up to the city part
      const short = parts[0].trim();
      return short.length > 30 ? short.substring(0, 28) + '…' : short;
    }
    return location.length > 30 ? location.substring(0, 28) + '…' : location;
  }

  getStatusClass(status: string): string {
    return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
  }

  /** A load is "live" when its scheduled date is today (delivery in progress). */
  isLoadLive(load: any): boolean {
    if (!load?.scheduledDate) return false;
    const d = new Date(load.scheduledDate);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth()
        && d.getDate() === now.getDate();
  }

  // Cache for last update strings to prevent ExpressionChangedAfterItHasBeenCheckedError
  private lastUpdateCache = new Map<string, { value: string, timestamp: number }>();
  
  formatLastUpdate(date: Date | string | undefined): string {
    if (!date) return 'Unknown';
    const d = new Date(date);
    
    // Use the date's timestamp rounded to the minute as cache key
    // This ensures the same value is returned for the entire minute
    const dateMinuteKey = Math.floor(d.getTime() / 60000);
    
    // Check if we have a cached value for this specific date-minute
    const cached = this.lastUpdateCache.get(dateMinuteKey.toString());
    if (cached) {
      return cached.value;
    }
    
    // Calculate the difference using current time rounded to the minute
    const nowMinute = Math.floor(Date.now() / 60000);
    const diffMins = nowMinute - dateMinuteKey;
    
    let result: string;
    if (diffMins < 1) result = 'Just now';
    else if (diffMins < 60) result = `${diffMins} min ago`;
    else if (diffMins < 1440) result = `${Math.floor(diffMins / 60)} hours ago`;
    else result = d.toLocaleDateString();
    
    // Cache the result for this date-minute
    this.lastUpdateCache.set(dateMinuteKey.toString(), { value: result, timestamp: Date.now() });
    
    // Clean old cache entries (keep last 100)
    if (this.lastUpdateCache.size > 100) {
      const firstKey = this.lastUpdateCache.keys().next().value;
      if (firstKey) this.lastUpdateCache.delete(firstKey);
    }
    
    return result;
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  syncFromCarTrack(): void {
    this.syncing.set(true);
    
    this.http.post<any>(`${this.apiUrl}/fleet/sync-from-cartrack`, {}).subscribe({
      next: (result) => {
        this.syncing.set(false);
        if (result.success) {
          // Show success dialog
          this.dialog.open(SyncResultDialogComponent, {
            width: '500px',
            data: result
          });
          // Refresh the dashboard data
          this.loadDashboardData();
        } else {
          alert('Sync failed: ' + result.message);
        }
      },
      error: (err) => {
        this.syncing.set(false);
        console.error('CarTrack sync error:', err);
        alert('Failed to sync from CarTrack. Check console for details.');
      }
    });
  }

  createNewLoad(): void {
    const dialogRef = this.dialog.open(NewLoadDialogComponent, {
      width: '95vw',
      maxWidth: '1000px',
      minWidth: '800px',
      maxHeight: '90vh',
      disableClose: true,
      panelClass: 'wide-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Add the new load to the list
        const newLoad: ActiveLoad = {
          id: this.activeLoads().length + 1,
          loadNumber: 'LD-2026-' + String(this.activeLoads().length + 1).padStart(3, '0'),
          customerName: result.customerName,
          origin: result.origin,
          destination: result.destination,
          status: 'Pending',
          vehicleRegistration: result.vehicleRegistration || '',
          driverName: result.driverName || '',
          scheduledDelivery: new Date(result.scheduledDelivery),
          progress: 0
        };
        this.activeLoads.update(loads => [...loads, newLoad]);
      }
    });
  }

  viewLoadDetails(load: ActiveLoad): void {
    // Fetch full load details from API
    this.http.get<any>(`${environment.apiUrl}/logistics/loads/${load.id}`).subscribe({
      next: (loadDetails) => {
        const dialogRef = this.dialog.open(ViewLoadDetailsDialog, {
          width: '900px',
          maxHeight: '90vh',
          data: loadDetails
        });
      },
      error: (error) => {
        console.error('Error fetching load details:', error);
        this.snackBar.open('Failed to load details', 'Close', { duration: 3000 });
      }
    });
  }

  trackLoad(load: ActiveLoad): void {
    // Try live tracking via CarTrack first, fall back to route map
    this.http.get<any>(`${this.apiUrl}/tracking/load/${load.id}/track`).subscribe({
      next: (tracking) => {
        // Open route map dialog with live vehicle position overlay
        this.http.get<any>(`${environment.apiUrl}/logistics/loads/${load.id}`).subscribe({
          next: (loadDetails) => {
            this.dialog.open(ViewRouteMapDialog, {
              width: '95vw',
              maxWidth: '1400px',
              height: '85vh',
              data: { 
                load: loadDetails,
                liveTracking: tracking
              }
            });
          },
          error: () => {
            this.snackBar.open('Failed to load route details', 'Close', { duration: 3000 });
          }
        });
      },
      error: (err) => {
        // No CarTrack or vehicle not linked — fall back to showing route on map
        this.viewRouteOnMap(load);
        if (err.status === 400) {
          this.snackBar.open('Live tracking unavailable — vehicle not linked to CarTrack. Showing route map.', 'Close', { duration: 5000 });
        }
      }
    });
  }

  updateLoadStatus(load: ActiveLoad): void {
    const dialogRef = this.dialog.open(UpdateLoadStatusDialog, {
      width: '400px',
      data: { load }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.put(`${this.apiUrl}/logistics/loads/${load.id}/status`, { status: result.status }).subscribe({
          next: () => {
            // Update local state
            this.activeLoads.update(loads => 
              loads.map(l => l.id === load.id ? { ...l, status: result.status } : l)
            );
            this.snackBar.open(`Load status updated to ${result.status}`, 'Close', { duration: 3000 });
            if (result.status === 'Delivered' || result.status === 'Completed') this.loadDeliveredWithoutPod();
          },
          error: (err) => {
            console.error('Error updating load status:', err);
            const msg = err?.status === 409 && err?.error?.error
              ? err.error.error + (err.error.missingInvoices?.length ? ` Missing: ${err.error.missingInvoices.slice(0, 5).join(', ')}${err.error.missingInvoices.length > 5 ? '…' : ''}` : '')
              : 'Failed to update load status';
            this.snackBar.open(msg, 'Close', { duration: 8000 });
          }
        });
      }
    });
  }

  reassignLoad(load: ActiveLoad): void {
    const dialogRef = this.dialog.open(ReassignLoadDialog, {
      width: '600px',
      data: { 
        load,
        vehicles: this.vehicles(),
        drivers: this.drivers()
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const updateData: any = {};
        if (result.vehicleId !== undefined) updateData.vehicleId = result.vehicleId;
        if (result.driverId !== undefined) updateData.driverId = result.driverId;

        this.http.put(`${this.apiUrl}/logistics/loads/${load.id}/reassign`, updateData).subscribe({
          next: (updatedLoad: any) => {
            // Update local state
            this.activeLoads.update(loads => 
              loads.map(l => l.id === load.id ? { 
                ...l, 
                vehicleRegistration: updatedLoad.vehicle?.registrationNumber || l.vehicleRegistration,
                driverName: updatedLoad.driver ? `${updatedLoad.driver.firstName} ${updatedLoad.driver.lastName}` : l.driverName
              } : l)
            );
            this.snackBar.open('Load reassigned successfully', 'Close', { duration: 3000 });
            this.refreshData(); // Refresh data
          },
          error: (err) => {
            console.error('Error reassigning load:', err);
            this.snackBar.open('Failed to reassign load', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  addVehicle(): void {
    this.openVehicleDialog();
  }

  getLoadRowClass(load: ActiveLoad): string {
    if (!load.scheduledDate) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const loadDate = new Date(load.scheduledDate);
    loadDate.setHours(0, 0, 0, 0);
    
    // Red: Overdue (date has passed)
    if (loadDate < today) {
      return 'load-row-overdue';
    }
    // Amber: Today's load (due today)
    else if (loadDate.getTime() === today.getTime()) {
      return 'load-row-today';
    }
    // Blue: Tomorrow's load
    else if (loadDate.getTime() === tomorrow.getTime()) {
      return 'load-row-tomorrow';
    }
    
    return '';
  }

  getTripsheetRowClass(trip: any): string {
    if (!trip.date) return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tripDate = new Date(trip.date);
    tripDate.setHours(0, 0, 0, 0);
    
    // Red: Overdue (date has passed)
    if (tripDate < today) {
      return 'load-row-overdue';
    }
    // Amber: Today's tripsheet (due today)
    else if (tripDate.getTime() === today.getTime()) {
      return 'load-row-today';
    }
    // Blue: Tomorrow's tripsheet
    else if (tripDate.getTime() === tomorrow.getTime()) {
      return 'load-row-tomorrow';
    }
    
    return '';
  }

  viewVehicleDetails(vehicle: Vehicle): void {
    this.openVehicleDialog(vehicle, 'view');
  }

  editVehicle(vehicle: Vehicle): void {
    this.openVehicleDialog(vehicle, 'edit');
  }

  assignDriver(vehicle: Vehicle): void {
    this.openAssignDriverDialog(vehicle);
  }

  reassignProvince(vehicle: Vehicle): void {
    const dialogRef = this.dialog.open(ReassignProvinceDialog, {
      width: '450px',
      data: { vehicle }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.province) {
        this.http.put(`${this.apiUrl}/fleet/vehicles/${vehicle.id}/province`, { province: result.province })
          .subscribe({
            next: () => {
              this.snackBar.open(`Province updated to ${result.province}`, 'Close', { duration: 3000 });
              this.loadVehiclesFromDatabase();
            },
            error: (err) => {
              console.error('Error updating province:', err);
              this.snackBar.open('Failed to update province', 'Close', { duration: 3000 });
            }
          });
      }
    });
  }

  getProvinceAbbreviation(province: string): string {
    const abbreviations: { [key: string]: string } = {
      'Gauteng': 'GP',
      'KwaZulu-Natal': 'KZN',
      'Western Cape': 'CPT',
      'Eastern Cape': 'EC'
    };
    return abbreviations[province] || province;
  }

  linkCarTrack(vehicle: Vehicle): void {
    this.openLinkDialog(vehicle, 'cartrack');
  }

  unlinkCarTrack(vehicle: Vehicle): void {
    if (confirm(`Unlink CarTrack from ${vehicle.registrationNumber}?`)) {
      this.http.post<any>(`${this.apiUrl}/fleet/vehicles/${vehicle.id}/unlink-cartrack`, {}).subscribe({
        next: () => {
          this.loadVehiclesFromDatabase();
        },
        error: (err) => console.error('Error unlinking CarTrack:', err)
      });
    }
  }

  linkTfn(vehicle: Vehicle): void {
    this.openLinkDialog(vehicle, 'tfn');
  }

  unlinkTfn(vehicle: Vehicle): void {
    if (confirm(`Unlink TruckFuelNet from ${vehicle.registrationNumber}?`)) {
      this.http.post<any>(`${this.apiUrl}/fleet/vehicles/${vehicle.id}/unlink-tfn`, {}).subscribe({
        next: () => {
          this.loadVehiclesFromDatabase();
        },
        error: (err) => console.error('Error unlinking TFN:', err)
      });
    }
  }

  viewFuelHistory(vehicle: Vehicle): void {
    this.dialog.open(FuelHistoryDialog, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'fuel-history-dialog-panel',
      data: { vehicle, apiUrl: environment.apiUrl }
    });
  }

  viewVehicleMaintenanceHistory(vehicle: Vehicle): void {
    this.dialog.open(VehicleMaintenanceHistoryDialog, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'maintenance-history-dialog-panel',
      data: { vehicle, apiUrl: environment.apiUrl }
    });
  }

  viewTodayHistory(vehicle: Vehicle): void {
    this.dialog.open(TodayHistoryDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'today-history-dialog-panel',
      data: { vehicle, apiUrl: environment.apiUrl }
    });
  }

  deleteVehicle(vehicle: Vehicle): void {
    if (confirm(`Are you sure you want to delete vehicle ${vehicle.registrationNumber}? This action cannot be undone.`)) {
      this.http.delete<any>(`${this.apiUrl}/fleet/vehicles/${vehicle.id}`).subscribe({
        next: () => {
          this.loadVehiclesFromDatabase();
        },
        error: (err) => console.error('Error deleting vehicle:', err)
      });
    }
  }

  openVehicleDialog(vehicle?: Vehicle, mode: 'view' | 'edit' | 'add' = 'add'): void {
    const dialogRef = this.dialog.open(VehicleDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      data: { vehicle, mode }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadVehiclesFromDatabase();
      }
    });
  }

  openAssignDriverDialog(vehicle: Vehicle): void {
    const dialogRef = this.dialog.open(AssignDriverDialogComponent, {
      width: '500px',
      data: { vehicle }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadVehiclesFromDatabase();
      }
    });
  }

  openLinkDialog(vehicle: Vehicle, type: 'cartrack' | 'tfn'): void {
    const dialogRef = this.dialog.open(LinkVehicleDialogComponent, {
      width: '500px',
      data: { vehicle, type }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadVehiclesFromDatabase();
      }
    });
  }

  trackVehicle(vehicle: Vehicle): void {
    this.openSingleVehicleMap(vehicle);
  }

  openFleetMap(): void {
    const vehiclesWithLocation = this.vehicles().filter(v => v.latitude && v.longitude);
    this.dialog.open(FleetMapDialogComponent, {
      width: '95vw',
      maxWidth: '1400px',
      height: '85vh',
      data: { vehicles: vehiclesWithLocation.length > 0 ? vehiclesWithLocation : this.vehicles() }
    });
  }

  openSingleVehicleMap(vehicle: Vehicle): void {
    this.dialog.open(FleetMapDialogComponent, {
      width: '95vw',
      maxWidth: '1200px',
      height: '80vh',
      data: { 
        vehicles: this.vehicles(),
        focusVehicle: vehicle 
      }
    });
  }

  refreshFleetLocations(): void {
    this.http.get<any>(`${this.apiUrl}/tracking/fleet-status`).subscribe({
      next: (fleetStatus) => {
        if (fleetStatus?.vehicles) {
          this.vehicles.set(fleetStatus.vehicles.map((v: any) => ({
            id: v.localVehicleId || 0,
            registrationNumber: v.registrationNumber || v.vehicleName,
            type: 'Vehicle',
            status: v.status || 'Unknown',
            currentDriver: v.currentDriverName || '',
            lastLocation: v.location?.address || 'Unknown',
            fuelLevel: 50,
            speed: v.speed,
            latitude: v.location?.latitude,
            longitude: v.location?.longitude,
            lastUpdate: v.lastUpdate
          })));
        }
      },
      error: (err) => {
        console.error('Error refreshing fleet locations:', err);
      }
    });
  }

  // South African provinces list
  southAfricanProvinces = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape'
  ];

  // Imported Invoice methods
  uniqueProvinces = computed(() => {
    // Return all SA provinces - the filter will handle showing which ones have invoices
    return this.southAfricanProvinces;
  });

  // Pre-computed province counts - calculated once when invoices change, not on every render
  provinceInvoiceCounts = computed(() => {
    const invoices = this.importedInvoices();
    const counts = new Map<string, number>();
    
    // Initialize all provinces with 0
    this.southAfricanProvinces.forEach(p => counts.set(p, 0));
    
    // Count invoices per province in a single pass
    for (const invoice of invoices) {
      if (invoice.deliveryProvince) {
        counts.set(invoice.deliveryProvince, (counts.get(invoice.deliveryProvince) || 0) + 1);
      }
    }
    
    return counts;
  });

  // Get count of invoices per province for display - now uses pre-computed map
  getProvinceInvoiceCount(province: string): number {
    return this.provinceInvoiceCounts().get(province) || 0;
  }

  allFilteredInvoices = computed(() => {
    let invoices = this.importedInvoices();
    const statusFilter = this.invoiceStatusFilter();
    const sourceFilter = this.invoiceSourceFilter();
    const provinceFilter = this.invoiceProvinceFilter();
    const searchTerm = this.invoiceSearch();
    
    if (statusFilter !== 'all') {
      invoices = invoices.filter(i => i.status.toLowerCase() === statusFilter);
    }
    
    if (sourceFilter !== 'all') {
      invoices = invoices.filter(i => i.sourceSystem === sourceFilter);
    }
    
    if (provinceFilter !== 'all') {
      invoices = invoices.filter(i => i.deliveryProvince === provinceFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      invoices = invoices.filter(i => 
        i.transactionNumber?.toLowerCase().includes(search) ||
        i.customerNumber?.toLowerCase().includes(search) ||
        i.customerName?.toLowerCase().includes(search) ||
        i.productCode?.toLowerCase().includes(search) ||
        i.productDescription?.toLowerCase().includes(search)
      );
    }
    
    return invoices;
  });

  // Paginated invoices for table display
  filteredInvoices = computed(() => {
    const all = this.allFilteredInvoices();
    const start = this.invoicePageIndex() * this.invoicePageSize();
    return all.slice(start, start + this.invoicePageSize());
  });

  // Pre-computed status counts - single pass over all invoices
  invoiceStatusCounts = computed(() => {
    const invoices = this.importedInvoices();
    let pending = 0, assigned = 0, delivered = 0, partdelivered = 0, query = 0;
    
    for (const invoice of invoices) {
      const status = invoice.status?.toLowerCase();
      switch (status) {
        case 'pending': pending++; break;
        case 'assigned': assigned++; break;
        case 'delivered': delivered++; break;
        case 'partdelivered': partdelivered++; break;
        case 'part delivered': partdelivered++; break;
        case 'query': query++; break;
      }
    }
    
    return { pending, assigned, delivered, partdelivered, query };
  });

  pendingInvoiceCount = computed(() => this.invoiceStatusCounts().pending);
  assignedInvoiceCount = computed(() => this.invoiceStatusCounts().assigned);
  deliveredInvoiceCount = computed(() => this.invoiceStatusCounts().delivered);
  partDeliveredInvoiceCount = computed(() => this.invoiceStatusCounts().partdelivered);
  queryInvoiceCount = computed(() => this.invoiceStatusCounts().query);

  loadImportedInvoices(): void {
    // Request all invoices by passing a large pageSize
    this.http.get<ImportedInvoice[]>(`${this.apiUrl}/logistics/importedinvoices?pageSize=10000`).subscribe({
      next: (invoices) => {
        // Count by status (exact case)
        const statusBreakdown = invoices.reduce((acc: any, inv) => {
          const status = inv.status || 'Unknown';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});
        
        // Check for loadId to see how many are actually linked
        const linkedCount = invoices.filter(i => i.loadId !== null && i.loadId !== undefined).length;
        // Sample invoices with different statuses
        const assigned = invoices.filter(i => i.status?.toLowerCase() === 'assigned');
        const delivered = invoices.filter(i => i.status?.toLowerCase() === 'delivered');
        const inProgress = invoices.filter(i => i.status?.toLowerCase() === 'inprogress' || i.status?.toLowerCase() === 'in progress');
        
        if (assigned.length > 0) {
        }
        
        this.importedInvoices.set(invoices);
      },
      error: (err) => {
        console.error('Failed to load invoices:', err);
        this.snackBar.open('Failed to load invoices', 'Close', { duration: 3000 });
      }
    });
  }

  getInvoiceStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'assigned': return 'status-in-transit';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  }

  calculateMargin(salesAmount: number, costOfSales: number): number {
    if (salesAmount === 0) return 0;
    return ((salesAmount - costOfSales) / salesAmount) * 100;
  }

  showSuggestedTrips(): void {
    this.dialog.open(SuggestedTripsDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      data: { apiUrl: this.apiUrl }
    }).afterClosed().subscribe(result => {
      if (result) {
        // Refresh invoices and tripsheets after trip creation
        this.loadImportedInvoices();
        this.loadTripsheets();
      }
    });
  }

  createTripsheetFromInvoices(): void {
    const pendingInvoices = this.importedInvoices().filter(i => i.status === 'Pending');
    if (pendingInvoices.length === 0) {
      alert('No pending invoices to create tripsheet from');
      return;
    }
    
    // Group by customer for tripsheet creation
    const invoiceIds = pendingInvoices.map(i => i.id);
    
    this.http.post<any>(`${this.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
      invoiceIds: invoiceIds,
      notes: 'Auto-generated from imported invoices'
    }).subscribe({
      next: (result) => {
        alert(`Tripsheet ${result.load?.loadNumber} created with ${result.stopsCreated} stops!`);
        this.loadImportedInvoices();
        this.loadTripsheets();
      },
      error: (err) => {
        console.error('Failed to create tripsheet:', err);
        alert('Failed to create tripsheet: ' + (err.error?.message || err.message));
      }
    });
  }

  viewInvoiceDetails(invoice: ImportedInvoice): void {
    this.dialog.open(InvoiceDetailsDialog, {
      width: '600px',
      data: invoice
    });
  }

  /** Display friendly region label for a warehouse code (WC→CPT, EC→PE). */
  displayWarehouseCode(code: string | null | undefined): string {
    const c = (code || '').toUpperCase();
    if (!c) return '—';
    if (c === 'WC') return 'CPT';
    if (c === 'EC') return 'PE';
    return c;
  }

  // Tripsheet methods
  allFilteredTripsheets = computed(() => {
    let trips = this.tripsheets();
    
    if (this.tripsheetStatusFilter !== 'all') {
      // Normalise both sides so 'In Transit', 'InTransit' and 'in-transit' all match,
      // and treat 'Delivered' as 'Completed' (they are the same end state).
      const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_-]+/g, '');
      const target = norm(this.tripsheetStatusFilter);
      trips = trips.filter(t => {
        let s = norm(t.status);
        if (s === 'delivered') s = 'completed';
        return s === target;
      });
    }

    if (this.tripsheetWarehouseFilter !== 'all') {
      // Region aliases: the friendly filter labels differ from the stored
      // warehouse codes/names. CPT = WC (Western Cape), PE = EC (Eastern Cape).
      // Match generously against code, name, province and origin city so the
      // filter works regardless of whether the backend returns "WC", "WH-WC",
      // "Western Cape", "Cape Town", etc.
      const aliasMap: Record<string, string[]> = {
        'CPT': ['cpt', 'wc', 'western cape', 'cape town', 'westerncape'],
        'PE':  ['pe', 'ec', 'eastern cape', 'gqeberha', 'port elizabeth', 'easterncape'],
        'GP':  ['gp', 'gauteng', 'johannesburg', 'jhb', 'joburg'],
        'KZN': ['kzn', 'kwazulu-natal', 'kwazulu natal', 'durban', 'verulam', 'kwazulunatal']
      };
      const selected = this.tripsheetWarehouseFilter.toUpperCase();
      const accepted = aliasMap[selected] || [selected.toLowerCase()];
      const strip = (s: string) => (s || '').toString().toLowerCase().replace(/^wh-/, '').trim();
      const matches = (h: string, a: string) => {
        if (!h || !a) return false;
        // Short codes (<= 3 chars) must match exactly to avoid false positives;
        // longer names/cities can match as substrings.
        if (a.length <= 3 || h.length <= 3) return h === a;
        return h.includes(a) || a.includes(h);
      };
      trips = trips.filter(t => {
        const haystack = [t.warehouseCode, t.warehouseName, t.province, t.origin]
          .map(strip)
          .filter(x => x.length > 0);
        return haystack.some(h => accepted.some(a => matches(h, a)));
      });
    }
    
    if (this.tripsheetSearch) {
      const search = this.tripsheetSearch.toLowerCase();
      trips = trips.filter(t => 
        t.tripNumber?.toLowerCase().includes(search) ||
        t.loadNumber?.toLowerCase().includes(search) ||
        t.driverName?.toLowerCase().includes(search) ||
        t.vehicleReg?.toLowerCase().includes(search)
      );
    }

    // Date range filter
    if (this.tripsheetFromDate) {
      const from = new Date(this.tripsheetFromDate);
      from.setHours(0, 0, 0, 0);
      trips = trips.filter(t => {
        const tripDate = new Date(t.date);
        tripDate.setHours(0, 0, 0, 0);
        return tripDate >= from;
      });
    }
    if (this.tripsheetToDate) {
      const to = new Date(this.tripsheetToDate);
      to.setHours(23, 59, 59, 999);
      trips = trips.filter(t => {
        const tripDate = new Date(t.date);
        return tripDate <= to;
      });
    }
    
    // Sort: Delivered/Completed status always at the bottom
    trips = [...trips].sort((a, b) => {
      const aDelivered = a.status?.toLowerCase() === 'delivered' || a.status?.toLowerCase() === 'completed';
      const bDelivered = b.status?.toLowerCase() === 'delivered' || b.status?.toLowerCase() === 'completed';
      
      if (aDelivered && !bDelivered) return 1;  // a goes to bottom
      if (!aDelivered && bDelivered) return -1; // b goes to bottom
      return 0; // keep original order within same category
    });
    
    return trips;
  });

  // Paginated tripsheets for table display
  filteredTripsheets = computed(() => {
    const all = this.allFilteredTripsheets();
    const start = this.tripsheetPageIndex() * this.tripsheetPageSize();
    return all.slice(start, start + this.tripsheetPageSize());
  });

  loadTripsheets(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/tripsheet`).subscribe({
      next: (trips) => {
        this.tripsheets.set(trips);
        this.checkInitialLoadComplete();
      },
      error: () => {
        // Sample data for testing
        this.tripsheets.set([
          { id: 1, loadId: 1, tripNumber: 'TS-2026-001', loadNumber: 'LD-000001', driverName: 'John Smith', vehicleReg: 'GP 123-456', origin: 'JHB', destination: 'DBN', totalStops: 3, totalDistance: 580, estimatedTime: '9h 30m', date: new Date(), status: 'Completed' },
          { id: 2, loadId: 2, tripNumber: 'TS-2026-002', loadNumber: 'LD-000002', driverName: 'Peter Nkosi', vehicleReg: 'KZN 111-222', origin: 'DBN', destination: 'CPT', totalStops: 2, totalDistance: 1650, estimatedTime: '18h 0m', date: new Date(), status: 'In Progress' },
          { id: 3, loadId: 3, tripNumber: 'TS-2026-003', loadNumber: 'LD-000003', driverName: 'Mike Johnson', vehicleReg: 'WC 333-444', origin: 'CPT', destination: 'PE', totalStops: 4, totalDistance: 760, estimatedTime: '12h 0m', date: new Date(), status: 'Pending' }
        ]);
        this.checkInitialLoadComplete();
      }
    });
  }

  onTripsheetFilterChange(): void {
    this.tripsheetPageIndex.set(0);
    this.tripsheets.update(trips => [...trips]);
  }

  onTripsheetDateFilterChange(): void {
    // Trigger computed re-evaluation by updating the signal
    this.tripsheetPageIndex.set(0);
    this.tripsheets.update(trips => [...trips]);
  }

  clearTripsheetDateFilter(): void {
    this.tripsheetFromDate = null;
    this.tripsheetToDate = null;
    this.tripsheetPageIndex.set(0);
    this.tripsheets.update(trips => [...trips]);
  }

  clearAllTripsheetFilters(): void {
    this.tripsheetSearch = '';
    this.tripsheetStatusFilter = 'all';
    this.tripsheetWarehouseFilter = 'all';
    this.tripsheetFromDate = null;
    this.tripsheetToDate = null;
    this.tripsheetPageIndex.set(0);
    this.tripsheets.update(trips => [...trips]);
  }

  get hasActiveTripsheetFilters(): boolean {
    return this.tripsheetSearch !== '' || 
           this.tripsheetStatusFilter !== 'all' || 
           this.tripsheetWarehouseFilter !== 'all' || 
           this.tripsheetFromDate !== null || 
           this.tripsheetToDate !== null;
  }

  getTripStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': 
      case 'delivered': 
        return 'trip-status-completed';
      case 'in progress': 
      case 'in transit':
      case 'intransit':
      case 'active':
        return 'trip-status-active';
      case 'pending': 
        return 'trip-status-pending';
      case 'assigned':
        return 'trip-status-assigned';
      case 'scheduled':
        return 'trip-status-scheduled';
      case 'cancelled':
        return 'trip-status-cancelled';
      case 'draft':
        return 'trip-status-draft';
      default: 
        return 'trip-status-pending';
    }
  }

  viewTripsheet(trip: any): void {
    // Open the generated trip sheet document (exact same format as print/email)
    this.dialog.open(TripsheetDocumentPreviewDialog, {
      width: '95vw',
      maxWidth: '1600px',
      height: '90vh',
      panelClass: 'tripsheet-landscape-dialog',
      data: { loadId: trip.loadId || trip.id, loadNumber: trip.tripsheetNo || trip.loadNumber, mode: 'tripsheet' }
    });
  }

  viewPickingSlip(trip: any): void {
    // Open the generated picking slip document (warehouse variant)
    this.dialog.open(TripsheetDocumentPreviewDialog, {
      width: '95vw',
      maxWidth: '1600px',
      height: '90vh',
      panelClass: 'tripsheet-landscape-dialog',
      data: { loadId: trip.loadId || trip.id, loadNumber: trip.tripsheetNo || trip.loadNumber, mode: 'picking' }
    });
  }

  viewRouteOnMap(trip: any): void {
    // Fetch full load details with stops from API
    const loadId = trip.loadId || trip.id;
    
    if (!loadId) {
      this.snackBar.open('Invalid load ID', 'Close', { duration: 3000 });
      return;
    }

    this.http.get<any>(`${environment.apiUrl}/logistics/loads/${loadId}`).subscribe({
      next: (loadDetails) => {
        // Check if we have warehouse and stops
        if (!loadDetails.warehouse && !loadDetails.warehouseId) {
          this.snackBar.open('Load does not have warehouse information', 'Close', { duration: 3000 });
          return;
        }
        
        if (!loadDetails.stops || loadDetails.stops.length === 0) {
          this.snackBar.open('Load does not have any stops', 'Close', { duration: 3000 });
          return;
        }

        this.dialog.open(ViewRouteMapDialog, {
          width: '95vw',
          maxWidth: '1400px',
          height: '85vh',
          data: { load: loadDetails }
        });
      },
      error: (error) => {
        console.error('Error fetching load details:', error);
        this.snackBar.open(`Failed to load route details: ${error.message || 'Unknown error'}`, 'Close', { duration: 5000 });
      }
    });
  }

  // Open the tripsheet type selection dialog
  openTripsheetTypeDialog(): void {
    const dialogRef = this.dialog.open(TripsheetTypeDialog, {
      width: '850px',
      maxWidth: '95vw',
      panelClass: 'tripsheet-type-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.type) {
        switch (result.type) {
          case 'import':
            this.openImportTripsheetDialog();
            break;
          case 'pad':
            this.openImportTripsheetDialog(true);
            break;
          case 'manual':
            this.openManualTripsheetDialog();
            break;
          case 'transfer':
            this.openInternalTransferDialog();
            break;
          case 'welly':
            this.openWellyTripsheetWizard();
            break;
          case 'ai-builder':
            this.openAiTripsheetBuilder();
            break;
          case 'welly-suggests':
            this.openWellySuggestsDialog();
            break;
        }
      }
    });
  }

  // Open Welly AI Tripsheet Wizard
  openWellyTripsheetWizard(): void {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));

    const dialogRef = this.dialog.open(WellyTripsheetWizardDialog, {
      width: '95vw',
      maxWidth: '1100px',
      height: '90vh',
      panelClass: 'welly-wizard-dialog-panel',
      data: {
        apiUrl: this.apiUrl,
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  // Open AI Powered Tripsheets builder — warehouse → vehicle → grouped invoices
  openAiTripsheetBuilder(): void {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));

    const dialogRef = this.dialog.open(AiTripsheetBuilderDialog, {
      width: '95vw',
      maxWidth: '1300px',
      height: '92vh',
      panelClass: 'ai-builder-dialog-panel',
      data: {
        apiUrl: this.apiUrl,
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result?.openWellySuggests) {
        this.openWellySuggestsDialog();
        return;
      }
      if (result?.created) {
        this.loadTripsheets();
        this.loadImportedInvoices();
        this.loadDashboardData();
      }
    });
  }

  // Open Welly Suggests Dialog — AI-batched tripsheet suggestions by warehouse
  openWellySuggestsDialog(): void {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));

    const dialogRef = this.dialog.open(WellySuggestsDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '92vh',
      panelClass: 'welly-suggests-dialog-panel',
      data: {
        apiUrl: this.apiUrl,
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
        customers: this.customers(),
        invoices: this.importedInvoices(),
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  // Open Manual Tripsheet Dialog (no system invoice linking)
  openManualTripsheetDialog(): void {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    const dialogRef = this.dialog.open(ManualTripsheetDialog, {
      width: '95vw',
      maxWidth: '1200px',
      height: '90vh',
      panelClass: 'manual-tripsheet-dialog-panel',
      data: {
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
        customers: this.customers(),
        apiUrl: this.apiUrl
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
      }
    });
  }

  // Open Internal Transfer Dialog (warehouse to warehouse)
  openInternalTransferDialog(): void {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    const dialogRef = this.dialog.open(InternalTransferDialog, {
      width: '95vw',
      maxWidth: '1000px',
      height: '85vh',
      panelClass: 'internal-transfer-dialog-panel',
      data: {
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
        apiUrl: this.apiUrl
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
      }
    });
  }

  openCreateTripsheetDialog(): void {
    // Filter out unavailable vehicles (under maintenance, decommissioned, etc.)
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    const dialogRef = this.dialog.open(CreateTripsheetDialog, {
      width: '99vw',
      maxWidth: '2200px',
      height: '95vh',
      panelClass: 'create-tripsheet-dialog-panel',
      data: {
        invoices: this.importedInvoices(),
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
        customers: this.customers(),
        apiUrl: this.apiUrl
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  openImportTripsheetDialog(padMode: boolean = false): void {
    const dialogRef = this.dialog.open(ImportTripsheetDialog, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'import-tripsheet-dialog-panel',
      data: {
        apiUrl: this.apiUrl,
        padMode
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.openCreateDialog && result.invoices?.length > 0) {
        // Open CreateTripsheetDialog with imported data pre-populated
        setTimeout(() => {
          this.openCreateTripsheetDialogWithImportedData(result.invoices, result.batchId, result.isManualTripsheet);
        }, 100);
      } else if (result?.imported) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  // Open Create Tripsheet dialog with pre-populated data from Excel import
  openCreateTripsheetDialogWithImportedData(importedInvoices: any[], batchId?: string, isManualTripsheet?: boolean): void {
    // Combine imported invoices with existing pending invoices (if any)
    const allInvoices = [...importedInvoices];
    
    // Open the CreateTripsheetDialog with imported data pre-selected
    const dialogRef = this.dialog.open(CreateTripsheetDialog, {
      width: '99vw',
      maxWidth: '2200px',
      height: '95vh',
      panelClass: 'create-tripsheet-dialog-panel',
      data: {
        invoices: allInvoices,
        drivers: this.drivers(),
        vehicles: this.vehicles(),
        warehouses: this.warehouses(),
        customers: this.customers(),
        apiUrl: this.apiUrl,
        // Flag to indicate this came from an import
        isImport: true,
        batchId: batchId,
        // Flag for manual tripsheet (no matched invoices in system)
        isManualTripsheet: isManualTripsheet || false,
        // Pre-select all imported invoices
        preSelectedInvoices: importedInvoices
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  // Continue editing a draft tripsheet - opens in edit mode
  continueDraft(trip: any): void {
    // Drafts use editTripsheet - the dialog will detect edit mode and allow completion
    this.snackBar.open('Opening draft tripsheet...', '', { duration: 2000 });
    this.editTripsheet(trip);
  }

  // Edit existing tripsheet - load data and open CreateTripsheetDialog
  editTripsheet(trip: any): void {
    const loadId = trip.loadId || trip.id;
    
    // Fetch full tripsheet data from API
    this.http.get<any>(`${this.apiUrl}/logistics/tripsheet/${loadId}`).subscribe({
      next: (tripsheetData) => {
        // Convert tripsheet line items back to invoice-like format for the dialog
        const invoices = (tripsheetData.lineItems || []).map((item: any, index: number) => ({
          id: `edit-${loadId}-${index}`,
          transactionNumber: item.invNo || item.invoiceNumber || `ITEM-${index + 1}`,
          customerName: item.customerName || 'Unknown Customer',
          customerNumber: item.orderNo || item.customerNumber,
          deliveryAddress: item.address || '',
          address: item.address || '',
          city: item.city || '',
          province: '',
          productDescription: item.productDescription || 'Product',
          productCode: item.productBrand || item.productCode,
          quantity: item.qty || 1,
          salesAmount: item.value || 0,
          netSales: item.value || 0,
          totalAmount: item.value || 0,
          status: 'Pending',
          contactPerson: item.contactPerson,
          contactPhone: item.contactPhone,
          latitude: item.latitude,
          longitude: item.longitude
        }));

        // Find matching warehouse, driver, vehicle using IDs first, then name fallback
        const matchedWarehouse = this.warehouses().find(w => w.id === tripsheetData.warehouseId)
          || this.warehouses().find(w => w.name?.toLowerCase() === tripsheetData.warehouseName?.toLowerCase())
          || this.warehouses().find(w => w.name?.toLowerCase() === tripsheetData.origin?.toLowerCase());
        
        const driverNameLower = tripsheetData.driverName?.toLowerCase()?.trim();
        const matchedDriver = this.drivers().find(d => d.id === tripsheetData.driverId)
          || (driverNameLower && driverNameLower !== 'unassigned'
            ? this.drivers().find(d => `${d.firstName} ${d.lastName}`.toLowerCase().trim() === driverNameLower)
              || this.drivers().find(d => d.firstName?.toLowerCase() === driverNameLower?.replace(/\s*-\s*$/, ''))
            : undefined);
        
        const matchedVehicle = this.vehicles().find(v => v.id === tripsheetData.vehicleId)
          || this.vehicles().find(v => v.registrationNumber === tripsheetData.vehicleRegNumber)
          || this.vehicles().find(v => v.registrationNumber === tripsheetData.vehicleRegistration);

        // Filter out unavailable vehicles
        const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
        const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));

        // Open CreateTripsheetDialog in edit mode
        const dialogRef = this.dialog.open(CreateTripsheetDialog, {
          width: '99vw',
          maxWidth: '2200px',
          height: '95vh',
          panelClass: 'create-tripsheet-dialog-panel',
          data: {
            invoices: invoices,
            drivers: this.drivers(),
            vehicles: availableVehicles,
            warehouses: this.warehouses(),
            customers: this.customers(),
            apiUrl: this.apiUrl,
            // Edit mode flags
            isEditMode: true,
            editLoadId: loadId,
            existingTripsheet: tripsheetData,
            // Pre-populate values
            preSelectedInvoices: invoices,
            preSelectedWarehouse: matchedWarehouse,
            preSelectedDriver: matchedDriver,
            preSelectedVehicle: matchedVehicle,
            preScheduledDate: tripsheetData.tripDate ? new Date(tripsheetData.tripDate) : new Date(),
            preSpecialInstructions: tripsheetData.specialInstructions || tripsheetData.notes || '',
            preTotalDistance: tripsheetData.totalDistance || tripsheetData.estimatedDistance,
            preEstimatedTime: tripsheetData.estimatedTime
          }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result?.created || result?.updated) {
            this.loadTripsheets();
            this.loadImportedInvoices();
          }
        });
      },
      error: (err) => {
        console.error('Failed to load tripsheet for editing:', err);
        this.snackBar.open('Failed to load tripsheet for editing: ' + (err.error?.message || err.message || 'Unknown error'), 'Close', { duration: 5000 });
      }
    });
  }

  printTripsheet(trip: any): void {
    // Open tripsheet in new window for printing
    const loadId = trip.loadId || trip.id;
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        }
      },
      error: (err) => {
        console.error('Failed to load tripsheet for printing:', err);
      }
    });
  }

  downloadTripsheet(trip: any): void {
    // Download tripsheet as PDF
    const loadId = trip.loadId || trip.id;
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        // Create a hidden iframe and use print to PDF
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          
          // Use the browser's print dialog with "Save as PDF" option
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
          }, 500);
        }
      },
      error: (err) => {
        console.error('Failed to download tripsheet:', err);
      }
    });
  }

  assignTripsheet(trip: any): void {
    // Filter out unavailable vehicles (under maintenance, decommissioned, etc.)
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    // Open dialog to assign driver and vehicle to existing tripsheet
    const dialogRef = this.dialog.open(AssignTripsheetDialog, {
      width: '500px',
      data: {
        tripsheet: trip,
        drivers: this.drivers(),
        vehicles: availableVehicles
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.assigned) {
        // Update the tripsheet with driver/vehicle
        const loadId = trip.loadId || trip.id;
        this.http.put(`${this.apiUrl}/logistics/tripsheet/${loadId}/assign`, {
          driverId: result.driverId,
          vehicleId: result.vehicleId,
          scheduledDate: result.scheduledDate
        }).subscribe({
          next: () => {
            this.loadTripsheets();
            this.snackBar.open('Driver and vehicle assigned successfully!', 'Close', { duration: 3000 });
          },
          error: (err) => {
            console.error('Failed to assign tripsheet:', err);
            this.snackBar.open('Failed to assign driver/vehicle', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  reassignTripsheet(trip: any): void {
    // Filter out unavailable vehicles
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    // Use the ReassignLoadDialog for tripsheets too
    const dialogRef = this.dialog.open(ReassignLoadDialog, {
      width: '500px',
      data: {
        load: {
          loadNumber: trip.tripNumber || trip.loadNumber || `TS-${trip.loadId || trip.id}`,
          vehicleRegistration: trip.vehicleReg,
          driverName: trip.driverName
        },
        vehicles: availableVehicles,
        drivers: this.drivers()
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const loadId = trip.loadId || trip.id;
        const updateData: any = {};
        
        if (result.vehicleId !== null) {
          updateData.vehicleId = result.vehicleId;
        }
        if (result.driverId !== null) {
          updateData.driverId = result.driverId;
        }

        this.http.put(`${this.apiUrl}/logistics/tripsheet/${loadId}/assign`, updateData).subscribe({
          next: () => {
            this.loadTripsheets();
            this.snackBar.open('Tripsheet reassigned successfully!', 'Close', { duration: 3000 });
          },
          error: (err) => {
            console.error('Error reassigning tripsheet:', err);
            this.snackBar.open('Failed to reassign tripsheet', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  rescheduleTripsheet(trip: any): void {
    const dialogRef = this.dialog.open(RescheduleTripsheetDialog, {
      width: '520px',
      data: {
        tripNumber: trip.tripsheetNo || trip.tripNumber || trip.loadNumber || `TS-${trip.loadId || trip.id}`,
        currentPickupDate: trip.scheduledPickupDate || trip.scheduledDate || trip.date,
        currentPickupTime: trip.scheduledPickupTime,
        currentDeliveryDate: trip.scheduledDeliveryDate || trip.expectedDelivery,
        currentDeliveryTime: trip.scheduledDeliveryTime || trip.expectedDeliveryTime
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const loadId = trip.loadId || trip.id;
        const updateData: any = {};
        
        if (result.scheduledPickupDate) updateData.scheduledPickupDate = result.scheduledPickupDate;
        if (result.scheduledPickupTime) updateData.scheduledPickupTime = result.scheduledPickupTime;
        if (result.scheduledDeliveryDate) updateData.scheduledDeliveryDate = result.scheduledDeliveryDate;
        if (result.scheduledDeliveryTime) updateData.scheduledDeliveryTime = result.scheduledDeliveryTime;
        if (result.reason) updateData.notes = result.reason;

        // The tripsheet list "Date" column is derived from deliveryDate ?? pickupDate.
        // If the user only changed one of the two dates, apply it to both so the
        // rescheduled date is actually reflected in the table.
        if (result.scheduledPickupDate && !result.scheduledDeliveryDate) {
          updateData.scheduledDeliveryDate = result.scheduledPickupDate;
        }
        if (result.scheduledDeliveryDate && !result.scheduledPickupDate) {
          updateData.scheduledPickupDate = result.scheduledDeliveryDate;
        }

        this.http.put(`${this.apiUrl}/logistics/tripsheet/${loadId}/assign`, updateData).subscribe({
          next: () => {
            this.loadTripsheets();
            this.loadDashboardData();
            this.snackBar.open('Tripsheet rescheduled successfully!', 'Close', { duration: 3000 });
          },
          error: (err) => {
            console.error('Error rescheduling tripsheet:', err);
            this.snackBar.open('Failed to reschedule tripsheet', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  deleteTripsheet(trip: any): void {
    const loadId = trip.loadId || trip.id;
    const tripsheetNo = trip.tripsheetNo || `TS-${loadId}`;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete tripsheet ${tripsheetNo}?\n\nThis will remove the load and reset all associated invoices back to Pending status.`)) {
      return;
    }
    
    this.http.delete(`${this.apiUrl}/logistics/tripsheet/${loadId}`).subscribe({
      next: () => {
        this.loadTripsheets();
        this.loadImportedInvoices();
        this.snackBar.open(`Tripsheet ${tripsheetNo} deleted successfully!`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to delete tripsheet:', err);
        this.snackBar.open('Failed to delete tripsheet: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  emailToWarehouseManager(trip: any): void {
    const loadId = trip.loadId || trip.id;
    const tripsheetNo = trip.tripsheetNo || trip.loadNumber || `TS-${loadId}`;

    // Recipients are entered manually — email is sent from intranet@promedtechnologies.co.za
    // with the trip sheet PDF and picking slip PDF attached.
    let userEmail = '';
    try {
      const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
      userEmail = cu?.email || '';
    } catch { /* ignore */ }

    const recipientsRef = this.dialog.open(TripsheetEmailRecipientsDialog, {
      width: '540px',
      data: { loadNumber: tripsheetNo, userEmail }
    });

    recipientsRef.afterClosed().subscribe((result: { emails: string[]; ccSelf: boolean; attachPickingSlip: boolean } | undefined) => {
      if (!result || !result.emails?.length) return;

      this.snackBar.open(`Sending trip sheet ${tripsheetNo}...`, undefined, { duration: 10000 });
      this.http.post(`${this.apiUrl}/logistics/tripsheet/${loadId}/email`, {
        recipientEmails: result.emails,
        ccSelf: result.ccSelf,
        attachPickingSlip: result.attachPickingSlip
      }).subscribe({
        next: () => {
          this.snackBar.open(
            `Trip sheet ${tripsheetNo} emailed to ${result.emails.length} recipient${result.emails.length === 1 ? '' : 's'}`,
            'Close',
            { duration: 5000 }
          );
        },
        error: (err) => {
          console.error('Failed to email trip sheet:', err);
          this.snackBar.open(err?.error?.error || 'Failed to send trip sheet email', 'Close', { duration: 6000 });
        }
      });
    });
  }

  activateTripsheet(trip: any): void {
    const loadId = trip.loadId || trip.id;
    const tripsheetNo = trip.tripsheetNo || `TS-${loadId}`;
    
    // Check if driver and vehicle are assigned
    if (!trip.driverId || !trip.vehicleId) {
      this.snackBar.open('Please assign a driver and vehicle before activating the tripsheet.', 'Close', { duration: 4000 });
      // Open the assign dialog
      this.assignTripsheet(trip);
      return;
    }
    
    // Confirm activation
    if (!confirm(`Generate load for tripsheet ${tripsheetNo}?\n\nThis will change the status to Active and the driver will be ready to depart.`)) {
      return;
    }
    
    this.http.post(`${this.apiUrl}/logistics/tripsheet/${loadId}/activate`, {}).subscribe({
      next: () => {
        this.loadTripsheets();
        this.snackBar.open(`Tripsheet ${tripsheetNo} is now Active! Driver can depart.`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to activate tripsheet:', err);
        this.snackBar.open('Failed to activate tripsheet: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  // Fuel Management Methods (TFN)
  loadFuelSummary(): void {
    this.http.get<any>(`${environment.apiUrl}/logistics/tfn/dashboard-summary`).subscribe({
      next: (data) => {
        this.fuelSummary.set(data);
      },
      error: (err) => {
        console.error('Failed to load fuel summary:', err);
        this.fuelSummary.set(null);
      }
    });
  }

  syncFuelData(): void {
    this.syncingFuel.set(true);
    this.http.post<any>(`${environment.apiUrl}/logistics/tfn/sync`, {}).subscribe({
      next: (result) => {
        this.syncingFuel.set(false);
        // Reload fuel summary after sync
        this.loadFuelSummary();

        const vehicles = result.vehiclesResult?.synced ?? 0;
        const orders = result.ordersResult?.synced ?? 0;
        const transactions = result.transactionsResult?.synced ?? 0;

        if (result.hasError) {
          alert(`Fuel data synced with errors.\nVehicles: ${vehicles}\nOrders: ${orders}\nTransactions: ${transactions}\n\nDetails: ${result.errorMessage || 'Unknown error'}`);
        } else {
          alert(`Fuel data synced successfully!\nVehicles: ${vehicles}\nOrders: ${orders}\nTransactions: ${transactions}`);
        }
      },
      error: (err) => {
        console.error('Failed to sync fuel data:', err);
        this.syncingFuel.set(false);
        alert('Failed to sync fuel data. Please check console for details.');
      }
    });
  }

  calculateFuelChange(): string {
    const summary = this.fuelSummary();
    if (!summary?.thisMonth?.totalCost || !summary?.lastMonth?.totalCost) {
      return '0';
    }
    const change = ((summary.thisMonth.totalCost - summary.lastMonth.totalCost) / summary.lastMonth.totalCost) * 100;
    return change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Incoming Delivery Requests Methods
  loadDeliveryRequests(): void {
    this.http.get<DeliveryRequest[]>(`${environment.apiUrl}/logistics/delivery-requests`).subscribe({
      next: (requests) => {
        this.deliveryRequests.set(requests);
        // Count pending + approved as active requests needing attention
        this.deliveryRequestsCount.set(requests.filter(r => r.status === 'Pending' || r.status === 'Approved').length);
      },
      error: (err) => {
        console.error('Failed to load delivery requests:', err);
        this.deliveryRequests.set([]);
        this.deliveryRequestsCount.set(0);
      }
    });
  }

  openIncomingRequestsDialog(): void {
    const dialogRef = this.dialog.open(IncomingRequestsDialog, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'incoming-requests-dialog-panel',
      data: { requests: this.deliveryRequests(), apiUrl: environment.apiUrl }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'refresh') {
        this.loadDeliveryRequests();
      }
    });
  }

  // Address Issues Methods (Customers without addresses)
  loadAddressIssuesCount(): void {
    this.http.get<number>(`${environment.apiUrl}/logistics/customers/address-issues/count`).subscribe({
      next: (count) => {
        this.addressIssuesCount.set(count);
      },
      error: (err) => {
        console.error('Failed to load address issues count:', err);
        this.addressIssuesCount.set(0);
      }
    });
  }

  openAddressIssuesDialog(): void {
    const dialogRef = this.dialog.open(AddressIssuesDialog, {
      width: '95vw',
      maxWidth: '1400px',
      maxHeight: '90vh',
      panelClass: 'address-issues-dialog-panel',
      data: { apiUrl: environment.apiUrl }
    });

    dialogRef.afterClosed().subscribe(() => {
      // Always refresh count after dialog closes — Welly fixes may have been applied
      this.loadAddressIssuesCount();
      this.loadCustomers();
    });
  }

  // ==========================================
  // Fuel History Methods
  // ==========================================
  loadFuelPeriods(): void {
    this.http.get<any[]>(`${environment.apiUrl}/fuelhistory/periods`).subscribe({
      next: (periods) => {
        this.fuelPeriods.set(periods);
        // Auto-select latest period
        if (periods.length > 0 && !this.selectedFuelPeriod) {
          this.selectedFuelPeriod = periods[0];
          this.loadFuelMonthlyReport();
        }
      },
      error: (err) => {
        console.error('Failed to load fuel periods:', err);
        this.fuelPeriods.set([]);
      }
    });
  }

  syncFuelFromTfn(): void {
    this.fuelSyncing = true;
    this.http.post<any>(`${environment.apiUrl}/fuelhistory/sync-from-tfn`, {}).subscribe({
      next: (result) => {
        this.fuelSyncing = false;
        const imported = result.imported || 0;
        const skipped = result.skippedDuplicates || 0;
        
        if (imported > 0) {
          // Refresh periods and current report
          this.selectedFuelPeriod = null;
          this.loadFuelPeriods();
          alert(`✅ Synced ${imported} new fuel transactions from TFN\n${skipped > 0 ? `(${skipped} duplicates skipped)` : ''}\n\n${result.monthBreakdown?.map((m: any) => `${m.month}: ${m.count} transactions, ${m.litres?.toFixed(0)}L, R${m.amount?.toFixed(2)}`).join('\n') || ''}`);
        } else {
          alert(`ℹ️ ${result.message || 'No new transactions to sync'}\n\nPeriod checked: ${result.periodChecked || 'N/A'}`);
        }
      },
      error: (err) => {
        this.fuelSyncing = false;
        console.error('Failed to sync fuel from TFN:', err);
        alert('❌ Failed to sync fuel data from TFN. Check the console for details.');
      }
    });
  }

  /** Format a UTC sync timestamp into a friendly relative/local string. */
  formatLastSync(utc: string | null | undefined): string {
    if (!utc) return 'never';
    const date = new Date(utc);
    if (isNaN(date.getTime())) return 'never';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago (${date.toLocaleDateString()})`;
  }

  /** Consider data stale if the last successful sync was more than 2 hours ago (or never). */
  isSyncStale(utc: string | null | undefined): boolean {
    if (!utc) return true;
    const date = new Date(utc);
    if (isNaN(date.getTime())) return true;
    return (Date.now() - date.getTime()) > 2 * 60 * 60 * 1000;
  }

  loadFuelMonthlyReport(): void {
    if (!this.selectedFuelPeriod) return;
    this.fuelLoading.set(true);

    const { reportMonth, reportYear } = this.selectedFuelPeriod;

    // Load report summary and transactions in parallel
    this.http.get<any>(`${environment.apiUrl}/fuelhistory/monthly-report?month=${reportMonth}&year=${reportYear}`).subscribe({
      next: (report) => {
        this.fuelReport.set(report);
        this.fuelLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load fuel report:', err);
        this.fuelReport.set(null);
        this.fuelLoading.set(false);
      }
    });

    this.http.get<any[]>(`${environment.apiUrl}/fuelhistory/transactions?month=${reportMonth}&year=${reportYear}&pageSize=500`).subscribe({
      next: (transactions) => {
        this.fuelTransactions.set(transactions);
        this.filteredFuelTransactions.set(transactions);
        // Extract unique assignment groups
        const groups = [...new Set(transactions.map(t => t.depotAssignment).filter(Boolean))].sort();
        this.fuelAssignmentGroups.set(groups);
      },
      error: (err) => {
        console.error('Failed to load fuel transactions:', err);
        this.fuelTransactions.set([]);
        this.filteredFuelTransactions.set([]);
      }
    });

    this.http.get<any[]>(`${environment.apiUrl}/fuelhistory/by-assignment?month=${reportMonth}&year=${reportYear}`).subscribe({
      next: (groups) => {
        this.fuelGroupData.set(groups);
      },
      error: (err) => {
        console.error('Failed to load fuel groups:', err);
        this.fuelGroupData.set([]);
      }
    });
  }

  filterFuelTransactions(): void {
    let filtered = this.fuelTransactions();
    if (this.fuelSearchTerm) {
      const term = this.fuelSearchTerm.toUpperCase();
      filtered = filtered.filter(t => t.registrationNumber.toUpperCase().includes(term));
    }
    if (this.fuelAssignmentFilter) {
      filtered = filtered.filter(t => t.depotAssignment === this.fuelAssignmentFilter);
    }
    if (this.fuelSourceFilter) {
      filtered = filtered.filter(t => (t.source || 'TFN') === this.fuelSourceFilter);
    }
    this.filteredFuelTransactions.set(filtered);
  }

  // Fuel Export Dialog Methods
  openFuelExportDialog(): void {
    // Default to the currently selected period, or all
    if (this.selectedFuelPeriod) {
      const month = this.selectedFuelPeriod.reportMonth;
      const year = this.selectedFuelPeriod.reportYear;
      this.fuelExportFromDate = new Date(year, month - 1, 1);
      this.fuelExportToDate = new Date(year, month, 0); // last day of month
      this.fuelExportQuickSelect = month + '-' + year;
    } else {
      this.setFuelExportAll();
    }
    this.fuelExportGenerating = false;
    this.showFuelExportDialog = true;
  }

  closeFuelExportDialog(): void {
    this.showFuelExportDialog = false;
    this.fuelExportGenerating = false;
  }

  setFuelExportPeriod(period: any): void {
    const month = period.reportMonth;
    const year = period.reportYear;
    this.fuelExportFromDate = new Date(year, month - 1, 1);
    this.fuelExportToDate = new Date(year, month, 0);
    this.fuelExportQuickSelect = month + '-' + year;
  }

  setFuelExportAll(): void {
    const periods = this.fuelPeriods();
    if (periods.length > 0) {
      const oldest = periods[periods.length - 1];
      const newest = periods[0];
      this.fuelExportFromDate = new Date(oldest.reportYear, oldest.reportMonth - 1, 1);
      this.fuelExportToDate = new Date(newest.reportYear, newest.reportMonth, 0);
    } else {
      this.fuelExportFromDate = new Date(2026, 0, 1);
      this.fuelExportToDate = new Date();
    }
    this.fuelExportQuickSelect = 'all';
  }

  async exportFuelExcel(): Promise<void> {
    this.fuelExportGenerating = true;
    try {
      const XLSX = await import('xlsx');
      const from = new Date(this.fuelExportFromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(this.fuelExportToDate);
      to.setHours(23, 59, 59, 999);
      const fromStr = from.toLocaleDateString('en-ZA');
      const toStr = to.toLocaleDateString('en-ZA');

      // Fetch ALL transactions across the date range from the API (no pagination)
      const url = `${environment.apiUrl}/fuelhistory/transactions?pageSize=10000`;
      const allTxns = await this.http.get<any[]>(url).toPromise() || [];

      // Filter by date range
      const filtered = allTxns.filter(t => {
        const d = new Date(t.transactionDate);
        return d >= from && d <= to;
      }).sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

      if (filtered.length === 0) {
        this.snackBar.open('No fuel transactions found for the selected date range', 'Close', { duration: 3000 });
        this.fuelExportGenerating = false;
        return;
      }

      // ---- Sheet 1: Transactions ----
      const txnRows: any[][] = [
        ['ProMed Technologies — Fuel History Report'],
        [`Period: ${fromStr} to ${toStr}`],
        [`Generated: ${new Date().toLocaleString('en-ZA')}`],
        [`Total Transactions: ${filtered.length}`],
        [],
        ['Date', 'Time', 'Registration', 'Card Number', 'Depot/Station', 'Assignment', 'Allocation (L)', 'Litres Used', 'Amount (R)', 'Cost/Litre (R)']
      ];

      let totalLitres = 0;
      let totalAmount = 0;

      for (const t of filtered) {
        const dt = new Date(t.transactionDate);
        const dateStr = dt.toLocaleDateString('en-ZA');
        const timeStr = dt.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
        const costPerLitre = t.litresUsed > 0 ? Math.round((t.amountSpent / t.litresUsed) * 100) / 100 : 0;
        totalLitres += t.litresUsed;
        totalAmount += t.amountSpent;

        txnRows.push([
          dateStr,
          timeStr,
          t.registrationNumber,
          t.cardNumber || '',
          t.depotName || '',
          t.depotAssignment || '',
          t.allocationLitres,
          t.litresUsed,
          t.amountSpent,
          costPerLitre
        ]);
      }

      txnRows.push([]);
      txnRows.push(['', '', '', '', '', 'TOTALS:', '', totalLitres, totalAmount, totalLitres > 0 ? Math.round((totalAmount / totalLitres) * 100) / 100 : 0]);

      const txnSheet = XLSX.utils.aoa_to_sheet(txnRows);
      // Set column widths
      txnSheet['!cols'] = [
        { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 40 }, { wch: 18 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
      ];

      // ---- Sheet 2: Summary by Vehicle ----
      const vehicleMap = new Map<string, { reg: string; assignment: string; txns: number; litres: number; amount: number; allocation: number }>();
      for (const t of filtered) {
        const key = t.registrationNumber;
        if (!vehicleMap.has(key)) {
          vehicleMap.set(key, { reg: key, assignment: t.depotAssignment || '', txns: 0, litres: 0, amount: 0, allocation: t.allocationLitres || 0 });
        }
        const v = vehicleMap.get(key)!;
        v.txns++;
        v.litres += t.litresUsed;
        v.amount += t.amountSpent;
      }

      const summaryRows: any[][] = [
        ['ProMed Technologies — Fuel Summary by Vehicle'],
        [`Period: ${fromStr} to ${toStr}`],
        [],
        ['Registration', 'Assignment', 'Transactions', 'Allocation (L)', 'Total Litres', 'Total Amount (R)', 'Avg Cost/Litre (R)', 'Avg Litres/Fill']
      ];

      const sortedVehicles = [...vehicleMap.values()].sort((a, b) => b.amount - a.amount);
      let sumLitres = 0, sumAmount = 0, sumTxns = 0;
      for (const v of sortedVehicles) {
        sumLitres += v.litres;
        sumAmount += v.amount;
        sumTxns += v.txns;
        summaryRows.push([
          v.reg,
          v.assignment,
          v.txns,
          v.allocation,
          Math.round(v.litres * 100) / 100,
          Math.round(v.amount * 100) / 100,
          v.litres > 0 ? Math.round((v.amount / v.litres) * 100) / 100 : 0,
          v.txns > 0 ? Math.round((v.litres / v.txns) * 100) / 100 : 0
        ]);
      }
      summaryRows.push([]);
      summaryRows.push(['TOTALS', '', sumTxns, '', Math.round(sumLitres * 100) / 100, Math.round(sumAmount * 100) / 100, sumLitres > 0 ? Math.round((sumAmount / sumLitres) * 100) / 100 : 0, '']);

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
      summarySheet['!cols'] = [
        { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }
      ];

      // ---- Sheet 3: Summary by Group ----
      const groupMap = new Map<string, { group: string; vehicles: Set<string>; txns: number; litres: number; amount: number }>();
      for (const t of filtered) {
        const grp = t.depotAssignment || 'Unassigned';
        if (!groupMap.has(grp)) {
          groupMap.set(grp, { group: grp, vehicles: new Set(), txns: 0, litres: 0, amount: 0 });
        }
        const g = groupMap.get(grp)!;
        g.vehicles.add(t.registrationNumber);
        g.txns++;
        g.litres += t.litresUsed;
        g.amount += t.amountSpent;
      }

      const groupRows: any[][] = [
        ['ProMed Technologies — Fuel Summary by Group'],
        [`Period: ${fromStr} to ${toStr}`],
        [],
        ['Group/Assignment', 'Vehicles', 'Transactions', 'Total Litres', 'Total Amount (R)', 'Avg Cost/Litre (R)', 'Avg per Vehicle (R)']
      ];

      const sortedGroups = [...groupMap.values()].sort((a, b) => b.amount - a.amount);
      let gSumLitres = 0, gSumAmount = 0, gSumTxns = 0;
      for (const g of sortedGroups) {
        gSumLitres += g.litres;
        gSumAmount += g.amount;
        gSumTxns += g.txns;
        groupRows.push([
          g.group,
          g.vehicles.size,
          g.txns,
          Math.round(g.litres * 100) / 100,
          Math.round(g.amount * 100) / 100,
          g.litres > 0 ? Math.round((g.amount / g.litres) * 100) / 100 : 0,
          g.vehicles.size > 0 ? Math.round((g.amount / g.vehicles.size) * 100) / 100 : 0
        ]);
      }
      groupRows.push([]);
      groupRows.push(['TOTALS', '', gSumTxns, Math.round(gSumLitres * 100) / 100, Math.round(gSumAmount * 100) / 100, gSumLitres > 0 ? Math.round((gSumAmount / gSumLitres) * 100) / 100 : 0, '']);

      const groupSheet = XLSX.utils.aoa_to_sheet(groupRows);
      groupSheet['!cols'] = [
        { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
      ];

      // Create workbook with all sheets
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, txnSheet, 'Transactions');
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'By Vehicle');
      XLSX.utils.book_append_sheet(workbook, groupSheet, 'By Group');

      const filename = `Fuel_History_${fromStr.replace(/\//g, '-')}_to_${toStr.replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, filename);

      this.snackBar.open(`Exported ${filtered.length} transactions to Excel`, 'Close', { duration: 3000 });
      this.closeFuelExportDialog();
    } catch (err) {
      console.error('Fuel export failed:', err);
      this.snackBar.open('Failed to export fuel data', 'Close', { duration: 3000 });
    } finally {
      this.fuelExportGenerating = false;
    }
  }

  getFuelCardClass(assignment: string | null): string {
    if (!assignment) return '';
    if (assignment.includes('14 TON')) return 'fuel-14ton';
    if (assignment.includes('10 TON')) return 'fuel-10ton';
    if (assignment.includes('8 TON')) return 'fuel-8ton';
    if (assignment.includes('4 TON')) return 'fuel-4ton';
    if (assignment.includes('TRANSIT')) return 'fuel-transit';
    if (assignment.includes('LINK')) return 'fuel-link';
    return '';
  }

  getAssignmentClass(assignment: string | null): string {
    if (!assignment) return 'assignment-default';
    if (assignment.includes('14 TON')) return 'assignment-14ton';
    if (assignment.includes('10 TON')) return 'assignment-10ton';
    if (assignment.includes('8 TON')) return 'assignment-8ton';
    if (assignment.includes('4 TON')) return 'assignment-4ton';
    if (assignment.includes('TRANSIT')) return 'assignment-transit';
    if (assignment.includes('LINK')) return 'assignment-link';
    if (assignment.includes('GP')) return 'assignment-gp';
    if (assignment.includes('CPT')) return 'assignment-cpt';
    return 'assignment-default';
  }

  // ─── Requisitions / Petty Cash Methods ─────────────────────────

  reqMonthName(month: number): string {
    const names = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names[month] || '';
  }

  reqCurrentPeriodLabel(): string {
    const p = this.reqPeriod();
    if (!p) return '';
    const [year, month] = p.split('-');
    return `${this.reqMonthName(+month)} ${year}`;
  }

  private reqPeriodIndex(): number {
    return this.reqPeriods().findIndex(p => `${p.year}-${p.month}` === this.reqPeriod());
  }

  // Periods come newest-first, so "Previous" (older) = index+1, "Next" (newer) = index-1
  reqHasPrevPeriod(): boolean {
    const i = this.reqPeriodIndex();
    return i >= 0 && i < this.reqPeriods().length - 1;
  }

  reqHasNextPeriod(): boolean {
    return this.reqPeriodIndex() > 0;
  }

  stepRequisitionPeriod(direction: number): void {
    // direction -1 = older period, +1 = newer period
    const periods = this.reqPeriods();
    const i = this.reqPeriodIndex();
    if (i < 0) return;
    const target = direction < 0 ? i + 1 : i - 1;
    if (target < 0 || target >= periods.length) return;
    const p = periods[target];
    this.reqPeriod.set(`${p.year}-${p.month}`);
    this.loadRequisitions();
  }

  loadRequisitionPeriods(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/requisitions/periods`).subscribe({
      next: (data) => {
        this.reqPeriods.set(data || []);
        if (data && data.length > 0 && !this.reqPeriod()) {
          this.reqPeriod.set(`${data[0].year}-${data[0].month}`);
        }
        this.loadRequisitions();
      },
      error: (err) => {
        console.error('Failed to load requisition periods:', err);
        this.reqPeriods.set([]);
      }
    });
  }

  loadRequisitions(): void {
    this.reqLoading.set(true);
    const period = this.reqPeriod();
    let params = '';
    if (period) {
      const [year, month] = period.split('-');
      params = `?year=${year}&month=${month}`;
    }
    this.http.get<any[]>(`${this.apiUrl}/logistics/requisitions${params}`).subscribe({
      next: (data) => {
        this.requisitions.set(data || []);
        this.reqLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load requisitions:', err);
        this.requisitions.set([]);
        this.reqLoading.set(false);
      }
    });
    if (period) {
      const [year, month] = period.split('-');
      this.http.get<any>(`${this.apiUrl}/logistics/requisitions/summary?year=${year}&month=${month}`).subscribe({
        next: (summary) => this.reqSummary.set(summary),
        error: () => this.reqSummary.set(null)
      });
    } else {
      this.reqSummary.set(null);
    }
  }

  openRequisitionDialog(req?: any): void {
    if (req) {
      this.editingRequisition = req;
      this.requisitionForm = {
        rfNumber: req.rfNumber || '',
        date: req.date ? new Date(req.date) : null,
        paidTo: req.paidTo || '',
        cellNumber: req.cellNumber || '',
        amountEwallet: req.amountEwallet ?? null,
        dieselAmount: req.dieselAmount ?? null,
        reason: req.reason || '',
        paymentMethod: req.paymentMethod || 'E-Wallet',
        status: req.status || 'Active'
      };
    } else {
      this.editingRequisition = null;
      this.requisitionForm = {
        rfNumber: '',
        date: new Date(),
        paidTo: '',
        cellNumber: '',
        amountEwallet: null,
        dieselAmount: null,
        reason: '',
        paymentMethod: 'E-Wallet',
        status: 'Active'
      };
    }
    this.showRequisitionDialog = true;
  }

  closeRequisitionDialog(): void {
    this.showRequisitionDialog = false;
    this.editingRequisition = null;
  }

  saveRequisition(): void {
    const f = this.requisitionForm;
    const payload = {
      rfNumber: f.rfNumber || null,
      date: f.date ? new Date(f.date).toISOString() : null,
      paidTo: f.paidTo,
      cellNumber: f.cellNumber || null,
      amountEwallet: f.amountEwallet ? Number(f.amountEwallet) : 0,
      dieselAmount: f.dieselAmount ? Number(f.dieselAmount) : 0,
      reason: f.reason || null,
      paymentMethod: f.paymentMethod || 'E-Wallet',
      status: f.status || 'Active'
    };
    const req$ = this.editingRequisition
      ? this.http.put(`${this.apiUrl}/logistics/requisitions/${this.editingRequisition.id}`, payload)
      : this.http.post(`${this.apiUrl}/logistics/requisitions`, payload);
    req$.subscribe({
      next: () => {
        this.snackBar.open(this.editingRequisition ? 'Requisition updated' : 'Requisition created', 'Close', { duration: 2500 });
        this.closeRequisitionDialog();
        this.loadRequisitionPeriods();
      },
      error: (err) => {
        console.error('Failed to save requisition:', err);
        this.snackBar.open('Failed to save requisition', 'Close', { duration: 3000 });
      }
    });
  }

  deleteRequisition(req: any): void {
    if (!confirm(`Delete requisition${req.rfNumber ? ' RF ' + req.rfNumber : ''} for ${req.paidTo}?`)) return;
    this.http.delete(`${this.apiUrl}/logistics/requisitions/${req.id}`).subscribe({
      next: () => {
        this.snackBar.open('Requisition deleted', 'Close', { duration: 2500 });
        this.loadRequisitionPeriods();
      },
      error: (err) => {
        console.error('Failed to delete requisition:', err);
        this.snackBar.open('Failed to delete requisition', 'Close', { duration: 3000 });
      }
    });
  }

  /** Open a printable Rocket Freight Requisition Form in a new window. */
  printRequisition(req: any): void {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (v: any) => (v && +v > 0) ? 'R ' + (+v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const dateStr = req.date ? new Date(req.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const total = (+req.amountEwallet || 0) + (+req.dieselAmount || 0);
    const printedAt = new Date().toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cancelled = req.status === 'Cancelled';
    const templateUrl = `${window.location.origin}/logos/requisition-template.png`;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Requisition ${esc(req.rfNumber) || ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; min-height: 297mm; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #222;
    /* Company letterhead template as the page background */
    background: #fff url('${templateUrl}') no-repeat top center;
    background-size: 210mm 297mm;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    /* Leave the letterhead visible: content starts below it, footer strip stays clear */
    padding: 52mm 18mm 30mm 18mm;
  }
  .doc-title-bar { text-align: center; margin-bottom: 16px; }
  .doc-title { font-size: 17px; font-weight: 800; color: #033142; letter-spacing: 2.5px; text-transform: uppercase; }
  .rf-badge { display: inline-block; background: #033142; color: #fff; padding: 7px 20px; border-radius: 20px; font-size: 17px; font-weight: 700; margin-top: 8px; }
  .status { display: inline-block; margin-left: 10px; padding: 3px 14px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; vertical-align: middle; }
  .status.active { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
  .status.cancelled { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
  table.details { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: rgba(255,255,255,0.92); }
  table.details td { padding: 10px 14px; border: 1px solid #ccc; vertical-align: top; }
  table.details td.label { width: 32%; background: rgba(244,246,248,0.95); font-weight: 700; color: #033142; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.5px; }
  .amount-row td.value { font-size: 17px; font-weight: 700; }
  .total-row td { background: rgba(224,236,240,0.95); font-size: 18px; font-weight: 800; color: #033142; }
  .sign-row { display: table; width: 100%; margin-top: 34px; border-spacing: 18px 0; }
  .sign-box { display: table-cell; width: 33%; text-align: center; }
  .sign-line { border-bottom: 1.5px solid #333; height: 40px; margin-bottom: 6px; }
  .sign-label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.6px; }
  .print-meta { margin-top: 20px; font-size: 10.5px; color: #777; text-align: center; }
  .watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 90px; font-weight: 900; color: rgba(198,40,40,0.14); transform: rotate(-20deg); pointer-events: none; }
  @page { size: A4; margin: 0; }
  @media print { body { padding: 52mm 18mm 30mm 18mm; } }
</style>
</head>
<body>
  ${cancelled ? '<div class="watermark">CANCELLED</div>' : ''}
  <div class="doc-title-bar">
    <div class="doc-title">Requisition Form &bull; Petty Cash / E-Wallet</div>
    <span class="rf-badge">RF ${esc(req.rfNumber) || '—'}</span><span class="status ${cancelled ? 'cancelled' : 'active'}">${esc(req.status) || 'Active'}</span>
  </div>

  <table class="details">
    <tr><td class="label">Date</td><td>${esc(dateStr)}</td></tr>
    <tr><td class="label">Paid To</td><td><strong>${esc(req.paidTo) || '—'}</strong></td></tr>
    <tr><td class="label">Cell Number</td><td>${esc(req.cellNumber) || '—'}</td></tr>
    <tr><td class="label">Reason / Description</td><td>${esc(req.reason) || '—'}</td></tr>
    <tr class="amount-row"><td class="label">E-Wallet Amount</td><td class="value">${money(req.amountEwallet)}</td></tr>
    <tr class="amount-row"><td class="label">Diesel Amount</td><td class="value">${money(req.dieselAmount)}</td></tr>
    <tr class="total-row"><td class="label" style="background:#e0ecf0;">Total</td><td>${money(total)}</td></tr>
    <tr><td class="label">Department</td><td>${esc(req.department) || 'Logistics'}</td></tr>
    <tr><td class="label">Finance Status</td><td>${esc(req.financeStatus) || 'Requested'}${req.paidDate ? ' — paid ' + esc(new Date(req.paidDate).toLocaleDateString('en-ZA')) : ''}</td></tr>
    ${req.financeNotes ? `<tr><td class="label">Finance Notes</td><td>${esc(req.financeNotes)}</td></tr>` : ''}
    <tr><td class="label">Generated By</td><td><strong>${esc(req.createdByName) || '—'}</strong>${req.createdAt ? ' on ' + esc(new Date(req.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })) : ''}</td></tr>
  </table>

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Requested By</div></div>
    <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Authorised By</div></div>
    <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Received By</div></div>
  </div>

  <div class="print-meta">
    Requisition ${esc(req.rfNumber) || ''}${req.createdByName ? ' &bull; Generated by ' + esc(req.createdByName) : ''} &bull; Printed ${esc(printedAt)} from the Promed Technologies Intranet
  </div>
  <script>
    // Wait for the letterhead template to load before opening the print dialog.
    var bg = new Image();
    bg.onload = function(){ setTimeout(function(){ window.print(); }, 200); };
    bg.onerror = function(){ setTimeout(function(){ window.print(); }, 200); };
    bg.src = '${templateUrl}';
  </scr` + `ipt>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      this.snackBar.open('Pop-up blocked — allow pop-ups to print', 'Close', { duration: 4000 });
    }
  }

  /** Export a single requisition to Excel. */
  exportRequisitionExcel(req: any): void {
    this.exportRequisitionsToExcel([req], `Requisition-${req.rfNumber || req.id}.xlsx`);
  }

  /** Export the currently filtered requisitions list to Excel. */
  exportAllRequisitionsExcel(): void {
    const rows = this.filteredRequisitions();
    if (!rows.length) { this.snackBar.open('No requisitions to export', 'Close', { duration: 3000 }); return; }
    const period = this.reqPeriod() ? String(this.reqPeriod()).replace('/', '-') : 'all';
    this.exportRequisitionsToExcel(rows, `Requisitions-${period}.xlsx`);
  }

  private async exportRequisitionsToExcel(rows: any[], fileName: string): Promise<void> {
    const XLSX = await import('xlsx');
    const data = rows.map(r => ({
      'RF #': r.rfNumber || '',
      'Date': r.date ? new Date(r.date).toLocaleDateString('en-ZA') : '',
      'Paid To': r.paidTo || '',
      'Cell Number': r.cellNumber || '',
      'E-Wallet (R)': +r.amountEwallet || 0,
      'Diesel (R)': +r.dieselAmount || 0,
      'Total (R)': (+r.amountEwallet || 0) + (+r.dieselAmount || 0),
      'Reason': r.reason || '',
      'Status': r.status || '',
      'Finance Status': r.financeStatus || '',
      'Payment Method': r.paymentMethod || '',
      'Period': `${r.periodYear || ''}-${String(r.periodMonth || '').padStart(2, '0')}`,
      'Generated By': r.createdByName || '',
      'Created At': r.createdAt ? new Date(r.createdAt).toLocaleString('en-ZA') : ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    // Column widths for readability
    ws['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 9 },
      { wch: 22 }, { wch: 18 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requisitions');
    XLSX.writeFile(wb, fileName);
    this.snackBar.open(`Exported ${rows.length} requisition${rows.length === 1 ? '' : 's'} to Excel`, 'Close', { duration: 3000 });
  }

  // ─── Sleep Out Methods ─────────────────────────────────────────

  loadSleepOuts(): void {
    this.sleepOutLoading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/logistics/sleepouts`).subscribe({
      next: (data) => {
        this.sleepOuts.set(data);
        this.sleepOutLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load sleep outs:', err);
        this.sleepOuts.set([]);
        this.sleepOutLoading.set(false);
      }
    });
    // Also load summary
    this.http.get<any>(`${this.apiUrl}/logistics/sleepouts/summary`).subscribe({
      next: (summary) => this.sleepOutSummary.set(summary),
      error: () => {}
    });
  }

  openSleepOutDialog(sleepOut?: any): void {
    if (sleepOut) {
      this.editingSleepOut = sleepOut;
      this.sleepOutForm = {
        tripSheetId: sleepOut.tripSheetId,
        driverId: sleepOut.driverId,
        driverName: sleepOut.driverName || '',
        vehicleReg: sleepOut.vehicleReg || '',
        tripNumber: sleepOut.tripNumber || '',
        amount: sleepOut.amount,
        date: new Date(sleepOut.date),
        reason: sleepOut.reason || '',
        notes: sleepOut.notes || ''
      };
    } else {
      this.editingSleepOut = null;
      this.sleepOutForm = {
        tripSheetId: null,
        driverId: null,
        driverName: '',
        vehicleReg: '',
        tripNumber: '',
        amount: null,
        date: new Date(),
        reason: '',
        notes: ''
      };
    }
    this.showSleepOutDialog = true;
  }

  closeSleepOutDialog(): void {
    this.showSleepOutDialog = false;
    this.editingSleepOut = null;
    this.sleepOutForm = {
      tripSheetId: null,
      driverId: null,
      driverName: '',
      vehicleReg: '',
      tripNumber: '',
      amount: null,
      date: new Date(),
      reason: '',
      notes: ''
    };
  }

  onSleepOutTripsheetChange(tripSheetId: number): void {
    const trip = this.tripsheets().find(t => (t.loadId || t.id) === tripSheetId);
    if (trip) {
      const vehicleReg = trip.vehicleReg || trip.vehicleRegNumber || trip.vehicleRegistration || '';
      const tripNumber = trip.tripNumber || trip.loadNumber || '';
      const tripDate = trip.date || trip.tripDate;
      // Replace entire object to ensure Angular change detection fires
      this.sleepOutForm = {
        ...this.sleepOutForm,
        tripSheetId: tripSheetId,
        driverId: trip.driverId || null,
        driverName: trip.driverName || '',
        vehicleReg: vehicleReg,
        tripNumber: tripNumber,
        date: tripDate ? new Date(tripDate) : new Date()
      };
    }
  }

  editSleepOut(row: any): void {
    this.openSleepOutDialog(row);
  }

  saveSleepOut(): void {
    if (!this.sleepOutForm.driverId || !this.sleepOutForm.amount) {
      this.snackBar.open('Please select a tripsheet and enter an amount', 'Close', { duration: 3000 });
      return;
    }

    const payload: any = {
      driverId: this.sleepOutForm.driverId,
      amount: this.sleepOutForm.amount,
      date: this.sleepOutForm.date,
      reason: this.sleepOutForm.reason || null,
      notes: this.sleepOutForm.notes || null,
      tripSheetId: this.sleepOutForm.tripSheetId,
      tripNumber: this.sleepOutForm.tripNumber,
      vehicleReg: this.sleepOutForm.vehicleReg
    };

    if (this.editingSleepOut) {
      this.http.put(`${this.apiUrl}/logistics/sleepouts/${this.editingSleepOut.id}`, payload).subscribe({
        next: () => {
          this.snackBar.open('Sleep out updated', 'Close', { duration: 3000 });
          this.closeSleepOutDialog();
          this.loadSleepOuts();
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || 'Failed to update sleep out', 'Close', { duration: 3000 });
        }
      });
    } else {
      this.http.post(`${this.apiUrl}/logistics/sleepouts`, payload).subscribe({
        next: () => {
          this.snackBar.open('Sleep out request submitted', 'Close', { duration: 3000 });
          this.closeSleepOutDialog();
          this.loadSleepOuts();
        },
        error: (err) => {
          this.snackBar.open(err.error?.error || 'Failed to create sleep out', 'Close', { duration: 3000 });
        }
      });
    }
  }

  approveSleepOut(row: any, approved: boolean): void {
    const action = approved ? 'approve' : 'reject';
    if (!confirm(`Are you sure you want to ${action} this sleep out for ${row.driverName}?`)) return;

    this.http.post(`${this.apiUrl}/logistics/sleepouts/${row.id}/approve`, { approved, notes: '' }).subscribe({
      next: () => {
        this.snackBar.open(`Sleep out ${approved ? 'approved' : 'rejected'}`, 'Close', { duration: 3000 });
        this.loadSleepOuts();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || `Failed to ${action} sleep out`, 'Close', { duration: 3000 });
      }
    });
  }

  markSleepOutPaid(row: any): void {
    if (!confirm(`Mark sleep out for ${row.driverName} (R${row.amount}) as paid?`)) return;

    this.http.post(`${this.apiUrl}/logistics/sleepouts/${row.id}/mark-paid`, {}).subscribe({
      next: () => {
        this.snackBar.open('Sleep out marked as paid', 'Close', { duration: 3000 });
        this.loadSleepOuts();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to mark as paid', 'Close', { duration: 3000 });
      }
    });
  }

  deleteSleepOut(row: any): void {
    if (!confirm(`Delete sleep out request for ${row.driverName}?`)) return;

    this.http.delete(`${this.apiUrl}/logistics/sleepouts/${row.id}`).subscribe({
      next: () => {
        this.snackBar.open('Sleep out deleted', 'Close', { duration: 3000 });
        this.loadSleepOuts();
      },
      error: (err) => {
        this.snackBar.open(err.error?.error || 'Failed to delete sleep out', 'Close', { duration: 3000 });
      }
    });
  }

  downloadSleepOutPdf(row: any): void {
    this.http.get(`${this.apiUrl}/logistics/sleepouts/${row.id}/pdf`, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SleepOut_${row.id}_${(row.driverName || 'Driver').replace(/\s+/g, '_')}_${new Date(row.date).toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.snackBar.open('PDF downloaded', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open('Failed to download PDF', 'Close', { duration: 3000 });
      }
    });
  }

  // ─── POD Documents Methods ───────────────────────────────────────

  loadPodDocuments(): void {
    this.podLoading = true;
    let params = `?page=${this.podCurrentPage}&pageSize=${this.podPageSize}`;
    
    if (this.podRegionFilter) params += `&region=${this.podRegionFilter}`;
    if (this.podDriverFilter) params += `&driverName=${encodeURIComponent(this.podDriverFilter)}`;
    if (this.podLinkFilter) params += `&linkStatus=${this.podLinkFilter}`;
    
    if (this.podMonthFilter) {
      const [m, y] = this.podMonthFilter.split('-');
      params += `&month=${m}&year=${y}`;
    }

    this.http.get<any>(`${this.apiUrl}/PodDocuments${params}`).subscribe({
      next: (res) => {
        this.podDocuments = res.data || [];
        this.podTotalCount = res.total || 0;
        this.podLoading = false;
      },
      error: (err) => {
        console.error('Failed to load POD documents:', err);
        this.podDocuments = [];
        this.podLoading = false;
      }
    });
  }

  loadPodSummary(): void {
    this.http.get<any>(`${this.apiUrl}/PodDocuments/summary`).subscribe({
      next: (summary) => {
        this.podSummary = summary;
        // Build driver list for filter
        this.podDriverList = (summary.drivers || []).map((d: any) => d.driverName).sort();
      },
      error: (err) => console.error('Failed to load POD summary:', err)
    });
  }

  reconcilePodTripsheets(): void {
    this.podReconciling = true;
    this.http.post<any>(`${this.apiUrl}/PodDocuments/reconcile-tripsheets`, {}).subscribe({
      next: (res) => {
        this.podReconciling = false;
        const linked = res?.podsLinked ?? 0;
        const examined = res?.podsExamined ?? 0;
        this.snackBar.open(
          res?.message || `Linked ${linked} POD(s) to tripsheets (examined ${examined})`,
          'Close',
          { duration: 6000 }
        );
        this.loadPodDocuments();
        this.loadPodSummary();
      },
      error: (err) => {
        this.podReconciling = false;
        console.error('Failed to reconcile PODs to tripsheets:', err);
        this.snackBar.open('Failed to reconcile PODs to tripsheets', 'Close', { duration: 5000 });
      }
    });
  }

  viewPodDocument(pod: any): void {
    this.http.get(`${this.apiUrl}/PodDocuments/${pod.id}/view`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const contentType = pod.contentType || 'application/pdf';
        const file = new Blob([blob], { type: contentType });
        const url = window.URL.createObjectURL(file);
        window.open(url, '_blank');
      },
      error: (err) => {
        console.error('Failed to view POD:', err);
        this.snackBar.open('Failed to open POD document', 'Close', { duration: 3000 });
      }
    });
  }

  // Preview the tripsheet a POD is linked to — opens the standard Rocket Freight
  // printable tripsheet (same rendering used by Print/Download) in a new tab.
  previewTripsheetFromPod(pod: any): void {
    const loadId = pod?.loadId;
    if (!loadId) {
      this.snackBar.open('This POD is not linked to a tripsheet', 'Close', { duration: 3000 });
      return;
    }
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(html);
          previewWindow.document.close();
        }
      },
      error: (err) => {
        console.error('Failed to load tripsheet preview:', err);
        this.snackBar.open('Failed to load tripsheet', 'Close', { duration: 3000 });
      }
    });
  }

  // Show all invoice numbers linked to a POD in a dialog
  openPodInvoicesDialog(pod: any): void {
    this.dialog.open(LogisticsPodInvoicesDialog, {
      width: '480px',
      maxWidth: '95vw',
      data: { pod }
    });
  }

  downloadPodDocument(pod: any): void {
    this.http.get(`${this.apiUrl}/PodDocuments/${pod.id}/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pod.originalFileName || pod.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: (err) => {
        console.error('Failed to download POD:', err);
        this.snackBar.open('Failed to download POD', 'Close', { duration: 3000 });
      }
    });
  }

  loadDeliveredWithoutPod(): void {
    this.noPodLoading = true;
    this.http.get<{ count: number; deliveredTotal: number; totalValue: number; items: DeliveredWithoutPodRow[] }>(`${this.apiUrl}/logistics/loads/delivered-without-pod`).subscribe({
      next: res => {
        this.noPodLoads = res?.items || [];
        this.noPodTotalValue = res?.totalValue || 0;
        this.noPodDeliveredTotal = res?.deliveredTotal || 0;
        this.noPodLoading = false;
      },
      error: () => { this.noPodLoading = false; }
    });
  }

  get noPodVisible(): DeliveredWithoutPodRow[] {
    return this.noPodMinDays > 0 ? this.noPodLoads.filter(r => r.daysOutstanding >= this.noPodMinDays) : this.noPodLoads;
  }

  noPodAgeClass(days: number): string {
    return days > 30 ? 'age-critical' : days > 14 ? 'age-warn' : 'age-ok';
  }

  /** Upload a POD pre-targeted at this load, then refresh the backlog. */
  uploadPodForLoad(row: DeliveredWithoutPodRow): void {
    const dialogRef = this.dialog.open(UploadPodDocumentDialog, {
      width: '600px',
      maxWidth: '95vw',
      data: {
        drivers: this.podDriverList,
        loadId: row.loadId,
        loadNumber: row.loadNumber,
        invoiceNumbers: row.missingInvoices,
        driverName: row.driverName || '',
        deliveryDate: row.deliveredAt
      }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result?.uploaded) {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.loadDeliveredWithoutPod();
        this.snackBar.open(`POD uploaded for ${row.loadNumber}`, 'Close', { duration: 3000 });
      }
    });
  }

  openPodUploadDialog(): void {
    const dialogRef = this.dialog.open(UploadPodDocumentDialog, {
      width: '600px',
      maxWidth: '95vw',
      data: { drivers: this.podDriverList }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.uploaded) {
        this.loadPodDocuments();
        this.loadPodSummary();
        const linked = result.linkedInvoiceCount ?? 0;
        const msg = linked > 0
          ? `POD uploaded — Welly linked ${linked} invoice${linked === 1 ? '' : 's'}${result.loadNumber ? ' → tripsheet ' + result.loadNumber : ''}`
          : 'POD uploaded successfully!';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }

  formatPodFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  openLinkTripsheetDialog(pod: any): void {
    const dialogRef = this.dialog.open(LinkTripsheetDialog, {
      width: '550px',
      maxWidth: '95vw',
      data: { pod }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.linked) {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.snackBar.open(`POD linked to ${result.loadNumber}`, 'Close', { duration: 3000 });
      }
    });
  }

  delinkPod(pod: any): void {
    if (!confirm(`Delink this POD from tripsheet ${pod.loadNumber || ''}?`)) return;

    this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/delink`, {}).subscribe({
      next: () => {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.snackBar.open('POD delinked from tripsheet', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to delink POD:', err);
        this.snackBar.open('Failed to delink POD', 'Close', { duration: 3000 });
      }
    });
  }

  openLinkInvoiceDialog(pod: any): void {
    const dialogRef = this.dialog.open(LinkInvoiceDialog, {
      width: '760px',
      maxWidth: '95vw',
      data: { pod }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.linked) {
        this.loadPodDocuments();
        this.loadPodSummary();
        const count = result.linkedInvoiceCount || (result.invoiceNumbers?.length ?? 0) || 1;
        this.snackBar.open(`POD linked to ${count} invoice(s) → Status set to Delivered`, 'Close', { duration: 4500 });
      }
    });
  }

  delinkInvoice(pod: any): void {
    const linkedCount = pod.invoiceLinks?.length || (pod.invoiceId ? 1 : 0);
    if (!confirm(`Delink this POD from ${linkedCount} invoice(s)? Invoice status will revert to Pending only where not linked by another POD.`)) return;

    this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/delink-invoice`, {}).subscribe({
      next: () => {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.snackBar.open('POD delinked from invoices', 'Close', { duration: 4000 });
      },
      error: (err) => {
        console.error('Failed to delink invoice:', err);
        this.snackBar.open('Failed to delink from invoice', 'Close', { duration: 3000 });
      }
    });
  }

  openEditPodDialog(pod: any): void {
    const dialogRef = this.dialog.open(EditPodDialog, {
      width: '550px',
      maxWidth: '95vw',
      data: { pod, drivers: this.podDriverList }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.updated) {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.snackBar.open('POD details updated', 'Close', { duration: 3000 });
      }
    });
  }

  // TFN Orders Methods
  loadTfnOrders(): void {
    this.http.get<any[]>(`${environment.apiUrl}/logistics/tfn/orders`).subscribe({
      next: (orders) => {
        this.tfnOrders.set(orders);
        this.tfnOrdersCount.set(orders.length);
      },
      error: (err) => {
        console.error('Failed to load TFN orders:', err);
        this.tfnOrders.set([]);
        this.tfnOrdersCount.set(0);
      }
    });
  }

  openTfnOrdersDialog(): void {
    const dialogRef = this.dialog.open(TfnOrdersListDialog, {
      width: '95vw',
      maxWidth: '1400px',
      maxHeight: '90vh',
      panelClass: 'tfn-orders-dialog-panel',
      data: { orders: this.tfnOrders(), apiUrl: environment.apiUrl }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'refresh') {
        this.loadTfnOrders();
      }
    });
  }

  // Puma Garage Methods
  loadPumaOrders(): void {
    this.http.get<any[]>(`${environment.apiUrl}/logistics/pumagarageorders`).subscribe({
      next: (orders) => {
        this.pumaOrders.set(orders);
        this.pumaOrdersCount.set(orders.length);
      },
      error: (err) => {
        console.error('Failed to load Puma Garage orders:', err);
        this.pumaOrders.set([]);
        this.pumaOrdersCount.set(0);
      }
    });
  }

  openPumaGarageDialog(): void {
    const dialogRef = this.dialog.open(PumaGarageDialog, {
      width: '95vw',
      maxWidth: '1400px',
      maxHeight: '90vh',
      panelClass: 'puma-garage-dialog-panel',
      data: { orders: this.pumaOrders(), apiUrl: environment.apiUrl }
    });

    dialogRef.afterClosed().subscribe(() => {
      this.loadPumaOrders();
    });
  }
  loadTfnDepots(): void {
    this.http.get<any[]>(`${environment.apiUrl}/logistics/tfn/depots`).subscribe({
      next: (depots) => {
        this.tfnDepots.set(depots);
        this.tfnDepotsCount.set(depots.length);
      },
      error: (err) => {
        console.error('Failed to load TFN depots:', err);
        this.tfnDepots.set([]);
        this.tfnDepotsCount.set(0);
      }
    });
  }

  openDepotsMapDialog(): void {
    this.dialog.open(TfnDepotsMapDialog, {
      width: '95vw',
      maxWidth: '1600px',
      height: '90vh',
      panelClass: 'tfn-depots-map-dialog-panel',
      data: { depots: this.tfnDepots(), warehouses: this.warehouses() }
    });
  }

  openDriversDialog(): void {
    import('./drivers-dialog/drivers-dialog.component').then(m => {
      this.dialog.open(m.DriversDialogComponent, {
        width: '900px',
        maxWidth: '95vw',
        height: 'auto',
        maxHeight: '90vh'
      });
    });
  }

  openVehiclesDialog(): void {
    this.dialog.open(VehicleStatusDialog, {
      width: '750px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        vehicles: this.vehicles()
      }
    });
  }

  availableReportsCount = computed(() => 12); // Total available reports

  openReportsDialog(): void {
    this.dialog.open(LogisticsReportsDialog, {
      width: '1200px',
      maxWidth: '95vw',
      height: '90vh',
      panelClass: 'reports-dialog-panel'
    });
  }

  // Part Delivered Tracking Methods
  // Completed Tripsheets Methods
  loadCompletedTripsheets(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/loads?status=Delivered`).subscribe({
      next: (loads) => {
        this.completedTripsheets.set(loads.map(load => ({
          id: load.id,
          loadNumber: load.loadNumber,
          customerName: load.customerName || load.customer?.name || load.stops?.[0]?.companyName || 'Unknown',
          driverName: load.driverName || (load.driver ? `${load.driver.firstName || ''} ${load.driver.lastName || ''}`.trim() : null) || 'Not Assigned',
          vehicleReg: load.vehicleRegistration || load.vehicle?.registrationNumber || 'Not Assigned',
          completedDate: load.actualDeliveryDate || load.updatedAt,
          date: load.actualDeliveryDate || load.updatedAt, // For color coding
          totalStops: load.stops?.length || 0,
          totalDistance: load.estimatedDistance || 0,
          hasPOD: !!load.proofOfDelivery || !!load.podFilePath,
          podFilePath: load.podFilePath || load.proofOfDelivery?.filePath
        })));
      },
      error: (err) => {
        console.error('Failed to load completed tripsheets:', err);
      }
    });
  }

  filteredCompletedTripsheets = computed(() => {
    let trips = this.completedTripsheets();
    
    // Apply search filter
    if (this.completedSearch) {
      const search = this.completedSearch.toLowerCase();
      trips = trips.filter(t => 
        t.loadNumber?.toLowerCase().includes(search) ||
        t.customerName?.toLowerCase().includes(search) ||
        t.driverName?.toLowerCase().includes(search) ||
        t.vehicleReg?.toLowerCase().includes(search)
      );
    }
    
    // Apply date filter
    if (this.completedDateFilter) {
      const filterDate = new Date(this.completedDateFilter);
      filterDate.setHours(0, 0, 0, 0);
      trips = trips.filter(t => {
        if (!t.completedDate) return false;
        const tripDate = new Date(t.completedDate);
        tripDate.setHours(0, 0, 0, 0);
        return tripDate.getTime() === filterDate.getTime();
      });
    }
    
    // Sort: Missing POD first (red), then with POD (green)
    trips = [...trips].sort((a, b) => {
      // Missing POD (!hasPOD) should come first
      if (!a.hasPOD && b.hasPOD) return -1;
      if (a.hasPOD && !b.hasPOD) return 1;
      // Within same POD status, sort by completed date (most recent first)
      const dateA = a.completedDate ? new Date(a.completedDate).getTime() : 0;
      const dateB = b.completedDate ? new Date(b.completedDate).getTime() : 0;
      return dateB - dateA;
    });
    
    return trips;
  });

  getCompletedStats = computed(() => {
    const trips = this.completedTripsheets();
    const withPOD = trips.filter(t => t.hasPOD).length;
    const missingPOD = trips.length - withPOD;
    const totalDistance = trips.reduce((sum, t) => sum + (t.totalDistance || 0), 0);
    
    return {
      total: trips.length,
      withPOD,
      missingPOD,
      totalDistance
    };
  });

  filterCompleted(): void {
    // Trigger recomputation of filteredCompletedTripsheets
    this.completedTripsheets.set([...this.completedTripsheets()]);
  }

  uploadPOD(trip: any): void {
    const dialogRef = this.dialog.open(UploadPODDialog, {
      width: '600px',
      maxWidth: '95vw',
      data: { 
        trip,
        loadId: trip.id,
        loadNumber: trip.loadNumber
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.uploaded) {
        this.loadCompletedTripsheets();
        this.snackBar.open('POD uploaded successfully!', 'Close', { duration: 3000 });
      }
    });
  }

  viewPOD(trip: any): void {
    if (!trip.podFilePath) {
      this.snackBar.open('No POD file available', 'Close', { duration: 3000 });
      return;
    }

    // Open POD in new window/tab
    const podUrl = `${this.apiUrl}/logistics/loads/${trip.id}/pod`;
    window.open(podUrl, '_blank');
  }

  downloadPOD(trip: any): void {
    if (!trip.podFilePath) {
      this.snackBar.open('No POD file available', 'Close', { duration: 3000 });
      return;
    }

    // Download POD file
    this.http.get(`${this.apiUrl}/logistics/loads/${trip.id}/pod/download`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `POD_${trip.loadNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: (err) => {
        console.error('Failed to download POD:', err);
        this.snackBar.open('Failed to download POD', 'Close', { duration: 3000 });
      }
    });
  }
}

// Upload POD Dialog Component

// Backward-compatible re-exports: other modules (e.g. sales-dashboard)
// historically imported dialogs and models from this file.
export * from './logistics-dashboard-dialogs.component';
export * from './logistics.models';
