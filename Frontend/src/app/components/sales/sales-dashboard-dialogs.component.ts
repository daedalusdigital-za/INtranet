// ============================================================
// Sales dialog components â€” extracted verbatim from the former
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
      <mat-icon style="color:#1a237e;">receipt_long</mat-icon>
      {{ data.pod.podNumber || ('POD' + data.pod.id) }} â€” Invoices
    </h2>
    <mat-dialog-content style="min-width: 380px;">
      @if (invoices.length > 0) {
        <div style="color:#666; font-size:13px; margin-bottom:8px;">
          {{ invoices.length }} invoice{{ invoices.length === 1 ? '' : 's' }} linked to this POD
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          @for (inv of invoices; track inv) {
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#f5f6fa; border-radius:8px;">
              <mat-icon style="color:#3f51b5; font-size:20px; width:20px; height:20px;">receipt</mat-icon>
              <span style="font-family:monospace; font-weight:600;">{{ inv }}</span>
            </div>
          }
        </div>
      } @else {
        <div style="color:#888; padding:16px 0; text-align:center;">
          <mat-icon style="font-size:32px; width:32px; height:32px; opacity:.4;">receipt</mat-icon>
          <div>No invoice numbers recorded on this POD.</div>
        </div>
      }

      @if (data.pod.loadId) {
        <mat-divider style="margin:16px 0;"></mat-divider>
        <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:#e8f5e9; border-radius:8px;">
          <mat-icon style="color:#2e7d32;">local_shipping</mat-icon>
          <div>
            <div style="font-size:12px; color:#666;">Linked Tripsheet</div>
            <div style="font-weight:600; color:#1b5e20;">{{ data.pod.loadNumber || ('Load #' + data.pod.loadId) }}</div>
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
          <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #1a237e, #3f51b5); color: white; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600;">
            {{ data.from.charAt(0).toUpperCase() }}
          </div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 16px;">{{ data.from }}</div>
            <div style="color: #666; font-size: 13px;">{{ data.fromEmail }}</div>
          </div>
          <div style="text-align: right; color: #888; font-size: 13px;">
            <div>{{ data.date | date:'dd MMM yyyy' }}</div>
            <div>{{ data.date | date:'HH:mm:ss' }}</div>
          </div>
        </div>

        <div style="background: #f5f5f5; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px;">
          <div style="font-weight: 600; font-size: 18px; margin-bottom: 4px;">{{ data.subject }}</div>
          @if (data.hasAttachments) {
            <mat-chip style="margin-top: 4px;">
              <mat-icon style="font-size: 16px; width: 16px; height: 16px;">attach_file</mat-icon>
              Has Attachments
            </mat-chip>
          }
        </div>

        <mat-divider></mat-divider>

        <div style="margin-top: 12px;">
          <div style="display: flex; gap: 8px; margin-bottom: 6px; color: #666; font-size: 13px;">
            <strong style="min-width: 60px;">To:</strong>
            <span>{{ data.to.join(', ') || 'N/A' }}</span>
          </div>
          @if (data.cc.length > 0) {
            <div style="display: flex; gap: 8px; margin-bottom: 6px; color: #666; font-size: 13px;">
              <strong style="min-width: 60px;">Cc:</strong>
              <span>{{ data.cc.join(', ') }}</span>
            </div>
          }
          <div style="display: flex; gap: 8px; margin-bottom: 6px; color: #666; font-size: 13px;">
            <strong style="min-width: 60px;">Mailbox:</strong>
            <span>{{ data.foundInAccounts?.join(', ') || data.accountEmail }}</span>
          </div>
        </div>

        @if (data.preview) {
          <mat-divider style="margin: 12px 0;"></mat-divider>
          <div style="padding: 12px; background: #fafafa; border-radius: 8px; border-left: 3px solid #1a237e; font-size: 14px; line-height: 1.6; white-space: pre-wrap; max-height: 300px; overflow-y: auto;">
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
  private snackBar = inject(MatSnackBar);

  copyEmail(): void {
    navigator.clipboard.writeText(this.data.fromEmail).then(() => {
      this.snackBar.open(`Copied: ${this.data.fromEmail}`, 'Close', { duration: 2000 });
    });
  }
}
