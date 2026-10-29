import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BackOrderStockInfo } from './unmapped-products-dialog.component';
import { BackOrderItem } from './back-orders-data';

/**
 * Where is the stock for this back-order line? Lists each warehouse holding
 * the product with quantity on hand, and how much of the back-ordered
 * quantity each one could cover.
 */
@Component({
  selector: 'app-back-order-stock-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>warehouse</mat-icon>
      Stock locations
    </h2>
    <mat-dialog-content>
      <div class="item">
        <div class="code">{{ data.info.code }}</div>
        <div class="name">{{ data.info.commodityName }}</div>
        <div class="meta">
          Order <strong>{{ data.bo.orderNumber }}</strong> · {{ data.bo.customerName }}
          <span *ngIf="data.bo.poNo"> · PO {{ data.bo.poNo }}</span>
        </div>
      </div>

      <div class="summary" [class.full]="covered >= data.bo.qtyBackOrder" [class.partial]="covered < data.bo.qtyBackOrder">
        <div class="cell">
          <span class="lbl">Back ordered</span>
          <span class="val">{{ data.bo.qtyBackOrder | number:'1.0-0' }} <small>{{ data.bo.uom }}</small></span>
        </div>
        <div class="cell">
          <span class="lbl">On hand (all warehouses)</span>
          <span class="val">{{ data.info.onHand | number:'1.0-0' }}</span>
        </div>
        <div class="cell">
          <span class="lbl">{{ covered >= data.bo.qtyBackOrder ? 'Fully coverable' : 'Shortfall' }}</span>
          <span class="val">{{ (covered >= data.bo.qtyBackOrder ? data.bo.qtyBackOrder : data.bo.qtyBackOrder - covered) | number:'1.0-0' }}</span>
        </div>
      </div>

      <table class="wh" *ngIf="data.info.warehouses?.length; else none">
        <thead>
          <tr><th>Warehouse</th><th class="num">On hand</th><th class="num">Can cover</th><th class="bar"></th></tr>
        </thead>
        <tbody>
          @for (w of data.info.warehouses; track w.warehouseId) {
            <tr>
              <td><mat-icon inline>store</mat-icon> {{ w.name }}</td>
              <td class="num">{{ w.qty | number:'1.0-0' }}</td>
              <td class="num" [class.ok]="w.qty >= data.bo.qtyBackOrder">
                {{ (w.qty >= data.bo.qtyBackOrder ? data.bo.qtyBackOrder : w.qty) | number:'1.0-0' }}
                <small>({{ pct(w.qty) }}%)</small>
              </td>
              <td class="bar"><div class="track"><div class="fill" [style.width.%]="pct(w.qty)" [class.ok]="w.qty >= data.bo.qtyBackOrder"></div></div></td>
            </tr>
          }
        </tbody>
      </table>
      <ng-template #none>
        <div class="empty"><mat-icon>inventory_2</mat-icon> No warehouse currently holds this product.</div>
      </ng-template>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display:flex; align-items:center; gap:8px; }
    .item { margin-bottom:14px; }
    .code { font-family:monospace; font-weight:700; color:#37474f; }
    .name { font-size:1.05rem; font-weight:600; }
    .meta { color:var(--color-text-2); font-size:.85rem; margin-top:2px; }
    .summary { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; padding:12px; border-radius:8px; margin-bottom:14px; background:var(--color-surface-2); }
    .summary.full { background:var(--color-ok-soft); }
    .summary.partial { background:var(--color-warn-soft); }
    .cell { display:flex; flex-direction:column; }
    .lbl { font-size:.75rem; color:var(--color-text-2); text-transform:uppercase; letter-spacing:.3px; }
    .val { font-size:1.2rem; font-weight:700; }
    .val small { font-size:.75rem; font-weight:500; color:var(--color-text-3); }
    table.wh { width:100%; border-collapse:collapse; font-size:.9rem; }
    .wh th { text-align:left; padding:8px; border-bottom:2px solid var(--color-line); color:var(--color-text-2); font-weight:600; }
    .wh td { padding:8px; border-bottom:1px solid var(--color-line); vertical-align:middle; }
    .wh td mat-icon { vertical-align:-3px; margin-right:4px; color:#78909c; }
    .num { text-align:right; white-space:nowrap; }
    .num small { color:var(--color-text-3); }
    .num.ok { color:var(--color-ok); font-weight:600; }
    .bar { width:140px; }
    .track { height:8px; background:#eceff1; border-radius:4px; overflow:hidden; }
    .fill { height:100%; background:#ffb300; }
    .fill.ok { background:var(--color-ok); }
    .empty { display:flex; align-items:center; gap:8px; color:var(--color-text-3); padding:16px 0; }
    mat-dialog-content { min-width:520px; }
  `]
})
export class BackOrderStockDialog {
  covered: number;

  constructor(
    public ref: MatDialogRef<BackOrderStockDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { bo: BackOrderItem; info: BackOrderStockInfo }
  ) {
    this.covered = Math.max(0, data.info.onHand);
  }

  pct(qty: number): number {
    const need = this.data.bo.qtyBackOrder;
    if (!need || need <= 0) return 0;
    return Math.min(100, Math.round((qty / need) * 100));
  }
}
