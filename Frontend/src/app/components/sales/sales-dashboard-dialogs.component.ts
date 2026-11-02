// ============================================================
// Sales dialog components — extracted verbatim from the former
// 12.8k-line sales-dashboard.component.ts.
// ============================================================
import { Component, OnInit, inject, signal, computed, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SalesImportDialogComponent, SalesImportDialogData, SalesImportDialogResult } from '../shared/sales-import-dialog/sales-import-dialog.component';
import { ImportTripsheetDialog, CreateTripsheetDialog, EditPodDialog, UploadPodDocumentDialog } from '../logistics/logistics-dashboard.component';
import { environment } from '../../../environments/environment';
import { WellyActivityService } from '../../services/welly-activity.service';
import { PROMED_BACK_ORDERS, ACCESS_BACK_ORDERS, PHARMATECH_BACK_ORDERS, SEBENZANI_BACK_ORDERS, BackOrderItem } from './back-orders-data';
import * as XLSX from 'xlsx';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../ui/toast.service';

// Company definitions
import { Invoice, IncomingOrderEmail } from './sales.models';

// POD Invoices Dialog Component
@Component({
  selector: 'app-pod-invoices-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title style="display: flex; align-items: center; gap: 8px;">
      <mat-icon style="color:var(--color-brand);">receipt_long</mat-icon>
      {{ data.pod.podNumber || ('POD' + data.pod.id) }} — Invoices
    </h2>
    <mat-dialog-content style="min-width: 380px;">
      @if (invoices.length > 0) {
        <div style="color:var(--color-text-2); font-size:var(--text-sm); margin-bottom:8px;">
          {{ invoices.length }} invoice{{ invoices.length === 1 ? '' : 's' }} linked to this POD
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          @for (inv of invoices; track inv) {
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--color-surface-2); border-radius:8px;">
              <mat-icon style="color:var(--color-primary); font-size:20px; width:20px; height:20px;">receipt</mat-icon>
              <span style="font-family:var(--font-mono); font-weight:600;">{{ inv }}</span>
            </div>
          }
        </div>
      } @else {
        <div style="color:var(--color-text-3); padding:16px 0; text-align:center;">
          <mat-icon style="font-size:32px; width:32px; height:32px; opacity:.4;">receipt</mat-icon>
          <div>No invoice numbers recorded on this POD.</div>
        </div>
      }

      @if (data.pod.loadId) {
        <mat-divider style="margin:16px 0;"></mat-divider>
        <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--color-ok-soft); border-radius:8px;">
          <mat-icon style="color:var(--color-ok);">local_shipping</mat-icon>
          <div>
            <div style="font-size:var(--text-xs); color:var(--color-text-2);">Linked Tripsheet</div>
            <div style="font-weight:600; color:var(--color-ok);">{{ data.pod.loadNumber || ('Load #' + data.pod.loadId) }}</div>
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `
})
export class PodInvoicesDialog {
  invoices: string[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: { pod: any }) {
    const set = new Set<string>();
    if (Array.isArray(this.data.pod?.invoiceLinks)) {
      this.data.pod.invoiceLinks.forEach((l: any) => {
        if (l?.invoiceNumber) set.add(l.invoiceNumber);
      });
    }
    if (this.data.pod?.invoiceNumber) set.add(this.data.pod.invoiceNumber);
    this.invoices = Array.from(set);
  }
}

// Email Detail Dialog Component
@Component({
  selector: 'app-email-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title style="display: flex; align-items: center; gap: 8px;">
      <mat-icon>email</mat-icon>
      Email Detail
      @if (!data.isRead) {
        <mat-chip class="unread-chip">Unread</mat-chip>
      }
      @if (data.priority === 'High') {
        <mat-chip class="priority-chip">High Priority</mat-chip>
      }
    </h2>
    <mat-dialog-content style="min-width: 500px;">
      <div style="margin-bottom: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--color-primary-soft); color: var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: var(--text-2xl); font-weight: 600;">
            {{ data.from.charAt(0).toUpperCase() }}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: var(--text-lg);">{{ data.from }}</div>
            <div style="color: var(--color-text-2); font-size: var(--text-sm);">{{ data.fromEmail }}</div>
          </div>
          <div style="text-align: right; color: var(--color-text-3); font-size: var(--text-sm);">
            <div>{{ data.date | date:'dd MMM yyyy' }}</div>
            <div>{{ data.date | date:'HH:mm:ss' }}</div>
          </div>
        </div>

        <div style="background: var(--color-surface-2); padding: 12px 16px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: var(--text-xl); margin-bottom: 4px;">{{ data.subject }}</div>
          @if (data.hasAttachments) {
            <mat-chip style="margin-top: 4px;">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px;">attach_file</mat-icon>
              Has Attachments
            </mat-chip>
          }
        </div>

        <mat-divider></mat-divider>

        <div style="margin-top: 12px;">
          <div style="display: flex; gap: 8px; margin-bottom: 6px; color: var(--color-text-2); font-size: var(--text-sm);">
            <strong style="min-width: 60px;">To:</strong>
            <span>{{ data.to.join(', ') || 'N/A' }}</span>
          </div>
          @if (data.cc.length > 0) {
            <div style="display: flex; gap: 8px; margin-bottom: 6px; color: var(--color-text-2); font-size: var(--text-sm);">
              <strong style="min-width: 60px;">Cc:</strong>
              <span>{{ data.cc.join(', ') }}</span>
            </div>
          }
          <div style="display: flex; gap: 8px; margin-bottom: 6px; color: var(--color-text-2); font-size: var(--text-sm);">
            <strong style="min-width: 60px;">Mailbox:</strong>
            <span>{{ data.foundInAccounts?.join(', ') || data.accountEmail }}</span>
          </div>
        </div>

        @if (data.preview) {
          <mat-divider style="margin: 12px 0;"></mat-divider>
          <div style="padding: 12px; background: var(--color-canvas); border-radius: 8px; border-left: 3px solid var(--color-brand); font-size: var(--text-md); line-height: 1.6; white-space: pre-wrap; max-height: 300px; overflow-y: auto;">
            {{ data.preview }}
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="copyEmail()">
        <mat-icon>content_copy</mat-icon> Copy Sender
      </button>
      <button mat-raised-button color="primary" mat-dialog-close>
        <mat-icon>close</mat-icon> Close
      </button>
    </mat-dialog-actions>
  `
})
export class EmailDetailDialogComponent {
  data = inject<IncomingOrderEmail>(MAT_DIALOG_DATA);
  private toast = inject(ToastService);

  copyEmail(): void {
    navigator.clipboard.writeText(this.data.fromEmail).then(() => {
      this.toast.done(`Copied: ${this.data.fromEmail}`);
    });
  }
}
