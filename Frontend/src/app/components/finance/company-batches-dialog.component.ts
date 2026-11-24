import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { BatchRow, complianceKindsLabel } from '../../services/creditor-packs.service';

export interface CompanyBatchesData {
  code: string; name: string; logo: string | null; monogram: string; hue: number;
  rows: BatchRow[];
  typeTitle: (k: string) => string; badge: (s: string) => string; waitingOn: (r: BatchRow) => string; isSentBack: (s: string) => boolean;
}

/** All payment batches for one paying company. Closes with the batch id to open, or undefined. */
@Component({
  selector: 'app-company-batches-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
  <div class="cb">
    <header>
      <span class="mark">@if (d.logo) { <img [src]="d.logo" [alt]="d.name"> } @else { <span class="mono" [style.--hue]="d.hue">{{ d.monogram }}</span> }</span>
      <div class="nm"><h2>{{ d.name }}</h2><small>{{ d.code }} · {{ d.rows.length }} batch{{ d.rows.length === 1 ? '' : 'es' }} · {{ openCount }} open · R {{ openAmount | number:'1.2-2' }} outstanding</small></div>
      <button mat-icon-button mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>
    <div class="body">
      <table>
        <thead><tr><th>Batch</th><th>Payment type</th><th class="num">Amount</th><th>Stage</th><th>Waiting on</th><th></th></tr></thead>
        <tbody>
          @for (r of d.rows; track r.id) {
            <tr (click)="ref.close(r.id)" [class.back]="d.isSentBack(r.status)">
              <td><span class="ref">{{ r.batchNumber }}</span><br><small>{{ r.batchDate | date:'dd MMM yyyy' }} · {{ r.items }} payment{{ r.items === 1 ? '' : 's' }}</small></td>
              <td>{{ d.typeTitle(r.paymentType) }}@if (r.complianceKinds?.length) { <small> · {{ kinds(r) }}</small> }</td>
              <td class="num">R {{ r.totalAmount | number:'1.2-2' }}</td>
              <td>
                <span [class]="'badge ' + d.badge(r.status)">{{ r.statusTitle }}</span>
                @if (r.returnReason && d.isSentBack(r.status)) { <div class="reason">{{ r.returnReason }}</div> }
                @if (r.openPrepayments) { <div class="reason warn">{{ r.openPrepayments }} prepayment{{ r.openPrepayments === 1 ? '' : 's' }} awaiting invoice + GRV</div> }
              </td>
              <td class="who">{{ d.waitingOn(r) }}</td>
              <td class="go"><mat-icon>chevron_right</mat-icon></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  </div>
  `,
  styles: [`
    .cb { display: flex; flex-direction: column; max-height: 85vh; }
    header { display: flex; align-items: center; gap: 14px; padding: 14px 12px 14px 20px; border-bottom: 1px solid var(--color-line);
      .mark { width: 96px; height: 54px; flex: 0 0 auto; display: grid; place-items: center; background: #fff; border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; img { width: 100%; height: 100%; object-fit: contain; padding: 5px; box-sizing: border-box; } }
      .mono { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; font-size: var(--text-xl); letter-spacing: .06em; color: hsl(var(--hue) 45% 32%); background: linear-gradient(135deg, hsl(var(--hue) 55% 94%), hsl(var(--hue) 45% 86%)); }
      .nm { flex: 1; min-width: 0; h2 { margin: 0; font-size: var(--text-lg); } small { color: var(--color-text-3); font-size: var(--text-xs); } } }
    .body { overflow: auto; }
    table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 10px 16px; background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); position: sticky; top: 0; }
      td { padding: 10px 16px; border-bottom: 1px solid var(--color-line); font-size: var(--text-sm); vertical-align: top; small { color: var(--color-text-3); } }
      tbody tr { cursor: pointer; &:hover td { background: var(--color-surface-2); } &.back td:first-child { box-shadow: inset 3px 0 0 var(--color-danger); } }
      .ref { font-family: var(--font-mono); font-weight: 600; } .num { text-align: right; font-family: var(--font-mono); white-space: nowrap; } .who { color: var(--color-text-2); } .go { color: var(--color-text-3); text-align: right; }
      .reason { font-size: var(--text-xs); color: var(--color-danger); margin-top: 2px; max-width: 300px; &.warn { color: var(--color-warn); } } }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-surface-3); color: var(--color-text-2);
      &.ok { background: var(--color-ok-soft); color: var(--color-ok); } &.warn { background: var(--color-warn-soft); color: var(--color-warn); } &.bad { background: var(--color-danger-soft); color: var(--color-danger); } &.info { background: var(--color-primary-soft); color: var(--color-primary); } }
  `]
})
export class CompanyBatchesDialogComponent {
  d = inject<CompanyBatchesData>(MAT_DIALOG_DATA);
  ref = inject<MatDialogRef<CompanyBatchesDialogComponent, number | undefined>>(MatDialogRef);
  kinds(r: BatchRow) { return complianceKindsLabel(r.complianceKinds); }
  get openCount() { return this.d.rows.filter(r => r.status !== 'Closed').length; }
  get openAmount() { return this.d.rows.filter(r => r.status !== 'Closed').reduce((s, r) => s + (r.totalAmount || 0), 0); }
  static open(dialog: MatDialog, data: CompanyBatchesData) {
    return dialog.open<CompanyBatchesDialogComponent, CompanyBatchesData, number | undefined>(CompanyBatchesDialogComponent, { width: 'min(960px, 94vw)', maxWidth: '94vw', data, autoFocus: false });
  }
}
