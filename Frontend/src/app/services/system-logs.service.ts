import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SystemLog {
  id: number;
  action: string;
  category: 'user' | 'announcement' | 'settings' | 'security' | 'system';
  description: string;
  userId: number;
  userName: string;
  ipAddress?: string;
  timestamp: Date;
  details?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SystemLogsService {
  private apiUrl = `${environment.apiUrl}/logs`;
  private logsSubject = new BehaviorSubject<SystemLog[]>([]);
  
  // In-memory logs for demo (will be replaced with API calls)
  private mockLogs: SystemLog[] = [
    {
      id: 1,
      action: 'User Login',
      category: 'security',
      description: 'User logged in successfully',
      userId: 1,
      userName: 'Admin User',
      ipAddress: '192.168.10.30',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      details: 'Browser: Chrome, OS: Windows'
    },
    {
      id: 2,
      action: 'User Created',
      category: 'user',
      description: 'New user account created: john.doe@company.com',
      userId: 1,
      userName: 'Admin User',
      timestamp: new Date(Date.now() - 1000 * 60 * 30)
    },
    {
      id: 3,
      action: 'Announcement Published',
      category: 'announcement',
      description: 'Published announcement: "Company Holiday Schedule"',
      userId: 1,
      userName: 'Admin User',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2)
    },
    {
      id: 4,
      action: 'Settings Updated',
      category: 'settings',
      description: 'System settings updated: Email notifications enabled',
      userId: 1,
      userName: 'Admin User',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24)
    },
    {
      id: 5,
      action: 'User Role Changed',
      category: 'user',
      description: 'User role changed from "User" to "Manager" for jane.doe@company.com',
      userId: 1,
      userName: 'Admin User',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48)
    }
  ];

  constructor(private http: HttpClient) {
    this.logsSubject.next(this.mockLogs);
  }

  getLogs(filter?: { category?: string; startDate?: Date; endDate?: Date }): Observable<SystemLog[]> {
    let logs = [...this.mockLogs];
    
    if (filter?.category && filter.category !== 'all') {
      logs = logs.filter(log => log.category === filter.category);
    }
    
    if (filter?.startDate) {
      logs = logs.filter(log => new Date(log.timestamp) >= filter.startDate!);
    }
    
    if (filter?.endDate) {
      logs = logs.filter(log => new Date(log.timestamp) <= filter.endDate!);
    }
    
    return of(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  }

  addLog(log: Omit<SystemLog, 'id' | 'timestamp'>): void {
    const newLog: SystemLog = {
      ...log,
      id: this.mockLogs.length + 1,
      timestamp: new Date()
    };
    this.mockLogs.unshift(newLog);
    this.logsSubject.next(this.mockLogs);
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'user': 'person',
      'announcement': 'campaign',
      'settings': 'settings',
      'security': 'security',
      'system': 'computer'
    };
    return icons[category] || 'info';
  }

  getCategoryColor(category: string): string {
    const colors: { [key: string]: string } = {
      'user': '#2196f3',
      'announcement': '#ff9800',
      'settings': '#9c27b0',
      'security': '#f44336',
      'system': '#607d8b'
    };
    return colors[category] || '#666';
  }
}
