import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast toast-{{ t.tone }}" role="status">
          <span>{{ t.text }}</span>
          <button type="button" class="x" (click)="toast.dismiss(t.id)" aria-label="Dismiss">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .toasts { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 50; display: flex; flex-direction: column; gap: 8px; max-width: min(420px, calc(100vw - 32px)); }
    .toast { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 8px; background: var(--ink); color: var(--paper); font-weight: 600; box-shadow: 0 6px 24px rgba(0,0,0,.18); border-left: 5px solid var(--sign); }
    .toast-warn { border-left-color: var(--marking); }
    .toast-error { border-left-color: var(--problem); }
    .toast span { flex: 1; }
    .x { background: none; border: 0; color: inherit; font-size: 20px; line-height: 1; cursor: pointer; padding: 0 2px; opacity: .8; }
  `,
})
export class App {
  protected readonly toast = inject(ToastService);
}
