import { Component, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FlowCatalog, FlowDefinition, FlowStep } from '../../services/flows.service';
import { FlowCanvasComponent } from './flow-canvas.component';
import { STEP_COLOR, assigneeLabel } from './flow-step-factory';

/**
 * Read-only "how does this flow work" view: the diagram on the left, a plain-language walkthrough on
 * the right (who does what, in order), with Start / Edit actions. Opened by clicking any flow card.
 */
@Component({
  selector: 'app-flow-view-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, FlowCanvasComponent],
  template: `
    <h2 mat-dialog-title class="fv-title">
      <mat-icon>{{ def.departmentName ? 'groups' : 'account_tree' }}</mat-icon>
      <div class="fv-name"><b>{{ def.name }}</b><small>{{ def.departmentName ? def.departmentName + ' · human flow' : (def.category || 'General') }} · {{ triggerLabel() }} · v{{ def.version }}</small></div>
      <span class="lvl l{{ def.level }}">L{{ def.level }}</span>
      @if (!def.isEnabled) { <span class="fv-off">paused</span> }
      <span class="spacer"></span>
      <button mat-icon-button (click)="selected = null; canvas?.fit()" matTooltip="Fit diagram"><mat-icon>fit_screen</mat-icon></button>
    </h2>
    <mat-dialog-content class="fv-body">
      <div class="fv-canvas">
        <app-flow-canvas [steps]="def.graph.steps" [startStepId]="def.graph.startStepId ?? null" [catalog]="data.catalog" [readonly]="true"
                         [triggerType]="def.triggerType" [triggerLabel]="triggerLabel()" [(selectedId)]="selected"></app-flow-canvas>
      </div>
      <aside class="fv-side">
        @if (def.description) { <p class="fv-desc">{{ def.description }}</p> }

        @if (selectedStep(); as s) {
          <div class="fv-detail" [style.border-left-color]="colors[s.type]">
            <div class="fv-detail-head"><mat-icon [style.color]="colors[s.type]">{{ icon(s) }}</mat-icon><b>{{ s.name || s.id }}</b><small>{{ typeName(s) }}</small></div>
            @for (line of describe(s); track line) { <p>{{ line }}</p> }
          </div>
        }

        <h4><mat-icon>route</mat-icon>How it works</h4>
        <ol class="fv-steps">
          <li class="trig"><mat-icon>{{ def.triggerType === 'event' ? 'bolt' : def.triggerType === 'schedule' ? 'schedule' : 'touch_app' }}</mat-icon>
            <div><b>Trigger</b><span>{{ triggerLabel() }}@if (def.inputs?.length) { · asks for {{ inputNames() }} }</span></div></li>
          @for (s of ordered(); track s.id) {
            <li [class.sel]="selected === s.id" (click)="selected = s.id" [style.--c]="colors[s.type]">
              <mat-icon>{{ icon(s) }}</mat-icon>
              <div><b>{{ s.name || s.id }}</b><span>{{ summary(s) }}</span></div>
            </li>
          }
        </ol>

        @if (people().length) {
          <h4><mat-icon>people</mat-icon>Who is involved</h4>
          <div class="fv-people">@for (p of people(); track p) { <span>{{ p }}</span> }</div>
        }
      </aside>
    </mat-dialog-content>
    <mat-dialog-actions class="fv-actions">
      @if (data.canEdit) { <button mat-stroked-button (click)="ref.close('edit')"><mat-icon>edit</mat-icon>Edit flow</button> }
      <span class="spacer"></span>
      <button mat-button mat-dialog-close>Close</button>
      @if (def.canStart) { <button mat-flat-button color="primary" (click)="ref.close('start')"><mat-icon>play_arrow</mat-icon>Start</button> }
    </mat-dialog-actions>
  `,
  styles: [`
    .spacer { flex: 1; }
    .fv-title { display: flex; align-items: center; gap: 10px; }
    .fv-name { display: grid; line-height: 1.15; min-width: 0; b { font-size: 17px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } small { font-size: 12px; color: var(--color-text-3); font-weight: 400; } }
    .lvl { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-3); color: #334155; &.l2 { background: var(--color-cat-purple-soft); color: #6d28d9; } &.l3 { background: var(--color-ok-soft); color: #15803d; } }
    .fv-off { font-size: 11px; text-transform: uppercase; color: #b45309; background: var(--color-warn-soft); padding: 2px 8px; border-radius: 999px; }
    .fv-body { width: min(1500px, 94vw); height: 78vh; display: grid; grid-template-columns: 1fr 360px; gap: 12px; padding: 8px 16px !important; }
    .fv-canvas { min-width: 0; min-height: 0; }
    .fv-side { overflow: auto; min-height: 0; padding-right: 4px; }
    .fv-desc { font-size: 13.5px; color: var(--color-text-2); margin: 0 0 10px; line-height: 1.45; }
    h4 { display: flex; align-items: center; gap: 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); margin: 14px 0 6px; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .fv-detail { border: 1px solid var(--color-border, var(--color-line)); border-left: 4px solid var(--color-line-strong); border-radius: 10px; padding: 10px 12px; background: var(--color-surface, var(--color-surface)); margin-bottom: 8px;
      p { margin: 4px 0 0; font-size: 12.5px; color: var(--color-text-2); white-space: pre-wrap; } }
    .fv-detail-head { display: flex; align-items: center; gap: 8px; b { font-size: 14px; } small { color: var(--color-text-3); font-size: 11.5px; } }
    .fv-steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px;
      li { --c: #94a3b8; display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border-radius: 8px; border: 1px solid transparent; cursor: pointer;
        mat-icon { color: var(--c); font-size: 18px; width: 18px; height: 18px; margin-top: 1px; }
        div { display: grid; line-height: 1.25; min-width: 0; } b { font-size: 13px; } span { font-size: 11.5px; color: var(--color-text-3); }
        &:hover { background: var(--color-surface-2, var(--color-surface-2)); } &.sel { border-color: #7c3aed; background: var(--color-cat-purple-soft); }
        &.trig { --c: #16a34a; cursor: default; } } }
    .fv-people { display: flex; flex-wrap: wrap; gap: 6px; span { font-size: 12px; padding: 3px 10px; border-radius: 999px; background: var(--color-surface-2, var(--color-surface-2)); border: 1px solid var(--color-border, var(--color-line)); } }
    .fv-actions { display: flex; gap: 6px; button { display: inline-flex; align-items: center; gap: 6px; } }
    @media (max-width: 900px) { .fv-body { grid-template-columns: 1fr; grid-template-rows: 55% 1fr; } }
  `]
})
export class FlowViewDialogComponent {
  data = inject<{ def: FlowDefinition; catalog: FlowCatalog; canEdit: boolean }>(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<FlowViewDialogComponent>);
  @ViewChild(FlowCanvasComponent) canvas?: FlowCanvasComponent;
  def = this.data.def;
  colors = STEP_COLOR;
  selected: string | null = null;

  ngAfterViewInit() { setTimeout(() => { this.canvas?.ensurePositions(); this.canvas?.fit(); }, 30); }

  selectedStep() { return this.def.graph.steps.find(s => s.id === this.selected) ?? null; }
  icon(s: FlowStep) { return this.data.catalog.stepTypes.find(t => t.type === s.type)?.icon ?? 'circle'; }
  typeName(s: FlowStep) { return this.data.catalog.stepTypes.find(t => t.type === s.type)?.name ?? s.type; }
  inputNames() { return (this.def.inputs || []).map(i => i.label || i.key).join(', '); }

  triggerLabel(): string {
    const t = this.def.trigger || {};
    if (this.def.triggerType === 'event') return `When ${t.event || 'an event happens'}`;
    if (this.def.triggerType === 'schedule') { const ds = this.data.catalog.dataSources.find(d => d.key === t.dataSource); return `Every ${t.intervalMinutes || 60} min · ${ds?.name || t.dataSource}`; }
    return 'Started by a person';
  }

  /** Steps in walk order from the start (BFS), then any unreachable ones. */
  ordered(): FlowStep[] {
    const by = new Map(this.def.graph.steps.map(s => [s.id, s]));
    const seen = new Set<string>(); const out: FlowStep[] = []; const q: string[] = [];
    if (this.def.graph.startStepId && by.has(this.def.graph.startStepId)) q.push(this.def.graph.startStepId);
    while (q.length) {
      const id = q.shift()!; if (seen.has(id)) continue; seen.add(id);
      const s = by.get(id)!; out.push(s);
      const c = s.config || {};
      for (const n of [s.nextStepId, c['trueStepId'], c['falseStepId'], c['approvedStepId'], c['rejectedStepId']]) if (n && by.has(n) && !seen.has(n)) q.push(n);
    }
    for (const s of this.def.graph.steps) if (!seen.has(s.id)) out.push(s);
    return out;
  }

  private who(a: any) { return assigneeLabel(a, this.data.catalog) || 'whoever started it'; }
  private name(id?: string | null) { if (!id) return 'end'; return this.def.graph.steps.find(s => s.id === id)?.name || id; }

  summary(s: FlowStep): string {
    const c = s.config || {};
    switch (s.type) {
      case 'task': return `${this.who(c['assignTo'])}${c['dueInHours'] ? ` · ${c['dueInHours']}h` : ''}`;
      case 'approval': return `${this.who(c['assignTo'])} decides · yes → ${this.name(c['approvedStepId'] || s.nextStepId)} · no → ${this.name(c['rejectedStepId'] || s.nextStepId)}`;
      case 'condition': return `${c['expression'] || '?'} · yes → ${this.name(c['trueStepId'])} · no → ${this.name(c['falseStepId'])}`;
      case 'ai_analyze': return `Welly returns ${(c['fields'] || []).map((f: any) => f.key).join(', ')}`;
      case 'notify': return `to ${this.who(c['to'])}`;
      case 'email': return `to ${c['to'] || '?'}`;
      case 'welly_action': return c['action'] || 'Welly tool';
      case 'wait': return c['hours'] ? `${c['hours']} hours` : `${c['minutes'] || 0} minutes`;
      case 'set': return `vars.${c['key']} = ${c['value']}`;
      case 'end': return `outcome: ${c['outcome'] || 'completed'}`;
    }
  }

  describe(s: FlowStep): string[] {
    const c = s.config || {}; const out: string[] = [];
    if (c['title']) out.push(`Title: ${c['title']}`);
    if (c['description']) out.push(c['description']);
    if (c['prompt']) out.push(`Welly is asked: ${c['prompt']}`);
    if (c['assignTo']) out.push(`Assigned to: ${this.who(c['assignTo'])}`);
    if (c['escalateTo']) out.push(`Escalates to: ${this.who(c['escalateTo'])}`);
    if (c['form']?.length) out.push(`Form: ${c['form'].map((f: any) => f.label || f.key).join(', ')}`);
    if (c['expression']) out.push(`Checks: ${c['expression']}`);
    if (c['body']) out.push(`Message: ${c['body']}`);
    if (c['subject']) out.push(`Subject: ${c['subject']}`);
    if (c['payload'] && s.type === 'welly_action') out.push(`Payload: ${JSON.stringify(c['payload'])}`);
    if (!out.length) out.push(this.summary(s));
    return out;
  }

  people(): string[] {
    const set = new Set<string>();
    for (const s of this.def.graph.steps) { const c = s.config || {}; for (const k of ['assignTo', 'escalateTo', 'to']) if (c[k]) set.add(this.who(c[k])); }
    return [...set];
  }
}
