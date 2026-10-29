import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { PaperlessService, PaperlessUser, RecipientRole } from '../../../services/paperless.service';

/**
 * Finance request entry-point. Presents the two finance request types the
 * business supports: making a Payment (against an invoice or a 3-quote
 * comparison) and requesting/submitting Quotations. Each option opens its own
 * detailed dialog.
 */
@Component({
  selector: 'app-finance-menu',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="fin-menu-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">account_balance</mat-icon>
        <h2>Finance Request</h2>
        <button aria-label="Close" mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <p class="subtitle">What would you like to do?</p>

        <div class="options-list">
          <div class="option-item" (click)="openPayment()">
            <mat-icon class="option-icon" style="color:var(--color-ok)">payments</mat-icon>
            <div class="option-text">
              <span class="option-name">Payment</span>
              <span class="option-desc">Pay an invoice or submit a 3-quote comparison for approval</span>
            </div>
            <mat-icon class="arrow-icon">chevron_right</mat-icon>
          </div>

          <div class="option-item" (click)="openQuotations()">
            <mat-icon class="option-icon" style="color:var(--color-primary-hover)">request_quote</mat-icon>
            <div class="option-text">
              <span class="option-name">Quotations</span>
              <span class="option-desc">Request or submit supplier quotations</span>
            </div>
            <mat-icon class="arrow-icon">chevron_right</mat-icon>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fin-menu-dialog { padding: 0; min-width: 420px; }
    .dialog-header {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 18px 24px; background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
      color: white; margin: -24px -24px 0 -24px; position: relative;
    }
    .header-icon { font-size: 30px; width: 30px; height: 30px; }
    .dialog-header h2 { margin: 0; font-size: 1.4rem; text-align: center; }
    .close-btn { color: white; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); }
    .dialog-content { padding: 24px; }
    .subtitle { text-align: center; color: var(--color-text-2); margin: 0 0 20px; }
    .options-list { display: flex; flex-direction: column; gap: 12px; }
    .option-item {
      display: flex; align-items: center; gap: 14px; padding: 16px;
      border: 1px solid var(--color-line); border-radius: 12px; cursor: pointer; transition: all .2s;
    }
    .option-item:hover { border-color: var(--color-primary); background: var(--color-primary-soft); transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(33,150,243,.15); }
    .option-icon { font-size: 32px; width: 32px; height: 32px; }
    .option-text { display: flex; flex-direction: column; flex: 1; }
    .option-name { font-weight: 600; font-size: 1.05rem; color: var(--color-text); }
    .option-desc { font-size: .85rem; color: var(--color-text-3); }
    .arrow-icon { color: var(--color-text-3); }
  `]
})
export class FinanceMenuComponent {
  private dialogRef = inject(MatDialogRef<FinanceMenuComponent>);
  private dialog = inject(MatDialog);

  openPayment(): void {
    this.dialogRef.close();
    this.dialog.open(PaymentRequestDialogComponent, {
      width: '640px', maxHeight: '92vh', autoFocus: false, panelClass: 'no-scroll-dialog'
    });
  }

  openQuotations(): void {
    this.dialogRef.close();
    this.dialog.open(QuotationRequestDialogComponent, {
      width: '640px', maxHeight: '92vh', autoFocus: false, panelClass: 'no-scroll-dialog'
    });
  }

  close(): void { this.dialogRef.close(); }
}

interface PickedUser { id: number; name: string; email: string; role: RecipientRole; }

/**
 * Payment request. The requester uploads either a single invoice or three
 * comparative quotes, adds payment details, and can optionally turn the request
 * into a real Paperless workflow — choosing the signers and approvers who must
 * sign off before it is paid.
 */
@Component({
  selector: 'app-payment-request-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatSlideToggleModule, MatChipsModule, MatSnackBarModule
  ],
  template: `
    <div class="pay-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">payments</mat-icon>
        <h2>Payment Request</h2>
        <button aria-label="Close" mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Step 1: choose payment type -->
        <div class="step" [class.completed]="payType">
          <div class="step-header">
            <div class="step-number" [class.active]="!payType">1</div>
            <span class="step-label">What are you paying against?</span>
          </div>
          <div class="type-grid">
            <div class="type-card" [class.selected]="payType === 'invoice'" (click)="setType('invoice')">
              <mat-icon>receipt_long</mat-icon>
              <span class="t-name">Single Invoice</span>
              <span class="t-desc">Upload one supplier invoice</span>
            </div>
            <div class="type-card" [class.selected]="payType === 'quotes'" (click)="setType('quotes')">
              <mat-icon>format_list_numbered</mat-icon>
              <span class="t-name">Three Quotes</span>
              <span class="t-desc">Upload 3 quotes for comparison</span>
            </div>
          </div>
        </div>

        <!-- Step 2: upload -->
        @if (payType) {
          <div class="step" [class.completed]="filesReady()">
            <div class="step-header">
              <div class="step-number" [class.active]="!filesReady()">2</div>
              <span class="step-label">{{ payType === 'invoice' ? 'Upload invoice' : 'Upload 3 quotes' }}</span>
            </div>

            @if (payType === 'invoice') {
              <div class="upload-row">
                <button mat-stroked-button type="button" (click)="invoiceInput.click()">
                  <mat-icon>upload_file</mat-icon> {{ invoiceFile ? 'Replace invoice' : 'Choose invoice' }}
                </button>
                <input #invoiceInput type="file" hidden
                       accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
                       (change)="onInvoicePicked($event)">
                @if (invoiceFile) {
                  <div class="file-chip">
                    <mat-icon>description</mat-icon>
                    <span class="fname">{{ invoiceFile.name }}</span>
                    <button aria-label="Close" mat-icon-button (click)="invoiceFile = null"><mat-icon>close</mat-icon></button>
                  </div>
                }
              </div>
            } @else {
              <div class="quotes-list">
                @for (slot of [0,1,2]; track slot) {
                  <div class="quote-slot">
                    <span class="q-label">Quote {{ slot + 1 }}</span>
                    @if (quoteFiles[slot]) {
                      <div class="file-chip">
                        <mat-icon>description</mat-icon>
                        <span class="fname">{{ quoteFiles[slot]!.name }}</span>
                        <button aria-label="Close" mat-icon-button (click)="clearQuote(slot)"><mat-icon>close</mat-icon></button>
                      </div>
                    } @else {
                      <button mat-stroked-button type="button" (click)="pickQuote(slot)">
                        <mat-icon>upload_file</mat-icon> Choose file
                      </button>
                    }
                  </div>
                }
                <input #quoteInput type="file" hidden
                       accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
                       (change)="onQuotePicked($event)">
              </div>
            }
          </div>
        }

        <!-- Step 3: details -->
        @if (filesReady()) {
          <div class="step">
            <div class="step-header">
              <div class="step-number active">3</div>
              <span class="step-label">Payment details</span>
            </div>
            <div class="detail-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Supplier / Payee</mat-label>
                <input matInput [(ngModel)]="supplier" placeholder="Who is being paid?">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Amount</mat-label>
                <input matInput type="number" [(ngModel)]="amount" placeholder="0.00">
                <span matPrefix>R&nbsp;</span>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Reference</mat-label>
                <input matInput [(ngModel)]="reference" placeholder="Invoice / PO no.">
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Notes for finance (optional)</mat-label>
                <textarea matInput rows="2" [(ngModel)]="notes"></textarea>
              </mat-form-field>
            </div>
          </div>
        }

        <!-- Step 4: paperless workflow -->
        @if (filesReady()) {
          <div class="step paperless-step">
            <div class="pl-toggle-row">
              <div class="pl-toggle-text">
                <span class="pl-title"><mat-icon>fact_check</mat-icon> Make this a paperless workflow?</span>
                <span class="pl-sub">Route the document to signers &amp; approvers for electronic sign-off.</span>
              </div>
              <mat-slide-toggle color="primary" [(ngModel)]="paperless"></mat-slide-toggle>
            </div>

            @if (paperless) {
              <div class="signers-block">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Add signers &amp; approvers</mat-label>
                  <input matInput [(ngModel)]="userQuery" (ngModelChange)="onSearch($event)"
                         placeholder="Search people by name or email…">
                  <mat-icon matPrefix>person_search</mat-icon>
                  @if (searching) { <mat-spinner matSuffix diameter="18"></mat-spinner> }
                </mat-form-field>

                @if (results.length > 0) {
                  <div class="results">
                    @for (u of results; track u.id) {
                      <div class="result-row">
                        <div class="r-info">
                          <span class="r-name">{{ u.name }}</span>
                          <span class="r-email">{{ u.email }}</span>
                        </div>
                        <div class="r-actions">
                          <button mat-stroked-button (click)="addUser(u, 'signer')">
                            <mat-icon>draw</mat-icon> Signer
                          </button>
                          <button mat-stroked-button color="primary" (click)="addUser(u, 'approver')">
                            <mat-icon>verified</mat-icon> Approver
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }

                @if (picked.length > 0) {
                  <div class="picked-list">
                    <span class="picked-label">Workflow recipients ({{ picked.length }}):</span>
                    <mat-chip-set>
                      @for (p of picked; track p.id + p.role) {
                        <mat-chip [class]="'chip-' + p.role" (removed)="removeUser(p)">
                          <mat-icon>{{ p.role === 'signer' ? 'draw' : 'verified' }}</mat-icon>
                          {{ p.name }} · {{ p.role }}
                          <button aria-label="Close" matChipRemove><mat-icon>cancel</mat-icon></button>
                        </mat-chip>
                      }
                    </mat-chip-set>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (filesReady()) {
        <div class="dialog-actions">
          <button mat-button type="button" (click)="close()">Cancel</button>
          <button mat-raised-button color="primary" (click)="submit()"
                  [disabled]="submitting || (paperless && picked.length === 0)">
            @if (submitting) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>send</mat-icon>
              {{ paperless ? 'Create workflow' : 'Submit to finance' }}
            }
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .pay-dialog { width: 100%; color: var(--color-text); }
    /* Ensure form inputs are always dark-on-light regardless of global theme */
    .pay-dialog ::ng-deep .mat-mdc-form-field { color: var(--color-text); }
    .pay-dialog ::ng-deep input.mat-mdc-input-element,
    .pay-dialog ::ng-deep textarea.mat-mdc-input-element { color: var(--color-text) !important; caret-color: var(--color-text); }
    .pay-dialog ::ng-deep .mat-mdc-form-field-infix input::placeholder,
    .pay-dialog ::ng-deep .mat-mdc-form-field-infix textarea::placeholder { color: #9aa0ab !important; }
    .pay-dialog ::ng-deep .mdc-floating-label,
    .pay-dialog ::ng-deep .mat-mdc-form-field-label,
    .pay-dialog ::ng-deep .mdc-text-field__affix { color: #5b6270 !important; }
    .pay-dialog ::ng-deep .mdc-text-field--outlined .mdc-notched-outline__leading,
    .pay-dialog ::ng-deep .mdc-text-field--outlined .mdc-notched-outline__notch,
    .pay-dialog ::ng-deep .mdc-text-field--outlined .mdc-notched-outline__trailing { border-color: #c7ccd6; }
    .dialog-header {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 18px 24px; background: linear-gradient(135deg, var(--color-ok) 0%, #1b5e20 100%);
      color: white; margin: -24px -24px 0 -24px; position: relative;
    }
    .header-icon { font-size: 30px; width: 30px; height: 30px; }
    .dialog-header h2 { margin: 0; font-size: 1.4rem; }
    .close-btn { color: white; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); }
    .dialog-content { padding: 22px 2px 8px; }
    .full-width { width: 100%; }

    .step { margin-bottom: 18px; padding: 16px; background: var(--color-canvas); border-radius: 12px; border: 1px solid var(--color-line); }
    .step.completed { background: var(--color-ok-soft); border-color: #a5d6a7; }
    .step-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
    .step-number { width: 26px; height: 26px; border-radius: 50%; background: var(--color-line); color: var(--color-text-2);
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: .8rem; }
    .step-number.active { background: var(--color-ok); color: white; }
    .step.completed .step-number { background: var(--color-ok); color: white; }
    .step-label { font-weight: 600; color: var(--color-text); }

    .type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .type-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 18px;
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 12px; cursor: pointer; text-align: center; transition: all .2s; }
    .type-card:hover { border-color: var(--color-ok); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(46,125,50,.15); }
    .type-card.selected { border: 2px solid var(--color-ok); background: #f1f8e9; }
    .type-card mat-icon { font-size: 32px; width: 32px; height: 32px; color: var(--color-ok); }
    .t-name { font-weight: 600; color: var(--color-text); }
    .t-desc { font-size: .8rem; color: var(--color-text-3); }

    .upload-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .quotes-list { display: flex; flex-direction: column; gap: 10px; }
    .quote-slot { display: flex; align-items: center; gap: 12px; }
    .q-label { font-weight: 600; color: var(--color-text-2); min-width: 64px; }
    .file-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 12px;
      background: var(--color-surface); border: 1px solid #c8e6c9; border-radius: 20px; }
    .file-chip .fname { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .85rem; }
    .file-chip mat-icon { color: var(--color-ok); }
    .file-chip button { width: 28px; height: 28px; line-height: 28px; }

    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 14px; }
    .detail-grid .full-width { grid-column: 1 / -1; }

    .paperless-step { background: #eef4ff; border-color: #c5d8ff; }
    .pl-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .pl-toggle-text { display: flex; flex-direction: column; }
    .pl-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #1a3f8f; }
    .pl-sub { font-size: .82rem; color: #5b6b8c; margin-top: 2px; }
    .signers-block { margin-top: 14px; }

    .results { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
    .result-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--color-line); }
    .result-row:last-child { border-bottom: none; }
    .r-info { display: flex; flex-direction: column; }
    .r-name { font-weight: 600; color: var(--color-text); font-size: .9rem; }
    .r-email { font-size: .78rem; color: var(--color-text-3); }
    .r-actions { display: flex; gap: 8px; }
    .r-actions button { line-height: 30px; }

    .picked-label { font-size: .85rem; color: var(--color-text-2); font-weight: 600; display: block; margin-bottom: 6px; }
    .chip-signer { --mdc-chip-elevated-container-color: var(--color-primary-soft); }
    .chip-approver { --mdc-chip-elevated-container-color: var(--color-ok-soft); }

    .dialog-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 14px; border-top: 1px solid var(--color-line); }
    .dialog-actions button { display: flex; align-items: center; gap: 8px; }
  `]
})
export class PaymentRequestDialogComponent {
  private dialogRef = inject(MatDialogRef<PaymentRequestDialogComponent>);
  private snackBar = inject(MatSnackBar);
  private paperlessSvc = inject(PaperlessService);

  payType: 'invoice' | 'quotes' | null = null;
  invoiceFile: File | null = null;
  quoteFiles: (File | null)[] = [null, null, null];
  private pendingQuoteSlot = 0;

  supplier = '';
  amount: number | null = null;
  reference = '';
  notes = '';

  paperless = false;
  userQuery = '';
  results: PaperlessUser[] = [];
  searching = false;
  picked: PickedUser[] = [];
  submitting = false;

  private searchTimer: any;
  private quoteInputEl: HTMLInputElement | null = null;

  setType(t: 'invoice' | 'quotes'): void {
    this.payType = t;
  }

  filesReady(): boolean {
    if (this.payType === 'invoice') return !!this.invoiceFile;
    if (this.payType === 'quotes') return this.quoteFiles.every(f => !!f);
    return false;
  }

  onInvoicePicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files && input.files.length) this.invoiceFile = input.files[0];
    input.value = '';
  }

  pickQuote(slot: number): void {
    this.pendingQuoteSlot = slot;
    if (!this.quoteInputEl) {
      this.quoteInputEl = document.querySelector('.pay-dialog input[type=file]:last-of-type') as HTMLInputElement;
    }
    // Trigger the shared hidden quote input.
    const inputs = document.querySelectorAll('.pay-dialog input[type=file]');
    const el = inputs[inputs.length - 1] as HTMLInputElement;
    el?.click();
  }

  onQuotePicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.quoteFiles[this.pendingQuoteSlot] = input.files[0];
    }
    input.value = '';
  }

  clearQuote(slot: number): void {
    this.quoteFiles[slot] = null;
  }

  onSearch(q: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const term = (q || '').trim();
    if (term.length < 2) { this.results = []; return; }
    this.searching = true;
    this.searchTimer = setTimeout(() => {
      this.paperlessSvc.searchUsers(term).subscribe({
        next: (list) => {
          const takenIds = new Set(this.picked.map(p => p.id));
          this.results = (list || []).filter(u => !takenIds.has(u.id)).slice(0, 8);
          this.searching = false;
        },
        error: () => { this.results = []; this.searching = false; }
      });
    }, 300);
  }

  addUser(u: PaperlessUser, role: RecipientRole): void {
    if (this.picked.some(p => p.id === u.id && p.role === role)) return;
    this.picked.push({ id: u.id, name: u.name, email: u.email, role });
    this.results = this.results.filter(r => r.id !== u.id);
    this.userQuery = '';
  }

  removeUser(p: PickedUser): void {
    this.picked = this.picked.filter(x => !(x.id === p.id && x.role === p.role));
  }

  async submit(): Promise<void> {
    if (!this.filesReady()) return;
    if (this.paperless && this.picked.length === 0) {
      this.snackBar.open('Add at least one signer or approver for the workflow.', 'OK', { duration: 3500 });
      return;
    }
    this.submitting = true;

    try {
      const category = this.payType === 'quotes' ? 'ThreeQuote' : 'Payment';
      const primaryFile = this.payType === 'invoice' ? this.invoiceFile! : this.quoteFiles[0]!;

      const primary = await this.paperlessSvc.uploadPrimary(primaryFile, category as any);
      if (!primary) throw new Error('upload failed');

      // Stack the remaining quotes under the primary document.
      if (this.payType === 'quotes') {
        for (let i = 1; i < this.quoteFiles.length; i++) {
          const q = this.quoteFiles[i];
          if (q) await this.paperlessSvc.addStackItem(primary.id, 'Invoice', q, category as any);
        }
      }

      if (this.paperless) {
        // Approvers act after signers by insertion order (sequential routing).
        const signers = this.picked.filter(p => p.role === 'signer');
        const approvers = this.picked.filter(p => p.role === 'approver');
        for (const s of signers) this.paperlessSvc.addRecipient(primary.id, s.name, 'signer', s.email);
        for (const a of approvers) this.paperlessSvc.addRecipient(primary.id, a.name, 'approver', a.email);
        this.paperlessSvc.sendForSignature(primary.id);

        this.snackBar.open(
          `Paperless workflow created and sent to ${this.picked.length} recipient(s).`,
          'OK', { duration: 5000 });
      } else {
        this.snackBar.open('Payment request submitted to finance.', 'OK', { duration: 4000 });
      }

      this.submitting = false;
      this.dialogRef.close(true);
    } catch {
      this.submitting = false;
      this.snackBar.open('Could not submit the payment request. Please try again.', 'OK', { duration: 4000 });
    }
  }

  close(): void { this.dialogRef.close(); }
}

/**
 * Quotation request. Ask suppliers for quotes (describe the requirement) and,
 * optionally, upload any quotes already received and route them through a
 * paperless approval workflow.
 */
@Component({
  selector: 'app-quotation-request-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule,
    MatSlideToggleModule, MatChipsModule, MatSnackBarModule
  ],
  template: `
    <div class="quote-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">request_quote</mat-icon>
        <h2>Quotation Request</h2>
        <button aria-label="Close" mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>What do you need quoted?</mat-label>
          <input matInput [(ngModel)]="subject" placeholder="e.g. 5 x office chairs">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Details / specifications</mat-label>
          <textarea matInput rows="3" [(ngModel)]="details"
                    placeholder="Describe the goods/services, quantity, deadline…"></textarea>
        </mat-form-field>

        <div class="uploaded">
          <div class="up-head">
            <span>Attach quotes already received (optional)</span>
            <button mat-stroked-button type="button" (click)="fileInput.click()">
              <mat-icon>upload_file</mat-icon> Add quote
            </button>
            <input #fileInput type="file" hidden multiple
                   accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx"
                   (change)="onPicked($event)">
          </div>
          @if (files.length > 0) {
            <div class="chips">
              @for (f of files; track f.name; let i = $index) {
                <div class="file-chip">
                  <mat-icon>description</mat-icon>
                  <span class="fname">{{ f.name }}</span>
                  <button aria-label="Close" mat-icon-button (click)="remove(i)"><mat-icon>close</mat-icon></button>
                </div>
              }
            </div>
          }
        </div>

        @if (files.length > 0) {
          <div class="paperless-step">
            <div class="pl-toggle-row">
              <div class="pl-toggle-text">
                <span class="pl-title"><mat-icon>fact_check</mat-icon> Make this a paperless workflow?</span>
                <span class="pl-sub">Route the quotes to signers &amp; approvers for sign-off.</span>
              </div>
              <mat-slide-toggle color="primary" [(ngModel)]="paperless"></mat-slide-toggle>
            </div>

            @if (paperless) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Add signers &amp; approvers</mat-label>
                <input matInput [(ngModel)]="userQuery" (ngModelChange)="onSearch($event)"
                       placeholder="Search people by name or email…">
                <mat-icon matPrefix>person_search</mat-icon>
                @if (searching) { <mat-spinner matSuffix diameter="18"></mat-spinner> }
              </mat-form-field>

              @if (results.length > 0) {
                <div class="results">
                  @for (u of results; track u.id) {
                    <div class="result-row">
                      <div class="r-info">
                        <span class="r-name">{{ u.name }}</span>
                        <span class="r-email">{{ u.email }}</span>
                      </div>
                      <div class="r-actions">
                        <button mat-stroked-button (click)="addUser(u, 'signer')"><mat-icon>draw</mat-icon> Signer</button>
                        <button mat-stroked-button color="primary" (click)="addUser(u, 'approver')"><mat-icon>verified</mat-icon> Approver</button>
                      </div>
                    </div>
                  }
                </div>
              }

              @if (picked.length > 0) {
                <mat-chip-set>
                  @for (p of picked; track p.id + p.role) {
                    <mat-chip (removed)="removeUser(p)">
                      <mat-icon>{{ p.role === 'signer' ? 'draw' : 'verified' }}</mat-icon>
                      {{ p.name }} · {{ p.role }}
                      <button aria-label="Close" matChipRemove><mat-icon>cancel</mat-icon></button>
                    </mat-chip>
                  }
                </mat-chip-set>
              }
            }
          </div>
        }
      </div>

      <div class="dialog-actions">
        <button mat-button type="button" (click)="close()">Cancel</button>
        <button mat-raised-button color="primary" (click)="submit()"
                [disabled]="submitting || !subject || (paperless && picked.length === 0)">
          @if (submitting) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>send</mat-icon> Submit
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .quote-dialog { width: 100%; color: var(--color-text); }
    .quote-dialog ::ng-deep .mat-mdc-form-field { color: var(--color-text); }
    .quote-dialog ::ng-deep input.mat-mdc-input-element,
    .quote-dialog ::ng-deep textarea.mat-mdc-input-element { color: var(--color-text) !important; caret-color: var(--color-text); }
    .quote-dialog ::ng-deep .mat-mdc-form-field-infix input::placeholder,
    .quote-dialog ::ng-deep .mat-mdc-form-field-infix textarea::placeholder { color: #9aa0ab !important; }
    .quote-dialog ::ng-deep .mdc-floating-label,
    .quote-dialog ::ng-deep .mat-mdc-form-field-label,
    .quote-dialog ::ng-deep .mdc-text-field__affix { color: #5b6270 !important; }
    .quote-dialog ::ng-deep .mdc-text-field--outlined .mdc-notched-outline__leading,
    .quote-dialog ::ng-deep .mdc-text-field--outlined .mdc-notched-outline__notch,
    .quote-dialog ::ng-deep .mdc-text-field--outlined .mdc-notched-outline__trailing { border-color: #c7ccd6; }
    .dialog-header {
      display: flex; align-items: center; justify-content: center; gap: 12px;
      padding: 18px 24px; background: linear-gradient(135deg, var(--color-primary-hover) 0%, var(--color-primary-hover) 100%);
      color: white; margin: -24px -24px 0 -24px; position: relative;
    }
    .header-icon { font-size: 30px; width: 30px; height: 30px; }
    .dialog-header h2 { margin: 0; font-size: 1.4rem; }
    .close-btn { color: white; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); }
    .dialog-content { padding: 22px 2px 8px; }
    .full-width { width: 100%; }
    .uploaded { margin-bottom: 14px; }
    .up-head { display: flex; align-items: center; gap: 12px; justify-content: space-between; margin-bottom: 10px; color: var(--color-text-2); font-size: .9rem; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .file-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 12px;
      background: var(--color-surface); border: 1px solid var(--color-primary-soft); border-radius: 20px; }
    .file-chip .fname { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .85rem; }
    .file-chip mat-icon { color: var(--color-primary-hover); }
    .file-chip button { width: 28px; height: 28px; line-height: 28px; }
    .paperless-step { padding: 14px; background: #eef4ff; border: 1px solid #c5d8ff; border-radius: 12px; margin-top: 8px; }
    .pl-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .pl-toggle-text { display: flex; flex-direction: column; }
    .pl-title { display: flex; align-items: center; gap: 8px; font-weight: 600; color: #1a3f8f; }
    .pl-sub { font-size: .82rem; color: #5b6b8c; margin-top: 2px; }
    .results { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 10px; overflow: hidden; margin: 12px 0; }
    .result-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--color-line); }
    .result-row:last-child { border-bottom: none; }
    .r-info { display: flex; flex-direction: column; }
    .r-name { font-weight: 600; color: var(--color-text); font-size: .9rem; }
    .r-email { font-size: .78rem; color: var(--color-text-3); }
    .r-actions { display: flex; gap: 8px; }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 14px; border-top: 1px solid var(--color-line); }
    .dialog-actions button { display: flex; align-items: center; gap: 8px; }
  `]
})
export class QuotationRequestDialogComponent {
  private dialogRef = inject(MatDialogRef<QuotationRequestDialogComponent>);
  private snackBar = inject(MatSnackBar);
  private paperlessSvc = inject(PaperlessService);

  subject = '';
  details = '';
  files: File[] = [];

  paperless = false;
  userQuery = '';
  results: PaperlessUser[] = [];
  searching = false;
  picked: PickedUser[] = [];
  submitting = false;
  private searchTimer: any;

  onPicked(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files) this.files.push(...Array.from(input.files));
    input.value = '';
  }

  remove(i: number): void { this.files.splice(i, 1); }

  onSearch(q: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const term = (q || '').trim();
    if (term.length < 2) { this.results = []; return; }
    this.searching = true;
    this.searchTimer = setTimeout(() => {
      this.paperlessSvc.searchUsers(term).subscribe({
        next: (list) => {
          const takenIds = new Set(this.picked.map(p => p.id));
          this.results = (list || []).filter(u => !takenIds.has(u.id)).slice(0, 8);
          this.searching = false;
        },
        error: () => { this.results = []; this.searching = false; }
      });
    }, 300);
  }

  addUser(u: PaperlessUser, role: RecipientRole): void {
    if (this.picked.some(p => p.id === u.id && p.role === role)) return;
    this.picked.push({ id: u.id, name: u.name, email: u.email, role });
    this.results = this.results.filter(r => r.id !== u.id);
    this.userQuery = '';
  }

  removeUser(p: PickedUser): void {
    this.picked = this.picked.filter(x => !(x.id === p.id && x.role === p.role));
  }

  async submit(): Promise<void> {
    if (!this.subject) return;
    if (this.paperless && this.picked.length === 0) {
      this.snackBar.open('Add at least one signer or approver for the workflow.', 'OK', { duration: 3500 });
      return;
    }
    this.submitting = true;

    try {
      if (this.files.length > 0) {
        const primary = await this.paperlessSvc.uploadPrimary(this.files[0], 'ThreeQuote' as any);
        if (primary) {
          for (let i = 1; i < this.files.length; i++) {
            await this.paperlessSvc.addStackItem(primary.id, 'Invoice', this.files[i], 'ThreeQuote' as any);
          }
          if (this.paperless) {
            const signers = this.picked.filter(p => p.role === 'signer');
            const approvers = this.picked.filter(p => p.role === 'approver');
            for (const s of signers) this.paperlessSvc.addRecipient(primary.id, s.name, 'signer', s.email);
            for (const a of approvers) this.paperlessSvc.addRecipient(primary.id, a.name, 'approver', a.email);
            this.paperlessSvc.sendForSignature(primary.id);
          }
        }
      }

      this.snackBar.open(
        this.paperless
          ? `Quotation workflow created and sent to ${this.picked.length} recipient(s).`
          : 'Quotation request submitted.',
        'OK', { duration: 4500 });
      this.submitting = false;
      this.dialogRef.close(true);
    } catch {
      this.submitting = false;
      this.snackBar.open('Could not submit the quotation request. Please try again.', 'OK', { duration: 4000 });
    }
  }

  close(): void { this.dialogRef.close(); }
}
