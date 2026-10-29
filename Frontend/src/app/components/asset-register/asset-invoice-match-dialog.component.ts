import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { WellyActivityService } from '../../services/welly-activity.service';
import { ToastService } from '../../ui/toast.service';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

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
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatProgressBarModule, MatTooltipModule, EmptyStateComponent],
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
            <app-empty-state icon="search_off" title="No confident matches found"
                             message="Try scanning more invoices, or confirm more invoices in Books first."></app-empty-state>
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
    .match-header mat-icon { color: var(--color-cat-purple); font-size: var(--text-3xl); width: 24px; height: 24px; }
    .match-header h2 { margin: 0 0 4px; font-size: var(--text-2xl); color: var(--color-text); }
    .match-header p { margin: 0; color: var(--color-text-3); font-size: var(--text-sm); }

    .match-setup { display: flex; flex-direction: column; gap: 16px; }
    .setup-row { display: flex; flex-direction: column; gap: 6px; }
    .setup-row label { font-weight: 600; font-size: var(--text-sm); color: var(--color-text-2); }
    .setup-row select { padding: 8px 10px; border: 1px solid var(--color-line-strong); border-radius: 8px; font-size: var(--text-md); background: var(--color-surface); color: var(--color-text); }
    .field-hint { font-size: var(--text-xs); color: var(--color-text-3); }
    .scope-note { font-size: var(--text-md); color: var(--color-text-2); }
    .pill { display: inline-block; background: var(--color-cat-purple-soft); color: var(--color-cat-purple); border-radius: 999px; padding: 2px 10px; font-size: var(--text-xs); margin-left: 6px; }
    .hint { display: flex; gap: 8px; align-items: center; background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: 8px; padding: 10px 12px; font-size: var(--text-xs); color: var(--color-text-3); margin: 0; }
    .hint mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; color: var(--color-text-3); }
    .setup-actions, .results-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
    .results-actions .spacer { flex: 1; }

    .match-running { display: flex; flex-direction: column; gap: 12px; padding: 32px 20px; }
    .prog-head { display: flex; justify-content: space-between; align-items: baseline; }
    .prog-title { font-weight: 600; color: var(--color-text-2); font-size: var(--text-md); }
    .prog-pct { font-weight: 700; color: var(--color-cat-purple); font-size: var(--text-lg); }
    .match-running mat-progress-bar { border-radius: 6px; height: 8px; }
    .prog-status { display: flex; gap: 8px; align-items: center; color: var(--color-text-2); font-size: var(--text-sm); }
    .prog-status mat-icon { color: var(--color-cat-purple); font-size: var(--text-xl); width: 18px; height: 18px; }
    .prog-status .pulse { animation: pulse 1.2s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
    .prog-sub { font-size: var(--text-xs); color: var(--color-text-3); }
    .cancel-run { align-self: flex-start; margin-top: 4px; }

    .result-stats { display: flex; gap: 10px; flex-wrap: wrap; }
    .stat { flex: 1; min-width: 90px; background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: 10px; padding: 10px; text-align: center; }
    .stat .num { display: block; font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); }
    .stat .lbl { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); }
    .stat.good .num { color: var(--color-ok); }
    .stat.warn .num { color: var(--color-warn); }

    .select-bar { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--color-line); border-bottom: 1px solid var(--color-line); padding: 8px 4px; }
    .sel-all { display: flex; gap: 6px; align-items: center; font-size: var(--text-sm); cursor: pointer; }
    .sel-count { font-size: var(--text-xs); color: var(--color-text-3); }

    .suggestions { display: flex; flex-direction: column; gap: 8px; }
    .sugg { display: flex; gap: 10px; padding: 10px; border: 1px solid var(--color-line); border-radius: 10px; align-items: flex-start; }
    .sugg.picked { border-color: var(--color-cat-purple); background: var(--color-cat-purple-soft); }
    .sugg input[type=checkbox] { margin-top: 4px; }
    .overwrite-opt { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--color-text-3); cursor: pointer; }
    .sugg-body { flex: 1; min-width: 0; }
    .sugg-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .sugg-line .asset { font-weight: 600; color: var(--color-text); font-size: var(--text-md); }
    .sugg-line .arrow { font-size: var(--text-lg); width: 16px; height: 16px; color: var(--color-text-3); }
    .sugg-line .inv { display: inline-flex; gap: 4px; align-items: center; color: var(--color-cat-purple); font-weight: 600; font-size: var(--text-sm); }
    .sugg-line .inv mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }
    .sugg-meta { font-size: var(--text-xs); color: var(--color-text-3); margin-top: 3px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .sugg-meta .matched-item { font-style: italic; color: var(--color-text-2); }
    .sugg-meta .book-value { color: var(--color-ok); font-weight: 600; }
    .sugg-meta .dot { color: var(--color-line-strong); }
    .sugg-reason { display: flex; gap: 8px; align-items: center; margin-top: 6px; font-size: var(--text-xs); }
    .conf { font-weight: 700; border-radius: 6px; padding: 1px 7px; font-size: var(--text-xs); }
    .conf.high { background: var(--color-ok-soft); color: var(--color-ok); }
    .conf.mid { background: var(--color-warn-soft); color: var(--color-warn); }
    .conf.low { background: var(--color-danger-soft); color: var(--color-danger); }
    .reason { color: var(--color-text-3); }
    .assigned { color: var(--color-text-3); }

    .unmatched-list { font-size: var(--text-sm); color: var(--color-text-2); background: var(--color-warn-soft); border: 1px solid var(--color-warn-soft); border-radius: 8px; padding: 8px 12px; }
    .unmatched-list summary { cursor: pointer; font-weight: 600; color: var(--color-warn); }
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
    private toast: ToastService,
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
              this.toast.error(json.error || 'Matching failed.');
            }
          } catch {
            // ignore partial/invalid JSON
          }
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.toast.error('Matching failed. Please try again.');
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
    this.toast.info('Matching cancelled.');
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
          this.toast.done(`${res.applied || 0} asset(s) linked${valueMsg}`);
          this.dialogRef.close({ applied: res.applied || 0 });
        },
        error: (err) => {
          this.applying.set(false);
          this.toast.error(err.error?.error || 'Failed to link matches.');
        }
      });
  }

  reset() { this.result.set(null); }
  close() { this.dialogRef.close(); }
}
