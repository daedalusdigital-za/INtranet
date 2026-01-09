import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SupportTicket {
  ticketId: number;
  title: string;
  description: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'InProgress' | 'Resolved' | 'Closed';
  category: string;
  submittedBy: string;
  submittedByEmail?: string;
  assignedTo?: string;
  submittedDate: Date;
  firstResponseDate?: Date;
  resolvedDate?: Date;
  closedDate?: Date;
  lastUpdated: Date;
  resolution?: string;
  comments: TicketComment[];
}

export interface TicketComment {
  commentId: number;
  ticketId: number;
  content: string;
  author: string;
  createdAt: Date;
  isInternal: boolean;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  priority: string;
  category: string;
  submittedBy: string;
  submittedByEmail?: string;
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  category?: string;
  assignedTo?: string;
  resolution?: string;
}

export interface AddCommentRequest {
  content: string;
  author: string;
  isInternal?: boolean;
}

export interface TicketStatistics {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResponseTimeHours: number;
  averageResolutionTimeHours: number;
  resolutionRate: number;
  ticketsByCategory: { [key: string]: number };
  ticketsByPriority: { [key: string]: number };
}

export interface TicketFilter {
  status?: string;
  priority?: string;
  category?: string;
  fromDate?: Date;
  toDate?: Date;
  submittedBy?: string;
  assignedTo?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupportTicketService {
  private apiUrl = '/api/supporttickets';

  constructor(private http: HttpClient) {}

  // Get all tickets with optional filtering
  getTickets(filter?: TicketFilter): Observable<SupportTicket[]> {
    let params = new HttpParams();
    
    if (filter) {
      if (filter.status) params = params.set('status', filter.status);
      if (filter.priority) params = params.set('priority', filter.priority);
      if (filter.category) params = params.set('category', filter.category);
      if (filter.fromDate) params = params.set('fromDate', filter.fromDate.toISOString());
      if (filter.toDate) params = params.set('toDate', filter.toDate.toISOString());
      if (filter.submittedBy) params = params.set('submittedBy', filter.submittedBy);
      if (filter.assignedTo) params = params.set('assignedTo', filter.assignedTo);
    }
    
    return this.http.get<SupportTicket[]>(this.apiUrl, { params });
  }

  // Get open tickets
  getOpenTickets(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(`${this.apiUrl}/open`);
  }

  // Get closed tickets
  getClosedTickets(): Observable<SupportTicket[]> {
    return this.http.get<SupportTicket[]>(`${this.apiUrl}/closed`);
  }

  // Get single ticket by ID
  getTicket(id: number): Observable<SupportTicket> {
    return this.http.get<SupportTicket>(`${this.apiUrl}/${id}`);
  }

  // Get statistics
  getStatistics(fromDate?: Date, toDate?: Date): Observable<TicketStatistics> {
    let params = new HttpParams();
    if (fromDate) params = params.set('fromDate', fromDate.toISOString());
    if (toDate) params = params.set('toDate', toDate.toISOString());
    
    return this.http.get<TicketStatistics>(`${this.apiUrl}/statistics`, { params });
  }

  // Create new ticket
  createTicket(ticket: CreateTicketRequest): Observable<SupportTicket> {
    return this.http.post<SupportTicket>(this.apiUrl, ticket);
  }

  // Update ticket
  updateTicket(id: number, update: UpdateTicketRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, update);
  }

  // Close ticket
  closeTicket(id: number, resolution?: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/close`, JSON.stringify(resolution), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Reopen ticket
  reopenTicket(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/reopen`, {});
  }

  // Add comment
  addComment(ticketId: number, comment: AddCommentRequest): Observable<TicketComment> {
    return this.http.post<TicketComment>(`${this.apiUrl}/${ticketId}/comments`, comment);
  }

  // Delete ticket
  deleteTicket(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}


