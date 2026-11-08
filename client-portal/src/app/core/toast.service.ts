import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; text: string; tone: 'ok' | 'warn' | 'error'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private n = 0;

  show(text: string, tone: Toast['tone'] = 'ok', ms = 4500): void {
    const t = { id: ++this.n, text, tone };
    this.toasts.update(list => [...list, t]);
    setTimeout(() => this.dismiss(t.id), ms);
  }
  dismiss(id: number): void { this.toasts.update(list => list.filter(t => t.id !== id)); }
}
