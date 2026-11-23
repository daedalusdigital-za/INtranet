import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export interface ReconPreviewData { sheetUrl: string; fileUrl: string; title: string; subtitle?: string; fileName?: string; }

interface SheetGrid { name: string; rows: string[][]; }
interface SheetResponse {
  id: number; docType: string; title: string; originalFileName?: string; size: number; uploadedByName?: string; uploadedAt?: string;
  extracted: { amount?: number; invoiceNumber?: string; invoiceNumbers: string[]; accountNumber?: string; vatNumber?: string; documentDate?: string;
    amounts: { label: string; value: string }[]; matchesSchedule?: boolean | null; scheduleAmount?: number; scheduleInvoices?: string; supplier?: string; };
  sheets: SheetGrid[];
}

/** In-page preview of a spreadsheet document (supplier recon / schedule): the grid plus what the system read off it. */
@Component({
  selector: 'app-recon-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
  <div class="rp">
    <header class="rp__head">
      <mat-icon class="rp__icon">table_view</mat-icon>
      <div class="rp__title"><b>{{ data.title }}</b>@if (data.subtitle) { <small>{{ data.subtitle }}</small> }</div>
      <button mat-icon-button type="button" (click)="download()" matTooltip="Download the file"><mat-icon>download</mat-icon></button>
      <button mat-icon-button type="button" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>

    @if (loading()) { <div class="rp__state"><mat-spinner diameter="32"></mat-spinner></div> }
    @else if (error()) { <div class="rp__state rp__state--err"><mat-icon>error_outline</mat-icon><p>{{ error() }}</p></div> }
    @else if (res()) { @if (res(); as r) {
      <section class="rp__facts">
        <h4><mat-icon>auto_awesome</mat-icon> What the system read off this recon</h4>
        <div class="facts">
          <div class="fact">
            <span class="k">Amount on recon</span>
            <span class="v">{{ r.extracted.amount != null ? ('R ' + (r.extracted.amount | number:'1.2-2')) : '—' }}</span>
            @if (r.extracted.scheduleAmount != null) { <small>schedule pays R {{ r.extracted.scheduleAmount | number:'1.2-2' }} · for information only, layouts vary</small> }
          </div>
          <div class="fact">
            <span class="k">Invoice numbers found</span>
            <span class="v chips">@for (n of r.extracted.invoiceNumbers; track n) { <span class="chip" [class.on]="onSchedule(n)">{{ n }}</span> } @empty { — }</span>
            @if (r.extracted.scheduleInvoices) { <small>schedule lists {{ r.extracted.scheduleInvoices }}</small> }
          </div>
          <div class="fact"><span class="k">Latest date</span><span class="v">{{ r.extracted.documentDate ? (r.extracted.documentDate | date:'dd MMM yyyy') : '—' }}</span></div>
          <div class="fact"><span class="k">Bank account seen</span><span class="v">{{ r.extracted.accountNumber || '—' }}</span></div>
          <div class="fact"><span class="k">VAT number seen</span><span class="v">{{ r.extracted.vatNumber || '—' }}</span></div>
          @if (r.extracted.amounts.length) {
            <div class="fact wide"><span class="k">Totals on the sheet</span><span class="v chips">@for (a of r.extracted.amounts; track $index) { <span class="chip">{{ a.label }}: {{ a.value }}</span> }</span></div>
          }
        </div>
        <small class="meta">{{ r.originalFileName }} · {{ (r.size / 1024) | number:'1.0-0' }} KB · uploaded by {{ r.uploadedByName }} {{ r.uploadedAt | date:'dd MMM HH:mm' }}</small>
      </section>

      <section class="rp__grid">
        @if (r.sheets.length > 1) {
          <div class="tabs">@for (s of r.sheets; track s.name; let i = $index) { <button [class.on]="tab() === i" (click)="tab.set(i)">{{ s.name }} <span>{{ s.rows.length }}</span></button> }</div>
        }
        @if (r.sheets[tab()]; as s) {
          <div class="scroll">
            <table>
              <tbody>
                @for (row of s.rows; track $index; let ri = $index) {
                  <tr [class.hdr]="ri === 0">@for (c of row; track $index) { <td [class.num]="isNum(c)" [class.hit]="hit(c)">{{ c }}</td> }</tr>
                }
              </tbody>
            </table>
            @if (s.rows.length >= 300) { <p class="more">Showing the first 300 rows — download the file to see everything.</p> }
          </div>
        } @else { <div class="rp__state"><p>The spreadsheet has no data.</p></div> }
      </section>
    } }
  </div>
  `,
  styles: [`
    :host { display: block; }
    .rp { display: flex; flex-direction: column; height: 92vh; }
    .rp__head { display: flex; align-items: center; gap: 10px; padding: 10px 12px 10px 16px; border-bottom: 1px solid var(--color-line); }
    .rp__icon { color: #15803d; }
    .rp__title { flex: 1; min-width: 0; display: flex; flex-direction: column; b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } small { color: var(--color-text-3); font-size: .78rem; } }
    .rp__state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--color-text-3); &--err mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--color-danger); } p { margin: 0; } }
    .rp__facts { padding: 12px 16px; border-bottom: 1px solid var(--color-line); background: var(--color-surface-2);
      h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: var(--text-sm); color: var(--color-text-2); mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); } }
      .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
      .fact { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; min-width: 0;
        .k { font-size: var(--text-xs); color: var(--color-text-3); text-transform: uppercase; letter-spacing: .03em; } .v { font-weight: 600; font-size: var(--text-md); word-break: break-word; } small { color: var(--color-text-3); font-size: var(--text-xs); }
        &.ok { border-color: var(--color-ok); .v { color: var(--color-ok); } } &.bad { border-color: var(--color-danger); .v { color: var(--color-danger); } } &.wide { grid-column: 1 / -1; } }
      .chips { display: flex; flex-wrap: wrap; gap: 4px; font-weight: 500; font-size: var(--text-sm); }
      .chip { padding: 1px 8px; border-radius: 999px; background: var(--color-surface-3); font-family: var(--font-mono); font-size: var(--text-xs); &.on { background: var(--color-ok-soft); color: var(--color-ok); } }
      .meta { display: block; margin-top: 8px; color: var(--color-text-3); font-size: var(--text-xs); } }
    .rp__grid { flex: 1; min-height: 0; display: flex; flex-direction: column;
      .tabs { display: flex; gap: 2px; padding: 6px 12px 0; border-bottom: 1px solid var(--color-line);
        button { font: inherit; font-size: var(--text-sm); padding: 6px 12px; border: 0; border-bottom: 2px solid transparent; background: none; cursor: pointer; color: var(--color-text-2); span { color: var(--color-text-3); font-size: var(--text-xs); margin-left: 4px; } &.on { border-bottom-color: var(--color-primary); color: var(--color-text); font-weight: 600; } } }
      .scroll { flex: 1; overflow: auto; padding: 0 0 8px; }
      table { border-collapse: collapse; font-size: var(--text-xs); min-width: 100%; }
      td { border: 1px solid var(--color-line); padding: 3px 8px; white-space: nowrap; max-width: 280px; overflow: hidden; text-overflow: ellipsis; &.num { text-align: right; font-family: var(--font-mono); } &.hit { background: var(--color-ok-soft); font-weight: 600; } }
      tr.hdr td { background: var(--color-surface-2); font-weight: 700; position: sticky; top: 0; }
      .more { margin: 8px 12px 0; color: var(--color-text-3); font-size: var(--text-xs); } }
  `]
})
export class ReconPreviewDialogComponent {
  private http = inject(HttpClient);
  data = inject<ReconPreviewData>(MAT_DIALOG_DATA);

  static open(dialog: MatDialog, data: ReconPreviewData) {
    return dialog.open(ReconPreviewDialogComponent, { width: 'min(1200px, 96vw)', maxWidth: '96vw', maxHeight: '96vh', data, autoFocus: false });
  }

  loading = signal(true);
  error = signal('');
  res = signal<SheetResponse | null>(null);
  tab = signal(0);
  private scheduleInv = new Set<string>();

  constructor() {
    this.http.get<SheetResponse>(this.data.sheetUrl).subscribe({
      next: r => { this.res.set(r); this.scheduleInv = new Set((r.extracted.scheduleInvoices || '').split(/[,;\s/]+/).map(s => s.toUpperCase()).filter(Boolean)); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || "Couldn't read the spreadsheet."); },
    });
  }

  onSchedule(n: string): boolean { const u = n.toUpperCase(); return [...this.scheduleInv].some(s => s === u || s.endsWith(u) || u.endsWith(s)); }
  isNum(c: string): boolean { return /^-?R?\s?[\d\s]*[.,]?\d+(\.\d+)?$/.test((c || '').trim()) && /\d/.test(c); }
  /** Highlight cells that hold the amount or an invoice number we recognised. */
  hit(c: string): boolean {
    const r = this.res(); if (!r || !c) return false;
    const u = c.toUpperCase();
    if (r.extracted.amount != null && this.isNum(c)) { const v = parseFloat(c.replace(/[^\d.-]/g, '').replace(/,/g, '.')); if (!isNaN(v) && Math.abs(Math.abs(v) - Math.abs(r.extracted.amount)) < 0.005) return true; }
    return r.extracted.invoiceNumbers.some(n => u.includes(n));
  }
  download(): void {
    this.http.get(this.data.fileUrl, { responseType: 'blob' }).subscribe(b => { const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = this.data.fileName || 'recon.xlsx'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  }
}
