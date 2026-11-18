import { Component, OnInit, inject, signal, computed, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ExplainerDialogComponent } from './explainer-dialog.component';
import { companyWideLogo, companyMonogram, companyHue } from '../../core/company-logos';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, Cashflow, CashCompany, CashLine, CashLineInput, CashSection } from '../../services/creditor-packs.service';

interface LineForm extends CashLineInput { id?: number }

/**
 * Finance → Creditors → Cashflow. The group cashflow built the way the treasurer's workbook does it:
 * per company  Balance − Payments − Debit orders − Monthly payments = Closing balance.
 * Balance is typed in by Treasury (bank), Payments come from the open payment packs, debit orders and monthly
 * payments are standing lines kept here. Export gives the same workbook (SUMMARY + a sheet per company).
 */
@Component({
  selector: 'app-finance-cashflow',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
  @if (!cf()) {
    <div class="cf-state"><mat-spinner diameter="36"></mat-spinner><p>Working out the group cashflow…</p></div>
  } @else {
    <div class="cf-toolbar">
      <label class="asat">As at <input type="date" [ngModel]="asAt()" (ngModelChange)="asAt.set($event); load()"></label>
      <span class="hint muted">Balances are the latest captured on or before this date. Payments are every pack not yet paid.</span>
      @if (!canEdit()) { <span class="ro" matTooltip="Bank balances, debit orders and monthly payments are kept by Treasury (Executive › Treasury › Cashflow). Admins can also change them in Admin settings."><mat-icon>lock</mat-icon> View only · kept by Treasury</span> }
      <span class="sp"></span>
      <button mat-icon-button (click)="explain()" matTooltip="How the cashflow is worked out"><mat-icon>help_outline</mat-icon></button>
      <button mat-icon-button (click)="load()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
      <button mat-stroked-button (click)="exportXlsx()" [disabled]="busy()"><mat-icon>table_view</mat-icon> Excel</button>
    </div>

    <!-- ── Summary (the SUMMARY sheet) ── -->
    <div class="cf-card">
      <header><h3><mat-icon>account_balance</mat-icon> Group cashflow</h3><small>Balance − payments − debit orders − monthly = closing</small></header>
      <div class="tbl-wrap">
      <table class="cf-sum">
        <thead><tr>
          <th class="co">Company</th><th class="num">Balance</th><th class="num">Payments<small>from packs</small></th><th class="num">Debit orders</th><th class="num">Monthly</th><th class="num cl">Closing balance</th><th></th>
        </tr></thead>
        <tbody>
          @for (c of cf()!.companies; track c.code) {
            <tr [class.open]="sel() === c.code" [class.neg]="c.closing < 0" (click)="toggle(c.code)">
              <td class="co">
                <span class="mark">@if (logo(c.code); as src) { <img [src]="src" [alt]="c.name"> } @else { <span class="mono" [style.--hue]="hue(c.code)">{{ monogram(c.code, c.name) }}</span> }</span>
                <span class="nm"><b>{{ c.name }}</b><small>{{ c.code }}@if (c.balanceAsAt) { · balance {{ c.balanceAsAt | date:'d MMM' }} }</small></span>
              </td>
              <td class="num" [class.missing]="c.balance == null">@if (c.balance != null) { {{ c.balance | number:'1.2-2' }} } @else { <em>not captured</em> }</td>
              <td class="num">{{ c.payments | number:'1.2-2' }}@if (c.batchCount) { <small>{{ c.batchCount }} pack{{ c.batchCount === 1 ? '' : 's' }}</small> }</td>
              <td class="num">{{ c.debitOrders | number:'1.2-2' }}</td>
              <td class="num">{{ c.monthly | number:'1.2-2' }}</td>
              <td class="num cl">{{ c.closing | number:'1.2-2' }}</td>
              <td class="chev"><mat-icon>{{ sel() === c.code ? 'expand_less' : 'expand_more' }}</mat-icon></td>
            </tr>
            @if (sel() === c.code) {
              <tr class="detail"><td colspan="7"><ng-container *ngTemplateOutlet="detail; context: { $implicit: c }"></ng-container></td></tr>
            }
          }
        </tbody>
        <tfoot><tr>
          <td class="co">Total</td>
          <td class="num">{{ cf()!.totals.balance | number:'1.2-2' }}</td>
          <td class="num">{{ cf()!.totals.payments | number:'1.2-2' }}</td>
          <td class="num">{{ cf()!.totals.debitOrders | number:'1.2-2' }}</td>
          <td class="num">{{ cf()!.totals.monthly | number:'1.2-2' }}</td>
          <td class="num cl" [class.negv]="cf()!.totals.closing < 0">{{ cf()!.totals.closing | number:'1.2-2' }}</td><td></td>
        </tr></tfoot>
      </table>
      </div>
      @if (missingBalances().length) {
        <p class="note"><mat-icon>info</mat-icon> No bank balance captured yet for <strong>{{ missingBalances().join(', ') }}</strong> — {{ canEdit() ? 'click the company row to add one.' : 'Treasury captures these.' }}</p>
      }
    </div>
  }

  <!-- ── Company detail (the per-company sheet) ── -->
  <ng-template #detail let-c>
    <div class="cf-detail">
      <!-- Balance -->
      <section class="bal">
        <h4><mat-icon>savings</mat-icon> Bank balance</h4>
        @if (canEdit()) {
          <div class="balform">
            <label>As at <input type="date" [(ngModel)]="balForm.asAt"></label>
            <label>Balance (R) <input type="number" step="0.01" [(ngModel)]="balForm.balance" placeholder="0.00"></label>
            <label class="grow">Note <input type="text" [(ngModel)]="balForm.note" placeholder="e.g. FNB current account, after salaries"></label>
            <button mat-flat-button color="primary" [disabled]="busy() || balForm.balance == null" (click)="saveBalance(c.code)">Save balance</button>
          </div>
        }
        @if (c.balance != null) { <p class="muted small">Latest: <b>R {{ c.balance | number:'1.2-2' }}</b> as at {{ c.balanceAsAt | date:'d MMM yyyy' }}@if (c.balanceNote) { · {{ c.balanceNote }} }</p> }
      </section>

      <!-- Payments from packs -->
      <section>
        <h4><mat-icon>receipt_long</mat-icon> Payments from packs <span class="cnt">{{ c.paymentLines.length }}</span><span class="sp"></span><b>R {{ c.payments | number:'1.2-2' }}</b></h4>
        @if (!c.paymentLines.length) { <p class="muted small">No open payment packs for this company — nothing going out through creditors.</p> }
        @else {
          <table class="cf-lines">
            <thead><tr><th>#</th><th>Supplier</th><th>Date</th><th>Document no.</th><th>Description</th><th>Payable by</th><th class="num">Amount</th><th>Pack</th></tr></thead>
            <tbody>
              @for (l of c.paymentLines; track $index) {
                <tr>
                  <td>{{ l.no }}</td><td>{{ l.supplier }}</td><td class="nowrap">{{ l.invoiceDate ? (l.invoiceDate | date:'dd.MM.yyyy') : '—' }}</td><td class="ref">{{ l.documentNumber || '—' }}</td>
                  <td class="desc">{{ l.description || '' }}</td><td class="nowrap">{{ l.payableBy | date:'dd.MM.yyyy' }}</td><td class="num">{{ l.amount | number:'1.2-2' }}</td>
                  <td><button type="button" class="lnk" (click)="openBatch.emit(batchId(c, l.batchNumber)); $event.stopPropagation()">{{ l.batchNumber }}</button><small class="st">{{ statusTitle(l.status) }}</small></td>
                </tr>
              }
            </tbody>
          </table>
        }
      </section>

      <!-- Debit orders & monthly -->
      @for (sec of sections; track sec.key) {
        <section>
          <h4><mat-icon>{{ sec.icon }}</mat-icon> {{ sec.title }} <span class="cnt">{{ linesFor(c, sec.key).length }}</span><span class="sp"></span><b>R {{ (sec.key === 'DebitOrder' ? c.debitOrders : c.monthly) | number:'1.2-2' }}</b>
            @if (canEdit()) { <button mat-stroked-button (click)="startLine(c.code, sec.key)"><mat-icon>add</mat-icon> Add</button> }
          </h4>
          <p class="muted small">{{ sec.hint }}</p>
          @if (form() && form()!.companyCode === c.code && form()!.section === sec.key) {
            <div class="lineform">
              <label>Payee <input type="text" [(ngModel)]="form()!.payee" placeholder="e.g. Standard Bank"></label>
              <label>Reference / account <input type="text" [(ngModel)]="form()!.reference"></label>
              <label>Frequency <input type="text" [(ngModel)]="form()!.frequency" placeholder="Monthly on the 1st"></label>
              <label class="sm">Due day <input type="number" min="1" max="31" [(ngModel)]="form()!.dueDay"></label>
              <label class="grow">Description <input type="text" [(ngModel)]="form()!.description"></label>
              <label>Amount (R) <input type="number" step="0.01" [(ngModel)]="form()!.amount"></label>
              <div class="acts">
                <button mat-button (click)="form.set(null)">Cancel</button>
                <button mat-flat-button color="primary" [disabled]="busy() || !form()!.payee || form()!.amount == null" (click)="saveLine()">{{ form()!.id ? 'Save' : 'Add' }}</button>
              </div>
            </div>
          }
          @if (linesFor(c, sec.key).length) {
            <table class="cf-lines">
              <thead><tr><th>#</th><th>Payee</th><th>Reference</th><th>Frequency</th><th>Due</th><th>Description</th><th class="num">Amount</th>@if (canEdit()) { <th></th> }</tr></thead>
              <tbody>
                @for (l of linesFor(c, sec.key); track l.id; let i = $index) {
                  <tr>
                    <td>{{ i + 1 }}</td><td><b>{{ l.payee }}</b></td><td class="ref">{{ l.reference || '—' }}</td><td>{{ l.frequency || '—' }}</td><td>{{ l.dueDay ? ('Day ' + l.dueDay) : '—' }}</td>
                    <td class="desc">{{ l.description || '' }}</td><td class="num">{{ l.amount | number:'1.2-2' }}</td>
                    @if (canEdit()) {
                      <td class="nowrap">
                        <button mat-icon-button (click)="editLine(l)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                        <button mat-icon-button (click)="removeLine(l)" matTooltip="Remove"><mat-icon>delete_outline</mat-icon></button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }
    </div>
  </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .muted { color: var(--color-text-3); } .small { font-size: var(--text-sm); } .nowrap { white-space: nowrap; } .ref { font-family: var(--font-mono); font-size: var(--text-xs); } .sp { flex: 1; }
    .cf-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); }
    .cf-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);
      .asat { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); font-weight: 600; input { height: 38px; padding: 0 10px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; } }
      .hint { font-size: var(--text-xs); }
      .ro { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-surface-3); color: var(--color-text-2); mat-icon { font-size: 14px; width: 14px; height: 14px; } } }
    .cf-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);
      header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); flex-wrap: wrap; h3 { margin: 0; font-size: var(--text-md); display: flex; align-items: center; gap: 6px; mat-icon { color: var(--color-primary); } } small { color: var(--color-text-3); } }
      .note { display: flex; align-items: center; gap: 6px; margin: var(--space-3) 0 0; font-size: var(--text-sm); color: var(--color-text-2); mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); } } }
    .tbl-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); th, td { padding: 8px 10px; text-align: left; vertical-align: middle; } th { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); border-bottom: 1px solid var(--color-line-strong); small { display: block; text-transform: none; letter-spacing: 0; font-weight: 400; } } .num { text-align: right; font-family: var(--font-mono); white-space: nowrap; small { display: block; font-family: var(--font-sans); color: var(--color-text-3); font-size: var(--text-xs); } } }
    .cf-sum {
      tbody tr:not(.detail) { cursor: pointer; border-bottom: 1px solid var(--color-line); &:hover { background: var(--color-surface-2); } &.open { background: var(--color-primary-soft); } &.neg .cl { color: var(--color-danger); } }
      td.co { display: flex; align-items: center; gap: 10px; min-width: 260px; }
      .mark { width: 72px; height: 40px; flex: 0 0 auto; display: grid; place-items: center; background: #fff; border: 1px solid var(--color-line); border-radius: var(--radius-sm); overflow: hidden; img { max-width: 84%; max-height: 80%; width: auto; height: auto; object-fit: contain; display: block; } }
      .mono { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; font-size: 12px; letter-spacing: .06em; color: hsl(var(--hue) 45% 32%); background: linear-gradient(135deg, hsl(var(--hue) 55% 94%), hsl(var(--hue) 45% 86%)); }
      .nm { display: flex; flex-direction: column; line-height: 1.2; b { font-size: var(--text-md); } small { color: var(--color-text-3); font-size: var(--text-xs); } }
      .cl { font-weight: 700; } .missing em { color: var(--color-warn); font-size: var(--text-xs); font-style: normal; }
      .chev { width: 32px; color: var(--color-text-3); }
      tfoot td { border-top: 2px solid var(--color-text); font-weight: 700; padding-top: 10px; &.negv { color: var(--color-danger); } }
      tr.detail td { padding: 0 0 var(--space-3); background: var(--color-surface-2); cursor: default; } }
    .cf-detail { padding: var(--space-3) var(--space-4); display: grid; gap: var(--space-4);
      section { h4 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: var(--text-sm); mat-icon { color: var(--color-primary); font-size: 20px; width: 20px; height: 20px; } .cnt { font-size: var(--text-xs); background: var(--color-surface-3); padding: 1px 8px; border-radius: 999px; } b { font-family: var(--font-mono); } }
        p.small { margin: 0 0 8px; } }
      .cf-lines { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; td { border-top: 1px solid var(--color-line); } .desc { color: var(--color-text-2); max-width: 360px; } .st { display: block; color: var(--color-text-3); font-size: var(--text-xs); } }
      .lnk { font: inherit; font-family: var(--font-mono); font-weight: 600; color: var(--color-primary); background: none; border: 0; padding: 0; cursor: pointer; &:hover { text-decoration: underline; } }
      .balform, .lineform { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-2); padding: var(--space-3); margin-bottom: var(--space-2); background: var(--color-surface); border: 1px dashed var(--color-line-strong); border-radius: var(--radius-md);
        label { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-xs); color: var(--color-text-2); font-weight: 600; min-width: 140px; &.grow { flex: 1; min-width: 220px; } &.sm { min-width: 90px; }
          input { height: 36px; padding: 0 10px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; font-weight: 400; } }
        .acts { display: flex; gap: 6px; margin-left: auto; } } }
  `]
})
export class FinanceCashflowComponent implements OnInit {
  private api = inject(CreditorPacksService);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);
  /** Ask the parent to open a payment pack (batch id). */
  @Output() openBatch = new EventEmitter<number>();
  /** Finance › Creditors shows the cashflow view-only; it is edited in Treasury or Admin settings. */
  @Input() readOnly = false;
  /** Editable only where the host allows it AND the server says this user is Treasury or an admin. */
  canEdit(): boolean { return !this.readOnly && !!this.cf()?.canEdit; }

  cf = signal<Cashflow | null>(null);
  busy = signal(false);
  asAt = signal(new Date().toISOString().slice(0, 10));
  sel = signal<string | null>(null);
  form = signal<LineForm | null>(null);
  balForm: { asAt: string; balance: number | null; note: string } = { asAt: new Date().toISOString().slice(0, 10), balance: null, note: '' };
  missingBalances = computed(() => (this.cf()?.companies ?? []).filter(c => c.balance == null).map(c => c.code));

  readonly sections: { key: CashSection; title: string; icon: string; hint: string }[] = [
    { key: 'DebitOrder', title: 'Debit orders', icon: 'autorenew', hint: 'Taken by the bank automatically — fuel cards, tracking, finance, bank charges. Not in any payment pack.' },
    { key: 'Monthly', title: 'Monthly payments', icon: 'event_repeat', hint: 'Fixed outflows paid outside packs — salaries, SARS (VAT, EMP201), rent, intercompany.' },
  ];

  logo = companyWideLogo; monogram = companyMonogram; hue = companyHue;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.cashflow(this.asAt()).subscribe({ next: c => this.cf.set(c), error: () => this.toast.error("Couldn't load the cashflow.") });
  }
  toggle(code: string): void { this.sel.set(this.sel() === code ? null : code); this.form.set(null); const c = this.cf()?.companies.find(x => x.code === code); this.balForm = { asAt: this.asAt(), balance: c?.balance ?? null, note: '' }; }
  linesFor(c: CashCompany, s: CashSection): CashLine[] { return c.lines.filter(l => l.section === s); }
  batchId(c: CashCompany, no: string): number { return c.batches.find(b => b.batchNumber === no)?.id ?? 0; }
  statusTitle(s: string): string { return ({ Draft: 'Draft', ChecksFailed: 'Checks failed', AwaitingAccountant: 'With accountant', QueriedByAccountant: 'Queried', AwaitingDirector: 'With director', QueriedByDirector: 'Queried', Approved: 'Approved', LoadedOnBank: 'Loaded on bank' } as Record<string, string>)[s] ?? s; }

  private apply(c: Cashflow, msg: string): void { this.cf.set(c); this.busy.set(false); this.form.set(null); this.toast.done(msg); }
  private fail(e: any, fallback: string): void { this.busy.set(false); this.toast.error(e?.error?.message || fallback); }

  saveBalance(code: string): void {
    if (this.balForm.balance == null) return;
    this.busy.set(true);
    this.api.setCashBalance({ companyCode: code, asAt: this.balForm.asAt, balance: Number(this.balForm.balance), note: this.balForm.note || undefined })
      .subscribe({ next: c => { this.apply(c, 'Balance saved'); if (this.asAt() !== new Date().toISOString().slice(0, 10)) this.load(); }, error: e => this.fail(e, "Couldn't save the balance.") });
  }
  startLine(code: string, section: CashSection): void { this.form.set({ companyCode: code, section, payee: '', reference: '', description: '', frequency: section === 'Monthly' ? 'Monthly' : 'Monthly on the 1st', dueDay: 1, amount: 0, isActive: true }); }
  editLine(l: CashLine): void { this.form.set({ id: l.id, companyCode: l.companyCode, section: l.section, payee: l.payee, reference: l.reference ?? '', description: l.description ?? '', frequency: l.frequency ?? '', dueDay: l.dueDay ?? null, amount: l.amount, isActive: l.isActive }); }
  saveLine(): void {
    const f = this.form(); if (!f) return;
    const body: CashLineInput = { companyCode: f.companyCode, section: f.section, payee: f.payee.trim(), reference: f.reference || null, description: f.description || null, frequency: f.frequency || null, dueDay: f.dueDay ? Number(f.dueDay) : null, amount: Number(f.amount), isActive: true };
    this.busy.set(true);
    (f.id ? this.api.updateCashLine(f.id, body) : this.api.addCashLine(body)).subscribe({ next: c => this.apply(c, f.id ? 'Line updated' : 'Line added'), error: e => this.fail(e, "Couldn't save the line.") });
  }
  removeLine(l: CashLine): void {
    if (!confirm(`Remove ${l.payee} (R ${l.amount.toFixed(2)}) from ${l.section === 'Monthly' ? 'monthly payments' : 'debit orders'}?`)) return;
    this.busy.set(true);
    this.api.deleteCashLine(l.id).subscribe({ next: c => this.apply(c, 'Line removed'), error: e => this.fail(e, "Couldn't remove the line.") });
  }
  exportXlsx(): void {
    this.busy.set(true);
    this.api.cashflowXlsx(this.asAt()).subscribe({
      next: blob => { this.busy.set(false); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Group-cashflow-${this.asAt()}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); },
      error: () => this.fail(null, "Couldn't build the workbook.")
    });
  }
  explain(): void {
    ExplainerDialogComponent.open(this.dialog, {
      title: 'How the cashflow is worked out',
      intro: 'This is the group cashflow workbook, kept live. One row per paying company; click a row to see the detail that makes up each figure.',
      steps: [
        { icon: 'savings', title: 'Balance', body: 'The bank balance Treasury captured, as at a date. The latest balance on or before the "as at" date is used. Nothing in the system changes a captured balance — only Treasury (or an admin) does.' },
        { icon: 'receipt_long', title: 'Payments', body: 'Every payment in a pack that has not been paid yet — draft, with the accountant, with the director, approved or loaded on the bank. This is the Payment Schedule on the company sheet.' },
        { icon: 'autorenew', title: 'Debit orders', body: 'Standing amounts the bank takes automatically. Kept here as a list per company.' },
        { icon: 'event_repeat', title: 'Monthly payments', body: 'Fixed outflows paid outside packs: salaries, SARS, rent, intercompany.' },
        { icon: 'functions', title: 'Closing balance', body: 'Balance − Payments − Debit orders − Monthly. Red means the company cannot cover everything from its current balance.' },
        { icon: 'table_view', title: 'Excel', body: 'Downloads the same workbook as the template: a SUMMARY sheet plus one sheet per company with formulas linking them.' },
      ]
    });
  }
}
