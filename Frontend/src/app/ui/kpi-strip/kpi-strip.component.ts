import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CountUpDirective } from '../count-up.directive';
import { SparklineComponent } from '../sparkline/sparkline.component';

export interface KpiItem {
  label: string;
  /** Pre-formatted value, e.g. "14" or "R 1,84 m". null shows a placeholder while loading. */
  value: string | number | null;
  /** Small text after the value, e.g. "of 71". */
  unit?: string;
  /** Line under the value. */
  note?: string;
  /** Colour the value by status. Only for status, never decoration. */
  tone?: 'default' | 'ok' | 'warn' | 'danger';
  /** Where the number leads: the filtered list it counts. */
  link?: { label: string; route: string; query?: Record<string, string> };
  /** Alternative to a route, e.g. open a dialog. */
  action?: { label: string; run: () => void };
  icon?: string;
  /** Recent values (e.g. last 7 days), drawn as a sparkline under the number. */
  trend?: number[];
}

/**
 * One strip of up to five key numbers (design review D-08). Each number links to the
 * list it counts, so the strip is a way in, not decoration.
 */
@Component({
  selector: 'app-kpi-strip',
  standalone: true,
  imports: [RouterLink, MatIconModule, CountUpDirective, SparklineComponent],
  template: `
    <div class="kpis" [style.--kpi-count]="items.length">
      @for (k of items; track k.label) {
        <div class="kpi" [class]="'kpi tone-' + (k.tone || 'default')">
          <span class="kpi-l">
            @if (k.icon) { <span class="kpi-ic" aria-hidden="true"><mat-icon>{{ k.icon }}</mat-icon></span> }
            {{ k.label }}
          </span>
          <span class="kpi-v">
            @if (k.value === null) { <span class="kpi-skel skeleton"></span> }
            @else { <span [countUp]="k.value"></span>@if (k.unit) {<small>{{ k.unit }}</small>} }
          </span>
          @if (k.trend?.length) { <app-sparkline class="kpi-spark" [values]="k.trend" /> }
          @if (k.link) {
            <a class="kpi-go" [routerLink]="k.link.route" [queryParams]="k.link.query ?? null">{{ k.link.label }}<mat-icon aria-hidden="true">chevron_right</mat-icon></a>
          } @else if (k.action) {
            <button type="button" class="kpi-go" (click)="k.action.run()">{{ k.action.label }}<mat-icon aria-hidden="true">chevron_right</mat-icon></button>
          } @else if (k.note) {
            <span class="kpi-note">{{ k.note }}</span>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    /* Visual refresh: separate cards, accent top border, big tabular numbers, faint tint at the bottom. */
    .kpis { display: grid; grid-template-columns: repeat(var(--kpi-count, 4), minmax(0, 1fr)); gap: 12px; }
    .kpi { position: relative; padding: 14px 16px 13px; display: grid; gap: 4px; align-content: start; min-width: 0;
      background: linear-gradient(180deg, var(--color-surface) 55%, color-mix(in srgb, var(--accent-soft) 70%, var(--color-surface)));
      border-top: 3px solid var(--accent); border-radius: var(--radius-card); box-shadow: var(--shadow-card);
      transition: transform var(--fast) var(--ease), box-shadow var(--fast) var(--ease);
      animation: refresh-rise-in 280ms var(--ease) both; }
    .kpi:nth-child(2) { animation-delay: 40ms; } .kpi:nth-child(3) { animation-delay: 80ms; }
    .kpi:nth-child(4) { animation-delay: 120ms; } .kpi:nth-child(5) { animation-delay: 160ms; }
    .kpi:hover { transform: translateY(-2px); box-shadow: var(--shadow-hover); }
    .tone-ok { border-top-color: var(--color-ok); } .tone-warn { border-top-color: var(--color-warn); } .tone-danger { border-top-color: var(--color-danger); }
    .kpi-l { display: flex; align-items: center; gap: 8px; font-size: calc(12px * var(--text-scale)); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-text-3); }
    .kpi-ic { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); }
    .kpi-ic mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .kpi-v { font-size: calc(32px * var(--text-scale)); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; font-variant-numeric: tabular-nums; color: var(--color-text); }
    .kpi-v small { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-3); margin-left: 4px; letter-spacing: 0; }
    .tone-ok .kpi-v { color: var(--color-ok); }
    .tone-warn .kpi-v { color: var(--color-warn); }
    .tone-danger .kpi-v { color: var(--color-danger); }
    .kpi-spark { margin: 2px 0 1px; }
    .kpi-note { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }
    .kpi-go { display: inline-flex; align-items: center; gap: 1px; width: fit-content; padding: 0; border: 0; background: none; font: 700 var(--text-xs) var(--font-body); color: var(--accent); text-decoration: none; cursor: pointer; }
    .kpi-go mat-icon { font-size: var(--text-md); width: 15px; height: 15px; }
    .kpi-skel { display: block; width: 56px; height: 30px; }
    @media (max-width: 760px) {
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `]
})
export class KpiStripComponent {
  @Input() items: KpiItem[] = [];
}
