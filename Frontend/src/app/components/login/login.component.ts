import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

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
        <div class="companies"><span>Promed</span><span>Access Medical</span><span>Pharmatech</span><span>Sebenzani</span><span>Rocket Freight</span></div>
        <div class="hexfield">
          @for (h of hexes; track $index) {
            <i [style.left.px]="h.x" [style.top.px]="h.y" [style.background]="h.c"></i>
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

          <p class="help"><b>Forgot your password or locked out?</b> Ask IT support to reset it, or log a ticket from a colleague's computer.</p>
        </form>
      </main>
    </div>
  `,
  styles: [`
    .login { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-height: 100vh; background: var(--color-surface); }

    .brand { position: relative; overflow: hidden; background: var(--nav-bg); color: var(--color-on-dark); padding: 48px 56px; display: flex; flex-direction: column; justify-content: space-between; gap: 40px; }
    .wordmark { display: flex; align-items: center; gap: 14px; font-weight: 800; font-size: 18px; position: relative; z-index: 1; }
    .mark { position: relative; width: 31px; height: 35px; flex: none; }
    .mark i { position: absolute; width: 15px; height: 17.5px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
    .mark i:nth-child(1) { left: 0; top: 0; background: var(--color-focus); }
    .mark i:nth-child(2) { left: 16px; top: 0; background: #2167a8; }
    .mark i:nth-child(3) { left: 8px; top: 14px; background: var(--color-surface); opacity: 0.9; }
    .pitch { position: relative; z-index: 1; max-width: 26rem; }
    .pitch h1 { margin: 0; font-size: 40px; line-height: 1.1; font-weight: 800; letter-spacing: -0.025em; }
    .pitch p { margin: 14px 0 0; color: var(--nav-text-dim); font-size: 15px; }
    .companies { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 8px 22px; font-size: 13px; font-weight: 600; color: var(--nav-text-dim); }
    .hexfield { position: absolute; right: -60px; bottom: -40px; width: 520px; height: 420px; }
    .hexfield i { position: absolute; width: 92px; height: 104px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }

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

    @media (max-width: 860px) {
      .login { grid-template-columns: 1fr; }
      .brand { padding: 28px 24px; gap: 18px; }
      .pitch h1 { font-size: 26px; }
      .pitch p, .companies, .hexfield { display: none; }
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  showPassword = false;
  capsLock = false;
  error = '';

  /** Decorative hexagon field on the brand panel, after the logo. */
  readonly hexes = [
    { x: 200, y: 40, c: 'rgba(60, 189, 233, .28)' }, { x: 296, y: 40, c: 'rgba(33, 103, 168, .5)' },
    { x: 392, y: 40, c: 'rgba(255, 255, 255, .06)' }, { x: 152, y: 122, c: 'rgba(255, 255, 255, .06)' },
    { x: 248, y: 122, c: 'rgba(60, 189, 233, .55)' }, { x: 344, y: 122, c: 'rgba(33, 103, 168, .35)' },
    { x: 440, y: 122, c: 'rgba(60, 189, 233, .2)' }, { x: 200, y: 204, c: 'rgba(33, 103, 168, .45)' },
    { x: 296, y: 204, c: 'rgba(255, 255, 255, .08)' }, { x: 392, y: 204, c: 'rgba(60, 189, 233, .4)' },
    { x: 248, y: 286, c: 'rgba(60, 189, 233, .22)' }, { x: 344, y: 286, c: 'rgba(33, 103, 168, .55)' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
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
