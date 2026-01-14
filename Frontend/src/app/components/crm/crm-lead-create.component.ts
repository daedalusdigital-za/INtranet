import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { CrmService, Campaign, Agent } from '../../services/crm/crm.service';

@Component({
  selector: 'app-crm-lead-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatDividerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="lead-create-container">
      <div class="page-header">
        <button mat-icon-button routerLink="/crm/leads">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Add New Lead</h1>
      </div>

      <mat-card>
        <mat-card-content>
          <form [formGroup]="leadForm" (ngSubmit)="onSubmit()">
            <h3>Contact Information</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>First Name *</mat-label>
                <input matInput formControlName="firstName" required>
                <mat-error>First name is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="lastName">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Company</mat-label>
                <input matInput formControlName="companyName">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Job Title</mat-label>
                <input matInput formControlName="jobTitle">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Phone *</mat-label>
                <input matInput formControlName="phone" required>
                <mat-icon matPrefix>phone</mat-icon>
                <mat-error>Phone number is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Mobile Phone</mat-label>
                <input matInput formControlName="mobilePhone">
                <mat-icon matPrefix>phone_android</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Alternate Phone</mat-label>
                <input matInput formControlName="alternatePhone">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" type="email">
                <mat-icon matPrefix>email</mat-icon>
                <mat-error>Please enter a valid email</mat-error>
              </mat-form-field>
            </div>

            <mat-divider></mat-divider>

            <h3>Address</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Street Address</mat-label>
                <input matInput formControlName="address">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>City</mat-label>
                <input matInput formControlName="city">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Province</mat-label>
                <mat-select formControlName="province">
                  <mat-option value="">Select Province</mat-option>
                  <mat-option value="Gauteng">Gauteng</mat-option>
                  <mat-option value="Western Cape">Western Cape</mat-option>
                  <mat-option value="KwaZulu-Natal">KwaZulu-Natal</mat-option>
                  <mat-option value="Eastern Cape">Eastern Cape</mat-option>
                  <mat-option value="Free State">Free State</mat-option>
                  <mat-option value="Limpopo">Limpopo</mat-option>
                  <mat-option value="Mpumalanga">Mpumalanga</mat-option>
                  <mat-option value="North West">North West</mat-option>
                  <mat-option value="Northern Cape">Northern Cape</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Postal Code</mat-label>
                <input matInput formControlName="postalCode">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Area</mat-label>
                <input matInput formControlName="area" placeholder="e.g., Sandton, Rosebank">
              </mat-form-field>
            </div>

            <mat-divider></mat-divider>

            <h3>Lead Details</h3>
            <div class="form-grid">
              <mat-form-field appearance="outline">
                <mat-label>Source</mat-label>
                <mat-select formControlName="source">
                  <mat-option value="">Select Source</mat-option>
                  <mat-option value="Website">Website</mat-option>
                  <mat-option value="Referral">Referral</mat-option>
                  <mat-option value="Cold Call">Cold Call</mat-option>
                  <mat-option value="Trade Show">Trade Show</mat-option>
                  <mat-option value="Social Media">Social Media</mat-option>
                  <mat-option value="Email Campaign">Email Campaign</mat-option>
                  <mat-option value="Partner">Partner</mat-option>
                  <mat-option value="Other">Other</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Campaign</mat-label>
                <mat-select formControlName="campaignId">
                  <mat-option [value]="null">No Campaign</mat-option>
                  @for (campaign of campaigns(); track campaign.campaignId) {
                    <mat-option [value]="campaign.campaignId">{{ campaign.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              @if (isManager()) {
                <mat-form-field appearance="outline">
                  <mat-label>Assign To</mat-label>
                  <mat-select formControlName="assignedAgentId">
                    <mat-option [value]="null">Unassigned</mat-option>
                    @for (agent of agents(); track agent.staffMemberId) {
                      <mat-option [value]="agent.staffMemberId">{{ agent.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Notes</mat-label>
                <textarea matInput formControlName="notes" rows="3"></textarea>
              </mat-form-field>
            </div>

            <div class="form-actions">
              <button mat-button type="button" routerLink="/crm/leads">Cancel</button>
              <button mat-raised-button color="primary" type="submit" 
                      [disabled]="!leadForm.valid || submitting()">
                {{ submitting() ? 'Saving...' : 'Create Lead' }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .lead-create-container {
      padding: 24px;
      max-width: 900px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }

    .page-header h1 {
      margin: 0;
      font-size: 24px;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    h3 {
      margin: 24px 0 16px;
      color: #666;
      font-size: 14px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    h3:first-of-type {
      margin-top: 0;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .form-grid .full-width {
      grid-column: 1 / -1;
    }

    mat-divider {
      margin: 24px 0;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #eee;
    }

    @media (max-width: 600px) {
      .form-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CrmLeadCreateComponent implements OnInit {
  private crmService = inject(CrmService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  campaigns = signal<Campaign[]>([]);
  agents = signal<Agent[]>([]);
  isManager = signal(false);
  submitting = signal(false);
  currentCompanyId = signal<number | null>(null);

  leadForm: FormGroup;

  constructor() {
    this.leadForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: [''],
      companyName: [''],
      jobTitle: [''],
      phone: ['', Validators.required],
      mobilePhone: [''],
      alternatePhone: [''],
      email: ['', Validators.email],
      address: [''],
      city: [''],
      province: [''],
      postalCode: [''],
      area: [''],
      source: [''],
      campaignId: [null],
      assignedAgentId: [null],
      notes: ['']
    });
  }

  ngOnInit() {
    this.crmService.currentCompany$.subscribe(company => {
      if (company) {
        this.currentCompanyId.set(company.operatingCompanyId);
        this.isManager.set(company.userRole === 'SalesManager');
        this.loadCampaigns(company.operatingCompanyId);
        this.loadAgents(company.operatingCompanyId);
      }
    });

    this.crmService.getOperatingCompanies().subscribe();
  }

  loadCampaigns(companyId: number) {
    this.crmService.getCampaigns(companyId, 'Active').subscribe(result => {
      this.campaigns.set(result.items);
    });
  }

  loadAgents(companyId: number) {
    this.crmService.getAgents(companyId).subscribe(agents => {
      this.agents.set(agents);
    });
  }

  onSubmit() {
    if (!this.leadForm.valid || !this.currentCompanyId()) return;

    this.submitting.set(true);

    const lead = {
      ...this.leadForm.value,
      operatingCompanyId: this.currentCompanyId()
    };

    this.crmService.createLead(lead).subscribe({
      next: (created) => {
        this.snackBar.open('Lead created successfully', 'Close', { duration: 3000 });
        this.router.navigate(['/crm/leads', created.leadId]);
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open('Failed to create lead', 'Close', { duration: 3000 });
      }
    });
  }
}
