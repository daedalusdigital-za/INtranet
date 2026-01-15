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
        <h2 class="error-title">Oops! Page Not Found</h2>
        <p class="error-message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div class="action-buttons">
          <button mat-raised-button color="primary" (click)="goHome()">
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
      
      <div class="decoration">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
        <div class="circle circle-3"></div>
      </div>
    </div>
  `,
  styles: [`
    .not-found-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      position: relative;
      overflow: hidden;
    }

    .content-wrapper {
      text-align: center;
      z-index: 10;
      padding: 40px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .error-code {
      font-size: 120px;
      font-weight: 800;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
    }

    .error-title {
      font-size: 28px;
      font-weight: 600;
      color: #333;
      margin: 16px 0;
    }

    .error-message {
      font-size: 16px;
      color: #666;
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
      background: #f5f5f5;
      border-radius: 8px;
    }

    .countdown p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    /* Decorative elements */
    .decoration {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      pointer-events: none;
    }

    .circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
    }

    .circle-1 {
      width: 300px;
      height: 300px;
      top: -100px;
      right: -100px;
      animation: float 6s ease-in-out infinite;
    }

    .circle-2 {
      width: 200px;
      height: 200px;
      bottom: -50px;
      left: -50px;
      animation: float 8s ease-in-out infinite reverse;
    }

    .circle-3 {
      width: 150px;
      height: 150px;
      top: 50%;
      left: 10%;
      animation: float 7s ease-in-out infinite;
    }

    @keyframes float {
      0%, 100% {
        transform: translateY(0) rotate(0deg);
      }
      50% {
        transform: translateY(-20px) rotate(5deg);
      }
    }

    @media (max-width: 600px) {
      .error-code {
        font-size: 80px;
      }

      .error-title {
        font-size: 22px;
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
