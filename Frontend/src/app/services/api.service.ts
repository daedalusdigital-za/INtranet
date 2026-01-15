import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Department, Board, Card, CardDetail, CreateCardRequest, MoveCardRequest, CreateCommentRequest, Comment, BoardChecklistItem, CreateChecklistItemRequest, UpdateChecklistItemRequest, UpdateBoardStatusRequest, BoardMember, InviteBoardMemberRequest, CreateBoardRequest, ActiveCallsResponse, CdrQuery, CdrResponse, ExtensionStatus, PbxStatus } from '../models/models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // Departments
  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(`${this.apiUrl}/departments`);
  }

  getDepartment(id: number): Observable<Department> {
    return this.http.get<Department>(`${this.apiUrl}/departments/${id}`);
  }

  createDepartment(department: { name: string, managerName: string }): Observable<Department> {
    return this.http.post<Department>(`${this.apiUrl}/departments`, department);
  }

  // Boards
  getAllBoards(): Observable<Board[]> {
    return this.http.get<Board[]>(`${this.apiUrl}/boards`);
  }

  getBoardsByDepartment(departmentId: number): Observable<Board[]> {
    return this.http.get<Board[]>(`${this.apiUrl}/boards/department/${departmentId}`);
  }

  getBoard(id: number): Observable<Board> {
    return this.http.get<Board>(`${this.apiUrl}/boards/${id}`);
  }

  createBoard(board: CreateBoardRequest): Observable<Board> {
    return this.http.post<Board>(`${this.apiUrl}/boards`, board);
  }

  updateBoard(id: number, board: { departmentId: number; title: string; description?: string }): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/boards/${id}`, board);
  }

  deleteBoard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boards/${id}`);
  }

  updateBoardStatus(id: number, request: UpdateBoardStatusRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/boards/${id}/status`, request);
  }

  // Board Members
  getBoardMembers(boardId: number): Observable<BoardMember[]> {
    return this.http.get<BoardMember[]>(`${this.apiUrl}/boards/${boardId}/members`);
  }

  inviteBoardMember(boardId: number, request: InviteBoardMemberRequest): Observable<BoardMember> {
    return this.http.post<BoardMember>(`${this.apiUrl}/boards/${boardId}/members`, request);
  }

  removeBoardMember(boardId: number, memberId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boards/${boardId}/members/${memberId}`);
  }

  // Board Checklist
  addChecklistItem(boardId: number, item: CreateChecklistItemRequest): Observable<BoardChecklistItem> {
    return this.http.post<BoardChecklistItem>(`${this.apiUrl}/boards/${boardId}/checklist`, item);
  }

  updateChecklistItem(boardId: number, itemId: number, request: UpdateChecklistItemRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/boards/${boardId}/checklist/${itemId}`, request);
  }

  deleteChecklistItem(boardId: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boards/${boardId}/checklist/${itemId}`);
  }

  // Cards
  getCard(id: number): Observable<CardDetail> {
    return this.http.get<CardDetail>(`${this.apiUrl}/cards/${id}`);
  }

  createCard(card: CreateCardRequest): Observable<Card> {
    return this.http.post<Card>(`${this.apiUrl}/cards`, card);
  }

  updateCard(id: number, card: CreateCardRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/cards/${id}`, card);
  }

  moveCard(id: number, moveRequest: MoveCardRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/cards/${id}/move`, moveRequest);
  }

  deleteCard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/cards/${id}`);
  }

  // Comments
  addComment(cardId: number, comment: CreateCommentRequest): Observable<Comment> {
    return this.http.post<Comment>(`${this.apiUrl}/cards/${cardId}/comments`, comment);
  }

  // Lists
  createList(list: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/lists`, list);
  }

  // Attendance
  getEarliestEmployeeToday(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/attendance/earliest-today`);
  }

  // Employees
  getEmployees(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/attendance/employees`);
  }

  // PBX - Active Calls
  getActiveCalls(): Observable<ActiveCallsResponse> {
    return this.http.get<ActiveCallsResponse>(`${this.apiUrl}/pbx/active-calls`);
  }

  // PBX - Call Detail Records (CDR)
  getCallHistory(query?: CdrQuery): Observable<CdrResponse> {
    let params = new HttpParams();
    if (query) {
      if (query.startDate) params = params.set('startDate', query.startDate.toISOString());
      if (query.endDate) params = params.set('endDate', query.endDate.toISOString());
      if (query.extension) params = params.set('extension', query.extension);
      if (query.callerNumber) params = params.set('callerNumber', query.callerNumber);
      if (query.calleeNumber) params = params.set('calleeNumber', query.calleeNumber);
      if (query.direction) params = params.set('direction', query.direction);
      if (query.disposition) params = params.set('disposition', query.disposition);
      if (query.minDuration !== undefined) params = params.set('minDuration', query.minDuration.toString());
      if (query.maxDuration !== undefined) params = params.set('maxDuration', query.maxDuration.toString());
      if (query.page !== undefined) params = params.set('page', query.page.toString());
      if (query.pageSize !== undefined) params = params.set('pageSize', query.pageSize.toString());
    }
    return this.http.get<CdrResponse>(`${this.apiUrl}/pbx/cdr`, { params });
  }

  // PBX - Extension Status
  getExtensionStatuses(): Observable<ExtensionStatus[]> {
    return this.http.get<ExtensionStatus[]>(`${this.apiUrl}/pbx/extension-status`);
  }

  // PBX - System Status
  getPbxStatus(): Observable<PbxStatus> {
    return this.http.get<PbxStatus>(`${this.apiUrl}/pbx/status`);
  }

  // PBX - Test Connection
  testPbxConnection(): Observable<{ success: boolean; message: string }> {
    return this.http.get<{ success: boolean; message: string }>(`${this.apiUrl}/pbx/test-connection`);
  }
}


