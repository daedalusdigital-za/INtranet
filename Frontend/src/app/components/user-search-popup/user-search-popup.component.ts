import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService, User } from '../../services/message.service';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-user-search-popup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-search-popup.component.html',
  styleUrls: ['./user-search-popup.component.scss']
})
export class UserSearchPopupComponent implements OnInit {
  @Input() currentUserId: number = 0;
  @Output() close = new EventEmitter<void>();
  @Output() userSelected = new EventEmitter<User>();

  searchQuery = '';
  users: User[] = [];
  filteredUsers: User[] = [];
  isLoading = false;
  hasSearched = false;
  
  private searchSubject = new Subject<string>();

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    // Load initial users
    this.loadUsers();
    
    // Setup debounced search
    this.searchSubject.pipe(
      debounceTime(300)
    ).subscribe((query: string) => {
      this.filterUsers(query);
    });
  }

  loadUsers(): void {
    this.isLoading = true;
    this.messageService.searchUsers('', this.currentUserId).subscribe({
      next: (users: User[]) => {
        this.users = users;
        this.filteredUsers = users;
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Error loading users:', err);
        this.isLoading = false;
      }
    });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchQuery);
  }

  filterUsers(query: string): void {
    this.hasSearched = true;
    
    if (!query.trim()) {
      this.filteredUsers = this.users;
      return;
    }
    
    const lowerQuery = query.toLowerCase();
    this.filteredUsers = this.users.filter(user => 
      user.name.toLowerCase().includes(lowerQuery) ||
      user.surname.toLowerCase().includes(lowerQuery) ||
      user.email.toLowerCase().includes(lowerQuery) ||
      (user.department && user.department.toLowerCase().includes(lowerQuery)) ||
      (user.position && user.position.toLowerCase().includes(lowerQuery))
    );
  }

  selectUser(user: User): void {
    this.userSelected.emit(user);
  }

  closePopup(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('popup-backdrop')) {
      this.closePopup();
    }
  }

  getInitials(user: User): string {
    return `${user.name?.charAt(0) || ''}${user.surname?.charAt(0) || ''}`.toUpperCase();
  }
}
