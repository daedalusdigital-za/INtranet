import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormControl } from '@angular/forms';
import { LeaveRequestDialogComponent } from '../leave-request-dialog/leave-request-dialog.component';
import { PayslipRequestDialogComponent } from '../payslip-request-dialog/payslip-request-dialog.component';
import { PrivateMeetingRequestDialogComponent } from '../private-meeting-request-dialog/private-meeting-request-dialog.component';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable, map, startWith } from 'rxjs';

interface RequestCategory {
  name: string;
  icon: string;
  color: string;
  description: string;
  type: string;
}

@Component({
  selector: 'app-request-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatSnackBarModule],
  template: `
    <div class="request-dialog">
      <div class="dialog-header">
        <h2>Submit a Request</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <p class="subtitle">Select the department to submit your request</p>
        
        <div class="categories-grid">
          @for (category of categories; track category.name) {
            <div 
              class="category-box" 
              [style.background]="category.color"
              (click)="selectCategory(category)">
              <mat-icon class="category-icon">{{ category.icon }}</mat-icon>
              <span class="category-name">{{ category.name }}</span>
              <span class="category-desc">{{ category.description }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .request-dialog {
      padding: 0;
      min-width: 500px;
    }

    .dialog-header {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 500;
      text-align: center;
    }

    .dialog-header button {
      color: white;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
    }

    .dialog-content {
      padding: 24px;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 24px;
      font-size: 1rem;
    }

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .category-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      color: white;
      min-height: 140px;
      text-align: center;
    }

    .category-box:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .category-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .category-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .category-desc {
      font-size: 0.85rem;
      opacity: 0.9;
    }
  `]
})
export class RequestDialogComponent {
  categories: RequestCategory[] = [
    {
      name: 'Meeting',
      icon: 'event',
      color: '#9c27b0',
      description: 'Schedule a meeting with colleagues',
      type: 'meeting'
    },
    {
      name: 'Finance',
      icon: 'account_balance',
      color: '#2196f3',
      description: 'Expense claims, petty cash, invoices',
      type: 'finance'
    }
  ];

  constructor(
    private dialogRef: MatDialogRef<RequestDialogComponent>,
    private dialog: MatDialog,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  selectCategory(category: RequestCategory): void {
    this.dialogRef.close();
    
    switch (category.type) {
      case 'finance':
        this.dialog.open(FinanceInquiryDialogComponent, {
          width: '600px',
          autoFocus: false,
          panelClass: 'no-scroll-dialog'
        });
        break;
      case 'meeting':
        // Open meeting request dialog
        this.dialog.open(ScheduleMeetingDialogComponent, {
          width: '900px',
          autoFocus: false,
          panelClass: 'no-scroll-dialog'
        });
        break;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}

// HR Sub-menu component for Leave, Payslip, Meeting
@Component({
  selector: 'app-hr-request-menu',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="hr-menu-dialog">
      <div class="dialog-header">
        <h2>HR Requests</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <p class="subtitle">What would you like to request?</p>
        
        <div class="options-list">
          <div class="option-item" (click)="openLeaveRequest()">
            <mat-icon class="option-icon" style="color: #4caf50">event_busy</mat-icon>
            <div class="option-text">
              <span class="option-name">Leave Request</span>
              <span class="option-desc">Apply for annual, sick, or other leave</span>
            </div>
            <mat-icon class="arrow-icon">chevron_right</mat-icon>
          </div>
          
          <div class="option-item" (click)="openPayslipRequest()">
            <mat-icon class="option-icon" style="color: #2196f3">receipt_long</mat-icon>
            <div class="option-text">
              <span class="option-name">Payslip Request</span>
              <span class="option-desc">Request your payslip or salary info</span>
            </div>
            <mat-icon class="arrow-icon">chevron_right</mat-icon>
          </div>
          
          <div class="option-item" (click)="openMeetingRequest()">
            <mat-icon class="option-icon" style="color: #9c27b0">meeting_room</mat-icon>
            <div class="option-text">
              <span class="option-name">Private Meeting</span>
              <span class="option-desc">Request a private meeting with HR/Manager</span>
            </div>
            <mat-icon class="arrow-icon">chevron_right</mat-icon>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hr-menu-dialog {
      padding: 0;
      min-width: 400px;
    }

    .dialog-header {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 500;
    }

    .dialog-header button {
      color: white;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
    }

    .dialog-content {
      padding: 24px;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 24px;
    }

    .options-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .option-item {
      display: flex;
      align-items: center;
      padding: 16px;
      border-radius: 12px;
      background: #f5f5f5;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .option-item:hover {
      background: #e3f2fd;
      transform: translateX(4px);
    }

    .option-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      margin-right: 16px;
    }

    .option-text {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .option-name {
      font-weight: 600;
      font-size: 1rem;
      color: #333;
    }

    .option-desc {
      font-size: 0.85rem;
      color: #666;
    }

    .arrow-icon {
      color: #999;
    }
  `]
})
export class HRRequestMenuComponent {
  constructor(
    private dialogRef: MatDialogRef<HRRequestMenuComponent>,
    private dialog: MatDialog
  ) {}

  openLeaveRequest(): void {
    this.dialogRef.close();
    this.dialog.open(LeaveRequestDialogComponent, {
      width: '900px',
      autoFocus: false,
      panelClass: 'no-scroll-dialog'
    });
  }

  openPayslipRequest(): void {
    this.dialogRef.close();
    this.dialog.open(PayslipRequestDialogComponent, {
      width: '900px',
      autoFocus: false,
      panelClass: 'no-scroll-dialog'
    });
  }

  openMeetingRequest(): void {
    this.dialogRef.close();
    this.dialog.open(PrivateMeetingRequestDialogComponent, {
      width: '900px',
      autoFocus: false,
      panelClass: 'no-scroll-dialog'
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}

// User interface for autocomplete
interface UserOption {
  id: number;
  name: string;
  email: string;
  department?: string;
}

// Schedule Meeting Dialog Component
@Component({
  selector: 'app-schedule-meeting-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatRadioModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="meeting-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">event</mat-icon>
        <h2>Schedule a Meeting</h2>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="meetingForm" (ngSubmit)="submitMeeting()">
        <div class="dialog-content">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Meeting Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g., Project Status Update" required>
            <mat-error *ngIf="meetingForm.get('title')?.hasError('required')">
              Meeting title is required
            </mat-error>
          </mat-form-field>

          <div class="date-time-row">
            <mat-form-field appearance="outline">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="date" [min]="minDate" required>
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              <mat-error *ngIf="meetingForm.get('date')?.hasError('required')">Date is required</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Start Time</mat-label>
              <mat-select formControlName="startTime" required>
                @for (time of timeSlots; track time) {
                  <mat-option [value]="time">{{ time }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Duration</mat-label>
              <mat-select formControlName="duration" required>
                <mat-option value="15">15 minutes</mat-option>
                <mat-option value="30">30 minutes</mat-option>
                <mat-option value="45">45 minutes</mat-option>
                <mat-option value="60">1 hour</mat-option>
                <mat-option value="90">1.5 hours</mat-option>
                <mat-option value="120">2 hours</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Location -->
          <div class="location-section">
            <label class="section-label">Location</label>
            <mat-radio-group formControlName="locationType" class="location-group">
              <mat-radio-button value="online" color="primary">
                <div class="location-option">
                  <mat-icon>videocam</mat-icon>
                  <span>Online (Teams/Zoom)</span>
                </div>
              </mat-radio-button>
              <mat-radio-button value="boardroom" color="primary">
                <div class="location-option">
                  <mat-icon>meeting_room</mat-icon>
                  <span>Boardroom</span>
                </div>
              </mat-radio-button>
            </mat-radio-group>
          </div>

          @if (meetingForm.get('locationType')?.value === 'boardroom') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Boardroom</mat-label>
              <mat-select formControlName="boardroom">
                <mat-option value="boardroom1">Main Boardroom (10 seats)</mat-option>
                <mat-option value="boardroom2">Executive Boardroom (6 seats)</mat-option>
                <mat-option value="meeting1">Meeting Room 1 (4 seats)</mat-option>
                <mat-option value="meeting2">Meeting Room 2 (4 seats)</mat-option>
              </mat-select>
            </mat-form-field>
          }

          <!-- Attendees -->
          <div class="attendees-section">
            <label class="section-label">Invite Attendees</label>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Search for people</mat-label>
              <input matInput [formControl]="attendeeSearchControl" 
                     [matAutocomplete]="auto"
                     placeholder="Type a name to search...">
              <mat-icon matPrefix>person_add</mat-icon>
              <mat-autocomplete #auto="matAutocomplete" (optionSelected)="addAttendee($event)" [displayWith]="displayUser">
                @for (user of filteredUsers | async; track user.id) {
                  <mat-option [value]="user">
                    <div class="user-option">
                      <div class="user-avatar-small">{{ (user.name || '?').charAt(0) }}</div>
                      <div class="user-info">
                        <span class="user-name">{{ user.name || 'Unknown' }}</span>
                        <span class="user-dept">{{ user.department || user.email }}</span>
                      </div>
                    </div>
                  </mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>

            @if (selectedAttendees.length > 0) {
              <div class="selected-attendees">
                @for (attendee of selectedAttendees; track attendee.id) {
                  <mat-chip-row (removed)="removeAttendee(attendee)">
                    <div class="chip-content">
                      <div class="chip-avatar">{{ (attendee.name || '?').charAt(0) }}</div>
                      {{ attendee.name || 'Unknown' }}
                    </div>
                    <button matChipRemove>
                      <mat-icon>cancel</mat-icon>
                    </button>
                  </mat-chip-row>
                }
              </div>
            }
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description / Agenda</mat-label>
            <textarea matInput formControlName="description" rows="4" 
                      placeholder="What is this meeting about? Add agenda items..."></textarea>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="close()">Cancel</button>
          <button mat-raised-button color="primary" type="submit" 
                  [disabled]="meetingForm.invalid || selectedAttendees.length === 0 || isSubmitting">
            @if (isSubmitting) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <ng-container><mat-icon>send</mat-icon> Send Meeting Invites</ng-container>
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .meeting-dialog {
      width: 100%;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
      text-align: center;
    }

    .close-btn {
      color: white;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
    }

    .dialog-content {
      padding: 24px 0;
    }

    .full-width {
      width: 100%;
    }

    .date-time-row {
      display: flex;
      gap: 16px;
    }

    .date-time-row mat-form-field {
      flex: 1;
    }

    .section-label {
      display: block;
      margin-bottom: 12px;
      font-size: 0.9rem;
      font-weight: 500;
      color: #666;
    }

    .location-section {
      margin-bottom: 16px;
    }

    .location-group {
      display: flex;
      gap: 24px;
    }

    .location-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .location-option mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .attendees-section {
      margin-bottom: 16px;
    }

    .user-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 0;
    }

    .user-avatar-small {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 600;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 500;
      font-size: 14px;
    }

    .user-dept {
      font-size: 12px;
      color: #666;
    }

    .selected-attendees {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }

    .chip-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .chip-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .dialog-actions button {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class ScheduleMeetingDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<ScheduleMeetingDialogComponent>);

  meetingForm: FormGroup;
  attendeeSearchControl = new FormControl('');
  selectedAttendees: UserOption[] = [];
  allUsers: UserOption[] = [];
  filteredUsers: Observable<UserOption[]>;
  isSubmitting = false;
  minDate = new Date();

  timeSlots: string[] = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
  ];

  constructor() {
    this.meetingForm = this.fb.group({
      title: ['', Validators.required],
      date: ['', Validators.required],
      startTime: ['09:00', Validators.required],
      duration: ['30', Validators.required],
      locationType: ['online', Validators.required],
      boardroom: [''],
      description: ['']
    });

    this.filteredUsers = this.attendeeSearchControl.valueChanges.pipe(
      startWith(''),
      map(value => this.filterUsers(value || ''))
    );
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.http.get<any[]>(`${environment.apiUrl}/users`).subscribe({
      next: (users) => {
        this.allUsers = users.map(u => ({
          id: u.id || u.userId,
          name: u.fullName || u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username || 'Unknown User',
          email: u.email || '',
          department: u.department || u.departmentName || ''
        }));
      },
      error: () => {
        // Fallback if API fails
        this.allUsers = [];
      }
    });
  }

  filterUsers(value: string | UserOption): UserOption[] {
    const filterValue = typeof value === 'string' ? value.toLowerCase() : value.name.toLowerCase();
    return this.allUsers
      .filter(user => 
        !this.selectedAttendees.some(a => a.id === user.id) &&
        (user.name.toLowerCase().includes(filterValue) || 
         user.email.toLowerCase().includes(filterValue))
      )
      .slice(0, 10);
  }

  addAttendee(event: any): void {
    const user = event.option.value as UserOption;
    if (!this.selectedAttendees.some(a => a.id === user.id)) {
      this.selectedAttendees.push(user);
    }
    this.attendeeSearchControl.setValue('');
  }

  removeAttendee(attendee: UserOption): void {
    this.selectedAttendees = this.selectedAttendees.filter(a => a.id !== attendee.id);
  }

  submitMeeting(): void {
    if (this.meetingForm.invalid || this.selectedAttendees.length === 0) {
      return;
    }

    this.isSubmitting = true;
    const formValue = this.meetingForm.value;

    const meetingRequest = {
      title: formValue.title,
      date: formValue.date,
      startTime: formValue.startTime,
      durationMinutes: parseInt(formValue.duration),
      locationType: formValue.locationType,
      location: formValue.locationType === 'boardroom' ? formValue.boardroom : 'Online Meeting',
      description: formValue.description,
      attendeeIds: this.selectedAttendees.map(a => a.id)
    };

    this.http.post(`${environment.apiUrl}/meetings`, meetingRequest).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.snackBar.open(
          `Meeting scheduled! Invitations sent to ${this.selectedAttendees.length} attendee(s).`,
          'OK',
          { duration: 5000 }
        );
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snackBar.open('Failed to schedule meeting. Please try again.', 'OK', { duration: 4000 });
      }
    });
  }

  displayUser(user: UserOption | string): string {
    return typeof user === 'string' ? user : (user?.name || '');
  }

  close(): void {
    this.dialogRef.close();
  }
}

// Invoice search result interface
interface InvoiceSearchResult {
  id: number;
  invoiceNumber?: string;
  supplierName: string;
  companyName?: string;
  invoiceDate: string;
  total: number;
  currency: string;
  status: string;
  paymentDate?: string;
  paymentMethod?: string;
  paymentReference?: string;
  departmentId: number;
}

interface BookDepartment {
  departmentId: number;
  departmentName: string;
}

// Finance Invoice Inquiry Dialog Component
@Component({
  selector: 'app-finance-inquiry-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatAutocompleteModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="finance-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">account_balance</mat-icon>
        <h2>Invoice Payment Inquiry</h2>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <p class="subtitle">Check if an invoice has been paid</p>

        <!-- Step 1: Select Department -->
        <div class="step" [class.completed]="selectedDepartment">
          <div class="step-header">
            <div class="step-number" [class.active]="!selectedDepartment">1</div>
            <span class="step-label">Select Department</span>
            @if (selectedDepartment) {
              <button mat-icon-button class="change-btn" (click)="resetDepartment()">
                <mat-icon>edit</mat-icon>
              </button>
            }
          </div>
          @if (!selectedDepartment) {
            <div class="department-grid">
              @for (dept of departments; track dept.departmentId) {
                <div class="dept-chip" (click)="selectDepartment(dept)">
                  <mat-icon>folder_open</mat-icon>
                  {{ dept.departmentName }}
                </div>
              }
              @if (departments.length === 0) {
                <div class="loading-hint">
                  <mat-spinner diameter="20"></mat-spinner>
                  <span>Loading departments...</span>
                </div>
              }
            </div>
          } @else {
            <div class="selected-dept-chip">
              <mat-icon>folder</mat-icon>
              {{ selectedDepartment.departmentName }}
            </div>
          }
        </div>

        <!-- Step 2: Search Invoice -->
        @if (selectedDepartment) {
          <div class="step" [class.completed]="selectedInvoice">
            <div class="step-header">
              <div class="step-number" [class.active]="selectedDepartment && !selectedInvoice">2</div>
              <span class="step-label">Find Invoice</span>
              @if (selectedInvoice) {
                <button mat-icon-button class="change-btn" (click)="resetInvoice()">
                  <mat-icon>edit</mat-icon>
                </button>
              }
            </div>
            @if (!selectedInvoice) {
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Search by invoice number or supplier</mat-label>
                <input matInput [formControl]="invoiceSearchControl"
                       [matAutocomplete]="invoiceAuto"
                       placeholder="Start typing...">
                <mat-icon matPrefix>search</mat-icon>
                @if (isSearching) {
                  <mat-spinner matSuffix diameter="20"></mat-spinner>
                }
                <mat-autocomplete #invoiceAuto="matAutocomplete" (optionSelected)="selectInvoice($event)">
                  @for (inv of invoiceResults; track inv.id) {
                    <mat-option [value]="inv">
                      <div class="invoice-option">
                        <div class="invoice-option-main">
                          <span class="inv-number">{{ inv.invoiceNumber || 'No Number' }}</span>
                          <span class="inv-supplier">{{ inv.supplierName }}</span>
                        </div>
                        <div class="invoice-option-sub">
                          <span>{{ inv.invoiceDate | date:'dd MMM yyyy' }}</span>
                          <span class="inv-amount">{{ inv.currency }} {{ inv.total | number:'1.2-2' }}</span>
                          <span class="inv-status" [class]="'status-' + inv.status.toLowerCase().replace(' ', '-')">{{ inv.status }}</span>
                        </div>
                      </div>
                    </mat-option>
                  }
                  @if (invoiceSearchControl.value && (invoiceSearchControl.value + '').length >= 2 && invoiceResults.length === 0 && !isSearching) {
                    <mat-option disabled>
                      <div class="no-results">
                        <mat-icon>search_off</mat-icon>
                        <span>No invoices found</span>
                      </div>
                    </mat-option>
                  }
                </mat-autocomplete>
              </mat-form-field>
            } @else {
              <!-- Selected Invoice Card -->
              <div class="invoice-card">
                <div class="invoice-card-row">
                  <span class="label">Invoice #</span>
                  <span class="value">{{ selectedInvoice.invoiceNumber || 'N/A' }}</span>
                </div>
                <div class="invoice-card-row">
                  <span class="label">Supplier</span>
                  <span class="value">{{ selectedInvoice.supplierName }}</span>
                </div>
                @if (selectedInvoice.companyName) {
                  <div class="invoice-card-row">
                    <span class="label">Company</span>
                    <span class="value">{{ selectedInvoice.companyName }}</span>
                  </div>
                }
                <div class="invoice-card-row">
                  <span class="label">Date</span>
                  <span class="value">{{ selectedInvoice.invoiceDate | date:'dd MMM yyyy' }}</span>
                </div>
                <div class="invoice-card-row">
                  <span class="label">Amount</span>
                  <span class="value amount">{{ selectedInvoice.currency }} {{ selectedInvoice.total | number:'1.2-2' }}</span>
                </div>
                <div class="invoice-card-row">
                  <span class="label">Status</span>
                  <span class="value">
                    <span class="inv-status-badge" [class]="'status-' + selectedInvoice.status.toLowerCase().replace(' ', '-')">
                      {{ selectedInvoice.status }}
                    </span>
                  </span>
                </div>
                @if (selectedInvoice.paymentDate) {
                  <div class="invoice-card-row">
                    <span class="label">Payment Date</span>
                    <span class="value">{{ selectedInvoice.paymentDate | date:'dd MMM yyyy' }}</span>
                  </div>
                }
                @if (selectedInvoice.paymentReference) {
                  <div class="invoice-card-row">
                    <span class="label">Payment Ref</span>
                    <span class="value">{{ selectedInvoice.paymentReference }}</span>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Step 3: Add Notes & Send -->
        @if (selectedInvoice) {
          <div class="step">
            <div class="step-header">
              <div class="step-number active">3</div>
              <span class="step-label">Send Inquiry</span>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Additional notes (optional)</mat-label>
              <textarea matInput [formControl]="notesControl" rows="3"
                        placeholder="Any extra info for finance..."></textarea>
            </mat-form-field>
          </div>
        }
      </div>

      @if (selectedInvoice) {
        <div class="dialog-actions">
          <button mat-button type="button" (click)="close()">Cancel</button>
          <button mat-raised-button color="primary" (click)="sendInquiry()" [disabled]="isSending">
            @if (isSending) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>send</mat-icon> Send to Finance
            }
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .finance-dialog {
      width: 100%;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #2196f3 0%, #1565c0 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.4rem;
      text-align: center;
    }

    .close-btn {
      color: white;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
    }

    .dialog-content {
      padding: 24px 0 8px 0;
    }

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 20px;
      font-size: 0.95rem;
    }

    .full-width { width: 100%; }

    /* Steps */
    .step {
      margin-bottom: 20px;
      padding: 16px;
      background: #fafafa;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      transition: all 0.3s;
    }

    .step.completed {
      background: #e8f5e9;
      border-color: #a5d6a7;
    }

    .step-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .step-number {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #e0e0e0;
      color: #666;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .step-number.active {
      background: #2196f3;
      color: white;
    }

    .step.completed .step-number {
      background: #4caf50;
      color: white;
    }

    .step-label {
      font-weight: 600;
      font-size: 0.95rem;
      color: #333;
    }

    .change-btn {
      margin-left: auto;
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;
    }

    .change-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    /* Department Grid */
    .department-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
    }

    .dept-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 500;
      color: #333;
      transition: all 0.2s;
    }

    .dept-chip:hover {
      border-color: #2196f3;
      background: #e3f2fd;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15);
    }

    .dept-chip mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #2196f3;
    }

    .selected-dept-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: white;
      border: 1px solid #4caf50;
      border-radius: 20px;
      font-weight: 500;
      color: #2e7d32;
    }

    .selected-dept-chip mat-icon {
      color: #4caf50;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .loading-hint {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #666;
      font-size: 0.9rem;
      grid-column: 1 / -1;
    }

    /* Invoice Option in autocomplete */
    .invoice-option {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
    }

    .invoice-option-main {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .inv-number {
      font-weight: 600;
      color: #1565c0;
      font-size: 0.9rem;
    }

    .inv-supplier {
      color: #555;
      font-size: 0.85rem;
    }

    .invoice-option-sub {
      display: flex;
      gap: 12px;
      align-items: center;
      font-size: 0.8rem;
      color: #888;
      margin-top: 2px;
    }

    .inv-amount {
      font-weight: 600;
      color: #333;
    }

    .inv-status, .inv-status-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-draft { background: #fff3e0; color: #e65100; }
    .status-confirmed { background: #e8f5e9; color: #2e7d32; }
    .status-payment-requested { background: #e3f2fd; color: #1565c0; }
    .status-archived { background: #f5f5f5; color: #757575; }

    .no-results {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #999;
    }

    /* Invoice Card */
    .invoice-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
    }

    .invoice-card-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid #f0f0f0;
    }

    .invoice-card-row:last-child { border-bottom: none; }

    .invoice-card-row .label {
      font-size: 0.85rem;
      color: #666;
      font-weight: 500;
    }

    .invoice-card-row .value {
      font-size: 0.9rem;
      font-weight: 500;
      color: #333;
    }

    .invoice-card-row .value.amount {
      color: #1565c0;
      font-weight: 700;
    }

    /* Actions */
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .dialog-actions button {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class FinanceInquiryDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private dialogRef = inject(MatDialogRef<FinanceInquiryDialogComponent>);

  departments: BookDepartment[] = [];
  selectedDepartment: BookDepartment | null = null;
  
  invoiceSearchControl = new FormControl('');
  invoiceResults: InvoiceSearchResult[] = [];
  selectedInvoice: InvoiceSearchResult | null = null;
  isSearching = false;
  
  notesControl = new FormControl('');
  isSending = false;

  private searchTimeout: any;

  ngOnInit(): void {
    this.loadDepartments();
    
    // Debounced invoice search
    this.invoiceSearchControl.valueChanges.subscribe(value => {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      
      const searchTerm = typeof value === 'string' ? value : '';
      if (searchTerm.length < 2) {
        this.invoiceResults = [];
        return;
      }

      this.isSearching = true;
      this.searchTimeout = setTimeout(() => {
        this.searchInvoices(searchTerm);
      }, 300);
    });
  }

  loadDepartments(): void {
    this.http.get<BookDepartment[]>(`${environment.apiUrl}/Books/departments`).subscribe({
      next: (depts) => this.departments = depts,
      error: () => this.departments = []
    });
  }

  selectDepartment(dept: BookDepartment): void {
    this.selectedDepartment = dept;
    this.resetInvoice();
  }

  resetDepartment(): void {
    this.selectedDepartment = null;
    this.selectedInvoice = null;
    this.invoiceSearchControl.setValue('');
    this.invoiceResults = [];
  }

  searchInvoices(query: string): void {
    const deptId = this.selectedDepartment?.departmentId;
    let url = `${environment.apiUrl}/Books/invoice-search?query=${encodeURIComponent(query)}&limit=15`;
    if (deptId) url += `&departmentId=${deptId}`;

    this.http.get<InvoiceSearchResult[]>(url).subscribe({
      next: (results) => {
        this.invoiceResults = results;
        this.isSearching = false;
      },
      error: () => {
        this.invoiceResults = [];
        this.isSearching = false;
      }
    });
  }

  selectInvoice(event: any): void {
    this.selectedInvoice = event.option.value as InvoiceSearchResult;
    this.invoiceSearchControl.setValue('');
  }

  resetInvoice(): void {
    this.selectedInvoice = null;
    this.invoiceSearchControl.setValue('');
    this.invoiceResults = [];
  }

  sendInquiry(): void {
    if (!this.selectedInvoice) return;
    
    this.isSending = true;
    const body = {
      invoiceId: this.selectedInvoice.id,
      invoiceNumber: this.selectedInvoice.invoiceNumber,
      notes: this.notesControl.value || ''
    };

    this.http.post<any>(`${environment.apiUrl}/Books/payment-inquiry`, body).subscribe({
      next: (res) => {
        this.isSending = false;
        this.snackBar.open(
          'Payment inquiry sent to finance for invoice ' + (this.selectedInvoice?.invoiceNumber || 'N/A') + '!',
          'OK',
          { duration: 5000 }
        );
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.isSending = false;
        this.snackBar.open('Failed to send inquiry. Please try again.', 'OK', { duration: 4000 });
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}