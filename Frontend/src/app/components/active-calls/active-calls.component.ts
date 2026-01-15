import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { interval, Subscription, Subject } from 'rxjs';
import { takeUntil, switchMap, startWith } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { ActiveCall, ActiveCallsResponse, CdrRecord, CdrResponse, ExtensionStatus, PbxStatus, CdrQuery } from '../../models/models';

@Component({
  selector: 'app-active-calls',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTabsModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDividerModule,
    MatExpansionModule,
    MatSlideToggleModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="active-calls-container">
      <!-- Header Section -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-title">
            <mat-icon class="header-icon">phone_in_talk</mat-icon>
            <div>
              <h1>PBX Active Calls Monitor</h1>
              <p class="subtitle">Real-time call monitoring and history</p>
            </div>
          </div>
          <div class="header-actions">
            <button mat-stroked-button (click)="testConnection()" [disabled]="testingConnection">
              <mat-icon>network_check</mat-icon>
              Test Connection
            </button>
            <mat-slide-toggle 
              [(ngModel)]="autoRefresh" 
              (change)="toggleAutoRefresh()"
              color="primary">
              Auto Refresh
            </mat-slide-toggle>
            <button mat-icon-button (click)="refresh()" matTooltip="Refresh Now">
              <mat-icon>refresh</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Status Cards -->
      <div class="status-cards">
        <mat-card class="status-card connected" [class.error]="!pbxStatus?.connected">
          <mat-card-content>
            <div class="status-icon">
              <mat-icon>{{ pbxStatus?.connected ? 'check_circle' : 'error' }}</mat-icon>
            </div>
            <div class="status-info">
              <span class="label">PBX Status</span>
              <span class="value">{{ pbxStatus?.connected ? 'Connected' : 'Disconnected' }}</span>
              <span class="detail">{{ pbxStatus?.pbxModel || 'UCM6302A' }}</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="status-card calls">
          <mat-card-content>
            <div class="status-icon">
              <mat-icon>phone</mat-icon>
            </div>
            <div class="status-info">
              <span class="label">Active Calls</span>
              <span class="value">{{ activeCallsData?.totalCalls || 0 }}</span>
              <span class="detail">
                <span class="inbound">↓ {{ activeCallsData?.inboundCalls || 0 }}</span>
                <span class="outbound">↑ {{ activeCallsData?.outboundCalls || 0 }}</span>
                <span class="internal">↔ {{ activeCallsData?.internalCalls || 0 }}</span>
              </span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="status-card extensions">
          <mat-card-content>
            <div class="status-icon">
              <mat-icon>devices</mat-icon>
            </div>
            <div class="status-info">
              <span class="label">Extensions</span>
              <span class="value">{{ pbxStatus?.registeredExtensions || 0 }} / {{ pbxStatus?.totalExtensions || 0 }}</span>
              <span class="detail">Registered</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="status-card uptime">
          <mat-card-content>
            <div class="status-icon">
              <mat-icon>schedule</mat-icon>
            </div>
            <div class="status-info">
              <span class="label">System Uptime</span>
              <span class="value">{{ pbxStatus?.uptime || 'N/A' }}</span>
              <span class="detail">Last updated: {{ lastUpdated | date:'HH:mm:ss' }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Tabs for different views -->
      <mat-tab-group animationDuration="200ms">
        <!-- Active Calls Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">phone_in_talk</mat-icon>
            Active Calls
            @if ((activeCallsData?.totalCalls || 0) > 0) {
              <span class="badge">{{ activeCallsData?.totalCalls }}</span>
            }
          </ng-template>

          <div class="tab-content">
            @if (loadingCalls) {
              <div class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading active calls...</p>
              </div>
            } @else if (activeCalls.length === 0) {
              <div class="empty-state">
                <mat-icon>phone_disabled</mat-icon>
                <h3>No Active Calls</h3>
                <p>There are currently no active calls on the system</p>
              </div>
            } @else {
              <div class="calls-grid">
                @for (call of activeCalls; track call.callId) {
                  <mat-card class="call-card" [class.inbound]="call.direction === 'Inbound'" 
                            [class.outbound]="call.direction === 'Outbound'"
                            [class.internal]="call.direction === 'Internal'"
                            [class.on-hold]="call.onHold">
                    <mat-card-header>
                      <mat-icon mat-card-avatar class="direction-icon">
                        {{ getDirectionIcon(call.direction) }}
                      </mat-icon>
                      <mat-card-title>
                        {{ call.callerNumber || 'Unknown' }}
                        <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                        {{ call.calleeNumber || 'Unknown' }}
                      </mat-card-title>
                      <mat-card-subtitle>
                        {{ call.callerName || call.callerNumber }} → {{ call.calleeName || call.calleeNumber }}
                      </mat-card-subtitle>
                    </mat-card-header>
                    <mat-card-content>
                      <div class="call-details">
                        <div class="detail-row">
                          <span class="label">Duration:</span>
                          <span class="value duration">{{ call.durationFormatted }}</span>
                        </div>
                        <div class="detail-row">
                          <span class="label">Extension:</span>
                          <span class="value">{{ call.extension }} - {{ call.extensionName }}</span>
                        </div>
                        @if (call.trunkName) {
                          <div class="detail-row">
                            <span class="label">Trunk:</span>
                            <span class="value">{{ call.trunkName }}</span>
                          </div>
                        }
                        <div class="detail-row">
                          <span class="label">Status:</span>
                          <span class="value">
                            <mat-chip [class]="getStatusClass(call)">{{ getStatusText(call) }}</mat-chip>
                          </span>
                        </div>
                      </div>
                      <div class="call-indicators">
                        @if (call.onHold) {
                          <mat-chip class="indicator hold">
                            <mat-icon>pause</mat-icon> On Hold
                          </mat-chip>
                        }
                        @if (call.isRecording) {
                          <mat-chip class="indicator recording">
                            <mat-icon>fiber_manual_record</mat-icon> Recording
                          </mat-chip>
                        }
                      </div>
                    </mat-card-content>
                    <mat-card-actions>
                      <span class="start-time">Started: {{ call.startTime | date:'HH:mm:ss' }}</span>
                    </mat-card-actions>
                  </mat-card>
                }
              </div>
            }
          </div>
        </mat-tab>

        <!-- Call History Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">history</mat-icon>
            Call History
          </ng-template>

          <div class="tab-content">
            <!-- Filters -->
            <mat-expansion-panel class="filters-panel">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>filter_list</mat-icon>
                  Filters
                </mat-panel-title>
              </mat-expansion-panel-header>
              
              <form [formGroup]="filterForm" class="filter-form">
                <div class="filter-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Start Date</mat-label>
                    <input matInput [matDatepicker]="startPicker" formControlName="startDate">
                    <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
                    <mat-datepicker #startPicker></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>End Date</mat-label>
                    <input matInput [matDatepicker]="endPicker" formControlName="endDate">
                    <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
                    <mat-datepicker #endPicker></mat-datepicker>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Extension</mat-label>
                    <input matInput formControlName="extension" placeholder="e.g., 1001">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Direction</mat-label>
                    <mat-select formControlName="direction">
                      <mat-option value="">All</mat-option>
                      <mat-option value="Inbound">Inbound</mat-option>
                      <mat-option value="Outbound">Outbound</mat-option>
                      <mat-option value="Internal">Internal</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <div class="filter-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Caller Number</mat-label>
                    <input matInput formControlName="callerNumber">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Callee Number</mat-label>
                    <input matInput formControlName="calleeNumber">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Disposition</mat-label>
                    <mat-select formControlName="disposition">
                      <mat-option value="">All</mat-option>
                      <mat-option value="ANSWERED">Answered</mat-option>
                      <mat-option value="NO ANSWER">No Answer</mat-option>
                      <mat-option value="BUSY">Busy</mat-option>
                      <mat-option value="FAILED">Failed</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <div class="filter-actions">
                    <button mat-raised-button color="primary" (click)="applyFilters()">
                      <mat-icon>search</mat-icon> Search
                    </button>
                    <button mat-stroked-button (click)="clearFilters()">
                      <mat-icon>clear</mat-icon> Clear
                    </button>
                  </div>
                </div>
              </form>
            </mat-expansion-panel>

            <!-- CDR Table -->
            @if (loadingHistory) {
              <div class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading call history...</p>
              </div>
            } @else {
              <div class="table-container">
                <table mat-table [dataSource]="cdrRecords" matSort (matSortChange)="sortData($event)">
                  
                  <ng-container matColumnDef="startTime">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Date/Time</th>
                    <td mat-cell *matCellDef="let record">{{ record.startTime | date:'MM/dd/yyyy HH:mm:ss' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="direction">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Direction</th>
                    <td mat-cell *matCellDef="let record">
                      <mat-chip [class]="'direction-' + record.direction.toLowerCase()">
                        <mat-icon>{{ getDirectionIcon(record.direction) }}</mat-icon>
                        {{ record.direction }}
                      </mat-chip>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="callerNumber">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Caller</th>
                    <td mat-cell *matCellDef="let record">
                      <div class="caller-info">
                        <span class="number">{{ record.callerNumber }}</span>
                        @if (record.callerName) {
                          <span class="name">{{ record.callerName }}</span>
                        }
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="calleeNumber">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Callee</th>
                    <td mat-cell *matCellDef="let record">
                      <div class="caller-info">
                        <span class="number">{{ record.calleeNumber }}</span>
                        @if (record.calleeName) {
                          <span class="name">{{ record.calleeName }}</span>
                        }
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="duration">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Duration</th>
                    <td mat-cell *matCellDef="let record">{{ record.durationFormatted }}</td>
                  </ng-container>

                  <ng-container matColumnDef="disposition">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                    <td mat-cell *matCellDef="let record">
                      <mat-chip [class]="'disposition-' + record.disposition.toLowerCase().replace(' ', '-')">
                        {{ record.disposition }}
                      </mat-chip>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="extension">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Extension</th>
                    <td mat-cell *matCellDef="let record">{{ record.extension }}</td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let record">
                      @if (record.recordingUrl) {
                        <button mat-icon-button matTooltip="Play Recording" (click)="playRecording(record)">
                          <mat-icon>play_circle</mat-icon>
                        </button>
                      }
                      <button mat-icon-button matTooltip="View Details" [matMenuTriggerFor]="detailsMenu">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #detailsMenu="matMenu">
                        <button mat-menu-item (click)="viewDetails(record)">
                          <mat-icon>info</mat-icon>
                          <span>View Details</span>
                        </button>
                        @if (record.recordingUrl) {
                          <button mat-menu-item (click)="downloadRecording(record)">
                            <mat-icon>download</mat-icon>
                            <span>Download Recording</span>
                          </button>
                        }
                      </mat-menu>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>

                @if (cdrRecords.length === 0) {
                  <div class="empty-state small">
                    <mat-icon>history</mat-icon>
                    <p>No call records found</p>
                  </div>
                }

                <mat-paginator
                  [length]="totalRecords"
                  [pageSize]="pageSize"
                  [pageSizeOptions]="[10, 25, 50, 100]"
                  (page)="onPageChange($event)"
                  showFirstLastButtons>
                </mat-paginator>
              </div>
            }
          </div>
        </mat-tab>

        <!-- Extensions Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">device_hub</mat-icon>
            Extensions
          </ng-template>

          <div class="tab-content">
            @if (loadingExtensions) {
              <div class="loading-spinner">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading extensions...</p>
              </div>
            } @else {
              <div class="extensions-grid">
                @for (ext of extensionStatuses; track ext.extension) {
                  <mat-card class="extension-card" [class]="'status-' + ext.status.toLowerCase()">
                    <mat-card-header>
                      <div mat-card-avatar class="ext-avatar">
                        <mat-icon>{{ getExtensionIcon(ext.status) }}</mat-icon>
                      </div>
                      <mat-card-title>{{ ext.extension }}</mat-card-title>
                      <mat-card-subtitle>{{ ext.name }}</mat-card-subtitle>
                    </mat-card-header>
                    <mat-card-content>
                      <div class="ext-details">
                        <div class="detail-item">
                          <mat-icon>{{ ext.registered ? 'check_circle' : 'cancel' }}</mat-icon>
                          <span>{{ ext.registered ? 'Registered' : 'Unregistered' }}</span>
                        </div>
                        <div class="detail-item">
                          <mat-icon>router</mat-icon>
                          <span>{{ ext.ipAddress || 'N/A' }}</span>
                        </div>
                        <div class="detail-item">
                          <mat-icon>phone_android</mat-icon>
                          <span>{{ ext.deviceType || 'Unknown' }}</span>
                        </div>
                        @if (ext.departmentName) {
                          <div class="detail-item">
                            <mat-icon>business</mat-icon>
                            <span>{{ ext.departmentName }}</span>
                          </div>
                        }
                      </div>
                    </mat-card-content>
                    <mat-card-actions>
                      <mat-chip [class]="'status-chip-' + ext.status.toLowerCase()">
                        {{ ext.statusText || ext.status }}
                      </mat-chip>
                    </mat-card-actions>
                  </mat-card>
                }
              </div>

              @if (extensionStatuses.length === 0) {
                <div class="empty-state">
                  <mat-icon>device_hub</mat-icon>
                  <h3>No Extensions</h3>
                  <p>No extension data available</p>
                </div>
              }
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .active-calls-container {
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
      background: #f5f7fa;
    }

    .page-header {
      margin-bottom: 24px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
    }

    .header-title h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 500;
      color: #333;
    }

    .header-title .subtitle {
      margin: 4px 0 0;
      color: #666;
      font-size: 14px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    /* Status Cards */
    .status-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .status-card {
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .status-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
    }

    .status-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .status-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    .status-card.connected .status-icon { background: linear-gradient(135deg, #4caf50, #81c784); }
    .status-card.error .status-icon { background: linear-gradient(135deg, #f44336, #e57373); }
    .status-card.calls .status-icon { background: linear-gradient(135deg, #2196f3, #64b5f6); }
    .status-card.extensions .status-icon { background: linear-gradient(135deg, #9c27b0, #ba68c8); }
    .status-card.uptime .status-icon { background: linear-gradient(135deg, #ff9800, #ffb74d); }

    .status-info {
      display: flex;
      flex-direction: column;
    }

    .status-info .label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }

    .status-info .value {
      font-size: 24px;
      font-weight: 600;
      color: #333;
    }

    .status-info .detail {
      font-size: 12px;
      color: #888;
      display: flex;
      gap: 8px;
    }

    .status-info .detail .inbound { color: #4caf50; }
    .status-info .detail .outbound { color: #2196f3; }
    .status-info .detail .internal { color: #9c27b0; }

    /* Tabs */
    ::ng-deep .mat-mdc-tab-group {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .tab-icon {
      margin-right: 8px;
    }

    .badge {
      background: #f44336;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 12px;
      margin-left: 8px;
    }

    .tab-content {
      padding: 24px;
      min-height: 400px;
    }

    /* Loading & Empty States */
    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #666;
    }

    .loading-spinner p {
      margin-top: 16px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
    }

    .empty-state h3 {
      margin: 16px 0 8px;
      color: #666;
    }

    .empty-state.small {
      padding: 40px;
    }

    .empty-state.small mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    /* Call Cards */
    .calls-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }

    .call-card {
      border-radius: 12px;
      border-left: 4px solid #ccc;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .call-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }

    .call-card.inbound { border-left-color: #4caf50; }
    .call-card.outbound { border-left-color: #2196f3; }
    .call-card.internal { border-left-color: #9c27b0; }
    .call-card.on-hold { background: #fff8e1; }

    .direction-icon {
      background: #e3f2fd;
      color: #1976d2;
    }

    .call-card.inbound .direction-icon { background: #e8f5e9; color: #4caf50; }
    .call-card.outbound .direction-icon { background: #e3f2fd; color: #2196f3; }
    .call-card.internal .direction-icon { background: #f3e5f5; color: #9c27b0; }

    .arrow-icon {
      font-size: 16px;
      vertical-align: middle;
      margin: 0 4px;
    }

    .call-details {
      margin-top: 8px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-row .label {
      color: #666;
      font-size: 13px;
    }

    .detail-row .value {
      font-weight: 500;
      font-size: 13px;
    }

    .detail-row .value.duration {
      font-family: 'Roboto Mono', monospace;
      color: #1976d2;
    }

    .call-indicators {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .indicator {
      font-size: 12px;
    }

    .indicator.hold { background: #ff9800; color: white; }
    .indicator.recording { background: #f44336; color: white; }

    .call-card mat-card-actions {
      display: flex;
      justify-content: flex-end;
      padding: 8px 16px;
    }

    .start-time {
      font-size: 12px;
      color: #888;
    }

    /* Filters Panel */
    .filters-panel {
      margin-bottom: 16px;
      border-radius: 8px;
    }

    .filter-form {
      padding-top: 16px;
    }

    .filter-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: flex-end;
      margin-bottom: 8px;
    }

    .filter-row mat-form-field {
      flex: 1;
      min-width: 150px;
    }

    .filter-actions {
      display: flex;
      gap: 8px;
      padding-bottom: 22px;
    }

    /* Table */
    .table-container {
      overflow-x: auto;
    }

    table {
      width: 100%;
    }

    .caller-info {
      display: flex;
      flex-direction: column;
    }

    .caller-info .number {
      font-weight: 500;
    }

    .caller-info .name {
      font-size: 12px;
      color: #666;
    }

    .direction-inbound { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .direction-outbound { background: #e3f2fd !important; color: #1565c0 !important; }
    .direction-internal { background: #f3e5f5 !important; color: #7b1fa2 !important; }

    .disposition-answered { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .disposition-no-answer { background: #fff3e0 !important; color: #ef6c00 !important; }
    .disposition-busy { background: #fce4ec !important; color: #c62828 !important; }
    .disposition-failed { background: #ffebee !important; color: #c62828 !important; }

    /* Extensions Grid */
    .extensions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .extension-card {
      border-radius: 12px;
      transition: transform 0.2s;
    }

    .extension-card:hover {
      transform: translateY(-2px);
    }

    .ext-avatar {
      background: #e3f2fd;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
    }

    .extension-card.status-available .ext-avatar { background: #e8f5e9; color: #4caf50; }
    .extension-card.status-busy .ext-avatar { background: #ffebee; color: #f44336; }
    .extension-card.status-ringing .ext-avatar { background: #fff3e0; color: #ff9800; }
    .extension-card.status-unavailable .ext-avatar { background: #eeeeee; color: #9e9e9e; }
    .extension-card.status-dnd .ext-avatar { background: #fce4ec; color: #e91e63; }

    .ext-details {
      margin-top: 8px;
    }

    .detail-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
      font-size: 13px;
      color: #666;
    }

    .detail-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #888;
    }

    .status-chip-available { background: #4caf50 !important; color: white !important; }
    .status-chip-busy { background: #f44336 !important; color: white !important; }
    .status-chip-ringing { background: #ff9800 !important; color: white !important; }
    .status-chip-unavailable { background: #9e9e9e !important; color: white !important; }
    .status-chip-dnd { background: #e91e63 !important; color: white !important; }

    /* Responsive */
    @media (max-width: 768px) {
      .active-calls-container {
        padding: 16px;
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .header-actions {
        width: 100%;
        justify-content: flex-start;
      }

      .status-cards {
        grid-template-columns: 1fr 1fr;
      }

      .calls-grid,
      .extensions-grid {
        grid-template-columns: 1fr;
      }

      .filter-row {
        flex-direction: column;
      }

      .filter-row mat-form-field {
        width: 100%;
      }
    }
  `]
})
export class ActiveCallsComponent implements OnInit, OnDestroy {
  // Data
  activeCalls: ActiveCall[] = [];
  activeCallsData: ActiveCallsResponse | null = null;
  cdrRecords: CdrRecord[] = [];
  extensionStatuses: ExtensionStatus[] = [];
  pbxStatus: PbxStatus | null = null;

  // UI State
  loadingCalls = false;
  loadingHistory = false;
  loadingExtensions = false;
  testingConnection = false;
  autoRefresh = true;
  lastUpdated = new Date();

  // Pagination
  totalRecords = 0;
  pageSize = 25;
  currentPage = 0;

  // Table columns
  displayedColumns = ['startTime', 'direction', 'callerNumber', 'calleeNumber', 'duration', 'disposition', 'extension', 'actions'];

  // Filter form
  filterForm: FormGroup;

  // Subscriptions
  private destroy$ = new Subject<void>();
  private refreshSubscription?: Subscription;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      startDate: [null],
      endDate: [null],
      extension: [''],
      direction: [''],
      callerNumber: [''],
      calleeNumber: [''],
      disposition: ['']
    });
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
  }

  loadInitialData(): void {
    this.loadActiveCalls();
    this.loadPbxStatus();
    this.loadCallHistory();
    this.loadExtensionStatuses();
  }

  refresh(): void {
    this.loadActiveCalls();
    this.loadPbxStatus();
    this.snackBar.open('Data refreshed', 'Close', { duration: 2000 });
  }

  loadActiveCalls(): void {
    this.loadingCalls = true;
    this.apiService.getActiveCalls()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.activeCallsData = response;
          this.activeCalls = response.calls || [];
          this.lastUpdated = new Date();
          this.loadingCalls = false;
        },
        error: (err) => {
          console.error('Error loading active calls:', err);
          this.loadingCalls = false;
        }
      });
  }

  loadPbxStatus(): void {
    this.apiService.getPbxStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          this.pbxStatus = status;
        },
        error: (err) => {
          console.error('Error loading PBX status:', err);
          this.pbxStatus = {
            connected: false,
            pbxModel: 'UCM6302A',
            firmwareVersion: '',
            uptime: 'N/A',
            activeChannels: 0,
            maxChannels: 0,
            registeredExtensions: 0,
            totalExtensions: 0,
            lastUpdated: new Date()
          };
        }
      });
  }

  loadCallHistory(): void {
    this.loadingHistory = true;
    const formValue = this.filterForm.value;
    const query: CdrQuery = {
      startDate: formValue.startDate,
      endDate: formValue.endDate,
      extension: formValue.extension || undefined,
      direction: formValue.direction || undefined,
      callerNumber: formValue.callerNumber || undefined,
      calleeNumber: formValue.calleeNumber || undefined,
      disposition: formValue.disposition || undefined,
      page: this.currentPage + 1,
      pageSize: this.pageSize
    };

    this.apiService.getCallHistory(query)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.cdrRecords = response.records || [];
          this.totalRecords = response.totalRecords;
          this.loadingHistory = false;
        },
        error: (err) => {
          console.error('Error loading call history:', err);
          this.loadingHistory = false;
        }
      });
  }

  loadExtensionStatuses(): void {
    this.loadingExtensions = true;
    this.apiService.getExtensionStatuses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (statuses) => {
          this.extensionStatuses = statuses || [];
          this.loadingExtensions = false;
        },
        error: (err) => {
          console.error('Error loading extensions:', err);
          this.loadingExtensions = false;
        }
      });
  }

  testConnection(): void {
    this.testingConnection = true;
    this.apiService.testPbxConnection()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.testingConnection = false;
          if (result.success) {
            this.snackBar.open('✓ PBX connection successful', 'Close', { 
              duration: 3000,
              panelClass: 'success-snackbar'
            });
          } else {
            this.snackBar.open('✗ ' + result.message, 'Close', { 
              duration: 5000,
              panelClass: 'error-snackbar'
            });
          }
        },
        error: (err) => {
          this.testingConnection = false;
          this.snackBar.open('✗ Connection failed: ' + (err.message || 'Unknown error'), 'Close', { 
            duration: 5000,
            panelClass: 'error-snackbar'
          });
        }
      });
  }

  toggleAutoRefresh(): void {
    if (this.autoRefresh) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    if (this.autoRefresh) {
      this.refreshSubscription = interval(5000)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.loadActiveCalls();
        });
    }
  }

  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = undefined;
    }
  }

  // Filter methods
  applyFilters(): void {
    this.currentPage = 0;
    this.loadCallHistory();
  }

  clearFilters(): void {
    this.filterForm.reset();
    this.currentPage = 0;
    this.loadCallHistory();
  }

  // Pagination
  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCallHistory();
  }

  // Sorting
  sortData(sort: Sort): void {
    // Implement sorting logic if needed
    console.log('Sort:', sort);
  }

  // Helper methods
  getDirectionIcon(direction: string): string {
    switch (direction) {
      case 'Inbound': return 'call_received';
      case 'Outbound': return 'call_made';
      case 'Internal': return 'swap_calls';
      default: return 'phone';
    }
  }

  getStatusClass(call: ActiveCall): string {
    if (call.onHold) return 'hold';
    if (call.answered) return 'connected';
    return 'ringing';
  }

  getStatusText(call: ActiveCall): string {
    if (call.onHold) return 'On Hold';
    if (call.answered) return 'Connected';
    return 'Ringing';
  }

  getExtensionIcon(status: string): string {
    switch (status) {
      case 'Available': return 'phone_enabled';
      case 'Busy': return 'phone_in_talk';
      case 'Ringing': return 'ring_volume';
      case 'DND': return 'do_not_disturb';
      default: return 'phone_disabled';
    }
  }

  // Recording methods
  playRecording(record: CdrRecord): void {
    if (record.recordingUrl) {
      window.open(record.recordingUrl, '_blank');
    }
  }

  downloadRecording(record: CdrRecord): void {
    if (record.recordingUrl) {
      const link = document.createElement('a');
      link.href = record.recordingUrl;
      link.download = `recording_${record.callId}.wav`;
      link.click();
    }
  }

  viewDetails(record: CdrRecord): void {
    // Could open a dialog with full details
    console.log('View details:', record);
    this.snackBar.open(`Call ID: ${record.callId}`, 'Close', { duration: 3000 });
  }
}
