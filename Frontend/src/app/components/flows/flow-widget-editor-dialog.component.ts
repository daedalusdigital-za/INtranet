import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FlowCatalog, FlowDefinition, FlowWidget, FlowsService, SaveWidgetRequest } from '../../services/flows.service';
import { ToastService } from '../../ui/toast.service';
import { WIDGETS, WidgetMeta, WidgetSize, SIZE_LABEL } from '../../services/home-layout.service';
import { FlowKpiWidgetComponent, FlowRunsWidgetComponent, FlowStartWidgetComponent, FlowTasksWidgetComponent, FLOW_KPI_METRICS } from '../home/widgets/flow-widgets.component';

export interface WidgetEditorData { widget?: FlowWidget; flows: FlowDefinition[]; catalog: FlowCatalog; asTemplate?: boolean }

const ICONS = ['pin', 'hourglass_top', 'error_outline', 'account_tree', 'play_circle', 'approval', 'link', 'sticky_note_2', 'insights', 'local_shipping', 'receipt_long', 'payments', 'inventory_2', 'gavel', 'groups', 'bolt', 'widgets', 'fact_check', 'speed', 'star'];

/**
 * Designer for a shared Home widget: pick the widget kind, point it at a flow (or links), name it,
 * choose who sees it, and watch a live preview. Returns the saved FlowWidget.
 */
@Component({
  selector: 'app-flow-widget-editor-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule, MatTooltipModule,
    FlowKpiWidgetComponent, FlowRunsWidgetComponent, FlowStartWidgetComponent, FlowTasksWidgetComponent],
  template: `
    <h2 mat-dialog-title>{{ data.widget ? 'Edit widget' : (data.asTemplate ? 'New widget template' : 'New widget') }}</h2>
    <mat-dialog-content>
      <div class="we">
        <div class="we-form">
          <h3>What it shows</h3>
          <div class="kinds">
            @for (k of kinds; track k.type) {
              <button type="button" class="kind" [class.on]="type === k.type" (click)="setType(k)" [matTooltip]="k.description">
                <mat-icon>{{ k.icon }}</mat-icon><span>{{ k.name }}</span>
              </button>
            }
          </div>

          @if (type === 'flow-kpi' || type === 'flow-runs') {
            <mat-form-field appearance="outline" class="full">
              <mat-label>Flow</mat-label>
              <mat-select [(ngModel)]="flowId">
                <mat-option [value]="null">All flows</mat-option>
                @for (f of data.flows; track f.id) { <mat-option [value]="f.id">{{ f.name }}@if (f.departmentName) { · {{ f.departmentName }} }</mat-option> }
              </mat-select>
              @if (data.asTemplate || isTemplate) { <mat-hint>Templates usually leave this on "All flows"; the person using it picks one.</mat-hint> }
            </mat-form-field>
          }
          @if (type === 'flow-kpi') {
            <mat-form-field appearance="outline" class="full">
              <mat-label>Number to show</mat-label>
              <mat-select [(ngModel)]="metric">
                @for (m of metrics; track m.key) { <mat-option [value]="m.key">{{ m.label }}</mat-option> }
              </mat-select>
            </mat-form-field>
          }
          @if (type === 'flow-start') {
            <mat-form-field appearance="outline" class="full">
              <mat-label>Flows to offer (empty = all the person may start)</mat-label>
              <mat-select multiple [(ngModel)]="flowIds">
                @for (f of startable(); track f.id) { <mat-option [value]="f.id">{{ f.name }}</mat-option> }
              </mat-select>
            </mat-form-field>
          }
          @if (type === 'links') {
            <mat-form-field appearance="outline" class="full">
              <mat-label>Links — one per line: Label | URL or /route</mat-label>
              <textarea matInput rows="4" [(ngModel)]="linksText"></textarea>
            </mat-form-field>
          }

          <h3>Name &amp; look</h3>
          <div class="two">
            <mat-form-field appearance="outline">
              <mat-label>Name</mat-label>
              <input matInput [(ngModel)]="name" required>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Icon</mat-label>
              <mat-select [(ngModel)]="icon">
                @for (i of icons; track i) { <mat-option [value]="i"><mat-icon class="opt-ic">{{ i }}</mat-icon>{{ i }}</mat-option> }
              </mat-select>
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Description</mat-label>
            <input matInput [(ngModel)]="description" placeholder="What is it for, and who should add it?">
          </mat-form-field>
          <div class="two">
            <mat-form-field appearance="outline">
              <mat-label>Default size</mat-label>
              <mat-select [(ngModel)]="size">
                @for (s of sizes(); track s) { <mat-option [value]="s">{{ sizeLabel[s] }}</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Category</mat-label>
              <mat-select [(ngModel)]="category">
                @for (c of categories; track c) { <mat-option [value]="c">{{ c }}</mat-option> }
              </mat-select>
            </mat-form-field>
          </div>

          <h3>Who sees it</h3>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Audience</mat-label>
            <mat-select [(ngModel)]="departmentName">
              <mat-option [value]="null">Everyone</mat-option>
              @for (d of data.catalog.departments; track d.id) { <mat-option [value]="d.name">{{ d.name }} only</mat-option> }
            </mat-select>
          </mat-form-field>
          <div class="toggles">
            <mat-slide-toggle [(ngModel)]="isPublished">Published — people can add it from Home</mat-slide-toggle>
            <mat-slide-toggle [(ngModel)]="isTemplate">Template — shown under Templates as a starting point</mat-slide-toggle>
          </div>
        </div>

        <div class="we-preview">
          <h3>Preview</h3>
          <section class="panel" [class]="'panel size-' + size">
            <div class="panel-h"><h2><mat-icon>{{ icon }}</mat-icon>{{ name || 'Untitled widget' }}</h2></div>
            @switch (type) {
              @case ('flow-kpi') { <app-flow-kpi-widget [flowId]="flowId" [metric]="metric"></app-flow-kpi-widget> }
              @case ('flow-runs') { <app-flow-runs-widget [flowId]="flowId"></app-flow-runs-widget> }
              @case ('flow-start') { <app-flow-start-widget [pinned]="flowIds"></app-flow-start-widget> }
              @case ('flow-tasks') { <app-flow-tasks-widget></app-flow-tasks-widget> }
              @case ('links') {
                @for (l of parsedLinks(); track l.url) { <div class="lnk"><mat-icon>arrow_forward</mat-icon><span>{{ l.label }}<small>{{ l.url }}</small></span></div> }
                @empty { <p class="muted">Add some links on the left.</p> }
              }
              @default { <p class="muted">This widget shows the person's own {{ meta()?.name?.toLowerCase() }} — nothing to configure.</p> }
            }
          </section>
          <p class="muted">Shown here at “{{ sizeLabel[size] }}” width. People can resize it on their Home.</p>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="busy || !name.trim()" (click)="save()">{{ data.widget ? 'Save' : 'Create' }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { max-height: 76vh; }
    .we { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(300px, .9fr); gap: var(--space-5); }
    h3 { margin: var(--space-3) 0 var(--space-2); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--color-text-3); }
    .kinds { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; margin-bottom: var(--space-3); }
    .kind { display: grid; justify-items: center; gap: 4px; padding: 10px 6px; border: 1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); font: 700 var(--text-xs) var(--font-body); color: var(--color-text-2); cursor: pointer; }
    .kind mat-icon { color: var(--color-text-3); }
    .kind.on { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
    .kind.on mat-icon { color: var(--color-primary); }
    .full { width: 100%; }
    .two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .toggles { display: grid; gap: 8px; }
    .opt-ic { font-size: 18px; width: 18px; height: 18px; margin-right: 8px; vertical-align: -4px; color: var(--color-text-3); }
    .we-preview { position: sticky; top: 0; align-self: start; }
    .panel { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; }
    .size-sm { max-width: 300px; } .size-md { max-width: 400px; } .size-lg, .size-xl { max-width: 100%; }
    .panel-h { display: flex; align-items: center; padding: 12px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .panel-h h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-md); font-weight: 750; color: var(--color-text); }
    .panel-h mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); }
    .lnk { display: flex; align-items: center; gap: 10px; padding: 10px var(--space-4); border-bottom: 1px solid var(--color-line); font-size: var(--text-md); font-weight: 650; color: var(--color-text); }
    .lnk span { display: grid; } .lnk small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); }
    .lnk mat-icon { color: var(--color-text-3); }
    .muted { margin: var(--space-3) 0 0; padding: 0 var(--space-4) var(--space-3); font-size: var(--text-sm); color: var(--color-text-3); }
    @media (max-width: 860px) { .we { grid-template-columns: 1fr; } .we-preview { position: static; } }
  `]
})
export class FlowWidgetEditorDialogComponent {
  readonly data = inject<WidgetEditorData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<FlowWidgetEditorDialogComponent>);
  private readonly api = inject(FlowsService);
  private readonly toast = inject(ToastService);

  readonly kinds: WidgetMeta[] = WIDGETS.filter(w => ['flow-kpi', 'flow-runs', 'flow-start', 'flow-tasks', 'links'].includes(w.type));
  readonly metrics = FLOW_KPI_METRICS;
  readonly icons = ICONS;
  readonly sizeLabel = SIZE_LABEL;
  readonly categories = ['General', 'Flows', 'Operations', 'Logistics', 'Finance', 'HR', 'Sales', 'IT', 'Compliance', 'Personal'];
  busy = false;

  type = this.data.widget?.type ?? 'flow-kpi';
  name = this.data.widget?.name ?? '';
  description = this.data.widget?.description ?? '';
  icon = this.data.widget?.icon ?? 'pin';
  size: WidgetSize = this.data.widget?.size ?? 'sm';
  category = this.data.widget?.category ?? 'Flows';
  departmentName: string | null = this.data.widget?.departmentName ?? null;
  isPublished = this.data.widget?.isPublished ?? !this.data.asTemplate;
  isTemplate = this.data.widget?.isTemplate ?? !!this.data.asTemplate;
  flowId: number | null = this.data.widget?.config?.['flowId'] ?? null;
  metric: any = this.data.widget?.config?.['metric'] ?? 'active';
  flowIds: number[] = this.data.widget?.config?.['flowIds'] ?? [];
  linksText = ((this.data.widget?.config?.['links'] ?? []) as { label: string; url: string }[]).map(l => `${l.label} | ${l.url}`).join('\n');

  readonly startable = signal(this.data.flows.filter(f => f.canStart && f.isEnabled && f.triggerType !== 'event'));

  meta(): WidgetMeta | undefined { return WIDGETS.find(w => w.type === this.type); }
  sizes(): WidgetSize[] { return this.meta()?.sizes ?? ['sm', 'md', 'lg', 'xl']; }

  setType(k: WidgetMeta): void {
    this.type = k.type;
    if (!this.sizes().includes(this.size)) this.size = k.defaultSize;
    if (!this.data.widget) this.icon = k.icon;
  }

  parsedLinks(): { label: string; url: string }[] {
    return this.linksText.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [label, url] = l.split('|').map(s => s.trim());
      return url ? { label, url } : { label: l, url: l };
    });
  }

  private config(): Record<string, any> {
    switch (this.type) {
      case 'flow-kpi': return { flowId: this.flowId, metric: this.metric };
      case 'flow-runs': return { flowId: this.flowId };
      case 'flow-start': return { flowIds: this.flowIds };
      case 'links': return { links: this.parsedLinks() };
      default: return {};
    }
  }

  save(): void {
    const req: SaveWidgetRequest = {
      name: this.name.trim(), description: this.description?.trim() || null, icon: this.icon, type: this.type, size: this.size,
      config: this.config(), category: this.category, departmentName: this.departmentName, isPublished: this.isPublished, isTemplate: this.isTemplate
    };
    this.busy = true;
    const call = this.data.widget ? this.api.updateWidget(this.data.widget.id, req) : this.api.createWidget(req);
    call.subscribe({
      next: w => { this.toast.done(this.data.widget ? 'Widget saved' : `"${w.name}" created`); this.ref.close(w); },
      error: e => { this.busy = false; this.toast.error(e?.error?.message || 'Could not save the widget'); }
    });
  }
}
