import { Component, OnInit, OnDestroy, ViewChild, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
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
import { FlowCatalog, FlowDefinition, FlowRunSummary, FlowStats, FlowTask, FlowWidget, FlowsService } from '../../services/flows.service';
import { FlowStartDialogComponent } from './flow-start-dialog.component';
import { assigneeLabel } from './flow-step-factory';
import { FlowTaskDialogComponent } from './flow-task-dialog.component';
import { FlowRunDialogComponent } from './flow-run-dialog.component';
import { FlowEditorDialogComponent } from './flow-editor-dialog.component';
import { FlowViewDialogComponent } from './flow-view-dialog.component';
import { FlowCanvasComponent } from './flow-canvas.component';
import { FlowWidgetEditorDialogComponent } from './flow-widget-editor-dialog.component';
import { FlowCortexComponent } from './flow-cortex.component';
import { HomeLayoutService, HomeWidget, WidgetType } from '../../services/home-layout.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-flows',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatDialogModule, MatMenuModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatProgressSpinnerModule,
    NavbarComponent, PageHeaderComponent, EmptyStateComponent, SkeletonRowsComponent, FlowCanvasComponent, FlowCortexComponent],
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
  private layouts = inject(HomeLayoutService);
  private auth = inject(AuthService);
  @ViewChild('opsCanvas') opsCanvas?: FlowCanvasComponent;

  loading = signal(true);
  catalog = signal<FlowCatalog | null>(null);
  stats = signal<FlowStats | null>(null);
  myTasks = signal<FlowTask[]>([]);
  runs = signal<FlowRunSummary[]>([]);
  flows = signal<FlowDefinition[]>([]);
  templates = signal<FlowDefinition[]>([]);
  widgets = signal<FlowWidget[]>([]);
  widgetTemplates = signal<FlowWidget[]>([]);
  widgetFilter = signal('');
  /** Ids of library widgets already on my Home (by config.libraryId). */
  onMyHome = signal<Set<number>>(new Set());
  readonly TAB = { overview: 0, human: 1, runs: 2, flows: 3, widgets: 4, templates: 5, cortex: 6 };
  private tab = signal(0);
  /** The open section. Opening Human flows re-fits its diagram, which only exists while the section is shown. */
  get selectedTab() { return this.tab(); }
  set selectedTab(i: number) {
    this.tab.set(i);
    if (i === this.TAB.human) setTimeout(() => { this.opsCanvas?.ensurePositions(); this.opsCanvas?.fit(); }, 30);
  }
  includeDoneTasks = false;
  runStatus = 'running,waiting';
  runQuery = '';
  runFlowId: number | null = null;
  opsDept = signal<string | null>(null);
  /** Within a department: null = the department's own flows, otherwise an employee id whose flows to show. */
  opsPerson = signal<string | null>(null);
  opsFlowId = signal<number | null>(null);
  /** Human flow view: the step diagram or the role blueprint (purpose, responsibilities, KPIs, handover). */
  opsMode = signal<'diagram' | 'blueprint'>('diagram');
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
    return ordered.map(n => {
      const flows = this.opsFlows().filter(f => f.departmentName === n);
      return { name: n, flows, deptFlows: flows.filter(f => !this.ownerKey(f)), people: this.peopleOf(flows), active: flows.reduce((a, f) => a + f.activeRuns, 0) };
    });
  });
  /** Employees in the current department who have their own human flow. */
  opsPeopleList = computed(() => this.opsDepartments().find(d => d.name === this.opsDept())?.people ?? []);
  opsCurrentPerson = computed(() => this.opsPeopleList().find(p => p.key === this.opsPerson()) ?? null);
  opsCurrentFlows = computed(() => {
    const d = this.opsDepartments().find(x => x.name === this.opsDept());
    if (!d) return [] as FlowDefinition[];
    const p = this.opsPerson();
    if (!p) return d.deptFlows.length ? d.deptFlows : d.flows;
    return d.people.find(x => x.key === p)?.flows ?? [];
  });
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
  /** Side navigation, grouped like Admin settings. */
  navGroups = computed(() => {
    const s = this.stats();
    return [
      { label: 'Work', items: [
        { tab: this.TAB.overview, label: 'Overview', icon: 'dashboard', hint: 'Start a flow, busiest flows and recent activity', count: 0, live: false },
        { tab: this.TAB.runs, label: 'Runs', icon: 'view_kanban', hint: 'Every run, by status — who it is waiting on and for how long', count: s?.active ?? 0, live: true },
      ] },
      { label: 'Design', items: [
        { tab: this.TAB.human, label: 'Human flows', icon: 'diversity_3', hint: 'How each department and person works day to day', count: this.opsDepartments().length, live: false },
        { tab: this.TAB.flows, label: 'Flows', icon: 'account_tree', hint: 'Process flows by level: manual, AI-assisted, automated', count: this.processFlows().length, live: false },
        { tab: this.TAB.widgets, label: 'Widgets', icon: 'widgets', hint: 'Home-page tiles fed by flows', count: this.widgets().length, live: false },
        { tab: this.TAB.templates, label: 'Templates', icon: 'auto_awesome', hint: 'Ready-made flows and widgets to copy', count: this.templates().length, live: false },
      ] },
      { label: 'Map', items: [
        { tab: this.TAB.cortex, label: 'Cortex', icon: 'hub', hint: 'The whole company on one live, clickable map', count: 0, live: false },
      ] },
    ];
  });
  currentSection = computed(() => this.navGroups().flatMap(g => g.items).find(i => i.tab === this.tab()) ?? null);
  widgetsByCategory = computed(() => {
    const q = this.widgetFilter().trim().toLowerCase();
    const list = this.widgets().filter(w => !q || w.name.toLowerCase().includes(q) || (w.description ?? '').toLowerCase().includes(q) || w.category.toLowerCase().includes(q));
    const cats = [...new Set(list.map(w => w.category))].sort();
    return cats.map(c => ({ name: c, items: list.filter(w => w.category === c) }));
  });

  ngOnInit() {
    this.loadAll(true);
    this.poll = interval(45000).subscribe(() => this.refreshLive());
    // Deep links from notifications: /flows?run=12 or /flows?task=34
    this.route.queryParamMap.subscribe(p => {
      const run = p.get('run'); const task = p.get('task'); const tab = p.get('tab');
      if (run) { this.openRunById(+run); this.clearQuery(); }
      else if (task) { this.openTaskById(+task); this.clearQuery(); }
      else if (tab === 'operations' || tab === 'human') { this.selectedTab = 1; this.clearQuery(); }
      else if (tab === 'widgets') { this.selectedTab = this.TAB.widgets; this.clearQuery(); }
      else if (tab === 'templates') { this.selectedTab = this.TAB.templates; this.clearQuery(); }
      else if (tab === 'cortex') { this.selectedTab = this.TAB.cortex; this.clearQuery(); }
    });
  }
  ngOnDestroy() { this.poll?.unsubscribe(); }

  private clearQuery() { this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true }); }

  loadAll(first = false) {
    if (first) this.loading.set(true);
    forkJoin({
      catalog: this.api.catalog(), stats: this.api.stats(), tasks: this.api.myTasks(this.includeDoneTasks),
      runs: this.api.runs({ status: this.runStatus, q: this.runQuery, definitionId: this.runFlowId ?? undefined }),
      flows: this.api.definitions(false), templates: this.api.definitions(true),
      widgets: this.api.widgets(false), widgetTemplates: this.api.widgets(true)
    }).subscribe({
      next: r => {
        this.catalog.set(r.catalog); this.stats.set(r.stats); this.myTasks.set(r.tasks); this.runs.set(r.runs); this.flows.set(r.flows); this.templates.set(r.templates);
        this.widgets.set(r.widgets); this.widgetTemplates.set(r.widgetTemplates); this.loading.set(false);
        this.refreshOnMyHome();
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
  /** Stable key for a flow's owner (employee id, else user id, else name). */
  ownerKey(f: FlowDefinition): string | null {
    if (f.ownerEmployeeId) return 'e:' + f.ownerEmployeeId;
    if (f.ownerUserId) return 'u:' + f.ownerUserId;
    return f.ownerName ? 'n:' + f.ownerName : null;
  }
  private peopleOf(flows: FlowDefinition[]) {
    const map = new Map<string, { key: string; name: string; title: string | null; flows: FlowDefinition[]; active: number }>();
    for (const f of flows) {
      const k = this.ownerKey(f); if (!k) continue;
      const p = map.get(k) ?? { key: k, name: f.ownerName || 'Employee', title: f.ownerTitle ?? null, flows: [], active: 0 };
      p.flows.push(f); p.active += f.activeRuns; if (!p.title && f.ownerTitle) p.title = f.ownerTitle;
      map.set(k, p);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  pickDept(name: string | null) {
    this.opsDept.set(name); this.opsPerson.set(null); this.opsFlowId.set(null); this.opsSelectedStep = null;
    setTimeout(() => { this.opsCanvas?.ensurePositions(); this.opsCanvas?.fit(); }, 30);
  }
  hasBlueprint(f: FlowDefinition): boolean {
    const b = f.blueprint; if (!b) return false;
    return !!(b.purpose || b.responsibilities?.length || b.kpis?.length || b.painPoints?.length || b.handover || b.systems?.length);
  }

  /** Designer action: tie an employee-owned human flow to an intranet user (created on the spot if it doesn't exist). */
  linkOwner(f: FlowDefinition) {
    const email = (window.prompt(`Work email for ${f.ownerName || 'employee #' + f.ownerEmployeeId}\n(the intranet account will be created if it does not exist)`, f.blueprint?.email || '') || '').trim();
    if (!email) return;
    this.api.linkOwner(f.id, email, true).subscribe({
      next: r => {
        this.toast.done(r.message || `Linked ${email}`);
        if (r.created && r.tempPassword) window.alert(`Account created for ${r.name || email}\n\nEmail: ${r.email}\nTemporary password: ${r.tempPassword}\n\nShare this securely — it must be changed on first login.`);
        this.loadAll();
      },
      error: e => this.toast.error(e?.error?.message || 'Could not link account')
    });
  }

  pickPerson(key: string | null) {
    this.opsPerson.set(key); this.opsFlowId.set(null); this.opsSelectedStep = null;
    setTimeout(() => { this.opsCanvas?.ensurePositions(); this.opsCanvas?.fit(); }, 30);
  }
  initials(n: string) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join(''); }
  pickOpsFlow(id: number) { this.opsFlowId.set(id); this.opsSelectedStep = null; setTimeout(() => { this.opsCanvas?.ensurePositions(); this.opsCanvas?.fit(); }, 30); }
  opsStep() { const f = this.opsCurrent(); return f?.graph.steps.find(s => s.id === this.opsSelectedStep) ?? null; }
  who(a: any) { const c = this.catalog(); return c ? (assigneeLabel(a, c) || 'Whoever started it') : ''; }
  newOpsFlow() {
    const dept = this.opsDept();
    const person = this.opsCurrentPerson();
    const presetOwner = person?.key.startsWith('e:') ? { employeeId: person.key.slice(2), name: person.name, title: person.title } : null;
    this.dialog.open(FlowEditorDialogComponent, { data: { catalog: this.catalog()!, presetDepartment: dept, presetOwner }, width: '1600px', maxWidth: '94vw', maxHeight: '92vh', disableClose: true, panelClass: 'flow-editor-panel' })
      .afterClosed().subscribe(d => { if (d) { this.loadAll(); if (d.departmentName) { this.opsDept.set(d.departmentName); this.opsPerson.set(this.ownerKey(d)); this.opsFlowId.set(d.id); } } });
  }

  /** From Cortex: a human flow for a department, optionally pinned to one employee. */
  newOpsFlowFor(dept: string | null, owner: { employeeId: string; name: string; title?: string | null } | null) {
    this.dialog.open(FlowEditorDialogComponent, { data: { catalog: this.catalog()!, presetDepartment: dept, presetOwner: owner }, width: '1600px', maxWidth: '94vw', maxHeight: '92vh', disableClose: true, panelClass: 'flow-editor-panel' })
      .afterClosed().subscribe(d => { if (d) { this.loadAll(); this.toast.done(`"${d.name}" is on the map`); } });
  }
  /** From Cortex: jump to a department (and person) on the Human flows section. */
  openHuman(dept: string, personKey: string | null) {
    this.selectedTab = this.TAB.human;
    this.pickDept(dept);
    if (personKey && this.opsPeopleList().some(p => p.key === personKey)) this.pickPerson(personKey);
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
      next: d => { this.toast.done(`"${d.name}" added to your flows${d.isEnabled ? '' : ' (disabled — review then enable)'}`); this.loadAll(); this.selectedTab = this.TAB.flows; },
      error: e => this.toast.error(e?.error?.message || 'Could not use template')
    });
  }
  async deleteFlow(def: FlowDefinition) {
    if (!(await this.confirm.ask({ title: `Delete "${def.name}"?`, message: 'Past runs and their audit trails are removed too. Consider pausing instead.', confirmText: 'Delete flow', danger: true }))) return;
    this.api.delete(def.id).subscribe({ next: () => { this.toast.done('Flow deleted'); this.loadAll(); }, error: e => this.toast.error(e?.error?.message || 'Could not delete') });
  }
  cloneFlow(def: FlowDefinition) { this.useTemplate(def); }

  // ── widgets ──
  reloadWidgets() {
    forkJoin({ w: this.api.widgets(false), t: this.api.widgets(true) }).subscribe(r => { this.widgets.set(r.w); this.widgetTemplates.set(r.t); });
  }
  private refreshOnMyHome() {
    this.layouts.load().subscribe(l => this.onMyHome.set(new Set(l.widgets.map(w => w.config?.['libraryId']).filter((x): x is number => typeof x === 'number'))));
  }
  newWidget(asTemplate = false) {
    this.dialog.open(FlowWidgetEditorDialogComponent, { data: { flows: this.flows(), catalog: this.catalog()!, asTemplate }, width: '1100px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: false })
      .afterClosed().subscribe(w => { if (w) { this.reloadWidgets(); this.selectedTab = w.isTemplate ? this.TAB.templates : this.TAB.widgets; } });
  }
  editWidget(w: FlowWidget) {
    this.dialog.open(FlowWidgetEditorDialogComponent, { data: { widget: w, flows: this.flows(), catalog: this.catalog()! }, width: '1100px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: false })
      .afterClosed().subscribe(r => { if (r) this.reloadWidgets(); });
  }
  toggleWidget(w: FlowWidget) {
    this.api.toggleWidget(w.id).subscribe({ next: r => { this.widgets.update(ws => ws.map(x => x.id === r.id ? { ...x, isPublished: r.isPublished } : x)); this.toast.done(r.isPublished ? `${w.name} published` : `${w.name} hidden`); }, error: e => this.toast.error(e?.error?.message || 'Could not update') });
  }
  useWidgetTemplate(t: FlowWidget) {
    this.api.cloneWidget(t.id).subscribe({
      next: w => { this.toast.done(`"${w.name}" added to Widgets — finish it and publish`); this.reloadWidgets(); this.selectedTab = this.TAB.widgets; this.editWidget(w); },
      error: e => this.toast.error(e?.error?.message || 'Could not use template')
    });
  }
  async deleteWidget(w: FlowWidget) {
    if (!(await this.confirm.ask({ title: `Delete "${w.name}"?`, message: 'People who already added it keep their copy; it just leaves the library.', confirmText: 'Delete widget', danger: true }))) return;
    this.api.deleteWidget(w.id).subscribe({ next: () => { this.toast.done('Widget deleted'); this.reloadWidgets(); }, error: e => this.toast.error(e?.error?.message || 'Could not delete') });
  }
  /** Put a library widget on the signed-in person's Home. */
  addToMyHome(w: FlowWidget) {
    this.layouts.load().subscribe(layout => {
      if (layout.widgets.some(x => x.config?.['libraryId'] === w.id)) { this.toast.info(`${w.name} is already on your Home`); return; }
      const widget: HomeWidget = { id: this.layouts.newId('lib'), type: w.type as WidgetType, size: w.size, config: { ...(w.config ?? {}), title: w.name, libraryId: w.id } };
      const next = { ...layout, widgets: [...layout.widgets, widget] };
      this.layouts.save(next).subscribe({
        next: () => { this.onMyHome.update(s => new Set([...s, w.id])); this.api.widgetUsed(w.id).subscribe({ error: () => {} }); this.toast.done(`${w.name} added to your Home`, { action: 'Open Home', onAction: () => this.router.navigateByUrl('/home') }); },
        error: () => this.toast.error('Could not update your Home layout')
      });
    });
  }
  widgetKindName(type: string) { return this.layouts.availableWidgets().find(m => m.type === type)?.name ?? type; }
  widgetFlowName(w: FlowWidget) { const id = w.config?.['flowId']; return id ? (this.flows().find(f => f.id === id)?.name ?? 'a flow') : (w.type === 'flow-kpi' || w.type === 'flow-runs' ? 'All flows' : ''); }
  canAddWidget(w: FlowWidget) { return this.layouts.availableWidgets().some(m => m.type === w.type); }

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
