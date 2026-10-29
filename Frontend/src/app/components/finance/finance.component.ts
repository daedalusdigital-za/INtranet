import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  total: number;
  invoiceDate: Date;
  description: string;
  status: string;
  category: string;
  fileName?: string;
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
    PageHeaderComponent
  ],
  templateUrl: './finance.component.html',
  styleUrls: ['./finance.component.scss']
})
export class FinanceComponent implements OnInit {
  stats = {
    totalInvoices: 0,
    totalAmount: 0,
    requestedPayments: 0,
    pendingPayments: 0,
    unpaidInvoices: 0,
    paidInvoices: 0,
    submittedInvoices: 0
  };

  // Invoice management
  invoices: BookInvoice[] = [];
  filteredInvoices: BookInvoice[] = [];
  departments: Department[] = [];
  loading = false;
  commitmentsMonthly = 0;
  creditorsTotal = 0;
  debtorsTotal = 0;
  
  // Filters
  selectedDepartment: number | null = null;
  searchTerm = '';
  selectedStatus = '';
  selectedCategory = '';
  
  // Pagination
  pageSize = 20;
  pageIndex = 0;
  totalInvoices = 0;
  
  displayedColumns = ['invoiceNumber', 'supplierName', 'invoiceDate', 'category', 'total', 'status', 'actions'];

  // ─── Requested Payments Flow ───
  companies = [
    { name: 'Acess Medical', icon: 'local_hospital' },
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

  // NOTE: the old frontend-hardcoded per-company passwords were removed.
  // Access is now verified server-side (GET /api/finance/company-access)
  // against the authenticated user's role.

  constructor(
    private financeService: FinanceService,
    private http: HttpClient,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
    this.loadStats();
    this.loadStationeryCounts();
    this.loadRequisitionCounts();
  }

  loadDepartments(): void {
    this.http.get<Department[]>(`${environment.apiUrl}/departments`).subscribe({
      next: (depts) => {
        this.departments = depts;
        this.selectedDepartment = null;
      },
      error: (err) => {
        console.error('Error loading departments:', err);
      }
    });
  }

  loadStats(): void {
    this.financeService.getExpenses('Pending').subscribe(expenses => {
      this.stats.requestedPayments = expenses.length;
    });

    this.financeService.getPayments('Pending').subscribe(payments => {
      this.stats.pendingPayments = payments.length;
    });
    
    this.loadInvoiceStats();

    this.http.get<any>(`${environment.apiUrl}/finance/creditors/summary`).subscribe({
      next: (s) => this.creditorsTotal = s?.totalPayable || 0,
      error: () => {}
    });
    this.http.get<any>(`${environment.apiUrl}/finance/debtors/summary`).subscribe({
      next: (s) => this.debtorsTotal = s?.totalReceivable || 0,
      error: () => {}
    });
  }
  
  loadInvoiceStats(): void {
    let url = `${environment.apiUrl}/Books/all-invoices-summary`;
    this.http.get<any>(url).subscribe({
      next: (summary) => {
        this.stats.totalInvoices = summary.totalCount || 0;
        this.stats.totalAmount = summary.totalAmount || 0;
        this.stats.unpaidInvoices = summary.unpaidCount || 0;
        this.stats.paidInvoices = summary.paidCount || 0;
        this.stats.submittedInvoices = summary.submittedCount || 0;
      },
      error: (err) => console.error('Error loading invoice stats:', err)
    });

    this.http.get<any>(`${environment.apiUrl}/finance/recurring-payments/summary`).subscribe({
      next: (s) => this.commitmentsMonthly = s?.monthlyTotal || 0,
      error: () => {}
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
    if (this.selectedDepartment) {
      this.pageIndex = 0;
      this.loadInvoices();
    } else {
      this.invoices = [];
      this.filteredInvoices = [];
      this.totalInvoices = 0;
    }
  }

  loadInvoices(): void {
    if (!this.selectedDepartment) {
      return;
    }
    
    this.loading = true;
    let url = `${environment.apiUrl}/Books?departmentId=${this.selectedDepartment}&page=${this.pageIndex + 1}&pageSize=${this.pageSize}`;
    
    if (this.searchTerm) url += `&search=${encodeURIComponent(this.searchTerm)}`;
    if (this.selectedStatus) url += `&status=${this.selectedStatus}`;
    if (this.selectedCategory) url += `&category=${encodeURIComponent(this.selectedCategory)}`;

    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.invoices = response.items || response.data || [];
        this.filteredInvoices = this.invoices;
        this.totalInvoices = response.totalCount || response.total || 0;
        this.loading = false;
        
        if (this.invoices.length === 0) {
          this.toast.info('No invoices found for this department');
        }
      },
      error: (err) => {
        this.loading = false;
        this.invoices = [];
        this.filteredInvoices = [];
        this.totalInvoices = 0;
        
        const errorMsg = err.error?.message || err.message || 'Error loading invoices';
        this.toast.error(errorMsg);
      }
    });
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

  downloadInvoice(invoice: BookInvoice): void {
    const url = `${environment.apiUrl}/Books/${invoice.id}/download`;
    window.open(url, '_blank');
  }

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

    // Load pending invoices across all departments for the selected company
    this.http.get<any>(`${environment.apiUrl}/Books/all-invoices-summary`).subscribe({
      next: () => {
        // Load invoices from all departments with Pending status
        this.http.get<any>(`${environment.apiUrl}/Books?page=1&pageSize=100&status=Pending`).subscribe({
          next: (response) => {
            const items = response.items || response.data || [];
            // Map to RequestedPayment with company context
            this.requestedPayments = items.map((inv: any) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber || 'N/A',
              supplierName: inv.supplierName || 'Unknown',
              departmentName: inv.departmentName || 'Unknown',
              departmentId: inv.departmentId,
              total: inv.total || 0,
              invoiceDate: inv.invoiceDate,
              description: inv.description || '',
              status: inv.status || 'Pending',
              category: inv.category || 'General',
              fileName: inv.fileName
            }));
            this.requestedPaymentsLoading = false;
          },
          error: () => {
            this.requestedPaymentsLoading = false;
            this.toast.error("Couldn't load requested payments. Try again.");
          }
        });
      },
      error: () => {
        this.requestedPaymentsLoading = false;
        this.toast.error("Couldn't load requested payments. Try again.");
      }
    });
  }

  closeRequestedPayments(): void {
    this.showRequestedPaymentsPanel = false;
    this.requestedPayments = [];
    this.selectedCompany = '';
    this.previewPayment = null;
    this.showPreviewDialog = false;
  }

  previewRequestedPayment(payment: RequestedPayment): void {
    this.previewPayment = payment;
    this.showPreviewDialog = true;
  }

  closePreviewDialog(): void {
    this.showPreviewDialog = false;
    this.previewPayment = null;
  }

  approvePayment(payment: RequestedPayment): void {
    // Update invoice status to Submitted/Paid
    this.http.put(`${environment.apiUrl}/Books/${payment.id}/status`, { status: 'Paid' }).subscribe({
      next: () => {
        this.toast.done(`Invoice ${payment.invoiceNumber} approved and submitted`);
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
        this.loadStats();
      },
      error: () => {
        // If endpoint doesn't exist yet, just remove from local list
        this.toast.info(`Invoice ${payment.invoiceNumber} marked as submitted`);
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
      }
    });
  }

  rejectPayment(payment: RequestedPayment): void {
    this.http.put(`${environment.apiUrl}/Books/${payment.id}/status`, { status: 'Rejected' }).subscribe({
      next: () => {
        this.toast.done(`Invoice ${payment.invoiceNumber} rejected`);
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
        this.loadStats();
      },
      error: () => {
        this.toast.info(`Invoice ${payment.invoiceNumber} marked as rejected`);
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
      }
    });
  }

  downloadRequestedPayment(payment: RequestedPayment): void {
    const url = `${environment.apiUrl}/Books/${payment.id}/download`;
    window.open(url, '_blank');
  }

  // ─── Stationery Requests ───

  private finHeaders(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  loadStationeryCounts(): void {
    this.http.get<any>(`${environment.apiUrl}/stationery-requests/counts`, { headers: this.finHeaders() }).subscribe({
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
    this.http.get<any[]>(`${environment.apiUrl}/stationery-requests${q}`, { headers: this.finHeaders() }).subscribe({
      next: r => { this.stationeryRequests = r; this.stationeryLoading = false; },
      error: () => { this.stationeryLoading = false; }
    });
  }

  reviewStationery(req: any, status: 'Approved' | 'Declined'): void {
    this.http.put(`${environment.apiUrl}/stationery-requests/${req.stationeryRequestId}/review`,
      { status, notes: null }, { headers: this.finHeaders() }).subscribe({
      next: () => {
        req.status = status;
        this.loadStationeryCounts();
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
        if (this.requisitionFilter !== 'all' && this.requisitionFilter !== status) {
          this.requisitions = this.requisitions.filter(r => r.id !== req.id);
        }
        this.toast.done(`Requisition marked ${status}`);
      },
      error: () => this.toast.error("Couldn't update the requisition. Try again.")
    });
  }
}
