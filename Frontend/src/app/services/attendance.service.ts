import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { Employee, AttendanceMetrics, CheckInRequest, CheckOutRequest } from '../models/attendance.model';

// Hardcoded development environment
const environment = {
  production: false,
  apiUrl: 'http://localhost:5143/api',
  signalRUrl: 'http://localhost:5143',
  enableDebugMode: true,
  logLevel: 'debug'
};

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private apiUrl = `${environment.apiUrl}/attendance`;
  private hubConnection!: signalR.HubConnection;
  private refreshSubject = new BehaviorSubject<void>(undefined);
  public refresh$ = this.refreshSubject.asObservable();

  constructor(private http: HttpClient) {
    console.log('🔧 AttendanceService Environment:', environment);
    console.log('📡 API URL:', this.apiUrl);
    this.startConnection();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // SignalR Connection
  private startConnection(): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl.replace('/api', '')}/hubs/attendance`, {
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('AttendanceHub connection started'))
      .catch(err => console.error('Error starting AttendanceHub connection:', err));

    // Listen to events
    this.hubConnection.on('EmployeeCheckedIn', (data: any) => {
      console.log('Employee checked in:', data);
      this.refreshSubject.next();
    });

    this.hubConnection.on('EmployeeCheckedOut', (data: any) => {
      console.log('Employee checked out:', data);
      this.refreshSubject.next();
    });

    this.hubConnection.on('RefreshDashboard', () => {
      console.log('Dashboard refresh requested');
      this.refreshSubject.next();
    });
  }

  // API Methods
  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/employees`, { headers: this.getHeaders() });
  }

  getMetrics(): Observable<AttendanceMetrics> {
    return this.http.get<AttendanceMetrics>(`${this.apiUrl}/metrics`, { headers: this.getHeaders() });
  }

  getWeeklyAttendance(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/weekly`, { headers: this.getHeaders() });
  }

  getEmployee(id: number): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/employee/${id}`, { headers: this.getHeaders() });
  }

  checkIn(request: CheckInRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/checkin`, request, { headers: this.getHeaders() });
  }

  checkOut(request: CheckOutRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/checkout`, request, { headers: this.getHeaders() });
  }

  // Cleanup
  stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }
}
