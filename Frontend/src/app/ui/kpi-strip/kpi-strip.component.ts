import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

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
}

/**
 * One strip of up to five key numbers (design review D-08). Each number links to the
 * list it counts, so the strip is a way in, not decoration.
 */
@Component({
  selector: 'app-kpi-strip',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="kpis" [style.--kpi-count]="items.length">
      @for (k of items; track k.label) {
        <div class="kpi" [class]="'kpi tone-' + (k.tone || 'default')">
          <span class="kpi-l">
            @if (k.icon) { <mat-icon aria-hidden="true">{{ k.icon }}</mat-icon> }
            {{ k.label }}
          </span>
          <span class="kpi-v">
            @if (k.value === null) { <span class="kpi-skel skeleton"></span> }
            @else { {{ k.value }}@if (k.unit) {<small>{{ k.unit }}</small>} }
          </span>
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
    .kpis { display: grid; grid-template-columns: repeat(var(--kpi-count, 4), minmax(0, 1fr)); background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); }
    .kpi { padding: 13px 16px 12px; display: grid; gap: 3px; align-content: start; min-width: 0; }
    .kpi + .kpi { border-left: 1px solid var(--color-line); }
    .kpi-l { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }
    .kpi-l mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }
    .kpi-v { font-size: var(--text-3xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; font-variant-numeric: tabular-nums; color: var(--color-text); }
    .kpi-v small { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-3); margin-left: 4px; letter-spacing: 0; }
    .tone-ok .kpi-v { color: var(--color-ok); }
    .tone-warn .kpi-v { color: var(--color-warn); }
    .tone-danger .kpi-v { color: var(--color-danger); }
    .kpi-note { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }
    .kpi-go { display: inline-flex; align-items: center; gap: 1px; width: fit-content; padding: 0; border: 0; background: none; font: 700 var(--text-xs) var(--font-body); color: var(--color-primary); text-decoration: none; cursor: pointer; }
    .kpi-go mat-icon { font-size: var(--text-md); width: 15px; height: 15px; }
    .kpi-skel { display: block; width: 48px; height: 24px; }
    @media (max-width: 760px) {
      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .kpi:nth-child(odd) { border-left: 0; }
      .kpi:nth-child(n+3) { border-top: 1px solid var(--color-line); }
    }
  `]
})
export class KpiStripComponent {
  @Input() items: KpiItem[] = [];
}
