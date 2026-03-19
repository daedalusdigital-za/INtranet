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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCardModule } from '@angular/material/card';
import { TenderService, Tender, TenderDocument, TenderTeamMember, TenderBOQItem, TenderActivity } from '../../services/tender.service';
import { AuthService } from '../../services/auth.service';
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
    MatSnackBarModule,
    MatMenuModule,
    MatExpansionModule,
    MatCardModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe
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
              <span class="status-badge" [style.background-color]="getStatusColor(data.tender?.status || 'Draft')">
                {{ data.tender?.status }}
              </span>
            </div>
          }
        </div>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
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
                        <button mat-icon-button (click)="downloadDocument(doc)" matTooltip="Download">
                          <mat-icon>download</mat-icon>
                        </button>
                        <button mat-icon-button (click)="deleteDocument(doc)" matTooltip="Delete" color="warn">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="['type', 'name', 'version', 'uploaded', 'actions']"></tr>
                    <tr mat-row *matRowDef="let row; columns: ['type', 'name', 'version', 'uploaded', 'actions'];"></tr>
                  </table>
                } @else {
                  <div class="empty-state">
                    <mat-icon>folder_open</mat-icon>
                    <p>No documents uploaded yet</p>
                  </div>
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
                  <button mat-raised-button class="welly-boq-btn" [matMenuTriggerFor]="wellyMenu" matTooltip="Welly AI Pricing Assistant">
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
                        <button mat-icon-button [matMenuTriggerFor]="boqMenu">
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
                  <div class="empty-state">
                    <mat-icon>list_alt</mat-icon>
                    <p>No BOQ items added yet</p>
                  </div>
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
              <button mat-icon-button (click)="showWellyPanel = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            @if (wellyAnalysisInfo) {
              <div class="welly-analysis-info">
                <mat-icon>{{ wellyAnalysisInfo.icon }}</mat-icon>
                <span>{{ wellyAnalysisInfo.label }}</span>
                @if (wellyDocsAnalyzed > 0) {
                  <span class="doc-count">📄 {{ wellyDocsAnalyzed }} doc(s) read</span>
                }
              </div>
            }
            <div class="welly-panel-body">
              @if (wellyLoading) {
                <div class="welly-loading">
                  <mat-spinner diameter="36"></mat-spinner>
                  <p>{{ wellyLoadingMessage }}</p>
                </div>
              } @else if (wellyResult) {
                <div class="welly-result">
                  <div class="welly-result-text" [innerHTML]="formatWellyResult(wellyResult)"></div>
                  @if (wellyExtractedItems.length > 0) {
                    <div class="welly-extracted-boq">
                      <h4>📋 Extracted BOQ Items ({{ wellyExtractedItems.length }})</h4>
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
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .dialog-header button {
      color: white;
    }

    .tender-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .company-badge {
      padding: 6px 16px;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }

    .status-badge {
      padding: 6px 16px;
      border-radius: 20px;
      color: white;
      font-size: 13px;
      font-weight: 500;
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
      font-size: 20px;
      color: #1a5fb4;
    }

    .description {
      color: #666;
      margin-bottom: 24px;
      line-height: 1.6;
    }

    .info-row {
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .info-row mat-icon {
      margin-right: 16px;
      color: #1e90ff;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .info-row .label {
      display: block;
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .info-row .value {
      font-weight: 600;
      font-size: 15px;
      color: #333;
    }

    /* Dates Section */
    .dates-section h4, .workflow-section h4 {
      margin: 0 0 20px 0;
      color: #1a5fb4;
      font-size: 18px;
    }

    .date-timeline {
      border-left: 3px solid #1e90ff;
      padding-left: 24px;
      margin-left: 8px;
    }

    .timeline-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 20px;
      position: relative;
      padding: 12px;
      background: #f8f9fa;
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
      background: #E0E0E0;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .timeline-item.past::before { background: #4CAF50; }
    .timeline-item.closing::before { background: #F44336; }

    .timeline-item mat-icon {
      margin-right: 16px;
      color: #1e90ff;
    }
    .timeline-item .label {
      display: block;
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .timeline-item .date {
      font-weight: 600;
      font-size: 15px;
      color: #333;
    }
    .timeline-item .venue {
      display: block;
      font-size: 13px;
      color: #1976D2;
      margin-top: 4px;
    }
    .timeline-item.urgent .date { color: #F44336; font-weight: 700; }

    .days-badge {
      display: inline-block;
      padding: 4px 12px;
      background: #FFEBEE;
      color: #C62828;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 12px;
    }

    /* Workflow */
    .workflow-section {
      grid-column: 1 / -1;
      margin-top: 16px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
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
      background: #F5F5F5;
      border-radius: 24px;
      font-size: 14px;
      transition: all 0.2s;
    }
    .step.active {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3);
    }
    .step.completed {
      background: #E8F5E9;
      color: #2E7D32;
    }

    .step-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #CCC;
      margin-right: 10px;
    }
    .step.active .step-indicator { background: white; }
    .step.completed .step-indicator { background: #4CAF50; }

    /* Activity */
    .activity-list {
      max-height: 250px;
      overflow-y: auto;
    }

    .activity-item {
      display: flex;
      padding: 16px;
      border-bottom: 1px solid #EEE;
    }
    .activity-item mat-icon {
      margin-right: 16px;
      color: #1e90ff;
    }
    .activity-desc {
      display: block;
      font-size: 14px;
    }
    .activity-meta {
      display: block;
      font-size: 12px;
      color: #999;
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

    .empty-state {
      text-align: center;
      padding: 64px;
      color: #999;
    }
    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
    }
    .empty-state p {
      font-size: 16px;
      margin-top: 16px;
    }

    /* BOQ */
    .boq-summary {
      display: flex;
      gap: 32px;
      font-size: 15px;
    }
    .boq-summary strong {
      color: #1a5fb4;
    }

    .below-cost { color: #F44336 !important; }

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
      color: #1e90ff;
    }

    .member-info { text-align: center; padding: 16px 0; }
    .member-name { display: block; font-weight: 600; font-size: 15px; margin-bottom: 12px; }
    .member-status {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
    }
    .member-status.status-pending { background: #FFF3E0; color: #E65100; }
    .member-status.status-inprogress { background: #E3F2FD; color: #1565C0; }
    .member-status.status-completed { background: #E8F5E9; color: #2E7D32; }

    .no-member {
      text-align: center;
      color: #999;
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
      color: #1a5fb4;
      font-size: 16px;
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
      border-top: 1px solid #E0E0E0;
      background: #fafafa;
    }

    mat-dialog-actions button {
      min-width: 120px;
      padding: 8px 24px;
    }

    /* Material overrides */
    ::ng-deep .mat-mdc-tab-labels {
      background: #f5f5f5;
    }

    ::ng-deep .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
      color: #1e90ff;
    }

    ::ng-deep .mat-mdc-tab-body-wrapper {
      flex: 1;
    }

    ::ng-deep .mdc-text-field--outlined {
      --mdc-outlined-text-field-outline-color: #ccc;
      --mdc-outlined-text-field-focus-outline-color: #1e90ff;
    }

    /* Welly BOQ Analysis Styles */
    .welly-boq-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      border: none !important;
    }

    .welly-boq-btn:hover {
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .welly-boq-btn .welly-sparkle {
      color: #ffd700;
    }

    .welly-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .welly-panel {
      background: white;
      border-radius: 16px;
      width: 600px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .welly-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .welly-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-panel-title h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }

    .welly-sparkle {
      color: #ffd700;
    }

    .welly-panel-header button {
      color: white;
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
      color: #666;
      font-size: 14px;
    }

    .welly-result-text {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 16px;
      font-size: 14px;
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
      background: rgba(102, 126, 234, 0.08);
      border-bottom: 1px solid rgba(102, 126, 234, 0.15);
      font-size: 13px;
      color: #555;
    }

    .welly-analysis-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #667eea;
    }

    .welly-analysis-info .doc-count {
      margin-left: auto;
      background: #e8f5e9;
      color: #2e7d32;
      padding: 2px 10px;
      border-radius: 12px;
      font-weight: 500;
      font-size: 12px;
    }

    .welly-extracted-boq {
      margin: 16px 0;
      border: 2px solid #667eea;
      border-radius: 12px;
      padding: 16px;
      background: #f5f3ff;
    }

    .welly-extracted-boq h4 {
      margin: 0 0 12px 0;
      color: #4527a0;
      font-size: 14px;
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
      background: white;
      border-radius: 6px;
      margin-bottom: 4px;
      font-size: 13px;
    }

    .extracted-item .item-num {
      color: #667eea;
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
      color: #2e7d32;
      white-space: nowrap;
    }

    .import-btn {
      width: 100%;
    }

    .welly-result-text ::ng-deep h1,
    .welly-result-text ::ng-deep h2,
    .welly-result-text ::ng-deep h3 {
      margin: 12px 0 6px 0;
      font-size: 15px;
      color: #333;
      font-weight: 600;
    }

    .welly-result-text ::ng-deep strong {
      color: #4527a0;
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
    private snackBar: MatSnackBar,
    private http: HttpClient
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

  getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      'Draft': '#4CAF50',
      'Submitted': '#2196F3',
      'Clarification': '#FF9800',
      'Evaluation': '#9C27B0',
      'Awarded': '#FFC107',
      'Lost': '#F44336',
      'Cancelled': '#212121'
    };
    return colors[status] || '#666';
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
          this.snackBar.open('Tender created successfully', 'Close', { duration: 2000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving = false;
          this.snackBar.open('Error creating tender', 'Close', { duration: 3000 });
        }
      });
    } else {
      this.tenderService.updateTender(this.data.tender!.id, {
        ...formValue,
        updatedByUserId: currentUser?.userId,
        updatedByUserName: currentUser ? `${currentUser.name} ${currentUser.surname}` : undefined
      }).subscribe({
        next: () => {
          this.snackBar.open('Tender updated successfully', 'Close', { duration: 2000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving = false;
          this.snackBar.open('Error updating tender', 'Close', { duration: 3000 });
        }
      });
    }
  }

  // Document methods
  uploadDocument(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.data.tender) return;

    const file = input.files[0];
    const type = prompt('Document type:', 'Submission') || 'Other';
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
        this.snackBar.open('Document uploaded', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error uploading document', 'Close', { duration: 3000 })
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
      error: () => this.snackBar.open('Error downloading document', 'Close', { duration: 3000 })
    });
  }

  deleteDocument(doc: TenderDocument): void {
    if (!confirm('Delete this document?')) return;
    this.tenderService.deleteDocument(doc.id).subscribe({
      next: () => {
        this.data.tender!.documents = this.data.tender!.documents?.filter(d => d.id !== doc.id);
        this.snackBar.open('Document deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error deleting document', 'Close', { duration: 3000 })
    });
  }

  // BOQ methods
  addBOQItem(): void {
    if (!this.data.tender) return;
    const desc = prompt('Item description:');
    if (!desc) return;
    
    const qty = parseFloat(prompt('Quantity:', '1') || '1');
    const cost = parseFloat(prompt('Unit cost (optional):', '') || '0') || undefined;
    const price = parseFloat(prompt('Unit price:', '0') || '0');

    this.tenderService.addBOQItem(this.data.tender.id, {
      description: desc,
      quantity: qty,
      unitCost: cost,
      unitPrice: price
    }).subscribe({
      next: (item) => {
        this.data.tender!.boqItems = [...(this.data.tender!.boqItems || []), item];
        this.snackBar.open('Item added', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error adding item', 'Close', { duration: 3000 })
    });
  }

  editBOQItem(item: TenderBOQItem): void {
    const price = parseFloat(prompt('New unit price:', item.unitPrice.toString()) || item.unitPrice.toString());
    this.tenderService.updateBOQItem(item.id, { unitPrice: price }).subscribe({
      next: () => {
        item.unitPrice = price;
        this.snackBar.open('Item updated', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error updating item', 'Close', { duration: 3000 })
    });
  }

  deleteBOQItem(item: TenderBOQItem): void {
    if (!confirm('Delete this item?')) return;
    this.tenderService.deleteBOQItem(item.id).subscribe({
      next: () => {
        this.data.tender!.boqItems = this.data.tender!.boqItems?.filter(i => i.id !== item.id);
        this.snackBar.open('Item deleted', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error deleting item', 'Close', { duration: 3000 })
    });
  }

  // Team methods
  addTeamMember(role?: string): void {
    if (!this.data.tender) return;
    const memberName = prompt('Team member name:');
    if (!memberName) return;

    const memberRole = role || prompt('Role:', 'Technical') || 'Technical';
    const currentUser = this.authService.currentUserValue;

    this.tenderService.addTeamMember(this.data.tender.id, {
      userName: memberName,
      role: memberRole,
      assignedByUserId: currentUser?.userId,
      assignedByUserName: currentUser ? `${currentUser.name} ${currentUser.surname}` : undefined
    }).subscribe({
      next: (member) => {
        this.data.tender!.teamMembers = [...(this.data.tender!.teamMembers || []), member];
        this.snackBar.open('Team member added', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error adding team member', 'Close', { duration: 3000 })
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
        this.snackBar.open('Status updated', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Error updating status', 'Close', { duration: 3000 })
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

    this.http.post<{ result: string; analysisType: string; documentsAnalyzed: number; boqItemCount: number }>(
      `${environment.apiUrl}/aichat/tender-document-analyze`, {
        tenderId: this.data.tender.id,
        analysisType: analysisType
      }
    ).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyDocsAnalyzed = res.documentsAnalyzed;
        this.wellyLoading = false;

        // Parse extracted BOQ items if extract-boq type
        if (analysisType === 'extract-boq') {
          this.parseExtractedBOQItems(res.result);
        }
      },
      error: () => {
        this.snackBar.open('Welly could not analyze tender documents. Please try again.', 'Close', { duration: 3000 });
        this.wellyLoading = false;
        this.showWellyPanel = false;
      }
    });
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
            this.snackBar.open(`✅ ${imported} BOQ items imported from documents!`, 'Close', { duration: 4000 });
            this.wellyExtractedItems = [];
          }
        },
        error: () => {
          imported++;
          if (imported === total) {
            this.snackBar.open(`Imported some items. Check for errors.`, 'Close', { duration: 3000 });
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
      },
      error: () => {
        this.snackBar.open('Welly could not analyze BOQ. Please try again.', 'Close', { duration: 3000 });
        this.wellyLoading = false;
        this.showWellyPanel = false;
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
      },
      error: () => {
        this.snackBar.open('Welly could not check compliance. Please try again.', 'Close', { duration: 3000 });
        this.wellyLoading = false;
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
      this.snackBar.open('Copied to clipboard ✓', 'Close', { duration: 2000 });
    });
  }
}
