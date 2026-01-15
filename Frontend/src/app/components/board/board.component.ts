import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ApiService } from '../../services/api.service';
import { SignalRService } from '../../services/signalr.service';
import { AuthService } from '../../services/auth.service';
import { Board, List, Card, BoardChecklistItem, BoardMember } from '../../models/models';
import { Subscription } from 'rxjs';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatMenuModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatTooltipModule,
    MatSnackBarModule,
    DragDropModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="board-container">
      @if (board) {
        <div class="board-header">
          <div class="board-header-top">
            <div class="board-info">
              <h2>{{ board.title }}</h2>
              <p class="board-description">{{ board.description }}</p>
              <div class="board-meta">
                <span class="department-badge">
                  <mat-icon>business</mat-icon>
                  {{ board.departmentName }}
                </span>
                <span class="creator-badge">
                  <mat-icon>person</mat-icon>
                  Created by: {{ board.createdByName || 'Unknown' }}
                </span>
              </div>
            </div>
            
            <!-- Board Actions Menu -->
            <div class="board-actions">
              @if (canManage) {
                <button mat-icon-button [matMenuTriggerFor]="boardActionsMenu" class="board-menu-btn" matTooltip="Board Options">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #boardActionsMenu="matMenu">
                  <button mat-menu-item (click)="editBoard()">
                    <mat-icon>edit</mat-icon>
                    <span>Edit Board</span>
                  </button>
                  <button mat-menu-item (click)="toggleInviteMember()">
                    <mat-icon>person_add</mat-icon>
                    <span>Manage Team</span>
                  </button>
                  <button mat-menu-item (click)="viewReports()">
                    <mat-icon>assessment</mat-icon>
                    <span>View Reports</span>
                  </button>
                  <mat-divider></mat-divider>
                  <button mat-menu-item class="delete-action" (click)="confirmDeleteBoard()">
                    <mat-icon color="warn">delete</mat-icon>
                    <span style="color: #f44336;">Delete Board</span>
                  </button>
                </mat-menu>
              }
            </div>

            <div class="board-status-section">
              <div class="status-badge" [class]="'status-' + board.status.toLowerCase().replace(' ', '-')">
                {{ board.status }}
              </div>
              @if (canManage) {
                <button mat-icon-button [matMenuTriggerFor]="statusMenu" class="status-menu-btn">
                  <mat-icon>edit</mat-icon>
                </button>
                <mat-menu #statusMenu="matMenu">
                  <button mat-menu-item (click)="updateStatus('Planning')">
                    <mat-icon>schedule</mat-icon>
                    <span>Planning</span>
                  </button>
                  <button mat-menu-item (click)="updateStatus('In Progress')">
                    <mat-icon>trending_up</mat-icon>
                    <span>In Progress</span>
                  </button>
                  <button mat-menu-item (click)="updateStatus('Completed')">
                    <mat-icon>check_circle</mat-icon>
                    <span>Completed</span>
                  </button>
                  <button mat-menu-item (click)="updateStatus('On Hold')">
                    <mat-icon>pause_circle</mat-icon>
                    <span>On Hold</span>
                  </button>
                </mat-menu>
              }
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="progress-section">
            <div class="progress-header">
              <span class="progress-label">Progress</span>
              <span class="progress-value">{{ board.progress }}%</span>
            </div>
            <mat-progress-bar mode="determinate" [value]="board.progress" class="board-progress"></mat-progress-bar>
            <span class="progress-detail">{{ board.completedChecklistItems }} of {{ board.totalChecklistItems }} tasks completed</span>
          </div>

          <!-- Checklist Section -->
          <div class="checklist-section">
            <div class="checklist-header">
              <h3><mat-icon>checklist</mat-icon> Board Checklist</h3>
              @if (canManage) {
                <button mat-stroked-button (click)="toggleAddChecklist()">
                  <mat-icon>add</mat-icon> Add Task
                </button>
              }
            </div>

            @if (showAddChecklist && canManage) {
              <div class="add-checklist-form">
                <mat-form-field appearance="outline" class="checklist-input">
                  <mat-label>New task</mat-label>
                  <input matInput [(ngModel)]="newChecklistTitle" placeholder="Enter task title" (keyup.enter)="addChecklistItem()">
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="addChecklistItem()" [disabled]="!newChecklistTitle.trim()">
                  Add
                </button>
                <button mat-button (click)="toggleAddChecklist()">Cancel</button>
              </div>
            }

            <div class="checklist-items">
              @for (item of board.checklistItems; track item.checklistItemId) {
                <div class="checklist-item" [class.completed]="item.isCompleted">
                  <mat-checkbox 
                    [checked]="item.isCompleted" 
                    (change)="toggleChecklistItem(item)"
                    [disabled]="!canManage">
                    <span [class.checked-text]="item.isCompleted">{{ item.title }}</span>
                  </mat-checkbox>
                  @if (item.isCompleted && item.completedByName) {
                    <span class="completed-by">Completed by {{ item.completedByName }}</span>
                  }
                  @if (canManage) {
                    <button mat-icon-button class="delete-checklist-btn" (click)="deleteChecklistItem(item)">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
              }
              @if (board.checklistItems.length === 0) {
                <p class="no-checklist">No checklist items yet.</p>
              }
            </div>
          </div>

          <!-- Board Members Section -->
          <div class="members-section">
            <div class="members-header">
              <h3><mat-icon>group</mat-icon> Board Members</h3>
              @if (canManage) {
                <button mat-stroked-button (click)="toggleInviteMember()">
                  <mat-icon>person_add</mat-icon> Invite Member
                </button>
              }
            </div>

            @if (showInviteMember && canManage) {
              <div class="invite-member-form">
                <mat-form-field appearance="outline" class="member-select">
                  <mat-label>Select user to invite</mat-label>
                  <select matNativeControl [(ngModel)]="selectedUserToInvite">
                    <option value="">Choose a user</option>
                    @for (user of availableUsers; track user.userId) {
                      <option [value]="user.userId">{{ user.name }} ({{ user.email }})</option>
                    }
                  </select>
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="inviteMember()" [disabled]="!selectedUserToInvite">
                  Invite
                </button>
                <button mat-button (click)="toggleInviteMember()">Cancel</button>
              </div>
            }

            <div class="members-list">
              @for (member of board.members; track member.boardMemberId) {
                <div class="member-item">
                  <div class="member-avatar">
                    @if (member.profilePictureUrl) {
                      <img [src]="member.profilePictureUrl" [alt]="member.userName">
                    } @else {
                      <mat-icon>account_circle</mat-icon>
                    }
                  </div>
                  <div class="member-info">
                    <span class="member-name">{{ member.userName }}</span>
                    <span class="member-role" [class]="'role-' + member.role.toLowerCase()">{{ member.role }}</span>
                  </div>
                  @if (canManage && member.role !== 'Owner') {
                    <button mat-icon-button class="remove-member-btn" (click)="removeMember(member)">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
              }
              @if (!board.members || board.members.length === 0) {
                <p class="no-members">No members added yet.</p>
              }
            </div>
          </div>
        </div>

        <div class="lists-container" cdkDropListGroup>
          @for (list of board.lists; track list.listId) {
            <div class="list-column">
              <div class="list-header">
                <h3>{{ list.title }}</h3>
                <span class="card-count">{{ list.cards.length }}</span>
              </div>

              <div
                class="cards-container"
                cdkDropList
                [cdkDropListData]="list.cards"
                [id]="'list-' + list.listId"
                (cdkDropListDropped)="onCardDrop($event)">

                @for (card of list.cards; track card.cardId) {
                  <mat-card class="card" cdkDrag>
                    <mat-card-header>
                      <mat-card-title>{{ card.title }}</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      @if (card.description) {
                        <p class="card-description">{{ card.description }}</p>
                      }
                      @if (card.createdByName) {
                        <div class="card-meta created-by">
                          <mat-icon>edit</mat-icon>
                          <span>Created by: {{ card.createdByName }}</span>
                        </div>
                      }
                      @if (card.assignedToName) {
                        <div class="card-meta">
                          <mat-icon>person</mat-icon>
                          <span>Assigned to: {{ card.assignedToName }}</span>
                        </div>
                      }
                      @if (card.dueDate) {
                        <div class="card-meta">
                          <mat-icon>event</mat-icon>
                          <span>{{ card.dueDate | date }}</span>
                        </div>
                      }
                      <div class="card-footer">
                        @if (card.commentCount > 0) {
                          <div class="card-badge">
                            <mat-icon>comment</mat-icon>
                            <span>{{ card.commentCount }}</span>
                          </div>
                        }
                        @if (card.attachmentCount > 0) {
                          <div class="card-badge">
                            <mat-icon>attach_file</mat-icon>
                            <span>{{ card.attachmentCount }}</span>
                          </div>
                        }
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>

              <button mat-stroked-button class="add-card-btn" (click)="addCard(list.listId)">
                <mat-icon>add</mat-icon> Add Card
              </button>
            </div>
          }
        </div>
      }

      <!-- Delete Confirmation Dialog -->
      @if (showDeleteConfirm) {
        <div class="delete-overlay" (click)="cancelDelete()">
          <div class="delete-dialog" (click)="$event.stopPropagation()">
            <div class="delete-dialog-icon">
              <mat-icon color="warn">warning</mat-icon>
            </div>
            <h3>Delete Board?</h3>
            <p>Are you sure you want to delete "<strong>{{ board?.title }}</strong>"?</p>
            <p class="warning-text">This action cannot be undone. All lists, cards, and data will be permanently deleted.</p>
            <div class="delete-dialog-actions">
              <button mat-button (click)="cancelDelete()">Cancel</button>
              <button mat-raised-button color="warn" (click)="deleteBoard()">
                <mat-icon>delete</mat-icon>
                Delete Board
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .board-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .board-header {
      margin-bottom: 24px;
      background: rgba(255, 255, 255, 0.95);
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .board-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .board-info h2 {
      margin: 0 0 8px 0;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }

    .board-description {
      margin: 0 0 12px 0;
      color: #666;
    }

    .board-meta {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .department-badge, .creator-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #555;
      background: #f5f5f5;
      padding: 6px 12px;
      border-radius: 20px;
    }

    .department-badge mat-icon, .creator-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #4169e1;
    }

    .board-status-section {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-badge {
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 14px;
    }

    .status-planning {
      background: linear-gradient(135deg, #ffd93d 0%, #f9a825 100%);
      color: #333;
    }

    .status-in-progress {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
    }

    .status-completed {
      background: linear-gradient(135deg, #4caf50 0%, #2e7d32 100%);
      color: white;
    }

    .status-on-hold {
      background: linear-gradient(135deg, #ff5722 0%, #d84315 100%);
      color: white;
    }

    .status-menu-btn {
      color: #4169e1;
    }

    .progress-section {
      margin: 16px 0;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    .progress-label {
      font-weight: 600;
      color: #333;
    }

    .progress-value {
      font-weight: 700;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .board-progress {
      height: 10px;
      border-radius: 5px;
    }

    ::ng-deep .board-progress .mat-mdc-progress-bar-fill::after {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%) !important;
    }

    .progress-detail {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
      display: block;
    }

    .checklist-section {
      margin-top: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .checklist-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .checklist-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
      color: #333;
    }

    .checklist-header h3 mat-icon {
      color: #4169e1;
    }

    .add-checklist-form {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }

    .checklist-input {
      flex: 1;
    }

    .checklist-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .checklist-item {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: white;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .checklist-item:hover {
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .checklist-item.completed {
      background: #e8f5e9;
    }

    .checked-text {
      text-decoration: line-through;
      color: #888;
    }

    .completed-by {
      font-size: 11px;
      color: #4caf50;
      margin-left: auto;
      margin-right: 8px;
    }

    .delete-checklist-btn {
      color: #f44336;
      transform: scale(0.8);
    }

    .no-checklist {
      color: #888;
      font-style: italic;
      text-align: center;
      padding: 16px;
    }

    /* Members Section Styles */
    .members-section {
      margin-top: 16px;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .members-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .members-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
      color: #333;
    }

    .members-header h3 mat-icon {
      color: #4169e1;
    }

    .invite-member-form {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }

    .member-select {
      flex: 1;
    }

    .members-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .member-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: white;
      border-radius: 24px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.2s;
    }

    .member-item:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .member-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .member-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .member-avatar mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .member-info {
      display: flex;
      flex-direction: column;
    }

    .member-name {
      font-weight: 500;
      font-size: 14px;
      color: #333;
    }

    .member-role {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .role-owner {
      background: linear-gradient(135deg, #ffd93d 0%, #f9a825 100%);
      color: #333;
    }

    .role-admin {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
    }

    .role-member {
      background: #e0e0e0;
      color: #666;
    }

    .remove-member-btn {
      color: #f44336;
      transform: scale(0.7);
    }

    .no-members {
      color: #888;
      font-style: italic;
      text-align: center;
      padding: 16px;
      width: 100%;
    }

    /* Card Created By Styling */
    .card-meta.created-by {
      background: #e3f2fd;
      padding: 4px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
    }

    .card-meta.created-by mat-icon {
      color: #1e90ff;
    }

    .lists-container {
      display: flex;
      gap: 20px;
      overflow-x: auto;
      padding-bottom: 16px;
    }

    .list-column {
      flex: 0 0 320px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      max-height: calc(100vh - 200px);
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s;
    }

    .list-column:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid transparent;
      border-image: linear-gradient(90deg, #1e90ff 0%, #4169e1 100%) 1;
    }

    .list-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-count {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .cards-container {
      flex: 1;
      overflow-y: auto;
      min-height: 100px;
      padding: 4px;
    }

    .card {
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 4px solid;
      border-image: linear-gradient(180deg, #1e90ff 0%, #4169e1 100%) 1;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    .card:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0, 0, 139, 0.3);
    }

    .card.cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .cdk-drag-placeholder {
      opacity: 0.4;
      border: 2px dashed;
      border-image: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%) 1;
      background: rgba(0, 0, 139, 0.1);
    }

    .card-description {
      font-size: 14px;
      color: #666;
      margin: 8px 0;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 4px 0;
      font-weight: 500;
    }

    .card-meta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #667eea;
    }

    .card-footer {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }

    .card-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #666;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 12px;
    }

    .card-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .add-card-btn {
      width: 100%;
      margin-top: 8px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
      font-weight: 600;
    }

    .add-card-btn:hover {
      background: linear-gradient(135deg, #4169e1 0%, #1e90ff 100%);
    }

    /* Board Actions Menu */
    .board-actions {
      margin-left: auto;
      margin-right: 16px;
    }

    .board-menu-btn {
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    /* Delete Confirmation Dialog */
    .delete-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .delete-dialog {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      animation: dialogAppear 0.2s ease-out;
    }

    @keyframes dialogAppear {
      from {
        opacity: 0;
        transform: scale(0.9);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .delete-dialog-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #fff3e0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }

    .delete-dialog-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #ff9800;
    }

    .delete-dialog h3 {
      margin: 0 0 8px;
      font-size: 1.5rem;
      color: #333;
    }

    .delete-dialog p {
      margin: 0 0 8px;
      color: #666;
    }

    .delete-dialog .warning-text {
      font-size: 0.85rem;
      color: #f44336;
      margin-bottom: 24px;
    }

    .delete-dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    .delete-dialog-actions button {
      min-width: 120px;
    }
  `]
})
export class BoardComponent implements OnInit, OnDestroy {
  board?: Board;
  boardId: number = 0;
  currentUser: any;
  isCreator: boolean = false;
  canManage: boolean = false; // Creator, Admin, or Super Admin can manage
  showAddChecklist: boolean = false;
  newChecklistTitle: string = '';
  showInviteMember: boolean = false;
  selectedUserToInvite: string = '';
  availableUsers: any[] = [];
  showDeleteConfirm: boolean = false;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private signalRService: SignalRService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.boardId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadBoard();
    this.setupSignalR();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.board) {
      this.signalRService.leaveBoard(this.board.boardId.toString());
    }
  }

  loadBoard(): void {
    this.apiService.getBoard(this.boardId).subscribe({
      next: (board) => {
        if (board) {
          this.board = board;
          // Initialize arrays if undefined
          if (!this.board.checklistItems) {
            this.board.checklistItems = [];
          }
          if (!this.board.lists) {
            this.board.lists = [];
          }
          if (!this.board.members) {
            this.board.members = [];
          }
          // Check if current user is the creator
          this.isCreator = this.currentUser?.userId === board.createdByUserId;
          
          // Can manage: Creator, Admin, Super Admin, or board member with Admin role
          const userRole = this.currentUser?.role;
          const isAdminRole = userRole === 'Admin' || userRole === 'Super Admin';
          const isBoardAdmin = this.board.members?.some(m => 
            m.userId === this.currentUser?.userId && (m.role === 'Owner' || m.role === 'Admin')
          );
          this.canManage = this.isCreator || isAdminRole || isBoardAdmin;

          // Load available users for invites
          this.loadAvailableUsers();

          // Join SignalR board
          const token = this.authService.getToken();
          if (token) {
            this.signalRService.startConnection(token).then(() => {
              if (this.board) {
                this.signalRService.joinBoard(this.board.boardId.toString());
              }
            });
          }
        } else {
          // Board not found, redirect to 404
          this.router.navigate(['/404']);
        }
      },
      error: (error) => {
        console.error('Error loading board:', error);
        // Redirect to 404 on error
        this.router.navigate(['/404']);
      }
    });
  }

  updateStatus(status: string): void {
    if (!this.board) return;
    this.apiService.updateBoardStatus(this.board.boardId, { status }).subscribe({
      next: () => {
        if (this.board) {
          this.board.status = status;
        }
      },
      error: (error) => console.error('Error updating status:', error)
    });
  }

  toggleAddChecklist(): void {
    this.showAddChecklist = !this.showAddChecklist;
    if (!this.showAddChecklist) {
      this.newChecklistTitle = '';
    }
  }

  addChecklistItem(): void {
    if (!this.board || !this.newChecklistTitle.trim()) return;

    const position = this.board.checklistItems.length;
    this.apiService.addChecklistItem(this.board.boardId, {
      title: this.newChecklistTitle.trim(),
      position
    }).subscribe({
      next: (item) => {
        if (this.board) {
          this.board.checklistItems.push(item);
          this.board.totalChecklistItems++;
          this.updateProgress();
        }
        this.newChecklistTitle = '';
        this.showAddChecklist = false;
      },
      error: (error) => console.error('Error adding checklist item:', error)
    });
  }

  toggleChecklistItem(item: BoardChecklistItem): void {
    if (!this.board) return;

    const newCompleted = !item.isCompleted;
    this.apiService.updateChecklistItem(this.board.boardId, item.checklistItemId, {
      isCompleted: newCompleted,
      completedByUserId: newCompleted ? this.currentUser?.userId : undefined
    }).subscribe({
      next: () => {
        item.isCompleted = newCompleted;
        if (newCompleted) {
          item.completedByName = this.currentUser?.name || 'Unknown';
          item.completedAt = new Date();
          if (this.board) this.board.completedChecklistItems++;
        } else {
          item.completedByName = undefined;
          item.completedAt = undefined;
          if (this.board) this.board.completedChecklistItems--;
        }
        this.updateProgress();
      },
      error: (error) => console.error('Error updating checklist item:', error)
    });
  }

  deleteChecklistItem(item: BoardChecklistItem): void {
    if (!this.board) return;

    this.apiService.deleteChecklistItem(this.board.boardId, item.checklistItemId).subscribe({
      next: () => {
        if (this.board) {
          const index = this.board.checklistItems.findIndex(i => i.checklistItemId === item.checklistItemId);
          if (index > -1) {
            this.board.checklistItems.splice(index, 1);
            this.board.totalChecklistItems--;
            if (item.isCompleted) {
              this.board.completedChecklistItems--;
            }
            this.updateProgress();
          }
        }
      },
      error: (error) => console.error('Error deleting checklist item:', error)
    });
  }

  updateProgress(): void {
    if (!this.board) return;
    if (this.board.totalChecklistItems === 0) {
      this.board.progress = 0;
    } else {
      this.board.progress = Math.round((this.board.completedChecklistItems / this.board.totalChecklistItems) * 100);
    }
  }

  setupSignalR(): void {
    const sub1 = this.signalRService.cardMoved$.subscribe(() => {
      this.loadBoard();
    });

    const sub2 = this.signalRService.cardCreated$.subscribe(() => {
      this.loadBoard();
    });

    const sub3 = this.signalRService.cardUpdated$.subscribe(() => {
      this.loadBoard();
    });

    const sub4 = this.signalRService.cardDeleted$.subscribe(() => {
      this.loadBoard();
    });

    this.subscriptions.push(sub1, sub2, sub3, sub4);
  }

  onCardDrop(event: CdkDragDrop<Card[]>): void {
    if (event.previousContainer === event.container) {
      // Same list - just reorder
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Different list - move card
      const card = event.previousContainer.data[event.previousIndex];
      const targetListId = Number(event.container.id.replace('list-', ''));

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Update card position via API
      this.apiService.moveCard(card.cardId, {
        targetListId: targetListId,
        position: event.currentIndex
      }).subscribe({
        error: (error) => {
          console.error('Error moving card:', error);
          // Revert on error
          this.loadBoard();
        }
      });
    }
  }

  addCard(listId: number): void {
    // This would open a dialog to add a new card
    console.log('Add card to list:', listId);
  }

  // Board Members methods
  loadAvailableUsers(): void {
    // Load users from the same department or all users if admin
    this.apiService.getEmployees().subscribe({
      next: (users) => {
        // Filter out users who are already members
        const memberIds = this.board?.members?.map(m => m.userId) || [];
        this.availableUsers = users.filter(u => !memberIds.includes(u.userId));
      },
      error: (error) => console.error('Error loading users:', error)
    });
  }

  toggleInviteMember(): void {
    this.showInviteMember = !this.showInviteMember;
    this.selectedUserToInvite = '';
  }

  inviteMember(): void {
    if (!this.selectedUserToInvite || !this.board) return;

    const userId = parseInt(this.selectedUserToInvite, 10);
    this.apiService.inviteBoardMember(this.board.boardId, {
      userId: userId,
      role: 'Member',
      invitedByUserId: this.currentUser?.userId
    }).subscribe({
      next: (member) => {
        if (this.board) {
          if (!this.board.members) {
            this.board.members = [];
          }
          this.board.members.push(member);
          this.loadAvailableUsers(); // Refresh available users
        }
        this.showInviteMember = false;
        this.selectedUserToInvite = '';
      },
      error: (error) => console.error('Error inviting member:', error)
    });
  }

  removeMember(member: any): void {
    if (!this.board) return;

    if (confirm(`Are you sure you want to remove ${member.userName} from the board?`)) {
      this.apiService.removeBoardMember(this.board.boardId, member.boardMemberId).subscribe({
        next: () => {
          if (this.board && this.board.members) {
            const index = this.board.members.findIndex(m => m.boardMemberId === member.boardMemberId);
            if (index > -1) {
              this.board.members.splice(index, 1);
              this.loadAvailableUsers(); // Refresh available users
            }
          }
        },
        error: (error) => console.error('Error removing member:', error)
      });
    }
  }

  // Board management methods
  editBoard(): void {
    if (!this.board) return;
    // For now, show a snackbar - can be expanded to open an edit dialog
    this.snackBar.open('Board editing coming soon!', 'OK', { duration: 3000 });
  }

  viewReports(): void {
    if (!this.board) return;
    // Navigate to reports or show a report dialog
    this.snackBar.open('Board reports coming soon!', 'OK', { duration: 3000 });
  }

  confirmDeleteBoard(): void {
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
  }

  deleteBoard(): void {
    if (!this.board) return;

    this.apiService.deleteBoard(this.board.boardId).subscribe({
      next: () => {
        this.snackBar.open('Board deleted successfully', 'OK', { duration: 3000 });
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        console.error('Error deleting board:', error);
        this.snackBar.open('Failed to delete board: ' + (error.message || 'Unknown error'), 'OK', { duration: 5000 });
        this.showDeleteConfirm = false;
      }
    });
  }

  notificationCount = 3;

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}


