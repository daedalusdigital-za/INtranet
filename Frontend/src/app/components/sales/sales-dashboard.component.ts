import { Component, OnInit, DoCheck, OnDestroy, inject, signal, computed, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute, NavigationEnd, Params } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SalesImportDialogComponent, SalesImportDialogData, SalesImportDialogResult } from '../shared/sales-import-dialog/sales-import-dialog.component';
import { ImportTripsheetDialog, CreateTripsheetDialog, EditPodDialog, UploadPodDocumentDialog } from '../logistics/logistics-dashboard.component';
import { environment } from '../../../environments/environment';
import { WellyActivityService } from '../../services/welly-activity.service';
import { PROMED_BACK_ORDERS, ACCESS_BACK_ORDERS, PHARMATECH_BACK_ORDERS, SEBENZANI_BACK_ORDERS, BackOrderItem } from './back-orders-data';
import { TENDER_PRICE_ITEMS, TenderPriceItem } from './tender-pricing-data';
import * as XLSX from 'xlsx';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ToastService } from '../../ui/toast.service';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SubNavComponent } from '../../ui/sub-nav/sub-nav.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { ChipTone, StatusChipComponent } from '../../ui/status-chip/status-chip.component';
import { formatDay, isFilterRecord, parseDay, queryText, recordFilters, toQuery } from '../../ui/sub-pages';
import { SALES_SECTIONS, SalesSlug, salesSection } from './sales-sections';

// Company definitions
import { COMPANIES, Company, SalesHistoryRow, SalesHistoryLine, SalesHistoryReconcile, CompanySales, Customer, SalesTripSheetLine, SalesTripSheet, Invoice, Order, IncomingOrderEmail, SalesStats } from './sales.models';
import { PodInvoicesDialog, EmailDetailDialogComponent } from './sales-dashboard-dialogs.component';
import { UnmappedProductsDialog, BackOrderStockInfo } from './unmapped-products-dialog.component';
import { BackOrderStockDialog } from './back-order-stock-dialog.component';


@Component({
  selector: 'app-sales-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatTabsModule,
    MatDividerModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    NavbarComponent,
    PageHeaderComponent,
    SubNavComponent,
    SkeletonRowsComponent,
    EmptyStateComponent,
    StatusChipComponent
  ],
  templateUrl: './sales-dashboard.component.html',
  styleUrls: ['./sales-dashboard.component.scss']
})
export class SalesDashboardComponent implements OnInit, DoCheck, OnDestroy {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private wellyActivity = inject(WellyActivityService);
  private auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmService);
  private apiUrl = environment.apiUrl;

  // Companies
  companies = COMPANIES;

  // ---------- Sub-pages with their own addresses (design review D-12) ----------
  // /sales/<section>?<filters> picks the sub-page and its filters. Moving between sub-pages adds
  // to the browser history, so Back works; changing a filter replaces the current entry instead.

  readonly sections = SALES_SECTIONS;
  readonly section = signal<SalesSlug>('orders');
  readonly currentSection = computed(() => salesSection(this.section()));
  /** Each sub-page's filters as last used, so its link in the sub-navigation brings them back. */
  readonly sectionQuery = signal<Partial<Record<SalesSlug, Params>>>({});

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly subscriptions = new Subscription();
  private readonly filterWrites = new Subject<void>();
  private lastFilterKey = '';

  /** One line of context under the page title. */
  sectionSubtitle(): string {
    return this.section() === 'orders'
      ? 'Customers, invoices and orders for all four companies'
      : this.currentSection()?.hint ?? '';
  }

  /** Counts after the sub-page links, as the tabs had. */
  sectionCounts(): Partial<Record<SalesSlug, number>> {
    return {
      orders: this.stats().incomingOrders,
      history: this.salesHistoryTotalCount(),
      'back-orders': this.backOrderTotalCount(),
      pods: this.podTotalCount
    };
  }

  /** POD filters reload the list from the first page. */
  podFilterChanged(): void {
    this.podCurrentPage = 1;
    this.loadPodDocuments();
  }

  /** Filters change from many fields and buttons, so look for a change once per check and follow it in the address. */
  ngDoCheck(): void {
    const key = JSON.stringify(this.currentQuery(this.section()));
    if (key !== this.lastFilterKey) {
      this.lastFilterKey = key;
      this.filterWrites.next();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Reads the sub-page and its filters from the address. Runs after every navigation. */
  private applyUrl(): void {
    const section = salesSection(this.route.snapshot.firstChild?.paramMap.get('section'));
    if (!section) {
      // An old or mistyped address: open Sales where it normally opens rather than an empty page.
      this.router.navigate(['/sales', SALES_SECTIONS[0].slug], { replaceUrl: true });
      return;
    }
    this.section.set(section.slug);
    const query = this.route.snapshot.queryParams;
    if (!isFilterRecord(this.router)) {
      this.applyFilters(section.slug, query);
    }
    this.sectionQuery.update(all => ({ ...all, [section.slug]: query }));
    this.onSectionShown(section.slug);
  }

  /** Sets a sub-page's filters from the address. Filters missing from it go back to their defaults. */
  private applyFilters(slug: SalesSlug, q: Params): void {
    const text = (key: string): string => queryText(q, key);
    switch (slug) {
      case 'orders':
        this.emailFilterSearch.set(text('q'));
        this.emailReadFilter.set(text('read') || 'all');
        break;
      case 'customers': {
        const before = this.customerSearch() + '|' + this.customerProvinceFilter();
        this.customerSearch.set(text('q'));
        this.customerProvinceFilter.set(text('province') || 'all');
        if (this.customerSearch() + '|' + this.customerProvinceFilter() !== before) this.customerPageIndex.set(0);
        break;
      }
      case 'invoices': {
        const before = this.invoiceSearch() + '|' + this.invoiceStatusFilter();
        this.invoiceSearch.set(text('q'));
        this.invoiceStatusFilter.set(text('status') || 'all');
        if (this.invoiceSearch() + '|' + this.invoiceStatusFilter() !== before) this.invoicePageIndex.set(0);
        break;
      }
      case 'history': {
        const before = JSON.stringify(this.currentQuery('history'));
        this.salesHistorySearch.set(text('q'));
        this.salesHistoryCompany.set(text('company'));
        this.salesHistoryDetailedOnly.set(text('detailed') === '1');
        this.salesHistoryFromDate = parseDay(text('from'));
        this.salesHistoryToDate = parseDay(text('to'));
        // Before the first visit, onSectionShown() loads the history with these filters.
        if (JSON.stringify(this.currentQuery('history')) !== before && this.salesHistoryLoaded) {
          this.salesHistoryPageIndex.set(0);
          this.loadSalesHistory();
        }
        break;
      }
      case 'back-orders': {
        const stock = text('stock');
        this.backOrderSearch.set(text('q'));
        this.backOrderStockFilter.set(stock === 'full' || stock === 'partial' || stock === 'none' || stock === 'unmapped' ? stock : '');
        break;
      }
      case 'pods': {
        const next = [text('region'), text('month'), text('driver'), text('link')];
        const now = [this.podRegionFilter, this.podMonthFilter, this.podDriverFilter, this.podLinkFilter];
        if (next.join('|') !== now.join('|')) {
          [this.podRegionFilter, this.podMonthFilter, this.podDriverFilter, this.podLinkFilter] = next;
          this.podFilterChanged();
        }
        break;
      }
      case 'trip-sheets':
        this.logisticsTripsheetSearch.set(text('q'));
        break;
      case 'tender-pricing':
        this.tenderNoFilter.set(text('tender') || 'all');
        this.tenderSearch.set(text('q'));
        break;
    }
  }

  /** A sub-page's filters as address parameters, leaving out the defaults. */
  private currentQuery(slug: SalesSlug): Params {
    switch (slug) {
      case 'orders':
        return toQuery({ q: this.emailFilterSearch(), read: this.emailReadFilter() }, { read: 'all' });
      case 'customers':
        return toQuery({ q: this.customerSearch(), province: this.customerProvinceFilter() }, { province: 'all' });
      case 'invoices':
        return toQuery({ q: this.invoiceSearch(), status: this.invoiceStatusFilter() }, { status: 'all' });
      case 'history':
        return toQuery({
          q: this.salesHistorySearch(), company: this.salesHistoryCompany(), detailed: this.salesHistoryDetailedOnly() ? '1' : null,
          from: formatDay(this.salesHistoryFromDate), to: formatDay(this.salesHistoryToDate)
        });
      case 'back-orders':
        return toQuery({ q: this.backOrderSearch(), stock: this.backOrderStockFilter() });
      case 'pods':
        return toQuery({ region: this.podRegionFilter, month: this.podMonthFilter, driver: this.podDriverFilter, link: this.podLinkFilter });
      case 'trip-sheets':
        return toQuery({ q: this.logisticsTripsheetSearch() });
      case 'tender-pricing':
        return toQuery({ tender: this.tenderNoFilter(), q: this.tenderSearch() }, { tender: 'all' });
    }
  }

  private writeFilters(): void {
    const slug = this.section();
    const query = this.currentQuery(slug);
    this.sectionQuery.update(all => ({ ...all, [slug]: query }));
    recordFilters(this.router, this.route, query);
  }


  // ── Tender Pricing tab state ─────────────────────────────────────────────
  tenderItems: TenderPriceItem[] = TENDER_PRICE_ITEMS;
  tenderSearch = signal<string>('');
  tenderCompanyFilter = signal<string>('all');
  tenderNoFilter = signal<string>('all');
  tenderCompanies = [...new Set(TENDER_PRICE_ITEMS.map(i => i.company))];
  tenderNumbers = computed(() => {
    const c = this.tenderCompanyFilter();
    const src = c === 'all' ? this.tenderItems : this.tenderItems.filter(i => i.company === c);
    return [...new Set(src.map(i => i.tenderNo))];
  });
  filteredTenderItems = computed(() => {
    const c = this.tenderCompanyFilter();
    const t = this.tenderNoFilter();
    const q = this.tenderSearch().trim().toLowerCase();
    return this.tenderItems.filter(i =>
      (c === 'all' || i.company === c) &&
      (t === 'all' || i.tenderNo === t) &&
      (!q || i.itemNo.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.tenderNo.toLowerCase().includes(q) || i.uom.toLowerCase().includes(q)));
  });
  tenderStats = computed(() => {
    const rows = this.filteredTenderItems();
    return { items: rows.length, tenders: new Set(rows.map(r => r.tenderNo)).size, companies: new Set(rows.map(r => r.company)).size };
  });

  setTenderCompany(c: string): void {
    this.tenderCompanyFilter.set(c);
    this.tenderNoFilter.set('all');
  }

  exportTenderPricing(): void {
    const rows = this.filteredTenderItems().map(i => ({
      'Company': i.company, 'Tender No.': i.tenderNo, 'Item No.': i.itemNo,
      'Item Description': i.description, 'UOM / Pack Size': i.uom, 'Price (R, incl. 15% VAT)': i.price,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 70 }, { wch: 20 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tender Pricing');
    XLSX.writeFile(wb, `Tender_Pricing_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Sales History tab state ──────────────────────────────────────────────
  salesHistoryRecords = signal<SalesHistoryRow[]>([]);
  salesHistoryLoading = signal<boolean>(false);
  salesHistorySearch = signal<string>('');
  salesHistoryCompany = signal<string>('');
  salesHistoryDetailedOnly = signal<boolean>(false);
  salesHistoryFromDate: Date | null = null;
  salesHistoryToDate: Date | null = null;
  salesHistoryTotalCount = signal<number>(0);
  salesHistoryTotalAmount = signal<number>(0);
  salesHistoryTotalGrossProfit = signal<number>(0);
  salesHistoryAvgMargin = signal<number | null>(null);
  salesHistoryDetailedCount = signal<number>(0);
  salesHistoryCustomerCount = signal<number>(0);
  salesHistoryInvoiceCount = signal<number>(0);
  salesHistoryDateMin = signal<string | null>(null);
  salesHistoryDateMax = signal<string | null>(null);
  salesHistoryPageIndex = signal<number>(0);
  salesHistoryPageSize = signal<number>(50);
  salesHistoryLoaded = false;
  salesHistoryReconcile = signal<SalesHistoryReconcile | null>(null);
  salesHistoryExpandedId = signal<number | null>(null);
  salesHistoryLines = signal<SalesHistoryLine[]>([]);
  salesHistoryLinesLoading = signal<boolean>(false);
  private salesHistorySearchTimer: any = null;

  salesHistoryDateRangeLabel = computed(() => {
    const min = this.salesHistoryDateMin();
    const max = this.salesHistoryDateMax();
    if (!min || !max) return '—';
    const fmt = (s: string) => new Date(s).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' });
    return `${fmt(min)} → ${fmt(max)}`;
  });

  // Data signals
  customers = signal<Customer[]>([]);
  invoices = signal<Invoice[]>([]);

  // ── Sales Trip Sheets tab state ──────────────────────────────────────────
  salesTripSheets = signal<SalesTripSheet[]>([]);
  loadingTripSheets = signal(false);
  tripSheetsLoaded = false;
  tripSheetStatusFilter = signal<string>('all');

  // Logistics tripsheets (Loads) — the same list Logistics sees
  logisticsTripsheets = signal<any[]>([]);
  loadingLogisticsTripsheets = signal(false);
  logisticsTripsheetSearch = signal('');
  // Create/edit dialog state
  showTripSheetDialog = false;
  editingTripSheetId: number | null = null;
  tripSheetMode: 'signoff' | 'choose' | 'manual' | 'import' = 'signoff';
  tripSheetForm: { warehouseCode: string; routeArea: string; scheduledDate: string; notes: string } = {
    warehouseCode: '', routeArea: '', scheduledDate: '', notes: ''
  };
  tripSheetLines: SalesTripSheetLine[] = [];
  savingTripSheet = false;
  // Signer & approver
  salesAgents: { userId: number; name: string; surname?: string; role?: string }[] = [];
  tripSheetSignerId: number | null = null;
  tripSheetApproverId: number | null = null;
  // Signer/approver autocomplete search text
  signerSearch = '';
  approverSearch = '';
  // Logistics reference data (for the shared Create/Import trip sheet dialogs)
  tsDrivers: any[] = [];
  tsVehicles: any[] = [];
  tsWarehouses: any[] = [];
  tsCustomers: any[] = [];
  // Import flow state (mirrors logistics: 'upload' | 'preview')
  importStep: 'upload' | 'preview' = 'upload';
  importSelectedFile: File | null = null;
  importUploading = false;
  importError = '';
  importDragOver = false;
  importPreviewResponse: any = null;
  // Per-line async flags
  lineLookupBusy: { [index: number]: boolean } = {};
  lineGeocodeBusy: { [index: number]: boolean } = {};
  lineAddressConfirmed: { [index: number]: boolean } = {};
  // Detail / approval dialog state
  viewingTripSheet: SalesTripSheet | null = null;
  approvalNotes = '';
  rejectionReason = '';

  filteredTripSheets = computed(() => {
    const status = this.tripSheetStatusFilter();
    const list = this.salesTripSheets();
    return status === 'all' ? list : list.filter(t => t.status === status);
  });

  pendingTripSheetCount = computed(() => this.salesTripSheets().filter(t => t.status === 'PendingApproval' || t.status === 'PendingSignature').length);

  filteredLogisticsTripsheets = computed(() => {
    const q = this.logisticsTripsheetSearch().toLowerCase().trim();
    const list = this.logisticsTripsheets();
    if (!q) return list;
    return list.filter(t =>
      (t.loadNumber || '').toLowerCase().includes(q) ||
      (t.tripNumber || '').toLowerCase().includes(q) ||
      (t.driverName || '').toLowerCase().includes(q) ||
      (t.vehicleReg || '').toLowerCase().includes(q) ||
      (t.origin || '').toLowerCase().includes(q) ||
      (t.destination || '').toLowerCase().includes(q) ||
      (t.status || '').toLowerCase().includes(q));
  });

  orders = signal<Order[]>([]);
  companyPerfServer = signal<CompanySales[] | null>(null);
  incomingEmails = signal<IncomingOrderEmail[]>([]);
  emailAccounts = signal<string[]>([]);
  selectedEmailAccounts = signal<string[]>([]);
  emailSearchKeyword = signal('order');
  // Back Orders
  activeBackOrderTab = signal<string>('promed');
  backOrderSearch = signal('');
  backOrderPage = signal(0);
  backOrderPageSize = signal(50);
  stats = signal<SalesStats>({
    totalCustomers: 0,
    activeCustomers: 0,
    totalInvoices: 0,
    pendingInvoices: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    incomingOrders: 0,
    processingOrders: 0
  });

  // Loading states
  loadingCustomers = signal(false);
  loadingInvoices = signal(false);
  loadingOrders = signal(false);

  // Initial loading progress
  initialLoading = signal(true);
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing...';
  private progressInterval: any;
  private loadedSections = 0;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Authenticating', detail: 'Securing connection...' },
    { icon: 'shopping_cart', label: 'Orders', detail: 'Loading orders & invoices...' },
    { icon: 'analytics', label: 'Analytics', detail: 'Calculating statistics...' },
    { icon: 'dashboard', label: 'Ready', detail: 'Building sales dashboard...' }
  ];

  // Total counts from API headers (for accurate stats)
  totalCustomerCount = 0;
  totalInvoiceCount = 0;

  // Filter signals
  customerSearch = signal('');
  customerProvinceFilter = signal('all');
  invoiceSearch = signal('');
  invoiceStatusFilter = signal('all');
  orderSearch = signal('');
  orderStatusFilter = signal('all');
  emailFilterSearch = signal('');
  emailReadFilter = signal('all');
  // Loading states for back orders (unused, kept for structure)
  loadingBackOrders = signal(false);

  // POD Documents
  podDocuments: any[] = [];
  podSummary: any = null;
  podLoading = false;
  podRegionFilter = '';
  podMonthFilter = '';
  podDriverFilter = '';
  podLinkFilter = '';
  podDriverList: string[] = [];
  podViewMode = 'list';
  podCurrentPage = 1;
  podPageSize = 50;
  podTotalCount = 0;
  podTableColumns = ['podNumber', 'deliveryDate', 'region', 'linkStatus', 'fileName', 'fileSize', 'actions'];
  // POD Tripsheet attachments side panel
  tripsheetPanelOpen = false;
  tripsheetPanelLoading = false;
  tripsheetPanelLoad: any = null;
  tripsheetPanelPods: any[] = [];
  tripsheetPanelActiveId: number | null = null;
  tripsheetPreviewLoading = false;
  // POD Upload password gate
  showPodPasswordDialog = false;
  podPasswordInput = '';
  podPasswordError = '';
  private readonly POD_UPLOAD_PASSWORD = '1234';

  // ── Welly POD OCR scan ────────────────────────────────────────────
  showWellyPodPanel = false;
  wellyPodScanning = false;
  wellyPodStatus = '';
  wellyPodProgress = 0;
  wellyPodCurrent: any = null;          // the POD being scanned
  wellyPodMatches: any[] = [];          // suggested invoice matches (with .approved flag)
  wellyPodUnmatched: string[] = [];     // OCR tokens that didn't resolve
  wellyPodOcrText = '';                  // raw OCR text (for visibility when nothing matches)
  wellyPodEmbeddedText = '';             // embedded PDF text layer (digital PDFs)
  wellyPodPageCount = 0;
  wellyPodCandidatesFound: string[] = [];// invoice-number-looking tokens Welly extracted
  wellyPodShowDebug = false;
  wellyPodLinking = false;
  wellyPodBatchMode = false;            // true when scanning all unlinked
  wellyPodBatchQueue: any[] = [];
  wellyPodBatchResults: { pod: any; linked: number; found: number }[] = [];
  private wellyPodActivityId: number | null = null;

  // Selected items
  selectedCustomer = signal<Customer | null>(null);
  showCustomerSidebar = false;

  // Attention dialog
  showAttentionDialog = false;
  attentionTabIndex = 0;
  bulkProvince = '';
  isGeocoding = false;
  geocodeProgress = '';

  // Welly Fix suggestions
  wellyCustomerFixes: any[] = [];
  wellyInvoiceFixes: any[] = [];
  wellyCustomerFixLoading = false;
  wellyInvoiceFixLoading = false;
  wellyCustomerFixApplying = false;
  wellyInvoiceFixApplying = false;
  showWellyCustomerReview = false;
  showWellyInvoiceReview = false;

  // Company Sales Dialog
  showCompanySalesDialog = false;
  selectedCompanyForDialog: Company | null = null;
  companySalesHistoryData: any[] = [];
  companySalesTableData: any[] = [];
  companySalesLoading = false;
  companySalesDateRange: 'week' | 'month' | 'quarter' = 'week';
  newSaleFormVisible = false;

  // Export Date Range Picker
  showExportDatePicker = false;
  exportType: 'excel' | 'pdf' = 'excel';
  exportFromDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  exportToDate: Date = new Date();
  exportGenerating = false;

  // Company Comparison Dialog
  showCompareDialog = false;
  compareCompanyCode = '';
  compareFromDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  compareToDate: Date = new Date();
  compareDataA = { count: 0, revenue: 0, cost: 0 };
  compareDataB = { count: 0, revenue: 0, cost: 0 };
  compareDailyData: { date: string; label: string; totalA: number; totalB: number }[] = [];
  compareExporting = false;
  Math = Math;
  newSaleForm = {
    transactionNumber: '',
    customerName: '',
    productDescription: '',
    quantity: 1,
    salesAmount: 0,
    transactionDate: new Date()
  };

  // Edit Invoice Dialog
  showEditInvoiceDialog = false;
  editingInvoiceId: number | null = null;
  editInvoiceForm: any = {
    transactionNumber: '',
    customerNumber: '',
    customerName: '',
    productCode: '',
    productDescription: '',
    quantity: 0,
    salesAmount: 0,
    costOfSales: 0,
    transactionDate: '',
    status: '',
    deliveryProvince: '',
    deliveryAddress: '',
    sourceCompany: ''
  };
  editInvoiceSaving = false;

  // Delivery Request Dialog
  showDeliveryDialog = false;
  deliverySaving = false;
  deliveryError = '';
  deliverySuccess = false;
  deliverySuccessMsg = '';
  deliverySuccessRef = '';
  // Delivery password gate
  showDeliveryPasswordDialog = false;
  deliveryPasswordInput = '';
  deliveryPasswordError = '';
  private readonly DELIVERY_PASSWORD = '0000';
  private pendingDeliveryInvoice: Invoice | null = null;
  deliveryInvoiceSearch = '';
  deliveryFilteredInvoices: Invoice[] = [];
  deliverySelectedInvoices: Invoice[] = [];
  deliveryForm = {
    priority: 'Urgent',
    quantity: 0,
    description: '',
    deliveryAddress: '',
    notes: ''
  };

  // Table columns
  customerColumns = ['customerCode', 'name', 'contact', 'location', 'status', 'actions'];
  invoiceColumns = ['transactionNumber', 'date', 'customer', 'product', 'amount', 'province', 'source', 'status', 'actions'];

  // Pagination state
  customerPageIndex = signal(0);
  customerPageSize = signal(10);
  invoicePageIndex = signal(0);
  invoicePageSize = signal(15);

  // Province list
  provinces = [
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

  // Computed filtered lists (full set for counting)
  allFilteredCustomers = computed(() => {
    let list = this.customers();
    const search = this.customerSearch().toLowerCase();
    const province = this.customerProvinceFilter();

    if (search) {
      list = list.filter(c =>
        c.name?.toLowerCase().includes(search) ||
        c.customerCode?.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.contactPerson?.toLowerCase().includes(search)
      );
    }

    if (province !== 'all') {
      list = list.filter(c => c.province === province || c.deliveryProvince === province);
    }

    return list;
  });

  // Paginated customers for table display
  filteredCustomers = computed(() => {
    const all = this.allFilteredCustomers();
    const start = this.customerPageIndex() * this.customerPageSize();
    return all.slice(start, start + this.customerPageSize());
  });

  // Full filtered invoices for counting
  allFilteredInvoices = computed(() => {
    let list = this.invoices();
    const search = this.invoiceSearch().toLowerCase();
    const status = this.invoiceStatusFilter();

    if (search) {
      list = list.filter(i =>
        i.transactionNumber?.toLowerCase().includes(search) ||
        i.customerName?.toLowerCase().includes(search) ||
        i.customerNumber?.toLowerCase().includes(search) ||
        i.productDescription?.toLowerCase().includes(search)
      );
    }

    if (status !== 'all') {
      list = list.filter(i => i.status === status);
    }

    return list;
  });

  // Paginated invoices for table display
  filteredInvoices = computed(() => {
    const all = this.allFilteredInvoices();
    const start = this.invoicePageIndex() * this.invoicePageSize();
    return all.slice(start, start + this.invoicePageSize());
  });

  filteredOrders = computed(() => {
    let list = this.orders();
    const search = this.orderSearch().toLowerCase();
    const status = this.orderStatusFilter();

    if (search) {
      list = list.filter(o =>
        o.orderNumber?.toLowerCase().includes(search) ||
        o.customerName?.toLowerCase().includes(search)
      );
    }

    if (status !== 'all') {
      list = list.filter(o => o.status === status);
    }

    return list;
  });

  filteredEmails = computed(() => {
    let list = this.incomingEmails();
    const search = this.emailFilterSearch().toLowerCase();
    const readFilter = this.emailReadFilter();

    if (search) {
      list = list.filter(e =>
        e.subject?.toLowerCase().includes(search) ||
        e.from?.toLowerCase().includes(search) ||
        e.fromEmail?.toLowerCase().includes(search) ||
        e.accountEmail?.toLowerCase().includes(search) ||
        e.preview?.toLowerCase().includes(search)
      );
    }

    if (readFilter === 'unread') {
      list = list.filter(e => !e.isRead);
    } else if (readFilter === 'read') {
      list = list.filter(e => e.isRead);
    }

    return list;
  });

  unreadEmailCount = computed(() => this.filteredEmails().filter(e => !e.isRead).length);
  attachmentEmailCount = computed(() => this.filteredEmails().filter(e => e.hasAttachments).length);

  // Back Order computed signals.
  // Imported backorders (Admin > Data Import > Backorders) take precedence per
  // company; the bundled static lists are the fallback until an import is done.
  importedBackOrders = signal<{ [company: string]: BackOrderItem[] }>({});

  private importedOrStatic(company: string, fallback: BackOrderItem[]): BackOrderItem[] {
    const imported = this.importedBackOrders()[company];
    return imported && imported.length > 0 ? imported : fallback;
  }

  promedBackOrders = computed(() => this.importedOrStatic('PMT', PROMED_BACK_ORDERS));
  accessBackOrders = computed(() => this.importedOrStatic('ACM', ACCESS_BACK_ORDERS));
  pharmatechBackOrders = computed(() => this.importedOrStatic('PHT', PHARMATECH_BACK_ORDERS));
  sebenzaniBackOrders = computed(() => this.importedOrStatic('SBT', SEBENZANI_BACK_ORDERS));

  loadImportedBackOrders(): void {
    this.http.get<any[]>(`${this.apiUrl}/backorders`).subscribe({
      next: (rows) => {
        const map: { [company: string]: BackOrderItem[] } = {};
        for (const r of rows || []) {
          const item: BackOrderItem = {
            orderNumber: r.orderNumber || '',
            orderDate: r.orderDate ? String(r.orderDate).substring(0, 10).replace(/-/g, '/') : '',
            customerNo: r.customerNo || '',
            customerName: r.customerName || '',
            poNo: r.poNo || '',
            itemDesc: r.itemDesc || '',
            location: r.location || '',
            uom: r.uom || '',
            qtyBackOrder: Number(r.qtyBackOrder) || 0,
            unitPrice: Number(r.unitPrice) || 0,
            extPrice: Number(r.extPrice) || 0,
            contract: r.contract || '',
            accountSet: r.accountSet || ''
          };
          (map[r.sourceCompany] ||= []).push(item);
        }
        this.importedBackOrders.set(map);
      },
      error: () => { /* keep static fallback */ }
    });
  }

  /** Company tab + text search, before the stock-state filter. */
  filteredBackOrdersUnfiltered = computed(() => {
    const tab = this.activeBackOrderTab();
    let list: BackOrderItem[] = [];

    if (tab === 'promed') {
      list = this.promedBackOrders();
    } else if (tab === 'access') {
      list = this.accessBackOrders();
    } else if (tab === 'pharmatech') {
      list = this.pharmatechBackOrders();
    } else if (tab === 'sebenzani') {
      list = this.sebenzaniBackOrders();
    }

    const search = this.backOrderSearch().toLowerCase();

    if (search) {
      list = list.filter(bo =>
        bo.orderNumber?.toLowerCase().includes(search) ||
        bo.customerName?.toLowerCase().includes(search) ||
        bo.customerNo?.toLowerCase().includes(search) ||
        bo.itemDesc?.toLowerCase().includes(search) ||
        bo.poNo?.toLowerCase().includes(search)
      );
    }

    return list;
  });

  filteredBackOrders = computed(() => {
    const list = this.filteredBackOrdersUnfiltered();
    const f = this.backOrderStockFilter();
    if (!f) return list;
    return list.filter(bo => this.backOrderStockState(bo) === f);
  });

  backOrderTotalCount = computed(() => this.promedBackOrders().length + this.accessBackOrders().length + this.pharmatechBackOrders().length + this.sebenzaniBackOrders().length);
  backOrderTotalQty = computed(() => this.filteredBackOrders().reduce((sum, bo) => sum + bo.qtyBackOrder, 0));
  backOrderTotalValue = computed(() => this.filteredBackOrders().reduce((sum, bo) => sum + bo.extPrice, 0));
  backOrderUniqueOrders = computed(() => new Set(this.filteredBackOrders().map(bo => bo.orderNumber)).size);

  paginatedBackOrders = computed(() => {
    const list = this.filteredBackOrders();
    const start = this.backOrderPage() * this.backOrderPageSize();
    return list.slice(start, start + this.backOrderPageSize());
  });

  backOrderPageStart = computed(() => this.backOrderPage() * this.backOrderPageSize());
  backOrderPageEnd = computed(() => Math.min((this.backOrderPage() + 1) * this.backOrderPageSize(), this.filteredBackOrders().length));
  backOrderTotalPages = computed(() => Math.ceil(this.filteredBackOrders().length / this.backOrderPageSize()));

  // ---------------------------------------------------------------
  // Back order ↔ Stock availability (Sales → Stock hand-off)
  // ---------------------------------------------------------------
  backOrderStock = signal<{ [code: string]: BackOrderStockInfo }>({});
  backOrderStockLoaded = signal(false);
  backOrderUnmappedCount = signal(0);
  backOrderStockFilter = signal<'' | 'full' | 'partial' | 'none' | 'unmapped'>('');

  loadBackOrderStockCheck(): void {
    this.http.get<{ items: BackOrderStockInfo[]; unmappedCodes: string[] }>(`${this.apiUrl}/backorders/stock-check`).subscribe({
      next: (res) => {
        const map: { [code: string]: BackOrderStockInfo } = {};
        for (const it of res?.items || []) map[it.code] = it;
        this.backOrderStock.set(map);
        this.backOrderUnmappedCount.set(res?.unmappedCodes?.length || 0);
        this.backOrderStockLoaded.set(true);
      },
      error: () => this.backOrderStockLoaded.set(true)
    });
  }

  /** Mirrors BackordersController.ExtractItemCode. */
  backOrderItemCode(itemDesc: string): string {
    const s = (itemDesc || '').trim();
    const m = /^([A-Z]-[A-Z0-9]{2,4}-\d{2,4})-/i.exec(s);
    if (m) return m[1].toUpperCase();
    const dash = s.indexOf('-');
    return (dash > 0 ? s.substring(0, dash) : s).trim().toUpperCase();
  }

  backOrderStockState(bo: BackOrderItem): 'full' | 'partial' | 'none' | 'unmapped' {
    const info = this.backOrderStock()[this.backOrderItemCode(bo.itemDesc)];
    if (!info) return 'unmapped';
    if (info.onHand <= 0) return 'none';
    return info.onHand >= bo.qtyBackOrder ? 'full' : 'partial';
  }

  backOrderStockInfo(bo: BackOrderItem): BackOrderStockInfo | undefined {
    return this.backOrderStock()[this.backOrderItemCode(bo.itemDesc)];
  }

  backOrderStockTooltip(bo: BackOrderItem): string {
    const info = this.backOrderStockInfo(bo);
    if (!info) return 'Item code not mapped to a product — map it via "Unmapped products"';
    if (!info.warehouses?.length) return `${info.commodityName}: no stock in any warehouse`;
    return `${info.commodityName} — on hand ${info.onHand}\n` + info.warehouses.map(w => `${w.name}: ${w.qty}`).join('\n');
  }

  backOrderStockLabel(state: string): string {
    return state === 'full' ? 'In stock' : state === 'partial' ? 'Partial' : state === 'none' ? 'No stock' : 'Unmapped';
  }

  /** Lines the warehouse can fully cover right now (current company tab + search). */
  backOrderCoverable = computed(() => {
    const stock = this.backOrderStock();
    let lines = 0, value = 0;
    for (const bo of this.filteredBackOrdersUnfiltered()) {
      const info = stock[this.backOrderItemCode(bo.itemDesc)];
      if (info && bo.qtyBackOrder > 0 && info.onHand >= bo.qtyBackOrder) { lines++; value += bo.extPrice; }
    }
    return { lines, value };
  });

  backOrderStockCounts = computed(() => {
    const c = { full: 0, partial: 0, none: 0, unmapped: 0 };
    for (const bo of this.filteredBackOrdersUnfiltered()) c[this.backOrderStockState(bo)]++;
    return c;
  });

  openUnmappedProducts(): void {
    const ref = this.dialog.open(UnmappedProductsDialog, { width: '900px', maxHeight: '85vh', data: { apiUrl: this.apiUrl } });
    ref.afterClosed().subscribe(changed => { if (changed) this.loadBackOrderStockCheck(); });
  }

  /** Click on an In stock / Partial badge: show which warehouses hold the item. */
  openBackOrderStock(bo: BackOrderItem): void {
    const info = this.backOrderStockInfo(bo);
    if (!info || info.onHand <= 0) return;
    this.dialog.open(BackOrderStockDialog, { width: '620px', data: { bo, info } });
  }

  // Attention computed values
  customersWithoutLocation = computed(() => {
    // Default centroid for South Africa (used as placeholder when no address data)
    const defaultLat = -30.559482;
    const defaultLng = 22.937506;
    
    return this.customers().filter(c => {
      // No coordinates at all
      if (!c.latitude || !c.longitude) return true;
      
      // Has the default placeholder coordinates (meaning not properly geocoded)
      const isDefault = Math.abs(c.latitude - defaultLat) < 0.001 && 
                        Math.abs(c.longitude - defaultLng) < 0.001;
      if (isDefault) return true;
      
      // Missing province/city even though has coordinates
      if (!c.province || !c.city) return true;
      
      return false;
    });
  });

  invoicesWithoutProvince = computed(() => {
    return this.invoices().filter(i => !i.deliveryProvince || i.deliveryProvince.trim() === '');
  });

  attentionCount = computed(() => {
    return this.customersWithoutLocation().length + this.invoicesWithoutProvince().length;
  });

  // Helper function to get the last business day (Mon-Fri)
  private getLastBusinessDay(fromDate: Date): Date {
    const result = new Date(fromDate);
    result.setDate(result.getDate() - 1);
    
    // If Saturday (6), go back to Friday
    // If Sunday (0), go back to Friday
    const dayOfWeek = result.getDay();
    if (dayOfWeek === 6) { // Saturday
      result.setDate(result.getDate() - 1); // Go to Friday
    } else if (dayOfWeek === 0) { // Sunday
      result.setDate(result.getDate() - 2); // Go to Friday
    }
    
    return result;
  }

  // Get past N business days (Mon-Fri) going backwards from fromDate (exclusive)
  private getPastBusinessDays(fromDate: Date, count: number): Date[] {
    const days: Date[] = [];
    const d = new Date(fromDate);
    while (days.length < count) {
      d.setDate(d.getDate() - 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) { // skip weekends
        const day = new Date(d);
        day.setHours(0, 0, 0, 0);
        days.push(day);
      }
    }
    return days;
  }

  // Get the current business day (if weekend, show Friday)
  private getCurrentBusinessDay(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    
    // If Saturday (6), go back to Friday
    // If Sunday (0), go back to Friday
    if (dayOfWeek === 6) { // Saturday
      result.setDate(result.getDate() - 1);
    } else if (dayOfWeek === 0) { // Sunday
      result.setDate(result.getDate() - 2);
    }
    
    return result;
  }

  // Get label for the comparison days
  lastBusinessDayLabel = computed(() => {
    const today = new Date();
    const currentBizDay = this.getCurrentBusinessDay(today);
    const lastBizDay = this.getLastBusinessDay(currentBizDay);
    return lastBizDay.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  });

  currentBusinessDayLabel = computed(() => {
    const today = new Date();
    const currentBizDay = this.getCurrentBusinessDay(today);
    const isToday = currentBizDay.toDateString() === today.toDateString();
    if (isToday) {
      return 'Today';
    }
    return currentBizDay.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
  });

  // Company sales comparison - Last Business Day vs Current Business Day
  // Trend % compares the most recent day with data against the current month's daily average
  //
  // Cards prefer the lightweight server-computed summary (companyPerfServer). The client-side
  // computation below is kept as a fallback for when the full invoices array is already loaded
  // (e.g. after opening a data-heavy tab) or if the summary endpoint fails.
  companyCards = computed<CompanySales[]>(() => {
    const server = this.companyPerfServer();
    if (server && server.length) return server;
    return this.companySalesDataClient();
  });

  companySalesDataClient = computed(() => {
    const invoices = this.invoices();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get current business day (today if weekday, Friday if weekend)
    const currentBizDay = this.getCurrentBusinessDay(today);
    currentBizDay.setHours(0, 0, 0, 0);
    
    // Get last business day (previous weekday)
    const lastBizDay = this.getLastBusinessDay(currentBizDay);
    lastBizDay.setHours(0, 0, 0, 0);

    // First day of the current month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    return this.companies.map(company => {
      const companyInvoices = invoices.filter(i => 
        i.sourceCompany === company.code || 
        i.sourceSystem?.toLowerCase().includes(company.shortName.toLowerCase())
      );

      const currentDayInvoices = companyInvoices.filter(i => {
        const date = new Date(i.transactionDate);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === currentBizDay.getTime();
      });

      const lastDayInvoices = companyInvoices.filter(i => {
        const date = new Date(i.transactionDate);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === lastBizDay.getTime();
      });

      const todaySales = currentDayInvoices.reduce((sum, i) => sum + (i.salesAmount || 0), 0);
      const yesterdaySales = lastDayInvoices.reduce((sum, i) => sum + (i.salesAmount || 0), 0);

      // Gather all invoices for the current month (weekdays only)
      const monthInvoices = companyInvoices.filter(i => {
        const d = new Date(i.transactionDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= monthStart.getTime() && d.getTime() <= currentBizDay.getTime();
      });

      // Group month invoices by date to get daily totals
      const dailyMap = new Map<number, number>();
      for (const inv of monthInvoices) {
        const d = new Date(inv.transactionDate);
        d.setHours(0, 0, 0, 0);
        const key = d.getTime();
        dailyMap.set(key, (dailyMap.get(key) || 0) + (inv.salesAmount || 0));
      }

      // Only count weekdays that have data for the average
      const dailyTotals = Array.from(dailyMap.values()).filter(v => v > 0);
      const monthlyDailyAvg = dailyTotals.length > 0
        ? dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length
        : 0;

      // Find the most recent day's sales for trend comparison
      // Use today if it has data, otherwise use the latest day with data this month
      let trendSales = todaySales;
      if (trendSales === 0 && dailyMap.size > 0) {
        const sortedDays = Array.from(dailyMap.entries()).sort((a, b) => b[0] - a[0]);
        trendSales = sortedDays[0][1];
      }

      const percentChange = monthlyDailyAvg > 0
        ? ((trendSales - monthlyDailyAvg) / monthlyDailyAvg) * 100
        : trendSales > 0 ? 100 : 0;

      return {
        company,
        todaySales,
        yesterdaySales,
        todayOrders: currentDayInvoices.length,
        yesterdayOrders: lastDayInvoices.length,
        percentChange,
        monthlyDailyAvg
      } as CompanySales;
    });
  });

  ngOnInit(): void {
    // Read the address first, so the first requests already use any filters in it.
    this.applyUrl();
    this.subscriptions.add(this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.applyUrl()));
    this.subscriptions.add(this.filterWrites.pipe(debounceTime(250)).subscribe(() => this.writeFilters()));
    this.startLoadingProgress();
    this.loadDashboardData();
    this.loadImportedBackOrders();
    this.loadBackOrderStockCheck();
  }

  private checkInitialLoadComplete(): void {
    this.loadedSections++;
    if (this.loadedSections >= 3) {
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

  private stopLoadingProgress(): void {
    clearInterval(this.progressInterval);
    this.loadingProgress = 0;
    this.loadingStage = 0;
  }

  // Pagination handlers
  onCustomerPageChange(event: PageEvent): void {
    this.customerPageIndex.set(event.pageIndex);
    this.customerPageSize.set(event.pageSize);
  }

  onInvoicePageChange(event: PageEvent): void {
    this.invoicePageIndex.set(event.pageIndex);
    this.invoicePageSize.set(event.pageSize);
  }

  loadDashboardData(): void {
    this.loadCustomers();
    this.loadCompanyPerformance();
    this.loadOrders();
    this.loadEmailAccounts();
    this.loadPodDocuments();
    this.loadPodSummary();
    // Defer the heavy full-invoice load (up to 10k rows) so the dashboard paints and
    // becomes interactive immediately. The top Company Performance cards are driven by the
    // lightweight server summary above; the full array is only needed by data-heavy tabs.
    setTimeout(() => this.loadInvoices(), 400);
    // Stats are now calculated reactively when data loads
  }

  /** Load the lightweight server-computed company performance summary for the top cards. */
  loadCompanyPerformance(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/importedinvoices/company-performance`).subscribe({
      next: (rows) => {
        const cards: CompanySales[] = this.companies.map(company => {
          const r = (rows || []).find(x => x.companyCode === company.code);
          return {
            company,
            todaySales: r?.todaySales ?? 0,
            yesterdaySales: r?.yesterdaySales ?? 0,
            todayOrders: r?.todayOrders ?? 0,
            yesterdayOrders: r?.yesterdayOrders ?? 0,
            percentChange: r?.percentChange ?? 0,
            monthlyDailyAvg: r?.monthlyDailyAvg ?? 0
          } as CompanySales;
        });
        this.companyPerfServer.set(cards);
        this.checkInitialLoadComplete();
      },
      error: (err) => {
        // Silent fallback: cards will use the client-side computation once invoices load.
        console.warn('Company performance summary failed; falling back to client calc', err);
        this.checkInitialLoadComplete();
      }
    });
  }

  loadCustomers(): void {
    this.loadingCustomers.set(true);
    this.http.get<Customer[]>(`${this.apiUrl}/logistics/customers?pageSize=2000`, { observe: 'response' }).subscribe({
      next: (response) => {
        const customers = response.body || [];
        const totalCount = parseInt(response.headers.get('X-Total-Count') || '0', 10);
        this.customers.set(customers);
        this.totalCustomerCount = totalCount; // Store actual total from header
        this.loadingCustomers.set(false);
        this.updateStats();
        this.checkInitialLoadComplete();
      },
      error: (err) => {
        console.error('Failed to load customers:', err);
        this.loadingCustomers.set(false);
        this.checkInitialLoadComplete();
        this.toast.error('Failed to load customers');
      }
    });
  }

  /**
   * Export all customers to an Excel (.xlsx) file, including full address and contact details.
   * Exports the complete customer list currently loaded (respecting no pagination),
   * or the active search/province filter if one is applied.
   */
  exportCustomers(): void {
    const source = this.allFilteredCustomers();
    if (!source || source.length === 0) {
      this.toast.warn('No customers to export');
      return;
    }

    try {
      const rows = source.map(c => ({
        'Customer Code': c.customerCode || '',
        'Name': c.name || '',
        'Short Name': c.shortName || '',
        'Contact Person': c.contactPerson || '',
        'Email': c.email || '',
        'Phone': c.phoneNumber || '',
        'Address': c.address || '',
        'City': c.city || '',
        'Province': c.province || '',
        'Postal Code': c.postalCode || '',
        'Delivery Address': c.deliveryAddress || '',
        'Delivery City': c.deliveryCity || '',
        'Delivery Province': c.deliveryProvince || '',
        'Delivery Postal Code': c.deliveryPostalCode || '',
        'Latitude': c.latitude ?? '',
        'Longitude': c.longitude ?? '',
        'Status': c.status || '',
        'Company Code': c.companyCode || '',
        'Total Orders': c.totalOrders ?? '',
        'Total Revenue': c.totalRevenue ?? '',
        'Created At': c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : ''
      }));

      const ws = XLSX.utils.json_to_sheet(rows);

      // Set sensible column widths
      ws['!cols'] = [
        { wch: 14 }, { wch: 32 }, { wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 16 },
        { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
        { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Customers');

      const stamp = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `Customers_Export_${stamp}.xlsx`);

      this.toast.done(`Exported ${rows.length} customers to Excel`);
    } catch (err) {
      console.error('Failed to export customers:', err);
      this.toast.error('Failed to export customers');
    }
  }

  // ── Sales Trip Sheets ─────────────────────────────────────────────────────
  private tripSheetApi = `${this.apiUrl}/logistics/sales-tripsheets`;

  loadSalesTripSheets(): void {
    this.loadingTripSheets.set(true);
    this.http.get<SalesTripSheet[]>(this.tripSheetApi).subscribe({
      next: (sheets) => {
        this.salesTripSheets.set(sheets || []);
        this.loadingTripSheets.set(false);
        this.tripSheetsLoaded = true;
      },
      error: (err) => {
        console.error('Failed to load trip sheets:', err);
        this.loadingTripSheets.set(false);
        this.toast.error('Failed to load trip sheets');
      }
    });
    this.loadLogisticsTripsheets();
  }

  /** Pull the same tripsheet list Logistics sees so sales can view them here. */
  loadLogisticsTripsheets(): void {
    this.loadingLogisticsTripsheets.set(true);
    this.http.get<any[]>(`${this.apiUrl}/logistics/tripsheet`).subscribe({
      next: (trips) => {
        this.logisticsTripsheets.set(trips || []);
        this.loadingLogisticsTripsheets.set(false);
      },
      error: (err) => {
        console.error('Failed to load logistics tripsheets:', err);
        this.loadingLogisticsTripsheets.set(false);
      }
    });
  }

  tripsheetTone(status: string | null | undefined): ChipTone {
    if (status === 'Completed' || status === 'Delivered') return 'ok';
    if (status === 'In Progress' || status === 'In Transit' || status === 'Assigned') return 'warn';
    if (status === 'Pending' || status === 'Available' || status === 'Draft') return 'info';
    return 'neutral';
  }

  /** Open the printable Rocket Freight tripsheet for a logistics load. */
  viewLogisticsTripsheet(trip: any): void {
    const loadId = trip.loadId || trip.id;
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
      },
      error: () => this.toast.error('Failed to load tripsheet')
    });
  }

  get currentUserId(): number | null {
    return this.auth.currentUserValue?.userId ?? null;
  }

  get currentUserName(): string {
    const u = this.auth.currentUserValue;
    return u ? `${u.name} ${u.surname || ''}`.trim() : '';
  }

  /** Whether the current agent may check/approve a sheet (must be a different agent than the creator). */
  canApproveTripSheet(sheet: SalesTripSheet): boolean {
    if (sheet.status !== 'PendingApproval') return false;
    const me = this.currentUserId;
    if (me == null) return true; // fall back to backend enforcement
    return sheet.createdByUserId !== me;
  }

  /** Whether the current agent may sign a sheet (must be the designated signer, if one is set). */
  canSignTripSheet(sheet: SalesTripSheet): boolean {
    if (sheet.status !== 'PendingSignature') return false;
    const me = this.currentUserId;
    if (me == null) return true; // fall back to backend enforcement
    if (sheet.signerUserId == null) return true;
    return sheet.signerUserId === me;
  }

  /** Create a trip sheet exactly like Logistics does — same dialog, same flow, no sign-off stages. */
  openCreateTripSheet(): void {
    this.loadTsRefData();
    // Fetch pending imported invoices so the dialog behaves identically to Logistics
    this.http.get<any[]>(`${this.apiUrl}/logistics/importedinvoices?pageSize=10000`).subscribe({
      next: (invoices) => this.openLogisticsCreateDialog(invoices || []),
      error: () => this.openLogisticsCreateDialog([])
    });
  }

  private openLogisticsCreateDialog(invoices: any[], opts?: { isImport?: boolean; isManualTripsheet?: boolean; batchId?: string; preSelectedInvoices?: any[] }): void {
    const dialogRef = this.dialog.open(CreateTripsheetDialog, {
      width: '99vw',
      maxWidth: '2200px',
      height: '95vh',
      panelClass: 'create-tripsheet-dialog-panel',
      data: {
        invoices,
        drivers: this.tsDrivers,
        vehicles: this.tsVehicles,
        warehouses: this.tsWarehouses,
        customers: this.tsCustomers,
        apiUrl: this.apiUrl,
        ...(opts || {})
      }
    });
    dialogRef.afterClosed().subscribe((result: any) => {
      if (result?.created || result?.updated) {
        this.toast.done('Trip sheet created — it now appears in Logistics too');
        this.loadLogisticsTripsheets();
      }
    });
  }

  /** Import a trip sheet from Excel — the exact Logistics import dialog. */
  openImportTripsheet(): void {
    this.loadTsRefData();
    const importRef = this.dialog.open(ImportTripsheetDialog, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'import-tripsheet-dialog-panel',
      data: { apiUrl: this.apiUrl, padMode: false }
    });
    importRef.afterClosed().subscribe((result: any) => {
      if (result?.openCreateDialog && result.invoices?.length > 0) {
        setTimeout(() => this.openLogisticsCreateDialog(result.invoices, {
          isImport: !result.isManualTripsheet,
          isManualTripsheet: !!result.isManualTripsheet,
          batchId: result.batchId,
          preSelectedInvoices: result.invoices
        }), 100);
      } else if (result?.imported) {
        this.loadLogisticsTripsheets();
      }
    });
  }

  editTripSheet(sheet: SalesTripSheet): void {
    this.editingTripSheetId = sheet.id;
    this.tripSheetMode = 'manual';
    this.tripSheetForm = {
      warehouseCode: sheet.warehouseCode || '',
      routeArea: sheet.routeArea || '',
      scheduledDate: sheet.scheduledDate ? sheet.scheduledDate.split('T')[0] : '',
      notes: sheet.notes || ''
    };
    this.tripSheetLines = sheet.lines.length
      ? sheet.lines.map(l => ({ ...l }))
      : [this.newTripSheetLine()];
    this.tripSheetSignerId = sheet.signerUserId ?? this.currentUserId;
    this.tripSheetApproverId = sheet.approverUserId ?? null;
    this.loadSalesAgents();
    this.resetImportState();
    this.showTripSheetDialog = true;
  }

  closeTripSheetDialog(): void {
    this.showTripSheetDialog = false;
    this.editingTripSheetId = null;
    this.tripSheetLines = [];
    this.tripSheetMode = 'signoff';
    this.resetImportState();
  }

  private resetImportState(): void {
    this.importStep = 'upload';
    this.importSelectedFile = null;
    this.importUploading = false;
    this.importError = '';
    this.importDragOver = false;
    this.importPreviewResponse = null;
    this.lineLookupBusy = {};
    this.lineGeocodeBusy = {};
    this.lineAddressConfirmed = {};
  }

  /** Load the list of sales agents (users) to populate signer/approver dropdowns. */
  loadSalesAgents(): void {
    if (this.salesAgents.length > 0) return;
    this.http.get<any[]>(`${this.apiUrl}/users`).subscribe({
      next: (users) => {
        this.salesAgents = (users || []).map(u => ({
          userId: u.userId,
          name: u.name || '',
          surname: u.surname || '',
          role: u.role || ''
        }));
        // Resolve any pre-selected signer/approver display text now that names are available
        if (this.tripSheetSignerId != null && !this.signerSearch) {
          this.signerSearch = this.agentDisplayName(this.tripSheetSignerId);
        }
        if (this.tripSheetApproverId != null && !this.approverSearch) {
          this.approverSearch = this.agentDisplayName(this.tripSheetApproverId);
        }
      },
      error: () => { /* fall back to free text / backend enforcement */ }
    });
  }

  agentDisplayName(userId: number | null): string {
    if (userId == null) return '';
    const a = this.salesAgents.find(x => x.userId === userId);
    return a ? `${a.name} ${a.surname || ''}`.trim() : '';
  }

  /** Autocomplete displayWith — resolves a userId to the agent's full name. */
  displayAgent = (userId: number | null): string => this.agentDisplayName(userId);

  private filterAgents(term: string, excludeId: number | null): { userId: number; name: string; surname?: string }[] {
    const t = (term || '').toString().toLowerCase().trim();
    return this.salesAgents.filter(a => {
      if (excludeId != null && a.userId === excludeId) return false;
      if (!t) return true;
      const full = `${a.name} ${a.surname || ''}`.toLowerCase();
      return full.includes(t);
    }).slice(0, 50);
  }

  filteredSignerAgents(): { userId: number; name: string; surname?: string }[] {
    return this.filterAgents(this.signerSearch, this.tripSheetApproverId);
  }

  filteredApproverAgents(): { userId: number; name: string; surname?: string }[] {
    return this.filterAgents(this.approverSearch, this.tripSheetSignerId);
  }

  onSignerSearchChange(val: any): void {
    // Clear the selection when the user edits the text (only re-set on explicit pick)
    if (typeof val === 'string') this.tripSheetSignerId = null;
  }

  onApproverSearchChange(val: any): void {
    if (typeof val === 'string') this.tripSheetApproverId = null;
  }

  onSignerSelected(userId: number): void {
    this.tripSheetSignerId = userId;
    this.signerSearch = this.agentDisplayName(userId);
  }

  onApproverSelected(userId: number): void {
    this.tripSheetApproverId = userId;
    this.approverSearch = this.agentDisplayName(userId);
  }

  /** Stage 0 -> Stage 1: validate signer & approver, then move to the mode chooser. */
  proceedFromSignoff(): void {
    if (this.tripSheetSignerId == null) {
      this.toast.warn('Select who is signing (creating) this trip sheet.');
      return;
    }
    if (this.tripSheetApproverId == null) {
      this.toast.warn('Select the approver who will check & sign this trip sheet.');
      return;
    }
    if (this.tripSheetSignerId === this.tripSheetApproverId) {
      this.toast.warn('The approver must be a different person than the signer.');
      return;
    }
    this.tripSheetMode = 'choose';
  }

  /** Load logistics reference data needed by the shared Create/Import trip sheet dialogs. */
  loadTsRefData(): void {
    if (this.tsWarehouses.length === 0) {
      this.http.get<any[]>(`${this.apiUrl}/warehouses`).subscribe({ next: d => this.tsWarehouses = d || [], error: () => {} });
    }
    if (this.tsDrivers.length === 0) {
      this.http.get<any[]>(`${this.apiUrl}/logistics/drivers`).subscribe({ next: d => this.tsDrivers = d || [], error: () => {} });
    }
    if (this.tsCustomers.length === 0) {
      this.http.get<any[]>(`${this.apiUrl}/logistics/customers?pageSize=100000`).subscribe({ next: d => this.tsCustomers = d || [], error: () => {} });
    }
    if (this.tsVehicles.length === 0) {
      this.http.get<any[]>(`${this.apiUrl}/fleet/vehicles/live`).subscribe({
        next: (fleet) => {
          const unavailable = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
          this.tsVehicles = (fleet || [])
            .filter(v => !unavailable.includes(v.status))
            .map(v => ({
              id: v.id,
              registrationNumber: v.registrationNumber,
              type: v.vehicleTypeName || 'Truck',
              vehicleTypeName: v.vehicleTypeName,
              status: v.status,
              make: v.make,
              model: v.model
            }));
        },
        error: () => {}
      });
    }
  }

  private tripSheetSignoffData(): any {
    return {
      salesMode: true,
      createdByName: this.currentUserName || null,
      signerUserId: this.tripSheetSignerId,
      signerName: this.agentDisplayName(this.tripSheetSignerId) || null,
      approverUserId: this.tripSheetApproverId,
      approverName: this.agentDisplayName(this.tripSheetApproverId) || null
    };
  }

  private openSalesCreateDialog(preSelectedInvoices: any[], isManual: boolean, batchId?: string): void {
    const dialogRef = this.dialog.open(CreateTripsheetDialog, {
      width: '99vw',
      maxWidth: '2200px',
      height: '95vh',
      panelClass: 'create-tripsheet-dialog-panel',
      data: {
        invoices: preSelectedInvoices,
        drivers: this.tsDrivers,
        vehicles: this.tsVehicles,
        warehouses: this.tsWarehouses,
        customers: this.tsCustomers,
        apiUrl: this.apiUrl,
        isImport: !isManual && preSelectedInvoices.length > 0,
        isManualTripsheet: isManual,
        batchId,
        preSelectedInvoices,
        ...this.tripSheetSignoffData()
      }
    });
    dialogRef.afterClosed().subscribe((result: any) => {
      if (result?.created) {
        const msg = result.sentToSign
          ? 'Trip sheet generated — sent to the signer to sign off'
          : 'Trip sheet generated — awaiting approval by the designated approver';
        this.toast.done(msg);
        this.loadSalesTripSheets();
      }
    });
  }

  /** Import mode — opens the exact Logistics Excel import dialog, then the shared create dialog. */
  openLogisticsImport(): void {
    this.showTripSheetDialog = false;
    const importRef = this.dialog.open(ImportTripsheetDialog, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'import-tripsheet-dialog-panel',
      data: { apiUrl: this.apiUrl, padMode: false }
    });
    importRef.afterClosed().subscribe((result: any) => {
      if (result?.openCreateDialog && result.invoices?.length > 0) {
        setTimeout(() => this.openSalesCreateDialog(result.invoices, !!result.isManualTripsheet, result.batchId), 100);
      }
    });
  }

  /** Manual mode — opens the exact Logistics create dialog (map, distance, driver assignment). */
  openLogisticsManual(): void {
    this.showTripSheetDialog = false;
    this.openSalesCreateDialog([], true);
  }

  selectTripSheetMode(mode: 'manual' | 'import'): void {
    this.tripSheetMode = mode;
    if (mode === 'manual' && this.tripSheetLines.length === 0) {
      this.tripSheetLines = [this.newTripSheetLine()];
    }
  }

  backToModeChooser(): void {
    this.tripSheetMode = 'choose';
    this.resetImportState();
  }

  // ---- Excel import (exact mirror of the Logistics trip sheet import) ----

  onImportDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.importDragOver = true;
  }

  onImportDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.importDragOver = false;
  }

  onTsImportDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.importDragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleImportFile(file);
  }

  onTsImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleImportFile(file);
    input.value = '';
  }

  private handleImportFile(file: File): void {
    const name = (file.name || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      this.importError = 'Please select an Excel file (.xlsx or .xls)';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.importError = 'File is too large. Maximum size is 10MB.';
      return;
    }
    this.importError = '';
    this.importSelectedFile = file;
    this.importPreviewResponse = null;
    this.importStep = 'upload';
  }

  removeImportFile(): void {
    this.importSelectedFile = null;
    this.importPreviewResponse = null;
    this.importStep = 'upload';
    this.importError = '';
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /** Upload the selected Excel to the logistics preview endpoint and show a parsed preview. */
  previewImportFile(): void {
    if (!this.importSelectedFile) return;
    this.importUploading = true;
    this.importError = '';
    const formData = new FormData();
    formData.append('file', this.importSelectedFile);
    this.http.post<any>(`${this.apiUrl}/logistics/tripsheet/preview-import`, formData).subscribe({
      next: (res) => {
        this.importUploading = false;
        this.importPreviewResponse = res;
        this.importStep = 'preview';
        const rows = (res?.rows || []).length;
        if (rows === 0) {
          this.importError = 'No rows could be read from this file. Check the format hints and try again.';
        }
      },
      error: (err) => {
        this.importUploading = false;
        this.importError = err?.error?.error || err?.error?.message || 'Failed to parse Excel file';
      }
    });
  }

  hasValidImportRows(): boolean {
    return this.getImportValidRowCount() > 0;
  }

  getImportValidRowCount(): number {
    const rows = (this.importPreviewResponse?.rows || []) as any[];
    return rows.filter(r => (r.status !== 'error') && (r.data?.invoiceNumber || r.data?.customerName)).length;
  }

  getImportTotalValue(): number {
    const rows = (this.importPreviewResponse?.rows || []) as any[];
    return rows.reduce((sum, r) => sum + (Number(r.data?.salesAmount) || 0), 0);
  }

  /** After reviewing the import preview, map the parsed rows into editable lines and finalise. */
  useImportedRows(): void {
    const rows = (this.importPreviewResponse?.rows || []) as any[];
    this.tripSheetLines = rows
      .filter(r => r.status !== 'error')
      .map(r => {
        const d = r.data || {};
        return {
          customerName: d.customerName || d.customerNumber || '',
          invoiceNumber: d.invoiceNumber || '',
          address: d.deliveryAddress || '',
          city: d.city || '',
          province: d.province || '',
          contactPerson: d.contactPerson || '',
          contactPhone: d.contactPhone || '',
          productDescription: d.productDescription || '',
          quantity: Number(d.quantity) || 0,
          value: Number(d.salesAmount) || 0
        } as SalesTripSheetLine;
      });
    if (this.tripSheetLines.length === 0) this.tripSheetLines = [this.newTripSheetLine()];
    this.tripSheetMode = 'manual';
  }

  /** Look up an invoice number to auto-fill customer, address, product, qty and value. */
  lookupInvoiceForLine(index: number): void {
    const line = this.tripSheetLines[index];
    const inv = (line?.invoiceNumber || '').trim();
    if (!inv) {
      this.toast.warn('Enter an invoice number first');
      return;
    }
    this.lineLookupBusy = { ...this.lineLookupBusy, [index]: true };
    this.http.get<any>(`${this.tripSheetApi}/lookup-invoice/${encodeURIComponent(inv)}`).subscribe({
      next: (res) => {
        this.lineLookupBusy = { ...this.lineLookupBusy, [index]: false };
        if (!res?.found) {
          this.toast.warn(`No invoice found for ${inv} — you can type the details manually`);
          return;
        }
        const resultLines: SalesTripSheetLine[] = (res.lines || []).map((l: any) => ({
          customerName: l.customerName || '',
          invoiceNumber: l.invoiceNumber || inv,
          address: l.address || '',
          city: l.city || '',
          province: l.province || '',
          contactPerson: l.contactPerson || '',
          contactPhone: l.contactPhone || '',
          productDescription: l.productDescription || '',
          quantity: Number(l.quantity) || 0,
          value: Number(l.value) || 0
        }));
        if (resultLines.length === 0) return;
        // Fill the current line with the first result
        this.tripSheetLines[index] = resultLines[0];
        // Append any additional product lines from the same invoice
        if (resultLines.length > 1) {
          this.tripSheetLines = [
            ...this.tripSheetLines.slice(0, index + 1),
            ...resultLines.slice(1),
            ...this.tripSheetLines.slice(index + 1)
          ];
        } else {
          this.tripSheetLines = [...this.tripSheetLines];
        }
        this.toast.done(resultLines.length > 1
            ? `Loaded ${resultLines.length} product lines from ${res.invoiceNumber}`
            : `Loaded details from ${res.invoiceNumber}`);
      },
      error: () => {
        this.lineLookupBusy = { ...this.lineLookupBusy, [index]: false };
        this.toast.error('Invoice lookup failed');
      }
    });
  }

  /** Confirm/normalise a line's delivery address via Google Maps geocoding. */
  verifyLineAddress(index: number): void {
    const line = this.tripSheetLines[index];
    const addr = [line?.address, line?.city, line?.province].filter(Boolean).join(', ');
    if (!addr) {
      this.toast.warn('Enter an address first');
      return;
    }
    this.lineGeocodeBusy = { ...this.lineGeocodeBusy, [index]: true };
    this.http.get<any>(`${this.apiUrl}/logistics/googlemaps/geocode?address=${encodeURIComponent(addr + ', South Africa')}`).subscribe({
      next: (res) => {
        this.lineGeocodeBusy = { ...this.lineGeocodeBusy, [index]: false };
        if (res?.success) {
          if (res.formattedAddress) this.tripSheetLines[index].address = res.formattedAddress;
          if (res.city) this.tripSheetLines[index].city = res.city;
          if (res.province) this.tripSheetLines[index].province = res.province;
          this.tripSheetLines = [...this.tripSheetLines];
          this.lineAddressConfirmed = { ...this.lineAddressConfirmed, [index]: true };
          this.toast.done('Address confirmed via Google Maps');
        } else {
          this.toast.warn(res?.error || 'Could not confirm this address');
        }
      },
      error: () => {
        this.lineGeocodeBusy = { ...this.lineGeocodeBusy, [index]: false };
        this.toast.error('Address verification failed');
      }
    });
  }


  private newTripSheetLine(): SalesTripSheetLine {
    return { customerName: '', invoiceNumber: '', address: '', city: '', province: '', contactPerson: '', contactPhone: '', productDescription: '', quantity: 0, value: 0 };
  }

  addTripSheetLine(): void {
    this.tripSheetLines = [...this.tripSheetLines, this.newTripSheetLine()];
  }

  removeTripSheetLine(index: number): void {
    this.tripSheetLines = this.tripSheetLines.filter((_, i) => i !== index);
    if (this.tripSheetLines.length === 0) this.tripSheetLines = [this.newTripSheetLine()];
  }

  /** Reorder delivery stops via drag & drop (Google-Maps-style itinerary). */
  dropTripSheetLine(event: CdkDragDrop<SalesTripSheetLine[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const lines = [...this.tripSheetLines];
    moveItemInArray(lines, event.previousIndex, event.currentIndex);
    this.tripSheetLines = lines;
    // Keep the per-line UI state maps in sync with the new order.
    this.lineAddressConfirmed = this.remapLineState(this.lineAddressConfirmed, event.previousIndex, event.currentIndex);
    this.lineGeocodeBusy = this.remapLineState(this.lineGeocodeBusy, event.previousIndex, event.currentIndex);
    this.lineLookupBusy = this.remapLineState(this.lineLookupBusy, event.previousIndex, event.currentIndex);
  }

  /** Move a boolean index-keyed state map to match a moved array item. */
  private remapLineState(state: { [k: number]: boolean }, from: number, to: number): { [k: number]: boolean } {
    const orig: boolean[] = [];
    for (let i = 0; i < this.tripSheetLines.length; i++) orig[i] = !!state[i];
    moveItemInArray(orig, from, to);
    const result: { [k: number]: boolean } = {};
    orig.forEach((v, i) => { if (v) result[i] = true; });
    return result;
  }

  get tripSheetDialogTotal(): number {
    return this.tripSheetLines.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
  }

  saveTripSheet(): void {
    const lines = this.tripSheetLines.filter(l => (l.customerName || '').trim() || (l.invoiceNumber || '').trim());
    if (lines.length === 0) {
      this.toast.warn('Add at least one delivery line (customer or invoice).');
      return;
    }
    this.savingTripSheet = true;
    const payload = {
      warehouseCode: this.tripSheetForm.warehouseCode || null,
      routeArea: this.tripSheetForm.routeArea || null,
      scheduledDate: this.tripSheetForm.scheduledDate || null,
      notes: this.tripSheetForm.notes || null,
      createdByName: this.currentUserName || null,
      signerUserId: this.tripSheetSignerId,
      signerName: this.agentDisplayName(this.tripSheetSignerId) || this.currentUserName || null,
      approverUserId: this.tripSheetApproverId,
      approverName: this.agentDisplayName(this.tripSheetApproverId) || null,
      lines: lines.map(l => ({
        customerName: l.customerName || null,
        invoiceNumber: l.invoiceNumber || null,
        address: l.address || null,
        city: l.city || null,
        province: l.province || null,
        contactPerson: l.contactPerson || null,
        contactPhone: l.contactPhone || null,
        productDescription: l.productDescription || null,
        quantity: Number(l.quantity) || 0,
        value: Number(l.value) || 0
      }))
    };

    const req = this.editingTripSheetId
      ? this.http.put<SalesTripSheet>(`${this.tripSheetApi}/${this.editingTripSheetId}`, payload)
      : this.http.post<SalesTripSheet>(this.tripSheetApi, payload);

    req.subscribe({
      next: () => {
        this.savingTripSheet = false;
        this.toast.done(this.editingTripSheetId ? 'Trip sheet updated' : 'Trip sheet created — awaiting approval by another agent');
        this.closeTripSheetDialog();
        this.loadSalesTripSheets();
      },
      error: (err) => {
        this.savingTripSheet = false;
        this.toast.error(err?.error?.error || 'Failed to save trip sheet');
      }
    });
  }

  viewTripSheet(sheet: SalesTripSheet): void {
    this.viewingTripSheet = sheet;
    this.approvalNotes = '';
    this.rejectionReason = '';
  }

  closeViewTripSheet(): void {
    this.viewingTripSheet = null;
  }

  signTripSheet(sheet: SalesTripSheet): void {
    if (!this.canSignTripSheet(sheet)) {
      this.toast.warn('Only the designated signer can sign this trip sheet.');
      return;
    }
    this.http.post<SalesTripSheet>(`${this.tripSheetApi}/${sheet.id}/sign`, {
      signedByName: this.currentUserName || null
    }).subscribe({
      next: () => {
        this.toast.done('Trip sheet signed — now awaiting approval');
        this.closeViewTripSheet();
        this.loadSalesTripSheets();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to sign trip sheet')
    });
  }

  approveTripSheet(sheet: SalesTripSheet): void {
    if (!this.canApproveTripSheet(sheet)) {
      this.toast.warn('You cannot approve your own trip sheet — it must be checked by a different sales agent.');
      return;
    }
    this.http.post<SalesTripSheet>(`${this.tripSheetApi}/${sheet.id}/approve`, {
      checkedByName: this.currentUserName || null,
      approvalNotes: this.approvalNotes || null
    }).subscribe({
      next: () => {
        this.toast.done('Trip sheet approved & sent to Logistics');
        this.closeViewTripSheet();
        this.loadSalesTripSheets();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to approve trip sheet')
    });
  }

  rejectTripSheet(sheet: SalesTripSheet): void {
    this.http.post<SalesTripSheet>(`${this.tripSheetApi}/${sheet.id}/reject`, {
      reason: this.rejectionReason || null
    }).subscribe({
      next: () => {
        this.toast.done('Trip sheet rejected');
        this.closeViewTripSheet();
        this.loadSalesTripSheets();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to reject trip sheet')
    });
  }

  async deleteTripSheet(sheet: SalesTripSheet): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete trip sheet ${sheet.tripSheetNumber}?`,
      message: 'The trip sheet is deleted and removed from the list.',
      confirmText: 'Delete trip sheet',
      danger: true
    }))) return;
    this.http.delete(`${this.tripSheetApi}/${sheet.id}`).subscribe({
      next: () => {
        this.toast.done('Trip sheet deleted');
        this.loadSalesTripSheets();
      },
      error: (err) => this.toast.error(err?.error?.error || 'Failed to delete trip sheet')
    });
  }

  tripSheetStatusLabel(status: string): string {
    switch (status) {
      case 'PendingSignature': return 'To Sign';
      case 'PendingApproval': return 'Awaiting Approval';
      case 'Approved': return 'Approved';
      case 'Rejected': return 'Rejected';
      default: return status;
    }
  }

  loadInvoices(): void {
    this.loadingInvoices.set(true);
    this.http.get<Invoice[]>(`${this.apiUrl}/logistics/importedinvoices?pageSize=10000`, { observe: 'response' }).subscribe({
      next: (response) => {
        this.invoices.set(response.body || []);
        const invTotal = parseInt(response.headers.get('X-Total-Count') || '0', 10);
        this.totalInvoiceCount = invTotal;
        this.loadingInvoices.set(false);
        this.updateStats();
      },
      error: (err) => {
        console.error('Failed to load invoices:', err);
        this.loadingInvoices.set(false);
        this.toast.error('Failed to load invoices');
      }
    });
  }

  loadOrders(): void {
    this.loadingOrders.set(true);
    // Load incoming order emails from IMAP via backend
    const accounts = this.selectedEmailAccounts().length > 0
      ? this.selectedEmailAccounts().join(',')
      : '';
    const keyword = this.emailSearchKeyword() || 'order';
    let url = `${this.apiUrl}/emailsearch/incoming-orders?keyword=${encodeURIComponent(keyword)}&maxResults=50`;
    if (accounts) {
      url += `&accounts=${encodeURIComponent(accounts)}`;
    }

    this.http.get<IncomingOrderEmail[]>(url).subscribe({
      next: (emails) => {
        this.incomingEmails.set(emails);
        this.loadingOrders.set(false);
        this.updateStats();
        this.checkInitialLoadComplete();
      },
      error: (err) => {
        console.error('Failed to load incoming order emails:', err);
        this.incomingEmails.set([]);
        this.loadingOrders.set(false);
        this.updateStats();
        this.checkInitialLoadComplete();
        this.toast.error('Failed to load incoming emails. Check IMAP connection.');
      }
    });
  }

  loadEmailAccounts(): void {
    this.http.get<string[]>(`${this.apiUrl}/emailsearch/accounts`).subscribe({
      next: (accounts) => {
        this.emailAccounts.set(accounts);
      },
      error: (err) => {
        console.error('Failed to load email accounts:', err);
      }
    });
  }

  // Back order pagination helper
  onBackOrderPageSizeChange(size: number): void {
    this.backOrderPageSize.set(size);
    this.backOrderPage.set(0);
  }

  updateStats(): void {
    // Calculate stats from loaded data
    const customers = this.customers();
    const invoices = this.invoices();
    const emails = this.incomingEmails();

    this.stats.set({
      // Use totalCustomerCount from API header for accurate total, fallback to loaded customers length
      totalCustomers: this.totalCustomerCount > 0 ? this.totalCustomerCount : customers.length,
      activeCustomers: customers.filter(c => c.status === 'Active').length,
      totalInvoices: this.totalInvoiceCount > 0 ? this.totalInvoiceCount : invoices.length,
      pendingInvoices: invoices.filter(i => i.status === 'Pending').length,
      totalRevenue: invoices.reduce((sum, i) => sum + (i.salesAmount || 0), 0),
      monthlyRevenue: invoices
        .filter(i => new Date(i.transactionDate).getMonth() === new Date().getMonth())
        .reduce((sum, i) => sum + (i.salesAmount || 0), 0),
      incomingOrders: emails.length,
      processingOrders: emails.filter(e => !e.isRead).length
    });
  }

  formatCurrency(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toFixed(0);
  }

  calculateMargin(sales: number, cost: number): number {
    if (sales === 0) return 0;
    return ((sales - cost) / sales) * 100;
  }

  // Customer methods
  openCustomerDialog(customer?: Customer): void {
    this.toast.info('Customer dialog coming soon');
  }

  editCustomer(customer: Customer): void {
    this.toast.info('Edit customer: ' + customer.name);
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.showCustomerSidebar = true;
  }

  viewCustomerInvoices(customer: Customer): void {
    this.showCustomerSidebar = false;
    this.router.navigate(['/sales/invoices'], { queryParams: { q: customer.customerCode || customer.name } });
  }

  geocodeCustomer(customer: Customer): void {
    this.toast.info('Geocoding address...');
    // Call geocode API
    this.http.post(`${this.apiUrl}/logistics/googlemaps/geocode-customer/${customer.id}`, {}).subscribe({
      next: () => {
        this.toast.done('Address geocoded successfully');
        this.loadCustomers();
      },
      error: () => {
        this.toast.error('Failed to geocode address');
      }
    });
  }

  createOrderForCustomer(customer: Customer): void {
    this.toast.info('Create order for: ' + customer.name);
  }

  viewCustomerHistory(customer: Customer): void {
    this.toast.info('View history for: ' + customer.name);
  }

  async deleteCustomer(customer: Customer): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete customer ${customer.name}?`,
      message: 'The customer record is deleted.',
      confirmText: 'Delete customer',
      danger: true
    })) {
      this.http.delete(`${this.apiUrl}/logistics/customers/${customer.id}`).subscribe({
        next: () => {
          this.toast.done('Customer deleted');
          this.loadCustomers();
        },
        error: () => {
          this.toast.error('Failed to delete customer');
        }
      });
    }
  }

  openInMaps(customer: Customer): void {
    if (customer.latitude && customer.longitude) {
      window.open(`https://www.google.com/maps?q=${customer.latitude},${customer.longitude}`, '_blank');
    }
  }

  // Invoice methods
  openInvoiceDialog(invoice?: Invoice): void {
    this.toast.info('Invoice capture dialog coming soon');
  }

  editInvoice(invoice: Invoice): void {
    this.editingInvoiceId = invoice.id;
    const txDate = invoice.transactionDate ? new Date(invoice.transactionDate) : new Date();
    const dateStr = txDate.getFullYear() + '-' + String(txDate.getMonth() + 1).padStart(2, '0') + '-' + String(txDate.getDate()).padStart(2, '0');
    this.editInvoiceForm = {
      transactionNumber: invoice.transactionNumber || '',
      customerNumber: invoice.customerNumber || '',
      customerName: invoice.customerName || '',
      productCode: invoice.productCode || '',
      productDescription: invoice.productDescription || '',
      quantity: invoice.quantity || 0,
      salesAmount: invoice.salesAmount || 0,
      costOfSales: invoice.costOfSales || 0,
      transactionDate: dateStr,
      status: invoice.status || 'Pending',
      deliveryProvince: invoice.deliveryProvince || '',
      deliveryAddress: invoice.deliveryAddress || '',
      sourceCompany: invoice.sourceCompany || ''
    };
    this.showEditInvoiceDialog = true;
  }

  closeEditInvoiceDialog(): void {
    this.showEditInvoiceDialog = false;
    this.editingInvoiceId = null;
    this.editInvoiceSaving = false;
  }

  saveEditedInvoice(): void {
    if (!this.editingInvoiceId) return;
    this.editInvoiceSaving = true;
    const payload: any = {
      transactionNumber: this.editInvoiceForm.transactionNumber,
      customerNumber: this.editInvoiceForm.customerNumber,
      customerName: this.editInvoiceForm.customerName,
      productCode: this.editInvoiceForm.productCode,
      productDescription: this.editInvoiceForm.productDescription,
      quantity: Number(this.editInvoiceForm.quantity),
      salesAmount: Number(this.editInvoiceForm.salesAmount),
      costOfSales: Number(this.editInvoiceForm.costOfSales),
      transactionDate: this.editInvoiceForm.transactionDate ? new Date(this.editInvoiceForm.transactionDate).toISOString() : null,
      status: this.editInvoiceForm.status,
      deliveryProvince: this.editInvoiceForm.deliveryProvince,
      deliveryAddress: this.editInvoiceForm.deliveryAddress,
      sourceCompany: this.editInvoiceForm.sourceCompany
    };
    this.http.put(`${this.apiUrl}/logistics/importedinvoices/${this.editingInvoiceId}`, payload).subscribe({
      next: () => {
        this.toast.done('Invoice updated successfully');
        this.closeEditInvoiceDialog();
        this.loadInvoices();
      },
      error: (err) => {
        console.error('Failed to update invoice:', err);
        this.toast.error('Failed to update invoice');
        this.editInvoiceSaving = false;
      }
    });
  }

  sendToLogistics(invoice: Invoice): void {
    // Open delivery dialog with this invoice pre-selected
    this.openDeliveryRequestDialog();
    this.toggleDeliveryInvoice(invoice);
  }

  showDeliveryPasswordPrompt(invoice?: Invoice): void {
    this.deliveryPasswordInput = '';
    this.deliveryPasswordError = '';
    this.pendingDeliveryInvoice = invoice || null;
    this.showDeliveryPasswordDialog = true;
  }

  verifyDeliveryPassword(): void {
    if (this.deliveryPasswordInput === this.DELIVERY_PASSWORD) {
      this.showDeliveryPasswordDialog = false;
      this.deliveryPasswordInput = '';
      this.deliveryPasswordError = '';
      if (this.pendingDeliveryInvoice) {
        this.sendToLogistics(this.pendingDeliveryInvoice);
        this.pendingDeliveryInvoice = null;
      } else {
        this.openDeliveryRequestDialog();
      }
    } else {
      this.deliveryPasswordError = 'Incorrect password. Please try again.';
      this.deliveryPasswordInput = '';
    }
  }

  cancelDeliveryPassword(): void {
    this.showDeliveryPasswordDialog = false;
    this.deliveryPasswordInput = '';
    this.deliveryPasswordError = '';
    this.pendingDeliveryInvoice = null;
  }

  // ── Delivery Request Dialog Methods ──

  openDeliveryRequestDialog(): void {
    this.resetDeliveryForm();
    this.showDeliveryDialog = true;
    // Pre-populate filtered list with all pending invoices
    this.deliveryFilteredInvoices = this.invoices().filter(i => i.status !== 'Delivered').slice(0, 50);
  }

  closeDeliveryDialog(): void {
    this.showDeliveryDialog = false;
    this.deliveryError = '';
    this.deliverySuccess = false;
  }

  resetDeliveryForm(): void {
    this.deliveryInvoiceSearch = '';
    this.deliverySelectedInvoices = [];
    this.deliveryFilteredInvoices = [];
    this.deliveryError = '';
    this.deliverySuccess = false;
    this.deliverySuccessMsg = '';
    this.deliverySuccessRef = '';
    this.deliverySaving = false;
    this.deliveryForm = {
      priority: 'Urgent',
      quantity: 0,
      description: '',
      deliveryAddress: '',
      notes: ''
    };
  }

  filterDeliveryInvoices(): void {
    const search = this.deliveryInvoiceSearch.toLowerCase().trim();
    if (!search) {
      this.deliveryFilteredInvoices = this.invoices().filter(i => i.status !== 'Delivered').slice(0, 50);
      return;
    }
    this.deliveryFilteredInvoices = this.invoices().filter(inv =>
      inv.status !== 'Delivered' && (
        inv.transactionNumber?.toLowerCase().includes(search) ||
        inv.customerName?.toLowerCase().includes(search) ||
        inv.productDescription?.toLowerCase().includes(search) ||
        inv.customerNumber?.toLowerCase().includes(search) ||
        inv.deliveryProvince?.toLowerCase().includes(search)
      )
    ).slice(0, 50);
  }

  toggleDeliveryInvoice(inv: Invoice): void {
    const idx = this.deliverySelectedInvoices.findIndex(i => i.id === inv.id);
    if (idx >= 0) {
      this.deliverySelectedInvoices = this.deliverySelectedInvoices.filter(i => i.id !== inv.id);
    } else {
      this.deliverySelectedInvoices = [...this.deliverySelectedInvoices, inv];
    }
    // Auto-fill quantity from selected invoices
    this.deliveryForm.quantity = this.deliverySelectedInvoices.reduce((sum, i) => sum + i.quantity, 0);
    // Auto-fill delivery address from first selected invoice's customer
    if (this.deliverySelectedInvoices.length > 0 && !this.deliveryForm.deliveryAddress) {
      const first = this.deliverySelectedInvoices[0];
      if (first.deliveryAddress) this.deliveryForm.deliveryAddress = first.deliveryAddress;
    }
  }

  removeDeliveryInvoice(inv: Invoice): void {
    this.deliverySelectedInvoices = this.deliverySelectedInvoices.filter(i => i.id !== inv.id);
    this.deliveryForm.quantity = this.deliverySelectedInvoices.reduce((sum, i) => sum + i.quantity, 0);
  }

  isInvoiceSelected(inv: Invoice): boolean {
    return this.deliverySelectedInvoices.some(i => i.id === inv.id);
  }

  getDeliveryTotalValue(): number {
    return this.deliverySelectedInvoices.reduce((sum, i) => sum + (i.salesAmount * 1.15), 0);
  }

  submitDeliveryRequest(): void {
    if (this.deliverySelectedInvoices.length === 0 || !this.deliveryForm.description) return;

    this.deliverySaving = true;
    this.deliveryError = '';

    const invoiceNumbers = this.deliverySelectedInvoices.map(i => i.transactionNumber).join(', ');
    const customerNames = [...new Set(this.deliverySelectedInvoices.map(i => i.customerName))].join(', ');

    const payload = {
      department: 'Sales',
      invoiceNumber: invoiceNumbers,
      description: this.deliveryForm.description,
      quantity: this.deliveryForm.quantity || this.deliverySelectedInvoices.length,
      uom: 'INVOICES',
      deliveryAddress: this.deliveryForm.deliveryAddress || '',
      notes: this.deliveryForm.notes ? `${this.deliveryForm.notes} | Customers: ${customerNames}` : `Customers: ${customerNames}`,
      priority: this.deliveryForm.priority,
      requestedBy: 'Sales Department'
    };

    this.http.post<any>(`${this.apiUrl}/condomproject/delivery-requests`, payload).subscribe({
      next: (res) => {
        this.deliverySaving = false;
        this.deliverySuccess = true;
        this.deliverySuccessRef = res?.referenceNumber || 'Submitted';
        this.deliverySuccessMsg = `${this.deliverySelectedInvoices.length} invoice(s) sent to logistics for ${this.deliveryForm.priority.toLowerCase()} delivery`;
        this.toast.done('Delivery request submitted');
      },
      error: (err) => {
        this.deliverySaving = false;
        this.deliveryError = err.error?.error || 'Failed to submit delivery request';
      }
    });
  }

  printInvoice(invoice: Invoice): void {
    this.toast.info('Printing invoice...');
  }

  emailInvoice(invoice: Invoice): void {
    this.toast.info('Emailing invoice...');
  }

  duplicateInvoice(invoice: Invoice): void {
    this.toast.info('Duplicating invoice...');
  }

  async deleteInvoice(invoice: Invoice): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete invoice ${invoice.transactionNumber}?`,
      message: 'The imported invoice is deleted.',
      confirmText: 'Delete invoice',
      danger: true
    })) {
      this.http.delete(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}`).subscribe({
        next: () => {
          this.toast.done('Invoice deleted');
          this.loadInvoices();
        },
        error: () => {
          this.toast.error('Failed to delete invoice');
        }
      });
    }
  }

  importInvoices(): void {
    this.toast.info('Import invoices dialog coming soon');
  }

  // Order methods
  processOrder(order: Order): void {
    this.toast.info('Processing order: ' + order.orderNumber);
  }

  viewOrderDetails(order: Order): void {
    this.toast.info('View order details: ' + order.orderNumber);
  }

  createInvoiceFromOrder(order: Order): void {
    this.toast.info('Creating invoice from order...');
  }

  assignToLogistics(order: Order): void {
    this.toast.info('Assigning to logistics...');
  }

  // Email action methods
  getMailboxName(email: string): string {
    return email.split('@')[0];
  }

  viewEmailDetail(email: IncomingOrderEmail): void {
    this.pendingEmail = email;
    this.showEmailPinDialog = true;
    this.emailPinDigits.set(['', '', '']);
    this.emailPinError.set(false);
    setTimeout(() => {
      const firstInput = document.querySelector('.email-pin') as HTMLInputElement;
      firstInput?.focus();
    }, 100);
  }

  // Email PIN dialog state
  showEmailPinDialog = false;
  emailPinDigits = signal<string[]>(['', '', '']);
  emailPinError = signal(false);
  private pendingEmail: IncomingOrderEmail | null = null;
  private readonly EMAIL_PIN = '000';

  closeEmailPinDialog(): void {
    this.showEmailPinDialog = false;
    this.emailPinDigits.set(['', '', '']);
    this.emailPinError.set(false);
    this.pendingEmail = null;
  }

  onEmailPinInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (value && !/^\d$/.test(value)) { input.value = ''; return; }
    const digits = [...this.emailPinDigits()];
    digits[index] = value;
    this.emailPinDigits.set(digits);
    this.emailPinError.set(false);
    if (value && index < 2) {
      const next = document.querySelector(`[data-email-pin-index="${index + 1}"]`) as HTMLInputElement;
      next?.focus();
    }
    if (digits.every(d => d !== '')) {
      setTimeout(() => this.verifyEmailPin(), 150);
    }
  }

  onEmailPinKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const digits = [...this.emailPinDigits()];
      if (!digits[index] && index > 0) {
        const prev = document.querySelector(`[data-email-pin-index="${index - 1}"]`) as HTMLInputElement;
        prev?.focus();
        digits[index - 1] = '';
        this.emailPinDigits.set(digits);
      } else {
        digits[index] = '';
        this.emailPinDigits.set(digits);
      }
      this.emailPinError.set(false);
    } else if (event.key === 'Enter') {
      this.verifyEmailPin();
    }
  }

  onEmailPinPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    const digits = pasted.replace(/\D/g, '').split('').slice(0, 3);
    while (digits.length < 3) digits.push('');
    this.emailPinDigits.set(digits);
    if (digits.every(d => d !== '')) {
      setTimeout(() => this.verifyEmailPin(), 150);
    }
  }

  verifyEmailPin(): void {
    const entered = this.emailPinDigits().join('');
    if (entered.length < 3) return;
    if (entered === this.EMAIL_PIN) {
      const email = this.pendingEmail;
      this.closeEmailPinDialog();
      if (email) {
        this.dialog.open(EmailDetailDialogComponent, {
          width: '700px',
          maxHeight: '80vh',
          data: email
        });
      }
    } else {
      this.emailPinError.set(true);
      setTimeout(() => {
        this.emailPinDigits.set(['', '', '']);
        const first = document.querySelector('.email-pin') as HTMLInputElement;
        first?.focus();
      }, 600);
    }
  }

  copyEmailSender(email: IncomingOrderEmail): void {
    navigator.clipboard.writeText(email.fromEmail).then(() => {
      this.toast.done(`Copied: ${email.fromEmail}`);
    });
  }

  createOrderFromEmail(email: IncomingOrderEmail): void {
    this.toast.info('Create order from email: ' + email.subject);
  }

  forwardToLogistics(email: IncomingOrderEmail): void {
    this.toast.info('Forwarding email to logistics...');
  }

  async cancelOrder(order: Order): Promise<void> {
    const reason = await this.confirmDialog.askText({
      title: `Cancel order ${order.orderNumber}?`,
      label: 'Cancellation reason',
      value: 'CustomerRequest',
      confirmText: 'Cancel order',
      cancelText: 'Keep order',
      danger: true
    });
    if (!reason) return;

    this.toast.warn('Order cancellation is no longer available. Use Back Orders tab instead.');
  }

  // ============= Import Methods (Sales & Customers) =============
  showImportPasswordDialog = false;
  importPasswordDigits = signal<string[]>(['', '', '', '']);
  importPasswordError = signal(false);
  pendingImportType: 'sales' | 'customers' = 'sales';
  showCustomerImportResult = false;
  customerImportResult: any = null;
  customerImportLoading = signal(false);
  private importPasswordValue = '';
  private readonly IMPORT_ACCESS_CODE = '0000';

  promptImportPassword(type: 'sales' | 'customers'): void {
    this.pendingImportType = type;
    this.showImportPasswordDialog = true;
    this.importPasswordDigits.set(['', '', '', '']);
    this.importPasswordError.set(false);
    this.importPasswordValue = '';
    setTimeout(() => {
      const firstInput = document.querySelector('.pin-digit') as HTMLInputElement;
      firstInput?.focus();
    }, 100);
  }

  closeImportPasswordDialog(): void {
    this.showImportPasswordDialog = false;
    this.importPasswordDigits.set(['', '', '', '']);
    this.importPasswordError.set(false);
    this.importPasswordValue = '';
  }

  onPinInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (value && !/^\d$/.test(value)) {
      input.value = '';
      return;
    }

    const digits = [...this.importPasswordDigits()];
    digits[index] = value;
    this.importPasswordDigits.set(digits);
    this.importPasswordError.set(false);

    if (value && index < 3) {
      const nextInput = document.querySelector(`[data-pin-index="${index + 1}"]`) as HTMLInputElement;
      nextInput?.focus();
    }

    if (digits.every(d => d !== '')) {
      setTimeout(() => this.verifyImportPassword(), 150);
    }
  }

  onPinKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace') {
      const digits = [...this.importPasswordDigits()];
      if (!digits[index] && index > 0) {
        const prevInput = document.querySelector(`[data-pin-index="${index - 1}"]`) as HTMLInputElement;
        prevInput?.focus();
        digits[index - 1] = '';
        this.importPasswordDigits.set(digits);
      } else {
        digits[index] = '';
        this.importPasswordDigits.set(digits);
      }
      this.importPasswordError.set(false);
    } else if (event.key === 'Enter') {
      this.verifyImportPassword();
    }
  }

  onPinPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pastedData = event.clipboardData?.getData('text') || '';
    const digits = pastedData.replace(/\D/g, '').split('').slice(0, 4);
    while (digits.length < 4) digits.push('');
    this.importPasswordDigits.set(digits);
    
    if (digits.every(d => d !== '')) {
      setTimeout(() => this.verifyImportPassword(), 150);
    }
  }

  verifyImportPassword(): void {
    const entered = this.importPasswordDigits().join('');
    if (entered.length < 4) return;

    if (entered === this.IMPORT_ACCESS_CODE) {
      const type = this.pendingImportType;
      this.closeImportPasswordDialog();
      this.toast.info(`Access granted - select your Excel file`);
      setTimeout(() => {
        const inputId = type === 'customers' ? '#customerFileInput' : '#salesFileInput';
        const fileInput = document.querySelector(inputId) as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
          fileInput.click();
        }
      }, 300);
    } else {
      this.importPasswordError.set(true);
      setTimeout(() => {
        this.importPasswordDigits.set(['', '', '', '']);
        const firstInput = document.querySelector('.pin-digit') as HTMLInputElement;
        firstInput?.focus();
      }, 600);
    }
  }

  // Sales file import
  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      this.toast.warn('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    const dialogRef = this.dialog.open(SalesImportDialogComponent, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      disableClose: true,
      data: {
        apiUrl: this.apiUrl,
        file: file
      } as SalesImportDialogData
    });

    dialogRef.afterClosed().subscribe((result: SalesImportDialogResult) => {
      if (result?.success && result?.committed) {
        this.toast.done(result.message || 'Sales transactions imported');
        this.loadDashboardData();
      }
    });
  }

  // Customer file import
  onCustomerFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      this.toast.warn('Please select an Excel file (.xlsx or .xls)');
      return;
    }

    this.customerImportLoading.set(true);
    this.showCustomerImportResult = true;
    this.customerImportResult = null;

    const formData = new FormData();
    formData.append('file', file);

    this.http.post(`${this.apiUrl}/logistics/customers/import/excel`, formData).subscribe({
      next: (result: any) => {
        this.customerImportLoading.set(false);
        this.customerImportResult = result;
        this.loadDashboardData();
      },
      error: (err) => {
        this.customerImportLoading.set(false);
        this.customerImportResult = {
          success: false,
          error: err.error?.error || err.error?.details || 'Import failed',
          details: err.error?.details
        };
      }
    });
  }

  closeCustomerImportResult(): void {
    this.showCustomerImportResult = false;
    this.customerImportResult = null;
  }

  // Attention dialog methods
  openAttentionDialog(): void {
    this.showAttentionDialog = true;
    this.bulkProvince = '';
  }

  closeAttentionDialog(): void {
    this.showAttentionDialog = false;
  }

  async geocodeAllCustomers(): Promise<void> {
    const customers = this.customersWithoutLocation();
    if (customers.length === 0) {
      this.toast.info('No customers need geocoding');
      return;
    }

    if (!(await this.confirmDialog.ask({
      title: `Geocode ${customers.length} customers?`,
      message: 'Their locations are looked up from their names and addresses with the Google Maps API and saved to the customer records. This may take a few minutes.',
      confirmText: 'Geocode customers'
    }))) return;

    this.isGeocoding = true;
    this.geocodeProgress = `0/${customers.length}`;

    this.http.post<any>(`${this.apiUrl}/logistics/googlemaps/geocode-customers?limit=${customers.length}&updateDatabase=true`, {}).subscribe({
      next: (result) => {
        this.isGeocoding = false;
        this.geocodeProgress = '';
        
        const message = `Geocoding complete: ${result.updated} updated, ${result.failed} failed`;
        this.toast.done(message);
        
        // Reload customers to reflect changes
        this.loadCustomers();
      },
      error: (err) => {
        this.isGeocoding = false;
        this.geocodeProgress = '';
        console.error('Geocode all failed:', err);
        this.toast.error('Geocoding failed. Please try again.');
      }
    });
  }

  geocodeCustomerFromAttention(customer: Customer): void {
    this.toast.info('Geocoding ' + customer.name + '...');
    this.http.post(`${this.apiUrl}/logistics/googlemaps/geocode-customer/${customer.id}`, {}).subscribe({
      next: () => {
        this.toast.done('Location set for ' + customer.name);
        this.loadCustomers();
      },
      error: () => {
        this.toast.error('Failed to geocode. Please set location manually.');
      }
    });
  }

  async editCustomerLocation(customer: Customer): Promise<void> {
    const address = await this.confirmDialog.askText({
      title: `Set the location for ${customer.name}`,
      label: 'Full address',
      value: customer.deliveryAddress || customer.address || '',
      hint: 'e.g. 123 Main Road, Sandton, Johannesburg, Gauteng',
      confirmText: 'Find location'
    });
    if (address === null || address.trim() === '') return;

    this.toast.info('Geocoding address...');

    // Call the geocode API
    this.http.get<any>(`${this.apiUrl}/logistics/googlemaps/geocode`, {
      params: { address: address.trim() }
    }).subscribe({
      next: (result) => {
        if (result.success && result.latitude && result.longitude) {
          // Update customer with the geocoded coordinates
          this.http.put(`${this.apiUrl}/logistics/customers/${customer.id}`, {
            ...customer,
            latitude: result.latitude,
            longitude: result.longitude,
            province: result.province || customer.province,
            city: result.city || customer.city,
            postalCode: result.postalCode || customer.postalCode
          }).subscribe({
            next: () => {
              this.toast.done(`Location set for ${customer.name}: ${result.formattedAddress || address}`);
              this.loadCustomers();
            },
            error: () => {
              this.toast.error('Failed to save location');
            }
          });
        } else {
          this.toast.warn('Could not find location for that address. Please try a more specific address.');
        }
      },
      error: () => {
        this.toast.error('Geocoding service unavailable. Please try again later.');
      }
    });
  }

  setInvoiceProvince(invoice: Invoice, province: string): void {
    this.http.put(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}/delivery`, {
      deliveryProvince: province
    }).subscribe({
      next: () => {
        this.toast.done('Province set to ' + province);
        this.loadInvoices();
      },
      error: () => {
        this.toast.error('Failed to update province');
      }
    });
  }

  bulkAssignProvince(): void {
    if (!this.bulkProvince) return;

    const invoicesToUpdate = this.invoicesWithoutProvince();
    const total = invoicesToUpdate.length;
    let completed = 0;

    this.toast.info(`Updating ${total} invoices...`);

    invoicesToUpdate.forEach(invoice => {
      this.http.put(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}/delivery`, {
        deliveryProvince: this.bulkProvince
      }).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.toast.done(`All ${total} invoices updated to ${this.bulkProvince}`);
            this.loadInvoices();
            this.bulkProvince = '';
          }
        },
        error: () => {
          completed++;
        }
      });
    });
  }

  // === Welly Fix Methods ===

  wellyFixCustomerLocations(): void {
    this.wellyCustomerFixLoading = true;
    this.showWellyCustomerReview = false;
    this.wellyCustomerFixes = [];

    const customerIds = this.customersWithoutLocation().map(c => c.id);

    this.http.post<any>(`${this.apiUrl}/logistics/googlemaps/welly-suggest-customer-fixes`, customerIds).subscribe({
      next: (response) => {
        this.wellyCustomerFixes = (response.suggestions || []).map((s: any) => ({
          ...s,
          approved: s.success // Auto-approve successful ones, user can toggle
        }));
        this.wellyCustomerFixLoading = false;
        this.showWellyCustomerReview = true;

        const fixable = this.wellyCustomerFixes.filter(f => f.success).length;
        this.toast.info(`Welly found fixes for ${fixable} of ${this.wellyCustomerFixes.length} customers`);
      },
      error: (err) => {
        this.wellyCustomerFixLoading = false;
        console.error('Welly customer fix error:', err);
        this.toast.error('Welly could not analyze customers. Please try again.');
      }
    });
  }

  applyWellyCustomerFixes(): void {
    const approved = this.wellyCustomerFixes.filter(f => f.approved && f.success);
    if (approved.length === 0) {
      this.toast.warn('No fixes approved to apply');
      return;
    }

    this.wellyCustomerFixApplying = true;
    const fixes = approved.map(f => ({
      customerId: f.customerId,
      province: f.suggestedProvince,
      city: f.suggestedCity,
      postalCode: f.suggestedPostalCode,
      latitude: f.suggestedLatitude,
      longitude: f.suggestedLongitude,
      formattedAddress: f.suggestedFormattedAddress
    }));

    this.http.post<any>(`${this.apiUrl}/logistics/googlemaps/welly-apply-customer-fixes`, fixes).subscribe({
      next: (result) => {
        this.wellyCustomerFixApplying = false;
        this.showWellyCustomerReview = false;
        this.wellyCustomerFixes = [];
        this.toast.done(`Welly updated ${result.applied} customer locations` + (result.failed > 0 ? ` (${result.failed} failed)` : ''));
        this.loadCustomers();
      },
      error: () => {
        this.wellyCustomerFixApplying = false;
        this.toast.error('Failed to apply fixes. Please try again.');
      }
    });
  }

  cancelWellyCustomerReview(): void {
    this.showWellyCustomerReview = false;
    this.wellyCustomerFixes = [];
  }

  toggleAllCustomerFixes(approved: boolean): void {
    this.wellyCustomerFixes.forEach(f => {
      if (f.success) f.approved = approved;
    });
  }

  get approvedCustomerFixCount(): number {
    return this.wellyCustomerFixes.filter(f => f.approved && f.success).length;
  }

  get approvedInvoiceFixCount(): number {
    return this.wellyInvoiceFixes.filter(f => f.approved && f.success).length;
  }

  wellyFixInvoiceProvinces(): void {
    this.wellyInvoiceFixLoading = true;
    this.showWellyInvoiceReview = false;
    this.wellyInvoiceFixes = [];

    const invoiceIds = this.invoicesWithoutProvince().map(i => i.id);

    this.http.post<any>(`${this.apiUrl}/logistics/googlemaps/welly-suggest-invoice-fixes`, invoiceIds).subscribe({
      next: (response) => {
        this.wellyInvoiceFixes = (response.suggestions || []).map((s: any) => ({
          ...s,
          approved: s.success
        }));
        this.wellyInvoiceFixLoading = false;
        this.showWellyInvoiceReview = true;

        const fixable = this.wellyInvoiceFixes.filter(f => f.success).length;
        this.toast.info(`Welly found province data for ${fixable} of ${this.wellyInvoiceFixes.length} invoices`);
      },
      error: (err) => {
        this.wellyInvoiceFixLoading = false;
        console.error('Welly invoice fix error:', err);
        this.toast.error('Welly could not analyze invoices. Please try again.');
      }
    });
  }

  applyWellyInvoiceFixes(): void {
    const approved = this.wellyInvoiceFixes.filter(f => f.approved && f.success);
    if (approved.length === 0) {
      this.toast.warn('No fixes approved to apply');
      return;
    }

    this.wellyInvoiceFixApplying = true;
    const fixes = approved.map(f => ({
      invoiceId: f.invoiceId,
      province: f.suggestedProvince,
      city: f.suggestedCity
    }));

    this.http.post<any>(`${this.apiUrl}/logistics/googlemaps/welly-apply-invoice-fixes`, fixes).subscribe({
      next: (result) => {
        this.wellyInvoiceFixApplying = false;
        this.showWellyInvoiceReview = false;
        this.wellyInvoiceFixes = [];
        this.toast.done(`Welly updated ${result.applied} invoice provinces` + (result.failed > 0 ? ` (${result.failed} failed)` : ''));
        this.loadInvoices();
      },
      error: () => {
        this.wellyInvoiceFixApplying = false;
        this.toast.error('Failed to apply fixes. Please try again.');
      }
    });
  }

  cancelWellyInvoiceReview(): void {
    this.showWellyInvoiceReview = false;
    this.wellyInvoiceFixes = [];
  }

  toggleAllInvoiceFixes(approved: boolean): void {
    this.wellyInvoiceFixes.forEach(f => {
      if (f.success) f.approved = approved;
    });
  }

  // Company helper methods
  private findCompany(companyCode: string) {
    if (!companyCode) return undefined;
    const key = companyCode.trim().toLowerCase();
    return this.companies.find(c =>
      c.code.toLowerCase() === key ||
      c.name.toLowerCase() === key ||
      c.shortName.toLowerCase() === key);
  }

  /** Theme colour for a company on screen; COMPANIES keeps the brand hex for PDF and Excel output. */
  getCompanyColor(companyCode: string): string {
    const tokens: Record<string, string> = {
      PMT: 'var(--color-brand)',
      ACM: 'var(--color-cat-teal)',
      PHT: 'var(--color-cat-pink)',
      SBT: 'var(--color-cat-purple)'
    };
    return tokens[this.findCompany(companyCode)?.code ?? ''] || 'var(--color-text-3)';
  }

  getCompanyShortName(companyCode: string): string {
    return this.findCompany(companyCode)?.shortName || companyCode;
  }

  getCompanyName(companyCode: string): string {
    return this.findCompany(companyCode)?.name || companyCode;
  }

  /** Logo path for a company code/name, or null when unknown (fall back to text tag). */
  getCompanyLogo(companyCode: string): string | null {
    return this.findCompany(companyCode)?.logo || null;
  }

  // ── Sales History tab ────────────────────────────────────────────────────
  loadSalesHistory(): void {
    this.salesHistoryLoading.set(true);
    let params = `page=${this.salesHistoryPageIndex() + 1}&pageSize=${this.salesHistoryPageSize()}`;
    const search = this.salesHistorySearch().trim();
    const company = this.salesHistoryCompany();
    if (search) params += `&search=${encodeURIComponent(search)}`;
    if (company) params += `&company=${encodeURIComponent(company)}`;
    if (this.salesHistoryDetailedOnly()) params += `&detailedOnly=true`;
    if (this.salesHistoryFromDate) params += `&fromDate=${this.toIsoDate(this.salesHistoryFromDate)}`;
    if (this.salesHistoryToDate) params += `&toDate=${this.toIsoDate(this.salesHistoryToDate)}`;

    this.http.get<any>(`${this.apiUrl}/logistics/saleshistory?${params}`).subscribe({
      next: (res) => {
        this.salesHistoryRecords.set(res.items || []);
        this.salesHistoryTotalCount.set(res.totalCount || 0);
        this.salesHistoryTotalAmount.set(res.totalAmount || 0);
        this.salesHistoryTotalGrossProfit.set(res.totalGrossProfit || 0);
        this.salesHistoryAvgMargin.set(res.avgMarginPercent ?? null);
        this.salesHistoryDetailedCount.set(res.detailedCount || 0);
        this.salesHistoryCustomerCount.set(res.customerCount || 0);
        this.salesHistoryInvoiceCount.set(res.invoiceCount || 0);
        this.salesHistoryDateMin.set(res.dateMin || null);
        this.salesHistoryDateMax.set(res.dateMax || null);
        this.salesHistoryExpandedId.set(null);
        this.salesHistoryLoading.set(false);
        this.salesHistoryLoaded = true;
      },
      error: (err) => {
        console.error('Failed to load sales history', err);
        this.salesHistoryLoading.set(false);
        this.toast.error('Failed to load sales history');
      }
    });
  }

  private toIsoDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  onSalesHistoryFilterChange(): void {
    if (this.salesHistorySearchTimer) clearTimeout(this.salesHistorySearchTimer);
    this.salesHistorySearchTimer = setTimeout(() => {
      this.salesHistoryPageIndex.set(0);
      this.loadSalesHistory();
    }, 350);
  }

  clearSalesHistoryFilters(): void {
    this.salesHistorySearch.set('');
    this.salesHistoryCompany.set('');
    this.salesHistoryDetailedOnly.set(false);
    this.salesHistoryFromDate = null;
    this.salesHistoryToDate = null;
    this.salesHistoryPageIndex.set(0);
    this.loadSalesHistory();
  }

  toggleSalesHistoryDetailedOnly(): void {
    this.salesHistoryDetailedOnly.set(!this.salesHistoryDetailedOnly());
    this.salesHistoryPageIndex.set(0);
    this.loadSalesHistory();
  }

  onSalesHistoryPageChange(event: PageEvent): void {
    this.salesHistoryPageIndex.set(event.pageIndex);
    this.salesHistoryPageSize.set(event.pageSize);
    this.loadSalesHistory();
  }

  toggleSalesHistoryLines(row: SalesHistoryRow): void {
    if (this.salesHistoryExpandedId() === row.id) {
      this.salesHistoryExpandedId.set(null);
      this.salesHistoryLines.set([]);
      return;
    }
    if (!row.hasLineDetail) return;
    this.salesHistoryExpandedId.set(row.id);
    this.salesHistoryLines.set([]);
    this.salesHistoryLinesLoading.set(true);
    this.http.get<SalesHistoryLine[]>(`${this.apiUrl}/logistics/saleshistory/${row.id}/lines`).subscribe({
      next: (lines) => {
        this.salesHistoryLines.set(lines || []);
        this.salesHistoryLinesLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load line items', err);
        this.salesHistoryLinesLoading.set(false);
        this.toast.error('Failed to load product detail');
      }
    });
  }

  salesHistoryMarginClass(margin?: number | null): string {
    if (margin == null) return '';
    if (margin >= 25) return 'margin-high';
    if (margin >= 12) return 'margin-mid';
    return 'margin-low';
  }

  runSalesHistoryReconcile(): void {
    const company = this.salesHistoryCompany();
    const q = company ? `?company=${encodeURIComponent(company)}` : '';
    this.http.get<any>(`${this.apiUrl}/logistics/saleshistory/reconcile${q}`).subscribe({
      next: (res) => {
        this.salesHistoryReconcile.set({
          historyCount: res.historyCount,
          matchedCount: res.matchedCount,
          missingCount: res.missingCount,
          missingAmount: res.missingAmount,
          missingByMonth: res.missingByMonth || []
        });
      },
      error: (err) => {
        console.error('Reconcile failed', err);
        this.toast.error('Reconciliation failed');
      }
    });
  }

  /** Sales history and trip sheets load the first time their sub-page is shown. */
  private onSectionShown(slug: SalesSlug): void {
    if (slug === 'history' && !this.salesHistoryLoaded) {
      this.loadSalesHistory();
    }
    if (slug === 'trip-sheets' && !this.tripSheetsLoaded) {
      this.loadSalesTripSheets();
    }
  }

  // Company Sales Dialog Methods
  openCompanySalesDialog(company: Company): void {
    this.selectedCompanyForDialog = company;
    this.showCompanySalesDialog = true;
    this.companySalesDateRange = 'week';
    this.newSaleFormVisible = false;
    this.resetNewSaleForm();
    this.loadCompanySalesHistory();
    this.loadCompanySalesTable();
  }

  closeCompanySalesDialog(): void {
    this.showCompanySalesDialog = false;
    this.selectedCompanyForDialog = null;
  }

  loadCompanySalesHistory(): void {
    if (!this.selectedCompanyForDialog) return;
    
    const invoices = this.invoices().filter(inv => 
      inv.sourceCompany === this.selectedCompanyForDialog!.code
    );
    
    // Actual calendar days to show based on selection
    const calendarDays = this.companySalesDateRange === 'week' ? 7 : 
                         this.companySalesDateRange === 'month' ? 30 : 90;
    
    const historyData: { date: string; label: string; total: number; count: number }[] = [];
    const today = new Date();
    
    for (let daysBack = calendarDays - 1; daysBack >= 0; daysBack--) {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      const dayInvoices = invoices.filter(inv => {
        const d = new Date(inv.transactionDate);
        const invDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return invDateStr === dateStr;
      });
      
      const label = calendarDays <= 7 ? 
        date.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' }) :
        date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
      
      historyData.push({
        date: date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
        label: label,
        total: dayInvoices.reduce((sum, inv) => sum + (inv.salesAmount || 0), 0),
        count: dayInvoices.length
      });
    }
    
    this.companySalesHistoryData = historyData;
  }

  loadCompanySalesTable(): void {
    if (!this.selectedCompanyForDialog) return;
    
    this.companySalesTableData = this.invoices()
      .filter(inv => inv.sourceCompany === this.selectedCompanyForDialog!.code)
      .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime())
      .slice(0, 50);
  }

  updateCompanySalesChart(): void {
    this.loadCompanySalesHistory();
  }

  getCompanySalesForPeriod(period: 'today' | 'week' | 'month' | 'quarter'): { total: number; count: number } {
    if (!this.selectedCompanyForDialog) return { total: 0, count: 0 };
    
    const invoices = this.invoices().filter(inv => 
      inv.sourceCompany === this.selectedCompanyForDialog!.code
    );
    
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    let startDate: Date;
    switch (period) {
      case 'today':
        startDate = startOfToday;
        break;
      case 'week':
        startDate = new Date(startOfToday);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(startOfToday);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'quarter':
        startDate = new Date(startOfToday);
        startDate.setDate(startDate.getDate() - 90);
        break;
    }
    
    const filteredInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.transactionDate);
      return invDate >= startDate;
    });
    
    return {
      total: filteredInvoices.reduce((sum, inv) => sum + (inv.salesAmount || 0), 0),
      count: filteredInvoices.length
    };
  }

  getBarHeight(value: number): number {
    if (!this.companySalesHistoryData.length) return 0;
    const max = Math.max(...this.companySalesHistoryData.map(d => d.total));
    if (max === 0) return 5;
    return Math.max(5, (value / max) * 100);
  }

  formatCurrencyFull(value: number): string {
    return value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  toggleNewSaleForm(): void {
    this.newSaleFormVisible = !this.newSaleFormVisible;
    if (!this.newSaleFormVisible) {
      this.resetNewSaleForm();
    }
  }

  resetNewSaleForm(): void {
    this.newSaleForm = {
      transactionNumber: '',
      customerName: '',
      productDescription: '',
      quantity: 1,
      salesAmount: 0,
      transactionDate: new Date()
    };
  }

  saveSale(): void {
    if (!this.selectedCompanyForDialog || !this.newSaleForm.customerName || !this.newSaleForm.salesAmount) {
      return;
    }
    
    const newInvoice = {
      sourceCompany: this.selectedCompanyForDialog.code,
      transactionNumber: this.newSaleForm.transactionNumber || `SALE-${Date.now()}`,
      customerName: this.newSaleForm.customerName,
      productDescription: this.newSaleForm.productDescription,
      quantity: this.newSaleForm.quantity,
      salesAmount: this.newSaleForm.salesAmount,
      transactionDate: this.newSaleForm.transactionDate,
      deliveryProvince: 'Gauteng',
      isProcessed: false
    };
    
    this.http.post(`${this.apiUrl}/logistics/importedinvoices`, newInvoice).subscribe({
      next: () => {
        this.toast.done('Sale captured successfully');
        this.loadInvoices();
        this.newSaleFormVisible = false;
        this.resetNewSaleForm();
        // Refresh dialog data after a short delay
        setTimeout(() => {
          this.loadCompanySalesHistory();
          this.loadCompanySalesTable();
        }, 500);
      },
      error: () => {
        this.toast.error('Failed to capture sale');
      }
    });
  }

  // Export Date Picker Methods
  openExportDatePicker(type: 'excel' | 'pdf'): void {
    this.exportType = type;
    this.exportFromDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    this.exportToDate = new Date();
    this.showExportDatePicker = true;
    this.exportGenerating = false;
  }

  closeExportDatePicker(): void {
    this.showExportDatePicker = false;
    this.exportGenerating = false;
  }

  setExportRange(range: 'week' | 'month' | 'quarter' | 'year'): void {
    const today = new Date();
    this.exportToDate = new Date(today);
    switch (range) {
      case 'week':
        this.exportFromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
        break;
      case 'month':
        this.exportFromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        this.exportFromDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
        break;
      case 'year':
        this.exportFromDate = new Date(today.getFullYear(), 0, 1);
        break;
    }
  }

  executeExport(): void {
    if (this.exportType === 'excel') {
      this.exportCompanySalesExcel();
    } else {
      this.exportCompanySalesPdf();
    }
  }

  private getExportInvoices(): Invoice[] {
    if (!this.selectedCompanyForDialog) return [];
    const from = new Date(this.exportFromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(this.exportToDate);
    to.setHours(23, 59, 59, 999);

    return this.invoices()
      .filter(inv => inv.sourceCompany === this.selectedCompanyForDialog!.code)
      .filter(inv => {
        const d = new Date(inv.transactionDate);
        return d >= from && d <= to;
      })
      .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
  }

  async exportCompanySalesExcel(): Promise<void> {
    if (!this.selectedCompanyForDialog) return;
    this.exportGenerating = true;

    try {
      const XLSX = await import('xlsx');
      const invoices = this.getExportInvoices();
      const companyName = this.selectedCompanyForDialog.name;
      const fromStr = this.exportFromDate.toLocaleDateString('en-ZA');
      const toStr = this.exportToDate.toLocaleDateString('en-ZA');

      // Build rows
      const rows: any[][] = [
        [`${companyName} — Sales Report`],
        [`Period: ${fromStr} to ${toStr}`],
        [`Generated: ${new Date().toLocaleString('en-ZA')}`],
        [],
        ['Date', 'Transaction #', 'Customer #', 'Customer Name', 'Product Code', 'Product Description', 'Qty', 'Sales Amount (excl VAT)', 'VAT (15%)', 'Total (incl VAT)', 'Cost of Sales', 'Margin']
      ];

      let totalSales = 0;
      let totalVAT = 0;
      let totalInclVAT = 0;
      let totalCost = 0;

      for (const inv of invoices) {
        const salesAmt = inv.salesAmount || 0;
        const vat = salesAmt * 0.15;
        const inclVAT = salesAmt + vat;
        const cost = inv.costOfSales || 0;
        const margin = salesAmt > 0 ? ((salesAmt - cost) / salesAmt * 100) : 0;

        totalSales += salesAmt;
        totalVAT += vat;
        totalInclVAT += inclVAT;
        totalCost += cost;

        rows.push([
          new Date(inv.transactionDate).toLocaleDateString('en-ZA'),
          inv.transactionNumber || '',
          inv.customerNumber || '',
          inv.customerName || '',
          inv.productCode || '',
          inv.productDescription || '',
          inv.quantity || 0,
          salesAmt,
          vat,
          inclVAT,
          cost,
          Math.round(margin * 100) / 100
        ]);
      }

      // Totals row
      const totalMargin = totalSales > 0 ? ((totalSales - totalCost) / totalSales * 100) : 0;
      rows.push([]);
      rows.push([
        '', '', '', '', '', 'TOTALS:', invoices.reduce((s, i) => s + (i.quantity || 0), 0),
        totalSales, totalVAT, totalInclVAT, totalCost, Math.round(totalMargin * 100) / 100
      ]);
      rows.push([
        '', '', '', '', '', `Total Invoices: ${invoices.length}`
      ]);

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Column widths
      ws['!cols'] = [
        { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 28 }, { wch: 14 },
        { wch: 32 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
        { wch: 16 }, { wch: 10 }
      ];

      // Format number cells
      const numFmt = '#,##0.00';
      for (let r = 5; r < rows.length; r++) {
        for (let c = 7; c <= 11; c++) {
          const cell = XLSX.utils.encode_cell({ r, c });
          if (ws[cell] && typeof ws[cell].v === 'number') {
            ws[cell].z = numFmt;
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Report');
      const filename = `${this.selectedCompanyForDialog.shortName}_Sales_${this.exportFromDate.toISOString().split('T')[0]}_to_${this.exportToDate.toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      this.toast.done(`Excel exported: ${invoices.length} invoices`);
      this.closeExportDatePicker();
    } catch (err) {
      console.error('Excel export error:', err);
      this.toast.error('Failed to export Excel');
      this.exportGenerating = false;
    }
  }

  async exportCompanySalesPdf(): Promise<void> {
    if (!this.selectedCompanyForDialog) return;
    this.exportGenerating = true;

    try {
      const { jsPDF } = await import('jspdf');
      const invoices = this.getExportInvoices();
      const company = this.selectedCompanyForDialog;
      const fromStr = this.exportFromDate.toLocaleDateString('en-ZA');
      const toStr = this.exportToDate.toLocaleDateString('en-ZA');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      // --- Header ---
      pdf.setFillColor(26, 35, 126);
      pdf.rect(0, 0, pageWidth, 32, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${company.name}`, margin, 14);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Sales Report — ${fromStr} to ${toStr}`, margin, 22);
      pdf.setFontSize(8);
      pdf.text(`Generated: ${new Date().toLocaleString('en-ZA')}`, margin, 28);
      y = 40;

      // --- Summary Cards ---
      const totalSales = invoices.reduce((s, i) => s + (i.salesAmount || 0), 0);
      const totalCost = invoices.reduce((s, i) => s + (i.costOfSales || 0), 0);
      const totalVAT = totalSales * 0.15;
      const totalInclVAT = totalSales + totalVAT;
      const avgPerInvoice = invoices.length > 0 ? totalSales / invoices.length : 0;
      const margin_pct = totalSales > 0 ? ((totalSales - totalCost) / totalSales * 100) : 0;

      const cardData = [
        { label: 'Total Invoices', value: invoices.length.toString() },
        { label: 'Sales (excl VAT)', value: `R ${this.formatCurrencyFull(totalSales)}` },
        { label: 'Total (incl VAT)', value: `R ${this.formatCurrencyFull(totalInclVAT)}` },
        { label: 'Avg per Invoice', value: `R ${this.formatCurrencyFull(avgPerInvoice)}` },
        { label: 'Cost of Sales', value: `R ${this.formatCurrencyFull(totalCost)}` },
        { label: 'Margin', value: `${margin_pct.toFixed(1)}%` }
      ];

      const cardWidth = (pageWidth - margin * 2 - 10) / 3;
      const cardHeight = 18;
      pdf.setFontSize(9);
      for (let i = 0; i < cardData.length; i++) {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const cx = margin + col * (cardWidth + 5);
        const cy = y + row * (cardHeight + 4);

        pdf.setFillColor(245, 245, 250);
        pdf.roundedRect(cx, cy, cardWidth, cardHeight, 2, 2, 'F');
        pdf.setDrawColor(200, 200, 220);
        pdf.roundedRect(cx, cy, cardWidth, cardHeight, 2, 2, 'S');

        pdf.setTextColor(100, 100, 100);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.text(cardData[i].label, cx + 4, cy + 6);
        pdf.setTextColor(26, 35, 126);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(cardData[i].value, cx + 4, cy + 14);
      }
      y += Math.ceil(cardData.length / 3) * (cardHeight + 4) + 6;

      // --- Daily Sales Chart ---
      pdf.setTextColor(50, 50, 50);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Daily Sales Trend', margin, y);
      y += 6;

      // Calculate daily totals
      const dailyMap = new Map<string, number>();
      for (const inv of invoices) {
        const d = new Date(inv.transactionDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        dailyMap.set(key, (dailyMap.get(key) || 0) + (inv.salesAmount || 0));
      }
      const dailyEntries = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

      if (dailyEntries.length > 0) {
        const chartWidth = pageWidth - margin * 2;
        const chartHeight = 40;
        const maxVal = Math.max(...dailyEntries.map(e => e[1]), 1);
        const barWidth = Math.min(12, (chartWidth - 20) / dailyEntries.length - 2);
        const startX = margin + 10;

        // Y-axis
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.3);
        pdf.line(startX, y, startX, y + chartHeight);
        pdf.line(startX, y + chartHeight, margin + chartWidth, y + chartHeight);

        // Bars
        for (let i = 0; i < dailyEntries.length; i++) {
          const [dateStr, val] = dailyEntries[i];
          const barHeight = (val / maxVal) * (chartHeight - 4);
          const bx = startX + 4 + i * (barWidth + 2);
          const by = y + chartHeight - barHeight;

          // Bar color from company
          const hex = company.color.replace('#', '');
          const r = parseInt(hex.substring(0, 2), 16);
          const g = parseInt(hex.substring(2, 4), 16);
          const b = parseInt(hex.substring(4, 6), 16);
          pdf.setFillColor(r, g, b);
          pdf.rect(bx, by, barWidth, barHeight, 'F');

          // Date label (rotated effect - just put at bottom)
          if (dailyEntries.length <= 31) {
            pdf.setFontSize(5);
            pdf.setTextColor(120, 120, 120);
            pdf.setFont('helvetica', 'normal');
            const label = dateStr.substring(5);
            pdf.text(label, bx, y + chartHeight + 4);
          }
        }
        y += chartHeight + 10;
      }

      // --- Invoice Table ---
      if (y > pageHeight - 60) { pdf.addPage(); y = margin; }
      pdf.setTextColor(50, 50, 50);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('Invoice Details', margin, y);
      y += 6;

      // Table header
      const colWidths = [22, 24, 42, 42, 12, 24, 16];
      const headers = ['Date', 'Trans #', 'Customer', 'Product', 'Qty', 'Amount', 'VAT Incl'];
      pdf.setFillColor(26, 35, 126);
      pdf.rect(margin, y, pageWidth - margin * 2, 7, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      let hx = margin + 2;
      for (let i = 0; i < headers.length; i++) {
        pdf.text(headers[i], hx, y + 5);
        hx += colWidths[i];
      }
      y += 7;

      // Table rows
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.5);
      let rowIdx = 0;
      for (const inv of invoices) {
        if (y > pageHeight - 20) {
          pdf.addPage();
          y = margin;
          // Re-draw header on new page
          pdf.setFillColor(26, 35, 126);
          pdf.rect(margin, y, pageWidth - margin * 2, 7, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          hx = margin + 2;
          for (let i = 0; i < headers.length; i++) {
            pdf.text(headers[i], hx, y + 5);
            hx += colWidths[i];
          }
          y += 7;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6.5);
        }

        if (rowIdx % 2 === 0) {
          pdf.setFillColor(248, 248, 252);
          pdf.rect(margin, y, pageWidth - margin * 2, 6, 'F');
        }

        pdf.setTextColor(60, 60, 60);
        hx = margin + 2;
        const rowData = [
          new Date(inv.transactionDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' }),
          (inv.transactionNumber || '').substring(0, 14),
          (inv.customerName || '').substring(0, 26),
          (inv.productDescription || '').substring(0, 26),
          (inv.quantity || 0).toString(),
          `R${this.formatCurrencyFull(inv.salesAmount || 0)}`,
          `R${this.formatCurrencyFull((inv.salesAmount || 0) * 1.15)}`
        ];
        for (let i = 0; i < rowData.length; i++) {
          pdf.text(rowData[i], hx, y + 4);
          hx += colWidths[i];
        }
        y += 6;
        rowIdx++;
      }

      // Totals row
      y += 2;
      pdf.setFillColor(26, 35, 126);
      pdf.rect(margin, y, pageWidth - margin * 2, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      hx = margin + 2;
      pdf.text(`TOTALS — ${invoices.length} invoices`, hx, y + 5.5);
      hx = margin + 2 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4];
      pdf.text(`R${this.formatCurrencyFull(totalSales)}`, hx, y + 5.5);
      hx += colWidths[5];
      pdf.text(`R${this.formatCurrencyFull(totalInclVAT)}`, hx, y + 5.5);

      // Footer
      y += 14;
      if (y > pageHeight - 10) { pdf.addPage(); y = margin; }
      pdf.setTextColor(150, 150, 150);
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(7);
      pdf.text('ProMed Technologies — Confidential', margin, y);
      pdf.text(`Page 1 of ${pdf.getNumberOfPages()}`, pageWidth - margin - 25, y);

      const filename = `${company.shortName}_Sales_Report_${this.exportFromDate.toISOString().split('T')[0]}_to_${this.exportToDate.toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);

      this.toast.done(`PDF generated: ${invoices.length} invoices`);
      this.closeExportDatePicker();
    } catch (err) {
      console.error('PDF generation error:', err);
      this.toast.error('Failed to generate PDF');
      this.exportGenerating = false;
    }
  }

  // === Company Comparison Methods ===
  openCompareDialog(): void {
    this.showCompareDialog = true;
    this.compareCompanyCode = '';
    this.compareFromDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    this.compareToDate = new Date();
    this.compareDataA = { count: 0, revenue: 0, cost: 0 };
    this.compareDataB = { count: 0, revenue: 0, cost: 0 };
    this.compareDailyData = [];
    this.compareExporting = false;
  }

  closeCompareDialog(): void {
    this.showCompareDialog = false;
  }

  getCompareOptions(): Company[] {
    if (!this.selectedCompanyForDialog) return COMPANIES;
    return COMPANIES.filter(c => c.code !== this.selectedCompanyForDialog!.code);
  }

  getCompareCompany(): Company | null {
    return COMPANIES.find(c => c.code === this.compareCompanyCode) || null;
  }

  setCompareRange(range: 'week' | 'month' | 'quarter' | 'year'): void {
    const today = new Date();
    this.compareToDate = new Date(today);
    switch (range) {
      case 'week':
        this.compareFromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
        break;
      case 'month':
        this.compareFromDate = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case 'quarter':
        this.compareFromDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
        break;
      case 'year':
        this.compareFromDate = new Date(today.getFullYear(), 0, 1);
        break;
    }
    this.loadComparisonData();
  }

  loadComparisonData(): void {
    if (!this.selectedCompanyForDialog || !this.compareCompanyCode) return;

    const from = new Date(this.compareFromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(this.compareToDate);
    to.setHours(23, 59, 59, 999);

    const allInvoices = this.invoices();
    const invoicesA = allInvoices.filter(inv =>
      inv.sourceCompany === this.selectedCompanyForDialog!.code &&
      new Date(inv.transactionDate) >= from && new Date(inv.transactionDate) <= to
    );
    const invoicesB = allInvoices.filter(inv =>
      inv.sourceCompany === this.compareCompanyCode &&
      new Date(inv.transactionDate) >= from && new Date(inv.transactionDate) <= to
    );

    this.compareDataA = {
      count: invoicesA.length,
      revenue: invoicesA.reduce((s, i) => s + (i.salesAmount || 0), 0),
      cost: invoicesA.reduce((s, i) => s + (i.costOfSales || 0), 0)
    };
    this.compareDataB = {
      count: invoicesB.length,
      revenue: invoicesB.reduce((s, i) => s + (i.salesAmount || 0), 0),
      cost: invoicesB.reduce((s, i) => s + (i.costOfSales || 0), 0)
    };

    // Build daily comparison data
    const dailyMap = new Map<string, { totalA: number; totalB: number }>();
    const msPerDay = 86400000;
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + msPerDay)) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyMap.set(key, { totalA: 0, totalB: 0 });
    }

    for (const inv of invoicesA) {
      const d = new Date(inv.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dailyMap.has(key)) {
        dailyMap.get(key)!.totalA += inv.salesAmount || 0;
      }
    }
    for (const inv of invoicesB) {
      const d = new Date(inv.transactionDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dailyMap.has(key)) {
        dailyMap.get(key)!.totalB += inv.salesAmount || 0;
      }
    }

    this.compareDailyData = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateStr, vals]) => {
        const d = new Date(dateStr);
        return {
          date: dateStr,
          label: d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
          totalA: vals.totalA,
          totalB: vals.totalB
        };
      });
  }

  getCompareBarHeight(value: number): number {
    if (!this.compareDailyData.length) return 0;
    const max = Math.max(...this.compareDailyData.map(d => Math.max(d.totalA, d.totalB)), 1);
    return Math.max(3, (value / max) * 100);
  }

  async exportComparisonExcel(): Promise<void> {
    if (!this.selectedCompanyForDialog || !this.compareCompanyCode) return;
    this.compareExporting = true;

    try {
      const XLSX = await import('xlsx');
      const companyA = this.selectedCompanyForDialog;
      const companyB = this.getCompareCompany();
      if (!companyB) return;

      const fromStr = this.compareFromDate.toLocaleDateString('en-ZA');
      const toStr = this.compareToDate.toLocaleDateString('en-ZA');

      // Summary sheet rows
      const summaryRows: any[][] = [
        [`Company Comparison Report`],
        [`${companyA.name} vs ${companyB.name}`],
        [`Period: ${fromStr} to ${toStr}`],
        [`Generated: ${new Date().toLocaleString('en-ZA')}`],
        [],
        ['Metric', companyA.shortName, companyB.shortName, 'Difference', 'Leader'],
        ['Total Invoices', this.compareDataA.count, this.compareDataB.count,
          Math.abs(this.compareDataA.count - this.compareDataB.count),
          this.compareDataA.count >= this.compareDataB.count ? companyA.shortName : companyB.shortName],
        ['Revenue (excl VAT)', this.compareDataA.revenue, this.compareDataB.revenue,
          Math.abs(this.compareDataA.revenue - this.compareDataB.revenue),
          this.compareDataA.revenue >= this.compareDataB.revenue ? companyA.shortName : companyB.shortName],
        ['Revenue (incl VAT)', this.compareDataA.revenue * 1.15, this.compareDataB.revenue * 1.15,
          Math.abs(this.compareDataA.revenue - this.compareDataB.revenue) * 1.15,
          this.compareDataA.revenue >= this.compareDataB.revenue ? companyA.shortName : companyB.shortName],
        ['Cost of Sales', this.compareDataA.cost, this.compareDataB.cost,
          Math.abs(this.compareDataA.cost - this.compareDataB.cost),
          this.compareDataA.cost <= this.compareDataB.cost ? companyA.shortName : companyB.shortName],
        ['Avg per Invoice',
          this.compareDataA.count > 0 ? this.compareDataA.revenue / this.compareDataA.count : 0,
          this.compareDataB.count > 0 ? this.compareDataB.revenue / this.compareDataB.count : 0,
          '', ''],
        ['Margin %',
          this.compareDataA.revenue > 0 ? ((this.compareDataA.revenue - this.compareDataA.cost) / this.compareDataA.revenue * 100) : 0,
          this.compareDataB.revenue > 0 ? ((this.compareDataB.revenue - this.compareDataB.cost) / this.compareDataB.revenue * 100) : 0,
          '', '']
      ];

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];

      // Daily breakdown sheet
      const dailyRows: any[][] = [
        ['Daily Revenue Comparison'],
        [`${companyA.shortName} vs ${companyB.shortName} — ${fromStr} to ${toStr}`],
        [],
        ['Date', `${companyA.shortName} Revenue`, `${companyB.shortName} Revenue`, 'Difference', 'Leader']
      ];

      for (const day of this.compareDailyData) {
        const diff = day.totalA - day.totalB;
        dailyRows.push([
          day.date,
          day.totalA,
          day.totalB,
          Math.abs(diff),
          diff >= 0 ? companyA.shortName : companyB.shortName
        ]);
      }

      dailyRows.push([]);
      dailyRows.push([
        'TOTALS',
        this.compareDataA.revenue,
        this.compareDataB.revenue,
        Math.abs(this.compareDataA.revenue - this.compareDataB.revenue),
        this.compareDataA.revenue >= this.compareDataB.revenue ? companyA.shortName : companyB.shortName
      ]);

      const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
      wsDaily['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 18 }, { wch: 16 }];

      // Invoices sheets for each company
      const buildInvoiceSheet = (companyCode: string, companyName: string) => {
        const from = new Date(this.compareFromDate); from.setHours(0, 0, 0, 0);
        const to = new Date(this.compareToDate); to.setHours(23, 59, 59, 999);
        const invoices = this.invoices()
          .filter(inv => inv.sourceCompany === companyCode && new Date(inv.transactionDate) >= from && new Date(inv.transactionDate) <= to)
          .sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

        const rows: any[][] = [
          [`${companyName} — Invoice Details`],
          [`Period: ${fromStr} to ${toStr}`],
          [],
          ['Date', 'Transaction #', 'Customer', 'Product', 'Qty', 'Amount (excl VAT)', 'VAT', 'Total (incl VAT)']
        ];

        let totalSales = 0;
        for (const inv of invoices) {
          const amt = inv.salesAmount || 0;
          totalSales += amt;
          rows.push([
            new Date(inv.transactionDate).toLocaleDateString('en-ZA'),
            inv.transactionNumber || '',
            inv.customerName || '',
            inv.productDescription || '',
            inv.quantity || 0,
            amt,
            amt * 0.15,
            amt * 1.15
          ]);
        }
        rows.push([]);
        rows.push(['', '', '', 'TOTALS', invoices.reduce((s, i) => s + (i.quantity || 0), 0), totalSales, totalSales * 0.15, totalSales * 1.15]);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 30 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 18 }];
        return ws;
      };

      const wsInvA = buildInvoiceSheet(companyA.code, companyA.name);
      const wsInvB = buildInvoiceSheet(companyB.code, companyB.name);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Breakdown');
      XLSX.utils.book_append_sheet(wb, wsInvA, `${companyA.shortName} Invoices`);
      XLSX.utils.book_append_sheet(wb, wsInvB, `${companyB.shortName} Invoices`);

      const filename = `${companyA.shortName}_vs_${companyB.shortName}_${this.compareFromDate.toISOString().split('T')[0]}_to_${this.compareToDate.toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, filename);

      this.toast.done('Comparison Excel exported');
      this.compareExporting = false;
    } catch (err) {
      console.error('Comparison export error:', err);
      this.toast.error('Failed to export comparison');
      this.compareExporting = false;
    }
  }

  // ─── POD Document Methods ────────────────────────────────────────────

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
        this.podDriverList = (summary.drivers || []).map((d: any) => d.driverName).sort();
      },
      error: (err) => console.error('Failed to load POD summary:', err)
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
        this.toast.error('Failed to open POD document');
      }
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
        this.toast.error('Failed to download POD');
      }
    });
  }

  formatPodFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  openSalesPodUploadDialog(): void {
    // Password gate for sales POD uploads
    this.showPodPasswordDialog = true;
    this.podPasswordInput = '';
    this.podPasswordError = '';
  }

  verifyPodUploadPassword(): void {
    if (this.podPasswordInput === this.POD_UPLOAD_PASSWORD) {
      this.showPodPasswordDialog = false;
      this.podPasswordInput = '';
      this.podPasswordError = '';
      // Open the actual upload dialog
      this.openPodUploadDialogAfterAuth();
    } else {
      this.podPasswordError = 'Incorrect password. Please try again.';
      this.podPasswordInput = '';
    }
  }

  cancelPodPasswordDialog(): void {
    this.showPodPasswordDialog = false;
    this.podPasswordInput = '';
    this.podPasswordError = '';
  }

  private openPodUploadDialogAfterAuth(): void {
    const dialogRef = this.dialog.open(UploadPodDocumentDialog, {
      width: '600px',
      maxWidth: '95vw',
      data: { drivers: this.podDriverList }
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result?.uploaded) {
        this.loadPodDocuments();
        this.loadPodSummary();
        const linked = result.linkedInvoiceCount ?? 0;
        const msg = linked > 0
          ? `POD uploaded — Welly linked ${linked} invoice${linked === 1 ? '' : 's'}${result.loadNumber ? ' → tripsheet ' + result.loadNumber : ''}`
          : 'POD uploaded successfully';
        this.toast.done(msg);
      }
    });
  }

  private podLabel(pod: any): string {
    const name = pod?.originalFileName || pod?.fileName;
    return name ? `POD ${name}` : 'this POD';
  }

  async openLinkTripsheetDialog(pod: any): Promise<void> {
    const title = `Link ${this.podLabel(pod)} to a tripsheet`;
    const search = await this.confirmDialog.askText({
      title,
      label: 'Tripsheet or load number',
      hint: 'Matching tripsheets are listed next',
      confirmText: 'Search'
    });
    if (!search) return;

    this.http.get<any[]>(`${this.apiUrl}/PodDocuments/search-loads?search=${encodeURIComponent(search)}`).subscribe({
      next: async (loads) => {
        if (loads.length === 0) {
          this.toast.warn('No matching tripsheets found');
          return;
        }
        const choice = await this.confirmDialog.askForm({
          title,
          message: `${loads.length} tripsheet${loads.length === 1 ? '' : 's'} match "${search}".`,
          fields: [{
            key: 'load',
            label: 'Tripsheet',
            type: 'select',
            required: true,
            options: loads.map((l, i) => ({ value: String(i), label: `${l.loadNumber} - ${l.customerName || 'N/A'} (${l.status})` }))
          }],
          confirmText: 'Link POD'
        });
        if (!choice) return;
        const idx = parseInt(String(choice['load']), 10);
        if (idx >= 0 && idx < loads.length) {
          this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/link`, { loadId: loads[idx].id }).subscribe({
            next: () => {
              this.loadPodDocuments();
              this.loadPodSummary();
              this.toast.done(`POD linked to ${loads[idx].loadNumber}`);
            },
            error: () => this.toast.error('Failed to link POD')
          });
        }
      },
      error: () => this.toast.error('Failed to search tripsheets')
    });
  }

  async delinkPod(pod: any): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: pod.loadNumber ? `Delink this POD from tripsheet ${pod.loadNumber}?` : 'Delink this POD from its tripsheet?',
      message: 'The POD will no longer be linked to the tripsheet.',
      confirmText: 'Delink POD',
      danger: true
    }))) return;

    this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/delink`, {}).subscribe({
      next: () => {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.toast.done('POD delinked from tripsheet');
      },
      error: (err) => {
        console.error('Failed to delink POD:', err);
        this.toast.error('Failed to delink POD');
      }
    });
  }

  async openLinkInvoiceDialog(pod: any): Promise<void> {
    // A single POD can be linked to multiple invoices — accept a comma/space
    // separated list of invoice numbers and link them all in one go.
    const input = await this.confirmDialog.askText({
      title: `Link ${this.podLabel(pod)} to invoices`,
      label: 'Invoice number(s)',
      hint: 'Separate multiple with a comma, e.g. IN123456, IN123457',
      confirmText: 'Link invoices'
    });
    if (!input || !input.trim()) return;

    const tokens = input.split(/[\s,;]+/).map(t => t.trim()).filter(Boolean);
    if (tokens.length === 0) return;

    // Resolve each typed number to an invoice id via search, then bulk-link.
    const lookups = tokens.map(t =>
      this.http.get<any[]>(`${this.apiUrl}/PodDocuments/search-invoices?search=${encodeURIComponent(t)}`).toPromise()
        .then(results => {
          if (!results || results.length === 0) return { token: t, id: null as number | null };
          // Prefer an exact transaction-number match, else the first result.
          const exact = results.find(r => (r.transactionNumber || '').toLowerCase() === t.toLowerCase());
          return { token: t, id: (exact || results[0]).id as number };
        })
        .catch(() => ({ token: t, id: null as number | null }))
    );

    Promise.all(lookups).then(resolved => {
      const invoiceIds = resolved.filter(r => r.id != null).map(r => r.id as number);
      const notFound = resolved.filter(r => r.id == null).map(r => r.token);

      if (invoiceIds.length === 0) {
        this.toast.warn('No matching invoices found for: ' + notFound.join(', '));
        return;
      }

      this.http.put<any>(`${this.apiUrl}/PodDocuments/${pod.id}/link-invoices`, { invoiceIds }).subscribe({
        next: (res) => {
          this.loadPodDocuments();
          this.loadPodSummary();
          const base = res?.message || `POD linked to ${invoiceIds.length} invoice(s)`;
          const warn = notFound.length ? ` · Not found: ${notFound.join(', ')}` : '';
          this.toast.done(base + warn);
        },
        error: () => this.toast.error('Failed to link POD to invoices')
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Welly POD OCR — scan a POD image, read invoice numbers, suggest links
  // ═══════════════════════════════════════════════════════════════════

  /** Scan a single POD document with Welly OCR and show suggested invoice links. */
  async wellyScanPod(pod: any): Promise<void> {
    this.wellyPodBatchMode = false;
    this.wellyPodCurrent = pod;
    this.wellyPodMatches = [];
    this.wellyPodUnmatched = [];
    this.wellyPodOcrText = '';
    this.wellyPodEmbeddedText = '';
    this.wellyPodCandidatesFound = [];
    this.wellyPodShowDebug = false;
    this.showWellyPodPanel = true;
    this.wellyPodScanning = true;
    this.wellyPodProgress = 0;
    this.wellyPodStatus = 'Fetching document…';
    this.wellyPodActivityId = this.wellyActivity.start(`Welly: scanning POD (${pod.driverName})`);

    try {
      const candidates = await this.ocrExtractInvoiceNumbers(pod);

      let res: any = null;
      if (candidates.length > 0) {
        this.wellyPodStatus = 'Matching against invoices…';
        res = await this.http
          .post(`${this.apiUrl}/PodDocuments/match-invoice-numbers`, { candidates })
          .toPromise();
      }

      // Fallback: if in-browser OCR found nothing (or matched nothing), try the
      // stronger server-side Tesseract engine — better on rotated / faint scans.
      const noMatches = !res || (res.matches?.length ?? 0) === 0;
      if (noMatches) {
        this.wellyPodStatus = 'Trying deep server scan (handles rotated / faint scans)…';
        try {
          const serverRes: any = await this.http
            .post(`${this.apiUrl}/PodDocuments/${pod.id}/server-ocr`, {})
            .toPromise();
          if ((serverRes?.matches?.length ?? 0) > 0 || (serverRes?.candidates?.length ?? 0) > 0) {
            res = serverRes;
            if (serverRes?.rawText) this.wellyPodOcrText = serverRes.rawText;
            if (serverRes?.candidates) this.wellyPodCandidatesFound = serverRes.candidates;
          }
        } catch (srvErr) {
          console.warn('Server OCR fallback unavailable:', srvErr);
        }
      }

      if (!res || ((res.matches?.length ?? 0) === 0 && (res.candidates?.length ?? 0) === 0)) {
        this.wellyPodStatus = 'No invoice numbers found on this document.';
        this.wellyPodScanning = false;
        this.finishWellyPodActivity();
        return;
      }

      this.wellyPodMatches = (res?.matches || []).map((m: any) => ({ ...m, approved: !m.alreadyLinked }));
      this.wellyPodUnmatched = res?.unmatched || [];
      this.wellyPodStatus = this.wellyPodMatches.length > 0
        ? `Welly found ${this.wellyPodMatches.length} invoice${this.wellyPodMatches.length === 1 ? '' : 's'} on this POD.`
        : 'Read some text, but none matched a known invoice number.';
    } catch (err) {
      console.error('Welly POD scan error:', err);
      this.wellyPodStatus = 'Welly could not read this document. Try a clearer scan.';
    } finally {
      this.wellyPodScanning = false;
      this.finishWellyPodActivity();
    }
  }

  /** Download the POD, render to images if needed, and OCR out IN###### tokens.
   *  INTENSIVE mode: upscales the image, applies grayscale + Otsu binarization on
   *  hard scans, and brute-forces 0/90/180/270° rotations so upside-down or sideways
   *  scans still read. Picks the orientation that yields the most invoice matches. */
  private async ocrExtractInvoiceNumbers(pod: any): Promise<string[]> {
    // 1. Fetch the file as a blob
    const blob: Blob = await this.http
      .get(`${this.apiUrl}/PodDocuments/${pod.id}/view`, { responseType: 'blob' })
      .toPromise() as Blob;

    const contentType = pod.contentType || blob.type || '';
    const imageSources: (string | Blob)[] = [];

    if (contentType.includes('pdf') || (pod.fileName || '').toLowerCase().endsWith('.pdf')) {
      this.wellyPodStatus = 'Rendering PDF pages…';
      const pages = await this.renderPdfToImages(blob);
      imageSources.push(...pages);
    } else {
      imageSources.push(blob);
    }

    if (imageSources.length === 0) return [];

    // 2. OCR each page — intensive multi-rotation + preprocessing.
    this.wellyPodStatus = 'Loading OCR engine…';
    const { createWorker } = await import('tesseract.js');
    const totalPages = imageSources.length;
    let progressPage = 0;
    const worker = await createWorker('eng', undefined, {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          this.wellyPodProgress = Math.round(((progressPage + m.progress) / totalPages) * 100);
        }
      }
    });

    let fullText = '';
    for (let i = 0; i < totalPages; i++) {
      progressPage = i;
      // Base canvas (upscaled, white background).
      const base = await this.loadToCanvas(imageSources[i]);

      // Pass 1: as-is (grayscale kept) across all rotations.
      let best = await this.ocrPageAllRotations(worker, base, i, totalPages, false);

      // Pass 2: if nothing found, binarize (Otsu) and try harder — helps faint / photographed scans.
      if (best.tokens.length === 0) {
        const bin = this.binarizeCanvas(this.cloneCanvas(base));
        const binBest = await this.ocrPageAllRotations(worker, bin, i, totalPages, true);
        if (binBest.tokens.length > best.tokens.length || binBest.conf > best.conf) best = binBest;
      }

      fullText += '\n' + best.text;
    }
    await worker.terminate();

    // Combine OCR text with any embedded PDF text layer (digital PDFs carry real text).
    const combined = ((this.wellyPodEmbeddedText || '') + '\n' + fullText).trim();

    // Keep the raw text + page count for debugging/visibility in the panel.
    this.wellyPodOcrText = combined;
    this.wellyPodPageCount = totalPages;

    const list = this.extractInvoiceTokens(combined);
    this.wellyPodCandidatesFound = list;
    return list;
  }

  /** OCR a canvas at 0/180/90/270°, returning the best-scoring orientation. */
  private async ocrPageAllRotations(
    worker: any, baseCanvas: HTMLCanvasElement, pageIdx: number, totalPages: number, binarized: boolean
  ): Promise<{ text: string; tokens: string[]; rotation: number; conf: number }> {
    const rotations = [0, 180, 90, 270];
    let best = { text: '', tokens: [] as string[], rotation: 0, conf: 0 };
    for (const deg of rotations) {
      const label = totalPages > 1 ? `page ${pageIdx + 1}/${totalPages}` : 'document';
      const rot = deg ? ` · rotated ${deg}°` : '';
      const pp = binarized ? ' · enhanced' : '';
      this.wellyPodStatus = `Reading ${label}${rot}${pp}…`;
      const canvas = this.rotateCanvas(baseCanvas, deg);
      const result: any = await worker.recognize(canvas);
      const text = result?.data?.text || '';
      const conf = result?.data?.confidence || 0;
      const tokens = this.extractInvoiceTokens(text);
      const better =
        tokens.length > best.tokens.length ||
        (tokens.length === best.tokens.length && conf > best.conf);
      if (better) best = { text, tokens, rotation: deg, conf };
      // Early exit: upright read already produced solid results — don't waste time rotating.
      if (deg === 0 && tokens.length > 0 && conf >= 70) break;
      if (tokens.length > 0 && conf >= 82) break;
    }
    return best;
  }

  /** Extract IN###### candidate tokens from noisy OCR text.
   *  Your invoices are IN######, but OCR is noisy:
   *   - the "IN" prefix letters can be misread (I↔1↔l, N↔M↔H)
   *   - digits can be letters (O↔0, S↔5, etc.) — backend corrects those
   *   - there may be spaces/dashes between the prefix and the digits */
  private extractInvoiceTokens(text: string): string[] {
    const tokens = new Set<string>();
    const upper = (text || '').toUpperCase();
    // Pattern A: IN-ish prefix followed by 5-8 digit-or-confusable chars.
    const rxPrefixed = /\b[I1L][NMH][\s.\-:]?[0-9OQDILSBZGT]{5,8}\b/g;
    // Pattern B: the literal word/label "INV" or "INVOICE" then a number.
    const rxLabeled = /INV(?:OICE)?[\s.#:\-]*([0-9OQDILSBZGT]{5,8})/g;
    // Pattern C: a bare 6-digit run (fallback — backend still validates it exists as IN######).
    const rxBare = /\b([0-9]{6})\b/g;
    let m: RegExpExecArray | null;
    while ((m = rxPrefixed.exec(upper)) !== null) tokens.add(m[0].replace(/[\s.\-:]/g, ''));
    while ((m = rxLabeled.exec(upper)) !== null) tokens.add('IN' + m[1].replace(/[\s.\-:]/g, ''));
    while ((m = rxBare.exec(upper)) !== null) tokens.add('IN' + m[1]);
    return Array.from(tokens);
  }

  /** Load an image source (data URL or Blob) into an upscaled, white-background canvas. */
  private async loadToCanvas(src: string | Blob): Promise<HTMLCanvasElement> {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      });
      // Upscale small scans so 8–10px invoice digits become legible to Tesseract.
      const minWidth = 1600;
      const scale = img.naturalWidth > 0 && img.naturalWidth < minWidth ? minWidth / img.naturalWidth : 1;
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      (ctx as any).imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
    }
  }

  private cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
    return c;
  }

  /** Grayscale + Otsu binarization for high-contrast text on noisy / photographed scans. */
  private binarizeCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const d = imageData.data;
    const total = width * height;
    const gray = new Uint8ClampedArray(total);
    const hist = new Array(256).fill(0);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
      gray[p] = g;
      hist[g]++;
    }
    // Otsu's method — find the global threshold that maximises between-class variance.
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, maxVar = 0, threshold = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      const wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > maxVar) { maxVar = between; threshold = t; }
    }
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const v = gray[p] > threshold ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /** Rotate a canvas by 0/90/180/270°, returning a new canvas (white background). */
  private rotateCanvas(src: HTMLCanvasElement, deg: number): HTMLCanvasElement {
    if (deg % 360 === 0) return src;
    const swap = deg === 90 || deg === 270;
    const w = src.width, h = src.height;
    const canvas = document.createElement('canvas');
    canvas.width = swap ? h : w;
    canvas.height = swap ? w : h;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(src, -w / 2, -h / 2);
    return canvas;
  }

  /** Render a PDF blob to an array of PNG data URLs using pdfjs. */
  private async renderPdfToImages(blob: Blob): Promise<string[]> {
    const pdfjsLib: any = await import('pdfjs-dist');
    // Use the locally-bundled worker (copied via angular.json assets) so it works offline / on
    // networks where the CDN is blocked.
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    } catch { /* worker may already be set */ }

    const data = new Uint8Array(await blob.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const images: string[] = [];
    const maxPages = Math.min(pdf.numPages, 12); // cap for performance

    // First, try to harvest any embedded (selectable) text layer — digital PDFs carry the
    // invoice number as real text, which is far more reliable than OCR-ing a rasterized page.
    let embedded = '';
    for (let p = 1; p <= maxPages; p++) {
      try {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        embedded += ' ' + tc.items.map((it: any) => it.str || '').join(' ');
      } catch { /* ignore */ }
    }
    this.wellyPodEmbeddedText = embedded.trim();

    for (let p = 1; p <= maxPages; p++) {
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      // CRITICAL: paint the canvas white first. The default canvas is transparent, so a
      // vector/text PDF renders black text on a transparent background — Tesseract then reads
      // the transparent area as black and sees nothing. A white fill makes text OCR-able.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport, background: 'rgba(255,255,255,1)' } as any).promise;
      images.push(canvas.toDataURL('image/png'));
    }
    return images;
  }

  wellyPodApprovedCount(): number {
    return this.wellyPodMatches.filter(m => m.approved).length;
  }

  /** Apply the approved suggested links to the current POD. */
  applyWellyPodLinks(): void {
    const approved = this.wellyPodMatches.filter(m => m.approved).map(m => m.id);
    if (approved.length === 0 || !this.wellyPodCurrent) {
      this.toast.warn('No invoices selected to link');
      return;
    }
    this.wellyPodLinking = true;
    this.http.put(`${this.apiUrl}/PodDocuments/${this.wellyPodCurrent.id}/link-invoices`, { invoiceIds: approved })
      .subscribe({
        next: (res: any) => {
          this.wellyPodLinking = false;
          this.showWellyPodPanel = false;
          this.loadPodDocuments();
          this.loadPodSummary();
          this.toast.done(`Welly linked ${res?.linkedInvoiceCount ?? approved.length} invoice(s) to this POD → marked Delivered`);
        },
        error: () => {
          this.wellyPodLinking = false;
          this.toast.error('Failed to link invoices');
        }
      });
  }

  closeWellyPodPanel(): void {
    if (this.wellyPodScanning || this.wellyPodLinking) return;
    this.showWellyPodPanel = false;
    this.wellyPodCurrent = null;
    this.wellyPodMatches = [];
    this.wellyPodUnmatched = [];
  }

  /** Scan every currently-listed unlinked POD, auto-linking high-confidence exact reads. */
  async wellyScanAllUnlinked(): Promise<void> {
    const queue = this.podDocuments.filter(p => !p.loadId && !p.invoiceId &&
      ((p.contentType || '').includes('image') || (p.contentType || '').includes('pdf') ||
       /\.(pdf|jpe?g|png)$/i.test(p.fileName || '')));
    if (queue.length === 0) {
      this.toast.info('No unlinked image/PDF PODs in the current list to scan');
      return;
    }
    if (!(await this.confirmDialog.ask({
      title: `Scan ${queue.length} unlinked POD(s) with Welly?`,
      message: 'Welly reads each POD and automatically links it to the invoices whose numbers it reads exactly.',
      confirmText: 'Scan PODs'
    }))) return;

    this.wellyPodBatchMode = true;
    this.wellyPodBatchQueue = queue;
    this.wellyPodBatchResults = [];
    this.showWellyPodPanel = true;
    this.wellyPodScanning = true;
    this.wellyPodActivityId = this.wellyActivity.start(`Welly: scanning ${queue.length} PODs`);

    let totalLinked = 0;
    for (let i = 0; i < queue.length; i++) {
      const pod = queue[i];
      this.wellyPodCurrent = pod;
      this.wellyPodProgress = 0;
      this.wellyPodStatus = `POD ${i + 1} of ${queue.length}: ${pod.driverName}`;
      try {
        let res: any = null;

        // Primary: server-side Tesseract — reliable on large multi-page scanned bundles
        // (rotated/faint) that would overwhelm the in-browser OCR.
        try {
          this.wellyPodStatus = `POD ${i + 1}/${queue.length}: deep server scan…`;
          res = await this.http
            .post(`${this.apiUrl}/PodDocuments/${pod.id}/server-ocr`, {})
            .toPromise();
        } catch (srvErr: any) {
          // 503 => server OCR not installed; fall back to in-browser OCR.
          if (srvErr?.status === 503) {
            this.wellyPodStatus = `POD ${i + 1}/${queue.length}: browser scan…`;
            const candidates = await this.ocrExtractInvoiceNumbers(pod);
            if (candidates.length > 0) {
              res = await this.http
                .post(`${this.apiUrl}/PodDocuments/match-invoice-numbers`, { candidates })
                .toPromise();
            }
          } else {
            throw srvErr;
          }
        }

        let linked = 0;
        const matches = res?.matches || [];
        const found = matches.length;
        const exact = matches.filter((m: any) => m.readExactly && !m.alreadyLinked);
        if (exact.length > 0) {
          await this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/link-invoices`,
            { invoiceIds: exact.map((m: any) => m.id) }).toPromise();
          linked = exact.length;
          totalLinked += linked;
        }
        this.wellyPodBatchResults.push({ pod, linked, found });
      } catch (err) {
        console.error('Batch scan error for POD', pod.id, err);
        this.wellyPodBatchResults.push({ pod, linked: 0, found: 0 });
      }
    }

    this.wellyPodScanning = false;
    this.finishWellyPodActivity();
    this.loadPodDocuments();
    this.loadPodSummary();
    this.wellyPodStatus = `Done — auto-linked ${totalLinked} invoice(s) across ${queue.length} POD(s).`;
    this.toast.done(this.wellyPodStatus);
  }

  private finishWellyPodActivity(): void {
    if (this.wellyPodActivityId !== null) {
      this.wellyActivity.stop(this.wellyPodActivityId);
      this.wellyPodActivityId = null;
    }
  }

  async delinkInvoice(pod: any): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: pod.invoiceNumber ? `Delink this POD from invoice ${pod.invoiceNumber}?` : 'Delink this POD from its invoice?',
      message: 'The invoice status will revert to Pending.',
      confirmText: 'Delink invoice',
      danger: true
    }))) return;

    this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/delink-invoice`, {}).subscribe({
      next: () => {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.toast.done('POD delinked from invoice → Status reverted to Pending');
      },
      error: (err) => {
        console.error('Failed to delink invoice:', err);
        this.toast.error('Failed to delink from invoice');
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
        this.toast.done('POD details updated');
      }
    });
  }

  openPodInvoicesDialog(pod: any): void {
    this.dialog.open(PodInvoicesDialog, {
      width: '480px',
      maxWidth: '95vw',
      data: { pod }
    });
  }

  // Open the tripsheet attachments side panel for a linked POD
  openTripsheetPanel(pod: any): void {
    if (!pod?.loadId) {
      this.toast.warn('This POD is not linked to a tripsheet');
      return;
    }
    this.tripsheetPanelOpen = true;
    this.tripsheetPanelLoading = true;
    this.tripsheetPanelLoad = null;
    this.tripsheetPanelPods = [];
    this.tripsheetPanelActiveId = pod.id;

    this.http.get<any>(`${this.apiUrl}/PodDocuments/by-load/${pod.loadId}`).subscribe({
      next: (res) => {
        this.tripsheetPanelLoad = res?.load || null;
        this.tripsheetPanelPods = res?.pods || [];
        this.tripsheetPanelLoading = false;
      },
      error: () => {
        this.tripsheetPanelLoading = false;
        this.toast.error('Failed to load tripsheet attachments');
      }
    });
  }

  closeTripsheetPanel(): void {
    this.tripsheetPanelOpen = false;
    this.tripsheetPanelActiveId = null;
  }

  previewTripsheet(): void {
    const loadId = this.tripsheetPanelLoad?.id;
    if (!loadId) {
      this.toast.warn('No tripsheet linked to preview');
      return;
    }
    this.tripsheetPreviewLoading = true;
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        this.tripsheetPreviewLoading = false;
        const previewWindow = window.open('', '_blank');
        if (previewWindow) {
          previewWindow.document.write(html);
          previewWindow.document.close();
        }
      },
      error: (err) => {
        this.tripsheetPreviewLoading = false;
        console.error('Failed to preview tripsheet:', err);
        this.toast.error('Failed to load tripsheet');
      }
    });
  }

  // Open the standard Rocket Freight printable tripsheet a POD is linked to.
  previewTripsheetFromPod(pod: any): void {
    const loadId = pod?.loadId;
    if (!loadId) {
      this.toast.warn('This POD is not linked to a tripsheet');
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
        this.toast.error('Failed to load tripsheet');
      }
    });
  }
}


// Backward-compatible re-exports for historical import sites.
export * from './sales-dashboard-dialogs.component';
export * from './sales.models';
