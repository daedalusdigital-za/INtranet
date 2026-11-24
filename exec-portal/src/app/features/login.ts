import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TimeoutError, timeout } from 'rxjs';
import { Api } from '../core/api';
import { AuthStore } from '../core/auth';

/** The code step survives the phone reloading the tab while the user is in their mail app. */
const CHAL_KEY = 'exec-challenge';
interface SavedChallenge { challenge: string; hint: string; email: string; at: number; }

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="card login">
      @if (notice()) { <p class="note">{{ notice() }}</p> }
      @if (step() === 'password') {
        <h1>Sign in</h1>
        <p class="muted">Use your intranet e-mail and password. Only directors, accountants and the treasurer can approve here.</p>
        <form (ngSubmit)="login()" autocomplete="on">
          <label class="f">E-mail <input type="email" name="email" [(ngModel)]="email" autocomplete="username" inputmode="email" required autofocus></label>
          <label class="f">Password <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required></label>
          @if (error()) { <p class="err">{{ error() }}</p> }
          <button class="btn block" type="submit" [disabled]="busy() || !email || !password">{{ busy() ? 'Checking… this can take a few seconds' : 'Continue' }}</button>
        </form>
      } @else {
        <h1>Enter your code</h1>
        <p class="muted">We e-mailed a 6-digit code to <strong>{{ hint() }}</strong>. It expires in 10 minutes.</p>
        <form (ngSubmit)="verify()">
          <label class="f">Code
            <input type="text" name="code" [ngModel]="code()" (ngModelChange)="onCode($event)" inputmode="numeric" autocomplete="one-time-code"
                   class="code" placeholder="••••••" required autofocus [disabled]="busy()">
          </label>
          @if (error()) { <p class="err">{{ error() }}</p> }
          <button class="btn block" type="submit" [disabled]="busy() || code().length !== 6">{{ busy() ? 'Verifying…' : 'Sign in' }}</button>
          <div class="row2">
            <button class="btn ghost" type="button" (click)="back()" [disabled]="busy()">Back</button>
            @if (password) { <button class="btn ghost" type="button" (click)="resend()" [disabled]="busy()">Send a new code</button> }
          </div>
        </form>
      }
    </div>
  `,
  styles: [`
    .login { max-width: 420px; margin: 8vh auto 0; }
    h1 { margin: 0 0 6px; font-size: 24px; } p { margin: 0 0 18px; }
    .code { letter-spacing: 10px; font-size: 26px; text-align: center; font-variant-numeric: tabular-nums; }
    .row2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-top: 10px; }
    .err { margin-bottom: 14px; } .note { margin-bottom: 14px; }
  `]
})
export class LoginPage implements OnInit {
  private api = inject(Api); private auth = inject(AuthStore); private router = inject(Router); private route = inject(ActivatedRoute);
  step = signal<'password' | 'code'>('password');
  email = ''; password = '';
  code = signal('');
  challenge = ''; hint = signal('');
  busy = signal(false); error = signal(''); notice = signal('');

  ngOnInit() {
    if (this.route.snapshot.queryParamMap.get('expired')) this.notice.set('Your session ended. Please sign in again.');
    try {
      const s = JSON.parse(sessionStorage.getItem(CHAL_KEY) || 'null') as SavedChallenge | null;
      if (s && Date.now() - s.at < 10 * 60_000) { this.challenge = s.challenge; this.hint.set(s.hint); this.email = s.email; this.step.set('code'); }
      else sessionStorage.removeItem(CHAL_KEY);
    } catch { /* storage blocked — the code step just won't survive a reload */ }
  }

  login() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    this.api.login(this.email.trim(), this.password).pipe(timeout(60_000)).subscribe({
      next: r => {
        this.busy.set(false);
        if (r.token) { this.done(r); return; }
        this.challenge = r.challenge; this.hint.set(r.emailHint); this.code.set(''); this.step.set('code');
        try { sessionStorage.setItem(CHAL_KEY, JSON.stringify({ challenge: r.challenge, hint: r.emailHint, email: this.email.trim(), at: Date.now() } satisfies SavedChallenge)); } catch { }
      },
      error: e => { this.busy.set(false); this.error.set(this.message(e, 'Could not sign in. Check your connection and try again.')); }
    });
  }

  resend() { this.code.set(''); this.login(); }

  /** Keep digits only (codes pasted from the e-mail often carry spaces) and sign in as soon as all six are there. */
  onCode(v: string) {
    const digits = (v ?? '').replace(/\D/g, '').slice(0, 6);
    this.code.set(digits);
    if (digits.length === 6 && !this.busy()) this.verify();
  }

  verify() {
    const code = this.code();
    if (this.busy() || code.length !== 6) return;
    this.busy.set(true); this.error.set('');
    this.api.verify(this.challenge, code).pipe(timeout(30_000)).subscribe({
      next: r => { this.busy.set(false); this.done(r); },
      error: e => {
        this.busy.set(false); this.code.set('');
        const msg = this.message(e, 'That code did not work.');
        this.error.set(msg);
        if (e?.status === 401 && /sign in again/i.test(msg)) this.back(msg);
      }
    });
  }

  back(msg = '') {
    this.step.set('password'); this.code.set(''); this.challenge = '';
    try { sessionStorage.removeItem(CHAL_KEY); } catch { }
    this.error.set(msg);
  }

  private message(e: any, fallback: string): string {
    if (e instanceof TimeoutError) return 'The server is taking too long to answer. Check your connection and try again.';
    if (e?.status === 0) return 'Could not reach the server. Check your connection and try again.';
    if (e?.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return e?.error?.message ?? fallback;
  }

  private done(r: any) {
    if (!r?.token || !r?.expiresAt) { this.error.set('Sign-in did not complete. Please try again.'); return; }
    try { sessionStorage.removeItem(CHAL_KEY); } catch { }
    this.password = '';
    this.auth.set({ token: r.token, expiresAt: r.expiresAt, user: r.user });
    const next = this.route.snapshot.queryParamMap.get('next');
    this.router.navigateByUrl(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/');
  }
}
