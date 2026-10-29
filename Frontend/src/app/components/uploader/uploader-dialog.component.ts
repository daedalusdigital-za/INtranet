import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { environment } from '../../../environments/environment';
import { PodUploaderComponent } from '../settings/pod-uploader.component';
import { CollaborativeDocsService } from '../../services/collaborative-docs.service';

type UploaderMode = 'home' | 'pod' | 'invoice' | 'document' | 'worksheet';
type JobStatus = 'pending' | 'uploading' | 'done' | 'error';

interface UploadJob {
  file: File;
  relativePath: string;   // for folder uploads (webkitRelativePath)
  status: JobStatus;
  message?: string;
}

interface UploaderCard {
  mode: UploaderMode;
  icon: string;
  title: string;
  description: string;
  accent: string;
}

interface DepartmentOption {
  name: string;
}

/**
 * Unified "Uploader" tool (launched from the navbar Tools menu).
 *
 * A single card-based launcher for the four upload flows staff use most:
 *  • POD Uploader       — reuses the multi-POD uploader (tag invoices, auto-links tripsheet).
 *  • Invoice Uploader   — import a sales/invoice Excel worksheet for a chosen company.
 *  • Document Uploader  — upload files OR whole folders to a department (password protected).
 *  • Worksheet Uploader — import a tripsheet worksheet (.xlsx) and preview the parse result.
 */
@Component({
  selector: 'app-uploader-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, PodUploaderComponent],
  template: `
  <div class="up">
    <!-- Header -->
    <div class="up__head">
      @if (mode() !== 'home') {
        <button aria-label="Back" class="up__back" (click)="goHome()" title="Back">
          <mat-icon>arrow_back</mat-icon>
        </button>
      }
      <mat-icon class="up__head-icon">cloud_upload</mat-icon>
      <div class="up__head-text">
        <h2>{{ headerTitle() }}</h2>
        <p>{{ headerSubtitle() }}</p>
      </div>
      <span class="up__spacer"></span>
      <button aria-label="Close" class="up__close" mat-dialog-close title="Close"><mat-icon>close</mat-icon></button>
    </div>

    <div class="up__body">
      <!-- HOME: card selector -->
      @if (mode() === 'home') {
        <div class="up__grid">
          @for (c of cards; track c.mode) {
            <button class="up-card" [style.--accent]="c.accent" (click)="select(c.mode)">
              <span class="up-card__icon"><mat-icon>{{ c.icon }}</mat-icon></span>
              <span class="up-card__title">{{ c.title }}</span>
              <span class="up-card__desc">{{ c.description }}</span>
            </button>
          }
        </div>
      }

      <!-- POD -->
      @if (mode() === 'pod') {
        <app-pod-uploader></app-pod-uploader>
      }

      <!-- INVOICE -->
      @if (mode() === 'invoice') {
        <div class="up-pane">
          <div class="up-field">
            <label>Company</label>
            <select [(ngModel)]="invoiceCompany">
              @for (c of companies; track c.code) {
                <option [value]="c.code">{{ c.name }} ({{ c.code }})</option>
              }
            </select>
          </div>

          <label class="up-drop" [class.up-drop--drag]="dragging()"
                 (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)"
                 (drop)="onDropSingle($event, 'invoice')">
            <input type="file" hidden accept=".xlsx,.xls" (change)="onPickSingle($event, 'invoice')" />
            <mat-icon>upload_file</mat-icon>
            <span class="up-drop__title">{{ invoiceFile ? invoiceFile.name : 'Drop the invoice worksheet here, or click to browse' }}</span>
            <span class="up-drop__hint">Excel .xlsx / .xls · the sheet is imported against the selected company</span>
          </label>

          @if (invoiceMsg) {
            <div class="up-msg" [class.ok]="invoiceOk" [class.err]="!invoiceOk">
              <mat-icon>{{ invoiceOk ? 'check_circle' : 'error' }}</mat-icon><span>{{ invoiceMsg }}</span>
            </div>
          }

          <div class="up-actions">
            <button class="up-btn" (click)="goHome()">Cancel</button>
            <button class="up-btn up-btn--primary" [disabled]="!invoiceFile || busy()" (click)="uploadInvoice()">
              <mat-icon>{{ busy() ? 'progress_activity' : 'publish' }}</mat-icon> Import &amp; commit
            </button>
          </div>

          @if (invoiceSuccess; as s) {
            <div class="up-success-overlay" (click)="closeInvoiceSuccess()">
              <div class="up-success" (click)="$event.stopPropagation()">
                <div class="up-success__badge"><mat-icon>check_circle</mat-icon></div>
                <h3>Invoices committed</h3>
                <p class="up-success__lead">
                  <strong>{{ s.committed | number }}</strong> transaction(s) for
                  <strong>{{ s.company }}</strong> are now live in sales.
                </p>
                @if (s.message) { <p class="up-success__detail">{{ s.message }}</p> }
                <button class="up-btn up-btn--primary" (click)="closeInvoiceSuccess()">
                  <mat-icon>done</mat-icon> Done
                </button>
              </div>
            </div>
          }
        </div>
      }

      <!-- DOCUMENT -->
      @if (mode() === 'document') {
        <div class="up-pane">
          <div class="up-field">
            <label>Department</label>
            <select [(ngModel)]="docDepartment" (ngModelChange)="docAuthed = false">
              <option value="" disabled selected>Select a department…</option>
              @for (d of departments(); track d.name) {
                <option [value]="d.name">{{ d.name }}</option>
              }
            </select>
          </div>

          <div class="up-field">
            <label>Department password</label>
            <div class="up-pwd">
              <input [type]="showPwd ? 'text' : 'password'" [(ngModel)]="docPassword"
                     placeholder="Enter password to unlock uploads" (keyup.enter)="verifyDepartment()" />
              <button [attr.aria-label]="showPwd ? 'Hide password' : 'Show password'" type="button" (click)="showPwd = !showPwd" title="Show/hide">
                <mat-icon>{{ showPwd ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </div>
          </div>

          @if (!docAuthed) {
            <div class="up-actions">
              <button class="up-btn" (click)="goHome()">Cancel</button>
              <button class="up-btn up-btn--primary" [disabled]="!docDepartment || !docPassword || busy()" (click)="verifyDepartment()">
                <mat-icon>{{ busy() ? 'progress_activity' : 'lock_open' }}</mat-icon> Unlock
              </button>
            </div>
          } @else {
            <div class="up-authed"><mat-icon>verified_user</mat-icon> Unlocked <b>{{ docDepartment }}</b> — choose files or a folder to upload.</div>

            <div class="up-choicerow">
              <label class="up-drop up-drop--sm" (click)="clearDocMsg()">
                <input type="file" hidden multiple (change)="onPickDocs($event, false)" />
                <mat-icon>upload_file</mat-icon><span>Choose files</span>
              </label>
              <label class="up-drop up-drop--sm" (click)="clearDocMsg()">
                <input type="file" hidden webkitdirectory (change)="onPickDocs($event, true)" />
                <mat-icon>drive_folder_upload</mat-icon><span>Choose a folder</span>
              </label>
            </div>

            @if (docJobs().length) {
              <div class="up-joblist">
                @for (j of docJobs(); track j.relativePath + $index) {
                  <div class="up-job" [class.ok]="j.status==='done'" [class.err]="j.status==='error'">
                    <mat-icon>{{ j.status==='done' ? 'check_circle' : (j.status==='error' ? 'error' : (j.status==='uploading' ? 'progress_activity' : 'insert_drive_file')) }}</mat-icon>
                    <span class="up-job__name" [title]="j.relativePath || j.file.name">{{ j.relativePath || j.file.name }}</span>
                    <span class="up-job__meta">{{ humanSize(j.file.size) }}</span>
                  </div>
                }
              </div>
            }

            <div class="up-actions">
              <button class="up-btn" (click)="goHome()">Done</button>
              <button class="up-btn up-btn--primary" [disabled]="docReadyCount() === 0 || busy()" (click)="uploadDocs()">
                <mat-icon>{{ busy() ? 'progress_activity' : 'cloud_upload' }}</mat-icon> Upload ({{ docReadyCount() }})
              </button>
            </div>
          }
        </div>
      }

      <!-- WORKSHEET -->
      @if (mode() === 'worksheet') {
        <div class="up-pane">
          <label class="up-drop" [class.up-drop--drag]="dragging()"
                 (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)"
                 (drop)="onDropSingle($event, 'worksheet')">
            <input type="file" hidden accept=".xlsx,.xls,.csv" (change)="onPickSingle($event, 'worksheet')" />
            <mat-icon>table_view</mat-icon>
            <span class="up-drop__title">{{ worksheetFile ? worksheetFile.name : 'Drop an Excel or CSV worksheet here, or click to browse' }}</span>
            <span class="up-drop__hint">.xlsx / .xls / .csv · converted into a new collaborative spreadsheet you can share</span>
          </label>

          @if (worksheetSheets.length > 1) {
            <div class="up-field">
              <label>Sheet to convert</label>
              <select [(ngModel)]="worksheetSelectedSheet">
                @for (s of worksheetSheets; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </div>
          }

          @if (worksheetSummary) {
            <div class="up-summary">
              <div class="up-stat"><b>{{ worksheetSummary.rows }}</b><span>rows</span></div>
              <div class="up-stat"><b>{{ worksheetSummary.cols }}</b><span>columns</span></div>
              <div class="up-stat"><b>{{ worksheetSheets.length }}</b><span>sheet(s)</span></div>
            </div>
          }
          @if (worksheetMsg) {
            <div class="up-msg" [class.ok]="worksheetOk" [class.err]="!worksheetOk">
              <mat-icon>{{ worksheetOk ? 'check_circle' : 'error' }}</mat-icon><span>{{ worksheetMsg }}</span>
            </div>
          }

          <div class="up-actions">
            <button class="up-btn" (click)="goHome()">Cancel</button>
            <button class="up-btn up-btn--primary" [disabled]="!worksheetFile || busy()" (click)="convertWorksheet()">
              <mat-icon>{{ busy() ? 'progress_activity' : 'grid_on' }}</mat-icon> Convert &amp; open spreadsheet
            </button>
          </div>
        </div>
      }
    </div>
  </div>
  `,
  styles: [`
    .up { display:flex; flex-direction:column; max-height:88vh; }
    .up__head { display:flex; align-items:center; gap:12px; padding:18px 22px; border-bottom:1px solid #e8eaf3;
      background:linear-gradient(120deg,#eef0ff,#f7f8ff); }
    .up__head-icon { color:var(--color-primary); font-size:30px; width:30px; height:30px; }
    .up__head-text h2 { margin:0; font-size:1.15rem; color:var(--color-text); }
    .up__head-text p { margin:1px 0 0; font-size:0.82rem; color:var(--color-text-3); }
    .up__spacer { flex:1; }
    .up__back, .up__close { border:none; background:transparent; cursor:pointer; color:var(--color-text-2); display:inline-flex; padding:6px; border-radius:8px; }
    .up__back:hover, .up__close:hover { background:#e2e5f5; color:var(--color-text); }
    .up__body { padding:20px 22px; overflow:auto; }

    .up__grid { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; }
    @media (max-width:640px){ .up__grid { grid-template-columns:1fr; } }
    .up-card { --accent:var(--color-primary); display:flex; flex-direction:column; align-items:flex-start; gap:8px; text-align:left;
      padding:20px; border:1px solid var(--color-line); border-radius:16px; background:var(--color-surface); cursor:pointer; transition:all .18s ease; }
    .up-card:hover { border-color:var(--accent); box-shadow:0 8px 24px rgba(79,70,229,0.12); transform:translateY(-2px); }
    .up-card__icon { width:48px; height:48px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center;
      background:color-mix(in srgb, var(--accent) 14%, var(--color-surface)); color:var(--accent); }
    .up-card__icon mat-icon { font-size:26px; width:26px; height:26px; }
    .up-card__title { font-weight:700; color:var(--color-text); font-size:1rem; }
    .up-card__desc { font-size:0.82rem; color:var(--color-text-3); line-height:1.35; }

    .up-pane { display:flex; flex-direction:column; gap:14px; }
    .up-field { display:flex; flex-direction:column; gap:6px; }
    .up-field label { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.4px; color:var(--color-text-3); font-weight:700; }
    .up-field select, .up-pwd input {
      width:100%; padding:10px 12px; border:1px solid var(--color-line-strong); border-radius:10px; font-size:0.9rem; background:var(--color-surface); }
    .up-field select:focus, .up-pwd input:focus { outline:none; border-color:var(--color-primary); box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
    .up-pwd { display:flex; gap:6px; }
    .up-pwd input { flex:1; }
    .up-pwd button { border:1px solid var(--color-line-strong); background:var(--color-surface); border-radius:10px; cursor:pointer; color:var(--color-text-2); padding:0 10px; display:inline-flex; align-items:center; }

    .up-drop { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;
      border:2px dashed #c7cbf5; border-radius:16px; padding:30px 16px; cursor:pointer;
      background:linear-gradient(180deg,#fbfbff,#f4f4ff); transition:border-color .2s, background .2s; text-align:center; }
    .up-drop:hover, .up-drop--drag { border-color:var(--color-primary); background:#eef0ff; }
    .up-drop > mat-icon { font-size:38px; width:38px; height:38px; color:var(--color-primary); }
    .up-drop__title { font-weight:700; color:var(--color-text-2); }
    .up-drop__hint { font-size:0.78rem; color:var(--color-text-3); }
    .up-drop--sm { flex-direction:row; padding:14px 18px; border-radius:12px; flex:1; }
    .up-drop--sm mat-icon { font-size:22px; width:22px; height:22px; }
    .up-choicerow { display:flex; gap:12px; }

    .up-authed { display:flex; align-items:center; gap:8px; font-size:0.86rem; color:#047857; background:var(--color-ok-soft); border:1px solid #a7f3d0; padding:10px 12px; border-radius:10px; }
    .up-authed mat-icon { font-size:20px; width:20px; height:20px; }

    .up-joblist { display:flex; flex-direction:column; gap:6px; max-height:240px; overflow:auto; }
    .up-job { display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--color-line); border-radius:10px; background:var(--color-surface); font-size:0.84rem; }
    .up-job.ok { border-color:#a7f3d0; background:#f0fdf9; } .up-job.err { border-color:#fca5a5; background:var(--color-danger-soft); }
    .up-job mat-icon { font-size:18px; width:18px; height:18px; color:var(--color-primary); flex-shrink:0; }
    .up-job.ok mat-icon { color:var(--color-ok); } .up-job.err mat-icon { color:var(--color-danger); }
    .up-job__name { flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--color-text); }
    .up-job__meta { font-size:0.72rem; color:var(--color-text-3); }

    .up-summary { display:flex; gap:12px; }
    .up-stat { flex:1; text-align:center; border:1px solid var(--color-line); border-radius:12px; padding:12px; background:var(--color-surface); }
    .up-stat b { display:block; font-size:1.4rem; color:var(--color-text); } .up-stat span { font-size:0.74rem; color:var(--color-text-3); }

    .up-msg { display:flex; align-items:center; gap:6px; font-size:0.84rem; padding:10px 12px; border-radius:10px; }
    .up-msg.ok { color:#047857; background:var(--color-ok-soft); border:1px solid #a7f3d0; }
    .up-msg.err { color:var(--color-danger); background:var(--color-danger-soft); border:1px solid #fca5a5; }
    .up-msg mat-icon { font-size:18px; width:18px; height:18px; }

    /* Success pop-up shown ONLY after a committed import */
    .up-success-overlay {
      position:fixed; inset:0; z-index:1400; background:rgba(15,23,42,0.55);
      display:flex; align-items:center; justify-content:center; padding:24px;
      animation:up-fade .12s ease;
    }
    @keyframes up-fade { from { opacity:0; } to { opacity:1; } }
    .up-success {
      background:var(--color-surface); border-radius:16px; padding:28px 26px; width:min(420px,92vw);
      text-align:center; box-shadow:0 24px 60px rgba(0,0,0,0.35);
    }
    .up-success__badge {
      width:64px; height:64px; border-radius:50%; margin:0 auto 14px;
      background:var(--color-ok-soft); display:flex; align-items:center; justify-content:center;
    }
    .up-success__badge mat-icon { color:var(--color-ok); font-size:38px; width:38px; height:38px; }
    .up-success h3 { margin:0 0 8px; font-size:1.2rem; color:var(--color-text); }
    .up-success__lead { margin:0 0 8px; color:var(--color-text-2); font-size:0.92rem; }
    .up-success__detail { margin:0 0 18px; color:var(--color-text-3); font-size:0.82rem; }
    .up-success .up-btn--primary { width:100%; justify-content:center; }

    .up-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:4px; }
    .up-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 16px; border:1px solid var(--color-line); border-radius:10px;
      background:var(--color-surface); color:var(--color-text-2); font-weight:600; font-size:0.85rem; cursor:pointer; }
    .up-btn:hover { background:var(--color-canvas); }
    .up-btn--primary { background:linear-gradient(120deg,var(--color-primary),var(--color-primary)); border-color:transparent; color:#fff; }
    .up-btn[disabled] { opacity:0.5; cursor:not-allowed; }
    .up-btn mat-icon { font-size:18px; width:18px; height:18px; }
    .up-btn mat-icon.progress_activity, .up-btn [class*="progress"] { animation:up-spin 1s linear infinite; }
  `]
})
export class UploaderDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly docsService = inject(CollaborativeDocsService);
  private readonly dialogRef = inject(MatDialogRef<UploaderDialogComponent>);
  private readonly apiUrl = environment.apiUrl;

  readonly mode = signal<UploaderMode>('home');
  readonly dragging = signal(false);
  readonly busy = signal(false);

  readonly cards: UploaderCard[] = [
    { mode: 'pod', icon: 'fact_check', title: 'POD Uploader', accent: '#6366f1',
      description: 'Upload multiple proof-of-delivery files and tag the invoice numbers each covers. Auto-links to a tripsheet where possible.' },
    { mode: 'invoice', icon: 'receipt_long', title: 'Invoice Uploader', accent: '#0ea5e9',
      description: 'Import an invoice / sales Excel worksheet. Pick the company and the sheet is imported for you.' },
    { mode: 'document', icon: 'folder_shared', title: 'Document Uploader', accent: '#f59e0b',
      description: 'Upload files or whole folders to the portal. Choose the department and enter its password.' },
    { mode: 'worksheet', icon: 'table_view', title: 'Worksheet Uploader', accent: '#10b981',
      description: 'Convert an Excel/CSV worksheet into a new collaborative spreadsheet, then open it and add collaborators.' },
  ];

  readonly companies = [
    { code: 'PMT', name: 'Promed Technologies' },
    { code: 'ACM', name: 'Access Medical' },
    { code: 'PHT', name: 'Pharmatech' },
    { code: 'SBT', name: 'Sebenzani Trading' },
  ];

  // Invoice state
  invoiceCompany = 'PMT';
  invoiceFile: File | null = null;
  invoiceMsg = '';
  invoiceOk = false;
  /** Populated only after a successful COMMIT — drives the success pop-up. */
  invoiceSuccess: { company: string; committed: number; message: string } | null = null;

  // Document state
  readonly departments = signal<DepartmentOption[]>([]);
  docDepartment = '';
  docPassword = '';
  showPwd = false;
  docAuthed = false;
  private docToken: string | null = null;
  readonly docJobs = signal<UploadJob[]>([]);

  // Worksheet state
  worksheetFile: File | null = null;
  private worksheetWorkbook: XLSX.WorkBook | null = null;
  worksheetSheets: string[] = [];
  worksheetSelectedSheet = '';
  worksheetSummary: { rows: number; cols: number } | null = null;
  worksheetMsg = '';
  worksheetOk = false;

  headerTitle(): string {
    switch (this.mode()) {
      case 'pod': return 'POD Uploader';
      case 'invoice': return 'Invoice Uploader';
      case 'document': return 'Document Uploader';
      case 'worksheet': return 'Worksheet Uploader';
      default: return 'Uploader';
    }
  }
  headerSubtitle(): string {
    switch (this.mode()) {
      case 'pod': return 'Upload PODs and tag the invoices they cover';
      case 'invoice': return 'Import an invoice worksheet for a company';
      case 'document': return 'Upload files or folders to a department';
      case 'worksheet': return 'Convert a worksheet into a new collaborative spreadsheet';
      default: return 'Choose what you want to upload';
    }
  }

  select(mode: UploaderMode): void {
    this.mode.set(mode);
    if (mode === 'document' && this.departments().length === 0) this.loadDepartments();
  }
  goHome(): void { this.mode.set('home'); }

  // ---- shared file pickers ----
  onDragOver(evt: DragEvent): void { evt.preventDefault(); this.dragging.set(true); }
  onDropSingle(evt: DragEvent, kind: 'invoice' | 'worksheet'): void {
    evt.preventDefault();
    this.dragging.set(false);
    const f = evt.dataTransfer?.files?.[0];
    if (f) this.setSingle(kind, f);
  }
  onPickSingle(evt: Event, kind: 'invoice' | 'worksheet'): void {
    const input = evt.target as HTMLInputElement;
    if (input.files?.[0]) this.setSingle(kind, input.files[0]);
    input.value = '';
  }
  private setSingle(kind: 'invoice' | 'worksheet', file: File): void {
    if (kind === 'invoice') { this.invoiceFile = file; this.invoiceMsg = ''; }
    else { this.worksheetFile = file; this.worksheetMsg = ''; this.worksheetSummary = null; this.readWorkbook(file); }
  }

  /** Read the workbook so we can list sheets and show a quick summary before converting. */
  private async readWorkbook(file: File): Promise<void> {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      this.worksheetWorkbook = wb;
      this.worksheetSheets = wb.SheetNames || [];
      this.worksheetSelectedSheet = this.worksheetSheets[0] || '';
      this.summariseSelectedSheet();
    } catch {
      this.worksheetWorkbook = null;
      this.worksheetSheets = [];
      this.worksheetOk = false;
      this.worksheetMsg = 'Could not read that file.';
    }
  }

  private summariseSelectedSheet(): void {
    const wb = this.worksheetWorkbook;
    if (!wb || !this.worksheetSelectedSheet) { this.worksheetSummary = null; return; }
    const ws = wb.Sheets[this.worksheetSelectedSheet];
    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false }) as unknown[][];
    const cols = rows.reduce((max, r) => Math.max(max, (r?.length || 0)), 0);
    this.worksheetSummary = { rows: rows.length, cols };
  }

  // ---- INVOICE ----
  uploadInvoice(): void {
    if (!this.invoiceFile) return;
    this.busy.set(true);
    this.invoiceMsg = 'Uploading & parsing worksheet…';
    this.invoiceOk = true;
    this.invoiceSuccess = null;

    const form = new FormData();
    form.append('file', this.invoiceFile);
    form.append('sourceCompany', this.invoiceCompany);

    // Step 1 — parse the file into staging.
    this.http.post<any>(`${this.apiUrl}/imports/sales-report`, form).subscribe({
      next: (res) => {
        if (res?.success === false || res?.status === 'Failed' || !res?.importId) {
          this.busy.set(false);
          this.invoiceOk = false;
          this.invoiceMsg = res?.message || 'Import failed — the file could not be parsed.';
          return;
        }
        // Step 2 — COMMIT so the data becomes live. Success is only shown after this.
        this.invoiceMsg = 'Parsed — committing to live sales…';
        this.commitInvoice(res.importId, res);
      },
      error: (err) => {
        this.busy.set(false);
        this.invoiceOk = false;
        this.invoiceMsg = err?.error?.message || err?.error || 'Import failed.';
      }
    });
  }

  /** Commit a parsed import batch; only on success do we surface the pop-up. */
  private commitInvoice(importId: string, parseRes: any): void {
    this.http.post<any>(`${this.apiUrl}/imports/${importId}/commit`, {}).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res?.success === false) {
          this.invoiceOk = false;
          this.invoiceMsg = res?.message || 'Commit failed — data was NOT saved to live sales.';
          return;
        }
        const committed = res?.transactionsCommitted ?? parseRes?.summary?.transactions ?? 0;
        const companyName = this.companies.find(c => c.code === this.invoiceCompany)?.name || this.invoiceCompany;
        this.invoiceOk = true;
        this.invoiceMsg = res?.message || `Committed ${committed} transactions.`;
        this.invoiceSuccess = { company: companyName, committed, message: res?.message || '' };
        this.invoiceFile = null;
        this.snack.open(`✅ ${committed} invoices committed for ${companyName}.`, 'OK', { duration: 4000 });
      },
      error: (err) => {
        this.busy.set(false);
        this.invoiceOk = false;
        this.invoiceMsg = err?.error?.message || err?.error || 'Commit failed — data was NOT saved to live sales.';
      }
    });
  }

  /** Dismiss the invoice success pop-up. */
  closeInvoiceSuccess(): void {
    this.invoiceSuccess = null;
    this.invoiceMsg = '';
  }

  // ---- DOCUMENT ----
  private loadDepartments(): void {
    this.http.get<any[]>(`${this.apiUrl}/documents/departments`).subscribe({
      next: (list) => this.departments.set((list || []).map(d => ({ name: d?.name ?? d }))),
      error: () => this.departments.set([]),
    });
  }

  verifyDepartment(): void {
    if (!this.docDepartment || !this.docPassword) return;
    this.busy.set(true);
    this.http.post<any>(`${this.apiUrl}/documents/validate-password`,
      { department: this.docDepartment, password: this.docPassword }).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.docAuthed = !!res?.success;
        this.docToken = res?.token ?? null;
        if (!this.docAuthed) this.snack.open('Invalid password.', 'Close', { duration: 3000 });
      },
      error: () => {
        this.busy.set(false);
        this.docAuthed = false;
        this.snack.open('Invalid password.', 'Close', { duration: 3000 });
      }
    });
  }

  clearDocMsg(): void { /* placeholder for click to reset any inline msg */ }

  onPickDocs(evt: Event, isFolder: boolean): void {
    const input = evt.target as HTMLInputElement;
    if (input.files?.length) {
      const jobs: UploadJob[] = Array.from(input.files).map(file => ({
        file,
        relativePath: isFolder ? ((file as any).webkitRelativePath || file.name) : file.name,
        status: 'pending' as JobStatus,
      }));
      this.docJobs.update(list => [...list, ...jobs]);
    }
    input.value = '';
  }

  docReadyCount(): number { return this.docJobs().filter(j => j.status === 'pending' || j.status === 'error').length; }

  async uploadDocs(): Promise<void> {
    if (!this.docAuthed) return;
    this.busy.set(true);
    const jobs = this.docJobs();
    for (let i = 0; i < jobs.length; i++) {
      if (jobs[i].status === 'pending' || jobs[i].status === 'error') {
        await this.uploadOneDoc(i);
      }
    }
    this.busy.set(false);
    const done = this.docJobs().filter(j => j.status === 'done').length;
    if (done) this.snack.open(`${done} item(s) uploaded to ${this.docDepartment}.`, 'OK', { duration: 3500 });
  }

  private uploadOneDoc(index: number): Promise<void> {
    return new Promise((resolve) => {
      const job = this.docJobs()[index];
      if (!job) { resolve(); return; }
      this.patchDoc(index, { status: 'uploading', message: undefined });

      // Preserve folder structure: everything before the last slash becomes the subfolder.
      const rel = job.relativePath || job.file.name;
      const slash = rel.lastIndexOf('/');
      const subfolder = slash > 0 ? rel.substring(0, slash) : '';

      const form = new FormData();
      form.append('file', job.file, job.file.name);

      let url = `${this.apiUrl}/documents/upload/${encodeURIComponent(this.docDepartment)}`;
      if (subfolder) url += `?subfolder=${encodeURIComponent(subfolder)}`;

      const headers = this.docToken ? { 'X-Document-Token': this.docToken } : undefined;
      this.http.post<any>(url, form, { headers }).subscribe({
        next: () => { this.patchDoc(index, { status: 'done' }); resolve(); },
        error: (err) => {
          this.patchDoc(index, { status: 'error', message: err?.error?.message || 'Upload failed.' });
          resolve();
        }
      });
    });
  }

  private patchDoc(index: number, changes: Partial<UploadJob>): void {
    this.docJobs.update(list => list.map((j, i) => i === index ? { ...j, ...changes } : j));
  }

  // ---- WORKSHEET (convert to a new collaborative spreadsheet) ----
  convertWorksheet(): void {
    if (!this.worksheetFile) return;
    if (this.worksheetSelectedSheet) this.summariseSelectedSheet();

    const doConvert = (csv: string, title: string) => {
      this.busy.set(true);
      this.worksheetMsg = '';
      this.docsService.createDocument({ title, documentType: 'sheet' } as any).subscribe({
        next: (doc: any) => {
          // Seed the sheet editor exactly like the built-in importer does.
          try { sessionStorage.setItem(`collab-import-sheet-${doc.id}`, csv); } catch { /* quota */ }
          this.busy.set(false);
          this.snack.open('Spreadsheet created — opening…', 'OK', { duration: 2500 });
          this.dialogRef.close();
          this.router.navigate(['/sheets', doc.id]);
        },
        error: (err: any) => {
          this.busy.set(false);
          this.worksheetOk = false;
          this.worksheetMsg = err?.error?.message || 'Failed to create the spreadsheet.';
        }
      });
    };

    const baseTitle = this.worksheetFile.name.replace(/\.[^.]+$/, '') || 'Imported worksheet';

    // CSV files can be seeded directly; Excel is converted to CSV via SheetJS.
    const ext = (this.worksheetFile.name.split('.').pop() || '').toLowerCase();
    if (ext === 'csv' && !this.worksheetWorkbook) {
      this.worksheetFile.text().then(text => doConvert(text, baseTitle));
      return;
    }
    const wb = this.worksheetWorkbook;
    if (!wb) { this.worksheetOk = false; this.worksheetMsg = 'Could not read that file.'; return; }
    const ws = wb.Sheets[this.worksheetSelectedSheet || wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(ws);
    const title = this.worksheetSheets.length > 1
      ? `${baseTitle} — ${this.worksheetSelectedSheet}`
      : baseTitle;
    doConvert(csv, title);
  }

  humanSize(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
