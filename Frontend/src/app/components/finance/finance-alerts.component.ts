import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';

interface StaleCo { company: string; code: string; snapshotId?: number; asOf?: string; days?: number; level: 'ok' | 'amber' | 'red' | 'missing'; totalBalance: number; }
interface UnsignedCn { number: string; company: string; customerNumber: string; customerName: string; date: string; value: number; }
interface NoPodInv { company: string; code: string; customerCode: string; customerName: string; documentNumber: string; documentDate?: string; balance: number; ageDays: number; poNumber?: string; }
interface PendingRet { id: number; creditNoteNumber: string; company: string; customerName?: string; returnType: string; createdAt: string; lines: number; qty: number; }
export interface FinanceAlerts {
  generatedAt: string; total: number;
  thresholds: { staleAmberDays: number; staleRedDays: number; unsignedAfterDays: number; noPodAfterDays: number; podCaptureSince?: string };
  aging: { stale: number; companies: StaleCo[] };
  unsignedCredits: { count: number; value: number; items: UnsignedCn[] };
  noPodInvoices: { count: number; value: number; byCompany: { company: string; count: number; value: number }[]; items: NoPodInv[] };
  pendingReturns: { count: number; items: PendingRet[] };
  customers: { total: number; unmapped: number; masters: number };
}

/**
 * Control-gap strip for the Finance overview. Each card is a live query, so it clears itself as soon as the
 * gap is closed. Clicking a card jumps to the tab where the fix happens.
 */
@Component({
  selector: 'app-finance-alerts',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    @if (alerts(); as a) {
      <div class="alerts" [class.quiet]="a.total === 0">
        <div class="alerts-head">
          <mat-icon>{{ a.total === 0 ? 'verified' : 'notification_important' }}</mat-icon>
          <b>{{ a.total === 0 ? 'No control gaps' : a.total + ' control gap' + (a.total === 1 ? '' : 's') }}</b>
          <span class="muted">staleness · unsigned credits · disputed-pattern invoices · pending returns</span>
          <span class="spacer"></span>
          <button mat-icon-button (click)="load()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
          <button mat-icon-button (click)="expanded.set(!expanded())" [matTooltip]="expanded() ? 'Collapse' : 'Show details'"><mat-icon>{{ expanded() ? 'expand_less' : 'expand_more' }}</mat-icon></button>
        </div>

        <div class="cards">
          <!-- Aging freshness -->
          <button class="card" [class.red]="hasLevel(a, 'red') || hasLevel(a, 'missing')" [class.amber]="!hasLevel(a, 'red') && !hasLevel(a, 'missing') && hasLevel(a, 'amber')" (click)="go.emit('aging')">
            <div class="c-head"><mat-icon>update</mat-icon> Aging freshness</div>
            <div class="chips">
              @for (c of a.aging.companies; track c.code) {
                <span class="chip" [class]="'chip ' + c.level" [matTooltip]="c.asOf ? ('As at ' + (c.asOf | date:'d MMM yyyy')) : 'No aging imported'">
                  {{ c.code }} <b>{{ c.level === 'missing' ? '—' : c.days + 'd' }}</b>
                </span>
              }
            </div>
            <div class="c-foot">amber &gt; {{ a.thresholds.staleAmberDays }}d · red &gt; {{ a.thresholds.staleRedDays }}d</div>
          </button>

          <!-- Unsigned credits -->
          <button class="card" [class.red]="a.unsignedCredits.count > 0" (click)="go.emit('credit-notes:unsigned')">
            <div class="c-head"><mat-icon>draw</mat-icon> Credits without signed copy</div>
            <div class="c-value">{{ a.unsignedCredits.count }} <small>{{ a.unsignedCredits.value | currency:'ZAR':'R':'1.0-0' }}</small></div>
            <div class="c-foot">posted in Sage &gt; {{ a.thresholds.unsignedAfterDays }} days ago · last 12 months</div>
          </button>

          <!-- No POD -->
          <button class="card" [class.red]="a.noPodInvoices.count > 0" (click)="go.emit('aging:nopod')">
            <div class="c-head"><mat-icon>gavel</mat-icon> 60+ days, no POD</div>
            <div class="c-value">{{ a.noPodInvoices.count }} <small>{{ a.noPodInvoices.value | currency:'ZAR':'R':'1.0-0' }}</small></div>
            <div class="c-foot">
              @for (c of a.noPodInvoices.byCompany; track c.company) { <span>{{ shortCo(c.company) }} {{ c.count }}</span> }
              @if (a.noPodInvoices.count === 0) { <span>every old invoice has proof of delivery</span> }
              @if (a.thresholds.podCaptureSince) { <span class="since">invoices since {{ a.thresholds.podCaptureSince | date:'MMM yyyy' }}</span> }
            </div>
          </button>

          <!-- Pending returns -->
          <button class="card" [class.amber]="a.pendingReturns.count > 0" (click)="go.emit('credit-notes:returns')">
            <div class="c-head"><mat-icon>assignment_return</mat-icon> Stock returns to confirm</div>
            <div class="c-value">{{ a.pendingReturns.count }}</div>
            <div class="c-foot">Return / Damaged credits awaiting the branch</div>
          </button>

          <!-- Customer master -->
          <button class="card" [class.amber]="a.customers.unmapped > 0" (click)="go.emit('customers')">
            <div class="c-head"><mat-icon>hub</mat-icon> Customer master</div>
            <div class="c-value">{{ a.customers.masters }} <small>{{ a.customers.unmapped }} unmapped of {{ a.customers.total }} accounts</small></div>
            <div class="c-foot">one view per customer across all companies</div>
          </button>
        </div>

        @if (expanded() && a.total > 0) {
          <div class="detail">
            @if (a.noPodInvoices.items.length) {
              <div class="dcol">
                <h4>Oldest open invoices with no POD</h4>
                <table>
                  <tr><th>Invoice</th><th>Customer</th><th>Co</th><th class="r">Age</th><th class="r">Balance</th></tr>
                  @for (i of a.noPodInvoices.items; track i.documentNumber + i.code) {
                    <tr><td class="mono">{{ i.documentNumber }}</td><td class="ell" [title]="i.customerName">{{ i.customerName }}</td><td>{{ i.code }}</td><td class="r">{{ i.ageDays }}d</td><td class="r mono">{{ i.balance | currency:'ZAR':'R':'1.0-0' }}</td></tr>
                  }
                </table>
              </div>
            }
            @if (a.unsignedCredits.items.length) {
              <div class="dcol">
                <h4>Largest credits with no signed authorisation</h4>
                <table>
                  <tr><th>Credit</th><th>Customer</th><th>Co</th><th>Date</th><th class="r">Value</th></tr>
                  @for (c of a.unsignedCredits.items; track c.number + c.company) {
                    <tr><td class="mono">{{ c.number }}</td><td class="ell" [title]="c.customerName">{{ c.customerName }}</td><td>{{ c.company }}</td><td>{{ c.date | date:'d MMM yy' }}</td><td class="r mono">{{ c.value | currency:'ZAR':'R':'1.0-0' }}</td></tr>
                  }
                </table>
              </div>
            }
          </div>
        }
      </div>
    } @else if (error()) {
      <div class="alerts err"><mat-icon>cloud_off</mat-icon> Couldn't load control alerts. <button mat-button (click)="load()">Retry</button></div>
    }
  `,
  styles: [`
    :host { display:block; margin: 0 0 16px; }
    .alerts { background: var(--surface, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 14px; padding: 12px 14px; }
    .alerts.quiet { border-color: #c7e8d2; }
    .alerts.err { display:flex; align-items:center; gap:8px; color:#9f1239; }
    .alerts-head { display:flex; align-items:center; gap:8px; margin-bottom: 10px; }
    .alerts-head mat-icon { color:#b45309; } .quiet .alerts-head mat-icon { color:#15803d; }
    .muted { color:#6b7280; font-size:12px; } .spacer { flex:1; }
    .cards { display:grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap:10px; }
    .card { text-align:left; background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:10px 12px; cursor:pointer; font: inherit; transition: box-shadow .15s, transform .15s; }
    .card:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08); transform: translateY(-1px); }
    .card.red { background:#fff1f2; border-color:#fecdd3; } .card.amber { background:#fffbeb; border-color:#fde68a; }
    .c-head { display:flex; align-items:center; gap:6px; font-size:12px; color:#374151; font-weight:600; } .c-head mat-icon { font-size:18px; width:18px; height:18px; }
    .c-value { font-size:22px; font-weight:700; margin:4px 0 2px; display:flex; align-items:baseline; gap:8px; } .c-value small { font-size:12px; font-weight:500; color:#6b7280; }
    .c-foot { font-size:11px; color:#6b7280; display:flex; flex-wrap:wrap; gap:8px; }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 4px; }
    .chip { font-size:11px; padding:2px 8px; border-radius:999px; background:#e5e7eb; } .chip.ok { background:#dcfce7; color:#166534; } .chip.amber { background:#fef3c7; color:#92400e; } .chip.red, .chip.missing { background:#fee2e2; color:#991b1b; }
    .detail { display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap:16px; margin-top:12px; padding-top:12px; border-top:1px dashed #e5e7eb; }
    .detail h4 { margin:0 0 6px; font-size:12px; color:#374151; text-transform:uppercase; letter-spacing:.04em; }
    .detail table { width:100%; border-collapse:collapse; font-size:12px; } .detail th { text-align:left; color:#6b7280; font-weight:600; padding:3px 6px; } .detail td { padding:3px 6px; border-top:1px solid #f1f5f9; }
    .r { text-align:right; } .mono { font-family: ui-monospace, monospace; } .ell { max-width: 220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  `]
})
export class FinanceAlertsComponent implements OnInit {
  private http = inject(HttpClient);
  alerts = signal<FinanceAlerts | null>(null);
  error = signal(false);
  expanded = signal(false);
  /** Emits a navigation hint: 'aging' | 'aging:nopod' | 'credit-notes:unsigned' | 'credit-notes:returns' | 'customers' */
  @Output() go = new EventEmitter<string>();

  ngOnInit(): void { this.load(); }
  load(): void {
    this.error.set(false);
    this.http.get<FinanceAlerts>(`${environment.apiUrl}/finance/alerts`).subscribe({ next: a => this.alerts.set(a), error: () => this.error.set(true) });
  }
  hasLevel(a: FinanceAlerts, lvl: string): boolean { return a.aging.companies.some(c => c.level === lvl); }
  shortCo(name: string): string { return name.replace('Promed ', '').replace(' Trading', '').replace('Access ', 'Acc '); }
}
