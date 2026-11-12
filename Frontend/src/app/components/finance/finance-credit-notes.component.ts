import { Component, HostListener, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { companyLogo, companyName } from '../../core/company-logos';

interface Doc { id: number; creditNoteNumber: string; company?: string; companyName: string; customerNumber?: string; customerName?: string; invoiceNumbers?: string; amount?: number; reason?: string; notes?: string; signedBy?: string; signedOn?: string; originalFileName?: string; contentType?: string; size: number; uploadedByName?: string; uploadedAt: string; isPdf: boolean; }
interface DocRow { doc: Doc; inSage: boolean; sageValue?: number; sageCustomer?: string; sageCompany?: string; sageDate?: string; amountMismatch: boolean; }
interface InvMatch { number: string; date: string; daysBefore: number; overlapProducts: number; totalProductsOnCredit: number; confidence: number; total: number; lines: number; overlapValue: number; stillOpen?: number; hasPod: boolean; loadId?: number; lines_?: { productCode: string; productDescription?: string; quantity: number; salesAmount: number; credited: boolean }[]; }
interface Cn {
  number: string; companyCode: string; company: string; customerNumber: string; customerName: string; date: string; lines: number; products: number; qty: number; value: number;
  status: 'Open' | 'Applied'; openBalance: number; openAgeDays?: number; orderNumber?: string; hasSignedCopy: boolean; documents: number; signedBy?: string; reason?: string; invoices: InvMatch[];
}
interface Detail {
  number: string; companyCode?: string; company: string; customerNumber?: string; customerName?: string; date?: string; value: number; cost: number; status: string; openBalance: number; openAgeDays?: number; orderNumber?: string; agingAsOf?: string; hasSignedCopy: boolean;
  lines: { id: number; productCode?: string; productDescription?: string; brand?: string; qty: number; value: number; cost: number }[];
  invoices: InvMatch[]; documents: Doc[];
  remittances: { id: number; subject?: string; fromEmail?: string; receivedAt: string; customerName?: string; totalAmount?: number; status: string }[];
  customerHistory?: { number: string; date: string; value: number; lines: number }[];
  stockReturn?: { id: number; returnType: string; status: string; warehouseId?: number; confirmedAt?: string; confirmedByName?: string; lines: number; qty: number } | null;
  reason?: string | null; customerMasterId?: number | null; customerMasterName?: string | null;
}
interface RetLine { id: number; productCode: string; productDescription?: string; quantity: number; confirmedQuantity?: number; commodityId?: number; movementId?: number; matched: boolean; }
interface StockRet { id: number; creditNoteNumber: string; company: string; customerNumber?: string; customerName?: string; returnType: string; status: string; warehouseId?: number; warehouse?: string; notes?: string; createdByName?: string; createdAt: string; confirmedByName?: string; confirmedAt?: string; lines: RetLine[]; totalQty: number; }
interface Summary {
  totalDocs: number; totalValue: number; thisMonth: { docs: number; value: number }; last30: { docs: number; value: number }; signedDocs: number; unsignedDocs: number; uploadedDocuments: number;
  open: { docs: number; value: number };
  byCompany: { code: string; name: string; docs: number; lines: number; value: number; first: string; last: string; salesValue: number; creditPct: number; open: number; openValue: number }[];
  topCustomers: { customerNumber: string; customerName: string; company: string; docs: number; value: number }[];
  topProducts: { productCode: string; productDescription?: string; qty: number; value: number; docs: number }[];
  trend: { month: string; docs: number; value: number }[];
}

@Component({
  selector: 'app-finance-credit-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <!-- ── Summary ───────────────────────────────────────────────── -->
    @if (summary(); as s) {
      <div class="cn-kpis">
        <div class="cn-kpi">
          <span class="k">Credited (all time in history)</span>
          <b>{{ s.totalValue | currency:'ZAR':'R':'1.0-0' }}</b>
          <small>{{ s.totalDocs }} credit notes across {{ s.byCompany.length }} companies</small>
        </div>
        <div class="cn-kpi">
          <span class="k">Last 30 days</span>
          <b>{{ s.last30.value | currency:'ZAR':'R':'1.0-0' }}</b>
          <small>{{ s.last30.docs }} credit notes · {{ s.thisMonth.docs }} this month</small>
        </div>
        <div class="cn-kpi" [class.warn]="s.open.docs > 0">
          <span class="k">Unapplied on debtor accounts</span>
          <b>{{ s.open.value | currency:'ZAR':'R':'1.0-0' }}</b>
          <small>{{ s.open.docs }} still sitting as CR on the latest aging</small>
        </div>
        <div class="cn-kpi" [class.bad]="s.unsignedDocs > 0" [class.ok]="s.unsignedDocs === 0">
          <span class="k">Without a signed copy</span>
          <b>{{ s.unsignedDocs }}</b>
          <small>{{ s.signedDocs }} have an uploaded signed PDF · {{ s.uploadedDocuments }} files</small>
        </div>
      </div>

      <div class="cn-companies">
        <button class="cn-co all" [class.active]="company() === 'ALL'" (click)="company.set('ALL'); page.set(1); load()">
          <span class="cn-logo all-logo"><mat-icon>apps</mat-icon></span>
          <div class="cn-co-body">
            <div class="cn-co-top"><b>All companies</b><span>{{ s.totalValue | currency:'ZAR':'R':'1.0-0' }}</span></div>
            <div class="cn-co-foot"><span>{{ s.totalDocs }} notes</span></div>
          </div>
        </button>
        @for (c of s.byCompany; track c.code) {
          <button class="cn-co" [class.active]="company() === c.code" [class.dim]="company() !== 'ALL' && company() !== c.code" (click)="company.set(company() === c.code ? 'ALL' : c.code); page.set(1); load()" [attr.aria-pressed]="company() === c.code">
            <img class="cn-logo" [src]="logo(c.code)" [alt]="c.name">
            <div class="cn-co-body">
              <div class="cn-co-top"><b>{{ c.name }}</b><span>{{ c.value | currency:'ZAR':'R':'1.0-0' }}</span></div>
              <div class="cn-co-bar"><i [style.width.%]="barPct(c.value, s.totalValue)"></i></div>
              <div class="cn-co-foot">
                <span>{{ c.docs }} notes</span>
                <span matTooltip="Credits as a percentage of invoiced sales in the same history">{{ c.creditPct }}% of sales</span>
                @if (c.open > 0) { <span class="warn">{{ c.open }} unapplied · {{ c.openValue | currency:'ZAR':'R':'1.0-0' }}</span> }
              </div>
            </div>
          </button>
        }
      </div>
    }

    <!-- ── Sub-tabs ──────────────────────────────────────────────── -->
    <div class="cn-subtabs">
      <button [class.active]="view() === 'list'" (click)="view.set('list')"><mat-icon>receipt_long</mat-icon> Credit notes</button>
      <button [class.active]="view() === 'docs'" (click)="view.set('docs'); loadDocs()"><mat-icon>draw</mat-icon> Signed copies <span class="n">{{ summary()?.uploadedDocuments ?? 0 }}</span></button>
      <button [class.active]="view() === 'returns'" (click)="view.set('returns'); loadReturns()"><mat-icon>assignment_return</mat-icon> Stock returns @if (pendingReturns() > 0) { <span class="n warn-n">{{ pendingReturns() }}</span> }</button>
      <button [class.active]="view() === 'insight'" (click)="view.set('insight')"><mat-icon>insights</mat-icon> Patterns</button>
      <span class="sp"></span>
      <button mat-flat-button color="primary" (click)="openUpload()"><mat-icon>upload_file</mat-icon> Upload signed credit note</button>
    </div>

    <!-- ── LIST ──────────────────────────────────────────────────── -->
    @if (view() === 'list') {
      <div class="cn-toolbar">
        <div class="cn-chips">
          @for (f of filters; track f.key) {
            <button class="chip" [class.active]="status() === f.key" (click)="status.set(f.key); page.set(1); load()">{{ f.label }}</button>
          }
        </div>
        <input class="cn-search" type="search" placeholder="CN number, customer, product code or description…" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="page.set(1); load()" />
        <input class="cn-date" type="date" [ngModel]="from()" (ngModelChange)="from.set($event); page.set(1); load()" matTooltip="From" />
        <input class="cn-date" type="date" [ngModel]="to()" (ngModelChange)="to.set($event); page.set(1); load()" matTooltip="To" />
        @if (search() || from() || to() || status() !== 'all' || company() !== 'ALL') {
          <button mat-icon-button (click)="clear()" matTooltip="Clear filters"><mat-icon>filter_alt_off</mat-icon></button>
        }
      </div>

      @if (loading()) { <div class="cn-center"><mat-spinner diameter="36"></mat-spinner></div> }
      @else if (items().length === 0) {
        <div class="cn-empty"><mat-icon>search_off</mat-icon><p>No credit notes match. The list is built from the Sage sales history import — if a recent credit is missing, re-import the sales history.</p></div>
      } @else {
        <div class="cn-resultline">{{ total() }} credit notes · {{ totalValue() | currency:'ZAR':'R':'1.0-0' }}</div>
        <div class="cn-tablewrap">
          <table class="cn-table">
            <thead><tr>
              <th>Credit note</th><th>Date</th><th>Company</th><th>Customer</th><th class="r">Value</th><th>Lines</th><th>Reverses invoice</th><th>On account</th><th>Signed copy</th>
            </tr></thead>
            <tbody>
              @for (c of items(); track c.number) {
                <tr (click)="open(c.number, c.companyCode)" [class.sel]="detail()?.number === c.number && detail()?.companyCode === c.companyCode">
                  <td class="mono"><b>{{ c.number }}</b>@if (c.reason) { <small class="reason">{{ c.reason }}</small> }</td>
                  <td>{{ c.date | date:'dd MMM yyyy' }}</td>
                  <td><img class="row-logo" [src]="logo(c.companyCode)" [alt]="c.company" [matTooltip]="c.company"></td>
                  <td class="cust"><span>{{ c.customerName }}</span><small>{{ c.customerNumber }}</small></td>
                  <td class="r mono"><b>{{ c.value | currency:'ZAR':'R':'1.2-2' }}</b></td>
                  <td>{{ c.lines }}<small> / {{ c.products }} prod</small></td>
                  <td>
                    @if (c.invoices.length) {
                      <span class="inv" [matTooltip]="'Same customer & products · ' + c.invoices[0].daysBefore + ' days before · confidence ' + (c.invoices[0].confidence * 100 | number:'1.0-0') + '%'">
                        <mat-icon>{{ c.invoices[0].confidence >= 0.8 ? 'link' : 'link_off' }}</mat-icon>{{ c.invoices[0].number }}
                        @if (c.invoices.length > 1) { <small>+{{ c.invoices.length - 1 }}</small> }
                      </span>
                    } @else { <span class="muted">—</span> }
                  </td>
                  <td>
                    @if (c.status === 'Open') { <span class="st open" matTooltip="Still unapplied on the debtor's aging — credit hasn't been offset against an invoice yet">Unapplied {{ c.openAgeDays }}d</span> }
                    @else { <span class="st applied">Applied</span> }
                  </td>
                  <td>
                    @if (c.hasSignedCopy) { <span class="st signed" [matTooltip]="'Signed by ' + (c.signedBy || 'unknown')"><mat-icon>verified</mat-icon> {{ c.documents }}</span> }
                    @else { <button class="st missing" (click)="$event.stopPropagation(); openUpload(c)" matTooltip="No signed authorisation uploaded — click to upload"><mat-icon>warning_amber</mat-icon> Missing</button> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (total() > pageSize) {
          <div class="cn-pager">
            <button mat-stroked-button [disabled]="page() === 1" (click)="page.set(page() - 1); load()">Previous</button>
            <span>Page {{ page() }} of {{ pages() }}</span>
            <button mat-stroked-button [disabled]="page() >= pages()" (click)="page.set(page() + 1); load()">Next</button>
          </div>
        }
      }
    }

    <!-- ── SIGNED COPIES ─────────────────────────────────────────── -->
    @if (view() === 'docs') {
      <div class="cn-toolbar">
        <input class="cn-search" type="search" placeholder="CN number, customer, signed by, invoice, file name…" [ngModel]="docSearch()" (ngModelChange)="docSearch.set($event)" (keyup.enter)="loadDocs()" />
        <label class="cn-check"><input type="checkbox" [ngModel]="docsUnmatched()" (ngModelChange)="docsUnmatched.set($event); loadDocs()" /> Only ones not found in Sage</label>
      </div>
      @if (docsLoading()) { <div class="cn-center"><mat-spinner diameter="36"></mat-spinner></div> }
      @else if (docs().length === 0) {
        <div class="cn-empty"><mat-icon>draw</mat-icon><p>No signed credit notes uploaded yet. Managers upload the signed PDF here (or from the Missing button on a credit note).</p></div>
      } @else {
        <div class="cn-tablewrap">
          <table class="cn-table">
            <thead><tr><th>Credit note</th><th>Customer</th><th class="r">Amount</th><th>Reason</th><th>Signed by</th><th>Uploaded</th><th>Sage</th><th></th></tr></thead>
            <tbody>
              @for (r of docs(); track r.doc.id) {
                <tr>
                  <td class="mono"><b>{{ r.doc.creditNoteNumber }}</b><small>{{ r.doc.companyName }}</small></td>
                  <td class="cust"><span>{{ r.doc.customerName || r.sageCustomer || '—' }}</span>@if (r.doc.invoiceNumbers) { <small>Inv {{ r.doc.invoiceNumbers }}</small> }</td>
                  <td class="r mono">{{ (r.doc.amount ?? r.sageValue) | currency:'ZAR':'R':'1.2-2' }}
                    @if (r.amountMismatch) { <small class="bad" [matTooltip]="'Sage shows ' + (r.sageValue | currency:'ZAR':'R':'1.2-2')">≠ Sage</small> }</td>
                  <td>{{ r.doc.reason || '—' }}</td>
                  <td>{{ r.doc.signedBy || '—' }}@if (r.doc.signedOn) { <small>{{ r.doc.signedOn | date:'dd MMM yyyy' }}</small> }</td>
                  <td>{{ r.doc.uploadedAt | date:'dd MMM HH:mm' }}<small>{{ r.doc.uploadedByName }}</small></td>
                  <td>@if (r.inSage) { <span class="st applied">In history</span> } @else { <span class="st open" matTooltip="Not in the imported sales history yet — will link when the next import includes it">Not yet</span> }</td>
                  <td class="acts">
                    <button mat-icon-button (click)="viewFile(r.doc)" matTooltip="View"><mat-icon>visibility</mat-icon></button>
                    <button mat-icon-button (click)="download(r.doc)" matTooltip="Download"><mat-icon>download</mat-icon></button>
                    @if (r.inSage) { <button mat-icon-button (click)="open(r.doc.creditNoteNumber, r.doc.company)" matTooltip="Open credit note"><mat-icon>open_in_new</mat-icon></button> }
                    <button mat-icon-button (click)="remove(r.doc)" matTooltip="Delete"><mat-icon>delete_outline</mat-icon></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    <!-- ── PATTERNS ──────────────────────────────────────────────── -->
    @if (view() === 'insight') { @if (summary(); as s) {
      <div class="cn-insight">
        <div class="cn-card">
          <h3><mat-icon>trending_up</mat-icon> Monthly credits</h3>
          <div class="cn-trend">
            @for (m of s.trend; track m.month) {
              <div class="bar" [matTooltip]="m.month + ' · ' + m.docs + ' notes · ' + (m.value | currency:'ZAR':'R':'1.0-0')">
                <i [style.height.%]="barPct(m.value, maxTrend(s))"></i><span>{{ m.month.slice(5) }}</span>
              </div>
            }
          </div>
        </div>
        <div class="cn-card">
          <h3><mat-icon>groups</mat-icon> Most credited customers</h3>
          <table class="cn-mini"><tbody>
            @for (c of s.topCustomers; track c.customerNumber + c.company) {
              <tr (click)="search.set(c.customerNumber); view.set('list'); page.set(1); load()"><td><b>{{ c.customerName }}</b><small>{{ c.company }} · {{ c.docs }} notes</small></td><td class="r mono">{{ c.value | currency:'ZAR':'R':'1.0-0' }}</td></tr>
            }
          </tbody></table>
        </div>
        <div class="cn-card">
          <h3><mat-icon>inventory_2</mat-icon> Most credited products</h3>
          <table class="cn-mini"><tbody>
            @for (p of s.topProducts; track p.productCode) {
              <tr (click)="search.set(p.productCode); view.set('list'); page.set(1); load()"><td><b>{{ p.productDescription || p.productCode }}</b><small>{{ p.productCode }} · {{ p.qty | number:'1.0-0' }} units · {{ p.docs }} notes</small></td><td class="r mono">{{ p.value | currency:'ZAR':'R':'1.0-0' }}</td></tr>
            }
          </tbody></table>
        </div>
      </div>
    } }

    <!-- ── STOCK RETURNS ─────────────────────────────────────────── -->
    @if (view() === 'returns') {
      <div class="cn-toolbar">
        <div class="cn-chips">
          @for (f of returnFilters; track f) { <button class="chip" [class.active]="retStatus() === f" (click)="retStatus.set(f); loadReturns()">{{ f }}</button> }
        </div>
        <span class="muted">A credit reasoned <b>Return</b>, <b>Damaged</b> or <b>Expired</b> raises a return here. The branch confirms what came back and where — that confirmation posts the stock ledger movement.</span>
      </div>
      @if (retLoading()) { <div class="cn-center"><mat-spinner diameter="36"></mat-spinner></div> }
      @else if (returns().length === 0) { <div class="cn-empty"><mat-icon>inventory</mat-icon><p>No {{ retStatus() === 'All' ? '' : retStatus().toLowerCase() }} stock returns. Set the reason on a credit note's signed copy to Return / Damaged / Expired to raise one.</p></div> }
      @else {
        <div class="cn-tablewrap">
          <table class="cn-table">
            <thead><tr><th>Credit note</th><th>Company</th><th>Customer</th><th>Type</th><th class="r">Lines</th><th class="r">Qty</th><th>Status</th><th>Raised</th><th></th></tr></thead>
            <tbody>
              @for (r of returns(); track r.id) {
                <tr (click)="openReturn(r)">
                  <td class="mono"><b>{{ r.creditNoteNumber }}</b></td>
                  <td><img class="row-logo" [src]="logo(r.company)" [alt]="coName(r.company)" [matTooltip]="coName(r.company)"></td>
                  <td class="cust"><span [title]="r.customerName">{{ r.customerName }}</span></td>
                  <td><span class="st" [class.open]="r.returnType !== 'Return'" [class.applied]="r.returnType === 'Return'">{{ r.returnType }}</span></td>
                  <td class="r">{{ r.lines.length }}</td><td class="r mono">{{ r.totalQty | number:'1.0-2' }}</td>
                  <td><span class="st" [class.missing]="r.status === 'Pending'" [class.signed]="r.status === 'Confirmed'" [class.neutral]="r.status === 'Rejected'">{{ r.status }}@if (r.warehouse) { · {{ r.warehouse }} }</span></td>
                  <td>{{ r.createdAt | date:'dd MMM yy' }}<small>{{ r.createdByName }}</small></td>
                  <td class="acts">@if (r.status === 'Pending') { <button mat-stroked-button (click)="openReturn(r); $event.stopPropagation()">Confirm…</button> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }

    <!-- ── RETURN CONFIRM PANEL ──────────────────────────────────── -->
    @if (retOpen(); as r) {
      <div class="cn-backdrop top" (click)="retOpen.set(null)"></div>
      <div class="cn-upload">
        <header><mat-icon>assignment_return</mat-icon><h3>{{ r.returnType }} on {{ r.creditNoteNumber }} <small style="display:inline">{{ r.company }} · {{ r.customerName }}</small></h3><span class="sp"></span><button mat-icon-button (click)="retOpen.set(null)"><mat-icon>close</mat-icon></button></header>
        @if (r.status === 'Pending') {
          <p class="hint">Confirm what physically came back. <b>Return</b> puts the quantity back into the warehouse; <b>Damaged / Expired</b> records the goods in and straight out as a write-off so the ledger shows them against this credit.</p>
          <label class="full" style="display:block;margin-bottom:10px">Warehouse the goods came back to *
            <select [(ngModel)]="retWarehouse" style="width:100%"><option [ngValue]="null">Choose…</option>@for (w of retWarehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}@if (w.province) { · {{ w.province }} }</option> }</select>
          </label>
        } @else {
          <p class="hint">{{ r.status }} by {{ r.confirmedByName }} on {{ r.confirmedAt | date:'dd MMM yyyy HH:mm' }}@if (r.warehouse) { · {{ r.warehouse }} }</p>
        }
        <table class="cn-lines"><thead><tr><th>Product</th><th class="r">On credit</th><th class="r">Confirmed</th><th>Stock item</th></tr></thead><tbody>
          @for (l of r.lines; track l.id) {
            <tr>
              <td><b>{{ l.productDescription || l.productCode }}</b><small>{{ l.productCode }}</small></td>
              <td class="r mono">{{ l.quantity | number:'1.0-2' }}</td>
              <td class="r">@if (r.status === 'Pending') { <input type="number" step="any" style="width:90px;text-align:right" [(ngModel)]="retQty[l.id]" /> } @else { <span class="mono">{{ l.confirmedQuantity ?? l.quantity | number:'1.0-2' }}</span> }</td>
              <td>@if (l.matched) { <span class="ok"><mat-icon style="font-size:16px;width:16px;height:16px;vertical-align:middle">link</mat-icon> matched</span> } @else { <span class="warn" matTooltip="This code isn't a stock item yet — create it in Stock first">not a stock item</span> }</td>
            </tr>
          }
        </tbody></table>
        @if (r.notes) { <p class="hint" style="white-space:pre-line">{{ r.notes }}</p> }
        @if (r.status === 'Pending') {
          <label class="full" style="display:block;margin-top:10px">Notes<textarea rows="2" [(ngModel)]="retNotes" placeholder="Condition of goods, GRN number, who received…" style="width:100%"></textarea></label>
          <footer>
            <button mat-button color="warn" (click)="rejectReturn(r)" [disabled]="retBusy()">Nothing came back</button>
            <span class="sp"></span>
            <button mat-button (click)="retOpen.set(null)">Cancel</button>
            <button mat-flat-button color="primary" (click)="confirmReturn(r)" [disabled]="retBusy() || !retWarehouse"><mat-icon>{{ retBusy() ? 'hourglass_top' : 'inventory' }}</mat-icon> Confirm &amp; post to stock</button>
          </footer>
        }
      </div>
    }

    <!-- ── DETAIL DRAWER ─────────────────────────────────────────── -->
    @if (detail() || detailLoading()) {
      <div class="cn-backdrop" (click)="closeDetail()"></div>
      <aside class="cn-drawer">
        @if (detailLoading()) { <div class="cn-center"><mat-spinner diameter="36"></mat-spinner></div> }
        @if (!detailLoading() && detail(); as d) {
          <header>
            <div>
              <div class="eyebrow">{{ d.company }} · {{ d.date | date:'dd MMM yyyy' }}</div>
              <h2 class="mono">{{ d.number }}</h2>
              <div class="sub">{{ d.customerName }} <small>{{ d.customerNumber }}</small></div>
            </div>
            <div class="hv">
              <b>{{ d.value | currency:'ZAR':'R':'1.2-2' }}</b>
              <small>cost {{ d.cost | currency:'ZAR':'R':'1.0-0' }}</small>
            </div>
            <button mat-icon-button (click)="closeDetail()"><mat-icon>close</mat-icon></button>
          </header>

          <div class="cn-status-row">
            @if (d.status === 'Open') { <span class="st open">Unapplied on account · {{ d.openBalance | currency:'ZAR':'R':'1.2-2' }} · {{ d.openAgeDays }} days (aging {{ d.agingAsOf | date:'dd MMM' }})</span> }
            @else if (d.status === 'Applied') { <span class="st applied">Applied — no longer on the debtor's aging</span> }
            @else { <span class="st open">{{ d.status }}</span> }
            @if (d.orderNumber) { <span class="st neutral">Order {{ d.orderNumber }}</span> }
            @if (d.hasSignedCopy) { <span class="st signed"><mat-icon>verified</mat-icon> Signed copy on file</span> }
            @else { <button class="st missing" (click)="openUpload(d)"><mat-icon>warning_amber</mat-icon> No signed copy — upload</button> }
            @if (d.reason) { <span class="st neutral">{{ d.reason }}</span> }
            @if (d.stockReturn; as sr) {
              <button class="st" [class.missing]="sr.status === 'Pending'" [class.signed]="sr.status === 'Confirmed'" [class.neutral]="sr.status === 'Rejected'" (click)="view.set('returns'); loadReturns(); openReturnById(sr.id)" matTooltip="Open the stock return">
                <mat-icon>assignment_return</mat-icon> Stock {{ sr.returnType.toLowerCase() }} {{ sr.status.toLowerCase() }} · {{ sr.qty | number:'1.0-0' }} units
              </button>
            }
            @if (d.customerMasterId) { <a class="st neutral link" [routerLink]="['/customers', d.customerMasterId]" matTooltip="Customer 360 — sales, aging, credits, PODs, backorders, loads across all companies"><mat-icon>hub</mat-icon> Customer 360</a> }
            @else if (d.customerNumber && d.companyCode) { <button class="st neutral" (click)="goto360(d.companyCode!, d.customerNumber!)"><mat-icon>hub</mat-icon> Customer 360</button> }
          </div>

          <section>
            <h4>What was credited <small>{{ d.lines.length }} lines</small></h4>
            <table class="cn-lines"><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Value</th></tr></thead><tbody>
              @for (l of d.lines; track l.id) {
                <tr><td><b>{{ l.productDescription || l.productCode }}</b><small>{{ l.productCode }}@if (l.brand) { · {{ l.brand }} }</small></td><td class="r mono">{{ l.qty | number:'1.0-2' }}</td><td class="r mono">{{ l.value | currency:'ZAR':'R':'1.2-2' }}</td></tr>
              }
            </tbody></table>
          </section>

          <section>
            <h4>Invoice(s) this reverses <small>matched on customer + product + date</small></h4>
            @if (d.invoices.length === 0) { <p class="muted">No earlier invoice with these products for this customer in the imported history (older than the import window, or a pricing-only credit).</p> }
            @for (i of d.invoices; track i.number) {
              <div class="cn-inv">
                <div class="cn-inv-head">
                  <b class="mono">{{ i.number }}</b>
                  <span>{{ i.date | date:'dd MMM yyyy' }} · {{ i.daysBefore }}d before</span>
                  <span class="conf" [class.hi]="i.confidence >= 0.8" [class.lo]="i.confidence < 0.5">{{ i.confidence * 100 | number:'1.0-0' }}% match</span>
                  <span class="sp"></span>
                  <span class="mono">{{ i.total | currency:'ZAR':'R':'1.2-2' }}</span>
                </div>
                <div class="cn-inv-meta">
                  <span>{{ i.overlapProducts }}/{{ i.totalProductsOnCredit }} credited products on this invoice ({{ i.overlapValue | currency:'ZAR':'R':'1.0-0' }})</span>
                  @if (i.stillOpen != null) { <span class="warn">Invoice still open on aging: {{ i.stillOpen | currency:'ZAR':'R':'1.2-2' }}</span> } @else { <span class="ok">Invoice settled / not on aging</span> }
                  @if (i.hasPod) { <span class="ok"><mat-icon>task</mat-icon> POD on file</span> } @else { <span class="muted">No POD linked</span> }
                  @if (i.loadId) { <span class="muted">Load #{{ i.loadId }}</span> }
                </div>
                @if (i.lines_?.length) {
                  <table class="cn-lines small"><tbody>
                    @for (l of i.lines_; track l.productCode) {
                      <tr [class.hit]="l.credited"><td>{{ l.productDescription || l.productCode }}<small>{{ l.productCode }}</small></td><td class="r mono">{{ l.quantity | number:'1.0-2' }}</td><td class="r mono">{{ l.salesAmount | currency:'ZAR':'R':'1.2-2' }}</td><td>@if (l.credited) { <mat-icon class="hitico" matTooltip="This product is on the credit note">undo</mat-icon> }</td></tr>
                    }
                  </tbody></table>
                }
              </div>
            }
          </section>

          <section>
            <h4>Signed authorisation <small>{{ d.documents.length }} file{{ d.documents.length === 1 ? '' : 's' }}</small></h4>
            @for (f of d.documents; track f.id) {
              <div class="cn-doc">
                <mat-icon>{{ f.isPdf ? 'picture_as_pdf' : 'image' }}</mat-icon>
                <div class="t"><b>{{ f.originalFileName }}</b><small>{{ f.reason || 'No reason given' }} · signed by {{ f.signedBy || '—' }}@if (f.signedOn) { on {{ f.signedOn | date:'dd MMM yyyy' }} } · uploaded {{ f.uploadedAt | date:'dd MMM HH:mm' }} by {{ f.uploadedByName }}</small>@if (f.notes) { <small class="note">{{ f.notes }}</small> }</div>
                <button mat-icon-button (click)="viewFile(f)" matTooltip="View"><mat-icon>visibility</mat-icon></button>
                <button mat-icon-button (click)="download(f)" matTooltip="Download"><mat-icon>download</mat-icon></button>
              </div>
            }
            <button mat-stroked-button (click)="openUpload(d)"><mat-icon>upload_file</mat-icon> Upload {{ d.documents.length ? 'another' : 'the signed' }} copy</button>
          </section>

          @if (d.remittances.length) {
            <section>
              <h4>Mentioned in remittances</h4>
              @for (r of d.remittances; track r.id) {
                <div class="cn-remit"><mat-icon>mark_email_read</mat-icon><div><b>{{ r.subject }}</b><small>{{ r.fromEmail }} · {{ r.receivedAt | date:'dd MMM yyyy' }} · {{ r.status }}</small></div>@if (r.totalAmount) { <span class="mono">{{ r.totalAmount | currency:'ZAR':'R':'1.0-0' }}</span> }</div>
              }
            </section>
          }

          @if (d.customerHistory?.length) {
            <section>
              <h4>Other credits for {{ d.customerName }} <small>{{ d.customerHistory!.length }} recent</small></h4>
              <div class="cn-hist">
                @for (h of d.customerHistory; track h.number) {
                  <button (click)="open(h.number, detail()?.companyCode)"><b class="mono">{{ h.number }}</b><span>{{ h.date | date:'dd MMM yy' }}</span><span class="mono">{{ h.value | currency:'ZAR':'R':'1.0-0' }}</span></button>
                }
              </div>
            </section>
          }
        }
      </aside>
    }

    <!-- ── FILE VIEWER ───────────────────────────────────────────── -->
    @if (fileUrl()) {
      <div class="cn-backdrop top" (click)="closeFile()"></div>
      <div class="cn-viewer">
        <header><b>{{ fileName() }}</b><span class="sp"></span><button mat-icon-button (click)="closeFile()"><mat-icon>close</mat-icon></button></header>
        @if (fileIsPdf()) { <iframe [src]="fileUrl()" title="Signed credit note"></iframe> } @else { <img [src]="fileUrl()" alt="Signed credit note" /> }
      </div>
    }

    <!-- ── UPLOAD DIALOG ─────────────────────────────────────────── -->
    @if (uploadOpen()) {
      <div class="cn-backdrop top" (click)="uploadOpen.set(false)"></div>
      <div class="cn-upload">
        <header><mat-icon>draw</mat-icon><h3>Upload signed credit note</h3><span class="sp"></span><button mat-icon-button (click)="uploadOpen.set(false)"><mat-icon>close</mat-icon></button></header>
        <p class="hint">The signed PDF is the authorisation for the credit. It is matched to the Sage credit note by its <b>CN number</b>, which then links it to the customer, the original invoice and the aging.</p>
        <div class="grid">
          <label>Credit note number *<input [(ngModel)]="up.creditNoteNumber" placeholder="CN103513" (blur)="lookupNumber()" /></label>
          <label>Company<select [(ngModel)]="up.company"><option value="">Auto from Sage</option><option value="PMT">Promed Technologies</option><option value="ACM">Access Medical</option><option value="PHT">Promed Pharmatech</option><option value="SBT">Sebenzani Trading</option></select></label>
          <label>Customer<input [(ngModel)]="up.customerName" [placeholder]="upSage()?.customerName || 'Auto from Sage'" /></label>
          <label>Amount<input type="number" step="0.01" [(ngModel)]="up.amount" [placeholder]="upSage() ? (upSage()!.value | number:'1.2-2') : 'Auto from Sage'" /></label>
          <label>Reason<select [(ngModel)]="up.reason"><option value="">—</option>@for (r of reasons; track r.reason) { <option [value]="r.reason">{{ r.reason }}{{ r.movesStock ? ' · raises stock return' : '' }}</option> }</select></label>
          <label>Invoice(s) credited<input [(ngModel)]="up.invoiceNumbers" [placeholder]="upSage()?.invoices?.[0]?.number || 'IN148387'" /></label>
          <label>Signed by (manager)<input [(ngModel)]="up.signedBy" placeholder="Name on the signature" /></label>
          <label>Signed on<input type="date" [(ngModel)]="up.signedOn" /></label>
          <label class="full">Notes<textarea rows="2" [(ngModel)]="up.notes" placeholder="Why the credit was approved, who requested it, reference to return / query…"></textarea></label>
          <label class="full file" [class.has]="upFile">
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="pickFile($event)" />
            <mat-icon>{{ upFile ? 'check_circle' : 'upload_file' }}</mat-icon>
            <span>{{ upFile ? upFile.name + ' (' + (upFile.size / 1024 | number:'1.0-0') + ' KB)' : 'Choose the signed PDF / photo' }}</span>
          </label>
        </div>
        @if (upSage(); as sg) {
          <div class="sage-hit"><mat-icon>link</mat-icon> Found in Sage: <b>{{ sg.customerName }}</b> · {{ sg.company }} · {{ sg.value | currency:'ZAR':'R':'1.2-2' }} · {{ sg.date | date:'dd MMM yyyy' }}@if (sg.hasSignedCopy) { · <span class="warn">already has {{ sg.documents.length }} signed cop{{ sg.documents.length === 1 ? 'y' : 'ies' }}</span> }</div>
        } @else if (upLookedUp() && up.creditNoteNumber) {
          <div class="sage-miss"><mat-icon>info</mat-icon> {{ up.creditNoteNumber | uppercase }} isn't in the imported sales history yet. You can still upload — it will link automatically after the next sales import.</div>
        }
        @if (movesStock(up.reason)) {
          <div class="sage-hit"><mat-icon>assignment_return</mat-icon> <b>{{ up.reason }}</b> means goods came back — a stock return will be raised from the credit note's product lines for the branch to confirm.</div>
        }
        <footer>
          <button mat-button (click)="uploadOpen.set(false)">Cancel</button>
          <button mat-flat-button color="primary" (click)="submitUpload()" [disabled]="uploading() || !upFile || !up.creditNoteNumber.trim()"><mat-icon>{{ uploading() ? 'hourglass_top' : 'cloud_upload' }}</mat-icon> {{ uploading() ? 'Uploading…' : 'Upload' }}</button>
        </footer>
      </div>
    }
  `,
  styles: [`
    :host { display:block; }
    .mono { font-variant-numeric: tabular-nums; font-family: var(--font-mono, ui-monospace, monospace); }
    .r { text-align:right; }
    .sp { flex:1; }
    .muted { color: var(--color-text-3); }
    .warn { color: var(--color-warn); }
    .ok { color: var(--color-ok); }
    .bad { color: var(--color-danger); }
    small { display:block; color: var(--color-text-3); font-size: var(--text-xs); }

    .cn-kpis { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
    .cn-kpi { background: var(--color-surface); border:1px solid var(--color-line); border-left:4px solid var(--color-primary); border-radius: var(--radius-lg); padding:14px 16px; display:flex; flex-direction:column; gap:4px;
      .k { font-size: var(--text-xs); text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-2); font-weight:700; }
      b { font-size: clamp(18px, 2vw, 26px); font-weight:800; white-space:nowrap; }
      &.warn { border-left-color: var(--color-warn); } &.bad { border-left-color: var(--color-danger); b { color: var(--color-danger); } } &.ok { border-left-color: var(--color-ok); b { color: var(--color-ok); } } }

    .cn-companies { display:grid; grid-template-columns: repeat(auto-fit, minmax(250px,1fr)); gap:12px; margin-bottom: var(--space-4); }
    .cn-co { display:flex; align-items:center; gap:14px; text-align:left; font: inherit; color: inherit; cursor:pointer; background: var(--color-surface); border:2px solid var(--color-line); border-radius: 16px; padding:12px 16px; transition: border-color .15s, box-shadow .15s, opacity .15s, transform .15s;
      &:hover { box-shadow: 0 6px 18px rgba(0,0,0,.08); transform: translateY(-1px); }
      &.active { border-color: var(--color-primary); background: var(--color-primary-soft); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
      &.dim { opacity:.55; }
      .cn-logo { width:56px; height:56px; border-radius:50%; object-fit:cover; flex:0 0 56px; background:#f3f4f6; box-shadow:0 1px 3px rgba(0,0,0,.12); }
      .cn-logo.all-logo { display:inline-flex; align-items:center; justify-content:center; background: linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; mat-icon { font-size:30px; width:30px; height:30px; } }
      .cn-co-body { flex:1; min-width:0; }
      .cn-co-top { display:flex; justify-content:space-between; gap:8px; b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } span { font-weight:800; white-space:nowrap; } }
      .cn-co-bar { height:8px; border-radius:999px; background: var(--color-surface); overflow:hidden; margin:6px 0; i { display:block; height:100%; background: var(--color-danger); opacity:.75; } }
      .cn-co-foot { display:flex; flex-wrap:wrap; gap:4px 10px; font-size: var(--text-xs); color: var(--color-text-3); } }

    .cn-subtabs { display:flex; gap:6px; align-items:center; border-bottom:1px solid var(--color-line); margin-bottom: var(--space-3); padding-bottom:8px;
      > button:not([mat-flat-button]) { display:inline-flex; align-items:center; gap:6px; background:none; border:0; border-radius:999px; padding:8px 14px; font: inherit; font-weight:600; color: var(--color-text-2); cursor:pointer;
        mat-icon { font-size:18px; width:18px; height:18px; } .n { background: var(--color-surface-2); border-radius:999px; padding:0 7px; font-size: var(--text-xs); }
        &:hover { background: var(--color-surface-2); } &.active { background: var(--color-primary-soft); color: var(--color-primary); } } }

    .cn-toolbar { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom: var(--space-3); }
    .warn-n { background: var(--color-warn) !important; color:#fff !important; }
    .st.link { text-decoration:none; }
    .cn-chips { display:flex; gap:4px; flex-wrap:wrap; }
    .chip { border:1px solid var(--color-line); background: var(--color-surface); border-radius:999px; padding:5px 12px; font: inherit; font-size: var(--text-sm); cursor:pointer; color: var(--color-text-2);
      &.active { background: var(--color-primary); color: var(--color-on-primary); border-color: var(--color-primary); } }
    .cn-search { flex:1; min-width:240px; padding:8px 12px; border:1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); color: inherit; font: inherit; }
    .cn-date { padding:7px 10px; border:1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); color: inherit; font: inherit; }
    .cn-check { display:inline-flex; align-items:center; gap:6px; font-size: var(--text-sm); color: var(--color-text-2); }
    .cn-resultline { font-size: var(--text-sm); color: var(--color-text-3); margin-bottom:6px; }
    .cn-center { display:flex; justify-content:center; padding: var(--space-6); }
    .cn-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding: var(--space-6); color: var(--color-text-3); text-align:center; mat-icon { font-size:40px; width:40px; height:40px; opacity:.5; } p { max-width:520px; margin:0; } }

    .cn-tablewrap { overflow-x:auto; border:1px solid var(--color-line); border-radius: var(--radius-lg); background: var(--color-surface); }
    .cn-table { width:100%; border-collapse:collapse; font-size: var(--text-sm);
      th { text-align:left; font-size: var(--text-xs); text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-3); padding:10px 12px; border-bottom:1px solid var(--color-line); white-space:nowrap; }
      td { padding:10px 12px; border-bottom:1px solid var(--color-line); vertical-align:top; }
      tbody tr { cursor:pointer; &:hover { background: var(--color-surface-2); } &.sel { background: var(--color-primary-soft); } }
      .cust span { display:block; max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .reason { color: var(--color-text-3); }
      .acts { white-space:nowrap; } }
    .co-pill { background: var(--color-surface-2); border-radius:6px; padding:2px 8px; font-weight:700; font-size: var(--text-xs); }
    .row-logo { width:28px; height:28px; border-radius:50%; object-fit:cover; display:block; box-shadow:0 1px 2px rgba(0,0,0,.15); }
    .inv { display:inline-flex; align-items:center; gap:4px; font-weight:600; mat-icon { font-size:16px; width:16px; height:16px; color: var(--color-primary); } small { display:inline; color: var(--color-text-3); } }
    .st { display:inline-flex; align-items:center; gap:4px; border-radius:999px; padding:3px 10px; font-size: var(--text-xs); font-weight:700; border:0; font-family: inherit; white-space:nowrap;
      mat-icon { font-size:14px; width:14px; height:14px; }
      &.open { background: var(--color-warn-soft); color: var(--color-warn); }
      &.applied { background: var(--color-ok-soft); color: var(--color-ok); }
      &.signed { background: var(--color-ok-soft); color: var(--color-ok); }
      &.neutral { background: var(--color-surface-2); color: var(--color-text-2); }
      &.missing { background: var(--color-danger-soft); color: var(--color-danger); cursor:pointer; &:hover { filter: brightness(.95); } } }
    .cn-pager { display:flex; justify-content:center; align-items:center; gap:12px; padding:12px; color: var(--color-text-3); }

    .cn-insight { display:grid; grid-template-columns: repeat(auto-fit, minmax(320px,1fr)); gap: var(--space-4); }
    .cn-card { background: var(--color-surface); border:1px solid var(--color-line); border-radius: var(--radius-lg); padding:14px 16px;
      h3 { margin:0 0 10px; font-size: var(--text-md); display:flex; align-items:center; gap:6px; mat-icon { color: var(--color-primary); } } }
    .cn-trend { display:flex; align-items:flex-end; gap:6px; height:160px;
      .bar { flex:1; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; height:100%; gap:4px;
        i { display:block; width:100%; background: var(--color-danger); opacity:.7; border-radius:4px 4px 0 0; min-height:2px; } span { font-size:10px; color: var(--color-text-3); } } }
    .cn-mini { width:100%; border-collapse:collapse; td { padding:6px 4px; border-bottom:1px solid var(--color-line); } tr { cursor:pointer; &:hover { background: var(--color-surface-2); } } }

    .cn-backdrop { position:fixed; inset:0; background: rgba(0,0,0,.35); z-index:900; &.top { z-index:950; } }
    .cn-drawer { position:fixed; top:0; right:0; bottom:0; width: min(760px, 96vw); background: var(--color-surface); z-index:901; overflow:auto; box-shadow: -8px 0 32px rgba(0,0,0,.2); padding: 0 20px 24px; animation: slide .18s ease;
      header { display:flex; gap:14px; align-items:flex-start; position:sticky; top:0; background: var(--color-surface); padding:18px 0 12px; border-bottom:1px solid var(--color-line); z-index:1;
        .eyebrow { font-size: var(--text-xs); text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-3); } h2 { margin:2px 0; } .sub { color: var(--color-text-2); small { display:inline; } }
        .hv { margin-left:auto; text-align:right; b { font-size: var(--text-xl); font-weight:800; } } }
      section { margin-top:18px; h4 { margin:0 0 8px; font-size: var(--text-md); display:flex; align-items:baseline; gap:8px; small { display:inline; font-weight:400; } } } }
    @keyframes slide { from { transform: translateX(30px); opacity:0; } to { transform:none; opacity:1; } }
    .cn-status-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
    .cn-lines { width:100%; border-collapse:collapse; font-size: var(--text-sm); th { text-align:left; font-size: var(--text-xs); color: var(--color-text-3); padding:4px 6px; } td { padding:6px; border-bottom:1px solid var(--color-line); }
      &.small { font-size: var(--text-xs); margin-top:6px; tr.hit td { background: var(--color-warn-soft); } .hitico { font-size:16px; width:16px; height:16px; color: var(--color-warn); } } }
    .cn-inv { border:1px solid var(--color-line); border-radius: var(--radius-md); padding:10px 12px; margin-bottom:8px; background: var(--color-surface-2);
      .cn-inv-head { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      .conf { border-radius:999px; padding:1px 8px; font-size: var(--text-xs); font-weight:700; background: var(--color-warn-soft); color: var(--color-warn); &.hi { background: var(--color-ok-soft); color: var(--color-ok); } &.lo { background: var(--color-surface); color: var(--color-text-3); } }
      .cn-inv-meta { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:6px; font-size: var(--text-xs); color: var(--color-text-2); span { display:inline-flex; align-items:center; gap:3px; } mat-icon { font-size:14px; width:14px; height:14px; } } }
    .cn-doc { display:flex; gap:10px; align-items:center; padding:8px 10px; border:1px solid var(--color-line); border-radius: var(--radius-md); margin-bottom:6px; > mat-icon { color: var(--color-danger); } .t { flex:1; min-width:0; b { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } .note { color: var(--color-text-2); font-style:italic; } } }
    .cn-remit { display:flex; gap:10px; align-items:center; padding:8px 0; border-bottom:1px solid var(--color-line); > mat-icon { color: var(--color-primary); } div { flex:1; min-width:0; } }
    .cn-hist { display:flex; flex-direction:column; gap:4px; button { display:grid; grid-template-columns: 1fr auto auto; gap:12px; text-align:left; font: inherit; color: inherit; background: var(--color-surface-2); border:0; border-radius: var(--radius-sm); padding:6px 10px; cursor:pointer; &:hover { background: var(--color-primary-soft); } } }

    .cn-viewer { position:fixed; inset: 4vh 6vw; background: var(--color-surface); z-index:951; border-radius: var(--radius-lg); display:flex; flex-direction:column; overflow:hidden; box-shadow: 0 20px 60px rgba(0,0,0,.4);
      header { display:flex; align-items:center; gap:10px; padding:8px 8px 8px 16px; border-bottom:1px solid var(--color-line); }
      iframe { flex:1; border:0; width:100%; } img { flex:1; object-fit:contain; max-width:100%; background: var(--color-surface-2); } }

    .cn-upload { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:min(720px, 94vw); max-height:92vh; overflow:auto; background: var(--color-surface); z-index:951; border-radius: var(--radius-lg); padding:16px 20px 18px; box-shadow: 0 20px 60px rgba(0,0,0,.4);
      header { display:flex; align-items:center; gap:8px; h3 { margin:0; } > mat-icon { color: var(--color-primary); } }
      .hint { color: var(--color-text-2); font-size: var(--text-sm); margin:6px 0 14px; }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap:10px 14px; label { display:flex; flex-direction:column; gap:4px; font-size: var(--text-xs); font-weight:700; color: var(--color-text-2); text-transform:uppercase; letter-spacing:.04em; &.full { grid-column: 1 / -1; } }
        input, select, textarea { font: inherit; text-transform:none; letter-spacing:0; font-weight:400; padding:8px 10px; border:1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); color: inherit; &:focus { outline:none; border-color: var(--color-primary); } }
        .file { flex-direction:row; align-items:center; gap:10px; border:2px dashed var(--color-line); border-radius: var(--radius-md); padding:14px; cursor:pointer; position:relative; text-transform:none; letter-spacing:0; font-weight:600; color: var(--color-text-2);
          input { position:absolute; inset:0; opacity:0; cursor:pointer; } mat-icon { color: var(--color-primary); } &.has { border-color: var(--color-ok); color: var(--color-ok); mat-icon { color: var(--color-ok); } } } }
      .sage-hit, .sage-miss { display:flex; align-items:center; gap:8px; margin-top:12px; padding:8px 12px; border-radius: var(--radius-md); font-size: var(--text-sm); }
      .sage-hit { background: var(--color-ok-soft); color: var(--color-text); mat-icon { color: var(--color-ok); } }
      .sage-miss { background: var(--color-warn-soft); mat-icon { color: var(--color-warn); } }
      footer { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; } }

    @media (max-width: 1000px) { .cn-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } }
    @media (max-width: 640px) { .cn-kpis { grid-template-columns: 1fr; } .cn-upload .grid { grid-template-columns: 1fr; } }
  `]
})
export class FinanceCreditNotesComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = `${environment.apiUrl}/finance/credit-notes`;

  readonly filters = [
    { key: 'all', label: 'All' }, { key: 'open', label: 'Unapplied on account' }, { key: 'applied', label: 'Applied' },
    { key: 'unsigned', label: 'No signed copy' }, { key: 'signed', label: 'Signed copy on file' }
  ];
  readonly reasons: { reason: string; movesStock: boolean }[] = [
    { reason: 'Return', movesStock: true }, { reason: 'Pricing', movesStock: false }, { reason: 'Short delivery', movesStock: false }, { reason: 'Damaged', movesStock: true },
    { reason: 'Expired', movesStock: true }, { reason: 'Duplicate', movesStock: false }, { reason: 'Goodwill', movesStock: false }, { reason: 'Other', movesStock: false }
  ];
  movesStock(r: string): boolean { return !!this.reasons.find(x => x.reason === r)?.movesStock; }
  readonly pageSize = 50;

  summary = signal<Summary | null>(null);
  view = signal<'list' | 'docs' | 'returns' | 'insight'>('list');

  // stock returns
  readonly returnFilters = ['Pending', 'Confirmed', 'Rejected', 'All'];
  returns = signal<StockRet[]>([]); retLoading = signal(false); retStatus = signal('Pending'); pendingReturns = signal(0);
  retOpen = signal<StockRet | null>(null); retWarehouses = signal<{ id: number; name: string; code?: string; province?: string }[]>([]); retWarehouse: number | null = null; retQty: Record<number, number> = {}; retNotes = ''; retBusy = signal(false);
  company = signal('ALL'); status = signal('all'); search = signal(''); from = signal(''); to = signal(''); page = signal(1);
  logo = companyLogo; coName = companyName;
  loading = signal(false); items = signal<Cn[]>([]); total = signal(0); totalValue = signal(0);
  pages = () => Math.max(1, Math.ceil(this.total() / this.pageSize));

  docs = signal<DocRow[]>([]); docsLoading = signal(false); docSearch = signal(''); docsUnmatched = signal(false);
  detail = signal<Detail | null>(null); detailLoading = signal(false);

  fileUrl = signal<SafeResourceUrl | null>(null); fileName = signal(''); fileIsPdf = signal(true); private fileBlobUrl: string | null = null;

  uploadOpen = signal(false); uploading = signal(false); upFile: File | null = null; upSage = signal<Detail | null>(null); upLookedUp = signal(false);
  up = this.blankUpload();

  ngOnInit(): void {
    // Deep link from the Finance alert strip: ?view=unsigned | returns
    const v = this.route.snapshot.queryParamMap.get('view');
    if (v === 'unsigned') this.status.set('unsigned');
    if (v === 'returns') { this.view.set('returns'); this.loadReturns(); }
    this.loadSummary(); this.load(); this.countPending();
  }

  // ── stock returns ──────────────────────────────────────────────
  private retApi = `${environment.apiUrl}/finance/stock-returns`;
  countPending(): void { this.http.get<StockRet[]>(this.retApi, { params: { status: 'Pending' } }).subscribe({ next: r => this.pendingReturns.set(r.length), error: () => {} }); }
  loadReturns(): void {
    this.retLoading.set(true);
    this.http.get<StockRet[]>(this.retApi, { params: { status: this.retStatus() } }).subscribe({
      next: r => { this.returns.set(r); this.retLoading.set(false); if (this.retStatus() === 'Pending') this.pendingReturns.set(r.length); },
      error: () => { this.retLoading.set(false); this.toast.error('Could not load stock returns'); }
    });
  }
  openReturn(r: StockRet): void { this.openReturnById(r.id); }
  openReturnById(id: number): void {
    this.http.get<{ ret: StockRet; warehouses: { id: number; name: string; code?: string; province?: string }[] }>(`${this.retApi}/${id}`).subscribe({
      next: x => {
        this.retWarehouses.set(x.warehouses); this.retWarehouse = x.ret.warehouseId ?? null; this.retNotes = '';
        this.retQty = {}; for (const l of x.ret.lines) this.retQty[l.id] = l.confirmedQuantity ?? l.quantity;
        this.retOpen.set(x.ret);
      },
      error: () => this.toast.error('Could not open the return')
    });
  }
  confirmReturn(r: StockRet): void {
    if (!this.retWarehouse) return;
    this.retBusy.set(true);
    const lines = r.lines.map(l => ({ id: l.id, confirmedQuantity: Number(this.retQty[l.id] ?? l.quantity) }));
    this.http.post<StockRet>(`${this.retApi}/${r.id}/confirm`, { warehouseId: this.retWarehouse, notes: this.retNotes, lines }).subscribe({
      next: () => { this.retBusy.set(false); this.retOpen.set(null); this.toast.done(`${r.creditNoteNumber} posted to stock`); this.loadReturns(); this.countPending(); if (this.detail()?.number === r.creditNoteNumber) this.open(r.creditNoteNumber, r.company); },
      error: e => { this.retBusy.set(false); this.toast.error(e?.error?.error || 'Could not confirm the return'); }
    });
  }
  rejectReturn(r: StockRet): void {
    const reason = prompt('Why did nothing come back? (e.g. pricing credit, goods written off at customer)');
    if (reason === null) return;
    this.retBusy.set(true);
    this.http.post<StockRet>(`${this.retApi}/${r.id}/reject`, { reason }).subscribe({
      next: () => { this.retBusy.set(false); this.retOpen.set(null); this.toast.done('Return closed without stock movement'); this.loadReturns(); this.countPending(); },
      error: e => { this.retBusy.set(false); this.toast.error(e?.error?.error || 'Could not close the return'); }
    });
  }
  goto360(company: string, code: string): void {
    this.http.get<{ id: number }>(`${environment.apiUrl}/customers/master/resolve`, { params: { company, code } }).subscribe({
      next: r => this.router.navigate(['/customers', r.id]),
      error: () => this.toast.error('Could not resolve the customer')
    });
  }

  @HostListener('document:keydown.escape') onEsc(): void {
    if (this.fileUrl()) this.closeFile(); else if (this.uploadOpen()) this.uploadOpen.set(false); else if (this.detail()) this.closeDetail();
  }

  barPct(v: number, max: number): number { return max > 0 ? Math.max(1, Math.round(v / max * 100)) : 0; }
  maxTrend(s: Summary): number { return Math.max(1, ...s.trend.map(t => t.value)); }

  loadSummary(): void { this.http.get<Summary>(`${this.api}/summary`).subscribe({ next: s => this.summary.set(s), error: () => this.toast.error('Could not load credit note summary') }); }

  load(): void {
    this.loading.set(true);
    let p = new HttpParams().set('page', this.page()).set('pageSize', this.pageSize).set('company', this.company()).set('status', this.status());
    if (this.search()) p = p.set('search', this.search());
    if (this.from()) p = p.set('from', this.from());
    if (this.to()) p = p.set('to', this.to());
    this.http.get<{ total: number; totalValue: number; items: Cn[] }>(this.api, { params: p }).subscribe({
      next: r => { this.items.set(r.items); this.total.set(r.total); this.totalValue.set(r.totalValue); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Could not load credit notes'); }
    });
  }
  clear(): void { this.search.set(''); this.from.set(''); this.to.set(''); this.status.set('all'); this.company.set('ALL'); this.page.set(1); this.load(); }

  open(number: string, company?: string | null): void {
    this.detailLoading.set(true); this.detail.set(null);
    const params: Record<string, string> = company ? { company } : {};
    this.http.get<Detail>(`${this.api}/${encodeURIComponent(number)}`, { params }).subscribe({
      next: d => { this.detail.set(d); this.detailLoading.set(false); },
      error: e => { this.detailLoading.set(false); this.toast.error(e?.error?.message || `Could not open ${number}`); }
    });
  }
  closeDetail(): void { this.detail.set(null); }

  loadDocs(): void {
    this.docsLoading.set(true);
    let p = new HttpParams().set('unmatched', this.docsUnmatched());
    if (this.docSearch()) p = p.set('search', this.docSearch());
    this.http.get<DocRow[]>(`${this.api}/documents`, { params: p }).subscribe({
      next: r => { this.docs.set(r); this.docsLoading.set(false); },
      error: () => { this.docsLoading.set(false); this.toast.error('Could not load signed copies'); }
    });
  }

  viewFile(d: Doc): void {
    this.http.get(`${this.api}/documents/${d.id}/file`, { responseType: 'blob' }).subscribe({
      next: b => {
        this.closeFile();
        this.fileBlobUrl = URL.createObjectURL(b);
        this.fileIsPdf.set(d.isPdf); this.fileName.set(d.originalFileName || d.creditNoteNumber);
        this.fileUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.fileBlobUrl));
      },
      error: () => this.toast.error('Could not open the file')
    });
  }
  closeFile(): void { if (this.fileBlobUrl) URL.revokeObjectURL(this.fileBlobUrl); this.fileBlobUrl = null; this.fileUrl.set(null); }
  download(d: Doc): void {
    this.http.get(`${this.api}/documents/${d.id}/file`, { responseType: 'blob', params: { download: true } }).subscribe({
      next: b => { const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = d.originalFileName || `${d.creditNoteNumber}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); },
      error: () => this.toast.error('Download failed')
    });
  }
  remove(d: Doc): void {
    if (!confirm(`Delete the signed copy "${d.originalFileName}" for ${d.creditNoteNumber}? This cannot be undone.`)) return;
    this.http.delete(`${this.api}/documents/${d.id}`).subscribe({
      next: () => { this.toast.done('Deleted'); this.loadDocs(); this.loadSummary(); if (this.detail()?.number === d.creditNoteNumber) this.open(d.creditNoteNumber, d.company); this.load(); },
      error: () => this.toast.error('Could not delete')
    });
  }

  // ── upload ─────────────────────────────────────────────────────
  private blankUpload() { return { creditNoteNumber: '', company: '', customerName: '', amount: null as number | null, reason: '', invoiceNumbers: '', signedBy: '', signedOn: '', notes: '' }; }
  openUpload(cn?: Cn | Detail): void {
    this.up = this.blankUpload(); this.upFile = null; this.upSage.set(null); this.upLookedUp.set(false);
    if (cn) {
      this.up.creditNoteNumber = cn.number; this.up.company = cn.companyCode || ''; this.up.customerName = cn.customerName || '';
      this.up.amount = Math.round(cn.value * 100) / 100; this.up.invoiceNumbers = cn.invoices?.[0]?.number || '';
      this.lookupNumber();
    }
    this.uploadOpen.set(true);
  }
  lookupNumber(): void {
    let n = this.up.creditNoteNumber.trim().toUpperCase(); if (/^\d+$/.test(n)) n = 'CN' + n; this.up.creditNoteNumber = n;
    if (!n) { this.upSage.set(null); return; }
    const params: Record<string, string> = this.up.company ? { company: this.up.company } : {};
    this.http.get<Detail & { otherCompanies?: string[] }>(`${this.api}/${encodeURIComponent(n)}`, { params }).subscribe({
      next: d => {
        this.upSage.set(d); this.upLookedUp.set(true); if (!this.up.company) this.up.company = d.companyCode || '';
        if (d.otherCompanies?.length) this.toast.warn(`${n} also exists in ${d.otherCompanies.join(', ')} — make sure the company is right`);
      },
      error: () => { this.upSage.set(null); this.upLookedUp.set(true); }
    });
  }
  pickFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0] || null; this.upFile = f;
    if (f && !this.up.creditNoteNumber) { const m = f.name.match(/CN\d{4,}/i); if (m) { this.up.creditNoteNumber = m[0].toUpperCase(); this.lookupNumber(); } }
  }
  submitUpload(): void {
    if (!this.upFile || !this.up.creditNoteNumber.trim()) return;
    const fd = new FormData();
    fd.append('file', this.upFile);
    fd.append('creditNoteNumber', this.up.creditNoteNumber.trim());
    for (const k of ['company', 'customerName', 'reason', 'invoiceNumbers', 'signedBy', 'notes'] as const) if (this.up[k]) fd.append(k, this.up[k]);
    if (this.up.amount != null && this.up.amount !== ('' as unknown)) fd.append('amount', String(this.up.amount));
    if (this.up.signedOn) fd.append('signedOn', this.up.signedOn);
    this.uploading.set(true);
    this.http.post<{ warning?: string }>(`${this.api}/documents`, fd).subscribe({
      next: r => {
        this.uploading.set(false); this.uploadOpen.set(false);
        r.warning ? this.toast.warn(r.warning) : this.toast.done(`Signed copy saved for ${this.up.creditNoteNumber}`);
        this.loadSummary(); this.load(); if (this.view() === 'docs') this.loadDocs();
        if (this.detail()?.number === this.up.creditNoteNumber) this.open(this.up.creditNoteNumber, this.up.company);
      },
      error: e => { this.uploading.set(false); this.toast.error(e?.error?.error || 'Upload failed'); }
    });
  }
}
