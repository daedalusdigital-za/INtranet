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
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';

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
      <!-- Header -->
      <div class="dashboard-header">
        <div class="header-left">
          <h1><mat-icon>point_of_sale</mat-icon> Sales Dashboard</h1>
          <p class="subtitle">Manage customers, invoices, and orders</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="warn" (click)="openAttentionDialog()" 
                  [matBadge]="attentionCount()" matBadgeColor="accent"
                  [matBadgeHidden]="attentionCount() === 0" class="attention-btn">
            <mat-icon>warning</mat-icon> Attention Required
          </button>
          <button mat-raised-button color="primary" (click)="openCustomerDialog()">
            <mat-icon>person_add</mat-icon> Add Customer
          </button>
          <button mat-raised-button color="accent" (click)="openInvoiceDialog()">
            <mat-icon>receipt</mat-icon> Capture Invoice
          </button>
          <button mat-stroked-button (click)="syncFromERP()">
            <mat-icon>sync</mat-icon> Sync from ERP
          </button>
        </div>
      </div>

      <!-- Company Sales Comparison - Yesterday vs Today -->
      <div class="company-sales-section">
        <h3 class="section-title"><mat-icon>business</mat-icon> Company Sales: Yesterday vs Today</h3>
        <div class="company-cards-grid">
          @for (cs of companySalesData(); track cs.company.code) {
            <mat-card class="company-card clickable" [style.border-left-color]="cs.company.color" (click)="openCompanySalesDialog(cs.company)">
              <mat-card-content>
                <div class="company-header">
                  <span class="company-name" [style.color]="cs.company.color">{{ cs.company.shortName }}</span>
                  <mat-chip [class]="cs.percentChange >= 0 ? 'up' : 'down'">
                    <mat-icon>{{ cs.percentChange >= 0 ? 'trending_up' : 'trending_down' }}</mat-icon>
                    {{ cs.percentChange >= 0 ? '+' : '' }}{{ cs.percentChange | number:'1.0-0' }}%
                  </mat-chip>
                </div>
                <div class="company-sales-row">
                  <div class="sales-item yesterday">
                    <span class="day-label">Yesterday</span>
                    <span class="day-value">R{{ formatCurrency(cs.yesterdaySales) }}</span>
                    <span class="day-orders">{{ cs.yesterdayOrders }} orders</span>
                  </div>
                  <mat-icon class="vs-icon">arrow_forward</mat-icon>
                  <div class="sales-item today">
                    <span class="day-label">Today</span>
                    <span class="day-value">R{{ formatCurrency(cs.todaySales) }}</span>
                    <span class="day-orders">{{ cs.todayOrders }} orders</span>
                  </div>
                </div>
                <div class="card-hint">
                  <mat-icon>touch_app</mat-icon> Click for details
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid">
        <mat-card class="stat-card customers">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>people</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().totalCustomers }}</span>
              <span class="stat-label">Total Customers</span>
              <span class="stat-sub">{{ stats().activeCustomers }} active</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card invoices">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().totalInvoices }}</span>
              <span class="stat-label">Total Invoices</span>
              <span class="stat-sub">{{ stats().pendingInvoices }} pending</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card revenue">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>trending_up</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">R{{ formatCurrency(stats().monthlyRevenue) }}</span>
              <span class="stat-label">Monthly Revenue</span>
              <span class="stat-sub">Total: R{{ formatCurrency(stats().totalRevenue) }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card orders">
          <mat-card-content>
            <div class="stat-icon">
              <mat-icon>shopping_cart</mat-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ stats().incomingOrders }}</span>
              <span class="stat-label">Incoming Orders</span>
              <span class="stat-sub">{{ stats().processingOrders }} processing</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Main Content Tabs -->
      <mat-card class="main-content">
        <mat-tab-group animationDuration="200ms" [(selectedIndex)]="selectedTab">
          <!-- Incoming Orders Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>inbox</mat-icon>
              <span>Incoming Orders</span>
              @if (stats().incomingOrders > 0) {
                <span class="tab-badge">{{ stats().incomingOrders }}</span>
              }
            </ng-template>
            <div class="tab-content">
              <div class="section-header">
                <h3>Incoming Orders</h3>
                <div class="section-actions">
                  <mat-form-field appearance="outline" class="search-field">
                    <mat-label>Search orders</mat-label>
                    <input matInput [value]="orderSearch()" (input)="orderSearch.set($any($event.target).value)">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Status</mat-label>
                    <mat-select [value]="orderStatusFilter()" (selectionChange)="orderStatusFilter.set($event.value)">
                      <mat-option value="all">All Status</mat-option>
                      <mat-option value="New">New</mat-option>
                      <mat-option value="Processing">Processing</mat-option>
                      <mat-option value="Ready">Ready</mat-option>
                      <mat-option value="Shipped">Shipped</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-icon-button (click)="loadOrders()" matTooltip="Refresh">
                    <mat-icon>refresh</mat-icon>
                  </button>
                </div>
              </div>

              @if (loadingOrders()) {
                <div class="loading-container">
                  <mat-spinner diameter="40"></mat-spinner>
                </div>
              } @else if (filteredOrders().length === 0) {
                <div class="empty-state">
                  <mat-icon>inbox</mat-icon>
                  <h3>No Orders Found</h3>
                  <p>No incoming orders match your criteria</p>
                </div>
              } @else {
                <div class="orders-grid">
                  @for (order of filteredOrders(); track order.id) {
                    <mat-card class="order-card" [class]="'priority-' + order.priority.toLowerCase()">
                      <mat-card-header>
                        <div class="order-header">
                          <div class="order-number">
                            <strong>{{ order.orderNumber }}</strong>
                            <span class="order-date">{{ order.orderDate | date:'dd MMM yyyy' }}</span>
                          </div>
                          <mat-chip [class]="'status-' + order.status.toLowerCase()">
                            {{ order.status }}
                          </mat-chip>
                        </div>
                      </mat-card-header>
                      <mat-card-content>
                        <div class="order-customer">
                          <mat-icon>person</mat-icon>
                          <span>{{ order.customerName }}</span>
                        </div>
                        <div class="order-details">
                          <div class="detail-item">
                            <span class="label">Items</span>
                            <span class="value">{{ order.items }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">Total</span>
                            <span class="value amount">R{{ order.totalAmount | number:'1.2-2' }}</span>
                          </div>
                          <div class="detail-item">
                            <span class="label">Priority</span>
                            <mat-chip [class]="'priority-chip-' + order.priority.toLowerCase()" size="small">
                              {{ order.priority }}
                            </mat-chip>
                          </div>
                        </div>
                        @if (order.notes) {
                          <div class="order-notes">
                            <mat-icon>notes</mat-icon>
                            <span>{{ order.notes }}</span>
                          </div>
                        }
                      </mat-card-content>
                      <mat-card-actions>
                        <button mat-button color="primary" (click)="processOrder(order)">
                          <mat-icon>play_arrow</mat-icon> Process
                        </button>
                        <button mat-button (click)="viewOrderDetails(order)">
                          <mat-icon>visibility</mat-icon> View
                        </button>
                        <button mat-icon-button [matMenuTriggerFor]="orderMenu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #orderMenu="matMenu">
                          <button mat-menu-item (click)="createInvoiceFromOrder(order)">
                            <mat-icon>receipt</mat-icon> Create Invoice
                          </button>
                          <button mat-menu-item (click)="assignToLogistics(order)">
                            <mat-icon>local_shipping</mat-icon> Send to Logistics
                          </button>
                          <mat-divider></mat-divider>
                          <button mat-menu-item class="cancel-btn" (click)="cancelOrder(order)">
                            <mat-icon>cancel</mat-icon> Cancel Order
                          </button>
                        </mat-menu>
                      </mat-card-actions>
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
                    <input matInput [value]="customerSearch()" (input)="customerSearch.set($any($event.target).value)">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Province</mat-label>
                    <mat-select [value]="customerProvinceFilter()" (selectionChange)="customerProvinceFilter.set($event.value)">
                      <mat-option value="all">All Provinces</mat-option>
                      @for (province of provinces; track province) {
                        <mat-option [value]="province">{{ province }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <button mat-raised-button color="primary" (click)="openCustomerDialog()">
                    <mat-icon>add</mat-icon> Add Customer
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
                <mat-paginator [length]="customers().length"
                               [pageSize]="10"
                               [pageSizeOptions]="[5, 10, 25, 50]"
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
                    <input matInput [value]="invoiceSearch()" (input)="invoiceSearch.set($any($event.target).value)">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Status</mat-label>
                    <mat-select [value]="invoiceStatusFilter()" (selectionChange)="invoiceStatusFilter.set($event.value)">
                      <mat-option value="all">All Status</mat-option>
                      <mat-option value="Pending">Pending</mat-option>
                      <mat-option value="Assigned">Assigned</mat-option>
                      <mat-option value="Delivered">Delivered</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <button mat-raised-button color="accent" (click)="openInvoiceDialog()">
                    <mat-icon>add</mat-icon> Capture Invoice
                  </button>
                  <button mat-stroked-button (click)="importInvoices()">
                    <mat-icon>upload</mat-icon> Import
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
                      <th mat-header-cell *matHeaderCellDef>Amount</th>
                      <td mat-cell *matCellDef="let inv">
                        <div class="amount-cell">
                          <span class="sales">R{{ inv.salesAmount | number:'1.2-2' }}</span>
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
                        <button mat-icon-button matTooltip="Send to Logistics" (click)="sendToLogistics(inv)">
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
                <mat-paginator [length]="invoices().length"
                               [pageSize]="15"
                               [pageSizeOptions]="[10, 15, 25, 50]"
                               showFirstLastButtons>
                </mat-paginator>
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
                <mat-card class="report-card" (click)="runReport('sales-summary')">
                  <mat-card-content>
                    <mat-icon>summarize</mat-icon>
                    <h4>Sales Summary</h4>
                    <p>Overview of sales performance</p>
                  </mat-card-content>
                </mat-card>

                <mat-card class="report-card" (click)="runReport('customer-analysis')">
                  <mat-card-content>
                    <mat-icon>analytics</mat-icon>
                    <h4>Customer Analysis</h4>
                    <p>Top customers and trends</p>
                  </mat-card-content>
                </mat-card>

                <mat-card class="report-card" (click)="runReport('province-breakdown')">
                  <mat-card-content>
                    <mat-icon>map</mat-icon>
                    <h4>Province Breakdown</h4>
                    <p>Sales by geographic region</p>
                  </mat-card-content>
                </mat-card>

                <mat-card class="report-card" (click)="runReport('product-performance')">
                  <mat-card-content>
                    <mat-icon>inventory_2</mat-icon>
                    <h4>Product Performance</h4>
                    <p>Best and worst sellers</p>
                  </mat-card-content>
                </mat-card>
              </div>
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
                  @if (customersWithoutLocation().length === 0) {
                    <div class="empty-state">
                      <mat-icon>check_circle</mat-icon>
                      <h3>All Good!</h3>
                      <p>All customers have location data set.</p>
                    </div>
                  } @else {
                    <p class="attention-desc">These customers don't have GPS coordinates set. Click to edit and add location.</p>
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
                  @if (invoicesWithoutProvince().length === 0) {
                    <div class="empty-state">
                      <mat-icon>check_circle</mat-icon>
                      <h3>All Good!</h3>
                      <p>All invoices have delivery province set.</p>
                    </div>
                  } @else {
                    <p class="attention-desc">These invoices don't have a delivery province set. Select a province to assign.</p>
                    <div class="attention-list">
                      @for (invoice of invoicesWithoutProvince(); track invoice.id) {
                        <div class="attention-item">
                          <div class="attention-item-info">
                            <strong>{{ invoice.transactionNumber }}</strong>
                            <span class="customer">{{ invoice.customerName }}</span>
                            <span class="amount">R{{ invoice.salesAmount | number:'1.2-2' }}</span>
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
                  <button mat-raised-button color="primary" (click)="toggleNewSaleForm()">
                    <mat-icon>add</mat-icon> Capture Sale
                  </button>
                </div>

                <!-- New Sale Form -->
                @if (newSaleFormVisible) {
                  <div class="new-sale-form">
                    <h4>Capture New Sale for {{ selectedCompanyForDialog.shortName }}</h4>
                    <div class="form-row">
                      <mat-form-field>
                        <mat-label>Transaction Number</mat-label>
                        <input matInput [(ngModel)]="newSaleForm.transactionNumber" placeholder="INV-001">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Customer Name</mat-label>
                        <input matInput [(ngModel)]="newSaleForm.customerName" placeholder="Customer name">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Date</mat-label>
                        <input matInput [matDatepicker]="salePicker" [(ngModel)]="newSaleForm.transactionDate">
                        <mat-datepicker-toggle matIconSuffix [for]="salePicker"></mat-datepicker-toggle>
                        <mat-datepicker #salePicker></mat-datepicker>
                      </mat-form-field>
                    </div>
                    <div class="form-row">
                      <mat-form-field class="wide">
                        <mat-label>Product/Description</mat-label>
                        <input matInput [(ngModel)]="newSaleForm.productDescription" placeholder="Product description">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Quantity</mat-label>
                        <input matInput type="number" [(ngModel)]="newSaleForm.quantity" min="1">
                      </mat-form-field>
                      <mat-form-field>
                        <mat-label>Sales Amount (R)</mat-label>
                        <input matInput type="number" [(ngModel)]="newSaleForm.salesAmount" min="0" step="0.01">
                      </mat-form-field>
                    </div>
                    <div class="form-actions">
                      <button mat-button (click)="toggleNewSaleForm()">Cancel</button>
                      <button mat-raised-button color="primary" (click)="saveSale()" [disabled]="!newSaleForm.customerName || !newSaleForm.salesAmount">
                        <mat-icon>save</mat-icon> Save Sale
                      </button>
                    </div>
                  </div>
                }

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
                      <th mat-header-cell *matHeaderCellDef>Amount</th>
                      <td mat-cell *matCellDef="let row" class="amount-cell">R{{ row.salesAmount | number:'1.2-2' }}</td>
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
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      min-height: 100vh;
    }

    .sales-dashboard {
      padding: 24px;
      padding-top: 88px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      min-height: calc(100vh - 64px);
      max-width: 1600px;
      margin: 0 auto;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }

    .header-left h1 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #ffffff;
      font-size: 28px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .header-left h1 mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .subtitle {
      margin: 4px 0 0 44px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    /* Company Sales Section */
    .company-sales-section {
      margin-bottom: 24px;
    }

    .company-sales-section .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ffffff;
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 16px;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
    }

    .company-sales-section .section-title mat-icon {
      color: rgba(255, 255, 255, 0.9);
    }

    .company-cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .company-card {
      border-radius: 12px;
      border-left: 4px solid #ccc;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .company-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    .company-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .company-name {
      font-size: 15px;
      font-weight: 600;
    }

    .company-header mat-chip {
      font-size: 11px;
      min-height: 24px;
      padding: 0 8px;
    }

    .company-header mat-chip.up {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
    }

    .company-header mat-chip.down {
      background: #ffebee !important;
      color: #c62828 !important;
    }

    .company-header mat-chip mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      margin-right: 4px;
    }

    .company-sales-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .sales-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }

    .sales-item .day-label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
    }

    .sales-item .day-value {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .sales-item .day-orders {
      font-size: 11px;
      color: #666;
    }

    .sales-item.yesterday .day-value {
      color: #888;
    }

    .sales-item.today .day-value {
      color: #1a237e;
    }

    .vs-icon {
      color: #ccc;
      font-size: 20px;
    }

    .company-chip {
      color: white !important;
      font-size: 11px !important;
      font-weight: 500 !important;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }

    .stat-card {
      border-radius: 16px;
      overflow: hidden;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-card.customers .stat-icon { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .stat-card.invoices .stat-icon { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .stat-card.revenue .stat-icon { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .stat-card.orders .stat-icon { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #1a237e;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 2px;
    }

    .stat-sub {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }

    /* Main Content */
    .main-content {
      border-radius: 16px;
      overflow: hidden;
    }

    .tab-content {
      padding: 24px;
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
      font-size: 20px;
      font-weight: 600;
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
      border-radius: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
      border-left: 4px solid #ccc;
    }

    .order-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
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

    /* Tables */
    .table-container {
      overflow-x: auto;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .customers-table,
    .invoices-table {
      width: 100%;
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

    tr.mat-mdc-row:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    tr.mat-mdc-row.selected {
      background: rgba(26, 35, 126, 0.08);
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
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .report-card {
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .report-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    }

    .report-card mat-card-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 24px;
    }

    .report-card mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1a237e;
      margin-bottom: 12px;
    }

    .report-card h4 {
      margin: 0 0 8px 0;
      color: #1a237e;
    }

    .report-card p {
      margin: 0;
      font-size: 12px;
      color: #666;
    }

    /* Customer Sidebar */
    .customer-sidebar {
      position: fixed;
      right: 0;
      top: 64px;
      width: 360px;
      height: calc(100vh - 64px);
      background: white;
      box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
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
      padding: 60px;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #333;
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
      border-radius: 16px;
      width: 90%;
      max-width: 900px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
      background: #f5f5f5;
      border-radius: 8px;
      gap: 16px;
    }

    .attention-item:hover {
      background: #eeeeee;
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

    /* Responsive */
    @media (max-width: 1200px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .company-cards-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .sales-dashboard {
        padding: 16px;
      }

      .dashboard-header {
        flex-direction: column;
        gap: 16px;
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
      border-radius: 16px;
      width: 95%;
      max-width: 1200px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
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
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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

    .table-container {
      overflow-x: auto;
    }

    .sales-table {
      width: 100%;
    }

    .sales-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }

    .sales-table td {
      padding: 12px 16px;
    }

    .amount-cell {
      font-weight: 600;
      color: #1a237e;
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

  // Filter signals
  customerSearch = signal('');
  customerProvinceFilter = signal('all');
  invoiceSearch = signal('');
  invoiceStatusFilter = signal('all');
  orderSearch = signal('');
  orderStatusFilter = signal('all');

  // Selected items
  selectedCustomer = signal<Customer | null>(null);
  showCustomerSidebar = false;

  // Attention dialog
  showAttentionDialog = false;
  attentionTabIndex = 0;
  bulkProvince = '';

  // Company Sales Dialog
  showCompanySalesDialog = false;
  selectedCompanyForDialog: Company | null = null;
  companySalesHistoryData: any[] = [];
  companySalesTableData: any[] = [];
  companySalesLoading = false;
  companySalesDateRange: 'week' | 'month' | 'quarter' = 'week';
  newSaleFormVisible = false;
  newSaleForm = {
    transactionNumber: '',
    customerName: '',
    productDescription: '',
    quantity: 1,
    salesAmount: 0,
    transactionDate: new Date()
  };

  // Report dates
  reportFromDate: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  reportToDate: Date = new Date();

  // Table columns
  customerColumns = ['customerCode', 'name', 'contact', 'location', 'status', 'actions'];
  invoiceColumns = ['transactionNumber', 'date', 'customer', 'product', 'amount', 'province', 'source', 'status', 'actions'];

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

  // Computed filtered lists
  filteredCustomers = computed(() => {
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

  filteredInvoices = computed(() => {
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

  // Attention computed values
  customersWithoutLocation = computed(() => {
    return this.customers().filter(c => !c.latitude || !c.longitude);
  });

  invoicesWithoutProvince = computed(() => {
    return this.invoices().filter(i => !i.deliveryProvince || i.deliveryProvince.trim() === '');
  });

  attentionCount = computed(() => {
    return this.customersWithoutLocation().length + this.invoicesWithoutProvince().length;
  });

  // Company sales comparison - Yesterday vs Today
  companySalesData = computed(() => {
    const invoices = this.invoices();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return this.companies.map(company => {
      const companyInvoices = invoices.filter(i => 
        i.sourceCompany === company.code || 
        i.sourceSystem?.toLowerCase().includes(company.shortName.toLowerCase())
      );

      const todayInvoices = companyInvoices.filter(i => {
        const date = new Date(i.transactionDate);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === today.getTime();
      });

      const yesterdayInvoices = companyInvoices.filter(i => {
        const date = new Date(i.transactionDate);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === yesterday.getTime();
      });

      const todaySales = todayInvoices.reduce((sum, i) => sum + (i.salesAmount || 0), 0);
      const yesterdaySales = yesterdayInvoices.reduce((sum, i) => sum + (i.salesAmount || 0), 0);

      const percentChange = yesterdaySales > 0 
        ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 
        : todaySales > 0 ? 100 : 0;

      return {
        company,
        todaySales,
        yesterdaySales,
        todayOrders: todayInvoices.length,
        yesterdayOrders: yesterdayInvoices.length,
        percentChange
      } as CompanySales;
    });
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.loadCustomers();
    this.loadInvoices();
    this.loadOrders();
    this.loadStats();
  }

  loadCustomers(): void {
    this.loadingCustomers.set(true);
    this.http.get<Customer[]>(`${this.apiUrl}/logistics/customers?pageSize=500`).subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.loadingCustomers.set(false);
      },
      error: (err) => {
        console.error('Failed to load customers:', err);
        this.loadingCustomers.set(false);
        this.snackBar.open('Failed to load customers', 'Close', { duration: 3000 });
      }
    });
  }

  loadInvoices(): void {
    this.loadingInvoices.set(true);
    this.http.get<Invoice[]>(`${this.apiUrl}/logistics/importedinvoices?pageSize=1000`).subscribe({
      next: (invoices) => {
        this.invoices.set(invoices);
        this.loadingInvoices.set(false);
      },
      error: (err) => {
        console.error('Failed to load invoices:', err);
        this.loadingInvoices.set(false);
        this.snackBar.open('Failed to load invoices', 'Close', { duration: 3000 });
      }
    });
  }

  loadOrders(): void {
    this.loadingOrders.set(true);
    // Simulate orders data - in production, this would come from an API
    const mockOrders: Order[] = [
      { id: 1, orderNumber: 'ORD-2026-001', customerName: 'ABC Medical', customerId: 1, orderDate: new Date(), totalAmount: 15450.00, status: 'New', priority: 'High', items: 5, notes: 'Urgent delivery required' },
      { id: 2, orderNumber: 'ORD-2026-002', customerName: 'XYZ Healthcare', customerId: 2, orderDate: new Date(), totalAmount: 8750.00, status: 'Processing', priority: 'Medium', items: 3 },
      { id: 3, orderNumber: 'ORD-2026-003', customerName: 'City Hospital', customerId: 3, orderDate: new Date(), totalAmount: 32000.00, status: 'New', priority: 'High', items: 12 },
      { id: 4, orderNumber: 'ORD-2026-004', customerName: 'Rural Clinic', customerId: 4, orderDate: new Date(), totalAmount: 5200.00, status: 'Ready', priority: 'Low', items: 2 },
    ];
    
    setTimeout(() => {
      this.orders.set(mockOrders);
      this.loadingOrders.set(false);
    }, 500);
  }

  loadStats(): void {
    // Calculate stats from loaded data
    const customers = this.customers();
    const invoices = this.invoices();
    const orders = this.orders();

    this.stats.set({
      totalCustomers: customers.length,
      activeCustomers: customers.filter(c => c.status === 'Active').length,
      totalInvoices: invoices.length,
      pendingInvoices: invoices.filter(i => i.status === 'Pending').length,
      totalRevenue: invoices.reduce((sum, i) => sum + (i.salesAmount || 0), 0),
      monthlyRevenue: invoices
        .filter(i => new Date(i.transactionDate).getMonth() === new Date().getMonth())
        .reduce((sum, i) => sum + (i.salesAmount || 0), 0),
      incomingOrders: orders.filter(o => o.status === 'New').length,
      processingOrders: orders.filter(o => o.status === 'Processing').length
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
    this.snackBar.open('Edit invoice: ' + invoice.transactionNumber, 'Close', { duration: 2000 });
  }

  sendToLogistics(invoice: Invoice): void {
    this.snackBar.open('Sending to logistics...', 'Close', { duration: 2000 });
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

  cancelOrder(order: Order): void {
    if (confirm(`Are you sure you want to cancel order ${order.orderNumber}?`)) {
      this.snackBar.open('Order cancelled', 'Close', { duration: 3000 });
    }
  }

  // Report methods
  generateReport(): void {
    this.snackBar.open('Generating report...', 'Close', { duration: 2000 });
  }

  runReport(reportType: string): void {
    this.snackBar.open('Running ' + reportType + ' report...', 'Close', { duration: 2000 });
  }

  // Sync methods
  syncFromERP(): void {
    this.snackBar.open('Syncing from ERP...', 'Close', { duration: 2000 });
    // This would trigger an ERP sync
    this.http.post(`${this.apiUrl}/logistics/importedinvoices/sync`, {}).subscribe({
      next: () => {
        this.snackBar.open('Sync completed', 'Close', { duration: 3000 });
        this.loadDashboardData();
      },
      error: () => {
        this.snackBar.open('Sync failed', 'Close', { duration: 3000 });
      }
    });
  }

  // Attention dialog methods
  openAttentionDialog(): void {
    this.showAttentionDialog = true;
    this.bulkProvince = '';
  }

  closeAttentionDialog(): void {
    this.showAttentionDialog = false;
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
    this.http.put(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}`, {
      ...invoice,
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
      this.http.put(`${this.apiUrl}/logistics/importedinvoices/${invoice.id}`, {
        ...invoice,
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
    
    // Number of business days to show based on selection
    const businessDays = this.companySalesDateRange === 'week' ? 5 : 
                         this.companySalesDateRange === 'month' ? 22 : 66;
    
    const historyData: { date: string; label: string; total: number; count: number }[] = [];
    const today = new Date();
    let daysCollected = 0;
    let daysBack = 0;
    
    // Go back until we have enough business days (Mon-Fri only)
    while (daysCollected < businessDays && daysBack < 120) {
      const date = new Date(today);
      date.setDate(date.getDate() - daysBack);
      const dayOfWeek = date.getDay();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = date.toISOString().split('T')[0];
        
        const dayInvoices = invoices.filter(inv => {
          const invDate = new Date(inv.transactionDate).toISOString().split('T')[0];
          return invDate === dateStr;
        });
        
        const label = businessDays <= 5 ? 
          date.toLocaleDateString('en-ZA', { weekday: 'short' }) :
          date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
        
        historyData.unshift({
          date: date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }),
          label: label,
          total: dayInvoices.reduce((sum, inv) => sum + (inv.salesAmount || 0), 0),
          count: dayInvoices.length
        });
        
        daysCollected++;
      }
      daysBack++;
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
}
