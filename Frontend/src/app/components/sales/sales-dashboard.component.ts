import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SalesImportDialogComponent, SalesImportDialogData, SalesImportDialogResult } from '../shared/sales-import-dialog/sales-import-dialog.component';
import { environment } from '../../../environments/environment';
import { PROMED_BACK_ORDERS, ACCESS_BACK_ORDERS, PHARMATECH_BACK_ORDERS, SEBENZANI_BACK_ORDERS, BackOrderItem } from './back-orders-data';
import Chart from 'chart.js/auto';

// Company definitions
const COMPANIES = [
  { code: 'PMT', name: 'Promed Technologies', shortName: 'Promed', color: '#1a237e' },
  { code: 'ACM', name: 'Access Medical', shortName: 'Access', color: '#00695c' },
  { code: 'PHT', name: 'Pharmatech', shortName: 'Pharmatech', color: '#c62828' },
  { code: 'SBT', name: 'Sebenzani Trading', shortName: 'Sebenzani', color: '#6a1b9a' }
];

interface Company {
  code: string;
  name: string;
  shortName: string;
  color: string;
}

interface CompanySales {
  company: Company;
  todaySales: number;
  yesterdaySales: number;
  todayOrders: number;
  yesterdayOrders: number;
  percentChange: number;
  monthlyDailyAvg: number;
}

interface Customer {
  id: number;
  customerCode: string;
  name: string;
  shortName?: string;
  email?: string;
  phoneNumber?: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryProvince?: string;
  deliveryPostalCode?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  createdAt: Date;
  totalOrders?: number;
  totalRevenue?: number;
  companyCode?: string;
}

interface Invoice {
  id: number;
  transactionNumber: string;
  customerNumber: string;
  customerName: string;
  customerId?: number;
  productCode: string;
  productDescription: string;
  quantity: number;
  salesAmount: number;
  costOfSales: number;
  transactionDate: Date;
  status: string;
  sourceSystem?: string;
  sourceCompany?: string;
  deliveryProvince?: string;
  deliveryAddress?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerId: number;
  orderDate: Date;
  totalAmount: number;
  status: string;
  priority: string;
  items: number;
  notes?: string;
  companyCode?: string;
}

interface IncomingOrderEmail {
  messageId: string;
  subject: string;
  from: string;
  fromEmail: string;
  date: Date;
  accountEmail: string;
  accountDisplayName: string;
  hasAttachments: boolean;
  preview: string;
  isRead: boolean;
  priority: string;
  to: string[];
  cc: string[];
  foundInAccounts: string[];
}

interface SalesStats {
  totalCustomers: number;
  activeCustomers: number;
  totalInvoices: number;
  pendingInvoices: number;
  totalRevenue: number;
  monthlyRevenue: number;
  incomingOrders: number;
  processingOrders: number;
}

interface SalesReportChartData {
  labels: string[];
  values: number[];
}

interface SalesReportSummary {
  totalInvoices: number;
  totalRevenue: number;
  netSales: number;
  grossProfit: number;
  marginPercent: number;
  totalReturns: number;
  uniqueCustomers: number;
  uniqueProducts: number;
  totalCancellations: number;
  cancellationValue: number;
}

interface SalesReportResponse {
  analysis: string;
  reportType: string;
  charts: {
    salesByCompany: SalesReportChartData;
    topCustomers: SalesReportChartData;
    salesByProvince: SalesReportChartData;
    topProducts: SalesReportChartData;
    dailySales: SalesReportChartData;
    cancellationsByReason: SalesReportChartData;
  };
  summary: SalesReportSummary;
}

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
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatTabsModule,
    MatDividerModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="sales-dashboard">
      @if (initialLoading()) {
        <div class="loading-state">
          <div class="loading-card">
            <div class="lc-icon-wrap">
              <mat-icon class="lc-icon pulse-icon">point_of_sale</mat-icon>
            </div>
            <h3>Loading Sales Dashboard</h3>
            <p class="lc-subtitle">Fetching customers, invoices, orders & analytics</p>
            <div class="lc-progress-wrap">
              <div class="lc-progress-track">
                <div class="lc-progress-fill" [style.width.%]="loadingProgress"></div>
              </div>
              <div class="lc-progress-info">
                <span class="lc-progress-message">{{ loadingMessage }}</span>
                <span class="lc-progress-pct">{{ loadingProgress | number:'1.0-0' }}%</span>
              </div>
            </div>
            <div class="lc-steps">
              @for (step of loadingSteps; track step.label; let i = $index) {
                <div class="lc-step" [class.active]="loadingStage === i" [class.done]="loadingStage > i">
                  <div class="lc-step-dot">
                    @if (loadingStage > i) {
                      <mat-icon>check</mat-icon>
                    } @else {
                      <mat-icon>{{ step.icon }}</mat-icon>
                    }
                  </div>
                  <span class="lc-step-label">{{ step.label }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      } @else {
      <!-- Modern Header -->
      <div class="dashboard-header">
        <div class="header-content-wrapper">
          <div class="header-icon-wrapper">
            <mat-icon>point_of_sale</mat-icon>
          </div>
          <div class="header-text-area">
            <h1>Sales Dashboard</h1>
            <p class="subtitle">Manage customers, invoices, and orders across all companies</p>
          </div>
        </div>
        <div class="header-stats-row">
          <div class="mini-stat">
            <mat-icon>people</mat-icon>
            <div class="mini-stat-info">
              <span class="mini-value">{{ stats().totalCustomers }}</span>
              <span class="mini-label">Customers</span>
            </div>
          </div>
          <div class="mini-stat">
            <mat-icon>receipt_long</mat-icon>
            <div class="mini-stat-info">
              <span class="mini-value">{{ stats().totalInvoices }}</span>
              <span class="mini-label">Invoices</span>
            </div>
          </div>
          <div class="mini-stat">
            <mat-icon>shopping_cart</mat-icon>
            <div class="mini-stat-info">
              <span class="mini-value">{{ stats().incomingOrders }}</span>
              <span class="mini-label">Orders</span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button class="action-btn attention" (click)="openAttentionDialog()" 
                  [matBadge]="attentionCount()" matBadgeColor="accent"
                  [matBadgeHidden]="attentionCount() === 0">
            <mat-icon>warning</mat-icon>
            <span>Attention</span>
          </button>
          <button class="action-btn primary" (click)="promptImportPassword('customers')">
            <mat-icon>group_add</mat-icon>
            <span>Import Customers</span>
          </button>
          <button class="action-btn import" (click)="promptImportPassword('sales')">
            <mat-icon>upload_file</mat-icon>
            <span>Import Sales</span>
          </button>
          <button class="action-btn delivery" (click)="openDeliveryRequestDialog()">
            <mat-icon>local_shipping</mat-icon>
            <span>Request Delivery</span>
          </button>
        </div>
      </div>

      <!-- Password Protection Dialog -->
      @if (showImportPasswordDialog) {
        <div class="dialog-overlay" (click)="closeImportPasswordDialog()">
          <div class="import-password-dialog" (click)="$event.stopPropagation()">
            <div class="password-dialog-header">
              <div class="password-icon-circle" [style.background]="pendingImportType === 'customers' ? 'linear-gradient(135deg, #1e88e5 0%, #1565c0 100%)' : 'linear-gradient(135deg, #43a047 0%, #2e7d32 100%)'">
                <mat-icon>{{ pendingImportType === 'customers' ? 'group_add' : 'lock' }}</mat-icon>
              </div>
              <h2>Import Authentication</h2>
              <p>Enter the access code to import {{ pendingImportType === 'customers' ? 'customers' : 'sales transactions' }}</p>
            </div>
            <div class="password-dialog-body">
              <div class="pin-input-group">
                @for (i of [0, 1, 2, 3]; track i) {
                  <input
                    type="password"
                    maxlength="1"
                    class="pin-digit"
                    [class.filled]="importPasswordDigits()[i]"
                    [class.error]="importPasswordError()"
                    [value]="importPasswordDigits()[i] || ''"
                    (input)="onPinInput($event, i)"
                    (keydown)="onPinKeydown($event, i)"
                    (paste)="onPinPaste($event)"
                    [attr.data-pin-index]="i"
                  />
                }
              </div>
              @if (importPasswordError()) {
                <div class="password-error">
                  <mat-icon>error_outline</mat-icon>
                  <span>Incorrect access code. Please try again.</span>
                </div>
              }
            </div>
            <div class="password-dialog-actions">
              <button class="dialog-btn cancel" (click)="closeImportPasswordDialog()">Cancel</button>
              <button class="dialog-btn submit" (click)="verifyImportPassword()" [disabled]="importPasswordDigits().join('').length < 4">Verify</button>
            </div>
          </div>
        </div>
      }

      <!-- Email View PIN Dialog -->
      @if (showEmailPinDialog) {
        <div class="dialog-overlay" (click)="closeEmailPinDialog()">
          <div class="import-password-dialog" (click)="$event.stopPropagation()">
            <div class="password-dialog-header">
              <div class="password-icon-circle" style="background: linear-gradient(135deg, #1a237e 0%, #3f51b5 100%); box-shadow: 0 8px 24px rgba(26, 35, 126, 0.3);">
                <mat-icon>mail_lock</mat-icon>
              </div>
              <h2>Email Protected</h2>
              <p>Enter PIN to view this email</p>
            </div>
            <div class="password-dialog-body">
              <div class="pin-input-group">
                @for (i of [0, 1, 2]; track i) {
                  <input
                    type="password"
                    maxlength="1"
                    class="pin-digit email-pin"
                    [class.filled]="emailPinDigits()[i]"
                    [class.error]="emailPinError()"
                    [value]="emailPinDigits()[i] || ''"
                    (input)="onEmailPinInput($event, i)"
                    (keydown)="onEmailPinKeydown($event, i)"
                    (paste)="onEmailPinPaste($event)"
                    [attr.data-email-pin-index]="i"
                  />
                }
              </div>
              @if (emailPinError()) {
                <div class="password-error">
                  <mat-icon>error_outline</mat-icon>
                  <span>Incorrect PIN. Please try again.</span>
                </div>
              }
            </div>
            <div class="password-dialog-actions">
              <button class="dialog-btn cancel" (click)="closeEmailPinDialog()">Cancel</button>
              <button class="dialog-btn submit" style="background: linear-gradient(135deg, #1a237e 0%, #3f51b5 100%); box-shadow: 0 4px 12px rgba(26, 35, 126, 0.3);" (click)="verifyEmailPin()" [disabled]="emailPinDigits().join('').length < 3">Unlock</button>
            </div>
          </div>
        </div>
      }

      <!-- Edit Invoice Dialog -->
      @if (showEditInvoiceDialog) {
        <div class="dialog-overlay" (click)="closeEditInvoiceDialog()">
          <div class="edit-invoice-dialog" (click)="$event.stopPropagation()">
            <div class="edit-invoice-header">
              <div class="edit-invoice-icon">
                <mat-icon>edit_note</mat-icon>
              </div>
              <h2>Edit Invoice</h2>
              <p>Update invoice details below</p>
              <button mat-icon-button class="edit-invoice-close" (click)="closeEditInvoiceDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="edit-invoice-body">
              <div class="edit-invoice-grid">
                <div class="edit-field">
                  <label>Transaction Number</label>
                  <input type="text" [(ngModel)]="editInvoiceForm.transactionNumber" placeholder="Transaction #" />
                </div>
                <div class="edit-field">
                  <label>Customer Name</label>
                  <input type="text" [(ngModel)]="editInvoiceForm.customerName" placeholder="Customer name" />
                </div>
                <div class="edit-field">
                  <label>Customer Number</label>
                  <input type="text" [(ngModel)]="editInvoiceForm.customerNumber" placeholder="Customer #" />
                </div>
                <div class="edit-field">
                  <label>Product Code</label>
                  <input type="text" [(ngModel)]="editInvoiceForm.productCode" placeholder="Product code" />
                </div>
                <div class="edit-field full-width">
                  <label>Product Description</label>
                  <input type="text" [(ngModel)]="editInvoiceForm.productDescription" placeholder="Product description" />
                </div>
                <div class="edit-field">
                  <label>Quantity</label>
                  <input type="number" [(ngModel)]="editInvoiceForm.quantity" placeholder="0" />
                </div>
                <div class="edit-field">
                  <label>Sales Amount</label>
                  <input type="number" [(ngModel)]="editInvoiceForm.salesAmount" step="0.01" placeholder="0.00" />
                </div>
                <div class="edit-field">
                  <label>Cost of Sales</label>
                  <input type="number" [(ngModel)]="editInvoiceForm.costOfSales" step="0.01" placeholder="0.00" />
                </div>
                <div class="edit-field">
                  <label>Transaction Date</label>
                  <input type="date" [(ngModel)]="editInvoiceForm.transactionDate" />
                </div>
                <div class="edit-field">
                  <label>Status</label>
                  <select [(ngModel)]="editInvoiceForm.status">
                    <option value="Pending">Pending</option>
                    <option value="Assigned">Assigned</option>
                    <option value="InProgress">In Progress</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div class="edit-field">
                  <label>Delivery Province</label>
                  <select [(ngModel)]="editInvoiceForm.deliveryProvince">
                    <option value="">-- Select --</option>
                    @for (p of provinces; track p) {
                      <option [value]="p">{{ p }}</option>
                    }
                  </select>
                </div>
                <div class="edit-field">
                  <label>Source Company</label>
                  <input type="text" [(ngModel)]="editInvoiceForm.sourceCompany" placeholder="Source company" />
                </div>
                <div class="edit-field full-width">
                  <label>Delivery Address</label>
                  <input type="text" [(ngModel)]="editInvoiceForm.deliveryAddress" placeholder="Delivery address" />
                </div>
              </div>
            </div>
            <div class="edit-invoice-actions">
              <button class="dialog-btn cancel" (click)="closeEditInvoiceDialog()">Cancel</button>
              <button class="dialog-btn submit" (click)="saveEditedInvoice()" [disabled]="editInvoiceSaving">
                @if (editInvoiceSaving) {
                  <mat-icon class="spin-icon">sync</mat-icon> Saving...
                } @else {
                  <mat-icon>save</mat-icon> Save Changes
                }
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ==================== REQUEST DELIVERY DIALOG ==================== -->
      @if (showDeliveryDialog) {
        <div class="dialog-overlay" (click)="closeDeliveryDialog()">
          <div class="delivery-request-dialog" (click)="$event.stopPropagation()">
            <div class="delivery-header">
              <div class="delivery-icon-circle">
                <mat-icon>local_shipping</mat-icon>
              </div>
              <h2>Request Urgent Delivery</h2>
              <p>Select invoices that require logistics to deliver urgently</p>
              <button mat-icon-button class="delivery-close-btn" (click)="closeDeliveryDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            @if (deliverySuccess) {
              <div class="delivery-success-state">
                <div class="delivery-success-icon"><mat-icon>check_circle</mat-icon></div>
                <h3>Delivery Request Submitted!</h3>
                <p>{{ deliverySuccessMsg }}</p>
                <div class="delivery-success-ref">{{ deliverySuccessRef }}</div>
                <div class="delivery-success-actions">
                  <button class="dialog-btn submit delivery-submit" (click)="resetDeliveryForm()">
                    <mat-icon>add</mat-icon> Submit Another
                  </button>
                  <button class="dialog-btn cancel" (click)="closeDeliveryDialog()">
                    <mat-icon>close</mat-icon> Close
                  </button>
                </div>
              </div>
            } @else {
              <div class="delivery-body">
                @if (deliveryError) {
                  <div class="delivery-error-bar">
                    <mat-icon>error_outline</mat-icon>
                    <span>{{ deliveryError }}</span>
                  </div>
                }

                <!-- Invoice Search & Selection -->
                <div class="delivery-section">
                  <label class="delivery-section-label">Search & Select Invoices <span class="req-star">*</span></label>
                  <div class="delivery-invoice-search">
                    <mat-icon>search</mat-icon>
                    <input type="text" placeholder="Search by invoice #, customer name, product..." [(ngModel)]="deliveryInvoiceSearch" (input)="filterDeliveryInvoices()">
                    @if (deliveryInvoiceSearch) {
                      <button mat-icon-button class="clear-search" (click)="deliveryInvoiceSearch = ''; filterDeliveryInvoices()">
                        <mat-icon>close</mat-icon>
                      </button>
                    }
                  </div>

                  @if (deliverySelectedInvoices.length > 0) {
                    <div class="delivery-selected-chips">
                      <span class="selected-label">Selected ({{ deliverySelectedInvoices.length }}):</span>
                      @for (inv of deliverySelectedInvoices; track inv.id) {
                        <div class="delivery-chip">
                          <span>{{ inv.transactionNumber }}</span>
                          <span class="chip-customer">{{ inv.customerName }}</span>
                          <button mat-icon-button class="chip-remove" (click)="removeDeliveryInvoice(inv)">
                            <mat-icon>close</mat-icon>
                          </button>
                        </div>
                      }
                    </div>
                  }

                  <div class="delivery-invoice-list">
                    @if (deliveryFilteredInvoices.length === 0) {
                      <div class="delivery-no-results">
                        <mat-icon>search_off</mat-icon>
                        <span>{{ deliveryInvoiceSearch ? 'No invoices match your search' : 'Type to search invoices' }}</span>
                      </div>
                    } @else {
                      @for (inv of deliveryFilteredInvoices; track inv.id) {
                        <div class="delivery-invoice-row" [class.selected]="isInvoiceSelected(inv)" (click)="toggleDeliveryInvoice(inv)">
                          <div class="inv-checkbox">
                            <mat-icon>{{ isInvoiceSelected(inv) ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
                          </div>
                          <div class="inv-details">
                            <div class="inv-top-row">
                              <strong>{{ inv.transactionNumber }}</strong>
                              <span class="inv-amount">R{{ inv.salesAmount * 1.15 | number:'1.2-2' }}</span>
                            </div>
                            <div class="inv-bottom-row">
                              <span class="inv-customer">{{ inv.customerName }}</span>
                              <span class="inv-product">{{ inv.productDescription }}</span>
                              @if (inv.deliveryProvince) {
                                <span class="inv-province">{{ inv.deliveryProvince }}</span>
                              }
                            </div>
                          </div>
                        </div>
                      }
                    }
                  </div>
                </div>

                <!-- Priority & Details -->
                <div class="delivery-form-grid">
                  <div class="delivery-field">
                    <label>Priority <span class="req-star">*</span></label>
                    <select [(ngModel)]="deliveryForm.priority">
                      <option value="Normal">Normal</option>
                      <option value="Urgent">🔴 Urgent</option>
                    </select>
                  </div>
                  <div class="delivery-field">
                    <label>Quantity</label>
                    <input type="number" [(ngModel)]="deliveryForm.quantity" min="1" placeholder="Auto from invoices">
                  </div>
                  <div class="delivery-field full-w">
                    <label>Description <span class="req-star">*</span></label>
                    <input type="text" [(ngModel)]="deliveryForm.description" placeholder="e.g. Urgent delivery required for customer order">
                  </div>
                  <div class="delivery-field full-w">
                    <label>Delivery Address</label>
                    <input type="text" [(ngModel)]="deliveryForm.deliveryAddress" placeholder="Delivery address (optional)">
                  </div>
                  <div class="delivery-field full-w">
                    <label>Notes</label>
                    <input type="text" [(ngModel)]="deliveryForm.notes" placeholder="Additional notes for logistics (optional)">
                  </div>
                </div>

                <!-- Summary preview -->
                @if (deliverySelectedInvoices.length > 0) {
                  <div class="delivery-preview">
                    <mat-icon>summarize</mat-icon>
                    <div class="preview-content">
                      <strong>{{ deliverySelectedInvoices.length }} invoice(s)</strong> selected •
                      Total value: <strong>R{{ getDeliveryTotalValue() | number:'1.2-2' }}</strong>
                      @if (deliveryForm.priority === 'Urgent') {
                        • <span class="urgent-tag">🔴 URGENT</span>
                      }
                    </div>
                  </div>
                }
              </div>

              <div class="delivery-actions">
                <button class="dialog-btn cancel" (click)="closeDeliveryDialog()">Cancel</button>
                <button class="dialog-btn submit delivery-submit" (click)="submitDeliveryRequest()" [disabled]="deliverySaving || deliverySelectedInvoices.length === 0 || !deliveryForm.description">
                  @if (deliverySaving) {
                    <mat-icon class="spin-icon">sync</mat-icon> Submitting...
                  } @else {
                    <mat-icon>send</mat-icon> Submit Request ({{ deliverySelectedInvoices.length }})
                  }
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- Hidden file inputs for import -->
      <input
        type="file"
        id="salesFileInput"
        style="display: none"
        accept=".xlsx,.xls"
        (change)="onImportFileSelected($event)"
      />
      <input
        type="file"
        id="customerFileInput"
        style="display: none"
        accept=".xlsx,.xls"
        (change)="onCustomerFileSelected($event)"
      />

      <!-- Customer Import Result Dialog -->
      @if (showCustomerImportResult && customerImportResult) {
        <div class="import-result-overlay" (click)="closeCustomerImportResult()">
          <div class="import-result-dialog" (click)="$event.stopPropagation()">
            <div class="import-result-header" [class.success]="customerImportResult.success" [class.error]="!customerImportResult.success">
              <mat-icon>{{ customerImportResult.success ? 'check_circle' : 'error' }}</mat-icon>
              <h3>Customer Import {{ customerImportResult.success ? 'Complete' : 'Failed' }}</h3>
              <button mat-icon-button (click)="closeCustomerImportResult()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="import-result-body">
              <div class="import-stats-grid">
                <div class="import-stat">
                  <span class="stat-number">{{ customerImportResult.totalRecords }}</span>
                  <span class="stat-label">Total Records</span>
                </div>
                <div class="import-stat created">
                  <span class="stat-number">{{ customerImportResult.created }}</span>
                  <span class="stat-label">Created</span>
                </div>
                <div class="import-stat updated">
                  <span class="stat-number">{{ customerImportResult.updated }}</span>
                  <span class="stat-label">Updated</span>
                </div>
                <div class="import-stat failed">
                  <span class="stat-number">{{ customerImportResult.failed }}</span>
                  <span class="stat-label">Failed</span>
                </div>
              </div>
              @if (customerImportResult.errors && customerImportResult.errors.length > 0) {
                <div class="import-errors-section">
                  <h4><mat-icon>warning</mat-icon> Errors</h4>
                  <div class="import-errors-list">
                    @for (error of customerImportResult.errors; track error) {
                      <div class="import-error-item">{{ error }}</div>
                    }
                  </div>
                </div>
              }
            </div>
            <div class="import-result-footer">
              <button mat-raised-button color="primary" (click)="closeCustomerImportResult()">Close</button>
            </div>
          </div>
        </div>
      }

      <!-- Company Sales Comparison - Business Day Comparison -->
      <div class="company-sales-section">
        <div class="section-header-row">
          <div class="section-title-area">
            <mat-icon>business</mat-icon>
            <h3>Company Performance</h3>
          </div>
          <span class="comparison-label">{{ lastBusinessDayLabel() }} → {{ currentBusinessDayLabel() }} · Trend vs MTD avg</span>
        </div>
        <div class="company-cards-grid">
          @for (cs of companySalesData(); track cs.company.code) {
            <div class="modern-company-card" [style.--company-color]="cs.company.color" (click)="openCompanySalesDialog(cs.company)">
              <div class="company-card-header">
                <div class="company-badge" [style.background]="cs.company.color">
                  {{ cs.company.shortName.charAt(0) }}
                </div>
                <div class="company-title">
                  <span class="company-name">{{ cs.company.shortName }}</span>
                  <span class="company-full">{{ cs.company.name }}</span>
                </div>
                <div class="trend-indicator" [class.up]="cs.percentChange >= 0" [class.down]="cs.percentChange < 0"
                     [matTooltip]="'vs month-to-date daily avg: R' + formatCurrency(cs.monthlyDailyAvg)">
                  <mat-icon>{{ cs.percentChange >= 0 ? 'trending_up' : 'trending_down' }}</mat-icon>
                  <span>{{ cs.percentChange >= 0 ? '+' : '' }}{{ cs.percentChange | number:'1.0-0' }}%</span>
                </div>
              </div>
              <div class="company-sales-comparison">
                <div class="sales-period yesterday">
                  <span class="period-label">{{ lastBusinessDayLabel() }}</span>
                  <span class="period-value">R{{ formatCurrency(cs.yesterdaySales) }}</span>
                  <span class="period-orders">{{ cs.yesterdayOrders }} orders</span>
                </div>
                <div class="comparison-arrow">
                  <mat-icon>east</mat-icon>
                </div>
                <div class="sales-period today">
                  <span class="period-label">{{ currentBusinessDayLabel() }}</span>
                  <span class="period-value">R{{ formatCurrency(cs.todaySales) }}</span>
                  <span class="period-orders">{{ cs.todayOrders }} orders</span>
                </div>
              </div>
              <div class="card-footer">
                <span class="click-hint"><mat-icon>touch_app</mat-icon> View Details</span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <div class="modern-stat-card customers">
          <div class="stat-icon-wrapper">
            <mat-icon>people</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats().totalCustomers }}</span>
            <span class="stat-label">Total Customers</span>
            <div class="stat-progress">
              <div class="progress-bar" [style.width.%]="(stats().activeCustomers / stats().totalCustomers) * 100"></div>
            </div>
            <span class="stat-sub">{{ stats().activeCustomers }} active ({{ ((stats().activeCustomers / stats().totalCustomers) * 100) | number:'1.0-0' }}%)</span>
          </div>
        </div>

        <div class="modern-stat-card invoices">
          <div class="stat-icon-wrapper">
            <mat-icon>receipt_long</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats().totalInvoices }}</span>
            <span class="stat-label">Total Invoices</span>
            <div class="stat-progress">
              <div class="progress-bar pending" [style.width.%]="stats().totalInvoices > 0 ? (stats().pendingInvoices / stats().totalInvoices) * 100 : 0"></div>
            </div>
            <span class="stat-sub">{{ stats().pendingInvoices }} pending</span>
          </div>
        </div>

        <div class="modern-stat-card revenue">
          <div class="stat-icon-wrapper">
            <mat-icon>trending_up</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">R{{ formatCurrency(stats().monthlyRevenue) }}</span>
            <span class="stat-label">Monthly Revenue</span>
            <div class="revenue-breakdown">
              <span class="total-label">Total: R{{ formatCurrency(stats().totalRevenue) }}</span>
            </div>
          </div>
        </div>

        <div class="modern-stat-card orders">
          <div class="stat-icon-wrapper">
            <mat-icon>email</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ stats().incomingOrders }}</span>
            <span class="stat-label">Order Emails Today</span>
            <div class="order-breakdown">
              <span class="processing-badge">
                <mat-icon>mark_email_unread</mat-icon>
                {{ stats().processingOrders }} unread
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Tabs -->
      <mat-card class="main-content">
        <mat-tab-group animationDuration="200ms" [(selectedIndex)]="selectedTab">
          <!-- Incoming Order Emails Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>email</mat-icon>
              <span>Incoming Orders</span>
              @if (stats().incomingOrders > 0) {
                <span class="tab-badge">{{ stats().incomingOrders }}</span>
              }
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h3>
                  <mat-icon style="vertical-align: middle; margin-right: 8px;">mark_email_unread</mat-icon>
                  Incoming Order Emails — Today
                </h3>
                <div class="section-actions">
                  <mat-form-field appearance="outline" class="search-field">
                    <mat-label>Filter emails</mat-label>
                    <input matInput [value]="emailFilterSearch()" (input)="emailFilterSearch.set($any($event.target).value)">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Read Status</mat-label>
                    <mat-select [value]="emailReadFilter()" (selectionChange)="emailReadFilter.set($event.value)">
                      <mat-option value="all">All</mat-option>
                      <mat-option value="unread">Unread</mat-option>
                      <mat-option value="read">Read</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field" style="min-width: 200px;">
                    <mat-label>Mailbox</mat-label>
                    <mat-select [value]="selectedEmailAccounts()" (selectionChange)="selectedEmailAccounts.set($event.value); loadOrders()" multiple>
                      @for (account of emailAccounts(); track account) {
                        <mat-option [value]="account">{{ account }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <button mat-icon-button (click)="loadOrders()" matTooltip="Refresh emails from IMAP">
                    <mat-icon>refresh</mat-icon>
                  </button>
                </div>
              </div>

              @if (loadingOrders()) {
                <div class="loading-container">
                  <mat-spinner diameter="40"></mat-spinner>
                  <p style="margin-top: 12px; color: #666;">Connecting to mail server...</p>
                </div>
              } @else if (filteredEmails().length === 0) {
                <div class="empty-state">
                  <mat-icon>mark_email_read</mat-icon>
                  <h3>No Order Emails Today</h3>
                  <p>No emails with "{{ emailSearchKeyword() }}" in the subject were found for today</p>
                  <button mat-raised-button color="primary" (click)="loadOrders()" style="margin-top: 12px;">
                    <mat-icon>refresh</mat-icon> Check Again
                  </button>
                </div>
              } @else {
                <div class="email-summary-bar">
                  <span class="email-count">
                    <mat-icon>inbox</mat-icon>
                    {{ filteredEmails().length }} email(s) found
                  </span>
                  <span class="unread-count">
                    <mat-icon>mark_email_unread</mat-icon>
                    {{ unreadEmailCount() }} unread
                  </span>
                  <span class="attachment-count">
                    <mat-icon>attach_file</mat-icon>
                    {{ attachmentEmailCount() }} with attachments
                  </span>
                </div>
                <div class="email-list">
                  @for (email of filteredEmails(); track email.messageId) {
                    <mat-card class="email-card" [class.email-unread]="!email.isRead" [class.email-high-priority]="email.priority === 'High'" (click)="viewEmailDetail(email)" style="cursor: pointer;">
                      <div class="email-row">
                        <div class="email-status-indicator">
                          @if (!email.isRead) {
                            <div class="unread-dot"></div>
                          }
                          @if (email.priority === 'High') {
                            <mat-icon class="priority-flag" matTooltip="High Priority">flag</mat-icon>
                          }
                        </div>
                        <div class="email-sender">
                          <div class="sender-avatar">
                            {{ email.from.charAt(0).toUpperCase() }}
                          </div>
                          <div class="sender-details">
                            <span class="sender-name">{{ email.from }}</span>
                            <span class="sender-email">{{ email.fromEmail }}</span>
                          </div>
                        </div>
                        <div class="email-content">
                          <div class="email-subject">
                            {{ email.subject }}
                            @if (email.hasAttachments) {
                              <mat-icon class="attachment-icon" matTooltip="Has attachments">attach_file</mat-icon>
                            }
                          </div>
                          @if (email.preview) {
                            <div class="email-preview">{{ email.preview }}</div>
                          }
                        </div>
                        <div class="email-meta">
                          <span class="email-time">{{ email.date | date:'HH:mm' }}</span>
                          <span class="email-date">{{ email.date | date:'dd MMM' }}</span>
                          @for (acct of email.foundInAccounts; track acct) {
                            <mat-chip class="mailbox-chip" matTooltip="Received in {{ acct }}">
                              {{ getMailboxName(acct) }}
                            </mat-chip>
                          }
                        </div>
                        <div class="email-actions">
                          <button mat-icon-button [matMenuTriggerFor]="emailMenu" matTooltip="More actions" (click)="$event.stopPropagation()">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #emailMenu="matMenu">
                            <button mat-menu-item (click)="viewEmailDetail(email)">
                              <mat-icon>open_in_new</mat-icon> View Full Email
                            </button>
                            <button mat-menu-item (click)="copyEmailSender(email)">
                              <mat-icon>content_copy</mat-icon> Copy Sender Email
                            </button>
                            <mat-divider></mat-divider>
                            <button mat-menu-item (click)="createOrderFromEmail(email)">
                              <mat-icon>add_shopping_cart</mat-icon> Create Order
                            </button>
                            <button mat-menu-item (click)="forwardToLogistics(email)">
                              <mat-icon>local_shipping</mat-icon> Forward to Logistics
                            </button>
                          </mat-menu>
                        </div>
                      </div>
                    </mat-card>
                  }
                </div>
              }
            </div>
          </mat-tab>

          <!-- Customers Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>people</mat-icon>
              <span>Customers</span>
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h3>Customer Management</h3>
                <div class="section-actions">
                  <mat-form-field appearance="outline" class="search-field">
                    <mat-label>Search customers</mat-label>
                    <input matInput [value]="customerSearch()" (input)="customerSearch.set($any($event.target).value); customerPageIndex.set(0)">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Province</mat-label>
                    <mat-select [value]="customerProvinceFilter()" (selectionChange)="customerProvinceFilter.set($event.value); customerPageIndex.set(0)">
                      <mat-option value="all">All Provinces</mat-option>
                      @for (province of provinces; track province) {
                        <mat-option [value]="province">{{ province }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <button mat-raised-button color="primary" (click)="promptImportPassword('customers')">
                    <mat-icon>group_add</mat-icon> Import Customers
                  </button>
                </div>
              </div>

              @if (loadingCustomers()) {
                <div class="loading-container">
                  <mat-spinner diameter="40"></mat-spinner>
                </div>
              } @else {
                <div class="table-container">
                  <table mat-table [dataSource]="filteredCustomers()" class="customers-table">
                    <ng-container matColumnDef="customerCode">
                      <th mat-header-cell *matHeaderCellDef>Code</th>
                      <td mat-cell *matCellDef="let customer">
                        <strong>{{ customer.customerCode }}</strong>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Customer Name</th>
                      <td mat-cell *matCellDef="let customer">
                        <div class="customer-name-cell">
                          <span class="name">{{ customer.name }}</span>
                          @if (customer.shortName) {
                            <span class="short-name">({{ customer.shortName }})</span>
                          }
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="contact">
                      <th mat-header-cell *matHeaderCellDef>Contact</th>
                      <td mat-cell *matCellDef="let customer">
                        <div class="contact-cell">
                          @if (customer.contactPerson) {
                            <span class="contact-person">{{ customer.contactPerson }}</span>
                          }
                          @if (customer.email) {
                            <span class="email">{{ customer.email }}</span>
                          }
                          @if (customer.phoneNumber) {
                            <span class="phone">{{ customer.phoneNumber }}</span>
                          }
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="location">
                      <th mat-header-cell *matHeaderCellDef>Location</th>
                      <td mat-cell *matCellDef="let customer">
                        <div class="location-cell">
                          @if (customer.city || customer.province) {
                            <span>{{ customer.city }}{{ customer.city && customer.province ? ', ' : '' }}{{ customer.province }}</span>
                          } @else {
                            <span class="no-data">No location</span>
                          }
                          @if (customer.latitude && customer.longitude) {
                            <mat-icon class="verified-icon" matTooltip="Address verified">verified</mat-icon>
                          }
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let customer">
                        <mat-chip [class]="'status-' + customer.status.toLowerCase()">
                          {{ customer.status }}
                        </mat-chip>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let customer">
                        <button mat-icon-button matTooltip="Edit" (click)="editCustomer(customer)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button matTooltip="View Invoices" (click)="viewCustomerInvoices(customer)">
                          <mat-icon>receipt</mat-icon>
                        </button>
                        <button mat-icon-button matTooltip="Geocode Address" (click)="geocodeCustomer(customer)">
                          <mat-icon>location_on</mat-icon>
                        </button>
                        <button mat-icon-button [matMenuTriggerFor]="customerMenu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #customerMenu="matMenu">
                          <button mat-menu-item (click)="createOrderForCustomer(customer)">
                            <mat-icon>add_shopping_cart</mat-icon> New Order
                          </button>
                          <button mat-menu-item (click)="viewCustomerHistory(customer)">
                            <mat-icon>history</mat-icon> View History
                          </button>
                          <mat-divider></mat-divider>
                          <button mat-menu-item class="delete-btn" (click)="deleteCustomer(customer)">
                            <mat-icon>delete</mat-icon> Delete
                          </button>
                        </mat-menu>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="customerColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: customerColumns;" 
                        (click)="selectCustomer(row)"
                        [class.selected]="selectedCustomer()?.id === row.id"></tr>
                  </table>
                </div>
                <mat-paginator [length]="allFilteredCustomers().length"
                               [pageSize]="customerPageSize()"
                               [pageIndex]="customerPageIndex()"
                               [pageSizeOptions]="[5, 10, 25, 50]"
                               (page)="onCustomerPageChange($event)"
                               showFirstLastButtons>
                </mat-paginator>
              }
            </div>
          </mat-tab>

          <!-- Invoices Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>receipt_long</mat-icon>
              <span>Invoices</span>
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h3>Invoice Management</h3>
                <div class="section-actions">
                  <mat-form-field appearance="outline" class="search-field">
                    <mat-label>Search invoices</mat-label>
                    <input matInput [value]="invoiceSearch()" (input)="invoiceSearch.set($any($event.target).value); invoicePageIndex.set(0)">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Status</mat-label>
                    <mat-select [value]="invoiceStatusFilter()" (selectionChange)="invoiceStatusFilter.set($event.value); invoicePageIndex.set(0)">
                      <mat-option value="all">All Status</mat-option>
                      <mat-option value="Pending">Pending</mat-option>
                      <mat-option value="Assigned">Assigned</mat-option>
                      <mat-option value="Delivered">Delivered</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-stroked-button (click)="importInvoices()">
                    <mat-icon>upload</mat-icon> Import
                  </button>
                  <button mat-flat-button class="request-delivery-tab-btn" (click)="openDeliveryRequestDialog()">
                    <mat-icon>local_shipping</mat-icon> Request Delivery
                  </button>
                </div>
              </div>

              @if (loadingInvoices()) {
                <div class="loading-container">
                  <mat-spinner diameter="40"></mat-spinner>
                </div>
              } @else {
                <div class="table-container">
                  <table mat-table [dataSource]="filteredInvoices()" class="invoices-table">
                    <ng-container matColumnDef="transactionNumber">
                      <th mat-header-cell *matHeaderCellDef>Invoice #</th>
                      <td mat-cell *matCellDef="let inv">
                        <strong>{{ inv.transactionNumber }}</strong>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef>Date</th>
                      <td mat-cell *matCellDef="let inv">{{ inv.transactionDate | date:'dd/MM/yyyy' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="customer">
                      <th mat-header-cell *matHeaderCellDef>Customer</th>
                      <td mat-cell *matCellDef="let inv">
                        <div class="customer-cell">
                          <span class="name">{{ inv.customerName }}</span>
                          <span class="code">{{ inv.customerNumber }}</span>
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="product">
                      <th mat-header-cell *matHeaderCellDef>Product</th>
                      <td mat-cell *matCellDef="let inv">
                        <div class="product-cell">
                          <span class="description">{{ inv.productDescription }}</span>
                          <span class="code">{{ inv.productCode }}</span>
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="amount">
                      <th mat-header-cell *matHeaderCellDef>Amount (incl. VAT)</th>
                      <td mat-cell *matCellDef="let inv">
                        <div class="amount-cell">
                          <span class="sales">R{{ inv.salesAmount * 1.15 | number:'1.2-2' }}</span>
                          <span class="margin" [class.positive]="inv.salesAmount > inv.costOfSales">
                            {{ calculateMargin(inv.salesAmount, inv.costOfSales) | number:'1.1-1' }}%
                          </span>
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="province">
                      <th mat-header-cell *matHeaderCellDef>Province</th>
                      <td mat-cell *matCellDef="let inv">
                        @if (inv.deliveryProvince) {
                          <span>{{ inv.deliveryProvince }}</span>
                        } @else {
                          <span class="no-data">Not set</span>
                        }
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="source">
                      <th mat-header-cell *matHeaderCellDef>Source</th>
                      <td mat-cell *matCellDef="let inv">
                        @if (inv.sourceCompany) {
                          <mat-chip class="company-chip" [style.background-color]="getCompanyColor(inv.sourceCompany)">
                            {{ getCompanyShortName(inv.sourceCompany) }}
                          </mat-chip>
                        } @else {
                          <span class="no-data">-</span>
                        }
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let inv">
                        <mat-chip [class]="'status-' + inv.status.toLowerCase()">
                          {{ inv.status }}
                        </mat-chip>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let inv">
                        <button mat-icon-button matTooltip="Edit" (click)="editInvoice(inv)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button matTooltip="Request Delivery" (click)="sendToLogistics(inv)" class="req-delivery-icon">
                          <mat-icon>local_shipping</mat-icon>
                        </button>
                        <button mat-icon-button [matMenuTriggerFor]="invoiceMenu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #invoiceMenu="matMenu">
                          <button mat-menu-item (click)="printInvoice(inv)">
                            <mat-icon>print</mat-icon> Print
                          </button>
                          <button mat-menu-item (click)="emailInvoice(inv)">
                            <mat-icon>email</mat-icon> Email to Customer
                          </button>
                          <button mat-menu-item (click)="duplicateInvoice(inv)">
                            <mat-icon>content_copy</mat-icon> Duplicate
                          </button>
                          <mat-divider></mat-divider>
                          <button mat-menu-item class="delete-btn" (click)="deleteInvoice(inv)">
                            <mat-icon>delete</mat-icon> Delete
                          </button>
                        </mat-menu>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="invoiceColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: invoiceColumns;"></tr>
                  </table>
                </div>
                <mat-paginator [length]="allFilteredInvoices().length"
                               [pageSize]="invoicePageSize()"
                               [pageIndex]="invoicePageIndex()"
                               [pageSizeOptions]="[10, 15, 25, 50, 100]"
                               (page)="onInvoicePageChange($event)"
                               showFirstLastButtons>
                </mat-paginator>
              }
            </div>
          </mat-tab>

          <!-- POD Documents Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>verified</mat-icon>
              <span>POD Documents</span>
              @if (podTotalCount > 0) {
                <span class="tab-badge">{{ podTotalCount }}</span>
              }
            </ng-template>
            <div class="tab-content">
              <div class="pod-section">
                <!-- POD Toolbar -->
                <div class="pod-toolbar">
                  <div class="pod-filters">
                    <mat-form-field appearance="outline" class="pod-filter-field">
                      <mat-label>Region</mat-label>
                      <mat-select [(ngModel)]="podRegionFilter" (selectionChange)="loadPodDocuments()">
                        <mat-option value="">All Regions</mat-option>
                        <mat-option value="GP">Gauteng (GP)</mat-option>
                        <mat-option value="KZN">KwaZulu-Natal (KZN)</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="pod-filter-field">
                      <mat-label>Month</mat-label>
                      <mat-select [(ngModel)]="podMonthFilter" (selectionChange)="loadPodDocuments()">
                        <mat-option value="">All Months</mat-option>
                        <mat-option value="1-2026">January 2026</mat-option>
                        <mat-option value="2-2026">February 2026</mat-option>
                        <mat-option value="3-2026">March 2026</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="pod-filter-field pod-driver-field">
                      <mat-label>Driver</mat-label>
                      <mat-select [(ngModel)]="podDriverFilter" (selectionChange)="loadPodDocuments()">
                        <mat-option value="">All Drivers</mat-option>
                        @for (driver of podDriverList; track driver) {
                          <mat-option [value]="driver">{{ driver }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="pod-filter-field">
                      <mat-label>Link Status</mat-label>
                      <mat-select [(ngModel)]="podLinkFilter" (selectionChange)="loadPodDocuments()">
                        <mat-option value="">All</mat-option>
                        <mat-option value="linked">Linked</mat-option>
                        <mat-option value="not-linked">Not Linked</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>

                  <div class="pod-actions">
                    <button mat-stroked-button class="pod-upload-btn" (click)="openSalesPodUploadDialog()">
                      <mat-icon>upload_file</mat-icon> Upload POD
                    </button>
                    <div class="pod-view-toggle">
                      <button mat-icon-button [class.active]="podViewMode === 'grid'" (click)="podViewMode = 'grid'" matTooltip="Grid View">
                        <mat-icon>grid_view</mat-icon>
                      </button>
                      <button mat-icon-button [class.active]="podViewMode === 'list'" (click)="podViewMode = 'list'" matTooltip="List View">
                        <mat-icon>view_list</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- POD Summary Stats -->
                @if (podSummary) {
                  <div class="pod-stats-row">
                    <div class="pod-stat-chip">
                      <mat-icon>folder</mat-icon>
                      <span class="stat-num">{{ podSummary.total }}</span>
                      <span class="stat-lbl">Total PODs</span>
                    </div>
                    <div class="pod-stat-chip linked-chip">
                      <mat-icon>link</mat-icon>
                      <span class="stat-num">{{ podSummary.linked || 0 }}</span>
                      <span class="stat-lbl">Linked</span>
                    </div>
                    <div class="pod-stat-chip tripsheet-chip">
                      <mat-icon>description</mat-icon>
                      <span class="stat-num">{{ podSummary.linkedToTripsheet || 0 }}</span>
                      <span class="stat-lbl">Tripsheets</span>
                    </div>
                    <div class="pod-stat-chip invoice-chip">
                      <mat-icon>receipt</mat-icon>
                      <span class="stat-num">{{ podSummary.linkedToInvoice || 0 }}</span>
                      <span class="stat-lbl">Invoices</span>
                    </div>
                    <div class="pod-stat-chip unlinked-chip">
                      <mat-icon>link_off</mat-icon>
                      <span class="stat-num">{{ podSummary.unlinked || 0 }}</span>
                      <span class="stat-lbl">Not Linked</span>
                    </div>
                    @for (r of podSummary.byRegion; track r.region) {
                      <div class="pod-stat-chip region-chip">
                        <mat-icon>location_on</mat-icon>
                        <span class="stat-num">{{ r.count }}</span>
                        <span class="stat-lbl">{{ r.region }}</span>
                      </div>
                    }
                    <div class="pod-stat-chip drivers-chip">
                      <mat-icon>people</mat-icon>
                      <span class="stat-num">{{ podSummary.drivers?.length || 0 }}</span>
                      <span class="stat-lbl">Drivers</span>
                    </div>
                  </div>
                }

                <!-- Loading State -->
                @if (podLoading) {
                  <div class="loading-state">
                    <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
                    <p>Loading POD documents...</p>
                  </div>
                } @else if (podDocuments.length === 0) {
                  <div class="empty-state">
                    <mat-icon>verified</mat-icon>
                    <h3>No POD Documents Found</h3>
                    <p>Adjust your filters or upload new POD documents</p>
                  </div>
                } @else {
                  <!-- Grid View -->
                  @if (podViewMode === 'grid') {
                    <div class="pod-grid">
                      @for (pod of podDocuments; track pod.id) {
                        <mat-card class="pod-card" (click)="viewPodDocument(pod)">
                          <div class="pod-card-header">
                            <mat-icon class="pdf-icon">picture_as_pdf</mat-icon>
                            <div class="pod-card-info">
                              <span class="pod-driver">{{ pod.driverName }}</span>
                              <span class="pod-date">{{ pod.deliveryDate | date:'dd MMM yyyy' }}</span>
                            </div>
                            <span class="pod-link-badge" [ngClass]="(pod.loadId || pod.invoiceId) ? 'linked' : 'not-linked'">
                              <mat-icon>{{ (pod.loadId || pod.invoiceId) ? 'link' : 'link_off' }}</mat-icon>
                              {{ pod.loadId ? 'Tripsheet' : pod.invoiceId ? 'Invoice' : 'Not Linked' }}
                            </span>
                            <span class="pod-region-badge" [ngClass]="'region-' + pod.region.toLowerCase()">{{ pod.region }}</span>
                          </div>
                          @if (pod.loadNumber) {
                            <div class="pod-tripsheet-ref">
                              <mat-icon>description</mat-icon>
                              <span>{{ pod.loadNumber }}</span>
                            </div>
                          }
                          @if (pod.invoiceNumber) {
                            <div class="pod-tripsheet-ref invoice-ref">
                              <mat-icon>receipt</mat-icon>
                              <span>{{ pod.invoiceNumber }}</span>
                            </div>
                          }
                          <div class="pod-card-meta">
                            <span class="pod-filename" matTooltip="{{ pod.originalFileName }}">{{ pod.originalFileName || pod.fileName }}</span>
                            <span class="pod-size">{{ formatPodFileSize(pod.fileSize) }}</span>
                          </div>
                          <div class="pod-card-actions">
                            <button mat-icon-button color="primary" (click)="viewPodDocument(pod); $event.stopPropagation()" matTooltip="View">
                              <mat-icon>visibility</mat-icon>
                            </button>
                            <button mat-icon-button (click)="downloadPodDocument(pod); $event.stopPropagation()" matTooltip="Download">
                              <mat-icon>download</mat-icon>
                            </button>
                            <button mat-icon-button [matMenuTriggerFor]="podActionMenu" (click)="$event.stopPropagation()" matTooltip="Actions">
                              <mat-icon>more_vert</mat-icon>
                            </button>
                            <mat-menu #podActionMenu="matMenu" class="modern-menu">
                              @if (!pod.loadId) {
                                <button mat-menu-item (click)="openLinkTripsheetDialog(pod)">
                                  <mat-icon>link</mat-icon> Link to Tripsheet
                                </button>
                              } @else {
                                <button mat-menu-item (click)="delinkPod(pod)">
                                  <mat-icon>link_off</mat-icon> Delink from Tripsheet
                                </button>
                              }
                              @if (!pod.invoiceId) {
                                <button mat-menu-item (click)="openLinkInvoiceDialog(pod)">
                                  <mat-icon>receipt</mat-icon> Link to Invoice
                                </button>
                              } @else {
                                <button mat-menu-item (click)="delinkInvoice(pod)">
                                  <mat-icon>receipt_long</mat-icon> Delink from Invoice
                                </button>
                              }
                              <button mat-menu-item (click)="openEditPodDialog(pod)">
                                <mat-icon>edit</mat-icon> Edit Details
                              </button>
                            </mat-menu>
                          </div>
                        </mat-card>
                      }
                    </div>
                  } @else {
                    <!-- List View -->
                    <div class="pod-list-container">
                      <table mat-table [dataSource]="podDocuments" class="pod-table modern-table">
                        <ng-container matColumnDef="driverName">
                          <th mat-header-cell *matHeaderCellDef>Driver</th>
                          <td mat-cell *matCellDef="let pod">{{ pod.driverName }}</td>
                        </ng-container>
                        <ng-container matColumnDef="deliveryDate">
                          <th mat-header-cell *matHeaderCellDef>Date</th>
                          <td mat-cell *matCellDef="let pod">{{ pod.deliveryDate | date:'dd MMM yyyy' }}</td>
                        </ng-container>
                        <ng-container matColumnDef="region">
                          <th mat-header-cell *matHeaderCellDef>Region</th>
                          <td mat-cell *matCellDef="let pod">
                            <span class="pod-region-badge small" [ngClass]="'region-' + pod.region.toLowerCase()">{{ pod.region }}</span>
                          </td>
                        </ng-container>
                        <ng-container matColumnDef="linkStatus">
                          <th mat-header-cell *matHeaderCellDef>Status</th>
                          <td mat-cell *matCellDef="let pod">
                            @if (pod.loadId) {
                              <span class="pod-link-badge small linked">
                                <mat-icon>link</mat-icon>
                                {{ pod.loadNumber || 'Tripsheet' }}
                              </span>
                            } @else if (pod.invoiceId) {
                              <span class="pod-link-badge small linked invoice">
                                <mat-icon>receipt</mat-icon>
                                {{ pod.invoiceNumber || 'Invoice' }}
                              </span>
                            } @else {
                              <span class="pod-link-badge small not-linked">
                                <mat-icon>link_off</mat-icon>
                                Not Linked
                              </span>
                            }
                          </td>
                        </ng-container>
                        <ng-container matColumnDef="fileName">
                          <th mat-header-cell *matHeaderCellDef>File</th>
                          <td mat-cell *matCellDef="let pod">{{ pod.originalFileName || pod.fileName }}</td>
                        </ng-container>
                        <ng-container matColumnDef="fileSize">
                          <th mat-header-cell *matHeaderCellDef>Size</th>
                          <td mat-cell *matCellDef="let pod">{{ formatPodFileSize(pod.fileSize) }}</td>
                        </ng-container>
                        <ng-container matColumnDef="actions">
                          <th mat-header-cell *matHeaderCellDef>Actions</th>
                          <td mat-cell *matCellDef="let pod">
                            <button mat-icon-button color="primary" (click)="viewPodDocument(pod); $event.stopPropagation()" matTooltip="View">
                              <mat-icon>visibility</mat-icon>
                            </button>
                            <button mat-icon-button (click)="downloadPodDocument(pod); $event.stopPropagation()" matTooltip="Download">
                              <mat-icon>download</mat-icon>
                            </button>
                            <button mat-icon-button [matMenuTriggerFor]="podListMenu" (click)="$event.stopPropagation()" matTooltip="Actions">
                              <mat-icon>more_vert</mat-icon>
                            </button>
                            <mat-menu #podListMenu="matMenu" class="modern-menu">
                              @if (!pod.loadId) {
                                <button mat-menu-item (click)="openLinkTripsheetDialog(pod)">
                                  <mat-icon>link</mat-icon> Link to Tripsheet
                                </button>
                              } @else {
                                <button mat-menu-item (click)="delinkPod(pod)">
                                  <mat-icon>link_off</mat-icon> Delink from Tripsheet
                                </button>
                              }
                              @if (!pod.invoiceId) {
                                <button mat-menu-item (click)="openLinkInvoiceDialog(pod)">
                                  <mat-icon>receipt</mat-icon> Link to Invoice
                                </button>
                              } @else {
                                <button mat-menu-item (click)="delinkInvoice(pod)">
                                  <mat-icon>receipt_long</mat-icon> Delink from Invoice
                                </button>
                              }
                              <button mat-menu-item (click)="openEditPodDialog(pod)">
                                <mat-icon>edit</mat-icon> Edit Details
                              </button>
                            </mat-menu>
                          </td>
                        </ng-container>
                        <tr mat-header-row *matHeaderRowDef="podTableColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: podTableColumns;" class="clickable-row" (click)="viewPodDocument(row)"></tr>
                      </table>
                    </div>
                  }

                  <!-- Pagination -->
                  @if (podTotalCount > podPageSize) {
                    <div class="pod-pagination">
                      <span class="pod-page-info">Showing {{ (podCurrentPage - 1) * podPageSize + 1 }} - {{ Math.min(podCurrentPage * podPageSize, podTotalCount) }} of {{ podTotalCount }}</span>
                      <div class="pod-page-btns">
                        <button mat-icon-button [disabled]="podCurrentPage <= 1" (click)="podCurrentPage = podCurrentPage - 1; loadPodDocuments()">
                          <mat-icon>chevron_left</mat-icon>
                        </button>
                        <span class="page-num">Page {{ podCurrentPage }}</span>
                        <button mat-icon-button [disabled]="podCurrentPage * podPageSize >= podTotalCount" (click)="podCurrentPage = podCurrentPage + 1; loadPodDocuments()">
                          <mat-icon>chevron_right</mat-icon>
                        </button>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </mat-tab>

          <!-- Back Orders Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>assignment_return</mat-icon>
              <span>Back Orders</span>
              @if (backOrderTotalCount() > 0) {
                <span class="tab-badge warning">{{ backOrderTotalCount() }}</span>
              }
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h3>Back Orders</h3>
                <div class="section-actions">
                  <mat-form-field appearance="outline" class="search-field">
                    <mat-label>Search back orders</mat-label>
                    <input matInput [value]="backOrderSearch()" (input)="backOrderSearch.set($any($event.target).value)">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                </div>
              </div>

              <!-- Back Order Stats -->
              <div class="back-order-stats">
                <div class="bo-stat total">
                  <mat-icon>inventory</mat-icon>
                  <div class="stat-info">
                    <span class="value">{{ filteredBackOrders().length }}</span>
                    <span class="label">Total Items</span>
                  </div>
                </div>
                <div class="bo-stat qty">
                  <mat-icon>shopping_cart</mat-icon>
                  <div class="stat-info">
                    <span class="value">{{ backOrderTotalQty() }}</span>
                    <span class="label">Total Qty</span>
                  </div>
                </div>
                <div class="bo-stat value">
                  <mat-icon>payments</mat-icon>
                  <div class="stat-info">
                    <span class="value">R{{ formatCurrency(backOrderTotalValue()) }}</span>
                    <span class="label">Total Value</span>
                  </div>
                </div>
                <div class="bo-stat orders">
                  <mat-icon>receipt_long</mat-icon>
                  <div class="stat-info">
                    <span class="value">{{ backOrderUniqueOrders() }}</span>
                    <span class="label">Unique Orders</span>
                  </div>
                </div>
              </div>

              <!-- Company Sub-Tabs -->
              <div class="back-order-company-tabs">
                <button class="bo-company-tab" [class.active]="activeBackOrderTab() === 'promed'" (click)="activeBackOrderTab.set('promed'); backOrderPage.set(0)">
                  <span class="bo-tab-dot" style="background:#1a237e"></span>
                  Promed
                  <span class="bo-tab-count">{{ promedBackOrders().length }}</span>
                </button>
                <button class="bo-company-tab" [class.active]="activeBackOrderTab() === 'access'" (click)="activeBackOrderTab.set('access'); backOrderPage.set(0)">
                  <span class="bo-tab-dot" style="background:#00695c"></span>
                  Access
                  <span class="bo-tab-count">{{ accessBackOrders().length }}</span>
                </button>
                <button class="bo-company-tab" [class.active]="activeBackOrderTab() === 'pharmatech'" (click)="activeBackOrderTab.set('pharmatech'); backOrderPage.set(0)">
                  <span class="bo-tab-dot" style="background:#c62828"></span>
                  Pharmatech
                  <span class="bo-tab-count">{{ pharmatechBackOrders().length }}</span>
                </button>
                <button class="bo-company-tab" [class.active]="activeBackOrderTab() === 'sebenzani'" (click)="activeBackOrderTab.set('sebenzani'); backOrderPage.set(0)">
                  <span class="bo-tab-dot" style="background:#6a1b9a"></span>
                  Sebenzani
                  <span class="bo-tab-count">{{ sebenzaniBackOrders().length }}</span>
                </button>
              </div>

              <!-- Back Orders Table -->
              @if (activeBackOrderTab() === 'promed' || activeBackOrderTab() === 'access' || activeBackOrderTab() === 'pharmatech' || activeBackOrderTab() === 'sebenzani') {
                @if (filteredBackOrders().length === 0) {
                  <div class="empty-state">
                    <mat-icon>inventory_2</mat-icon>
                    <h3>No Back Orders Found</h3>
                    <p>No back orders match your search criteria</p>
                  </div>
                } @else {
                  <div class="back-order-table-wrapper">
                    <table class="back-order-table">
                      <thead>
                        <tr>
                          <th class="bo-col-order">Order No</th>
                          <th class="bo-col-date">Order Date</th>
                          <th class="bo-col-custno">Cust No</th>
                          <th class="bo-col-custname">Customer Name</th>
                          <th class="bo-col-po">PO No</th>
                          <th class="bo-col-item">Item Description</th>
                          <th class="bo-col-loc">Location</th>
                          <th class="bo-col-uom">UOM</th>
                          <th class="bo-col-qty">Qty B/O</th>
                          <th class="bo-col-price">Unit Price</th>
                          <th class="bo-col-ext">Ext Price</th>
                          <th class="bo-col-contract">Contract</th>
                          <th class="bo-col-acct">Account Set</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (bo of paginatedBackOrders(); track bo.orderNumber + bo.itemDesc) {
                          <tr>
                            <td class="bo-col-order"><strong>{{ bo.orderNumber }}</strong></td>
                            <td class="bo-col-date">{{ bo.orderDate }}</td>
                            <td class="bo-col-custno">{{ bo.customerNo }}</td>
                            <td class="bo-col-custname">{{ bo.customerName }}</td>
                            <td class="bo-col-po">{{ bo.poNo }}</td>
                            <td class="bo-col-item">{{ bo.itemDesc }}</td>
                            <td class="bo-col-loc">{{ bo.location }}</td>
                            <td class="bo-col-uom">{{ bo.uom }}</td>
                            <td class="bo-col-qty">{{ bo.qtyBackOrder }}</td>
                            <td class="bo-col-price">R{{ bo.unitPrice | number:'1.2-2' }}</td>
                            <td class="bo-col-ext">R{{ bo.extPrice | number:'1.2-2' }}</td>
                            <td class="bo-col-contract">{{ bo.contract }}</td>
                            <td class="bo-col-acct">{{ bo.accountSet }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <div class="back-order-pagination">
                    <span class="bo-page-info">Showing {{ backOrderPageStart() + 1 }}-{{ backOrderPageEnd() }} of {{ filteredBackOrders().length }} items</span>
                    <div class="bo-page-controls">
                      <button mat-icon-button [disabled]="backOrderPage() === 0" (click)="backOrderPage.set(backOrderPage() - 1)">
                        <mat-icon>chevron_left</mat-icon>
                      </button>
                      <span class="bo-page-number">Page {{ backOrderPage() + 1 }} of {{ backOrderTotalPages() }}</span>
                      <button mat-icon-button [disabled]="backOrderPage() >= backOrderTotalPages() - 1" (click)="backOrderPage.set(backOrderPage() + 1)">
                        <mat-icon>chevron_right</mat-icon>
                      </button>
                      <mat-form-field appearance="outline" class="bo-page-size-field">
                        <mat-select [value]="backOrderPageSize()" (selectionChange)="onBackOrderPageSizeChange($event.value)">
                          <mat-option [value]="25">25</mat-option>
                          <mat-option [value]="50">50</mat-option>
                          <mat-option [value]="100">100</mat-option>
                          <mat-option [value]="250">250</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>
                  </div>
                }
              } @else {
                <div class="empty-state">
                  <mat-icon>inventory_2</mat-icon>
                  <h3>No Back Orders</h3>
                  <p>No back order data available for {{ activeBackOrderTab() | titlecase }} yet</p>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Reports Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>analytics</mat-icon>
              <span>Reports</span>
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h3>Sales Reports</h3>
                <div class="section-actions">
                  <mat-form-field appearance="outline" class="date-field">
                    <mat-label>From Date</mat-label>
                    <input matInput [matDatepicker]="fromPicker" [(ngModel)]="reportFromDate">
                    <mat-datepicker-toggle matSuffix [for]="fromPicker"></mat-datepicker-toggle>
                    <mat-datepicker #fromPicker></mat-datepicker>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="date-field">
                    <mat-label>To Date</mat-label>
                    <input matInput [matDatepicker]="toPicker" [(ngModel)]="reportToDate">
                    <mat-datepicker-toggle matSuffix [for]="toPicker"></mat-datepicker-toggle>
                    <mat-datepicker #toPicker></mat-datepicker>
                  </mat-form-field>
                  <button mat-raised-button color="primary" (click)="generateReport()">
                    <mat-icon>bar_chart</mat-icon> Generate Report
                  </button>
                </div>
              </div>

              <div class="reports-grid">
                <mat-card class="report-card" [class.active]="activeReportType === 'sales-summary'" (click)="runReport('sales-summary')">
                  <mat-card-content>
                    <mat-icon>summarize</mat-icon>
                    <h4>Sales Summary</h4>
                    <p>Overview of sales performance</p>
                  </mat-card-content>
                </mat-card>

                <mat-card class="report-card" [class.active]="activeReportType === 'customer-analysis'" (click)="runReport('customer-analysis')">
                  <mat-card-content>
                    <mat-icon>analytics</mat-icon>
                    <h4>Customer Analysis</h4>
                    <p>Top customers and trends</p>
                  </mat-card-content>
                </mat-card>

                <mat-card class="report-card" [class.active]="activeReportType === 'province-breakdown'" (click)="runReport('province-breakdown')">
                  <mat-card-content>
                    <mat-icon>map</mat-icon>
                    <h4>Province Breakdown</h4>
                    <p>Sales by geographic region</p>
                  </mat-card-content>
                </mat-card>

                <mat-card class="report-card" [class.active]="activeReportType === 'product-performance'" (click)="runReport('product-performance')">
                  <mat-card-content>
                    <mat-icon>inventory_2</mat-icon>
                    <h4>Product Performance</h4>
                    <p>Best and worst sellers</p>
                  </mat-card-content>
                </mat-card>
              </div>

              <!-- Welly Report Panel -->
              @if (showReportPanel) {
                <div class="welly-report-panel" id="welly-report-content">
                  <div class="welly-report-header">
                    <div class="welly-report-title">
                      <mat-icon class="welly-sparkle-gold">auto_awesome</mat-icon>
                      <h3>{{ reportPanelTitle }}</h3>
                    </div>
                    <div class="welly-report-header-actions">
                      @if (!reportLoading && reportResult) {
                        <button mat-raised-button color="primary" (click)="downloadReportPdf()">
                          <mat-icon>picture_as_pdf</mat-icon> Download PDF
                        </button>
                        <button mat-button (click)="copyReportResult()">
                          <mat-icon>content_copy</mat-icon> Copy
                        </button>
                      }
                      <button mat-icon-button (click)="closeReportPanel()">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  </div>

                  @if (reportLoading) {
                    <div class="welly-report-loading">
                      <mat-spinner diameter="40"></mat-spinner>
                      <p>Welly is generating your {{ reportPanelTitle }}...</p>
                      <span class="loading-sub">Analyzing invoices, customers & cancellations</span>
                    </div>
                  } @else if (reportResult) {
                    <!-- Summary Cards -->
                    @if (reportSummary) {
                      <div class="report-summary-grid">
                        <div class="report-summary-card">
                          <mat-icon>receipt_long</mat-icon>
                          <div class="rs-info">
                            <span class="rs-value">{{ reportSummary.totalInvoices | number }}</span>
                            <span class="rs-label">Invoices</span>
                          </div>
                        </div>
                        <div class="report-summary-card">
                          <mat-icon>payments</mat-icon>
                          <div class="rs-info">
                            <span class="rs-value">R{{ reportSummary.totalRevenue | number:'1.0-0' }}</span>
                            <span class="rs-label">Revenue</span>
                          </div>
                        </div>
                        <div class="report-summary-card">
                          <mat-icon>trending_up</mat-icon>
                          <div class="rs-info">
                            <span class="rs-value">R{{ reportSummary.grossProfit | number:'1.0-0' }}</span>
                            <span class="rs-label">Gross Profit</span>
                          </div>
                        </div>
                        <div class="report-summary-card">
                          <mat-icon>speed</mat-icon>
                          <div class="rs-info">
                            <span class="rs-value">{{ reportSummary.marginPercent }}%</span>
                            <span class="rs-label">Margin</span>
                          </div>
                        </div>
                        <div class="report-summary-card">
                          <mat-icon>people</mat-icon>
                          <div class="rs-info">
                            <span class="rs-value">{{ reportSummary.uniqueCustomers | number }}</span>
                            <span class="rs-label">Customers</span>
                          </div>
                        </div>
                        <div class="report-summary-card">
                          <mat-icon>cancel</mat-icon>
                          <div class="rs-info">
                            <span class="rs-value">{{ reportSummary.totalCancellations }}</span>
                            <span class="rs-label">Cancellations</span>
                          </div>
                        </div>
                      </div>
                    }

                    <!-- Charts -->
                    @if (reportCharts) {
                      <div class="report-charts-grid">
                        <div class="report-chart-card">
                          <h4>Sales by Division</h4>
                          <canvas id="report-chart-company"></canvas>
                        </div>
                        <div class="report-chart-card">
                          <h4>Daily Sales Trend</h4>
                          <canvas id="report-chart-daily"></canvas>
                        </div>
                        <div class="report-chart-card">
                          <h4>Top Customers</h4>
                          <canvas id="report-chart-customers"></canvas>
                        </div>
                        <div class="report-chart-card">
                          <h4>Sales by Province</h4>
                          <canvas id="report-chart-province"></canvas>
                        </div>
                        <div class="report-chart-card">
                          <h4>Top Products</h4>
                          <canvas id="report-chart-products"></canvas>
                        </div>
                        @if (reportCharts.cancellationsByReason.labels.length > 0) {
                          <div class="report-chart-card">
                            <h4>Cancellation Reasons</h4>
                            <canvas id="report-chart-cancellations"></canvas>
                          </div>
                        }
                      </div>
                    }

                    <!-- AI Analysis Text -->
                    <div class="report-analysis-section">
                      <h4 class="report-analysis-title"><mat-icon>psychology</mat-icon> Welly's Analysis</h4>
                      <div class="report-analysis-text">{{ reportResult }}</div>
                    </div>
                  }
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>

      <!-- Customer Detail Sidebar -->
      @if (selectedCustomer() && showCustomerSidebar) {
        <div class="customer-sidebar">
          <div class="sidebar-header">
            <h3>Customer Details</h3>
            <button mat-icon-button (click)="showCustomerSidebar = false">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="sidebar-content">
            <div class="customer-info-section">
              <h4>{{ selectedCustomer()!.name }}</h4>
              <p class="customer-code">{{ selectedCustomer()!.customerCode }}</p>
            </div>
            
            <mat-divider></mat-divider>
            
            <div class="info-group">
              <h5>Contact Information</h5>
              @if (selectedCustomer()!.contactPerson) {
                <div class="info-item">
                  <mat-icon>person</mat-icon>
                  <span>{{ selectedCustomer()!.contactPerson }}</span>
                </div>
              }
              @if (selectedCustomer()!.email) {
                <div class="info-item">
                  <mat-icon>email</mat-icon>
                  <a [href]="'mailto:' + selectedCustomer()!.email">{{ selectedCustomer()!.email }}</a>
                </div>
              }
              @if (selectedCustomer()!.phoneNumber) {
                <div class="info-item">
                  <mat-icon>phone</mat-icon>
                  <a [href]="'tel:' + selectedCustomer()!.phoneNumber">{{ selectedCustomer()!.phoneNumber }}</a>
                </div>
              }
            </div>
            
            <mat-divider></mat-divider>
            
            <div class="info-group">
              <h5>Delivery Address</h5>
              @if (selectedCustomer()!.deliveryAddress) {
                <div class="address-block">
                  <p>{{ selectedCustomer()!.deliveryAddress }}</p>
                  <p>{{ selectedCustomer()!.deliveryCity }}, {{ selectedCustomer()!.deliveryProvince }}</p>
                  <p>{{ selectedCustomer()!.deliveryPostalCode }}</p>
                </div>
              } @else {
                <p class="no-data">No delivery address set</p>
              }
              @if (selectedCustomer()!.latitude && selectedCustomer()!.longitude) {
                <button mat-stroked-button (click)="openInMaps(selectedCustomer()!)">
                  <mat-icon>map</mat-icon> View on Map
                </button>
              }
            </div>
            
            <mat-divider></mat-divider>
            
            <div class="sidebar-actions">
              <button mat-raised-button color="primary" (click)="editCustomer(selectedCustomer()!)">
                <mat-icon>edit</mat-icon> Edit Customer
              </button>
              <button mat-stroked-button (click)="viewCustomerInvoices(selectedCustomer()!)">
                <mat-icon>receipt</mat-icon> View Invoices
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Attention Dialog -->
      @if (showAttentionDialog) {
        <div class="attention-overlay" (click)="closeAttentionDialog()">
          <div class="attention-dialog" (click)="$event.stopPropagation()">
            <div class="attention-header">
              <h2><mat-icon>warning</mat-icon> Data Issues Requiring Attention</h2>
              <button mat-icon-button (click)="closeAttentionDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            
            <mat-tab-group [(selectedIndex)]="attentionTabIndex">
              <!-- Customers Without Locations -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <mat-icon>location_off</mat-icon>
                  Customers Without Locations
                  <span class="attention-badge">{{ customersWithoutLocation().length }}</span>
                </ng-template>
                
                <div class="attention-content">
                  @if (customersWithoutLocation().length === 0 && !showWellyCustomerReview) {
                    <div class="empty-state">
                      <mat-icon>check_circle</mat-icon>
                      <h3>All Good!</h3>
                      <p>All customers have location data set.</p>
                    </div>
                  } @else if (showWellyCustomerReview) {
                    <!-- Welly Review Panel -->
                    <div class="welly-review-panel">
                      <div class="welly-review-header">
                        <div class="welly-avatar">🤖</div>
                        <div>
                          <h3>Welly's Suggested Fixes</h3>
                          <p>Review each suggestion below. Toggle off any you don't want to apply.</p>
                        </div>
                        <div class="welly-review-actions-header">
                          <button mat-button (click)="toggleAllCustomerFixes(true)">
                            <mat-icon>check_box</mat-icon> Select All
                          </button>
                          <button mat-button (click)="toggleAllCustomerFixes(false)">
                            <mat-icon>check_box_outline_blank</mat-icon> Deselect All
                          </button>
                        </div>
                      </div>
                      <div class="welly-review-list">
                        @for (fix of wellyCustomerFixes; track fix.customerId) {
                          <div class="welly-review-item" [class.failed]="!fix.success" [class.rejected]="!fix.approved">
                            <div class="welly-review-toggle">
                              @if (fix.success) {
                                <mat-slide-toggle [(ngModel)]="fix.approved" color="primary"></mat-slide-toggle>
                              } @else {
                                <mat-icon class="fix-failed-icon">error_outline</mat-icon>
                              }
                            </div>
                            <div class="welly-review-info">
                              <div class="welly-review-name">
                                <strong>{{ fix.customerName }}</strong>
                                <span class="code">{{ fix.customerCode }}</span>
                              </div>
                              @if (fix.success) {
                                <div class="welly-review-suggestion">
                                  <mat-icon>arrow_forward</mat-icon>
                                  <span>{{ fix.suggestedFormattedAddress }}</span>
                                </div>
                                <div class="welly-review-details">
                                  <span class="welly-chip">{{ fix.suggestedProvince }}</span>
                                  @if (fix.suggestedCity) {
                                    <span class="welly-chip">{{ fix.suggestedCity }}</span>
                                  }
                                </div>
                              } @else {
                                <div class="welly-review-error">{{ fix.error }}</div>
                              }
                            </div>
                          </div>
                        }
                      </div>
                      <div class="welly-review-actions">
                        <button mat-stroked-button (click)="cancelWellyCustomerReview()">
                          <mat-icon>close</mat-icon> Cancel
                        </button>
                        <button mat-raised-button color="primary" (click)="applyWellyCustomerFixes()" 
                                [disabled]="wellyCustomerFixApplying || approvedCustomerFixCount === 0">
                          @if (wellyCustomerFixApplying) {
                            <mat-spinner diameter="18"></mat-spinner> Applying...
                          } @else {
                            <mat-icon>check_circle</mat-icon>
                            Apply {{ approvedCustomerFixCount }} Fixes
                          }
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div class="attention-desc-row">
                      <p class="attention-desc">These customers don't have GPS coordinates set. Click to edit and add location.</p>
                      <div class="attention-desc-buttons">
                        <button mat-raised-button class="welly-fix-btn" (click)="wellyFixCustomerLocations()" 
                                [disabled]="wellyCustomerFixLoading">
                          @if (wellyCustomerFixLoading) {
                            <mat-spinner diameter="18"></mat-spinner>
                            Welly is analyzing...
                          } @else {
                            <span class="welly-btn-icon">🤖</span> Ask Welly to Fix
                          }
                        </button>
                        <button mat-raised-button color="accent" (click)="geocodeAllCustomers()" [disabled]="isGeocoding">
                          @if (isGeocoding) {
                            <mat-spinner diameter="18"></mat-spinner>
                            Geocoding {{ geocodeProgress }}...
                          } @else {
                            <ng-container><mat-icon>my_location</mat-icon> Geocode All ({{ customersWithoutLocation().length }})</ng-container>
                          }
                        </button>
                      </div>
                    </div>
                    <div class="attention-list">
                      @for (customer of customersWithoutLocation(); track customer.id) {
                        <div class="attention-item">
                          <div class="attention-item-info">
                            <strong>{{ customer.name }}</strong>
                            <span class="code">{{ customer.customerCode }}</span>
                            <span class="address">{{ customer.deliveryAddress || customer.address || 'No address' }}</span>
                          </div>
                          <div class="attention-item-actions">
                            <button mat-stroked-button (click)="geocodeCustomerFromAttention(customer)">
                              <mat-icon>my_location</mat-icon> Auto-Geocode
                            </button>
                            <button mat-raised-button color="primary" (click)="editCustomerLocation(customer)">
                              <mat-icon>place</mat-icon> Enter Address
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </mat-tab>
              
              <!-- Invoices Without Provinces -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <mat-icon>map</mat-icon>
                  Invoices Without Province
                  <span class="attention-badge">{{ invoicesWithoutProvince().length }}</span>
                </ng-template>
                
                <div class="attention-content">
                  @if (invoicesWithoutProvince().length === 0 && !showWellyInvoiceReview) {
                    <div class="empty-state">
                      <mat-icon>check_circle</mat-icon>
                      <h3>All Good!</h3>
                      <p>All invoices have delivery province set.</p>
                    </div>
                  } @else if (showWellyInvoiceReview) {
                    <!-- Welly Invoice Review Panel -->
                    <div class="welly-review-panel">
                      <div class="welly-review-header">
                        <div class="welly-avatar">🤖</div>
                        <div>
                          <h3>Welly's Province Suggestions</h3>
                          <p>Review each suggestion. Toggle off any you don't want to apply.</p>
                        </div>
                        <div class="welly-review-actions-header">
                          <button mat-button (click)="toggleAllInvoiceFixes(true)">
                            <mat-icon>check_box</mat-icon> Select All
                          </button>
                          <button mat-button (click)="toggleAllInvoiceFixes(false)">
                            <mat-icon>check_box_outline_blank</mat-icon> Deselect All
                          </button>
                        </div>
                      </div>
                      <div class="welly-review-list">
                        @for (fix of wellyInvoiceFixes; track fix.invoiceId) {
                          <div class="welly-review-item" [class.failed]="!fix.success" [class.rejected]="!fix.approved">
                            <div class="welly-review-toggle">
                              @if (fix.success) {
                                <mat-slide-toggle [(ngModel)]="fix.approved" color="primary"></mat-slide-toggle>
                              } @else {
                                <mat-icon class="fix-failed-icon">error_outline</mat-icon>
                              }
                            </div>
                            <div class="welly-review-info">
                              <div class="welly-review-name">
                                <strong>{{ fix.transactionNumber }}</strong>
                                <span class="customer">{{ fix.customerName }}</span>
                                <span class="amount">R{{ fix.salesAmount * 1.15 | number:'1.2-2' }}</span>
                              </div>
                              @if (fix.success) {
                                <div class="welly-review-suggestion">
                                  <mat-icon>arrow_forward</mat-icon>
                                  <span class="welly-chip province">{{ fix.suggestedProvince }}</span>
                                  @if (fix.suggestedCity) {
                                    <span class="welly-chip">{{ fix.suggestedCity }}</span>
                                  }
                                </div>
                                <div class="welly-review-source">
                                  <mat-icon>info_outline</mat-icon> Source: {{ fix.source }}
                                </div>
                              } @else {
                                <div class="welly-review-error">{{ fix.error }}</div>
                              }
                            </div>
                          </div>
                        }
                      </div>
                      <div class="welly-review-actions">
                        <button mat-stroked-button (click)="cancelWellyInvoiceReview()">
                          <mat-icon>close</mat-icon> Cancel
                        </button>
                        <button mat-raised-button color="primary" (click)="applyWellyInvoiceFixes()"
                                [disabled]="wellyInvoiceFixApplying || approvedInvoiceFixCount === 0">
                          @if (wellyInvoiceFixApplying) {
                            <mat-spinner diameter="18"></mat-spinner> Applying...
                          } @else {
                            <mat-icon>check_circle</mat-icon>
                            Apply {{ approvedInvoiceFixCount }} Fixes
                          }
                        </button>
                      </div>
                    </div>
                  } @else {
                    <div class="attention-desc-row">
                      <p class="attention-desc">These invoices don't have a delivery province set. Select a province to assign.</p>
                      <button mat-raised-button class="welly-fix-btn" (click)="wellyFixInvoiceProvinces()"
                              [disabled]="wellyInvoiceFixLoading">
                        @if (wellyInvoiceFixLoading) {
                          <mat-spinner diameter="18"></mat-spinner>
                          Welly is analyzing...
                        } @else {
                          <span class="welly-btn-icon">🤖</span> Ask Welly to Fix
                        }
                      </button>
                    </div>
                    <div class="attention-list">
                      @for (invoice of invoicesWithoutProvince(); track invoice.id) {
                        <div class="attention-item">
                          <div class="attention-item-info">
                            <strong>{{ invoice.transactionNumber }}</strong>
                            <span class="customer">{{ invoice.customerName }}</span>
                            <span class="amount">R{{ invoice.salesAmount * 1.15 | number:'1.2-2' }}</span>
                          </div>
                          <div class="attention-item-actions">
                            <mat-form-field class="province-select">
                              <mat-label>Select Province</mat-label>
                              <mat-select (selectionChange)="setInvoiceProvince(invoice, $event.value)">
                                @for (prov of provinces; track prov) {
                                  <mat-option [value]="prov">{{ prov }}</mat-option>
                                }
                              </mat-select>
                            </mat-form-field>
                          </div>
                        </div>
                      }
                    </div>
                    <div class="bulk-actions">
                      <mat-form-field class="bulk-province">
                        <mat-label>Bulk Assign Province</mat-label>
                        <mat-select [(value)]="bulkProvince">
                          @for (prov of provinces; track prov) {
                            <mat-option [value]="prov">{{ prov }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                      <button mat-raised-button color="primary" (click)="bulkAssignProvince()" [disabled]="!bulkProvince">
                        <mat-icon>playlist_add_check</mat-icon> Assign to All ({{ invoicesWithoutProvince().length }})
                      </button>
                    </div>
                  }
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>
        </div>
      }

      <!-- Company Sales Details Dialog -->
      @if (showCompanySalesDialog && selectedCompanyForDialog) {
        <div class="company-sales-overlay" (click)="closeCompanySalesDialog()">
          <div class="company-sales-dialog" (click)="$event.stopPropagation()">
            <div class="dialog-header" [style.background]="selectedCompanyForDialog.color">
              <div class="header-content">
                <mat-icon>business</mat-icon>
                <div class="header-text">
                  <h2>{{ selectedCompanyForDialog.name }}</h2>
                  <span>Sales Analytics & History</span>
                </div>
              </div>
              <button mat-icon-button (click)="closeCompanySalesDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            
            <div class="dialog-body">
              <!-- Summary Cards -->
              <div class="summary-row">
                <div class="summary-card">
                  <div class="summary-icon today"><mat-icon>today</mat-icon></div>
                  <div class="summary-info">
                    <span class="summary-label">Today</span>
                    <span class="summary-value">R{{ formatCurrency(getCompanySalesForPeriod('today').total) }}</span>
                    <span class="summary-orders">{{ getCompanySalesForPeriod('today').count }} orders</span>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="summary-icon week"><mat-icon>date_range</mat-icon></div>
                  <div class="summary-info">
                    <span class="summary-label">Past 7 Days</span>
                    <span class="summary-value">R{{ formatCurrency(getCompanySalesForPeriod('week').total) }}</span>
                    <span class="summary-orders">{{ getCompanySalesForPeriod('week').count }} orders</span>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="summary-icon month"><mat-icon>calendar_month</mat-icon></div>
                  <div class="summary-info">
                    <span class="summary-label">This Month</span>
                    <span class="summary-value">R{{ formatCurrency(getCompanySalesForPeriod('month').total) }}</span>
                    <span class="summary-orders">{{ getCompanySalesForPeriod('month').count }} orders</span>
                  </div>
                </div>
                <div class="summary-card">
                  <div class="summary-icon quarter"><mat-icon>assessment</mat-icon></div>
                  <div class="summary-info">
                    <span class="summary-label">This Quarter</span>
                    <span class="summary-value">R{{ formatCurrency(getCompanySalesForPeriod('quarter').total) }}</span>
                    <span class="summary-orders">{{ getCompanySalesForPeriod('quarter').count }} orders</span>
                  </div>
                </div>
              </div>

              <!-- Chart Section -->
              <div class="chart-section">
                <div class="chart-header">
                  <h3><mat-icon>show_chart</mat-icon> Sales Trend</h3>
                  <div class="chart-controls">
                    <mat-button-toggle-group [(value)]="companySalesDateRange" (change)="updateCompanySalesChart()">
                      <mat-button-toggle value="week">7 Days</mat-button-toggle>
                      <mat-button-toggle value="month">30 Days</mat-button-toggle>
                      <mat-button-toggle value="quarter">90 Days</mat-button-toggle>
                    </mat-button-toggle-group>
                  </div>
                </div>
                <div class="chart-container">
                  <div class="chart-bars">
                    @for (day of companySalesHistoryData; track day.date) {
                      <div class="chart-bar-wrapper" [matTooltip]="day.date + ': R' + formatCurrencyFull(day.total) + ' (' + day.count + ' orders)'">
                        <div class="chart-bar" 
                             [style.height.%]="getBarHeight(day.total)"
                             [style.background]="selectedCompanyForDialog.color">
                        </div>
                        <span class="chart-label">{{ day.label }}</span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Sales Table -->
              <div class="sales-table-section">
                <div class="table-header">
                  <h3><mat-icon>receipt_long</mat-icon> Recent Sales</h3>
                  <div class="table-header-actions">
                    <button mat-stroked-button class="export-btn excel-btn" (click)="openExportDatePicker('excel')">
                      <mat-icon>table_chart</mat-icon> Export Excel
                    </button>
                    <button mat-stroked-button class="export-btn pdf-btn" (click)="openExportDatePicker('pdf')">
                      <mat-icon>picture_as_pdf</mat-icon> Generate PDF
                    </button>
                    <button mat-stroked-button class="export-btn compare-btn" (click)="openCompareDialog()">
                      <mat-icon>compare_arrows</mat-icon> Compare
                    </button>
                  </div>
                </div>

                <!-- Sales Data Table -->
                <div class="table-container">
                  <table mat-table [dataSource]="companySalesTableData" class="sales-table">
                    <ng-container matColumnDef="date">
                      <th mat-header-cell *matHeaderCellDef>Date</th>
                      <td mat-cell *matCellDef="let row">{{ row.transactionDate | date:'dd MMM yyyy' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="transaction">
                      <th mat-header-cell *matHeaderCellDef>Transaction #</th>
                      <td mat-cell *matCellDef="let row">{{ row.transactionNumber }}</td>
                    </ng-container>
                    <ng-container matColumnDef="customer">
                      <th mat-header-cell *matHeaderCellDef>Customer</th>
                      <td mat-cell *matCellDef="let row">{{ row.customerName }}</td>
                    </ng-container>
                    <ng-container matColumnDef="product">
                      <th mat-header-cell *matHeaderCellDef>Product</th>
                      <td mat-cell *matCellDef="let row">{{ row.productDescription }}</td>
                    </ng-container>
                    <ng-container matColumnDef="quantity">
                      <th mat-header-cell *matHeaderCellDef>Qty</th>
                      <td mat-cell *matCellDef="let row">{{ row.quantity }}</td>
                    </ng-container>
                    <ng-container matColumnDef="amount">
                      <th mat-header-cell *matHeaderCellDef>Amount (incl. VAT)</th>
                      <td mat-cell *matCellDef="let row" class="amount-cell">R{{ row.salesAmount * 1.15 | number:'1.2-2' }}</td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="['date', 'transaction', 'customer', 'product', 'quantity', 'amount']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['date', 'transaction', 'customer', 'product', 'quantity', 'amount'];"></tr>
                  </table>

                  @if (companySalesTableData.length === 0) {
                    <div class="no-data">
                      <mat-icon>inbox</mat-icon>
                      <p>No sales data found for {{ selectedCompanyForDialog.shortName }}</p>
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Company Comparison Dialog -->
        @if (showCompareDialog && selectedCompanyForDialog) {
          <div class="export-date-overlay" (click)="closeCompareDialog()">
            <div class="compare-dialog" (click)="$event.stopPropagation()">
              <div class="compare-dialog-header">
                <div class="compare-title">
                  <mat-icon>compare_arrows</mat-icon>
                  <h3>Company Comparison</h3>
                </div>
                <button mat-icon-button (click)="closeCompareDialog()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>

              <!-- Config Row -->
              <div class="compare-config">
                <div class="compare-companies">
                  <div class="compare-company-badge" [style.background]="selectedCompanyForDialog.color">
                    {{ selectedCompanyForDialog.shortName }}
                  </div>
                  <mat-icon>vs</mat-icon>
                  <mat-form-field appearance="outline" class="compare-select">
                    <mat-label>Compare with</mat-label>
                    <mat-select [(ngModel)]="compareCompanyCode" (ngModelChange)="loadComparisonData()">
                      @for (c of getCompareOptions(); track c.code) {
                        <mat-option [value]="c.code">{{ c.shortName }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <div class="compare-date-range">
                  <mat-form-field appearance="outline" class="compare-date-field">
                    <mat-label>From</mat-label>
                    <input matInput [matDatepicker]="cmpFrom" [(ngModel)]="compareFromDate" (dateChange)="loadComparisonData()">
                    <mat-datepicker-toggle matIconSuffix [for]="cmpFrom"></mat-datepicker-toggle>
                    <mat-datepicker #cmpFrom></mat-datepicker>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="compare-date-field">
                    <mat-label>To</mat-label>
                    <input matInput [matDatepicker]="cmpTo" [(ngModel)]="compareToDate" (dateChange)="loadComparisonData()">
                    <mat-datepicker-toggle matIconSuffix [for]="cmpTo"></mat-datepicker-toggle>
                    <mat-datepicker #cmpTo></mat-datepicker>
                  </mat-form-field>
                </div>
              </div>

              <!-- Quick Range Buttons -->
              <div class="compare-quick-ranges">
                <button mat-stroked-button (click)="setCompareRange('week')">Past 7 Days</button>
                <button mat-stroked-button (click)="setCompareRange('month')">This Month</button>
                <button mat-stroked-button (click)="setCompareRange('quarter')">This Quarter</button>
                <button mat-stroked-button (click)="setCompareRange('year')">This Year</button>
              </div>

              @if (compareCompanyCode) {
                <!-- Side-by-Side Summary -->
                <div class="compare-summary">
                  <div class="compare-col">
                    <div class="compare-col-header" [style.background]="selectedCompanyForDialog.color">
                      {{ selectedCompanyForDialog.shortName }}
                    </div>
                    <div class="compare-stat"><span class="label">Invoices</span><span class="val">{{ compareDataA.count }}</span></div>
                    <div class="compare-stat"><span class="label">Revenue</span><span class="val">R{{ formatCurrencyFull(compareDataA.revenue) }}</span></div>
                    <div class="compare-stat"><span class="label">Incl. VAT</span><span class="val">R{{ formatCurrencyFull(compareDataA.revenue * 1.15) }}</span></div>
                    <div class="compare-stat"><span class="label">Avg/Invoice</span><span class="val">R{{ formatCurrencyFull(compareDataA.count > 0 ? compareDataA.revenue / compareDataA.count : 0) }}</span></div>
                    <div class="compare-stat"><span class="label">Cost</span><span class="val">R{{ formatCurrencyFull(compareDataA.cost) }}</span></div>
                    <div class="compare-stat"><span class="label">Margin</span><span class="val">{{ compareDataA.revenue > 0 ? ((compareDataA.revenue - compareDataA.cost) / compareDataA.revenue * 100).toFixed(1) : '0.0' }}%</span></div>
                  </div>
                  <div class="compare-vs">VS</div>
                  <div class="compare-col">
                    <div class="compare-col-header" [style.background]="getCompareCompany()?.color">
                      {{ getCompareCompany()?.shortName }}
                    </div>
                    <div class="compare-stat"><span class="label">Invoices</span><span class="val">{{ compareDataB.count }}</span></div>
                    <div class="compare-stat"><span class="label">Revenue</span><span class="val">R{{ formatCurrencyFull(compareDataB.revenue) }}</span></div>
                    <div class="compare-stat"><span class="label">Incl. VAT</span><span class="val">R{{ formatCurrencyFull(compareDataB.revenue * 1.15) }}</span></div>
                    <div class="compare-stat"><span class="label">Avg/Invoice</span><span class="val">R{{ formatCurrencyFull(compareDataB.count > 0 ? compareDataB.revenue / compareDataB.count : 0) }}</span></div>
                    <div class="compare-stat"><span class="label">Cost</span><span class="val">R{{ formatCurrencyFull(compareDataB.cost) }}</span></div>
                    <div class="compare-stat"><span class="label">Margin</span><span class="val">{{ compareDataB.revenue > 0 ? ((compareDataB.revenue - compareDataB.cost) / compareDataB.revenue * 100).toFixed(1) : '0.0' }}%</span></div>
                  </div>
                </div>

                <!-- Comparison Bar Chart -->
                <div class="compare-chart-section">
                  <h4><mat-icon>bar_chart</mat-icon> Daily Revenue Comparison</h4>
                  <div class="compare-chart">
                    @for (day of compareDailyData; track day.date) {
                      <div class="compare-chart-day">
                        <div class="compare-bars">
                          <div class="compare-bar bar-a" [style.height.%]="getCompareBarHeight(day.totalA)" [style.background]="selectedCompanyForDialog.color"
                               [matTooltip]="selectedCompanyForDialog.shortName + ': R' + formatCurrencyFull(day.totalA)"></div>
                          <div class="compare-bar bar-b" [style.height.%]="getCompareBarHeight(day.totalB)" [style.background]="getCompareCompany()?.color"
                               [matTooltip]="getCompareCompany()?.shortName + ': R' + formatCurrencyFull(day.totalB)"></div>
                        </div>
                        <span class="compare-chart-label">{{ day.label }}</span>
                      </div>
                    }
                  </div>
                  <div class="compare-legend">
                    <span class="legend-item"><span class="legend-dot" [style.background]="selectedCompanyForDialog.color"></span> {{ selectedCompanyForDialog.shortName }}</span>
                    <span class="legend-item"><span class="legend-dot" [style.background]="getCompareCompany()?.color"></span> {{ getCompareCompany()?.shortName }}</span>
                  </div>
                </div>

                <!-- Difference Highlights -->
                <div class="compare-highlights">
                  <div class="highlight-card" [class.positive]="compareDataA.revenue >= compareDataB.revenue" [class.negative]="compareDataA.revenue < compareDataB.revenue">
                    <mat-icon>{{ compareDataA.revenue >= compareDataB.revenue ? 'trending_up' : 'trending_down' }}</mat-icon>
                    <div class="highlight-text">
                      <span class="highlight-label">Revenue Difference</span>
                      <span class="highlight-value">R{{ formatCurrencyFull(Math.abs(compareDataA.revenue - compareDataB.revenue)) }}</span>
                      <span class="highlight-sub">{{ selectedCompanyForDialog.shortName }} is {{ compareDataA.revenue >= compareDataB.revenue ? 'ahead' : 'behind' }}</span>
                    </div>
                  </div>
                  <div class="highlight-card" [class.positive]="compareDataA.count >= compareDataB.count" [class.negative]="compareDataA.count < compareDataB.count">
                    <mat-icon>{{ compareDataA.count >= compareDataB.count ? 'trending_up' : 'trending_down' }}</mat-icon>
                    <div class="highlight-text">
                      <span class="highlight-label">Invoice Volume</span>
                      <span class="highlight-value">{{ Math.abs(compareDataA.count - compareDataB.count) }} invoices</span>
                      <span class="highlight-sub">{{ selectedCompanyForDialog.shortName }} has {{ compareDataA.count >= compareDataB.count ? 'more' : 'fewer' }}</span>
                    </div>
                  </div>
                </div>

                <!-- Export Button -->
                <div class="compare-actions">
                  <button mat-raised-button color="primary" (click)="exportComparisonExcel()" [disabled]="compareExporting">
                    @if (compareExporting) {
                      <mat-icon class="spin-icon">hourglass_empty</mat-icon> Exporting...
                    } @else {
                      <mat-icon>table_chart</mat-icon> Export Comparison to Excel
                    }
                  </button>
                </div>
              } @else {
                <div class="compare-placeholder">
                  <mat-icon>compare_arrows</mat-icon>
                  <p>Select a company above to start comparing</p>
                </div>
              }
            </div>
          </div>
        }

        <!-- Export Date Range Picker Popup -->
        @if (showExportDatePicker) {
          <div class="export-date-overlay" (click)="closeExportDatePicker()">
            <div class="export-date-popup" (click)="$event.stopPropagation()">
              <div class="export-popup-header">
                <mat-icon>{{ exportType === 'excel' ? 'table_chart' : 'picture_as_pdf' }}</mat-icon>
                <h3>{{ exportType === 'excel' ? 'Export to Excel' : 'Generate PDF Report' }}</h3>
                <button mat-icon-button (click)="closeExportDatePicker()">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <p class="export-popup-desc">
                {{ exportType === 'excel' ? 'Select a date range to export all invoices to an Excel spreadsheet.' : 'Select a date range to generate a PDF report with charts and invoice details.' }}
              </p>
              <div class="export-date-fields">
                <mat-form-field appearance="outline">
                  <mat-label>From Date</mat-label>
                  <input matInput [matDatepicker]="exportFromPicker" [(ngModel)]="exportFromDate">
                  <mat-datepicker-toggle matIconSuffix [for]="exportFromPicker"></mat-datepicker-toggle>
                  <mat-datepicker #exportFromPicker></mat-datepicker>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>To Date</mat-label>
                  <input matInput [matDatepicker]="exportToPicker" [(ngModel)]="exportToDate">
                  <mat-datepicker-toggle matIconSuffix [for]="exportToPicker"></mat-datepicker-toggle>
                  <mat-datepicker #exportToPicker></mat-datepicker>
                </mat-form-field>
              </div>
              <div class="export-quick-ranges">
                <button mat-stroked-button (click)="setExportRange('week')">Past 7 Days</button>
                <button mat-stroked-button (click)="setExportRange('month')">This Month</button>
                <button mat-stroked-button (click)="setExportRange('quarter')">This Quarter</button>
                <button mat-stroked-button (click)="setExportRange('year')">This Year</button>
              </div>
              <div class="export-popup-actions">
                <button mat-button (click)="closeExportDatePicker()">Cancel</button>
                <button mat-raised-button [color]="exportType === 'excel' ? 'primary' : 'warn'"
                        (click)="executeExport()" [disabled]="exportGenerating">
                  @if (exportGenerating) {
                    <mat-icon class="spin-icon">hourglass_empty</mat-icon> Generating...
                  } @else {
                    <mat-icon>{{ exportType === 'excel' ? 'download' : 'picture_as_pdf' }}</mat-icon>
                    {{ exportType === 'excel' ? 'Export Excel' : 'Generate PDF' }}
                  }
                </button>
              </div>
            </div>
          </div>
        }
      }
      }

      <!-- POD Upload Password Dialog -->
      @if (showPodPasswordDialog) {
        <div class="pod-password-overlay" (click)="cancelPodPasswordDialog()">
          <div class="pod-password-card" (click)="$event.stopPropagation()">
            <mat-icon class="lock-icon">lock</mat-icon>
            <h3>Upload Password Required</h3>
            <p>Enter the password to upload POD documents</p>
            @if (podPasswordError) {
              <div class="pod-password-error">{{ podPasswordError }}</div>
            }
            <mat-form-field appearance="outline" class="password-input">
              <mat-label>Password</mat-label>
              <input matInput type="password" [(ngModel)]="podPasswordInput"
                     (keydown.enter)="verifyPodUploadPassword()"
                     placeholder="Enter password" autofocus>
            </mat-form-field>
            <div class="password-actions">
              <button mat-stroked-button (click)="cancelPodPasswordDialog()">Cancel</button>
              <button mat-raised-button color="primary" (click)="verifyPodUploadPassword()">
                <mat-icon>lock_open</mat-icon> Verify
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: linear-gradient(160deg, #1976d2 0%, #1565c0 40%, #0d47a1 100%);
      min-height: 100vh;
    }

    .sales-dashboard {
      padding: 28px;
      padding-top: 90px;
      min-height: calc(100vh - 64px);
      max-width: 1600px;
      margin: 0 auto;
    }

    /* Modern Header Styles */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 20px;
    }

    .header-content-wrapper {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .header-icon-wrapper {
      width: 68px;
      height: 68px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      transition: transform 0.3s cubic-bezier(.4,0,.2,1);
    }

    .header-icon-wrapper:hover {
      transform: scale(1.04);
    }

    .header-icon-wrapper mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }

    .header-text-area h1 {
      margin: 0;
      color: white;
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.3px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    .header-text-area .subtitle {
      margin: 6px 0 0 0;
      color: rgba(255, 255, 255, 0.85);
      font-size: 14px;
      letter-spacing: 0.1px;
    }

    .header-stats-row {
      display: flex;
      gap: 16px;
    }

    .mini-stat {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      padding: 12px 18px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      transition: background 0.25s ease;
    }

    .mini-stat:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .mini-stat mat-icon {
      color: rgba(255, 255, 255, 0.9);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .mini-stat-info {
      display: flex;
      flex-direction: column;
    }

    .mini-value {
      color: white;
      font-size: 18px;
      font-weight: 700;
    }

    .mini-label {
      color: rgba(255, 255, 255, 0.8);
      font-size: 11px;
      text-transform: uppercase;
    }

    .header-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 11px 20px;
      border: none;
      border-radius: 12px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
      letter-spacing: 0.1px;
    }

    .action-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .action-btn.primary {
      background: white;
      color: #1e90ff;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }

    .action-btn.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    .action-btn.accent {
      background: linear-gradient(135deg, #ff6b9d 0%, #c44569 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(196, 69, 105, 0.3);
    }

    .action-btn.accent:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(196, 69, 105, 0.4);
    }

    .action-btn.attention {
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
      animation: pulse-warning 2s infinite;
    }

    .action-btn.attention:hover {
      transform: translateY(-2px);
    }

    .action-btn.import {
      background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(46, 125, 50, 0.3);
    }

    .action-btn.import:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(46, 125, 50, 0.4);
    }

    .action-btn.outline {
      background: transparent;
      color: white;
      border: 2px solid rgba(255, 255, 255, 0.5);
    }

    .action-btn.outline:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    /* Import Password Dialog */
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
    }

    .import-password-dialog {
      background: white;
      border-radius: 24px;
      padding: 40px;
      width: 400px;
      max-width: 90vw;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
      animation: dialogSlideIn 0.3s ease;
    }

    @keyframes dialogSlideIn {
      from { transform: scale(0.9) translateY(20px); opacity: 0; }
      to { transform: scale(1) translateY(0); opacity: 1; }
    }

    .password-dialog-header {
      text-align: center;
      margin-bottom: 32px;
    }

    .password-icon-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      box-shadow: 0 8px 24px rgba(46, 125, 50, 0.3);
    }

    .password-icon-circle mat-icon {
      color: white;
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .password-dialog-header h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .password-dialog-header p {
      margin: 8px 0 0;
      color: #666;
      font-size: 14px;
    }

    .password-dialog-body {
      margin-bottom: 32px;
    }

    .pin-input-group {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .pin-digit {
      width: 56px;
      height: 64px;
      border: 2px solid #e0e0e0;
      border-radius: 14px;
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      color: #1a1a2e;
      background: #fafafa;
      outline: none;
      transition: all 0.2s ease;
      -webkit-text-security: disc;
    }

    .pin-digit:focus {
      border-color: #43a047;
      background: white;
      box-shadow: 0 0 0 3px rgba(67, 160, 71, 0.15);
    }

    .pin-digit.filled {
      border-color: #43a047;
      background: #f1f8e9;
    }

    .pin-digit.error {
      border-color: #e53935;
      background: #ffebee;
      animation: shake 0.4s ease;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-6px); }
      50% { transform: translateX(6px); }
      75% { transform: translateX(-6px); }
    }

    .password-error {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 16px;
      color: #e53935;
      font-size: 13px;
      font-weight: 500;
    }

    .password-error mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .password-dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .dialog-btn {
      padding: 12px 32px;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .dialog-btn.cancel {
      background: #f5f5f5;
      color: #666;
    }

    .dialog-btn.cancel:hover {
      background: #e0e0e0;
    }

    .dialog-btn.submit {
      background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
      color: white;
      box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3);
    }

    .dialog-btn.submit:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(46, 125, 50, 0.4);
    }

    .dialog-btn.submit:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Edit Invoice Dialog */
    .edit-invoice-dialog {
      background: white;
      border-radius: 20px;
      padding: 0;
      width: 640px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
      animation: dialogSlideIn 0.3s ease;
    }

    .edit-invoice-header {
      text-align: center;
      padding: 32px 32px 16px;
      position: relative;
    }

    .edit-invoice-header h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .edit-invoice-header p {
      margin: 6px 0 0;
      color: #666;
      font-size: 14px;
    }

    .edit-invoice-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
      box-shadow: 0 8px 24px rgba(21, 101, 192, 0.3);
    }

    .edit-invoice-icon mat-icon {
      color: white;
      font-size: 30px;
      width: 30px;
      height: 30px;
    }

    .edit-invoice-close {
      position: absolute;
      top: 16px;
      right: 16px;
    }

    .edit-invoice-body {
      padding: 0 32px;
    }

    .edit-invoice-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .edit-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .edit-field.full-width {
      grid-column: 1 / -1;
    }

    .edit-field label {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .edit-field input,
    .edit-field select {
      padding: 10px 14px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 14px;
      color: #1a1a2e;
      background: #fafafa;
      outline: none;
      transition: all 0.2s ease;
      width: 100%;
      box-sizing: border-box;
    }

    .edit-field input:focus,
    .edit-field select:focus {
      border-color: #1e88e5;
      background: white;
      box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.12);
    }

    .edit-invoice-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 24px 32px 28px;
    }

    .edit-invoice-actions .dialog-btn.submit {
      background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
      box-shadow: 0 4px 12px rgba(21, 101, 192, 0.3);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .edit-invoice-actions .dialog-btn.submit mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Request Delivery Button & Dialog */
    .action-btn.delivery {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%) !important;
      color: white !important;
      border: none !important;
    }
    .action-btn.delivery:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(238, 90, 36, 0.4);
    }

    .request-delivery-tab-btn {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%) !important;
      color: white !important;
      border: none !important;
      border-radius: 10px !important;
      font-weight: 600 !important;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px !important;
      height: 40px;
    }
    .request-delivery-tab-btn:hover {
      box-shadow: 0 4px 16px rgba(238, 90, 36, 0.4);
    }

    .req-delivery-icon {
      color: #ee5a24 !important;
    }

    .delivery-request-dialog {
      background: white;
      border-radius: 20px;
      padding: 0;
      width: 720px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
      animation: dialogSlideIn 0.3s ease;
    }

    .delivery-header {
      text-align: center;
      padding: 32px 32px 16px;
      position: relative;
    }

    .delivery-header h2 {
      margin: 0;
      font-size: 22px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .delivery-header p {
      margin: 6px 0 0;
      color: #666;
      font-size: 14px;
    }

    .delivery-icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 14px;
      box-shadow: 0 8px 24px rgba(238, 90, 36, 0.3);
    }

    .delivery-icon-circle mat-icon {
      color: white;
      font-size: 30px;
      width: 30px;
      height: 30px;
    }

    .delivery-close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
    }

    .delivery-body {
      padding: 0 32px;
    }

    .delivery-error-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 10px;
      background: #fff5f5;
      border: 1px solid #fed7d7;
      color: #c53030;
      font-size: 13px;
      margin-bottom: 16px;
    }

    .delivery-section-label {
      font-size: 13px;
      font-weight: 700;
      color: #444;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: block;
    }

    .req-star { color: #e53e3e; }

    .delivery-invoice-search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      background: #fafafa;
      margin-bottom: 10px;
      transition: all 0.2s ease;
    }

    .delivery-invoice-search:focus-within {
      border-color: #ee5a24;
      background: white;
      box-shadow: 0 0 0 3px rgba(238, 90, 36, 0.12);
    }

    .delivery-invoice-search mat-icon {
      color: #aaa;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .delivery-invoice-search input {
      border: none;
      outline: none;
      background: transparent;
      flex: 1;
      font-size: 14px;
      color: #1a1a2e;
    }

    .clear-search { width: 28px !important; height: 28px !important; }
    .clear-search mat-icon { font-size: 16px !important; width: 16px !important; height: 16px !important; }

    .delivery-selected-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      margin-bottom: 8px;
    }

    .selected-label {
      font-size: 12px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
    }

    .delivery-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px 4px 12px;
      border-radius: 20px;
      background: linear-gradient(135deg, #fff5f0, #ffe8e0);
      border: 1px solid #fed7c7;
      font-size: 12px;
      font-weight: 600;
      color: #c05621;
    }

    .chip-customer {
      font-weight: 400;
      color: #888;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-remove { width: 20px !important; height: 20px !important; }
    .chip-remove mat-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; color: #e53e3e; }

    .delivery-invoice-list {
      max-height: 220px;
      overflow-y: auto;
      border: 2px solid #eee;
      border-radius: 12px;
      margin-bottom: 16px;
    }

    .delivery-invoice-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      transition: all 0.15s ease;
    }

    .delivery-invoice-row:last-child { border-bottom: none; }

    .delivery-invoice-row:hover {
      background: #fff9f5;
    }

    .delivery-invoice-row.selected {
      background: linear-gradient(135deg, #fff5f0, #ffe8e0);
      border-left: 3px solid #ee5a24;
    }

    .inv-checkbox mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #ccc;
    }

    .delivery-invoice-row.selected .inv-checkbox mat-icon {
      color: #ee5a24;
    }

    .inv-details {
      flex: 1;
      min-width: 0;
    }

    .inv-top-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .inv-top-row strong {
      font-size: 13px;
      color: #1a1a2e;
    }

    .inv-amount {
      font-size: 12px;
      font-weight: 700;
      color: #2e7d32;
    }

    .inv-bottom-row {
      display: flex;
      gap: 8px;
      margin-top: 2px;
      font-size: 11px;
      color: #888;
      flex-wrap: wrap;
    }

    .inv-customer {
      font-weight: 600;
      color: #666;
    }

    .inv-province {
      padding: 1px 6px;
      background: #e3f2fd;
      border-radius: 4px;
      color: #1565c0;
      font-size: 10px;
      font-weight: 600;
    }

    .delivery-no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px;
      color: #aaa;
    }

    .delivery-no-results mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .delivery-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 16px;
    }

    .delivery-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .delivery-field.full-w {
      grid-column: 1 / -1;
    }

    .delivery-field label {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .delivery-field input,
    .delivery-field select {
      padding: 10px 14px;
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      font-size: 14px;
      color: #1a1a2e;
      background: #fafafa;
      outline: none;
      transition: all 0.2s ease;
      width: 100%;
      box-sizing: border-box;
    }

    .delivery-field input:focus,
    .delivery-field select:focus {
      border-color: #ee5a24;
      background: white;
      box-shadow: 0 0 0 3px rgba(238, 90, 36, 0.12);
    }

    .delivery-preview {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      background: #fffbeb;
      border: 1px solid #fef3c7;
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
    }

    .delivery-preview mat-icon {
      color: #f59e0b;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .urgent-tag {
      font-weight: 700;
      color: #e53e3e;
      font-size: 12px;
    }

    .delivery-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 20px 32px 28px;
    }

    .delivery-submit {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%) !important;
      box-shadow: 0 4px 12px rgba(238, 90, 36, 0.3) !important;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .delivery-submit:disabled {
      opacity: 0.5;
    }

    .delivery-success-state {
      text-align: center;
      padding: 40px 32px;
    }

    .delivery-success-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #43a047, #2e7d32);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .delivery-success-icon mat-icon {
      color: white;
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .delivery-success-state h3 {
      font-size: 20px;
      color: #1a1a2e;
      margin: 0 0 8px;
    }

    .delivery-success-state p {
      color: #666;
      font-size: 14px;
      margin: 0 0 12px;
    }

    .delivery-success-ref {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 8px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 20px;
    }

    .delivery-success-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    /* Customer Import Result Dialog */
    .import-result-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1200;
    }

    .import-result-dialog {
      background: white;
      border-radius: 20px;
      width: 480px;
      max-width: 90vw;
      max-height: 80vh;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.3);
      animation: dialogSlideIn 0.3s ease;
      display: flex;
      flex-direction: column;
    }

    .import-result-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      color: white;
    }

    .import-result-header.success {
      background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
    }

    .import-result-header.error {
      background: linear-gradient(135deg, #e53935 0%, #c62828 100%);
    }

    .import-result-header mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .import-result-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      flex: 1;
    }

    .import-result-header button {
      color: white;
    }

    .import-result-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .import-stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .import-stat {
      text-align: center;
      padding: 16px 8px;
      border-radius: 12px;
      background: #f5f5f5;
    }

    .import-stat .stat-number {
      display: block;
      font-size: 28px;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1.2;
    }

    .import-stat .stat-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    .import-stat.created {
      background: #e8f5e9;
    }

    .import-stat.created .stat-number {
      color: #2e7d32;
    }

    .import-stat.updated {
      background: #e3f2fd;
    }

    .import-stat.updated .stat-number {
      color: #1565c0;
    }

    .import-stat.failed {
      background: #ffebee;
    }

    .import-stat.failed .stat-number {
      color: #c62828;
    }

    .import-errors-section {
      border-top: 1px solid #eee;
      padding-top: 16px;
    }

    .import-errors-section h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: #e53935;
    }

    .import-errors-section h4 mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .import-errors-list {
      max-height: 160px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .import-error-item {
      padding: 8px 12px;
      background: #fff3f3;
      border-left: 3px solid #e53935;
      border-radius: 4px;
      font-size: 13px;
      color: #555;
    }

    .import-result-footer {
      padding: 16px 24px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
    }

    /* Company Sales Section */
    .company-sales-section {
      margin-bottom: 28px;
    }

    .section-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .section-title-area {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .section-title-area mat-icon {
      color: rgba(255, 255, 255, 0.9);
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .section-title-area h3 {
      margin: 0;
      color: white;
      font-size: 18px;
      font-weight: 600;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }

    .comparison-label {
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 6px 16px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      letter-spacing: 0.2px;
    }

    .company-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .modern-company-card {
      background: white;
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(.4,0,.2,1);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.04);
      position: relative;
      overflow: hidden;
    }

    .modern-company-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--company-color);
      transition: height 0.25s cubic-bezier(.4,0,.2,1);
    }

    .modern-company-card:hover::before {
      height: 4px;
    }

    .modern-company-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.06);
      border-color: rgba(0, 0, 0, 0.06);
    }

    .company-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .company-badge {
      width: 42px;
      height: 42px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      transition: transform 0.2s ease;
    }

    .modern-company-card:hover .company-badge {
      transform: scale(1.06);
    }

    .company-title {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .company-title .company-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .company-title .company-full {
      font-size: 11px;
      color: #888;
    }

    .trend-indicator {
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .trend-indicator.up {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .trend-indicator.down {
      background: #ffebee;
      color: #c62828;
    }

    .trend-indicator mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .company-sales-comparison {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
    }

    .sales-period {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      padding: 12px;
      border-radius: 10px;
    }

    .sales-period.yesterday {
      background: #f5f5f5;
    }

    .sales-period.today {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    }

    .period-label {
      font-size: 10px;
      color: #888;
      text-transform: uppercase;
      font-weight: 600;
    }

    .period-value {
      font-size: 18px;
      font-weight: 700;
      color: #1a237e;
      margin: 4px 0;
    }

    .sales-period.yesterday .period-value {
      color: #666;
    }

    .period-orders {
      font-size: 11px;
      color: #888;
    }

    .comparison-arrow {
      color: #ccc;
    }

    .comparison-arrow mat-icon {
      font-size: 20px;
    }

    .card-footer {
      text-align: center;
      padding-top: 8px;
      border-top: 1px solid #eee;
    }

    .click-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #999;
      font-size: 12px;
    }

    .click-hint mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Modern Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }

    .modern-stat-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.04);
      transition: all 0.3s cubic-bezier(.4,0,.2,1);
    }

    .modern-stat-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.04);
      border-color: rgba(0, 0, 0, 0.06);
    }

    .stat-icon-wrapper {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .stat-icon-wrapper mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .modern-stat-card.customers .stat-icon-wrapper { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .modern-stat-card.invoices .stat-icon-wrapper { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .modern-stat-card.revenue .stat-icon-wrapper { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .modern-stat-card.orders .stat-icon-wrapper { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }

    .stat-content {
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .stat-value {
      font-size: 26px;
      font-weight: 700;
      color: #1a237e;
      line-height: 1.2;
      letter-spacing: -0.5px;
    }

    .stat-label {
      font-size: 13px;
      color: #78909c;
      margin-top: 4px;
      letter-spacing: 0.1px;
    }

    .stat-progress {
      height: 4px;
      background: #e8eaf6;
      border-radius: 4px;
      margin-top: 12px;
      overflow: hidden;
    }

    .stat-progress .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      border-radius: 4px;
      transition: width 0.8s cubic-bezier(.4,0,.2,1);
    }

    .stat-progress .progress-bar.pending {
      background: linear-gradient(90deg, #ff9800 0%, #f57c00 100%);
    }

    .stat-sub {
      font-size: 12px;
      color: #888;
      margin-top: 6px;
    }

    .revenue-breakdown .total-label {
      font-size: 12px;
      color: #888;
      margin-top: 8px;
    }

    .order-breakdown {
      margin-top: 8px;
    }

    .processing-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #fff3e0;
      color: #ef6c00;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .processing-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Main Content Card */
    .main-content {
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07), 0 1px 4px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .tab-content {
      padding: 24px 28px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .section-header h3 {
      margin: 0;
      color: #1a237e;
      font-size: 19px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .section-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .search-field {
      width: 250px;
    }

    .filter-field {
      width: 150px;
    }

    .date-field {
      width: 150px;
    }

    ::ng-deep .section-actions .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .tab-badge {
      background: #f44336;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 12px;
      margin-left: 8px;
    }

    /* Orders Grid */
    .orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .order-card {
      border-radius: 14px;
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
      border-left: 4px solid #ccc;
    }

    .order-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
    }

    .order-card.priority-high { border-left-color: #f44336; }
    .order-card.priority-medium { border-left-color: #ff9800; }
    .order-card.priority-low { border-left-color: #4caf50; }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      width: 100%;
    }

    .order-number {
      display: flex;
      flex-direction: column;
    }

    .order-number strong {
      font-size: 16px;
      color: #1a237e;
    }

    .order-date {
      font-size: 12px;
      color: #999;
    }

    .order-customer {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      color: #333;
    }

    .order-customer mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
    }

    .order-details {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
    }

    .detail-item .label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
    }

    .detail-item .value {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }

    .detail-item .value.amount {
      color: #1a237e;
      font-weight: 600;
    }

    .order-notes {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #f5f5f5;
      padding: 8px;
      border-radius: 8px;
      font-size: 12px;
      color: #666;
    }

    .order-notes mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Email List Styles */
    .email-summary-bar {
      display: flex;
      gap: 24px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #f8f9ff, #e8eaf6);
      border-radius: 12px;
      margin-bottom: 16px;
      align-items: center;
    }

    .email-summary-bar span {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #555;
      font-weight: 500;
    }

    .email-summary-bar .email-count mat-icon { color: #1a237e; }
    .email-summary-bar .unread-count mat-icon { color: #f44336; }
    .email-summary-bar .attachment-count mat-icon { color: #ff9800; }

    .email-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .email-card {
      border-radius: 10px;
      padding: 12px 16px;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
      cursor: pointer;
    }

    .email-card:hover {
      background: #f5f7ff;
      transform: translateX(2px);
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    }

    .email-card.email-unread {
      background: #f8f9ff;
      border-left-color: #1a237e;
      font-weight: 500;
    }

    .email-card.email-high-priority {
      border-left-color: #f44336;
    }

    .email-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .email-status-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      min-width: 20px;
    }

    .unread-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #1a237e;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.85); }
    }

    .priority-flag {
      color: #f44336 !important;
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
    }

    .email-sender {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 220px;
      max-width: 220px;
    }

    .sender-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1a237e, #3f51b5);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .sender-details {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .sender-name {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sender-email {
      font-size: 11px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .email-content {
      flex: 1;
      min-width: 0;
      overflow: hidden;
    }

    .email-subject {
      font-size: 14px;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .email-unread .email-subject {
      font-weight: 600;
      color: #1a237e;
    }

    .attachment-icon {
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      color: #999;
    }

    .email-preview {
      font-size: 12px;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }

    .email-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      min-width: 100px;
    }

    .email-time {
      font-size: 13px;
      font-weight: 600;
      color: #333;
    }

    .email-date {
      font-size: 11px;
      color: #999;
    }

    .mailbox-chip {
      font-size: 10px !important;
      min-height: 22px !important;
      padding: 0 8px !important;
      background: #e8eaf6 !important;
      color: #1a237e !important;
    }

    .email-actions {
      display: flex;
      align-items: center;
      gap: 0;
    }

    .email-actions button {
      opacity: 0;
      transition: opacity 0.2s;
    }

    .email-card:hover .email-actions button {
      opacity: 1;
    }

    .email-recipients {
      display: flex;
      gap: 16px;
      padding: 6px 0 0 42px;
      font-size: 11px;
      color: #999;
    }

    .recipient-label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 400px;
    }

    .unread-chip {
      background: #1a237e !important;
      color: white !important;
      font-size: 11px !important;
    }

    .priority-chip {
      background: #f44336 !important;
      color: white !important;
      font-size: 11px !important;
    }

    /* Back Order Stats */
    .back-order-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .bo-stat {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 12px;
      background: white;
      border: 1px solid #e8e8e8;
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
    }

    .bo-stat:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
      border-color: #d0d0d0;
    }

    .bo-stat mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .bo-stat.total mat-icon { color: #1a237e; }
    .bo-stat.qty mat-icon { color: #ff9800; }
    .bo-stat.value mat-icon { color: #4caf50; }
    .bo-stat.orders mat-icon { color: #2196f3; }

    .bo-stat .stat-info {
      display: flex;
      flex-direction: column;
    }

    .bo-stat .value {
      font-size: 20px;
      font-weight: 600;
      color: #1a237e;
    }

    .bo-stat .label {
      font-size: 12px;
      color: #666;
    }

    /* Back Order Company Tabs */
    .back-order-company-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .bo-company-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border: 2px solid #e0e0e0;
      border-radius: 25px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #555;
      transition: all 0.25s cubic-bezier(.4,0,.2,1);
    }

    .bo-company-tab:hover {
      border-color: #90a4ae;
      background: #fafafa;
    }

    .bo-company-tab.active {
      border-color: #1a237e;
      background: #e8eaf6;
      color: #1a237e;
      font-weight: 600;
    }

    .bo-tab-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .bo-tab-count {
      background: #e0e0e0;
      color: #555;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
    }

    .bo-company-tab.active .bo-tab-count {
      background: #1a237e;
      color: white;
    }

    /* Back Order Table */
    .back-order-table-wrapper {
      overflow-x: auto;
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      background: white;
      max-height: 600px;
      overflow-y: auto;
    }

    .back-order-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .back-order-table thead {
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .back-order-table thead tr {
      background: linear-gradient(135deg, #1a237e, #283593);
    }

    .back-order-table th {
      padding: 12px 10px;
      text-align: left;
      color: white;
      font-weight: 600;
      font-size: 12px;
      white-space: nowrap;
      border-bottom: 2px solid #0d1642;
    }

    .back-order-table tbody tr {
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.15s ease;
    }

    .back-order-table tbody tr:hover {
      background: #e8eaf6;
    }

    .back-order-table tbody tr:nth-child(even) {
      background: #fafafa;
    }

    .back-order-table tbody tr:nth-child(even):hover {
      background: #e8eaf6;
    }

    .back-order-table td {
      padding: 10px 10px;
      color: #333;
      white-space: nowrap;
    }

    .back-order-table td strong {
      color: #1a237e;
    }

    .bo-col-order { min-width: 100px; }
    .bo-col-date { min-width: 90px; }
    .bo-col-custno { min-width: 80px; }
    .bo-col-custname { min-width: 200px; white-space: normal !important; }
    .bo-col-po { min-width: 120px; }
    .bo-col-item { min-width: 250px; white-space: normal !important; }
    .bo-col-loc { min-width: 80px; }
    .bo-col-uom { min-width: 60px; }
    .bo-col-qty { min-width: 70px; text-align: right; }
    .bo-col-price { min-width: 90px; text-align: right; }
    .bo-col-ext { min-width: 100px; text-align: right; font-weight: 600; }
    .bo-col-contract { min-width: 100px; }
    .bo-col-acct { min-width: 100px; }

    /* Back Order Pagination */
    .back-order-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: white;
      border: 1px solid #e8eaf6;
      border-top: none;
      border-radius: 0 0 14px 14px;
    }

    .bo-page-info {
      font-size: 13px;
      color: #666;
    }

    .bo-page-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bo-page-number {
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }

    .bo-page-size-field {
      width: 80px;
    }

    .bo-page-size-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .tab-badge.warning {
      background: #ff9800;
    }

    /* Tables */
    .table-container {
      overflow-x: auto;
      border-radius: 14px;
      border: 1px solid #e8eaf6;
      background: white;
    }

    .customers-table,
    .invoices-table {
      width: 100%;
    }

    .company-chip {
      color: white !important;
      font-size: 11px !important;
      font-weight: 500 !important;
    }

    .customer-name-cell .name {
      font-weight: 500;
    }

    .customer-name-cell .short-name {
      font-size: 12px;
      color: #999;
      margin-left: 4px;
    }

    .contact-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .contact-cell .contact-person {
      font-weight: 500;
    }

    .contact-cell .email,
    .contact-cell .phone {
      font-size: 12px;
      color: #666;
    }

    .location-cell {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .verified-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #4caf50;
    }

    .customer-cell,
    .product-cell {
      display: flex;
      flex-direction: column;
    }

    .customer-cell .code,
    .product-cell .code {
      font-size: 11px;
      color: #999;
    }

    .amount-cell {
      display: flex;
      flex-direction: column;
    }

    .amount-cell .sales {
      font-weight: 600;
      color: #1a237e;
    }

    .amount-cell .margin {
      font-size: 11px;
      color: #f44336;
    }

    .amount-cell .margin.positive {
      color: #4caf50;
    }

    .no-data {
      color: #999;
      font-style: italic;
    }

    tr.mat-mdc-row {
      transition: background 0.15s ease;
    }

    tr.mat-mdc-row:hover {
      background: rgba(26, 35, 126, 0.03);
    }

    tr.mat-mdc-row.selected {
      background: rgba(26, 35, 126, 0.07);
    }

    /* Status Chips */
    .status-new { background: #e3f2fd !important; color: #1976d2 !important; }
    .status-processing { background: #fff3e0 !important; color: #f57c00 !important; }
    .status-ready { background: #e8f5e9 !important; color: #388e3c !important; }
    .status-shipped { background: #f3e5f5 !important; color: #7b1fa2 !important; }
    .status-pending { background: #fff8e1 !important; color: #ffa000 !important; }
    .status-assigned { background: #e1f5fe !important; color: #0288d1 !important; }
    .status-delivered { background: #e8f5e9 !important; color: #388e3c !important; }
    .status-active { background: #e8f5e9 !important; color: #388e3c !important; }
    .status-inactive { background: #fafafa !important; color: #9e9e9e !important; }

    .priority-chip-high { background: #ffebee !important; color: #c62828 !important; }
    .priority-chip-medium { background: #fff3e0 !important; color: #ef6c00 !important; }
    .priority-chip-low { background: #e8f5e9 !important; color: #2e7d32 !important; }

    /* Reports Grid */
    .reports-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
    }

    .report-card {
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(.4,0,.2,1);
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%);
    }

    .report-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 36px rgba(26, 35, 126, 0.14);
      border-color: rgba(26, 35, 126, 0.2);
    }

    .report-card mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 36px 28px 32px;
    }

    .report-card mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #1a237e;
      margin-bottom: 18px;
      transition: transform 0.3s ease;
      background: linear-gradient(135deg, rgba(26,35,126,0.08), rgba(26,35,126,0.04));
      border-radius: 16px;
      padding: 14px;
      box-sizing: content-box;
    }

    .report-card:hover mat-icon {
      transform: scale(1.1);
      background: linear-gradient(135deg, rgba(26,35,126,0.14), rgba(26,35,126,0.06));
    }

    .report-card h4 {
      margin: 0 0 8px 0;
      color: #1a237e;
      font-size: 17px;
      font-weight: 600;
      letter-spacing: -0.2px;
    }

    .report-card p {
      margin: 0;
      font-size: 13.5px;
      color: #78909c;
      line-height: 1.5;
    }

    .report-card.active {
      border: 2px solid #1a237e;
      box-shadow: 0 8px 28px rgba(26, 35, 126, 0.22);
      background: linear-gradient(180deg, #f0f1ff 0%, #ffffff 100%);
    }

    @media (max-width: 1200px) {
      .reports-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .reports-grid { grid-template-columns: 1fr; }
    }

    /* Welly Report Panel */
    .welly-report-panel {
      margin-top: 24px;
      background: #f8f9fa;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.05);
      animation: slideUp 0.35s cubic-bezier(.4,0,.2,1);
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .welly-report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 20px;
      background: linear-gradient(135deg, #1a237e 0%, #311b92 100%);
      color: white;
    }

    .welly-report-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-report-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .welly-sparkle-gold {
      color: #ffd700;
    }

    .welly-report-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .welly-report-header-actions button {
      color: white;
    }

    .welly-report-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 48px;
    }

    .welly-report-loading p {
      color: #444;
      font-size: 15px;
      font-weight: 500;
      margin: 0;
    }

    .welly-report-loading .loading-sub {
      color: #888;
      font-size: 12px;
    }

    /* Report Summary Cards */
    .report-summary-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 12px;
      padding: 20px;
    }

    .report-summary-card {
      background: white;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.04);
      transition: all 0.2s ease;
    }

    .report-summary-card:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      transform: translateY(-1px);
    }

    .report-summary-card mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #1a237e;
    }

    .rs-info {
      display: flex;
      flex-direction: column;
    }

    .rs-value {
      font-size: 16px;
      font-weight: 700;
      color: #333;
      line-height: 1.2;
    }

    .rs-label {
      font-size: 10px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    /* Report Charts Grid */
    .report-charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      padding: 0 20px 20px;
    }

    .report-chart-card {
      background: white;
      border-radius: 14px;
      padding: 18px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
      border: 1px solid rgba(0, 0, 0, 0.04);
      transition: box-shadow 0.2s ease;
    }

    .report-chart-card:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
    }

    .report-chart-card h4 {
      margin: 0 0 14px 0;
      font-size: 12px;
      font-weight: 600;
      color: #78909c;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }

    .report-chart-card canvas {
      width: 100% !important;
      max-height: 240px;
    }

    /* Report Analysis Section */
    .report-analysis-section {
      padding: 0 20px 20px;
    }

    .report-analysis-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: #555;
    }

    .report-analysis-title mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #1a237e;
    }

    .report-analysis-text {
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.06);
      border-radius: 14px;
      padding: 20px;
      font-size: 13.5px;
      line-height: 1.75;
      white-space: pre-wrap;
      max-height: 50vh;
      overflow-y: auto;
      color: #37474f;
    }

    @media (max-width: 900px) {
      .report-summary-grid { grid-template-columns: repeat(3, 1fr); }
      .report-charts-grid { grid-template-columns: 1fr; }
    }

    /* Customer Sidebar */
    .customer-sidebar {
      position: fixed;
      right: 0;
      top: 64px;
      width: 360px;
      height: calc(100vh - 64px);
      background: white;
      box-shadow: -4px 0 20px rgba(0, 0, 0, 0.08), -1px 0 4px rgba(0, 0, 0, 0.03);
      border-left: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 100;
      overflow-y: auto;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      position: sticky;
      top: 0;
      background: white;
    }

    .sidebar-header h3 {
      margin: 0;
      color: #1a237e;
    }

    .sidebar-content {
      padding: 20px;
    }

    .customer-info-section h4 {
      margin: 0 0 4px 0;
      color: #1a237e;
      font-size: 18px;
    }

    .customer-code {
      color: #666;
      font-size: 14px;
      margin: 0;
    }

    .info-group {
      margin: 16px 0;
    }

    .info-group h5 {
      margin: 0 0 12px 0;
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .info-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
    }

    .info-item a {
      color: #1976d2;
      text-decoration: none;
    }

    .info-item a:hover {
      text-decoration: underline;
    }

    .address-block {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .address-block p {
      margin: 0 0 4px 0;
      font-size: 14px;
    }

    .sidebar-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 20px;
    }

    /* Loading & Empty States */
    .loading-state {
      display: flex; justify-content: center; padding: 80px 20px; min-height: 60vh; align-items: center;
    }
    .loading-card {
      background: rgba(255,255,255,0.97); border-radius: 20px;
      padding: 48px 56px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.12);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: #1a1a2e; margin: 16px 0 6px; font-size: 20px; font-weight: 700; }
    .loading-card p { color: #64748b; margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, rgba(255,152,0,0.12), rgba(255,193,7,0.12));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(255,152,0,0.15);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #ff9800; }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
    .lc-subtitle { color: #94a3b8 !important; font-size: 13px !important; }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track { height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; position: relative; }
    .lc-progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #ff9800, #ffc107, #ff5722);
      background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite;
      transition: width 0.15s ease-out; position: relative;
    }
    .lc-progress-fill::after {
      content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4)); border-radius: 0 4px 4px 0;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .lc-progress-info { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; }
    .lc-progress-message { color: #64748b; font-weight: 500; }
    .lc-progress-pct { color: #ff9800; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
    .lc-steps { display: flex; justify-content: space-between; gap: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.35; transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.65; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot { background: linear-gradient(135deg, #ff9800, #ff5722); box-shadow: 0 2px 10px rgba(255,152,0,0.3); }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: #dcfce7; }
    .lc-step.done .lc-step-dot mat-icon { color: #16a34a; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #ff9800; }
    .lc-step.done .lc-step-label { color: #16a34a; }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 60px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px;
      color: #78909c;
    }

    .empty-state mat-icon {
      font-size: 60px;
      width: 60px;
      height: 60px;
      color: #b0bec5;
      margin-bottom: 16px;
      opacity: 0.7;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #455a64;
      font-weight: 600;
    }

    .empty-state p {
      margin: 0;
      font-size: 14px;
    }

    /* Delete/Cancel buttons */
    .delete-btn, .cancel-btn {
      color: #f44336 !important;
    }

    /* Attention Button */
    .attention-btn {
      animation: pulse-warning 2s infinite;
    }

    @keyframes pulse-warning {
      0%, 100% { box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(244, 67, 54, 0); }
    }

    /* Attention Dialog */
    .attention-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .attention-dialog {
      background: white;
      border-radius: 18px;
      width: 90%;
      max-width: 900px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06);
    }

    .attention-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #eee;
      background: linear-gradient(135deg, #ff9800 0%, #f44336 100%);
      border-radius: 16px 16px 0 0;
    }

    .attention-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-size: 20px;
    }

    .attention-header mat-icon {
      color: white;
    }

    .attention-header button {
      color: white;
    }

    .attention-content {
      padding: 24px;
      overflow-y: auto;
      max-height: 60vh;
    }

    .attention-desc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 16px;
    }

    .attention-desc-row .attention-desc {
      margin-bottom: 0;
    }

    .attention-desc-row button {
      white-space: nowrap;
    }

    .attention-desc-row mat-spinner {
      margin-right: 8px;
    }

    .attention-desc {
      color: #666;
      margin-bottom: 16px;
    }

    .attention-badge {
      background: #f44336;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 12px;
      margin-left: 8px;
      font-weight: 500;
    }

    .attention-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .attention-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 10px;
      gap: 16px;
      transition: background 0.15s ease;
    }

    .attention-item:hover {
      background: #eceff1;
    }

    .attention-item-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .attention-item-info strong {
      font-size: 15px;
      color: #333;
    }

    .attention-item-info .code {
      font-size: 12px;
      color: #666;
      font-family: monospace;
    }

    .attention-item-info .address,
    .attention-item-info .customer {
      font-size: 13px;
      color: #888;
    }

    .attention-item-info .amount {
      font-size: 13px;
      color: #2e7d32;
      font-weight: 500;
    }

    .attention-item-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .province-select {
      width: 180px;
    }

    ::ng-deep .attention-item-actions .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .bulk-actions {
      display: flex;
      gap: 16px;
      align-items: center;
      padding-top: 24px;
      margin-top: 24px;
      border-top: 1px solid #eee;
    }

    .bulk-province {
      width: 200px;
    }

    /* Welly Fix Button */
    .welly-fix-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      font-weight: 500;
      border: none;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 20px;
      border-radius: 8px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .welly-fix-btn:hover:not([disabled]) {
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.5);
      transform: translateY(-1px);
    }

    .welly-fix-btn[disabled] {
      opacity: 0.7;
    }

    .welly-btn-icon {
      font-size: 20px;
      line-height: 1;
    }

    .attention-desc-buttons {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .attention-desc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    /* Welly Review Panel */
    .welly-review-panel {
      padding: 0;
    }

    .welly-review-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea08 0%, #764ba208 100%);
      border: 1px solid #667eea22;
      border-radius: 12px;
      margin-bottom: 16px;
    }

    .welly-avatar {
      font-size: 36px;
      line-height: 1;
      flex-shrink: 0;
    }

    .welly-review-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .welly-review-header p {
      margin: 4px 0 0;
      font-size: 13px;
      color: #666;
    }

    .welly-review-actions-header {
      margin-left: auto;
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }

    .welly-review-actions-header button {
      font-size: 12px;
    }

    .welly-review-list {
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 4px;
    }

    .welly-review-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 16px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .welly-review-item:hover {
      border-color: #667eea;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }

    .welly-review-item.failed {
      background: #fff5f5;
      border-color: #ffcdd2;
    }

    .welly-review-item.rejected {
      opacity: 0.5;
    }

    .welly-review-toggle {
      padding-top: 2px;
      flex-shrink: 0;
    }

    .fix-failed-icon {
      color: #ef5350;
    }

    .welly-review-info {
      flex: 1;
      min-width: 0;
    }

    .welly-review-name {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .welly-review-name strong {
      font-size: 14px;
      color: #333;
    }

    .welly-review-name .code,
    .welly-review-name .customer {
      font-size: 12px;
      color: #888;
    }

    .welly-review-name .amount {
      font-size: 12px;
      font-weight: 600;
      color: #2e7d32;
    }

    .welly-review-suggestion {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      font-size: 13px;
      color: #555;
    }

    .welly-review-suggestion mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #667eea;
    }

    .welly-review-details {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      flex-wrap: wrap;
    }

    .welly-chip {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      background: #e8eaf6;
      color: #3949ab;
    }

    .welly-chip.province {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .welly-review-source {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 11px;
      color: #999;
    }

    .welly-review-source mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .welly-review-error {
      margin-top: 4px;
      font-size: 12px;
      color: #ef5350;
      font-style: italic;
    }

    .welly-review-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      margin-top: 16px;
      border-top: 1px solid #eee;
    }

    .welly-review-actions button {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Responsive */
    @media (max-width: 1200px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .company-cards-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .header-stats-row {
        display: none;
      }
    }

    @media (max-width: 768px) {
      .sales-dashboard {
        padding: 16px;
        padding-top: 80px;
      }

      .dashboard-header {
        flex-direction: column;
        gap: 16px;
      }

      .header-content-wrapper {
        flex-direction: column;
        text-align: center;
      }

      .header-text-area h1 {
        font-size: 24px;
      }

      .header-actions {
        width: 100%;
        justify-content: center;
      }

      .action-btn span {
        display: none;
      }

      .action-btn {
        padding: 12px;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }

      .company-cards-grid {
        grid-template-columns: 1fr;
      }

      .section-actions {
        flex-wrap: wrap;
      }

      .customer-sidebar {
        width: 100%;
      }
    }

    /* Company Sales Dialog Styles */
    .company-sales-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      backdrop-filter: blur(4px);
    }

    .company-sales-dialog {
      background: white;
      border-radius: 18px;
      width: 95%;
      max-width: 1200px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 16px 56px rgba(0, 0, 0, 0.22), 0 4px 16px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      color: white;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-content mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .header-text h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }

    .header-text span {
      font-size: 14px;
      opacity: 0.9;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
      background: #f8f9fa;
    }

    .summary-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      background: white;
      border-radius: 14px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.04);
      transition: transform 0.2s ease;
    }

    .summary-card:hover {
      transform: translateY(-1px);
    }

    .summary-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .summary-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .summary-icon.today { background: linear-gradient(135deg, #4caf50 0%, #43a047 100%); }
    .summary-icon.week { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); }
    .summary-icon.month { background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%); }
    .summary-icon.quarter { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); }

    .summary-info {
      display: flex;
      flex-direction: column;
    }

    .summary-label {
      font-size: 13px;
      color: #666;
      font-weight: 500;
    }

    .summary-value {
      font-size: 24px;
      font-weight: 700;
      color: #1a237e;
    }

    .summary-orders {
      font-size: 12px;
      color: #999;
    }

    .chart-section {
      background: white;
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      border: 1px solid rgba(0, 0, 0, 0.04);
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .chart-header h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
      font-size: 18px;
    }

    .chart-container {
      height: 250px;
      position: relative;
    }

    .chart-bars {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 100%;
      padding: 20px 0;
      gap: 4px;
    }

    .chart-bar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      height: 100%;
      cursor: pointer;
    }

    .chart-bar {
      width: 100%;
      max-width: 40px;
      min-height: 4px;
      border-radius: 4px 4px 0 0;
      transition: all 0.3s ease;
      margin-top: auto;
    }

    .chart-bar-wrapper:hover .chart-bar {
      opacity: 0.8;
      transform: scaleY(1.05);
    }

    .chart-label {
      font-size: 10px;
      color: #666;
      margin-top: 8px;
      text-align: center;
      white-space: nowrap;
    }

    .sales-table-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .table-header h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
      font-size: 18px;
    }

    .new-sale-form {
      background: #f5f5f5;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .new-sale-form h4 {
      margin: 0 0 16px 0;
      color: #1a237e;
    }

    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .form-row mat-form-field.wide {
      flex: 2;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .sales-table-section .table-container {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      background: white;
    }

    .sales-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .sales-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
      padding: 12px 16px;
      text-align: left;
      border-bottom: 2px solid #e0e0e0;
      white-space: nowrap;
    }

    .sales-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sales-table tr:last-child td {
      border-bottom: none;
    }

    .sales-table tr:hover td {
      background: #fafafa;
    }

    /* Column widths for dialog sales table */
    .sales-table .mat-column-date {
      width: 120px;
    }

    .sales-table .mat-column-transaction {
      width: 140px;
    }

    .sales-table .mat-column-customer {
      width: auto;
    }

    .sales-table .mat-column-product {
      width: auto;
    }

    .sales-table .mat-column-quantity {
      width: 70px;
      text-align: right;
    }

    .sales-table .mat-column-amount {
      width: 150px;
      text-align: right;
    }

    .amount-cell {
      font-weight: 600;
      color: #1a237e;
    }

    /* Table header actions */
    .table-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .export-btn {
      font-size: 12px !important;
      height: 36px !important;
      line-height: 36px !important;
      border-radius: 8px !important;
    }

    .excel-btn {
      color: #2e7d32 !important;
      border-color: #2e7d32 !important;
    }

    .excel-btn:hover {
      background: rgba(46, 125, 50, 0.08) !important;
    }

    .pdf-btn {
      color: #c62828 !important;
      border-color: #c62828 !important;
    }

    .pdf-btn:hover {
      background: rgba(198, 40, 40, 0.08) !important;
    }

    /* Export Date Range Popup */
    .export-date-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1100;
      backdrop-filter: blur(3px);
    }

    .export-date-popup {
      background: white;
      border-radius: 16px;
      padding: 28px;
      width: 420px;
      max-width: 90vw;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: popupSlideIn 0.2s ease-out;
    }

    @keyframes popupSlideIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .export-popup-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .export-popup-header mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #1a237e;
    }

    .export-popup-header h3 {
      flex: 1;
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a237e;
    }

    .export-popup-desc {
      color: #666;
      font-size: 13px;
      margin: 0 0 20px 0;
    }

    .export-date-fields {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }

    .export-date-fields mat-form-field {
      flex: 1;
    }

    .export-quick-ranges {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .export-quick-ranges button {
      font-size: 11px !important;
      height: 30px !important;
      line-height: 30px !important;
      border-radius: 15px !important;
      padding: 0 14px !important;
    }

    .export-popup-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid #eee;
    }

    .spin-icon {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .compare-btn {
      color: #1565c0 !important;
      border-color: #1565c0 !important;
    }

    .compare-btn:hover {
      background: rgba(21, 101, 192, 0.08) !important;
    }

    /* Comparison Dialog */
    .compare-dialog {
      background: white;
      border-radius: 16px;
      padding: 0;
      width: 780px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: popupSlideIn 0.2s ease-out;
    }

    .compare-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 12px;
      border-bottom: 1px solid #eee;
    }

    .compare-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .compare-title mat-icon {
      color: #1a237e;
      font-size: 26px;
      width: 26px;
      height: 26px;
    }

    .compare-title h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1a237e;
    }

    .compare-config {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px 0;
      flex-wrap: wrap;
    }

    .compare-companies {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .compare-company-badge {
      padding: 6px 14px;
      border-radius: 20px;
      color: white;
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
    }

    .compare-select {
      width: 180px;
    }

    .compare-date-range {
      display: flex;
      gap: 10px;
      margin-left: auto;
    }

    .compare-date-field {
      width: 140px;
    }

    .compare-quick-ranges {
      display: flex;
      gap: 8px;
      padding: 0 24px 12px;
      flex-wrap: wrap;
    }

    .compare-quick-ranges button {
      font-size: 11px !important;
      height: 28px !important;
      line-height: 28px !important;
      border-radius: 14px !important;
      padding: 0 12px !important;
    }

    /* Side-by-Side Summary */
    .compare-summary {
      display: flex;
      gap: 0;
      margin: 0 24px 16px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }

    .compare-col {
      flex: 1;
    }

    .compare-col-header {
      color: white;
      font-weight: 600;
      text-align: center;
      padding: 10px;
      font-size: 14px;
    }

    .compare-stat {
      display: flex;
      justify-content: space-between;
      padding: 8px 14px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 13px;
    }

    .compare-stat .label {
      color: #777;
    }

    .compare-stat .val {
      font-weight: 600;
      color: #333;
    }

    .compare-vs {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      padding: 0 12px;
      font-weight: 800;
      font-size: 16px;
      color: #999;
      border-left: 1px solid #e0e0e0;
      border-right: 1px solid #e0e0e0;
    }

    /* Comparison Chart */
    .compare-chart-section {
      margin: 0 24px 16px;
    }

    .compare-chart-section h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
      font-size: 14px;
      margin: 0 0 10px 0;
    }

    .compare-chart {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      height: 120px;
      background: #fafafa;
      border-radius: 10px;
      padding: 12px 8px 24px;
      overflow-x: auto;
    }

    .compare-chart-day {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
      min-width: 28px;
    }

    .compare-bars {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      height: 80px;
      width: 100%;
    }

    .compare-bar {
      flex: 1;
      min-height: 3px;
      border-radius: 3px 3px 0 0;
      transition: height 0.3s ease;
      cursor: pointer;
    }

    .compare-chart-label {
      font-size: 8px;
      color: #999;
      margin-top: 4px;
      white-space: nowrap;
    }

    .compare-legend {
      display: flex;
      gap: 20px;
      justify-content: center;
      margin-top: 8px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #555;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    /* Highlights */
    .compare-highlights {
      display: flex;
      gap: 12px;
      margin: 0 24px 16px;
    }

    .highlight-card {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      border-radius: 10px;
      border: 1px solid #e0e0e0;
    }

    .highlight-card.positive {
      background: #e8f5e9;
      border-color: #a5d6a7;
    }

    .highlight-card.positive mat-icon {
      color: #2e7d32;
    }

    .highlight-card.negative {
      background: #fce4ec;
      border-color: #ef9a9a;
    }

    .highlight-card.negative mat-icon {
      color: #c62828;
    }

    .highlight-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .highlight-text {
      display: flex;
      flex-direction: column;
    }

    .highlight-label {
      font-size: 11px;
      color: #666;
    }

    .highlight-value {
      font-weight: 700;
      font-size: 15px;
      color: #333;
    }

    .highlight-sub {
      font-size: 11px;
      color: #888;
    }

    .compare-actions {
      display: flex;
      justify-content: center;
      padding: 16px 24px 20px;
      border-top: 1px solid #eee;
    }

    .compare-placeholder {
      text-align: center;
      padding: 48px 24px;
      color: #999;
    }

    .compare-placeholder mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .no-data {
      text-align: center;
      padding: 48px;
      color: #999;
    }

    .no-data mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    @media (max-width: 1000px) {
      .summary-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .summary-row {
        grid-template-columns: 1fr;
      }
      .form-row {
        flex-direction: column;
      }
      .company-sales-dialog {
        width: 100%;
        max-height: 100vh;
        border-radius: 0;
      }
    }

    /* POD Documents Styles */
    .pod-section {
      padding: 0;
    }

    .pod-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .pod-filters {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }

    .pod-filter-field {
      width: 160px;
      
      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .pod-driver-field {
      width: 200px;
    }

    .pod-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pod-upload-btn {
      border-radius: 8px !important;
      
      mat-icon {
        margin-right: 4px;
      }
    }

    .pod-view-toggle {
      display: flex;
      background: #f0f0f0;
      border-radius: 8px;
      padding: 2px;

      button {
        border-radius: 6px !important;
        
        &.active {
          background: #1e90ff;
          color: white;
        }
      }
    }

    .pod-stats-row {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .pod-stat-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 8px 16px;

      mat-icon {
        color: #1e90ff;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .stat-num {
        font-size: 18px;
        font-weight: 700;
        color: #1a1a2e;
      }

      .stat-lbl {
        font-size: 12px;
        color: #888;
      }

      &.region-chip mat-icon { color: #4caf50; }
      &.drivers-chip mat-icon { color: #ff9800; }
    }

    .linked-chip mat-icon { color: #2e7d32; }
    .unlinked-chip mat-icon { color: #e65100; }
    .tripsheet-chip mat-icon { color: #1565c0; }
    .invoice-chip mat-icon { color: #283593; }

    .pod-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .pod-card {
      background: #fff !important;
      border: 1px solid #e0e0e0;
      border-radius: 12px !important;
      padding: 16px !important;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        border-color: #1e90ff;
        box-shadow: 0 4px 16px rgba(30, 144, 255, 0.15);
      }
    }

    .pod-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .pdf-icon {
      color: #e53935;
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .pod-card-info {
      flex: 1;
      display: flex;
      flex-direction: column;

      .pod-driver {
        font-weight: 600;
        font-size: 14px;
        color: #1a1a2e;
      }

      .pod-date {
        font-size: 12px;
        color: #888;
      }
    }

    .pod-region-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;

      &.region-gp {
        background: #e3f2fd;
        color: #1565c0;
      }

      &.region-kzn {
        background: #e8f5e9;
        color: #2e7d32;
      }

      &.small {
        padding: 2px 8px;
        font-size: 10px;
      }
    }

    .pod-card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .pod-filename {
        font-size: 12px;
        color: #666;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 200px;
      }

      .pod-size {
        font-size: 11px;
        color: #999;
      }
    }

    .pod-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-top: 4px;

      button {
        transform: scale(0.85);
      }
    }

    .pod-link-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }

      &.linked {
        background: #e8f5e9;
        color: #2e7d32;
      }

      &.not-linked {
        background: #fff3e0;
        color: #e65100;
      }

      &.invoice {
        background: #e8eaf6;
        color: #283593;
      }

      &.small {
        padding: 2px 8px;
        font-size: 10px;

        mat-icon {
          font-size: 12px;
          width: 12px;
          height: 12px;
        }
      }
    }

    .pod-tripsheet-ref {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      padding: 4px 8px;
      background: #f5f5f5;
      border-radius: 6px;
      font-size: 12px;
      color: #1976d2;
      font-weight: 500;

      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #1976d2;
      }

      &.invoice-ref {
        color: #283593;
        mat-icon { color: #283593; }
      }
    }

    .pod-list-container {
      overflow-x: auto;
    }

    .pod-table {
      width: 100%;
      background: #fff;
      
      .clickable-row {
        cursor: pointer;
        
        &:hover {
          background: #f5f8ff;
        }
      }
    }

    .pod-pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;

      .pod-page-info {
        font-size: 13px;
        color: #666;
      }

      .pod-page-btns {
        display: flex;
        align-items: center;
        gap: 8px;

        .page-num {
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }
      }
    }

    .pod-password-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .pod-password-card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      width: 380px;
      max-width: 90vw;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }

    .pod-password-card mat-icon.lock-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1e90ff;
      margin-bottom: 12px;
    }

    .pod-password-card h3 {
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #1a1a2e;
    }

    .pod-password-card p {
      margin: 0 0 20px 0;
      color: #666;
      font-size: 14px;
    }

    .pod-password-card .password-input {
      width: 100%;
      margin-bottom: 16px;
    }

    .pod-password-card .password-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .pod-password-error {
      color: #e53935;
      font-size: 13px;
      margin: -8px 0 12px 0;
    }
  `]
})
export class SalesDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private apiUrl = environment.apiUrl;

  // Companies
  companies = COMPANIES;

  // Tab state
  selectedTab = 0;

  // Data signals
  customers = signal<Customer[]>([]);
  invoices = signal<Invoice[]>([]);
  orders = signal<Order[]>([]);
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
  podViewMode = 'grid';
  podCurrentPage = 1;
  podPageSize = 50;
  podTotalCount = 0;
  podTableColumns = ['driverName', 'deliveryDate', 'region', 'linkStatus', 'fileName', 'fileSize', 'actions'];
  // POD Upload password gate
  showPodPasswordDialog = false;
  podPasswordInput = '';
  podPasswordError = '';
  private readonly POD_UPLOAD_PASSWORD = '1234';

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

  // Report dates
  reportFromDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  reportToDate: Date = new Date();

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

  // Back Order computed signals
  promedBackOrders = computed(() => PROMED_BACK_ORDERS);
  accessBackOrders = computed(() => ACCESS_BACK_ORDERS);
  pharmatechBackOrders = computed(() => PHARMATECH_BACK_ORDERS);
  sebenzaniBackOrders = computed(() => SEBENZANI_BACK_ORDERS);

  filteredBackOrders = computed(() => {
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
  companySalesData = computed(() => {
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
    this.startLoadingProgress();
    this.loadDashboardData();
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
    this.loadInvoices();
    this.loadOrders();
    this.loadEmailAccounts();
    this.loadPodDocuments();
    this.loadPodSummary();
    // Stats are now calculated reactively when data loads
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
        this.snackBar.open('Failed to load customers', 'Close', { duration: 3000 });
      }
    });
  }

  loadInvoices(): void {
    this.loadingInvoices.set(true);
    this.http.get<Invoice[]>(`${this.apiUrl}/logistics/importedinvoices?pageSize=10000`, { observe: 'response' }).subscribe({
      next: (response) => {
        this.invoices.set(response.body || []);
        this.loadingInvoices.set(false);
        this.updateStats();
        this.checkInitialLoadComplete();
      },
      error: (err) => {
        console.error('Failed to load invoices:', err);
        this.loadingInvoices.set(false);
        this.checkInitialLoadComplete();
        this.snackBar.open('Failed to load invoices', 'Close', { duration: 3000 });
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
        this.snackBar.open('Failed to load incoming emails. Check IMAP connection.', 'Close', { duration: 5000 });
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
      totalInvoices: invoices.length,
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
    this.snackBar.open('Customer dialog coming soon', 'Close', { duration: 2000 });
  }

  editCustomer(customer: Customer): void {
    this.snackBar.open('Edit customer: ' + customer.name, 'Close', { duration: 2000 });
  }

  selectCustomer(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.showCustomerSidebar = true;
  }

  viewCustomerInvoices(customer: Customer): void {
    this.customerSearch.set(customer.customerCode || customer.name);
    this.selectedTab = 2; // Switch to invoices tab
    this.showCustomerSidebar = false;
  }

  geocodeCustomer(customer: Customer): void {
    this.snackBar.open('Geocoding address...', 'Close', { duration: 2000 });
    // Call geocode API
    this.http.post(`${this.apiUrl}/logistics/googlemaps/geocode-customer/${customer.id}`, {}).subscribe({
      next: () => {
        this.snackBar.open('Address geocoded successfully', 'Close', { duration: 3000 });
        this.loadCustomers();
      },
      error: () => {
        this.snackBar.open('Failed to geocode address', 'Close', { duration: 3000 });
      }
    });
  }

  createOrderForCustomer(customer: Customer): void {
    this.snackBar.open('Create order for: ' + customer.name, 'Close', { duration: 2000 });
  }

  viewCustomerHistory(customer: Customer): void {
    this.snackBar.open('View history for: ' + customer.name, 'Close', { duration: 2000 });
  }

  deleteCustomer(customer: Customer): void {
    if (confirm(`Are you sure you want to delete ${customer.name}?`)) {
      this.http.delete(`${this.apiUrl}/logistics/customers/${customer.id}`).subscribe({
        next: () => {
          this.snackBar.open('Customer deleted', 'Close', { duration: 3000 });
          this.loadCustomers();
        },
        error: () => {
          this.snackBar.open('Failed to delete customer', 'Close', { duration: 3000 });
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
    this.snackBar.open('Invoice capture dialog coming soon', 'Close', { duration: 2000 });
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
        this.snackBar.open('Invoice updated successfully', 'Close', { duration: 3000 });
        this.closeEditInvoiceDialog();
        this.loadInvoices();
      },
      error: (err) => {
        console.error('Failed to update invoice:', err);
        this.snackBar.open('Failed to update invoice', 'Close', { duration: 3000 });
        this.editInvoiceSaving = false;
      }
    });
  }

  sendToLogistics(invoice: Invoice): void {
    // Open delivery dialog with this invoice pre-selected
    this.openDeliveryRequestDialog();
    this.toggleDeliveryInvoice(invoice);
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
        this.snackBar.open('Delivery request submitted!', 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.deliverySaving = false;
        this.deliveryError = err.error?.error || 'Failed to submit delivery request';
      }
    });
  }

  printInvoice(invoice: Invoice): void {
    this.snackBar.open('Printing invoice...', 'Close', { duration: 2000 });
  }

  emailInvoice(invoice: Invoice): void {
    this.snackBar.open('Emailing invoice...', 'Close', { duration: 2000 });
  }

  duplicateInvoice(invoice: Invoice): void {
    this.snackBar.open('Duplicating invoice...', 'Close', { duration: 2000 });
  }

  deleteInvoice(invoice: Invoice): void {
    if (confirm(`Are you sure you want to delete invoice ${invoice.transactionNumber}?`)) {
      this.http.delete(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}`).subscribe({
        next: () => {
          this.snackBar.open('Invoice deleted', 'Close', { duration: 3000 });
          this.loadInvoices();
        },
        error: () => {
          this.snackBar.open('Failed to delete invoice', 'Close', { duration: 3000 });
        }
      });
    }
  }

  importInvoices(): void {
    this.snackBar.open('Import invoices dialog coming soon', 'Close', { duration: 2000 });
  }

  // Order methods
  processOrder(order: Order): void {
    this.snackBar.open('Processing order: ' + order.orderNumber, 'Close', { duration: 2000 });
  }

  viewOrderDetails(order: Order): void {
    this.snackBar.open('View order details: ' + order.orderNumber, 'Close', { duration: 2000 });
  }

  createInvoiceFromOrder(order: Order): void {
    this.snackBar.open('Creating invoice from order...', 'Close', { duration: 2000 });
  }

  assignToLogistics(order: Order): void {
    this.snackBar.open('Assigning to logistics...', 'Close', { duration: 2000 });
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
      this.snackBar.open(`Copied: ${email.fromEmail}`, 'Close', { duration: 2000 });
    });
  }

  createOrderFromEmail(email: IncomingOrderEmail): void {
    this.snackBar.open('Create order from email: ' + email.subject, 'Close', { duration: 3000 });
  }

  forwardToLogistics(email: IncomingOrderEmail): void {
    this.snackBar.open('Forwarding email to logistics...', 'Close', { duration: 3000 });
  }

  cancelOrder(order: Order): void {
    const reason = prompt('Please enter cancellation reason:', 'CustomerRequest');
    if (!reason) return;

    this.snackBar.open('Order cancellation is no longer available. Use Back Orders tab instead.', 'Close', { duration: 3000 });
  }

  // ═══════════════════════════════════════════
  // Welly Sales Reports (AI-Powered)
  // ═══════════════════════════════════════════

  showReportPanel = false;
  reportLoading = false;
  reportResult = '';
  reportSummary: SalesReportSummary | null = null;
  reportCharts: SalesReportResponse['charts'] | null = null;
  activeReportType = '';
  reportPanelTitle = 'Sales Report';
  private reportChartInstances: Chart[] = [];

  private readonly reportColors = [
    '#1a237e', '#00695c', '#c62828', '#6a1b9a', '#ef6c00',
    '#0277bd', '#2e7d32', '#ad1457', '#4527a0', '#00838f',
    '#558b2f', '#d84315', '#6d4c41', '#37474f', '#ff6f00'
  ];

  private readonly reportTitles: Record<string, string> = {
    'sales-summary': 'Sales Summary Report',
    'customer-analysis': 'Customer Analysis Report',
    'province-breakdown': 'Province Breakdown Report',
    'product-performance': 'Product Performance Report'
  };

  generateReport(): void {
    this.runReport('sales-summary');
  }

  runReport(reportType: string): void {
    this.activeReportType = reportType;
    this.reportPanelTitle = this.reportTitles[reportType] || 'Sales Report';
    this.showReportPanel = true;
    this.reportLoading = true;
    this.reportResult = '';
    this.reportSummary = null;
    this.reportCharts = null;
    this.destroyReportCharts();

    this.http.post<SalesReportResponse>(
      `${this.apiUrl}/aichat/welly-sales-report`,
      {
        reportType,
        fromDate: this.reportFromDate.toISOString(),
        toDate: this.reportToDate.toISOString()
      }
    ).subscribe({
      next: (res) => {
        this.reportResult = res.analysis;
        this.reportSummary = res.summary;
        this.reportCharts = res.charts;
        this.reportLoading = false;
        setTimeout(() => this.renderReportCharts(), 150);
      },
      error: () => {
        this.snackBar.open('Welly could not generate the report. Please try again.', 'Close', { duration: 3000 });
        this.reportLoading = false;
      }
    });
  }

  private destroyReportCharts(): void {
    this.reportChartInstances.forEach(c => c.destroy());
    this.reportChartInstances = [];
  }

  closeReportPanel(): void {
    this.showReportPanel = false;
    this.activeReportType = '';
    this.destroyReportCharts();
  }

  private renderReportCharts(): void {
    if (!this.reportCharts) return;
    this.destroyReportCharts();

    // Sales by Company (doughnut)
    this.pushReportChart('report-chart-company', 'doughnut',
      this.reportCharts.salesByCompany.labels,
      this.reportCharts.salesByCompany.values, 'Revenue (R)');

    // Daily Sales Trend (line)
    this.pushReportLineChart('report-chart-daily',
      this.reportCharts.dailySales.labels,
      this.reportCharts.dailySales.values);

    // Top Customers (bar - horizontal)
    this.pushReportChart('report-chart-customers', 'bar',
      this.reportCharts.topCustomers.labels,
      this.reportCharts.topCustomers.values, 'Revenue (R)', true);

    // Sales by Province (doughnut)
    this.pushReportChart('report-chart-province', 'doughnut',
      this.reportCharts.salesByProvince.labels,
      this.reportCharts.salesByProvince.values, 'Revenue (R)');

    // Top Products (bar - horizontal)
    this.pushReportChart('report-chart-products', 'bar',
      this.reportCharts.topProducts.labels,
      this.reportCharts.topProducts.values, 'Revenue (R)', true);

    // Cancellations by Reason (doughnut)
    if (this.reportCharts.cancellationsByReason.labels.length > 0) {
      this.pushReportChart('report-chart-cancellations', 'doughnut',
        this.reportCharts.cancellationsByReason.labels,
        this.reportCharts.cancellationsByReason.values, 'Count');
    }
  }

  private pushReportChart(canvasId: string, type: 'doughnut' | 'bar', labels: string[], values: number[], label: string, horizontal = false): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas || !labels?.length) return;
    const colors = labels.map((_, i) => this.reportColors[i % this.reportColors.length]);

    if (type === 'doughnut') {
      this.reportChartInstances.push(new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12, boxWidth: 12 } } }
        }
      }));
    } else {
      this.reportChartInstances.push(new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ label, data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
        options: {
          responsive: true, maintainAspectRatio: true,
          indexAxis: horizontal ? 'y' : 'x',
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: !horizontal }, ticks: { font: { size: 10 } } },
            y: { grid: { display: horizontal }, ticks: { font: { size: 10 } } }
          }
        }
      }));
    }
  }

  private pushReportLineChart(canvasId: string, labels: string[], values: number[]): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas || !labels?.length) return;

    this.reportChartInstances.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Sales (R)',
          data: values,
          borderColor: '#1a237e',
          backgroundColor: 'rgba(26, 35, 126, 0.08)',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#1a237e'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10 }, maxRotation: 45 } },
          y: { ticks: { font: { size: 10 } } }
        }
      }
    }));
  }

  async downloadReportPdf(): Promise<void> {
    const element = document.getElementById('welly-report-content');
    if (!element) return;

    this.snackBar.open('Generating PDF...', '', { duration: 2000 });

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2, useCORS: true, backgroundColor: '#f5f5f7', logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight() - 20;

      // Title
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`ProMed Technologies — ${this.reportPanelTitle}`, 10, 8);
      pdf.text(`${this.reportFromDate.toLocaleDateString()} to ${this.reportToDate.toLocaleDateString()}`, 10, 13);
      let yOffset = 16;

      let remainingHeight = pdfHeight;
      while (remainingHeight > 0) {
        const sourceY = (pdfHeight - remainingHeight) * (canvas.height / pdfHeight);
        const sourceHeight = Math.min(pageHeight, remainingHeight) * (canvas.height / pdfHeight);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          pdf.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 10, yOffset, pdfWidth, Math.min(pageHeight, remainingHeight));
        }
        remainingHeight -= pageHeight;
        if (remainingHeight > 0) { pdf.addPage(); yOffset = 10; }
      }

      const filename = `${this.reportPanelTitle.replace(/\s+/g, '-')}-${this.reportFromDate.toISOString().split('T')[0]}-to-${this.reportToDate.toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      this.snackBar.open('PDF downloaded ✓', 'Close', { duration: 2000 });
    } catch (err) {
      console.error('PDF generation error:', err);
      this.snackBar.open('Failed to generate PDF.', 'Close', { duration: 3000 });
    }
  }

  copyReportResult(): void {
    navigator.clipboard.writeText(this.reportResult).then(() => {
      this.snackBar.open('Copied to clipboard ✓', 'Close', { duration: 2000 });
    });
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
      this.snackBar.open(`Access granted - select your Excel file`, 'Close', { duration: 2000 });
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
      this.snackBar.open('Please select an Excel file (.xlsx or .xls)', 'Close', { duration: 3000 });
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
        this.snackBar.open(result.message || 'Sales transactions imported successfully!', 'Close', { duration: 5000 });
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
      this.snackBar.open('Please select an Excel file (.xlsx or .xls)', 'Close', { duration: 3000 });
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

  geocodeAllCustomers(): void {
    const customers = this.customersWithoutLocation();
    if (customers.length === 0) {
      this.snackBar.open('No customers need geocoding', 'Close', { duration: 2000 });
      return;
    }

    const confirmMsg = `This will geocode ${customers.length} customers using their names/addresses.\\n\\nThis uses Google Maps API and may take a few minutes. Continue?`;
    if (!confirm(confirmMsg)) return;

    this.isGeocoding = true;
    this.geocodeProgress = `0/${customers.length}`;

    this.http.post<any>(`${this.apiUrl}/logistics/googlemaps/geocode-customers?limit=${customers.length}&updateDatabase=true`, {}).subscribe({
      next: (result) => {
        this.isGeocoding = false;
        this.geocodeProgress = '';
        
        const message = `Geocoding complete: ${result.updated} updated, ${result.failed} failed`;
        this.snackBar.open(message, 'Close', { duration: 5000 });
        
        // Reload customers to reflect changes
        this.loadCustomers();
      },
      error: (err) => {
        this.isGeocoding = false;
        this.geocodeProgress = '';
        console.error('Geocode all failed:', err);
        this.snackBar.open('Geocoding failed. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }

  geocodeCustomerFromAttention(customer: Customer): void {
    this.snackBar.open('Geocoding ' + customer.name + '...', 'Close', { duration: 2000 });
    this.http.post(`${this.apiUrl}/logistics/googlemaps/geocode-customer/${customer.id}`, {}).subscribe({
      next: () => {
        this.snackBar.open('Location set for ' + customer.name, 'Close', { duration: 3000 });
        this.loadCustomers();
      },
      error: () => {
        this.snackBar.open('Failed to geocode. Please set location manually.', 'Close', { duration: 3000 });
      }
    });
  }

  editCustomerLocation(customer: Customer): void {
    const address = prompt(
      'Enter full address to geocode:\n(e.g., "123 Main Road, Sandton, Johannesburg, Gauteng")', 
      customer.deliveryAddress || customer.address || ''
    );
    if (address === null || address.trim() === '') return;

    this.snackBar.open('Geocoding address...', 'Close', { duration: 2000 });

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
              this.snackBar.open(
                `Location set for ${customer.name}: ${result.formattedAddress || address}`, 
                'Close', 
                { duration: 4000 }
              );
              this.loadCustomers();
            },
            error: () => {
              this.snackBar.open('Failed to save location', 'Close', { duration: 3000 });
            }
          });
        } else {
          this.snackBar.open(
            'Could not find location for that address. Please try a more specific address.', 
            'Close', 
            { duration: 4000 }
          );
        }
      },
      error: () => {
        this.snackBar.open('Geocoding service unavailable. Please try again later.', 'Close', { duration: 3000 });
      }
    });
  }

  setInvoiceProvince(invoice: Invoice, province: string): void {
    this.http.put(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}/delivery`, {
      deliveryProvince: province
    }).subscribe({
      next: () => {
        this.snackBar.open('Province set to ' + province, 'Close', { duration: 2000 });
        this.loadInvoices();
      },
      error: () => {
        this.snackBar.open('Failed to update province', 'Close', { duration: 3000 });
      }
    });
  }

  bulkAssignProvince(): void {
    if (!this.bulkProvince) return;

    const invoicesToUpdate = this.invoicesWithoutProvince();
    const total = invoicesToUpdate.length;
    let completed = 0;

    this.snackBar.open(`Updating ${total} invoices...`, 'Close', { duration: 2000 });

    invoicesToUpdate.forEach(invoice => {
      this.http.put(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}/delivery`, {
        deliveryProvince: this.bulkProvince
      }).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.snackBar.open(`All ${total} invoices updated to ${this.bulkProvince}`, 'Close', { duration: 3000 });
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
        this.snackBar.open(
          `Welly found fixes for ${fixable} of ${this.wellyCustomerFixes.length} customers`,
          'Close', { duration: 4000 }
        );
      },
      error: (err) => {
        this.wellyCustomerFixLoading = false;
        console.error('Welly customer fix error:', err);
        this.snackBar.open('Welly could not analyze customers. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }

  applyWellyCustomerFixes(): void {
    const approved = this.wellyCustomerFixes.filter(f => f.approved && f.success);
    if (approved.length === 0) {
      this.snackBar.open('No fixes approved to apply', 'Close', { duration: 2000 });
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
        this.snackBar.open(
          `✅ Welly updated ${result.applied} customer locations` + (result.failed > 0 ? ` (${result.failed} failed)` : ''),
          'Close', { duration: 4000 }
        );
        this.loadCustomers();
      },
      error: () => {
        this.wellyCustomerFixApplying = false;
        this.snackBar.open('Failed to apply fixes. Please try again.', 'Close', { duration: 3000 });
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
        this.snackBar.open(
          `Welly found province data for ${fixable} of ${this.wellyInvoiceFixes.length} invoices`,
          'Close', { duration: 4000 }
        );
      },
      error: (err) => {
        this.wellyInvoiceFixLoading = false;
        console.error('Welly invoice fix error:', err);
        this.snackBar.open('Welly could not analyze invoices. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }

  applyWellyInvoiceFixes(): void {
    const approved = this.wellyInvoiceFixes.filter(f => f.approved && f.success);
    if (approved.length === 0) {
      this.snackBar.open('No fixes approved to apply', 'Close', { duration: 2000 });
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
        this.snackBar.open(
          `✅ Welly updated ${result.applied} invoice provinces` + (result.failed > 0 ? ` (${result.failed} failed)` : ''),
          'Close', { duration: 4000 }
        );
        this.loadInvoices();
      },
      error: () => {
        this.wellyInvoiceFixApplying = false;
        this.snackBar.open('Failed to apply fixes. Please try again.', 'Close', { duration: 3000 });
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
  getCompanyColor(companyCode: string): string {
    const company = this.companies.find(c => c.code === companyCode);
    return company?.color || '#666';
  }

  getCompanyShortName(companyCode: string): string {
    const company = this.companies.find(c => c.code === companyCode);
    return company?.shortName || companyCode;
  }

  getCompanyName(companyCode: string): string {
    const company = this.companies.find(c => c.code === companyCode);
    return company?.name || companyCode;
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
        this.snackBar.open('Sale captured successfully', 'Close', { duration: 3000 });
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
        this.snackBar.open('Failed to capture sale', 'Close', { duration: 3000 });
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

      this.snackBar.open(`Excel exported: ${invoices.length} invoices ✓`, 'Close', { duration: 3000 });
      this.closeExportDatePicker();
    } catch (err) {
      console.error('Excel export error:', err);
      this.snackBar.open('Failed to export Excel', 'Close', { duration: 3000 });
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

      this.snackBar.open(`PDF generated: ${invoices.length} invoices ✓`, 'Close', { duration: 3000 });
      this.closeExportDatePicker();
    } catch (err) {
      console.error('PDF generation error:', err);
      this.snackBar.open('Failed to generate PDF', 'Close', { duration: 3000 });
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

      this.snackBar.open('Comparison Excel exported ✓', 'Close', { duration: 3000 });
      this.compareExporting = false;
    } catch (err) {
      console.error('Comparison export error:', err);
      this.snackBar.open('Failed to export comparison', 'Close', { duration: 3000 });
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
        this.snackBar.open('Failed to open POD document', 'Close', { duration: 3000 });
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
        this.snackBar.open('Failed to download POD', 'Close', { duration: 3000 });
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
    const formData = new FormData();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.zip';
    fileInput.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const driverName = prompt('Enter driver name:');
      if (!driverName) return;

      const region = prompt('Enter region (GP or KZN):');
      if (!region) return;

      const dateStr = prompt('Enter delivery date (YYYY-MM-DD):');
      if (!dateStr) return;

      formData.append('file', file);
      formData.append('driverName', driverName);
      formData.append('region', region.toUpperCase());
      formData.append('deliveryDate', dateStr);

      this.http.post(`${this.apiUrl}/PodDocuments/upload`, formData).subscribe({
        next: () => {
          this.loadPodDocuments();
          this.loadPodSummary();
          this.snackBar.open('POD uploaded successfully!', 'Close', { duration: 3000 });
        },
        error: (err) => {
          console.error('Failed to upload POD:', err);
          this.snackBar.open('Failed to upload POD: ' + (err.error || 'Unknown error'), 'Close', { duration: 4000 });
        }
      });
    };
    fileInput.click();
  }

  openLinkTripsheetDialog(pod: any): void {
    const search = prompt('Enter tripsheet/load number to search:');
    if (!search) return;

    this.http.get<any[]>(`${this.apiUrl}/PodDocuments/search-loads?search=${encodeURIComponent(search)}`).subscribe({
      next: (loads) => {
        if (loads.length === 0) {
          this.snackBar.open('No matching tripsheets found', 'Close', { duration: 3000 });
          return;
        }
        const options = loads.map((l, i) => `${i + 1}. ${l.loadNumber} - ${l.customerName || 'N/A'} (${l.status})`).join('\n');
        const choice = prompt(`Select a tripsheet:\n${options}\n\nEnter number:`);
        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < loads.length) {
          this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/link`, { loadId: loads[idx].id }).subscribe({
            next: () => {
              this.loadPodDocuments();
              this.loadPodSummary();
              this.snackBar.open(`POD linked to ${loads[idx].loadNumber}`, 'Close', { duration: 3000 });
            },
            error: () => this.snackBar.open('Failed to link POD', 'Close', { duration: 3000 })
          });
        }
      },
      error: () => this.snackBar.open('Failed to search tripsheets', 'Close', { duration: 3000 })
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
    const search = prompt('Enter invoice number to search:');
    if (!search) return;

    this.http.get<any[]>(`${this.apiUrl}/PodDocuments/search-invoices?search=${encodeURIComponent(search)}`).subscribe({
      next: (invoices) => {
        if (invoices.length === 0) {
          this.snackBar.open('No matching invoices found', 'Close', { duration: 3000 });
          return;
        }
        const options = invoices.map((inv, i) => `${i + 1}. ${inv.transactionNumber} - ${inv.customerName} (${inv.status})`).join('\n');
        const choice = prompt(`Select an invoice:\n${options}\n\nEnter number:`);
        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < invoices.length) {
          this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/link-invoice`, { invoiceId: invoices[idx].id }).subscribe({
            next: () => {
              this.loadPodDocuments();
              this.loadPodSummary();
              this.snackBar.open(`POD linked to invoice ${invoices[idx].transactionNumber} → Status set to Delivered`, 'Close', { duration: 4000 });
            },
            error: () => this.snackBar.open('Failed to link POD to invoice', 'Close', { duration: 3000 })
          });
        }
      },
      error: () => this.snackBar.open('Failed to search invoices', 'Close', { duration: 3000 })
    });
  }

  delinkInvoice(pod: any): void {
    if (!confirm(`Delink this POD from invoice ${pod.invoiceNumber || ''}? The invoice status will revert to Pending.`)) return;

    this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}/delink-invoice`, {}).subscribe({
      next: () => {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.snackBar.open('POD delinked from invoice → Status reverted to Pending', 'Close', { duration: 4000 });
      },
      error: (err) => {
        console.error('Failed to delink invoice:', err);
        this.snackBar.open('Failed to delink from invoice', 'Close', { duration: 3000 });
      }
    });
  }

  openEditPodDialog(pod: any): void {
    const driverName = prompt('Driver name:', pod.driverName);
    if (driverName === null) return;

    const region = prompt('Region (GP/KZN):', pod.region);
    if (region === null) return;

    const notes = prompt('Notes:', pod.notes || '');

    this.http.put(`${this.apiUrl}/PodDocuments/${pod.id}`, {
      driverName: driverName || pod.driverName,
      region: region || pod.region,
      notes: notes
    }).subscribe({
      next: () => {
        this.loadPodDocuments();
        this.loadPodSummary();
        this.snackBar.open('POD details updated', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to update POD:', err);
        this.snackBar.open('Failed to update POD details', 'Close', { duration: 3000 });
      }
    });
  }
}

// Email Detail Dialog Component
@Component({
  selector: 'app-email-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title style="display: flex; align-items: center; gap: 8px;">
      <mat-icon>email</mat-icon>
      Email Detail
      @if (!data.isRead) {
        <mat-chip class="unread-chip">Unread</mat-chip>
      }
      @if (data.priority === 'High') {
        <mat-chip class="priority-chip">High Priority</mat-chip>
      }
    </h2>
    <mat-dialog-content style="min-width: 500px;">
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #1a237e, #3f51b5); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600;">
            {{ data.from.charAt(0).toUpperCase() }}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 16px;">{{ data.from }}</div>
            <div style="color: #666; font-size: 13px;">{{ data.fromEmail }}</div>
          </div>
          <div style="text-align: right; color: #888; font-size: 13px;">
            <div>{{ data.date | date:'dd MMM yyyy' }}</div>
            <div>{{ data.date | date:'HH:mm:ss' }}</div>
          </div>
        </div>

        <div style="background: #f5f5f5; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: 18px; margin-bottom: 4px;">{{ data.subject }}</div>
          @if (data.hasAttachments) {
            <mat-chip style="margin-top: 4px;">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px;">attach_file</mat-icon>
              Has Attachments
            </mat-chip>
          }
        </div>

        <mat-divider></mat-divider>

        <div style="margin-top: 12px;">
          <div style="display: flex; gap: 8px; margin-bottom: 6px; color: #666; font-size: 13px;">
            <strong style="min-width: 60px;">To:</strong>
            <span>{{ data.to.join(', ') || 'N/A' }}</span>
          </div>
          @if (data.cc.length > 0) {
            <div style="display: flex; gap: 8px; margin-bottom: 6px; color: #666; font-size: 13px;">
              <strong style="min-width: 60px;">Cc:</strong>
              <span>{{ data.cc.join(', ') }}</span>
            </div>
          }
          <div style="display: flex; gap: 8px; margin-bottom: 6px; color: #666; font-size: 13px;">
            <strong style="min-width: 60px;">Mailbox:</strong>
            <span>{{ data.foundInAccounts?.join(', ') || data.accountEmail }}</span>
          </div>
        </div>

        @if (data.preview) {
          <mat-divider style="margin: 12px 0;"></mat-divider>
          <div style="padding: 12px; background: #fafafa; border-radius: 8px; border-left: 3px solid #1a237e; font-size: 14px; line-height: 1.6; white-space: pre-wrap; max-height: 300px; overflow-y: auto;">
            {{ data.preview }}
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="copyEmail()">
        <mat-icon>content_copy</mat-icon> Copy Sender
      </button>
      <button mat-raised-button color="primary" mat-dialog-close>
        <mat-icon>close</mat-icon> Close
      </button>
    </mat-dialog-actions>
  `
})
export class EmailDetailDialogComponent {
  data = inject<IncomingOrderEmail>(MAT_DIALOG_DATA);
  private snackBar = inject(MatSnackBar);

  copyEmail(): void {
    navigator.clipboard.writeText(this.data.fromEmail).then(() => {
      this.snackBar.open(`Copied: ${this.data.fromEmail}`, 'Close', { duration: 2000 });
    });
  }
}
