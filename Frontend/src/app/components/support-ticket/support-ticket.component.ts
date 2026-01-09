import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SupportTicketService, SupportTicket, TicketStatistics } from '../../services/support-ticket.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-support-ticket',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogModule,
    MatSelectModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    FormsModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="support-container">
      <div class="header-section">
        <div class="header-left">
          <h1>
            <mat-icon>support_agent</mat-icon>
            Support Ticket System
          </h1>
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

      <!-- Loading Spinner -->
      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Loading tickets...</p>
        </div>
      }

      <!-- Tickets Row: Open and Closed Side by Side -->
      @if (!loading) {
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
                @for (ticket of openTickets; track ticket.ticketId) {
                  <div class="ticket-item">
                    <div class="ticket-header">
                      <div class="ticket-title-section">
                        <h4>{{ ticket.title }}</h4>
                        <span class="ticket-id">#{{ ticket.ticketId }}</span>
                      </div>
                      <div class="ticket-actions">
                        <mat-chip [class]="'priority-' + ticket.priority.toLowerCase()">
                          {{ ticket.priority }}
                        </mat-chip>
                        <button mat-icon-button color="primary" (click)="closeTicket(ticket)" title="Close Ticket">
                          <mat-icon>check_circle</mat-icon>
                        </button>
                      </div>
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
                @for (ticket of closedTickets; track ticket.ticketId) {
                  <div class="ticket-item closed">
                    <div class="ticket-header">
                      <div class="ticket-title-section">
                        <h4>{{ ticket.title }}</h4>
                        <span class="ticket-id">#{{ ticket.ticketId }}</span>
                      </div>
                      <div class="ticket-actions">
                        <mat-chip class="status-closed">Resolved</mat-chip>
                        <button mat-icon-button color="warn" (click)="reopenTicket(ticket)" title="Reopen Ticket">
                          <mat-icon>refresh</mat-icon>
                        </button>
                      </div>
                    </div>
                    <p class="ticket-description">{{ ticket.description }}</p>
                    @if (ticket.resolution) {
                      <p class="ticket-resolution"><strong>Resolution:</strong> {{ ticket.resolution }}</p>
                    }
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
      }
    </div>
  `,
  styles: [`
    .support-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: white;
    }

    .loading-container p {
      margin-top: 16px;
      font-size: 16px;
    }

    .ticket-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ticket-resolution {
      font-size: 13px;
      color: #059669;
      background: #d1fae5;
      padding: 8px 12px;
      border-radius: 6px;
      margin: 8px 0;
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
      justify-content: center;
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
  notificationCount = 3;
  loading = false;

  // Statistics
  totalTickets: number = 0;
  averageResponseTime: string = '0 hrs';
  resolutionRate: number = 0;

  // Date filter
  selectedDateRange: string = '30days';

  // Tickets from database
  openTickets: SupportTicket[] = [];
  closedTickets: SupportTicket[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private ticketService: SupportTicketService,
    private snackBar: MatSnackBar
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.loading = true;
    
    // Load open tickets
    this.ticketService.getOpenTickets().subscribe({
      next: (tickets) => {
        this.openTickets = tickets;
        this.loadClosedTickets();
      },
      error: (error) => {
        console.error('Error loading open tickets:', error);
        this.snackBar.open('Failed to load tickets', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadClosedTickets(): void {
    this.ticketService.getClosedTickets().subscribe({
      next: (tickets) => {
        this.closedTickets = tickets;
        this.loadStatistics();
      },
      error: (error) => {
        console.error('Error loading closed tickets:', error);
        this.loading = false;
      }
    });
  }

  loadStatistics(): void {
    const fromDate = this.getDateRangeStart();
    this.ticketService.getStatistics(fromDate).subscribe({
      next: (stats) => {
        this.totalTickets = stats.totalTickets;
        this.resolutionRate = Math.round(stats.resolutionRate);
        if (stats.averageResponseTimeHours > 0) {
          this.averageResponseTime = stats.averageResponseTimeHours.toFixed(1) + ' hrs';
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading statistics:', error);
        this.calculateLocalStatistics();
        this.loading = false;
      }
    });
  }

  calculateLocalStatistics(): void {
    this.totalTickets = this.openTickets.length + this.closedTickets.length;
    if (this.totalTickets > 0) {
      this.resolutionRate = Math.round((this.closedTickets.length / this.totalTickets) * 100);
    }
  }

  getDateRangeStart(): Date {
    const now = new Date();
    switch (this.selectedDateRange) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case '7days':
        return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
      case '30days':
        return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      case '90days':
        return new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
      default:
        return new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }
  }

  onDateRangeChange(): void {
    this.loadStatistics();
  }

  openCreateTicketDialog(): void {
    const dialogRef = this.dialog.open(CreateTicketDialogComponent, {
      width: '600px',
      data: { submittedBy: this.currentUser?.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const createRequest = {
          title: result.title,
          description: result.description,
          priority: result.priority,
          category: result.category,
          submittedBy: this.currentUser?.name || 'Unknown'
        };

        this.ticketService.createTicket(createRequest).subscribe({
          next: (newTicket) => {
            this.openTickets.unshift(newTicket);
            this.totalTickets++;
            this.snackBar.open('Ticket created successfully!', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error creating ticket:', error);
            this.snackBar.open('Failed to create ticket', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  closeTicket(ticket: SupportTicket): void {
    this.ticketService.closeTicket(ticket.ticketId).subscribe({
      next: () => {
        // Move from open to closed
        this.openTickets = this.openTickets.filter(t => t.ticketId !== ticket.ticketId);
        ticket.status = 'Closed';
        ticket.closedDate = new Date();
        this.closedTickets.unshift(ticket);
        this.loadStatistics();
        this.snackBar.open('Ticket closed', 'Close', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error closing ticket:', error);
        this.snackBar.open('Failed to close ticket', 'Close', { duration: 3000 });
      }
    });
  }

  reopenTicket(ticket: SupportTicket): void {
    this.ticketService.reopenTicket(ticket.ticketId).subscribe({
      next: () => {
        // Move from closed to open
        this.closedTickets = this.closedTickets.filter(t => t.ticketId !== ticket.ticketId);
        ticket.status = 'Open';
        ticket.closedDate = undefined;
        this.openTickets.unshift(ticket);
        this.loadStatistics();
        this.snackBar.open('Ticket reopened', 'Close', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error reopening ticket:', error);
        this.snackBar.open('Failed to reopen ticket', 'Close', { duration: 3000 });
      }
    });
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
