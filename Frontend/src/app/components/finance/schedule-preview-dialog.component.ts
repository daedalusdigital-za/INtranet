import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GeneratedSchedule } from '../../services/creditor-packs.service';

export interface SchedulePreviewData { schedule: GeneratedSchedule; logo: string | null; onDownload: () => void; }

/** Print-style preview of the generated payment schedule — what the director signs and the bank user takes away. */
@Component({
  selector: 'app-schedule-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
  <div class="sp">
    <header class="sp__bar">
      <mat-icon>event_repeat</mat-icon><b>Payment schedule · {{ d.schedule.head.batchNumber }}</b>
      <span class="sp__spacer"></span>
      <button mat-icon-button (click)="print()" matTooltip="Print"><mat-icon>print</mat-icon></button>
      <button mat-icon-button (click)="d.onDownload()" matTooltip="Download Excel"><mat-icon>download</mat-icon></button>
      <button mat-icon-button mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>
    <div class="sp__page" id="schedule-print">
      <div class="doc">
        <div class="doc__head">
          @if (d.logo) { <img [src]="d.logo" alt=""> }
          <div class="doc__co"><h1>{{ d.schedule.head.company }}</h1><p>Payment schedule</p></div>
          <dl>
            <dt>Batch</dt><dd class="mono">{{ d.schedule.head.batchNumber }}</dd>
            <dt>Payment type</dt><dd>{{ d.schedule.head.paymentType }}</dd>
            <dt>Payment run</dt><dd>{{ d.schedule.head.paymentRunDate | date:'dd MMMM yyyy' }}</dd>
            <dt>Prepared by</dt><dd>{{ d.schedule.head.preparedBy }}</dd>
          </dl>
        </div>
        <table>
          <thead><tr><th>#</th><th>Supplier</th><th>Invoice date</th><th>Document number</th><th>Payable by</th><th class="num">Amount (R)</th></tr></thead>
          <tbody>
            @for (l of d.schedule.lines; track l.itemId) {
              <tr [class.rej]="l.decision === 'Rejected'">
                <td class="muted">{{ l.no }}</td>
                <td><strong>{{ l.supplier }}</strong>@if (l.description) { <br><small>{{ l.description }}</small> }@if (l.bank || l.accountNumber) { <br><small class="bank">{{ l.bank }} {{ l.accountNumber }}@if (l.branchCode) { · {{ l.branchCode }} }@if (l.reference) { · ref {{ l.reference }} }</small> }</td>
                <td>{{ l.invoiceDate ? (l.invoiceDate | date:'dd MMM yyyy') : '—' }}</td>
                <td class="mono">{{ l.documentNumber || '—' }}</td>
                <td>{{ l.payableBy | date:'dd MMM yyyy' }}</td>
                <td class="num">{{ l.amount | number:'1.2-2' }}</td>
              </tr>
            }
          </tbody>
          <tfoot><tr><td colspan="5">Total · {{ d.schedule.head.count }} payment{{ d.schedule.head.count === 1 ? '' : 's' }}</td><td class="num">R {{ d.schedule.head.total | number:'1.2-2' }}</td></tr></tfoot>
        </table>
        <div class="doc__sign">
          <div><span></span>Prepared</div><div><span></span>Accountant</div><div><span></span>Director</div>
        </div>
        <p class="doc__gen">Generated {{ d.schedule.head.generatedAt | date:'dd MMM yyyy HH:mm' }} from the payments in {{ d.schedule.head.batchNumber }}.</p>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .sp { display: flex; flex-direction: column; height: 90vh; }
    .sp__bar { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 16px; border-bottom: 1px solid var(--color-line); > mat-icon { color: var(--color-primary); } }
    .sp__spacer { flex: 1; }
    .sp__page { flex: 1; overflow: auto; background: var(--color-surface-2); padding: 24px; }
    .doc { background: #fff; color: #111; max-width: 960px; margin: 0 auto; padding: 36px 40px; box-shadow: 0 2px 12px rgba(0,0,0,.12); font-size: 13px; }
    .doc__head { display: flex; align-items: flex-start; gap: 20px; padding-bottom: 16px; border-bottom: 2px solid #111; margin-bottom: 18px;
      img { max-height: 56px; max-width: 160px; object-fit: contain; }
      .doc__co { flex: 1; h1 { margin: 0; font-size: 20px; } p { margin: 2px 0 0; color: #555; text-transform: uppercase; letter-spacing: .08em; font-size: 11px; } }
      dl { display: grid; grid-template-columns: auto auto; gap: 2px 12px; margin: 0; font-size: 12px; dt { color: #666; } dd { margin: 0; font-weight: 600; } } }
    table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #555; padding: 8px 8px; border-bottom: 1px solid #999; }
      td { padding: 8px; border-bottom: 1px solid #e3e3e3; vertical-align: top; small { color: #666; } .bank { color: #777; } }
      tr.rej td { text-decoration: line-through; color: #999; }
      tfoot td { font-weight: 700; border-top: 2px solid #111; border-bottom: 0; text-align: right; font-size: 14px; }
      .num { text-align: right; white-space: nowrap; } .muted { color: #888; } }
    .mono { font-family: var(--font-mono), ui-monospace, monospace; }
    .doc__sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; margin-top: 48px; div { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: .06em; span { display: block; border-bottom: 1px solid #111; height: 36px; margin-bottom: 6px; } } }
    .doc__gen { margin: 28px 0 0; font-size: 11px; color: #888; }
    @media print { .sp__bar { display: none; } .sp__page { padding: 0; background: #fff; } .doc { box-shadow: none; padding: 0; max-width: none; } }
  `]
})
export class SchedulePreviewDialogComponent {
  d = inject<SchedulePreviewData>(MAT_DIALOG_DATA);
  print(): void {
    const el = document.getElementById('schedule-print'); if (!el) return;
    const w = window.open('', '_blank', 'width=1000,height=800'); if (!w) return;
    const styles = Array.from(document.querySelectorAll('style')).map(s => s.outerHTML).join('');
    w.document.write(`<html><head><title>Payment schedule ${this.d.schedule.head.batchNumber}</title>${styles}<style>body{margin:0;background:#fff}.sp__page{padding:0!important;background:#fff!important}.doc{box-shadow:none!important;padding:24px!important}</style></head><body>${el.outerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 300);
  }
  static open(dialog: MatDialog, data: SchedulePreviewData) {
    return dialog.open(SchedulePreviewDialogComponent, { width: 'min(1100px, 96vw)', maxWidth: '96vw', data, autoFocus: false });
  }
}
