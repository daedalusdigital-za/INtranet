import { Component, Inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { HttpClient } from '@angular/common/http';

interface OperatingCompany {
  operatingCompanyId: number;
  name: string;
  code?: string;
}

interface SohImportSummary {
  operatingCompanyId: number;
  operatingCompanyName: string;
  lines: number;
  items: number;
  locations: string[];
  asAtDate: string | null;
  totalQtyOnHand: number;
  totalStockValue: number;
  warningCount: number;
  errorCount: number;
}

interface SohImportIssue {
  rowIndex: number;
  severity: string;
  code: string;
  message: string;
  itemCode?: string;
  location?: string;
}

interface SohLine {
  rowIndex: number;
  itemCode: string;
  itemDescription: string | null;
  location: string;
  uom: string;
  qtyOnHand: number | null;
  qtyOnPO: number | null;
  qtyOnSO: number | null;
  stockAvailable: number | null;
  totalCostForQOH: number | null;
  unitCostForQOH: number | null;
  hasIssues: boolean;
}

export interface SohImportDialogData {
  apiUrl: string;
}

export interface SohImportDialogResult {
  success: boolean;
  importId?: string;
  committed?: boolean;
  message?: string;
}

@Component({
  selector: 'app-soh-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
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
    MatCheckboxModule,
    MatSlideToggleModule,
    MatSelectModule
  ],
  template: `
    <div class="soh-import-dialog">
      <h2 mat-dialog-title>
        <mat-icon>inventory_2</mat-icon>
        Import Stock on Hand
      </h2>

      <mat-dialog-content>
        <!-- Step 1: File Selection -->
        @if (currentStep() === 'setup') {
          <div class="setup-section">
            <!-- Company Selector -->
            <div class="company-selector">
              <h4><mat-icon>business</mat-icon> Select Company</h4>
              <mat-form-field appearance="outline" class="company-field">
                <mat-label>Operating Company</mat-label>
                <mat-select [(ngModel)]="selectedCompanyId" (selectionChange)="onCompanyChange($event.value)" required>
                  @for (company of companies(); track company.operatingCompanyId) {
                    <mat-option [value]="company.operatingCompanyId">
                      {{ company.name }}
                    </mat-option>
                  }
                </mat-select>
                <mat-hint>Select which company this stock belongs to</mat-hint>
              </mat-form-field>
              @if (loadingCompanies()) {
                <mat-spinner diameter="20" class="company-spinner"></mat-spinner>
              }
            </div>

            <!-- File Upload Area -->
            <div 
              class="upload-area" 
              [class.drag-over]="isDragOver()"
              [class.disabled]="!selectedCompanyId"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              (click)="selectedCompanyId && fileInput.click()">
              
              @if (!selectedFile()) {
                <mat-icon class="upload-icon">cloud_upload</mat-icon>
                <h3>Drop your Excel file here</h3>
                <p>or click to browse</p>
                <p class="file-hint">Only .xlsx files are supported</p>
              } @else {
                <mat-icon class="file-icon">table_chart</mat-icon>
                <h3>{{ selectedFile()?.name }}</h3>
                <p>{{ formatFileSize(selectedFile()?.size || 0) }}</p>
                <button mat-button color="warn" (click)="clearFile($event)">
                  <mat-icon>close</mat-icon> Remove
                </button>
              }
              
              <input 
                #fileInput 
                type="file" 
                accept=".xlsx" 
                hidden 
                (change)="onFileSelected($event)">
            </div>

            <!-- Options -->
            <div class="options-section">
              <h4><mat-icon>settings</mat-icon> Import Options</h4>
              
              <div class="option-row">
                <mat-form-field appearance="outline">
                  <mat-label>Snapshot Date (As At)</mat-label>
                  <input matInput [matDatepicker]="datePicker" [(ngModel)]="asAtDate">
                  <mat-datepicker-toggle matIconSuffix [for]="datePicker"></mat-datepicker-toggle>
                  <mat-datepicker #datePicker></mat-datepicker>
                  <mat-hint>Leave blank to use today's date</mat-hint>
                </mat-form-field>
              </div>

              <div class="option-row toggle-row">
                <mat-slide-toggle [(ngModel)]="strictMode">
                  Strict Mode
                </mat-slide-toggle>
                <p class="toggle-hint">
                  When enabled, any validation error will fail the entire import.
                  When disabled, invalid rows are skipped with warnings.
                </p>
              </div>
            </div>
          </div>
        }

        <!-- Step 2: Uploading -->
        @if (currentStep() === 'uploading') {
          <div class="uploading-section">
            <mat-spinner diameter="60"></mat-spinner>
            <h3>Processing Stock on Hand File...</h3>
            <p>Parsing and validating data</p>
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          </div>
        }

        <!-- Step 3: Preview -->
        @if (currentStep() === 'preview') {
          <div class="preview-section">
            <!-- Company Info Banner -->
            <div class="company-banner">
              <mat-icon>business</mat-icon>
              <span>Company: <strong>{{ importSummary()?.operatingCompanyName || selectedCompanyName }}</strong></span>
            </div>

            <!-- Summary Cards -->
            <div class="summary-cards">
              <div class="summary-card">
                <mat-icon>format_list_numbered</mat-icon>
                <div class="value">{{ importSummary()?.lines || 0 }}</div>
                <div class="label">Lines</div>
              </div>
              <div class="summary-card">
                <mat-icon>inventory</mat-icon>
                <div class="value">{{ importSummary()?.items || 0 }}</div>
                <div class="label">Unique Items</div>
              </div>
              <div class="summary-card">
                <mat-icon>warehouse</mat-icon>
                <div class="value">{{ importSummary()?.locations?.length || 0 }}</div>
                <div class="label">Locations</div>
              </div>
              <div class="summary-card qty">
                <mat-icon>stacked_bar_chart</mat-icon>
                <div class="value">{{ formatNumber(importSummary()?.totalQtyOnHand || 0) }}</div>
                <div class="label">Total Qty</div>
              </div>
              <div class="summary-card value">
                <mat-icon>attach_money</mat-icon>
                <div class="value">{{ formatCurrency(importSummary()?.totalStockValue || 0) }}</div>
                <div class="label">Stock Value</div>
              </div>
            </div>

            <!-- Locations Detected -->
            <div class="locations-chips">
              <span class="chip-label">Locations:</span>
              @for (loc of importSummary()?.locations || []; track loc) {
                <span class="location-chip">{{ loc }}</span>
              }
            </div>

            <!-- Date Info -->
            <div class="date-info">
              <mat-icon>calendar_today</mat-icon>
              <span>Snapshot Date: <strong>{{ importSummary()?.asAtDate || 'Today' }}</strong></span>
            </div>

            <!-- Issues Panel -->
            @if (importIssues().length > 0) {
              <mat-expansion-panel class="issues-panel" [expanded]="hasErrors()">
                <mat-expansion-panel-header>
                  <mat-panel-title>
                    <mat-icon [class.warning]="!hasErrors()" [class.error]="hasErrors()">
                      {{ hasErrors() ? 'error' : 'warning' }}
                    </mat-icon>
                    {{ importSummary()?.warningCount || 0 }} Warning(s), {{ importSummary()?.errorCount || 0 }} Error(s)
                  </mat-panel-title>
                  <mat-panel-description>
                    <button mat-icon-button matTooltip="Export Issues to CSV" (click)="exportIssues($event)">
                      <mat-icon>download</mat-icon>
                    </button>
                  </mat-panel-description>
                </mat-expansion-panel-header>
                <div class="issues-list">
                  @for (issue of importIssues().slice(0, 30); track $index) {
                    <div class="issue-item" [class.warning]="issue.severity === 'warning'" [class.error]="issue.severity === 'error'">
                      <span class="row-num">Row {{ issue.rowIndex }}</span>
                      <span class="issue-code">[{{ issue.code }}]</span>
                      <span class="issue-message">{{ issue.message }}</span>
                      @if (issue.itemCode) {
                        <span class="issue-item-code">{{ issue.itemCode }}</span>
                      }
                    </div>
                  }
                  @if (importIssues().length > 30) {
                    <div class="more-issues">... and {{ importIssues().length - 30 }} more issues</div>
                  }
                </div>
              </mat-expansion-panel>
            }

            <!-- Data Preview Table -->
            <mat-expansion-panel [expanded]="true">
              <mat-expansion-panel-header>
                <mat-panel-title>
                  <mat-icon>table_view</mat-icon>
                  Data Preview
                </mat-panel-title>
              </mat-expansion-panel-header>
              <div class="data-preview">
                <table class="preview-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Item Code</th>
                      <th>Description</th>
                      <th>Location</th>
                      <th>UOM</th>
                      <th class="right">Qty On Hand</th>
                      <th class="right">Available</th>
                      <th class="right">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of previewLines(); track line.rowIndex) {
                      <tr [class.has-issues]="line.hasIssues">
                        <td>{{ line.rowIndex }}</td>
                        <td class="item-code">{{ line.itemCode }}</td>
                        <td class="description">{{ line.itemDescription || '-' }}</td>
                        <td>{{ line.location }}</td>
                        <td>{{ line.uom }}</td>
                        <td class="right">{{ formatNumber(line.qtyOnHand) }}</td>
                        <td class="right">{{ formatNumber(line.stockAvailable) }}</td>
                        <td class="right">{{ formatCurrency(line.totalCostForQOH) }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
                <mat-paginator
                  [length]="totalLines()"
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
            <p>Saving {{ importSummary()?.lines || 0 }} stock records to database</p>
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
                  [disabled]="!selectedFile() || !selectedCompanyId"
                  (click)="uploadAndParse()">
            <mat-icon>cloud_upload</mat-icon>
            Upload & Preview
          </button>
        }

        @if (currentStep() === 'preview') {
          <button mat-button (click)="cancelImport()">
            <mat-icon>close</mat-icon>
            Cancel
          </button>
          <button mat-raised-button color="primary"
                  [disabled]="hasErrors() && strictMode"
                  (click)="commitImport()">
            <mat-icon>check</mat-icon>
            Commit {{ importSummary()?.lines || 0 }} Records
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
    .soh-import-dialog {
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
      background: linear-gradient(135deg, #00695c, #004d40);
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

    /* Company Selector */
    .company-selector {
      margin-bottom: 24px;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 8px;
      border-left: 4px solid #1976d2;

      h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 12px;
        color: #1565c0;

        mat-icon {
          color: #1976d2;
        }
      }

      .company-field {
        width: 100%;
        max-width: 400px;
      }

      .company-spinner {
        display: inline-block;
        margin-left: 12px;
        vertical-align: middle;
      }
    }

    /* Upload Area */
    .upload-area {
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 48px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      background: #fafafa;

      &:hover:not(.disabled) {
        border-color: #00695c;
        background: #e0f2f1;
      }

      &.disabled {
        opacity: 0.5;
        cursor: not-allowed;
        background: #f0f0f0;
      }

      &.drag-over {
        border-color: #00695c;
        background: #e0f2f1;
        transform: scale(1.02);
      }

      .upload-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #00695c;
      }

      .file-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #4caf50;
      }

      h3 {
        margin: 16px 0 8px;
        color: #333;
      }

      p {
        margin: 0;
        color: #666;
      }

      .file-hint {
        font-size: 12px;
        color: #999;
        margin-top: 8px;
      }
    }

    /* Options */
    .options-section {
      margin-top: 24px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;

      h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 16px;
        color: #333;

        mat-icon {
          color: #00695c;
        }
      }

      .option-row {
        margin-bottom: 16px;

        mat-form-field {
          width: 300px;
        }
      }

      .toggle-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .toggle-hint {
        font-size: 12px;
        color: #666;
        margin: 0;
        padding-left: 48px;
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

      &.qty {
        background: #e8f5e9;
        mat-icon { color: #4caf50; }
        .value { color: #2e7d32; }
      }

      &.value {
        background: #e3f2fd;
        mat-icon { color: #1976d2; }
        .value { color: #1565c0; }
      }
    }

    /* Locations */
    .locations-chips {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;

      .chip-label {
        font-weight: 500;
        color: #666;
      }

      .location-chip {
        background: #00695c;
        color: white;
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 13px;
      }
    }

    /* Company Banner */
    .company-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #1565c0;
      border-left: 4px solid #1976d2;

      mat-icon {
        font-size: 20px;
        color: #1976d2;
      }
    }

    /* Date Info */
    .date-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #e0f2f1;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #00695c;

      mat-icon {
        font-size: 20px;
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
      align-items: center;

      &.warning {
        background: #fff8e1;
      }

      &.error {
        background: #ffebee;
      }

      .row-num {
        font-weight: 500;
        color: #666;
        min-width: 60px;
      }

      .issue-code {
        font-family: monospace;
        color: #9e9e9e;
        font-size: 11px;
      }

      .issue-message {
        flex: 1;
      }

      .issue-item-code {
        font-family: monospace;
        font-size: 11px;
        color: #666;
        background: #eee;
        padding: 2px 6px;
        border-radius: 4px;
      }
    }

    .more-issues {
      text-align: center;
      padding: 8px;
      color: #666;
      font-style: italic;
    }

    /* Preview Table */
    .data-preview {
      max-height: 350px;
      overflow-y: auto;
    }

    .preview-table {
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
        z-index: 1;
      }

      .right {
        text-align: right;
      }

      .item-code {
        font-family: monospace;
        font-size: 12px;
      }

      .description {
        max-width: 200px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      tr.has-issues {
        background: #fff8e1;
      }
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
export class SohImportDialogComponent implements OnInit {
  // Signals
  currentStep = signal<'setup' | 'uploading' | 'preview' | 'committing' | 'error'>('setup');
  selectedFile = signal<File | null>(null);
  isDragOver = signal(false);
  importId = signal<string | null>(null);
  importSummary = signal<SohImportSummary | null>(null);
  importIssues = signal<SohImportIssue[]>([]);
  previewLines = signal<SohLine[]>([]);
  totalLines = signal<number>(0);
  errorMessage = signal<string>('');
  companies = signal<OperatingCompany[]>([]);
  loadingCompanies = signal(false);

  // Form values
  selectedCompanyId: number | null = null;
  selectedCompanyName: string = '';
  asAtDate: Date | null = null;
  strictMode = false;

  // Pagination
  pageSize = 10;
  pageIndex = 0;

  constructor(
    public dialogRef: MatDialogRef<SohImportDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SohImportDialogData,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loadingCompanies.set(true);
    this.http.get<OperatingCompany[]>(`${this.data.apiUrl}/crm/all-companies`).subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.loadingCompanies.set(false);
      },
      error: (error) => {
        console.error('Failed to load companies:', error);
        this.loadingCompanies.set(false);
      }
    });
  }

  onCompanyChange(companyId: number): void {
    const company = this.companies().find(c => c.operatingCompanyId === companyId);
    this.selectedCompanyName = company?.name || '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('en-ZA', { maximumFractionDigits: 2 });
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '-';
    return 'R ' + value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  hasErrors(): boolean {
    return (this.importSummary()?.errorCount || 0) > 0;
  }

  // Drag & Drop handlers
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx')) {
        this.selectedFile.set(file);
      } else {
        this.errorMessage.set('Only .xlsx files are supported.');
        this.currentStep.set('error');
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.name.endsWith('.xlsx')) {
        this.selectedFile.set(file);
      } else {
        this.errorMessage.set('Only .xlsx files are supported.');
        this.currentStep.set('error');
      }
    }
  }

  clearFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile.set(null);
  }

  async uploadAndParse(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    if (!this.selectedCompanyId) {
      this.errorMessage.set('Please select an operating company.');
      this.currentStep.set('error');
      return;
    }

    this.currentStep.set('uploading');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('operatingCompanyId', this.selectedCompanyId.toString());
    formData.append('operatingCompanyName', this.selectedCompanyName);
    formData.append('strictMode', this.strictMode.toString());
    
    if (this.asAtDate) {
      formData.append('asAtDate', this.asAtDate.toISOString().split('T')[0]);
    }

    try {
      const response = await this.http.post<any>(
        `${this.data.apiUrl}/imports/soh`,
        formData
      ).toPromise();

      if (response.success) {
        this.importId.set(response.importId);
        this.importSummary.set(response.summary);
        this.importIssues.set(response.issues || []);
        
        // Load first page of lines
        await this.loadLines(0);
        
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

  async loadLines(page: number): Promise<void> {
    if (!this.importId()) return;

    try {
      const response = await this.http.get<any>(
        `${this.data.apiUrl}/imports/soh/${this.importId()}/lines`,
        { params: { page: (page + 1).toString(), pageSize: this.pageSize.toString() } }
      ).toPromise();

      this.previewLines.set(response.lines || []);
      this.totalLines.set(response.totalCount || 0);
    } catch (error) {
      console.error('Failed to load lines:', error);
    }
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadLines(event.pageIndex);
  }

  async exportIssues(event: Event): Promise<void> {
    event.stopPropagation();
    if (!this.importId()) return;

    try {
      const blob = await this.http.get(
        `${this.data.apiUrl}/imports/soh/${this.importId()}/issues/csv`,
        { responseType: 'blob' }
      ).toPromise();

      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `soh-import-issues-${this.importId()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export issues:', error);
    }
  }

  async commitImport(): Promise<void> {
    if (!this.importId()) return;

    this.currentStep.set('committing');

    try {
      const response = await this.http.post<any>(
        `${this.data.apiUrl}/imports/soh/${this.importId()}/commit`,
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
        await this.http.delete(`${this.data.apiUrl}/imports/soh/${this.importId()}`).toPromise();
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
    this.selectedFile.set(null);
    this.errorMessage.set('');
  }
}
