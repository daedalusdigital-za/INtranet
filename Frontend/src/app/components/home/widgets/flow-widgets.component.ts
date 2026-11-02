import { Component, Directive, Injectable, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { Subscription, forkJoin, interval, of, catchError } from 'rxjs';

import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { StatusChipComponent } from '../../../ui/status-chip/status-chip.component';
import { ToastService } from '../../../ui/toast.service';
import { FlowCatalog, FlowDefinition, FlowRunSummary, FlowTask, FlowsService } from '../../../services/flows.service';
import { FlowStartDialogComponent } from '../../flows/flow-start-dialog.component';
import { FlowTaskDialogComponent } from '../../flows/flow-task-dialog.component';
import { FlowRunDialogComponent } from '../../flows/flow-run-dialog.component';

/**
 * One shared load of Flows data for every flow widget on Home, so five widgets don't make
 * five sets of calls. Refreshes itself while anything is subscribed.
 */
@Injectable({ providedIn: 'root' })
export class HomeFlowsStore {
  private readonly api = inject(FlowsService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly catalog = signal<FlowCatalog | null>(null);
  readonly flows = signal<FlowDefinition[]>([]);
  readonly tasks = signal<FlowTask[]>([]);
  readonly runs = signal<FlowRunSummary[]>([]);

  readonly startable = computed(() => this.flows().filter(f => f.canStart && f.isEnabled && f.triggerType !== 'event'));
  readonly openTasks = computed(() => this.tasks().filter(t => t.status === 'open' || t.status === 'escalated'));

  private users = 0;
  private poll?: Subscription;
  private loaded = false;

  attach(): void {
    this.users++;
    if (!this.loaded) this.refresh(true);
    if (!this.poll) this.poll = interval(60000).subscribe(() => this.refresh());
  }

  detach(): void {
    this.users = Math.max(0, this.users - 1);
    if (!this.users) { this.poll?.unsubscribe(); this.poll = undefined; }
  }

  refresh(first = false): void {
    if (first) this.loading.set(true);
    forkJoin({
      catalog: this.catalog() ? of(this.catalog()!) : this.api.catalog(),
      flows: this.api.definitions(false),
      tasks: this.api.myTasks(false),
      runs: this.api.runs({ status: 'running,waiting,completed,failed', take: 200 }).pipe(catchError(() => of([] as FlowRunSummary[])))
    }).subscribe({
      next: r => {
        this.catalog.set(r.catalog); this.flows.set(r.flows); this.tasks.set(r.tasks); this.runs.set(r.runs);
        this.loaded = true; this.loading.set(false); this.failed.set(false);
      },
      error: () => { this.loading.set(false); this.failed.set(true); }
    });
  }

  start(def: FlowDefinition): void {
    if (!this.catalog()) {
      this.api.catalog().subscribe({ next: c => { this.catalog.set(c); this.start(def); }, error: () => this.toast.error('Could not load Flows') });
      return;
    }
    if (def.triggerType === 'schedule') {
      this.api.start(def.id, {}).subscribe({ next: r => { this.toast.done(r.message || 'Checked'); this.refresh(); }, error: e => this.toast.error(e?.error?.message || 'Could not run') });
      return;
    }
    this.dialog.open(FlowStartDialogComponent, { data: { def, catalog: this.catalog()! }, width: '600px', maxWidth: '94vw' })
      .afterClosed().subscribe(res => { if (res) { this.refresh(); if (res.summary) this.openRun(res.summary.id); } });
  }

  startById(id: number): void {
    const def = this.flows().find(f => f.id === id);
    if (def) { this.start(def); return; }
    this.api.definition(id).subscribe({ next: d => this.start(d), error: () => this.toast.error("That flow isn't available to you any more.") });
  }

  openTask(t: FlowTask): void {
    this.dialog.open(FlowTaskDialogComponent, { data: { task: t, catalog: this.catalog()! }, width: '640px', maxWidth: '94vw' })
      .afterClosed().subscribe(res => { if (res) this.refresh(); });
  }

  openRun(id: number): void {
    this.dialog.open(FlowRunDialogComponent, { data: { runId: id, catalog: this.catalog()! }, width: '1200px', maxWidth: '94vw', maxHeight: '92vh' })
      .afterClosed().subscribe(changed => { if (changed) this.refresh(); });
  }
}

@Directive()
abstract class FlowWidgetBase implements OnInit, OnDestroy {
  readonly store = inject(HomeFlowsStore);
  ngOnInit(): void { this.store.attach(); }
  ngOnDestroy(): void { this.store.detach(); }
}

// ── Start a flow ──────────────────────────────────────────────────────────────

@Component({
  selector: 'app-flow-start-widget',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, EmptyStateComponent, SkeletonRowsComponent],
  template: `
    @if (store.loading()) {
      <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
    } @else {
      @for (f of flows(); track f.id) {
        <button type="button" class="fs-row" (click)="store.start(f)" [matTooltip]="f.description || ''" matTooltipPosition="above">
          <span class="fs-ic"><mat-icon>{{ f.triggerType === 'schedule' ? 'schedule' : 'play_arrow' }}</mat-icon></span>
          <span class="fs-t">{{ f.name }}<small>{{ f.departmentName || f.category || 'Flow' }}@if (f.activeRuns) { · {{ f.activeRuns }} running }</small></span>
          <mat-icon class="fs-go">chevron_right</mat-icon>
        </button>
      } @empty {
        <app-empty-state compact icon="play_circle" [title]="pinned.length ? 'Those flows are no longer available' : 'No flows you can start'"
          message="Pick flows in Customise, or ask a flow designer to let you start one."></app-empty-state>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .fs-row { display: flex; align-items: center; gap: var(--space-3); width: 100%; padding: 10px var(--space-4); border: 0; border-bottom: 1px solid var(--color-line); background: none; text-align: left; cursor: pointer; font: inherit; color: var(--color-text); }
    .fs-row:last-child { border-bottom: 0; }
    .fs-row:hover { background: var(--color-surface-2); }
    .fs-ic { width: 34px; height: 34px; flex: none; border-radius: 9px; display: grid; place-items: center; background: var(--color-primary-soft); color: var(--color-primary); }
    .fs-ic mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .fs-t { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: var(--text-md); font-weight: 650; }
    .fs-t small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fs-go { color: var(--color-text-3); }
  `]
})
export class FlowStartWidgetComponent extends FlowWidgetBase {
  /** Flow ids chosen in Customise. Empty = every flow the person can start (first 6). */
  @Input() pinned: number[] = [];
  readonly flows = computed(() => {
    const all = this.store.startable();
    if (!this.pinned.length) return all.slice(0, 6);
    return this.pinned.map(id => all.find(f => f.id === id)).filter((f): f is FlowDefinition => !!f);
  });
}

// ── Flow tasks for me ─────────────────────────────────────────────────────────

@Component({
  selector: 'app-flow-tasks-widget',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, EmptyStateComponent, SkeletonRowsComponent, StatusChipComponent],
  template: `
    @if (store.loading()) {
      <app-skeleton-rows [rows]="3"></app-skeleton-rows>
    } @else {
      @for (t of tasks(); track t.id) {
        <div class="ft-row">
          <span class="ft-ic" [class.approval]="t.kind === 'approval'" [class.overdue]="t.isOverdue"><mat-icon>{{ t.kind === 'approval' ? 'approval' : 'assignment' }}</mat-icon></span>
          <span class="ft-t">{{ t.title }}<small>{{ t.flowName }}@if (t.runNumber) { · {{ t.runNumber }} }@if (t.dueAt) { · {{ due(t) }} }</small></span>
          @if (t.isOverdue) { <app-status-chip status="Overdue" tone="danger"></app-status-chip> }
          @else if (t.status === 'escalated') { <app-status-chip status="Escalated" tone="warn"></app-status-chip> }
          <button mat-stroked-button class="ft-btn" (click)="store.openTask(t)">{{ t.kind === 'approval' ? 'Decide' : 'Open' }}</button>
        </div>
      } @empty {
        <app-empty-state compact icon="approval" title="No flow tasks for you" message="When a flow needs your approval or input it shows up here."></app-empty-state>
      }
      @if (store.openTasks().length > limit) {
        <a class="ft-more" href="/flows" (click)="$event.preventDefault(); goFlows()">{{ store.openTasks().length - limit }} more in Flows <mat-icon>chevron_right</mat-icon></a>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .ft-row { display: flex; align-items: center; gap: var(--space-3); padding: 11px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .ft-row:last-child { border-bottom: 0; }
    .ft-ic { width: 34px; height: 34px; flex: none; border-radius: 9px; display: grid; place-items: center; background: var(--color-surface-2); color: var(--color-text-2); }
    .ft-ic.approval { background: var(--color-warn-soft); color: var(--color-warn); }
    .ft-ic.overdue { background: var(--color-danger-soft); color: var(--color-danger); }
    .ft-ic mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .ft-t { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: var(--text-md); font-weight: 650; color: var(--color-text); }
    .ft-t small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ft-btn { flex: none; }
    .ft-more { display: flex; align-items: center; justify-content: center; gap: 2px; padding: 8px; font-size: var(--text-xs); font-weight: 700; color: var(--color-primary); text-decoration: none; border-top: 1px solid var(--color-line); }
    .ft-more mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `]
})
export class FlowTasksWidgetComponent extends FlowWidgetBase {
  private readonly router = inject(Router);
  readonly limit = 6;
  readonly tasks = computed(() => [...this.store.openTasks()]
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || (a.dueAt ? +new Date(a.dueAt) : Infinity) - (b.dueAt ? +new Date(b.dueAt) : Infinity))
    .slice(0, this.limit));
  due(t: FlowTask): string {
    const n = Math.round((+new Date(t.dueAt!) - Date.now()) / 86400000);
    return n < 0 ? `due ${-n}d ago` : n === 0 ? 'due today' : n === 1 ? 'due tomorrow' : `due in ${n}d`;
  }
  goFlows(): void { this.router.navigateByUrl('/flows'); }
}

// ── Flow activity (runs) ──────────────────────────────────────────────────────

@Component({
  selector: 'app-flow-runs-widget',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, EmptyStateComponent, SkeletonRowsComponent, StatusChipComponent],
  template: `
    @if (store.loading()) {
      <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
    } @else {
      <div class="fr-strip">
        <button type="button" class="fr-k" [class.on]="filter() === 'live'" (click)="filter.set('live')"><b>{{ counts().live }}</b> live</button>
        <button type="button" class="fr-k" [class.on]="filter() === 'waiting'" (click)="filter.set('waiting')"><b>{{ counts().waiting }}</b> waiting on people</button>
        <button type="button" class="fr-k" [class.on]="filter() === 'completed'" (click)="filter.set('completed')"><b>{{ counts().completed }}</b> done</button>
        @if (counts().failed) { <button type="button" class="fr-k danger" [class.on]="filter() === 'failed'" (click)="filter.set('failed')"><b>{{ counts().failed }}</b> failed</button> }
      </div>
      @for (r of visible(); track r.id) {
        <button type="button" class="fr-row" (click)="store.openRun(r.id)">
          <span class="fr-dot" [class]="'fr-dot ' + r.status"></span>
          <span class="fr-t">{{ r.title }}<small>{{ flowId ? r.runNumber : r.flowName }} · {{ r.status === 'waiting' && r.currentAssignee ? 'with ' + r.currentAssignee : r.status }} · {{ r.startedAt | date:'d MMM HH:mm' }}</small></span>
          @if (r.overdueTasks) { <app-status-chip [status]="r.overdueTasks + ' overdue'" tone="danger"></app-status-chip> }
        </button>
      } @empty {
        <app-empty-state compact icon="account_tree" [title]="'No ' + (filter() === 'live' ? 'running' : filter()) + ' runs'" [message]="flowId ? 'Runs of this flow show up here.' : 'Runs of your flows show up here.'"></app-empty-state>
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .fr-strip { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .fr-k { padding: 4px 10px; border: 1px solid var(--color-line); border-radius: 999px; background: var(--color-surface); font: 600 var(--text-xs) var(--font-body); color: var(--color-text-2); cursor: pointer; }
    .fr-k b { color: var(--color-text); font-variant-numeric: tabular-nums; margin-right: 3px; }
    .fr-k.on { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
    .fr-k.on b { color: var(--color-primary); }
    .fr-k.danger.on { border-color: var(--color-danger); background: var(--color-danger-soft); color: var(--color-danger); }
    .fr-row { display: flex; align-items: center; gap: var(--space-3); width: 100%; padding: 10px var(--space-4); border: 0; border-bottom: 1px solid var(--color-line); background: none; text-align: left; cursor: pointer; font: inherit; }
    .fr-row:last-child { border-bottom: 0; }
    .fr-row:hover { background: var(--color-surface-2); }
    .fr-dot { width: 10px; height: 10px; flex: none; border-radius: 50%; background: var(--color-line-strong); }
    .fr-dot.running { background: var(--color-primary); }
    .fr-dot.waiting { background: var(--color-warn); }
    .fr-dot.completed { background: var(--color-ok); }
    .fr-dot.failed, .fr-dot.cancelled { background: var(--color-danger); }
    .fr-t { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: var(--text-md); font-weight: 650; color: var(--color-text); }
    .fr-t small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `]
})
export class FlowRunsWidgetComponent extends FlowWidgetBase {
  /** Only this flow; null = all flows. */
  @Input() flowId: number | null = null;
  readonly filter = signal<'live' | 'waiting' | 'completed' | 'failed'>('live');
  private readonly mine = computed(() => this.flowId ? this.store.runs().filter(r => r.flowId === this.flowId) : this.store.runs());
  readonly counts = computed(() => {
    const r = this.mine();
    return {
      live: r.filter(x => x.status === 'running' || x.status === 'waiting').length,
      waiting: r.filter(x => x.status === 'waiting').length,
      completed: r.filter(x => x.status === 'completed').length,
      failed: r.filter(x => x.status === 'failed' || x.status === 'cancelled').length
    };
  });
  readonly visible = computed(() => {
    const f = this.filter();
    return this.mine().filter(r =>
      f === 'live' ? (r.status === 'running' || r.status === 'waiting')
      : f === 'waiting' ? r.status === 'waiting'
      : f === 'completed' ? r.status === 'completed'
      : (r.status === 'failed' || r.status === 'cancelled'))
      .slice(0, 6);
  });
}

// ── Flow number (KPI tile) ────────────────────────────────────────────────────

export type FlowKpiMetric = 'active' | 'waiting' | 'completed' | 'failed' | 'myTasks';
export const FLOW_KPI_METRICS: { key: FlowKpiMetric; label: string }[] = [
  { key: 'active', label: 'Active runs' },
  { key: 'waiting', label: 'Waiting on people' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed or cancelled' },
  { key: 'myTasks', label: 'Tasks for me' },
];

@Component({
  selector: 'app-flow-kpi-widget',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <button type="button" class="kpi" [class]="'kpi tone-' + tone()" (click)="open()">
      <span class="kpi-l">{{ label() }}</span>
      <span class="kpi-v">@if (store.loading()) { <i class="sk"></i> } @else { {{ value() }} }</span>
      <span class="kpi-f">{{ flowName() }}</span>
    </button>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .kpi { display: grid; align-content: space-between; gap: 6px; width: 100%; height: 100%; min-height: 118px; padding: var(--space-4); border: 0; background: none; text-align: left; cursor: pointer; font: inherit; color: var(--color-text); }
    .kpi:hover { background: var(--color-surface-2); }
    .kpi-l { font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); }
    .kpi-v { font-size: var(--text-4xl); font-weight: 800; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; }
    .tone-warn .kpi-v { color: var(--color-warn); }
    .tone-danger .kpi-v { color: var(--color-danger); }
    .tone-ok .kpi-v { color: var(--color-ok); }
    .kpi-f { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sk { display: inline-block; width: 48px; height: 28px; border-radius: 6px; background: var(--color-surface-2); }
  `]
})
export class FlowKpiWidgetComponent extends FlowWidgetBase {
  private readonly router = inject(Router);
  @Input() flowId: number | null = null;
  @Input() metric: FlowKpiMetric = 'active';

  readonly flowName = computed(() => this.flowId ? (this.store.flows().find(f => f.id === this.flowId)?.name ?? 'Flow') : 'All flows');
  readonly label = computed(() => FLOW_KPI_METRICS.find(m => m.key === this.metric)?.label ?? '');
  readonly value = computed(() => {
    const runs = this.flowId ? this.store.runs().filter(r => r.flowId === this.flowId) : this.store.runs();
    switch (this.metric) {
      case 'active': return runs.filter(r => r.status === 'running' || r.status === 'waiting').length;
      case 'waiting': return runs.filter(r => r.status === 'waiting').length;
      case 'completed': return runs.filter(r => r.status === 'completed').length;
      case 'failed': return runs.filter(r => r.status === 'failed' || r.status === 'cancelled').length;
      case 'myTasks': return this.store.openTasks().filter(t => !this.flowId || this.store.runs().find(r => r.id === t.flowRunId)?.flowId === this.flowId).length;
    }
  });
  readonly tone = computed(() => {
    const v = this.value() || 0;
    if (this.metric === 'failed') return v ? 'danger' : 'ok';
    if (this.metric === 'myTasks' || this.metric === 'waiting') return v ? 'warn' : 'default';
    return 'default';
  });
  open(): void { this.router.navigateByUrl('/flows'); }
}
