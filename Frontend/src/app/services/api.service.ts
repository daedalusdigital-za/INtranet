import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Department, Board, Card, CardDetail, CreateCardRequest, MoveCardRequest, CreateCommentRequest, Comment } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = '/api';

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

  createBoard(board: { departmentId: number; title: string; description?: string }): Observable<Board> {
    return this.http.post<Board>(`${this.apiUrl}/boards`, board);
  }

  updateBoard(id: number, board: { departmentId: number; title: string; description?: string }): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/boards/${id}`, board);
  }

  deleteBoard(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/boards/${id}`);
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
}


