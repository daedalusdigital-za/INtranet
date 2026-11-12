import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from '../../ui/toast.service';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { environment } from '../../../environments/environment';
import { FinancePodsComponent } from './finance-pods.component';
import { FinanceVaultComponent } from './finance-vault.component';
import { FinanceAgingComponent } from './finance-aging.component';
import { FinanceRemittancesComponent } from './finance-remittances.component';
import { TenderService } from '../../services/tender.service';

/** Tab order in finance.component.html */
const TABS = ['overview', 'approvals', 'invoices', 'pods', 'aging', 'remittances', 'vault'] as const;
type FinanceTab = typeof TABS[number];

interface BookInvoice {
  id: number;
  supplierName: string;
  invoiceNumber?: string;
  invoiceDate: Date;
  total: number;
  vatAmount?: number;
  category?: string;
  companyName?: string;
  status: string;
  paymentDate?: Date;
  description?: string;
  departmentId: number;
  departmentName?: string;
  fileName?: string;
}

interface Department {
  departmentId: number;
  name: string;
}

interface RequestedPayment {
  id: number;
  invoiceNumber: string;
  supplierName: string;
  departmentName: string;
  departmentId: number;
  companyName?: string;
  total: number;
  invoiceDate: Date;
  description: string;
  status: string;
  category: string;
  fileName?: string;
  notes?: string;
}

interface DebtorCompany { snapshotId: number; company: string; asOfDate: string; customerCount: number; documentCount: number; total: number; current: number; overdue: number; d90plus: number; d120: number; stale: boolean; }
interface Overview {
  generatedAt: string;
  invoices: { total: number; totalAmount: number; unpaid: number; unpaidAmount: number; paid: number; paidThisMonth: number; paymentRequested: number; paymentRequestedAmount: number; overdue: number; submitted: number; };
  creditors: { totalPayable: number; unpaidInvoices: number; commitmentsMonthly: number; requisitions: number; pendingExpenses: number; };
  debtors: { total: number; current: number; overdue: number; d90plus: number; d120: number; companiesLoaded: number; oldestAsOf?: string; byCompany: DebtorCompany[] };
  requisitions: { requested: number; requestedAmount: number; paid: number; rejected: number; total: number };
  remittances: { new: number; thisMonth: number; thisMonthAmount: number; lastScanAt?: string; lastScanError?: string };
  pods: { total: number; unlinked: number };
  vault: { total: number; expired: number; dueSoon: number };
  commitmentsMonthly: number;
}

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    NavbarComponent,
    PageHeaderComponent,
    FinancePodsComponent,
    FinanceVaultComponent,
    FinanceAgingComponent,
    FinanceRemittancesComponent
  ],
  templateUrl: './finance.component.html',
  styleUrls: ['./finance.component.scss']
})
export class FinanceComponent implements OnInit {
  // ── Tabs ──
  tabIndex = 0;
  private approvalsLoaded = false;

  // ── Overview (single server aggregate) ──
  ov: Overview | null = null;
  ovLoading = true;
  ovError = false;

  get podUnlinked(): number { return this.ov?.pods.unlinked ?? 0; }
  get vaultExpired(): number { return this.ov?.vault.expired ?? 0; }
  get vaultExpiring(): number { return this.ov?.vault.dueSoon ?? 0; }
  get creditorsTotal(): number { return this.ov?.creditors.totalPayable ?? 0; }
  get debtorsTotal(): number { return this.ov?.debtors.total ?? 0; }
  get commitmentsMonthly(): number { return this.ov?.commitmentsMonthly ?? 0; }
  get debtorsOverduePct(): number { const d = this.ov?.debtors; return d && d.total > 0 ? Math.round((d.overdue / d.total) * 100) : 0; }
  get attentionCount(): number {
    return (this.ov?.invoices.paymentRequested ?? 0) + (this.ov?.requisitions.requested ?? 0) + (this.stationeryCounts.pending || 0)
      + (this.ov?.remittances.new ?? 0) + (this.ov?.vault.expired ?? 0);
  }
  barPct(part: number, whole: number): number { return whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0; }

  get approvalsBadge(): number {
    return (this.ov?.invoices.paymentRequested ?? 0) + (this.requisitionCounts.requested || 0) + (this.stationeryCounts.pending || 0);
  }

  // Invoice management
  invoices: BookInvoice[] = [];
  departments: Department[] = [];
  loading = false;
  
  // Filters
  selectedDepartment: number | null = null;
  searchTerm = '';
  selectedStatus = '';
  selectedCategory = '';
  
  // Pagination
  pageSize = 20;
  pageIndex = 0;
  totalInvoices = 0;
  
  displayedColumns = ['invoiceNumber', 'supplierName', 'department', 'invoiceDate', 'category', 'total', 'status', 'actions'];

  // ─── Requested Payments Flow ───
  companies = [
    { name: 'All companies', icon: 'apps' },
    { name: 'Access Medical', icon: 'local_hospital' },
    { name: 'Promed Technologies', icon: 'biotech' },
    { name: 'Promed Pharmatech', icon: 'science' },
    { name: 'Sebenzani Trading', icon: 'store' },
    { name: 'SA Wellness', icon: 'spa' },
    { name: 'Kog Trading', icon: 'business_center' }
  ];

  // Dialog state
  showCompanyDialog = false;
  showRequestedPaymentsPanel = false;

  // Stationery Requests
  showStationeryPanel = false;
  stationeryRequests: any[] = [];
  stationeryLoading = false;
  stationeryFilter = 'all';
  stationeryCounts = { pending: 0, approved: 0, declined: 0, total: 0 };

  // Requisitions (finance payment workflow: Requested / Paid / Rejected)
  showRequisitionsPanel = false;
  requisitions: any[] = [];
  requisitionsLoading = false;
  requisitionFilter = 'Requested';
  requisitionCounts = { requested: 0, paid: 0, rejected: 0, total: 0 };

  selectedCompany = '';
  accessError = '';
  requestedPaymentsLoading = false;
  requestedPayments: RequestedPayment[] = [];
  previewPayment: RequestedPayment | null = null;
  showPreviewDialog = false;
  rejectReason = '';
  previewPdfUrl: string | null = null;
  deciding = false;

  // NOTE: the old frontend-hardcoded per-company passwords were removed.
  // Access is now verified server-side (GET /api/finance/company-access)
  // against the authenticated user's role.

  constructor(
    private financeService: FinanceService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
    private tenderService: TenderService,
    private sanitizer: DomSanitizer
  ) {}

  safeUrl(u: string): SafeResourceUrl { return this.sanitizer.bypassSecurityTrustResourceUrl(u); }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadOverview();
    this.loadStationeryCounts();
    this.loadRequisitionCounts();

    // Deep link: /finance?tab=pods|vault|approvals|invoices (&section=stationery|requisitions)
    this.route.queryParamMap.subscribe(q => {
      const t = (q.get('tab') || '') as FinanceTab;
      const idx = TABS.indexOf(t);
      if (idx >= 0 && idx !== this.tabIndex) this.onTabChange(idx);
      const section = q.get('section');
      if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
    });
  }

  onTabChange(i: number): void {
    this.tabIndex = i;
    const tab = TABS[i] ?? 'overview';
    if (tab === 'approvals' && !this.approvalsLoaded) {
      this.approvalsLoaded = true;
      this.loadRequisitions();
      this.loadStationeryRequests();
    }
    if (tab === 'invoices' && this.invoices.length === 0 && !this.loading) this.loadInvoices();
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'overview' ? null : tab }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  goTab(tab: FinanceTab, section?: string): void {
    this.onTabChange(TABS.indexOf(tab));
    if (section) setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250);
  }

  loadOverview(): void {
    this.ovLoading = true; this.ovError = false;
    this.http.get<Overview>(`${environment.apiUrl}/finance/overview`).subscribe({
      next: o => { this.ov = o; this.ovLoading = false; },
      error: () => { this.ovLoading = false; this.ovError = true; }
    });
  }
  /** Kept for call-sites that used to refresh individual stats. */
  loadStats(): void { this.loadOverview(); }
  loadInvoiceStats(): void { this.loadOverview(); }

  loadDepartments(): void {
    this.http.get<Department[]>(`${environment.apiUrl}/departments`).subscribe({
      next: (depts) => { this.departments = depts; },
      error: (err) => { console.error('Error loading departments:', err); }
    });
  }

  goToCommitments(): void {
    this.router.navigate(['/finance/commitments']);
  }

  goToCreditors(): void {
    this.router.navigate(['/finance/creditors']);
  }

  goToDebtors(): void {
    this.router.navigate(['/finance/debtors']);
  }

  onDepartmentChange(): void {
    this.pageIndex = 0;
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading = true;
    let url = `${environment.apiUrl}/Books?page=${this.pageIndex + 1}&pageSize=${this.pageSize}`;
    if (this.selectedDepartment) url += `&departmentId=${this.selectedDepartment}`;
    if (this.searchTerm) url += `&search=${encodeURIComponent(this.searchTerm)}`;
    if (this.selectedStatus) url += `&status=${encodeURIComponent(this.selectedStatus)}`;
    if (this.selectedCategory) url += `&category=${encodeURIComponent(this.selectedCategory)}`;

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.invoices = response.items || response.data || [];
        this.totalInvoices = response.totalCount || response.total || 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.invoices = [];
        this.totalInvoices = 0;
        this.toast.error(err.error?.message || err.error?.error || 'Error loading invoices');
      }
    });
  }

  clearInvoiceFilters(): void {
    this.selectedDepartment = null; this.searchTerm = ''; this.selectedStatus = ''; this.selectedCategory = '';
    this.applyFilters();
  }

  applyFilters(): void {
    this.pageIndex = 0;
    this.loadInvoices();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadInvoices();
  }

  /** Files sit behind [Authorize]; fetch as a blob so the auth interceptor adds the token. */
  private fetchFile(url: string, open: boolean, name?: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: b => {
        const href = URL.createObjectURL(b);
        if (open) { window.open(href, '_blank'); }
        else { const a = document.createElement('a'); a.href = href; a.download = name || 'invoice.pdf'; a.click(); }
        setTimeout(() => URL.revokeObjectURL(href), 60_000);
      },
      error: () => this.toast.error('The file is missing from storage.')
    });
  }
  downloadInvoice(invoice: BookInvoice): void { this.fetchFile(`${environment.apiUrl}/Books/${invoice.id}/download`, false, invoice.fileName); }
  openInvoiceFile(invoice: BookInvoice): void { this.fetchFile(`${environment.apiUrl}/Books/${invoice.id}/view`, true); }

  markPaid(invoice: BookInvoice): void {
    const body = { paymentDate: new Date().toISOString() };
    this.http.put<any>(`${environment.apiUrl}/Books/${invoice.id}/mark-paid`, body).subscribe({
      next: () => {
        invoice.status = 'Paid';
        invoice.paymentDate = new Date();
        this.toast.done(`Invoice ${invoice.invoiceNumber || ''} marked as paid`);
        this.loadInvoiceStats();
      },
      error: (err) => this.toast.error(err?.error?.error || "Couldn't mark the invoice as paid. Try again.")
    });
  }

  markUnpaid(invoice: BookInvoice): void {
    this.http.put<any>(`${environment.apiUrl}/Books/${invoice.id}/mark-unpaid`, {}).subscribe({
      next: () => {
        invoice.status = 'Confirmed';
        invoice.paymentDate = undefined;
        this.toast.done(`Invoice ${invoice.invoiceNumber || ''} marked as unpaid`);
        this.loadInvoiceStats();
      },
      error: (err) => this.toast.error(err?.error?.error || "Couldn't mark the invoice as unpaid. Try again.")
    });
  }

  viewInvoice(invoice: BookInvoice): void {
    const deptId = invoice.departmentId || this.selectedDepartment;
    const dept = this.departments.find(d => d.departmentId === deptId);
    this.router.navigate(['/books'], { 
      queryParams: { 
        departmentId: deptId,
        departmentName: dept?.name || invoice.departmentName || '',
        invoiceId: invoice.id 
      } 
    });
  }
  
  goToBooks(): void {
    const dept = this.departments.find(d => d.departmentId === this.selectedDepartment);
    this.router.navigate(['/books'], {
      queryParams: {
        departmentId: this.selectedDepartment || '',
        departmentName: dept?.name || ''
      }
    });
  }

  statusClass(s: string): string { return 'status-' + (s || '').toLowerCase().replace(/\s+/g, '-'); }

  // ─── Requested Payments Flow ───

  openRequestedPayments(): void {
    this.selectedCompany = '';
    this.accessError = '';
    this.showCompanyDialog = true;
  }

  selectCompany(companyName: string): void {
    this.selectedCompany = companyName;
    this.accessError = '';
    // Server-side role check replaces the old client-side password gate
    this.http.get(`${environment.apiUrl}/finance/company-access`).subscribe({
      next: () => {
        this.showCompanyDialog = false;
        this.loadRequestedPayments();
      },
      error: () => {
        this.accessError = 'You do not have permission to view company financials.';
        this.toast.error('Access denied: finance permission required.');
      }
    });
  }

  closeCompanyDialog(): void {
    this.showCompanyDialog = false;
  }

  loadRequestedPayments(): void {
    this.showRequestedPaymentsPanel = true;
    this.requestedPaymentsLoading = true;
    this.requestedPayments = [];

    // Departments put invoices into "Payment Requested" (PUT /Books/{id}/request-payment).
    let url = `${environment.apiUrl}/Books?page=1&pageSize=200&status=${encodeURIComponent('Payment Requested')}&sortBy=invoicedate&sortDir=asc`;
    if (this.selectedCompany && this.selectedCompany !== 'All companies') url += `&company=${encodeURIComponent(this.selectedCompany)}`;
    this.http.get<any>(url).subscribe({
      next: (response) => {
        const items = response.items || response.data || [];
        this.requestedPayments = items.map((inv: any) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber || 'N/A',
          supplierName: inv.supplierName || 'Unknown',
          departmentName: inv.departmentName || 'Unknown',
          departmentId: inv.departmentId,
          companyName: inv.companyName,
          total: inv.total || 0,
          invoiceDate: inv.invoiceDate,
          description: inv.description || '',
          status: inv.status || 'Payment Requested',
          category: inv.category || 'General',
          fileName: inv.originalFileName || inv.fileName,
          notes: inv.notes
        }));
        this.requestedPaymentsLoading = false;
      },
      error: () => {
        this.requestedPaymentsLoading = false;
        this.toast.error("Couldn't load requested payments. Try again.");
      }
    });
  }

  get requestedTotal(): number { return this.requestedPayments.reduce((a, p) => a + (p.total || 0), 0); }

  closeRequestedPayments(): void {
    this.showRequestedPaymentsPanel = false;
    this.requestedPayments = [];
    this.selectedCompany = '';
    this.closePreviewDialog();
  }

  previewRequestedPayment(payment: RequestedPayment): void {
    this.previewPayment = payment;
    this.showPreviewDialog = true;
    this.rejectReason = '';
    this.previewPdfUrl = null;
    if (payment.fileName) {
      this.http.get(`${environment.apiUrl}/Books/${payment.id}/view`, { responseType: 'blob' }).subscribe({
        next: b => { if (this.previewPayment?.id === payment.id) this.previewPdfUrl = URL.createObjectURL(b); },
        error: () => {}
      });
    }
  }

  closePreviewDialog(): void {
    this.showPreviewDialog = false;
    this.previewPayment = null;
    if (this.previewPdfUrl) { URL.revokeObjectURL(this.previewPdfUrl); this.previewPdfUrl = null; }
  }

  private decide(payment: RequestedPayment, status: 'Paid' | 'Rejected', notes?: string): void {
    if (this.deciding) return;
    this.deciding = true;
    this.http.put<any>(`${environment.apiUrl}/Books/${payment.id}/status`, { status, notes: notes || null }).subscribe({
      next: () => {
        this.deciding = false;
        this.toast.done(status === 'Paid' ? `Invoice ${payment.invoiceNumber} marked paid` : `Invoice ${payment.invoiceNumber} sent back to ${payment.departmentName}`);
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
        this.loadOverview();
        if (this.invoices.length) this.loadInvoices();
      },
      error: (err) => { this.deciding = false; this.toast.error(err?.error?.error || `Couldn't update invoice ${payment.invoiceNumber}. Nothing was changed.`); }
    });
  }
  approvePayment(payment: RequestedPayment): void { this.decide(payment, 'Paid'); }
  rejectPayment(payment: RequestedPayment): void {
    if (!this.showPreviewDialog) { this.previewRequestedPayment(payment); return; } // reason is captured in the preview
    this.decide(payment, 'Rejected', this.rejectReason.trim());
  }

  downloadRequestedPayment(payment: RequestedPayment): void { this.fetchFile(`${environment.apiUrl}/Books/${payment.id}/download`, false, payment.fileName); }

  // ─── Stationery Requests ───

  loadStationeryCounts(): void {
    this.http.get<any>(`${environment.apiUrl}/stationery-requests/counts`).subscribe({
      next: c => this.stationeryCounts = c,
      error: () => {}
    });
  }

  toggleStationeryPanel(): void {
    this.showStationeryPanel = !this.showStationeryPanel;
    if (this.showStationeryPanel) this.loadStationeryRequests();
  }

  setStationeryFilter(f: string): void {
    this.stationeryFilter = f;
    this.loadStationeryRequests();
  }

  loadStationeryRequests(): void {
    this.stationeryLoading = true;
    const q = this.stationeryFilter !== 'all' ? `?status=${this.stationeryFilter}` : '';
    this.http.get<any[]>(`${environment.apiUrl}/stationery-requests${q}`).subscribe({
      next: r => { this.stationeryRequests = r; this.stationeryLoading = false; },
      error: () => { this.stationeryLoading = false; }
    });
  }

  reviewStationery(req: any, status: 'Approved' | 'Declined'): void {
    this.http.put(`${environment.apiUrl}/stationery-requests/${req.stationeryRequestId}/review`,
      { status, notes: null }).subscribe({
      next: () => {
        req.status = status;
        this.loadStationeryCounts();
        this.toast.done(`Stationery request ${status.toLowerCase()}`);
      },
      error: () => this.toast.error("Couldn't update the stationery request. Try again.")
    });
  }

  spInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getQuoteUrl(id: number, n: number): string {
    return `${environment.apiUrl}/stationery-requests/${id}/quote/${n}`;
  }

  // ── Requisitions (finance payment workflow) ──────────────────────────────
  loadRequisitionCounts(): void {
    this.http.get<any>(`${environment.apiUrl}/finance/requisitions/summary`).subscribe({
      next: c => this.requisitionCounts = {
        requested: c?.requested || 0,
        paid: c?.paid || 0,
        rejected: c?.rejected || 0,
        total: c?.total || 0
      },
      error: () => {}
    });
  }

  toggleRequisitionsPanel(): void {
    this.showRequisitionsPanel = !this.showRequisitionsPanel;
    if (this.showRequisitionsPanel) this.loadRequisitions();
  }

  setRequisitionFilter(f: string): void {
    this.requisitionFilter = f;
    this.loadRequisitions();
  }

  loadRequisitions(): void {
    this.requisitionsLoading = true;
    const q = this.requisitionFilter !== 'all' ? `?status=${this.requisitionFilter}` : '';
    this.http.get<any[]>(`${environment.apiUrl}/finance/requisitions${q}`).subscribe({
      next: r => { this.requisitions = r || []; this.requisitionsLoading = false; },
      error: () => { this.requisitionsLoading = false; }
    });
  }

  setRequisitionStatus(req: any, status: 'Requested' | 'Paid' | 'Rejected'): void {
    this.http.put(`${environment.apiUrl}/finance/requisitions/${req.id}/status`, { status }).subscribe({
      next: () => {
        req.financeStatus = status;
        this.loadRequisitionCounts();
        this.loadOverview();
        if (this.requisitionFilter !== 'all' && this.requisitionFilter !== status) {
          this.requisitions = this.requisitions.filter(r => r.id !== req.id);
        }
        this.toast.done(`Requisition marked ${status}`);
      },
      error: () => this.toast.error("Couldn't update the requisition. Try again.")
    });
  }
}
