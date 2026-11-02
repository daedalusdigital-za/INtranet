import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { MODULES } from '../core/modules.config';

/**
 * Home page layouts (design review D-07 follow-up): Home is a grid of widgets and a strip of
 * shortcuts that each person can arrange. Widgets are described here as a registry so new ones
 * (including ones fed by Flows) can be added without touching the saving code.
 */

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl';

export type WidgetType =
  | 'waiting' | 'tasks' | 'today' | 'announcements' | 'deliveries' | 'around'
  | 'payment-tracker' | 'currency' | 'sales-graph' | 'sales-vs-stock' | 'early-birds' | 'late-birds'
  | 'flow-start' | 'flow-tasks' | 'flow-runs' | 'flow-kpi'
  | 'links' | 'note';

export interface HomeWidget {
  /** Stable id for the instance (several flow widgets may exist for different flows). */
  id: string;
  type: WidgetType;
  size: WidgetSize;
  /** Per-type settings: flow ids, link lists, note text, custom title... */
  config?: Record<string, any>;
}

export interface HomeShortcut {
  id: string;
  label: string;
  icon: string;
  /** Internal route (starts with /) or absolute URL. */
  target: string;
  /** For 'flow' shortcuts: start this flow immediately instead of navigating. */
  flowId?: number;
}

export interface HomeLayout {
  version: 1;
  widgets: HomeWidget[];
  shortcuts: HomeShortcut[];
}

export interface WidgetMeta {
  type: WidgetType;
  name: string;
  icon: string;
  description: string;
  /** Module permission needed to use this widget (none = everyone). */
  permission?: string;
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  /** Allows more than one on the page (flow widgets, links, notes). */
  multiple?: boolean;
  /** Needs the person to choose something when adding (e.g. a flow). */
  configurable?: boolean;
  group: 'Work' | 'Business' | 'Flows' | 'Personal';
}

export const WIDGETS: WidgetMeta[] = [
  { type: 'waiting', name: 'Waiting for you', icon: 'pending_actions', description: 'Documents to sign, approvals, leave requests and task requests.', sizes: ['md', 'lg', 'xl'], defaultSize: 'lg', group: 'Work' },
  { type: 'tasks', name: 'Your tasks', icon: 'task_alt', description: 'Open to-do items with one-click done.', sizes: ['md', 'lg', 'xl'], defaultSize: 'lg', group: 'Work' },
  { type: 'today', name: 'Today', icon: 'event', description: 'Meetings and birthdays today.', sizes: ['sm', 'md', 'lg'], defaultSize: 'md', group: 'Work' },
  { type: 'announcements', name: 'Announcements', icon: 'campaign', description: 'The latest company announcements.', sizes: ['sm', 'md', 'lg'], defaultSize: 'md', group: 'Work' },
  { type: 'deliveries', name: 'Deliveries today', icon: 'local_shipping', description: "Today's loads: delivered, on the road, not left yet.", permission: 'logistics', sizes: ['md', 'lg'], defaultSize: 'md', group: 'Work' },
  { type: 'around', name: 'Around the company', icon: 'cake', description: 'Upcoming birthdays and new starters.', sizes: ['sm', 'md'], defaultSize: 'md', group: 'Work' },

  { type: 'payment-tracker', name: 'Payment tracker', icon: 'account_balance_wallet', description: 'Creditors pipeline as a stepper: received → auto-matched → approval queue → payment schedule → paid. Click a step to see what is in it.', permission: 'finance', sizes: ['md', 'lg', 'xl'], defaultSize: 'lg', group: 'Business' },
  { type: 'currency', name: 'Currency', icon: 'currency_exchange', description: 'What the rand is doing against the dollar, euro and pound today vs yesterday.', sizes: ['sm', 'md'], defaultSize: 'sm', multiple: true, configurable: true, group: 'Business' },
  { type: 'sales-graph', name: 'Sales graph', icon: 'show_chart', description: 'Daily sales for every company on one line graph (last 7 days).', permission: 'sales', sizes: ['md', 'lg', 'xl'], defaultSize: 'lg', configurable: true, group: 'Business' },
  { type: 'sales-vs-stock', name: 'Sales vs stock', icon: 'inventory_2', description: '30-day sales against stock on hand, with stock cover in days.', permission: 'sales', sizes: ['md', 'lg'], defaultSize: 'lg', group: 'Business' },
  { type: 'early-birds', name: 'Early birds', icon: 'wb_twilight', description: 'The first people to clock in at the main office today. Wider shows more.', sizes: ['sm', 'md', 'lg'], defaultSize: 'sm', group: 'Business' },
  { type: 'late-birds', name: 'Late birds', icon: 'schedule', description: 'The last people to clock in at the main office today. Wider shows more.', sizes: ['sm', 'md', 'lg'], defaultSize: 'sm', group: 'Business' },

  { type: 'flow-start', name: 'Start a flow', icon: 'play_circle', description: 'One-click buttons for the flows you start most.', sizes: ['sm', 'md', 'lg'], defaultSize: 'md', multiple: true, configurable: true, group: 'Flows' },
  { type: 'flow-tasks', name: 'Flow tasks for you', icon: 'approval', description: 'Approvals and tasks that flows have handed to you.', sizes: ['md', 'lg', 'xl'], defaultSize: 'lg', group: 'Flows' },
  { type: 'flow-runs', name: 'Flow activity', icon: 'account_tree', description: 'Live runs of one flow (or all flows) with where they are.', sizes: ['md', 'lg', 'xl'], defaultSize: 'md', multiple: true, configurable: true, group: 'Flows' },
  { type: 'flow-kpi', name: 'Flow number', icon: 'pin', description: 'A single figure: active, waiting, completed or failed runs of a flow.', sizes: ['sm'], defaultSize: 'sm', multiple: true, configurable: true, group: 'Flows' },

  { type: 'links', name: 'My links', icon: 'link', description: 'Your own list of pages and websites.', sizes: ['sm', 'md'], defaultSize: 'sm', multiple: true, configurable: true, group: 'Personal' },
  { type: 'note', name: 'Sticky note', icon: 'sticky_note_2', description: 'A note only you can see.', sizes: ['sm', 'md'], defaultSize: 'sm', multiple: true, group: 'Personal' },
];

export function widgetMeta(type: WidgetType): WidgetMeta {
  return WIDGETS.find(w => w.type === type)!;
}

export const SIZE_COLS: Record<WidgetSize, number> = { sm: 3, md: 4, lg: 6, xl: 12 };
export const SIZE_LABEL: Record<WidgetSize, string> = { sm: 'Small', md: 'Medium', lg: 'Wide', xl: 'Full width' };

/** Shortcut targets anyone may pick from (modules are filtered by permission at runtime). */
export interface ShortcutOption { label: string; icon: string; target: string; permission?: string; group: string }

export const SHORTCUT_OPTIONS: ShortcutOption[] = [
  { label: 'Apply for leave', icon: 'event_available', target: 'action:leave', group: 'Actions' },
  { label: 'Add a task', icon: 'add_task', target: 'action:todo', group: 'Actions' },
  { label: 'Company news', icon: 'campaign', target: '/welcome', group: 'Pages' },
  { label: 'Calendar', icon: 'calendar_month', target: '/calendar', group: 'Pages' },
  { label: 'My profile', icon: 'person', target: '/profile', group: 'Pages' },
  ...MODULES.filter(m => m.showInNavbar).map(m => ({ label: m.name, icon: m.icon, target: m.route, permission: m.requiresPermission ? m.key : undefined, group: 'Modules' })),
  ...MODULES.flatMap(m => (m.subRoutes ?? []).filter(s => s.path !== m.route).map(s => ({ label: `${m.name} · ${s.name}`, icon: s.icon || m.icon, target: s.path, permission: m.requiresPermission ? m.key : undefined, group: 'Module pages' }))),
];

const STORAGE_KEY = 'home.layout.v1';

@Injectable({ providedIn: 'root' })
export class HomeLayoutService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly url = `${environment.apiUrl}/home/layout`;

  /** True when the person has saved a layout of their own (vs the default for their permissions). */
  readonly customised = signal(false);

  private get cacheKey(): string { return `${STORAGE_KEY}.${this.auth.currentUserValue?.userId ?? 0}`; }

  can(permission?: string): boolean {
    if (!permission) return true;
    return this.auth.hasModulePermission(permission as any);
  }

  /** Widgets this person may add. */
  availableWidgets(): WidgetMeta[] {
    return WIDGETS.filter(w => this.can(w.permission));
  }

  availableShortcuts(): ShortcutOption[] {
    return SHORTCUT_OPTIONS.filter(s => this.can(s.permission));
  }

  /** The layout everyone gets before customising: the panels Home always had, filtered by permission. */
  defaultLayout(): HomeLayout {
    const widgets: HomeWidget[] = [
      { id: 'waiting', type: 'waiting', size: 'lg' },
      { id: 'tasks', type: 'tasks', size: 'lg' },
    ];
    if (this.can('logistics')) widgets.push({ id: 'deliveries', type: 'deliveries', size: 'md' });
    widgets.push({ id: 'flow-tasks', type: 'flow-tasks', size: this.can('logistics') ? 'lg' : 'md' });
    widgets.push({ id: 'today', type: 'today', size: 'md' });
    widgets.push({ id: 'announcements', type: 'announcements', size: 'md' });
    widgets.push({ id: 'around', type: 'around', size: 'md' });
    const shortcuts: HomeShortcut[] = [
      { id: 's-leave', label: 'Apply for leave', icon: 'event_available', target: 'action:leave' },
      { id: 's-todo', label: 'Add a task', icon: 'add_task', target: 'action:todo' },
      { id: 's-news', label: 'Company news', icon: 'campaign', target: '/welcome' },
    ];
    return { version: 1, widgets, shortcuts };
  }

  /** Cached copy first (instant paint), then the server's. */
  load(): Observable<HomeLayout> {
    return this.http.get<{ layout: HomeLayout | null }>(this.url).pipe(
      map(r => r.layout && Array.isArray(r.layout.widgets) ? this.sanitise(r.layout) : null),
      tap(l => { this.customised.set(!!l); if (l) localStorage.setItem(this.cacheKey, JSON.stringify(l)); else localStorage.removeItem(this.cacheKey); }),
      map(l => l ?? this.defaultLayout()),
      catchError(() => of(this.cached() ?? this.defaultLayout()))
    );
  }

  cached(): HomeLayout | null {
    try {
      const raw = localStorage.getItem(this.cacheKey);
      const l = raw ? JSON.parse(raw) as HomeLayout : null;
      if (l) this.customised.set(true);
      return l ? this.sanitise(l) : null;
    } catch { return null; }
  }

  save(layout: HomeLayout): Observable<void> {
    localStorage.setItem(this.cacheKey, JSON.stringify(layout));
    this.customised.set(true);
    return this.http.put<void>(this.url, layout).pipe(map(() => void 0));
  }

  reset(): Observable<void> {
    localStorage.removeItem(this.cacheKey);
    this.customised.set(false);
    return this.http.delete<void>(this.url).pipe(map(() => void 0), catchError(() => of(void 0)));
  }

  /** Drops widgets the person can no longer see (permissions change) and fixes bad sizes. */
  private sanitise(l: HomeLayout): HomeLayout {
    const widgets = (l.widgets ?? []).filter(w => {
      const meta = WIDGETS.find(m => m.type === w.type);
      return !!meta && this.can(meta.permission);
    }).map(w => {
      const meta = widgetMeta(w.type);
      return { ...w, size: meta.sizes.includes(w.size) ? w.size : meta.defaultSize };
    });
    const shortcuts = (l.shortcuts ?? []).filter(s => {
      const opt = SHORTCUT_OPTIONS.find(o => o.target === s.target);
      return s.flowId || !opt || this.can(opt.permission);
    });
    return { version: 1, widgets, shortcuts };
  }

  newId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }
}
