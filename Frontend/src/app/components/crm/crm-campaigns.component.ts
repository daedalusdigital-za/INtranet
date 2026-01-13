import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { CrmService, Campaign, CampaignCreate, Agent } from '../../services/crm/crm.service';

@Component({
  selector: 'app-crm-campaigns',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="campaigns-container">
      <!-- Header -->
      <div class="campaigns-header">
        <div class="header-left">
          <button mat-icon-button routerLink="/crm">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h1>Campaigns</h1>
          @if (currentCompany()) {
            <div class="company-badge" [style.background-color]="currentCompany()?.primaryColor">
              {{ currentCompany()?.code }}
            </div>
          }
        </div>
        @if (isManager()) {
          <button mat-raised-button color="primary" (click)="openCampaignDialog()">
            <mat-icon>add</mat-icon>
            New Campaign
          </button>
        }
      </div>

      <!-- Status Filter Chips -->
      <div class="status-filter">
        <mat-chip-listbox [value]="selectedStatus" (selectionChange)="onStatusChange($event)">
          <mat-chip-option value="">All</mat-chip-option>
          <mat-chip-option value="Active">Active</mat-chip-option>
          <mat-chip-option value="Draft">Draft</mat-chip-option>
          <mat-chip-option value="Paused">Paused</mat-chip-option>
          <mat-chip-option value="Completed">Completed</mat-chip-option>
        </mat-chip-listbox>
      </div>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
        </div>
      } @else {
        <!-- Campaigns Grid -->
        <div class="campaigns-grid">
          @for (campaign of campaigns(); track campaign.campaignId) {
            <mat-card class="campaign-card">
              <mat-card-header>
                <mat-card-title>{{ campaign.name }}</mat-card-title>
                <mat-card-subtitle>
                  <span class="campaign-type">{{ campaign.campaignType }}</span>
                  @if (campaign.channel) {
                    <span class="campaign-channel">• {{ campaign.channel }}</span>
                  }
                </mat-card-subtitle>
                <div class="campaign-status">
                  <span class="status-badge" [ngClass]="'status-' + campaign.status.toLowerCase()">
                    {{ campaign.status }}
                  </span>
                </div>
              </mat-card-header>

              <mat-card-content>
                @if (campaign.description) {
                  <p class="campaign-description">{{ campaign.description }}</p>
                }

                <div class="campaign-stats">
                  <div class="stat">
                    <mat-icon>people</mat-icon>
                    <span>{{ campaign.totalLeads || 0 }} Leads</span>
                  </div>
                  <div class="stat">
                    <mat-icon>person</mat-icon>
                    <span>{{ campaign.assignedAgents || 0 }} Agents</span>
                  </div>
                  @if (campaign.targetLeads) {
                    <div class="stat">
                      <mat-icon>flag</mat-icon>
                      <span>Target: {{ campaign.targetLeads }}</span>
                    </div>
                  }
                </div>

                <div class="campaign-dates">
                  @if (campaign.startDate) {
                    <span class="date">
                      <mat-icon>event</mat-icon>
                      {{ campaign.startDate | date:'mediumDate' }}
                    </span>
                  }
                  @if (campaign.endDate) {
                    <span class="date">
                      → {{ campaign.endDate | date:'mediumDate' }}
                    </span>
                  }
                </div>
              </mat-card-content>

              <mat-card-actions>
                <button mat-button routerLink="/crm/leads" [queryParams]="{campaignId: campaign.campaignId}">
                  View Leads
                </button>
                @if (isManager()) {
                  <button mat-icon-button [matMenuTriggerFor]="campaignMenu">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #campaignMenu="matMenu">
                    <button mat-menu-item (click)="openCampaignDialog(campaign)">
                      <mat-icon>edit</mat-icon>
                      Edit Campaign
                    </button>
                    <button mat-menu-item (click)="openAgentDialog(campaign)">
                      <mat-icon>group_add</mat-icon>
                      Manage Agents
                    </button>
                    <mat-divider></mat-divider>
                    @if (campaign.status !== 'Active') {
                      <button mat-menu-item (click)="updateStatus(campaign, 'Active')">
                        <mat-icon>play_arrow</mat-icon>
                        Activate
                      </button>
                    }
                    @if (campaign.status === 'Active') {
                      <button mat-menu-item (click)="updateStatus(campaign, 'Paused')">
                        <mat-icon>pause</mat-icon>
                        Pause
                      </button>
                    }
                    <button mat-menu-item (click)="updateStatus(campaign, 'Completed')">
                      <mat-icon>check_circle</mat-icon>
                      Mark Complete
                    </button>
                    <mat-divider></mat-divider>
                    <button mat-menu-item (click)="deleteCampaign(campaign)" class="delete-action">
                      <mat-icon>delete</mat-icon>
                      Delete
                    </button>
                  </mat-menu>
                }
              </mat-card-actions>
            </mat-card>
          }

          @if (campaigns().length === 0) {
            <div class="empty-state">
              <mat-icon>campaign</mat-icon>
              <h3>No campaigns found</h3>
              <p>Create your first campaign to start organizing your leads.</p>
              @if (isManager()) {
                <button mat-raised-button color="primary" (click)="openCampaignDialog()">
                  <mat-icon>add</mat-icon>
                  Create Campaign
                </button>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Campaign Dialog Template -->
    <ng-template #campaignDialogTemplate let-data>
      <h2 mat-dialog-title>{{ data.campaign ? 'Edit Campaign' : 'New Campaign' }}</h2>
      <mat-dialog-content>
        <form [formGroup]="campaignForm" class="campaign-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Campaign Name</mat-label>
            <input matInput formControlName="name" required>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description</mat-label>
            <textarea matInput formControlName="description" rows="2"></textarea>
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Type</mat-label>
              <mat-select formControlName="campaignType" required>
                <mat-option value="Outbound">Outbound</mat-option>
                <mat-option value="Inbound">Inbound</mat-option>
                <mat-option value="Follow-up">Follow-up</mat-option>
                <mat-option value="Retention">Retention</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Channel</mat-label>
              <mat-select formControlName="channel">
                <mat-option value="">Not specified</mat-option>
                <mat-option value="Phone">Phone</mat-option>
                <mat-option value="Email">Email</mat-option>
                <mat-option value="SMS">SMS</mat-option>
                <mat-option value="Multi-channel">Multi-channel</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="Draft">Draft</mat-option>
                <mat-option value="Active">Active</mat-option>
                <mat-option value="Paused">Paused</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Start Date</mat-label>
              <input matInput [matDatepicker]="startPicker" formControlName="startDate">
              <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>End Date</mat-label>
              <input matInput [matDatepicker]="endPicker" formControlName="endDate">
              <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Target Leads</mat-label>
              <input matInput type="number" formControlName="targetLeads">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Budget (R)</mat-label>
              <input matInput type="number" formControlName="budget">
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Call Script</mat-label>
            <textarea matInput formControlName="script" rows="4" 
                      placeholder="Enter the script agents should follow..."></textarea>
          </mat-form-field>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" (click)="saveCampaign()" 
                [disabled]="!campaignForm.valid">
          {{ data.campaign ? 'Save Changes' : 'Create Campaign' }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Agent Assignment Dialog Template -->
    <ng-template #agentDialogTemplate let-data>
      <h2 mat-dialog-title>Manage Agents - {{ data.campaign?.name }}</h2>
      <mat-dialog-content>
        <p class="dialog-description">Select agents to assign to this campaign:</p>
        <div class="agent-list">
          @for (agent of allAgents(); track agent.staffMemberId) {
            <div class="agent-item" (click)="toggleAgent(agent.staffMemberId)"
                 [class.selected]="isAgentSelected(agent.staffMemberId)">
              <div class="agent-avatar">{{ agent.name.charAt(0) }}</div>
              <div class="agent-info">
                <span class="agent-name">{{ agent.name }}</span>
                <span class="agent-role">{{ agent.role }}</span>
              </div>
              <mat-icon class="check-icon">
                {{ isAgentSelected(agent.staffMemberId) ? 'check_circle' : 'radio_button_unchecked' }}
              </mat-icon>
            </div>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" (click)="saveAgents()">
          Save Assignments
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
  styles: [`
    .campaigns-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .campaigns-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-left h1 {
      margin: 0;
      font-size: 24px;
    }

    .company-badge {
      padding: 4px 12px;
      border-radius: 16px;
      color: white;
      font-weight: 600;
      font-size: 12px;
    }

    .status-filter {
      margin-bottom: 24px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px;
    }

    .campaigns-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }

    .campaign-card {
      height: fit-content;
    }

    .campaign-card mat-card-header {
      position: relative;
    }

    .campaign-status {
      position: absolute;
      top: 0;
      right: 0;
    }

    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-draft {
      background: #f5f5f5;
      color: #616161;
    }

    .status-paused {
      background: #fff3e0;
      color: #e65100;
    }

    .status-completed {
      background: #e3f2fd;
      color: #1565c0;
    }

    .campaign-type, .campaign-channel {
      font-size: 13px;
    }

    .campaign-description {
      color: #666;
      margin-bottom: 16px;
      font-size: 14px;
    }

    .campaign-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #666;
    }

    .stat mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .campaign-dates {
      display: flex;
      gap: 8px;
      font-size: 13px;
      color: #999;
    }

    .campaign-dates .date {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .campaign-dates mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    mat-card-actions {
      display: flex;
      justify-content: space-between;
    }

    .delete-action {
      color: #f44336;
    }

    .empty-state {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #bdbdbd;
      margin-bottom: 16px;
    }

    /* Dialog Styles */
    .campaign-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 500px;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .full-width {
      width: 100%;
    }

    .dialog-description {
      color: #666;
      margin-bottom: 16px;
    }

    .agent-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }

    .agent-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .agent-item:hover {
      background: #f5f5f5;
    }

    .agent-item.selected {
      background: #e3f2fd;
    }

    .agent-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }

    .agent-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .agent-name {
      font-weight: 500;
    }

    .agent-role {
      font-size: 12px;
      color: #666;
    }

    .check-icon {
      color: #4caf50;
    }

    .agent-item:not(.selected) .check-icon {
      color: #bdbdbd;
    }

    @media (max-width: 600px) {
      .campaigns-grid {
        grid-template-columns: 1fr;
      }

      .campaign-form {
        min-width: auto;
      }

      .form-row {
        flex-direction: column;
        gap: 0;
      }
    }
  `]
})
export class CrmCampaignsComponent implements OnInit {
  private crmService = inject(CrmService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  campaigns = signal<Campaign[]>([]);
  allAgents = signal<Agent[]>([]);
  currentCompany = signal<any>(null);
  loading = signal(true);
  isManager = signal(false);
  selectedStatus = '';

  campaignForm: FormGroup;
  selectedAgentIds: number[] = [];
  editingCampaign: Campaign | null = null;

  private campaignDialogRef: MatDialogRef<any> | null = null;
  private agentDialogRef: MatDialogRef<any> | null = null;

  constructor() {
    this.campaignForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      campaignType: ['Outbound', Validators.required],
      channel: [''],
      status: ['Draft'],
      startDate: [null],
      endDate: [null],
      targetLeads: [null],
      budget: [null],
      script: ['']
    });
  }

  ngOnInit() {
    this.crmService.currentCompany$.subscribe(company => {
      this.currentCompany.set(company);
      this.isManager.set(company?.userRole === 'SalesManager');
      if (company) {
        this.loadCampaigns();
        this.loadAgents(company.operatingCompanyId);
      }
    });

    this.crmService.getOperatingCompanies().subscribe();
  }

  onStatusChange(event: any) {
    this.selectedStatus = event.value || '';
    this.loadCampaigns();
  }

  loadCampaigns() {
    const companyId = this.currentCompany()?.operatingCompanyId;
    if (!companyId) return;

    this.loading.set(true);
    this.crmService.getCampaigns(companyId, this.selectedStatus || undefined).subscribe({
      next: (result) => {
        this.campaigns.set(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadAgents(companyId: number) {
    this.crmService.getAgents(companyId).subscribe(agents => {
      this.allAgents.set(agents);
    });
  }

  openCampaignDialog(campaign?: Campaign) {
    this.editingCampaign = campaign || null;
    
    if (campaign) {
      this.campaignForm.patchValue({
        name: campaign.name,
        description: campaign.description,
        campaignType: campaign.campaignType,
        channel: campaign.channel,
        status: campaign.status,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        targetLeads: campaign.targetLeads,
        budget: campaign.budget,
        script: campaign.script
      });
    } else {
      this.campaignForm.reset({
        campaignType: 'Outbound',
        status: 'Draft'
      });
    }

    // Note: In a real app, you'd open a proper dialog here
    // For simplicity, we're using inline logic
    this.saveCampaign();
  }

  saveCampaign() {
    if (!this.campaignForm.valid) return;

    const companyId = this.currentCompany()?.operatingCompanyId;
    if (!companyId) return;

    const data: CampaignCreate = {
      ...this.campaignForm.value,
      operatingCompanyId: companyId
    };

    if (this.editingCampaign) {
      this.crmService.updateCampaign(this.editingCampaign.campaignId, data).subscribe({
        next: () => {
          this.snackBar.open('Campaign updated', 'Close', { duration: 3000 });
          this.loadCampaigns();
        }
      });
    } else {
      this.crmService.createCampaign(data).subscribe({
        next: () => {
          this.snackBar.open('Campaign created', 'Close', { duration: 3000 });
          this.loadCampaigns();
        }
      });
    }
  }

  openAgentDialog(campaign: Campaign) {
    this.editingCampaign = campaign;
    this.selectedAgentIds = campaign.assignedAgentsList?.map(a => a.staffMemberId) || [];
    // In real app, open dialog here
  }

  toggleAgent(agentId: number) {
    const index = this.selectedAgentIds.indexOf(agentId);
    if (index > -1) {
      this.selectedAgentIds.splice(index, 1);
    } else {
      this.selectedAgentIds.push(agentId);
    }
  }

  isAgentSelected(agentId: number): boolean {
    return this.selectedAgentIds.includes(agentId);
  }

  saveAgents() {
    if (!this.editingCampaign) return;

    this.crmService.assignCampaignAgents(this.editingCampaign.campaignId, this.selectedAgentIds).subscribe({
      next: () => {
        this.snackBar.open('Agents assigned', 'Close', { duration: 3000 });
        this.loadCampaigns();
      }
    });
  }

  updateStatus(campaign: Campaign, status: string) {
    this.crmService.updateCampaignStatus(campaign.campaignId, status).subscribe({
      next: () => {
        this.snackBar.open(`Campaign ${status.toLowerCase()}`, 'Close', { duration: 3000 });
        this.loadCampaigns();
      }
    });
  }

  deleteCampaign(campaign: Campaign) {
    if (confirm(`Are you sure you want to delete "${campaign.name}"?`)) {
      this.crmService.deleteCampaign(campaign.campaignId).subscribe({
        next: () => {
          this.snackBar.open('Campaign deleted', 'Close', { duration: 3000 });
          this.loadCampaigns();
        }
      });
    }
  }
}
