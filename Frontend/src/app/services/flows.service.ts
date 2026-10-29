import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type FlowTriggerType = 'manual' | 'event' | 'schedule';
export type FlowStepType = 'condition' | 'ai_analyze' | 'task' | 'approval' | 'notify' | 'email' | 'welly_action' | 'set' | 'wait' | 'end';

export interface FlowAssignee {
  userId?: number; role?: string; departmentId?: number; departmentName?: string; email?: string;
  expression?: string; starter?: boolean; starterManager?: boolean;
}

export interface FlowStep {
  id: string;
  type: FlowStepType;
  name?: string;
  nextStepId?: string | null;
  config: Record<string, any>;
  x?: number; y?: number;
}

export interface FlowGraph { startStepId?: string | null; steps: FlowStep[]; }

export interface FlowTrigger {
  event?: string; filter?: string; intervalMinutes?: number; dataSource?: string;
  params?: Record<string, string>; titleTemplate?: string; dedupeByEntity?: boolean;
}

export interface FlowInput {
  key: string; label: string; type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'user' | 'department';
  required?: boolean; options?: string[]; hint?: string;
}

export interface FlowDefinition {
  id: number; name: string; description?: string; category?: string; departmentName?: string | null; level: 1 | 2 | 3;
  triggerType: FlowTriggerType; trigger: FlowTrigger; graph: FlowGraph; inputs: FlowInput[];
  isEnabled: boolean; isTemplate: boolean; version: number; startPermissions?: string | null;
  lastScheduledRunAt?: string | null; createdAt: string; createdBy?: string | null; updatedAt?: string | null;
  runCount: number; activeRuns: number; canStart: boolean;
}

export interface SaveFlowRequest {
  name: string; description?: string; category?: string; departmentName?: string | null; level: number; triggerType: FlowTriggerType;
  trigger: FlowTrigger; graph: FlowGraph; inputs: FlowInput[]; isEnabled: boolean; startPermissions?: string | null;
}

export interface FlowRunSummary {
  id: number; runNumber: string; title: string; status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  priority: string; outcome?: string | null; error?: string | null; flowName: string; flowId: number; level: number; category?: string;
  triggerSource: string; entityType?: string | null; entityKey?: string | null; currentStepId?: string | null;
  startedBy: string; startedAt: string; completedAt?: string | null; resumeAt?: string | null;
  openTasks: number; overdueTasks: number; currentAssignee?: string | null; durationMinutes: number;
}

export interface FlowTask {
  id: number; flowRunId: number; stepId: string; kind: 'task' | 'approval'; title: string; description?: string;
  priority: string; status: 'open' | 'completed' | 'approved' | 'rejected' | 'escalated' | 'cancelled';
  dueAt?: string | null; isOverdue: boolean; escalationCount: number; escalatedAt?: string | null;
  assignedToUserId?: number | null; assignedToRole?: string | null; assignedToDepartmentId?: number | null; assigneeLabel?: string;
  form?: { key: string; label: string; type?: string; required?: boolean; options?: string[] }[] | null;
  result?: Record<string, any> | null; comment?: string | null; completedAt?: string | null; completedBy?: string | null; createdAt: string;
  runNumber?: string; runTitle?: string; flowName?: string; level?: number;
}

export interface FlowAuditEvent { id: number; stepId?: string | null; type: string; message: string; userName?: string | null; occurredAt: string; data?: any; }

export interface FlowRunDetail {
  summary: FlowRunSummary; context: Record<string, any>; graph: FlowGraph; tasks: FlowTask[]; events: FlowAuditEvent[];
}

export interface FlowCatalog {
  isDesigner: boolean;
  users: { id: number; name: string; email: string; role: string; departmentId?: number | null }[];
  departments: { id: number; name: string; manager?: string | null }[];
  roles: string[];
  events: { key: string; description: string }[];
  dataSources: { key: string; name: string; description: string; entityType: string; params: string[]; fields: string[] }[];
  stepTypes: { type: FlowStepType; name: string; icon: string; description: string }[];
  actions: string[];
}

export interface FlowStats {
  myOpen: number; myOverdue: number; active: number; completed30: number; failed30: number; avgHours: number; enabled: number;
  byFlow: { name: string; runs: number; active: number; failed: number }[];
}

@Injectable({ providedIn: 'root' })
export class FlowsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/flows`;

  catalog(): Observable<FlowCatalog> { return this.http.get<FlowCatalog>(`${this.base}/catalog`); }
  stats(): Observable<FlowStats> { return this.http.get<FlowStats>(`${this.base}/stats`); }

  definitions(templates = false): Observable<FlowDefinition[]> { return this.http.get<FlowDefinition[]>(`${this.base}/definitions`, { params: { templates } }); }
  definition(id: number): Observable<FlowDefinition> { return this.http.get<FlowDefinition>(`${this.base}/definitions/${id}`); }
  create(req: SaveFlowRequest): Observable<FlowDefinition> { return this.http.post<FlowDefinition>(`${this.base}/definitions`, req); }
  update(id: number, req: SaveFlowRequest): Observable<FlowDefinition> { return this.http.put<FlowDefinition>(`${this.base}/definitions/${id}`, req); }
  toggle(id: number): Observable<{ id: number; isEnabled: boolean }> { return this.http.post<{ id: number; isEnabled: boolean }>(`${this.base}/definitions/${id}/toggle`, {}); }
  delete(id: number): Observable<any> { return this.http.delete(`${this.base}/definitions/${id}`); }
  clone(id: number): Observable<FlowDefinition> { return this.http.post<FlowDefinition>(`${this.base}/definitions/${id}/clone`, {}); }
  validate(req: SaveFlowRequest): Observable<{ ok: boolean; error?: string | null; warnings: string[] }> { return this.http.post<any>(`${this.base}/definitions/validate`, req); }

  start(id: number, inputs: Record<string, any>, title?: string, priority?: string): Observable<any> {
    return this.http.post<any>(`${this.base}/definitions/${id}/start`, { inputs, title, priority });
  }

  runs(opts: { status?: string; definitionId?: number; q?: string; mine?: boolean; take?: number } = {}): Observable<FlowRunSummary[]> {
    const params: any = {};
    Object.entries(opts).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params[k] = v; });
    return this.http.get<FlowRunSummary[]>(`${this.base}/runs`, { params });
  }
  run(id: number): Observable<FlowRunDetail> { return this.http.get<FlowRunDetail>(`${this.base}/runs/${id}`); }
  cancelRun(id: number, reason?: string): Observable<FlowRunDetail> { return this.http.post<FlowRunDetail>(`${this.base}/runs/${id}/cancel`, { reason }); }

  myTasks(includeDone = false): Observable<FlowTask[]> { return this.http.get<FlowTask[]>(`${this.base}/tasks/mine`, { params: { includeDone } }); }
  allTasks(status = 'open,escalated'): Observable<FlowTask[]> { return this.http.get<FlowTask[]>(`${this.base}/tasks`, { params: { status } }); }
  completeTask(id: number, body: { decision?: string; result?: Record<string, any>; comment?: string }): Observable<{ task: FlowTask; run: FlowRunDetail }> {
    return this.http.post<{ task: FlowTask; run: FlowRunDetail }>(`${this.base}/tasks/${id}/complete`, body);
  }
  reassign(id: number, body: { userId?: number; role?: string; departmentId?: number }): Observable<FlowRunDetail> {
    return this.http.post<FlowRunDetail>(`${this.base}/tasks/${id}/reassign`, body);
  }
}
