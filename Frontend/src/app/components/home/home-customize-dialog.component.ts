import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

import { HomeLayout, HomeLayoutService, HomeShortcut, HomeWidget, ShortcutOption, WidgetMeta, WidgetType, widgetMeta } from '../../services/home-layout.service';
import { FlowDefinition, FlowWidget, FlowsService } from '../../services/flows.service';
import { FLOW_KPI_METRICS, FlowKpiMetric } from './widgets/flow-widgets.component';
import { CURRENCY_OPTIONS } from './widgets/business-widgets.component';

export interface CustomizeData { layout: HomeLayout; }

const WIDGETS_BY_TYPE = (type: string) => widgetMeta(type as WidgetType)?.name ?? type;

/**
 * "Customise Home": add widgets (configuring flow widgets as you add them), and manage the
 * shortcut strip. Returns the new layout, or undefined when cancelled.
 */
@Component({
  selector: 'app-home-customize-dialog',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTabsModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>Customise Home</h2>
    <mat-dialog-content>
      <mat-tab-group animationDuration="120ms" [(selectedIndex)]="tab">

        <mat-tab label="Add widgets">
          @if (library().length) {
            <h3 class="grp">From the widget library <small class="grp-note">Ready-made by your flow designers · <a routerLink="/flows" [queryParams]="{ tab: 'widgets' }" mat-dialog-close>browse all</a></small></h3>
            <div class="gallery">
              @for (w of library(); track w.id) {
                <div class="card lib" [class.used]="hasLib(w.id)">
                  <mat-icon class="card-ic">{{ w.icon }}</mat-icon>
                  <div class="card-t">{{ w.name }}<small>{{ w.description || widgetName(w.type) }}</small></div>
                  @if (hasLib(w.id)) { <span class="on">On your Home</span> }
                  @else { <button mat-stroked-button (click)="addLib(w)"><mat-icon>add</mat-icon>Add</button> }
                </div>
              }
            </div>
          }
          @for (g of groups; track g) {
            @if (byGroup(g).length) {
              <h3 class="grp">{{ g }}</h3>
              <div class="gallery">
                @for (w of byGroup(g); track w.type) {
                  <div class="card" [class.sel]="picking()?.type === w.type" [class.used]="!w.multiple && has(w.type)">
                    <mat-icon class="card-ic">{{ w.icon }}</mat-icon>
                    <div class="card-t">{{ w.name }}<small>{{ w.description }}</small></div>
                    @if (!w.multiple && has(w.type)) {
                      <span class="on">On your Home</span>
                    } @else if (w.configurable) {
                      <button mat-stroked-button (click)="pick(w)">Set up…</button>
                    } @else {
                      <button mat-stroked-button (click)="add(w)"><mat-icon>add</mat-icon>Add</button>
                    }
                  </div>
                }
              </div>
            }
          }

          @if (picking(); as w) {
            <div class="setup">
              <h3><mat-icon>{{ w.icon }}</mat-icon>{{ w.name }}</h3>

              @if (w.type === 'flow-start') {
                <p class="hint">Choose the flows to show as one-click buttons. Leave empty to show every flow you can start.</p>
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Flows</mat-label>
                  <mat-select multiple [(ngModel)]="cfg.flowIds">
                    @for (f of startable(); track f.id) { <mat-option [value]="f.id">{{ f.name }}@if (f.departmentName) { <small> · {{ f.departmentName }}</small> }</mat-option> }
                  </mat-select>
                </mat-form-field>
              }

              @if (w.type === 'flow-runs' || w.type === 'flow-kpi') {
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Flow</mat-label>
                  <mat-select [(ngModel)]="cfg.flowId">
                    <mat-option [value]="null">All flows</mat-option>
                    @for (f of flows(); track f.id) { <mat-option [value]="f.id">{{ f.name }}@if (f.departmentName) { <small> · {{ f.departmentName }}</small> }</mat-option> }
                  </mat-select>
                </mat-form-field>
              }
              @if (w.type === 'flow-kpi') {
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Show</mat-label>
                  <mat-select [(ngModel)]="cfg.metric">
                    @for (m of metrics; track m.key) { <mat-option [value]="m.key">{{ m.label }}</mat-option> }
                  </mat-select>
                </mat-form-field>
              }

              @if (w.type === 'links') {
                <p class="hint">One link per line as <code>Label | https://…</code> or <code>Label | /route</code>.</p>
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Links</mat-label>
                  <textarea matInput rows="5" [(ngModel)]="cfg.linksText" placeholder="Sage | https://sage.example.com&#10;Trip sheets | /logistics/trip-sheets"></textarea>
                </mat-form-field>
              }

              @if (w.type === 'currency') {
                <p class="hint">Rates are rand per one unit of each currency, today against the previous trading day (European Central Bank).</p>
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Currencies</mat-label>
                  <mat-select multiple [(ngModel)]="cfg.codes">
                    @for (c of currencies; track c.code) { <mat-option [value]="c.code">{{ c.code }} · {{ c.name }}</mat-option> }
                  </mat-select>
                </mat-form-field>
              }
              @if (w.type === 'sales-graph') {
                <mat-form-field appearance="outline" class="full">
                  <mat-label>Period</mat-label>
                  <mat-select [(ngModel)]="cfg.days">
                    <mat-option [value]="7">Last 7 days</mat-option>
                    <mat-option [value]="14">Last 14 days</mat-option>
                    <mat-option [value]="30">Last 30 days</mat-option>
                  </mat-select>
                </mat-form-field>
              }

              <mat-form-field appearance="outline" class="full">
                <mat-label>Title (optional)</mat-label>
                <input matInput [(ngModel)]="cfg.title" [placeholder]="w.name">
              </mat-form-field>

              <div class="setup-actions">
                <button mat-button (click)="picking.set(null)">Cancel</button>
                <button mat-flat-button color="primary" (click)="addConfigured(w)"><mat-icon>add</mat-icon>Add to Home</button>
              </div>
            </div>
          }
        </mat-tab>

        <mat-tab label="Shortcuts">
          <p class="hint">Shortcuts sit at the top of Home. Drag to reorder on the page itself.</p>
          <div class="sc-list">
            @for (s of layout.shortcuts; track s.id; let i = $index) {
              <div class="sc-row">
                <mat-icon>{{ s.icon }}</mat-icon>
                <span class="sc-l">{{ s.label }}<small>{{ s.flowId ? 'Starts a flow' : s.target }}</small></span>
                <button mat-icon-button (click)="moveShortcut(i, -1)" [disabled]="i === 0" matTooltip="Move up"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button (click)="moveShortcut(i, 1)" [disabled]="i === layout.shortcuts.length - 1" matTooltip="Move down"><mat-icon>arrow_downward</mat-icon></button>
                <button mat-icon-button (click)="removeShortcut(i)" matTooltip="Remove"><mat-icon>close</mat-icon></button>
              </div>
            } @empty {
              <p class="hint">No shortcuts yet.</p>
            }
          </div>

          <h3 class="grp">Add a shortcut</h3>
          <div class="sc-add">
            <mat-form-field appearance="outline" class="full">
              <mat-label>Page or action</mat-label>
              <mat-select [(ngModel)]="newTarget" (selectionChange)="onPickTarget()">
                @for (g of shortcutGroups(); track g.name) {
                  <mat-optgroup [label]="g.name">
                    @for (o of g.items; track o.target) { <mat-option [value]="o.target"><mat-icon class="opt-ic">{{ o.icon }}</mat-icon>{{ o.label }}</mat-option> }
                  </mat-optgroup>
                }
                @if (startable().length) {
                  <mat-optgroup label="Start a flow">
                    @for (f of startable(); track f.id) { <mat-option [value]="'flow:' + f.id"><mat-icon class="opt-ic">play_circle</mat-icon>{{ f.name }}</mat-option> }
                  </mat-optgroup>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Label</mat-label>
              <input matInput [(ngModel)]="newLabel">
            </mat-form-field>
            <button mat-flat-button color="primary" [disabled]="!newTarget || !newLabel.trim()" (click)="addShortcut()"><mat-icon>add</mat-icon>Add</button>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="done()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { max-height: 72vh; }
    .grp { margin: var(--space-4) 0 var(--space-2); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--color-text-3); display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
    .grp-note { text-transform: none; letter-spacing: 0; font-weight: 500; }
    .grp-note a { color: var(--color-primary); font-weight: 700; }
    .card.lib { border-color: var(--color-primary-soft); background: linear-gradient(180deg, var(--color-primary-soft) 0, var(--color-surface) 48px); }
    .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--space-2); }
    .card { display: grid; grid-template-columns: auto 1fr; gap: 4px var(--space-3); align-items: center; padding: 12px; border: 1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); }
    .card.sel { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-soft); }
    .card.used { opacity: .7; }
    .card-ic { color: var(--color-primary); }
    .card-t { font-size: var(--text-md); font-weight: 700; color: var(--color-text); display: grid; gap: 2px; }
    .card-t small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); line-height: 1.4; }
    .card button, .card .on { grid-column: 2; justify-self: start; margin-top: 4px; }
    .on { font-size: var(--text-xs); font-weight: 700; color: var(--color-ok); }
    .setup { margin-top: var(--space-4); padding: var(--space-4); border: 1px solid var(--color-primary); border-radius: var(--radius-md); background: var(--color-primary-soft); display: grid; gap: var(--space-2); }
    .setup h3 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-md); font-weight: 750; color: var(--color-text); }
    .setup-actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .hint { margin: var(--space-2) 0; font-size: var(--text-sm); color: var(--color-text-2); }
    .hint code { font-size: var(--text-xs); background: var(--color-surface-2); padding: 1px 5px; border-radius: 4px; }
    .full { width: 100%; }
    .sc-list { display: grid; gap: 4px; }
    .sc-row { display: flex; align-items: center; gap: var(--space-2); padding: 6px 8px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); }
    .sc-row > mat-icon:first-child { color: var(--color-primary); }
    .sc-l { flex: 1; min-width: 0; display: grid; font-size: var(--text-md); font-weight: 650; color: var(--color-text); }
    .sc-l small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sc-add { display: grid; grid-template-columns: 1fr 200px auto; gap: var(--space-2); align-items: center; }
    .sc-add button { margin-bottom: 20px; }
    .opt-ic { font-size: 18px; width: 18px; height: 18px; margin-right: 8px; vertical-align: -4px; color: var(--color-text-3); }
    @media (max-width: 640px) { .sc-add { grid-template-columns: 1fr; } .sc-add button { margin: 0; } }
  `]
})
export class HomeCustomizeDialogComponent {
  private readonly ref = inject(MatDialogRef<HomeCustomizeDialogComponent>);
  private readonly data = inject<CustomizeData>(MAT_DIALOG_DATA);
  private readonly layouts = inject(HomeLayoutService);
  private readonly flowsApi = inject(FlowsService);

  readonly layout: HomeLayout = structuredClone(this.data.layout);
  tab = 0;
  readonly groups: WidgetMeta['group'][] = ['Work', 'Business', 'Flows', 'Personal'];
  readonly available = this.layouts.availableWidgets();
  readonly picking = signal<WidgetMeta | null>(null);
  readonly flows = signal<FlowDefinition[]>([]);
  readonly startable = computed(() => this.flows().filter(f => f.canStart && f.isEnabled && f.triggerType !== 'event'));
  readonly metrics = FLOW_KPI_METRICS;
  readonly currencies = CURRENCY_OPTIONS;
  cfg: { flowIds: number[]; flowId: number | null; metric: FlowKpiMetric; linksText: string; title: string; codes: string[]; days: number } = { flowIds: [], flowId: null, metric: 'active', linksText: '', title: '', codes: ['USD', 'EUR', 'GBP'], days: 7 };

  newTarget = '';
  newLabel = '';
  private readonly shortcutOptions = this.layouts.availableShortcuts();

  constructor() {
    this.flowsApi.definitions(false).subscribe({ next: f => this.flows.set(f), error: () => {} });
    this.flowsApi.widgets(false).subscribe({ next: w => this.library.set(w.filter(x => x.isPublished && this.available.some(m => m.type === x.type))), error: () => {} });
  }

  readonly library = signal<FlowWidget[]>([]);
  hasLib(id: number): boolean { return this.layout.widgets.some(w => w.config?.['libraryId'] === id); }
  widgetName(type: string): string { return WIDGETS_BY_TYPE(type); }
  addLib(w: FlowWidget): void {
    this.layout.widgets.push({ id: this.layouts.newId('lib'), type: w.type as WidgetType, size: w.size, config: { ...(w.config ?? {}), title: w.name, libraryId: w.id } });
    this.flowsApi.widgetUsed(w.id).subscribe({ error: () => {} });
  }

  byGroup(g: WidgetMeta['group']): WidgetMeta[] { return this.available.filter(w => w.group === g); }
  has(type: string): boolean { return this.layout.widgets.some(w => w.type === type); }

  add(w: WidgetMeta): void {
    this.layout.widgets.push({ id: this.layouts.newId(w.type), type: w.type, size: w.defaultSize });
  }

  pick(w: WidgetMeta): void {
    this.cfg = { flowIds: [], flowId: null, metric: 'active', linksText: '', title: '', codes: ['USD', 'EUR', 'GBP'], days: 7 };
    this.picking.set(w);
  }

  addConfigured(w: WidgetMeta): void {
    const config: Record<string, any> = {};
    if (this.cfg.title.trim()) config['title'] = this.cfg.title.trim();
    if (w.type === 'flow-start') config['flowIds'] = this.cfg.flowIds;
    if (w.type === 'flow-runs' || w.type === 'flow-kpi') config['flowId'] = this.cfg.flowId;
    if (w.type === 'flow-kpi') config['metric'] = this.cfg.metric;
    if (w.type === 'currency') config['codes'] = this.cfg.codes.length ? this.cfg.codes : ['USD', 'EUR', 'GBP'];
    if (w.type === 'sales-graph') config['days'] = this.cfg.days || 7;
    if (w.type === 'links') {
      config['links'] = this.cfg.linksText.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [label, url] = l.split('|').map(s => s.trim());
        return url ? { label, url } : { label: l, url: l };
      });
    }
    this.layout.widgets.push({ id: this.layouts.newId(w.type), type: w.type, size: w.defaultSize, config });
    this.picking.set(null);
  }

  shortcutGroups(): { name: string; items: ShortcutOption[] }[] {
    const names = [...new Set(this.shortcutOptions.map(o => o.group))];
    return names.map(name => ({ name, items: this.shortcutOptions.filter(o => o.group === name) }));
  }

  onPickTarget(): void {
    if (this.newTarget.startsWith('flow:')) {
      const f = this.flows().find(x => x.id === +this.newTarget.slice(5));
      this.newLabel = f?.name ?? '';
    } else {
      const o = this.shortcutOptions.find(x => x.target === this.newTarget);
      this.newLabel = o?.label.replace(/^.*· /, '') ?? '';
    }
  }

  addShortcut(): void {
    let s: HomeShortcut;
    if (this.newTarget.startsWith('flow:')) {
      s = { id: this.layouts.newId('s'), label: this.newLabel.trim(), icon: 'play_circle', target: '/flows', flowId: +this.newTarget.slice(5) };
    } else {
      const o = this.shortcutOptions.find(x => x.target === this.newTarget)!;
      s = { id: this.layouts.newId('s'), label: this.newLabel.trim(), icon: o.icon, target: o.target };
    }
    this.layout.shortcuts.push(s);
    this.newTarget = ''; this.newLabel = '';
  }

  removeShortcut(i: number): void { this.layout.shortcuts.splice(i, 1); }
  moveShortcut(i: number, d: number): void {
    const j = i + d; if (j < 0 || j >= this.layout.shortcuts.length) return;
    [this.layout.shortcuts[i], this.layout.shortcuts[j]] = [this.layout.shortcuts[j], this.layout.shortcuts[i]];
  }

  done(): void { this.ref.close(this.layout); }
}
