import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthStore } from './core/auth';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="bar">
    <header class="top">
      <a routerLink="/" class="brand"><span class="mark">✓</span> {{ brand }}</a>
      @if (auth.user(); as u) {
        <div class="who"><span class="nm">{{ u.name }}</span><button type="button" class="out" (click)="signOut()">Sign out</button></div>
      }
    </header>
    @if (auth.signedIn()) {
      <nav class="tabs">
        <div class="tabs-in">
          @if (showOverview()) { <a routerLink="/overview" routerLinkActive="on">Overview</a> }
          <a routerLink="/" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }" [class.on]="onPack()">Sign</a>
          <a routerLink="/payruns" routerLinkActive="on">Pay-runs</a>
          <a routerLink="/history" routerLinkActive="on">History</a>
        </div>
      </nav>
    }
    </div>
    <main class="wrap"><router-outlet /></main>
    <footer class="foot muted">Secure off-site approvals · every action is signed with your name, time and a tamper-evident hash.</footer>
  `,
  styles: [`
    .bar { position: sticky; top: 0; z-index: 5; }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: #1e1b4b; color: #fff; padding-top: calc(12px + env(safe-area-inset-top)); }
    .brand { color: #fff; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 10px; }
    .mark { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: #4f46e5; font-size: 18px; }
    .who { display: flex; align-items: center; gap: 10px; font-size: 14px; } .nm { opacity: .9; max-width: 40vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .out { background: transparent; color: #c7d2fe; border: 1px solid #4338ca; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
    .tabs { background: #1e1b4b; border-top: 1px solid #312e81; }
    .tabs-in { max-width: 860px; margin: 0 auto; display: flex; overflow-x: auto; scrollbar-width: none; }
    .tabs a { flex: 1; text-align: center; white-space: nowrap; padding: 11px 12px; color: #c7d2fe; text-decoration: none; font-size: 14px; font-weight: 600; border-bottom: 3px solid transparent; }
    .tabs a.on { color: #fff; border-bottom-color: #818cf8; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 16px; padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
    .foot { text-align: center; font-size: 12px; padding: 8px 16px 24px; }
  `]
})
export class App {
  auth = inject(AuthStore); private router = inject(Router);
  brand = environment.brandName;
  private url = toSignal(this.router.events.pipe(filter(e => e instanceof NavigationEnd), map(() => this.router.url)), { initialValue: this.router.url });
  /** A pack opened from Sign keeps the Sign tab highlighted. */
  onPack = computed(() => this.url().startsWith('/pack/'));
  /** Accountants and clerks don't get the executive overview (the server refuses it too). */
  showOverview = computed(() => !['accountant', 'clerk', 'creditor clerk', 'debtor clerk'].includes((this.auth.user()?.role ?? '').trim().toLowerCase()));
  signOut() { this.auth.clear(); this.router.navigate(['/login']); }
}
