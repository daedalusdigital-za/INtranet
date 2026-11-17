import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';
import { ToastService } from '../ui/toast.service';
import { environment } from '../../environments/environment';

export type RequisitionSignSlot = 'RequestedBy' | 'AuthorisedBy' | 'ReceivedBy';
export const REQUISITION_SIGN_SLOTS: { key: RequisitionSignSlot; label: string }[] = [
  { key: 'RequestedBy', label: 'Requested By' },
  { key: 'AuthorisedBy', label: 'Authorised By' },
  { key: 'ReceivedBy', label: 'Received By' },
];

/** A drawn signature placed in one of the three boxes on the requisition form. */
export interface RequisitionSignature {
  id?: number;
  slot: RequisitionSignSlot;
  /** width as % of the signature box (30–140) */
  size: number;
  /** horizontal / vertical nudge, % of box (-50..50) */
  dx: number;
  dy: number;
  imageDataUrl: string;
  signerName: string;
  signedAtUtc?: string;
}

/** Context string stored on the ElectronicSignature row: Sig|<slot>|<size>|<dx>|<dy> */
export function encodeSignContext(s: Pick<RequisitionSignature, 'slot' | 'size' | 'dx' | 'dy'>): string {
  return `Sig|${s.slot}|${Math.round(s.size)}|${Math.round(s.dx)}|${Math.round(s.dy)}`;
}
function decodeSignContext(ctx: string | null | undefined): Pick<RequisitionSignature, 'slot' | 'size' | 'dx' | 'dy'> | null {
  if (!ctx || !ctx.startsWith('Sig|')) return null;
  const [, slot, size, dx, dy] = ctx.split('|');
  if (!REQUISITION_SIGN_SLOTS.some(s => s.key === slot)) return null;
  return { slot: slot as RequisitionSignSlot, size: +size || 80, dx: +dx || 0, dy: +dy || 0 };
}

/**
 * Renders the Rocket Freight "Requisition Form" (petty cash / e-wallet) on the company letterhead.
 * Used by Logistics (where the form is raised) and Finance › Approvals (where it is paid), so both
 * sides see the identical document. The browser's print dialog is how it becomes a PDF ("Save as PDF").
 * Digital signatures captured against the requisition (EntityType "Requisition") are drawn into the boxes.
 */
@Injectable({ providedIn: 'root' })
export class RequisitionFormService {
  private toast = inject(ToastService);
  private http = inject(HttpClient);

  /** Signatures stored for this requisition (latest per slot wins). */
  loadSignatures(requisitionId: number): Observable<RequisitionSignature[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/signatures/Requisition/${requisitionId}?images=true`).pipe(
      map(rows => {
        const out: RequisitionSignature[] = [];
        for (const r of rows || []) {             // rows are newest-first
          const pos = decodeSignContext(r.context);
          if (!pos || !r.imageDataUrl) continue;
          if (out.some(o => o.slot === pos.slot)) continue;
          out.push({ id: r.id, ...pos, imageDataUrl: r.imageDataUrl, signerName: r.signerName, signedAtUtc: r.signedAtUtc });
        }
        return out;
      }),
      catchError(() => of([] as RequisitionSignature[]))
    );
  }

  /** Save a drawn signature against the requisition. */
  saveSignature(req: any, sig: RequisitionSignature, comment?: string): Observable<any> {
    const slotLabel = REQUISITION_SIGN_SLOTS.find(s => s.key === sig.slot)?.label ?? sig.slot;
    return this.http.post(`${environment.apiUrl}/signatures`, {
      entityType: 'Requisition', entityId: req.id, context: encodeSignContext(sig), signerRole: slotLabel,
      action: 'Sign', method: 'Drawn', comment: comment || null,
      signatureImageBase64: sig.imageDataUrl, signatureImageMimeType: 'image/png',
      payload: { id: req.id, rfNumber: req.rfNumber, paidTo: req.paidTo, amountEwallet: req.amountEwallet, dieselAmount: req.dieselAmount, date: req.date }
    });
  }

  /** Opens the form in a new tab (with stored signatures) and triggers print. `autoPrint=false` just shows it. */
  open(req: any, autoPrint = true): void {
    const w = window.open('', '_blank');
    if (!w) { this.toast.warn('Pop-up blocked — allow pop-ups to open the form'); return; }
    w.document.write('<title>Loading requisition…</title>');
    this.loadSignatures(req.id).subscribe(sigs => {
      w.document.open();
      w.document.write(this.html(req, autoPrint, sigs));
      w.document.close();
    });
  }

  html(req: any, autoPrint: boolean, signatures: RequisitionSignature[] = []): string {
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
  .sign-line { position: relative; border-bottom: 1.5px solid #333; height: 56px; margin-bottom: 6px; overflow: visible; }
  .sign-line img { position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%); max-height: 400%; pointer-events: none; }
  .sign-label { font-size: 11px; color: #52606d; text-transform: uppercase; letter-spacing: 0.6px; }
  .sign-by { font-size: 10px; color: #2e7d32; margin-top: 3px; }
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
    ${REQUISITION_SIGN_SLOTS.map(s => {
      const sig = signatures.find(x => x.slot === s.key);
      const img = sig ? `<img src="${sig.imageDataUrl}" alt="Signature" style="width:${sig.size}%;left:calc(50% + ${sig.dx}%);bottom:calc(2px + ${sig.dy}%)">` : '';
      const by = sig ? `<div class="sign-by">✓ ${esc(sig.signerName)}${sig.signedAtUtc ? ' · ' + esc(new Date(sig.signedAtUtc).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })) : ''}</div>` : '';
      return `<div class="sign-box"><div class="sign-line">${img}</div><div class="sign-label">${s.label}</div>${by}</div>`;
    }).join('')}
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
