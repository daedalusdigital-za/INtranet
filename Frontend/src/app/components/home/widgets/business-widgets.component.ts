import { Component, Directive, Input, OnChanges, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, interval } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { WidgetSize } from '../../../services/home-layout.service';

/**
 * Business widgets for Home: the creditors payment tracker, currency board, sales graph,
 * sales vs stock and early/late birds. Each one owns a single small GET to api/home/widgets/*
 * (or api/attendance) and refreshes itself while on the page.
 */

export function rand(v: number | null | undefined): string { return 'R' + Math.round(v ?? 0).toLocaleString('en-US'); }
function short(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `R${(v / 1_000_000).toFixed(1)}m`;
  if (a >= 1_000) return `R${Math.round(v / 1_000)}k`;
  return `R${Math.round(v)}`;
}

@Directive()
abstract class Poller implements OnInit, OnDestroy {
  protected readonly http = inject(HttpClient);
  protected readonly api = environment.apiUrl;
  readonly loading = signal(true);
  readonly failed = signal(false);
  protected everyMs = 5 * 60_000;
  private sub?: Subscription;
  ngOnInit(): void { this.load(); this.sub = interval(this.everyMs).subscribe(() => this.load()); }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
  abstract load(): void;
}

// ── Payment tracker ───────────────────────────────────────────────────────────

export interface TrackerStep {
  key: string; title: string; icon: string; count: number; amount: number; detail: string;
  tone: 'info' | 'ok' | 'warn' | 'danger'; route: string;
  items: { reference: string; supplier?: string; amount: number; detail?: string }[];
  unmatched?: number; stuck?: number; onHold?: number; returned?: number; overdue?: number; dueThisWeek?: number;
  byStage?: { stage: string; title: string; count: number }[];
}

@Component({
  selector: 'app-payment-tracker-widget',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, RouterLink, SkeletonRowsComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
    } @else if (failed()) {
      <app-empty-state compact icon="cloud_off" title="Couldn't load the payment tracker" message="Try again in a moment."></app-empty-state>
    } @else {
      <div class="pt-steps" [class.compact]="compact">
        @for (s of steps(); track s.key; let last = $last) {
          <button type="button" class="pt-step" [class]="'pt-step tone-' + s.tone" [class.on]="open() === s.key" (click)="toggle(s.key)" [matTooltip]="s.detail">
            <span class="pt-ic"><mat-icon>{{ s.icon }}</mat-icon>@if (badge(s); as b) { <i class="pt-badge">{{ b }}</i> }</span>
            <b class="pt-n">{{ s.count }}</b>
            <span class="pt-t">{{ s.title }}</span>
            <small class="pt-a">{{ money(s.amount) }}</small>
          </button>
          @if (!last) { <mat-icon class="pt-arrow">arrow_forward</mat-icon> }
        }
      </div>
      @if (current(); as s) {
        <div class="pt-detail">
          <div class="pt-dh">
            <span [class]="'pt-dot tone-' + s.tone"></span>
            <span class="pt-dt">{{ s.detail }}</span>
            <a class="pt-go" [routerLink]="path(s.route)" [queryParams]="query(s.route)">Open <mat-icon>chevron_right</mat-icon></a>
          </div>
          @if (s.byStage?.length) {
            <div class="pt-stages">@for (st of s.byStage; track st.stage) { <span class="pt-stage">{{ st.count }} · {{ st.title }}</span> }</div>
          }
          @for (i of s.items; track $index) {
            <div class="pt-row">
              <span class="pt-ref">{{ i.reference }}</span>
              <span class="pt-sup">{{ i.supplier || '—' }}<small>{{ i.detail }}</small></span>
              <span class="pt-amt">{{ money(i.amount) }}</span>
            </div>
          } @empty {
            <p class="pt-none">Nothing in this step right now.</p>
          }
        </div>
      } @else {
        <p class="pt-hint"><mat-icon>touch_app</mat-icon>Click a step to see what's in it. Suppliers on new invoices are matched to ones we already know; unknown ones are flagged for the creditors clerk to confirm (or add) before the invoice joins the approval queue.</p>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .pt-steps { display: flex; align-items: stretch; gap: 2px; padding: var(--space-3) var(--space-3) var(--space-2); overflow-x: auto; }
    .pt-step { position: relative; flex: 1 1 0; min-width: 92px; display: grid; justify-items: center; gap: 2px; padding: 10px 6px 8px; border: 1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); cursor: pointer; font: inherit; color: var(--color-text); text-align: center; transition: border-color .15s, background .15s; }
    .pt-step:hover { background: var(--color-surface-2); }
    .pt-step.on { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-soft); }
    .pt-ic { position: relative; width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--color-primary-soft); color: var(--color-primary); }
    .tone-ok .pt-ic { background: var(--color-ok-soft); color: var(--color-ok); }
    .tone-warn .pt-ic { background: var(--color-warn-soft); color: var(--color-warn); }
    .tone-danger .pt-ic { background: var(--color-danger-soft); color: var(--color-danger); }
    .pt-ic mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .pt-badge { position: absolute; top: -6px; right: -8px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-danger); color: #fff; font: 700 10px/18px var(--font-sans, inherit); font-style: normal; }
    .tone-warn .pt-badge { background: var(--color-warn); }
    .pt-n { font-size: var(--text-xl); font-weight: 800; line-height: 1.1; margin-top: 4px; }
    .pt-t { font-size: var(--text-xs); font-weight: 700; color: var(--color-text-2); }
    .pt-a { font-size: var(--text-xs); color: var(--color-text-3); }
    .compact .pt-a { display: none; }
    .pt-arrow { align-self: center; flex: none; color: var(--color-text-3); font-size: 18px; width: 18px; height: 18px; }
    .pt-detail { border-top: 1px solid var(--color-line); }
    .pt-dh { display: flex; align-items: center; gap: 8px; padding: 10px var(--space-4) 6px; }
    .pt-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary); }
    .pt-dot.tone-ok { background: var(--color-ok); } .pt-dot.tone-warn { background: var(--color-warn); } .pt-dot.tone-danger { background: var(--color-danger); }
    .pt-dt { flex: 1; font-size: var(--text-sm); font-weight: 650; color: var(--color-text); }
    .pt-go { display: inline-flex; align-items: center; font-size: var(--text-xs); font-weight: 700; color: var(--color-primary); text-decoration: none; }
    .pt-go mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .pt-stages { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 var(--space-4) 8px; }
    .pt-stage { font-size: var(--text-xs); padding: 2px 8px; border-radius: 10px; background: var(--color-surface-2); color: var(--color-text-2); }
    .pt-row { display: grid; grid-template-columns: auto 1fr auto; gap: var(--space-3); align-items: center; padding: 7px var(--space-4); border-top: 1px solid var(--color-line); font-size: var(--text-sm); }
    .pt-ref { font-family: var(--font-mono, monospace); font-size: var(--text-xs); color: var(--color-text-3); }
    .pt-sup { min-width: 0; display: grid; font-weight: 650; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pt-sup small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); }
    .pt-amt { font-weight: 700; font-variant-numeric: tabular-nums; }
    .pt-none, .pt-hint { margin: 0; padding: 10px var(--space-4) 12px; font-size: var(--text-xs); color: var(--color-text-3); display: flex; gap: 6px; align-items: flex-start; line-height: 1.45; }
    .pt-hint mat-icon { font-size: 16px; width: 16px; height: 16px; flex: none; margin-top: 1px; }
  `]
})
export class PaymentTrackerWidgetComponent extends Poller {
  @Input() size: WidgetSize = 'lg';
  readonly steps = signal<TrackerStep[]>([]);
  readonly open = signal<string | null>(null);
  readonly current = computed(() => this.steps().find(s => s.key === this.open()) ?? null);
  get compact(): boolean { return this.size === 'md'; }

  load(): void {
    this.http.get<{ steps: TrackerStep[] }>(`${this.api}/home/widgets/payment-tracker`).subscribe({
      next: r => { this.steps.set(r.steps); this.loading.set(false); this.failed.set(false); },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }
  toggle(k: string): void { this.open.set(this.open() === k ? null : k); }
  money(v: number): string { return short(v); }
  badge(s: TrackerStep): number | null {
    const n = (s.unmatched ?? 0) + (s.stuck ?? 0) + (s.overdue ?? 0);
    return n > 0 ? n : null;
  }
  path(route: string): string { return route.split('?')[0]; }
  query(route: string): Record<string, string> | null {
    const q = route.split('?')[1];
    if (!q) return null;
    return Object.fromEntries(new URLSearchParams(q).entries());
  }
}

// ── Currency ──────────────────────────────────────────────────────────────────

interface Rate { code: string; name: string; symbol: string; rand: number; previous: number; change: number; changePct: number }
interface CurrencyFeed { date: string; previousDate: string; stale: boolean; source: string; rates: Rate[] }

@Component({
  selector: 'app-currency-widget',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, DatePipe, DecimalPipe, SkeletonRowsComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
    } @else if (failed() || !feed()) {
      <app-empty-state compact icon="cloud_off" title="Rates unavailable" message="The exchange-rate feed could not be reached."></app-empty-state>
    } @else {
      @for (r of feed()!.rates; track r.code) {
        <div class="cx-row" [matTooltip]="'Yesterday R' + (r.previous | number:'1.2-2')">
          <span class="cx-sym">{{ r.symbol }}</span>
          <span class="cx-name">{{ r.code }}<small>{{ r.name }}</small></span>
          <span class="cx-val">R{{ r.rand | number:'1.2-2' }}</span>
          <span class="cx-chg" [class.up]="r.change > 0" [class.down]="r.change < 0">
            <mat-icon>{{ r.change > 0 ? 'arrow_drop_up' : r.change < 0 ? 'arrow_drop_down' : 'remove' }}</mat-icon>{{ r.changePct > 0 ? '+' : '' }}{{ r.changePct | number:'1.2-2' }}%
          </span>
        </div>
      }
      <p class="cx-foot">
        <span>{{ feed()!.date | date:'EEE d MMM' }} vs {{ feed()!.previousDate | date:'EEE d MMM' }}</span>
        @if (feed()!.stale) { <span class="cx-stale"><mat-icon>history</mat-icon>last good rates</span> }
        <span class="cx-src">ECB</span>
      </p>
    }
  `,
  styles: [`
    :host { display: block; }
    .cx-row { display: grid; grid-template-columns: 34px 1fr auto auto; gap: var(--space-3); align-items: center; padding: 9px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .cx-sym { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; background: var(--color-primary-soft); color: var(--color-primary); font-weight: 800; font-size: var(--text-md); }
    .cx-name { display: grid; font-weight: 750; color: var(--color-text); font-size: var(--text-md); }
    .cx-name small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); }
    .cx-val { font-size: var(--text-lg); font-weight: 800; font-variant-numeric: tabular-nums; color: var(--color-text); }
    .cx-chg { display: inline-flex; align-items: center; min-width: 72px; justify-content: flex-end; font-size: var(--text-xs); font-weight: 700; color: var(--color-text-3); font-variant-numeric: tabular-nums; }
    .cx-chg mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .cx-chg.up { color: var(--color-danger); }   /* rand weaker: more rand per unit */
    .cx-chg.down { color: var(--color-ok); }     /* rand stronger */
    .cx-foot { display: flex; gap: 8px; align-items: center; margin: 0; padding: 8px var(--space-4); font-size: var(--text-xs); color: var(--color-text-3); }
    .cx-stale { display: inline-flex; align-items: center; gap: 2px; color: var(--color-warn); font-weight: 700; }
    .cx-stale mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .cx-src { margin-left: auto; font-weight: 700; letter-spacing: .04em; }
  `]
})
export class CurrencyWidgetComponent extends Poller implements OnChanges {
  @Input() codes: string[] = ['USD', 'EUR', 'GBP'];
  readonly feed = signal<CurrencyFeed | null>(null);
  constructor() { super(); this.everyMs = 60 * 60_000; }
  ngOnChanges(): void { if (!this.loading()) this.load(); }
  load(): void {
    const symbols = (this.codes?.length ? this.codes : ['USD', 'EUR', 'GBP']).join(',');
    this.http.get<CurrencyFeed>(`${this.api}/home/widgets/currency`, { params: { symbols } }).subscribe({
      next: f => { this.feed.set(f); this.loading.set(false); this.failed.set(false); },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }
}

export const CURRENCY_OPTIONS = [
  { code: 'USD', name: 'US dollar' }, { code: 'EUR', name: 'Euro' }, { code: 'GBP', name: 'British pound' },
  { code: 'AUD', name: 'Australian dollar' }, { code: 'CNY', name: 'Chinese yuan' }, { code: 'INR', name: 'Indian rupee' },
  { code: 'JPY', name: 'Japanese yen' }, { code: 'CHF', name: 'Swiss franc' }, { code: 'CAD', name: 'Canadian dollar' },
];

// ── Sales graph ───────────────────────────────────────────────────────────────

interface SalesSeries { code: string; name: string; total: number; points: { date: string; sales: number; orders: number }[] }
interface SalesDaily { from: string; to: string; dates: string[]; series: SalesSeries[] }

const SERIES_COLOURS: Record<string, string> = { PMT: '#2563eb', ACM: '#16a34a', PHT: '#f59e0b', SBT: '#db2777' };

@Component({
  selector: 'app-sales-graph-widget',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, DatePipe, SkeletonRowsComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
    } @else if (failed() || !data()) {
      <app-empty-state compact icon="cloud_off" title="Couldn't load sales" message="Try again in a moment."></app-empty-state>
    } @else {
      <div class="sg-legend">
        @for (s of data()!.series; track s.code) {
          <button type="button" class="sg-key" [class.off]="hidden().has(s.code)" (click)="toggleSeries(s.code)" [style.--c]="colour(s.code)">
            <i></i>{{ s.name }}<b>{{ money(s.total) }}</b>
          </button>
        }
      </div>
      <svg class="sg-chart" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" role="img" aria-label="Daily sales per company">
        @for (g of gridLines(); track g.y) {
          <line [attr.x1]="PL" [attr.x2]="W - PR" [attr.y1]="g.y" [attr.y2]="g.y" class="sg-grid"></line>
          <text [attr.x]="PL - 6" [attr.y]="g.y + 3" class="sg-ylab" text-anchor="end">{{ g.label }}</text>
        }
        @for (s of visible(); track s.code) {
          <path [attr.d]="area(s)" class="sg-area" [attr.fill]="colour(s.code)"></path>
          <path [attr.d]="line(s)" class="sg-line" [attr.stroke]="colour(s.code)"></path>
          @for (p of s.points; track p.date; let i = $index) {
            <circle [attr.cx]="x(i)" [attr.cy]="y(p.sales)" r="3.2" [attr.fill]="colour(s.code)" class="sg-pt">
              <title>{{ s.name }} · {{ p.date | date:'EEE d MMM' }}: {{ full(p.sales) }} ({{ p.orders }} invoices)</title>
            </circle>
          }
        }
        @for (d of data()!.dates; track d; let i = $index) {
          <text [attr.x]="x(i)" [attr.y]="H - 4" class="sg-xlab" text-anchor="middle">{{ d | date:(days > 10 ? 'd/M' : 'EEE') }}</text>
        }
      </svg>
      <p class="sg-foot"><span>{{ data()!.from | date:'d MMM' }} – {{ data()!.to | date:'d MMM' }}</span><span class="sg-tot">Total {{ full(grand()) }}</span></p>
    }
  `,
  styles: [`
    :host { display: block; }
    .sg-legend { display: flex; flex-wrap: wrap; gap: 6px; padding: var(--space-3) var(--space-4) 4px; }
    .sg-key { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 6px; border: 1px solid var(--color-line); border-radius: 14px; background: var(--color-surface); cursor: pointer; font: inherit; font-size: var(--text-xs); font-weight: 650; color: var(--color-text); }
    .sg-key i { width: 10px; height: 10px; border-radius: 50%; background: var(--c); }
    .sg-key b { color: var(--color-text-3); font-weight: 700; }
    .sg-key.off { opacity: .45; text-decoration: line-through; }
    .sg-chart { display: block; width: 100%; height: 190px; padding: 0 var(--space-2); }
    .sg-grid { stroke: var(--color-line); stroke-width: 1; }
    .sg-ylab, .sg-xlab { font-size: 10px; fill: var(--color-text-3); }
    .sg-area { opacity: .08; }
    .sg-line { fill: none; stroke-width: 2.2; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
    .sg-pt { stroke: var(--color-surface); stroke-width: 1.5; cursor: help; }
    .sg-foot { display: flex; justify-content: space-between; margin: 0; padding: 4px var(--space-4) 10px; font-size: var(--text-xs); color: var(--color-text-3); }
    .sg-tot { font-weight: 700; color: var(--color-text-2); }
  `]
})
export class SalesGraphWidgetComponent extends Poller implements OnChanges {
  @Input() days = 7;
  readonly W = 600; readonly H = 190; readonly PL = 44; readonly PR = 12; readonly PT = 10; readonly PB = 20;
  readonly data = signal<SalesDaily | null>(null);
  readonly hidden = signal(new Set<string>());
  readonly visible = computed(() => (this.data()?.series ?? []).filter(s => !this.hidden().has(s.code)));
  readonly max = computed(() => Math.max(1, ...this.visible().flatMap(s => s.points.map(p => p.sales))) * 1.08);
  readonly grand = computed(() => this.visible().reduce((a, s) => a + s.total, 0));

  ngOnChanges(): void { if (!this.loading()) this.load(); }
  load(): void {
    this.http.get<SalesDaily>(`${this.api}/home/widgets/sales-daily`, { params: { days: String(this.days || 7) } }).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); this.failed.set(false); },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }
  colour(code: string): string { return SERIES_COLOURS[code] ?? '#64748b'; }
  toggleSeries(code: string): void { const s = new Set(this.hidden()); s.has(code) ? s.delete(code) : s.add(code); this.hidden.set(s); }
  x(i: number): number { const n = Math.max(1, (this.data()?.dates.length ?? 1) - 1); return this.PL + (i / n) * (this.W - this.PL - this.PR); }
  y(v: number): number { return this.PT + (1 - v / this.max()) * (this.H - this.PT - this.PB); }
  line(s: SalesSeries): string { return s.points.map((p, i) => `${i ? 'L' : 'M'}${this.x(i).toFixed(1)},${this.y(p.sales).toFixed(1)}`).join(' '); }
  area(s: SalesSeries): string {
    if (!s.points.length) return '';
    const base = this.y(0);
    return `${this.line(s)} L${this.x(s.points.length - 1).toFixed(1)},${base} L${this.x(0).toFixed(1)},${base} Z`;
  }
  gridLines(): { y: number; label: string }[] {
    const m = this.max();
    return [0, .5, 1].map(f => ({ y: this.y(m * f), label: f ? short(m * f) : '0' }));
  }
  money(v: number): string { return short(v); }
  full(v: number): string { return rand(v); }
}

// ── Sales vs stock ────────────────────────────────────────────────────────────

interface SalesVsStock {
  sales30: number; cost30: number; orders30: number; stockValue: number; stockItems: number; coverDays: number | null;
  companies: { code: string; name: string; sales: number; cost: number; orders: number }[];
  warehouses: { warehouseId: number; name: string; code?: string; items: number; qty: number; value: number }[];
}

@Component({
  selector: 'app-sales-vs-stock-widget',
  standalone: true,
  imports: [MatIconModule, MatTooltipModule, SkeletonRowsComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
    } @else if (failed() || !d()) {
      <app-empty-state compact icon="cloud_off" title="Couldn't load sales vs stock" message="Try again in a moment."></app-empty-state>
    } @else {
      <div class="ss-top">
        <div class="ss-kpi"><small>Sales · 30 days</small><b>{{ money(d()!.sales30) }}</b><span>{{ d()!.orders30 }} invoices</span></div>
        <mat-icon class="ss-vs">compare_arrows</mat-icon>
        <div class="ss-kpi"><small>Stock on hand</small><b>{{ money(d()!.stockValue) }}</b><span>{{ d()!.stockItems }} lines</span></div>
        <div class="ss-kpi cover" [matTooltip]="'Stock value ÷ average daily sales over the last 30 days'">
          <small>Stock cover</small><b>{{ d()!.coverDays === null ? '—' : d()!.coverDays + 'd' }}</b>
          <span>{{ coverNote() }}</span>
        </div>
      </div>
      <div class="ss-bars">
        <div class="ss-col">
          <h4>Sales by company</h4>
          @for (c of d()!.companies; track c.code) {
            <div class="ss-bar" [matTooltip]="full(c.sales) + ' · ' + c.orders + ' invoices'">
              <span class="ss-l">{{ c.name }}</span>
              <span class="ss-track"><i [style.width.%]="pct(c.sales, maxSales())" [style.background]="colour(c.code)"></i></span>
              <span class="ss-v">{{ money(c.sales) }}</span>
            </div>
          }
        </div>
        <div class="ss-col">
          <h4>Stock by warehouse</h4>
          @for (w of d()!.warehouses; track w.warehouseId) {
            <div class="ss-bar" [matTooltip]="full(w.value) + ' · ' + w.items + ' lines'">
              <span class="ss-l">{{ w.code || w.name }}</span>
              <span class="ss-track"><i [style.width.%]="pct(w.value, maxStock())"></i></span>
              <span class="ss-v">{{ money(w.value) }}</span>
            </div>
          } @empty { <p class="ss-none">No stock on hand recorded.</p> }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .ss-top { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-line); }
    .ss-kpi { flex: 1; display: grid; gap: 1px; }
    .ss-kpi small { font-size: var(--text-xs); color: var(--color-text-3); font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    .ss-kpi b { font-size: var(--text-xl); font-weight: 800; color: var(--color-text); font-variant-numeric: tabular-nums; }
    .ss-kpi span { font-size: var(--text-xs); color: var(--color-text-3); }
    .ss-kpi.cover b { color: var(--color-primary); }
    .ss-vs { color: var(--color-text-3); }
    .ss-bars { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); padding: var(--space-3) var(--space-4); }
    .ss-col h4 { margin: 0 0 6px; font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-3); }
    .ss-bar { display: grid; grid-template-columns: 76px 1fr auto; gap: 8px; align-items: center; padding: 3px 0; font-size: var(--text-xs); }
    .ss-l { font-weight: 650; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ss-track { height: 8px; border-radius: 4px; background: var(--color-surface-2); overflow: hidden; }
    .ss-track i { display: block; height: 100%; border-radius: 4px; background: var(--color-primary); min-width: 2px; }
    .ss-v { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text-2); }
    .ss-none { margin: 0; font-size: var(--text-xs); color: var(--color-text-3); }
    @media (max-width: 560px) { .ss-bars { grid-template-columns: 1fr; } }
  `]
})
export class SalesVsStockWidgetComponent extends Poller {
  readonly d = signal<SalesVsStock | null>(null);
  readonly maxSales = computed(() => Math.max(1, ...(this.d()?.companies.map(c => c.sales) ?? [1])));
  readonly maxStock = computed(() => Math.max(1, ...(this.d()?.warehouses.map(w => w.value) ?? [1])));
  load(): void {
    this.http.get<SalesVsStock>(`${this.api}/home/widgets/sales-vs-stock`).subscribe({
      next: d => { this.d.set(d); this.loading.set(false); this.failed.set(false); },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }
  pct(v: number, max: number): number { return Math.max(0, Math.min(100, (v / max) * 100)); }
  colour(code: string): string { return SERIES_COLOURS[code] ?? '#64748b'; }
  money(v: number): string { return short(v); }
  full(v: number): string { return rand(v); }
  coverNote(): string {
    const c = this.d()?.coverDays;
    if (c === null || c === undefined) return 'no sales yet';
    return c < 30 ? 'running low' : c > 180 ? 'heavy stock' : 'healthy';
  }
}

// ── Early / late birds ────────────────────────────────────────────────────────

interface Bird { employeeId: string; fullName: string; department: string; photoBase64: string | null; timeIn: string; isLate: boolean; lateMinutes: number }
interface BirdsFeed { hasEmployees: boolean; earlyBirds: Bird[]; lateBirds: Bird[]; totalCheckedIn?: number }

@Component({
  selector: 'app-birds-widget',
  standalone: true,
  imports: [MatIconModule, SkeletonRowsComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-skeleton-rows [rows]="take"></app-skeleton-rows>
    } @else if (failed()) {
      <app-empty-state compact icon="cloud_off" title="Couldn't load clock-ins" message="Try again in a moment."></app-empty-state>
    } @else {
      @for (b of birds(); track b.employeeId; let i = $index) {
        <div class="bd-row">
          <span class="bd-rank" [class.gold]="i === 0 && mode === 'early'">{{ i + 1 }}</span>
          @if (b.photoBase64) { <img class="bd-av" [src]="'data:image/jpeg;base64,' + b.photoBase64" alt=""> }
          @else { <span class="bd-av bd-ini">{{ initials(b.fullName) }}</span> }
          <span class="bd-t">{{ b.fullName }}<small>{{ b.department || 'Main office' }}</small></span>
          <span class="bd-time" [class.late]="b.isLate"><mat-icon>{{ mode === 'early' ? 'wb_twilight' : 'schedule' }}</mat-icon>{{ b.timeIn }}
            @if (b.isLate && mode === 'late') { <small>+{{ b.lateMinutes }}m</small> }
          </span>
        </div>
      } @empty {
        <app-empty-state compact [icon]="mode === 'early' ? 'wb_twilight' : 'schedule'" title="No clock-ins yet today" message="Clock-ins from the main office appear here as they happen."></app-empty-state>
      }
      @if (feed()?.totalCheckedIn) { <p class="bd-foot">{{ feed()!.totalCheckedIn }} clocked in at the main office today · work starts 07:30</p> }
    }
  `,
  styles: [`
    :host { display: block; }
    .bd-row { display: flex; align-items: center; gap: var(--space-3); padding: 9px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .bd-row:last-of-type { border-bottom: 0; }
    .bd-rank { width: 20px; font-size: var(--text-xs); font-weight: 800; color: var(--color-text-3); text-align: center; }
    .bd-rank.gold { color: #d97706; }
    .bd-av { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex: none; background: var(--color-surface-2); }
    .bd-ini { display: grid; place-items: center; font-size: var(--text-xs); font-weight: 800; color: var(--color-primary); background: var(--color-primary-soft); }
    .bd-t { flex: 1; min-width: 0; display: grid; font-size: var(--text-md); font-weight: 650; color: var(--color-text); }
    .bd-t small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bd-time { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; font-variant-numeric: tabular-nums; color: var(--color-ok); font-size: var(--text-md); }
    .bd-time mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .bd-time.late { color: var(--color-danger); }
    .bd-time small { font-size: var(--text-xs); font-weight: 700; opacity: .8; }
    .bd-foot { margin: 0; padding: 6px var(--space-4) 8px; font-size: var(--text-xs); color: var(--color-text-3); border-top: 1px solid var(--color-line); }
  `]
})
export class BirdsWidgetComponent extends Poller implements OnChanges {
  @Input() mode: 'early' | 'late' = 'early';
  @Input() size: WidgetSize = 'sm';
  readonly feed = signal<BirdsFeed | null>(null);
  get take(): number { return this.size === 'sm' ? 2 : this.size === 'md' ? 3 : 5; }
  readonly birds = computed(() => { const f = this.feed(); return (this.mode === 'early' ? f?.earlyBirds : f?.lateBirds) ?? []; });
  constructor() { super(); this.everyMs = 2 * 60_000; }
  ngOnChanges(): void { if (!this.loading()) this.load(); }
  load(): void {
    this.http.get<BirdsFeed>(`${this.api}/attendance/earliest-today`, { params: { take: String(this.take) } }).subscribe({
      next: f => { this.feed.set(f); this.loading.set(false); this.failed.set(false); },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }
  initials(n: string): string { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join(''); }
}
