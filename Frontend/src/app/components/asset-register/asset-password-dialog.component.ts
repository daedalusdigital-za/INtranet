import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-asset-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="pw-dialog">
      <div class="pw-icon"><mat-icon>lock</mat-icon></div>
      <h2>Restricted Area</h2>
      <p>The Asset Register (and linked Books invoices) is access-controlled. Enter the access code to continue.</p>
      <div class="pw-field" [class.shake]="error">
        <mat-icon>vpn_key</mat-icon>
        <input #pwInput type="password" inputmode="numeric" autocomplete="off"
               [(ngModel)]="password" (keyup.enter)="submit()" (input)="error=false"
               placeholder="Access code" maxlength="12" autofocus>
      </div>
      @if (error) { <div class="pw-error"><mat-icon>error_outline</mat-icon> Incorrect access code</div> }
      <div class="pw-actions">
        <button mat-button (click)="cancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="submit()" [disabled]="!password">
          <mat-icon>login</mat-icon> Unlock
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pw-dialog { padding: 28px 26px 22px; text-align: center; max-width: 380px; }
    .pw-icon { width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 14px; display: flex; align-items: center; justify-content: center; background: var(--color-primary-soft); }
    .pw-icon mat-icon { color: var(--color-primary); font-size: var(--text-4xl); width: 32px; height: 32px; }
    h2 { margin: 0 0 6px; font-size: var(--text-2xl); color: var(--color-text); font-weight: 700; }
    p { margin: 0 0 20px; font-size: var(--text-sm); color: var(--color-text-3); line-height: 1.5; }
    .pw-field { display: flex; align-items: center; gap: 8px; border: 2px solid var(--color-line); border-radius: 10px; padding: 0 12px; background: var(--color-canvas); transition: border-color .2s; }
    .pw-field:focus-within { border-color: var(--color-primary); background: var(--color-surface); }
    .pw-field mat-icon { color: var(--color-text-3); }
    .pw-field input { flex: 1; border: none; background: transparent; outline: none; font-size: var(--text-xl); letter-spacing: 6px; text-align: center; padding: 12px 0; color: var(--color-text); }
    .pw-field.shake { animation: shake .35s; border-color: var(--color-danger); }
    @keyframes shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-6px);} 75%{transform:translateX(6px);} }
    .pw-error { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--color-danger); font-size: var(--text-sm); margin-top: 12px; }
    .pw-error mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }
    .pw-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
    .pw-actions mat-icon { margin-right: 4px; font-size: var(--text-xl); width: 18px; height: 18px; }
  `]
})
export class AssetPasswordDialogComponent {
  password = '';
  error = false;
  private readonly code = '0000';

  constructor(private ref: MatDialogRef<AssetPasswordDialogComponent>) {
    this.ref.disableClose = true;
  }

  submit() {
    if (this.password === this.code) {
      this.ref.close(true);
    } else {
      this.error = true;
      this.password = '';
    }
  }

  cancel() { this.ref.close(false); }
}
