import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

interface PumaOrder {
  id?: number;
  orderNumber: string;
  driverName?: string | null;
  vehicleType?: string | null;
  registration?: string | null;
  capacity?: number | null;
  litersFilled?: number | null;
  value?: number | null;
  date?: string | null;
  period?: string | null;
  notes?: string | null;
}

/**
 * Puma Garage (Bronkhorstspruit, GP) fuel fill-ups — an alternative fuel source
 * to TFN. Lists captured orders, supports paste-import of the monthly sheet,
 * plus add/delete of individual rows.
 */
@Component({
  selector: 'app-puma-garage-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatProgressSpinnerModule
  ],
  template: `
    <div class="puma-dialog">
      <div class="puma-header">
        <div class="puma-title">
          <div class="puma-logo"><mat-icon>local_gas_station</mat-icon></div>
          <div>
            <h2>Puma Garage</h2>
            <span class="puma-sub">Rocket Freight · Bronkhorstspruit, GP</span>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- KPI strip -->
      <div class="puma-kpis">
        <div class="puma-kpi">
          <span class="k-label">Orders</span>
          <span class="k-value">{{ orders.length }}</span>
        </div>
        <div class="puma-kpi">
          <span class="k-label">Litres Filled</span>
          <span class="k-value">{{ totalLitres() | number:'1.2-2' }} L</span>
        </div>
        <div class="puma-kpi">
          <span class="k-label">Total Value</span>
          <span class="k-value">R {{ totalValue() | number:'1.2-2' }}</span>
        </div>
        <div class="puma-kpi">
          <span class="k-label">Date Range</span>
          <span class="k-value sm">{{ dateRange() }}</span>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="puma-toolbar">
        <div class="puma-search">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="search" (ngModelChange)="applyFilter()"
                 placeholder="Search order, driver, registration, vehicle type…" />
        </div>
        <span class="spacer"></span>
        <button mat-stroked-button (click)="toggleImport()">
          <mat-icon>content_paste</mat-icon> {{ showImport ? 'Hide Import' : 'Import / Paste' }}
        </button>
        <button mat-stroked-button (click)="toggleAdd()">
          <mat-icon>add</mat-icon> Add Order
        </button>
        <button mat-icon-button (click)="reload()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
      </div>

      <!-- Import panel -->
      @if (showImport) {
        <div class="puma-import">
          <p class="hint">
            Paste rows straight from the Puma / Rocket Freight sheet
            (columns: <b>Order · Driver · Vehicle Type · Registration · Capacity · Litres · Value · Date</b>).
            Header and blank rows are ignored automatically.
          </p>
          <div class="import-row">
            <input class="period-input" type="text" [(ngModel)]="importPeriod"
                   placeholder="Period label (e.g. MARCH 2026)" />
          </div>
          <textarea [(ngModel)]="importText" rows="8"
                    placeholder="ROCF092&#9;SANDILE&#9;8 TON&#9;BJ87TBZN&#9;315&#9;182,25&#9;R3 790,85&#9;01.03.2026"></textarea>
          <div class="import-actions">
            <button mat-flat-button color="primary" [disabled]="importing || !importText.trim()" (click)="doImport()">
              @if (importing) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>upload</mat-icon> }
              Import Orders
            </button>
            <button mat-button (click)="importText=''">Clear</button>
          </div>
        </div>
      }

      <!-- Add panel -->
      @if (showAdd) {
        <div class="puma-add">
          <div class="add-grid">
            <input type="text" [(ngModel)]="newOrder.orderNumber" placeholder="Order # *" />
            <input type="text" [(ngModel)]="newOrder.driverName" placeholder="Driver" />
            <input type="text" [(ngModel)]="newOrder.vehicleType" placeholder="Vehicle Type" />
            <input type="text" [(ngModel)]="newOrder.registration" placeholder="Registration" />
            <input type="number" [(ngModel)]="newOrder.capacity" placeholder="Capacity" />
            <input type="number" [(ngModel)]="newOrder.litersFilled" placeholder="Litres" />
            <input type="number" [(ngModel)]="newOrder.value" placeholder="Value (R)" />
            <input type="date" [(ngModel)]="newOrder.date" />
          </div>
          <div class="import-actions">
            <button mat-flat-button color="primary" [disabled]="!newOrder.orderNumber.trim()" (click)="doAdd()">
              <mat-icon>save</mat-icon> Save Order
            </button>
            <button mat-button (click)="toggleAdd()">Cancel</button>
          </div>
        </div>
      }

      <!-- Table -->
      <div class="puma-table-wrap">
        @if (filtered.length === 0) {
          <div class="empty">
            <mat-icon>local_gas_station</mat-icon>
            <h3>No Puma Garage orders yet</h3>
            <p>Use “Import / Paste” to load a monthly sheet, or “Add Order” to capture one.</p>
          </div>
        } @else {
          <table class="puma-table">
            <thead>
              <tr>
                <th>Order #</th><th>Driver</th><th>Vehicle</th><th>Registration</th>
                <th class="r">Capacity</th><th class="r">Litres</th><th class="r">Value</th>
                <th>Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of filtered; track o.id) {
                <tr>
                  <td class="mono b">{{ o.orderNumber }}</td>
                  <td>{{ o.driverName || '—' }}</td>
                  <td>{{ o.vehicleType || '—' }}</td>
                  <td class="mono">{{ o.registration || '—' }}</td>
                  <td class="r">{{ o.capacity != null ? (o.capacity | number:'1.0-0') : '—' }}</td>
                  <td class="r">{{ o.litersFilled != null ? (o.litersFilled | number:'1.2-2') : '—' }}</td>
                  <td class="r b">{{ o.value != null ? ('R ' + (o.value | number:'1.2-2')) : '—' }}</td>
                  <td>{{ o.date ? (o.date | date:'dd MMM yyyy') : '—' }}</td>
                  <td class="r">
                    <button mat-icon-button color="warn" matTooltip="Delete" (click)="doDelete(o)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
  styles: [`
    .puma-dialog { display: flex; flex-direction: column; max-height: 88vh; }
    .puma-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid #eef0f4;
    }
    .puma-title { display: flex; align-items: center; gap: 14px; }
    .puma-logo {
      width: 46px; height: 46px; border-radius: 12px; display: grid; place-items: center;
      background: linear-gradient(135deg, #d32f2f, #ff6d00); color: #fff;
    }
    .puma-logo mat-icon { color: #fff; }
    .puma-title h2 { margin: 0; font-size: 20px; font-weight: 700; color: #1e293b; }
    .puma-sub { font-size: 12.5px; color: #64748b; }

    .puma-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px 20px 4px; }
    .puma-kpi {
      background: #f8fafc; border: 1px solid #eef0f4; border-radius: 12px;
      padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
    }
    .puma-kpi .k-label { font-size: 11.5px; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
    .puma-kpi .k-value { font-size: 19px; font-weight: 700; color: #0f172a; }
    .puma-kpi .k-value.sm { font-size: 13.5px; font-weight: 600; }

    .puma-toolbar { display: flex; align-items: center; gap: 10px; padding: 14px 20px; flex-wrap: wrap; }
    .puma-toolbar .spacer { flex: 1; }
    .puma-search {
      display: flex; align-items: center; gap: 8px; flex: 1 1 320px; min-width: 240px;
      background: #f1f5f9; border-radius: 10px; padding: 8px 12px;
    }
    .puma-search mat-icon { color: #94a3b8; font-size: 20px; width: 20px; height: 20px; }
    .puma-search input { border: none; background: transparent; outline: none; width: 100%; font-size: 14px; }

    .puma-import, .puma-add { margin: 0 20px 8px; padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; }
    .puma-import .hint { margin: 0 0 10px; font-size: 12.5px; color: #64748b; }
    .puma-import textarea, .period-input {
      width: 100%; border: 1px solid #d5dbe3; border-radius: 8px; padding: 10px 12px;
      font-family: 'Consolas', monospace; font-size: 12.5px; box-sizing: border-box;
    }
    .import-row { margin-bottom: 8px; }
    .period-input { font-family: inherit; max-width: 280px; }
    .import-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
    .import-actions mat-spinner { margin-right: 4px; }

    .add-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
    .add-grid input { border: 1px solid #d5dbe3; border-radius: 8px; padding: 9px 11px; font-size: 13px; box-sizing: border-box; }

    .puma-table-wrap { overflow: auto; padding: 4px 20px 20px; flex: 1; }
    .puma-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .puma-table thead th {
      position: sticky; top: 0; background: #f8fafc; z-index: 1; text-align: left;
      padding: 10px 12px; font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em;
      color: #64748b; border-bottom: 2px solid #eef0f4;
    }
    .puma-table tbody td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .puma-table tbody tr:hover { background: #f8fafc; }
    .puma-table .r { text-align: right; }
    .puma-table .b { font-weight: 700; }
    .puma-table .mono { font-family: 'Consolas', monospace; }

    .empty { text-align: center; padding: 48px 20px; color: #94a3b8; }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; }
    .empty h3 { margin: 12px 0 4px; color: #475569; }
    .empty p { margin: 0; font-size: 13px; }

    @media (max-width: 720px) {
      .puma-kpis, .add-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class PumaGarageDialog {
  orders: PumaOrder[] = [];
  filtered: PumaOrder[] = [];
  search = '';
  apiUrl = '';

  showImport = false;
  showAdd = false;
  importText = '';
  importPeriod = '';
  importing = false;

  newOrder: PumaOrder = { orderNumber: '' };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { orders: PumaOrder[]; apiUrl: string },
    private dialogRef: MatDialogRef<PumaGarageDialog>,
    private http: HttpClient,
    private snack: MatSnackBar
  ) {
    this.apiUrl = data.apiUrl;
    this.orders = [...(data.orders || [])];
    this.applyFilter();
    // Always refresh from the server so KPIs are current.
    this.reload();
  }

  private base() { return `${this.apiUrl}/logistics/pumagarageorders`; }

  reload(): void {
    this.http.get<PumaOrder[]>(this.base()).subscribe({
      next: (o) => { this.orders = o || []; this.applyFilter(); },
      error: () => { /* keep existing */ }
    });
  }

  applyFilter(): void {
    const t = this.search.trim().toLowerCase();
    this.filtered = !t ? [...this.orders] : this.orders.filter(o =>
      o.orderNumber?.toLowerCase().includes(t) ||
      o.driverName?.toLowerCase().includes(t) ||
      o.registration?.toLowerCase().includes(t) ||
      o.vehicleType?.toLowerCase().includes(t));
  }

  totalLitres(): number { return this.orders.reduce((s, o) => s + (o.litersFilled || 0), 0); }
  totalValue(): number { return this.orders.reduce((s, o) => s + (o.value || 0), 0); }
  dateRange(): string {
    const dates = this.orders.map(o => o.date).filter(Boolean).map(d => new Date(d as string)).sort((a, b) => +a - +b);
    if (dates.length === 0) return '—';
    const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    return dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])} → ${fmt(dates[dates.length - 1])}`;
  }

  toggleImport(): void { this.showImport = !this.showImport; if (this.showImport) this.showAdd = false; }
  toggleAdd(): void { this.showAdd = !this.showAdd; if (this.showAdd) this.showImport = false; if (!this.showAdd) this.newOrder = { orderNumber: '' }; }

  doImport(): void {
    if (!this.importText.trim()) return;
    this.importing = true;
    this.http.post<any>(`${this.base()}/import`, {
      text: this.importText, period: this.importPeriod?.trim() || null, overwrite: true
    }).subscribe({
      next: (res) => {
        this.importing = false;
        this.snack.open(
          `Imported ${res.imported} new, updated ${res.updated}, skipped ${res.skipped}.`,
          'Close', { duration: 4000 });
        this.importText = '';
        this.showImport = false;
        this.reload();
      },
      error: (err) => {
        this.importing = false;
        this.snack.open(err.error?.message || 'Import failed.', 'Close', { duration: 4000 });
      }
    });
  }

  doAdd(): void {
    if (!this.newOrder.orderNumber.trim()) return;
    this.http.post<PumaOrder>(this.base(), this.newOrder).subscribe({
      next: () => {
        this.snack.open('Order added.', 'Close', { duration: 2500 });
        this.newOrder = { orderNumber: '' };
        this.showAdd = false;
        this.reload();
      },
      error: (err) => this.snack.open(err.error?.message || 'Failed to add order.', 'Close', { duration: 3000 })
    });
  }

  doDelete(o: PumaOrder): void {
    if (!o.id) return;
    this.http.delete(`${this.base()}/${o.id}`).subscribe({
      next: () => { this.snack.open('Order deleted.', 'Close', { duration: 2000 }); this.reload(); },
      error: () => this.snack.open('Failed to delete order.', 'Close', { duration: 3000 })
    });
  }
}
