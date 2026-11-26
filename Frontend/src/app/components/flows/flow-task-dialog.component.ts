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
import { FlowCatalog, FlowTask, FlowsService, WellyTaskInfo } from '../../services/flows.service';
import { ToastService } from '../../ui/toast.service';
import { ConfirmService } from '../../ui/confirm.service';

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

      @if (mode === 'complete' && welly; as w) {
        <div class="ftd-welly" [attr.data-s]="w.status">
          <img class="ftd-welly-face" [src]="w.status === 'fallback' ? '/welly/thinking.png' : '/welly/happy.png'" alt="" />
          <div class="ftd-welly-main">
            <div class="ftd-welly-head">
              <b>{{ wellyHeadline(w) }}</b>
              @if (w.status === 'suggested' && (w.confidence ?? 1) < 0.5) { <span class="ftd-welly-unsure">Not sure: please check</span> }
            </div>
            @if (w.summary) { <div class="ftd-welly-sum">{{ w.summary }}</div> }
            @if (w.evidence?.length && w.status !== 'fallback') {
              <ul class="ftd-welly-ev">@for (e of w.evidence!; track $index) { <li><span>{{ e.label }}</span>{{ e.value }}</li> }</ul>
            }
            @if (w.status === 'suggested') {
              <div class="ftd-welly-foot">
                <span>I've filled the form in. Check it, then click <b>Do it</b>.</span>
                <button mat-button type="button" (click)="notRight()" [disabled]="busy"><mat-icon>thumb_down_off_alt</mat-icon>Not right</button>
              </div>
            }
            @if (w.status === 'rejected' && w.reason) { <div class="ftd-welly-sum muted">Your note: “{{ w.reason }}”</div> }
          </div>
        </div>
      }

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
            @if (busy) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>{{ wellyUntouched() ? 'smart_toy' : 'task_alt' }}</mat-icon> } {{ wellyUntouched() ? 'Do it' : 'Mark done' }}
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
    .ftd-welly { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; margin: 0 0 14px; border-radius: 12px;
      background: var(--color-primary-soft); border: 1px solid color-mix(in srgb, var(--color-primary, #2563eb) 25%, transparent); }
    .ftd-welly[data-s="fallback"], .ftd-welly[data-s="rejected"] { background: var(--color-surface-2); border-color: var(--color-line); }
    .ftd-welly-face { width: 44px; height: 44px; object-fit: contain; flex: none; }
    .ftd-welly-main { flex: 1; min-width: 0; display: grid; gap: 6px; font-size: var(--text-sm); color: var(--color-text); }
    .ftd-welly-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .ftd-welly-unsure { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 999px; background: var(--color-warn-soft); color: #b45309; }
    .ftd-welly-sum { line-height: 1.4; }
    .ftd-welly-ev { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; font-size: 12.5px; color: var(--color-text-2);
      li { overflow-wrap: anywhere; } span { color: var(--color-text-3); margin-right: 6px; } span::after { content: ':'; } }
    .ftd-welly-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; font-size: 12.5px; color: var(--color-text-2);
      button { display: inline-flex; align-items: center; gap: 4px; } }
  `]
})
export class FlowTaskDialogComponent {
  data = inject<{ task: FlowTask; catalog: FlowCatalog }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<FlowTaskDialogComponent>);
  private api = inject(FlowsService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  task = this.data.task;
  welly: WellyTaskInfo | null = this.task.welly ?? null;
  mode: 'complete' | 'reassign' = 'complete';
  result: Record<string, any> = {};
  comment = '';
  decision = '';
  busy = false;
  reassignUserId: number | null = null;
  reassignDeptId: number | null = null;
  reassignRole: string | null = null;

  constructor() {
    // Welly prepared this step: start from its answers; the person can change anything before Do it.
    if (this.welly?.status === 'suggested' && this.welly.prefill) {
      const keys = new Set((this.task.form || []).map(f => f.key));
      for (const [k, v] of Object.entries(this.welly.prefill)) if (keys.has(k) && v !== null && v !== '') this.result[k] = v;
    }
  }

  wellyHeadline(w: WellyTaskInfo): string {
    switch (w.status) {
      case 'suggested': return `Welly prepared this · ${w.title || w.skill}`;
      case 'fallback': return `Welly couldn't do this one`;
      case 'rejected': return `You told Welly this was wrong`;
      default: return `Welly · ${w.title || w.skill}`;
    }
  }

  /** True while the form still holds exactly what Welly prepared (so the button reads "Do it"). */
  wellyUntouched(): boolean {
    const w = this.welly;
    if (!w || w.status !== 'suggested' || !w.prefill) return false;
    const keys = new Set((this.task.form || []).map(f => f.key));
    return Object.entries(w.prefill).every(([k, v]) => !keys.has(k) || String(this.result[k] ?? '') === String(v ?? ''));
  }

  async notRight() {
    const reason = await this.confirm.askText({
      title: 'What did Welly get wrong?', label: 'What was wrong', required: true, multiline: true,
      hint: 'This is saved so Welly can learn. The task stays with you.', confirmText: 'Tell Welly'
    });
    if (reason === null) return;
    this.busy = true;
    this.api.rejectWelly(this.task.id, reason).subscribe({
      next: t => {
        this.busy = false;
        const prefill = this.welly?.prefill || {};
        for (const k of Object.keys(prefill)) if (String(this.result[k] ?? '') === String(prefill[k] ?? '')) delete this.result[k];
        this.welly = t.welly ?? null;
        this.toast.done('Thanks. Welly has noted it; fill the form in yourself.');
      },
      error: err => { this.busy = false; this.toast.error(err?.error?.message || 'Could not save that'); }
    });
  }

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
