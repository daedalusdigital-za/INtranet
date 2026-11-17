import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RequisitionFormService } from '../../services/requisition-form.service';

export interface RequisitionPreviewData { req: any; }

/** In-page preview of the Rocket Freight requisition form. Print / Save-as-PDF without leaving the page. */
@Component({
  selector: 'app-requisition-preview-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
  <div class="pv">
    <header class="pv__head">
      <mat-icon class="pv__icon">receipt_long</mat-icon>
      <div class="pv__title"><b>Requisition {{ data.req.rfNumber ? 'RF ' + data.req.rfNumber : '' }}</b><small>{{ data.req.paidTo }} · {{ data.req.financeStatus || 'Requested' }}</small></div>
      <button mat-stroked-button type="button" (click)="print()"><mat-icon>picture_as_pdf</mat-icon> Print / Save as PDF</button>
      <button mat-icon-button type="button" (click)="openTab()" matTooltip="Open in new tab"><mat-icon>open_in_new</mat-icon></button>
      <button mat-icon-button type="button" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>
    <div class="pv__body">
      <iframe #frame [srcdoc]="html" title="Requisition form"></iframe>
    </div>
  </div>
  `,
  styles: [`
    :host { display:block; }
    .pv { display:flex; flex-direction:column; height: 92vh; }
    .pv__head { display:flex; align-items:center; gap:10px; padding:10px 12px 10px 16px; border-bottom:1px solid var(--color-line); }
    .pv__icon { color:#033142; }
    .pv__title { flex:1; min-width:0; display:flex; flex-direction:column; b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } small { color: var(--color-text-muted); font-size:.78rem; } }
    .pv__body { flex:1; min-height:0; background:#525659; display:flex; justify-content:center; overflow:auto; padding:16px;
      iframe { width:210mm; max-width:100%; height:297mm; border:0; background:#fff; box-shadow:0 6px 24px rgba(0,0,0,.4); flex-shrink:0; } }
  `]
})
export class RequisitionPreviewDialogComponent {
  private sanitizer = inject(DomSanitizer);
  private form = inject(RequisitionFormService);
  data = inject<RequisitionPreviewData>(MAT_DIALOG_DATA);
  @ViewChild('frame') frame?: ElementRef<HTMLIFrameElement>;

  /** Form HTML with the in-page toolbar hidden (dialog has its own buttons) and no auto-print. */
  html: SafeHtml = this.sanitizer.bypassSecurityTrustHtml(
    this.form.html(this.data.req, false).replace('</style>', '.toolbar{display:none}</style>')
  );

  static open(dialog: MatDialog, req: any) {
    return dialog.open(RequisitionPreviewDialogComponent, { width: 'min(900px, 96vw)', maxWidth: '96vw', maxHeight: '96vh', data: { req }, autoFocus: false });
  }

  print(): void {
    const w = this.frame?.nativeElement.contentWindow;
    if (w) { w.focus(); w.print(); }
  }

  openTab(): void { this.form.open(this.data.req, false); }
}
