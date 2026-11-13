import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { companyLogo, companyName, COMPANY_NAMES } from '../../core/company-logos';
import { PackUploadDialogComponent, PACK_KINDS, Analysis } from './pack-upload-dialog.component';
import { PackBatchDialogComponent } from './pack-batch-dialog.component';
import { InvoiceDetailDialogComponent } from './invoice-detail-dialog.component';
import { PackPreviewDialogComponent } from './pack-preview-dialog.component';
import { PackEditDialogComponent } from './pack-edit-dialog.component';

interface PackContents { deliveryNote: boolean; taxInvoice: boolean; orderConfirmation: boolean; orderEmail: boolean; orderForm: boolean; }
interface Pack {
  id: number; packNumber: string; invoiceNumber: string; orderNumber?: string | null; confirmationNumber?: string | null; customerNumber?: string | null; customerName?: string | null;
  company?: string | null; invoiceDate?: string | null; invoiceTotal?: number | null; source: string; status: string;
  contents: PackContents; invoiceVerified: boolean; inSage: boolean; notes?: string | null;
  validationStatus?: 'PASS' | 'FAIL' | 'REVIEW' | 'UNKNOWN' | null; validation?: Analysis | null; proofOfDelivery: boolean; partDelivery: boolean; amendedOrder: boolean;
  fileName: string; originalFileName?: string | null; contentType?: string | null; size: number; pageCount: number;
  uploadedByName?: string | null; uploadedAt: string; updatedAt?: string | null;
  files?: { id: number; kind: string; sortOrder: number; originalFileName?: string; contentType?: string; size: number }[];
}
interface Summary {
  total: number; complete: number; incomplete: number; notInSage: number; thisMonth: number;
  byCompany: { company: string | null; count: number }[];
  missing: { deliveryNote: number; taxInvoice: number; orderConfirmation: number; orderEmail: number; orderForm: number };
  validation: { pass: number; review: number; fail: number; unknown: number };
}

/**
 * Finance › Packs — the complete paper trail per invoice (delivery note, tax invoice, order
 * confirmation, customer order e-mail, order form) as one PDF, tracked by invoice number.
 */
@Component({
  selector: 'app-finance-packs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatPaginatorModule, MatDialogModule, MatMenuModule],
  template: `
  <!-- Company tiles -->
  <div class="pk-companies">
    <button type="button" class="pk-co" [class.active]="company() === ''" [class.dim]="company() !== ''" (click)="pickCompany('')">
      <span class="pk-logo pk-logo--all"><mat-icon>apps</mat-icon></span>
      <span class="pk-co-body"><span class="pk-co-top"><b>All companies</b><span>{{ summary()?.total ?? 0 }}</span></span><small>{{ summary()?.complete ?? 0 }} complete · {{ summary()?.incomplete ?? 0 }} missing items</small></span>
    </button>
    @for (c of companyCodes; track c) {
      <button type="button" class="pk-co" [class.active]="company() === c" [class.dim]="company() !== '' && company() !== c" (click)="pickCompany(c)">
        <img class="pk-logo" [src]="logo(c)" [alt]="names[c]" />
        <span class="pk-co-body"><span class="pk-co-top"><b>{{ names[c] }}</b><span>{{ countFor(c) }}</span></span><small>{{ c }}</small></span>
      </button>
    }
  </div>

  <!-- KPI strip -->
  @if (summary(); as s) {
    <div class="pk-kpis">
      <div class="pk-kpi"><span class="pk-kpi__v">{{ s.total }}</span><span class="pk-kpi__l">Packs on file</span></div>
      <div class="pk-kpi ok"><span class="pk-kpi__v">{{ s.validation.pass }}</span><span class="pk-kpi__l">Checks passed</span></div>
      <div class="pk-kpi" [class.warn]="s.validation.review > 0"><span class="pk-kpi__v">{{ s.validation.review }}</span><span class="pk-kpi__l">Need a look</span></div>
      <div class="pk-kpi" [class.bad]="s.validation.fail > 0"><span class="pk-kpi__v">{{ s.validation.fail }}</span><span class="pk-kpi__l">Checks failed</span></div>
      <div class="pk-kpi" [class.warn]="s.notInSage > 0"><span class="pk-kpi__v">{{ s.notInSage }}</span><span class="pk-kpi__l">Invoice not in Sage yet</span></div>
    </div>
  }

  <!-- Toolbar -->
  <div class="pk-toolbar">
    <div class="pk-search">
      <mat-icon>search</mat-icon>
      <input type="search" placeholder="Invoice, order no., customer, pack no.…" [ngModel]="search()" (ngModelChange)="onSearch($event)" />
    </div>
    <select class="pk-select" [ngModel]="validation()" (ngModelChange)="validation.set($event); pageIndex.set(0); reload()">
      <option value="">Any check result</option><option value="PASS">Passed</option><option value="REVIEW">Needs a look</option><option value="FAIL">Failed</option><option value="UNKNOWN">Unreadable</option>
    </select>
    <select class="pk-select" [ngModel]="status()" (ngModelChange)="status.set($event); pageIndex.set(0); reload()">
      <option value="">All packs</option><option value="Complete">Complete</option><option value="Incomplete">Missing something</option>
    </select>
    <select class="pk-select" [ngModel]="source()" (ngModelChange)="source.set($event); pageIndex.set(0); reload()">
      <option value="">Scanned, assembled & batch</option><option value="Scanned">Scanned</option><option value="Assembled">Assembled</option><option value="Batch">Split from a batch scan</option>
    </select>
    <span class="pk-spacer"></span>
    <button mat-stroked-button type="button" (click)="create()"><mat-icon>auto_awesome_motion</mat-icon> Create pack</button>
    <button mat-stroked-button type="button" (click)="batch()" matTooltip="Drop one or many scans (PDF / JPG / PNG) — we split and group the pages into packs, you check the summary and save them all"><mat-icon>call_split</mat-icon> Batch upload</button>
    <button mat-flat-button color="primary" type="button" (click)="upload()"><mat-icon>upload_file</mat-icon> Upload scanned pack</button>
  </div>

  <!-- What a pack is -->
  <div class="pk-legend">
    @for (k of kinds; track k.key) { <span class="pk-legend__i" [matTooltip]="k.hint"><mat-icon>{{ k.icon }}</mat-icon> {{ k.label }}</span> }
    @if (summary(); as s) { <span class="pk-legend__missing">Most often missing: <b>{{ mostMissing(s) }}</b></span> }
  </div>

  <!-- Table -->
  <div class="pk-table-wrap">
    @if (loading()) { <div class="pk-loading"><mat-spinner diameter="28"></mat-spinner></div> }
    @if (!loading() && rows().length === 0) {
      <div class="pk-empty">
        <mat-icon>inventory_2</mat-icon>
        <h3>No packs {{ search() || company() || status() ? 'match' : 'yet' }}</h3>
        <p>{{ search() || company() || status() ? 'Try a different search or clear the filters.' : 'Upload a scanned pack — we read the invoice number off it, you confirm, and Sage fills the rest.' }}</p>
        @if (!(search() || company() || status())) { <button mat-flat-button color="primary" type="button" (click)="upload()"><mat-icon>upload_file</mat-icon> Upload scanned pack</button> }
      </div>
    }
    @if (rows().length) {
      <table class="pk-table">
        <thead><tr>
          <th>Pack</th><th>Invoice</th><th>Customer</th><th>Order no.</th><th class="num">Total</th><th>Contents</th><th>Checks</th><th>Added</th><th></th>
        </tr></thead>
        <tbody>
          @for (p of rows(); track p.id) {
            <tr [class.expanded]="expanded() === p.id">
              <td>
                <div class="pk-cell-co">
                  <img class="row-logo" [src]="logo(p.company)" [alt]="p.company || ''" [matTooltip]="name(p.company)" />
                  <div><b class="mono">{{ p.packNumber }}</b><small>{{ p.source }}</small></div>
                </div>
              </td>
              <td>
                <button type="button" class="inv-link mono" (click)="openInvoice(p)" matTooltip="Invoice details">{{ p.invoiceNumber }}</button>
                @if (!p.inSage) { <mat-icon class="pk-flag" matTooltip="Not in the Sage sales history yet">help_outline</mat-icon> }
                @if (p.invoiceDate) { <small class="pk-sub">{{ p.invoiceDate | date:'d MMM yyyy' }}</small> }
              </td>
              <td><div class="pk-cust"><b>{{ p.customerName || '—' }}</b><small class="mono">{{ p.customerNumber || '' }}</small></div></td>
              <td><div class="pk-cust"><span class="mono">{{ p.orderNumber || '—' }}</span>@if (p.confirmationNumber) { <small class="mono">{{ p.confirmationNumber }}</small> }</div></td>
              <td class="num">{{ p.invoiceTotal != null ? ('R ' + (p.invoiceTotal | number:'1.2-2')) : '—' }}</td>
              <td>
                <div class="pk-contents" [class.complete]="p.status === 'Complete'">
                  <mat-icon [class.on]="p.contents.deliveryNote" matTooltip="Delivery note">local_shipping</mat-icon>
                  <mat-icon [class.on]="p.contents.taxInvoice" matTooltip="Tax invoice">receipt_long</mat-icon>
                  <mat-icon [class.on]="p.contents.orderConfirmation" matTooltip="Order confirmation">task_alt</mat-icon>
                  <mat-icon [class.on]="p.contents.orderEmail" matTooltip="Customer order e-mail">mail</mat-icon>
                  <mat-icon [class.on]="p.contents.orderForm" matTooltip="Order form">description</mat-icon>
                </div>
              </td>
              <td>
                <button type="button" class="pk-vstat" [class]="'pk-vstat ' + (p.validationStatus || 'UNKNOWN').toLowerCase()" (click)="toggleExpand(p)" [matTooltip]="validationTip(p)">
                  <mat-icon>{{ vIcon(p.validationStatus) }}</mat-icon> {{ vLabel(p.validationStatus) }}
                </button>
                @if (p.proofOfDelivery) { <mat-icon class="pk-mini ok" matTooltip="Signed / stamped delivery note">fact_check</mat-icon> }
                @if (p.partDelivery) { <mat-icon class="pk-mini" matTooltip="Part delivery">call_split</mat-icon> }
                @if (p.amendedOrder) { <mat-icon class="pk-mini" matTooltip="Amended order">edit_note</mat-icon> }
              </td>
              <td><div class="pk-cust"><span>{{ p.uploadedAt | date:'d MMM yyyy' }}</span><small>{{ p.uploadedByName || '' }}</small></div></td>
              <td class="actions">
                <button mat-icon-button type="button" (click)="preview(p)" matTooltip="Preview pack here"><mat-icon>visibility</mat-icon></button>
                <button mat-icon-button type="button" (click)="edit(p)" matTooltip="Edit invoice / order / customer / contents"><mat-icon>edit</mat-icon></button>
                <button mat-icon-button type="button" (click)="view(p)" matTooltip="Open pack PDF in new tab"><mat-icon>open_in_new</mat-icon></button>
                <button mat-icon-button type="button" [matMenuTriggerFor]="menu" matTooltip="More"><mat-icon>more_vert</mat-icon></button>
                <mat-menu #menu="matMenu">
                  <button mat-menu-item (click)="edit(p)"><mat-icon>edit</mat-icon> Edit details</button>
                  <button mat-menu-item (click)="download(p)"><mat-icon>download</mat-icon> Download</button>
                  <button mat-menu-item (click)="toggleExpand(p)"><mat-icon>{{ expanded() === p.id ? 'unfold_less' : 'unfold_more' }}</mat-icon> {{ expanded() === p.id ? 'Hide details' : 'Details & contents' }}</button>
                  <button mat-menu-item (click)="openInvoice(p)"><mat-icon>receipt_long</mat-icon> Invoice details</button>
                  <button mat-menu-item (click)="reanalyse(p)"><mat-icon>refresh</mat-icon> Re-run pack checks</button>
                  @if (p.customerNumber && p.company) { <button mat-menu-item (click)="customer360(p)"><mat-icon>person_search</mat-icon> Customer 360</button> }
                  <button mat-menu-item class="danger" (click)="remove(p)"><mat-icon>delete</mat-icon> Delete pack</button>
                </mat-menu>
              </td>
            </tr>
            @if (expanded() === p.id) {
              <tr class="pk-detail"><td colspan="9">
                <div class="pk-detail__grid">
                  <div>
                    <h4>Pack checks</h4>
                    @if (p.validation; as v) {
                      <ul class="pk-rules">
                        @for (r of v.rules; track r.code) { <li [class.ok]="r.pass"><mat-icon>{{ r.pass ? 'check_circle' : 'cancel' }}</mat-icon><span><b>{{ r.code }}</b> {{ r.title }}<br><small>{{ r.detail }}</small></span></li> }
                        @for (w of v.warnings; track w) { <li class="warn"><mat-icon>warning_amber</mat-icon><span>{{ w }}</span></li> }
                        @for (n of v.notes; track n) { <li class="note"><mat-icon>info</mat-icon><span>{{ n }}</span></li> }
                      </ul>
                      <h4>Pages</h4>
                      <table class="pk-pages">
                        <thead><tr><th>#</th><th>Type</th><th>Invoice</th><th>Order</th><th>Conf.</th><th></th></tr></thead>
                        <tbody>
                          @for (pg of v.pages; track pg.page) {
                            <tr [class.dup]="pg.duplicate">
                              <td>{{ pg.page }}</td>
                              <td><span class="pk-ptype" [class.unk]="pg.type === 'UNK'">{{ pg.type === 'UNK' ? '?' : pg.type }}</span> <small>{{ typeName(pg.type) }}</small></td>
                              <td class="mono">{{ pg.invoiceNumber || '' }}</td>
                              <td class="mono" [matTooltip]="pg.orderNumberRaw || ''">{{ pg.orderNumber || '' }}</td>
                              <td class="mono">{{ pg.confirmationNumber || '' }}</td>
                              <td class="pk-pflags">@if (pg.signed || pg.stamped) { <mat-icon matTooltip="Signed / stamped">draw</mat-icon> }@if (pg.partDelivery) { <mat-icon matTooltip="Part delivery">call_split</mat-icon> }@if (pg.amended) { <mat-icon matTooltip="Amended">edit_note</mat-icon> }@if (pg.duplicate) { <mat-icon matTooltip="Duplicate — counted once">content_copy</mat-icon> }@if (pg.textLength < 40) { <mat-icon matTooltip="Almost no text read">visibility_off</mat-icon> }</td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    } @else {
                      <p class="pk-muted">No page analysis stored for this pack. <button type="button" class="inv-link" (click)="reanalyse(p)">Run the checks now</button>.</p>
                    }
                  </div>
                  <div>
                    <h4>Contents checklist</h4>
                    <div class="pk-checks">
                      @for (k of kinds; track k.key) {
                        <label class="pk-check" [class.on]="hasKind(p, k.key)">
                          <input type="checkbox" hidden [checked]="hasKind(p, k.key)" (change)="setKind(p, k.key, $any($event.target).checked)" />
                          <mat-icon>{{ hasKind(p, k.key) ? 'check_box' : 'check_box_outline_blank' }}</mat-icon> {{ k.label }}
                        </label>
                      }
                    </div>
                    @if (p.notes) { <p class="pk-notes"><mat-icon>sticky_note_2</mat-icon> {{ p.notes }}</p> }
                  </div>
                  <div>
                    <h4>File</h4>
                    <dl class="pk-dl">
                      <dt>Original name</dt><dd>{{ p.originalFileName || p.fileName }}</dd>
                      <dt>Size</dt><dd>{{ fmtSize(p.size) }}</dd>
                      <dt>Pages</dt><dd>{{ p.pageCount || '—' }}</dd>
                      <dt>Invoice confirmed</dt><dd>{{ p.invoiceVerified ? 'Yes — read off the scan and confirmed by ' + (p.uploadedByName || 'the uploader') : 'No' }}</dd>
                    </dl>
                    @if (p.files?.length) {
                      <h4>Component documents</h4>
                      <ul class="pk-files">
                        @for (f of p.files; track f.id) {
                          <li><mat-icon>{{ kindIcon(f.kind) }}</mat-icon> <span>{{ kindLabel(f.kind) }}</span> <small>{{ f.originalFileName }} · {{ fmtSize(f.size) }}</small>
                            <button mat-icon-button type="button" (click)="previewPart(p, f)" matTooltip="Preview"><mat-icon>visibility</mat-icon></button>
                            <button mat-icon-button type="button" (click)="viewPart(p, f.id)" matTooltip="Open in new tab"><mat-icon>open_in_new</mat-icon></button></li>
                        }
                      </ul>
                    }
                  </div>
                </div>
              </td></tr>
            }
          }
        </tbody>
      </table>
      <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[25, 50, 100]" (page)="onPage($event)" showFirstLastButtons></mat-paginator>
    }
  </div>
  `,
  styles: [`
    :host { display:block; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing:.02em; }
    .pk-companies { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:12px; margin-bottom: var(--space-4, 16px); }
    .pk-co { display:flex; align-items:center; gap:14px; text-align:left; font: inherit; color: inherit; cursor:pointer; background: var(--color-surface); border:2px solid var(--color-line); border-radius: 16px; padding:12px 16px; transition: border-color .15s, box-shadow .15s, opacity .15s, transform .15s;
      &:hover { box-shadow: 0 6px 18px rgba(0,0,0,.08); transform: translateY(-1px); }
      &.active { border-color: var(--color-primary); background: var(--color-primary-soft); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
      &.dim { opacity:.55; } }
    .pk-logo { width:56px; height:56px; border-radius:50%; object-fit:cover; flex:0 0 56px; background:#f3f4f6; box-shadow:0 1px 3px rgba(0,0,0,.12); &--all { display:grid; place-items:center; color: var(--color-primary); mat-icon { font-size:28px; width:28px; height:28px; } } }
    .pk-co-body { flex:1; min-width:0; display:flex; flex-direction:column; small { color: var(--color-text-muted); } }
    .pk-co-top { display:flex; justify-content:space-between; gap:8px; b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } > span { font-weight:800; white-space:nowrap; } }
    .pk-kpis { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap:10px; margin-bottom: var(--space-4, 16px); }
    .pk-kpi { display:flex; flex-direction:column; padding:10px 14px; border-radius:12px; background: var(--color-surface); border:1px solid var(--color-line);
      &__v { font-size:1.4rem; font-weight:800; } &__l { font-size:.78rem; color: var(--color-text-muted); }
      &.ok .pk-kpi__v { color:#059669; } &.warn .pk-kpi__v { color:#d97706; } }
    .pk-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:10px; }
    .pk-search { display:flex; align-items:center; gap:8px; flex:1 1 280px; max-width:460px; padding:0 12px; border:1px solid var(--color-line); border-radius:10px; background: var(--color-surface); mat-icon { color: var(--color-text-muted); }
      input { flex:1; border:0; background:transparent; padding:10px 0; font: inherit; color: inherit; outline:none; } }
    .pk-select { font: inherit; padding:9px 10px; border:1px solid var(--color-line); border-radius:10px; background: var(--color-surface); color: inherit; }
    .pk-spacer { flex:1; }
    .pk-legend { display:flex; flex-wrap:wrap; align-items:center; gap:8px 14px; margin-bottom:12px; font-size:.82rem; color: var(--color-text-muted);
      &__i { display:inline-flex; align-items:center; gap:4px; mat-icon { font-size:16px; width:16px; height:16px; } } &__missing { margin-left:auto; b { color: var(--color-text); } } }
    .pk-table-wrap { background: var(--color-surface); border:1px solid var(--color-line); border-radius:14px; overflow:hidden; }
    .pk-loading { display:flex; justify-content:center; padding:32px; }
    .pk-empty { text-align:center; padding:48px 20px; color: var(--color-text-muted); mat-icon { font-size:44px; width:44px; height:44px; color: var(--color-primary); } h3 { margin:10px 0 4px; color: var(--color-text); } p { margin:0 0 14px; } }
    .pk-table { width:100%; border-collapse:collapse; font-size:.9rem;
      th { text-align:left; font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; color: var(--color-text-muted); padding:10px 12px; border-bottom:1px solid var(--color-line); background: var(--color-surface-2, #f9fafb); }
      td { padding:10px 12px; border-bottom:1px solid var(--color-line); vertical-align:middle; }
      tr.expanded td { background: var(--color-primary-soft); }
      .num { text-align:right; white-space:nowrap; } .actions { white-space:nowrap; text-align:right; } }
    .pk-cell-co { display:flex; align-items:center; gap:10px; > div { display:flex; flex-direction:column; small { color: var(--color-text-muted); } } }
    .row-logo { width:30px; height:30px; border-radius:50%; object-fit:cover; background:#f3f4f6; flex:0 0 30px; }
    .inv-link { font: inherit; font-weight:700; color: var(--color-primary); background:none; border:0; padding:0; cursor:pointer; text-decoration:underline dotted; &:hover { text-decoration:underline; } }
    .pk-flag { font-size:16px; width:16px; height:16px; vertical-align:-3px; color:#d97706; margin-left:4px; }
    .pk-sub { display:block; color: var(--color-text-muted); font-size:.78rem; }
    .pk-cust { display:flex; flex-direction:column; b { font-weight:600; } small { color: var(--color-text-muted); font-size:.78rem; } }
    .pk-contents { display:inline-flex; gap:3px; padding:4px 6px; border-radius:999px; background: var(--color-surface-2, #f3f4f6);
      mat-icon { font-size:18px; width:18px; height:18px; color:#cbd5e1; &.on { color:#059669; } } &.complete { background:#ecfdf5; } }
    .pk-detail td { background: var(--color-surface-2, #f9fafb) !important; }
    .pk-detail__grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; padding:6px 4px; h4 { margin:0 0 8px; font-size:.85rem; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-muted); } }
    .pk-checks { display:flex; flex-wrap:wrap; gap:8px; }
    .pk-check { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:999px; border:1px solid var(--color-line); background: var(--color-surface); font-size:.85rem; font-weight:600; cursor:pointer; color: var(--color-text-muted);
      mat-icon { font-size:18px; width:18px; height:18px; } &.on { border-color:#10b981; background:#ecfdf5; color:#065f46; } }
    .pk-notes { display:flex; align-items:flex-start; gap:6px; margin:12px 0 0; font-size:.88rem; mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-text-muted); } }
    .pk-dl { display:grid; grid-template-columns: auto 1fr; gap:4px 14px; margin:0 0 12px; font-size:.88rem; dt { color: var(--color-text-muted); } dd { margin:0; } }
    .pk-files { list-style:none; margin:0; padding:0; li { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:.88rem; mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-primary); } small { color: var(--color-text-muted); flex:1; } } }
    .danger { color:#b91c1c; }
    .pk-kpi.bad .pk-kpi__v { color:#dc2626; }
    .pk-vstat { display:inline-flex; align-items:center; gap:4px; font: inherit; font-size:.75rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:3px 9px 3px 6px; border-radius:999px; border:1px solid transparent; cursor:pointer; background:#f3f4f6; color:#6b7280;
      mat-icon { font-size:16px; width:16px; height:16px; }
      &.pass { background:#ecfdf5; color:#065f46; border-color:#a7f3d0; } &.review { background:#fffbeb; color:#92400e; border-color:#fde68a; } &.fail { background:#fef2f2; color:#991b1b; border-color:#fecaca; } }
    .pk-mini { font-size:16px; width:16px; height:16px; vertical-align:-3px; margin-left:4px; color:#9ca3af; &.ok { color:#059669; } }
    .pk-rules { list-style:none; margin:0 0 14px; padding:0; display:flex; flex-direction:column; gap:6px; font-size:.86rem;
      li { display:flex; align-items:flex-start; gap:8px; color:#991b1b; mat-icon { font-size:18px; width:18px; height:18px; flex:0 0 auto; margin-top:1px; } small { color: var(--color-text-muted); }
        &.ok { color:#065f46; } &.warn { color:#92400e; } &.note { color: var(--color-text-muted); } } }
    .pk-pages { width:100%; border-collapse:collapse; font-size:.82rem; margin-bottom:8px;
      th { text-align:left; font-weight:700; color: var(--color-text-muted); padding:4px 6px; border-bottom:1px solid var(--color-line); background:transparent; font-size:.72rem; }
      td { padding:4px 6px; border-bottom:1px dashed var(--color-line); background:transparent !important; } tr.dup td { opacity:.5; }
      .pk-ptype { display:inline-block; min-width:34px; text-align:center; font-weight:800; font-size:.72rem; padding:1px 6px; border-radius:6px; background: var(--color-primary-soft); color: var(--color-primary); &.unk { background:#f3f4f6; color:#9ca3af; } }
      small { color: var(--color-text-muted); } .pk-pflags mat-icon { font-size:16px; width:16px; height:16px; color:#6b7280; margin-right:2px; } }
    .pk-muted { color: var(--color-text-muted); font-size:.88rem; }
    @media (max-width: 1100px) { .pk-companies, .pk-kpis { grid-template-columns: repeat(3, minmax(0,1fr)); } }
    @media (max-width: 720px) { .pk-companies, .pk-kpis { grid-template-columns: repeat(2, minmax(0,1fr)); } .pk-detail__grid { grid-template-columns:1fr; } }
  `]
})
export class FinancePacksComponent implements OnInit {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private router = inject(Router);
  private api = environment.apiUrl;

  kinds = PACK_KINDS;
  companyCodes = ['PMT', 'ACM', 'PHT', 'SBT'];
  names = COMPANY_NAMES;
  logo = companyLogo;
  name = companyName;

  summary = signal<Summary | null>(null);
  rows = signal<Pack[]>([]);
  total = signal(0);
  loading = signal(false);
  pageIndex = signal(0);
  pageSize = signal(50);
  search = signal('');
  company = signal('');
  status = signal('');
  source = signal('');
  validation = signal('');
  expanded = signal<number | null>(null);

  ngOnInit(): void { this.loadSummary(); this.reload(); }

  loadSummary(): void {
    this.http.get<Summary>(`${this.api}/finance/packs/summary`).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  reload(): void {
    this.loading.set(true);
    let params = new HttpParams().set('page', this.pageIndex() + 1).set('pageSize', this.pageSize());
    if (this.company()) params = params.set('company', this.company());
    if (this.status()) params = params.set('status', this.status());
    if (this.source()) params = params.set('source', this.source());
    if (this.validation()) params = params.set('validation', this.validation());
    const q = this.search().trim(); if (q) params = params.set('search', q);
    this.http.get<{ data: Pack[]; total: number }>(`${this.api}/finance/packs`, { params }).subscribe({
      next: r => { this.rows.set(r.data ?? []); this.total.set(r.total ?? 0); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error("Couldn't load packs. Try again."); },
    });
  }

  private searchTimer: any;
  onSearch(v: string): void { this.search.set(v ?? ''); this.pageIndex.set(0); clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.reload(), 300); }
  onPage(e: PageEvent): void { this.pageIndex.set(e.pageIndex); this.pageSize.set(e.pageSize); this.reload(); }
  pickCompany(c: string): void { this.company.set(c); this.pageIndex.set(0); this.reload(); }
  countFor(c: string): number { return this.summary()?.byCompany.find(b => b.company === c)?.count ?? 0; }
  mostMissing(s: Summary): string {
    const m = s.missing; const pairs: [string, number][] = [['Delivery note', m.deliveryNote], ['Tax invoice', m.taxInvoice], ['Order confirmation', m.orderConfirmation], ['Customer order e-mail', m.orderEmail], ['Order form', m.orderForm]];
    const top = pairs.sort((a, b) => b[1] - a[1])[0];
    return top && top[1] > 0 ? `${top[0]} (${top[1]})` : 'nothing — all packs complete';
  }

  upload(): void { PackUploadDialogComponent.open(this.dialog, { mode: 'scan' }).afterClosed().subscribe(r => { if (r) { this.loadSummary(); this.reload(); } }); }
  create(): void { PackUploadDialogComponent.open(this.dialog, { mode: 'assemble' }).afterClosed().subscribe(r => { if (r) { this.loadSummary(); this.reload(); } }); }
  batch(): void { PackBatchDialogComponent.open(this.dialog).afterClosed().subscribe(r => { if (r) { this.loadSummary(); this.reload(); } }); }

  preview(p: Pack): void {
    PackPreviewDialogComponent.open(this.dialog, {
      url: `${this.api}/finance/packs/${p.id}/file`,
      title: `${p.packNumber} · ${p.invoiceNumber}`,
      subtitle: [p.customerName, p.orderNumber ? `Order ${p.orderNumber}` : null, p.pageCount ? `${p.pageCount} page(s)` : null].filter(Boolean).join(' · '),
      fileName: p.originalFileName || p.fileName || `${p.invoiceNumber}-pack.pdf`,
    });
  }
  previewPart(p: Pack, f: { id: number; kind: string; originalFileName?: string }): void {
    PackPreviewDialogComponent.open(this.dialog, { url: `${this.api}/finance/packs/${p.id}/files/${f.id}`, title: `${this.kindLabel(f.kind)} · ${p.invoiceNumber}`, subtitle: f.originalFileName, fileName: f.originalFileName });
  }
  view(p: Pack): void {
    this.http.get(`${this.api}/finance/packs/${p.id}/file`, { responseType: 'blob' }).subscribe({
      next: b => window.open(URL.createObjectURL(b), '_blank'),
      error: () => this.toast.error("Couldn't open the pack file."),
    });
  }
  download(p: Pack): void {
    this.http.get(`${this.api}/finance/packs/${p.id}/file`, { params: { download: true }, responseType: 'blob' }).subscribe({
      next: b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = p.originalFileName || p.fileName || `${p.invoiceNumber}-pack.pdf`; a.click(); URL.revokeObjectURL(a.href); },
      error: () => this.toast.error("Couldn't download the pack."),
    });
  }
  viewPart(p: Pack, fileId: number): void {
    this.http.get(`${this.api}/finance/packs/${p.id}/files/${fileId}`, { responseType: 'blob' }).subscribe({
      next: b => window.open(URL.createObjectURL(b), '_blank'),
      error: () => this.toast.error("Couldn't open that document."),
    });
  }

  openInvoice(p: Pack): void { InvoiceDetailDialogComponent.open(this.dialog, { number: p.invoiceNumber, company: p.company ?? undefined }); }

  edit(p: Pack): void {
    PackEditDialogComponent.open(this.dialog, p).afterClosed().subscribe((u: Pack | undefined) => {
      if (!u) return;
      this.rows.update(rs => rs.map(x => x.id === p.id ? { ...x, ...u } : x));
      this.loadSummary();
    });
  }

  customer360(p: Pack): void {
    this.http.get<{ id: number }>(`${this.api}/customers/master/resolve`, { params: { company: p.company!, code: p.customerNumber! } }).subscribe({
      next: m => this.router.navigate(['/customers', m.id]),
      error: () => this.toast.warn('No customer master record for this account yet.'),
    });
  }

  toggleExpand(p: Pack): void {
    if (this.expanded() === p.id) { this.expanded.set(null); return; }
    this.expanded.set(p.id);
    if (!p.files) this.http.get<{ pack: Pack }>(`${this.api}/finance/packs/${p.id}`).subscribe({ next: r => this.rows.update(rs => rs.map(x => x.id === p.id ? { ...x, ...r.pack } : x)), error: () => {} });
  }

  private kindFlag: Record<string, keyof PackContents> = { DeliveryNote: 'deliveryNote', TaxInvoice: 'taxInvoice', OrderConfirmation: 'orderConfirmation', OrderEmail: 'orderEmail', OrderForm: 'orderForm' };
  hasKind(p: Pack, kind: string): boolean { return !!p.contents?.[this.kindFlag[kind]]; }
  setKind(p: Pack, kind: string, on: boolean): void {
    const body: any = {}; body[`has${kind}`] = on;
    this.http.put<Pack>(`${this.api}/finance/packs/${p.id}`, body).subscribe({
      next: u => { this.rows.update(rs => rs.map(x => x.id === p.id ? { ...x, ...u } : x)); this.loadSummary(); },
      error: () => this.toast.error("Couldn't update the pack."),
    });
  }
  remove(p: Pack): void {
    if (!confirm(`Delete pack ${p.packNumber} for ${p.invoiceNumber}? The PDF will be removed from the server.`)) return;
    this.http.delete(`${this.api}/finance/packs/${p.id}`).subscribe({
      next: () => { this.rows.update(rs => rs.filter(x => x.id !== p.id)); this.total.update(t => t - 1); this.loadSummary(); this.toast.info(`Pack ${p.packNumber} deleted.`); },
      error: e => this.toast.error(e?.error?.error || "Couldn't delete the pack."),
    });
  }
  kindIcon(k: string): string { return PACK_KINDS.find(x => x.key === k)?.icon ?? 'insert_drive_file'; }
  kindLabel(k: string): string { return PACK_KINDS.find(x => x.key === k)?.label ?? k; }
  typeName(code: string): string { return PACK_KINDS.find(x => x.code === code)?.label ?? (code === 'UNK' ? 'Unclassified' : code); }
  vIcon(s?: string | null): string { return s === 'PASS' ? 'verified' : s === 'FAIL' ? 'cancel' : s === 'REVIEW' ? 'rule' : 'help'; }
  vLabel(s?: string | null): string { return s === 'PASS' ? 'Pass' : s === 'FAIL' ? 'Fail' : s === 'REVIEW' ? 'Review' : 'Unread'; }
  validationTip(p: Pack): string {
    const v = p.validation; if (!v) return 'No page analysis yet — click to see details';
    const failed = v.rules.filter(r => !r.pass).map(r => `${r.code}: ${r.detail}`);
    return failed.length ? failed.join('\n') : (v.warnings.length ? v.warnings.join('\n') : 'All three pack rules passed');
  }
  reanalyse(p: Pack): void {
    this.toast.info('Re-reading the pack…');
    this.http.post<Pack>(`${this.api}/finance/packs/${p.id}/reanalyse`, {}).subscribe({
      next: u => { this.rows.update(rs => rs.map(x => x.id === p.id ? { ...x, ...u } : x)); this.expanded.set(p.id); this.loadSummary(); },
      error: e => this.toast.error(e?.error?.error || "Couldn't re-run the pack checks."),
    });
  }
  fmtSize(b: number): string { return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }
}
