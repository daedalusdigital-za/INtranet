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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SupportTicketService, SupportTicket, TicketStatistics } from '../../services/support-ticket.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { ConfirmService } from '../../ui/confirm.service';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';

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
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatBadgeModule,
    MatMenuModule,
    FormsModule,
    NavbarComponent,
    PageHeaderComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="support-container">
      <app-page-header class="support-header" [crumbs]="['Oversight', 'Support']" title="Support"
                       subtitle="Track and resolve support requests">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search-field">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="searchQuery" placeholder="Search tickets" aria-label="Search tickets" (input)="filterTickets()">
          @if (searchQuery) {
            <button aria-label="Close" matSuffix mat-icon-button class="search-clear" (click)="searchQuery = ''; filterTickets()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="period-field">
          <mat-select [(value)]="selectedDateRange" (selectionChange)="onDateRangeChange()" aria-label="Statistics period">
            <mat-option value="today">Today</mat-option>
            <mat-option value="7days">7 days</mat-option>
            <mat-option value="30days">30 days</mat-option>
            <mat-option value="90days">90 days</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-flat-button color="primary" (click)="openCreateTicketDialog()">
          <mat-icon>add</mat-icon>New ticket
        </button>
      </app-page-header>

      <!-- Statistics Strip -->
      <div class="stats-strip">
        <div class="stat-pill" [class.active]="activeFilter === 'all'" (click)="setFilter('all')">
          <div class="pill-icon total"><mat-icon>confirmation_number</mat-icon></div>
          <div class="pill-info">
            <span class="pill-value">{{ totalTickets }}</span>
            <span class="pill-label">Total</span>
          </div>
        </div>
        <div class="stat-pill" [class.active]="activeFilter === 'open'" (click)="setFilter('open')">
          <div class="pill-icon open"><mat-icon>radio_button_unchecked</mat-icon></div>
          <div class="pill-info">
            <span class="pill-value">{{ openTickets.length }}</span>
            <span class="pill-label">Open</span>
          </div>
        </div>
        <div class="stat-pill" [class.active]="activeFilter === 'closed'" (click)="setFilter('closed')">
          <div class="pill-icon closed"><mat-icon>check_circle</mat-icon></div>
          <div class="pill-info">
            <span class="pill-value">{{ closedTickets.length }}</span>
            <span class="pill-label">Closed</span>
          </div>
        </div>
        <div class="stat-pill">
          <div class="pill-icon response"><mat-icon>schedule</mat-icon></div>
          <div class="pill-info">
            <span class="pill-value">{{ averageResponseTime }}</span>
            <span class="pill-label">Avg Response</span>
          </div>
        </div>
        <div class="stat-pill">
          <div class="pill-icon resolution"><mat-icon>trending_up</mat-icon></div>
          <div class="pill-info">
            <span class="pill-value">{{ resolutionRate }}%</span>
            <span class="pill-label">Resolved</span>
          </div>
        </div>
      </div>

      <!-- Loading -->
      @if (loading) {
        <div class="loading-state">
          <div class="loading-card">
            <div class="lc-icon-wrap">
              <mat-icon class="lc-icon pulse-icon">support_agent</mat-icon>
            </div>
            <h3>Loading tickets</h3>
            <p class="lc-subtitle">Fetching tickets, responses and statistics</p>
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
      }

      <!-- Tickets Content -->
      @if (!loading) {
        <!-- Active Tab Bar -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeFilter === 'all' || activeFilter === 'open'" (click)="setFilter('open')">
            <mat-icon>folder_open</mat-icon>
            Open Tickets
            <span class="badge open">{{ filteredOpenTickets.length }}</span>
          </button>
          <button class="tab-btn" [class.active]="activeFilter === 'closed'" (click)="setFilter('closed')">
            <mat-icon>task_alt</mat-icon>
            Closed Tickets
            <span class="badge closed">{{ filteredClosedTickets.length }}</span>
          </button>
        </div>

        <!-- Open Tickets -->
        @if (activeFilter !== 'closed') {
          <div class="tickets-grid">
            @if (filteredOpenTickets.length === 0) {
              <div class="empty-state">
                <div class="empty-icon"><mat-icon>inbox</mat-icon></div>
                <h3>No Open Tickets</h3>
                <p>All caught up! Create a new ticket if you need help.</p>
                <button mat-stroked-button class="empty-action" (click)="openCreateTicketDialog()">
                  <mat-icon>add</mat-icon> Create Ticket
                </button>
              </div>
            }
            @for (ticket of filteredOpenTickets; track ticket.ticketId) {
              <div class="ticket-card" [class]="'border-' + ticket.priority.toLowerCase()">
                <div class="ticket-card-top">
                  <div class="ticket-id-badge">#{{ ticket.ticketId }}</div>
                  <div class="ticket-priority" [class]="'priority-' + ticket.priority.toLowerCase()">
                    <mat-icon>{{ getPriorityIcon(ticket.priority) }}</mat-icon>
                    {{ ticket.priority }}
                  </div>
                </div>
                <h3 class="ticket-title">{{ ticket.title }}</h3>
                <p class="ticket-desc">{{ ticket.description | slice:0:120 }}{{ ticket.description.length > 120 ? '...' : '' }}</p>
                <div class="ticket-tags">
                  <span class="tag category"><mat-icon>label</mat-icon>{{ ticket.category }}</span>
                  <span class="tag status open"><mat-icon>radio_button_unchecked</mat-icon>{{ ticket.status }}</span>
                </div>
                <div class="ticket-footer">
                  <div class="ticket-meta-row">
                    <span class="meta-item"><mat-icon>person_outline</mat-icon>{{ ticket.submittedBy }}</span>
                    <span class="meta-item"><mat-icon>schedule</mat-icon>{{ ticket.submittedDate | date: 'MMM d, y' }}</span>
                  </div>
                  <div class="ticket-card-actions">
                    <button aria-label="Add Comment" mat-icon-button matTooltip="Add Comment" class="action-btn comment" (click)="openCommentDialog(ticket)">
                      <mat-icon>chat_bubble_outline</mat-icon>
                    </button>
                    <button aria-label="Close Ticket" mat-icon-button matTooltip="Close Ticket" class="action-btn resolve" (click)="closeTicket(ticket)">
                      <mat-icon>check_circle_outline</mat-icon>
                    </button>
                    <button aria-label="Delete Ticket" mat-icon-button matTooltip="Delete Ticket" class="action-btn delete" (click)="deleteTicket(ticket)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Closed Tickets -->
        @if (activeFilter === 'closed') {
          <div class="tickets-grid">
            @if (filteredClosedTickets.length === 0) {
              <div class="empty-state">
                <div class="empty-icon"><mat-icon>check_circle</mat-icon></div>
                <h3>No Closed Tickets</h3>
                <p>Resolved tickets will appear here.</p>
              </div>
            }
            @for (ticket of filteredClosedTickets; track ticket.ticketId) {
              <div class="ticket-card closed-card">
                <div class="ticket-card-top">
                  <div class="ticket-id-badge">#{{ ticket.ticketId }}</div>
                  <div class="ticket-priority resolved">
                    <mat-icon>check_circle</mat-icon>
                    Resolved
                  </div>
                </div>
                <h3 class="ticket-title">{{ ticket.title }}</h3>
                <p class="ticket-desc">{{ ticket.description | slice:0:120 }}{{ ticket.description.length > 120 ? '...' : '' }}</p>
                @if (ticket.resolution) {
                  <div class="resolution-box">
                    <mat-icon>lightbulb</mat-icon>
                    <span>{{ ticket.resolution }}</span>
                  </div>
                }
                <div class="ticket-tags">
                  <span class="tag category"><mat-icon>label</mat-icon>{{ ticket.category }}</span>
                  <span class="tag status closed"><mat-icon>check_circle</mat-icon>Closed</span>
                </div>
                <div class="ticket-footer">
                  <div class="ticket-meta-row">
                    <span class="meta-item"><mat-icon>person_outline</mat-icon>{{ ticket.submittedBy }}</span>
                    <span class="meta-item"><mat-icon>event_available</mat-icon>{{ ticket.closedDate | date: 'MMM d, y' }}</span>
                  </div>
                  <div class="ticket-card-actions">
                    <button aria-label="Reopen Ticket" mat-icon-button matTooltip="Reopen Ticket" class="action-btn reopen" (click)="reopenTicket(ticket)">
                      <mat-icon>refresh</mat-icon>
                    </button>
                    <button aria-label="Delete Ticket" mat-icon-button matTooltip="Delete Ticket" class="action-btn delete" (click)="deleteTicket(ticket)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    /* === Page container === */
    :host {
      display: block;
    }

    .support-container {
      padding: var(--space-5) var(--space-6) var(--space-8);
      background: var(--color-canvas);
    }

    /* === Page header === */
    .support-header {
      margin-bottom: var(--space-5);
    }

    .search-field,
    .period-field {
      --mat-form-field-container-height: 36px;
      --mat-form-field-container-vertical-padding: 6px;
      --mat-form-field-container-text-size: var(--text-sm);
      --mat-select-trigger-text-size: var(--text-sm);
      --mdc-outlined-text-field-container-shape: var(--radius-control);
      --mdc-outlined-text-field-outline-color: var(--color-line-strong);
      border-radius: var(--radius-control);
      background: var(--color-surface);
    }

    .search-field {
      width: 260px;
    }

    .period-field {
      width: 120px;
    }

    .search-clear {
      --mdc-icon-button-state-layer-size: 28px;
      --mdc-icon-button-icon-size: 18px;
    }

    .search-clear mat-icon {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
    }

    /* === Stats strip === */
    .stats-strip {
      display: flex;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
      overflow-x: auto;
      padding-bottom: var(--space-1);
    }

    .stat-pill {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 160px;
      padding: var(--space-4) var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }

    .stat-pill:hover {
      border-color: var(--color-line-strong);
    }

    .stat-pill.active {
      background: var(--color-primary-soft);
      border-color: var(--color-primary);
    }

    .pill-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-2);
    }

    .pill-icon mat-icon {
      width: 20px;
      height: 20px;
      font-size: var(--text-2xl);
    }

    .pill-icon.open { background: var(--color-info-soft); color: var(--color-info); }
    .pill-icon.closed { background: var(--color-ok-soft); color: var(--color-ok); }
    .stat-pill.active .pill-icon { background: var(--color-surface); }

    .pill-info {
      display: flex;
      flex-direction: column;
    }

    .pill-value {
      font-size: var(--text-2xl);
      font-weight: 800;
      line-height: 1.2;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }

    .pill-label {
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text-3);
    }

    /* === Loading === */
    .loading-state {
      display: flex;
      justify-content: center;
      padding: var(--space-8) var(--space-4);
    }

    .loading-card {
      width: 100%;
      max-width: 520px;
      padding: var(--space-8) var(--space-6);
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .loading-card h3 {
      margin: var(--space-4) 0 var(--space-1);
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--color-text);
    }

    .lc-subtitle {
      margin: 0 0 var(--space-5);
      font-size: var(--text-sm);
      line-height: 1.5;
      color: var(--color-text-3);
    }

    .lc-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      margin: 0 auto;
      border-radius: 50%;
      background: var(--color-primary-soft);
    }

    .lc-icon {
      width: 32px;
      height: 32px;
      font-size: var(--text-4xl);
      color: var(--color-primary);
    }

    .pulse-icon { animation: lcPulse 2s ease-in-out infinite; }
    @keyframes lcPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

    .lc-progress-wrap { margin: var(--space-2) 0 var(--space-5); }

    .lc-progress-track {
      height: 6px;
      border-radius: 3px;
      background: var(--color-surface-2);
      overflow: hidden;
    }

    .lc-progress-fill {
      height: 100%;
      border-radius: 3px;
      background: var(--color-primary);
      transition: width 0.15s ease-out;
    }

    .lc-progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: var(--space-2);
      font-size: var(--text-xs);
    }

    .lc-progress-message { color: var(--color-text-2); font-weight: 500; }
    .lc-progress-pct { color: var(--color-primary); font-weight: 700; font-size: var(--text-sm); font-variant-numeric: tabular-nums; }

    .lc-steps {
      display: flex;
      justify-content: space-between;
      gap: var(--space-1);
      padding-top: var(--space-1);
      border-top: 1px solid var(--color-line);
    }

    .lc-step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex: 1;
      padding-top: var(--space-4);
    }

    .lc-step-dot {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-surface-2);
      color: var(--color-text-3);
      transition: background-color 0.3s ease, color 0.3s ease;
    }

    .lc-step-dot mat-icon { width: 16px; height: 16px; font-size: var(--text-lg); }
    .lc-step-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); white-space: nowrap; }
    .lc-step.active .lc-step-dot { background: var(--color-primary); color: var(--color-on-primary); }
    .lc-step.active .lc-step-label { color: var(--color-primary); }
    .lc-step.done .lc-step-dot { background: var(--color-ok-soft); color: var(--color-ok); }
    .lc-step.done .lc-step-label { color: var(--color-ok); }

    /* === Tab bar (segmented control) === */
    .tab-bar {
      display: flex;
      gap: 2px;
      width: fit-content;
      margin-bottom: var(--space-5);
      padding: var(--space-1);
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      border: none;
      border-radius: var(--radius-control);
      background: transparent;
      font-family: inherit;
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--color-text-2);
      cursor: pointer;
      transition: background-color 0.15s ease, color 0.15s ease;
    }

    .tab-btn:hover {
      color: var(--color-text);
    }

    .tab-btn.active {
      background: var(--color-surface);
      color: var(--color-text);
      box-shadow: var(--shadow-sm);
    }

    .tab-btn mat-icon {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
    }

    .badge {
      min-width: 20px;
      padding: 1px var(--space-2);
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 700;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .badge.open { background: var(--color-info-soft); color: var(--color-info); }
    .badge.closed { background: var(--color-ok-soft); color: var(--color-ok); }

    /* === Tickets grid === */
    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: var(--space-4);
      animation: ticketsFadeIn 0.2s ease-out;
    }

    @keyframes ticketsFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    /* === Ticket card === */
    .ticket-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-5);
      overflow: hidden;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-left: 4px solid var(--color-line-strong);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.15s ease;
    }

    .ticket-card:hover {
      box-shadow: var(--shadow-md);
    }

    /* Left edge carries the priority (low stays neutral); closed tickets are green. */
    .ticket-card.border-medium { border-left-color: var(--color-warn); }
    .ticket-card.border-high,
    .ticket-card.border-critical { border-left-color: var(--color-danger); }
    .ticket-card.closed-card { border-left-color: var(--color-ok); }

    .ticket-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
    }

    .ticket-id-badge {
      padding: 2px var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-2);
      font-family: var(--font-mono);
      font-size: var(--text-xs);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .ticket-priority {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px 10px 2px var(--space-2);
      border-radius: 999px;
      background: var(--color-surface-2);
      color: var(--color-text-2);
      font-size: var(--text-xs);
      font-weight: 700;
    }

    .ticket-priority mat-icon {
      width: 14px;
      height: 14px;
      font-size: var(--text-md);
    }

    .ticket-priority.priority-medium { background: var(--color-warn-soft); color: var(--color-warn); }
    .ticket-priority.priority-high { background: var(--color-danger-soft); color: var(--color-danger); }
    .ticket-priority.priority-critical { background: var(--color-danger-soft); color: var(--color-danger); box-shadow: inset 0 0 0 1px var(--color-danger); }
    .ticket-priority.resolved { background: var(--color-ok-soft); color: var(--color-ok); }

    .ticket-title {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 700;
      line-height: 1.4;
      color: var(--color-text);
    }

    .ticket-desc {
      margin: 0;
      font-size: var(--text-sm);
      line-height: 1.6;
      color: var(--color-text-2);
    }

    .ticket-tags {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px 10px 2px var(--space-2);
      border-radius: 999px;
      background: var(--color-surface-2);
      color: var(--color-text-2);
      font-size: var(--text-xs);
      font-weight: 600;
    }

    .tag mat-icon {
      width: 14px;
      height: 14px;
      font-size: var(--text-md);
    }

    .tag.status.open { background: var(--color-info-soft); color: var(--color-info); }
    .tag.status.closed { background: var(--color-ok-soft); color: var(--color-ok); }

    .resolution-box {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-ok-soft);
      font-size: var(--text-sm);
      line-height: 1.6;
      color: var(--color-text);
    }

    .resolution-box mat-icon {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      margin-top: 1px;
      font-size: var(--text-xl);
      color: var(--color-ok);
    }

    .ticket-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
      margin-top: auto;
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-line);
    }

    .ticket-meta-row {
      display: flex;
      gap: var(--space-4);
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-xs);
      font-weight: 500;
      color: var(--color-text-3);
    }

    .meta-item mat-icon {
      width: 14px;
      height: 14px;
      font-size: var(--text-md);
    }

    .ticket-card-actions {
      display: flex;
      gap: 2px;
    }

    .action-btn {
      --mdc-icon-button-state-layer-size: 36px;
      --mdc-icon-button-icon-size: 18px;
    }

    .action-btn mat-icon {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
    }

    .action-btn.comment { --mdc-icon-button-icon-color: var(--color-primary); --mat-icon-button-state-layer-color: var(--color-primary); }
    .action-btn.resolve { --mdc-icon-button-icon-color: var(--color-ok); --mat-icon-button-state-layer-color: var(--color-ok); }
    .action-btn.reopen { --mdc-icon-button-icon-color: var(--color-warn); --mat-icon-button-state-layer-color: var(--color-warn); }
    .action-btn.delete { --mdc-icon-button-icon-color: var(--color-danger); --mat-icon-button-state-layer-color: var(--color-danger); }

    /* === Empty state === */
    .empty-state {
      grid-column: 1 / -1;
      padding: var(--space-8) var(--space-4);
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .empty-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      margin: 0 auto var(--space-4);
      border-radius: 50%;
      background: var(--color-surface-2);
      color: var(--color-text-3);
    }

    .empty-icon mat-icon {
      width: 32px;
      height: 32px;
      font-size: var(--text-4xl);
    }

    .empty-state h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-text);
    }

    .empty-state p {
      margin: 0 0 var(--space-5);
      font-size: var(--text-md);
      color: var(--color-text-2);
    }

    .empty-state p:last-child {
      margin-bottom: 0;
    }

    /* === Responsive === */
    @media (max-width: 1024px) {
      .support-container { padding: var(--space-5) var(--space-4) var(--space-6); }
      .stats-strip { flex-wrap: wrap; }
      .tickets-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 600px) {
      .support-container { padding: var(--space-4) var(--space-4) var(--space-6); }
      .stat-pill { min-width: 140px; padding: var(--space-3) var(--space-4); }
      .ticket-footer { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class SupportTicketComponent implements OnInit {
  currentUser: any;
  loading = false;
  searchQuery = '';
  activeFilter: 'all' | 'open' | 'closed' = 'open';

  // Statistics
  totalTickets: number = 0;
  averageResponseTime: string = '0h';
  resolutionRate: number = 0;

  // Date filter
  selectedDateRange: string = '30days';

  // Tickets from database
  openTickets: SupportTicket[] = [];
  closedTickets: SupportTicket[] = [];
  filteredOpenTickets: SupportTicket[] = [];
  filteredClosedTickets: SupportTicket[] = [];

  // Loading progress
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing...';
  private progressInterval: any;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Authenticating', detail: 'Securing connection...' },
    { icon: 'support_agent', label: 'Fetching Tickets', detail: 'Loading support requests...' },
    { icon: 'assignment', label: 'Statistics', detail: 'Calculating metrics...' },
    { icon: 'dashboard', label: 'Ready', detail: 'Building ticket view...' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private ticketService: SupportTicketService,
    private snackBar: MatSnackBar,
    private readonly confirmDialog: ConfirmService
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadTickets();
  }

  loadTickets(): void {
    this.loading = true;
    this.startLoadingProgress();
    
    this.ticketService.getOpenTickets().subscribe({
      next: (tickets) => {
        this.openTickets = tickets;
        this.filteredOpenTickets = tickets;
        this.loadClosedTickets();
      },
      error: (error) => {
        console.error('Error loading open tickets:', error);
        this.stopLoadingProgress();
        this.snackBar.open('Failed to load tickets', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  loadClosedTickets(): void {
    this.ticketService.getClosedTickets().subscribe({
      next: (tickets) => {
        this.closedTickets = tickets;
        this.filteredClosedTickets = tickets;
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
          this.averageResponseTime = stats.averageResponseTimeHours.toFixed(1) + 'h';
        }
        this.finishLoadingProgress(() => {
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('Error loading statistics:', error);
        this.calculateLocalStatistics();
        this.stopLoadingProgress();
        this.loading = false;
      }
    });
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

  setFilter(filter: 'all' | 'open' | 'closed'): void {
    this.activeFilter = filter;
    this.filterTickets();
  }

  filterTickets(): void {
    const q = this.searchQuery.toLowerCase().trim();

    if (!q) {
      this.filteredOpenTickets = this.openTickets;
      this.filteredClosedTickets = this.closedTickets;
      return;
    }

    this.filteredOpenTickets = this.openTickets.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.submittedBy.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      ('#' + t.ticketId).includes(q)
    );

    this.filteredClosedTickets = this.closedTickets.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.submittedBy.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      ('#' + t.ticketId).includes(q)
    );
  }

  getPriorityIcon(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'critical': return 'error';
      case 'high': return 'warning';
      case 'medium': return 'info';
      case 'low': return 'check_circle';
      default: return 'info';
    }
  }

  openCreateTicketDialog(): void {
    const dialogRef = this.dialog.open(CreateTicketDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      panelClass: 'modern-dialog',
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
            this.filterTickets();
            this.totalTickets++;
            this.snackBar.open('✅ Ticket created successfully!', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error creating ticket:', error);
            this.snackBar.open('Failed to create ticket', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  openCommentDialog(ticket: SupportTicket): void {
    const dialogRef = this.dialog.open(AddCommentDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'modern-dialog',
      data: { ticket, author: this.currentUser?.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.ticketService.addComment(ticket.ticketId, {
          content: result.content,
          author: this.currentUser?.name || 'Unknown',
          isInternal: false
        }).subscribe({
          next: () => {
            this.snackBar.open('💬 Comment added', 'Close', { duration: 3000 });
          },
          error: (error) => {
            console.error('Error adding comment:', error);
            this.snackBar.open('Failed to add comment', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  closeTicket(ticket: SupportTicket): void {
    this.ticketService.closeTicket(ticket.ticketId).subscribe({
      next: () => {
        this.openTickets = this.openTickets.filter(t => t.ticketId !== ticket.ticketId);
        ticket.status = 'Closed';
        ticket.closedDate = new Date();
        this.closedTickets.unshift(ticket);
        this.filterTickets();
        this.loadStatistics();
        this.snackBar.open('✅ Ticket closed', 'Close', { duration: 3000 });
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
        this.closedTickets = this.closedTickets.filter(t => t.ticketId !== ticket.ticketId);
        ticket.status = 'Open';
        ticket.closedDate = undefined;
        this.openTickets.unshift(ticket);
        this.filterTickets();
        this.loadStatistics();
        this.snackBar.open('🔄 Ticket reopened', 'Close', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error reopening ticket:', error);
        this.snackBar.open('Failed to reopen ticket', 'Close', { duration: 3000 });
      }
    });
  }

  async deleteTicket(ticket: SupportTicket): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete ticket #${ticket.ticketId} "${ticket.title}"?`,
      confirmText: 'Delete ticket',
      danger: true
    }))) return;

    this.ticketService.deleteTicket(ticket.ticketId).subscribe({
      next: () => {
        this.openTickets = this.openTickets.filter(t => t.ticketId !== ticket.ticketId);
        this.closedTickets = this.closedTickets.filter(t => t.ticketId !== ticket.ticketId);
        this.filterTickets();
        this.totalTickets--;
        this.snackBar.open('🗑️ Ticket deleted', 'Close', { duration: 3000 });
      },
      error: (error) => {
        console.error('Error deleting ticket:', error);
        this.snackBar.open('Failed to delete ticket', 'Close', { duration: 3000 });
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// ============================================================
// Create Ticket Dialog
// ============================================================
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
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="dialog-icon"><mat-icon>add_circle</mat-icon></div>
        <h2>New Support Ticket</h2>
      </div>
      <mat-dialog-content>
        <form [formGroup]="ticketForm">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" placeholder="Brief description of the issue">
            <mat-icon matPrefix>title</mat-icon>
            @if (ticketForm.get('title')?.hasError('required') && ticketForm.get('title')?.touched) {
              <mat-error>Title is required</mat-error>
            }
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="half-width">
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
            </mat-form-field>

            <mat-form-field appearance="outline" class="half-width">
              <mat-label>Priority</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="Low">🟢 Low</mat-option>
                <mat-option value="Medium">🟡 Medium</mat-option>
                <mat-option value="High">🟠 High</mat-option>
                <mat-option value="Critical">🔴 Critical</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput formControlName="description" rows="5" placeholder="Detailed description of the issue..."></textarea>
            @if (ticketForm.get('description')?.hasError('required') && ticketForm.get('description')?.touched) {
              <mat-error>Description is required</mat-error>
            }
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button class="cancel-btn" (click)="onCancel()">Cancel</button>
        <button mat-flat-button class="submit-btn" (click)="onSubmit()" [disabled]="!ticketForm.valid">
          <mat-icon>send</mat-icon>
          Submit Ticket
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper { padding: 0; background: var(--color-text); border-radius: 16px; }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 24px 8px;
      background: var(--color-text);
      border-radius: 16px 16px 0 0;
    }

    .dialog-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-primary), #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .dialog-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: white;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: var(--color-surface-2);
    }

    mat-dialog-content {
      padding: 16px 24px !important;
      background: var(--color-text);
    }

    .full-width { width: 100%; }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .half-width { flex: 1; }

    :host ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.04) !important;
    }

    :host ::ng-deep .mdc-notched-outline__leading,
    :host ::ng-deep .mdc-notched-outline__notch,
    :host ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.1) !important;
    }

    :host ::ng-deep .mat-mdc-form-field-label,
    :host ::ng-deep .mdc-floating-label {
      color: rgba(255,255,255,0.5) !important;
    }

    :host ::ng-deep input, :host ::ng-deep textarea {
      color: var(--color-surface-2) !important;
    }

    :host ::ng-deep .mat-mdc-select-value-text {
      color: var(--color-surface-2) !important;
    }

    :host ::ng-deep .mat-mdc-form-field-icon-prefix mat-icon {
      color: rgba(255,255,255,0.4) !important;
    }

    mat-dialog-actions {
      padding: 12px 24px 20px !important;
      margin: 0 !important;
      gap: 8px;
      background: var(--color-text);
      border-radius: 0 0 16px 16px;
    }

    :host ::ng-deep .mat-mdc-dialog-surface {
      background: var(--color-text) !important;
      border-radius: 16px !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
    }

    .cancel-btn {
      color: rgba(255,255,255,0.5) !important;
      font-weight: 500 !important;
    }

    .cancel-btn:hover {
      background: rgba(255,255,255,0.05) !important;
    }

    .submit-btn {
      background: linear-gradient(135deg, var(--color-primary), #8b5cf6) !important;
      color: white !important;
      padding: 0 24px !important;
      height: 40px;
      border-radius: 10px !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3) !important;
    }

    .submit-btn:hover {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45) !important;
    }

    .submit-btn mat-icon {
      margin-right: 6px;
      font-size: 18px;
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

// ============================================================
// Add Comment Dialog
// ============================================================
@Component({
  selector: 'app-add-comment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-wrapper">
      <div class="dialog-header">
        <div class="dialog-icon"><mat-icon>chat_bubble</mat-icon></div>
        <div>
          <h2>Add Comment</h2>
          <p class="dialog-sub">Ticket #{{ data.ticket.ticketId }} — {{ data.ticket.title }}</p>
        </div>
      </div>
      <mat-dialog-content>
        <!-- Existing comments -->
        @if (data.ticket.comments && data.ticket.comments.length > 0) {
          <div class="comments-list">
            @for (c of data.ticket.comments; track c.commentId) {
              <div class="comment-item">
                <div class="comment-author">
                  <mat-icon>person</mat-icon>
                  <strong>{{ c.author }}</strong>
                  <span class="comment-date">{{ c.createdAt | date: 'MMM d, y h:mm a' }}</span>
                </div>
                <p class="comment-content">{{ c.content }}</p>
              </div>
            }
          </div>
        }
        <form [formGroup]="commentForm">
          <mat-form-field appearance="outline" style="width: 100%;">
            <mat-label>Your comment</mat-label>
            <textarea matInput formControlName="content" rows="4" placeholder="Type your comment..."></textarea>
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button class="cancel-btn" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button class="submit-btn" (click)="onSubmit()" [disabled]="!commentForm.valid">
          <mat-icon>send</mat-icon>
          Post Comment
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-wrapper { padding: 0; background: var(--color-text); border-radius: 16px; }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 24px 8px;
      background: var(--color-text);
      border-radius: 16px 16px 0 0;
    }

    .dialog-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, var(--color-primary), #60a5fa);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .dialog-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: white;
    }

    h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--color-surface-2); }
    .dialog-sub { margin: 2px 0 0; font-size: 13px; color: rgba(255,255,255,0.35); }

    mat-dialog-content { padding: 16px 24px !important; background: var(--color-text); }

    .comments-list {
      margin-bottom: 16px;
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .comment-item {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px;
      padding: 10px 14px;
    }

    .comment-author {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #c7d2fe;
      margin-bottom: 4px;
    }

    .comment-author mat-icon { font-size: 16px; width: 16px; height: 16px; color: rgba(255,255,255,0.3); }
    .comment-date { font-size: 11px; color: rgba(255,255,255,0.3); margin-left: auto; }
    .comment-content { margin: 0; font-size: 13px; color: rgba(255,255,255,0.6); line-height: 1.5; }

    :host ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.04) !important;
    }

    :host ::ng-deep .mdc-notched-outline__leading,
    :host ::ng-deep .mdc-notched-outline__notch,
    :host ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.1) !important;
    }

    :host ::ng-deep .mat-mdc-form-field-label,
    :host ::ng-deep .mdc-floating-label {
      color: rgba(255,255,255,0.5) !important;
    }

    :host ::ng-deep textarea {
      color: var(--color-surface-2) !important;
    }

    mat-dialog-actions {
      padding: 12px 24px 20px !important;
      margin: 0 !important;
      gap: 8px;
      background: var(--color-text);
      border-radius: 0 0 16px 16px;
    }

    :host ::ng-deep .mat-mdc-dialog-surface {
      background: var(--color-text) !important;
      border-radius: 16px !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
    }

    .cancel-btn { color: rgba(255,255,255,0.5) !important; }
    .cancel-btn:hover { background: rgba(255,255,255,0.05) !important; }
    .submit-btn {
      background: linear-gradient(135deg, var(--color-primary), #60a5fa) !important;
      color: white !important;
      padding: 0 24px !important;
      height: 40px;
      border-radius: 10px !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3) !important;
    }

    .submit-btn:hover {
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.45) !important;
    }

    .submit-btn mat-icon { margin-right: 6px; font-size: 18px; }
  `]
})
export class AddCommentDialogComponent {
  commentForm: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<AddCommentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { ticket: SupportTicket; author: string },
    private fb: FormBuilder
  ) {
    this.commentForm = this.fb.group({
      content: ['', Validators.required]
    });
  }

  onSubmit(): void {
    if (this.commentForm.valid) {
      this.dialogRef.close(this.commentForm.value);
    }
  }
}


