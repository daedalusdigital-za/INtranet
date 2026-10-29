import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, ConfirmOptions } from './confirm-dialog/confirm-dialog.component';
import { PromptDialogComponent, PromptField, PromptOptions, PromptResult } from './prompt-dialog/prompt-dialog.component';

/**
 * Asks the user to confirm an action with an in-app dialog (replaces window.confirm()).
 *
 *   if (!(await this.confirm.ask({
 *     title: `Delete trip sheet ${ts.number}?`,
 *     message: 'Its invoices go back to "To assign". This can\'t be undone.',
 *     confirmText: 'Delete trip sheet',
 *     danger: true,
 *   }))) return;
 *
 * Resolves true only when the confirm button is pressed; Esc, the backdrop and
 * the cancel button all resolve false.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: options,
      width: '460px',
      maxWidth: '94vw',
      autoFocus: 'dialog',
      restoreFocus: true,
      panelClass: 'confirm-dialog-panel'
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  /**
   * Asks for one piece of text (replaces window.prompt()). Resolves null when cancelled.
   *
   *   const reason = await this.confirm.askText({
   *     title: `Decline waybill ${w.number}?`, label: 'Reason', required: true,
   *     hint: 'Sent to the client', confirmText: 'Decline waybill', danger: true,
   *   });
   *   if (reason === null) return;
   */
  async askText(options: Omit<PromptOptions, 'fields'> & Omit<PromptField, 'key' | 'type' | 'options'> & { multiline?: boolean }): Promise<string | null> {
    const { label, value, required, placeholder, hint, multiline, ...rest } = options;
    const result = await this.askForm({
      ...rest,
      fields: [{ key: 'text', label, value, required, placeholder, hint, type: multiline ? 'textarea' : 'text' }]
    });
    return result ? String(result['text'] ?? '') : null;
  }

  /** Asks for several values at once, e.g. an item's description, quantity and price. Resolves null when cancelled. */
  async askForm(options: PromptOptions): Promise<PromptResult | null> {
    const ref = this.dialog.open(PromptDialogComponent, {
      data: options,
      width: '480px',
      maxWidth: '94vw',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      panelClass: 'confirm-dialog-panel'
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}
