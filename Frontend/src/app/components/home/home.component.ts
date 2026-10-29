import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { catchError, forkJoin, of } from 'rxjs';

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
 * Home: what needs the signed-in person today (design review D-07). Every panel loads on
 * its own, shows a skeleton while loading and says plainly when there's nothing to do.
 * Panels for modules the person can't open are left out. The old company feed is at /welcome.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    DatePipe, RouterLink, MatButtonModule, MatIconModule, NavbarComponent,
    EmptyStateComponent, KpiStripComponent, StatusChipComponent, SkeletonRowsComponent
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
          <button mat-stroked-button (click)="applyForLeave()"><mat-icon>event_available</mat-icon>Apply for leave</button>
          <button mat-stroked-button (click)="openTodo()"><mat-icon>add_task</mat-icon>Add a task</button>
          <a mat-stroked-button routerLink="/welcome"><mat-icon>campaign</mat-icon>Company news</a>
        </div>
      </div>

      <app-kpi-strip [items]="kpis()"></app-kpi-strip>

      <div class="cols">
        <div class="stack">
          <section class="panel" id="waiting" aria-labelledby="waiting-h">
            <div class="panel-h">
              <h2 id="waiting-h">Waiting for you @if (!waitingLoading() && waiting().length) { <span class="count">{{ waiting().length }}</span> }</h2>
            </div>
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
          </section>

          <section class="panel" aria-labelledby="tasks-h">
            <div class="panel-h">
              <h2 id="tasks-h">Your tasks</h2>
              <button type="button" class="panel-link" (click)="openTodo()">All tasks <mat-icon>chevron_right</mat-icon></button>
            </div>
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
          </section>
        </div>

        <div class="stack">
          @if (canLogistics) {
            <section class="panel" aria-labelledby="del-h">
              <div class="panel-h">
                <h2 id="del-h">Deliveries today</h2>
                <a class="panel-link" routerLink="/logistics">Logistics <mat-icon>chevron_right</mat-icon></a>
              </div>
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
            </section>
          }

          <section class="panel" aria-labelledby="today-h">
            <div class="panel-h">
              <h2 id="today-h">Today</h2>
              <a class="panel-link" routerLink="/calendar">Calendar <mat-icon>chevron_right</mat-icon></a>
            </div>
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
          </section>

          <section class="panel" aria-labelledby="ann-h">
            <div class="panel-h">
              <h2 id="ann-h">Announcements</h2>
              <a class="panel-link" routerLink="/welcome">All <mat-icon>chevron_right</mat-icon></a>
            </div>
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
          </section>

          @if (birthdaysSoon().length || newStarters().length) {
            <section class="panel" aria-labelledby="around-h">
              <div class="panel-h">
                <h2 id="around-h">Around the company</h2>
                <a class="panel-link" routerLink="/welcome">Company news <mat-icon>chevron_right</mat-icon></a>
              </div>
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
            </section>
          }
        </div>
      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }
    .home { max-width: 1240px; margin: 0 auto; padding: var(--space-5) var(--space-5) var(--space-8); display: grid; gap: var(--space-4); }

    .hello { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
    .hello-date { margin: 0 0 2px; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-3); }
    .hello h1 { margin: 0; font-size: var(--text-3xl); font-weight: 800; letter-spacing: -0.02em; color: var(--color-text); }
    .hello-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }

    .cols { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: var(--space-4); align-items: start; }
    .stack { display: grid; gap: var(--space-4); min-width: 0; }

    .panel { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; }
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
      .cols { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 600px) {
      .home { padding: var(--space-4) var(--space-4) var(--space-6); }
      .hello-actions { width: 100%; }
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
  private readonly apiUrl = environment.apiUrl;

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
    this.loadTasks();
    this.loadMeetings();
    this.loadWaiting();
    this.loadAnnouncements();
    this.loadPeople();
    if (this.canLogistics) this.loadDeliveries();
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
