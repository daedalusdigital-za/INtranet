import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  template: `
    <div class="not-found-container">
      <div class="content-wrapper">
        <div class="error-icon">
          <mat-icon>error_outline</mat-icon>
        </div>
        
        <h1 class="error-code">404</h1>
        <h2 class="error-title">Page not found</h2>
        <p class="error-message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div class="action-buttons">
          <button mat-flat-button color="primary" (click)="goHome()">
            <mat-icon>home</mat-icon>
            Go to Home
          </button>
          <button mat-stroked-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
            Go Back
          </button>
        </div>
        
        <div class="countdown" *ngIf="countdown > 0">
          <p>Redirecting to home in {{ countdown }} seconds...</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .not-found-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-canvas);
      position: relative;
      overflow: hidden;
    }

    .content-wrapper {
      text-align: center;
      z-index: 10;
      padding: 40px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      max-width: 500px;
      margin: 20px;
    }

    .error-icon {
      margin-bottom: 20px;
    }

    .error-icon mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: var(--color-primary);
    }

    .error-code {
      font-size: 120px;
      font-weight: 800;
      margin: 0;
      color: var(--color-primary);
      line-height: 1;
    }

    .error-title {
      font-size: var(--text-3xl);
      font-weight: 600;
      color: var(--color-text);
      margin: 16px 0;
    }

    .error-message {
      font-size: var(--text-lg);
      color: var(--color-text-2);
      margin-bottom: 32px;
      line-height: 1.6;
    }

    .action-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .action-buttons button {
      min-width: 150px;
    }

    .action-buttons button mat-icon {
      margin-right: 8px;
    }

    .countdown {
      margin-top: 24px;
      padding: 12px 20px;
      background: var(--color-surface-2);
      border-radius: var(--radius-control);
    }

    .countdown p {
      margin: 0;
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    @media (max-width: 600px) {
      .error-code {
        font-size: 80px;
      }

      .error-title {
        font-size: var(--text-2xl);
      }

      .content-wrapper {
        padding: 30px 20px;
      }

      .action-buttons {
        flex-direction: column;
      }

      .action-buttons button {
        width: 100%;
      }
    }
  `]
})
export class NotFoundComponent {
  countdown = 10;
  private countdownInterval: any;

  constructor(private router: Router) {
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }

  startCountdown(): void {
    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.goHome();
      }
    }, 1000);
  }

  goHome(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.router.navigate(['/departments']);
  }

  goBack(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    window.history.back();
  }
}
