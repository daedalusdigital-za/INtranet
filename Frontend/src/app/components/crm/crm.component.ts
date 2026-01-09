import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-crm',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="crm-container">
      <div class="header-section">
        <h1>
          <mat-icon>people_outline</mat-icon>
          Customer Relationship Management
        </h1>
        <p class="subtitle">Manage customers, leads, and sales opportunities</p>
      </div>

      <div class="content-area">
        <mat-card class="coming-soon-card">
          <mat-card-content>
            <mat-icon class="large-icon">contact_mail</mat-icon>
            <h2>Coming Soon</h2>
            <p>The CRM system is currently under development.</p>
            <p>You'll be able to:</p>
            <ul>
              <li>Manage customer contacts and accounts</li>
              <li>Track leads and opportunities</li>
              <li>Monitor sales pipeline</li>
              <li>Schedule follow-ups and tasks</li>
              <li>Generate sales reports</li>
              <li>View customer interaction history</li>
            </ul>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .crm-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .header-section {
      margin-bottom: 32px;
      text-align: center;
    }

    h1 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: white;
      margin: 0 0 8px 0;
      font-size: 36px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    h1 mat-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      margin: 0;
    }

    .content-area {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    .coming-soon-card {
      max-width: 600px;
      width: 100%;
      padding: 40px !important;
      text-align: center;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
    }

    .large-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #00008B;
      margin-bottom: 16px;
    }

    .coming-soon-card h2 {
      color: #00008B;
      font-size: 28px;
      margin: 0 0 16px 0;
    }

    .coming-soon-card p {
      color: #333;
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 16px 0;
    }

    .coming-soon-card ul {
      text-align: left;
      display: inline-block;
      color: #555;
      font-size: 15px;
      line-height: 1.8;
    }

    .coming-soon-card ul li {
      margin-bottom: 8px;
    }

    .spacer {
      flex: 1 1 auto;
    }
  `]
})
export class CrmComponent implements OnInit {
  currentUser: any;
  notificationCount = 3;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    console.log('CRM Component initialized');
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
