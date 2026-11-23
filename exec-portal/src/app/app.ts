import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthStore } from './core/auth';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="top">
      <a routerLink="/" class="brand"><span class="mark">✓</span> {{ brand }}</a>
      @if (auth.user(); as u) {
        <div class="who"><span class="nm">{{ u.name }}</span><button type="button" class="out" (click)="signOut()">Sign out</button></div>
      }
    </header>
    <main class="wrap"><router-outlet /></main>
    <footer class="foot muted">Secure off-site approvals · every action is signed with your name, time and a tamper-evident hash.</footer>
  `,
  styles: [`
    .top { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: #1e1b4b; color: #fff; padding-top: calc(12px + env(safe-area-inset-top)); }
    .brand { color: #fff; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 10px; }
    .mark { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; background: #4f46e5; font-size: 18px; }
    .who { display: flex; align-items: center; gap: 10px; font-size: 14px; } .nm { opacity: .9; max-width: 40vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .out { background: transparent; color: #c7d2fe; border: 1px solid #4338ca; border-radius: 8px; padding: 6px 10px; cursor: pointer; }
    .wrap { max-width: 860px; margin: 0 auto; padding: 16px; padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
    .foot { text-align: center; font-size: 12px; padding: 8px 16px 24px; }
  `]
})
export class App {
  auth = inject(AuthStore); private router = inject(Router);
  brand = environment.brandName;
  signOut() { this.auth.clear(); this.router.navigate(['/login']); }
}
