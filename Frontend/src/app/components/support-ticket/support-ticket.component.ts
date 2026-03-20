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
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="support-container">
      <!-- Modern Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon-wrapper">
              <mat-icon>support_agent</mat-icon>
            </div>
            <div class="header-text">
              <h1>Support Tickets</h1>
              <p class="header-subtitle">Track, manage & resolve support requests</p>
            </div>
          </div>
          <div class="header-actions">
            <mat-form-field appearance="outline" class="search-field">
              <mat-icon matPrefix>search</mat-icon>
              <input matInput [(ngModel)]="searchQuery" placeholder="Search tickets..." (input)="filterTickets()">
              @if (searchQuery) {
                <button matSuffix mat-icon-button (click)="searchQuery = ''; filterTickets()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </mat-form-field>
            <mat-form-field appearance="outline" class="period-field">
              <mat-select [(value)]="selectedDateRange" (selectionChange)="onDateRangeChange()">
                <mat-option value="today">Today</mat-option>
                <mat-option value="7days">7 Days</mat-option>
                <mat-option value="30days">30 Days</mat-option>
                <mat-option value="90days">90 Days</mat-option>
              </mat-select>
            </mat-form-field>
            <button mat-flat-button class="create-btn" (click)="openCreateTicketDialog()">
              <mat-icon>add</mat-icon>
              New Ticket
            </button>
          </div>
        </div>
      </div>

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
            <h3>Loading Support Tickets</h3>
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
                    <button mat-icon-button matTooltip="Add Comment" class="action-btn comment" (click)="openCommentDialog(ticket)">
                      <mat-icon>chat_bubble_outline</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Close Ticket" class="action-btn resolve" (click)="closeTicket(ticket)">
                      <mat-icon>check_circle_outline</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Delete Ticket" class="action-btn delete" (click)="deleteTicket(ticket)">
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
                    <button mat-icon-button matTooltip="Reopen Ticket" class="action-btn reopen" (click)="reopenTicket(ticket)">
                      <mat-icon>refresh</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Delete Ticket" class="action-btn delete" (click)="deleteTicket(ticket)">
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
    /* === Page Container === */
    :host {
      display: block;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      min-height: 100vh;
    }

    .support-container {
      padding: 88px 32px 40px;
      min-height: calc(100vh - 64px);
      background: transparent;
    }

    /* === Header === */
    .page-header {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 16px;
      padding: 28px 32px;
      margin-bottom: 24px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.15);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 20px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon-wrapper {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(233, 69, 96, 0.4);
    }

    .header-icon-wrapper mat-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: white;
    }

    .header-text h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
    }

    .header-subtitle {
      margin: 4px 0 0;
      font-size: 14px;
      color: rgba(255,255,255,0.6);
      font-weight: 400;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .search-field {
      width: 260px;
    }

    .search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.1) !important;
      border-radius: 10px !important;
    }

    .search-field ::ng-deep .mdc-notched-outline__leading,
    .search-field ::ng-deep .mdc-notched-outline__notch,
    .search-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.2) !important;
    }

    .search-field ::ng-deep input {
      color: white !important;
    }

    .search-field ::ng-deep input::placeholder {
      color: rgba(255,255,255,0.5) !important;
    }

    .search-field ::ng-deep .mat-mdc-form-field-icon-prefix mat-icon,
    .search-field ::ng-deep .mat-mdc-form-field-icon-suffix mat-icon {
      color: rgba(255,255,255,0.5) !important;
    }

    .search-field ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      min-height: 40px !important;
    }

    .period-field {
      width: 120px;
    }

    .period-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.1) !important;
      border-radius: 10px !important;
    }

    .period-field ::ng-deep .mdc-notched-outline__leading,
    .period-field ::ng-deep .mdc-notched-outline__notch,
    .period-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.2) !important;
    }

    .period-field ::ng-deep .mat-mdc-select-value-text {
      color: white !important;
    }

    .period-field ::ng-deep .mat-mdc-select-arrow {
      color: rgba(255,255,255,0.5) !important;
    }

    .period-field ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      min-height: 40px !important;
    }

    .create-btn {
      background: linear-gradient(135deg, #e94560 0%, #ff6b6b 100%) !important;
      color: white !important;
      padding: 0 24px !important;
      height: 44px;
      border-radius: 10px !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 16px rgba(233, 69, 96, 0.3) !important;
      transition: all 0.3s ease !important;
    }

    .create-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(233, 69, 96, 0.45) !important;
    }

    .create-btn mat-icon {
      margin-right: 6px;
      font-size: 20px;
    }

    /* === Stats Strip === */
    .stats-strip {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .stat-pill {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 14px 20px;
      min-width: 150px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      cursor: pointer;
      border: 2px solid rgba(255, 255, 255, 0.5);
      transition: all 0.25s ease;
    }

    .stat-pill:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.18);
    }

    .stat-pill.active {
      border-color: #fff;
      box-shadow: 0 6px 24px rgba(0,0,0,0.2);
    }

    .pill-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pill-icon mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: white;
    }

    .pill-icon.total { background: linear-gradient(135deg, #667eea, #764ba2); }
    .pill-icon.open { background: linear-gradient(135deg, #f093fb, #f5576c); }
    .pill-icon.closed { background: linear-gradient(135deg, #4facfe, #00f2fe); }
    .pill-icon.response { background: linear-gradient(135deg, #43e97b, #38f9d7); }
    .pill-icon.resolution { background: linear-gradient(135deg, #fa709a, #fee140); }

    .pill-info {
      display: flex;
      flex-direction: column;
    }

    .pill-value {
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1.2;
    }

    .pill-label {
      font-size: 12px;
      color: #9ca3af;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* === Loading === */
    .loading-state {
      display: flex; justify-content: center; padding: 60px 20px;
    }
    .loading-card {
      background: rgba(255,255,255,0.97); border-radius: 20px;
      padding: 48px 56px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: #1a1a2e; margin: 16px 0 6px; font-size: 20px; font-weight: 700; }
    .loading-card p { color: #64748b; margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.12));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(16,185,129,0.15);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #10b981; }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
    .lc-subtitle { color: #94a3b8 !important; font-size: 13px !important; }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track { height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; position: relative; }
    .lc-progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #10b981, #34d399, #06b6d4);
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
    .lc-progress-pct { color: #10b981; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
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
    .lc-step.active .lc-step-dot { background: linear-gradient(135deg, #10b981, #06b6d4); box-shadow: 0 2px 10px rgba(16,185,129,0.3); }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: #dcfce7; }
    .lc-step.done .lc-step-dot mat-icon { color: #16a34a; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #10b981; }
    .lc-step.done .lc-step-label { color: #16a34a; }

    /* === Tab Bar === */
    .tab-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 6px;
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      width: fit-content;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      transition: all 0.25s ease;
    }

    .tab-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      color: white;
    }

    .tab-btn.active {
      background: rgba(255, 255, 255, 0.95);
      color: #1a1a2e;
    }

    .tab-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
    }

    .badge.open { background: rgba(233, 69, 96, 0.15); color: #e94560; }
    .tab-btn.active .badge.open { background: rgba(233, 69, 96, 0.15); color: #e94560; }
    .badge.closed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
    .tab-btn.active .badge.closed { background: rgba(16, 185, 129, 0.15); color: #10b981; }

    /* === Tickets Grid === */
    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 16px;
    }

    /* === Ticket Card === */
    .ticket-card {
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      border-left: 4px solid #e5e7eb;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .ticket-card:hover {
      box-shadow: 0 8px 28px rgba(0,0,0,0.18);
      transform: translateY(-2px);
    }

    .ticket-card.border-low { border-left-color: #10b981; }
    .ticket-card.border-medium { border-left-color: #f59e0b; }
    .ticket-card.border-high { border-left-color: #ef4444; }
    .ticket-card.border-critical { border-left-color: #7f1d1d; }
    .ticket-card.closed-card { border-left-color: #6366f1; opacity: 0.9; }

    .ticket-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticket-id-badge {
      font-size: 12px;
      font-weight: 700;
      color: #9ca3af;
      background: #f3f4f6;
      padding: 3px 10px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }

    .ticket-priority {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .ticket-priority mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .ticket-priority.priority-low { background: #d1fae5; color: #065f46; }
    .ticket-priority.priority-medium { background: #fef3c7; color: #92400e; }
    .ticket-priority.priority-high { background: #fee2e2; color: #991b1b; }
    .ticket-priority.priority-critical { background: #fecaca; color: #7f1d1d; }
    .ticket-priority.resolved { background: #e0e7ff; color: #4338ca; }

    .ticket-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
      line-height: 1.4;
    }

    .ticket-desc {
      margin: 0;
      font-size: 13px;
      color: #6b7280;
      line-height: 1.6;
    }

    .ticket-tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 6px;
      letter-spacing: 0.3px;
    }

    .tag mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .tag.category { background: #f3f4f6; color: #4b5563; }
    .tag.status.open { background: #fff1f2; color: #e11d48; }
    .tag.status.closed { background: #ecfdf5; color: #059669; }

    .resolution-box {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: #166534;
      line-height: 1.5;
    }

    .resolution-box mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #16a34a;
      margin-top: 1px;
      flex-shrink: 0;
    }

    .ticket-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #f3f4f6;
      margin-top: auto;
    }

    .ticket-meta-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #9ca3af;
      font-weight: 500;
    }

    .meta-item mat-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
    }

    .ticket-card-actions {
      display: flex;
      gap: 2px;
    }

    .action-btn {
      width: 34px !important;
      height: 34px !important;
      transition: all 0.2s ease !important;
    }

    .action-btn mat-icon {
      font-size: 19px !important;
      width: 19px !important;
      height: 19px !important;
    }

    .action-btn.comment { color: #6366f1 !important; }
    .action-btn.comment:hover { background: #eef2ff !important; }
    .action-btn.resolve { color: #10b981 !important; }
    .action-btn.resolve:hover { background: #ecfdf5 !important; }
    .action-btn.reopen { color: #f59e0b !important; }
    .action-btn.reopen:hover { background: #fffbeb !important; }
    .action-btn.delete { color: #ef4444 !important; }
    .action-btn.delete:hover { background: #fef2f2 !important; }

    /* === Empty State === */
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 14px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .empty-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #d1d5db;
    }

    .empty-state h3 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
      color: #374151;
    }

    .empty-state p {
      margin: 0 0 20px;
      font-size: 14px;
      color: #9ca3af;
    }

    .empty-action {
      border-color: #e94560 !important;
      color: #e94560 !important;
    }

    /* === Responsive === */
    @media (max-width: 1024px) {
      .support-container { padding: 16px; }
      .page-header { padding: 20px; }
      .header-content { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; flex-wrap: wrap; }
      .search-field { width: 100%; flex: 1; }
      .stats-strip { flex-wrap: wrap; }
      .tickets-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 600px) {
      .stat-pill { min-width: 130px; padding: 10px 14px; }
      .ticket-footer { flex-direction: column; gap: 10px; align-items: flex-start; }
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
    private snackBar: MatSnackBar
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

  deleteTicket(ticket: SupportTicket): void {
    if (!confirm(`Delete ticket #${ticket.ticketId} "${ticket.title}"?`)) return;

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
                <mat-option value="IT Support">🖥️ IT Support</mat-option>
                <mat-option value="Software">💿 Software</mat-option>
                <mat-option value="Hardware">🔧 Hardware</mat-option>
                <mat-option value="Network">🌐 Network</mat-option>
                <mat-option value="Account">👤 Account</mat-option>
                <mat-option value="Access">🔑 Access</mat-option>
                <mat-option value="Other">📋 Other</mat-option>
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
    .dialog-wrapper { padding: 0; background: white; border-radius: 12px; }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 24px 8px;
      background: white;
      border-radius: 12px 12px 0 0;
    }

    .dialog-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #e94560, #ff6b6b);
      display: flex;
      align-items: center;
      justify-content: center;
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
      color: #1a1a2e;
    }

    mat-dialog-content {
      padding: 16px 24px !important;
      background: white;
    }

    .full-width { width: 100%; }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .half-width { flex: 1; }

    mat-dialog-actions {
      padding: 12px 24px 20px !important;
      margin: 0 !important;
      gap: 8px;
      background: white;
      border-radius: 0 0 12px 12px;
    }

    :host ::ng-deep .mat-mdc-dialog-surface {
      background: white !important;
      border-radius: 12px !important;
    }

    .cancel-btn {
      color: #6b7280 !important;
      font-weight: 500 !important;
    }

    .submit-btn {
      background: linear-gradient(135deg, #e94560, #ff6b6b) !important;
      color: white !important;
      padding: 0 24px !important;
      height: 40px;
      border-radius: 8px !important;
      font-weight: 600 !important;
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
    .dialog-wrapper { padding: 0; background: white; border-radius: 12px; }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 24px 8px;
      background: white;
      border-radius: 12px 12px 0 0;
    }

    .dialog-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #818cf8);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .dialog-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: white;
    }

    h2 { margin: 0; font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .dialog-sub { margin: 2px 0 0; font-size: 13px; color: #9ca3af; }

    mat-dialog-content { padding: 16px 24px !important; background: white; }

    .comments-list {
      margin-bottom: 16px;
      max-height: 200px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .comment-item {
      background: #f9fafb;
      border-radius: 8px;
      padding: 10px 14px;
    }

    .comment-author {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #374151;
      margin-bottom: 4px;
    }

    .comment-author mat-icon { font-size: 16px; width: 16px; height: 16px; color: #9ca3af; }
    .comment-date { font-size: 11px; color: #9ca3af; margin-left: auto; }
    .comment-content { margin: 0; font-size: 13px; color: #4b5563; line-height: 1.5; }

    mat-dialog-actions {
      padding: 12px 24px 20px !important;
      margin: 0 !important;
      gap: 8px;
      background: white;
      border-radius: 0 0 12px 12px;
    }

    :host ::ng-deep .mat-mdc-dialog-surface {
      background: white !important;
      border-radius: 12px !important;
    }

    .cancel-btn { color: #6b7280 !important; }
    .submit-btn {
      background: linear-gradient(135deg, #6366f1, #818cf8) !important;
      color: white !important;
      padding: 0 24px !important;
      height: 40px;
      border-radius: 8px !important;
      font-weight: 600 !important;
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


