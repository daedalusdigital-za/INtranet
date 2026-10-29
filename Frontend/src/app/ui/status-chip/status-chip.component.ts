import { Component, Input, computed, input } from '@angular/core';

export type ChipTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

// One status language across modules (design review D-09). Words are matched loosely
// so "In Transit", "in-transit" and "IN_TRANSIT" read the same.
const TONES: Array<[RegExp, ChipTone]> = [
  [/(late|overdue|failed|rejected|declined|expired|out of stock|cancel|error|missing|negative|lost)/, 'danger'],
  [/(await|pending|partial|low|draft|waiting|review|sign.?off|on hold|due)/, 'warn'],
  [/(deliver|complet|approved|signed|active|in stock|paid|valid|done|online|awarded|closed)/, 'ok'],
  [/(transit|progress|open|sent|processing|loading|on the road|current)/, 'info'],
];

export function toneForStatus(status: string | null | undefined): ChipTone {
  const s = (status ?? '').toLowerCase().replace(/[_-]+/g, ' ');
  for (const [re, tone] of TONES) if (re.test(s)) return tone;
  return 'neutral';
}

/**
 * Status chip: a dot, a colour and a word, so colour is never the only signal.
 *   <app-status-chip status="In Transit" />          tone picked from the word
 *   <app-status-chip status="Needs sign-off" tone="warn" />
 */
@Component({
  selector: 'app-status-chip',
  standalone: true,
  template: `<span class="chip" [class]="'chip tone-' + resolvedTone()">{{ status() }}</span>`,
  styles: [`
    :host { display: inline-flex; }
    .chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; padding: 0 9px 0 8px; border-radius: 999px; font-size: var(--text-xs); font-weight: 700; white-space: nowrap; }
    .chip::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .tone-ok { background: var(--color-ok-soft); color: var(--color-ok); }
    .tone-warn { background: var(--color-warn-soft); color: var(--color-warn); }
    .tone-danger { background: var(--color-danger-soft); color: var(--color-danger); }
    .tone-info { background: var(--color-primary-soft); color: var(--color-primary); }
    .tone-neutral { background: var(--color-surface-2); color: var(--color-text-2); }
  `]
})
export class StatusChipComponent {
  readonly status = input<string>('');
  readonly tone = input<ChipTone | undefined>(undefined);
  readonly resolvedTone = computed(() => this.tone() ?? toneForStatus(this.status()));
}
