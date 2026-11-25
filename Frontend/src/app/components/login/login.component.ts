import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { companyLogo, COMPANY_NAMES } from '../../core/company-logos';

// Sign-in page (design review D-14): Promed branding, plain wording, show-password,
// Caps Lock warning and errors shown next to the form instead of a passing snackbar.
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="login">
      <section class="brand" aria-hidden="true">
        <div class="wordmark"><span class="mark"><i></i><i></i><i></i></span>Promed Intranet</div>
        <div class="pitch">
          <h1>Sales, deliveries and stock in one place.</h1>
          <p>The intranet for everyone at Promed Technologies and its group companies.</p>
        </div>
        <svg class="illus" viewBox="0 0 360 260" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="250" cy="110" r="96" fill="rgba(255,255,255,.06)"/>
          <circle cx="250" cy="110" r="62" fill="rgba(255,255,255,.07)"/>
          <rect x="40" y="150" width="120" height="78" rx="18" fill="rgba(60,189,233,.22)"/>
          <rect x="70" y="40" width="64" height="64" rx="16" fill="rgba(255,255,255,.1)" transform="rotate(12 102 72)"/>
          <g transform="translate(222 82)">
            <rect x="18" y="0" width="20" height="56" rx="5" fill="#fff" opacity=".92"/>
            <rect x="0" y="18" width="56" height="20" rx="5" fill="#fff" opacity=".92"/>
          </g>
          <path class="beat" d="M10 196 H120 l14 -30 l18 58 l16 -78 l16 50 h22 l10 -14 l10 14 H350"
                stroke="#3cbde9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="320" cy="40" r="6" fill="#3cbde9" opacity=".7"/>
          <circle cx="40" cy="60" r="4" fill="#fff" opacity=".4"/>
        </svg>
        <div class="companies">
          @for (c of companies; track c.code) {
            <span class="co"><img [src]="logo(c.code)" [alt]="c.name" width="28" height="28">{{ c.name }}</span>
          }
        </div>
      </section>

      <main class="form-side">
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="form" novalidate>
          <div>
            <h2>Sign in</h2>
            <p class="lede">Use your work email and intranet password.</p>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Work email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" required>
            @if (loginForm.get('email')?.hasError('required')) {
              <mat-error>Enter your work email</mat-error>
            } @else if (loginForm.get('email')?.hasError('email')) {
              <mat-error>That doesn't look like an email address</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input matInput [type]="showPassword ? 'text' : 'password'" formControlName="password"
                   autocomplete="current-password" required
                   (keyup)="checkCapsLock($event)" (keydown)="checkCapsLock($event)" (blur)="capsLock = false">
            <button mat-icon-button matSuffix type="button" (click)="showPassword = !showPassword"
                    [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'" [attr.aria-pressed]="showPassword">
              <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (loginForm.get('password')?.hasError('required')) {
              <mat-error>Enter your password</mat-error>
            }
          </mat-form-field>

          @if (capsLock) {
            <p class="hint warn" role="status"><mat-icon>keyboard_capslock</mat-icon>Caps Lock is on</p>
          }
          @if (error) {
            <p class="hint error" role="alert"><mat-icon>error</mat-icon>{{ error }}</p>
          }

          <button mat-flat-button color="primary" type="submit" class="submit" [disabled]="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>

          <p class="help"><b>Forgot your password or locked out?</b> Ask IT support to email you a reset link, or log a ticket from a colleague's computer.</p>
        </form>
      </main>
    </div>
  `,
  styles: [`
    .login { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100vh; background: var(--color-surface); }

    .brand { position: relative; overflow: hidden; background: linear-gradient(150deg, #262262 0%, #2167a8 58%, #6a4fc4 100%); color: #fff; padding: 48px 56px; display: flex; flex-direction: column; justify-content: space-between; gap: 32px; min-height: 100vh; box-sizing: border-box; }
    .wordmark { display: flex; align-items: center; gap: 14px; font-weight: 800; font-size: 18px; position: relative; z-index: 1; }
    .mark { position: relative; width: 31px; height: 35px; flex: none; }
    .mark i { position: absolute; width: 15px; height: 17.5px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
    .mark i:nth-child(1) { left: 0; top: 0; background: #3cbde9; }
    .mark i:nth-child(2) { left: 16px; top: 0; background: #2167a8; }
    .mark i:nth-child(3) { left: 8px; top: 14px; background: #fff; opacity: 0.9; }
    .pitch { position: relative; z-index: 1; max-width: 26rem; }
    .pitch h1 { margin: 0; font-size: 40px; line-height: 1.1; font-weight: 800; letter-spacing: -0.025em; }
    .pitch p { margin: 14px 0 0; color: rgba(255,255,255,.75); font-size: 15px; }
    .illus { position: relative; z-index: 1; width: 100%; max-width: 420px; height: auto; align-self: center; }
    .illus .beat { stroke-dasharray: 600; stroke-dashoffset: 600; animation: login-beat 2.4s var(--ease, ease) .3s forwards; }
    @keyframes login-beat { to { stroke-dashoffset: 0; } }
    .companies { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 10px 20px; font-size: 13px; font-weight: 600; color: rgba(255,255,255,.85); }
    .co { display: inline-flex; align-items: center; gap: 8px; }
    .co img { width: 28px; height: 28px; border-radius: 50%; background: #fff; object-fit: contain; box-shadow: 0 0 0 2px rgba(255,255,255,.25); }

    .form-side { display: grid; place-items: center; padding: 32px 24px; }
    .form { width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 6px; }
    .form h2 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: var(--color-text); }
    .lede { margin: 4px 0 18px; color: var(--color-text-3); font-size: 14px; }
    mat-form-field { width: 100%; }
    .hint { display: flex; align-items: center; gap: 6px; margin: -4px 0 8px; font-size: 13px; font-weight: 600; }
    .hint mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .hint.warn { color: var(--color-warn); }
    .hint.error { color: var(--color-danger); }
    .submit { height: 46px; font-size: 15px; font-weight: 750; border-radius: 10px; margin-top: 4px; }
    .help { margin: 18px 0 0; padding-top: 16px; border-top: 1px solid var(--color-line); font-size: 13px; color: var(--color-text-3); }
    .help b { color: var(--color-text-2); }

    @media (max-width: 900px) {
      .login { grid-template-columns: 1fr; }
      .brand { min-height: 0; padding: 28px 24px; gap: 18px; }
      .pitch h1 { font-size: 26px; }
      .pitch p, .illus { display: none; }
      .companies { gap: 8px 14px; font-size: 12px; }
      .co img { width: 22px; height: 22px; }
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;
  capsLock = false;
  error = '';

  /** Group companies shown along the bottom of the brand panel. */
  readonly companies = (['PMT', 'ACM', 'PHT', 'SBT'] as const).map(code => ({ code, name: COMPANY_NAMES[code] }));
  readonly logo = companyLogo;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      // ?email= is set when arriving from the reset-password page
      email: [route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  checkCapsLock(event: KeyboardEvent): void {
    this.capsLock = !!event.getModifierState && event.getModifierState('CapsLock');
  }

  onSubmit(): void {
    this.error = '';
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading = false;
        this.error = "That email and password don't match. Check Caps Lock, or ask IT support to reset your password.";
      }
    });
  }
}
