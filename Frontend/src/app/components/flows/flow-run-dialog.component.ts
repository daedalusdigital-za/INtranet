import { Component, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { FlowCatalog, FlowRunDetail, FlowStep, FlowTask, FlowsService } from '../../services/flows.service';
import { ToastService } from '../../ui/toast.service';
import { ConfirmService } from '../../ui/confirm.service';
import { FlowTaskDialogComponent } from './flow-task-dialog.component';
import { FlowCanvasComponent } from './flow-canvas.component';

/** One run: where it is in the flow, its tasks, the audit timeline and the data it carries. */
@Component({
  selector: 'app-flow-run-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, MatTabsModule, FlowCanvasComponent],
  template: `
    @if (!d()) {
      <div class="rd-loading"><mat-spinner diameter="36"></mat-spinner></div>
    } @else {
      <h2 mat-dialog-title class="rd-title">
        <span class="rd-num">{{ d()!.summary.runNumber }}</span>
        <span class="rd-name">{{ d()!.summary.title }}</span>
        <span class="rd-status" [attr.data-s]="d()!.summary.status">{{ d()!.summary.status }}</span>
        <span class="spacer"></span>
        <button mat-icon-button (click)="reload()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
      </h2>
      <mat-dialog-content class="rd-body">
        <div class="rd-meta">
          <span><mat-icon>account_tree</mat-icon>{{ d()!.summary.flowName }} · L{{ d()!.summary.level }}</span>
          <span><mat-icon>person</mat-icon>{{ d()!.summary.startedBy }}</span>
          <span><mat-icon>schedule</mat-icon>{{ d()!.summary.startedAt | date:'dd MMM HH:mm' }}@if (d()!.summary.completedAt) { → {{ d()!.summary.completedAt | date:'dd MMM HH:mm' }} }</span>
          @if (d()!.summary.entityKey) { <span><mat-icon>link</mat-icon>{{ d()!.summary.entityType }} #{{ d()!.summary.entityKey }}</span> }
          @if (d()!.summary.outcome) { <span><mat-icon>flag</mat-icon>{{ d()!.summary.outcome }}</span> }
        </div>
        @if (d()!.summary.error) { <div class="rd-error"><mat-icon>error</mat-icon>{{ d()!.summary.error }}</div> }

        <!-- Step track -->
        <div class="rd-track">
          @for (s of d()!.graph.steps; track s.id) {
            <div class="rd-node" [class.done]="stepState(s) === 'done'" [class.current]="stepState(s) === 'current'" [class.skipped]="stepState(s) === 'skipped'" [matTooltip]="s.type + ' · ' + s.id">
              <mat-icon>{{ iconFor(s) }}</mat-icon><span>{{ s.name || s.id }}</span>
            </div>
          }
        </div>

        <mat-tab-group animationDuration="120ms" (selectedIndexChange)="onTab($event)">
          <mat-tab label="Map">
            <div class="rd-map">
              @if (mapReady()) {
                <app-flow-canvas [steps]="d()!.graph.steps" [startStepId]="d()!.graph.startStepId ?? null" [catalog]="data.catalog" [readonly]="true"
                                 [triggerType]="$any(d()!.summary.triggerSource?.startsWith('event') ? 'event' : d()!.summary.triggerSource === 'schedule' ? 'schedule' : 'manual')"
                                 [triggerLabel]="d()!.summary.triggerSource || 'manual'" [highlight]="highlight()"></app-flow-canvas>
              }
            </div>
          </mat-tab>
          <mat-tab [label]="'Tasks (' + d()!.tasks.length + ')'">
            <div class="rd-list">
              @for (t of d()!.tasks; track t.id) {
                <div class="rd-task" [attr.data-s]="t.status">
                  <mat-icon>{{ t.kind === 'approval' ? 'fact_check' : 'assignment_ind' }}</mat-icon>
                  <div class="rd-task-main">
                    <b>{{ t.title }}</b>
                    <small>{{ t.assigneeLabel }} · {{ t.priority }}@if (t.dueAt) { · due {{ t.dueAt | date:'dd MMM HH:mm' }} }@if (t.isOverdue && (t.status === 'open' || t.status === 'escalated')) { · <span class="ov">overdue</span> }@if (t.escalationCount) { · escalated ×{{ t.escalationCount }} }</small>
                    @if (t.completedAt) { <small>{{ t.status }} by {{ t.completedBy }} on {{ t.completedAt | date:'dd MMM HH:mm' }}@if (t.comment) { — “{{ t.comment }}” }</small> }
                    @if (t.result && objectKeys(t.result).length) { <small class="rd-kv">@for (k of objectKeys(t.result); track k) { <code>{{ k }}: {{ t.result![k] }}</code> }</small> }
                  </div>
                  <span class="rd-status small" [attr.data-s]="t.status">{{ t.status }}</span>
                  @if (t.status === 'open' || t.status === 'escalated') { <button mat-stroked-button (click)="openTask(t)"><mat-icon>edit</mat-icon>Open</button> }
                </div>
              }
              @if (!d()!.tasks.length) { <p class="rd-empty">No human steps yet.</p> }
            </div>
          </mat-tab>
          <mat-tab [label]="'Timeline (' + d()!.events.length + ')'">
            <div class="rd-timeline">
              @for (e of d()!.events; track e.id) {
                <div class="rd-ev" [attr.data-t]="e.type">
                  <span class="rd-ev-dot"></span>
                  <div class="rd-ev-main">
                    <div class="rd-ev-head"><b>{{ e.type }}</b><span class="rd-ev-time">{{ e.occurredAt | date:'dd MMM HH:mm:ss' }}@if (e.userName) { · {{ e.userName }} }</span></div>
                    <div class="rd-ev-msg">{{ e.message }}</div>
                    @if (e.data && e.type === 'ai.analyzed') { <pre class="rd-pre">{{ e.data | json }}</pre> }
                  </div>
                </div>
              }
            </div>
          </mat-tab>
          <mat-tab label="Data">
            <pre class="rd-pre big">{{ d()!.context | json }}</pre>
          </mat-tab>
        </mat-tab-group>
      </mat-dialog-content>
      <mat-dialog-actions class="rd-actions">
        @if (d()!.summary.status === 'running' || d()!.summary.status === 'waiting') {
          <button mat-stroked-button color="warn" (click)="cancel()"><mat-icon>cancel</mat-icon>Cancel run</button>
        }
        <span class="spacer"></span>
        <button mat-flat-button color="primary" (click)="ref.close(changed)">Close</button>
      </mat-dialog-actions>
    }
  `,
  styles: [`
    .spacer { flex: 1; }
    .rd-loading { display: grid; place-items: center; padding: 60px; width: min(1200px, 92vw); }
    .rd-title { display: flex; align-items: center; gap: 10px; font-size: 17px; }
    .rd-num { font-family: ui-monospace, Consolas, monospace; font-size: 13px; color: var(--color-text-3); }
    .rd-name { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rd-status { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-3); color: #334155; font-weight: 600; }
    .rd-status.small { font-size: 10px; }
    .rd-status[data-s="running"] { background: var(--color-primary-soft); color: #1d4ed8; } .rd-status[data-s="waiting"], .rd-status[data-s="open"] { background: var(--color-warn-soft); color: #b45309; }
    .rd-status[data-s="completed"], .rd-status[data-s="approved"] { background: var(--color-ok-soft); color: #15803d; } .rd-status[data-s="failed"], .rd-status[data-s="rejected"] { background: var(--color-danger-soft); color: #b91c1c; }
    .rd-status[data-s="cancelled"] { background: var(--color-surface-2); color: var(--color-text-2); } .rd-status[data-s="escalated"] { background: var(--color-danger-soft); color: #b91c1c; }
    .rd-body { width: min(1200px, 92vw); max-height: 78vh; }
    .rd-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--color-text-2); font-size: 12.5px; margin-bottom: 8px; span { display: inline-flex; align-items: center; gap: 4px; } mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .rd-error { display: flex; gap: 6px; align-items: center; background: var(--color-danger-soft); color: #b91c1c; padding: 8px 10px; border-radius: 8px; font-size: 13px; margin-bottom: 8px; }
    .rd-track { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; background: var(--color-surface-2, var(--color-surface-2)); border-radius: 10px; margin-bottom: 8px; }
    .rd-node { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--color-border, var(--color-line)); background: var(--color-surface, var(--color-surface)); color: var(--color-text-3);
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
      &.done { color: #15803d; border-color: #86efac; background: var(--color-ok-soft); } &.current { color: #1d4ed8; border-color: #60a5fa; background: var(--color-primary-soft); font-weight: 600; box-shadow: 0 0 0 2px #bfdbfe; } }
    .rd-map { height: 50vh; min-height: 360px; padding: 8px 0; }
    .rd-list { display: grid; gap: 6px; padding: 8px 0; }
    .rd-task { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--color-border, var(--color-line)); border-radius: 10px; > mat-icon { color: var(--color-text-2); } button { display: inline-flex; align-items: center; gap: 4px; } }
    .rd-task-main { flex: 1; display: grid; line-height: 1.3; b { font-size: 13.5px; } small { font-size: 12px; color: var(--color-text-3); } .ov { color: #b91c1c; font-weight: 600; } }
    .rd-kv { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; code { font-size: 11px; background: var(--color-surface-2, var(--color-surface-2)); padding: 1px 6px; border-radius: 4px; } }
    .rd-empty { color: var(--color-text-3); font-size: 13px; padding: 12px 0; }
    .rd-timeline { padding: 10px 0 4px 4px; display: grid; gap: 2px; }
    .rd-ev { display: grid; grid-template-columns: 14px 1fr; gap: 8px; position: relative; padding-bottom: 10px;
      &::before { content: ''; position: absolute; left: 5px; top: 14px; bottom: -2px; width: 2px; background: var(--color-border, var(--color-surface-3)); } &:last-child::before { display: none; } }
    .rd-ev-dot { width: 12px; height: 12px; border-radius: 50%; background: #94a3b8; margin-top: 3px; border: 2px solid #fff; box-shadow: 0 0 0 1px #cbd5e1; }
    .rd-ev[data-t^="run."] .rd-ev-dot { background: #2563eb; } .rd-ev[data-t="run.failed"] .rd-ev-dot, .rd-ev[data-t="task.escalated"] .rd-ev-dot { background: #dc2626; }
    .rd-ev[data-t="ai.analyzed"] .rd-ev-dot { background: #7c3aed; } .rd-ev[data-t="task.completed"] .rd-ev-dot, .rd-ev[data-t="approval.decided"] .rd-ev-dot, .rd-ev[data-t="run.completed"] .rd-ev-dot { background: #16a34a; }
    .rd-ev-head { display: flex; gap: 8px; align-items: baseline; b { font-size: 12px; font-family: ui-monospace, Consolas, monospace; color: var(--color-text-2); } }
    .rd-ev-time { font-size: 11px; color: var(--color-text-3); }
    .rd-ev-msg { font-size: 13px; }
    .rd-pre { font-size: 11.5px; background: var(--color-surface-2, var(--color-surface-2)); border-radius: 8px; padding: 8px 10px; margin: 4px 0 0; white-space: pre-wrap; max-height: 200px; overflow: auto; &.big { max-height: 50vh; margin-top: 8px; } }
    .rd-actions { display: flex; gap: 6px; button { display: inline-flex; align-items: center; gap: 6px; } }
  `]
})
export class FlowRunDialogComponent {
  data = inject<{ runId: number; catalog: FlowCatalog }>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<FlowRunDialogComponent>);
  private api = inject(FlowsService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);

  d = signal<FlowRunDetail | null>(null);
  mapReady = signal(false);
  highlight = signal<Record<string, string>>({});
  changed = false;
  private visited = new Set<string>();
  @ViewChild(FlowCanvasComponent) canvas?: FlowCanvasComponent;

  constructor() { this.reload(); }

  reload() {
    this.api.run(this.data.runId).subscribe({
      next: r => {
        this.visited = new Set(r.events.filter(e => e.stepId && (e.type === 'step.completed' || e.type === 'step.started')).map(e => e.stepId!));
        const failed = new Set(r.events.filter(e => e.stepId && e.type === 'step.failed').map(e => e.stepId!));
        const h: Record<string, string> = {};
        for (const s of r.graph.steps) {
          if (failed.has(s.id)) h[s.id] = 'failed';
          else if (r.summary.currentStepId === s.id && (r.summary.status === 'running' || r.summary.status === 'waiting')) h[s.id] = r.summary.status === 'waiting' ? 'waiting' : 'current';
          else if (this.visited.has(s.id)) h[s.id] = 'done';
        }
        this.highlight.set(h);
        this.d.set(r);
        setTimeout(() => this.onTab(0));
      },
      error: () => { this.toast.error('Could not load run'); this.ref.close(false); }
    });
  }

  onTab(i: number) {
    if (i !== 0) return;
    this.mapReady.set(true);
    setTimeout(() => { if (this.canvas) { this.canvas.ensurePositions(); this.canvas.fit(); } }, 50);
  }

  objectKeys(o: any) { return Object.keys(o || {}).filter(k => !['decision', 'comment', 'completedBy', 'completedByUserId', 'completedAt', 'taskId'].includes(k)); }

  stepState(s: FlowStep): 'done' | 'current' | 'pending' | 'skipped' {
    const sum = this.d()!.summary;
    if (sum.currentStepId === s.id && (sum.status === 'running' || sum.status === 'waiting')) return 'current';
    if (this.visited.has(s.id)) return 'done';
    return sum.status === 'completed' || sum.status === 'cancelled' || sum.status === 'failed' ? 'skipped' : 'pending';
  }

  iconFor(s: FlowStep) { return this.data.catalog.stepTypes.find(t => t.type === s.type)?.icon ?? 'circle'; }

  openTask(t: FlowTask) {
    this.dialog.open(FlowTaskDialogComponent, { data: { task: { ...t, runNumber: this.d()!.summary.runNumber }, catalog: this.data.catalog }, width: '640px', maxWidth: '94vw' })
      .afterClosed().subscribe(res => { if (res) { this.changed = true; this.reload(); } });
  }

  async cancel() {
    const reason = await this.confirm.askText({ title: `Cancel ${this.d()!.summary.runNumber}?`, message: 'Open tasks will be closed and the flow will stop.', label: 'Reason', required: false, confirmText: 'Cancel run', danger: true });
    if (reason === null) return;
    this.api.cancelRun(this.data.runId, reason).subscribe({ next: r => { this.changed = true; this.d.set(r); this.toast.done('Run cancelled'); }, error: e => this.toast.error(e?.error?.message || 'Could not cancel') });
  }
}
