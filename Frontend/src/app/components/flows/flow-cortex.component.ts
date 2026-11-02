import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CortexApiGap, CortexApiNode, CortexGraph, FlowCatalog, FlowDefinition, FlowStats, FlowsService } from '../../services/flows.service';
import { CORTEX_COMPANIES, CORTEX_EDGES, CORTEX_GAPS, CORTEX_NODES, CORTEX_STREAMS, CortexGap, CortexHow, CortexLayer, CortexNode, CortexStream } from './cortex-model';

/** A person on the map: from the employee register, or an intranet user who is not on it. */
interface CortexPerson { key: string; name: string; title: string | null; employeeId: string | null; userId: number | null; flows: FlowDefinition[]; }

/** A department node, built from live data. */
interface DeptNode extends CortexNode { deptId: number; deptName: string; people: CortexPerson[]; }

/** Edges on the map: the model's hand-offs plus "people in this department work in this module". */
interface MapEdge { from: string; to: string; label: string; how: CortexHow | 'works'; ref?: string; who?: string; }

interface Suggestion { icon: string; title: string; detail: string; tone: 'map' | 'people' | 'template' | 'gap' | 'data'; weight: number; act: () => void; actLabel: string; }

const DEPT_COLORS = ['#38bdf8', '#34d399', '#facc15', '#f472b6', '#22d3ee', '#a3e635', '#fb923c', '#c084fc', '#60a5fa', '#f5b942', '#fda4af', '#5eead4'];
const DEPT_Y = 600;

/**
 * Cortex: how work actually moves through this intranet. Modules and their hand-offs come from the code
 * (cortex-model.ts); departments, people and how they use each module come from live data.
 */
@Component({
  selector: 'app-flow-cortex',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatTooltipModule],
  templateUrl: './flow-cortex.component.html',
  styleUrls: ['./flow-cortex.component.scss']
})
export class FlowCortexComponent implements OnInit {
  private router = inject(Router);
  private api = inject(FlowsService);
  private snack = inject(MatSnackBar);
  flows = input<FlowDefinition[]>([]);
  templates = input<FlowDefinition[]>([]);
  catalog = input<FlowCatalog | null>(null);
  stats = input<FlowStats | null>(null);
  isDesigner = input(false);

  viewFlow = output<FlowDefinition>();
  startFlow = output<FlowDefinition>();
  useTemplate = output<FlowDefinition>();
  newHumanFlow = output<{ dept: string | null; owner: { employeeId: string; name: string; title?: string | null } | null }>();
  openHuman = output<{ dept: string; personKey: string | null }>();
  designFlow = output<void>();

  readonly streams = CORTEX_STREAMS;
  readonly gaps = CORTEX_GAPS;
  readonly companies = CORTEX_COMPANIES;
  readonly layers: { key: CortexLayer; label: string; y: number }[] = [
    { key: 'source', label: 'Where work comes from', y: 66 },
    { key: 'module', label: 'Intranet modules', y: 236 },
    { key: 'dept', label: 'Departments · from live data', y: DEPT_Y },
  ];

  selected = signal<string | null>(null);
  hovered = signal<string | null>(null);
  stream = signal<string | null>(null);
  query = signal('');
  hidden = signal<Set<CortexLayer>>(new Set());

  private live = computed(() => this.flows().filter(f => !f.isTemplate));
  private norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

  // ── the knowledge graph, from the server ──────────────────────────────────────

  graph = signal<CortexGraph | null>(null);
  apiGaps = signal<CortexApiGap[]>([]);
  graphBusy = signal(false);
  graphError = signal<string | null>(null);

  ngOnInit() { this.loadGraph(); }

  loadGraph() {
    this.graphBusy.set(true); this.graphError.set(null);
    this.api.cortexGraph().subscribe({
      next: g => { this.graph.set(g); this.graphBusy.set(false); },
      error: e => { this.graphBusy.set(false); this.graphError.set(e?.error?.message ?? 'Could not load the knowledge graph'); }
    });
    this.api.cortexGaps().subscribe({ next: g => this.apiGaps.set(g), error: () => this.apiGaps.set([]) });
  }

  /** Designers only: re-derive the graph from live data. Curated knowledge is never overwritten. */
  rebuildGraph() {
    if (!this.isDesigner() || this.graphBusy()) return;
    this.graphBusy.set(true);
    this.api.cortexRebuild().subscribe({
      next: r => { this.snack.open(`Cortex rebuilt: ${r.nodes} nodes, ${r.edges} edges · ${r.created} new, ${r.deactivated} gone · ${r.tookMs} ms`, 'OK', { duration: 6000 }); this.loadGraph(); },
      error: e => { this.graphBusy.set(false); this.snack.open(e?.error?.message ?? 'Rebuild failed', 'OK', { duration: 5000 }); }
    });
  }

  private apiByKey = computed(() => new Map((this.graph()?.nodes ?? []).map(n => [n.key, n])));
  /** Map a node key on this map to its key in the server graph (departments are 'd:ID' here, 'dept:ID' there). */
  apiKey(key: string | null | undefined) { return !key ? null : key.startsWith('d:') ? 'dept:' + key.slice(2) : key; }
  apiNode(key: string | null | undefined): CortexApiNode | null { const k = this.apiKey(key); return k ? this.apiByKey().get(k) ?? null : null; }
  /** Attached knowledge / responsibilities / workflow / authority nodes under a node, including empty ones (shown, not hidden). */
  attached(key: string) { const k = this.apiKey(key); return k ? (this.graph()?.nodes ?? []).filter(n => n.parent === k && n.type !== 'gap' && n.type !== 'step') : []; }
  /** Server-derived gaps on a node (unowned modules, flows with no owner, departments without a head, …). */
  apiGapsOf(key: string) { const k = this.apiKey(key); return k ? this.apiGaps().filter(g => g.on === k) : []; }
  /** Where to land on this map for a server-graph key: same key for modules/sources, 'd:ID' for departments, else the parent. */
  private mapKeyFor(k: string | null): string | null {
    if (!k) return null;
    const local = k.startsWith('dept:') ? 'd:' + k.slice(5) : k;
    if (this.byKey().has(local)) return local;
    const n = this.apiByKey().get(k);
    return n?.parent ? this.mapKeyFor(n.parent) : null;
  }
  provenanceLabel(p: string) { return p === 'derived' ? 'From live data' : p === 'curated' ? 'Written by a person' : 'Suggested by Welly'; }
  knowledgeStrip = computed(() => {
    const c = this.graph()?.counts; if (!c) return null;
    return [
      { key: 'derived', icon: 'memory', label: 'From data', value: c.derived, tip: 'Facts derived from live records. Rebuilt on demand; never edited by hand.' },
      { key: 'curated', icon: 'edit_note', label: 'Written', value: c.curated, tip: 'Knowledge a person wrote down and owns. Expires for review.' },
      { key: 'empty', icon: 'post_add', label: 'Still blank', value: c.curatedEmpty, tip: 'Slots waiting for someone to write what they know.' },
      { key: 'inferred', icon: 'auto_awesome', label: 'To confirm', value: c.inferred, tip: 'Welly suggestions waiting for a person to accept or reject.' },
      { key: 'overdue', icon: 'history', label: 'Overdue review', value: c.overdue, tip: 'Curated knowledge past its review date. Shown, not hidden.' },
      { key: 'gaps', icon: 'build_circle', label: 'Gaps', value: c.gaps, tip: 'Problems the graph found: no owner, no head, hand-off not built.' },
    ];
  });
  reviewAccept(n: CortexApiNode) { this.api.cortexAccept(n.key).subscribe({ next: () => { this.snack.open('Confirmed', undefined, { duration: 2500 }); this.loadGraph(); } }); }
  reviewReject(n: CortexApiNode) {
    const reason = window.prompt('Why is this wrong? (Welly learns from the reason)'); if (!reason) return;
    this.api.cortexReject(n.key, reason).subscribe({ next: () => { this.snack.open('Rejected', undefined, { duration: 2500 }); this.loadGraph(); } });
  }
  curate(n: CortexApiNode) {
    const text = window.prompt(`${n.label}\n\nWrite what you know. It will be stored with your name and a review date six months out.`, n.summary ?? '');
    if (text === null) return;
    this.api.cortexCurate(n.key, { summary: text }).subscribe({ next: () => { this.snack.open('Saved', undefined, { duration: 2500 }); this.loadGraph(); }, error: e => this.snack.open(e?.error?.message ?? 'Not allowed', 'OK', { duration: 4000 }) });
  }

  // ── departments and people, from live data ────────────────────────────────

  private placement = computed(() => {
    const cat = this.catalog();
    const byDept = new Map<number, CortexPerson[]>(); const unplaced: string[] = [];
    if (!cat) return { byDept, unplaced };
    const byEmp = new Map<string, FlowDefinition[]>(); const byUser = new Map<number, FlowDefinition[]>();
    for (const f of this.live()) {
      if (f.ownerEmployeeId) byEmp.set(f.ownerEmployeeId, [...(byEmp.get(f.ownerEmployeeId) ?? []), f]);
      if (f.ownerUserId) byUser.set(f.ownerUserId, [...(byUser.get(f.ownerUserId) ?? []), f]);
    }
    // First + last name, so "Joulene Mahabeer" on the register finds the account "Joulene Mahabeer Mahabeer".
    const key = (s: string) => { const w = this.norm(s).split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1]}` : w[0]; };
    const userByName = new Map(cat.users.map(u => [key(u.name), u]));
    const deptByName = (name: string | null | undefined) => {
      const n = this.norm(name);
      if (!n || n === 'other') return null;
      return cat.departments.find(d => this.norm(d.name) === n) ?? cat.departments.find(d => this.norm(d.name).startsWith(n) || n.startsWith(this.norm(d.name))) ?? null;
    };
    const put = (id: number, p: CortexPerson) => byDept.set(id, [...(byDept.get(id) ?? []), p]);
    const placedUsers = new Set<number>();
    for (const e of cat.employees ?? []) {
      const u = userByName.get(key(e.name));
      if (u) placedUsers.add(u.id);
      const d = deptByName(e.department) ?? cat.departments.find(x => x.id === u?.departmentId) ?? null;
      if (!d) { unplaced.push(e.name); continue; }
      const flows = [...(byEmp.get(e.id) ?? [])];
      for (const f of u ? byUser.get(u.id) ?? [] : []) if (!flows.includes(f)) flows.push(f);
      put(d.id, { key: 'e:' + e.id, name: e.name, title: e.jobTitle ?? null, employeeId: e.id, userId: u?.id ?? null, flows });
    }
    for (const u of cat.users) {
      if (placedUsers.has(u.id) || u.departmentId == null) continue;
      put(u.departmentId, { key: 'u:' + u.id, name: u.name, title: u.title || u.role, employeeId: null, userId: u.id, flows: byUser.get(u.id) ?? [] });
    }
    for (const l of byDept.values()) l.sort((a, b) => (b.flows.length ? 1 : 0) - (a.flows.length ? 1 : 0) || a.name.localeCompare(b.name));
    return { byDept, unplaced };
  });

  unplaced = computed(() => this.placement().unplaced);

  private hasOwnFlow(name: string) { return this.live().some(f => this.norm(f.departmentName) === this.norm(name)); }

  /**
   * Departments that are really in use: two or more people, or one person and a flow of their own. A department
   * record holding a single stray account (e.g. "Marketing") is not drawn; it is raised as a data question instead.
   */
  deptNodes = computed<DeptNode[]>(() => {
    const cat = this.catalog(); if (!cat) return [];
    const count = (id: number) => this.placement().byDept.get(id)?.length ?? 0;
    const list = cat.departments.filter(d => count(d.id) >= 2 || (count(d.id) === 1 && this.hasOwnFlow(d.name)))
      .sort((a, b) => (count(b.id) - count(a.id)) || a.name.localeCompare(b.name));
    // Drop a trailing "Department" only where the short name stays unique ("IT Department" → "IT", but not "Finance Department").
    const short = (name: string) => name.replace(/\s+Department$/i, '');
    const clash = (name: string) => list.filter(d => this.norm(short(d.name)) === this.norm(short(name))).length > 1;
    const n = list.length, left = 80, right = 1120;
    return list.map((d, i) => ({
      key: 'd:' + d.id, deptId: d.id, deptName: d.name, label: clash(d.name) ? d.name : short(d.name), layer: 'dept' as const, icon: 'groups',
      color: DEPT_COLORS[i % DEPT_COLORS.length], x: n === 1 ? 600 : left + (i * (right - left)) / (n - 1), y: DEPT_Y,
      blurb: d.manager ? `Manager: ${d.manager}` : 'Department', people: this.placement().byDept.get(d.id)!,
    }));
  });

  /** Module permission keys per department, counted by person. Admins ("all") are kept apart so they don't link everything. */
  private deptModules = computed(() => {
    const cat = this.catalog(); const out = new Map<number, { perms: Map<string, number>; admins: number }>();
    if (!cat) return out;
    for (const u of cat.users) {
      if (u.departmentId == null) continue;
      const e = out.get(u.departmentId) ?? { perms: new Map(), admins: 0 };
      if (u.modules?.includes('all')) e.admins++;
      else for (const m of u.modules ?? []) e.perms.set(m, (e.perms.get(m) ?? 0) + 1);
      out.set(u.departmentId, e);
    }
    return out;
  });
  /** False when the backend does not send module permissions yet (links then fall back to department names). */
  permsKnown = computed(() => this.catalog()?.users.some(u => Array.isArray(u.modules)) ?? false);

  // ── nodes, edges, flows ───────────────────────────────────────────────────

  allNodes = computed<CortexNode[]>(() => [...CORTEX_NODES, ...this.deptNodes()]);
  private byKey = computed(() => new Map(this.allNodes().map(n => [n.key, n])));
  node = computed(() => this.byKey().get(this.selected() ?? '') ?? null);
  dept = computed(() => this.deptNodes().find(d => d.key === this.selected()) ?? null);

  /** Department → module links: from people's module permissions, else from department names. */
  private worksEdges = computed<MapEdge[]>(() => {
    const out: MapEdge[] = [];
    const modules = CORTEX_NODES.filter(n => n.layer === 'module');
    for (const d of this.deptNodes()) {
      if (this.permsKnown()) {
        const perms = this.deptModules().get(d.deptId)?.perms;
        for (const m of modules) {
          const c = m.perm ? perms?.get(m.perm) ?? 0 : 0;
          if (c) out.push({ from: d.key, to: m.key, label: `${c} ${c === 1 ? 'person' : 'people'} work here`, how: 'works' });
        }
      } else {
        for (const m of modules) if (m.flowWords?.test(d.deptName)) out.push({ from: d.key, to: m.key, label: 'Works here (by department name)', how: 'works' });
      }
    }
    return out;
  });

  edges = computed<MapEdge[]>(() => [...CORTEX_EDGES, ...this.worksEdges()]);
  visibleNodes = computed(() => this.allNodes().filter(n => !this.hidden().has(n.layer)));
  visibleEdges = computed(() => this.edges().filter(e => {
    const a = this.byKey().get(e.from), b = this.byKey().get(e.to);
    return a && b && !this.hidden().has(a.layer) && !this.hidden().has(b.layer);
  }));

  /** Flows per node: modules by their flow words, departments by their own flows and steps assigned to them. */
  flowsByNode = computed(() => {
    const map = new Map<string, FlowDefinition[]>();
    const add = (k: string, f: FlowDefinition) => { const l = map.get(k) ?? []; if (!l.includes(f)) l.push(f); map.set(k, l); };
    for (const f of this.live()) {
      const text = `${f.name} ${f.category ?? ''} ${f.description ?? ''} ${f.departmentName ?? ''}`;
      for (const m of CORTEX_NODES) if (m.flowWords?.test(text)) add(m.key, f);
      add('flows', f);
      for (const d of this.deptNodes()) {
        if (this.norm(f.departmentName) === this.norm(d.deptName)) { add(d.key, f); continue; }
        const touches = (f.graph?.steps ?? []).some(s => ['assignTo', 'escalateTo', 'to'].some(k => {
          const a = s.config?.[k];
          return a && (a.departmentId === d.deptId || this.norm(a.departmentName) === this.norm(d.deptName));
        }));
        if (touches) add(d.key, f);
      }
    }
    return map;
  });

  flowsOf(key: string) { return this.flowsByNode().get(key) ?? []; }
  humanFlows(key: string) { return this.flowsOf(key).filter(f => !!f.departmentName); }
  activeRuns(key: string) { return this.flowsOf(key).reduce((a, f) => a + f.activeRuns, 0); }
  people(key: string) { return this.deptNodes().find(d => d.key === key)?.people ?? []; }
  mapped(key: string) { return this.people(key).filter(p => p.flows.length).length; }

  // ── gaps, coverage, suggestions ───────────────────────────────────────────

  private templateByName(name?: string) { return name ? this.templates().find(t => t.name === name) ?? null : null; }
  /** A gap is covered once a live flow exists from its template. */
  gapCovered(g: CortexGap) { return !!g.template && this.live().some(f => f.name.startsWith(g.template!)); }
  gapsOf(key: string) { return CORTEX_GAPS.filter(g => g.node === key); }
  openGaps = computed(() => CORTEX_GAPS.filter(g => !this.gapCovered(g)));

  gauges = computed(() => {
    const depts = this.deptNodes();
    const deptsMapped = depts.filter(d => this.humanFlows(d.key).length).length;
    let people = 0, peopleMapped = 0;
    for (const d of depts) { people += d.people.length; peopleMapped += d.people.filter(p => p.flows.length).length; }
    const steps = CORTEX_STREAMS.flatMap(s => s.steps);
    const auto = steps.filter(s => s.how === 'code').length;
    const pct = (a: number, b: number) => b ? Math.round(100 * a / b) : 0;
    return [
      { key: 'dept', label: 'Departments with a flow', value: pct(deptsMapped, depts.length), detail: `${deptsMapped} of ${depts.length} departments`, color: '#22d3ee' },
      { key: 'people', label: 'People with a flow', value: pct(peopleMapped, people), detail: `${peopleMapped} of ${people} people`, color: '#c084fc' },
      { key: 'auto', label: 'Hand-offs automatic', value: pct(auto, steps.length), detail: `${auto} of ${steps.length} steps run in code; the rest wait for someone`, color: '#34d399' },
      { key: 'gaps', label: 'Gaps closed', value: pct(CORTEX_GAPS.length - this.openGaps().length, CORTEX_GAPS.length), detail: `${this.openGaps().length} of ${CORTEX_GAPS.length} gaps still open`, color: '#f5b942' },
    ];
  });
  readonly ringLen = 2 * Math.PI * 26;
  ringDash(v: number) { return `${(this.ringLen * v) / 100} ${this.ringLen}`; }

  /** Departments on the map that look like one team under two names ("Finance" and "Finance Department"). */
  private lookalikes = computed(() => {
    const groups = new Map<string, string[]>();
    for (const d of this.deptNodes()) {
      const k = this.norm(d.deptName).replace(/\s+department$/, '');
      groups.set(k, [...(groups.get(k) ?? []), d.deptName]);
    }
    return [...groups.values()].filter(g => g.length > 1);
  });

  /** Department records with a single person and no flow of their own: probably stale or a mis-set account. */
  private strays = computed(() => {
    const cat = this.catalog(); if (!cat) return [] as { dept: string; person: string }[];
    const drawn = new Set(this.deptNodes().map(d => d.deptId));
    return cat.departments
      .filter(d => !drawn.has(d.id) && (this.placement().byDept.get(d.id)?.length ?? 0) === 1)
      .map(d => ({ dept: d.name, person: this.placement().byDept.get(d.id)![0].name }));
  });

  suggestions = computed<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const designer = this.isDesigner();
    for (const g of this.openGaps()) {
      const tpl = this.templateByName(g.template);
      out.push({ icon: 'build_circle', tone: 'gap', weight: 100, title: g.title, detail: g.fix,
        actLabel: tpl && designer ? 'Use template' : 'Show', act: () => tpl && designer ? this.useTemplate.emit(tpl) : this.select(g.node) });
    }
    for (const g of this.apiGaps()) {
      const target = this.mapKeyFor(g.on);
      out.push({ icon: g.kind === 'overdue' ? 'history' : g.unowned ? 'person_off' : 'build_circle', tone: g.kind === 'overdue' ? 'data' : 'gap', weight: 70 + g.priority * 10,
        title: g.label, detail: `${g.detail ?? ''}${g.owner ? ` · Owner: ${g.owner}` : ' · No owner yet'}`,
        actLabel: target ? 'Show' : 'OK', act: () => { if (target) this.selected.set(target); } });
    }
    const lost = this.unplaced();
    if (lost.length) out.push({ icon: 'person_search', tone: 'data', weight: 90, title: `${lost.length} employees have no department`,
      detail: `Clock-in register says "Other" and there's no intranet account to place them by (e.g. ${lost.slice(0, 3).join(', ')}).`,
      actLabel: designer ? 'Fix' : 'OK', act: () => { if (designer) this.router.navigate(['/settings', 'clock-in']); } });
    for (const g of this.lookalikes()) out.push({ icon: 'merge', tone: 'data', weight: 85, title: `${g.join(' / ')} look like one team`,
      detail: 'Two department records split the same people and flows. Merge them in Users so the map, permissions and flows agree.',
      actLabel: designer ? 'Open users' : 'OK', act: () => { if (designer) this.router.navigate(['/settings', 'users']); } });
    for (const s of this.strays()) out.push({ icon: 'help_outline', tone: 'data', weight: 80, title: `Is "${s.dept}" still a department?`,
      detail: `Only ${s.person} is in it, and it has no flow. Move them to their real department, or retire the record.`,
      actLabel: designer ? 'Open users' : 'OK', act: () => { if (designer) this.router.navigate(['/settings', 'users']); } });
    for (const d of this.deptNodes()) {
      if (!this.humanFlows(d.key).length) out.push({ icon: 'add_road', tone: 'map', weight: 60 + d.people.length, title: `Map how ${d.label} works`,
        detail: `${d.people.length} ${d.people.length === 1 ? 'person' : 'people'}, no human flow yet.`,
        actLabel: designer ? 'Create' : 'Show', act: () => designer ? this.newHumanFlow.emit({ dept: d.deptName, owner: null }) : this.select(d.key) });
      else {
        const missing = d.people.filter(p => !p.flows.length);
        if (missing.length) out.push({ icon: 'person_add', tone: 'people', weight: 30 + missing.length, title: `${missing.length} in ${d.label} without their own flow`,
          detail: `Start with ${missing.slice(0, 3).map(p => p.name.split(' ')[0]).join(', ')}${missing.length > 3 ? '…' : ''}.`, actLabel: 'Show', act: () => this.select(d.key) });
      }
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, 20);
  });

  // ── geometry and focus ────────────────────────────────────────────────────

  radius(n: CortexNode) { return n.layer === 'module' ? 30 : n.layer === 'dept' ? 26 : 22; }

  edgePath(e: MapEdge): string {
    const a = this.byKey().get(e.from)!, b = this.byKey().get(e.to)!;
    if (a.y === b.y) {
      const dir = a.x < b.x ? -1 : 1;
      const lift = Math.min(100, Math.abs(b.x - a.x) * 0.3 + 18) * dir;
      return `M${a.x},${a.y} Q${(a.x + b.x) / 2},${a.y + lift} ${b.x},${b.y}`;
    }
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
  }

  private focus = computed(() => {
    const k = this.hovered() ?? this.selected();
    if (!k) return null;
    const set = new Set([k]);
    for (const e of this.edges()) { if (e.from === k) set.add(e.to); if (e.to === k) set.add(e.from); }
    return { key: k, set };
  });
  private streamNodes = computed(() => {
    const s = CORTEX_STREAMS.find(x => x.key === this.stream());
    return s ? new Set(s.steps.map(st => st.node)) : null;
  });

  nodeState(n: CortexNode): 'focus' | 'near' | 'dim' | '' {
    const sn = this.streamNodes();
    if (sn) return sn.has(n.key) ? 'near' : 'dim';
    const f = this.focus();
    if (!f) return '';
    return n.key === f.key ? 'focus' : f.set.has(n.key) ? 'near' : 'dim';
  }
  edgeState(e: MapEdge): 'lit' | 'dim' | '' {
    if (this.streamNodes()) return 'dim';
    const f = this.focus();
    if (!f) return e.how === 'works' ? 'dim' : '';
    return e.from === f.key || e.to === f.key ? 'lit' : 'dim';
  }

  streamPath = computed(() => {
    const s = CORTEX_STREAMS.find(x => x.key === this.stream());
    if (!s) return null;
    const pts: CortexNode[] = [];
    for (const st of s.steps) { const n = this.byKey().get(st.node); if (n && pts[pts.length - 1] !== n) pts.push(n); }
    if (!pts.length) return null;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.y === b.y) d += ` Q${(a.x + b.x) / 2},${a.y + (a.x < b.x ? -1 : 1) * Math.min(110, Math.abs(b.x - a.x) * 0.4 + 24)} ${b.x},${b.y}`;
      else { const my = (a.y + b.y) / 2; d += ` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`; }
    }
    return { d, color: s.color, order: pts.map(p => p.key) };
  });
  streamIndex(key: string) { return (this.streamPath()?.order.indexOf(key) ?? -1) + 1; }
  activeStream = computed<CortexStream | null>(() => CORTEX_STREAMS.find(s => s.key === this.stream()) ?? null);
  streamAuto(s: CortexStream) { return Math.round(100 * s.steps.filter(x => x.how === 'code').length / s.steps.length); }

  // ── search and interaction ────────────────────────────────────────────────

  results = computed(() => {
    const q = this.norm(this.query());
    if (q.length < 2) return [];
    const out: { icon: string; label: string; sub: string; node: string }[] = [];
    for (const n of this.allNodes()) if (this.norm(n.label).includes(q)) out.push({ icon: n.icon, label: n.label, sub: n.layer === 'dept' ? 'Department' : n.layer === 'module' ? 'Module' : 'Source', node: n.key });
    for (const d of this.deptNodes()) for (const p of d.people) if (this.norm(p.name).includes(q)) out.push({ icon: 'person', label: p.name, sub: `${p.title ?? 'Employee'} · ${d.label}`, node: d.key });
    for (const f of this.live()) if (this.norm(f.name).includes(q)) {
      const home = this.deptNodes().find(d => this.flowsOf(d.key).includes(f)) ?? CORTEX_NODES.find(m => this.flowsOf(m.key).includes(f) && m.key !== 'flows');
      out.push({ icon: 'account_tree', label: f.name, sub: `Flow · ${home?.label ?? 'Flows'}`, node: home?.key ?? 'flows' });
    }
    return out.slice(0, 8);
  });

  select(key: string | null) { this.selected.set(this.selected() === key ? null : key); }
  pick(r: { node: string }) { this.selected.set(r.node); this.query.set(''); }
  toggleStream(key: string) { this.stream.set(this.stream() === key ? null : key); }
  toggleLayer(l: CortexLayer) { const s = new Set(this.hidden()); s.has(l) ? s.delete(l) : s.add(l); this.hidden.set(s); }

  /** Hand-offs in and out of a node (module and source edges only). */
  handoffs(key: string) {
    return CORTEX_EDGES.filter(e => e.from === key || e.to === key)
      .map(e => ({ edge: e, other: this.byKey().get(e.from === key ? e.to : e.from)!, out: e.from === key }))
      .filter(x => x.other);
  }
  /** For a module: departments whose people work in it. For a department: the modules they work in. */
  works(key: string) {
    return this.worksEdges().filter(e => e.from === key || e.to === key)
      .map(e => ({ node: this.byKey().get(e.from === key ? e.to : e.from)!, label: e.label }))
      .filter(x => x.node);
  }
  admins(key: string) { const d = this.deptNodes().find(x => x.key === key); return d ? this.deptModules().get(d.deptId)?.admins ?? 0 : 0; }

  label(key: string) { const n = this.byKey().get(key); return n?.short ?? n?.label ?? key; }
  color(key: string) { return this.byKey().get(key)?.color ?? '#94a3b8'; }
  howLabel(h: CortexHow | 'works') { return h === 'code' ? 'Automatic' : h === 'manual' ? 'Someone acts' : h === 'read' ? 'Read only' : h === 'gap' ? 'Not built' : 'Works here'; }
  layerName(n: CortexNode) { return n.layer === 'dept' ? 'Department' : n.layer === 'module' ? 'Module' : 'Source'; }
  gapTemplate(g: CortexGap) { return this.templateByName(g.template); }

  personClick(d: DeptNode, p: CortexPerson) {
    if (p.flows.length) {
      const f = p.flows[0];
      if (f.departmentName) this.openHuman.emit({ dept: f.departmentName, personKey: f.ownerEmployeeId ? 'e:' + f.ownerEmployeeId : f.ownerUserId ? 'u:' + f.ownerUserId : null });
      else this.viewFlow.emit(f);
    } else if (this.isDesigner() && p.employeeId) {
      this.newHumanFlow.emit({ dept: d.deptName, owner: { employeeId: p.employeeId, name: p.name, title: p.title } });
    }
  }

  initials(n: string) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]!.toUpperCase()).join(''); }
  trackEdge(e: MapEdge) { return e.from + '>' + e.to + ':' + e.label; }
}
