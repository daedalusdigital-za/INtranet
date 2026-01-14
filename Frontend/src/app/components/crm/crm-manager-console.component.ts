import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { SelectionModel } from '@angular/cdk/collections';
import { CrmService, Lead, Agent, CrmDashboard, AgentPerformance } from '../../services/crm/crm.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-crm-manager-console',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatDividerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="manager-console">
      <!-- Header -->
      <div class="console-header">
        <div class="header-left">
          <button mat-icon-button routerLink="/crm">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h1>Manager Console</h1>
          @if (currentCompany()) {
            <div class="company-badge" [style.background-color]="currentCompany()?.primaryColor">
              {{ currentCompany()?.code }}
            </div>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
        </div>
      } @else {
        <mat-tab-group>
          <!-- Team Performance Tab -->
          <mat-tab label="Team Performance">
            <div class="tab-content">
              <div class="performance-grid">
                @for (agent of agentPerformance(); track agent.agentId) {
                  <mat-card class="agent-card" [class.highlight]="isTopPerformer(agent)">
                    @if (isTopPerformer(agent)) {
                      <div class="top-badge">
                        <mat-icon>emoji_events</mat-icon>
                        Top Performer
                      </div>
                    }
                    <div class="agent-header">
                      <div class="agent-avatar" [style.background]="getAvatarColor(agent.agentId)">
                        {{ agent.agentName.charAt(0) }}
                      </div>
                      <div class="agent-info">
                        <span class="agent-name">{{ agent.agentName }}</span>
                        <span class="agent-role">{{ agent.role }}</span>
                      </div>
                    </div>

                    <div class="performance-stats">
                      <div class="stat-row">
                        <span class="stat-label">Leads Assigned</span>
                        <span class="stat-value">{{ agent.totalLeadsAssigned }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">Calls Today</span>
                        <span class="stat-value highlight-blue">{{ agent.callsMadeToday }}</span>
                      </div>
                      <div class="stat-row">
                        <span class="stat-label">Positive Outcomes</span>
                        <span class="stat-value highlight-green">{{ agent.positiveOutcomesToday }}</span>
                      </div>
                      <div class="stat-row" [class.warning]="agent.callbacksDue > 5">
                        <span class="stat-label">Callbacks Due</span>
                        <span class="stat-value">{{ agent.callbacksDue }}</span>
                      </div>
                    </div>

                    <div class="agent-actions">
                      <button mat-button routerLink="/crm/leads" 
                              [queryParams]="{agentId: agent.agentId}">
                        View Leads
                      </button>
                    </div>
                  </mat-card>
                }

                @if (agentPerformance().length === 0) {
                  <div class="empty-state">
                    <mat-icon>group</mat-icon>
                    <h3>No team members found</h3>
                    <p>Add agents to this company to see performance metrics.</p>
                  </div>
                }
              </div>
            </div>
          </mat-tab>

          <!-- Lead Assignment Tab -->
          <mat-tab label="Lead Assignment">
            <div class="tab-content">
              <mat-card class="assignment-controls">
                <h3>Quick Assignment</h3>
                <div class="assignment-row">
                  <mat-form-field appearance="outline">
                    <mat-label>Lead Pool</mat-label>
                    <mat-select [(ngModel)]="assignmentSource" (selectionChange)="loadUnassignedLeads()">
                      <mat-option value="unassigned">Unassigned Leads</mat-option>
                      <mat-option value="overdue">Overdue Callbacks</mat-option>
                      <mat-option value="hot">Hot Leads</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Assign To</mat-label>
                    <mat-select [(ngModel)]="targetAgentId">
                      @for (agent of agents(); track agent.staffMemberId) {
                        <mat-option [value]="agent.staffMemberId">
                          {{ agent.name }} ({{ getAgentLeadCount(agent.staffMemberId) }} leads)
                        </mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <button mat-raised-button color="primary" 
                          (click)="bulkAssign()"
                          [disabled]="!targetAgentId || selection.isEmpty()">
                    <mat-icon>assignment_turned_in</mat-icon>
                    Assign {{ selection.selected.length }} Leads
                  </button>
                </div>
              </mat-card>

              <mat-card class="leads-table-card">
                <table mat-table [dataSource]="unassignedLeads()" class="leads-table">
                  <ng-container matColumnDef="select">
                    <th mat-header-cell *matHeaderCellDef>
                      <mat-checkbox (change)="$event ? masterToggle() : null"
                                    [checked]="selection.hasValue() && isAllSelected()"
                                    [indeterminate]="selection.hasValue() && !isAllSelected()">
                      </mat-checkbox>
                    </th>
                    <td mat-cell *matCellDef="let lead">
                      <mat-checkbox (click)="$event.stopPropagation()"
                                    (change)="$event ? selection.toggle(lead) : null"
                                    [checked]="selection.isSelected(lead)">
                      </mat-checkbox>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Name</th>
                    <td mat-cell *matCellDef="let lead">
                      {{ lead.firstName }} {{ lead.lastName }}
                      @if (lead.isHot) {
                        <mat-icon class="hot-icon">local_fire_department</mat-icon>
                      }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="company">
                    <th mat-header-cell *matHeaderCellDef>Company</th>
                    <td mat-cell *matCellDef="let lead">{{ lead.companyName || '-' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="phone">
                    <th mat-header-cell *matHeaderCellDef>Phone</th>
                    <td mat-cell *matCellDef="let lead">{{ lead.phone }}</td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let lead">
                      <span class="status-chip" [style.background-color]="lead.leadStatusColor">
                        {{ lead.leadStatusName }}
                      </span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="callback">
                    <th mat-header-cell *matHeaderCellDef>Callback</th>
                    <td mat-cell *matCellDef="let lead">
                      @if (lead.nextCallbackAt) {
                        <span [class.overdue]="isOverdue(lead.nextCallbackAt)">
                          {{ lead.nextCallbackAt | date:'short' }}
                        </span>
                      }
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let lead">
                      <button mat-icon-button [matMenuTriggerFor]="assignMenu">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #assignMenu="matMenu">
                        @for (agent of agents(); track agent.staffMemberId) {
                          <button mat-menu-item (click)="assignSingleLead(lead, agent.staffMemberId)">
                            Assign to {{ agent.name }}
                          </button>
                        }
                      </mat-menu>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="assignmentColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: assignmentColumns;"></tr>
                </table>

                @if (unassignedLeads().length === 0) {
                  <div class="empty-state">
                    <mat-icon>check_circle</mat-icon>
                    <h3>All leads are assigned</h3>
                    <p>Great job! There are no unassigned leads in this pool.</p>
                  </div>
                }
              </mat-card>
            </div>
          </mat-tab>

          <!-- Staff Access Tab -->
          <mat-tab label="Staff Access">
            <div class="tab-content">
              <mat-card>
                <mat-card-header>
                  <mat-card-title>Team Members</mat-card-title>
                  <button mat-raised-button color="primary" (click)="showAddStaff = true">
                    <mat-icon>person_add</mat-icon>
                    Add Team Member
                  </button>
                </mat-card-header>
                <mat-card-content>
                  <table mat-table [dataSource]="agents()" class="staff-table">
                    <ng-container matColumnDef="name">
                      <th mat-header-cell *matHeaderCellDef>Name</th>
                      <td mat-cell *matCellDef="let agent">
                        <div class="staff-name-cell">
                          <div class="agent-avatar-small" [style.background]="getAvatarColor(agent.staffMemberId)">
                            {{ agent.name.charAt(0) }}
                          </div>
                          {{ agent.name }}
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="email">
                      <th mat-header-cell *matHeaderCellDef>Email</th>
                      <td mat-cell *matCellDef="let agent">{{ agent.email }}</td>
                    </ng-container>

                    <ng-container matColumnDef="role">
                      <th mat-header-cell *matHeaderCellDef>Role</th>
                      <td mat-cell *matCellDef="let agent">
                        <mat-form-field appearance="outline" class="role-select">
                          <mat-select [value]="agent.role" 
                                      (selectionChange)="updateStaffRole(agent, $event.value)">
                            <mat-option value="SalesAgent">Sales Agent</mat-option>
                            <mat-option value="SalesManager">Sales Manager</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="leads">
                      <th mat-header-cell *matHeaderCellDef>Assigned Leads</th>
                      <td mat-cell *matCellDef="let agent">
                        {{ getAgentLeadCount(agent.staffMemberId) }}
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let agent">
                        <button mat-icon-button color="warn" 
                                matTooltip="Remove access"
                                (click)="revokeAccess(agent)">
                          <mat-icon>person_remove</mat-icon>
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="staffColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: staffColumns;"></tr>
                  </table>
                </mat-card-content>
              </mat-card>
            </div>
          </mat-tab>
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .manager-console {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .console-header {
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
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .company-badge {
      padding: 4px 12px;
      border-radius: 16px;
      color: white;
      font-weight: 600;
      font-size: 12px;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px;
    }

    .tab-content {
      padding: 24px 0;
    }

    /* Performance Tab */
    .performance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    .agent-card {
      position: relative;
      overflow: hidden;
    }

    .agent-card.highlight {
      border: 2px solid #4caf50;
    }

    .top-badge {
      position: absolute;
      top: 0;
      right: 0;
      background: linear-gradient(135deg, #ffc107, #ff9800);
      color: white;
      padding: 4px 12px;
      border-radius: 0 4px 0 12px;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .top-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .agent-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid #eee;
    }

    .agent-avatar {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      font-weight: 600;
    }

    .agent-avatar-small {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: 600;
    }

    .agent-info {
      display: flex;
      flex-direction: column;
    }

    .agent-name {
      font-weight: 600;
      font-size: 16px;
    }

    .agent-role {
      font-size: 13px;
      color: #666;
    }

    .performance-stats {
      padding: 16px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f5f5f5;
    }

    .stat-row:last-child {
      border-bottom: none;
    }

    .stat-label {
      color: #666;
    }

    .stat-value {
      font-weight: 600;
    }

    .stat-value.highlight-blue {
      color: #1976d2;
    }

    .stat-value.highlight-green {
      color: #4caf50;
    }

    .stat-row.warning .stat-value {
      color: #f44336;
    }

    .agent-actions {
      padding: 8px 16px 16px;
    }

    /* Assignment Tab */
    .assignment-controls {
      padding: 16px;
      margin-bottom: 24px;
    }

    .assignment-controls h3 {
      margin: 0 0 16px;
    }

    .assignment-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .assignment-row mat-form-field {
      flex: 1;
      min-width: 200px;
    }

    .leads-table-card {
      overflow: hidden;
    }

    .leads-table {
      width: 100%;
    }

    .hot-icon {
      color: #ff9800;
      font-size: 18px;
      vertical-align: middle;
      margin-left: 4px;
    }

    .status-chip {
      padding: 2px 8px;
      border-radius: 8px;
      color: white;
      font-size: 12px;
    }

    .overdue {
      color: #f44336;
      font-weight: 500;
    }

    /* Staff Tab */
    mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .staff-table {
      width: 100%;
    }

    .staff-name-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .role-select {
      width: 150px;
    }

    .role-select ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .empty-state {
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

    @media (max-width: 768px) {
      .performance-grid {
        grid-template-columns: 1fr;
      }

      .assignment-row {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class CrmManagerConsoleComponent implements OnInit {
  private crmService = inject(CrmService);
  private snackBar = inject(MatSnackBar);

  currentCompany = signal<any>(null);
  loading = signal(true);
  agentPerformance = signal<AgentPerformance[]>([]);
  agents = signal<Agent[]>([]);
  unassignedLeads = signal<Lead[]>([]);
  
  // Assignment
  assignmentSource = 'unassigned';
  targetAgentId: number | null = null;
  selection = new SelectionModel<Lead>(true, []);
  assignmentColumns = ['select', 'name', 'company', 'phone', 'status', 'callback', 'actions'];
  
  // Staff
  staffColumns = ['name', 'email', 'role', 'leads', 'actions'];
  showAddStaff = false;

  // Lead counts per agent
  private agentLeadCounts: Record<number, number> = {};

  ngOnInit() {
    this.crmService.currentCompany$.subscribe(company => {
      this.currentCompany.set(company);
      if (company) {
        this.loadData();
      }
    });

    this.crmService.getOperatingCompanies().subscribe();
  }

  loadData() {
    const companyId = this.currentCompany()?.operatingCompanyId;
    if (!companyId) return;

    this.loading.set(true);

    // Load dashboard for performance data
    this.crmService.getDashboard(companyId).subscribe({
      next: (dashboard) => {
        this.agentPerformance.set(dashboard.agentPerformance || []);
        
        // Calculate lead counts from performance data
        this.agentLeadCounts = {};
        dashboard.agentPerformance?.forEach(agent => {
          this.agentLeadCounts[agent.agentId] = agent.totalLeadsAssigned;
        });
        
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });

    // Load agents
    this.crmService.getAgents(companyId).subscribe(agents => {
      this.agents.set(agents);
    });

    this.loadUnassignedLeads();
  }

  loadUnassignedLeads() {
    const companyId = this.currentCompany()?.operatingCompanyId;
    if (!companyId) return;

    this.selection.clear();

    let filter: any = {
      operatingCompanyId: companyId,
      pageSize: 100
    };

    switch (this.assignmentSource) {
      case 'unassigned':
        filter.unassigned = true;
        break;
      case 'overdue':
        filter.hasOverdueCallback = true;
        break;
      case 'hot':
        filter.isHot = true;
        break;
    }

    this.crmService.getLeads(filter).subscribe(result => {
      this.unassignedLeads.set(result.items);
    });
  }

  isTopPerformer(agent: AgentPerformance): boolean {
    const performance = this.agentPerformance();
    if (performance.length === 0) return false;
    
    const maxCalls = Math.max(...performance.map(a => a.callsMadeToday));
    return agent.callsMadeToday === maxCalls && maxCalls > 0;
  }

  getAvatarColor(id: number): string {
    const colors = [
      'linear-gradient(135deg, #667eea, #764ba2)',
      'linear-gradient(135deg, #f093fb, #f5576c)',
      'linear-gradient(135deg, #4facfe, #00f2fe)',
      'linear-gradient(135deg, #43e97b, #38f9d7)',
      'linear-gradient(135deg, #fa709a, #fee140)',
      'linear-gradient(135deg, #a8edea, #fed6e3)'
    ];
    return colors[id % colors.length];
  }

  getAgentLeadCount(agentId: number): number {
    return this.agentLeadCounts[agentId] || 0;
  }

  isOverdue(date: Date | null | undefined): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  // Selection methods
  isAllSelected(): boolean {
    return this.selection.selected.length === this.unassignedLeads().length;
  }

  masterToggle() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.unassignedLeads().forEach(lead => this.selection.select(lead));
    }
  }

  assignSingleLead(lead: Lead, agentId: number) {
    this.crmService.assignLead(lead.leadId, agentId).subscribe({
      next: () => {
        this.snackBar.open('Lead assigned', 'Close', { duration: 3000 });
        this.loadUnassignedLeads();
        this.loadData();
      }
    });
  }

  bulkAssign() {
    if (!this.targetAgentId || this.selection.isEmpty()) return;

    const leadIds = this.selection.selected.map(l => l.leadId);
    this.crmService.bulkAssignLeads(leadIds, this.targetAgentId).subscribe({
      next: (result) => {
        this.snackBar.open(`${result.assigned} leads assigned`, 'Close', { duration: 3000 });
        this.selection.clear();
        this.loadUnassignedLeads();
        this.loadData();
      }
    });
  }

  updateStaffRole(agent: Agent, role: string) {
    const companyId = this.currentCompany()?.operatingCompanyId;
    if (!companyId) return;

    this.crmService.grantStaffAccess(agent.staffMemberId, companyId, role).subscribe({
      next: () => {
        this.snackBar.open('Role updated', 'Close', { duration: 3000 });
      }
    });
  }

  revokeAccess(agent: Agent) {
    const companyId = this.currentCompany()?.operatingCompanyId;
    if (!companyId) return;

    if (confirm(`Remove ${agent.name}'s access to this company?`)) {
      this.crmService.revokeStaffAccess(agent.staffMemberId, companyId).subscribe({
        next: () => {
          this.snackBar.open('Access revoked', 'Close', { duration: 3000 });
          this.loadData();
        }
      });
    }
  }
}
