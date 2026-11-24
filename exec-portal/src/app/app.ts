import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from './core/auth';
import { Api } from './core/api';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="top">
      <div class="top-in">
        <a routerLink="/" class="brand" aria-label="Home">
          <span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
          <span class="bt"><b>{{ brand }}</b><small>Secure off-site approvals</small></span>
        </a>
        @if (auth.user(); as u) {
          <div class="who">
            <span class="av" [title]="u.name">{{ initials() }}</span>
            <span class="nm"><b>{{ u.name }}</b><small>{{ u.role }}</small></span>
            <button type="button" class="out" (click)="signOut()" title="Sign out" aria-label="Sign out">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>
              <span>Sign out</span>
            </button>
          </div>
        }
      </div>
    </header>
    @if (auth.signedIn()) {
      <nav class="tabs" aria-label="Sections">
        <div class="tabs-in">
          @if (showOverview()) {
            <a routerLink="/overview" routerLinkActive="on">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
              <span>Overview</span>
            </a>
          }
          <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" [class.on]="onPack()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            <span>Sign</span>
            @if (waiting() > 0) { <i class="badge">{{ waiting() > 99 ? '99+' : waiting() }}</i> }
          </a>
          <a routerLink="/payruns" routerLinkActive="on">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>
            <span>Pay-runs</span>
          </a>
          <a routerLink="/history" routerLinkActive="on">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>
            <span>History</span>
          </a>
        </div>
      </nav>
    }
    <main class="wrap" [class.login]="!auth.signedIn()"><router-outlet /></main>
    <footer class="foot" [class.login]="!auth.signedIn()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      Every action is signed with your name, time and a tamper-evident hash.
    </footer>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
    .top { background: radial-gradient(1200px 300px at 0% -50%, #2f2a7a 0%, transparent 60%), var(--nav); color: #fff; padding-top: env(safe-area-inset-top); }
    .top-in { max-width: 1040px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; }
    .brand { color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 11px; min-width: 0; }
    .mark { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #4338ca); box-shadow: 0 4px 12px rgba(79, 70, 229, .45), inset 0 1px 0 rgba(255,255,255,.2); flex: 0 0 auto; }
    .mark svg { width: 19px; height: 19px; }
    .bt { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; } .bt b { font-size: 15.5px; font-weight: 700; letter-spacing: -.01em; white-space: nowrap; } .bt small { font-size: 11.5px; color: #a5b4fc; }
    .who { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .av { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #312e81; border: 1px solid #4338ca; font-size: 13px; font-weight: 700; color: #e0e7ff; flex: 0 0 auto; }
    .nm { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; max-width: 26vw; } .nm b { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .nm small { font-size: 11.5px; color: #a5b4fc; }
    .out { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,255,255,.06); color: #c7d2fe; border: 1px solid rgba(165, 180, 252, .25); border-radius: 10px; padding: 7px 11px; cursor: pointer; font-size: 13px; font-weight: 500; }
    .out:hover { background: rgba(255,255,255,.12); color: #fff; } .out svg { width: 16px; height: 16px; }

    /* Desktop / tablet: tab strip pinned under the header. */
    .tabs { position: sticky; top: env(safe-area-inset-top); z-index: 5; background: rgba(255,255,255,.88); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--line); }
    .tabs-in { max-width: 1040px; margin: 0 auto; display: flex; gap: 4px; padding: 0 14px; }
    .tabs a { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 13px 14px 12px; color: var(--muted); text-decoration: none; font-size: 14px; font-weight: 600; border-bottom: 2px solid transparent; transition: color .15s; }
    .tabs a:hover { color: var(--ink); }
    .tabs a.on { color: var(--brand); border-bottom-color: var(--brand); }
    .tabs svg { width: 18px; height: 18px; flex: 0 0 auto; }
    .badge { font-style: normal; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: #ef4444; color: #fff; font-size: 11.5px; font-weight: 700; display: inline-grid; place-items: center; line-height: 1; box-shadow: 0 0 0 2px #fff; }

    .wrap { max-width: 1040px; margin: 0 auto; padding: 22px 20px 32px; }
    .foot { display: flex; align-items: center; justify-content: center; gap: 6px; text-align: center; font-size: 12px; color: var(--muted); padding: 6px 16px 28px; }
    .foot svg { width: 13px; height: 13px; flex: 0 0 auto; }

    /* Phones: thumb-reach tab bar along the bottom, compact header. */
    @media (max-width: 759px) {
      .top-in { padding: 10px 14px; } .bt small, .nm, .out span { display: none; } .out { padding: 7px 8px; } .mark { width: 30px; height: 30px; } .bt b { font-size: 15px; }
      .tabs { position: fixed; top: auto; bottom: 0; left: 0; right: 0; border-top: 1px solid var(--line); border-bottom: 0; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -6px 20px -12px rgba(15, 23, 42, .25); }
      .tabs-in { padding: 0; gap: 0; }
      .tabs a { flex: 1 1 0; flex-direction: column; gap: 3px; padding: 8px 4px 7px; font-size: 11px; border-bottom: 0; border-top: 2px solid transparent; }
      .tabs a.on { border-top-color: var(--brand); border-bottom-color: transparent; }
      .tabs svg { width: 22px; height: 22px; }
      .badge { position: absolute; top: 3px; left: calc(50% + 6px); min-width: 18px; height: 18px; font-size: 10.5px; padding: 0 5px; }
      .wrap { padding: 16px 14px 12px; }
      .foot { padding-bottom: calc(84px + env(safe-area-inset-bottom)); } .foot.login { padding-bottom: 24px; }
    }
  `]
})
export class App {
  auth = inject(AuthStore); private router = inject(Router); private api = inject(Api);
  brand = environment.brandName;
  private url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  /** A pack opened from Sign keeps the Sign tab highlighted. */
  onPack = computed(() => this.url().startsWith('/pack/'));
  /** Accountants and clerks don't get the executive overview (the server refuses it too). */
  showOverview = computed(() => !['accountant', 'clerk', 'creditor clerk', 'debtor clerk'].includes((this.auth.user()?.role ?? '').trim().toLowerCase()));
  initials = computed(() => (this.auth.user()?.name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('') || '•');

  /** Packs waiting for you + director queries to answer — the red count on Sign. Refreshed on navigation, at most once a minute. */
  waiting = signal(0);
  private lastCount = 0;
  constructor() {
    effect(() => {
      this.url();
      if (!this.auth.signedIn()) { this.waiting.set(0); this.lastCount = 0; return; }
      if (Date.now() - this.lastCount < 60_000) return;
      this.lastCount = Date.now();
      let packs = 0, qs = 0;
      this.api.inbox().subscribe({ next: r => { packs = r.length; this.waiting.set(packs + qs); }, error: () => { } });
      this.api.queries().subscribe({ next: q => { qs = q.filter(x => x.state === 'Open').length; this.waiting.set(packs + qs); }, error: () => { } });
    });
  }
  signOut() { this.auth.clear(); this.router.navigate(['/login']); }
}
