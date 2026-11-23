import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../environments/environment';

/**
 * Public page opened from the "Set your Promed Intranet password" email an admin sends
 * (Admin → Users → Email a reset link). The token in ?token= is checked first so an expired
 * or used link says so straight away instead of after the user has typed a password.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <main class="page">
      <div class="card">
        <div class="wordmark"><span class="mark"><i></i><i></i><i></i></span>Promed Intranet</div>

        @switch (state) {
          @case ('checking') {
            <h1>Checking your link…</h1>
          }
          @case ('invalid') {
            <h1>This link no longer works</h1>
            <p class="lede">Reset links work once and expire after 24 hours. Ask IT support or an administrator to send you a new one.</p>
            <a mat-flat-button color="primary" class="submit" routerLink="/login">Go to sign in</a>
          }
          @case ('done') {
            <h1>Password changed</h1>
            <p class="lede">You can now sign in with your new password.</p>
            <button mat-flat-button color="primary" class="submit" type="button" (click)="goToLogin()">Sign in</button>
          }
          @default {
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="form">
              <div>
                <h1>Choose a new password</h1>
                <p class="lede">{{ name ? 'Hi ' + name + ', choose' : 'Choose' }} a password of at least 8 characters.</p>
              </div>

              <mat-form-field appearance="outline">
                <mat-label>New password</mat-label>
                <input matInput [type]="show ? 'text' : 'password'" formControlName="password" autocomplete="new-password" required
                       (keyup)="checkCapsLock($event)" (keydown)="checkCapsLock($event)" (blur)="capsLock = false">
                <button mat-icon-button matSuffix type="button" (click)="show = !show"
                        [attr.aria-label]="show ? 'Hide password' : 'Show password'" [attr.aria-pressed]="show">
                  <mat-icon>{{ show ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (form.get('password')?.hasError('required')) {
                  <mat-error>Enter a new password</mat-error>
                } @else if (form.get('password')?.hasError('minlength')) {
                  <mat-error>Use at least 8 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Type it again</mat-label>
                <input matInput [type]="show ? 'text' : 'password'" formControlName="confirm" autocomplete="new-password" required>
                @if (form.get('confirm')?.hasError('required')) {
                  <mat-error>Type the password again</mat-error>
                } @else if (form.get('confirm')?.hasError('mismatch')) {
                  <mat-error>The passwords don't match</mat-error>
                }
              </mat-form-field>

              @if (capsLock) {
                <p class="hint warn" role="status"><mat-icon>keyboard_capslock</mat-icon>Caps Lock is on</p>
              }
              @if (error) {
                <p class="hint error" role="alert"><mat-icon>error</mat-icon>{{ error }}</p>
              }

              <button mat-flat-button color="primary" type="submit" class="submit" [disabled]="saving">
                {{ saving ? 'Saving…' : 'Set password' }}
              </button>
            </form>
          }
        }
      </div>
    </main>
  `,
  styles: [`
    .page { min-height: 100vh; display: grid; place-items: center; padding: 32px 16px; background: var(--color-surface); }
    .card { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 6px; }
    .wordmark { display: flex; align-items: center; gap: 12px; font-weight: 800; font-size: 16px; color: var(--color-text); margin-bottom: 28px; }
    .mark { position: relative; width: 31px; height: 35px; flex: none; }
    .mark i { position: absolute; width: 15px; height: 17.5px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
    .mark i:nth-child(1) { left: 0; top: 0; background: var(--color-focus); }
    .mark i:nth-child(2) { left: 16px; top: 0; background: #2167a8; }
    .mark i:nth-child(3) { left: 8px; top: 14px; background: var(--nav-bg); opacity: 0.9; }
    .form { display: flex; flex-direction: column; gap: 6px; }
    h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--color-text); }
    .lede { margin: 4px 0 18px; color: var(--color-text-3); font-size: 14px; }
    mat-form-field { width: 100%; }
    .hint { display: flex; align-items: center; gap: 6px; margin: -4px 0 8px; font-size: 13px; font-weight: 600; }
    .hint mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .hint.warn { color: var(--color-warn); }
    .hint.error { color: var(--color-danger); }
    .submit { height: 46px; font-size: 15px; font-weight: 750; border-radius: 10px; margin-top: 4px; }
  `]
})
export class ResetPasswordComponent implements OnInit {
  state: 'checking' | 'invalid' | 'form' | 'done' = 'checking';
  name: string | null = null;
  email = '';
  error = '';
  saving = false;
  show = false;
  capsLock = false;
  form: FormGroup;
  private token = '';
  private readonly url = `${environment.apiUrl}/auth/reset-password`;

  constructor(private fb: FormBuilder, private route: ActivatedRoute, private router: Router, private http: HttpClient) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required, (c: AbstractControl): ValidationErrors | null =>
        c.value && c.parent && c.value !== c.parent.get('password')?.value ? { mismatch: true } : null]]
    });
    this.form.get('password')!.valueChanges.subscribe(() => this.form.get('confirm')!.updateValueAndValidity({ emitEvent: false }));
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) { this.state = 'invalid'; return; }
    this.http.get<{ valid: boolean; name: string | null }>(this.url, { params: { token: this.token } }).subscribe({
      next: r => { this.state = r.valid ? 'form' : 'invalid'; this.name = r.name; },
      error: () => { this.state = 'form'; } // can't check (e.g. rate limit) — let them try; the POST re-validates
    });
  }

  checkCapsLock(event: KeyboardEvent): void {
    this.capsLock = !!event.getModifierState && event.getModifierState('CapsLock');
  }

  submit(): void {
    this.error = '';
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const password = (this.form.value.password as string).trim();
    if (password.length < 8) { this.error = 'Use at least 8 characters, not counting spaces at the start or end.'; return; }
    this.saving = true;
    this.http.post<{ email: string }>(this.url, { token: this.token, password }).subscribe({
      next: r => { this.saving = false; this.email = r?.email ?? ''; this.state = 'done'; },
      error: err => {
        this.saving = false;
        // errorInterceptor rethrows { status, message } — the server's message is err.message
        const message: string = err?.message || err?.error?.message || '';
        if (err?.status === 400 && /expired|already been used/i.test(message)) { this.state = 'invalid'; return; }
        this.error = err?.status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : message || "We couldn't change your password. Try again, or ask IT support.";
      }
    });
  }

  goToLogin(): void {
    // Any old session on this browser belongs to the old password.
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.router.navigate(['/login'], { queryParams: this.email ? { email: this.email } : {} });
  }
}
