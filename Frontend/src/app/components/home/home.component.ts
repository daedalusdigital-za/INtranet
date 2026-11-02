import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { Subject, catchError, debounceTime, forkJoin, of } from 'rxjs';

import { NavbarComponent } from '../shared/navbar/navbar.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { KpiItem, KpiStripComponent } from '../../ui/kpi-strip/kpi-strip.component';
import { StatusChipComponent } from '../../ui/status-chip/status-chip.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { ToastService } from '../../ui/toast.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { AnnouncementService, AnnouncementListItem } from '../../services/announcement.service';
import { ManagementService, ApprovalItem } from '../../services/management.service';
import { PaperlessService } from '../../services/paperless.service';
import { LeaveRequestDialogComponent } from '../shared/leave-request-dialog/leave-request-dialog.component';
import { TodoDialogComponent } from '../todo-dialog/todo-dialog.component';
import { environment } from '../../../environments/environment';
import { HomeLayout, HomeLayoutService, HomeShortcut, HomeWidget, SIZE_LABEL, WidgetSize, widgetMeta } from '../../services/home-layout.service';
import { FlowKpiWidgetComponent, FlowRunsWidgetComponent, FlowStartWidgetComponent, FlowTasksWidgetComponent, HomeFlowsStore } from './widgets/flow-widgets.component';
import { BirdsWidgetComponent, CurrencyWidgetComponent, PaymentTrackerWidgetComponent, SalesGraphWidgetComponent, SalesVsStockWidgetComponent } from './widgets/business-widgets.component';
import { HomeCustomizeDialogComponent } from './home-customize-dialog.component';

interface HomeTask {
  id: number;
  title: string;
  dueDate: string;
  status: string;
  isCompleted: boolean;
  priority: string;
  createdByUserName: string;
  isSelfAssigned: boolean;
}

interface HomeMeeting {
  id: number;
  title: string;
  start: string;
  end: string;
  location: string;
  responseStatus: string;
  isOrganizer: boolean;
}

interface DeliveriesToday {
  total: number;
  delivered: number;
  inTransit: number;
  notStarted: number;
  overdue: number;
  byWarehouse: { name: string; total: number; delivered: number; inTransit: number; notStarted: number }[];
}

interface WaitingRow {
  icon: string;
  tone: 'info' | 'warn' | 'danger' | 'neutral';
  title: string;
  detail: string;
  button: string;
  run: () => void;
}

interface Person { name: string; department: string; when: string; photo?: string }

/**
 * Home: what needs the signed-in person today (design review D-07). Home is a grid of widgets and
 * a strip of shortcuts. Everyone starts with a default arrangement for their permissions and can
 * customise it (add, remove, resize, drag); flow widgets let Flows feed Home directly. The layout
 * is saved per person. The old company feed is at /welcome.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    DatePipe, NgTemplateOutlet, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, NavbarComponent,
    EmptyStateComponent, KpiStripComponent, StatusChipComponent, SkeletonRowsComponent,
    FlowStartWidgetComponent, FlowTasksWidgetComponent, FlowRunsWidgetComponent, FlowKpiWidgetComponent,
    PaymentTrackerWidgetComponent, CurrencyWidgetComponent, SalesGraphWidgetComponent, SalesVsStockWidgetComponent, BirdsWidgetComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <main class="home">
      <div class="hello">
        <div>
          <p class="hello-date">{{ today | date:'EEEE d MMMM' }}</p>
          <h1>{{ greeting }}, {{ firstName }}</h1>
        </div>
        <div class="hello-actions">
          @for (s of layout().shortcuts; track s.id) {
            <button mat-stroked-button class="sc" [class.sc-flow]="s.flowId" (click)="runShortcut(s)"
                    [attr.draggable]="editing() ? 'true' : null" (dragstart)="dragShortcut(s.id)" (dragover)="editing() && $event.preventDefault()" (drop)="dropShortcut($event, s.id)">
              <mat-icon>{{ s.icon }}</mat-icon>{{ s.label }}
              @if (editing()) { <mat-icon class="sc-x" (click)="$event.stopPropagation(); removeShortcut(s.id)" aria-label="Remove shortcut">close</mat-icon> }
            </button>
          }
          @if (editing()) {
            <button mat-flat-button color="primary" (click)="openCustomize(1)"><mat-icon>add</mat-icon>Shortcut</button>
            <button mat-flat-button color="primary" (click)="openCustomize(0)"><mat-icon>dashboard_customize</mat-icon>Add widget</button>
            @if (layouts.customised()) { <button mat-stroked-button (click)="resetLayout()" matTooltip="Back to the default Home for your permissions"><mat-icon>restart_alt</mat-icon>Reset</button> }
            <button mat-stroked-button class="done-btn" (click)="finishEditing()"><mat-icon>check</mat-icon>Done</button>
          } @else {
            <button mat-icon-button class="edit-btn" (click)="editing.set(true)" matTooltip="Customise Home" aria-label="Customise Home"><mat-icon>tune</mat-icon></button>
          }
        </div>
      </div>

      @if (editing()) {
        <p class="edit-hint"><mat-icon>info</mat-icon>Grab a widget by its title bar and drop it where you want it (the blue line shows where it will land). Use the size buttons to make it wider or narrower, the arrows to nudge it, and <b>×</b> to remove. Changes save automatically.</p>
      }

      <app-kpi-strip [items]="kpis()"></app-kpi-strip>

      <div class="grid" [class.editing]="editing()" [class.is-dragging]="!!dragId()" #grid>
        @for (w of layout().widgets; track w.id; let i = $index) {
          <section class="panel" [class]="'panel size-' + w.size" [class.dragging]="dragId() === w.id"
                   [class.drop-before]="dropId() === w.id && dropSide() === 'before'" [class.drop-after]="dropId() === w.id && dropSide() === 'after'"
                   [attr.data-wid]="w.id" [attr.id]="w.type === 'waiting' ? 'waiting' : null" [attr.aria-labelledby]="'wh-' + w.id">
            <div class="panel-h" [class.handle]="editing()" (pointerdown)="editing() && grab($event, w.id)">
              <h2 [id]="'wh-' + w.id">
                @if (editing()) { <mat-icon class="grip" aria-hidden="true">drag_indicator</mat-icon> }
                {{ title(w) }}
                @if (w.type === 'waiting' && !waitingLoading() && waiting().length) { <span class="count">{{ waiting().length }}</span> }
              </h2>
              @if (editing()) {
                <div class="panel-tools" (pointerdown)="$event.stopPropagation()">
                  <button mat-icon-button class="rm" (click)="nudge(w.id, -1)" [disabled]="i === 0" matTooltip="Move earlier" aria-label="Move earlier"><mat-icon>chevron_left</mat-icon></button>
                  <button mat-icon-button class="rm" (click)="nudge(w.id, 1)" [disabled]="i === layout().widgets.length - 1" matTooltip="Move later" aria-label="Move later"><mat-icon>chevron_right</mat-icon></button>
                  <span class="tool-sep"></span>
                  @for (s of sizesFor(w); track s) {
                    <button type="button" class="sz" [class.on]="w.size === s" (click)="resize(w, s)" [matTooltip]="sizeLabel[s]">{{ s === 'xl' ? 'Full' : s.toUpperCase() }}</button>
                  }
                  <button mat-icon-button class="rm" (click)="removeWidget(w.id)" matTooltip="Remove widget" aria-label="Remove widget"><mat-icon>close</mat-icon></button>
                </div>
              } @else {
                @switch (w.type) {
                  @case ('tasks') { <button type="button" class="panel-link" (click)="openTodo()">All tasks <mat-icon>chevron_right</mat-icon></button> }
                  @case ('deliveries') { <a class="panel-link" routerLink="/logistics">Logistics <mat-icon>chevron_right</mat-icon></a> }
                  @case ('today') { <a class="panel-link" routerLink="/calendar">Calendar <mat-icon>chevron_right</mat-icon></a> }
                  @case ('announcements') { <a class="panel-link" routerLink="/welcome">All <mat-icon>chevron_right</mat-icon></a> }
                  @case ('around') { <a class="panel-link" routerLink="/welcome">Company news <mat-icon>chevron_right</mat-icon></a> }
                  @case ('flow-start') { <a class="panel-link" routerLink="/flows">Flows <mat-icon>chevron_right</mat-icon></a> }
                  @case ('flow-tasks') { <a class="panel-link" routerLink="/flows">Flows <mat-icon>chevron_right</mat-icon></a> }
                  @case ('flow-runs') { <a class="panel-link" routerLink="/flows">Flows <mat-icon>chevron_right</mat-icon></a> }
                  @case ('payment-tracker') { <a class="panel-link" routerLink="/finance/creditors">Creditors <mat-icon>chevron_right</mat-icon></a> }
                  @case ('sales-graph') { <a class="panel-link" routerLink="/sales">Sales <mat-icon>chevron_right</mat-icon></a> }
                  @case ('sales-vs-stock') { <a class="panel-link" routerLink="/stock-management">Stock <mat-icon>chevron_right</mat-icon></a> }
                  @case ('early-birds') { <a class="panel-link" routerLink="/people">People <mat-icon>chevron_right</mat-icon></a> }
                  @case ('late-birds') { <a class="panel-link" routerLink="/people">People <mat-icon>chevron_right</mat-icon></a> }
                }
              }
            </div>

            @switch (w.type) {
              @case ('waiting') { <ng-container *ngTemplateOutlet="waitingTpl"></ng-container> }
              @case ('tasks') { <ng-container *ngTemplateOutlet="tasksTpl"></ng-container> }
              @case ('deliveries') { <ng-container *ngTemplateOutlet="deliveriesTpl"></ng-container> }
              @case ('today') { <ng-container *ngTemplateOutlet="todayTpl"></ng-container> }
              @case ('announcements') { <ng-container *ngTemplateOutlet="announcementsTpl"></ng-container> }
              @case ('around') { <ng-container *ngTemplateOutlet="aroundTpl"></ng-container> }
              @case ('flow-start') { <app-flow-start-widget [pinned]="w.config?.['flowIds'] ?? []"></app-flow-start-widget> }
              @case ('flow-tasks') { <app-flow-tasks-widget></app-flow-tasks-widget> }
              @case ('flow-runs') { <app-flow-runs-widget [flowId]="w.config?.['flowId'] ?? null"></app-flow-runs-widget> }
              @case ('flow-kpi') { <app-flow-kpi-widget [flowId]="w.config?.['flowId'] ?? null" [metric]="w.config?.['metric'] ?? 'active'"></app-flow-kpi-widget> }
              @case ('payment-tracker') { <app-payment-tracker-widget [size]="w.size"></app-payment-tracker-widget> }
              @case ('currency') { <app-currency-widget [codes]="w.config?.['codes'] ?? ['USD','EUR','GBP']"></app-currency-widget> }
              @case ('sales-graph') { <app-sales-graph-widget [days]="w.config?.['days'] ?? 7"></app-sales-graph-widget> }
              @case ('sales-vs-stock') { <app-sales-vs-stock-widget></app-sales-vs-stock-widget> }
              @case ('early-birds') { <app-birds-widget mode="early" [size]="w.size"></app-birds-widget> }
              @case ('late-birds') { <app-birds-widget mode="late" [size]="w.size"></app-birds-widget> }
              @case ('links') {
                @for (l of (w.config?.['links'] ?? []); track l.url) {
                  <a class="row link-row" [href]="l.url" [attr.target]="isExternal(l.url) ? '_blank' : null" rel="noopener" (click)="openLink($event, l.url)">
                    <mat-icon class="muted-ic">{{ isExternal(l.url) ? 'open_in_new' : 'arrow_forward' }}</mat-icon>
                    <span class="row-t">{{ l.label }}<small>{{ l.url }}</small></span>
                  </a>
                } @empty {
                  <app-empty-state compact icon="link" title="No links yet" message="Remove this widget and add it again with your links."></app-empty-state>
                }
              }
              @case ('note') {
                <textarea class="note" [value]="w.config?.['text'] ?? ''" (input)="noteChanged(w, $any($event.target).value)" placeholder="Type a note only you can see…" rows="5"></textarea>
              }
            }
          </section>
        } @empty {
          <div class="panel size-xl empty-home">
            <app-empty-state icon="dashboard_customize" title="Your Home is empty" message="Add widgets to see what needs you today.">
              <button mat-flat-button color="primary" (click)="openCustomize(0)"><mat-icon>add</mat-icon>Add widgets</button>
            </app-empty-state>
          </div>
        }
        @if (dragId()) {
          <div class="end-zone size-xl" data-wid="__end" [class.drop-before]="dropId() === '__end'">Drop here to put it last</div>
        }
      </div>
      @if (dragId(); as id) {
        <div class="ghost" [style.left.px]="ghost().x" [style.top.px]="ghost().y" [style.width.px]="ghost().w">
          <mat-icon>drag_indicator</mat-icon>{{ titleById(id) }}
        </div>
      }
    </main>

    <!-- ── Built-in widget bodies ───────────────────────────────────────── -->

    <ng-template #waitingTpl>
            @if (waitingLoading()) {
              <app-skeleton-rows [rows]="3"></app-skeleton-rows>
            } @else {
              @for (w of waiting(); track w.title) {
                <div class="row">
                  <span class="ic" [class]="'ic tone-' + w.tone"><mat-icon>{{ w.icon }}</mat-icon></span>
                  <span class="row-t">{{ w.title }}<small>{{ w.detail }}</small></span>
                  <button mat-stroked-button class="row-btn" (click)="w.run()">{{ w.button }}</button>
                </div>
              } @empty {
                <app-empty-state compact icon="done_all" title="Nothing is waiting for you"
                  message="Documents to sign, task requests and approvals show up here."></app-empty-state>
              }
            }
    </ng-template>

    <ng-template #tasksTpl>
            @if (tasksLoading()) {
              <app-skeleton-rows [rows]="4" [avatar]="false"></app-skeleton-rows>
            } @else {
              @for (t of openTasks(); track t.id) {
                <div class="row">
                  <button type="button" class="tick" [attr.aria-label]="'Mark ' + t.title + ' as done'"
                          [disabled]="completing() === t.id" (click)="completeTask(t)"><mat-icon>check</mat-icon></button>
                  <span class="row-t">{{ t.title }}<small>{{ dueText(t) }}@if (!t.isSelfAssigned) { · from {{ t.createdByUserName }} }</small></span>
                  @if (dueTone(t); as tone) { <app-status-chip [status]="tone.label" [tone]="tone.tone"></app-status-chip> }
                </div>
              } @empty {
                <app-empty-state compact icon="task_alt" title="No open tasks"
                  message="Tasks you add, or that colleagues give you, show up here."></app-empty-state>
              }
            }
    </ng-template>

    <ng-template #deliveriesTpl>
              @if (deliveries(); as d) {
                @if (d.total) {
                  <div class="del">
                    <div class="del-big">{{ d.total }}<small>{{ d.total === 1 ? 'load' : 'loads' }} due today</small></div>
                    <div class="bar" role="img" [attr.aria-label]="d.delivered + ' delivered, ' + d.inTransit + ' on the road, ' + d.notStarted + ' not left yet'">
                      <i class="b-ok" [style.width.%]="pct(d.delivered, d.total)"></i>
                      <i class="b-info" [style.width.%]="pct(d.inTransit, d.total)"></i>
                      <i class="b-idle" [style.width.%]="pct(d.notStarted, d.total)"></i>
                    </div>
                    <div class="legend">
                      <span class="l-ok">{{ d.delivered }} delivered</span>
                      <span class="l-info">{{ d.inTransit }} on the road</span>
                      <span class="l-idle">{{ d.notStarted }} not left yet</span>
                    </div>
                    @for (w of d.byWarehouse.slice(0, 5); track w.name) {
                      <div class="wh">
                        <span class="wh-n">{{ w.name }}</span>
                        <div class="bar thin">
                          <i class="b-ok" [style.width.%]="pct(w.delivered, w.total)"></i>
                          <i class="b-info" [style.width.%]="pct(w.inTransit, w.total)"></i>
                          <i class="b-idle" [style.width.%]="pct(w.notStarted, w.total)"></i>
                        </div>
                        <span class="wh-c">{{ w.total }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <app-empty-state compact icon="local_shipping" title="No deliveries scheduled for today"
                    [message]="d.overdue ? d.overdue + ' loads from earlier days are still not delivered.' : 'Loads due for delivery today show up here.'"></app-empty-state>
                }
              } @else if (deliveriesFailed()) {
                <app-empty-state compact icon="cloud_off" title="Couldn't load today's deliveries" message="Open Logistics to see the loads."></app-empty-state>
              } @else {
                <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
              }
    </ng-template>

    <ng-template #todayTpl>
            @if (meetingsLoading()) {
              <app-skeleton-rows [rows]="2" [avatar]="false"></app-skeleton-rows>
            } @else {
              @for (m of meetings(); track m.id) {
                <div class="ev">
                  <span class="ev-tm">{{ isAllDay(m) ? 'All day' : (m.start | date:'HH:mm') }}</span>
                  <span class="ev-ln"></span>
                  <span class="ev-t">{{ m.title }}<small>{{ meetingDetail(m) }}</small></span>
                  @if (!m.isOrganizer && needsReply(m)) { <app-status-chip status="Reply needed" tone="warn"></app-status-chip> }
                </div>
              }
              @for (p of birthdaysToday(); track p.name) {
                <div class="ev ev-bday">
                  <span class="ev-tm">All day</span>
                  <span class="ev-ln"></span>
                  <span class="ev-t">Birthday: {{ p.name }}<small>{{ p.department }}</small></span>
                </div>
              }
              @if (!meetings().length && !birthdaysToday().length) {
                <app-empty-state compact icon="event_available" title="Nothing in your calendar today"></app-empty-state>
              }
            }
    </ng-template>

    <ng-template #announcementsTpl>
            @if (announcementsLoading()) {
              <app-skeleton-rows [rows]="2" [avatar]="false"></app-skeleton-rows>
            } @else {
              @for (a of announcements(); track a.announcementId) {
                <article class="ann">
                  <h3>{{ a.title }}
                    @if (a.priority === 'Urgent' || a.priority === 'High') { <app-status-chip [status]="a.priority" [tone]="a.priority === 'Urgent' ? 'danger' : 'warn'"></app-status-chip> }
                  </h3>
                  <p>{{ a.content }}</p>
                  <small>{{ a.createdByName }} · {{ relativeDay(a.createdAt) }}</small>
                </article>
              } @empty {
                <app-empty-state compact icon="campaign" title="No announcements right now"></app-empty-state>
              }
            }
    </ng-template>

    <ng-template #aroundTpl>
              @for (p of birthdaysSoon(); track p.name) {
                <div class="row person">
                  <span class="av">@if (p.photo) { <img [src]="'data:image/jpeg;base64,' + p.photo" alt=""> } @else { {{ initials(p.name) }} }</span>
                  <span class="row-t">{{ p.name }}<small>Birthday {{ p.when }} · {{ p.department }}</small></span>
                  <mat-icon class="muted-ic" aria-hidden="true">cake</mat-icon>
                </div>
              }
              @for (p of newStarters(); track p.name) {
                <div class="row person">
                  <span class="av">@if (p.photo) { <img [src]="'data:image/jpeg;base64,' + p.photo" alt=""> } @else { {{ initials(p.name) }} }</span>
                  <span class="row-t">{{ p.name }}<small>Joined {{ p.when }} · {{ p.department }}</small></span>
                  <mat-icon class="muted-ic" aria-hidden="true">waving_hand</mat-icon>
                </div>
              }
              @if (!birthdaysSoon().length && !newStarters().length) {
                <app-empty-state compact icon="cake" title="Nothing coming up" message="Birthdays in the next two weeks and new starters show up here."></app-empty-state>
              }
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .home { max-width: 1240px; margin: 0 auto; padding: var(--space-5) var(--space-5) var(--space-8); display: grid; gap: var(--space-4); }

    .hello { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
    .hello-date { margin: 0 0 2px; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-3); }
    .hello h1 { margin: 0; font-size: var(--text-3xl); font-weight: 800; letter-spacing: -0.02em; color: var(--color-text); }
    .hello-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; align-items: center; }
    .sc { position: relative; }
    .sc-flow { border-color: var(--color-primary) !important; color: var(--color-primary) !important; }
    .sc-x { position: absolute; top: -8px; right: -8px; width: 20px; height: 20px; font-size: 14px; display: grid; place-items: center; border-radius: 50%; background: var(--color-danger); color: #fff; margin: 0 !important; }
    .edit-btn { color: var(--color-text-3); }
    .done-btn { border-color: var(--color-ok) !important; color: var(--color-ok) !important; }
    .edit-hint { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 14px; border-radius: var(--radius-md); background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--text-sm); font-weight: 600; }
    .edit-hint mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--space-4); align-items: start; grid-auto-flow: dense; }
    .size-sm { grid-column: span 3; }
    .size-md { grid-column: span 4; }
    .size-lg { grid-column: span 6; }
    .size-xl { grid-column: span 12; }
    .grid.editing .panel { position: relative; outline: 2px dashed transparent; outline-offset: 2px; transition: outline-color .15s, opacity .15s; }
    .grid.editing .panel:hover { outline-color: var(--color-line-strong); }
    .grid.editing .panel-h.handle { cursor: grab; user-select: none; }
    .grid.editing .panel-h.handle:hover { background: var(--color-surface-2); }
    .grid.is-dragging, .grid.is-dragging * { cursor: grabbing !important; }
    .grid.editing .panel.dragging { opacity: .35; outline-color: var(--color-primary); }
    .grid .panel::before, .grid .panel::after, .end-zone::before { content: ''; position: absolute; top: 0; bottom: 0; width: 4px; border-radius: 4px; background: var(--color-primary); opacity: 0; transition: opacity .1s; pointer-events: none; }
    .grid .panel::before { left: calc(var(--space-4) / -2 - 2px); }
    .grid .panel::after { right: calc(var(--space-4) / -2 - 2px); }
    .grid .panel.drop-before::before, .grid .panel.drop-after::after { opacity: 1; }
    .end-zone { position: relative; min-height: 64px; border: 2px dashed var(--color-line-strong); border-radius: var(--radius-md); display: grid; place-items: center; font-size: var(--text-sm); font-weight: 700; color: var(--color-text-3); }
    .end-zone.drop-before { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-soft); }
    .ghost { position: fixed; z-index: 1000; pointer-events: none; display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: var(--radius-md); background: var(--color-surface); border: 1px solid var(--color-primary); box-shadow: 0 12px 32px rgba(0,0,0,.25); font-size: var(--text-md); font-weight: 750; color: var(--color-text); transform: translate(-12px, -50%) rotate(-1deg); }
    .ghost mat-icon { color: var(--color-text-3); }
    .grip { color: var(--color-text-3); font-size: 18px; width: 18px; height: 18px; }
    .panel-tools { display: flex; align-items: center; gap: 4px; }
    .tool-sep { width: 1px; height: 18px; margin: 0 4px; background: var(--color-line); }
    .sz { min-width: 28px; height: 24px; padding: 0 6px; border: 1px solid var(--color-line); border-radius: 6px; background: var(--color-surface); font: 700 10px var(--font-body); color: var(--color-text-2); cursor: pointer; }
    .sz.on { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); }
    .rm { width: 28px; height: 28px; padding: 0; margin-left: 4px; color: var(--color-text-3); }
    .rm mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .empty-home { padding: var(--space-6); display: grid; place-items: center; }
    .link-row { text-decoration: none; }
    .link-row:hover { background: var(--color-surface-2); }
    .note { display: block; width: 100%; min-height: 120px; padding: var(--space-3) var(--space-4); border: 0; resize: vertical; background: var(--color-warn-soft); color: var(--color-text); font: 500 var(--text-md)/1.5 var(--font-body); }
    .note:focus { outline: none; }

    .panel { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; min-width: 0; }
    .panel-h { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: 12px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .panel-h h2 { margin: 0; display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-md); font-weight: 750; letter-spacing: 0; color: var(--color-text); }
    .count { min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--text-xs); font-weight: 800; }
    .panel-link { display: inline-flex; align-items: center; gap: 1px; padding: 0; border: 0; background: none; font: 700 var(--text-xs) var(--font-body); color: var(--color-primary); text-decoration: none; cursor: pointer; }
    .panel-link mat-icon { font-size: var(--text-md); width: 15px; height: 15px; }

    .row { display: flex; align-items: center; gap: var(--space-3); padding: 11px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .row:last-child { border-bottom: 0; }
    .row-t { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: var(--text-md); font-weight: 650; color: var(--color-text); }
    .row-t small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-btn { flex: none; }

    .ic { width: 34px; height: 34px; flex: none; border-radius: 9px; display: grid; place-items: center; }
    .ic mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }
    .tone-info { background: var(--color-primary-soft); color: var(--color-primary); }
    .tone-warn { background: var(--color-warn-soft); color: var(--color-warn); }
    .tone-danger { background: var(--color-danger-soft); color: var(--color-danger); }
    .tone-neutral { background: var(--color-surface-2); color: var(--color-text-2); }

    .tick { width: 22px; height: 22px; flex: none; padding: 0; border: 1.5px solid var(--color-line-strong); border-radius: 6px; background: var(--color-surface); display: grid; place-items: center; cursor: pointer; color: transparent; }
    .tick mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }
    .tick:hover { border-color: var(--color-ok); color: var(--color-ok); }
    .tick:disabled { opacity: .5; cursor: progress; }

    .del { padding: var(--space-4); display: grid; gap: 10px; }
    .del-big { font-size: var(--text-4xl); font-weight: 800; letter-spacing: -0.03em; line-height: 1; font-variant-numeric: tabular-nums; color: var(--color-text); }
    .del-big small { margin-left: var(--space-2); font-size: var(--text-sm); font-weight: 600; letter-spacing: 0; color: var(--color-text-3); }
    .bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--color-surface-2); }
    .bar.thin { height: 6px; }
    .bar i { display: block; height: 100%; }
    .b-ok { background: var(--color-ok); }
    .b-info { background: var(--color-primary); }
    .b-idle { background: var(--color-line-strong); }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: var(--text-xs); font-weight: 600; color: var(--color-text-2); }
    .legend span::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 2px; }
    .l-ok::before { background: var(--color-ok); }
    .l-info::before { background: var(--color-primary); }
    .l-idle::before { background: var(--color-line-strong); }
    .wh { display: grid; grid-template-columns: 96px minmax(0, 1fr) 32px; align-items: center; gap: var(--space-3); font-size: var(--text-xs); font-weight: 600; color: var(--color-text-2); }
    .wh-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wh-c { text-align: right; font-variant-numeric: tabular-nums; color: var(--color-text-3); }

    .ev { display: grid; grid-template-columns: 52px 3px minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); padding: 10px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .ev:last-child { border-bottom: 0; }
    .ev-tm { font-size: var(--text-xs); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-text-2); }
    .ev-ln { align-self: stretch; border-radius: 2px; background: var(--color-primary); }
    .ev-bday .ev-ln { background: var(--color-warn); }
    .ev-t { display: grid; gap: 2px; font-size: var(--text-md); font-weight: 650; color: var(--color-text); min-width: 0; }
    .ev-t small { font-size: var(--text-xs); font-weight: 500; color: var(--color-text-3); }

    .ann { padding: 12px var(--space-4); border-bottom: 1px solid var(--color-line); }
    .ann:last-child { border-bottom: 0; }
    .ann h3 { margin: 0 0 4px; display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; font-size: var(--text-md); font-weight: 700; letter-spacing: 0; color: var(--color-text); }
    .ann p { margin: 0 0 6px; font-size: var(--text-sm); line-height: 1.5; color: var(--color-text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ann small { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }

    .av { width: 34px; height: 34px; flex: none; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--text-xs); font-weight: 800; }
    .av img { width: 100%; height: 100%; object-fit: cover; }
    .muted-ic { color: var(--color-text-3); font-size: var(--text-xl); width: 18px; height: 18px; }

    @media (max-width: 1000px) {
      .size-sm { grid-column: span 6; }
      .size-md, .size-lg { grid-column: span 12; }
    }
    @media (max-width: 600px) {
      .home { padding: var(--space-4) var(--space-4) var(--space-6); }
      .hello-actions { width: 100%; }
      .size-sm { grid-column: span 12; }
    }
  `]
})
export class HomeComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly announcementService = inject(AnnouncementService);
  private readonly management = inject(ManagementService);
  private readonly paperless = inject(PaperlessService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly layouts = inject(HomeLayoutService);
  private readonly flowsStore = inject(HomeFlowsStore);
  private readonly apiUrl = environment.apiUrl;

  // ── Layout (widgets + shortcuts) ──────────────────────────
  readonly layout = signal<HomeLayout>(this.layouts.cached() ?? this.layouts.defaultLayout());
  readonly editing = signal(false);
  readonly dragId = signal<string | null>(null);
  readonly dropId = signal<string | null>(null);
  readonly dropSide = signal<'before' | 'after'>('before');
  readonly ghost = signal({ x: 0, y: 0, w: 240 });
  private pendingGrab: { id: string; x: number; y: number } | null = null;
  private readonly onMove = (e: PointerEvent) => this.pointerMove(e);
  private readonly onUp = (e: PointerEvent) => this.pointerUp(e);
  readonly sizeLabel = SIZE_LABEL;
  private dragShortcutId: string | null = null;
  private readonly saveQueue = new Subject<HomeLayout>();

  readonly today = new Date();
  readonly greeting = this.today.getHours() < 12 ? 'Good morning' : this.today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  readonly firstName = (this.auth.currentUserValue?.name ?? '').split(' ')[0] || 'there';
  private readonly userId = this.auth.currentUserValue?.userId ?? 0;
  readonly canLogistics = this.auth.hasModulePermission('logistics');
  private readonly canHr = this.auth.hasModulePermission('human_resource') || this.auth.currentUserValue?.role === 'HR';

  readonly tasks = signal<HomeTask[]>([]);
  readonly tasksLoading = signal(true);
  readonly completing = signal<number | null>(null);
  readonly meetings = signal<HomeMeeting[]>([]);
  readonly meetingsLoading = signal(true);
  readonly announcements = signal<AnnouncementListItem[]>([]);
  readonly announcementsLoading = signal(true);
  readonly deliveries = signal<DeliveriesToday | null>(null);
  readonly deliveriesFailed = signal(false);
  readonly birthdaysToday = signal<Person[]>([]);
  readonly birthdaysSoon = signal<Person[]>([]);
  readonly newStarters = signal<Person[]>([]);

  private readonly approvals = signal<ApprovalItem[]>([]);
  private readonly leavePending = signal(0);
  private readonly podBacklog = signal(0);
  readonly waitingLoading = signal(true);

  /** Tasks the person has accepted and not finished, soonest first. */
  readonly openTasks = computed(() => this.tasks()
    .filter(t => !t.isCompleted && t.status !== 'Pending' && t.status !== 'Declined')
    .slice(0, 6));

  /** Tasks a colleague gave this person that they haven't accepted or declined yet. */
  private readonly taskRequests = computed(() => this.tasks()
    .filter(t => !t.isCompleted && t.status === 'Pending' && !t.isSelfAssigned));

  readonly waiting = computed<WaitingRow[]>(() => {
    const rows: WaitingRow[] = [];
    for (const a of this.approvals().slice(0, 4)) {
      rows.push({
        icon: 'draw', tone: 'warn',
        title: `${a.name} needs your ${a.myRole === 'approver' ? 'approval' : 'signature'}`,
        detail: [a.createdBy && `From ${a.createdBy}`, this.relativeDay(a.updatedAt)].filter(Boolean).join(' · '),
        button: 'Open', run: () => this.paperless.openInViewer(a.id)
      });
    }
    if (this.approvals().length > 4) {
      rows.push({
        icon: 'draw', tone: 'neutral', title: `${this.approvals().length - 4} more documents to sign`,
        detail: 'In Paperless', button: 'Open Paperless', run: () => this.paperless.open('right')
      });
    }
    const leave = this.leavePending();
    if (leave) {
      rows.push({
        icon: 'beach_access', tone: 'info', title: `${leave} leave ${leave === 1 ? 'request' : 'requests'} to approve`,
        detail: 'People · Leave', button: 'Review', run: () => this.go('/people')
      });
    }
    const pods = this.podBacklog();
    if (pods) {
      rows.push({
        icon: 'receipt_long', tone: 'danger', title: `${pods} delivered ${pods === 1 ? 'load has' : 'loads have'} no proof of delivery`,
        detail: "They can't be invoiced until a POD is attached", button: 'Check', run: () => this.go('/logistics/pods')
      });
    }
    for (const t of this.taskRequests().slice(0, 3)) {
      rows.push({
        icon: 'assignment_ind', tone: 'neutral', title: t.title,
        detail: `${t.createdByUserName} gave you this task · ${this.dueText(t)}`,
        button: 'Answer', run: () => this.openTodo()
      });
    }
    return rows;
  });

  readonly kpis = computed<KpiItem[]>(() => {
    const items: KpiItem[] = [{
      label: 'Waiting for you', icon: 'pending_actions',
      value: this.waitingLoading() ? null : this.waitingCount(),
      action: this.waitingCount() ? { label: 'Review', run: () => document.getElementById('waiting')?.scrollIntoView({ behavior: 'smooth' }) } : undefined,
      note: this.waitingCount() ? undefined : 'All clear'
    }];
    if (this.canLogistics) {
      const d = this.deliveries();
      items.push({
        label: 'Deliveries today', icon: 'local_shipping',
        value: d ? d.total : (this.deliveriesFailed() ? '–' : null), unit: d?.total === 1 ? 'load' : 'loads',
        note: d ? `${d.delivered} delivered so far` : undefined
      });
      items.push({
        label: 'Overdue loads', icon: 'schedule',
        value: d ? d.overdue : (this.deliveriesFailed() ? '–' : null),
        tone: d?.overdue ? 'danger' : 'default',
        link: d?.overdue ? { label: 'See loads', route: '/logistics/loads' } : undefined,
        note: d && !d.overdue ? 'None from earlier days' : undefined
      });
    } else {
      items.push({
        label: 'Meetings today', icon: 'event',
        value: this.meetingsLoading() ? null : this.meetings().length,
        link: { label: 'Calendar', route: '/calendar' }
      });
    }
    const week = this.dueThisWeek();
    items.push({
      label: 'Your tasks due this week', icon: 'task_alt',
      value: this.tasksLoading() ? null : week.total,
      tone: week.overdue ? 'warn' : 'default',
      note: week.overdue ? `${week.overdue} overdue` : week.today ? `${week.today} due today` : undefined
    });
    return items;
  });

  ngOnInit(): void {
    this.layouts.load().subscribe(l => this.layout.set(l));
    this.saveQueue.pipe(debounceTime(600)).subscribe(l => this.layouts.save(l).subscribe({
      error: () => this.toast.error("Couldn't save your Home layout. It's kept on this device for now.")
    }));
    this.loadTasks();
    this.loadMeetings();
    this.loadWaiting();
    this.loadAnnouncements();
    this.loadPeople();
    if (this.canLogistics) this.loadDeliveries();
  }

  // ── Layout editing ────────────────────────────────────────

  title(w: HomeWidget): string {
    return w.config?.['title'] || widgetMeta(w.type).name;
  }

  sizesFor(w: HomeWidget): WidgetSize[] { return widgetMeta(w.type).sizes; }

  private commit(mutate: (l: HomeLayout) => void): void {
    const next = structuredClone(this.layout());
    mutate(next);
    this.layout.set(next);
    this.saveQueue.next(next);
  }

  resize(w: HomeWidget, size: WidgetSize): void {
    this.commit(l => { const x = l.widgets.find(v => v.id === w.id); if (x) x.size = size; });
  }

  removeWidget(id: string): void {
    this.commit(l => { l.widgets = l.widgets.filter(w => w.id !== id); });
  }

  removeShortcut(id: string): void {
    this.commit(l => { l.shortcuts = l.shortcuts.filter(s => s.id !== id); });
  }

  noteChanged(w: HomeWidget, text: string): void {
    this.commit(l => { const x = l.widgets.find(v => v.id === w.id); if (x) x.config = { ...(x.config ?? {}), text }; });
  }

  openCustomize(tab: 0 | 1): void {
    const ref = this.dialog.open(HomeCustomizeDialogComponent, { width: '860px', maxWidth: '95vw', data: { layout: this.layout() }, autoFocus: false });
    ref.componentInstance.tab = tab;
    ref.afterClosed().subscribe((l: HomeLayout | undefined) => { if (l) { this.layout.set(l); this.saveQueue.next(l); this.editing.set(true); } });
  }

  finishEditing(): void {
    this.editing.set(false);
    this.pendingGrab = null;
    this.dragId.set(null); this.dropId.set(null);
  }

  resetLayout(): void {
    this.layouts.reset().subscribe(() => { this.layout.set(this.layouts.defaultLayout()); this.toast.done('Home is back to the default layout.'); });
  }

  titleById(id: string): string {
    const w = this.layout().widgets.find(x => x.id === id);
    return w ? this.title(w) : '';
  }

  nudge(id: string, d: number): void {
    this.commit(l => {
      const a = l.widgets.findIndex(w => w.id === id), b = a + d;
      if (a < 0 || b < 0 || b >= l.widgets.length) return;
      [l.widgets[a], l.widgets[b]] = [l.widgets[b], l.widgets[a]];
    });
  }

  // Widget drag & drop: pointer-based (works with mouse, touch and pen; inner buttons don't interfere).
  // The drag starts after the pointer moves a few pixels so a plain click on the title still works.
  grab(e: PointerEvent, id: string): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, a, input, textarea')) return;
    e.preventDefault();
    this.pendingGrab = { id, x: e.clientX, y: e.clientY };
    document.addEventListener('pointermove', this.onMove);
    document.addEventListener('pointerup', this.onUp, { once: true });
    document.addEventListener('pointercancel', this.onUp, { once: true });
  }

  private pointerMove(e: PointerEvent): void {
    if (this.pendingGrab && !this.dragId()) {
      if (Math.hypot(e.clientX - this.pendingGrab.x, e.clientY - this.pendingGrab.y) < 6) return;
      const el = document.querySelector<HTMLElement>(`[data-wid="${this.pendingGrab.id}"]`);
      this.ghost.set({ x: e.clientX, y: e.clientY, w: Math.min(el?.offsetWidth ?? 240, 320) });
      this.dragId.set(this.pendingGrab.id);
      document.body.style.userSelect = 'none';
    }
    if (!this.dragId()) return;
    e.preventDefault();
    this.ghost.update(g => ({ ...g, x: e.clientX, y: e.clientY }));

    // Find the widget under the pointer and whether we're on its left or right half.
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const target = under?.closest<HTMLElement>('[data-wid]');
    const id = target?.dataset['wid'];
    if (!target || !id || id === this.dragId()) {
      // Not over a widget: pick the nearest one in the grid by distance to its centre.
      const best = this.nearestWidget(e.clientX, e.clientY);
      if (best) { this.dropId.set(best.id); this.dropSide.set(best.side); }
      return;
    }
    if (id === '__end') { this.dropId.set('__end'); this.dropSide.set('before'); return; }
    const r = target.getBoundingClientRect();
    this.dropId.set(id);
    this.dropSide.set(e.clientX < r.left + r.width / 2 ? 'before' : 'after');

    // Keep the page scrolling when dragging near the top/bottom edge.
    const edge = 56;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }

  private nearestWidget(x: number, y: number): { id: string; side: 'before' | 'after' } | null {
    let best: { id: string; side: 'before' | 'after'; d: number } | null = null;
    document.querySelectorAll<HTMLElement>('.grid [data-wid]').forEach(el => {
      const id = el.dataset['wid']!;
      if (id === this.dragId()) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, (y - cy) * 1.6); // favour same-row targets
      const side: 'before' | 'after' = id !== '__end' && x >= cx ? 'after' : 'before';
      if (!best || d < best.d) best = { id, side, d };
    });
    return best;
  }

  private pointerUp(_e: PointerEvent): void {
    document.removeEventListener('pointermove', this.onMove);
    document.removeEventListener('pointerup', this.onUp);
    document.removeEventListener('pointercancel', this.onUp);
    document.body.style.userSelect = '';
    const from = this.dragId(), to = this.dropId(), side = this.dropSide();
    this.pendingGrab = null;
    this.dragId.set(null); this.dropId.set(null);
    if (!from || !to || from === to) return;
    this.commit(l => {
      const a = l.widgets.findIndex(w => w.id === from);
      if (a < 0) return;
      const [moved] = l.widgets.splice(a, 1);
      if (to === '__end') { l.widgets.push(moved); return; }
      const b = l.widgets.findIndex(w => w.id === to);
      if (b < 0) { l.widgets.splice(a, 0, moved); return; }
      l.widgets.splice(side === 'before' ? b : b + 1, 0, moved);
    });
  }

  dragShortcut(id: string): void { this.dragShortcutId = id; }
  dropShortcut(e: DragEvent, targetId: string): void {
    e.preventDefault();
    const from = this.dragShortcutId; this.dragShortcutId = null;
    if (!from || from === targetId) return;
    this.commit(l => {
      const a = l.shortcuts.findIndex(s => s.id === from), b = l.shortcuts.findIndex(s => s.id === targetId);
      if (a < 0 || b < 0) return;
      const [moved] = l.shortcuts.splice(a, 1);
      l.shortcuts.splice(b, 0, moved);
    });
  }

  runShortcut(s: HomeShortcut): void {
    if (this.editing()) return;
    if (s.flowId) { this.flowsStore.attach(); this.flowsStore.startById(s.flowId); return; }
    if (s.target === 'action:leave') { this.applyForLeave(); return; }
    if (s.target === 'action:todo') { this.openTodo(); return; }
    if (this.isExternal(s.target)) { window.open(s.target, '_blank', 'noopener'); return; }
    this.go(s.target);
  }

  isExternal(url: string): boolean { return /^https?:\/\//i.test(url); }

  openLink(e: MouseEvent, url: string): void {
    if (this.isExternal(url)) return;
    e.preventDefault();
    this.go(url);
  }

  // ── Loading ───────────────────────────────────────────────

  private loadTasks(): void {
    if (!this.userId) { this.tasksLoading.set(false); return; }
    this.http.get<HomeTask[]>(`${this.apiUrl}/todo/my-tasks/${this.userId}`).subscribe({
      next: tasks => { this.tasks.set(tasks ?? []); this.tasksLoading.set(false); },
      error: () => this.tasksLoading.set(false)
    });
  }

  private loadMeetings(): void {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    this.http.get<HomeMeeting[]>(`${this.apiUrl}/meetings/calendar?startDate=${start.toISOString()}&endDate=${end.toISOString()}`).subscribe({
      next: list => {
        const declined = (m: HomeMeeting) => (m.responseStatus || '').toLowerCase() === 'declined';
        this.meetings.set((list ?? [])
          .filter(m => !declined(m) && new Date(m.start) < end && new Date(m.end) >= start)
          .sort((a, b) => +new Date(a.start) - +new Date(b.start)));
        this.meetingsLoading.set(false);
      },
      error: () => this.meetingsLoading.set(false)
    });
  }

  /** Approvals, leave and the POD backlog load together so the count doesn't jump around. */
  private loadWaiting(): void {
    forkJoin({
      approvals: this.management.getApprovals().pipe(catchError(() => of({ pending: [], actioned: [] }))),
      leave: this.canHr
        ? this.http.get<{ pending: number }>(`${this.apiUrl}/leave-requests/counts`).pipe(catchError(() => of({ pending: 0 })))
        : of({ pending: 0 }),
      pods: this.canLogistics
        ? this.http.get<{ count: number }>(`${this.apiUrl}/logistics/loads/delivered-without-pod`).pipe(catchError(() => of({ count: 0 })))
        : of({ count: 0 })
    }).subscribe(r => {
      // Same rule as the Paperless inbox: I sign or approve, and haven't yet.
      this.approvals.set((r.approvals.pending ?? []).filter(a =>
        (a.myRole === 'signer' || a.myRole === 'approver') && !['signed', 'approved', 'declined'].includes((a.myState || '').toLowerCase())));
      this.leavePending.set(r.leave?.pending ?? 0);
      this.podBacklog.set(r.pods?.count ?? 0);
      this.waitingLoading.set(false);
    });
  }

  private loadAnnouncements(): void {
    this.announcementService.getAnnouncements(true, 3).subscribe({
      next: list => { this.announcements.set(list ?? []); this.announcementsLoading.set(false); },
      error: () => this.announcementsLoading.set(false)
    });
  }

  private loadDeliveries(): void {
    this.http.get<DeliveriesToday>(`${this.apiUrl}/logistics/loads/today-summary`).subscribe({
      next: d => this.deliveries.set(d),
      error: () => this.deliveriesFailed.set(true)
    });
  }

  /** Birthdays and new starters from the staff list. Staff without a stored date of birth are skipped. */
  private loadPeople(): void {
    this.api.getEmployees().subscribe({
      next: employees => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const in14 = new Date(today); in14.setDate(today.getDate() + 14);
        const ago30 = new Date(today); ago30.setDate(today.getDate() - 30);
        const todayList: Person[] = [];
        const soon: { p: Person; next: Date }[] = [];
        for (const e of employees ?? []) {
          const raw = e.dateOfBirth || e.birthday || e.dob;
          const dob = raw ? new Date(raw) : null;
          if (!dob || isNaN(dob.getTime())) continue;
          let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
          if (next < today) next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
          const p: Person = { name: e.fullName, department: e.department, when: '', photo: e.photoBase64 };
          if (+next === +today) todayList.push(p);
          else if (next <= in14) soon.push({ p: { ...p, when: this.onDay(next, true) }, next });
        }
        this.birthdaysToday.set(todayList);
        this.birthdaysSoon.set(soon.sort((a, b) => +a.next - +b.next).slice(0, 4).map(x => x.p));
        this.newStarters.set((employees ?? [])
          .filter(e => e.hireDate && new Date(e.hireDate) >= ago30 && new Date(e.hireDate) <= new Date())
          .sort((a, b) => +new Date(b.hireDate) - +new Date(a.hireDate))
          .slice(0, 3)
          .map(e => ({ name: e.fullName, department: e.department, when: this.onDay(e.hireDate), photo: e.photoBase64 })));
      },
      error: () => { /* the panel stays hidden */ }
    });
  }

  // ── Actions ───────────────────────────────────────────────

  completeTask(t: HomeTask): void {
    this.completing.set(t.id);
    this.http.post(`${this.apiUrl}/todo/${t.id}/complete`, {}).subscribe({
      next: () => {
        this.completing.set(null);
        this.tasks.update(list => list.map(x => x.id === t.id ? { ...x, isCompleted: true, status: 'Completed' } : x));
        this.toast.done(`Done: ${t.title}`);
      },
      error: () => {
        this.completing.set(null);
        this.toast.error("Couldn't mark that task as done. Try again, or open it in To-do.");
      }
    });
  }

  applyForLeave(): void {
    this.dialog.open(LeaveRequestDialogComponent, { width: '900px', autoFocus: false, panelClass: 'no-scroll-dialog' });
  }

  openTodo(): void {
    const ref = this.dialog.open(TodoDialogComponent, {
      width: '1200px', maxWidth: '95vw', maxHeight: '85vh', data: { userId: this.userId }
    });
    ref.afterClosed().subscribe(() => this.loadTasks());
  }

  private go(path: string): void {
    this.router.navigateByUrl(path);
  }

  // ── Formatting ────────────────────────────────────────────

  private waitingCount(): number {
    return this.approvals().length + this.leavePending() + this.podBacklog() + this.taskRequests().length;
  }

  private dueThisWeek(): { total: number; today: number; overdue: number } {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 7);
    let total = 0, today = 0, overdue = 0;
    for (const t of this.tasks()) {
      if (t.isCompleted || t.status === 'Declined') continue;
      const due = new Date(t.dueDate); due.setHours(0, 0, 0, 0);
      if (due < start) { overdue++; total++; }
      else if (due < end) { total++; if (+due === +start) today++; }
    }
    return { total, today, overdue };
  }

  private daysFromToday(value: string | Date): number {
    const d = new Date(value); d.setHours(0, 0, 0, 0);
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((+d - +t) / 86400000);
  }

  dueText(t: HomeTask): string {
    const n = this.daysFromToday(t.dueDate);
    if (n === 0) return 'Due today';
    if (n === 1) return 'Due tomorrow';
    if (n < 0) return n === -1 ? 'Was due yesterday' : `Overdue by ${-n} days`;
    return `Due ${this.relativeDay(t.dueDate, true)}`;
  }

  dueTone(t: HomeTask): { label: string; tone: 'danger' | 'warn' } | null {
    const n = this.daysFromToday(t.dueDate);
    if (n < 0) return { label: 'Overdue', tone: 'danger' };
    if (n === 0) return { label: 'Today', tone: 'warn' };
    if (t.priority === 'Urgent' || t.priority === 'High') return { label: t.priority, tone: 'warn' };
    return null;
  }

  /** "today", "yesterday", "Wednesday", or "3 Nov". Future dates read "on Friday" style when `future` is set. */
  relativeDay(value: string | Date, future = false): string {
    const n = this.daysFromToday(value);
    const d = new Date(value);
    if (n === 0) return 'today';
    if (n === -1) return 'yesterday';
    if (n === 1) return 'tomorrow';
    if ((future ? n > 0 : n < 0) && Math.abs(n) < 7) return d.toLocaleDateString('en-ZA', { weekday: 'long' });
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }

  /** relativeDay for use after a verb: "tomorrow", "on Friday", "on 3 Nov". */
  private onDay(value: string | Date, future = false): string {
    const r = this.relativeDay(value, future);
    return ['today', 'yesterday', 'tomorrow'].includes(r) ? r : `on ${r}`;
  }

  isAllDay(m: HomeMeeting): boolean {
    const s = new Date(m.start), e = new Date(m.end);
    return s.getHours() === 0 && s.getMinutes() === 0 && (+e - +s) >= 86400000 - 60000;
  }

  needsReply(m: HomeMeeting): boolean {
    return (m.responseStatus || '').toLowerCase() === 'pending';
  }

  meetingDetail(m: HomeMeeting): string {
    const mins = Math.round((+new Date(m.end) - +new Date(m.start)) / 60000);
    const length = this.isAllDay(m) ? '' : mins >= 60 ? `${Math.floor(mins / 60)} h${mins % 60 ? ' ' + (mins % 60) + ' min' : ''}` : `${mins} min`;
    return [m.location, length].filter(Boolean).join(' · ');
  }

  pct(part: number, total: number): number {
    return total ? Math.round((part / total) * 1000) / 10 : 0;
  }

  initials(name: string): string {
    return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
  }
}
