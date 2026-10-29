import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FlowCatalog, FlowTask, FlowsService } from '../../services/flows.service';
import { ToastService } from '../../ui/toast.service';

/** Complete a task or decide an approval; renders the step's form fields. Also supports reassigning. */
@Component({
  selector: 'app-flow-task-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatProgressSpinnerModule, MatCheckboxModule],
  template: `
    <h2 mat-dialog-title class="ftd-title">
      <mat-icon>{{ task.kind === 'approval' ? 'fact_check' : 'assignment_ind' }}</mat-icon>
      <span>{{ task.title }}</span>
    </h2>
    <mat-dialog-content class="ftd-body">
      <div class="ftd-meta">
        <span class="chip">{{ task.runNumber }}</span>
        <span class="chip" [class.urgent]="task.priority === 'Urgent'" [class.high]="task.priority === 'High'">{{ task.priority }}</span>
        @if (task.dueAt) { <span class="chip" [class.overdue]="task.isOverdue">Due {{ task.dueAt | date:'dd MMM HH:mm' }}</span> }
        <span class="chip">{{ task.assigneeLabel }}</span>
      </div>
      @if (task.description) { <pre class="ftd-desc">{{ task.description }}</pre> }

      @if (mode === 'complete') {
        <form #f="ngForm" class="ftd-form">
          @for (fld of task.form || []; track fld.key) {
            @if (fld.type === 'select') {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ fld.label }}</mat-label>
                <mat-select [(ngModel)]="result[fld.key]" [name]="fld.key" [required]="!!fld.required">
                  @for (o of fld.options || []; track o) { <mat-option [value]="o">{{ o }}</mat-option> }
                </mat-select>
              </mat-form-field>
            } @else if (fld.type === 'textarea') {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ fld.label }}</mat-label>
                <textarea matInput rows="3" [(ngModel)]="result[fld.key]" [name]="fld.key" [required]="!!fld.required"></textarea>
              </mat-form-field>
            } @else if (fld.type === 'checkbox') {
              <mat-checkbox [(ngModel)]="result[fld.key]" [name]="fld.key">{{ fld.label }}</mat-checkbox>
            } @else {
              <mat-form-field appearance="outline" class="full">
                <mat-label>{{ fld.label }}</mat-label>
                <input matInput [type]="fld.type === 'number' ? 'number' : fld.type === 'date' ? 'date' : 'text'" [(ngModel)]="result[fld.key]" [name]="fld.key" [required]="!!fld.required" />
              </mat-form-field>
            }
          }
          <mat-form-field appearance="outline" class="full">
            <mat-label>{{ task.kind === 'approval' ? 'Comment (shown to the requester)' : 'Comment / outcome notes' }}</mat-label>
            <textarea matInput rows="3" [(ngModel)]="comment" name="comment" [required]="task.kind === 'approval' && decision === 'rejected'"></textarea>
          </mat-form-field>
        </form>
      } @else {
        <div class="ftd-form">
          <mat-form-field appearance="outline" class="full">
            <mat-label>Reassign to person</mat-label>
            <mat-select [(ngModel)]="reassignUserId">
              <mat-option [value]="null">—</mat-option>
              @for (u of data.catalog.users; track u.id) { <mat-option [value]="u.id">{{ u.name }} <span class="muted">· {{ u.role }}</span></mat-option> }
            </mat-select>
          </mat-form-field>
          <div class="or">or a pool</div>
          <div class="two">
            <mat-form-field appearance="outline"><mat-label>Department</mat-label>
              <mat-select [(ngModel)]="reassignDeptId"><mat-option [value]="null">Any</mat-option>@for (d of data.catalog.departments; track d.id) { <mat-option [value]="d.id">{{ d.name }}</mat-option> }</mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Role</mat-label>
              <mat-select [(ngModel)]="reassignRole"><mat-option [value]="null">Any</mat-option>@for (r of data.catalog.roles; track r) { <mat-option [value]="r">{{ r }}</mat-option> }</mat-select>
            </mat-form-field>
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions class="ftd-actions">
      <button mat-button type="button" (click)="mode = mode === 'complete' ? 'reassign' : 'complete'" [disabled]="busy">
        <mat-icon>{{ mode === 'complete' ? 'person_search' : 'arrow_back' }}</mat-icon>{{ mode === 'complete' ? 'Reassign' : 'Back' }}
      </button>
      <span class="spacer"></span>
      <button mat-button mat-dialog-close [disabled]="busy">Close</button>
      @if (mode === 'complete') {
        @if (task.kind === 'approval') {
          <button mat-stroked-button color="warn" (click)="decide('rejected')" [disabled]="busy || !formValid()"><mat-icon>close</mat-icon>Reject</button>
          <button mat-flat-button color="primary" (click)="decide('approved')" [disabled]="busy || !formValid()"><mat-icon>check</mat-icon>Approve</button>
        } @else {
          <button mat-flat-button color="primary" (click)="decide('completed')" [disabled]="busy || !formValid()">
            @if (busy) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>task_alt</mat-icon> } Mark done
          </button>
        }
      } @else {
        <button mat-flat-button color="primary" (click)="reassign()" [disabled]="busy || (!reassignUserId && !reassignDeptId && !reassignRole)"><mat-icon>send</mat-icon>Reassign</button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .ftd-title { display: flex; align-items: center; gap: 8px; font-size: 18px; line-height: 1.3; }
    .ftd-body { min-width: min(560px, 90vw); }
    .ftd-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
    .chip { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-2, var(--color-surface-2)); color: var(--color-text-2); }
    .chip.urgent { background: var(--color-danger-soft); color: #b91c1c; } .chip.high { background: #ffedd5; color: #c2410c; } .chip.overdue { background: var(--color-danger-soft); color: #b91c1c; }
    .ftd-desc { white-space: pre-wrap; font-family: inherit; font-size: var(--text-sm); background: var(--color-surface-2, var(--color-surface-2)); border-radius: 8px; padding: 10px 12px; margin: 0 0 12px; color: var(--color-text); max-height: 260px; overflow: auto; }
    .ftd-form { display: grid; gap: 4px; }
    .full { width: 100%; } .two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .or { text-align: center; color: var(--color-text-3); font-size: 12px; margin: -4px 0 4px; }
    .muted { color: var(--color-text-3); font-size: 12px; }
    .ftd-actions { display: flex; gap: 6px; } .spacer { flex: 1; }
    .ftd-actions button { display: inline-flex; align-items: center; gap: 6px; }
  `]
})
export class FlowTaskDialogComponent {
  data = inject<{ task: FlowTask; catalog: FlowCatalog }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<FlowTaskDialogComponent>);
  private api = inject(FlowsService);
  private toast = inject(ToastService);

  task = this.data.task;
  mode: 'complete' | 'reassign' = 'complete';
  result: Record<string, any> = {};
  comment = '';
  decision = '';
  busy = false;
  reassignUserId: number | null = null;
  reassignDeptId: number | null = null;
  reassignRole: string | null = null;

  formValid(): boolean {
    for (const f of this.task.form || []) {
      if (f.required && (this.result[f.key] === undefined || this.result[f.key] === null || this.result[f.key] === '')) return false;
    }
    return true;
  }

  decide(decision: 'approved' | 'rejected' | 'completed') {
    this.decision = decision;
    if (decision === 'rejected' && !this.comment.trim()) { this.toast.warn('Please give a reason for rejecting.'); return; }
    this.busy = true;
    this.api.completeTask(this.task.id, { decision, result: this.result, comment: this.comment }).subscribe({
      next: res => { this.busy = false; this.toast.done(decision === 'completed' ? 'Task completed' : `Decision recorded: ${decision}`); this.ref.close(res); },
      error: err => { this.busy = false; this.toast.error(err?.error?.message || 'Could not complete task'); }
    });
  }

  reassign() {
    this.busy = true;
    this.api.reassign(this.task.id, { userId: this.reassignUserId ?? undefined, departmentId: this.reassignDeptId ?? undefined, role: this.reassignRole ?? undefined }).subscribe({
      next: res => { this.busy = false; this.toast.done('Task reassigned'); this.ref.close({ run: res }); },
      error: err => { this.busy = false; this.toast.error(err?.error?.message || 'Could not reassign'); }
    });
  }
}
