import { Injectable, inject } from '@angular/core';
import { ToastService } from '../ui/toast.service';

/**
 * Renders the Rocket Freight "Requisition Form" (petty cash / e-wallet) on the company letterhead.
 * Used by Logistics (where the form is raised) and Finance › Approvals (where it is paid), so both
 * sides see the identical document. The browser's print dialog is how it becomes a PDF ("Save as PDF").
 */
@Injectable({ providedIn: 'root' })
export class RequisitionFormService {
  private toast = inject(ToastService);

  /** Opens the form in a new tab and triggers print. `autoPrint=false` just shows it. */
  open(req: any, autoPrint = true): void {
    const w = window.open('', '_blank');
    if (!w) { this.toast.warn('Pop-up blocked — allow pop-ups to open the form'); return; }
    w.document.write(this.html(req, autoPrint));
    w.document.close();
  }

  html(req: any, autoPrint: boolean): string {
    const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const money = (v: any) => (v && +v > 0) ? 'R ' + (+v).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    const dateStr = req.date ? new Date(req.date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
    const total = (+req.amountEwallet || 0) + (+req.dieselAmount || 0);
    const printedAt = new Date().toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const cancelled = req.status === 'Cancelled';
    const templateUrl = `${window.location.origin}/logos/requisition-template.png`;
    const fin = req.financeStatus || 'Requested';
    const finClass = fin === 'Paid' ? 'paid' : fin === 'Rejected' ? 'rejected' : 'requested';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Requisition ${esc(req.rfNumber) || ''}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 210mm; min-height: 297mm; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #1f2933;
    background: #fff url('${templateUrl}') no-repeat top center;
    background-size: 210mm 297mm;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    padding: 52mm 18mm 30mm 18mm;
  }
  .doc-title-bar { text-align: center; margin-bottom: 16px; }
  .doc-title { font-size: 17px; font-weight: 800; color: #033142; letter-spacing: 2.5px; text-transform: uppercase; }
  .rf-badge { display: inline-block; background: #033142; color: #fff; padding: 7px 20px; border-radius: 20px; font-size: 17px; font-weight: 700; margin-top: 8px; }
  .status { display: inline-block; margin-left: 10px; padding: 3px 14px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; vertical-align: middle; }
  .status.active { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
  .status.cancelled { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
  .fin { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .fin.requested { background: #fff8e1; color: #b26a00; border: 1px solid #ffe082; }
  .fin.paid { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
  .fin.rejected { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
  table.details { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: rgba(255,255,255,0.92); }
  table.details td { padding: 10px 14px; border: 1px solid #cfd6dd; vertical-align: top; }
  table.details td.label { width: 32%; background: rgba(244,246,248,0.95); font-weight: 700; color: #033142; text-transform: uppercase; font-size: 11.5px; letter-spacing: 0.5px; }
  .amount-row td.value { font-size: 17px; font-weight: 700; }
  .total-row td { background: rgba(224,236,240,0.95); font-size: 18px; font-weight: 800; color: #033142; }
  .sign-row { display: table; width: 100%; margin-top: 34px; border-spacing: 18px 0; }
  .sign-box { display: table-cell; width: 33%; text-align: center; }
  .sign-line { border-bottom: 1.5px solid #333; height: 40px; margin-bottom: 6px; }
  .sign-label { font-size: 11px; color: #52606d; text-transform: uppercase; letter-spacing: 0.6px; }
  .print-meta { margin-top: 20px; font-size: 10.5px; color: #52606d; text-align: center; }
  .watermark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 90px; font-weight: 900; color: rgba(198,40,40,0.14); transform: rotate(-20deg); pointer-events: none; }
  .toolbar { position: fixed; top: 10px; right: 10px; display: flex; gap: 8px; }
  .toolbar button { font: inherit; font-size: 13px; padding: 8px 14px; border-radius: 8px; border: 1px solid #033142; background: #033142; color: #fff; cursor: pointer; }
  @page { size: A4; margin: 0; }
  @media print { body { padding: 52mm 18mm 30mm 18mm; } .toolbar { display: none; } }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  ${cancelled ? '<div class="watermark">CANCELLED</div>' : fin === 'Paid' ? '<div class="watermark" style="color:rgba(46,125,50,0.14)">PAID</div>' : ''}
  <div class="doc-title-bar">
    <div class="doc-title">Requisition Form &bull; Petty Cash / E-Wallet</div>
    <span class="rf-badge">RF ${esc(req.rfNumber) || '—'}</span><span class="status ${cancelled ? 'cancelled' : 'active'}">${esc(req.status) || 'Active'}</span>
  </div>

  <table class="details">
    <tr><td class="label">Date</td><td>${esc(dateStr)}</td></tr>
    <tr><td class="label">Paid To</td><td><strong>${esc(req.paidTo) || '—'}</strong></td></tr>
    <tr><td class="label">Cell Number</td><td>${esc(req.cellNumber) || '—'}</td></tr>
    <tr><td class="label">Reason / Description</td><td>${esc(req.reason) || '—'}</td></tr>
    <tr><td class="label">Payment Method</td><td>${esc(req.paymentMethod) || 'E-Wallet'}</td></tr>
    <tr class="amount-row"><td class="label">E-Wallet Amount</td><td class="value">${money(req.amountEwallet)}</td></tr>
    <tr class="amount-row"><td class="label">Diesel Amount</td><td class="value">${money(req.dieselAmount)}</td></tr>
    <tr class="total-row"><td class="label" style="background:#e0ecf0;">Total</td><td>${money(total)}</td></tr>
    <tr><td class="label">Department</td><td>${esc(req.department) || 'Logistics'}</td></tr>
    <tr><td class="label">Finance Status</td><td><span class="fin ${finClass}">${esc(fin)}</span>${req.paidDate ? ' &nbsp; paid ' + esc(new Date(req.paidDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })) : ''}</td></tr>
    ${req.financeNotes ? `<tr><td class="label">Finance Notes</td><td>${esc(req.financeNotes)}</td></tr>` : ''}
    <tr><td class="label">Generated By</td><td><strong>${esc(req.createdByName) || '—'}</strong>${req.createdAt ? ' on ' + esc(new Date(req.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })) : ''}</td></tr>
  </table>

  <div class="sign-row">
    <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Requested By</div></div>
    <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Authorised By</div></div>
    <div class="sign-box"><div class="sign-line"></div><div class="sign-label">Received By</div></div>
  </div>

  <div class="print-meta">
    Requisition ${esc(req.rfNumber) || ''}${req.createdByName ? ' &bull; Generated by ' + esc(req.createdByName) : ''} &bull; Printed ${esc(printedAt)} from the Promed Technologies Intranet
  </div>
  ${autoPrint ? `<script>
    var bg = new Image();
    bg.onload = function(){ setTimeout(function(){ window.print(); }, 200); };
    bg.onerror = function(){ setTimeout(function(){ window.print(); }, 200); };
    bg.src = '${templateUrl}';
  </scr` + `ipt>` : ''}
</body>
</html>`;
  }
}
