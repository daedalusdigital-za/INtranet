import { Component, computed, input } from '@angular/core';

/**
 * Tiny trend line (e.g. the last 7 days) for under a KPI number. Draws in the module
 * accent unless a colour is given; a soft area fill sits under the line.
 *
 *   <app-sparkline [values]="[12, 15, 9, 20, 22, 18, 25]" />
 */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  template: `
    @if (path()) {
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" aria-hidden="true">
        <path class="area" [attr.d]="area()" />
        <path class="line" [attr.d]="path()" [attr.stroke]="color() || null" />
        <circle class="end" [attr.cx]="end().x" [attr.cy]="end().y" r="2.2" [attr.fill]="color() || null" />
      </svg>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 26px; color: var(--accent); }
    svg { display: block; width: 100%; height: 100%; overflow: visible; }
    .line { fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
    .area { fill: currentColor; opacity: 0.1; }
    .end { fill: currentColor; }
  `]
})
export class SparklineComponent {
  readonly values = input<number[] | null | undefined>([]);
  readonly color = input<string>('');
  readonly w = 100;
  readonly h = 26;

  private readonly points = computed(() => {
    const v = (this.values() ?? []).filter(n => typeof n === 'number' && isFinite(n));
    if (v.length < 2) return [];
    const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
    return v.map((n, i) => ({ x: (i / (v.length - 1)) * this.w, y: this.h - 2 - ((n - min) / span) * (this.h - 4) }));
  });
  readonly path = computed(() => this.points().map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  readonly area = computed(() => { const p = this.points(); return p.length ? `${this.path()} L${this.w},${this.h} L0,${this.h} Z` : ''; });
  readonly end = computed(() => this.points().at(-1) ?? { x: 0, y: 0 });
}
