import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Api } from '../core/api';
import { AuthStore } from '../core/auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="card login">
      @if (step() === 'password') {
        <h1>Sign in</h1>
        <p class="muted">Use your intranet e-mail and password. Only directors, accountants and the treasurer can approve here.</p>
        <form (ngSubmit)="login()" autocomplete="on">
          <label class="f">E-mail <input type="email" name="email" [(ngModel)]="email" autocomplete="username" inputmode="email" required autofocus></label>
          <label class="f">Password <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required></label>
          @if (error()) { <p class="err">{{ error() }}</p> }
          <button class="btn block" type="submit" [disabled]="busy() || !email || !password">{{ busy() ? 'Checking…' : 'Continue' }}</button>
        </form>
      } @else {
        <h1>Enter your code</h1>
        <p class="muted">We e-mailed a 6-digit code to <strong>{{ hint() }}</strong>. It expires in 10 minutes.</p>
        <form (ngSubmit)="verify()">
          <label class="f">Code <input type="text" name="code" [(ngModel)]="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" class="code" required autofocus></label>
          @if (error()) { <p class="err">{{ error() }}</p> }
          <button class="btn block" type="submit" [disabled]="busy() || code.length !== 6">{{ busy() ? 'Verifying…' : 'Sign in' }}</button>
          <button class="btn ghost block back" type="button" (click)="step.set('password'); error.set('')">Back</button>
        </form>
      }
    </div>
  `,
  styles: [`
    .login { max-width: 420px; margin: 8vh auto 0; }
    h1 { margin: 0 0 6px; font-size: 24px; } p { margin: 0 0 18px; }
    .code { letter-spacing: 10px; font-size: 26px; text-align: center; font-variant-numeric: tabular-nums; }
    .back { margin-top: 10px; } .err { margin-bottom: 14px; }
  `]
})
export class LoginPage {
  private api = inject(Api); private auth = inject(AuthStore); private router = inject(Router); private route = inject(ActivatedRoute);
  step = signal<'password' | 'code'>('password');
  email = ''; password = ''; code = '';
  challenge = ''; hint = signal('');
  busy = signal(false); error = signal('');

  login() {
    this.busy.set(true); this.error.set('');
    this.api.login(this.email.trim(), this.password).subscribe({
      next: r => { this.busy.set(false); if (r.token) this.done(r); else { this.challenge = r.challenge; this.hint.set(r.emailHint); this.step.set('code'); this.code = ''; } },
      error: e => { this.busy.set(false); this.error.set(e?.error?.message ?? 'Could not sign in. Check your connection and try again.'); }
    });
  }
  verify() {
    this.busy.set(true); this.error.set('');
    this.api.verify(this.challenge, this.code.trim()).subscribe({
      next: r => { this.busy.set(false); this.done(r); },
      error: e => { this.busy.set(false); this.error.set(e?.error?.message ?? 'That code did not work.'); if (e?.status === 401 && /sign in again/i.test(e?.error?.message ?? '')) this.step.set('password'); }
    });
  }
  private done(r: any) {
    this.auth.set({ token: r.token, expiresAt: r.expiresAt, user: r.user });
    const next = this.route.snapshot.queryParamMap.get('next');
    this.router.navigateByUrl(next && next.startsWith('/') && !next.startsWith('/login') ? next : '/');
  }
}
