import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface ToastOptions {
  /** Button label, e.g. "Undo". */
  action?: string;
  /** Called when the action button is pressed. */
  onAction?: () => void;
  /** Milliseconds; defaults depend on the kind. */
  duration?: number;
}

/**
 * One way to tell people what happened (design review D-10). Replaces window.alert()
 * and ad-hoc snackbars: done / info / warning / error, each with a sensible duration,
 * and an optional action such as Undo.
 *
 *   this.toast.done(`Load ${load.number} marked as delivered.`, { action: 'Undo', onAction: () => this.undo(load) });
 *   this.toast.error('The POD could not be uploaded. Check the file is a PDF or photo and try again.');
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  done(message: string, options: ToastOptions = {}): void {
    this.show(message, 'toast-done', 4000, options);
  }

  info(message: string, options: ToastOptions = {}): void {
    this.show(message, 'toast-info', 5000, options);
  }

  warn(message: string, options: ToastOptions = {}): void {
    this.show(message, 'toast-warn', 7000, options);
  }

  /** Errors stay until dismissed when they need reading; pass a duration to auto-close. */
  error(message: string, options: ToastOptions = {}): void {
    this.show(message, 'toast-error', 9000, { action: 'Dismiss', ...options });
  }

  private show(message: string, panelClass: string, defaultDuration: number, options: ToastOptions): void {
    const ref = this.snackBar.open(message, options.action, {
      duration: options.duration ?? defaultDuration,
      panelClass: ['app-toast', panelClass],
      horizontalPosition: 'center',
      verticalPosition: 'bottom'
    });
    if (options.onAction) {
      ref.onAction().subscribe(() => options.onAction!());
    }
  }
}
