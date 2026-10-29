import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { FlowCatalog, FlowStep, FlowStepType, FlowTriggerType } from '../../services/flows.service';
import { FlowPortKey, STEP_COLOR, assigneeLabel, getTarget, makeStep, outPorts, relinkAll, setTarget, uniqueStepId } from './flow-step-factory';

/** Payload carried by a palette drag (HTML5 DnD, JSON in dataTransfer). */
export interface PaletteDrag {
  kind: 'step' | 'user' | 'department' | 'role' | 'action' | 'event' | 'dataSource' | 'manual';
  type?: FlowStepType; id?: number; name?: string; key?: string;
}

export interface TriggerDrop { kind: 'event' | 'dataSource' | 'manual'; key?: string; }

interface Edge { from: string; port: FlowPortKey; to: string; path: string; mx: number; my: number; id: string; }

export const TRIGGER_NODE_ID = '__trigger__';
const NODE_W = 230;
const HEAD_H = 40;
const META_H = 22;
const PORT_H = 22;

/**
 * n8n-style node canvas bound directly to a FlowStep[] graph. Mutates the array in place and emits
 * `changed` so the host can re-derive state. Positions are persisted on step.x / step.y.
 */
@Component({
  selector: 'app-flow-canvas',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule, MatButtonModule],
  templateUrl: './flow-canvas.component.html',
  styleUrls: ['./flow-canvas.component.scss']
})
export class FlowCanvasComponent {
  @Input({ required: true }) steps: FlowStep[] = [];
  @Input() startStepId: string | null = null;
  @Input({ required: true }) catalog!: FlowCatalog;
  @Input() triggerType: FlowTriggerType = 'manual';
  @Input() triggerLabel = '';
  @Input() selectedId: string | null = null;
  /** Optional run overlay: stepId → 'done' | 'current' | 'failed' | 'waiting'. */
  @Input() highlight: Record<string, string> | null = null;
  @Input() readonly = false;

  @Output() selectedIdChange = new EventEmitter<string | null>();
  @Output() startStepIdChange = new EventEmitter<string | null>();
  @Output() changed = new EventEmitter<void>();
  @Output() triggerDrop = new EventEmitter<TriggerDrop>();

  @ViewChild('viewport', { static: true }) viewport!: ElementRef<HTMLDivElement>;

  pan = { x: 40, y: 40 };
  zoom = 1;
  readonly NODE_W = NODE_W;
  readonly colors = STEP_COLOR;

  // interaction state
  private dragNode: { id: string; ox: number; oy: number } | null = null;
  private panning: { sx: number; sy: number; px: number; py: number } | null = null;
  linking = signal<{ from: string; port: FlowPortKey; x: number; y: number; path: string } | null>(null);
  selectedEdge = signal<string | null>(null);
  quickAdd = signal<{ x: number; y: number; wx: number; wy: number; from?: { id: string; port: FlowPortKey } } | null>(null);
  hoverNode: string | null = null;
  private moved = false;

  // ── geometry ──
  ports(s: FlowStep) { return outPorts(s.type); }
  nodeHeight(s: FlowStep) { return HEAD_H + META_H + this.ports(s).length * PORT_H + 8; }
  outPortPos(s: FlowStep, i: number) { return { x: (s.x ?? 0) + NODE_W, y: (s.y ?? 0) + HEAD_H + META_H + i * PORT_H + PORT_H / 2 }; }
  inPortPos(s: FlowStep) { return { x: s.x ?? 0, y: (s.y ?? 0) + HEAD_H / 2 }; }
  trigger() {
    const start = this.steps.find(s => s.id === this.startStepId) ?? this.steps[0];
    return { x: (start?.x ?? 300) - 300, y: start?.y ?? 40 };
  }
  triggerOutPos() { const t = this.trigger(); return { x: t.x + NODE_W, y: t.y + HEAD_H / 2 }; }
  triggerIcon() { return this.triggerType === 'event' ? 'bolt' : this.triggerType === 'schedule' ? 'schedule' : 'touch_app'; }

  private bezier(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }

  edges(): Edge[] {
    const out: Edge[] = [];
    const byId = new Map(this.steps.map(s => [s.id, s]));
    const start = byId.get(this.startStepId ?? '');
    if (start) {
      const a = this.triggerOutPos(), b = this.inPortPos(start);
      out.push({ from: TRIGGER_NODE_ID, port: 'next', to: start.id, path: this.bezier(a, b), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, id: `${TRIGGER_NODE_ID}:next` });
    }
    for (const s of this.steps) {
      this.ports(s).forEach((p, i) => {
        const to = getTarget(s, p.key); const t = to ? byId.get(to) : null;
        if (!t) return;
        const a = this.outPortPos(s, i), b = this.inPortPos(t);
        out.push({ from: s.id, port: p.key, to: t.id, path: this.bezier(a, b), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, id: `${s.id}:${p.key}` });
      });
    }
    return out;
  }

  stepType(t: FlowStepType) { return this.catalog.stepTypes.find(x => x.type === t); }
  meta(s: FlowStep): string {
    const c = s.config || {};
    switch (s.type) {
      case 'task': case 'approval': return assigneeLabel(c['assignTo'], this.catalog) || 'Whoever started it';
      case 'notify': return assigneeLabel(c['to'], this.catalog) || 'Nobody selected';
      case 'email': return c['to'] || 'No recipient';
      case 'condition': return c['expression'] || 'No expression yet';
      case 'ai_analyze': return `Welly → ${c['outputKey'] || 'ai'}`;
      case 'welly_action': return c['action'] || 'Pick an action';
      case 'set': return c['key'] ? `vars.${c['key']}` : 'Set a variable';
      case 'wait': return c['hours'] ? `${c['hours']} h` : c['minutes'] ? `${c['minutes']} min` : 'Wait';
      case 'end': return c['outcome'] || 'completed';
    }
  }
  isDangling(s: FlowStep, key: FlowPortKey) { return s.type !== 'end' && !getTarget(s, key); }
  stateOf(id: string) { return this.highlight?.[id] ?? ''; }

  // ── coordinate helpers ──
  toWorld(clientX: number, clientY: number) {
    const r = this.viewport.nativeElement.getBoundingClientRect();
    return { x: (clientX - r.left - this.pan.x) / this.zoom, y: (clientY - r.top - this.pan.y) / this.zoom };
  }

  // ── selection ──
  select(id: string | null, ev?: MouseEvent) {
    ev?.stopPropagation();
    this.selectedEdge.set(null);
    this.selectedId = id; this.selectedIdChange.emit(id);
  }
  selectEdge(e: Edge, ev: MouseEvent) { ev.stopPropagation(); this.selectedEdge.set(e.id); this.select(null); this.selectedEdge.set(e.id); }
  removeEdge(e: Edge) {
    if (e.from === TRIGGER_NODE_ID) { this.startStepId = null; this.startStepIdChange.emit(null); }
    else { const s = this.steps.find(x => x.id === e.from); if (s) setTarget(s, e.port, null); }
    this.selectedEdge.set(null); this.changed.emit();
  }

  // ── mouse: pan / drag / link ──
  onBgDown(ev: MouseEvent) {
    if (ev.button !== 0) return;
    this.quickAdd.set(null);
    this.panning = { sx: ev.clientX, sy: ev.clientY, px: this.pan.x, py: this.pan.y }; this.moved = false;
  }
  onNodeDown(ev: MouseEvent, s: FlowStep) {
    if (ev.button !== 0 || this.readonly) return;
    ev.stopPropagation();
    const w = this.toWorld(ev.clientX, ev.clientY);
    this.dragNode = { id: s.id, ox: w.x - (s.x ?? 0), oy: w.y - (s.y ?? 0) }; this.moved = false;
    this.select(s.id);
  }
  onPortDown(ev: MouseEvent, from: string, port: FlowPortKey, i: number) {
    if (this.readonly) return;
    ev.stopPropagation(); ev.preventDefault();
    const s = this.steps.find(x => x.id === from);
    const a = from === TRIGGER_NODE_ID ? this.triggerOutPos() : this.outPortPos(s!, i);
    this.linking.set({ from, port, x: a.x, y: a.y, path: this.bezier(a, a) });
  }

  @HostListener('window:mousemove', ['$event'])
  onMove(ev: MouseEvent) {
    if (this.panning) {
      this.pan = { x: this.panning.px + (ev.clientX - this.panning.sx), y: this.panning.py + (ev.clientY - this.panning.sy) }; this.moved = true; return;
    }
    if (this.dragNode) {
      const s = this.steps.find(x => x.id === this.dragNode!.id); if (!s) return;
      const w = this.toWorld(ev.clientX, ev.clientY);
      s.x = Math.round((w.x - this.dragNode.ox) / 10) * 10; s.y = Math.round((w.y - this.dragNode.oy) / 10) * 10; this.moved = true; return;
    }
    const l = this.linking();
    if (l) {
      const w = this.toWorld(ev.clientX, ev.clientY);
      this.linking.set({ ...l, path: this.bezier({ x: l.x, y: l.y }, w) });
    }
  }

  @HostListener('window:mouseup', ['$event'])
  onUp(ev: MouseEvent) {
    if (this.panning) { if (!this.moved) { this.select(null); this.selectedEdge.set(null); } this.panning = null; }
    if (this.dragNode) { if (this.moved) this.changed.emit(); this.dragNode = null; }
    const l = this.linking();
    if (l) {
      this.linking.set(null);
      const target = this.hoverNode;
      if (target && target !== l.from) this.connect(l.from, l.port, target);
      else if (!target) {
        // dropped on empty canvas → offer to create a connected step right there
        const r = this.viewport.nativeElement.getBoundingClientRect();
        const w = this.toWorld(ev.clientX, ev.clientY);
        if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom)
          this.quickAdd.set({ x: ev.clientX - r.left, y: ev.clientY - r.top, wx: w.x, wy: w.y - HEAD_H / 2, from: { id: l.from, port: l.port } });
      }
    }
  }

  connect(from: string, port: FlowPortKey, to: string) {
    if (from === TRIGGER_NODE_ID) { this.startStepId = to; this.startStepIdChange.emit(to); }
    else { const s = this.steps.find(x => x.id === from); if (s) setTarget(s, port, to); }
    this.changed.emit();
  }

  onWheel(ev: WheelEvent) {
    ev.preventDefault();
    const r = this.viewport.nativeElement.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const nz = Math.min(2, Math.max(0.3, this.zoom * (ev.deltaY < 0 ? 1.1 : 0.9)));
    this.pan = { x: mx - (mx - this.pan.x) * (nz / this.zoom), y: my - (my - this.pan.y) * (nz / this.zoom) };
    this.zoom = nz;
  }
  zoomBy(f: number) { this.zoom = Math.min(2, Math.max(0.3, this.zoom * f)); }
  fit() {
    const el = this.viewport.nativeElement; if (!el.clientWidth) return;
    const t = this.trigger();
    const xs = [t.x, ...this.steps.map(s => s.x ?? 0)], ys = [t.y, ...this.steps.map(s => s.y ?? 0)];
    const minX = Math.min(...xs) - 40, minY = Math.min(...ys) - 40;
    const maxX = Math.max(...xs) + NODE_W + 40, maxY = Math.max(...ys.map((y, i) => y + (i === 0 ? 80 : this.nodeHeight(this.steps[i - 1])))) + 40;
    const z = Math.min(1.25, Math.max(0.3, Math.min(el.clientWidth / (maxX - minX), el.clientHeight / (maxY - minY))));
    this.zoom = z;
    this.pan = { x: (el.clientWidth - (maxX - minX) * z) / 2 - minX * z, y: (el.clientHeight - (maxY - minY) * z) / 2 - minY * z };
  }

  @HostListener('window:keydown', ['$event'])
  onKey(ev: KeyboardEvent) {
    if (this.readonly) return;
    const tag = (ev.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (ev.target as HTMLElement)?.isContentEditable) return;
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      const edge = this.selectedEdge();
      if (edge) { const e = this.edges().find(x => x.id === edge); if (e) this.removeEdge(e); ev.preventDefault(); return; }
      if (this.selectedId && this.selectedId !== TRIGGER_NODE_ID) { this.removeStep(this.selectedId); ev.preventDefault(); }
    }
    if (ev.key === 'Escape') { this.quickAdd.set(null); this.linking.set(null); }
  }

  // ── graph mutations ──
  addStep(type: FlowStepType, x: number, y: number, preset?: Record<string, any>, from?: { id: string; port: FlowPortKey }, name?: string): FlowStep {
    const id = uniqueStepId(type, this.steps);
    const step = makeStep(type, id, name ?? (this.stepType(type)?.name ?? type), preset);
    step.x = Math.round(x / 10) * 10; step.y = Math.round(y / 10) * 10;
    this.steps.push(step);
    if (from) this.connect(from.id, from.port, id);
    else if (!this.startStepId) { this.startStepId = id; this.startStepIdChange.emit(id); }
    this.quickAdd.set(null);
    this.select(id); this.changed.emit();
    return step;
  }
  quickAddPick(type: FlowStepType) { const q = this.quickAdd(); if (q) this.addStep(type, q.wx, q.wy, undefined, q.from); }

  removeStep(id: string) {
    const i = this.steps.findIndex(s => s.id === id); if (i < 0) return;
    const [s] = this.steps.splice(i, 1);
    relinkAll(this.steps, s.id, s.nextStepId ?? null);
    if (this.startStepId === s.id) { this.startStepId = s.nextStepId ?? this.steps[0]?.id ?? null; this.startStepIdChange.emit(this.startStepId); }
    if (this.selectedId === id) this.select(null);
    this.changed.emit();
  }

  duplicate(s: FlowStep) {
    const copy = JSON.parse(JSON.stringify(s)) as FlowStep;
    copy.id = uniqueStepId(s.type, this.steps); copy.name = `${s.name || s.id} (copy)`; copy.nextStepId = null;
    for (const k of ['trueStepId', 'falseStepId', 'approvedStepId', 'rejectedStepId']) if (k in copy.config) copy.config[k] = null;
    copy.x = (s.x ?? 0) + 40; copy.y = (s.y ?? 0) + this.nodeHeight(s) + 30;
    this.steps.push(copy); this.select(copy.id); this.changed.emit();
  }

  /** Layered left-to-right layout from the start step (BFS), unreached steps parked below. */
  autoLayout() {
    const byId = new Map(this.steps.map(s => [s.id, s]));
    const layer = new Map<string, number>();
    const queue: string[] = [];
    if (this.startStepId && byId.has(this.startStepId)) { layer.set(this.startStepId, 0); queue.push(this.startStepId); }
    while (queue.length) {
      const id = queue.shift()!; const s = byId.get(id)!; const d = layer.get(id)!;
      for (const p of this.ports(s)) { const t = getTarget(s, p.key); if (t && byId.has(t) && !layer.has(t)) { layer.set(t, d + 1); queue.push(t); } }
    }
    const columns = new Map<number, FlowStep[]>();
    for (const s of this.steps) { const d = layer.get(s.id); if (d !== undefined) (columns.get(d) ?? columns.set(d, []).get(d)!).push(s); }
    let maxBottom = 0;
    for (const [d, col] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
      let y = 40;
      for (const s of col) { s.x = 40 + d * (NODE_W + 90); s.y = y; y += this.nodeHeight(s) + 40; }
      maxBottom = Math.max(maxBottom, y);
    }
    let x = 40;
    for (const s of this.steps) if (!layer.has(s.id)) { s.x = x; s.y = maxBottom + 60; x += NODE_W + 40; }
    this.changed.emit();
    setTimeout(() => this.fit());
  }

  /** Assign x/y to any step that has none (legacy flows authored in the list editor). */
  ensurePositions() {
    if (this.steps.every(s => typeof s.x === 'number' && typeof s.y === 'number')) return false;
    this.autoLayout(); return true;
  }

  // ── palette drag & drop (HTML5) ──
  onDragOver(ev: DragEvent) { if (this.readonly) return; ev.preventDefault(); ev.dataTransfer!.dropEffect = 'copy'; }
  onDrop(ev: DragEvent, onto?: FlowStep) {
    if (this.readonly) return;
    ev.preventDefault(); ev.stopPropagation();
    let d: PaletteDrag; try { d = JSON.parse(ev.dataTransfer!.getData('application/x-flow') || ev.dataTransfer!.getData('text/plain')); } catch { return; }
    const w = this.toWorld(ev.clientX, ev.clientY);
    const at = { x: w.x - NODE_W / 2, y: w.y - HEAD_H / 2 };
    switch (d.kind) {
      case 'step': this.addStep(d.type!, at.x, at.y); break;
      case 'user': case 'department': case 'role': {
        const assignee = d.kind === 'user' ? { userId: d.id } : d.kind === 'department' ? { departmentName: d.name } : { role: d.name };
        if (onto && (onto.type === 'task' || onto.type === 'approval')) { onto.config['assignTo'] = assignee; this.select(onto.id); this.changed.emit(); }
        else if (onto && onto.type === 'notify') { onto.config['to'] = assignee; this.select(onto.id); this.changed.emit(); }
        else this.addStep('task', at.x, at.y, { assignTo: assignee }, undefined, `Task for ${d.name}`);
        break;
      }
      case 'action':
        if (onto && onto.type === 'welly_action') { onto.config['action'] = d.key; this.select(onto.id); this.changed.emit(); }
        else this.addStep('welly_action', at.x, at.y, { action: d.key }, undefined, d.name ?? d.key);
        break;
      case 'event': this.triggerDrop.emit({ kind: 'event', key: d.key }); this.select(TRIGGER_NODE_ID); break;
      case 'dataSource': this.triggerDrop.emit({ kind: 'dataSource', key: d.key }); this.select(TRIGGER_NODE_ID); break;
      case 'manual': this.triggerDrop.emit({ kind: 'manual' }); this.select(TRIGGER_NODE_ID); break;
    }
  }
}
