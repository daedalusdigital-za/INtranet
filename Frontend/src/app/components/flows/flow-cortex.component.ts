import { Component, ElementRef, OnInit, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CortexApiGap, CortexApiNode, CortexGraph, FlowCatalog, FlowDefinition, FlowStats, FlowsService } from '../../services/flows.service';
import { CORTEX_COMPANIES, CORTEX_EDGES, CORTEX_GAPS, CORTEX_NODES, CORTEX_STREAMS, CortexGap, CortexHow, CortexLayer, CortexNode, CortexStream } from './cortex-model';
import { BrainEdge, BrainNode, CortexBrainComponent } from './cortex-brain.component';

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
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule, CortexBrainComponent],
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
  /** A flow was switched on/off from the Work view; parent should reload definitions. */
  flowsChanged = output<void>();

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
  /** 1 = company (sources + modules), 2 = departments, 3 = people inside the selected department. */
  zoom = signal<1 | 2 | 3>(2);
  readonly zoomLevels: { z: 1 | 2 | 3; label: string; icon: string; tip: string }[] = [
    { z: 1, label: 'Company', icon: 'apartment', tip: 'Sources, modules and the hand-offs between them' },
    { z: 2, label: 'Departments', icon: 'groups', tip: 'Who works in which module' },
    { z: 3, label: 'People', icon: 'person', tip: 'Pick a department to fan out its people and what they can reach' },
  ];
  setZoom(z: 1 | 2 | 3) {
    this.zoom.set(z);
    const s = new Set(this.hidden()); z === 1 ? s.add('dept') : s.delete('dept'); this.hidden.set(s);
    if (z === 3 && !this.dept()) { const d = this.deptNodes()[0]; if (d) this.selected.set(d.key); }
    if (z === 1) this.flyTo({ x: 0, y: -40, k: 1.25 });
    else if (z === 2) this.fit();
    else { const d = this.dept(); if (d) this.focusNode(d.key, 2.4); }
  }

  /** People of the selected department as small nodes on an arc above its hexagon (People zoom only). */
  personNodes = computed(() => {
    const d = this.dept(); if (!d || this.zoom() !== 3) return [] as { key: string; p: CortexPerson; x: number; y: number; modules: string[] }[];
    const list = d.people.slice(0, 28);
    const n = list.length; if (!n) return [];
    const byUser = new Map((this.catalog()?.users ?? []).map(u => [u.id, u]));
    return list.map((p, i) => {
      const row = i < 14 ? 0 : 1, idx = row ? i - 14 : i, cnt = row ? n - 14 : Math.min(n, 14);
      const a = Math.PI + (cnt === 1 ? Math.PI / 2 : (Math.PI * (idx + 0.5)) / cnt);   // 180° → 360° : an arc over the top
      const r = 78 + row * 34;
      const mods = p.userId != null ? (byUser.get(p.userId)?.modules ?? []) : [];
      return { key: 'p:' + p.key, p, x: Math.max(24, Math.min(1176, d.x + r * Math.cos(a))), y: d.y + r * Math.sin(a) * 0.72, modules: mods };
    });
  });
  /** Person → module reach, for the person under the pointer (or all, dimmed). */
  personEdges = computed(() => {
    const out: { from: string; to: string; x1: number; y1: number; x2: number; y2: number; lit: boolean }[] = [];
    const hov = this.hovered();
    for (const pn of this.personNodes()) {
      const mods = pn.modules.includes('all') ? [] : pn.modules;
      for (const m of CORTEX_NODES.filter(n => n.layer === 'module' && n.perm && mods.includes(n.perm))) out.push({ from: pn.key, to: m.key, x1: pn.x, y1: pn.y, x2: m.x, y2: m.y, lit: hov === pn.key });
    }
    return hov ? out.filter(e => e.lit) : out.slice(0, 120);
  });
  personPath(e: { x1: number; y1: number; x2: number; y2: number }) { const my = (e.y1 + e.y2) / 2; return `M${e.x1},${e.y1} C${e.x1},${my} ${e.x2},${my} ${e.x2},${e.y2}`; }

  /** Processes that count: live (not a template) and enabled. A disabled process is not coverage. */
  private live = computed(() => this.flows().filter(f => !f.isTemplate && f.isEnabled !== false));
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
  attached(key: string) { const k = this.apiKey(key); return k ? (this.graph()?.nodes ?? []).filter(n => n.parent === k && !['gap', 'step', 'approval', 'inference', 'finding', 'suggestion', 'process'].includes(n.type)) : []; }
  /** Welly inferences and findings attached to this node or its workflow steps. */
  inferencesOf(key: string) {
    const k = this.apiKey(key); if (!k) return [];
    return (this.graph()?.nodes ?? []).filter(n => (n.type === 'inference' || n.type === 'finding') && (n.parent === k || n.parent?.startsWith(k + ':step:')));
  }
  /** The proposed fix for a finding, if Welly Suggest attached one. */
  fixFor(n: CortexApiNode) { return n.type === 'finding' ? (this.graph()?.nodes ?? []).find(s => s.type === 'suggestion' && s.parent === n.key) ?? null : null; }
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
  /** Inline editor: which node is being written/reviewed, and the draft. One at a time. */
  editing = signal<{ node: CortexApiNode; mode: 'write' | 'reject' | 'owner'; text: string; owner: number | null; months: number; busy: boolean } | null>(null);
  openEditor(n: CortexApiNode, mode: 'write' | 'reject' | 'owner' = 'write') { this.editing.set({ node: n, mode, text: mode === 'write' ? (n.summary ?? '') : '', owner: n.ownerUserId, months: 6, busy: false }); }
  closeEditor() { this.editing.set(null); }
  patchEditor(p: Partial<{ text: string; owner: number | null; months: number }>) { const ed = this.editing(); if (ed) this.editing.set({ ...ed, ...p }); }
  private done(msg: string) { this.snack.open(msg, undefined, { duration: 2500 }); this.closeEditor(); this.loadGraph(); if (this.view() === 'work') this.loadChanges(); }
  private fail(e: any, fallback: string) { const ed = this.editing(); if (ed) this.editing.set({ ...ed, busy: false }); this.snack.open(e?.error?.message ?? fallback, 'OK', { duration: 4000 }); }
  saveEditor() {
    const ed = this.editing(); if (!ed || ed.busy) return;
    if (ed.mode === 'owner') { this.applyWithOwner(); return; }
    this.editing.set({ ...ed, busy: true });
    if (ed.mode === 'reject') {
      if (!ed.text.trim()) { this.fail(null, 'A reason is needed so Welly learns from it'); return; }
      this.api.cortexReject(ed.node.key, ed.text.trim()).subscribe({ next: () => this.done('Rejected'), error: e => this.fail(e, 'Could not reject') });
      return;
    }
    const owner = this.catalog()?.users.find(u => u.id === ed.owner);
    const due = new Date(); due.setMonth(due.getMonth() + ed.months);
    this.api.cortexCurate(ed.node.key, { summary: ed.text, ownerUserId: ed.owner, ownerLabel: owner?.name ?? null, reviewDueAt: due.toISOString() })
      .subscribe({ next: () => this.done('Saved'), error: e => this.fail(e, 'Not allowed') });
  }
  reviewAccept(n: CortexApiNode) { this.api.cortexAccept(n.key).subscribe({ next: () => this.done('Confirmed'), error: e => this.fail(e, 'Could not confirm') }); }
  reviewReject(n: CortexApiNode) { this.openEditor(n, 'reject'); }
  curate(n: CortexApiNode) { this.openEditor(n, 'write'); }

  /** Welly Fix. Parsed suggestion data: kind, payload and (once applied) the fix receipt with before/after. */
  fixData(s: CortexApiNode | null): { kind: string; payload: any; fix: { appliedAt: string; appliedBy: string; before: any; after: any; measureAfterAt: string | null; change: any } | null } | null {
    if (!s?.data) return null;
    try { const d = JSON.parse(s.data); return { kind: d.kind ?? '', payload: d.payload ?? {}, fix: d.fix ?? null }; } catch { return null; }
  }
  /** Whether Welly can carry this suggestion out by itself (others need a person). */
  canApply(s: CortexApiNode | null) { const d = this.fixData(s); return !!d && s!.status !== 'applied' && s!.status !== 'rejected' && (d.kind === 'update_step' || d.kind === 'set_owner'); }
  applyBusy = signal<string | null>(null);
  applyFix(s: CortexApiNode) {
    if (this.applyBusy()) return;
    const d = this.fixData(s);
    let owner: number | null = null;
    if (d?.kind === 'set_owner') {
      // the suggested name may not match one account; let the person pick from the catalog when needed
      const name = (d.payload?.suggestedOwner ?? '') as string;
      const hit = this.catalog()?.users.filter(u => u.name.toLowerCase() === name.toLowerCase()) ?? [];
      owner = hit.length === 1 ? hit[0].id : null;
      if (owner == null) { this.openEditor(s, 'owner'); return; }
    }
    this.applyBusy.set(s.key);
    this.api.cortexApply(s.key, owner).subscribe({
      next: r => { this.applyBusy.set(null); this.done(r?.message ?? 'Applied'); },
      error: e => { this.applyBusy.set(null); this.fail(e, 'Could not apply'); }
    });
  }
  applyWithOwner() {
    const ed = this.editing(); if (!ed || ed.mode !== 'owner' || !ed.owner) return;
    this.editing.set({ ...ed, busy: true });
    this.api.cortexApply(ed.node.key, ed.owner).subscribe({ next: r => this.done(r?.message ?? 'Applied'), error: e => this.fail(e, 'Could not apply') });
  }
  /** Short before → after line for an applied step fix. */
  fixVerdict(s: CortexApiNode | null) {
    const f = this.fixData(s)?.fix; if (!f) return null;
    const b = f.before?.median, a = f.after?.median;
    if (!f.after) return f.measureAfterAt ? `Before: median ${this.hrs(b)} · p90 ${this.hrs(f.before?.p90)} · ${f.before?.queue ?? 0} open. Welly measures again on ${new Date(f.measureAfterAt).toLocaleDateString()}.` : `Applied by ${f.appliedBy}.`;
    if (b == null || a == null) return `After ${14} days: not enough tasks to compare yet (${f.after?.samples ?? 0} completed).`;
    return `Median wait ${this.hrs(b)} → ${this.hrs(a)} (${a < b ? 'better' : a > b ? 'worse' : 'no change'}) · p90 ${this.hrs(f.before?.p90)} → ${this.hrs(f.after?.p90)} · ${f.after?.samples} tasks since.`;
  }

  /** Welly inferences waiting for a decision, newest evidence first. */
  pendingInferences = computed(() => (this.graph()?.nodes ?? []).filter(n => n.provenance === 'inferred' && n.status === 'pending' && n.type !== 'suggestion').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

  // ── Work view: everything the graph knows, as plain lists ─────────────────────

  /** 'brain' = Welly at the centre in 3D; 'map' = the flat picture; 'work' = gaps, hand-offs, Welly items and the change feed as lists. */
  view = signal<'brain' | 'map' | 'work'>((localStorage.getItem('cortex.view') as any) || 'brain');
  changes = signal<any[]>([]);
  changesBusy = signal(false);
  setView(v: 'brain' | 'map' | 'work') {
    this.view.set(v); if (v !== 'work') localStorage.setItem('cortex.view', v);
    if (v === 'work' && !this.changes().length) this.loadChanges();
  }

  // ── Brain view: what the 3D scene is fed ──────────────────────────────────

  brainNodes = computed<BrainNode[]>(() => this.allNodes().map(n => {
    const d = n.layer === 'dept' ? this.deptNodes().find(x => x.key === n.key) : null;
    return { ...n, people: d?.people.length, mapped: d ? d.people.filter(p => p.flows.length).length : undefined, flows: this.flowsOf(n.key).length, runs: this.activeRuns(n.key), gaps: this.apiGapsOf(n.key).length + this.gapsOf(n.key).filter(g => !this.gapCovered(g)).length };
  }));
  brainEdges = computed<BrainEdge[]>(() => this.edges().map(e => ({ from: e.from, to: e.to, label: e.label, how: e.how })));
  brainStream = computed<string[] | null>(() => this.streamPath()?.order ?? null);
  /** Selection from the 3D scene: same inspector as the flat map. */
  brainSelect(k: string | null) { this.selected.set(k); }
  brainDive(k: string) { this.selected.set(k); if (k.startsWith('d:')) this.zoom.set(3); }
  loadChanges() {
    this.changesBusy.set(true);
    this.api.cortexChanges({ take: 60 }).subscribe({ next: c => { this.changes.set(c ?? []); this.changesBusy.set(false); }, error: () => this.changesBusy.set(false) });
  }
  readonly gapKinds: Record<string, { label: string; icon: string; blurb: string; means: string; youDo: string; after: string }> = {
    not_built: { label: 'Hand-off not built', icon: 'link_off',
      blurb: 'Two modules pass work between them, but no code carries it.',
      means: 'Someone finishes something in one module and a person in another module has to notice and re-type it. That is where things get forgotten.',
      youDo: 'Tell me which one matters most. Each is a feature I build; once built the row turns green here and disappears from this list.',
      after: 'The receiving team gets the work automatically, with the details already filled in.' },
    no_owner: { label: 'Nobody owns it', icon: 'person_off',
      blurb: 'A module, process or department with no accountable person.',
      means: 'If this breaks or needs a decision, there is nobody to ask. Reminders and Welly suggestions have nowhere to go.',
      youDo: 'For a module: grant that permission to the person who really does the work (Users → edit → modules). For a process: open it in Flows and set an owner. For a department: set its manager.',
      after: 'The owner shows on the node, gets review reminders, and can press "Write it" on its knowledge slot.' },
    uncaptured: { label: 'Work not captured', icon: 'visibility_off',
      blurb: 'A team exists but none of its work is on the map.',
      means: 'People are employed in this department but the intranet has no idea what they do all day. Nothing can be measured, handed off or covered for them.',
      youDo: 'Press "Map their day". You get a blank human flow for that team: list the things they do, who does them and roughly how long each waits. 15 minutes with the team lead.',
      after: 'The department lights up on the map with a flow; its people show as "mapped"; the gap closes on the next rebuild.' },
    data_quality: { label: 'Data needs cleaning', icon: 'cleaning_services',
      blurb: 'Duplicates or broken records that make the map lie.',
      means: 'Two records for one real thing (e.g. "Finance" and "Finance Department") split the same people, permissions and flows, so counts and owners are wrong everywhere.',
      youDo: 'Say which name survives. I merge them with a script that re-points every table and keeps history. Nothing is deleted.',
      after: 'One department, correct counts, one manager. The loser record is retired and points at the survivor.' },
    no_events: { label: 'Process never ran', icon: 'play_disabled',
      blurb: 'Enabled in Flows, but nothing has ever passed through it.',
      means: 'This was designed but never used. Either the work is real and nobody starts the flow, or the flow is clutter. Until it runs it does not count as coverage.',
      youDo: 'If the team does this work: open it and press Start the next time it happens. If nobody does it this way: press "Switch off" — it stays saved, just not counted. You can switch it back on any time.',
      after: 'Switched-off processes drop out of this list and out of the coverage %. Running ones start collecting waits and Welly findings.' },
    overdue: { label: 'Review overdue', icon: 'history',
      blurb: 'Written knowledge past its review date.',
      means: 'Someone wrote this down months ago and nobody has confirmed it is still true.',
      youDo: 'Open it, read it, press Update (change what is wrong, or just re-save to confirm). Pick a new review period.',
      after: 'The review date moves forward and the reminder stops.' },
  };
  gapGroups = computed(() => {
    const by = new Map<string, CortexApiGap[]>();
    for (const g of this.apiGaps()) { const k = g.kind || 'other'; if (!by.has(k)) by.set(k, []); by.get(k)!.push(g); }
    const order = ['not_built', 'data_quality', 'no_owner', 'uncaptured', 'overdue', 'no_events'];
    return [...by.entries()].sort((a, b) => (order.indexOf(a[0]) + 99) % 99 - (order.indexOf(b[0]) + 99) % 99)
      .map(([kind, gaps]) => ({ kind, meta: this.gapKinds[kind] ?? { label: kind, icon: 'build_circle', blurb: '', means: '', youDo: '', after: '' }, gaps: gaps.sort((x, y) => x.priority - y.priority || x.label.localeCompare(y.label)) }));
  });
  /** Which group's "what does this mean" box is open. */
  explain = signal<string | null>(null);
  /** The Flows definition a gap points at (gap.on = 'flow:ID'). */
  gapFlow(g: CortexApiGap): FlowDefinition | null { const m = /^flow:(\d+)$/.exec(g.on ?? ''); return m ? this.flows().find(f => f.id === +m[1]) ?? null : null; }
  /** The department node a gap points at (gap.on = 'dept:ID'). */
  gapDept(g: CortexApiGap) { const m = /^dept:(\d+)$/.exec(g.on ?? ''); return m ? this.deptNodes().find(d => d.key === 'd:' + m[1]) ?? null : null; }
  busyGap = signal<string | null>(null);
  /** "Switch off": disable a never-run process so it stops counting. Reversible in Flows. */
  switchOff(g: CortexApiGap) {
    const f = this.gapFlow(g); if (!f || this.busyGap()) return;
    this.busyGap.set(g.key);
    this.api.toggle(f.id).subscribe({
      next: r => { this.busyGap.set(null); this.snack.open(`${f.name} switched ${r.isEnabled ? 'on' : 'off'}. It is kept, just not counted.`, 'OK', { duration: 4000 }); this.flowsChanged.emit(); this.rebuildGraph(); },
      error: e => { this.busyGap.set(null); this.snack.open(e?.error?.message ?? 'Could not switch off', 'OK', { duration: 4000 }); }
    });
  }
  /** "Map their day": a blank human flow for the team the gap points at. */
  mapDay(g: CortexApiGap) { const d = this.gapDept(g); if (d) this.newHumanFlow.emit({ dept: d.deptName, owner: null }); }
  /** Write a blank slot straight from the Work view: select its node on the map and open the editor. */
  writeSlot(b: { n: CortexApiNode; on?: CortexApiNode }) { this.showOnMap(b.on?.key); this.openEditor(b.n, 'write'); }
  /** Every module-to-module hand-off the server graph knows, with how it is carried. */
  handoffRows = computed(() => {
    const g = this.graph(); if (!g) return [];
    const byKey = this.apiByKey();
    return g.edges.filter(e => e.relation === 'handoff' || e.relation.startsWith('handoff#'))
      .map(e => ({ e, from: byKey.get(e.from), to: byKey.get(e.to), how: e.handoff ?? 'manual' }))
      .filter(r => r.from && r.to)
      .sort((a, b) => ['gap', 'manual', 'read', 'automatic'].indexOf(a.how) - ['gap', 'manual', 'read', 'automatic'].indexOf(b.how) || a.from!.label.localeCompare(b.from!.label));
  });
  handoffCounts = computed(() => this.graph()?.counts.handoffs ?? {});
  hoCount(k: string): number { return (this.handoffCounts() as Record<string, number | undefined>)[k] ?? 0; }
  /** Applied Welly fixes, newest first. */
  appliedFixes = computed(() => (this.graph()?.nodes ?? []).filter(n => n.type === 'suggestion' && n.status === 'applied').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  /** Blank knowledge slots grouped by what they are attached to, department heads first. */
  blankSlots = computed(() => {
    const nodes = this.graph()?.nodes ?? []; const byKey = this.apiByKey();
    const rows = nodes.filter(n => n.empty && n.provenance === 'curated').map(n => ({ n, on: n.parent ? byKey.get(n.parent) : undefined }));
    const rank = (t?: string) => t === 'department' ? 0 : t === 'role' ? 1 : t === 'process' ? 2 : t === 'module' ? 3 : 4;
    return rows.sort((a, b) => rank(a.on?.type) - rank(b.on?.type) || (a.on?.label ?? '').localeCompare(b.on?.label ?? ''));
  });
  changeKindLabel(k: string) {
    return ({ create: 'added', update: 'updated', deactivate: 'retired', reactivate: 'back', curate: 'written', accept: 'confirmed', reject: 'rejected', rebuild: 'rebuilt', reminded: 'reminder sent', tasked: 'to-do raised', applied: 'Welly fixed', fixed: 'fix applied', measured: 'measured after' } as Record<string, string>)[k] ?? k;
  }
  /** Jump from the Work view to the node on the map. Accepts a server key or a map key. */
  showOnMap(key: string | null | undefined) {
    const k = key && this.byKey().has(key) ? key : this.mapKeyFor(key ?? null);
    if (this.view() === 'work') this.view.set(localStorage.getItem('cortex.view') === 'map' ? 'map' : 'brain');
    if (k) { this.selected.set(k); if (this.view() === 'map') { if (k.startsWith('d:') && this.zoom() === 1) this.setZoom(2); setTimeout(() => this.focusNode(k, 1.8), 30); } }
  }
  blankLimit = signal(40);
  apiByKeyPublic = computed(() => this.apiByKey());
  howLabelAny(h: string) { return h === 'automatic' || h === 'code' ? 'Automatic' : h === 'manual' ? 'Someone acts' : h === 'read' ? 'Read only' : h === 'gap' ? 'Not built' : h; }
  /** Measured wait on the hand-off into a step (from FlowTasks), if any. */
  stepEdgesOf(key: string) {
    const k = this.apiKey(key); if (!k) return [];
    const g = this.graph(); if (!g) return [];
    return g.edges.filter(e => e.relation === 'handoff' && e.metricsAt && (e.to.startsWith(k + ':step:') || e.from.startsWith(k + ':step:')))
      .map(e => ({ edge: e, step: this.apiByKey().get(e.to) ?? null }))
      .filter(x => x.step).sort((a, b) => (b.edge.dwellMedianHours ?? 0) - (a.edge.dwellMedianHours ?? 0)).slice(0, 6);
  }
  hrs(h: number | null | undefined) { return h == null ? '–' : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(h < 10 ? 1 : 0)} h` : `${(h / 24).toFixed(1)} d`; }
  inferenceTarget(n: CortexApiNode) { return this.mapKeyFor(n.parent); }

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

  allNodes = computed<CortexNode[]>(() => [...CORTEX_NODES, ...this.deptNodes()].map(n => { const p = this.pos().get(n.key); return p ? { ...n, x: p.x, y: p.y } : n; }));
  private byKey = computed(() => new Map(this.allNodes().map(n => [n.key, n])));
  node = computed(() => this.byKey().get(this.selected() ?? '') ?? null);
  dept = computed(() => { const d = this.deptNodes().find(d => d.key === this.selected()); if (!d) return null; const p = this.pos().get(d.key); return p ? { ...d, x: p.x, y: p.y } : d; });

  // ── camera: pan, zoom, fly-to; node dragging ──────────────────────────────

  static readonly W = 1200; static readonly H = 690;
  /** Camera: top-left of the view in map units and zoom factor (1 = whole map). */
  cam = signal<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  viewBox = computed(() => { const c = this.cam(); return `${c.x} ${c.y} ${FlowCortexComponent.W / c.k} ${FlowCortexComponent.H / c.k}`; });
  /** Dragged node positions, remembered per browser. */
  pos = signal<Map<string, { x: number; y: number }>>(this.loadPos());
  private loadPos() { try { return new Map<string, { x: number; y: number }>(Object.entries(JSON.parse(localStorage.getItem('cortex.pos') ?? '{}'))); } catch { return new Map(); } }
  private savePos() { localStorage.setItem('cortex.pos', JSON.stringify(Object.fromEntries(this.pos()))); }
  resetLayout() { this.pos.set(new Map()); localStorage.removeItem('cortex.pos'); this.fit(); }
  hasCustomLayout = computed(() => this.pos().size > 0);

  private svgRef = viewChild<ElementRef<SVGSVGElement>>('cxsvg');
  private svgEl: SVGSVGElement | null = null;
  private _svgSync = effect(() => { this.svgEl = this.svgRef()?.nativeElement ?? null; });
  private drag: { kind: 'pan' | 'node'; key?: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  private camAnim: number | null = null;

  /** Client → map coordinates through the SVG's current transform. */
  private toMap(ev: { clientX: number; clientY: number }) {
    const svg = this.svgEl; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
    const m = svg.getScreenCTM(); if (!m) return { x: 0, y: 0 };
    const p = pt.matrixTransform(m.inverse()); return { x: p.x, y: p.y };
  }
  private clampCam(c: { x: number; y: number; k: number }) {
    const k = Math.min(6, Math.max(0.6, c.k));
    const w = FlowCortexComponent.W / k, h = FlowCortexComponent.H / k, pad = 200;
    return { k, x: Math.min(FlowCortexComponent.W - w + pad, Math.max(-pad, c.x)), y: Math.min(FlowCortexComponent.H - h + pad, Math.max(-pad, c.y)) };
  }
  private stopAnim() { if (this.camAnim != null) { cancelAnimationFrame(this.camAnim); this.camAnim = null; } }
  /** Ease the camera to a target over ~350 ms. */
  private flyTo(target: { x: number; y: number; k: number }, ms = 350) {
    this.stopAnim();
    const from = this.cam(), to = this.clampCam(target), t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      this.cam.set({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e });
      if (p < 1) this.camAnim = requestAnimationFrame(step); else this.camAnim = null;
    };
    this.camAnim = requestAnimationFrame(step);
  }
  fit() { this.flyTo({ x: 0, y: 0, k: 1 }); }
  /** Zoom in/out keeping a map point fixed under the cursor (or the centre). */
  zoomBy(factor: number, at?: { x: number; y: number }) {
    const c = this.cam(); const k = Math.min(6, Math.max(0.6, c.k * factor));
    const cx = at?.x ?? c.x + FlowCortexComponent.W / c.k / 2, cy = at?.y ?? c.y + FlowCortexComponent.H / c.k / 2;
    const nx = cx - (cx - c.x) * (c.k / k), ny = cy - (cy - c.y) * (c.k / k);
    at ? this.cam.set(this.clampCam({ x: nx, y: ny, k })) : this.flyTo({ x: nx, y: ny, k }, 200);
  }
  /** Centre a node and zoom in on it. */
  focusNode(key: string, k = 2.2) {
    const n = this.byKey().get(key); if (!n) return;
    this.flyTo({ x: n.x - FlowCortexComponent.W / k / 2, y: n.y - FlowCortexComponent.H / k / 2 + (n.layer === 'dept' && this.zoom() === 3 ? 40 : 0), k });
  }
  onWheel(ev: WheelEvent) { ev.preventDefault(); this.stopAnim(); this.zoomBy(ev.deltaY < 0 ? 1.15 : 1 / 1.15, this.toMap(ev)); }
  onPointerDown(ev: PointerEvent, nodeKey?: string) {
    if (ev.button !== 0) return;
    this.stopAnim();
    const p = this.toMap(ev);
    if (nodeKey) { const n = this.byKey().get(nodeKey); if (!n) return; this.drag = { kind: 'node', key: nodeKey, sx: p.x, sy: p.y, ox: n.x, oy: n.y, moved: false }; }
    else { const c = this.cam(); this.drag = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, ox: c.x, oy: c.y, moved: false }; }
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
    ev.stopPropagation();
  }
  onPointerMove(ev: PointerEvent) {
    const d = this.drag; if (!d) return;
    if (d.kind === 'pan') {
      const c = this.cam(); const svg = this.svgEl; if (!svg) return;
      const r = svg.getBoundingClientRect(); const scale = Math.min(r.width / (FlowCortexComponent.W / c.k), r.height / (FlowCortexComponent.H / c.k));
      const dx = (ev.clientX - d.sx) / scale, dy = (ev.clientY - d.sy) / scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
      this.cam.set(this.clampCam({ x: d.ox - dx, y: d.oy - dy, k: c.k }));
    } else {
      const p = this.toMap(ev); const dx = p.x - d.sx, dy = p.y - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      if (!d.moved) return;
      const m = new Map(this.pos()); m.set(d.key!, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) }); this.pos.set(m);
    }
  }
  onPointerUp(ev: PointerEvent, nodeKey?: string) {
    const d = this.drag; this.drag = null;
    if (!d) return;
    if (d.kind === 'node') { if (d.moved) this.savePos(); else if (nodeKey) this.select(nodeKey); }
    else if (!d.moved) this.selected.set(null);
  }
  dragging = () => this.drag?.kind === 'node' ? this.drag.key ?? null : null;
  isPanning = () => this.drag?.kind === 'pan' && this.drag.moved;
  onKey(ev: KeyboardEvent) {
    if ((ev.target as HTMLElement)?.tagName === 'INPUT' || (ev.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    if (ev.key === '+' || ev.key === '=') this.zoomBy(1.3); else if (ev.key === '-') this.zoomBy(1 / 1.3); else if (ev.key === '0') this.fit();
    else if (ev.key === 'Escape') { this.selected.set(null); this.stream.set(null); }
  }

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

  select(key: string | null) { this.selected.set(this.selected() === key && this.zoom() !== 3 ? null : key); }
  /** Double-click: fly into the node; on a department also open its people. */
  dive(key: string) {
    this.selected.set(key);
    if (key.startsWith('d:')) { if (this.zoom() !== 3) this.setZoom(3); this.focusNode(key, 2.4); } else this.focusNode(key, 2.2);
  }
  pick(r: { node: string }) { this.selected.set(r.node); this.query.set(''); this.focusNode(r.node, 1.8); }
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
