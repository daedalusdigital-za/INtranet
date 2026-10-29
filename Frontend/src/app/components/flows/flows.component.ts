import { Component, OnInit, OnDestroy, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, Subscription, interval } from 'rxjs';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { ToastService } from '../../ui/toast.service';
import { ConfirmService } from '../../ui/confirm.service';
import { FlowCatalog, FlowDefinition, FlowRunSummary, FlowStats, FlowTask, FlowsService } from '../../services/flows.service';
import { FlowStartDialogComponent } from './flow-start-dialog.component';
import { assigneeLabel } from './flow-step-factory';
import { FlowTaskDialogComponent } from './flow-task-dialog.component';
import { FlowRunDialogComponent } from './flow-run-dialog.component';
import { FlowEditorDialogComponent } from './flow-editor-dialog.component';
import { FlowViewDialogComponent } from './flow-view-dialog.component';
import { FlowCanvasComponent } from './flow-canvas.component';

@Component({
  selector: 'app-flows',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTabsModule, MatTooltipModule, MatDialogModule, MatMenuModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatProgressSpinnerModule,
    NavbarComponent, PageHeaderComponent, EmptyStateComponent, SkeletonRowsComponent, FlowCanvasComponent],
  templateUrl: './flows.component.html',
  styleUrls: ['./flows.component.scss']
})
export class FlowsComponent implements OnInit, OnDestroy {
  private api = inject(FlowsService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  @ViewChild('opsCanvas') opsCanvas?: FlowCanvasComponent;

  loading = signal(true);
  catalog = signal<FlowCatalog | null>(null);
  stats = signal<FlowStats | null>(null);
  myTasks = signal<FlowTask[]>([]);
  runs = signal<FlowRunSummary[]>([]);
  flows = signal<FlowDefinition[]>([]);
  templates = signal<FlowDefinition[]>([]);
  selectedTab = 0;
  includeDoneTasks = false;
  runStatus = 'running,waiting';
  runQuery = '';
  runFlowId: number | null = null;
  opsDept = signal<string | null>(null);
  opsFlowId = signal<number | null>(null);
  opsSelectedStep: string | null = null;
  private poll?: Subscription;

  isDesigner = computed(() => this.catalog()?.isDesigner ?? false);
  openMyTasks = computed(() => this.myTasks().filter(t => t.status === 'open' || t.status === 'escalated'));
  overdueMyTasks = computed(() => this.openMyTasks().filter(t => t.isOverdue));
  startable = computed(() => this.flows().filter(f => f.canStart && !f.departmentName));
  processFlows = computed(() => this.flows().filter(f => !f.departmentName));
  opsFlows = computed(() => this.flows().filter(f => !!f.departmentName));
  /** Departments that have at least one operational flow, in catalog order (then any extras). */
  opsDepartments = computed(() => {
    const names = new Set(this.opsFlows().map(f => f.departmentName!));
    const ordered = (this.catalog()?.departments ?? []).map(d => d.name).filter(n => names.has(n));
    for (const n of names) if (!ordered.includes(n)) ordered.push(n);
    return ordered.map(n => ({ name: n, flows: this.opsFlows().filter(f => f.departmentName === n), active: this.opsFlows().filter(f => f.departmentName === n).reduce((a, f) => a + f.activeRuns, 0) }));
  });
  opsCurrentFlows = computed(() => this.opsFlows().filter(f => f.departmentName === this.opsDept()));
  opsCurrent = computed(() => this.opsCurrentFlows().find(f => f.id === this.opsFlowId()) ?? this.opsCurrentFlows()[0] ?? null);
  opsPeople = computed(() => {
    const f = this.opsCurrent(); const cat = this.catalog(); if (!f || !cat) return [] as string[];
    const set = new Set<string>();
    for (const s of f.graph.steps) for (const k of ['assignTo', 'escalateTo', 'to']) { const a = s.config?.[k]; if (a) set.add(assigneeLabel(a, cat) || 'Whoever started it'); }
    return [...set];
  });
  opsRuns = computed(() => { const f = this.opsCurrent(); return f ? this.runs().filter(r => r.flowId === f.id) : []; });
  runColumns = computed(() => {
    const r = this.runs();
    return [
      { key: 'waiting', label: 'Waiting on people', icon: 'hourglass_top', items: r.filter(x => x.status === 'waiting') },
      { key: 'running', label: 'Running', icon: 'play_circle', items: r.filter(x => x.status === 'running') },
      { key: 'completed', label: 'Completed', icon: 'check_circle', items: r.filter(x => x.status === 'completed') },
      { key: 'failed', label: 'Failed / cancelled', icon: 'error', items: r.filter(x => x.status === 'failed' || x.status === 'cancelled') },
    ].filter(c => c.items.length || this.runStatus.includes(c.key));
  });
  flowsByLevel = computed(() => [1, 2, 3].map(l => ({ level: l, items: this.processFlows().filter(f => f.level === l) })).filter(g => g.items.length));

  ngOnInit() {
    this.loadAll(true);
    this.poll = interval(45000).subscribe(() => this.refreshLive());
    // Deep links from notifications: /flows?run=12 or /flows?task=34
    this.route.queryParamMap.subscribe(p => {
      const run = p.get('run'); const task = p.get('task'); const tab = p.get('tab');
      if (run) { this.openRunById(+run); this.clearQuery(); }
      else if (task) { this.openTaskById(+task); this.clearQuery(); }
      else if (tab === 'operations' || tab === 'human') { this.selectedTab = 1; this.clearQuery(); }
    });
  }
  ngOnDestroy() { this.poll?.unsubscribe(); }

  private clearQuery() { this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true }); }

  loadAll(first = false) {
    if (first) this.loading.set(true);
    forkJoin({
      catalog: this.api.catalog(), stats: this.api.stats(), tasks: this.api.myTasks(this.includeDoneTasks),
      runs: this.api.runs({ status: this.runStatus, q: this.runQuery, definitionId: this.runFlowId ?? undefined }),
      flows: this.api.definitions(false), templates: this.api.definitions(true)
    }).subscribe({
      next: r => {
        this.catalog.set(r.catalog); this.stats.set(r.stats); this.myTasks.set(r.tasks); this.runs.set(r.runs); this.flows.set(r.flows); this.templates.set(r.templates); this.loading.set(false);
        if (!this.opsDept() || !this.opsDepartments().some(d => d.name === this.opsDept())) this.pickDept(this.opsDepartments()[0]?.name ?? null);
      },
      error: () => { this.loading.set(false); this.toast.error('Could not load Flows'); }
    });
  }

  refreshLive() {
    forkJoin({ stats: this.api.stats(), tasks: this.api.myTasks(this.includeDoneTasks), runs: this.api.runs({ status: this.runStatus, q: this.runQuery, definitionId: this.runFlowId ?? undefined }), flows: this.api.definitions(false) })
      .subscribe({ next: r => { this.stats.set(r.stats); this.myTasks.set(r.tasks); this.runs.set(r.runs); this.flows.set(r.flows); } });
  }

  reloadTasks() { this.api.myTasks(this.includeDoneTasks).subscribe(t => this.myTasks.set(t)); }
  reloadRuns() { this.api.runs({ status: this.runStatus, q: this.runQuery, definitionId: this.runFlowId ?? undefined }).subscribe(r => this.runs.set(r)); }

  // ── actions ──
  startFlow(def: FlowDefinition) {
    if (def.triggerType === 'schedule') {
      this.api.start(def.id, {}).subscribe({ next: r => { this.toast.done(r.message || 'Checked'); this.refreshLive(); }, error: e => this.toast.error(e?.error?.message || 'Could not run') });
      return;
    }
    this.dialog.open(FlowStartDialogComponent, { data: { def, catalog: this.catalog()! }, width: '600px', maxWidth: '94vw' })
      .afterClosed().subscribe(res => { if (res) { this.refreshLive(); if (res.summary) this.openRunById(res.summary.id); } });
  }

  openTask(t: FlowTask) {
    this.dialog.open(FlowTaskDialogComponent, { data: { task: t, catalog: this.catalog()! }, width: '640px', maxWidth: '94vw' })
      .afterClosed().subscribe(res => { if (res) this.refreshLive(); });
  }
  openTaskById(id: number) {
    const local = this.myTasks().find(t => t.id === id);
    if (local) { this.openTask(local); return; }
    this.api.myTasks(true).subscribe(ts => { const t = ts.find(x => x.id === id); if (t) this.openTask(t); else this.toast.info('That task is not assigned to you (or is already closed).'); });
  }

  openRun(r: FlowRunSummary) { this.openRunById(r.id); }
  openRunById(id: number) {
    this.dialog.open(FlowRunDialogComponent, { data: { runId: id, catalog: this.catalog()! }, width: '1200px', maxWidth: '94vw', maxHeight: '92vh' })
      .afterClosed().subscribe(changed => { if (changed) this.refreshLive(); });
  }

  /** Click a flow card → visual diagram + walkthrough. */
  viewFlow(def: FlowDefinition) {
    this.dialog.open(FlowViewDialogComponent, { data: { def, catalog: this.catalog()!, canEdit: this.isDesigner() }, width: '1500px', maxWidth: '94vw', maxHeight: '92vh', panelClass: 'flow-editor-panel' })
      .afterClosed().subscribe(res => { if (res === 'start') this.startFlow(def); else if (res === 'edit') this.editFlow(def); });
  }

  // ── operations tab ──
  pickDept(name: string | null) {
    this.opsDept.set(name); this.opsFlowId.set(null); this.opsSelectedStep = null;
    setTimeout(() => { this.opsCanvas?.ensurePositions(); this.opsCanvas?.fit(); }, 30);
  }
  pickOpsFlow(id: number) { this.opsFlowId.set(id); this.opsSelectedStep = null; setTimeout(() => { this.opsCanvas?.ensurePositions(); this.opsCanvas?.fit(); }, 30); }
  opsStep() { const f = this.opsCurrent(); return f?.graph.steps.find(s => s.id === this.opsSelectedStep) ?? null; }
  who(a: any) { const c = this.catalog(); return c ? (assigneeLabel(a, c) || 'Whoever started it') : ''; }
  newOpsFlow() {
    const dept = this.opsDept();
    this.dialog.open(FlowEditorDialogComponent, { data: { catalog: this.catalog()!, presetDepartment: dept }, width: '1600px', maxWidth: '94vw', maxHeight: '92vh', disableClose: true, panelClass: 'flow-editor-panel' })
      .afterClosed().subscribe(d => { if (d) { this.loadAll(); if (d.departmentName) { this.opsDept.set(d.departmentName); this.opsFlowId.set(d.id); } } });
  }

  newFlow() {
    this.dialog.open(FlowEditorDialogComponent, { data: { catalog: this.catalog()! }, width: '1600px', maxWidth: '94vw', maxHeight: '92vh', disableClose: true, panelClass: 'flow-editor-panel' })
      .afterClosed().subscribe(d => { if (d) { this.loadAll(); this.selectedTab = 3; } });
  }
  editFlow(def: FlowDefinition) {
    this.api.definition(def.id).subscribe(full => {
      this.dialog.open(FlowEditorDialogComponent, { data: { def: full, catalog: this.catalog()! }, width: '1600px', maxWidth: '94vw', maxHeight: '92vh', disableClose: true, panelClass: 'flow-editor-panel' })
        .afterClosed().subscribe(d => { if (d) this.loadAll(); });
    });
  }
  toggleFlow(def: FlowDefinition) {
    this.api.toggle(def.id).subscribe({ next: r => { this.flows.update(fs => fs.map(f => f.id === r.id ? { ...f, isEnabled: r.isEnabled } : f)); this.toast.done(r.isEnabled ? `${def.name} enabled` : `${def.name} paused`); }, error: e => this.toast.error(e?.error?.message || 'Could not toggle') });
  }
  useTemplate(t: FlowDefinition) {
    this.api.clone(t.id).subscribe({
      next: d => { this.toast.done(`"${d.name}" added to your flows${d.isEnabled ? '' : ' (disabled — review then enable)'}`); this.loadAll(); this.selectedTab = 3; },
      error: e => this.toast.error(e?.error?.message || 'Could not use template')
    });
  }
  async deleteFlow(def: FlowDefinition) {
    if (!(await this.confirm.ask({ title: `Delete "${def.name}"?`, message: 'Past runs and their audit trails are removed too. Consider pausing instead.', confirmText: 'Delete flow', danger: true }))) return;
    this.api.delete(def.id).subscribe({ next: () => { this.toast.done('Flow deleted'); this.loadAll(); }, error: e => this.toast.error(e?.error?.message || 'Could not delete') });
  }
  cloneFlow(def: FlowDefinition) { this.useTemplate(def); }

  // ── helpers ──
  triggerLabel(d: FlowDefinition): string {
    if (d.triggerType === 'manual') return 'Started by people';
    if (d.triggerType === 'event') return `On ${d.trigger?.event || 'event'}`;
    const ds = this.catalog()?.dataSources.find(x => x.key === d.trigger?.dataSource);
    return `Every ${d.trigger?.intervalMinutes || 30} min · ${ds?.name || d.trigger?.dataSource}`;
  }
  triggerIcon(d: FlowDefinition) { return d.triggerType === 'manual' ? 'touch_app' : d.triggerType === 'event' ? 'bolt' : 'schedule'; }
  levelName(l: number) { return l === 1 ? 'Manual' : l === 2 ? 'AI-assisted' : 'Automated'; }
  stepCount(d: FlowDefinition) { return d.graph?.steps?.length ?? 0; }
  stepIcon(type: string) { return this.catalog()?.stepTypes.find(t => t.type === type)?.icon ?? 'circle'; }
  dueClass(t: FlowTask) { if (!t.dueAt) return ''; if (t.isOverdue) return 'overdue'; const h = (new Date(t.dueAt).getTime() - Date.now()) / 36e5; return h < 4 ? 'soon' : ''; }
  ago(iso: string) { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); if (h < 48) return `${h}h ago`; return `${Math.round(h / 24)}d ago`; }
  duration(min: number) { if (min < 60) return `${min}m`; if (min < 48 * 60) return `${Math.round(min / 60)}h`; return `${Math.round(min / 1440)}d`; }
}
