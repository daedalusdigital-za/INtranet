import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FlowCatalog, FlowDefinition, FlowStats } from '../../services/flows.service';
import { CORTEX_APPROVALS, CORTEX_EDGES, CORTEX_LAYERS, CORTEX_NODES, CORTEX_STREAMS, CortexEdge, CortexLayer, CortexNode, CortexStream, CortexStreamStep } from './cortex-model';

/** A person shown on the map: from the employee register, or an intranet user when a department has no register entries. */
interface CortexPerson { key: string; name: string; title: string | null; employeeId: string | null; flows: FlowDefinition[]; }

interface StepCoverage { step: CortexStreamStep; flows: FlowDefinition[]; template: FlowDefinition | null; state: 'live' | 'template' | 'gap'; }

interface Suggestion { icon: string; title: string; detail: string; tone: 'map' | 'people' | 'template' | 'gap'; weight: number; act: () => void; actLabel: string; }

/**
 * Cortex: the interconnected operating map. Shows every department, the cortex core, Welly's agents and the assets
 * underneath, with the company's real flows, people and live runs joined on, plus what is still missing.
 */
@Component({
  selector: 'app-flow-cortex',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatTooltipModule],
  templateUrl: './flow-cortex.component.html',
  styleUrls: ['./flow-cortex.component.scss']
})
export class FlowCortexComponent {
  private router = inject(Router);
  flows =input<FlowDefinition[]>([]);
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

  readonly nodes = CORTEX_NODES;
  readonly layers = CORTEX_LAYERS;
  readonly streams = CORTEX_STREAMS;
  readonly approvals = CORTEX_APPROVALS;
  private readonly byKey = new Map(CORTEX_NODES.map(n => [n.key, n]));

  selected = signal<string | null>(null);
  hovered = signal<string | null>(null);
  stream = signal<string | null>(null);
  query = signal('');
  hidden = signal<Set<CortexLayer>>(new Set());

  // ── joins: real data onto the model ────────────────────────────────────────

  /** Live flows only (templates excluded). */
  private live = computed(() => this.flows().filter(f => !f.isTemplate));

  /** Which map node a department / register department name belongs to. */
  nodeFor(name: string | null | undefined): CortexNode | null {
    if (!name) return null;
    return CORTEX_NODES.find(n => (n.layer === 'dept' || n.layer === 'gov') && n.match?.test(name)) ?? null;
  }

  /** Flows touching each node: human flows by their department, process flows by category or any step assigned there. */
  flowsByNode = computed(() => {
    const map = new Map<string, FlowDefinition[]>();
    const cat = this.catalog();
    const add = (key: string, f: FlowDefinition) => { const l = map.get(key) ?? []; if (!l.includes(f)) l.push(f); map.set(key, l); };
    for (const f of this.live()) {
      const own = this.nodeFor(f.departmentName ?? null);
      if (own) { add(own.key, f); continue; }
      const byCat = this.nodeFor(f.category ?? null);
      if (byCat) add(byCat.key, f);
      for (const s of f.graph?.steps ?? []) {
        for (const k of ['assignTo', 'escalateTo', 'to']) {
          const a = s.config?.[k];
          const dn = a?.departmentName ?? (a?.departmentId ? cat?.departments.find(d => d.id === a.departmentId)?.name : null);
          const n = this.nodeFor(dn);
          if (n) add(n.key, f);
          if (a?.role === 'Admin') add('mgmt', f);
        }
      }
    }
    return map;
  });

  private ownerFlows = computed(() => {
    const byEmp = new Map<string, FlowDefinition[]>(); const byUser = new Map<number, FlowDefinition[]>();
    for (const f of this.live()) {
      if (f.ownerEmployeeId) byEmp.set(f.ownerEmployeeId, [...(byEmp.get(f.ownerEmployeeId) ?? []), f]);
      if (f.ownerUserId) byUser.set(f.ownerUserId, [...(byUser.get(f.ownerUserId) ?? []), f]);
    }
    return { byEmp, byUser };
  });

  /**
   * People per department node. Everyone on the employee register, placed by their register department, or by their
   * intranet account's department when the register just says "Other"; then intranet users who are not on the register.
   */
  private placement = computed(() => {
    const cat = this.catalog(); const map = new Map<string, CortexPerson[]>(); const unplaced: string[] = [];
    if (!cat) return { map, unplaced };
    const { byEmp, byUser } = this.ownerFlows();
    // First + last name, so "Joulene Mahabeer" on the register finds the account "Joulene Mahabeer Mahabeer".
    const norm = (s: string) => { const w = s.trim().toLowerCase().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1]}` : w[0]; };
    const userByName = new Map(cat.users.map(u => [norm(u.name), u]));
    const userDept = (u?: { departmentId?: number | null }) => u ? cat.departments.find(d => d.id === u.departmentId)?.name ?? null : null;
    const put = (key: string, p: CortexPerson) => map.set(key, [...(map.get(key) ?? []), p]);
    const placedUsers = new Set<number>();
    for (const e of cat.employees ?? []) {
      const u = userByName.get(norm(e.name));
      const n = this.nodeFor(e.department) ?? this.nodeFor(userDept(u));
      if (u) placedUsers.add(u.id);
      if (!n) { unplaced.push(e.name); continue; }
      const flows = [...(byEmp.get(e.id) ?? [])];
      for (const f of u ? byUser.get(u.id) ?? [] : []) if (!flows.includes(f)) flows.push(f);
      put(n.key, { key: 'e:' + e.id, name: e.name, title: e.jobTitle ?? null, employeeId: e.id, flows });
    }
    for (const u of cat.users) {
      if (placedUsers.has(u.id)) continue;
      const n = this.nodeFor(userDept(u)); if (!n) continue;
      put(n.key, { key: 'u:' + u.id, name: u.name, title: u.role, employeeId: null, flows: byUser.get(u.id) ?? [] });
    }
    for (const l of map.values()) l.sort((a, b) => (b.flows.length ? 1 : 0) - (a.flows.length ? 1 : 0) || a.name.localeCompare(b.name));
    return { map, unplaced };
  });
  peopleByNode = computed(() => this.placement().map);
  /** Register employees with no recognisable department and no intranet account to place them by. */
  unplaced = computed(() => this.placement().unplaced);

  /** Actual department name in this company for a node (for presetting new flows). */
  deptName(n: CortexNode): string | null {
    const cat = this.catalog();
    return cat?.departments.find(d => n.match?.test(d.name))?.name
      ?? this.live().find(f => f.departmentName && n.match?.test(f.departmentName))?.departmentName
      ?? null;
  }

  activeRuns(key: string) { return (this.flowsByNode().get(key) ?? []).reduce((a, f) => a + f.activeRuns, 0); }
  humanFlows(key: string) { return (this.flowsByNode().get(key) ?? []).filter(f => !!f.departmentName); }
  processFlowsOf(key: string) { return (this.flowsByNode().get(key) ?? []).filter(f => !f.departmentName); }
  people(key: string) { return this.peopleByNode().get(key) ?? []; }
  mapped(key: string) { return this.people(key).filter(p => p.flows.length).length; }

  // ── coverage ───────────────────────────────────────────────────────────────

  private flowText(f: FlowDefinition) { return `${f.name} ${f.description ?? ''}`.toLowerCase(); }
  /** Matches at the start of a word, so "creditor" finds "creditors" but "order" does not hit "border". */
  private mentions(f: FlowDefinition, words: string[]) {
    const t = this.flowText(f);
    return words.some(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t));
  }

  coverage(step: CortexStreamStep): StepCoverage {
    const flows = this.live().filter(f => this.mentions(f, step.match));
    const template = step.template ? this.templates().find(t => t.name === step.template) ?? null : null;
    return { step, flows, template, state: flows.length ? 'live' : template ? 'template' : 'gap' };
  }

  streamCoverage = computed(() => {
    const out = new Map<string, StepCoverage[]>();
    for (const s of CORTEX_STREAMS) out.set(s.key, s.steps.map(st => this.coverage(st)));
    return out;
  });

  streamPct(key: string) {
    const c = this.streamCoverage().get(key) ?? [];
    return c.length ? Math.round(100 * c.filter(x => x.state === 'live').length / c.length) : 0;
  }

  approvalState(a: (typeof CORTEX_APPROVALS)[number]) {
    const flows = this.live().filter(f => this.mentions(f, a.match));
    const template = a.template ? this.templates().find(t => t.name === a.template) ?? null : null;
    return { flows, template, state: flows.length ? 'live' : template ? 'template' : 'gap' } as const;
  }

  gauges = computed(() => {
    const depts = CORTEX_NODES.filter(n => n.layer === 'dept' || n.layer === 'gov');
    const deptsMapped = depts.filter(n => this.humanFlows(n.key).length).length;
    let people = 0, peopleMapped = 0;
    for (const l of this.peopleByNode().values()) { people += l.length; peopleMapped += l.filter(p => p.flows.length).length; }
    const steps = [...this.streamCoverage().values()].flat();
    const live = this.live();
    const smart = live.filter(f => f.level >= 2 || f.graph?.steps?.some(s => s.type === 'ai_analyze')).length;
    const pct = (a: number, b: number) => b ? Math.round(100 * a / b) : 0;
    return [
      { key: 'dept', label: 'Departments mapped', value: pct(deptsMapped, depts.length), detail: `${deptsMapped} / ${depts.length}`, color: '#22d3ee' },
      { key: 'people', label: 'People with a flow', value: pct(peopleMapped, people), detail: `${peopleMapped} / ${people}`, color: '#c084fc' },
      { key: 'streams', label: 'Value streams automated', value: pct(steps.filter(s => s.state === 'live').length, steps.length), detail: `${steps.filter(s => s.state === 'live').length} / ${steps.length} steps`, color: '#34d399' },
      { key: 'ai', label: 'AI-assisted flows', value: pct(smart, live.length), detail: `${smart} / ${live.length}`, color: '#f5b942' },
    ];
  });

  /** Ring geometry for a gauge (r = 26). */
  readonly ringLen = 2 * Math.PI * 26;
  ringDash(v: number) { return `${(this.ringLen * v) / 100} ${this.ringLen}`; }

  // ── suggestions ────────────────────────────────────────────────────────────

  suggestions = computed<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const designer = this.isDesigner();
    for (const n of CORTEX_NODES.filter(x => x.layer === 'dept' || x.layer === 'gov')) {
      const ppl = this.people(n.key);
      if (!this.humanFlows(n.key).length) {
        out.push({ icon: 'add_road', tone: 'map', weight: 90 + ppl.length, title: `Map how ${n.label} works`,
          detail: `No human flow yet${ppl.length ? ` for ${ppl.length} ${ppl.length === 1 ? 'person' : 'people'}` : ''}. Capture the day-to-day so it survives staff changes.`,
          actLabel: designer ? 'Create' : 'Inspect', act: () => designer ? this.newHumanFlow.emit({ dept: this.deptName(n) ?? n.label, owner: null }) : this.select(n.key) });
      }
      const missing = ppl.filter(p => !p.flows.length);
      if (missing.length && this.humanFlows(n.key).length) {
        out.push({ icon: 'person_add', tone: 'people', weight: 40 + missing.length, title: `${missing.length} in ${n.short ?? n.label} without their own flow`,
          detail: `Start with ${missing.slice(0, 3).map(p => p.name.split(' ')[0]).join(', ')}${missing.length > 3 ? '…' : ''}.`,
          actLabel: 'Show people', act: () => this.select(n.key) });
      }
    }
    const lost = this.unplaced();
    if (lost.length) {
      out.push({ icon: 'person_search', tone: 'people', weight: 80 + lost.length, title: `${lost.length} employees can't be placed on the map`,
        detail: `Their clock-in record says "Other" and they have no intranet account with a department (e.g. ${lost.slice(0, 3).join(', ')}). Set their department to place them.`,
        actLabel: designer ? 'Fix' : 'OK', act: () => { if (designer) this.router.navigate(['/settings', 'clock-in']); } });
    }
    const seen = new Set<string>();
    for (const s of CORTEX_STREAMS) for (const c of this.streamCoverage().get(s.key) ?? []) {
      if (c.state === 'template' && c.template && !seen.has(c.template.name)) {
        seen.add(c.template.name);
        const tpl = c.template;
        out.push({ icon: 'auto_awesome', tone: 'template', weight: 70, title: `Switch on "${tpl.name}"`,
          detail: `Covers "${c.step.text}" in ${s.label}. A ready-made template exists.`,
          actLabel: designer ? 'Use template' : 'View', act: () => designer ? this.useTemplate.emit(tpl) : this.viewFlow.emit(tpl) });
      }
    }
    for (const a of CORTEX_APPROVALS) {
      const st = this.approvalState(a);
      if (st.state === 'template' && st.template && !seen.has(st.template.name)) {
        seen.add(st.template.name);
        const tpl = st.template;
        out.push({ icon: 'rule', tone: 'template', weight: 65, title: `Approval matrix: ${a.decision}`,
          detail: `${a.first} → ${a.escalates} (${a.trigger}). "${tpl.name}" is ready to use.`,
          actLabel: designer ? 'Use template' : 'View', act: () => designer ? this.useTemplate.emit(tpl) : this.viewFlow.emit(tpl) });
      }
    }
    for (const s of CORTEX_STREAMS) {
      const gaps = (this.streamCoverage().get(s.key) ?? []).filter(c => c.state === 'gap');
      if (gaps.length) out.push({ icon: 'conversion_path', tone: 'gap', weight: 30 + gaps.length, title: `${s.label}: ${gaps.length} step${gaps.length === 1 ? '' : 's'} with no flow`,
        detail: gaps.slice(0, 2).map(g => g.step.text).join(' · '), actLabel: 'Trace', act: () => this.toggleStream(s.key) });
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, 12);
  });

  // ── map geometry ───────────────────────────────────────────────────────────

  visibleNodes = computed(() => this.nodes.filter(n => !this.hidden().has(n.layer)));
  visibleEdges = computed(() => CORTEX_EDGES.filter(e => {
    const a = this.byKey.get(e.from), b = this.byKey.get(e.to);
    return a && b && !this.hidden().has(a.layer) && !this.hidden().has(b.layer);
  }));

  radius(n: CortexNode) { return n.layer === 'gov' ? 36 : n.layer === 'dept' ? 30 : n.layer === 'core' ? 30 : n.layer === 'ext' ? 26 : 20; }

  edgePath(e: CortexEdge): string {
    const a = this.byKey.get(e.from)!, b = this.byKey.get(e.to)!;
    if (a.y === b.y) {
      const dir = a.x < b.x ? -1 : 1;
      const lift = Math.min(110, Math.abs(b.x - a.x) * 0.35 + 18) * dir;
      return `M${a.x},${a.y} Q${(a.x + b.x) / 2},${a.y + lift} ${b.x},${b.y}`;
    }
    const my = (a.y + b.y) / 2;
    return `M${a.x},${a.y} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
  }

  /** The node in focus (hover beats selection) and everything one hop from it. */
  private focus = computed(() => {
    const k = this.hovered() ?? this.selected();
    if (!k) return null;
    const set = new Set([k]);
    for (const e of CORTEX_EDGES) { if (e.from === k) set.add(e.to); if (e.to === k) set.add(e.from); }
    return { key: k, set };
  });

  private streamNodes = computed(() => {
    const s = CORTEX_STREAMS.find(x => x.key === this.stream());
    return s ? new Set(s.steps.map(st => st.dept)) : null;
  });

  nodeState(n: CortexNode): 'focus' | 'near' | 'dim' | '' {
    const sn = this.streamNodes();
    if (sn) return sn.has(n.key) ? (this.selected() === n.key ? 'focus' : 'near') : 'dim';
    const f = this.focus();
    if (!f) return '';
    return n.key === f.key ? 'focus' : f.set.has(n.key) ? 'near' : 'dim';
  }

  edgeState(e: CortexEdge): 'lit' | 'dim' | '' {
    if (this.streamNodes()) return 'dim';
    const f = this.focus();
    if (!f) return '';
    return e.from === f.key || e.to === f.key ? 'lit' : 'dim';
  }

  /** The selected value stream as one path through its departments, in order. */
  streamPath = computed(() => {
    const s = CORTEX_STREAMS.find(x => x.key === this.stream());
    if (!s) return null;
    const pts: CortexNode[] = [];
    for (const st of s.steps) { const n = this.byKey.get(st.dept); if (n && pts[pts.length - 1] !== n) pts.push(n); }
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (a.y === b.y) d += ` Q${(a.x + b.x) / 2},${a.y + (a.x < b.x ? -1 : 1) * Math.min(120, Math.abs(b.x - a.x) * 0.4 + 24)} ${b.x},${b.y}`;
      else { const my = (a.y + b.y) / 2; d += ` C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`; }
    }
    return { d, color: s.color, order: pts.map(p => p.key) };
  });

  streamIndex(key: string) { return (this.streamPath()?.order.indexOf(key) ?? -1) + 1; }

  // ── search ─────────────────────────────────────────────────────────────────

  results = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (q.length < 2) return [];
    const out: { icon: string; label: string; sub: string; node: string; person?: string }[] = [];
    for (const n of this.nodes) if (n.label.toLowerCase().includes(q)) out.push({ icon: n.icon, label: n.label, sub: 'Map node', node: n.key });
    for (const [k, ppl] of this.peopleByNode()) for (const p of ppl) if (p.name.toLowerCase().includes(q)) out.push({ icon: 'person', label: p.name, sub: `${p.title ?? 'Employee'} · ${this.byKey.get(k)?.label}`, node: k, person: p.key });
    for (const [k, fs] of this.flowsByNode()) for (const f of fs) if (f.name.toLowerCase().includes(q) && !out.some(o => o.label === f.name)) out.push({ icon: 'account_tree', label: f.name, sub: `Flow · ${this.byKey.get(k)?.label}`, node: k });
    return out.slice(0, 8);
  });

  // ── interaction ────────────────────────────────────────────────────────────

  select(key: string | null) { this.selected.set(this.selected() === key ? null : key); }
  pick(r: { node: string }) { this.selected.set(r.node); this.query.set(''); }
  toggleStream(key: string) { this.stream.set(this.stream() === key ? null : key); }
  toggleLayer(l: CortexLayer) { const s = new Set(this.hidden()); s.has(l) ? s.delete(l) : s.add(l); this.hidden.set(s); }

  node = computed(() => this.byKey.get(this.selected() ?? '') ?? null);
  activeStream = computed<CortexStream | null>(() => CORTEX_STREAMS.find(s => s.key === this.stream()) ?? null);
  neighbours(key: string) {
    return CORTEX_EDGES.filter(e => e.from === key || e.to === key)
      .map(e => ({ edge: e, other: this.byKey.get(e.from === key ? e.to : e.from)!, out: e.from === key }));
  }
  label(key: string) { return this.byKey.get(key)?.short ?? this.byKey.get(key)?.label ?? key; }
  color(key: string) { return this.byKey.get(key)?.color ?? '#94a3b8'; }
  /** Flows that use Welly in an agent's owning area. */
  agentFlows(n: CortexNode) {
    const owner = this.nodeFor(n.owner ?? null);
    const pool = owner ? this.flowsByNode().get(owner.key) ?? [] : this.live();
    return pool.filter(f => f.graph?.steps?.some(s => s.type === 'ai_analyze' || s.type === 'welly_action'));
  }

  personClick(n: CortexNode, p: CortexPerson) {
    const dept = this.deptName(n) ?? p.flows[0]?.departmentName ?? n.label;
    if (p.flows.length) {
      const f = p.flows[0];
      if (f.departmentName) this.openHuman.emit({ dept: f.departmentName, personKey: f.ownerEmployeeId ? 'e:' + f.ownerEmployeeId : f.ownerUserId ? 'u:' + f.ownerUserId : null });
      else this.viewFlow.emit(f);
    } else if (this.isDesigner() && p.employeeId) {
      this.newHumanFlow.emit({ dept, owner: { employeeId: p.employeeId, name: p.name, title: p.title } });
    }
  }

  initials(n: string) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]!.toUpperCase()).join(''); }
  trackEdge(e: CortexEdge) { return e.from + '>' + e.to; }
}
