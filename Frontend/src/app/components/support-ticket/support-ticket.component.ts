import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

interface SupportTicket {
  id: number;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'Closed';
  submittedBy: string;
  submittedDate: Date;
  closedDate?: Date;
  category: string;
}

@Component({
  selector: 'app-support-ticket',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule
  ],
  template: `
    <mat-toolbar color="primary">
      <span style="font-size: 20px; font-weight: 600;">Promed Intranet</span>
      <span style="margin: 0 32px;"></span>

      <button mat-button routerLink="/dashboard">
        <mat-icon>home</mat-icon> Home
      </button>
      <button mat-button routerLink="/crm">
        <mat-icon>people_outline</mat-icon> CRM
      </button>
      <button mat-button routerLink="/departments">
        <mat-icon>business</mat-icon> Project Management
      </button>
      <button mat-button routerLink="/people">
        <mat-icon>people</mat-icon> Human Resource
      </button>
      <button mat-button routerLink="/stock-management">
        <mat-icon>inventory</mat-icon> Stock Management
      </button>
      <button mat-button routerLink="/documents">
        <mat-icon>folder</mat-icon> Documents
      </button>
      <button mat-button routerLink="/support-ticket">
        <mat-icon>support_agent</mat-icon> Support Ticket
      </button>

      <span class="spacer"></span>

      <button mat-icon-button>
        <mat-icon>search</mat-icon>
      </button>

      <span style="margin-right: 16px;">{{ currentUser?.name }} ({{ currentUser?.role }})</span>
      <button mat-icon-button (click)="logout()">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <div class="support-container">
      <div class="header-section">
        <div class="header-left">
          <h1>
            <mat-icon>support_agent</mat-icon>
            Support Ticket System
          </h1>
          <p class="subtitle">Submit and track your support requests</p>
        </div>
        <div class="header-right">
          <mat-form-field appearance="outline" class="date-filter">
            <mat-label>Time Period</mat-label>
            <mat-select [(value)]="selectedDateRange" (selectionChange)="onDateRangeChange()">
              <mat-option value="today">Today</mat-option>
              <mat-option value="7days">Last 7 Days</mat-option>
              <mat-option value="30days">Last 30 Days</mat-option>
              <mat-option value="90days">Last 90 Days</mat-option>
            </mat-select>
            <mat-icon matPrefix>date_range</mat-icon>
          </mat-form-field>
          <button mat-raised-button color="primary" class="create-ticket-btn" (click)="openCreateTicketDialog()">
            <mat-icon>add</mat-icon>
            Create New Ticket
          </button>
        </div>
      </div>

      <!-- Statistics Cards -->
      <div class="stats-grid">
        <mat-card class="stat-card">
          <div class="stat-icon-container blue">
            <mat-icon>confirmation_number</mat-icon>
          </div>
          <div class="stat-content">
            <h3>Total Tickets</h3>
            <p class="stat-value">{{ totalTickets }}</p>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon-container green">
            <mat-icon>schedule</mat-icon>
          </div>
          <div class="stat-content">
            <h3>Response Time</h3>
            <p class="stat-value">{{ averageResponseTime }}</p>
          </div>
        </mat-card>

        <mat-card class="stat-card">
          <div class="stat-icon-container purple">
            <mat-icon>task_alt</mat-icon>
          </div>
          <div class="stat-content">
            <h3>Resolution Rate</h3>
            <p class="stat-value">{{ resolutionRate }}%</p>
          </div>
        </mat-card>
      </div>

      <!-- Tickets Row: Open and Closed Side by Side -->
      <div class="tickets-row">
        <!-- Open Tickets Section -->
        <mat-card class="tickets-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>folder_open</mat-icon>
              Open Tickets
              <span class="ticket-count">({{ openTickets.length }})</span>
            </mat-card-title>
          </mat-card-header>
          <mat-divider></mat-divider>
          <mat-card-content>
            @if (openTickets.length === 0) {
              <div class="empty-state">
                <mat-icon>check_circle</mat-icon>
                <p>No open tickets at the moment</p>
              </div>
            } @else {
              <div class="tickets-list">
                @for (ticket of openTickets; track ticket.id) {
                  <div class="ticket-item">
                    <div class="ticket-header">
                      <div class="ticket-title-section">
                        <h4>{{ ticket.title }}</h4>
                        <span class="ticket-id">#{{ ticket.id }}</span>
                      </div>
                      <mat-chip [class]="'priority-' + ticket.priority.toLowerCase()">
                        {{ ticket.priority }}
                      </mat-chip>
                    </div>
                    <p class="ticket-description">{{ ticket.description }}</p>
                    <div class="ticket-meta">
                      <span><mat-icon>person</mat-icon>{{ ticket.submittedBy }}</span>
                      <span><mat-icon>calendar_today</mat-icon>{{ ticket.submittedDate | date: 'MMM dd, yyyy' }}</span>
                      <span><mat-icon>category</mat-icon>{{ ticket.category }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Closed Tickets Section -->
        <mat-card class="tickets-card">
          <mat-card-header>
            <mat-card-title>
              <mat-icon>check_circle</mat-icon>
              Closed Tickets
              <span class="ticket-count">({{ closedTickets.length }})</span>
            </mat-card-title>
          </mat-card-header>
          <mat-divider></mat-divider>
          <mat-card-content>
            @if (closedTickets.length === 0) {
              <div class="empty-state">
                <mat-icon>inbox</mat-icon>
                <p>No closed tickets yet</p>
              </div>
            } @else {
              <div class="tickets-list">
                @for (ticket of closedTickets; track ticket.id) {
                  <div class="ticket-item closed">
                    <div class="ticket-header">
                      <div class="ticket-title-section">
                        <h4>{{ ticket.title }}</h4>
                        <span class="ticket-id">#{{ ticket.id }}</span>
                      </div>
                      <mat-chip class="status-closed">Resolved</mat-chip>
                    </div>
                    <p class="ticket-description">{{ ticket.description }}</p>
                    <div class="ticket-meta">
                      <span><mat-icon>person</mat-icon>{{ ticket.submittedBy }}</span>
                      <span><mat-icon>calendar_today</mat-icon>{{ ticket.submittedDate | date: 'MMM dd, yyyy' }}</span>
                      <span><mat-icon>event_available</mat-icon>Closed: {{ ticket.closedDate | date: 'MMM dd, yyyy' }}</span>
                    </div>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .support-container {
      padding: 24px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .header-section {
      margin-bottom: 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
    }

    .header-left {
      flex: 1;
      text-align: left;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .date-filter {
      min-width: 200px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      padding: 0;
    }

    .date-filter ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      min-height: 40px !important;
    }

    .date-filter ::ng-deep .mat-mdc-text-field-wrapper {
      padding: 0 8px !important;
    }

    .date-filter ::ng-deep .mdc-notched-outline {
      display: none !important;
    }

    h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      margin: 0 0 8px 0;
      font-size: 36px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    h1 mat-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      margin: 0 0 20px 0;
    }

    .create-ticket-btn {
      padding: 12px 32px !important;
      font-size: 16px !important;
      font-weight: 500 !important;
      box-shadow: 0 4px 12px rgba(0, 0, 139, 0.3) !important;
      transition: all 0.3s ease !important;
    }

    .create-ticket-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 139, 0.4) !important;
    }

    .create-ticket-btn mat-icon {
      margin-right: 8px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      margin-bottom: 32px;
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 24px !important;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
      transition: transform 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-4px);
    }

    .stat-icon-container {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-icon-container.blue {
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
    }

    .stat-icon-container.green {
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    }

    .stat-icon-container.purple {
      background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
    }

    .stat-icon-container mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    .stat-content h3 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 500;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-value {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      color: #00008B;
    }

    .tickets-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
      max-width: 1400px;
      margin-left: auto;
      margin-right: auto;
    }

    @media (max-width: 1024px) {
      .tickets-row {
        grid-template-columns: 1fr;
      }
    }

    .tickets-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
      height: fit-content;
    }

    .tickets-card mat-card-header {
      padding: 24px 24px 16px 24px;
    }

    .tickets-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 24px;
      font-weight: 600;
      color: #00008B;
    }

    .tickets-card mat-card-title mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .ticket-count {
      font-size: 18px;
      color: #666;
      font-weight: 400;
    }

    .tickets-card mat-card-content {
      padding: 24px !important;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state p {
      font-size: 16px;
      margin: 0;
    }

    .tickets-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .ticket-item {
      padding: 20px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      background: white;
      transition: all 0.3s ease;
    }

    .ticket-item:hover {
      border-color: #00008B;
      box-shadow: 0 4px 12px rgba(0, 0, 139, 0.1);
    }

    .ticket-item.closed {
      opacity: 0.8;
      background: #f9fafb;
    }

    .ticket-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      gap: 16px;
    }

    .ticket-title-section {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .ticket-item h4 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1f2937;
    }

    .ticket-id {
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
    }

    .ticket-description {
      color: #4b5563;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 16px 0;
    }

    .ticket-meta {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .ticket-meta span {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #6b7280;
    }

    .ticket-meta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #9ca3af;
    }

    mat-chip {
      font-weight: 500 !important;
      border-radius: 8px !important;
    }

    .priority-low {
      background-color: #d1fae5 !important;
      color: #065f46 !important;
    }

    .priority-medium {
      background-color: #fef3c7 !important;
      color: #92400e !important;
    }

    .priority-high {
      background-color: #fee2e2 !important;
      color: #991b1b !important;
    }

    .priority-critical {
      background-color: #fecaca !important;
      color: #7f1d1d !important;
      font-weight: 600 !important;
    }

    .status-closed {
      background-color: #e0e7ff !important;
      color: #3730a3 !important;
    }

    .spacer {
      flex: 1 1 auto;
    }
  `]
})
export class SupportTicketComponent implements OnInit {
  currentUser: any;

  // Statistics
  totalTickets: number = 0;
  averageResponseTime: string = '2.5 hrs';
  resolutionRate: number = 0;

  // Date filter
  selectedDateRange: string = 'today';

  // All tickets storage
  allOpenTickets: SupportTicket[] = [];
  allClosedTickets: SupportTicket[] = [];

  // Filtered tickets for display
  openTickets: SupportTicket[] = [];
  closedTickets: SupportTicket[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.currentUser = this.authService.currentUserValue;
    this.initializeSampleData();
  }

  ngOnInit(): void {
    this.filterTicketsByDateRange();
    this.calculateStatistics();
    console.log('Support Ticket Component initialized');
  }

  initializeSampleData(): void {
    this.allOpenTickets = [
    {
      id: 1001,
      title: 'Email System Not Working',
      description: 'Unable to send or receive emails since this morning. Getting connection timeout errors.',
      priority: 'High',
      status: 'Open',
      submittedBy: 'John Smith',
      submittedDate: new Date('2025-11-04'),
      category: 'IT Support'
    },
    {
      id: 1002,
      title: 'Request for New Software License',
      description: 'Need Adobe Creative Cloud license for marketing team member.',
      priority: 'Medium',
      status: 'Open',
      submittedBy: 'Sarah Johnson',
      submittedDate: new Date('2025-11-03'),
      category: 'Software'
    },
    {
      id: 1003,
      title: 'Printer Offline in Conference Room',
      description: 'The main conference room printer is showing offline status and not responding.',
      priority: 'Low',
      status: 'Open',
      submittedBy: 'Michael Brown',
      submittedDate: new Date('2025-11-02'),
      category: 'Hardware'
    }
  ];

    this.allClosedTickets = [
    {
      id: 998,
      title: 'Password Reset Request',
      description: 'Locked out of account after multiple failed login attempts.',
      priority: 'High',
      status: 'Closed',
      submittedBy: 'Emily Davis',
      submittedDate: new Date('2025-11-01'),
      closedDate: new Date('2025-11-01'),
      category: 'Account'
    },
    {
      id: 999,
      title: 'VPN Connection Issues',
      description: 'Cannot connect to company VPN from home network.',
      priority: 'Medium',
      status: 'Closed',
      submittedBy: 'David Wilson',
      submittedDate: new Date('2025-10-30'),
      closedDate: new Date('2025-10-31'),
      category: 'Network'
    },
    {
      id: 1000,
      title: 'Request Access to Shared Drive',
      description: 'Need read/write access to Marketing shared drive folder.',
      priority: 'Low',
      status: 'Closed',
      submittedBy: 'Lisa Anderson',
      submittedDate: new Date('2025-10-29'),
      closedDate: new Date('2025-10-30'),
      category: 'Access'
    }
    ];
  }

  onDateRangeChange(): void {
    this.filterTicketsByDateRange();
    this.calculateStatistics();
  }

  filterTicketsByDateRange(): void {
    const now = new Date();
    let cutoffDate: Date;

    switch (this.selectedDateRange) {
      case 'today':
        cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case '7days':
        cutoffDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '30days':
        cutoffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '90days':
        cutoffDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      default:
        cutoffDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }

    this.openTickets = this.allOpenTickets.filter(ticket =>
      ticket.submittedDate >= cutoffDate
    );

    this.closedTickets = this.allClosedTickets.filter(ticket =>
      ticket.submittedDate >= cutoffDate
    );
  }

  openCreateTicketDialog(): void {
    const dialogRef = this.dialog.open(CreateTicketDialogComponent, {
      width: '600px',
      data: { submittedBy: this.currentUser?.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Add the new ticket to both allOpenTickets and openTickets
        const newTicket: SupportTicket = {
          id: 1000 + this.totalTickets + 1,
          title: result.title,
          description: result.description,
          priority: result.priority,
          status: 'Open',
          submittedBy: this.currentUser?.name || 'Unknown',
          submittedDate: new Date(),
          category: result.category
        };
        this.allOpenTickets.unshift(newTicket);
        this.openTickets.unshift(newTicket);
        this.calculateStatistics();
      }
    });
  }

  calculateStatistics(): void {
    this.totalTickets = this.openTickets.length + this.closedTickets.length;

    if (this.totalTickets > 0) {
      this.resolutionRate = Math.round((this.closedTickets.length / this.totalTickets) * 100);
    } else {
      this.resolutionRate = 0;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// Create Ticket Dialog Component
@Component({
  selector: 'app-create-ticket-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>confirmation_number</mat-icon>
      Create New Support Ticket
    </h2>
    <mat-dialog-content>
      <form [formGroup]="ticketForm">
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" placeholder="Brief description of the issue">
          <mat-icon matPrefix>title</mat-icon>
          @if (ticketForm.get('title')?.hasError('required') && ticketForm.get('title')?.touched) {
            <mat-error>Title is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Category</mat-label>
          <mat-select formControlName="category">
            <mat-option value="IT Support">IT Support</mat-option>
            <mat-option value="Software">Software</mat-option>
            <mat-option value="Hardware">Hardware</mat-option>
            <mat-option value="Network">Network</mat-option>
            <mat-option value="Account">Account</mat-option>
            <mat-option value="Access">Access</mat-option>
            <mat-option value="Other">Other</mat-option>
          </mat-select>
          <mat-icon matPrefix>category</mat-icon>
          @if (ticketForm.get('category')?.hasError('required') && ticketForm.get('category')?.touched) {
            <mat-error>Category is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority">
            <mat-option value="Low">Low</mat-option>
            <mat-option value="Medium">Medium</mat-option>
            <mat-option value="High">High</mat-option>
            <mat-option value="Critical">Critical</mat-option>
          </mat-select>
          <mat-icon matPrefix>priority_high</mat-icon>
          @if (ticketForm.get('priority')?.hasError('required') && ticketForm.get('priority')?.touched) {
            <mat-error>Priority is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Description</mat-label>
          <textarea matInput
                    formControlName="description"
                    rows="5"
                    placeholder="Detailed description of the issue or request"></textarea>
          <mat-icon matPrefix>description</mat-icon>
          @if (ticketForm.get('description')?.hasError('required') && ticketForm.get('description')?.touched) {
            <mat-error>Description is required</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!ticketForm.valid">
        <mat-icon>send</mat-icon>
        Submit Ticket
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #00008B;
      margin: 0;
    }

    h2 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    mat-dialog-content {
      padding: 20px 24px !important;
      min-height: 400px;
    }

    mat-form-field {
      margin-bottom: 16px;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      margin: 0 !important;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }

    mat-dialog-actions button mat-icon {
      margin-right: 4px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class CreateTicketDialogComponent {
  ticketForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<CreateTicketDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { submittedBy: string },
    private fb: FormBuilder
  ) {
    this.ticketForm = this.fb.group({
      title: ['', Validators.required],
      category: ['', Validators.required],
      priority: ['Medium', Validators.required],
      description: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.ticketForm.valid) {
      this.dialogRef.close(this.ticketForm.value);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
