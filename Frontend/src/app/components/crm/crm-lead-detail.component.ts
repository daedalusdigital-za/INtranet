import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { CrmService, Lead, LeadLog, LeadStatus, Disposition, Promotion, LeadAssignmentHistory } from '../../services/crm/crm.service';

@Component({
  selector: 'app-crm-lead-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatTabsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatExpansionModule,
    MatCheckboxModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="lead-detail-container">
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
        </div>
      } @else if (lead()) {
        <!-- Header -->
        <div class="lead-header">
          <div class="header-left">
            <button mat-icon-button routerLink="/crm/leads">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="lead-title">
              <h1>{{ lead()?.firstName }} {{ lead()?.lastName }}</h1>
              @if (lead()?.companyName) {
                <span class="company-name">{{ lead()?.companyName }}</span>
              }
            </div>
            @if (lead()?.isHot) {
              <mat-icon class="hot-badge" matTooltip="Hot Lead">local_fire_department</mat-icon>
            }
            @if (lead()?.doNotCall) {
              <span class="dnc-badge">DNC</span>
            }
          </div>
          <div class="header-actions">
            <button mat-raised-button color="primary" (click)="showCallLog = true">
              <mat-icon>phone</mat-icon>
              Log Call
            </button>
            <button mat-raised-button (click)="editMode = !editMode">
              <mat-icon>{{ editMode ? 'close' : 'edit' }}</mat-icon>
              {{ editMode ? 'Cancel' : 'Edit' }}
            </button>
          </div>
        </div>

        <div class="lead-content">
          <!-- Left Column: Lead Info -->
          <div class="lead-info-section">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Contact Information</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (!editMode) {
                  <div class="info-grid">
                    <div class="info-item">
                      <span class="info-label">Phone</span>
                      <a href="tel:{{ lead()?.phone }}" class="info-value phone-link">
                        <mat-icon>phone</mat-icon>
                        {{ lead()?.phone || 'Not provided' }}
                      </a>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Mobile</span>
                      <a href="tel:{{ lead()?.mobilePhone }}" class="info-value phone-link">
                        <mat-icon>phone_android</mat-icon>
                        {{ lead()?.mobilePhone || 'Not provided' }}
                      </a>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Email</span>
                      <a href="mailto:{{ lead()?.email }}" class="info-value">
                        {{ lead()?.email || 'Not provided' }}
                      </a>
                    </div>
                    <div class="info-item">
                      <span class="info-label">Job Title</span>
                      <span class="info-value">{{ lead()?.jobTitle || 'Not provided' }}</span>
                    </div>
                    <div class="info-item full-width">
                      <span class="info-label">Location</span>
                      <span class="info-value">{{ lead()?.city }}{{ lead()?.province ? ', ' + lead()?.province : '' }}</span>
                    </div>
                  </div>
                } @else {
                  <!-- Edit Form -->
                  <form [formGroup]="editForm" class="edit-form">
                    <mat-form-field appearance="outline">
                      <mat-label>First Name</mat-label>
                      <input matInput formControlName="firstName">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Last Name</mat-label>
                      <input matInput formControlName="lastName">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Company</mat-label>
                      <input matInput formControlName="companyName">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Job Title</mat-label>
                      <input matInput formControlName="jobTitle">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Phone</mat-label>
                      <input matInput formControlName="phone">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Mobile</mat-label>
                      <input matInput formControlName="mobilePhone">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Email</mat-label>
                      <input matInput formControlName="email" type="email">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>City</mat-label>
                      <input matInput formControlName="city">
                    </mat-form-field>
                    <mat-form-field appearance="outline">
                      <mat-label>Province</mat-label>
                      <input matInput formControlName="province">
                    </mat-form-field>
                    <div class="form-actions">
                      <button mat-raised-button color="primary" (click)="saveLead()" [disabled]="!editForm.valid">
                        Save Changes
                      </button>
                    </div>
                  </form>
                }
              </mat-card-content>
            </mat-card>

            <!-- Status & Assignment Card -->
            <mat-card>
              <mat-card-header>
                <mat-card-title>Status & Assignment</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="status-section">
                  <div class="status-item">
                    <span class="status-label">Status</span>
                    @if (lead()?.leadStatusName) {
                      <span class="status-chip" [style.background-color]="lead()?.leadStatusColor">
                        {{ lead()?.leadStatusName }}
                      </span>
                    }
                  </div>
                  <div class="status-item">
                    <span class="status-label">Assigned To</span>
                    <span class="status-value">{{ lead()?.assignedAgentName || 'Unassigned' }}</span>
                  </div>
                  <div class="status-item">
                    <span class="status-label">Last Disposition</span>
                    <span class="status-value">{{ lead()?.lastDispositionName || 'None' }}</span>
                  </div>
                  <div class="status-item">
                    <span class="status-label">Call Attempts</span>
                    <span class="status-value">{{ lead()?.totalCallAttempts }}</span>
                  </div>
                  @if (lead()?.nextCallbackAt) {
                    <div class="status-item callback" [class.overdue]="isOverdue(lead()?.nextCallbackAt)">
                      <span class="status-label">Next Callback</span>
                      <span class="status-value">
                        <mat-icon>schedule</mat-icon>
                        {{ lead()?.nextCallbackAt | date:'medium' }}
                      </span>
                    </div>
                  }
                </div>

                @if (!editMode) {
                  <mat-divider></mat-divider>
                  <div class="quick-actions">
                    <mat-form-field appearance="outline">
                      <mat-label>Change Status</mat-label>
                      <mat-select [value]="lead()?.leadStatusId" (selectionChange)="updateStatus($event.value)">
                        @for (status of statuses(); track status.leadStatusId) {
                          <mat-option [value]="status.leadStatusId">
                            <span class="status-dot" [style.background-color]="status.color"></span>
                            {{ status.name }}
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                }
              </mat-card-content>
            </mat-card>

            <!-- Notes Card -->
            <mat-card>
              <mat-card-header>
                <mat-card-title>Notes</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                @if (editMode) {
                  <mat-form-field appearance="outline" class="full-width">
                    <textarea matInput [formControl]="notesControl" rows="4"></textarea>
                  </mat-form-field>
                } @else {
                  <p class="notes-text">{{ lead()?.notes || 'No notes added' }}</p>
                }
              </mat-card-content>
            </mat-card>
          </div>

          <!-- Right Column: Call Log & History -->
          <div class="activity-section">
            <mat-card class="activity-card">
              <mat-tab-group>
                <!-- Call History Tab -->
                <mat-tab label="Call History">
                  <div class="tab-content">
                    @if (logs().length > 0) {
                      <div class="timeline">
                        @for (log of logs(); track log.leadLogId) {
                          <div class="timeline-item">
                            <div class="timeline-marker" [class.positive]="log.isPositiveOutcome"></div>
                            <div class="timeline-content">
                              <div class="timeline-header">
                                <span class="log-type">{{ log.logType }}</span>
                                <span class="log-time">{{ log.logDateTime | date:'short' }}</span>
                              </div>
                              <div class="log-details">
                                <span class="log-agent">{{ log.agentName }}</span>
                                @if (log.dispositionName) {
                                  <span class="disposition-badge" [style.background-color]="log.dispositionColor || '#9e9e9e'">
                                    {{ log.dispositionName }}
                                  </span>
                                }
                                @if (log.durationSeconds) {
                                  <span class="log-duration">{{ formatDuration(log.durationSeconds) }}</span>
                                }
                              </div>
                              @if (log.notes) {
                                <p class="log-notes">{{ log.notes }}</p>
                              }
                              @if (log.scheduledCallbackAt) {
                                <div class="callback-scheduled">
                                  <mat-icon>schedule</mat-icon>
                                  Callback: {{ log.scheduledCallbackAt | date:'short' }}
                                </div>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="empty-state">
                        <mat-icon>phone_missed</mat-icon>
                        <p>No call history yet</p>
                      </div>
                    }
                  </div>
                </mat-tab>

                <!-- Assignment History Tab -->
                <mat-tab label="Assignment History">
                  <div class="tab-content">
                    @if (assignmentHistory().length > 0) {
                      <div class="timeline">
                        @for (history of assignmentHistory(); track history.leadAssignmentHistoryId) {
                          <div class="timeline-item">
                            <div class="timeline-marker assignment"></div>
                            <div class="timeline-content">
                              <div class="timeline-header">
                                <span class="log-type">Assignment Change</span>
                                <span class="log-time">{{ history.changedAt | date:'short' }}</span>
                              </div>
                              <p class="assignment-detail">
                                @if (history.previousAgentName) {
                                  {{ history.previousAgentName }} → 
                                }
                                <strong>{{ history.newAgentName || 'Unassigned' }}</strong>
                              </p>
                              @if (history.reason) {
                                <p class="log-notes">{{ history.reason }}</p>
                              }
                              <span class="changed-by">by {{ history.changedByName }}</span>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="empty-state">
                        <mat-icon>assignment_ind</mat-icon>
                        <p>No assignment history</p>
                      </div>
                    }
                  </div>
                </mat-tab>
              </mat-tab-group>
            </mat-card>
          </div>
        </div>

        <!-- Call Log Dialog Overlay -->
        @if (showCallLog) {
          <div class="call-log-overlay" (click)="showCallLog = false">
            <mat-card class="call-log-card" (click)="$event.stopPropagation()">
              <mat-card-header>
                <mat-card-title>Log Call</mat-card-title>
                <button mat-icon-button (click)="showCallLog = false">
                  <mat-icon>close</mat-icon>
                </button>
              </mat-card-header>
              <mat-card-content>
                <form [formGroup]="callLogForm" class="call-log-form">
                  <mat-form-field appearance="outline">
                    <mat-label>Call Type</mat-label>
                    <mat-select formControlName="logType">
                      <mat-option value="Call">Outbound Call</mat-option>
                      <mat-option value="Inbound">Inbound Call</mat-option>
                      <mat-option value="Email">Email</mat-option>
                      <mat-option value="SMS">SMS</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Duration (seconds)</mat-label>
                    <input matInput type="number" formControlName="durationSeconds">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Disposition</mat-label>
                    <mat-select formControlName="dispositionId">
                      @for (disp of dispositions(); track disp.dispositionId) {
                        <mat-option [value]="disp.dispositionId">
                          {{ disp.name }}
                          @if (disp.requiresCallback) {
                            <mat-icon class="disp-icon">schedule</mat-icon>
                          }
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  @if (selectedDisposition()?.requiresCallback) {
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Schedule Callback</mat-label>
                      <input matInput type="datetime-local" formControlName="scheduledCallbackAt">
                    </mat-form-field>
                  }

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Update Status</mat-label>
                    <mat-select formControlName="newLeadStatusId">
                      <mat-option [value]="null">Keep Current Status</mat-option>
                      @for (status of statuses(); track status.leadStatusId) {
                        <mat-option [value]="status.leadStatusId">
                          <span class="status-dot" [style.background-color]="status.color"></span>
                          {{ status.name }}
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Notes</mat-label>
                    <textarea matInput formControlName="notes" rows="3" 
                              [required]="selectedDisposition()?.requiresNotes ?? false"></textarea>
                  </mat-form-field>

                  <mat-checkbox formControlName="wasContacted">Contact was made</mat-checkbox>

                  <div class="form-actions">
                    <button mat-button (click)="showCallLog = false">Cancel</button>
                    <button mat-raised-button color="primary" (click)="submitCallLog()" 
                            [disabled]="!callLogForm.valid || submitting()">
                      {{ submitting() ? 'Saving...' : 'Save Call Log' }}
                    </button>
                  </div>
                </form>
              </mat-card-content>
            </mat-card>
          </div>
        }
      } @else {
        <div class="not-found">
          <mat-icon>error</mat-icon>
          <h2>Lead not found</h2>
          <button mat-raised-button routerLink="/crm/leads">Back to Leads</button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .lead-detail-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .loading-container, .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
    }

    .not-found mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #f44336;
      margin-bottom: 16px;
    }

    .lead-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .lead-title h1 {
      margin: 0;
      font-size: 24px;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .company-name {
      font-size: 14px;
      color: #666;
    }

    .hot-badge {
      color: #ff9800;
      font-size: 28px !important;
    }

    .dnc-badge {
      padding: 4px 8px;
      background: #f44336;
      color: white;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .lead-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .lead-info-section, .activity-section {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    mat-card-header {
      border-bottom: 1px solid #eee;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .info-item.full-width {
      grid-column: 1 / -1;
    }

    .info-label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 14px;
      font-weight: 500;
    }

    .phone-link {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #1976d2;
      text-decoration: none;
    }

    .phone-link mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .edit-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .edit-form .full-width {
      grid-column: 1 / -1;
    }

    .form-actions {
      grid-column: 1 / -1;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }

    .status-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-label {
      font-size: 14px;
      color: #666;
    }

    .status-value {
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .status-chip {
      padding: 4px 12px;
      border-radius: 12px;
      color: white;
      font-size: 12px;
    }

    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .callback {
      padding: 8px;
      background: #e3f2fd;
      border-radius: 8px;
    }

    .callback.overdue {
      background: #ffebee;
      color: #c62828;
    }

    .quick-actions {
      padding-top: 16px;
    }

    .quick-actions mat-form-field {
      width: 100%;
    }

    .notes-text {
      white-space: pre-wrap;
      color: #666;
    }

    .activity-card {
      height: 100%;
    }

    .tab-content {
      padding: 16px 0;
      max-height: 500px;
      overflow-y: auto;
    }

    .timeline {
      position: relative;
      padding-left: 24px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #e0e0e0;
    }

    .timeline-item {
      position: relative;
      padding-bottom: 24px;
    }

    .timeline-marker {
      position: absolute;
      left: -20px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #9e9e9e;
      border: 2px solid white;
    }

    .timeline-marker.positive {
      background: #4caf50;
    }

    .timeline-marker.assignment {
      background: #2196f3;
    }

    .timeline-content {
      background: #f9f9f9;
      padding: 12px;
      border-radius: 8px;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .log-type {
      font-weight: 500;
    }

    .log-time {
      font-size: 12px;
      color: #666;
    }

    .log-details {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .log-agent {
      font-size: 13px;
    }

    .disposition-badge {
      padding: 2px 8px;
      border-radius: 8px;
      color: white;
      font-size: 11px;
    }

    .log-duration {
      font-size: 12px;
      color: #666;
    }

    .log-notes {
      font-size: 13px;
      color: #666;
      margin: 8px 0 0;
      white-space: pre-wrap;
    }

    .callback-scheduled {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #1976d2;
      margin-top: 8px;
    }

    .callback-scheduled mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .assignment-detail {
      font-size: 14px;
      margin: 4px 0;
    }

    .changed-by {
      font-size: 12px;
      color: #999;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    /* Call Log Overlay */
    .call-log-overlay {
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

    .call-log-card {
      width: 500px;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
    }

    .call-log-card mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .call-log-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .call-log-form .full-width {
      grid-column: 1 / -1;
    }

    .call-log-form mat-checkbox {
      grid-column: 1 / -1;
    }

    .disp-icon {
      font-size: 16px;
      margin-left: 4px;
    }

    @media (max-width: 1024px) {
      .lead-content {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 600px) {
      .lead-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .info-grid, .edit-form, .call-log-form {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CrmLeadDetailComponent implements OnInit {
  private crmService = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  lead = signal<Lead | null>(null);
  logs = signal<LeadLog[]>([]);
  assignmentHistory = signal<LeadAssignmentHistory[]>([]);
  statuses = this.crmService.leadStatuses;
  dispositions = this.crmService.dispositions;
  loading = signal(true);
  submitting = signal(false);
  editMode = false;
  showCallLog = false;

  editForm: FormGroup;
  callLogForm: FormGroup;
  notesControl = this.fb.control('');

  selectedDisposition = signal<Disposition | null>(null);

  constructor() {
    this.editForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: [''],
      companyName: [''],
      jobTitle: [''],
      phone: [''],
      mobilePhone: [''],
      email: ['', Validators.email],
      city: [''],
      province: ['']
    });

    this.callLogForm = this.fb.group({
      logType: ['Call', Validators.required],
      durationSeconds: [null],
      dispositionId: [null],
      scheduledCallbackAt: [null],
      newLeadStatusId: [null],
      notes: [''],
      wasContacted: [false]
    });

    // Watch disposition changes
    this.callLogForm.get('dispositionId')?.valueChanges.subscribe(id => {
      const disp = this.dispositions().find(d => d.dispositionId === id);
      this.selectedDisposition.set(disp || null);
    });
  }

  ngOnInit() {
    const leadId = this.route.snapshot.params['id'];
    if (leadId) {
      this.loadLead(+leadId);
    }

    this.crmService.getOperatingCompanies().subscribe();
  }

  loadLead(id: number) {
    this.loading.set(true);
    
    this.crmService.getLead(id).subscribe({
      next: (lead) => {
        this.lead.set(lead);
        this.populateEditForm(lead);
        this.notesControl.setValue(lead.notes || '');
        this.loading.set(false);
        this.loadLogs(id);
        this.loadAssignmentHistory(id);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadLogs(leadId: number) {
    this.crmService.getLeadLogs(leadId).subscribe(logs => {
      this.logs.set(logs);
    });
  }

  loadAssignmentHistory(leadId: number) {
    this.crmService.getLeadAssignmentHistory(leadId).subscribe(history => {
      this.assignmentHistory.set(history);
    });
  }

  populateEditForm(lead: Lead) {
    this.editForm.patchValue({
      firstName: lead.firstName,
      lastName: lead.lastName,
      companyName: lead.companyName,
      jobTitle: lead.jobTitle,
      phone: lead.phone,
      mobilePhone: lead.mobilePhone,
      email: lead.email,
      city: lead.city,
      province: lead.province
    });
  }

  saveLead() {
    if (!this.lead() || !this.editForm.valid) return;

    const updates = {
      ...this.editForm.value,
      notes: this.notesControl.value
    };

    this.crmService.updateLead(this.lead()!.leadId, updates).subscribe({
      next: () => {
        this.snackBar.open('Lead updated successfully', 'Close', { duration: 3000 });
        this.editMode = false;
        this.loadLead(this.lead()!.leadId);
      },
      error: () => {
        this.snackBar.open('Failed to update lead', 'Close', { duration: 3000 });
      }
    });
  }

  updateStatus(statusId: number) {
    if (!this.lead()) return;

    this.crmService.updateLead(this.lead()!.leadId, { leadStatusId: statusId }).subscribe({
      next: () => {
        this.snackBar.open('Status updated', 'Close', { duration: 3000 });
        this.loadLead(this.lead()!.leadId);
      }
    });
  }

  submitCallLog() {
    if (!this.lead() || !this.callLogForm.valid) return;

    this.submitting.set(true);
    const formValue = this.callLogForm.value;

    this.crmService.logCall(this.lead()!.leadId, formValue).subscribe({
      next: () => {
        this.snackBar.open('Call logged successfully', 'Close', { duration: 3000 });
        this.showCallLog = false;
        this.submitting.set(false);
        this.callLogForm.reset({ logType: 'Call', wasContacted: false });
        this.loadLead(this.lead()!.leadId);
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open('Failed to log call', 'Close', { duration: 3000 });
      }
    });
  }

  isOverdue(date: Date | null | undefined): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
