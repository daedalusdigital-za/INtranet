import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { PACK_KINDS } from './pack-upload-dialog.component';

export interface PackEditData {
  id: number; packNumber: string; invoiceNumber: string; orderNumber?: string | null; customerNumber?: string | null; customerName?: string | null;
  company?: string | null; invoiceDate?: string | null; invoiceTotal?: number | null; notes?: string | null;
  contents: { deliveryNote: boolean; taxInvoice: boolean; orderConfirmation: boolean; orderEmail: boolean; orderForm: boolean };
}

/**
 * Edit the details of a pack that has already been saved (e.g. a batch pack that was committed
 * with the wrong invoice / order / customer, or with the wrong contents ticked).
 */
@Component({
  selector: 'app-pack-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
  <h2 mat-dialog-title><mat-icon>edit</mat-icon> Edit pack {{ data.packNumber }}</h2>
  <mat-dialog-content>
    <div class="grid">
      <label>Invoice number <input [(ngModel)]="m.invoiceNumber" placeholder="IN123456" class="mono" /></label>
      <label>Order number <input [(ngModel)]="m.orderNumber" placeholder="OR000190 / customer PO" class="mono" /></label>
      <label>Company
        <select [(ngModel)]="m.company">
          <option value="">—</option>
          @for (c of companies; track c) { <option [value]="c">{{ c }}</option> }
        </select>
      </label>
      <label>Invoice date <input type="date" [(ngModel)]="m.invoiceDate" /></label>
      <label>Customer number <input [(ngModel)]="m.customerNumber" class="mono" /></label>
      <label>Customer name <input [(ngModel)]="m.customerName" /></label>
      <label>Invoice total (R) <input type="number" step="0.01" [(ngModel)]="m.invoiceTotal" /></label>
      <label class="wide">Notes <textarea rows="2" [(ngModel)]="m.notes"></textarea></label>
    </div>
    <h4>Contents</h4>
    <div class="kinds">
      @for (k of kinds; track k.key) {
        <label class="kind" [class.on]="m.has[k.key]">
          <input type="checkbox" hidden [(ngModel)]="m.has[k.key]" />
          <mat-icon>{{ m.has[k.key] ? 'check_box' : 'check_box_outline_blank' }}</mat-icon> {{ k.label }}
        </label>
      }
    </div>
    <p class="hint"><mat-icon>info</mat-icon> Changing the invoice number re-checks the Sage sales history and re-runs the completeness status. The PDF itself is not changed — delete the pack and re-upload if the wrong pages were saved.</p>
  </mat-dialog-content>
  <mat-dialog-actions align="end">
    <button mat-button type="button" (click)="ref.close()" [disabled]="saving()">Cancel</button>
    <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="saving() || !m.invoiceNumber.trim()">
      @if (saving()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>save</mat-icon> Save changes }
    </button>
  </mat-dialog-actions>
  `,
  styles: [`
    h2 { display:flex; align-items:center; gap:8px; }
    .grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px 14px; }
    label { display:flex; flex-direction:column; gap:4px; font-size:.8rem; color: var(--color-text-muted); font-weight:600; &.wide { grid-column: 1 / -1; } }
    input, select, textarea { font: inherit; font-size:.92rem; color: var(--color-text); padding:8px 10px; border:1px solid var(--color-line); border-radius:8px; background: var(--color-surface); }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; }
    h4 { margin:16px 0 8px; font-size:.8rem; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-muted); }
    .kinds { display:flex; flex-wrap:wrap; gap:8px; }
    .kind { flex-direction:row; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; border:1px solid var(--color-line); background: var(--color-surface); font-size:.85rem; cursor:pointer;
      mat-icon { font-size:18px; width:18px; height:18px; } &.on { border-color:#10b981; background:#ecfdf5; color:#065f46; } }
    .hint { display:flex; gap:6px; align-items:flex-start; margin:14px 0 0; font-size:.8rem; color: var(--color-text-muted); mat-icon { font-size:16px; width:16px; height:16px; flex:0 0 auto; margin-top:1px; } }
    mat-dialog-actions button mat-spinner { display:inline-block; }
  `]
})
export class PackEditDialogComponent {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  ref = inject(MatDialogRef<PackEditDialogComponent>);
  data = inject<PackEditData>(MAT_DIALOG_DATA);
  kinds = PACK_KINDS;
  companies = ['PMT', 'ACM', 'PHT', 'SBT'];
  saving = signal(false);

  m = {
    invoiceNumber: this.data.invoiceNumber ?? '',
    orderNumber: this.data.orderNumber ?? '',
    company: this.data.company ?? '',
    invoiceDate: this.data.invoiceDate ? this.data.invoiceDate.substring(0, 10) : '',
    customerNumber: this.data.customerNumber ?? '',
    customerName: this.data.customerName ?? '',
    invoiceTotal: this.data.invoiceTotal ?? null as number | null,
    notes: this.data.notes ?? '',
    has: {
      DeliveryNote: !!this.data.contents?.deliveryNote, TaxInvoice: !!this.data.contents?.taxInvoice, OrderConfirmation: !!this.data.contents?.orderConfirmation,
      OrderEmail: !!this.data.contents?.orderEmail, OrderForm: !!this.data.contents?.orderForm,
    } as Record<string, boolean>,
  };

  static open(dialog: MatDialog, data: PackEditData) {
    return dialog.open(PackEditDialogComponent, { data, width: '640px', maxWidth: '96vw', autoFocus: false });
  }

  save(): void {
    const body: any = {
      invoiceNumber: this.m.invoiceNumber.trim(),
      orderNumber: this.m.orderNumber.trim(),
      customerNumber: this.m.customerNumber.trim(),
      customerName: this.m.customerName.trim(),
      notes: this.m.notes,
    };
    if (this.m.company) body.company = this.m.company;
    if (this.m.invoiceDate) body.invoiceDate = this.m.invoiceDate;
    if (this.m.invoiceTotal != null && this.m.invoiceTotal !== ('' as any)) body.invoiceTotal = Number(this.m.invoiceTotal);
    for (const k of this.kinds) body[`has${k.key}`] = !!this.m.has[k.key];

    this.saving.set(true);
    this.http.put(`${environment.apiUrl}/finance/packs/${this.data.id}`, body).subscribe({
      next: updated => { this.saving.set(false); this.toast.info(`Pack ${this.data.packNumber} updated.`); this.ref.close(updated); },
      error: e => { this.saving.set(false); this.toast.error(e?.error?.error || "Couldn't save the changes."); },
    });
  }
}
