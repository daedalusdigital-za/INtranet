import { Component, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { HttpClient } from '@angular/common/http';

interface Company {
  code: string;
  name: string;
}

interface ImportSummary {
  customers: number;
  transactions: number;
  dateMin: string | null;
  dateMax: string | null;
  salesTotal: number;
  costTotal: number;
  grossProfit: number;
  customerSummaries?: CustomerSummary[];
  // Duplicate detection
  duplicateCount: number;
  duplicateSalesTotal: number;
  duplicates?: DuplicateInfo[];
}

interface DuplicateInfo {
  rowIndex: number;
  transactionNumber: string;
  customerNumber: string;
  transactionDate: string;
  salesAmount: number;
  existingSalesAmount: number;
  existingImportBatchId: string;
  existingImportedAt: string;
}

interface CustomerSummary {
  customerNumber: string;
  customerName: string;
  transactionCount: number;
  salesTotal: number;
  costTotal: number;
}

interface ImportIssue {
  rowIndex: number;
  severity: string;
  code: string;
  message: string;
}

interface Transaction {
  id: number;
  rowIndex: number;
  customerNumber: string;
  customerName: string;
  transactionDate: string;
  transactionNumber: string;
  type: string;
  salesAmount: number;
  costOfSales: number;
  quantity: number;
  hasIssues: boolean;
}

export interface SalesImportDialogData {
  apiUrl: string;
  file: File;
}

export interface SalesImportDialogResult {
  success: boolean;
  importId?: string;
  committed?: boolean;
  message?: string;
}

@Component({
  selector: 'app-sales-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTableModule,
    MatPaginatorModule,
    MatChipsModule,
    MatExpansionModule,
    MatTooltipModule,
    MatBadgeModule
  ],
  template: `
    <div class="sales-import-dialog">
      <h2 mat-dialog-title>
        <mat-icon>upload_file</mat-icon>
        Import Sales Report
      </h2>

      <mat-dialog-content>
        <!-- Step 1: File & Company Selection -->
        @if (currentStep() === 'setup') {
          <div class="setup-section">
            <!-- File Info -->
            <div class="file-info-card">
              <mat-icon class="file-icon">table_chart</mat-icon>
              <div class="file-details">
                <span class="file-name">{{ data.file.name }}</span>
                <span class="file-size">{{ formatFileSize(data.file.size) }}</span>
              </div>
            </div>

            <!-- Company Selection -->
            <div class="form-section">
              <h4><mat-icon>business</mat-icon> Select Company</h4>
              <p class="hint">Which company does this sales data belong to?</p>
              
              <div class="company-cards">
                @for (company of companies; track company.code) {
                  <div class="company-card" 
                       [class.selected]="selectedCompany() === company.code"
                       (click)="selectedCompany.set(company.code)">
                    <div class="company-code">{{ company.code }}</div>
                    <div class="company-name">{{ company.name }}</div>
                  </div>
                }
              </div>
            </div>

            <!-- Date Range (Optional) -->
            <div class="form-section">
              <h4><mat-icon>date_range</mat-icon> Report Period (Optional)</h4>
              <p class="hint">Specify the date range if known, or leave blank to auto-detect from data</p>
              
              <div class="date-range-inputs">
                <mat-form-field appearance="outline">
                  <mat-label>From Date</mat-label>
                  <input matInput [matDatepicker]="fromPicker" [(ngModel)]="fromDate">
                  <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
                  <mat-datepicker #fromPicker></mat-datepicker>
                </mat-form-field>

                <mat-icon class="date-separator">arrow_forward</mat-icon>

                <mat-form-field appearance="outline">
                  <mat-label>To Date</mat-label>
                  <input matInput [matDatepicker]="toPicker" [(ngModel)]="toDate">
                  <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
                  <mat-datepicker #toPicker></mat-datepicker>
                </mat-form-field>
              </div>
            </div>
          </div>
        }

        <!-- Step 2: Uploading/Parsing -->
        @if (currentStep() === 'uploading') {
          <div class="uploading-section">
            <mat-spinner diameter="60"></mat-spinner>
            <h3>Processing Sales Report...</h3>
            <p>Parsing transactions and validating data</p>
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          </div>
        }

        <!-- Step 3: Preview Results -->
        @if (currentStep() === 'preview') {
          <div class="preview-section">
            <!-- Summary Cards -->
            <div class="summary-cards">
              <div class="summary-card">
                <mat-icon>people</mat-icon>
                <div class="value">{{ importSummary()?.customers || 0 }}</div>
                <div class="label">Customers</div>
              </div>
              <div class="summary-card">
                <mat-icon>receipt_long</mat-icon>
                <div class="value">{{ importSummary()?.transactions || 0 }}</div>
                <div class="label">Transactions</div>
              </div>
              <div class="summary-card sales">
                <mat-icon>trending_up</mat-icon>
                <div class="value">{{ formatCurrency(importSummary()?.salesTotal || 0) }}</div>
                <div class="label">Total Sales</div>
              </div>
              <div class="summary-card cost">
                <mat-icon>trending_down</mat-icon>
                <div class="value">{{ formatCurrency(importSummary()?.costTotal || 0) }}</div>
                <div class="label">Cost of Sales</div>
              </div>
              <div class="summary-card profit">
                <mat-icon>account_balance</mat-icon>
                <div class="value">{{ formatCurrency(importSummary()?.grossProfit || 0) }}</div>
                <div class="label">Gross Profit</div>
              </div>
            </div>

            <!-- Date Range Detected -->
            @if (importSummary()?.dateMin || importSummary()?.dateMax) {
              <div class="date-range-info">
                <mat-icon>calendar_today</mat-icon>
                <span>Date Range: {{ importSummary()?.dateMin || 'N/A' }} to {{ importSummary()?.dateMax || 'N/A' }}</span>
              </div>
            }

            <!-- Duplicate Warning Banner -->
            @if (importSummary()?.duplicateCount && importSummary()!.duplicateCount > 0) {
              <div class="duplicate-warning-banner">
                <div class="warning-header">
                  <mat-icon>content_copy</mat-icon>
                  <div class="warning-text">
                    <strong>{{ importSummary()?.duplicateCount }} Duplicate Transaction(s) Detected!</strong>
                    <span>These transactions already exist in the database and will create duplicates if committed.</span>
                  </div>
                </div>
                <div class="warning-summary">
                  <span class="stat">
                    <mat-icon>attach_money</mat-icon>
                    Duplicate Sales Value: <strong>{{ formatCurrency(importSummary()?.duplicateSalesTotal || 0) }}</strong>
                  </span>
                </div>
                
                <!-- Duplicate Details -->
                @if (importSummary()?.duplicates && importSummary()!.duplicates!.length > 0) {
                  <mat-expansion-panel class="duplicates-detail-panel">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        View Duplicate Details ({{ importSummary()?.duplicates?.length }} shown)
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="duplicates-list">
                      <table class="duplicates-table">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Trans #</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th class="right">New Amount</th>
                            <th class="right">Existing</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (dup of importSummary()?.duplicates?.slice(0, 20); track dup.rowIndex) {
                            <tr>
                              <td>{{ dup.rowIndex }}</td>
                              <td>{{ dup.transactionNumber }}</td>
                              <td>{{ dup.customerNumber }}</td>
                              <td>{{ dup.transactionDate }}</td>
                              <td class="right">{{ formatCurrency(dup.salesAmount) }}</td>
                              <td class="right existing">{{ formatCurrency(dup.existingSalesAmount) }}</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                      @if ((importSummary()?.duplicates?.length || 0) > 20) {
                        <div class="more-duplicates">... and {{ (importSummary()?.duplicates?.length || 0) - 20 }} more duplicates</div>
                      }
                    </div>
                  </mat-expansion-panel>
                }
              </div>
            }

            <!-- Issues/Warnings -->
            @if (importIssues().length > 0) {
              <mat-expansion-panel class="issues-panel">
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon [class.warning]="hasWarnings()" [class.error]="hasErrors()">
                      {{ hasErrors() ? 'error' : 'warning' }}
                    </mat-icon>
                    {{ importIssues().length }} Issue(s) Found
                  </mat-panel-title>
                </mat-expansion-panel-header>
                <div class="issues-list">
                  @for (issue of importIssues().slice(0, 20); track $index) {
                    <div class="issue-item" [class.warning]="issue.severity === 'warning'" [class.error]="issue.severity === 'error'">
                      <span class="row-num">Row {{ issue.rowIndex }}</span>
                      <span class="issue-code">[{{ issue.code }}]</span>
                      <span class="issue-message">{{ issue.message }}</span>
                    </div>
                  }
                  @if (importIssues().length > 20) {
                    <div class="more-issues">... and {{ importIssues().length - 20 }} more issues</div>
                  }
                </div>
              </mat-expansion-panel>
            }

            <!-- Customer Breakdown -->
            @if (importSummary()?.customerSummaries && importSummary()!.customerSummaries!.length > 0) {
              <mat-expansion-panel>
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon>groups</mat-icon>
                    Customer Breakdown ({{ importSummary()?.customerSummaries?.length }} customers)
                  </mat-panel-title>
                </mat-expansion-panel-header>
                <div class="customer-list">
                  <table class="customer-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th class="right">Trans.</th>
                        <th class="right">Sales</th>
                        <th class="right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (cust of importSummary()?.customerSummaries?.slice(0, 15); track cust.customerNumber) {
                        <tr>
                          <td>
                            <div class="customer-info">
                              <span class="cust-number">{{ cust.customerNumber }}</span>
                              <span class="cust-name">{{ cust.customerName }}</span>
                            </div>
                          </td>
                          <td class="right">{{ cust.transactionCount }}</td>
                          <td class="right">{{ formatCurrency(cust.salesTotal) }}</td>
                          <td class="right">{{ formatCurrency(cust.costTotal) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  @if ((importSummary()?.customerSummaries?.length || 0) > 15) {
                    <div class="more-customers">... and {{ (importSummary()?.customerSummaries?.length || 0) - 15 }} more customers</div>
                  }
                </div>
              </mat-expansion-panel>
            }

            <!-- Transaction Preview -->
            <mat-expansion-panel [expanded]="true">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>list_alt</mat-icon>
                  Transaction Preview
                </mat-panel-title>
              </mat-expansion-panel-header>
              <div class="transactions-preview">
                <table class="transactions-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Trans #</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th class="right">Qty</th>
                      <th class="right">Sales</th>
                      <th class="right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (tx of previewTransactions(); track tx.id) {
                      <tr [class.has-issues]="tx.hasIssues">
                        <td>{{ tx.transactionDate | date:'dd/MM/yyyy' }}</td>
                        <td>{{ tx.transactionNumber }}</td>
                        <td>
                          <div class="customer-info">
                            <span class="cust-number">{{ tx.customerNumber }}</span>
                            <span class="cust-name">{{ tx.customerName }}</span>
                          </div>
                        </td>
                        <td>{{ tx.type }}</td>
                        <td class="right">{{ tx.quantity }}</td>
                        <td class="right">{{ formatCurrency(tx.salesAmount) }}</td>
                        <td class="right">{{ formatCurrency(tx.costOfSales) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
                <mat-paginator 
                  [length]="totalTransactions()"
                  [pageSize]="pageSize"
                  [pageSizeOptions]="[10, 25, 50]"
                  (page)="onPageChange($event)"
                  showFirstLastButtons>
                </mat-paginator>
              </div>
            </mat-expansion-panel>
          </div>
        }

        <!-- Step 4: Committing -->
        @if (currentStep() === 'committing') {
          <div class="committing-section">
            <mat-spinner diameter="60"></mat-spinner>
            <h3>Committing Import...</h3>
            <p>Saving {{ importSummary()?.transactions || 0 }} transactions to database</p>
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          </div>
        }

        <!-- Error State -->
        @if (currentStep() === 'error') {
          <div class="error-section">
            <mat-icon class="error-icon">error_outline</mat-icon>
            <h3>Import Failed</h3>
            <p>{{ errorMessage() }}</p>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        @if (currentStep() === 'setup') {
          <button mat-button (click)="cancel()">Cancel</button>
          <button mat-raised-button color="primary" 
                  [disabled]="!selectedCompany()"
                  (click)="uploadAndParse()">
            <mat-icon>cloud_upload</mat-icon>
            Upload & Preview
          </button>
        }

        @if (currentStep() === 'preview') {
          <button mat-button (click)="cancelImport()">
            <mat-icon>close</mat-icon>
            Cancel Import
          </button>
          <button mat-raised-button color="primary" 
                  [disabled]="hasErrors()"
                  (click)="commitImport()">
            <mat-icon>check</mat-icon>
            Commit {{ importSummary()?.transactions || 0 }} Transactions
          </button>
        }

        @if (currentStep() === 'error') {
          <button mat-button (click)="cancel()">Close</button>
          <button mat-raised-button color="primary" (click)="retry()">
            <mat-icon>refresh</mat-icon>
            Try Again
          </button>
        }
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .sales-import-dialog {
      min-width: 900px;
      max-width: 1200px;
      width: 95vw;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2, #1565c0);
      color: white;
      margin: -24px -24px 0;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
    }

    mat-dialog-content {
      padding: 24px !important;
      max-height: 65vh;
      overflow-y: auto;
    }

    /* File Info */
    .file-info-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 24px;

      .file-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #4caf50;
      }

      .file-details {
        display: flex;
        flex-direction: column;

        .file-name {
          font-weight: 500;
          font-size: 16px;
        }

        .file-size {
          color: #666;
          font-size: 13px;
        }
      }
    }

    /* Form Sections */
    .form-section {
      margin-bottom: 24px;

      h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 8px;
        font-weight: 500;

        mat-icon {
          color: #1976d2;
        }
      }

      .hint {
        color: #666;
        font-size: 13px;
        margin: 0 0 16px;
      }
    }

    /* Company Cards */
    .company-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    .company-card {
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: #1976d2;
        background: #e3f2fd;
      }

      &.selected {
        border-color: #1976d2;
        background: #1976d2;
        color: white;

        .company-code {
          color: white;
        }
      }

      .company-code {
        font-weight: 700;
        font-size: 18px;
        color: #1976d2;
      }

      .company-name {
        font-size: 11px;
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    /* Date Range */
    .date-range-inputs {
      display: flex;
      align-items: center;
      gap: 16px;

      mat-form-field {
        flex: 1;
      }

      .date-separator {
        color: #666;
      }
    }

    /* Uploading/Committing */
    .uploading-section, .committing-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
      text-align: center;

      h3 {
        margin: 24px 0 8px;
      }

      p {
        color: #666;
        margin: 0 0 24px;
      }

      mat-progress-bar {
        width: 100%;
        max-width: 400px;
      }
    }

    /* Summary Cards */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .summary-card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 12px;
      text-align: center;

      mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
        color: #666;
      }

      .value {
        font-size: 18px;
        font-weight: 700;
        margin: 4px 0;
      }

      .label {
        font-size: 11px;
        color: #666;
        text-transform: uppercase;
      }

      &.sales {
        background: #e8f5e9;
        mat-icon { color: #4caf50; }
        .value { color: #2e7d32; }
      }

      &.cost {
        background: #fff3e0;
        mat-icon { color: #ff9800; }
        .value { color: #e65100; }
      }

      &.profit {
        background: #e3f2fd;
        mat-icon { color: #1976d2; }
        .value { color: #1565c0; }
      }
    }

    /* Date Range Info */
    .date-range-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #1565c0;

      mat-icon {
        font-size: 20px;
      }
    }

    /* Duplicate Warning Banner */
    .duplicate-warning-banner {
      background: #fff3e0;
      border: 2px solid #ff9800;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;

      .warning-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;

        mat-icon {
          color: #ff9800;
          font-size: 32px;
          width: 32px;
          height: 32px;
        }

        .warning-text {
          display: flex;
          flex-direction: column;
          gap: 4px;

          strong {
            color: #e65100;
            font-size: 16px;
          }

          span {
            color: #666;
            font-size: 13px;
          }
        }
      }

      .warning-summary {
        display: flex;
        gap: 24px;
        padding: 8px 0;
        border-top: 1px solid #ffcc80;

        .stat {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          color: #666;

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
            color: #ff9800;
          }

          strong {
            color: #e65100;
          }
        }
      }

      .duplicates-detail-panel {
        margin-top: 12px;
        background: white;
      }

      .duplicates-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;

        th, td {
          padding: 6px 10px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
        }

        th {
          background: #fafafa;
          font-weight: 500;
        }

        .right {
          text-align: right;
        }

        .existing {
          color: #666;
          font-style: italic;
        }
      }

      .more-duplicates {
        text-align: center;
        padding: 8px;
        color: #666;
        font-style: italic;
        font-size: 12px;
      }
    }

    /* Issues Panel */
    .issues-panel {
      margin-bottom: 16px;

      mat-icon.warning { color: #ff9800; }
      mat-icon.error { color: #f44336; }
    }

    .issues-list {
      max-height: 200px;
      overflow-y: auto;
    }

    .issue-item {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 13px;
      margin-bottom: 4px;

      &.warning {
        background: #fff8e1;
      }

      &.error {
        background: #ffebee;
      }

      .row-num {
        font-weight: 500;
        color: #666;
      }

      .issue-code {
        font-family: monospace;
        color: #9e9e9e;
      }
    }

    .more-issues, .more-customers {
      text-align: center;
      padding: 8px;
      color: #666;
      font-style: italic;
    }

    /* Customer Table */
    .customer-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th, td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #e0e0e0;
      }

      th {
        background: #fafafa;
        font-weight: 500;
      }

      .right {
        text-align: right;
      }

      .customer-info {
        display: flex;
        flex-direction: column;

        .cust-number {
          font-weight: 500;
          font-size: 12px;
        }

        .cust-name {
          color: #666;
          font-size: 11px;
        }
      }
    }

    /* Transactions Table */
    .transactions-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th, td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #e0e0e0;
      }

      th {
        background: #fafafa;
        font-weight: 500;
        position: sticky;
        top: 0;
      }

      .right {
        text-align: right;
      }

      tr.has-issues {
        background: #fff8e1;
      }

      .customer-info {
        display: flex;
        flex-direction: column;

        .cust-number {
          font-weight: 500;
          font-size: 11px;
        }

        .cust-name {
          color: #666;
          font-size: 10px;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }

    .transactions-preview {
      max-height: 300px;
      overflow-y: auto;
    }

    /* Error Section */
    .error-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
      text-align: center;

      .error-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #f44336;
      }

      h3 {
        margin: 16px 0 8px;
        color: #f44336;
      }

      p {
        color: #666;
      }
    }

    /* Dialog Actions */
    mat-dialog-actions {
      padding: 16px 24px !important;
      border-top: 1px solid #e0e0e0;

      button {
        mat-icon {
          margin-right: 8px;
        }
      }
    }
  `]
})
export class SalesImportDialogComponent {
  companies: Company[] = [
    { code: 'PMT', name: 'Promed Technologies' },
    { code: 'ACM', name: 'Access Medical' },
    { code: 'PHT', name: 'Pharmatech' },
    { code: 'SBT', name: 'Sebenzani Trading' }
  ];

  // Signals
  currentStep = signal<'setup' | 'uploading' | 'preview' | 'committing' | 'error'>('setup');
  selectedCompany = signal<string | null>(null);
  importId = signal<string | null>(null);
  importSummary = signal<ImportSummary | null>(null);
  importIssues = signal<ImportIssue[]>([]);
  previewTransactions = signal<Transaction[]>([]);
  totalTransactions = signal<number>(0);
  errorMessage = signal<string>('');

  // Date inputs
  fromDate: Date | null = null;
  toDate: Date | null = null;

  // Pagination
  pageSize = 10;
  pageIndex = 0;

  constructor(
    public dialogRef: MatDialogRef<SalesImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SalesImportDialogData,
    private http: HttpClient
  ) {}

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  formatCurrency(amount: number): string {
    return 'R ' + amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  hasWarnings(): boolean {
    return this.importIssues().some(i => i.severity === 'warning');
  }

  hasErrors(): boolean {
    return this.importIssues().some(i => i.severity === 'error');
  }

  async uploadAndParse(): Promise<void> {
    if (!this.selectedCompany()) return;

    this.currentStep.set('uploading');

    const formData = new FormData();
    formData.append('file', this.data.file);
    formData.append('sourceCompany', this.selectedCompany()!);
    
    if (this.fromDate) {
      formData.append('fromDate', this.fromDate.toISOString());
    }
    if (this.toDate) {
      formData.append('toDate', this.toDate.toISOString());
    }

    try {
      const response = await this.http.post<any>(
        `${this.data.apiUrl}/imports/sales-report`,
        formData
      ).toPromise();

      if (response.success) {
        this.importId.set(response.importId);
        this.importSummary.set(response.summary);
        this.importIssues.set(response.issues || []);
        
        // Load first page of transactions
        await this.loadTransactions(0);
        
        this.currentStep.set('preview');
      } else {
        this.errorMessage.set(response.message || 'Failed to parse file');
        this.currentStep.set('error');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      this.errorMessage.set(error.error?.message || error.message || 'Failed to upload file');
      this.currentStep.set('error');
    }
  }

  async loadTransactions(page: number): Promise<void> {
    if (!this.importId()) return;

    try {
      const response = await this.http.get<any>(
        `${this.data.apiUrl}/imports/${this.importId()}/transactions`,
        { params: { page: page.toString(), pageSize: this.pageSize.toString() } }
      ).toPromise();

      this.previewTransactions.set(response.transactions || []);
      this.totalTransactions.set(response.totalCount || 0);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadTransactions(event.pageIndex);
  }

  async commitImport(): Promise<void> {
    if (!this.importId()) return;

    this.currentStep.set('committing');

    try {
      const response = await this.http.post<any>(
        `${this.data.apiUrl}/imports/${this.importId()}/commit`,
        {}
      ).toPromise();

      if (response.success) {
        this.dialogRef.close({
          success: true,
          importId: this.importId(),
          committed: true,
          message: response.message
        });
      } else {
        this.errorMessage.set(response.message || 'Failed to commit import');
        this.currentStep.set('error');
      }
    } catch (error: any) {
      console.error('Commit error:', error);
      this.errorMessage.set(error.error?.message || error.message || 'Failed to commit import');
      this.currentStep.set('error');
    }
  }

  async cancelImport(): Promise<void> {
    if (this.importId()) {
      try {
        await this.http.delete(`${this.data.apiUrl}/imports/${this.importId()}`).toPromise();
      } catch (error) {
        console.error('Failed to cancel import:', error);
      }
    }
    this.dialogRef.close({ success: false });
  }

  cancel(): void {
    this.dialogRef.close({ success: false });
  }

  retry(): void {
    this.currentStep.set('setup');
    this.errorMessage.set('');
  }
}
