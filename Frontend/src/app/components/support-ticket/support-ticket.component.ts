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
      <!-- Ambient Background Effects -->
      <div class="ambient-orb orb-1"></div>
      <div class="ambient-orb orb-2"></div>
      <div class="ambient-orb orb-3"></div>

      <!-- Modern Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon-wrapper">
              <mat-icon>support_agent</mat-icon>
              <div class="icon-ring"></div>
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
      background: #0a0a1a;
      min-height: 100vh;
      position: relative;
      overflow-x: hidden;
    }

    .support-container {
      padding: 88px 32px 40px;
      min-height: calc(100vh - 64px);
      background: transparent;
      position: relative;
      z-index: 1;
    }

    /* === Ambient Background Orbs === */
    .ambient-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(120px);
      opacity: 0.35;
      pointer-events: none;
      z-index: 0;
      animation: floatOrb 20s ease-in-out infinite;
    }

    .orb-1 {
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, #6366f1, transparent 70%);
      top: -100px;
      right: -100px;
      animation-delay: 0s;
    }

    .orb-2 {
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, #06b6d4, transparent 70%);
      bottom: -50px;
      left: -80px;
      animation-delay: -7s;
    }

    .orb-3 {
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, #e94560, transparent 70%);
      top: 40%;
      left: 50%;
      animation-delay: -14s;
    }

    @keyframes floatOrb {
      0%, 100% { transform: translate(0, 0) scale(1); }
      25% { transform: translate(30px, -20px) scale(1.05); }
      50% { transform: translate(-20px, 30px) scale(0.95); }
      75% { transform: translate(15px, 15px) scale(1.02); }
    }

    /* === Header === */
    .page-header {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 28px 32px;
      margin-bottom: 24px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
      position: relative;
      overflow: hidden;
    }

    .page-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), rgba(6, 182, 212, 0.5), transparent);
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
      border-radius: 16px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);
      position: relative;
      animation: iconPulse 3s ease-in-out infinite;
    }

    @keyframes iconPulse {
      0%, 100% { box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4); }
      50% { box-shadow: 0 8px 32px rgba(99, 102, 241, 0.6); }
    }

    .icon-ring {
      position: absolute;
      inset: -4px;
      border-radius: 20px;
      border: 2px solid rgba(99, 102, 241, 0.3);
      animation: ringPulse 3s ease-in-out infinite;
    }

    @keyframes ringPulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 0; transform: scale(1.15); }
    }

    .header-icon-wrapper mat-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: white;
    }

    .header-text h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(135deg, #ffffff 0%, #c7d2fe 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }

    .header-subtitle {
      margin: 4px 0 0;
      font-size: 14px;
      color: rgba(255,255,255,0.45);
      font-weight: 400;
      letter-spacing: 0.2px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .search-field {
      width: 280px;
    }

    .search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.06) !important;
      border-radius: 12px !important;
    }

    .search-field ::ng-deep .mdc-notched-outline__leading,
    .search-field ::ng-deep .mdc-notched-outline__notch,
    .search-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.1) !important;
    }

    .search-field:hover ::ng-deep .mdc-notched-outline__leading,
    .search-field:hover ::ng-deep .mdc-notched-outline__notch,
    .search-field:hover ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(99, 102, 241, 0.4) !important;
    }

    .search-field ::ng-deep input {
      color: rgba(255,255,255,0.9) !important;
    }

    .search-field ::ng-deep input::placeholder {
      color: rgba(255,255,255,0.35) !important;
    }

    .search-field ::ng-deep .mat-mdc-form-field-icon-prefix mat-icon,
    .search-field ::ng-deep .mat-mdc-form-field-icon-suffix mat-icon {
      color: rgba(255,255,255,0.35) !important;
    }

    .search-field ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      min-height: 40px !important;
    }

    .period-field {
      width: 130px;
    }

    .period-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.06) !important;
      border-radius: 12px !important;
    }

    .period-field ::ng-deep .mdc-notched-outline__leading,
    .period-field ::ng-deep .mdc-notched-outline__notch,
    .period-field ::ng-deep .mdc-notched-outline__trailing {
      border-color: rgba(255,255,255,0.1) !important;
    }

    .period-field ::ng-deep .mat-mdc-select-value-text {
      color: rgba(255,255,255,0.9) !important;
    }

    .period-field ::ng-deep .mat-mdc-select-arrow {
      color: rgba(255,255,255,0.35) !important;
    }

    .period-field ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 8px !important;
      padding-bottom: 8px !important;
      min-height: 40px !important;
    }

    .create-btn {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
      color: white !important;
      padding: 0 28px !important;
      height: 44px;
      border-radius: 12px !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35) !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      border: 1px solid rgba(139, 92, 246, 0.3) !important;
    }

    .create-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 28px rgba(99, 102, 241, 0.5) !important;
    }

    .create-btn mat-icon {
      margin-right: 6px;
      font-size: 20px;
    }

    /* === Stats Strip === */
    .stats-strip {
      display: flex;
      gap: 14px;
      margin-bottom: 28px;
      overflow-x: auto;
      padding-bottom: 4px;
    }

    .stat-pill {
      display: flex;
      align-items: center;
      gap: 14px;
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 16px;
      padding: 16px 22px;
      min-width: 160px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.06);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .stat-pill::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 16px;
      padding: 1px;
      background: linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.1));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    .stat-pill:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 28px rgba(0,0,0,0.3);
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .stat-pill.active {
      background: rgba(99, 102, 241, 0.12);
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 8px 28px rgba(99, 102, 241, 0.2);
    }

    .pill-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .pill-icon mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: white;
    }

    .pill-icon.total { background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
    .pill-icon.open { background: linear-gradient(135deg, #ef4444, #f97316); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
    .pill-icon.closed { background: linear-gradient(135deg, #10b981, #06b6d4); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); }
    .pill-icon.response { background: linear-gradient(135deg, #f59e0b, #eab308); box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); }
    .pill-icon.resolution { background: linear-gradient(135deg, #ec4899, #f43f5e); box-shadow: 0 4px 12px rgba(236, 72, 153, 0.3); }

    .pill-info {
      display: flex;
      flex-direction: column;
    }

    .pill-value {
      font-size: 22px;
      font-weight: 800;
      color: #f1f5f9;
      line-height: 1.2;
      font-variant-numeric: tabular-nums;
    }

    .pill-label {
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    /* === Loading === */
    .loading-state {
      display: flex; justify-content: center; padding: 60px 20px;
    }
    .loading-card {
      background: rgba(255,255,255,0.05); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255,255,255,0.08); border-radius: 24px;
      padding: 48px 56px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.3);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: #f1f5f9; margin: 16px 0 6px; font-size: 20px; font-weight: 700; }
    .loading-card p { color: rgba(255,255,255,0.5); margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.15));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(99,102,241,0.2);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #818cf8; }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
    .lc-subtitle { color: rgba(255,255,255,0.4) !important; font-size: 13px !important; }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track { height: 6px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow: hidden; position: relative; }
    .lc-progress-fill {
      height: 100%; border-radius: 3px;
      background: linear-gradient(90deg, #6366f1, #818cf8, #06b6d4);
      background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite;
      transition: width 0.15s ease-out; position: relative;
    }
    .lc-progress-fill::after {
      content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3)); border-radius: 0 3px 3px 0;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .lc-progress-info { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; }
    .lc-progress-message { color: rgba(255,255,255,0.5); font-weight: 500; }
    .lc-progress-pct { color: #818cf8; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
    .lc-steps { display: flex; justify-content: space-between; gap: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06); }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.3; transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.6; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.06);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; color: rgba(255,255,255,0.3); transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot { background: linear-gradient(135deg, #6366f1, #06b6d4); box-shadow: 0 2px 12px rgba(99,102,241,0.4); }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: rgba(16,185,129,0.15); }
    .lc-step.done .lc-step-dot mat-icon { color: #10b981; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.3); white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #818cf8; }
    .lc-step.done .lc-step-label { color: #10b981; }

    /* === Tab Bar === */
    .tab-bar {
      display: flex;
      gap: 6px;
      margin-bottom: 24px;
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.06);
      padding: 5px;
      border-radius: 14px;
      width: fit-content;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 22px;
      border: none;
      background: transparent;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.45);
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .tab-btn:hover {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.8);
    }

    .tab-btn.active {
      background: rgba(99, 102, 241, 0.15);
      color: #c7d2fe;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
    }

    .tab-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 9px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
    }

    .badge.open { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
    .tab-btn.active .badge.open { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
    .badge.closed { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }
    .tab-btn.active .badge.closed { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }

    /* === Tickets Grid === */
    .tickets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 18px;
      animation: fadeInUp 0.4s ease-out;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* === Ticket Card === */
    .ticket-card {
      background: rgba(255, 255, 255, 0.04);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 16px;
      padding: 22px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-left: 4px solid rgba(255,255,255,0.1);
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      flex-direction: column;
      gap: 14px;
      position: relative;
      overflow: hidden;
    }

    .ticket-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
    }

    .ticket-card:hover {
      box-shadow: 0 12px 40px rgba(0,0,0,0.35);
      transform: translateY(-4px);
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.1);
    }

    .ticket-card.border-low { border-left-color: #10b981; }
    .ticket-card.border-low:hover { box-shadow: 0 12px 40px rgba(16, 185, 129, 0.15); }
    .ticket-card.border-medium { border-left-color: #f59e0b; }
    .ticket-card.border-medium:hover { box-shadow: 0 12px 40px rgba(245, 158, 11, 0.15); }
    .ticket-card.border-high { border-left-color: #ef4444; }
    .ticket-card.border-high:hover { box-shadow: 0 12px 40px rgba(239, 68, 68, 0.15); }
    .ticket-card.border-critical { border-left-color: #dc2626; }
    .ticket-card.border-critical:hover { box-shadow: 0 12px 40px rgba(220, 38, 38, 0.2); }
    .ticket-card.closed-card { border-left-color: #6366f1; opacity: 0.85; }
    .ticket-card.closed-card:hover { opacity: 1; box-shadow: 0 12px 40px rgba(99, 102, 241, 0.15); }

    .ticket-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .ticket-id-badge {
      font-size: 12px;
      font-weight: 700;
      color: rgba(255,255,255,0.4);
      background: rgba(255,255,255,0.06);
      padding: 4px 12px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      font-variant-numeric: tabular-nums;
    }

    .ticket-priority {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 700;
      padding: 5px 12px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    .ticket-priority mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .ticket-priority.priority-low { background: rgba(16, 185, 129, 0.12); color: #6ee7b7; }
    .ticket-priority.priority-medium { background: rgba(245, 158, 11, 0.12); color: #fcd34d; }
    .ticket-priority.priority-high { background: rgba(239, 68, 68, 0.12); color: #fca5a5; }
    .ticket-priority.priority-critical { background: rgba(220, 38, 38, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.2); }
    .ticket-priority.resolved { background: rgba(99, 102, 241, 0.12); color: #a5b4fc; }

    .ticket-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.4;
    }

    .ticket-desc {
      margin: 0;
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      line-height: 1.7;
    }

    .ticket-tags {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 8px;
      letter-spacing: 0.3px;
    }

    .tag mat-icon {
      font-size: 13px;
      width: 13px;
      height: 13px;
    }

    .tag.category { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
    .tag.status.open { background: rgba(239, 68, 68, 0.1); color: #fca5a5; }
    .tag.status.closed { background: rgba(16, 185, 129, 0.1); color: #6ee7b7; }

    .resolution-box {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: rgba(16, 185, 129, 0.06);
      border: 1px solid rgba(16, 185, 129, 0.15);
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 13px;
      color: #6ee7b7;
      line-height: 1.6;
    }

    .resolution-box mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #10b981;
      margin-top: 1px;
      flex-shrink: 0;
    }

    .ticket-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,0.06);
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
      gap: 5px;
      font-size: 12px;
      color: rgba(255,255,255,0.3);
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
      width: 36px !important;
      height: 36px !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      border-radius: 10px !important;
    }

    .action-btn mat-icon {
      font-size: 19px !important;
      width: 19px !important;
      height: 19px !important;
    }

    .action-btn.comment { color: #818cf8 !important; }
    .action-btn.comment:hover { background: rgba(99, 102, 241, 0.12) !important; }
    .action-btn.resolve { color: #34d399 !important; }
    .action-btn.resolve:hover { background: rgba(16, 185, 129, 0.12) !important; }
    .action-btn.reopen { color: #fbbf24 !important; }
    .action-btn.reopen:hover { background: rgba(245, 158, 11, 0.12) !important; }
    .action-btn.delete { color: #f87171 !important; }
    .action-btn.delete:hover { background: rgba(239, 68, 68, 0.12) !important; }

    /* === Empty State === */
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 60px 20px;
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.06);
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .empty-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: rgba(255,255,255,0.2);
    }

    .empty-state h3 {
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 600;
      color: rgba(255,255,255,0.7);
    }

    .empty-state p {
      margin: 0 0 20px;
      font-size: 14px;
      color: rgba(255,255,255,0.35);
    }

    .empty-action {
      border-color: rgba(99, 102, 241, 0.5) !important;
      color: #a5b4fc !important;
    }

    .empty-action:hover {
      background: rgba(99, 102, 241, 0.1) !important;
    }

    /* === Responsive === */
    @media (max-width: 1024px) {
      .support-container { padding: 80px 16px 32px; }
      .page-header { padding: 20px; }
      .header-content { flex-direction: column; align-items: flex-start; }
      .header-actions { width: 100%; flex-wrap: wrap; }
      .search-field { width: 100%; flex: 1; }
      .stats-strip { flex-wrap: wrap; }
      .tickets-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 600px) {
      .stat-pill { min-width: 140px; padding: 12px 16px; }
      .ticket-footer { flex-direction: column; gap: 10px; align-items: flex-start; }
      .ambient-orb { display: none; }
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
    .dialog-wrapper { padding: 0; background: #1a1a2e; border-radius: 16px; }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 24px 8px;
      background: #1a1a2e;
      border-radius: 16px 16px 0 0;
    }

    .dialog-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
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
      color: #f1f5f9;
    }

    mat-dialog-content {
      padding: 16px 24px !important;
      background: #1a1a2e;
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
      color: #f1f5f9 !important;
    }

    :host ::ng-deep .mat-mdc-select-value-text {
      color: #f1f5f9 !important;
    }

    :host ::ng-deep .mat-mdc-form-field-icon-prefix mat-icon {
      color: rgba(255,255,255,0.4) !important;
    }

    mat-dialog-actions {
      padding: 12px 24px 20px !important;
      margin: 0 !important;
      gap: 8px;
      background: #1a1a2e;
      border-radius: 0 0 16px 16px;
    }

    :host ::ng-deep .mat-mdc-dialog-surface {
      background: #1a1a2e !important;
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
      background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
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
    .dialog-wrapper { padding: 0; background: #1a1a2e; border-radius: 16px; }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 24px 24px 8px;
      background: #1a1a2e;
      border-radius: 16px 16px 0 0;
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
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .dialog-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: white;
    }

    h2 { margin: 0; font-size: 18px; font-weight: 700; color: #f1f5f9; }
    .dialog-sub { margin: 2px 0 0; font-size: 13px; color: rgba(255,255,255,0.35); }

    mat-dialog-content { padding: 16px 24px !important; background: #1a1a2e; }

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
      color: #f1f5f9 !important;
    }

    mat-dialog-actions {
      padding: 12px 24px 20px !important;
      margin: 0 !important;
      gap: 8px;
      background: #1a1a2e;
      border-radius: 0 0 16px 16px;
    }

    :host ::ng-deep .mat-mdc-dialog-surface {
      background: #1a1a2e !important;
      border-radius: 16px !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
    }

    .cancel-btn { color: rgba(255,255,255,0.5) !important; }
    .cancel-btn:hover { background: rgba(255,255,255,0.05) !important; }
    .submit-btn {
      background: linear-gradient(135deg, #6366f1, #818cf8) !important;
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


