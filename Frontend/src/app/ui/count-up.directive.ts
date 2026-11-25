import { Directive, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, inject } from '@angular/core';

/**
 * Counts a number up from 0 on first show (600 ms), then shows later changes straight away.
 * Works on pre-formatted text too: "R 1,842,000", "41 / 575", "94%" — the first number in the
 * text animates and the rest is kept. Respects reduced motion.
 *
 *   <span [countUp]="kpi.value"></span>
 */
@Directive({ selector: '[countUp]', standalone: true })
export class CountUpDirective implements OnChanges, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  @Input('countUp') value: string | number | null | undefined = null;
  @Input() countUpDuration = 600;
  private raf = 0;
  private played = false;

  ngOnChanges(_: SimpleChanges): void {
    const text = this.value == null ? '' : String(this.value);
    const m = text.match(/-?\d[\d,\s]*(?:\.\d+)?/);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.played || !m || reduce) { this.set(text); return; }
    const raw = m[0];
    const target = Number(raw.replace(/[,\s]/g, ''));
    if (!isFinite(target) || target === 0) { this.set(text); return; }
    this.played = true;
    const decimals = (raw.split('.')[1] ?? '').length;
    const usesComma = raw.includes(',');
    const usesSpace = /\d\s\d/.test(raw);
    const before = text.slice(0, m.index!);
    const after = text.slice(m.index! + raw.length);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / this.countUpDuration);
      const eased = 1 - Math.pow(1 - t, 3);
      let n = (target * eased).toFixed(decimals);
      if (usesComma || usesSpace) {
        const [i, d] = n.split('.');
        n = i.replace(/\B(?=(\d{3})+(?!\d))/g, usesComma ? ',' : ' ') + (d ? '.' + d : '');
      }
      this.set(before + n + after);
      if (t < 1) this.raf = requestAnimationFrame(step); else this.set(text);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(step);
  }

  private set(text: string): void { this.el.nativeElement.textContent = text; }

  ngOnDestroy(): void { cancelAnimationFrame(this.raf); }
}
