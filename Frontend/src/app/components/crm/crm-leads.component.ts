import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { SelectionModel } from '@angular/cdk/collections';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { CrmService, Lead, LeadFilter, LeadStatus, Agent } from '../../services/crm/crm.service';

@Component({
  selector: 'app-crm-leads',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatDialogModule,
    MatSnackBarModule,
    MatDividerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="leads-container">
      <!-- Header -->
      <div class="leads-header">
        <div class="header-left">
          <button mat-icon-button routerLink="/crm">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h1>Leads</h1>
          @if (currentCompany()) {
            <div class="company-badge" [style.background-color]="currentCompany()?.primaryColor">
              {{ currentCompany()?.code }}
            </div>
          }
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" routerLink="/crm/leads/new">
            <mat-icon>person_add</mat-icon>
            Add Lead
          </button>
        </div>
      </div>

      <!-- Filters -->
      <mat-card class="filters-card">
        <div class="filters-row">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search leads</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="applyFilters()" placeholder="Name, email, phone, company...">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="selectedStatusId" (selectionChange)="applyFilters()">
              <mat-option [value]="null">All Statuses</mat-option>
              @for (status of statuses(); track status.leadStatusId) {
                <mat-option [value]="status.leadStatusId">
                  <span class="status-dot" [style.background-color]="status.color"></span>
                  {{ status.name }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (isManager()) {
            <mat-form-field appearance="outline">
              <mat-label>Agent</mat-label>
              <mat-select [(ngModel)]="selectedAgentId" (selectionChange)="applyFilters()">
                <mat-option [value]="null">All Agents</mat-option>
                <mat-option [value]="-1">Unassigned</mat-option>
                @for (agent of agents(); track agent.staffMemberId) {
                  <mat-option [value]="agent.staffMemberId">{{ agent.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }

          <div class="filter-chips">
            <mat-chip-listbox multiple>
              <mat-chip-option [selected]="filterHot" (click)="toggleFilter('hot')">
                <mat-icon>local_fire_department</mat-icon>
                Hot
              </mat-chip-option>
              <mat-chip-option [selected]="filterCallbacks" (click)="toggleFilter('callbacks')">
                <mat-icon>schedule</mat-icon>
                Callbacks Today
              </mat-chip-option>
              <mat-chip-option [selected]="filterOverdue" (click)="toggleFilter('overdue')" class="overdue-chip">
                <mat-icon>warning</mat-icon>
                Overdue
              </mat-chip-option>
            </mat-chip-listbox>
          </div>

          <button mat-icon-button (click)="clearFilters()" matTooltip="Clear filters">
            <mat-icon>clear</mat-icon>
          </button>
        </div>
      </mat-card>

      <!-- Bulk Actions (Managers) -->
      @if (isManager() && selection.hasValue()) {
        <mat-card class="bulk-actions-card">
          <span>{{ selection.selected.length }} leads selected</span>
          <button mat-button [matMenuTriggerFor]="bulkAssignMenu">
            <mat-icon>assignment_ind</mat-icon>
            Assign to Agent
          </button>
          <mat-menu #bulkAssignMenu="matMenu">
            @for (agent of agents(); track agent.staffMemberId) {
              <button mat-menu-item (click)="bulkAssign(agent.staffMemberId)">
                {{ agent.name }}
              </button>
            }
          </mat-menu>
          <button mat-button (click)="selection.clear()">
            <mat-icon>close</mat-icon>
            Clear Selection
          </button>
        </mat-card>
      }

      <!-- Leads Table -->
      @if (loading()) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
        </div>
      } @else {
        <mat-card class="table-card">
          <table mat-table [dataSource]="leads()" class="leads-table">
            <!-- Checkbox Column (Managers) -->
            @if (isManager()) {
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
            }

            <!-- Hot Column -->
            <ng-container matColumnDef="hot">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let lead">
                @if (lead.isHot) {
                  <mat-icon class="hot-icon" matTooltip="Hot Lead">local_fire_department</mat-icon>
                }
              </td>
            </ng-container>

            <!-- Name Column -->
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let lead">
                <div class="lead-name-cell">
                  <span class="lead-name">{{ lead.firstName }} {{ lead.lastName }}</span>
                  @if (lead.companyName) {
                    <span class="lead-company">{{ lead.companyName }}</span>
                  }
                </div>
              </td>
            </ng-container>

            <!-- Contact Column -->
            <ng-container matColumnDef="contact">
              <th mat-header-cell *matHeaderCellDef>Contact</th>
              <td mat-cell *matCellDef="let lead">
                <div class="contact-cell">
                  @if (lead.phone) {
                    <a href="tel:{{lead.phone}}" class="contact-link">
                      <mat-icon>phone</mat-icon>
                      {{ lead.phone }}
                    </a>
                  }
                  @if (lead.email) {
                    <a href="mailto:{{lead.email}}" class="contact-link">
                      <mat-icon>email</mat-icon>
                      {{ lead.email }}
                    </a>
                  }
                </div>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let lead">
                @if (lead.leadStatusName) {
                  <span class="status-chip" [style.background-color]="lead.leadStatusColor">
                    {{ lead.leadStatusName }}
                  </span>
                }
              </td>
            </ng-container>

            <!-- Agent Column -->
            <ng-container matColumnDef="agent">
              <th mat-header-cell *matHeaderCellDef>Agent</th>
              <td mat-cell *matCellDef="let lead">
                @if (lead.assignedAgentName) {
                  <span class="agent-name">{{ lead.assignedAgentName }}</span>
                } @else {
                  <span class="unassigned">Unassigned</span>
                }
              </td>
            </ng-container>

            <!-- Last Disposition Column -->
            <ng-container matColumnDef="disposition">
              <th mat-header-cell *matHeaderCellDef>Last Call</th>
              <td mat-cell *matCellDef="let lead">
                @if (lead.lastDispositionName) {
                  <span class="disposition-chip">{{ lead.lastDispositionName }}</span>
                }
                @if (lead.totalCallAttempts > 0) {
                  <span class="call-count">({{ lead.totalCallAttempts }} calls)</span>
                }
              </td>
            </ng-container>

            <!-- Callback Column -->
            <ng-container matColumnDef="callback">
              <th mat-header-cell *matHeaderCellDef>Callback</th>
              <td mat-cell *matCellDef="let lead">
                @if (lead.nextCallbackAt) {
                  <span class="callback-time" [class.overdue]="isOverdue(lead.nextCallbackAt)">
                    <mat-icon>schedule</mat-icon>
                    {{ lead.nextCallbackAt | date:'short' }}
                  </span>
                }
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let lead">
                <button mat-icon-button [matMenuTriggerFor]="actionMenu" (click)="$event.stopPropagation()">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #actionMenu="matMenu">
                  <button mat-menu-item [routerLink]="['/crm/leads', lead.leadId]">
                    <mat-icon>visibility</mat-icon>
                    View Details
                  </button>
                  <button mat-menu-item [routerLink]="['/crm/leads', lead.leadId, 'call']">
                    <mat-icon>phone</mat-icon>
                    Log Call
                  </button>
                  @if (isManager()) {
                    <button mat-menu-item [matMenuTriggerFor]="assignMenu">
                      <mat-icon>assignment_ind</mat-icon>
                      Assign to...
                    </button>
                  }
                  <mat-divider></mat-divider>
                  <button mat-menu-item (click)="toggleHot(lead)">
                    <mat-icon>{{ lead.isHot ? 'remove_circle' : 'local_fire_department' }}</mat-icon>
                    {{ lead.isHot ? 'Remove Hot' : 'Mark Hot' }}
                  </button>
                </mat-menu>
                <mat-menu #assignMenu="matMenu">
                  @for (agent of agents(); track agent.staffMemberId) {
                    <button mat-menu-item (click)="assignLead(lead, agent.staffMemberId)">
                      {{ agent.name }}
                    </button>
                  }
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let lead; columns: displayedColumns;"
                [class.hot-row]="lead.isHot"
                [class.overdue-row]="isOverdue(lead.nextCallbackAt)"
                [class.dnc-row]="lead.doNotCall"
                [routerLink]="['/crm/leads', lead.leadId]">
            </tr>
          </table>

          @if (leads().length === 0) {
            <div class="empty-state">
              <mat-icon>person_search</mat-icon>
              <h3>No leads found</h3>
              <p>Try adjusting your filters or add a new lead.</p>
              <button mat-raised-button color="primary" routerLink="/crm/leads/new">
                <mat-icon>person_add</mat-icon>
                Add Lead
              </button>
            </div>
          }

          <mat-paginator [length]="totalCount()"
                         [pageSize]="pageSize"
                         [pageSizeOptions]="[10, 25, 50, 100]"
                         (page)="onPageChange($event)"
                         showFirstLastButtons>
          </mat-paginator>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .leads-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .leads-header {
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

    .filters-card {
      padding: 16px;
      margin-bottom: 16px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-field {
      flex: 1;
      min-width: 250px;
    }

    mat-form-field {
      width: 180px;
    }

    .filter-chips {
      display: flex;
      gap: 8px;
    }

    .overdue-chip {
      background-color: #ffebee !important;
      color: #c62828 !important;
    }

    .bulk-actions-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #e3f2fd;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px;
    }

    .table-card {
      overflow: hidden;
    }

    .leads-table {
      width: 100%;
    }

    .leads-table tr {
      cursor: pointer;
    }

    .leads-table tr:hover {
      background-color: #f5f5f5;
    }

    .hot-row {
      background-color: #fff3e0;
    }

    .overdue-row {
      background-color: #ffebee;
    }

    .dnc-row {
      opacity: 0.6;
      background-color: #f5f5f5;
    }

    .hot-icon {
      color: #ff9800;
    }

    .lead-name-cell {
      display: flex;
      flex-direction: column;
    }

    .lead-name {
      font-weight: 500;
    }

    .lead-company {
      font-size: 12px;
      color: #666;
    }

    .contact-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .contact-link {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #1976d2;
      text-decoration: none;
      font-size: 13px;
    }

    .contact-link mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .contact-link:hover {
      text-decoration: underline;
    }

    .status-chip {
      padding: 4px 12px;
      border-radius: 12px;
      color: white;
      font-size: 12px;
      font-weight: 500;
    }

    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .agent-name {
      font-weight: 500;
    }

    .unassigned {
      color: #f44336;
      font-style: italic;
    }

    .disposition-chip {
      padding: 2px 8px;
      background: #e0e0e0;
      border-radius: 8px;
      font-size: 12px;
    }

    .call-count {
      font-size: 11px;
      color: #666;
      margin-left: 4px;
    }

    .callback-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
    }

    .callback-time mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .callback-time.overdue {
      color: #f44336;
      font-weight: 500;
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

    .empty-state h3 {
      margin: 0 0 8px;
    }

    .empty-state p {
      margin: 0 0 24px;
    }

    @media (max-width: 1024px) {
      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      mat-form-field {
        width: 100%;
      }

      .filter-chips {
        justify-content: center;
      }
    }
  `]
})
export class CrmLeadsComponent implements OnInit {
  private crmService = inject(CrmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  leads = signal<Lead[]>([]);
  statuses = this.crmService.leadStatuses;
  agents = signal<Agent[]>([]);
  totalCount = signal(0);
  loading = signal(true);
  currentCompany = signal<any>(null);
  isManager = signal(false);

  // Filters
  searchTerm = '';
  selectedStatusId: number | null = null;
  selectedAgentId: number | null = null;
  filterHot = false;
  filterCallbacks = false;
  filterOverdue = false;

  // Pagination
  page = 1;
  pageSize = 25;

  // Selection for bulk actions
  selection = new SelectionModel<Lead>(true, []);

  displayedColumns = computed(() => {
    const columns = ['hot', 'name', 'contact', 'status', 'agent', 'disposition', 'callback', 'actions'];
    if (this.isManager()) {
      return ['select', ...columns];
    }
    return columns;
  });

  ngOnInit() {
    this.crmService.currentCompany$.subscribe(company => {
      this.currentCompany.set(company);
      this.isManager.set(company?.userRole === 'SalesManager');
      if (company) {
        this.loadAgents(company.operatingCompanyId);
        this.loadLeads();
      }
    });

    // Handle query params for quick filters
    this.route.queryParams.subscribe(params => {
      if (params['filter']) {
        this.applyQuickFilter(params['filter']);
      }
      if (params['statusId']) {
        this.selectedStatusId = +params['statusId'];
        this.loadLeads();
      }
    });

    this.crmService.getOperatingCompanies().subscribe();
  }

  loadLeads() {
    const companyId = this.currentCompany()?.operatingCompanyId;
    if (!companyId) return;

    this.loading.set(true);
    this.selection.clear();

    const filter: LeadFilter = {
      operatingCompanyId: companyId,
      searchTerm: this.searchTerm || undefined,
      leadStatusId: this.selectedStatusId || undefined,
      isHot: this.filterHot ? true : undefined,
      hasCallbackToday: this.filterCallbacks ? true : undefined,
      hasOverdueCallback: this.filterOverdue ? true : undefined,
      page: this.page,
      pageSize: this.pageSize
    };

    if (this.selectedAgentId === -1) {
      filter.unassigned = true;
    } else if (this.selectedAgentId) {
      filter.assignedAgentId = this.selectedAgentId;
    }

    this.crmService.getLeads(filter).subscribe({
      next: (result) => {
        this.leads.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadAgents(companyId: number) {
    this.crmService.getAgents(companyId).subscribe(agents => {
      this.agents.set(agents);
    });
  }

  applyFilters() {
    this.page = 1;
    this.loadLeads();
  }

  toggleFilter(filter: string) {
    switch (filter) {
      case 'hot':
        this.filterHot = !this.filterHot;
        break;
      case 'callbacks':
        this.filterCallbacks = !this.filterCallbacks;
        break;
      case 'overdue':
        this.filterOverdue = !this.filterOverdue;
        break;
    }
    this.applyFilters();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedStatusId = null;
    this.selectedAgentId = null;
    this.filterHot = false;
    this.filterCallbacks = false;
    this.filterOverdue = false;
    this.applyFilters();
  }

  applyQuickFilter(filter: string) {
    this.clearFilters();
    switch (filter) {
      case 'hot':
        this.filterHot = true;
        break;
      case 'callbacks':
        this.filterCallbacks = true;
        break;
      case 'overdue':
        this.filterOverdue = true;
        break;
      case 'unassigned':
        this.selectedAgentId = -1;
        break;
      case 'my-queue':
        // Would need current user ID - handled by backend
        break;
    }
    this.loadLeads();
  }

  onPageChange(event: PageEvent) {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadLeads();
  }

  isOverdue(date: Date | null | undefined): boolean {
    if (!date) return false;
    return new Date(date) < new Date();
  }

  // Selection methods
  isAllSelected(): boolean {
    return this.selection.selected.length === this.leads().length;
  }

  masterToggle() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.leads().forEach(lead => this.selection.select(lead));
    }
  }

  // Actions
  assignLead(lead: Lead, agentId: number) {
    this.crmService.assignLead(lead.leadId, agentId).subscribe({
      next: () => {
        this.snackBar.open('Lead assigned successfully', 'Close', { duration: 3000 });
        this.loadLeads();
      },
      error: () => {
        this.snackBar.open('Failed to assign lead', 'Close', { duration: 3000 });
      }
    });
  }

  bulkAssign(agentId: number) {
    const leadIds = this.selection.selected.map(l => l.leadId);
    this.crmService.bulkAssignLeads(leadIds, agentId).subscribe({
      next: (result) => {
        this.snackBar.open(`${result.assigned} leads assigned successfully`, 'Close', { duration: 3000 });
        this.selection.clear();
        this.loadLeads();
      },
      error: () => {
        this.snackBar.open('Failed to assign leads', 'Close', { duration: 3000 });
      }
    });
  }

  toggleHot(lead: Lead) {
    this.crmService.updateLead(lead.leadId, { isHot: !lead.isHot }).subscribe({
      next: () => {
        this.snackBar.open(lead.isHot ? 'Lead unmarked as hot' : 'Lead marked as hot', 'Close', { duration: 3000 });
        this.loadLeads();
      }
    });
  }
}
