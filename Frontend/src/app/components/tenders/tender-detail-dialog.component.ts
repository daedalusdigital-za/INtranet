import { Component, Inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { TenderService, Tender, TenderDocument, TenderTeamMember, TenderBOQItem, TenderActivity } from '../../services/tender.service';
import { AuthService } from '../../services/auth.service';
import { WellyActivityService } from '../../services/welly-activity.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ToastService } from '../../ui/toast.service';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { ChipTone, StatusChipComponent } from '../../ui/status-chip/status-chip.component';
import { environment } from '../../../environments/environment';

interface DialogData {
  mode: 'create' | 'edit' | 'view';
  tender?: Tender;
  companies: { code: string; name: string; color: string }[];
  provinces: string[];
  departments: string[];
}

@Component({
  selector: 'app-tender-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatMenuModule,
    MatExpansionModule,
    MatCardModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    EmptyStateComponent,
    StatusChipComponent
  ],
  template: `
    <div class="dialog-container">
      <div mat-dialog-title class="dialog-header">
        <div class="header-content">
          @if (data.mode === 'create') {
            <h2>Create New Tender</h2>
          } @else {
            <div class="tender-header">
              <span class="company-badge" [style.background-color]="getCompanyColor(data.tender?.companyCode || '')">
                {{ data.tender?.companyCode }}
              </span>
              <h2>{{ data.tender?.tenderNumber }}</h2>
              <app-status-chip [status]="data.tender?.status || ''" [tone]="statusTone(data.tender?.status)"></app-status-chip>
            </div>
          }
        </div>
        <button aria-label="Close" mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>

      <mat-dialog-content>
        @if (data.mode === 'view' && data.tender) {
          <!-- View Mode - Tabs -->
          <mat-tab-group animationDuration="200ms">
            <!-- Overview Tab -->
            <mat-tab label="Overview">
              <div class="tab-content">
                <div class="overview-grid">
                  <div class="info-section">
                    <h3>{{ data.tender.title }}</h3>
                    <p class="description">{{ data.tender.description || 'No description provided' }}</p>
                    
                    <div class="info-row">
                      <mat-icon>business</mat-icon>
                      <div>
                        <span class="label">Issuing Department</span>
                        <span class="value">{{ data.tender.issuingDepartment }}</span>
                      </div>
                    </div>
                    
                    <div class="info-row">
                      <mat-icon>place</mat-icon>
                      <div>
                        <span class="label">Province</span>
                        <span class="value">{{ data.tender.province || 'Not specified' }}</span>
                      </div>
                    </div>

                    <div class="info-row">
                      <mat-icon>attach_money</mat-icon>
                      <div>
                        <span class="label">Estimated Value</span>
                        <span class="value">{{ data.tender.estimatedValue | currency:'ZAR':'symbol':'1.0-0' }}</span>
                      </div>
                    </div>

                    <div class="info-row">
                      <mat-icon>person</mat-icon>
                      <div>
                        <span class="label">Contact Person</span>
                        <span class="value">{{ data.tender.contactPerson || 'N/A' }}</span>
                        @if (data.tender.contactEmail) {
                          <br><a href="mailto:{{ data.tender.contactEmail }}">{{ data.tender.contactEmail }}</a>
                        }
                        @if (data.tender.contactPhone) {
                          <br><span>{{ data.tender.contactPhone }}</span>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="dates-section">
                    <h4>Key Dates</h4>
                    <div class="date-timeline">
                      @if (data.tender.publishedDate) {
                        <div class="timeline-item">
                          <mat-icon>publish</mat-icon>
                          <div>
                            <span class="label">Published</span>
                            <span class="date">{{ data.tender.publishedDate | date:'dd MMM yyyy' }}</span>
                          </div>
                        </div>
                      }
                      @if (data.tender.compulsoryBriefingDate) {
                        <div class="timeline-item" [class.past]="isPast(data.tender.compulsoryBriefingDate)">
                          <mat-icon>groups</mat-icon>
                          <div>
                            <span class="label">Briefing</span>
                            <span class="date">{{ data.tender.compulsoryBriefingDate | date:'dd MMM yyyy HH:mm' }}</span>
                            @if (data.tender.briefingVenue) {
                              <span class="venue">{{ data.tender.briefingVenue }}</span>
                            }
                          </div>
                        </div>
                      }
                      @if (data.tender.siteVisitDate) {
                        <div class="timeline-item" [class.past]="isPast(data.tender.siteVisitDate)">
                          <mat-icon>location_on</mat-icon>
                          <div>
                            <span class="label">Site Visit</span>
                            <span class="date">{{ data.tender.siteVisitDate | date:'dd MMM yyyy HH:mm' }}</span>
                          </div>
                        </div>
                      }
                      @if (data.tender.clarificationDeadline) {
                        <div class="timeline-item" [class.past]="isPast(data.tender.clarificationDeadline)">
                          <mat-icon>help_outline</mat-icon>
                          <div>
                            <span class="label">Clarification Deadline</span>
                            <span class="date">{{ data.tender.clarificationDeadline | date:'dd MMM yyyy HH:mm' }}</span>
                          </div>
                        </div>
                      }
                      <div class="timeline-item closing" [class.urgent]="getDaysLeft(data.tender.closingDate) <= 7">
                        <mat-icon>event</mat-icon>
                        <div>
                          <span class="label">Closing Date</span>
                          <span class="date">{{ data.tender.closingDate | date:'dd MMM yyyy HH:mm' }}</span>
                          <span class="days-badge">{{ getDaysLeft(data.tender.closingDate) }} days left</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="workflow-section">
                    <h4>Workflow Status</h4>
                    <div class="workflow-steps">
                      @for (step of workflowSteps; track step) {
                        <div class="step" [class.active]="data.tender.workflowStatus === step" [class.completed]="isWorkflowCompleted(step)">
                          <div class="step-indicator"></div>
                          <span>{{ step }}</span>
                        </div>
                      }
                    </div>
                  </div>
                </div>

                <!-- Activity Log -->
                <mat-expansion-panel>
                  <mat-expansion-panel-header>
                    <mat-panel-title><mat-icon>history</mat-icon> Activity Log</mat-panel-title>
                  </mat-expansion-panel-header>
                  <div class="activity-list">
                    @for (activity of data.tender.activities; track activity.id) {
                      <div class="activity-item">
                        <mat-icon>{{ getActivityIcon(activity.activityType) }}</mat-icon>
                        <div class="activity-content">
                          <span class="activity-desc">{{ activity.description }}</span>
                          <span class="activity-meta">{{ activity.userName }} • {{ activity.createdAt | date:'dd MMM yyyy HH:mm' }}</span>
                        </div>
                      </div>
                    }
                  </div>
                </mat-expansion-panel>
              </div>
            </mat-tab>

            <!-- Documents Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>folder</mat-icon> Documents ({{ data.tender.documents?.length || 0 }})
              </ng-template>
              <div class="tab-content">
                <div class="docs-header">
                  <button mat-raised-button color="primary" (click)="fileInput.click()">
                    <mat-icon>upload</mat-icon> Upload Document
                  </button>
                  <input #fileInput type="file" hidden (change)="uploadDocument($event)">
                </div>

                @if (data.tender.documents && data.tender.documents.length > 0) {
                  <table mat-table [dataSource]="data.tender.documents" class="documents-table">
                    <ng-container matColumnDef="type">
                      <th mat-header-cell *matHeaderCellDef>Type</th>
                      <td mat-cell *matCellDef="let doc">
                        <mat-chip>{{ doc.documentType }}</mat-chip>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>File Name</th>
                      <td mat-cell *matCellDef="let doc">{{ doc.fileName }}</td>
                    </ng-container>
                    <ng-container matColumnDef="version">
                      <th mat-header-cell *matHeaderCellDef>Version</th>
                      <td mat-cell *matCellDef="let doc">{{ doc.version }}</td>
                    </ng-container>
                    <ng-container matColumnDef="uploaded">
                      <th mat-header-cell *matHeaderCellDef>Uploaded</th>
                      <td mat-cell *matCellDef="let doc">
                        {{ doc.uploadedAt | date:'dd MMM yyyy' }}<br>
                        <small>{{ doc.uploadedByUserName }}</small>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Actions</th>
                      <td mat-cell *matCellDef="let doc">
                        <button aria-label="Download" mat-icon-button (click)="downloadDocument(doc)" matTooltip="Download">
                          <mat-icon>download</mat-icon>
                        </button>
                        <button aria-label="Delete" mat-icon-button (click)="deleteDocument(doc)" matTooltip="Delete" color="warn">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['type', 'name', 'version', 'uploaded', 'actions']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['type', 'name', 'version', 'uploaded', 'actions'];"></tr>
                  </table>
                } @else {
                  <app-empty-state icon="folder_open" title="No documents uploaded yet"
                                   message="Upload the RFQ, BOQ, addenda and submission files for this tender.">
                    <button mat-stroked-button (click)="fileInput.click()"><mat-icon>upload</mat-icon> Upload Document</button>
                  </app-empty-state>
                }
              </div>
            </mat-tab>

            <!-- Pricing/BOQ Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>calculate</mat-icon> Pricing/BOQ
              </ng-template>
              <div class="tab-content">
                <div class="boq-header">
                  <button mat-raised-button color="primary" (click)="addBOQItem()">
                    <mat-icon>add</mat-icon> Add Line Item
                  </button>
                  <button mat-stroked-button class="welly-boq-btn" [matMenuTriggerFor]="wellyMenu" matTooltip="Welly AI Pricing Assistant">
                    <mat-icon class="welly-sparkle">auto_awesome</mat-icon> Ask Welly
                  </button>
                  <mat-menu #wellyMenu="matMenu">
                    <button mat-menu-item (click)="wellyDocumentAnalyze('analyze')">
                      <mat-icon>analytics</mat-icon>
                      <span>Analyze Documents & BOQ</span>
                    </button>
                    <button mat-menu-item (click)="wellyDocumentAnalyze('pricing-review')">
                      <mat-icon>price_check</mat-icon>
                      <span>Pricing Review</span>
                    </button>
                    <button mat-menu-item (click)="wellyDocumentAnalyze('extract-boq')">
                      <mat-icon>playlist_add</mat-icon>
                      <span>Extract BOQ from Documents</span>
                    </button>
                    <mat-divider></mat-divider>
                    <button mat-menu-item (click)="wellyAnalyzeBOQ()">
                      <mat-icon>calculate</mat-icon>
                      <span>Quick BOQ Analysis (no docs)</span>
                    </button>
                    <button mat-menu-item (click)="wellyCheckCompliance()">
                      <mat-icon>verified</mat-icon>
                      <span>Compliance Check</span>
                    </button>
                  </mat-menu>
                  <div class="boq-summary">
                    <span>Total: <strong>{{ calculateBOQTotal() | currency:'ZAR':'symbol':'1.2-2' }}</strong></span>
                    <span>Avg Margin: <strong>{{ calculateAvgMargin() | number:'1.1-1' }}%</strong></span>
                  </div>
                </div>

                @if (data.tender.boqItems && data.tender.boqItems.length > 0) {
                  <table mat-table [dataSource]="data.tender.boqItems" class="boq-table">
                    <ng-container matColumnDef="line">
                      <th mat-header-cell *matHeaderCellDef>#</th>
                      <td mat-cell *matCellDef="let item">{{ item.lineNumber }}</td>
                    </ng-container>
                    <ng-container matColumnDef="code">
                      <th mat-header-cell *matHeaderCellDef>Code</th>
                      <td mat-cell *matCellDef="let item">{{ item.itemCode || '-' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="description">
                      <th mat-header-cell *matHeaderCellDef>Description</th>
                      <td mat-cell *matCellDef="let item">{{ item.description }}</td>
                    </ng-container>
                    <ng-container matColumnDef="qty">
                      <th mat-header-cell *matHeaderCellDef>Qty</th>
                      <td mat-cell *matCellDef="let item">{{ item.quantity }} {{ item.unit }}</td>
                    </ng-container>
                    <ng-container matColumnDef="cost">
                      <th mat-header-cell *matHeaderCellDef>Unit Cost</th>
                      <td mat-cell *matCellDef="let item">{{ item.unitCost | currency:'ZAR':'symbol':'1.2-2' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="price">
                      <th mat-header-cell *matHeaderCellDef>Unit Price</th>
                      <td mat-cell *matCellDef="let item">{{ item.unitPrice | currency:'ZAR':'symbol':'1.2-2' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="margin">
                      <th mat-header-cell *matHeaderCellDef>Margin</th>
                      <td mat-cell *matCellDef="let item" [class.below-cost]="item.isBelowCost">
                        {{ item.marginPercent | number:'1.1-1' }}%
                        @if (item.isBelowCost) {
                          <mat-icon color="warn" matTooltip="Below cost!">warning</mat-icon>
                        }
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="total">
                      <th mat-header-cell *matHeaderCellDef>Total</th>
                      <td mat-cell *matCellDef="let item">{{ item.quantity * item.unitPrice | currency:'ZAR':'symbol':'1.2-2' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let item">
                        <button aria-label="More actions" mat-icon-button [matMenuTriggerFor]="boqMenu">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #boqMenu="matMenu">
                          <button mat-menu-item (click)="editBOQItem(item)"><mat-icon>edit</mat-icon> Edit</button>
                          <button mat-menu-item (click)="deleteBOQItem(item)"><mat-icon>delete</mat-icon> Delete</button>
                        </mat-menu>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="boqColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: boqColumns;"></tr>
                  </table>
                } @else {
                  <app-empty-state icon="list_alt" title="No BOQ items added yet"
                                   message="Add line items by hand, or ask Welly to extract them from the tender documents.">
                    <button mat-stroked-button (click)="addBOQItem()"><mat-icon>add</mat-icon> Add Line Item</button>
                  </app-empty-state>
                }
              </div>
            </mat-tab>

            <!-- Team Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>group</mat-icon> Team ({{ data.tender.teamMembers?.length || 0 }})
              </ng-template>
              <div class="tab-content">
                <div class="team-header">
                  <button mat-raised-button color="primary" (click)="addTeamMember()">
                    <mat-icon>person_add</mat-icon> Assign Team Member
                  </button>
                </div>

                <div class="team-grid">
                  @for (role of teamRoles; track role) {
                    <mat-card class="team-role-card">
                      <mat-card-header>
                        <mat-icon mat-card-avatar>{{ getRoleIcon(role) }}</mat-icon>
                        <mat-card-title>{{ role }}</mat-card-title>
                      </mat-card-header>
                      <mat-card-content>
                        @if (getTeamMemberByRole(role); as member) {
                          <div class="member-info">
                            <span class="member-name">{{ member.userName }}</span>
                            <span class="member-status" [class]="'status-' + member.status.toLowerCase()">
                              {{ member.status }}
                            </span>
                            <div class="member-actions">
                              <button mat-button color="primary" (click)="updateMemberStatus(member, 'Completed')" [disabled]="member.status === 'Completed'">
                                Mark Complete
                              </button>
                            </div>
                          </div>
                        } @else {
                          <div class="no-member">
                            <span>Not assigned</span>
                            <button mat-button color="primary" (click)="addTeamMember(role)">Assign</button>
                          </div>
                        }
                      </mat-card-content>
                    </mat-card>
                  }
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        } @else {
          <!-- Create/Edit Form -->
          <form [formGroup]="tenderForm" class="tender-form">
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Tender Number</mat-label>
                <input matInput formControlName="tenderNumber" placeholder="e.g. RFQ-2024-001">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Company</mat-label>
                <mat-select formControlName="companyCode">
                  @for (company of data.companies; track company.code) {
                    <mat-option [value]="company.code">{{ company.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" placeholder="Tender title">
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="3"></textarea>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Issuing Department</mat-label>
                <input matInput formControlName="issuingDepartment">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Department Category</mat-label>
                <mat-select formControlName="departmentCategory">
                  @for (dept of data.departments; track dept) {
                    <mat-option [value]="dept">{{ dept }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Province</mat-label>
                <mat-select formControlName="province">
                  @for (prov of data.provinces; track prov) {
                    <mat-option [value]="prov">{{ prov }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Estimated Value (ZAR)</mat-label>
                <input matInput type="number" formControlName="estimatedValue">
                <span matPrefix>R&nbsp;</span>
              </mat-form-field>

              <mat-divider class="full-width"></mat-divider>
              <h4 class="full-width">Contact Information</h4>

              <mat-form-field appearance="outline">
                <mat-label>Contact Person</mat-label>
                <input matInput formControlName="contactPerson">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Contact Email</mat-label>
                <input matInput type="email" formControlName="contactEmail">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Contact Phone</mat-label>
                <input matInput formControlName="contactPhone">
              </mat-form-field>

              <mat-divider class="full-width"></mat-divider>
              <h4 class="full-width">Key Dates</h4>

              <mat-form-field appearance="outline">
                <mat-label>Published Date</mat-label>
                <input matInput [matDatepicker]="publishedPicker" formControlName="publishedDate">
                <mat-datepicker-toggle matSuffix [for]="publishedPicker"></mat-datepicker-toggle>
                <mat-datepicker #publishedPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Closing Date</mat-label>
                <input matInput [matDatepicker]="closingPicker" formControlName="closingDate">
                <mat-datepicker-toggle matSuffix [for]="closingPicker"></mat-datepicker-toggle>
                <mat-datepicker #closingPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Compulsory Briefing</mat-label>
                <input matInput [matDatepicker]="briefingPicker" formControlName="compulsoryBriefingDate">
                <mat-datepicker-toggle matSuffix [for]="briefingPicker"></mat-datepicker-toggle>
                <mat-datepicker #briefingPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Briefing Venue</mat-label>
                <input matInput formControlName="briefingVenue">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Site Visit Date</mat-label>
                <input matInput [matDatepicker]="sitePicker" formControlName="siteVisitDate">
                <mat-datepicker-toggle matSuffix [for]="sitePicker"></mat-datepicker-toggle>
                <mat-datepicker #sitePicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Clarification Deadline</mat-label>
                <input matInput [matDatepicker]="clarifyPicker" formControlName="clarificationDeadline">
                <mat-datepicker-toggle matSuffix [for]="clarifyPicker"></mat-datepicker-toggle>
                <mat-datepicker #clarifyPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Priority</mat-label>
                <mat-select formControlName="priority">
                  <mat-option value="Low">Low</mat-option>
                  <mat-option value="Medium">Medium</mat-option>
                  <mat-option value="High">High</mat-option>
                  <mat-option value="Critical">Critical</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </form>
        }
      </mat-dialog-content>

      <!-- Welly BOQ Analysis Panel -->
      @if (showWellyPanel) {
        <div class="welly-panel-overlay" (click)="showWellyPanel = false">
          <div class="welly-panel" (click)="$event.stopPropagation()">
            <div class="welly-panel-header">
              <div class="welly-panel-title">
                <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
                <h3>Welly Tender Analysis</h3>
              </div>
              <button aria-label="Close" mat-icon-button (click)="showWellyPanel = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            @if (wellyAnalysisInfo) {
              <div class="welly-analysis-info">
                <mat-icon>{{ wellyAnalysisInfo.icon }}</mat-icon>
                <span>{{ wellyAnalysisInfo.label }}</span>
                @if (wellyDocsAnalyzed > 0) {
                  <span class="doc-count">{{ wellyDocsAnalyzed }} doc(s) read</span>
                }
              </div>
            }
            <div class="welly-panel-body">
              @if (wellyLoading) {
                <div class="welly-loading">
                  <div class="progress-container">
                    <div class="progress-header">
                      <mat-icon class="progress-icon pulse-icon">auto_awesome</mat-icon>
                      <span class="progress-title">Welly is analyzing...</span>
                      <span class="progress-timer">{{ wellyElapsedTime }}</span>
                    </div>
                    <div class="progress-bar-track">
                      <div class="progress-bar-fill" [style.width.%]="wellyProgressPercent"></div>
                    </div>
                    <div class="progress-steps">
                      @for (step of wellyProgressSteps; track step.label; let i = $index) {
                        <div class="progress-step" [class.active]="i === wellyCurrentStep" [class.done]="i < wellyCurrentStep">
                          <div class="step-icon">
                            @if (i < wellyCurrentStep) {
                              <mat-icon>check_circle</mat-icon>
                            } @else if (i === wellyCurrentStep) {
                              <mat-spinner diameter="18"></mat-spinner>
                            } @else {
                              <mat-icon>radio_button_unchecked</mat-icon>
                            }
                          </div>
                          <span class="step-label">{{ step.label }}</span>
                        </div>
                      }
                    </div>
                    <p class="progress-message">{{ wellyLoadingMessage }}</p>
                  </div>
                </div>
              } @else if (wellyResult) {
                <div class="welly-result">
                  <div class="welly-result-text" [innerHTML]="formatWellyResult(wellyResult)"></div>
                  @if (wellyExtractedItems.length > 0) {
                    <div class="welly-extracted-boq">
                      <h4>Extracted BOQ Items ({{ wellyExtractedItems.length }})</h4>
                      <div class="extracted-items-list">
                        @for (item of wellyExtractedItems; track item.lineNumber) {
                          <div class="extracted-item">
                            <span class="item-num">#{{ item.lineNumber }}</span>
                            <span class="item-desc">{{ item.description }}</span>
                            <span class="item-price">R{{ item.unitPrice }}</span>
                          </div>
                        }
                      </div>
                      <button mat-raised-button color="primary" class="import-btn" (click)="importExtractedBOQItems()">
                        <mat-icon>playlist_add</mat-icon> Import {{ wellyExtractedItems.length }} Items to BOQ
                      </button>
                    </div>
                  }
                  <div class="welly-result-actions">
                    <button mat-button (click)="copyWellyResult()">
                      <mat-icon>content_copy</mat-icon> Copy Analysis
                    </button>
                    <button mat-button (click)="wellyDocumentAnalyze('pricing-review')">
                      <mat-icon>price_check</mat-icon> Pricing Review
                    </button>
                    <button mat-button (click)="wellyCheckCompliance()">
                      <mat-icon>verified</mat-icon> Check Compliance
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close()">Close</button>
        @if (data.mode === 'view') {
          <button mat-raised-button color="primary" (click)="switchToEdit()">
            <mat-icon>edit</mat-icon> Edit
          </button>
        } @else {
          <button mat-raised-button color="primary" (click)="saveTender()" [disabled]="saving || !tenderForm.valid">
            @if (saving) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <ng-container><mat-icon>save</mat-icon> {{ data.mode === 'create' ? 'Create' : 'Save' }}</ng-container>
            }
          </button>
        }
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .dialog-container {
      width: 100%;
      min-width: 1200px;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      background: var(--color-surface);
      color: var(--color-text);
      border-bottom: 1px solid var(--color-line);
    }

    .dialog-header h2 {
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: 500;
    }

    .dialog-header button {
      color: var(--color-text-2);
    }

    .tender-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .company-badge {
      padding: 6px 16px;
      border-radius: var(--radius-sm);
      color: var(--color-on-dark);
      font-weight: 600;
      font-size: var(--text-md);
    }

    mat-dialog-content {
      max-height: 75vh;
      padding: 0 !important;
      overflow-y: auto;
    }

    .tab-content {
      padding: 32px;
      min-height: 400px;
    }

    /* Overview Grid */
    .overview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }

    .info-section h3 {
      margin: 0 0 12px 0;
      font-size: var(--text-2xl);
      color: var(--color-text);
    }

    .description {
      color: var(--color-text-2);
      margin-bottom: 24px;
      line-height: 1.6;
    }

    .info-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      padding: 12px;
      background: var(--color-canvas);
      border-radius: 8px;
    }
    .info-row mat-icon {
      margin-right: 16px;
      color: var(--color-primary);
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .info-row .label {
      display: block;
      font-size: var(--text-xs);
      color: var(--color-text-2);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-row .value {
      font-weight: 600;
      font-size: var(--text-md);
      color: var(--color-text);
    }

    /* Dates Section */
    .dates-section h4, .workflow-section h4 {
      margin: 0 0 20px 0;
      color: var(--color-text);
      font-size: var(--text-xl);
    }

    .date-timeline {
      border-left: 3px solid var(--color-primary);
      padding-left: 24px;
      margin-left: 8px;
    }

    .timeline-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      position: relative;
      padding: 12px;
      background: var(--color-canvas);
      border-radius: 8px;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -33px;
      top: 16px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--color-line);
      border: 3px solid var(--color-surface);
      box-shadow: var(--shadow-sm);
    }
    .timeline-item.past::before { background: var(--color-ok); }
    .timeline-item.closing::before { background: var(--color-danger); }

    .timeline-item mat-icon {
      margin-right: 16px;
      color: var(--color-primary);
    }
    .timeline-item .label {
      display: block;
      font-size: var(--text-xs);
      color: var(--color-text-2);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .timeline-item .date {
      font-weight: 600;
      font-size: var(--text-md);
      color: var(--color-text);
    }
    .timeline-item .venue {
      display: block;
      font-size: var(--text-sm);
      color: var(--color-primary);
      margin-top: 4px;
    }
    .timeline-item.urgent .date { color: var(--color-danger); font-weight: 700; }

    .days-badge {
      display: inline-block;
      padding: 4px 12px;
      background: var(--color-danger-soft);
      color: var(--color-danger);
      border-radius: 12px;
      font-size: var(--text-xs);
      font-weight: 600;
      margin-left: 12px;
    }

    /* Workflow */
    .workflow-section {
      grid-column: 1 / -1;
      margin-top: 16px;
      padding-top: 24px;
      border-top: 1px solid var(--color-line);
    }

    .workflow-steps {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .step {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      background: var(--color-surface-2);
      border-radius: 24px;
      font-size: var(--text-md);
      transition: all 0.2s;
    }
    .step.active {
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-weight: 600;
      box-shadow: var(--shadow-sm);
    }
    .step.completed {
      background: var(--color-ok-soft);
      color: var(--color-ok);
    }

    .step-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-line-strong);
      margin-right: 10px;
    }
    .step.active .step-indicator { background: var(--color-on-primary); }
    .step.completed .step-indicator { background: var(--color-ok); }

    /* Activity */
    .activity-list {
      max-height: 250px;
      overflow-y: auto;
    }

    .activity-item {
      display: flex;
      padding: 16px;
      border-bottom: 1px solid var(--color-line);
    }
    .activity-item mat-icon {
      margin-right: 16px;
      color: var(--color-primary);
    }
    .activity-desc {
      display: block;
      font-size: var(--text-md);
    }
    .activity-meta {
      display: block;
      font-size: var(--text-xs);
      color: var(--color-text-3);
      margin-top: 6px;
    }

    /* Documents */
    .docs-header, .boq-header, .team-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .documents-table, .boq-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
    }

    /* BOQ */
    .boq-summary {
      display: flex;
      gap: 32px;
      font-size: var(--text-md);
    }
    .boq-summary strong {
      color: var(--color-text);
    }

    .below-cost { color: var(--color-danger); }

    /* Team */
    .team-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }

    .team-role-card {
      border-radius: 12px;
      overflow: hidden;
    }

    .team-role-card mat-card-header mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--color-primary);
    }

    .member-info { text-align: center; padding: 16px 0; }
    .member-name { display: block; font-weight: 600; font-size: var(--text-md); margin-bottom: 12px; }
    .member-status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 16px;
      font-size: var(--text-sm);
      font-weight: 500;
    }
    .member-status.status-pending { background: var(--color-warn-soft); color: var(--color-warn); }
    .member-status.status-inprogress { background: var(--color-primary-soft); color: var(--color-primary-hover); }
    .member-status.status-completed { background: var(--color-ok-soft); color: var(--color-ok); }

    .no-member {
      text-align: center;
      color: var(--color-text-3);
      padding: 16px 0;
    }

    /* Form - Create/Edit Mode */
    .tender-form {
      padding: 32px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      align-items: start;
    }

    .form-grid mat-form-field {
      width: 100%;
    }

    .form-grid h4 {
      margin: 16px 0 8px 0;
      color: var(--color-text);
      font-size: var(--text-lg);
      font-weight: 600;
    }

    .form-grid mat-divider {
      margin: 8px 0;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .two-cols {
      grid-column: span 2;
    }

    mat-dialog-actions {
      padding: 20px 32px;
      border-top: 1px solid var(--color-line);
      background: var(--color-canvas);
    }

    mat-dialog-actions button {
      min-width: 120px;
      padding: 8px 24px;
    }

    /* Material overrides */
    ::ng-deep .mat-mdc-tab-labels {
      background: var(--color-surface-2);
    }

    ::ng-deep .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
      color: var(--color-primary);
    }

    ::ng-deep .mat-mdc-tab-body-wrapper {
      flex: 1;
    }

    ::ng-deep .mdc-text-field--outlined {
      --mdc-outlined-text-field-outline-color: var(--color-line-strong);
      --mdc-outlined-text-field-focus-outline-color: var(--color-primary);
    }

    /* Welly BOQ Analysis Styles */
    .welly-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-scrim);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .welly-panel {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      width: 600px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .welly-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--color-surface);
      color: var(--color-text);
      border-bottom: 1px solid var(--color-line);
    }

    .welly-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-panel-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 600;
    }

    .welly-sparkle {
      color: var(--color-cat-amber);
    }

    .welly-panel-header button {
      color: var(--color-text-2);
    }

    .welly-panel-body {
      padding: 24px;
      overflow-y: auto;
      max-height: 60vh;
    }

    .welly-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
    }

    .welly-loading p {
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .progress-container {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .progress-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-icon {
      color: var(--color-cat-amber);
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .pulse-icon {
      animation: pulse 1.5s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.15); }
    }

    .progress-title {
      font-size: var(--text-md);
      font-weight: 700;
      color: var(--color-text);
      flex: 1;
    }

    .progress-timer {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--color-text-3);
      background: var(--color-surface-2);
      padding: 3px 10px;
      border-radius: 8px;
    }

    .progress-bar-track {
      width: 100%;
      height: 8px;
      background: var(--color-line);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: var(--color-primary);
      border-radius: 4px;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .progress-steps {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 8px 0;
    }

    .progress-step {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: var(--text-sm);
      color: var(--color-text-3);
      transition: all 0.3s;
    }

    .progress-step.active {
      color: var(--color-primary);
      font-weight: 600;
    }

    .progress-step.done {
      color: var(--color-ok);
    }

    .step-icon {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .step-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .progress-step.done .step-icon mat-icon {
      color: var(--color-ok);
    }

    .progress-step:not(.done):not(.active) .step-icon mat-icon {
      color: var(--color-line-strong);
    }

    .progress-message {
      text-align: center;
      color: var(--color-text-3);
      font-size: var(--text-sm);
      margin: 4px 0 0;
      font-style: italic;
    }

    .welly-result-text {
      background: var(--color-canvas);
      border: 1px solid var(--color-line);
      border-radius: 10px;
      padding: 16px;
      font-size: var(--text-md);
      line-height: 1.6;
      white-space: pre-wrap;
      max-height: 50vh;
      overflow-y: auto;
      margin-bottom: 16px;
    }

    .welly-result-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .welly-analysis-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      background: var(--color-primary-soft);
      border-bottom: 1px solid var(--color-line);
      font-size: var(--text-sm);
      color: var(--color-text-2);
    }

    .welly-analysis-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-primary);
    }

    .welly-analysis-info .doc-count {
      margin-left: auto;
      background: var(--color-ok-soft);
      color: var(--color-ok);
      padding: 2px 10px;
      border-radius: 12px;
      font-weight: 500;
      font-size: var(--text-xs);
    }

    .welly-extracted-boq {
      margin: 16px 0;
      border: 2px solid var(--color-primary);
      border-radius: 12px;
      padding: 16px;
      background: var(--color-primary-soft);
    }

    .welly-extracted-boq h4 {
      margin: 0 0 12px 0;
      color: var(--color-primary);
      font-size: var(--text-md);
    }

    .extracted-items-list {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 12px;
    }

    .extracted-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: var(--color-surface);
      border-radius: 6px;
      margin-bottom: 4px;
      font-size: var(--text-sm);
    }

    .extracted-item .item-num {
      color: var(--color-primary);
      font-weight: 600;
      min-width: 30px;
    }

    .extracted-item .item-desc {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .extracted-item .item-price {
      font-weight: 600;
      color: var(--color-ok);
      white-space: nowrap;
    }

    .import-btn {
      width: 100%;
    }

    .welly-result-text ::ng-deep h1,
    .welly-result-text ::ng-deep h2,
    .welly-result-text ::ng-deep h3 {
      margin: 12px 0 6px 0;
      font-size: var(--text-md);
      color: var(--color-text);
      font-weight: 600;
    }

    .welly-result-text ::ng-deep strong {
      color: var(--color-text);
    }

    .welly-result-text ::ng-deep ul,
    .welly-result-text ::ng-deep ol {
      padding-left: 20px;
      margin: 6px 0;
    }

    .welly-result-text ::ng-deep li {
      margin-bottom: 4px;
    }
  `]
})
export class TenderDetailDialogComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  tenderForm: FormGroup;
  saving = false;
  uploadType = '';

  workflowSteps = ['Draft', 'Review', 'Director Signoff', 'Submission Ready'];
  teamRoles = ['Technical', 'Financial', 'Compliance', 'DirectorApproval', 'ProjectLead'];
  boqColumns = ['line', 'code', 'description', 'qty', 'cost', 'price', 'margin', 'total', 'actions'];

  documentTypes = [
    'RFQ', 'RFP', 'RFI', 'BOQ', 'Addendum', 'Clarification',
    'TechnicalProposal', 'FinancialProposal', 'Submission', 'Contract', 'Other'
  ];

  constructor(
    public dialogRef: MatDialogRef<TenderDetailDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private fb: FormBuilder,
    private tenderService: TenderService,
    private authService: AuthService,
    private toast: ToastService,
    private http: HttpClient,
    private wellyActivity: WellyActivityService,
    private readonly confirmDialog: ConfirmService
  ) {
    this.tenderForm = this.fb.group({
      tenderNumber: [data.tender?.tenderNumber || '', Validators.required],
      companyCode: [data.tender?.companyCode || 'PMT', Validators.required],
      title: [data.tender?.title || '', Validators.required],
      description: [data.tender?.description || ''],
      issuingDepartment: [data.tender?.issuingDepartment || '', Validators.required],
      departmentCategory: [data.tender?.departmentCategory || ''],
      province: [data.tender?.province || ''],
      estimatedValue: [data.tender?.estimatedValue || null],
      contactPerson: [data.tender?.contactPerson || ''],
      contactEmail: [data.tender?.contactEmail || ''],
      contactPhone: [data.tender?.contactPhone || ''],
      publishedDate: [data.tender?.publishedDate ? new Date(data.tender.publishedDate) : null],
      closingDate: [data.tender?.closingDate ? new Date(data.tender.closingDate) : null, Validators.required],
      compulsoryBriefingDate: [data.tender?.compulsoryBriefingDate ? new Date(data.tender.compulsoryBriefingDate) : null],
      briefingVenue: [data.tender?.briefingVenue || ''],
      siteVisitDate: [data.tender?.siteVisitDate ? new Date(data.tender.siteVisitDate) : null],
      clarificationDeadline: [data.tender?.clarificationDeadline ? new Date(data.tender.clarificationDeadline) : null],
      priority: [data.tender?.priority || 'Medium']
    });
  }

  getCompanyColor(code: string): string {
    return this.data.companies.find(c => c.code === code)?.color || '#666';
  }

  statusTone(status: string | undefined): ChipTone | undefined {
    const tones: { [key: string]: ChipTone } = {
      'Submitted': 'info',
      'Clarification': 'warn',
      'Evaluation': 'info'
    };
    return tones[status || ''];
  }

  getDaysLeft(date: Date): number {
    const closing = new Date(date);
    const now = new Date();
    return Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  isPast(date: Date): boolean {
    return new Date(date) < new Date();
  }

  isWorkflowCompleted(step: string): boolean {
    if (!this.data.tender) return false;
    const currentIndex = this.workflowSteps.indexOf(this.data.tender.workflowStatus);
    const stepIndex = this.workflowSteps.indexOf(step);
    return stepIndex < currentIndex;
  }

  getActivityIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'Created': 'add_circle',
      'Updated': 'edit',
      'StatusChange': 'swap_horiz',
      'WorkflowChange': 'account_tree',
      'DocumentUpload': 'upload_file',
      'TeamAssignment': 'person_add',
      'TeamStatusUpdate': 'check_circle'
    };
    return icons[type] || 'info';
  }

  getRoleIcon(role: string): string {
    const icons: { [key: string]: string } = {
      'Technical': 'engineering',
      'Financial': 'attach_money',
      'Compliance': 'verified_user',
      'DirectorApproval': 'approval',
      'ProjectLead': 'supervisor_account'
    };
    return icons[role] || 'person';
  }

  getTeamMemberByRole(role: string): TenderTeamMember | undefined {
    return this.data.tender?.teamMembers?.find(m => m.role === role);
  }

  calculateBOQTotal(): number {
    return this.data.tender?.boqItems?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0;
  }

  calculateAvgMargin(): number {
    const items = this.data.tender?.boqItems?.filter(i => i.marginPercent != null) || [];
    if (items.length === 0) return 0;
    return items.reduce((sum, i) => sum + (i.marginPercent || 0), 0) / items.length;
  }

  switchToEdit(): void {
    this.data.mode = 'edit';
  }

  saveTender(): void {
    if (!this.tenderForm.valid) return;

    this.saving = true;
    const formValue = this.tenderForm.value;
    const currentUser = this.authService.currentUserValue;

    if (this.data.mode === 'create') {
      this.tenderService.createTender({
        ...formValue,
        createdByUserId: currentUser?.userId,
        createdByUserName: currentUser ? `${currentUser.name} ${currentUser.surname}` : undefined
      }).subscribe({
        next: () => {
          this.toast.done('Tender created successfully');
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving = false;
          this.toast.error('Error creating tender');
        }
      });
    } else {
      this.tenderService.updateTender(this.data.tender!.id, {
        ...formValue,
        updatedByUserId: currentUser?.userId,
        updatedByUserName: currentUser ? `${currentUser.name} ${currentUser.surname}` : undefined
      }).subscribe({
        next: () => {
          this.toast.done('Tender updated successfully');
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving = false;
          this.toast.error('Error updating tender');
        }
      });
    }
  }

  // Document methods
  async uploadDocument(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.data.tender) return;

    const file = input.files[0];
    const type = (await this.confirmDialog.askText({
      title: `Upload ${file.name}`,
      label: 'Document type',
      value: 'Submission',
      hint: 'For example RFQ, BOQ, Addendum, Submission. Left empty, it is saved as Other.',
      confirmText: 'Upload document'
    })) || 'Other';
    const currentUser = this.authService.currentUserValue;

    this.tenderService.uploadDocument(
      this.data.tender.id,
      file,
      type,
      currentUser?.userId || 0,
      currentUser ? `${currentUser.name} ${currentUser.surname}` : undefined
    ).subscribe({
      next: (doc) => {
        this.data.tender!.documents = [...(this.data.tender!.documents || []), doc];
        this.toast.done('Document uploaded');
      },
      error: () => this.toast.error('Error uploading document')
    });
  }

  downloadDocument(doc: TenderDocument): void {
    this.tenderService.downloadDocument(doc.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Error downloading document')
    });
  }

  async deleteDocument(doc: TenderDocument): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete document ${doc.fileName}?`,
      message: 'The document is deleted from this tender.',
      confirmText: 'Delete document',
      danger: true
    }))) return;
    this.tenderService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.data.tender!.documents = this.data.tender!.documents?.filter(d => d.id !== doc.id);
        this.toast.done('Document deleted');
      },
      error: () => this.toast.error('Error deleting document')
    });
  }

  // BOQ methods
  async addBOQItem(): Promise<void> {
    if (!this.data.tender) return;
    const form = await this.confirmDialog.askForm({
      title: 'Add a BOQ line item',
      fields: [
        { key: 'description', label: 'Item description', required: true },
        { key: 'quantity', label: 'Quantity', type: 'number', value: 1 },
        { key: 'unitCost', label: 'Unit cost (optional)', type: 'number' },
        { key: 'unitPrice', label: 'Unit price', type: 'number', value: 0 }
      ],
      confirmText: 'Add item'
    });
    const desc = form ? String(form['description'] ?? '') : '';
    if (!form || !desc) return;

    const qty = parseFloat(String(form['quantity'] ?? '') || '1');
    const cost = parseFloat(String(form['unitCost'] ?? '') || '0') || undefined;
    const price = parseFloat(String(form['unitPrice'] ?? '') || '0');

    this.tenderService.addBOQItem(this.data.tender.id, {
      description: desc,
      quantity: qty,
      unitCost: cost,
      unitPrice: price
    }).subscribe({
      next: (item) => {
        this.data.tender!.boqItems = [...(this.data.tender!.boqItems || []), item];
        this.toast.done('Item added');
      },
      error: () => this.toast.error('Error adding item')
    });
  }

  async editBOQItem(item: TenderBOQItem): Promise<void> {
    const form = await this.confirmDialog.askForm({
      title: `New unit price for "${item.description}"`,
      fields: [{ key: 'unitPrice', label: 'New unit price', type: 'number', value: item.unitPrice }],
      confirmText: 'Save price'
    });
    const price = parseFloat(String(form?.['unitPrice'] ?? '') || item.unitPrice.toString());
    this.tenderService.updateBOQItem(item.id, { unitPrice: price }).subscribe({
      next: () => {
        item.unitPrice = price;
        this.toast.done('Item updated');
      },
      error: () => this.toast.error('Error updating item')
    });
  }

  async deleteBOQItem(item: TenderBOQItem): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete BOQ item "${item.description}"?`,
      message: 'The item is removed from this tender\'s bill of quantities.',
      confirmText: 'Delete item',
      danger: true
    }))) return;
    this.tenderService.deleteBOQItem(item.id).subscribe({
      next: () => {
        this.data.tender!.boqItems = this.data.tender!.boqItems?.filter(i => i.id !== item.id);
        this.toast.done('Item deleted');
      },
      error: () => this.toast.error('Error deleting item')
    });
  }

  // Team methods
  async addTeamMember(role?: string): Promise<void> {
    if (!this.data.tender) return;
    const form = await this.confirmDialog.askForm({
      title: role ? `Assign a ${role} team member` : 'Assign a team member',
      fields: [
        { key: 'name', label: 'Team member name', required: true },
        ...(role ? [] : [{ key: 'role', label: 'Role', value: 'Technical', hint: this.teamRoles.join(', ') }])
      ],
      confirmText: 'Assign'
    });
    const memberName = form ? String(form['name'] ?? '') : '';
    if (!form || !memberName) return;

    const memberRole = role || String(form['role'] ?? '') || 'Technical';
    const currentUser = this.authService.currentUserValue;

    this.tenderService.addTeamMember(this.data.tender.id, {
      userName: memberName,
      role: memberRole,
      assignedByUserId: currentUser?.userId,
      assignedByUserName: currentUser ? `${currentUser.name} ${currentUser.surname}` : undefined
    }).subscribe({
      next: (member) => {
        this.data.tender!.teamMembers = [...(this.data.tender!.teamMembers || []), member];
        this.toast.done('Team member added');
      },
      error: () => this.toast.error('Error adding team member')
    });
  }

  updateMemberStatus(member: TenderTeamMember, status: string): void {
    const currentUser = this.authService.currentUserValue;
    this.tenderService.updateTeamMember(member.id, {
      status,
      updatedByUserId: currentUser?.userId,
      updatedByUserName: currentUser ? `${currentUser.name} ${currentUser.surname}` : undefined
    }).subscribe({
      next: () => {
        member.status = status;
        this.toast.done('Status updated');
      },
      error: () => this.toast.error('Error updating status')
    });
  }

  // ═══════════════════════════════════════════
  // Welly AI Tender Analysis
  // ═══════════════════════════════════════════

  showWellyPanel = false;
  wellyLoading = false;
  wellyResult = '';
  wellyLoadingMessage = 'Welly is analyzing the tender...';
  wellyDocsAnalyzed = 0;
  wellyAnalysisInfo: { icon: string; label: string } | null = null;
  wellyExtractedItems: { lineNumber: number; itemCode: string; description: string; unit: string; quantity: number; unitCost: number; unitPrice: number; marginPercent: number }[] = [];

  // Progress tracking
  wellyProgressPercent = 0;
  wellyCurrentStep = 0;
  wellyElapsedTime = '0:00';
  wellyProgressSteps = [
    { label: 'Reading tender details & documents' },
    { label: 'Extracting text from files' },
    { label: 'Analyzing content with AI' },
    { label: 'Generating insights' }
  ];
  private wellyTimerInterval: any = null;
  private wellyProgressInterval: any = null;
  private wellyStartTime = 0;
  private wellyActivityId: number | null = null;

  wellyDocumentAnalyze(analysisType: 'analyze' | 'pricing-review' | 'extract-boq'): void {
    if (!this.data.tender) return;
    this.showWellyPanel = true;
    this.wellyLoading = true;
    this.wellyResult = '';
    this.wellyDocsAnalyzed = 0;
    this.wellyExtractedItems = [];

    const typeInfo: Record<string, { icon: string; label: string; loadMsg: string }> = {
      'analyze': { icon: 'analytics', label: 'Full Document & BOQ Analysis', loadMsg: 'Welly is reading your tender documents and analyzing the BOQ...' },
      'pricing-review': { icon: 'price_check', label: 'Pricing Review', loadMsg: 'Welly is reviewing pricing from your tender documents...' },
      'extract-boq': { icon: 'playlist_add', label: 'Extract BOQ from Documents', loadMsg: 'Welly is extracting BOQ items from your uploaded documents...' }
    };

    const info = typeInfo[analysisType];
    this.wellyAnalysisInfo = { icon: info.icon, label: info.label };
    this.wellyLoadingMessage = info.loadMsg;

    this.wellyActivityId = this.wellyActivity.start(`Tenders: ${info.label}`);

    // Start progress tracking
    this.startWellyProgress();

    this.http.post<{ result: string; analysisType: string; documentsAnalyzed: number; boqItemCount: number }>(
      `${environment.apiUrl}/aichat/tender-document-analyze`, {
        tenderId: this.data.tender.id,
        analysisType: analysisType
      }
    ).subscribe({
      next: (res) => {
        this.stopWellyProgress();
        this.wellyProgressPercent = 100;
        this.wellyCurrentStep = this.wellyProgressSteps.length;
        this.wellyResult = res.result;
        this.wellyDocsAnalyzed = res.documentsAnalyzed;
        this.wellyLoading = false;

        // Parse extracted BOQ items if extract-boq type
        if (analysisType === 'extract-boq') {
          this.parseExtractedBOQItems(res.result);
        }
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: () => {
        this.stopWellyProgress();
        this.toast.error('Welly could not analyze tender documents. Please try again.');
        this.wellyLoading = false;
        this.showWellyPanel = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  private startWellyProgress(): void {
    this.wellyStartTime = Date.now();
    this.wellyProgressPercent = 0;
    this.wellyCurrentStep = 0;
    this.wellyElapsedTime = '0:00';

    // Update elapsed time every second
    this.wellyTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.wellyStartTime) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      this.wellyElapsedTime = `${min}:${sec.toString().padStart(2, '0')}`;
    }, 1000);

    // Simulate progress steps (AI takes ~2-5 min on CPU)
    // Step 0: Reading tender (0-15%) — fast, ~5s
    // Step 1: Extracting text (15-30%) — moderate, ~10s
    // Step 2: AI analyzing (30-85%) — slow, bulk of time
    // Step 3: Generating insights (85-95%) — tail end
    const stepTimings = [
      { delay: 0, step: 0, percent: 5 },
      { delay: 3000, step: 0, percent: 12 },
      { delay: 6000, step: 1, percent: 20 },
      { delay: 12000, step: 1, percent: 28 },
      { delay: 18000, step: 2, percent: 35 },
      { delay: 30000, step: 2, percent: 42 },
      { delay: 50000, step: 2, percent: 50 },
      { delay: 75000, step: 2, percent: 58 },
      { delay: 100000, step: 2, percent: 65 },
      { delay: 130000, step: 2, percent: 72 },
      { delay: 160000, step: 3, percent: 80 },
      { delay: 200000, step: 3, percent: 85 },
      { delay: 240000, step: 3, percent: 88 },
      { delay: 280000, step: 3, percent: 91 },
      { delay: 320000, step: 3, percent: 93 },
    ];

    const loadingMessages = [
      'Loading tender metadata and documents...',
      'Extracting text from uploaded files...',
      'Welly is thinking deeply about your tender...',
      'Almost there — generating final insights...'
    ];

    this.wellyProgressInterval = stepTimings.map(t =>
      setTimeout(() => {
        if (this.wellyLoading) {
          this.wellyProgressPercent = t.percent;
          this.wellyCurrentStep = t.step;
          this.wellyLoadingMessage = loadingMessages[t.step];
        }
      }, t.delay)
    );
  }

  private stopWellyProgress(): void {
    if (this.wellyTimerInterval) {
      clearInterval(this.wellyTimerInterval);
      this.wellyTimerInterval = null;
    }
    if (this.wellyProgressInterval) {
      this.wellyProgressInterval.forEach((t: any) => clearTimeout(t));
      this.wellyProgressInterval = null;
    }
  }

  parseExtractedBOQItems(result: string): void {
    const lines = result.split('\n');
    this.wellyExtractedItems = [];
    for (const line of lines) {
      const match = line.match(/\[BOQ_ITEM\]\s*(.+)/);
      if (match) {
        const parts = match[1].split('|').map(p => p.trim());
        if (parts.length >= 7) {
          this.wellyExtractedItems.push({
            lineNumber: parseInt(parts[0]) || this.wellyExtractedItems.length + 1,
            itemCode: parts[1] !== 'N/A' ? parts[1] : '',
            description: parts[2] || 'Unknown item',
            unit: parts[3] !== 'N/A' ? parts[3] : 'each',
            quantity: parseFloat(parts[4]) || 1,
            unitCost: parseFloat(parts[5]) || 0,
            unitPrice: parseFloat(parts[6]) || 0,
            marginPercent: parseFloat(parts[7]) || 0
          });
        }
      }
    }
  }

  importExtractedBOQItems(): void {
    if (!this.data.tender || this.wellyExtractedItems.length === 0) return;

    let imported = 0;
    const total = this.wellyExtractedItems.length;

    for (const item of this.wellyExtractedItems) {
      this.tenderService.addBOQItem(this.data.tender.id, {
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost || undefined,
        unitPrice: item.unitPrice,
        unit: item.unit,
        itemCode: item.itemCode
      }).subscribe({
        next: (newItem) => {
          this.data.tender!.boqItems = [...(this.data.tender!.boqItems || []), newItem];
          imported++;
          if (imported === total) {
            this.toast.done(`${imported} BOQ items imported from documents.`);
            this.wellyExtractedItems = [];
          }
        },
        error: () => {
          imported++;
          if (imported === total) {
            this.toast.warn(`Imported some items. Check for errors.`);
          }
        }
      });
    }
  }

  wellyAnalyzeBOQ(): void {
    if (!this.data.tender) return;
    this.showWellyPanel = true;
    this.wellyLoading = true;
    this.wellyResult = '';
    this.wellyDocsAnalyzed = 0;
    this.wellyExtractedItems = [];
    this.wellyAnalysisInfo = { icon: 'calculate', label: 'Quick BOQ Analysis' };
    this.wellyLoadingMessage = 'Welly is analyzing your BOQ items...';
    this.wellyActivityId = this.wellyActivity.start('Tenders: Analyzing BOQ');

    const boqItems = this.data.tender.boqItems || [];
    const boqSummary = boqItems.map(item =>
      `Line ${item.lineNumber}: ${item.description} | Code: ${item.itemCode || 'N/A'} | Qty: ${item.quantity} ${item.unit} | Cost: R${item.unitCost || 0} | Price: R${item.unitPrice} | Margin: ${item.marginPercent}% | Total: R${item.totalPrice}`
    ).join('\n');

    const content = `Tender: ${this.data.tender.tenderNumber} — ${this.data.tender.title}\nIssuing Dept: ${this.data.tender.issuingDepartment}\nStatus: ${this.data.tender.status}\nTotal BOQ Value: R${this.calculateBOQTotal().toFixed(2)}\nAvg Margin: ${this.calculateAvgMargin().toFixed(1)}%\nNumber of Line Items: ${boqItems.length}\n\nBOQ Line Items:\n${boqSummary || 'No BOQ items found'}`;

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'analyze-boq',
      content: content
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: () => {
        this.toast.error('Welly could not analyze BOQ. Please try again.');
        this.wellyLoading = false;
        this.showWellyPanel = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  wellyCheckCompliance(): void {
    if (!this.data.tender) return;
    this.showWellyPanel = true;
    this.wellyLoading = true;
    this.wellyResult = '';
    this.wellyExtractedItems = [];
    this.wellyAnalysisInfo = { icon: 'verified', label: 'Compliance Check' };
    this.wellyLoadingMessage = 'Welly is checking tender compliance...';
    this.wellyActivityId = this.wellyActivity.start('Tenders: Checking compliance');

    const docs = this.data.tender.documents || [];
    const docList = docs.map(d => `${d.documentType}: ${d.fileName} (v${d.version})`).join('\n');
    const team = this.data.tender.teamMembers || [];
    const teamList = team.map(t => `${t.role}: ${t.userName} (${t.status})`).join('\n');

    const content = `Tender: ${this.data.tender.tenderNumber} — ${this.data.tender.title}\nStatus: ${this.data.tender.status}\nClosing Date: ${this.data.tender.closingDate}\nCompany: ${this.data.tender.companyCode}\n\nDocuments:\n${docList || 'No documents uploaded'}\n\nTeam:\n${teamList || 'No team members assigned'}\n\nBOQ Items: ${(this.data.tender.boqItems || []).length} items, Total: R${this.calculateBOQTotal().toFixed(2)}`;

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'check-compliance',
      content: content
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: () => {
        this.toast.error('Welly could not check compliance. Please try again.');
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  formatWellyResult(text: string): string {
    // Convert markdown-like formatting to HTML
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^\- (.+)$/gm, '• $1')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\n/g, '<br>');
  }

  copyWellyResult(): void {
    navigator.clipboard.writeText(this.wellyResult).then(() => {
      this.toast.done('Copied to clipboard');
    });
  }
}
