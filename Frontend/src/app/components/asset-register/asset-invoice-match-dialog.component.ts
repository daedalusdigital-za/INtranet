import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WellyActivityService } from '../../services/welly-activity.service';

export interface AssetMatchDialogData {
  locationId: number | null;
  region: string;
  subLocation: string;
  category: string;
}

interface Suggestion {
  itemId: number;
  assetDescription: string;
  assetCategory: string;
  assignedTo?: string;
  locationName?: string;
  bookInvoiceId: number;
  invoiceNumber?: string;
  supplier: string;
  invoiceDate: string;
  matchedLineItem: string;
  bookValue?: number | null;
  confidence: number;
  reason: string;
  selected?: boolean;
}

interface MatchResult {
  assetsScanned: number;
  invoicesScanned: number;
  lineItemsExtracted: number;
  matched: number;
  unmatched: number;
  suggestions: Suggestion[];
  unmatchedAssets: string[];
}

interface SupplierOption { supplierName: string; invoiceCount: number; }

@Component({
  selector: 'app-asset-invoice-match-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <div class="match-dialog">
      <div class="match-header">
        <div class="mh-title">
          <mat-icon>auto_awesome</mat-icon>
          <div>
            <h2>AI Invoice Matching</h2>
            <p>Welly matches assets to Books invoices — each invoice line only fills its purchased quantity, so no asset is double-counted.</p>
          </div>
        </div>
      </div>

      @if (!result()) {
        <div class="match-setup">
          <div class="setup-row">
            <label>Scope</label>
            <div class="scope-note">
              @if (data.category || data.region || data.subLocation || data.locationId) {
                Matching the <strong>current filtered view</strong>
                @if (data.category) { <span class="pill">{{ data.category }}</span> }
                @if (data.subLocation) { <span class="pill">{{ data.subLocation }}</span> }
                @else if (data.region) { <span class="pill">{{ data.region }}</span> }
              } @else {
                Matching <strong>all unmatched assets</strong>
              }
            </div>
          </div>

          <div class="setup-row">
            <label for="supplier">Supplier</label>
            <select id="supplier" [(ngModel)]="supplierName">
              <option value="">All suppliers</option>
              @for (s of suppliers(); track s.supplierName) {
                <option [value]="s.supplierName">{{ s.supplierName }} ({{ s.invoiceCount }})</option>
              }
            </select>
            <span class="field-hint">Pick a hardware supplier to scan only their invoices — much faster than scanning everyone.</span>
          </div>

          <div class="setup-row">
            <label for="invLimit">Invoices to scan</label>
            <select id="invLimit" [(ngModel)]="invoiceLimit">
              <option [value]="15">Last 15 confirmed invoices</option>
              <option [value]="30">Last 30 confirmed invoices</option>
              <option [value]="50">Last 50 confirmed invoices</option>
              <option [value]="100">Last 100 confirmed invoices</option>
            </select>
          </div>

          <p class="hint"><mat-icon>info</mat-icon> Only <strong>confirmed</strong> invoices with extracted text are scanned. Larger scans take longer as Welly reads each invoice.</p>

          <div class="setup-actions">
            <button mat-button (click)="close()">Cancel</button>
            <button mat-raised-button color="primary" (click)="runMatch()" [disabled]="running()">
              @if (running()) { <mat-spinner diameter="18"></mat-spinner> <span>Welly is matching…</span> }
              @else { <mat-icon>auto_awesome</mat-icon> <span>Run AI Match</span> }
            </button>
          </div>
        </div>
      }

      @if (running() && !result()) {
        <div class="match-running">
          <div class="prog-head">
            <span class="prog-title">Welly is matching assets to invoices…</span>
            <span class="prog-pct">{{ progressPercent() }}%</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="progressPercent()"></mat-progress-bar>
          <div class="prog-status">
            <mat-icon class="pulse">bolt</mat-icon>
            <span>{{ progressMessage() || 'Starting…' }}</span>
          </div>
          @if (progressTotal() > 0) {
            <div class="prog-sub">Invoice {{ progressCurrent() }} of {{ progressTotal() }} · elapsed {{ elapsed() }}s</div>
          } @else {
            <div class="prog-sub">Elapsed {{ elapsed() }}s</div>
          }
          <button mat-stroked-button class="cancel-run" (click)="cancelRun()"><mat-icon>close</mat-icon> Cancel</button>
        </div>
      }

      @if (result()) {
        <div class="match-results">
          <div class="result-stats">
            <div class="stat"><span class="num">{{ result()!.assetsScanned }}</span><span class="lbl">Assets</span></div>
            <div class="stat"><span class="num">{{ result()!.invoicesScanned }}</span><span class="lbl">Invoices</span></div>
            <div class="stat"><span class="num">{{ result()!.lineItemsExtracted }}</span><span class="lbl">Line Items</span></div>
            <div class="stat good"><span class="num">{{ result()!.matched }}</span><span class="lbl">Matched</span></div>
            <div class="stat warn"><span class="num">{{ result()!.unmatched }}</span><span class="lbl">Unmatched</span></div>
          </div>

          @if (result()!.suggestions.length) {
            <div class="select-bar">
              <label class="sel-all"><input type="checkbox" [checked]="allSelected()" (change)="toggleAll($event)"> Select all</label>
              <span class="sel-count">{{ selectedCount() }} of {{ result()!.suggestions.length }} selected</span>
            </div>

            <div class="suggestions">
              @for (s of result()!.suggestions; track s.itemId) {
                <div class="sugg" [class.picked]="s.selected">
                  <input type="checkbox" [(ngModel)]="s.selected">
                  <div class="sugg-body">
                    <div class="sugg-line">
                      <span class="asset">{{ s.assetDescription }}</span>
                      <mat-icon class="arrow">arrow_forward</mat-icon>
                      <span class="inv">
                        <mat-icon>receipt_long</mat-icon>
                        {{ s.invoiceNumber || 'Invoice #' + s.bookInvoiceId }}
                      </span>
                    </div>
                    <div class="sugg-meta">
                      <span class="supplier">{{ s.supplier }}</span>
                      <span class="dot">·</span>
                      <span class="date">{{ s.invoiceDate | date:'dd MMM yyyy' }}</span>
                      @if (s.bookValue) { <span class="dot">·</span> <span class="book-value">Book value R{{ s.bookValue | number:'1.2-2' }}</span> }
                      @if (s.matchedLineItem) { <span class="dot">·</span> <span class="matched-item">“{{ s.matchedLineItem }}”</span> }
                    </div>
                    <div class="sugg-reason">
                      <span class="conf" [class.high]="s.confidence >= 75" [class.mid]="s.confidence >= 55 && s.confidence < 75" [class.low]="s.confidence < 55">
                        {{ s.confidence }}%
                      </span>
                      <span class="reason">{{ s.reason }}</span>
                      @if (s.assignedTo) { <span class="assigned">· {{ s.assignedTo }}</span> }
                    </div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="no-matches">
              <mat-icon>search_off</mat-icon>
              <p>No confident matches found. Try scanning more invoices, or confirm more invoices in Books first.</p>
            </div>
          }

          @if (result()!.unmatchedAssets.length) {
            <details class="unmatched-list">
              <summary>{{ result()!.unmatchedAssets.length }} asset(s) still unmatched — Welly looked but couldn't find their invoice</summary>
              <ul>
                @for (u of result()!.unmatchedAssets; track u) { <li>{{ u }}</li> }
              </ul>
            </details>
          }

          <div class="results-actions">
            <button mat-button (click)="reset()"><mat-icon>refresh</mat-icon> New Scan</button>
            <label class="overwrite-opt" matTooltip="When on, the invoice line price replaces any existing book value. When off, only empty book values are filled.">
              <input type="checkbox" [(ngModel)]="overwriteExisting"> Overwrite existing book values
            </label>
            <div class="spacer"></div>
            <button mat-button (click)="close()">Close</button>
            <button mat-raised-button color="primary" (click)="applySelected()" [disabled]="applying() || selectedCount() === 0">
              @if (applying()) { <mat-spinner diameter="18"></mat-spinner> <span>Linking…</span> }
              @else { <mat-icon>link</mat-icon> <span>Link {{ selectedCount() }} Selected</span> }
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .match-dialog { display: flex; flex-direction: column; gap: 16px; padding: 20px; width: 720px; max-width: 95vw; max-height: 88vh; overflow-y: auto; }
    .match-header .mh-title { display: flex; gap: 12px; align-items: flex-start; }
    .match-header mat-icon { color: #7c3aed; font-size: 28px; width: 28px; height: 28px; }
    .match-header h2 { margin: 0 0 4px; font-size: 20px; }
    .match-header p { margin: 0; color: #6b7280; font-size: 13px; }

    .match-setup { display: flex; flex-direction: column; gap: 16px; }
    .setup-row { display: flex; flex-direction: column; gap: 6px; }
    .setup-row label { font-weight: 600; font-size: 13px; color: #374151; }
    .setup-row select { padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
    .field-hint { font-size: 12px; color: #9ca3af; }
    .scope-note { font-size: 14px; color: #4b5563; }
    .pill { display: inline-block; background: #ede9fe; color: #6d28d9; border-radius: 999px; padding: 2px 10px; font-size: 12px; margin-left: 6px; }
    .hint { display: flex; gap: 8px; align-items: center; background: #f9fafb; border: 1px solid #eef2f7; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #6b7280; margin: 0; }
    .hint mat-icon { font-size: 18px; width: 18px; height: 18px; color: #9ca3af; }
    .setup-actions, .results-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
    .results-actions .spacer { flex: 1; }

    .match-running { display: flex; flex-direction: column; gap: 12px; padding: 32px 20px; }
    .prog-head { display: flex; justify-content: space-between; align-items: baseline; }
    .prog-title { font-weight: 600; color: #374151; font-size: 14px; }
    .prog-pct { font-weight: 700; color: #7c3aed; font-size: 16px; }
    .match-running mat-progress-bar { border-radius: 6px; height: 8px; }
    .prog-status { display: flex; gap: 8px; align-items: center; color: #4b5563; font-size: 13px; }
    .prog-status mat-icon { color: #7c3aed; font-size: 18px; width: 18px; height: 18px; }
    .prog-status .pulse { animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
    .prog-sub { font-size: 12px; color: #9ca3af; }
    .cancel-run { align-self: flex-start; margin-top: 4px; }

    .result-stats { display: flex; gap: 10px; flex-wrap: wrap; }
    .stat { flex: 1; min-width: 90px; background: #f9fafb; border: 1px solid #eef2f7; border-radius: 10px; padding: 10px; text-align: center; }
    .stat .num { display: block; font-size: 22px; font-weight: 700; color: #111827; }
    .stat .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #9ca3af; }
    .stat.good .num { color: #059669; }
    .stat.warn .num { color: #d97706; }

    .select-bar { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 8px 4px; }
    .sel-all { display: flex; gap: 6px; align-items: center; font-size: 13px; cursor: pointer; }
    .sel-count { font-size: 12px; color: #6b7280; }

    .suggestions { display: flex; flex-direction: column; gap: 8px; }
    .sugg { display: flex; gap: 10px; padding: 10px; border: 1px solid #e5e7eb; border-radius: 10px; align-items: flex-start; }
    .sugg.picked { border-color: #7c3aed; background: #faf5ff; }
    .sugg input[type=checkbox] { margin-top: 4px; }
    .overwrite-opt { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #6b7280; cursor: pointer; }
    .sugg-body { flex: 1; min-width: 0; }
    .sugg-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .sugg-line .asset { font-weight: 600; color: #111827; font-size: 14px; }
    .sugg-line .arrow { font-size: 16px; width: 16px; height: 16px; color: #9ca3af; }
    .sugg-line .inv { display: inline-flex; gap: 4px; align-items: center; color: #6d28d9; font-weight: 600; font-size: 13px; }
    .sugg-line .inv mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .sugg-meta { font-size: 12px; color: #6b7280; margin-top: 3px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .sugg-meta .matched-item { font-style: italic; color: #4b5563; }
    .sugg-meta .book-value { color: #059669; font-weight: 600; }
    .sugg-meta .dot { color: #d1d5db; }
    .sugg-reason { display: flex; gap: 8px; align-items: center; margin-top: 6px; font-size: 12px; }
    .conf { font-weight: 700; border-radius: 6px; padding: 1px 7px; font-size: 11px; }
    .conf.high { background: #d1fae5; color: #065f46; }
    .conf.mid { background: #fef3c7; color: #92400e; }
    .conf.low { background: #fee2e2; color: #991b1b; }
    .reason { color: #6b7280; }
    .assigned { color: #9ca3af; }

    .no-matches { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 30px; text-align: center; color: #9ca3af; }
    .no-matches mat-icon { font-size: 36px; width: 36px; height: 36px; }

    .unmatched-list { font-size: 13px; color: #6b7280; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 8px 12px; }
    .unmatched-list summary { cursor: pointer; font-weight: 600; color: #92400e; }
    .unmatched-list ul { margin: 8px 0 0; padding-left: 18px; }
    .unmatched-list li { margin: 2px 0; }
  `]
})
export class AssetInvoiceMatchDialogComponent implements OnInit {
  invoiceLimit = 30;
  supplierName = '';
  suppliers = signal<SupplierOption[]>([]);
  running = signal(false);
  applying = signal(false);
  overwriteExisting = false;
  result = signal<MatchResult | null>(null);

  // Live progress state (driven by SSE)
  progressPercent = signal(0);
  progressMessage = signal('');
  progressCurrent = signal(0);
  progressTotal = signal(0);
  elapsed = signal(0);

  private abortController: AbortController | null = null;
  private timerId: any = null;
  private activityId: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AssetMatchDialogData,
    private dialogRef: MatDialogRef<AssetInvoiceMatchDialogComponent>,
    private http: HttpClient,
    private snack: MatSnackBar,
    private wellyActivity: WellyActivityService
  ) {}

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  ngOnInit(): void {
    this.http.get<SupplierOption[]>(`${environment.apiUrl}/asset-register/match-suppliers`, { headers: this.headers() })
      .subscribe({ next: s => this.suppliers.set(s || []), error: () => {} });
  }

  private token(): string {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
  }

  selectedCount(): number {
    return (this.result()?.suggestions || []).filter(s => s.selected).length;
  }

  allSelected(): boolean {
    const s = this.result()?.suggestions || [];
    return s.length > 0 && s.every(x => x.selected);
  }

  toggleAll(ev: Event) {
    const checked = (ev.target as HTMLInputElement).checked;
    (this.result()?.suggestions || []).forEach(s => s.selected = checked);
  }

  async runMatch() {
    this.running.set(true);
    this.progressPercent.set(0);
    this.progressMessage.set('Starting…');
    this.progressCurrent.set(0);
    this.progressTotal.set(0);
    this.elapsed.set(0);

    // Liveness timer so the user always sees the clock ticking
    const started = Date.now();
    this.timerId = setInterval(() => this.elapsed.set(Math.floor((Date.now() - started) / 1000)), 1000);
    this.activityId = this.wellyActivity.start(
      this.supplierName ? `Matching invoices: ${this.supplierName}` : 'Matching assets to invoices');

    this.abortController = new AbortController();
    const payload = {
      locationId: this.data.locationId,
      region: this.data.region || null,
      subLocation: this.data.subLocation || null,
      category: this.data.category || null,
      supplierName: this.supplierName || null,
      invoiceLimit: +this.invoiceLimit,
      unmatchedOnly: true
    };

    try {
      const response = await fetch(`${environment.apiUrl}/asset-register/ai-match-invoices-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.token()}` },
        body: JSON.stringify(payload),
        signal: this.abortController.signal
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep incomplete tail

        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.substring(5).trim();
          if (data === '[DONE]') continue;

          try {
            const json = JSON.parse(data);
            if (json.progress) {
              this.progressPercent.set(json.progress.percent ?? this.progressPercent());
              this.progressMessage.set(json.progress.message ?? '');
              this.progressCurrent.set(json.progress.current ?? 0);
              this.progressTotal.set(json.progress.total ?? 0);
            } else if (json.result) {
              const res: MatchResult = json.result;
              res.suggestions.forEach(s => s.selected = s.confidence >= 70);
              this.progressPercent.set(100);
              this.result.set(res);
            } else if (json.error) {
              this.snack.open(json.error || 'Matching failed.', 'Close', { duration: 5000 });
            }
          } catch {
            // ignore partial/invalid JSON
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.snack.open('Matching failed. Please try again.', 'Close', { duration: 5000 });
      }
    } finally {
      this.stopTimer();
      this.running.set(false);
      this.abortController = null;
      if (this.activityId !== null) { this.wellyActivity.stop(this.activityId); this.activityId = null; }
    }
  }

  cancelRun() {
    this.abortController?.abort();
    this.stopTimer();
    this.running.set(false);
    this.snack.open('Matching cancelled.', 'Close', { duration: 2500 });
  }

  private stopTimer() {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
  }

  applySelected() {
    const matches = (this.result()?.suggestions || [])
      .filter(s => s.selected)
      .map(s => ({ itemId: s.itemId, bookInvoiceId: s.bookInvoiceId, invoiceNumber: s.invoiceNumber, bookValue: s.bookValue }));

    if (!matches.length) return;
    this.applying.set(true);

    this.http.post<any>(`${environment.apiUrl}/asset-register/apply-invoice-matches`, { matches, overwriteExistingValues: this.overwriteExisting }, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          this.applying.set(false);
          const valueMsg = res.valuesApplied > 0
            ? ` · R${(res.totalBookValueApplied || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} book value added`
            : '';
          this.snack.open(`${res.applied || 0} asset(s) linked${valueMsg}`, 'Close', { duration: 5000 });
          this.dialogRef.close({ applied: res.applied || 0 });
        },
        error: (err) => {
          this.applying.set(false);
          this.snack.open(err.error?.error || 'Failed to link matches.', 'Close', { duration: 5000 });
        }
      });
  }

  reset() { this.result.set(null); }
  close() { this.dialogRef.close(); }
}
