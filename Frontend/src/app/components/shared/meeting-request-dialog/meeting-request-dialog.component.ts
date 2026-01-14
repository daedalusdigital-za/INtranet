import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface User {
  userId: number;
  name: string;
  surname?: string;
  email: string;
  department?: string;
  profilePictureUrl?: string;
}

@Component({
  selector: 'app-meeting-request-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatAutocompleteModule,
    MatSnackBarModule
  ],
  template: `
    <div class="meeting-dialog">
      <div class="dialog-header">
        <h2>Schedule a Meeting</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <form [formGroup]="meetingForm">
          <!-- Title -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Meeting Title</mat-label>
            <input matInput formControlName="title" placeholder="Enter meeting title">
            <mat-icon matPrefix>title</mat-icon>
          </mat-form-field>

          <!-- Description -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Description (Optional)</mat-label>
            <textarea matInput formControlName="description" rows="3" placeholder="Enter meeting description"></textarea>
            <mat-icon matPrefix>description</mat-icon>
          </mat-form-field>

          <!-- Date and Time Row -->
          <div class="form-row">
            <mat-form-field appearance="outline" class="date-field">
              <mat-label>Meeting Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="meetingDate" [min]="minDate">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="time-field">
              <mat-label>Start Time</mat-label>
              <mat-select formControlName="startTime">
                @for (time of timeSlots; track time) {
                  <mat-option [value]="time">{{ time }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="time-field">
              <mat-label>End Time</mat-label>
              <mat-select formControlName="endTime">
                @for (time of timeSlots; track time) {
                  <mat-option [value]="time">{{ time }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Location -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Location</mat-label>
            <mat-select formControlName="location">
              <mat-option value="Online">
                <mat-icon>videocam</mat-icon>
                Online (Teams/Zoom)
              </mat-option>
              <mat-option value="Boardroom">
                <mat-icon>meeting_room</mat-icon>
                Boardroom
              </mat-option>
              <mat-option value="Conference Room A">
                <mat-icon>meeting_room</mat-icon>
                Conference Room A
              </mat-option>
              <mat-option value="Conference Room B">
                <mat-icon>meeting_room</mat-icon>
                Conference Room B
              </mat-option>
            </mat-select>
            <mat-icon matPrefix>location_on</mat-icon>
          </mat-form-field>

          <!-- Meeting Link (for online) -->
          @if (meetingForm.get('location')?.value === 'Online') {
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Meeting Link (Optional)</mat-label>
              <input matInput formControlName="meetingLink" placeholder="https://teams.microsoft.com/...">
              <mat-icon matPrefix>link</mat-icon>
            </mat-form-field>
          }

          <!-- Attendees Selection -->
          <div class="attendees-section">
            <label class="section-label">
              <mat-icon>people</mat-icon>
              Select Attendees
            </label>
            
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Search and select attendees</mat-label>
              <input 
                matInput 
                [formControl]="searchControl"
                (input)="filterUsers($event)">
              <mat-icon matPrefix>search</mat-icon>
            </mat-form-field>

            <!-- User List for Selection -->
            <div class="user-list" *ngIf="filteredUsers.length > 0">
              @for (user of filteredUsers; track user.userId) {
                <div 
                  class="user-item" 
                  [class.selected]="isSelected(user)"
                  (click)="toggleUser(user)">
                  <div class="user-avatar">
                    @if (user.profilePictureUrl) {
                      <img [src]="user.profilePictureUrl" [alt]="user.name">
                    } @else {
                      <mat-icon>person</mat-icon>
                    }
                  </div>
                  <div class="user-info">
                    <span class="user-name">{{ user.name }} {{ user.surname }}</span>
                    <span class="user-email">{{ user.email }}</span>
                  </div>
                  <mat-icon class="check-icon" *ngIf="isSelected(user)">check_circle</mat-icon>
                </div>
              }
            </div>

            <!-- Selected Attendees Chips -->
            @if (selectedAttendees.length > 0) {
              <div class="selected-chips">
                <span class="chips-label">Selected ({{ selectedAttendees.length }}):</span>
                <mat-chip-set>
                  @for (attendee of selectedAttendees; track attendee.userId) {
                    <mat-chip (removed)="removeAttendee(attendee)">
                      {{ attendee.name }} {{ attendee.surname }}
                      <button matChipRemove>
                        <mat-icon>cancel</mat-icon>
                      </button>
                    </mat-chip>
                  }
                </mat-chip-set>
              </div>
            }
          </div>
        </form>
      </div>

      <div class="dialog-actions">
        <button mat-button (click)="close()">Cancel</button>
        <button 
          mat-raised-button 
          color="primary" 
          [disabled]="!meetingForm.valid || selectedAttendees.length === 0 || isSubmitting"
          (click)="submit()">
          @if (isSubmitting) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else {
            <mat-icon>send</mat-icon>
            Send Meeting Request
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .meeting-dialog {
      min-width: 550px;
      max-width: 600px;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .full-width {
      width: 100%;
    }

    .form-row {
      display: flex;
      gap: 12px;
    }

    .date-field {
      flex: 2;
    }

    .time-field {
      flex: 1;
    }

    .attendees-section {
      margin-top: 16px;
    }

    .section-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #333;
      margin-bottom: 12px;
    }

    .section-label mat-icon {
      color: #667eea;
    }

    .user-list {
      max-height: 200px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .user-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      cursor: pointer;
      transition: background 0.2s;
      border-bottom: 1px solid #f0f0f0;
    }

    .user-item:last-child {
      border-bottom: none;
    }

    .user-item:hover {
      background: #f5f5f5;
    }

    .user-item.selected {
      background: #e3f2fd;
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .user-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .user-avatar mat-icon {
      color: #666;
    }

    .user-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 500;
      color: #333;
    }

    .user-email {
      font-size: 0.8rem;
      color: #666;
    }

    .check-icon {
      color: #4caf50;
    }

    .selected-chips {
      margin-top: 8px;
    }

    .chips-label {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 8px;
      display: block;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }

    .dialog-actions button mat-spinner {
      display: inline-block;
      margin-right: 8px;
    }
  `]
})
export class MeetingRequestDialogComponent implements OnInit {
  meetingForm!: FormGroup;
  searchControl!: FormControl;
  
  allUsers: User[] = [];
  filteredUsers: User[] = [];
  selectedAttendees: User[] = [];
  
  isSubmitting = false;
  minDate = new Date();
  
  timeSlots: string[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<MeetingRequestDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    this.searchControl = this.fb.control('');
    this.meetingForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      description: [''],
      meetingDate: [null, Validators.required],
      startTime: ['09:00', Validators.required],
      endTime: ['10:00'],
      location: ['Online', Validators.required],
      meetingLink: ['']
    });

    this.generateTimeSlots();
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  generateTimeSlots(): void {
    for (let hour = 7; hour <= 19; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const h = hour.toString().padStart(2, '0');
        const m = min.toString().padStart(2, '0');
        this.timeSlots.push(`${h}:${m}`);
      }
    }
  }

  loadUsers(): void {
    this.http.get<User[]>(`${environment.apiUrl}/users`, { headers: this.getHeaders() })
      .subscribe({
        next: (users) => {
          // Get current user ID from token
          const token = localStorage.getItem('token');
          let currentUserId = 0;
          if (token) {
            try {
              const payload = JSON.parse(atob(token.split('.')[1]));
              currentUserId = parseInt(payload.nameid || payload.sub, 10);
            } catch {}
          }
          
          // Exclude current user from the list
          this.allUsers = users.filter(u => u.userId !== currentUserId);
          this.filteredUsers = this.allUsers.slice(0, 10);
        },
        error: (err) => {
          console.error('Failed to load users:', err);
        }
      });
  }

  filterUsers(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toLowerCase();
    if (!value) {
      this.filteredUsers = this.allUsers.slice(0, 10);
      return;
    }
    
    this.filteredUsers = this.allUsers
      .filter(u => 
        u.name.toLowerCase().includes(value) || 
        (u.surname?.toLowerCase().includes(value)) ||
        u.email.toLowerCase().includes(value)
      )
      .slice(0, 10);
  }

  isSelected(user: User): boolean {
    return this.selectedAttendees.some(a => a.userId === user.userId);
  }

  toggleUser(user: User): void {
    if (this.isSelected(user)) {
      this.selectedAttendees = this.selectedAttendees.filter(a => a.userId !== user.userId);
    } else {
      this.selectedAttendees.push(user);
    }
  }

  removeAttendee(user: User): void {
    this.selectedAttendees = this.selectedAttendees.filter(a => a.userId !== user.userId);
  }

  submit(): void {
    if (!this.meetingForm.valid || this.selectedAttendees.length === 0) return;

    this.isSubmitting = true;
    
    const formValue = this.meetingForm.value;
    const payload = {
      title: formValue.title,
      description: formValue.description || null,
      meetingDate: formValue.meetingDate,
      startTime: formValue.startTime,
      endTime: formValue.endTime || null,
      location: formValue.location,
      meetingLink: formValue.location === 'Online' ? formValue.meetingLink : null,
      attendeeIds: this.selectedAttendees.map(a => a.userId)
    };

    this.http.post(`${environment.apiUrl}/meetings`, payload, { headers: this.getHeaders() })
      .subscribe({
        next: (response: any) => {
          this.isSubmitting = false;
          this.snackBar.open(
            `Meeting request sent to ${this.selectedAttendees.length} attendee(s)!`,
            'Close',
            { duration: 5000, panelClass: ['success-snackbar'] }
          );
          this.dialogRef.close({ success: true, meeting: response });
        },
        error: (err) => {
          this.isSubmitting = false;
          this.snackBar.open(
            err.error?.error || 'Failed to create meeting',
            'Close',
            { duration: 5000, panelClass: ['error-snackbar'] }
          );
        }
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
