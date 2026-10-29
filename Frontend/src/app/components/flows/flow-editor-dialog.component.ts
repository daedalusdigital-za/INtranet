import { Component, inject, signal, computed, ViewChild, AfterViewInit } from '@angular/core';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { FlowAssignee, FlowCatalog, FlowDefinition, FlowInput, FlowStep, FlowStepType, FlowsService, SaveFlowRequest } from '../../services/flows.service';
import { ToastService } from '../../ui/toast.service';
import { FlowCanvasComponent, PaletteDrag, TRIGGER_NODE_ID, TriggerDrop } from './flow-canvas.component';
import { STEP_COLOR, relinkAll } from './flow-step-factory';

type AssigneeMode = 'none' | 'starter' | 'starterManager' | 'user' | 'department' | 'role' | 'deptRole' | 'expression';
type PaletteGroup = 'steps' | 'people' | 'departments' | 'roles' | 'actions' | 'triggers';

/**
 * Visual flow designer: palette (steps, people, departments, roles, Welly actions, triggers) →
 * drag onto an n8n-style canvas → connect ports → configure the selected node in the inspector.
 * The canvas edits the same FlowStep[] graph the engine runs; JSON mode exposes it raw.
 */
@Component({
  selector: 'app-flow-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule,
    MatProgressSpinnerModule, MatCheckboxModule, MatSlideToggleModule, MatTooltipModule, MatMenuModule, MatTabsModule, FlowCanvasComponent],
  templateUrl: './flow-editor-dialog.component.html',
  styleUrls: ['./flow-editor-dialog.component.scss']
})
export class FlowEditorDialogComponent implements AfterViewInit {
  data = inject<{ def?: FlowDefinition; catalog: FlowCatalog; presetDepartment?: string | null }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<FlowEditorDialogComponent>);
  private api = inject(FlowsService);
  private toast = inject(ToastService);
  @ViewChild(FlowCanvasComponent) canvas?: FlowCanvasComponent;

  readonly TRIGGER = TRIGGER_NODE_ID;
  readonly colors = STEP_COLOR;
  catalog = this.data.catalog;
  isNew = !this.data.def;
  busy = false;
  tab = 0;
  jsonMode = false;
  jsonText = '';
  jsonError = '';
  warnings = signal<string[]>([]);
  selectedId: string | null = null;
  paletteGroup: PaletteGroup = 'steps';
  paletteFilter = '';
  paletteOpen = true;

  // ── model ──
  name = this.data.def?.name ?? '';
  description = this.data.def?.description ?? '';
  category = this.data.def?.category ?? (this.data.presetDepartment ? 'Operations' : 'General');
  departmentName: string | null = this.data.def?.departmentName ?? this.data.presetDepartment ?? null;
  level: 1 | 2 | 3 = this.data.def?.level ?? 1;
  triggerType = this.data.def?.triggerType ?? 'manual';
  trigger = { ...(this.data.def?.trigger ?? {}) } as any;
  triggerParamsHours: string = this.data.def?.trigger?.params?.['hours'] ?? '';
  inputs: FlowInput[] = JSON.parse(JSON.stringify(this.data.def?.inputs ?? []));
  steps: FlowStep[] = JSON.parse(JSON.stringify(this.data.def?.graph?.steps ?? []));
  startStepId: string | null = this.data.def?.graph?.startStepId ?? (this.steps[0]?.id ?? null);
  isEnabled = this.data.def?.isEnabled ?? true;
  startPermissions = this.data.def?.startPermissions ?? '';
  assigneeMode: Record<string, AssigneeMode> = {};
  escalateMode: Record<string, AssigneeMode> = {};
  notifyMode: Record<string, AssigneeMode> = {};

  categories = ['General', 'Operations', 'Logistics', 'Finance', 'HR', 'Sales', 'IT', 'Operations', 'Compliance'].filter((c, i, a) => a.indexOf(c) === i);
  inputTypes = ['text', 'textarea', 'number', 'date', 'select', 'user', 'department'];
  formFieldTypes = ['text', 'textarea', 'number', 'date', 'select', 'checkbox'];
  priorities = ['Low', 'Normal', 'High', 'Urgent'];
  paletteGroups: { key: PaletteGroup; icon: string; label: string }[] = [
    { key: 'steps', icon: 'extension', label: 'Steps' }, { key: 'triggers', icon: 'bolt', label: 'Triggers' },
    { key: 'people', icon: 'person', label: 'People' }, { key: 'departments', icon: 'groups', label: 'Departments' },
    { key: 'roles', icon: 'badge', label: 'Roles' }, { key: 'actions', icon: 'smart_toy', label: 'Welly tools' }
  ];

  constructor() {
    for (const s of this.steps) this.initStepUi(s);
  }

  ngAfterViewInit() {
    setTimeout(() => {
      if (this.canvas) { this.canvas.ensurePositions(); this.canvas.fit(); }
      if (this.isNew) this.selectedId = TRIGGER_NODE_ID;
    });
  }

  private initStepUi(s: FlowStep) {
    s.config ||= {};
    this.assigneeMode[s.id] = this.modeOf(s.config['assignTo']);
    this.escalateMode[s.id] = this.modeOf(s.config['escalateTo']);
    this.notifyMode[s.id] = this.modeOf(s.config['to']);
    if (s.type === 'task' || s.type === 'approval') s.config['form'] ||= [];
    if (s.type === 'ai_analyze') s.config['fields'] ||= [{ key: 'summary', description: 'A short summary' }];
  }

  // ── helpers ──
  stepType(t: FlowStepType) { return this.catalog.stepTypes.find(x => x.type === t); }
  stepLabel(id?: string | null): string { const s = this.steps.find(x => x.id === id); return s ? (s.name || s.id) : (id ? `⚠ ${id}` : '— end of flow —'); }
  otherSteps(id: string) { return this.steps.filter(s => s.id !== id); }
  selectedStep(): FlowStep | null { return this.steps.find(s => s.id === this.selectedId) ?? null; }
  levelHint = computed(() => ({ 1: 'Manual · a person starts it, people do the steps', 2: 'AI-assisted · Welly analyses & suggests, people decide', 3: 'Automated · triggers itself from events or a schedule' } as any));

  triggerLabel(): string {
    if (this.triggerType === 'event') return this.trigger.event ? `When ${this.trigger.event}` : 'When… (pick an event)';
    if (this.triggerType === 'schedule') { const ds = this.catalog.dataSources.find(d => d.key === this.trigger.dataSource); return ds ? `Every ${this.trigger.intervalMinutes || 60} min · ${ds.name}` : 'On a schedule (pick a data source)'; }
    return `Someone starts it${this.inputs.length ? ` · ${this.inputs.length} input${this.inputs.length > 1 ? 's' : ''}` : ''}`;
  }

  /** Canvas callback when a trigger chip is dropped. */
  onTriggerDrop(d: TriggerDrop) {
    if (d.kind === 'event') { this.triggerType = 'event'; this.trigger.event = d.key; if (this.level === 1) this.level = 3; }
    else if (d.kind === 'dataSource') { this.triggerType = 'schedule'; this.trigger.dataSource = d.key; this.trigger.intervalMinutes ||= 60; if (this.level === 1) this.level = 3; }
    else this.triggerType = 'manual';
    this.selectedId = TRIGGER_NODE_ID;
  }

  /** Steps added via the canvas need their UI mode maps initialised. */
  onGraphChanged() {
    for (const s of this.steps) if (!(s.id in this.assigneeMode)) this.initStepUi(s);
    if (this.level === 1 && this.steps.some(s => s.type === 'ai_analyze')) this.level = 2;
  }

  // ── palette ──
  paletteItems(): { drag: PaletteDrag; icon: string; label: string; hint?: string; color?: string }[] {
    const f = this.paletteFilter.trim().toLowerCase();
    const m = (...xs: (string | undefined | null)[]) => !f || xs.some(x => (x || '').toLowerCase().includes(f));
    switch (this.paletteGroup) {
      case 'steps': return this.catalog.stepTypes.filter(t => m(t.name, t.description)).map(t => ({ drag: { kind: 'step', type: t.type } as PaletteDrag, icon: t.icon, label: t.name, hint: t.description, color: STEP_COLOR[t.type] }));
      case 'people': return this.catalog.users.filter(u => m(u.name, u.email, u.role)).slice(0, 80).map(u => ({ drag: { kind: 'user', id: u.id, name: u.name } as PaletteDrag, icon: 'person', label: u.name, hint: u.role }));
      case 'departments': return this.catalog.departments.filter(d => m(d.name)).map(d => ({ drag: { kind: 'department', id: d.id, name: d.name } as PaletteDrag, icon: 'groups', label: d.name, hint: d.manager ? `Manager: ${d.manager}` : undefined }));
      case 'roles': return this.catalog.roles.filter(r => m(r)).map(r => ({ drag: { kind: 'role', name: r } as PaletteDrag, icon: 'badge', label: `Any ${r}` }));
      case 'actions': return (this.catalog.actions || []).filter(a => m(a)).map(a => ({ drag: { kind: 'action', key: a, name: a.replace(/_/g, ' ').toLowerCase() } as PaletteDrag, icon: 'smart_toy', label: a.replace(/_/g, ' '), hint: 'Welly tool', color: STEP_COLOR.welly_action }));
      case 'triggers': return [
        ...(m('someone starts it', 'manual') ? [{ drag: { kind: 'manual' } as PaletteDrag, icon: 'touch_app', label: 'Someone starts it', hint: 'Button + form on the Flows page', color: '#16a34a' }] : []),
        ...this.catalog.events.filter(e => m(e.key, e.description)).map(e => ({ drag: { kind: 'event', key: e.key } as PaletteDrag, icon: 'bolt', label: e.key, hint: e.description, color: '#16a34a' })),
        ...this.catalog.dataSources.filter(d => m(d.name, d.description)).map(d => ({ drag: { kind: 'dataSource', key: d.key } as PaletteDrag, icon: 'schedule', label: d.name, hint: d.description, color: '#16a34a' }))
      ];
    }
  }
  onDragStart(ev: DragEvent, drag: PaletteDrag) {
    ev.dataTransfer!.setData('application/x-flow', JSON.stringify(drag));
    ev.dataTransfer!.setData('text/plain', JSON.stringify(drag));
    ev.dataTransfer!.effectAllowed = 'copy';
  }
  /** Click (instead of drag) on a palette item → add at a free spot / apply to selection. */
  onPaletteClick(drag: PaletteDrag) {
    if (!this.canvas) return;
    const sel = this.selectedStep();
    const anchor = sel ?? this.steps[this.steps.length - 1];
    const x = anchor ? (anchor.x ?? 0) + 320 : 60, y = anchor ? (anchor.y ?? 0) : 60;
    const chain = sel && sel.type !== 'end' && sel.type !== 'condition' && sel.type !== 'approval' && !sel.nextStepId ? { id: sel.id, port: 'next' as const } : undefined;
    switch (drag.kind) {
      case 'step': this.canvas.addStep(drag.type!, x, y, undefined, chain); break;
      case 'user': case 'department': case 'role': {
        const a = drag.kind === 'user' ? { userId: drag.id } : drag.kind === 'department' ? { departmentName: drag.name } : { role: drag.name };
        if (sel && (sel.type === 'task' || sel.type === 'approval')) { sel.config['assignTo'] = a; this.assigneeMode[sel.id] = this.modeOf(a); }
        else if (sel && sel.type === 'notify') { sel.config['to'] = a; this.notifyMode[sel.id] = this.modeOf(a); }
        else this.canvas.addStep('task', x, y, { assignTo: a }, chain, `Task for ${drag.name}`);
        break;
      }
      case 'action': if (sel && sel.type === 'welly_action') sel.config['action'] = drag.key; else this.canvas.addStep('welly_action', x, y, { action: drag.key }, chain, drag.name); break;
      case 'event': case 'dataSource': case 'manual': this.onTriggerDrop({ kind: drag.kind, key: drag.key }); break;
    }
    this.onGraphChanged();
  }

  private modeOf(a: FlowAssignee | undefined): AssigneeMode {
    if (!a) return 'none';
    if (a.starter) return 'starter';
    if (a.starterManager) return 'starterManager';
    if ('userId' in a) return 'user';
    if ('expression' in a) return 'expression';
    if ((a.departmentName || a.departmentId) && a.role) return 'deptRole';
    if (a.departmentName || a.departmentId) return 'department';
    if (a.role) return 'role';
    return 'none';
  }

  setMode(step: FlowStep, key: 'assignTo' | 'escalateTo' | 'to', mode: AssigneeMode) {
    const store = key === 'assignTo' ? this.assigneeMode : key === 'escalateTo' ? this.escalateMode : this.notifyMode;
    store[step.id] = mode;
    const prev = step.config[key] || {};
    switch (mode) {
      case 'none': delete step.config[key]; break;
      case 'starter': step.config[key] = { starter: true }; break;
      case 'starterManager': step.config[key] = { starterManager: true }; break;
      case 'user': step.config[key] = { userId: prev.userId ?? null }; break;
      case 'department': step.config[key] = { departmentName: prev.departmentName ?? '' }; break;
      case 'role': step.config[key] = { role: prev.role ?? '' }; break;
      case 'deptRole': step.config[key] = { departmentName: prev.departmentName ?? '', role: prev.role ?? '' }; break;
      case 'expression': step.config[key] = { expression: prev.expression ?? '{{inputs.manager}}' }; break;
    }
  }

  renameId(step: FlowStep, newId: string) {
    newId = (newId || '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (!newId || newId === step.id || this.steps.some(s => s.id === newId)) return;
    const old = step.id;
    relinkAll(this.steps, old, newId);
    if (this.startStepId === old) this.startStepId = newId;
    this.assigneeMode[newId] = this.assigneeMode[old]; this.escalateMode[newId] = this.escalateMode[old]; this.notifyMode[newId] = this.notifyMode[old];
    step.id = newId; this.selectedId = newId;
  }

  addInput() { this.inputs.push({ key: `field${this.inputs.length + 1}`, label: '', type: 'text', required: false }); }
  addFormField(step: FlowStep) { (step.config['form'] ||= []).push({ key: `field${step.config['form'].length + 1}`, label: '', type: 'text', required: false }); }
  addAiField(step: FlowStep) { (step.config['fields'] ||= []).push({ key: '', description: '' }); }
  optionsText(o?: string[]) { return (o || []).join(', '); }
  setOptions(obj: any, text: string) { obj.options = text.split(',').map(s => s.trim()).filter(Boolean); }
  payloadText(step: FlowStep) { return typeof step.config['payload'] === 'string' ? step.config['payload'] : JSON.stringify(step.config['payload'] ?? {}, null, 2); }
  setPayload(step: FlowStep, text: string) { try { step.config['payload'] = JSON.parse(text); step.config['_payloadErr'] = ''; } catch { step.config['_payloadErr'] = 'Not valid JSON'; } }

  /** Variables the author can use in templates for this flow. */
  variableHints(): string[] {
    const hints = ['run.number', 'run.title', 'run.startedBy', 'run.startedByEmail', 'now'];
    for (const i of this.inputs) hints.push(`inputs.${i.key}`);
    if (this.triggerType === 'schedule') {
      const ds = this.catalog.dataSources.find(d => d.key === this.trigger.dataSource);
      for (const f of ds?.fields ?? []) hints.push(`entity.${f}`);
    }
    if (this.triggerType === 'event') for (const f of this.catalog.dataSources[0]?.fields ?? []) hints.push(`entity.${f}`);
    for (const s of this.steps) {
      if (s.type === 'ai_analyze') for (const f of s.config['fields'] ?? []) if (f.key) hints.push(`${s.config['outputKey'] || 'ai'}.${f.key}`);
      if (s.type === 'task' || s.type === 'approval') { hints.push(`steps.${s.id}.decision`, `steps.${s.id}.comment`, `steps.${s.id}.completedBy`); for (const f of s.config['form'] ?? []) if (f.key) hints.push(`steps.${s.id}.${f.key}`); }
      if (s.type === 'set' && s.config['key']) hints.push(`vars.${s.config['key']}`);
    }
    return hints;
  }
  copyVar(v: string) { navigator.clipboard?.writeText(`{{${v}}}`).then(() => this.toast.done(`Copied {{${v}}}`)); }

  // ── JSON mode ──
  toggleJson() {
    if (!this.jsonMode) { this.jsonText = JSON.stringify(this.buildRequest(), null, 2); this.jsonError = ''; this.jsonMode = true; }
    else { if (!this.applyJson()) return; this.jsonMode = false; setTimeout(() => { this.canvas?.ensurePositions(); this.canvas?.fit(); }); }
  }
  applyJson(): boolean {
    try {
      const r = JSON.parse(this.jsonText) as SaveFlowRequest;
      this.name = r.name; this.description = r.description ?? ''; this.category = r.category ?? 'General'; this.departmentName = r.departmentName ?? null; this.level = (r.level as any) ?? 1;
      this.triggerType = r.triggerType; this.trigger = r.trigger ?? {}; this.inputs = r.inputs ?? []; this.steps = r.graph?.steps ?? []; this.startStepId = r.graph?.startStepId ?? this.steps[0]?.id ?? null;
      this.isEnabled = r.isEnabled; this.startPermissions = r.startPermissions ?? '';
      for (const s of this.steps) this.initStepUi(s);
      this.selectedId = null; this.jsonError = ''; return true;
    } catch (e: any) { this.jsonError = e?.message || 'Invalid JSON'; return false; }
  }

  buildRequest(): SaveFlowRequest {
    const trig: any = { ...this.trigger };
    if (this.triggerType === 'schedule') { trig.params = { ...(trig.params || {}) }; if (this.triggerParamsHours) trig.params.hours = String(this.triggerParamsHours); else delete trig.params.hours; }
    const steps = this.steps.map(s => {
      const cfg = { ...s.config }; delete cfg['_payloadErr'];
      if (s.type === 'task' && cfg['form'] && cfg['form'].length === 0) delete cfg['form'];
      return { ...s, config: cfg };
    });
    return {
      name: this.name.trim(), description: this.description, category: this.category, departmentName: this.departmentName || null, level: this.level, triggerType: this.triggerType,
      trigger: trig, graph: { startStepId: this.startStepId, steps }, inputs: this.inputs, isEnabled: this.isEnabled, startPermissions: this.startPermissions || null
    };
  }

  validate() {
    if (this.jsonMode && !this.applyJson()) return;
    this.api.validate(this.buildRequest()).subscribe({
      next: r => { this.warnings.set([...(r.error ? [r.error] : []), ...r.warnings]); if (r.ok) this.toast.done('Flow looks good'); },
      error: () => this.toast.error('Validation failed')
    });
  }

  save() {
    if (this.jsonMode && !this.applyJson()) return;
    const req = this.buildRequest();
    if (!req.name) { this.toast.warn('Give the flow a name'); this.tab = 1; return; }
    this.busy = true;
    const call = this.isNew ? this.api.create(req) : this.api.update(this.data.def!.id, req);
    call.subscribe({
      next: d => { this.busy = false; this.toast.done(this.isNew ? 'Flow created' : 'Flow saved'); this.ref.close(d); },
      error: err => { this.busy = false; this.toast.error(err?.error?.message || 'Could not save flow'); }
    });
  }
}
