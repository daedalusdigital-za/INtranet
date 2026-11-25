import { Component, ElementRef, OnInit, ViewChild, inject, output, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';

interface QuoteFile { id: number; fileName: string; contentType: string; size: number; quoteNumber: number; supplier?: string | null; amount?: number | null; }
interface QuoteReq {
  id: number; number: string; userId?: number; requestedBy: string; department?: string; company?: string; companyCode?: string | null;
  subject: string; details?: string; priority: string; estimatedAmount?: number | null; fewerQuotesReason?: string | null;
  status: string; statusTitle: string; submittedAt: string; preparedByName?: string | null; preparedAt?: string | null;
  requestedAccountantIds: number[]; requestedAccountantNames?: string | null; requestedDirectorNames?: string | null;
  accountantName?: string | null; accountantApprovedAt?: string | null; accountantComment?: string | null;
  directorName?: string | null; directorDecidedAt?: string | null; directorComment?: string | null;
  selectedFileId?: number | null; returnReason?: string | null;
  history: { at: string; by: string; action: string; note?: string | null }[];
  files: QuoteFile[];
  can?: { editQuotes: boolean; accept: boolean; decline: boolean; accountant: boolean; changeAccountant: boolean; director: boolean; delete: boolean };
}
interface Person { userId: number; name: string; role: string; email?: string; }
interface Approvers { accountants: Person[]; accountantsFallback: boolean; directors: Person[]; directorsFallback: boolean; }
type Mode = 'accept' | 'change' | 'accountant' | 'director' | null;

/**
 * Finance › Approvals › Quotation requests: Creditors accept (and sign as preparer) → accountant signs → director
 * picks one quote and signs, or rejects all. The requester and preparer are e-mailed the outcome with the
 * quote approval sheet. Server: QuotationRequestsController.
 */
@Component({
  selector: 'app-quote-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <div class="qa">
      <div class="qa-tabs" role="tablist">
        @for (f of filters; track f.key) {
          <button type="button" role="tab" [class.on]="filter() === f.key" [class.attn]="f.key === 'forme' && (counts().forMe || 0) > 0" (click)="setFilter(f.key)">
            {{ f.title }} <b>{{ countFor(f.key) }}</b>
          </button>
        }
        <button mat-icon-button class="qa-refresh" (click)="load()" matTooltip="Refresh" aria-label="Refresh"><mat-icon>refresh</mat-icon></button>
      </div>
      <p class="qa-lead">Staff ask for something with three quotes. <b>Creditors</b> check and accept it, the <b>accountant</b> signs, and a <b>director</b> picks one quote (or rejects all). The requester gets an e-mail with the outcome and the signed approval sheet.</p>

      @if (loading()) { <div class="qa-state"><mat-spinner diameter="28"></mat-spinner></div> }
      @else if (!rows().length) {
        <div class="qa-state empty"><mat-icon>inbox</mat-icon><p>{{ filter() === 'forme' ? 'Nothing is waiting for you.' : 'No quotation requests here.' }}</p></div>
      } @else {
        <div class="qa-list">
          @for (q of rows(); track q.id) {
            <div class="qr" [class.open]="openId() === q.id" [attr.id]="'quote-' + q.id" [class]="'qr st-' + q.status">
              <button type="button" class="qr-head" (click)="toggle(q)">
                <span class="qr-no">{{ q.number }}</span>
                <span class="qr-main">
                  <b>{{ q.subject }}</b>
                  <small>{{ q.requestedBy }}@if (q.department) { · {{ q.department }} }@if (q.company) { · {{ q.company }} } · {{ q.submittedAt | date:'d MMM, HH:mm' }}</small>
                </span>
                <span class="qr-side">
                  <span class="pill" [class]="'pill p-' + q.status">{{ q.statusTitle }}</span>
                  <small>{{ q.files.length }} quote{{ q.files.length === 1 ? '' : 's' }}@if (lowest(q); as lo) { · from R {{ lo | number:'1.2-2' }} }</small>
                  @if (needsMe(q)) { <span class="you">Your turn</span> }
                </span>
                <mat-icon class="chev">{{ openId() === q.id ? 'expand_less' : 'expand_more' }}</mat-icon>
              </button>

              @if (openId() === q.id) {
                <div class="qr-body">
                  <!-- progress -->
                  <ol class="steps">
                    @for (s of steps(q); track s.label) { <li [class.done]="s.done" [class.now]="s.now" [class.bad]="s.bad"><span class="dot"></span><span class="lbl">{{ s.label }}</span>@if (s.who) { <small>{{ s.who }}</small> }</li> }
                  </ol>

                  @if (q.details) { <p class="det">{{ q.details }}</p> }
                  <div class="facts">
                    <span><mat-icon>flag</mat-icon> {{ q.priority }} priority</span>
                    @if (q.estimatedAmount) { <span><mat-icon>payments</mat-icon> Estimated R {{ q.estimatedAmount | number:'1.2-2' }}</span> }
                    @if (q.preparedByName) { <span><mat-icon>badge</mat-icon> Prepared by {{ q.preparedByName }}</span> }
                    @if (q.requestedAccountantNames && q.status === 'WithAccountant') { <span><mat-icon>fact_check</mat-icon> With {{ q.requestedAccountantNames }}</span> }
                    @if (q.requestedDirectorNames && q.status === 'WithDirector') { <span><mat-icon>draw</mat-icon> With {{ q.requestedDirectorNames }}</span> }
                  </div>
                  @if (q.fewerQuotesReason) { <p class="note warn"><mat-icon>info</mat-icon> Fewer than three quotes: {{ q.fewerQuotesReason }}</p> }
                  @if (q.returnReason && (q.status === 'Pending' || q.status === 'Declined')) { <p class="note bad"><mat-icon>reply</mat-icon> {{ q.status === 'Declined' ? 'Declined' : 'Sent back by the accountant' }}: {{ q.returnReason }}</p> }
                  @if (q.status === 'Approved') { <p class="note ok"><mat-icon>verified</mat-icon> {{ q.directorName }} approved {{ selectedLabel(q) }}@if (q.directorComment) { — “{{ q.directorComment }}” }</p> }
                  @if (q.status === 'Rejected') { <p class="note bad"><mat-icon>block</mat-icon> {{ q.directorName }} rejected all quotes: {{ q.directorComment }}</p> }
                  @if (q.accountantComment) { <p class="note"><mat-icon>comment</mat-icon> Accountant ({{ q.accountantName }}): {{ q.accountantComment }}</p> }

                  <!-- the quotes -->
                  <div class="quotes">
                    @for (f of q.files; track f.id) {
                      <label class="qc" [class.sel]="q.selectedFileId === f.id" [class.pick]="mode() === 'director'" [class.picked]="mode() === 'director' && pickFile === f.id">
                        @if (mode() === 'director') { <input type="radio" name="pick-{{ q.id }}" [value]="f.id" [(ngModel)]="pickFile"> }
                        <span class="qn">Quote {{ f.quoteNumber || $index + 1 }}@if (q.selectedFileId === f.id) { <mat-icon>verified</mat-icon> }</span>
                        @if (editing() === f.id) {
                          <input class="in" [(ngModel)]="editSupplier" placeholder="Supplier">
                          <input class="in" type="number" step="0.01" [(ngModel)]="editAmount" placeholder="Amount (R)">
                          <span class="qc-acts"><button mat-button (click)="saveEdit(q, f); $event.preventDefault()" [disabled]="busy()">Save</button><button mat-button (click)="editing.set(null); $event.preventDefault()">Cancel</button></span>
                        } @else {
                          <b class="sup">{{ f.supplier || 'Supplier not given' }}</b>
                          <span class="amt">{{ f.amount != null ? ('R ' + (f.amount | number:'1.2-2')) : 'Amount not given' }}</span>
                          <small class="fn" [title]="f.fileName">{{ f.fileName }}</small>
                          <span class="qc-acts">
                            <button mat-stroked-button (click)="view(q, f); $event.preventDefault()"><mat-icon>visibility</mat-icon> View</button>
                            @if (q.can?.editQuotes) {
                              <button mat-icon-button (click)="startEdit(f); $event.preventDefault()" matTooltip="Edit supplier / amount" aria-label="Edit"><mat-icon>edit</mat-icon></button>
                              <button mat-icon-button (click)="removeQuote(q, f); $event.preventDefault()" matTooltip="Remove this quote" aria-label="Remove"><mat-icon>delete</mat-icon></button>
                            }
                          </span>
                        }
                      </label>
                    } @empty { <p class="muted">No quotes attached yet.</p> }
                    @if (q.can?.editQuotes && q.files.length < 10) {
                      <div class="qc add">
                        <span class="qn">Add a quote</span>
                        <input class="in" [(ngModel)]="newSupplier" placeholder="Supplier">
                        <input class="in" type="number" step="0.01" [(ngModel)]="newAmount" placeholder="Amount (R)">
                        <button mat-stroked-button (click)="addInput.click()" [disabled]="busy()"><mat-icon>upload_file</mat-icon> Choose file & add</button>
                        <input #addInput type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx" (change)="addQuote(q, $event)">
                      </div>
                    }
                  </div>

                  <!-- actions -->
                  <div class="acts">
                    @if (q.can?.accept) { <button mat-flat-button color="primary" (click)="openMode(q, 'accept')" [disabled]="busy()"><mat-icon>send</mat-icon> Accept &amp; send to accountant</button> }
                    @if (q.can?.decline) { <button mat-stroked-button (click)="decline(q)" [disabled]="busy()"><mat-icon>undo</mat-icon> Decline to requester</button> }
                    @if (q.can?.accountant) {
                      <button mat-flat-button color="primary" (click)="openMode(q, 'accountant')" [disabled]="busy()"><mat-icon>task_alt</mat-icon> Approve &amp; send to director</button>
                      <button mat-stroked-button (click)="sendBack(q)" [disabled]="busy()"><mat-icon>reply</mat-icon> Send back to preparer</button>
                    }
                    @if (q.can?.changeAccountant) { <button mat-stroked-button (click)="openMode(q, 'change')" [disabled]="busy()"><mat-icon>swap_horiz</mat-icon> Change accountant</button> }
                    @if (q.can?.director) { <button mat-flat-button color="primary" (click)="openMode(q, 'director')" [disabled]="busy()"><mat-icon>how_to_reg</mat-icon> Choose a quote / reject</button> }
                    <button mat-stroked-button (click)="sheet(q)" [disabled]="busy()" matTooltip="Quote approval sheet with the signatures so far — opens to print or download"><mat-icon>fact_check</mat-icon> Approval sheet</button>
                  </div>

                  @if (mode(); as m) {
                    <div class="panel">
                      @switch (m) {
                        @case ('accept') {
                          <h4><mat-icon>send</mat-icon> Accept and send to the accountant</h4>
                          <label class="f">Paying company
                            <select [(ngModel)]="pickCompany" (ngModelChange)="loadApprovers(q)">
                              <option value="">Choose…</option>
                              @for (c of companies(); track c.code) { <option [value]="c.code">{{ c.name }}</option> }
                            </select>
                          </label>
                          @if (q.files.length < 3) { <label class="f">Why fewer than three quotes? <input [(ngModel)]="fewerReason" placeholder="e.g. Sole supplier"></label> }
                        }
                        @case ('change') { <h4><mat-icon>swap_horiz</mat-icon> Send it to a different accountant</h4><p class="muted">It's with {{ q.requestedAccountantNames || 'the accountant' }} now — no need to sign again.</p> }
                        @case ('accountant') { <h4><mat-icon>task_alt</mat-icon> Approve and send to the director</h4> }
                        @case ('director') { <h4><mat-icon>how_to_reg</mat-icon> Choose one quote above, or reject all</h4> }
                      }

                      @if (m === 'accept' || m === 'change' || m === 'accountant') {
                        @let people = m === 'accountant' ? (approvers()?.directors ?? []) : (approvers()?.accountants ?? []);
                        @let fallback = m === 'accountant' ? approvers()?.directorsFallback : approvers()?.accountantsFallback;
                        <div class="who-lbl">{{ m === 'accountant' ? 'Director(s)' : 'Accountant(s)' }}</div>
                        @if (!approvers()) { <mat-spinner diameter="20"></mat-spinner> }
                        @else {
                          @if (fallback) { <p class="note warn"><mat-icon>warning</mat-icon> Nobody is assigned to this company for this step, so everyone with the role is listed.</p> }
                          <div class="people">
                            @for (p of people; track p.userId) {
                              <label class="person" [class.on]="pick.has(p.userId)">
                                <input type="checkbox" [checked]="pick.has(p.userId)" (change)="togglePick(p.userId)">
                                <span><b>{{ p.name }}</b>@if (m === 'change' && q.requestedAccountantIds.includes(p.userId)) { <em> · has it now</em> }<small>{{ p.role }}</small></span>
                              </label>
                            } @empty { <p class="muted">Nobody available{{ m === 'accept' && !pickCompany ? ' — choose the company first' : '' }}.</p> }
                          </div>
                        }
                      }

                      <label class="f">{{ m === 'director' ? 'Comment (required to reject all)' : 'Note (optional)' }}
                        <input [(ngModel)]="note" [placeholder]="m === 'director' ? 'e.g. Best price with delivery included' : 'e.g. Supplier B can deliver this week'">
                      </label>

                      @if (m !== 'change') {
                        <div class="sigbox">
                          <div class="sig-top">
                            <span><mat-icon>draw</mat-icon> Your signature</span>
                            <label class="radio"><input type="radio" name="sigmode" value="saved" [(ngModel)]="sigMode"> Use my saved signature</label>
                            <label class="radio"><input type="radio" name="sigmode" value="draw" [(ngModel)]="sigMode" (ngModelChange)="initPad()"> Draw it now</label>
                          </div>
                          @if (sigMode === 'draw') {
                            <canvas #pad width="520" height="140" class="pad"
                              (pointerdown)="padDown($event)" (pointermove)="padMove($event)" (pointerup)="padUp()" (pointerleave)="padUp()"></canvas>
                            <button mat-button (click)="clearPad()"><mat-icon>backspace</mat-icon> Clear</button>
                          }
                          @if (sigError()) { <p class="note bad"><mat-icon>error</mat-icon> {{ sigError() }}</p> }
                        </div>
                      }

                      <div class="panel-acts">
                        <button mat-button (click)="closeMode()">Cancel</button>
                        @switch (m) {
                          @case ('accept') { <button mat-flat-button color="primary" (click)="accept(q)" [disabled]="busy() || !pickCompany || pick.size === 0"><mat-icon>draw</mat-icon> Sign &amp; send to {{ pick.size === 1 ? '1 accountant' : pick.size + ' accountants' }}</button> }
                          @case ('change') { <button mat-flat-button color="primary" (click)="changeAccountant(q)" [disabled]="busy() || pick.size === 0"><mat-icon>swap_horiz</mat-icon> Send to {{ pick.size === 1 ? '1 accountant' : pick.size + ' accountants' }}</button> }
                          @case ('accountant') { <button mat-flat-button color="primary" (click)="accountantApprove(q)" [disabled]="busy() || pick.size === 0"><mat-icon>draw</mat-icon> Sign, approve &amp; send to {{ pick.size === 1 ? '1 director' : pick.size + ' directors' }}</button> }
                          @case ('director') {
                            <button mat-stroked-button color="warn" (click)="director(q, 'reject')" [disabled]="busy() || !note.trim()" [matTooltip]="note.trim() ? '' : 'Write the reason in the comment first'"><mat-icon>block</mat-icon> Sign &amp; reject all</button>
                            <button mat-flat-button color="primary" (click)="director(q, 'select')" [disabled]="busy() || !pickFile"><mat-icon>draw</mat-icon> Sign &amp; approve {{ pickLabel(q) }}</button>
                          }
                        }
                      </div>
                    </div>
                  }

                  @if (q.history.length) {
                    <details class="hist"><summary>History ({{ q.history.length }})</summary>
                      <ul>@for (h of q.history.slice().reverse(); track $index) { <li><b>{{ h.by }}</b> {{ actionText(h.action) }} · {{ h.at | date:'d MMM, HH:mm' }}@if (h.note) { <span> — {{ h.note }}</span> }</li> }</ul>
                    </details>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .qa { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
    .qa-tabs { display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      button[role=tab] { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-weight: 600; font-size: var(--text-sm); min-height: 40px; padding: 0 14px; border: 1.5px solid var(--color-line-strong); border-radius: 999px; background: var(--color-surface); color: var(--color-text); cursor: pointer;
        b { min-width: 22px; text-align: center; font-size: var(--text-xs); background: var(--color-surface-3); padding: 1px 7px; border-radius: 999px; }
        &:hover { border-color: var(--color-primary); color: var(--color-primary); }
        &.on { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary, #fff); b { background: rgba(255,255,255,.25); color: inherit; } }
        &.attn:not(.on) { border-color: var(--color-warn); b { background: var(--color-warn); color: #fff; } } }
      .qa-refresh { margin-left: auto; } }
    .qa-lead { margin: 0; font-size: var(--text-sm); color: var(--color-text-2); }
    .qa-state { display: grid; place-items: center; padding: 28px; color: var(--color-text-3); mat-icon { font-size: 32px; width: 32px; height: 32px; } p { margin: 6px 0 0; } }
    .qa-list { display: flex; flex-direction: column; gap: 10px; }
    .qr { border: 1px solid var(--color-line); border-left: 4px solid var(--color-info, #0ea5e9); border-radius: var(--radius-md); background: var(--color-surface); overflow: hidden;
      &.st-WithAccountant { border-left-color: #6366f1; } &.st-WithDirector { border-left-color: #a855f7; } &.st-Approved { border-left-color: var(--color-ok, #16a34a); } &.st-Rejected, &.st-Declined { border-left-color: var(--color-danger, #dc2626); }
      &.open { box-shadow: var(--shadow-md); } }
    .qr-head { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: none; border: 0; font: inherit; color: inherit; text-align: left; cursor: pointer;
      &:hover { background: var(--color-surface-2); } }
    .qr-no { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-sm); color: var(--color-text-2); flex: none; }
    .qr-main { flex: 1; min-width: 0; display: flex; flex-direction: column; b { font-size: var(--text-md); } small { color: var(--color-text-3); font-size: var(--text-xs); } }
    .qr-side { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex: none; small { color: var(--color-text-3); font-size: var(--text-xs); } }
    .you { font-size: var(--text-xs); font-weight: 700; color: #fff; background: var(--color-warn); padding: 1px 8px; border-radius: 999px; }
    .chev { color: var(--color-text-3); flex: none; }
    .pill { font-size: var(--text-xs); font-weight: 600; padding: 2px 9px; border-radius: 999px; background: var(--color-surface-3); color: var(--color-text-2);
      &.p-Pending { background: #e0f2fe; color: #0369a1; } &.p-WithAccountant { background: #e0e7ff; color: #4338ca; } &.p-WithDirector { background: #f3e8ff; color: #7e22ce; }
      &.p-Approved { background: #dcfce7; color: #15803d; } &.p-Rejected, &.p-Declined { background: #fee2e2; color: #b91c1c; } }
    @media (max-width: 640px) { .qr-head { flex-wrap: wrap; } .qr-side { flex-direction: row; flex-wrap: wrap; align-items: center; width: 100%; } }
    .qr-body { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--color-line); }
    .steps { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 0; margin: 10px 0 2px; padding: 0;
      li { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--color-text-3); padding-right: 22px; position: relative;
        &:not(:last-child)::after { content: ''; position: absolute; right: 6px; top: 50%; width: 10px; height: 2px; background: var(--color-line-strong); }
        .dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--color-line-strong); background: var(--color-surface); flex: none; }
        small { color: var(--color-text-3); }
        &.done { color: var(--color-text); .dot { background: var(--color-ok, #16a34a); border-color: var(--color-ok, #16a34a); } }
        &.now { color: var(--color-primary); font-weight: 700; .dot { border-color: var(--color-primary); background: var(--color-primary-soft); } }
        &.bad { color: var(--color-danger); .dot { background: var(--color-danger); border-color: var(--color-danger); } } } }
    .det { margin: 0; white-space: pre-wrap; font-size: var(--text-sm); background: var(--color-surface-2); border-radius: var(--radius-sm); padding: 8px 10px; }
    .facts { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--text-xs); color: var(--color-text-2); span { display: inline-flex; align-items: center; gap: 4px; } mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .note { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); font-size: var(--text-sm); background: var(--color-surface-2);
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex: none; }
      &.warn { background: var(--color-warn-soft); color: var(--color-warn); } &.bad { background: var(--color-danger-soft); color: var(--color-danger); } &.ok { background: var(--color-ok-soft, #dcfce7); color: var(--color-ok, #15803d); } }
    .quotes { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
    .qc { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 12px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-md); background: var(--color-surface); min-width: 0;
      input[type=radio] { position: absolute; top: 12px; right: 12px; width: 18px; height: 18px; }
      &.pick { cursor: pointer; &:hover { border-color: var(--color-primary); } }
      &.picked { border: 2px solid var(--color-primary); background: var(--color-primary-soft); }
      &.sel { border: 2px solid var(--color-ok, #16a34a); background: var(--color-ok-soft, #f0fdf4); }
      &.add { border-style: dashed; background: var(--color-surface-2); } }
    .qn { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; font-weight: 700; color: var(--color-primary); mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--color-ok, #16a34a); } }
    .sup { font-size: var(--text-md); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amt { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-lg); }
    .fn { color: var(--color-text-3); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qc-acts { display: flex; align-items: center; gap: 4px; margin-top: 4px; flex-wrap: wrap; }
    .in, .f input, .f select { height: 36px; padding: 0 10px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control, 6px); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: var(--text-sm); min-width: 0; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .panel { display: flex; flex-direction: column; gap: 10px; padding: 14px; border: 1px solid var(--color-primary); border-radius: var(--radius-md); background: var(--color-primary-soft);
      h4 { margin: 0; display: flex; align-items: center; gap: 6px; } }
    .f { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-xs); font-weight: 600; color: var(--color-text-2); }
    .who-lbl { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-2); }
    .people { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
    .person { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); cursor: pointer;
      span { display: flex; flex-direction: column; min-width: 0; } small { color: var(--color-text-3); font-size: var(--text-xs); } em { font-style: normal; font-size: var(--text-xs); color: var(--color-warn); }
      &.on { border-color: var(--color-primary); } }
    .sigbox { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: var(--radius-sm); background: var(--color-surface); border: 1px solid var(--color-line);
      .sig-top { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; font-size: var(--text-sm); span { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; } }
      .radio { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; } }
    .pad { width: 100%; max-width: 520px; height: 140px; border: 1px dashed var(--color-line-strong); border-radius: var(--radius-sm); background: #fff; touch-action: none; cursor: crosshair; }
    .panel-acts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
    .hist { font-size: var(--text-sm); summary { cursor: pointer; color: var(--color-text-2); font-weight: 600; } ul { margin: 6px 0 0; padding-left: 18px; } li { margin: 3px 0; } span { color: var(--color-text-2); } }
    .muted { color: var(--color-text-3); font-size: var(--text-sm); margin: 0; }
  `]
})
export class QuoteApprovalsComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private base = `${environment.apiUrl}/quotation-requests`;

  /** Something changed (so the Finance page can refresh its counters). */
  changed = output<void>();

  readonly filters = [
    { key: 'forme', title: 'Waiting for you' }, { key: 'Pending', title: 'With creditors' }, { key: 'WithAccountant', title: 'With accountant' },
    { key: 'WithDirector', title: 'With director' }, { key: 'Approved', title: 'Approved' }, { key: 'Rejected', title: 'Rejected' },
    { key: 'Declined', title: 'Declined' }, { key: 'all', title: 'All' },
  ];
  filter = signal('forme');
  rows = signal<QuoteReq[]>([]);
  counts = signal<any>({});
  loading = signal(true);
  busy = signal(false);
  openId = signal<number | null>(null);
  mode = signal<Mode>(null);
  approvers = signal<Approvers | null>(null);
  companies = signal<{ code: string; name: string }[]>([]);
  editing = signal<number | null>(null);
  sigError = signal('');
  pick = new Set<number>();
  pickCompany = '';
  pickFile: number | null = null;
  fewerReason = '';
  note = '';
  sigMode: 'saved' | 'draw' = 'saved';
  editSupplier = ''; editAmount: number | null = null;
  newSupplier = ''; newAmount: number | null = null;

  @ViewChild('pad') padRef?: ElementRef<HTMLCanvasElement>;
  private drawing = false; private drew = false;

  ngOnInit(): void {
    this.http.get<{ code: string; name: string }[]>(`${this.base}/companies`).subscribe({ next: c => this.companies.set(c ?? []) });
    const deep = Number(this.route.snapshot.queryParamMap.get('quote'));
    if (deep > 0) { this.filter.set('all'); this.openId.set(deep); setTimeout(() => document.getElementById('quote-' + deep)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 900); }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.http.get<any>(`${this.base}/counts`).subscribe({ next: c => this.counts.set(c ?? {}) });
    this.http.get<QuoteReq[]>(`${this.base}?status=${this.filter()}`).subscribe({
      next: r => { this.rows.set(r ?? []); this.loading.set(false); },
      error: () => { this.rows.set([]); this.loading.set(false); }
    });
  }
  setFilter(f: string): void { this.filter.set(f); this.closeMode(); this.load(); }
  countFor(k: string): number {
    const c = this.counts();
    return k === 'forme' ? c.forMe ?? 0 : k === 'Pending' ? c.pending ?? 0 : k === 'WithAccountant' ? c.withAccountant ?? 0 : k === 'WithDirector' ? c.withDirector ?? 0
      : k === 'Approved' ? c.approved ?? 0 : k === 'Rejected' ? c.rejected ?? 0 : k === 'Declined' ? c.declined ?? 0 : c.total ?? 0;
  }

  toggle(q: QuoteReq): void { this.closeMode(); this.editing.set(null); this.openId.set(this.openId() === q.id ? null : q.id); }
  needsMe(q: QuoteReq): boolean { const c = q.can; return !!c && (c.accept || c.accountant || c.director); }
  lowest(q: QuoteReq): number | null { const a = q.files.map(f => f.amount).filter((x): x is number => x != null); return a.length ? Math.min(...a) : null; }
  selectedLabel(q: QuoteReq): string { const f = q.files.find(x => x.id === q.selectedFileId); return f ? `quote ${f.quoteNumber}: ${f.supplier || f.fileName}${f.amount != null ? ' (R ' + f.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 }) + ')' : ''}` : 'a quote'; }
  pickLabel(q: QuoteReq): string { const f = q.files.find(x => x.id === this.pickFile); return f ? `quote ${f.quoteNumber}` : 'the chosen quote'; }

  steps(q: QuoteReq) {
    const order = ['Pending', 'WithAccountant', 'WithDirector', 'Done'];
    const at = q.status === 'Approved' || q.status === 'Rejected' ? 3 : q.status === 'Declined' ? 0 : Math.max(0, order.indexOf(q.status));
    return [
      { label: 'Requested', who: q.requestedBy, done: true, now: false, bad: false },
      { label: 'Creditors', who: q.preparedByName ?? '', done: at > 0, now: at === 0 && q.status === 'Pending', bad: q.status === 'Declined' },
      { label: 'Accountant', who: q.accountantName ?? (q.status === 'WithAccountant' ? q.requestedAccountantNames ?? '' : ''), done: at > 1, now: at === 1, bad: false },
      { label: 'Director', who: q.directorName ?? (q.status === 'WithDirector' ? q.requestedDirectorNames ?? '' : ''), done: at > 2, now: at === 2, bad: false },
      { label: q.status === 'Rejected' ? 'All rejected' : q.status === 'Approved' ? 'Quote approved' : 'Outcome e-mailed', who: '', done: q.status === 'Approved', now: false, bad: q.status === 'Rejected' },
    ];
  }

  actionText(a: string): string {
    return ({ Submitted: 'submitted the request', QuoteAdded: 'added a quote', QuoteUpdated: 'edited a quote', QuoteRemoved: 'removed a quote', Accepted: 'accepted it (Creditors)',
      Declined: 'declined it', AccountantChanged: 'changed the accountant', AccountantSentBack: 'sent it back to the preparer', AccountantApproved: 'approved it (accountant)',
      QuoteSelected: 'approved a quote (director)', AllRejected: 'rejected all quotes (director)' } as Record<string, string>)[a] ?? a;
  }

  // ── quotes ──
  view(q: QuoteReq, f: QuoteFile): void { this.openBlob(`${this.base}/${q.id}/files/${f.id}`, f.fileName); }
  sheet(q: QuoteReq): void { this.openBlob(`${this.base}/${q.id}/approval-sheet.pdf`, `Quote-approval-${q.number}.pdf`); }
  private openBlob(url: string, name: string): void {
    const w = window.open('', '_blank');
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: b => { const u = URL.createObjectURL(b); if (w) w.location.href = u; else { const a = document.createElement('a'); a.href = u; a.download = name; a.click(); } setTimeout(() => URL.revokeObjectURL(u), 60_000); },
      error: () => { w?.close(); this.toast.error("Couldn't open that file."); }
    });
  }
  startEdit(f: QuoteFile): void { this.editing.set(f.id); this.editSupplier = f.supplier ?? ''; this.editAmount = f.amount ?? null; }
  saveEdit(q: QuoteReq, f: QuoteFile): void {
    this.run(this.http.put<QuoteReq>(`${this.base}/${q.id}/quotes/${f.id}`, { supplier: this.editSupplier, amount: this.editAmount === ('' as any) ? null : this.editAmount }), 'Quote updated', () => this.editing.set(null));
  }
  removeQuote(q: QuoteReq, f: QuoteFile): void {
    if (!confirm(`Remove quote ${f.quoteNumber} (${f.supplier || f.fileName})?`)) return;
    this.run(this.http.delete<QuoteReq>(`${this.base}/${q.id}/quotes/${f.id}`), 'Quote removed');
  }
  addQuote(q: QuoteReq, ev: Event): void {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    const fd = new FormData(); fd.append('file', file, file.name);
    fd.append('supplier', this.newSupplier.trim() || file.name.replace(/\.[^.]+$/, ''));
    if (this.newAmount != null && (this.newAmount as any) !== '') fd.append('amount', String(this.newAmount));
    this.run(this.http.post<QuoteReq>(`${this.base}/${q.id}/quotes`, fd), 'Quote added', () => { this.newSupplier = ''; this.newAmount = null; });
  }

  // ── stage actions ──
  openMode(q: QuoteReq, m: Mode): void {
    this.mode.set(m); this.pick = new Set(); this.note = ''; this.fewerReason = q.fewerQuotesReason ?? ''; this.sigError.set(''); this.sigMode = 'saved'; this.drew = false;
    this.pickFile = null; this.pickCompany = q.companyCode ?? '';
    if (m === 'director') return;
    this.loadApprovers(q);
  }
  closeMode(): void { this.mode.set(null); this.sigError.set(''); }
  loadApprovers(q: QuoteReq): void {
    this.approvers.set(null); this.pick = new Set();
    const company = this.mode() === 'accept' ? this.pickCompany : (q.companyCode ?? '');
    if (this.mode() === 'accept' && !company) { this.approvers.set({ accountants: [], accountantsFallback: false, directors: [], directorsFallback: false }); return; }
    this.http.get<Approvers>(`${this.base}/${q.id}/approvers${company ? '?company=' + encodeURIComponent(company) : ''}`).subscribe({
      next: a => this.approvers.set(a),
      error: () => { this.approvers.set({ accountants: [], accountantsFallback: false, directors: [], directorsFallback: false }); this.toast.error("Couldn't load the approvers."); }
    });
  }
  togglePick(id: number): void { if (this.pick.has(id)) this.pick.delete(id); else this.pick.add(id); }

  accept(q: QuoteReq): void {
    this.run(this.http.post<QuoteReq>(`${this.base}/${q.id}/accept`, { companyCode: this.pickCompany, accountantUserIds: [...this.pick], fewerQuotesReason: this.fewerReason || null, note: this.note || null, ...this.sig() }),
      'Accepted and sent to the accountant — they\'ve been notified and e-mailed', () => this.closeMode());
  }
  changeAccountant(q: QuoteReq): void {
    this.run(this.http.post<QuoteReq>(`${this.base}/${q.id}/change-accountant`, { accountantUserIds: [...this.pick], note: this.note || null }), 'Moved to the new accountant — they\'ve been notified and e-mailed', () => this.closeMode());
  }
  accountantApprove(q: QuoteReq): void {
    this.run(this.http.post<QuoteReq>(`${this.base}/${q.id}/accountant`, { decision: 'approve', comment: this.note || null, directorUserIds: [...this.pick], ...this.sig() }),
      'Signed and sent to the director — they\'ve been notified and e-mailed', () => this.closeMode());
  }
  sendBack(q: QuoteReq): void {
    const c = prompt('What needs fixing before you can approve it?'); if (c === null || !c.trim()) return;
    this.run(this.http.post<QuoteReq>(`${this.base}/${q.id}/accountant`, { decision: 'sendback', comment: c.trim() }), 'Sent back to the preparer');
  }
  decline(q: QuoteReq): void {
    const c = prompt(`Decline ${q.number} back to ${q.requestedBy}?\n\nReason (they'll get it by e-mail):`); if (c === null || !c.trim()) return;
    this.run(this.http.post<QuoteReq>(`${this.base}/${q.id}/decline`, { reason: c.trim() }), 'Declined — the requester has been e-mailed');
  }
  director(q: QuoteReq, d: 'select' | 'reject'): void {
    if (d === 'reject' && !confirm(`Reject all ${q.files.length} quotes on ${q.number}? The preparer and requester will be e-mailed.`)) return;
    this.run(this.http.post<QuoteReq>(`${this.base}/${q.id}/director`, { decision: d, fileId: d === 'select' ? this.pickFile : null, comment: this.note || null, ...this.sig() }),
      d === 'select' ? 'Quote approved — the preparer and requester have been e-mailed' : 'All quotes rejected — the preparer and requester have been e-mailed', () => this.closeMode());
  }

  private run(req: Observable<QuoteReq>, done: string, after?: () => void): void {
    this.busy.set(true); this.sigError.set('');
    req.subscribe({
      next: r => {
        this.busy.set(false); after?.();
        const keep = this.filter() === 'all' || this.filter() === r.status || (this.filter() === 'forme' && this.needsMe(r));
        this.rows.set(keep ? this.rows().map(x => x.id === r.id ? r : x) : this.rows().filter(x => x.id !== r.id));
        this.toast.done(done);
        this.http.get<any>(`${this.base}/counts`).subscribe({ next: c => this.counts.set(c ?? {}) });
        this.changed.emit();
      },
      error: e => {
        this.busy.set(false);
        const msg = e?.error?.message || "Couldn't save that. Try again.";
        if (e?.error?.code === 'SIGNATURE_REQUIRED') { this.sigError.set('You have no saved signature yet — choose “Draw it now” and sign in the box.'); this.sigMode = 'draw'; this.initPad(); }
        else this.toast.error(msg);
      }
    });
  }

  // ── signature pad ──
  private sig(): { signatureImageBase64?: string; useSavedSignature: boolean } {
    if (this.sigMode === 'draw' && this.drew && this.padRef) return { signatureImageBase64: this.padRef.nativeElement.toDataURL('image/png'), useSavedSignature: false };
    return { useSavedSignature: this.sigMode === 'saved' };
  }
  initPad(): void { this.drew = false; setTimeout(() => this.clearPad(), 0); }
  clearPad(): void { const c = this.padRef?.nativeElement; if (!c) return; const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); this.drew = false; }
  private pos(e: PointerEvent): [number, number] { const c = this.padRef!.nativeElement; const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; }
  padDown(e: PointerEvent): void { if (!this.padRef) return; this.drawing = true; const x = this.padRef.nativeElement.getContext('2d')!; x.lineWidth = 2.4; x.lineCap = 'round'; x.strokeStyle = '#111827'; x.beginPath(); x.moveTo(...this.pos(e)); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }
  padMove(e: PointerEvent): void { if (!this.drawing || !this.padRef) return; const x = this.padRef.nativeElement.getContext('2d')!; x.lineTo(...this.pos(e)); x.stroke(); this.drew = true; }
  padUp(): void { this.drawing = false; }
}
