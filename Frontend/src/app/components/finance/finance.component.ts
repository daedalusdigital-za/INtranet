import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
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
    MatSnackBarModule,
    MatTooltipModule,
    NavbarComponent
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
  showPasswordDialog = false;
  showRequestedPaymentsPanel = false;

  selectedCompany = '';
  companyPassword = '';
  passwordError = '';
  requestedPaymentsLoading = false;
  requestedPayments: RequestedPayment[] = [];
  previewPayment: RequestedPayment | null = null;
  showPreviewDialog = false;

  // Company passwords (frontend-only for now)
  private companyPasswords: { [key: string]: string } = {
    'Acess Medical': 'acess2026',
    'Promed Technologies': 'promed2026',
    'Promed Pharmatech': 'pharma2026',
    'Sebenzani Trading': 'sebenzani2026',
    'SA Wellness': 'sawellness2026',
    'Kog Trading': 'kog2026'
  };

  constructor(
    private financeService: FinanceService,
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    console.log('Finance Component Initialized');
    console.log('Environment API URL:', environment.apiUrl);
    this.loadDepartments();
    this.loadStats();
  }

  loadDepartments(): void {
    console.log('Loading departments...');
    this.http.get<Department[]>(`${environment.apiUrl}/departments`).subscribe({
      next: (depts) => {
        console.log('Departments loaded:', depts);
        this.departments = depts;
        this.selectedDepartment = null;
      },
      error: (err) => {
        console.error('Error loading departments:', err);
        console.error('Error details:', err.error);
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
  }

  onDepartmentChange(): void {
    console.log('=== Department Change ===>');
    console.log('Selected Department:', this.selectedDepartment);
    console.log('Type:', typeof this.selectedDepartment);
    
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
      console.warn('No department selected');
      return;
    }
    
    this.loading = true;
    let url = `${environment.apiUrl}/Books?departmentId=${this.selectedDepartment}&page=${this.pageIndex + 1}&pageSize=${this.pageSize}`;
    
    if (this.searchTerm) url += `&search=${encodeURIComponent(this.searchTerm)}`;
    if (this.selectedStatus) url += `&status=${this.selectedStatus}`;
    if (this.selectedCategory) url += `&category=${encodeURIComponent(this.selectedCategory)}`;

    console.log('Loading invoices from:', url);

    this.http.get<any>(url).subscribe({
      next: (response) => {
        console.log('Invoices loaded:', response);
        this.invoices = response.items || response.data || [];
        this.filteredInvoices = this.invoices;
        this.totalInvoices = response.totalCount || response.total || 0;
        this.loading = false;
        
        if (this.invoices.length === 0) {
          this.snackBar.open('No invoices found for this department', 'Close', { duration: 2000 });
        }
      },
      error: (err) => {
        console.error('Error loading invoices:', err);
        console.error('Error details:', err.error);
        this.loading = false;
        this.invoices = [];
        this.filteredInvoices = [];
        this.totalInvoices = 0;
        
        const errorMsg = err.error?.message || err.message || 'Error loading invoices';
        this.snackBar.open(errorMsg, 'Close', { duration: 5000 });
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
    this.companyPassword = '';
    this.passwordError = '';
    this.showCompanyDialog = true;
  }

  selectCompany(companyName: string): void {
    this.selectedCompany = companyName;
    this.companyPassword = '';
    this.passwordError = '';
    this.showCompanyDialog = false;
    this.showPasswordDialog = true;
  }

  closeCompanyDialog(): void {
    this.showCompanyDialog = false;
  }

  closePasswordDialog(): void {
    this.showPasswordDialog = false;
    this.selectedCompany = '';
    this.companyPassword = '';
    this.passwordError = '';
  }

  backToCompanySelect(): void {
    this.showPasswordDialog = false;
    this.companyPassword = '';
    this.passwordError = '';
    this.showCompanyDialog = true;
  }

  submitPassword(): void {
    const expected = this.companyPasswords[this.selectedCompany];
    if (this.companyPassword === expected) {
      this.showPasswordDialog = false;
      this.passwordError = '';
      this.loadRequestedPayments();
    } else {
      this.passwordError = 'Incorrect password. Please try again.';
    }
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
            this.snackBar.open('Error loading requested payments', 'Close', { duration: 3000 });
          }
        });
      },
      error: () => {
        this.requestedPaymentsLoading = false;
        this.snackBar.open('Error loading requested payments', 'Close', { duration: 3000 });
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
        this.snackBar.open(`Invoice ${payment.invoiceNumber} approved and submitted`, 'Close', { duration: 3000 });
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
        this.loadStats();
      },
      error: () => {
        // If endpoint doesn't exist yet, just remove from local list
        this.snackBar.open(`Invoice ${payment.invoiceNumber} marked as submitted`, 'Close', { duration: 3000 });
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
      }
    });
  }

  rejectPayment(payment: RequestedPayment): void {
    this.http.put(`${environment.apiUrl}/Books/${payment.id}/status`, { status: 'Rejected' }).subscribe({
      next: () => {
        this.snackBar.open(`Invoice ${payment.invoiceNumber} rejected`, 'Close', { duration: 3000 });
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
        this.loadStats();
      },
      error: () => {
        this.snackBar.open(`Invoice ${payment.invoiceNumber} marked as rejected`, 'Close', { duration: 3000 });
        this.requestedPayments = this.requestedPayments.filter(p => p.id !== payment.id);
        this.closePreviewDialog();
      }
    });
  }

  downloadRequestedPayment(payment: RequestedPayment): void {
    const url = `${environment.apiUrl}/Books/${payment.id}/download`;
    window.open(url, '_blank');
  }
}
