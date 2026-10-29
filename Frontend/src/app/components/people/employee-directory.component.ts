import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from '../../ui/toast.service';
import { environment } from '../../../environments/environment';
import { ConfirmService } from '../../ui/confirm.service';

export interface HrEmployee {
  id: number;
  firstName: string;
  lastName: string;
  fullName?: string;
  employeeNumber?: string | null;
  idNumber?: string | null;
  passportNumber?: string | null;
  nationality?: string | null;
  site: string;
  department?: string | null;
  jobTitle?: string | null;
  employmentType: string;
  status: string;
  phoneNumber?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  dateOfBirth?: string | null;
  hireDate?: string | null;
  contractEndDate?: string | null;
  notes?: string | null;
  source?: string;
  hasPhoto?: boolean;
  documentCount?: number;
}

interface HrDocument {
  id: number;
  category: string;
  title: string;
  description?: string;
  originalFileName?: string;
  contentType?: string;
  fileSize: number;
  expiryDate?: string | null;
  uploadedAt: string;
  uploadedByName?: string;
}

interface HrCase {
  id: number;
  employeeId: number;
  type: string;
  title: string;
  description?: string;
  issuedDate: string;
  expiryDate?: string | null;
  status: string;
  outcome?: string;
  isPaidSuspension?: boolean;
  issuedByName?: string;
  notes?: string;
}

@Component({
  selector: 'app-employee-directory',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatProgressSpinnerModule, SkeletonRowsComponent, EmptyStateComponent
  ],
  template: `
  <div class="dir-root">
    <!-- Header -->
    <div class="dir-header">
      <div class="dir-title">
        <mat-icon>badge</mat-icon>
        <div>
          <h2>Employee Directory</h2>
          <span class="dir-sub">All sites &amp; companies reporting to HR</span>
        </div>
      </div>
      <div class="dir-header-actions">
        <button mat-stroked-button class="hbtn" (click)="importFromSources()" [disabled]="importing" matTooltip="Import from biometric clock-in &amp; logistics drivers">
          <mat-icon>{{ importing ? 'hourglass_empty' : 'sync' }}</mat-icon> Import
        </button>
        <button mat-flat-button class="hbtn primary" (click)="newEmployee()">
          <mat-icon>person_add</mat-icon> Add Employee
        </button>
        <button aria-label="Close" mat-icon-button class="close-btn" (click)="close()"><mat-icon>close</mat-icon></button>
      </div>
    </div>

    @if (!selected && !editing) {
      <!-- Search + filters -->
      <div class="dir-controls">
        <div class="dir-search">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Search by name, employee no, ID, job title, phone, email…"
                 [(ngModel)]="search" (ngModelChange)="onSearchChange()">
          @if (search) { <button aria-label="Close" mat-icon-button (click)="search=''; onSearchChange()"><mat-icon>close</mat-icon></button> }
        </div>
        <div class="site-chips">
          <button class="chip" [class.active]="siteFilter==='All'" (click)="setSite('All')">
            All <span class="chip-count">{{ total }}</span>
          </button>
          @for (s of sites; track s) {
            <button class="chip" [class.active]="siteFilter===s" (click)="setSite(s)">
              {{ s }} <span class="chip-count">{{ siteCount(s) }}</span>
            </button>
          }
        </div>
        <div class="status-row">
          <select [(ngModel)]="statusFilter" (ngModelChange)="load()">
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="On Leave">On Leave</option>
            <option value="Serving Notice">Serving Notice</option>
            <option value="Suspended">Suspended</option>
            <option value="Terminated">Terminated</option>
          </select>
          <select [(ngModel)]="typeFilter" (ngModelChange)="load()">
            <option value="All">All types</option>
            <option value="Permanent">Permanent</option>
            <option value="Contract">Contract</option>
            <option value="Temporary">Temporary</option>
            <option value="Internship">Internship</option>
          </select>
          <span class="result-count">{{ employees.length }} result{{ employees.length===1?'':'s' }}</span>
        </div>
      </div>

      <!-- List -->
      <div class="dir-list">
        @if (loading) {
          <div class="dir-loading"><mat-spinner diameter="34"></mat-spinner></div>
        } @else if (employees.length === 0) {
          <div class="dir-empty">
            <mat-icon>person_search</mat-icon>
            <p>No employees found.</p>
            @if (total === 0) {
              <button mat-flat-button class="hbtn primary" (click)="importFromSources()">
                <mat-icon>sync</mat-icon> Import existing employees
              </button>
            }
          </div>
        } @else {
          @for (e of employees; track e.id) {
            <div class="emp-row" (click)="open(e)">
              <div class="emp-avatar" [attr.data-status]="e.status">
                @if (e.hasPhoto) { <img [src]="photoUrl(e.id)" alt="" (error)="e.hasPhoto=false"> } @else { {{ initials(e) }} }
              </div>
              <div class="emp-main">
                <div class="emp-name">{{ e.fullName || (e.firstName + ' ' + e.lastName) }}
                  <span class="emp-type">{{ e.employmentType }}</span>
                </div>
                <div class="emp-meta">
                  <span>{{ e.jobTitle || '—' }}</span>
                  <span class="dot">•</span>
                  <span>{{ e.department || 'No dept' }}</span>
                  @if (e.employeeNumber) { <span class="dot">•</span><span>#{{ e.employeeNumber }}</span> }
                </div>
              </div>
              <div class="emp-side">
                <span class="site-tag">{{ e.site }}</span>
                <span class="status-tag" [attr.data-status]="e.status">{{ e.status }}</span>
                @if (e.documentCount) {
                  <span class="doc-tag" matTooltip="{{ e.documentCount }} document(s)"><mat-icon>description</mat-icon>{{ e.documentCount }}</span>
                }
              </div>
              <mat-icon class="emp-go">chevron_right</mat-icon>
            </div>
          }
        }
      </div>
    }

    <!-- Detail / edit view -->
    @if (selected || editing) {
      <div class="detail-wrap">
        <button mat-button class="back-link" (click)="backToList()"><mat-icon>arrow_back</mat-icon> Back to directory</button>

        <div class="detail-grid">
          <!-- Left: profile / form -->
          <div class="detail-card">
            <div class="dc-head">
              <div class="emp-avatar big" [attr.data-status]="form.status" (click)="photoInput.click()" matTooltip="Click to change photo">
                @if (form.id && (form.hasPhoto || photoTimestamp)) {
                  <img [src]="photoUrl(form.id) + (photoTimestamp ? '&t='+photoTimestamp : '')" alt="" (error)="form.hasPhoto=false; photoTimestamp=0">
                } @else { {{ initials(form) }} }
                <div class="photo-overlay"><mat-icon>photo_camera</mat-icon></div>
              </div>
              <input #photoInput type="file" accept="image/*" hidden (change)="uploadPhoto($event)">
              <div>
                <input class="edit-inline name" [(ngModel)]="form.firstName" placeholder="First name">
                <input class="edit-inline name" [(ngModel)]="form.lastName" placeholder="Last name">
              </div>
            </div>

            <div class="field-grid">
              <label>Site
                <select [(ngModel)]="form.site">
                  @for (s of sites; track s) { <option [value]="s">{{ s }}</option> }
                </select>
              </label>
              <label>Status
                <select [(ngModel)]="form.status">
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Serving Notice">Serving Notice</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Terminated">Terminated</option>
                </select>
              </label>
              <label>Employment Type
                <select [(ngModel)]="form.employmentType">
                  <option value="Permanent">Permanent</option>
                  <option value="Contract">Contract</option>
                  <option value="Temporary">Temporary</option>
                  <option value="Internship">Internship</option>
                </select>
              </label>
              <label>Employee No <input [(ngModel)]="form.employeeNumber" placeholder="e.g. 1024"></label>
              <label>Job Title <input [(ngModel)]="form.jobTitle" placeholder="e.g. Machine Operator"></label>
              <label>Department
                <select [(ngModel)]="form.department">
                  <option [ngValue]="null">— Select —</option>
                  @for (d of departments; track d) { <option [value]="d">{{ d }}</option> }
                </select>
              </label>
              <label>Nationality <input [(ngModel)]="form.nationality" placeholder="South African"></label>
              <label>ID Number <input [(ngModel)]="form.idNumber" placeholder="13-digit SA ID"></label>
              <label>Passport <input [(ngModel)]="form.passportNumber" placeholder="Non-SA passport"></label>
              <label>Phone <input [(ngModel)]="form.phoneNumber" placeholder="Mobile"></label>
              <label>Email <input [(ngModel)]="form.email" placeholder="name@company.com"></label>
              <label>Date of Birth <input type="date" [(ngModel)]="dobStr"></label>
              <label>Hire Date <input type="date" [(ngModel)]="hireStr"></label>
              <label>Contract End <input type="date" [(ngModel)]="contractStr"></label>
              <label class="full">Address <input [(ngModel)]="form.address" placeholder="Physical address"></label>
              <label>Emergency Contact <input [(ngModel)]="form.emergencyContactName" placeholder="Name"></label>
              <label>Emergency Phone <input [(ngModel)]="form.emergencyContactPhone" placeholder="Phone"></label>
              <label class="full">Notes <input [(ngModel)]="form.notes" placeholder="Anything HR should know"></label>
            </div>

            <div class="dc-actions">
              @if (form.id) {
                <button mat-stroked-button class="danger" (click)="remove()"><mat-icon>delete</mat-icon> Delete</button>
              }
              <span class="spacer"></span>
              <button mat-button (click)="backToList()">Cancel</button>
              <button mat-flat-button class="hbtn primary" (click)="save()" [disabled]="saving">
                <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon> Save
              </button>
            </div>
          </div>

          <!-- Right: documents -->
          <div class="detail-card docs-card">
            <div class="docs-head">
              <h3><mat-icon>folder</mat-icon> Documents &amp; Contracts</h3>
            </div>

            @if (!form.id) {
              <div class="docs-hint"><mat-icon>info</mat-icon> Save the employee first to attach documents.</div>
            } @else {
              <div class="upload-box">
                <div class="up-row">
                  <select [(ngModel)]="uploadCategory">
                    <option value="Contract">Contract</option>
                    <option value="ID Document">ID Document</option>
                    <option value="Passport">Passport</option>
                    <option value="Qualification">Qualification</option>
                    <option value="Certificate">Certificate</option>
                    <option value="Medical">Medical</option>
                    <option value="Disciplinary">Disciplinary</option>
                    <option value="Policy">Policy</option>
                    <option value="Payroll">Payroll</option>
                    <option value="Other">Other</option>
                  </select>
                  <input class="up-title" [(ngModel)]="uploadTitle" placeholder="Title (optional)">
                </div>
                <div class="up-row">
                  <input type="date" [(ngModel)]="uploadExpiry" matTooltip="Expiry date (contracts/permits)" class="up-expiry">
                  <label class="file-btn">
                    <mat-icon>upload_file</mat-icon>
                    <span>{{ pickedFile?.name || 'Choose file' }}</span>
                    <input type="file" hidden (change)="onFile($event)"
                           accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.txt">
                  </label>
                  <button mat-flat-button class="hbtn primary" (click)="uploadDoc()" [disabled]="!pickedFile || uploading">
                    <mat-icon>{{ uploading ? 'hourglass_empty' : 'add' }}</mat-icon> Upload
                  </button>
                </div>
              </div>

              @if (docsLoading) {
                <div class="dir-loading"><mat-spinner diameter="28"></mat-spinner></div>
              } @else if (documents.length === 0) {
                <div class="docs-empty"><mat-icon>description</mat-icon><p>No documents yet.</p></div>
              } @else {
                <div class="docs-list">
                  @for (d of documents; track d.id) {
                    <div class="doc-item">
                      <mat-icon class="doc-ico">{{ docIcon(d.category) }}</mat-icon>
                      <div class="doc-info">
                        <div class="doc-title">{{ d.title }}<span class="doc-cat">{{ d.category }}</span></div>
                        <div class="doc-meta">
                          {{ d.originalFileName }} · {{ fmtSize(d.fileSize) }} · {{ d.uploadedAt | date:'d MMM yyyy' }}
                          @if (d.expiryDate) {
                            <span class="doc-expiry" [class.expired]="isExpired(d.expiryDate)">
                              <mat-icon>event</mat-icon> {{ isExpired(d.expiryDate) ? 'Expired' : 'Expires' }} {{ d.expiryDate | date:'d MMM yyyy' }}
                            </span>
                          }
                        </div>
                      </div>
                      <button aria-label="Download" mat-icon-button (click)="downloadDoc(d)" matTooltip="Download"><mat-icon>download</mat-icon></button>
                      <button aria-label="Delete" mat-icon-button class="danger" (click)="deleteDoc(d)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>

        <!-- Disciplinary / warnings / suspensions -->
        <div class="detail-card disc-card">
          <div class="disc-head">
            <h3><mat-icon>gavel</mat-icon> Warnings, Suspensions &amp; Cases</h3>
            @if (form.id) {
              <button mat-flat-button class="hbtn primary" (click)="showCaseForm = !showCaseForm">
                <mat-icon>add</mat-icon> New Case
              </button>
            }
          </div>

          @if (!form.id) {
            <div class="docs-hint"><mat-icon>info</mat-icon> Save the employee first to log warnings or suspensions.</div>
          } @else {
            @if (showCaseForm) {
              <div class="case-form">
                <div class="cf-row">
                  <label>Type
                    <select [(ngModel)]="newCase.type">
                      @for (t of caseTypes; track t) { <option [value]="t">{{ t }}</option> }
                    </select>
                  </label>
                  <label>Issued Date <input type="date" [(ngModel)]="caseIssuedStr"></label>
                  <label>{{ newCase.type === 'Suspension' ? 'End Date' : 'Expiry' }} <input type="date" [(ngModel)]="caseExpiryStr"></label>
                </div>
                <label class="full">Title <input [(ngModel)]="newCase.title" placeholder="e.g. Late arrival — 3rd offence"></label>
                <label class="full">Description <textarea [(ngModel)]="newCase.description" rows="2" placeholder="What happened, and any agreed action"></textarea></label>
                @if (newCase.type === 'Suspension') {
                  <label class="chk"><input type="checkbox" [(ngModel)]="newCase.isPaidSuspension"> Paid suspension</label>
                }
                <div class="cf-actions">
                  <span class="cf-note" [class.warn]="newCase.type==='Suspension' || newCase.type==='Dismissal'">
                    @if (newCase.type === 'Suspension') { <mat-icon>info</mat-icon> Will set status to Suspended }
                    @else if (newCase.type === 'Dismissal') { <mat-icon>info</mat-icon> Will set status to Terminated }
                  </span>
                  <button mat-button (click)="showCaseForm=false">Cancel</button>
                  <button mat-flat-button class="hbtn primary" (click)="saveCase()" [disabled]="savingCase || !newCase.title">
                    <mat-icon>save</mat-icon> Log Case
                  </button>
                </div>
              </div>
            }

            @if (casesLoading) {
              <div class="dir-loading"><mat-spinner diameter="26"></mat-spinner></div>
            } @else if (cases.length === 0) {
              <div class="docs-empty"><mat-icon>verified_user</mat-icon><p>No disciplinary records — clean history.</p></div>
            } @else {
              <div class="case-list">
                @for (c of cases; track c.id) {
                  <div class="case-item" [attr.data-type]="c.type">
                    <mat-icon class="case-ico">{{ caseIcon(c.type) }}</mat-icon>
                    <div class="case-info">
                      <div class="case-title">{{ c.title }}
                        <span class="case-type">{{ c.type }}</span>
                        <span class="case-status" [attr.data-status]="c.status">{{ c.status }}</span>
                      </div>
                      <div class="case-meta">
                        {{ c.issuedDate | date:'d MMM yyyy' }}
                        @if (c.issuedByName) { · by {{ c.issuedByName }} }
                        @if (c.expiryDate) { · until {{ c.expiryDate | date:'d MMM yyyy' }} }
                      </div>
                      @if (c.description) { <div class="case-desc">{{ c.description }}</div> }
                    </div>
                    <div class="case-actions">
                      @if (c.status === 'Active' || c.status === 'Open') {
                        @if (c.type === 'Suspension') {
                          <button mat-stroked-button class="reinstate" (click)="resolveCase(c, true)">Reinstate</button>
                        } @else {
                          <button mat-stroked-button (click)="resolveCase(c, false)">Resolve</button>
                        }
                      }
                      <button aria-label="Delete" mat-icon-button class="danger" (click)="deleteCase(c)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    }
  </div>
  `,
  styles: [`
    :host { display:block; }
    .dir-root { display:flex; flex-direction:column; height:80vh; max-height:900px; background:var(--color-text); color:var(--color-line); }
    .dir-header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid rgba(255,255,255,0.08);
      background:linear-gradient(135deg,#1e1b4b,var(--color-text)); }
    .dir-title { display:flex; align-items:center; gap:14px; }
    .dir-title mat-icon { font-size:30px; width:30px; height:30px; color:#60a5fa; }
    .dir-title h2 { margin:0; font-size:20px; font-weight:800; }
    .dir-sub { font-size:12px; color:var(--color-text-3); }
    .dir-header-actions { display:flex; align-items:center; gap:10px; }
    .hbtn { font-size:13px !important; }
    .hbtn.primary { background:var(--color-primary) !important; color:#fff !important; }
    .close-btn { color:var(--color-text-3); }

    .dir-controls { padding:16px 24px 8px; border-bottom:1px solid rgba(255,255,255,0.06); }
    .dir-search { display:flex; align-items:center; gap:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1);
      border-radius:12px; padding:8px 14px; margin-bottom:12px; }
    .dir-search mat-icon { color:var(--color-text-3); }
    .dir-search input { flex:1; background:transparent; border:none; outline:none; color:var(--color-line); font-size:14px; }
    .site-chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
    .chip { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:20px; font-size:12.5px; cursor:pointer;
      background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--color-line-strong); transition:all .15s; }
    .chip:hover { background:rgba(255,255,255,0.1); }
    .chip.active { background:var(--color-primary); border-color:var(--color-primary); color:#fff; }
    .chip-count { font-size:11px; background:rgba(0,0,0,0.25); padding:1px 7px; border-radius:10px; }
    .status-row { display:flex; align-items:center; gap:10px; }
    .status-row select { background:rgba(255,255,255,0.06); color:var(--color-line); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:6px 10px; font-size:13px; }
    .result-count { margin-left:auto; font-size:12px; color:var(--color-text-3); }

    .dir-list { flex:1; overflow:auto; padding:12px 24px 24px; }
    .dir-loading, .dir-empty, .docs-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:48px; color:var(--color-text-3); }
    .dir-empty mat-icon, .docs-empty mat-icon { font-size:44px; width:44px; height:44px; color:var(--color-text-2); }

    .emp-row { display:flex; align-items:center; gap:14px; padding:12px 14px; border-radius:12px; cursor:pointer;
      background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); margin-bottom:8px; transition:all .15s; }
    .emp-row:hover { background:rgba(255,255,255,0.09); transform:translateX(2px); }
    .emp-avatar { width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg,var(--color-primary),var(--color-primary)); color:#fff;
      font-size:14px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden; position:relative; cursor:pointer; }
    .emp-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
    .emp-avatar.big { width:64px; height:64px; font-size:20px; }
    .emp-avatar .photo-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;
      opacity:0; transition:opacity .2s; border-radius:50%; }
    .emp-avatar.big:hover .photo-overlay { opacity:1; }
    .emp-avatar .photo-overlay mat-icon { color:#fff; font-size:22px; }
    .emp-avatar[data-status='Terminated'] { background:linear-gradient(135deg,var(--color-text-3),var(--color-text-2)); }
    .emp-avatar[data-status='Suspended'] { background:linear-gradient(135deg,var(--color-warn),var(--color-warn)); }
    .emp-main { flex:1; min-width:0; }
    .emp-name { font-size:14.5px; font-weight:600; color:var(--color-surface-2); display:flex; align-items:center; gap:8px; }
    .emp-type { font-size:10.5px; font-weight:600; color:#a5b4fc; background:rgba(129,140,248,0.15); padding:2px 8px; border-radius:10px; }
    .emp-meta { font-size:12px; color:var(--color-text-3); display:flex; align-items:center; gap:6px; margin-top:2px; }
    .emp-meta .dot { opacity:.5; }
    .emp-side { display:flex; align-items:center; gap:8px; }
    .site-tag { font-size:11px; padding:3px 9px; border-radius:8px; background:rgba(56,189,248,0.15); color:#7dd3fc; }
    .status-tag { font-size:11px; padding:3px 9px; border-radius:8px; }
    .status-tag[data-status='Active'] { background:rgba(16,185,129,0.15); color:#6ee7b7; }
    .status-tag[data-status='On Leave'] { background:rgba(139,92,246,0.15); color:#c4b5fd; }
    .status-tag[data-status='Serving Notice'] { background:rgba(245,158,11,0.15); color:#fcd34d; }
    .status-tag[data-status='Suspended'] { background:rgba(239,68,68,0.15); color:#fca5a5; }
    .status-tag[data-status='Terminated'] { background:rgba(100,116,139,0.2); color:var(--color-line-strong); }
    .doc-tag { display:inline-flex; align-items:center; gap:3px; font-size:11px; color:var(--color-text-3); }
    .doc-tag mat-icon { font-size:15px; width:15px; height:15px; }
    .emp-go { color:var(--color-text-2); }

    /* Detail / edit */
    .detail-wrap { flex:1; overflow:auto; padding:16px 24px 28px; }
    .back-link { color:#a5b4fc !important; margin-bottom:12px; }
    .detail-grid { display:grid; grid-template-columns:1.4fr 1fr; gap:18px; }
    @media (max-width:1000px){ .detail-grid { grid-template-columns:1fr; } }
    .detail-card { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:16px; padding:20px; }
    .dc-head { display:flex; align-items:center; gap:16px; margin-bottom:18px; }
    .edit-inline { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:8px 10px; color:var(--color-surface-2); font-size:14px; }
    .edit-inline.name { font-size:16px; font-weight:700; margin-right:8px; width:150px; }
    .field-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
    .field-grid label { display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--color-text-3); text-transform:uppercase; letter-spacing:.4px; }
    .field-grid label.full { grid-column:1 / -1; }
    .field-grid input, .field-grid select { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:8px;
      padding:8px 10px; color:var(--color-surface-2); font-size:13.5px; text-transform:none; letter-spacing:normal; }
    .dc-actions { display:flex; align-items:center; gap:10px; margin-top:20px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.08); }
    .dc-actions .spacer { flex:1; }
    .danger { color:#fca5a5 !important; border-color:rgba(252,165,165,0.4) !important; }

    .docs-card { display:flex; flex-direction:column; }
    .docs-head h3 { margin:0 0 14px; font-size:15px; display:flex; align-items:center; gap:8px; color:var(--color-line); }
    .docs-head mat-icon { color:#60a5fa; }
    .docs-hint, .docs-empty { color:var(--color-text-3); font-size:13px; display:flex; align-items:center; gap:8px; padding:16px; }
    .upload-box { background:rgba(255,255,255,0.04); border:1px dashed rgba(255,255,255,0.15); border-radius:12px; padding:12px; margin-bottom:14px; }
    .up-row { display:flex; gap:8px; margin-bottom:8px; align-items:center; }
    .up-row:last-child { margin-bottom:0; }
    .upload-box select, .upload-box input { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:7px 9px; color:var(--color-surface-2); font-size:12.5px; }
    .up-title { flex:1; }
    .up-expiry { width:140px; }
    .file-btn { flex:1; display:flex; align-items:center; gap:8px; cursor:pointer; background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.12); border-radius:8px; padding:7px 10px; font-size:12.5px; color:var(--color-line-strong); overflow:hidden; }
    .file-btn span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .docs-list { display:flex; flex-direction:column; gap:8px; overflow:auto; }
    .doc-item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:10px; background:rgba(255,255,255,0.04); }
    .doc-ico { color:#a5b4fc; }
    .doc-info { flex:1; min-width:0; }
    .doc-title { font-size:13px; font-weight:600; color:var(--color-surface-2); display:flex; align-items:center; gap:8px; }
    .doc-cat { font-size:10px; font-weight:600; padding:1px 7px; border-radius:8px; background:rgba(129,140,248,0.15); color:#c7d2fe; text-transform:uppercase; }
    .doc-meta { font-size:11px; color:var(--color-text-3); margin-top:2px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .doc-expiry { display:inline-flex; align-items:center; gap:3px; color:#fcd34d; }
    .doc-expiry.expired { color:#fca5a5; }
    .doc-expiry mat-icon { font-size:13px; width:13px; height:13px; }

    /* Disciplinary */
    .disc-card { grid-column:1 / -1; }
    .disc-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    .disc-head h3 { margin:0; font-size:15px; display:flex; align-items:center; gap:8px; color:var(--color-line); }
    .disc-head mat-icon { color:#fca5a5; }
    .case-form { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:12px; padding:14px; margin-bottom:14px; }
    .case-form .cf-row { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:10px; }
    .case-form label { display:flex; flex-direction:column; gap:5px; font-size:11.5px; color:var(--color-text-3); text-transform:uppercase; letter-spacing:.4px; margin-bottom:10px; }
    .case-form label.full { grid-column:1 / -1; }
    .case-form label.chk { flex-direction:row; align-items:center; gap:8px; text-transform:none; }
    .case-form input, .case-form select, .case-form textarea { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
      border-radius:8px; padding:8px 10px; color:var(--color-surface-2); font-size:13.5px; text-transform:none; letter-spacing:normal; }
    .cf-actions { display:flex; align-items:center; gap:10px; }
    .cf-note { flex:1; display:flex; align-items:center; gap:4px; font-size:11.5px; color:var(--color-text-3); }
    .cf-note.warn { color:#fcd34d; }
    .cf-note mat-icon { font-size:15px; width:15px; height:15px; }
    .case-list { display:flex; flex-direction:column; gap:8px; }
    .case-item { display:flex; align-items:flex-start; gap:12px; padding:12px 14px; border-radius:10px; background:rgba(255,255,255,0.04); border-left:3px solid var(--color-text-3); }
    .case-item[data-type='Suspension'] { border-left-color:var(--color-danger); }
    .case-item[data-type='Final Written Warning'] { border-left-color:var(--color-warn); }
    .case-item[data-type='Written Warning'] { border-left-color:#eab308; }
    .case-item[data-type='Dismissal'] { border-left-color:#991b1b; }
    .case-ico { color:var(--color-line-strong); margin-top:2px; }
    .case-info { flex:1; min-width:0; }
    .case-title { font-size:13.5px; font-weight:600; color:var(--color-surface-2); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .case-type { font-size:10px; font-weight:600; padding:1px 7px; border-radius:8px; background:rgba(148,163,184,0.2); color:var(--color-line-strong); text-transform:uppercase; }
    .case-status { font-size:10px; font-weight:600; padding:1px 7px; border-radius:8px; }
    .case-status[data-status='Active'] { background:rgba(239,68,68,0.16); color:#fca5a5; }
    .case-status[data-status='Resolved'] { background:rgba(16,185,129,0.16); color:#6ee7b7; }
    .case-status[data-status='Expired'] { background:rgba(148,163,184,0.2); color:var(--color-line-strong); }
    .case-meta { font-size:11.5px; color:var(--color-text-3); margin-top:2px; }
    .case-desc { font-size:12.5px; color:var(--color-line-strong); margin-top:5px; }
    .case-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
    .reinstate { color:#6ee7b7 !important; border-color:rgba(110,231,183,0.4) !important; }
  `]
})
export class EmployeeDirectoryComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private ref = inject(MatDialogRef<EmployeeDirectoryComponent>);
  private readonly confirmDialog = inject(ConfirmService);

  sites: string[] = [];
  siteCounts: { site: string; count: number }[] = [];
  total = 0;
  departments: string[] = [];

  employees: HrEmployee[] = [];
  loading = false;
  search = '';
  siteFilter = 'All';
  statusFilter = 'All';
  typeFilter = 'All';
  private searchTimer: any;

  selected: HrEmployee | null = null;
  editing = false;
  form: HrEmployee = this.blank();
  saving = false;
  importing = false;

  // date string bridges for <input type="date">
  dobStr = ''; hireStr = ''; contractStr = '';

  // documents
  documents: HrDocument[] = [];
  docsLoading = false;
  pickedFile: File | null = null;
  uploadCategory = 'Contract';
  uploadTitle = '';
  uploadExpiry = '';
  uploading = false;
  photoTimestamp = 0;

  // disciplinary
  cases: HrCase[] = [];
  casesLoading = false;
  showCaseForm = false;
  savingCase = false;
  caseTypes: string[] = ['Verbal Warning', 'Written Warning', 'Final Written Warning', 'Suspension', 'Dismissal', 'Grievance', 'Investigation', 'Incident'];
  newCase: Partial<HrCase> = { type: 'Verbal Warning', title: '', description: '', isPaidSuspension: false };
  caseIssuedStr = '';
  caseExpiryStr = '';

  ngOnInit(): void {
    this.loadSites();
    this.loadDepartments();
    this.loadSiteCounts();
    this.load();
  }

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  private blank(): HrEmployee {
    return { id: 0, firstName: '', lastName: '', site: 'Main Office', employmentType: 'Permanent', status: 'Active' };
  }

  loadSites(): void {
    this.http.get<string[]>(`${environment.apiUrl}/hr-employees/sites`, { headers: this.headers() })
      .subscribe({ next: s => this.sites = s, error: () => {} });
  }

  loadDepartments(): void {
    this.http.get<string[]>(`${environment.apiUrl}/hr-employees/departments`, { headers: this.headers() })
      .subscribe({ next: d => this.departments = d, error: () => {} });
  }

  loadSiteCounts(): void {
    this.http.get<any>(`${environment.apiUrl}/hr-employees/site-counts`, { headers: this.headers() })
      .subscribe({ next: c => { this.total = c.total; this.siteCounts = c.bySite; }, error: () => {} });
  }

  siteCount(site: string): number {
    return this.siteCounts.find(c => c.site === site)?.count ?? 0;
  }

  load(): void {
    this.loading = true;
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    if (this.siteFilter !== 'All') params.set('site', this.siteFilter);
    if (this.statusFilter !== 'All') params.set('status', this.statusFilter);
    if (this.typeFilter !== 'All') params.set('employmentType', this.typeFilter);
    this.http.get<HrEmployee[]>(`${environment.apiUrl}/hr-employees?${params.toString()}`, { headers: this.headers() })
      .subscribe({
        next: r => { this.employees = r; this.loading = false; },
        error: () => { this.loading = false; }
      });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 300);
  }

  setSite(s: string): void { this.siteFilter = s; this.load(); }

  initials(e: { firstName?: string; lastName?: string }): string {
    return ((e.firstName?.[0] || '') + (e.lastName?.[0] || '')).toUpperCase() || '?';
  }

  photoUrl(id: number): string {
    return `${environment.apiUrl}/hr-employees/${id}/photo?_=${id}`;
  }

  uploadPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.form.id) return;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(`${environment.apiUrl}/hr-employees/${this.form.id}/photo`, fd, { headers: new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token') || localStorage.getItem('auth_token') || ''}` }) })
      .subscribe({
        next: () => {
          this.form.hasPhoto = true;
          this.photoTimestamp = Date.now();
          this.toast.done('Photo updated.');
        },
        error: () => this.toast.error('Photo upload failed.')
      });
    input.value = '';
  }

  // ---- detail / edit ----
  newEmployee(): void {
    this.form = this.blank();
    this.dobStr = this.hireStr = this.contractStr = '';
    this.documents = [];
    this.cases = [];
    this.showCaseForm = false;
    this.photoTimestamp = 0;
    this.editing = true;
    this.selected = null;
  }

  open(e: HrEmployee): void {
    this.http.get<any>(`${environment.apiUrl}/hr-employees/${e.id}`, { headers: this.headers() })
      .subscribe({
        next: r => {
          this.form = { ...r.employee };
          this.form.hasPhoto = !!r.employee.profilePhotoPath || !!e.hasPhoto;
          this.photoTimestamp = Date.now();
          this.dobStr = this.toDateInput(r.employee.dateOfBirth);
          this.hireStr = this.toDateInput(r.employee.hireDate);
          this.contractStr = this.toDateInput(r.employee.contractEndDate);
          this.documents = r.documents || [];
          this.selected = e;
          this.editing = true;
          this.loadCases(e.id);
        },
        error: () => this.toast.error('Could not load employee.')
      });
  }

  backToList(): void {
    this.selected = null; this.editing = false;
    this.form = this.blank(); this.pickedFile = null;
    this.cases = []; this.showCaseForm = false;
    this.load(); this.loadSiteCounts();
  }

  // ---- disciplinary ----
  loadCases(employeeId: number): void {
    this.casesLoading = true;
    this.http.get<HrCase[]>(`${environment.apiUrl}/hr-disciplinary/employee/${employeeId}`, { headers: this.headers() })
      .subscribe({
        next: c => { this.cases = c; this.casesLoading = false; },
        error: () => { this.casesLoading = false; }
      });
  }

  saveCase(): void {
    if (!this.form.id || !this.newCase.title) return;
    this.savingCase = true;
    const body = {
      employeeId: this.form.id,
      type: this.newCase.type,
      title: this.newCase.title,
      description: this.newCase.description,
      issuedDate: this.caseIssuedStr ? new Date(this.caseIssuedStr).toISOString() : null,
      expiryDate: this.caseExpiryStr ? new Date(this.caseExpiryStr).toISOString() : null,
      isPaidSuspension: this.newCase.isPaidSuspension || false,
      updateEmployeeStatus: true
    };
    this.http.post<HrCase>(`${environment.apiUrl}/hr-disciplinary`, body, { headers: this.headers() })
      .subscribe({
        next: c => {
          this.cases.unshift(c);
          this.savingCase = false;
          this.showCaseForm = false;
          this.newCase = { type: 'Verbal Warning', title: '', description: '', isPaidSuspension: false };
          this.caseIssuedStr = ''; this.caseExpiryStr = '';
          // reflect any status change (suspension/dismissal) on the form
          if (body.type === 'Suspension') this.form.status = 'Suspended';
          else if (body.type === 'Dismissal') this.form.status = 'Terminated';
          this.toast.done('Case logged.');
        },
        error: () => { this.savingCase = false; this.toast.error('Could not log case.'); }
      });
  }

  resolveCase(c: HrCase, reinstate: boolean): void {
    this.http.put<HrCase>(`${environment.apiUrl}/hr-disciplinary/${c.id}`,
      { status: 'Resolved', reinstateEmployee: reinstate }, { headers: this.headers() })
      .subscribe({
        next: () => {
          c.status = 'Resolved';
          if (reinstate && this.form.status === 'Suspended') this.form.status = 'Active';
          this.toast.done(reinstate ? 'Resolved & reinstated.' : 'Case resolved.');
        },
        error: () => this.toast.error('Update failed.')
      });
  }

  async deleteCase(c: HrCase): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete case "${c.title}"?`,
      confirmText: 'Delete case',
      danger: true
    }))) return;
    this.http.delete(`${environment.apiUrl}/hr-disciplinary/${c.id}`, { headers: this.headers() })
      .subscribe({
        next: () => { this.cases = this.cases.filter(x => x.id !== c.id); },
        error: () => this.toast.error('Delete failed.')
      });
  }

  caseIcon(type: string): string {
    switch (type) {
      case 'Suspension': return 'block';
      case 'Dismissal': return 'person_remove';
      case 'Grievance': return 'record_voice_over';
      case 'Investigation': return 'search';
      case 'Incident': return 'report';
      default: return 'warning';
    }
  }

  save(): void {
    if (!this.form.firstName?.trim() || !this.form.lastName?.trim()) {
      this.toast.warn('First and last name are required.'); return;
    }
    this.form.dateOfBirth = this.fromDateInput(this.dobStr);
    this.form.hireDate = this.fromDateInput(this.hireStr);
    this.form.contractEndDate = this.fromDateInput(this.contractStr);
    this.saving = true;

    const done = (saved: HrEmployee) => {
      this.saving = false;
      this.form = { ...saved };
      this.selected = saved;
      this.toast.done('Employee saved.');
      this.loadSiteCounts();
    };
    const fail = () => { this.saving = false; this.toast.error('Save failed.'); };

    if (this.form.id) {
      this.http.put<HrEmployee>(`${environment.apiUrl}/hr-employees/${this.form.id}`, this.form, { headers: this.headers() })
        .subscribe({ next: done, error: fail });
    } else {
      this.http.post<HrEmployee>(`${environment.apiUrl}/hr-employees`, this.form, { headers: this.headers() })
        .subscribe({ next: done, error: fail });
    }
  }

  async remove(): Promise<void> {
    if (!this.form.id) return;
    const name = `${this.form.firstName || ''} ${this.form.lastName || ''}`.trim();
    if (!(await this.confirmDialog.ask({
      title: name ? `Delete ${name}?` : 'Delete this employee?',
      message: 'The employee and all their documents are deleted.',
      confirmText: 'Delete employee',
      danger: true
    }))) return;
    this.http.delete(`${environment.apiUrl}/hr-employees/${this.form.id}`, { headers: this.headers() })
      .subscribe({
        next: () => { this.toast.done('Employee deleted.'); this.backToList(); },
        error: () => this.toast.error('Delete failed.')
      });
  }

  // ---- documents ----
  onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.pickedFile = input.files?.[0] || null;
    if (this.pickedFile && !this.uploadTitle) this.uploadTitle = this.pickedFile.name.replace(/\.[^.]+$/, '');
  }

  uploadDoc(): void {
    if (!this.pickedFile || !this.form.id) return;
    const fd = new FormData();
    fd.append('file', this.pickedFile);
    fd.append('category', this.uploadCategory);
    if (this.uploadTitle) fd.append('title', this.uploadTitle);
    if (this.uploadExpiry) fd.append('expiryDate', new Date(this.uploadExpiry).toISOString());
    this.uploading = true;
    this.http.post<HrDocument>(`${environment.apiUrl}/hr-employees/${this.form.id}/documents`, fd, { headers: this.headers() })
      .subscribe({
        next: d => {
          this.documents.unshift(d);
          this.pickedFile = null; this.uploadTitle = ''; this.uploadExpiry = '';
          this.uploading = false;
          this.toast.done('Document uploaded.');
        },
        error: () => { this.uploading = false; this.toast.error('Upload failed.'); }
      });
  }

  downloadDoc(d: HrDocument): void {
    this.http.get(`${environment.apiUrl}/hr-employees/documents/${d.id}/download`, { headers: this.headers(), responseType: 'blob' })
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = d.originalFileName || d.title; a.click();
          URL.revokeObjectURL(url);
        },
        error: () => this.toast.error('Download failed.')
      });
  }

  async deleteDoc(d: HrDocument): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete "${d.title}"?`,
      confirmText: 'Delete document',
      danger: true
    }))) return;
    this.http.delete(`${environment.apiUrl}/hr-employees/documents/${d.id}`, { headers: this.headers() })
      .subscribe({
        next: () => { this.documents = this.documents.filter(x => x.id !== d.id); },
        error: () => this.toast.error('Delete failed.')
      });
  }

  // ---- import ----
  importFromSources(): void {
    this.importing = true;
    this.http.post<any>(`${environment.apiUrl}/hr-employees/import`, {}, { headers: this.headers() })
      .subscribe({
        next: r => {
          this.importing = false;
          this.toast.done(`Imported ${r.importedBiometric} main-office + ${r.importedDrivers} drivers (${r.skipped} already present).`);
          this.loadSiteCounts(); this.load();
        },
        error: () => { this.importing = false; this.toast.error('Import failed.'); }
      });
  }

  close(): void { this.ref.close(); }

  // ---- helpers ----
  docIcon(cat: string): string {
    switch (cat) {
      case 'Contract': return 'assignment';
      case 'ID Document': case 'Passport': return 'badge';
      case 'Qualification': case 'Certificate': return 'school';
      case 'Medical': return 'medical_services';
      case 'Disciplinary': return 'gavel';
      case 'Policy': return 'policy';
      case 'Payroll': return 'payments';
      default: return 'description';
    }
  }

  fmtSize(bytes: number): string {
    if (!bytes) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let n = bytes;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
  }

  isExpired(d?: string | null): boolean {
    return !!d && new Date(d) < new Date();
  }

  private toDateInput(v?: string | null): string {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  private fromDateInput(v: string): string | null {
    return v ? new Date(v).toISOString() : null;
  }
}
