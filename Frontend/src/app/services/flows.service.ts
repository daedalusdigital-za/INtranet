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

/** Operational blueprint of a human flow: what the department / person is responsible for and how we'd know it is working. */
export interface FlowBlueprint {
  email?: string; purpose?: string; reportsTo?: string; team?: string;
  company?: string; functionalArea?: string; positionLevel?: string;
  responsibilities?: { area: string; items: string[] }[];
  kpis?: { name: string; target?: string; source?: string }[];
  systems?: string[]; inputs?: string[]; outputs?: string[];
  painPoints?: { issue: string; idea?: string }[];
  handover?: string; reviewedAt?: string;
}

export interface FlowDefinition {
  id: number; name: string; description?: string; category?: string; departmentName?: string | null; level: 1 | 2 | 3;
  /** Employee-specific human flow: whose day-to-day work this describes (employee register id + display name/title). */
  ownerEmployeeId?: string | null; ownerName?: string | null; ownerTitle?: string | null; ownerUserId?: number | null; ownerUserEmail?: string | null;
  blueprint?: FlowBlueprint | null;
  triggerType: FlowTriggerType; trigger: FlowTrigger; graph: FlowGraph; inputs: FlowInput[];
  isEnabled: boolean; isTemplate: boolean; version: number; startPermissions?: string | null;
  lastScheduledRunAt?: string | null; createdAt: string; createdBy?: string | null; updatedAt?: string | null;
  runCount: number; activeRuns: number; canStart: boolean;
}

export interface SaveFlowRequest {
  name: string; description?: string; category?: string; departmentName?: string | null; level: number; triggerType: FlowTriggerType;
  ownerEmployeeId?: string | null; ownerName?: string | null; ownerTitle?: string | null; ownerUserId?: number | null;
  blueprint?: FlowBlueprint | null;
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
  /** `modules`: module keys the person can open ("all" for admins). Absent from older backends. */
  users: { id: number; name: string; email: string; role: string; departmentId?: number | null; title?: string | null; modules?: string[] }[];
  departments: { id: number; name: string; manager?: string | null }[];
  /** Employee register (clocking system) — for pinning a human flow to a person. */
  employees?: { id: string; name: string; department?: string | null; jobTitle?: string | null }[];
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

/** A shared Home widget designed in Flows (see HomeLayoutService for the widget types). */
export interface FlowWidget {
  id: number; name: string; description?: string | null; icon: string; type: string; size: 'sm' | 'md' | 'lg' | 'xl';
  config: Record<string, any>; category: string; departmentName?: string | null;
  isTemplate: boolean; isPublished: boolean; useCount: number; createdAt: string; updatedAt?: string | null; createdBy?: string | null;
}

export interface SaveWidgetRequest {
  name: string; description?: string | null; icon?: string; type: string; size?: string; config?: Record<string, any>;
  category?: string; departmentName?: string | null; isPublished?: boolean; isTemplate?: boolean;
}

// ── Cortex: the company knowledge graph (server-side, derived from live data + curated by people) ──
export type CortexProvenance = 'derived' | 'curated' | 'inferred';
export interface CortexApiType { key: string; label: string; layer: string; icon: string | null; color: string | null; attachedType: string | null; zoomLevel: number; }
export interface CortexApiNode {
  key: string; type: string; layer: string; icon: string | null; color: string | null; zoom: number;
  label: string; short: string | null; summary: string | null; parent: string | null; provenance: CortexProvenance; source: string | null; sourceId: string | null;
  ownerUserId: number | null; ownerLabel: string | null; permission: string | null; reviewDueAt: string | null; overdue: boolean;
  route: string | null; data: string | null; rationale: string | null; status: string; isActive: boolean; updatedAt: string; empty: boolean;
}
export interface CortexApiEdge {
  id: number; from: string; to: string; relation: string; label: string | null; handoff: string | null; handoffCurated: boolean; codeRef: string | null;
  provenance: CortexProvenance; source: string | null; weight: number; status: string;
  dwellAvgHours: number | null; dwellMedianHours: number | null; dwellP90Hours: number | null; queueSize: number | null; metricsAt: string | null; data: string | null;
}
export interface CortexGraph {
  generatedAt: string; asOf: string | null; types: CortexApiType[]; nodes: CortexApiNode[]; edges: CortexApiEdge[];
  counts: { nodes: number; edges: number; derived: number; curated: number; curatedEmpty: number; inferred: number; overdue: number; gaps: number; handoffs: Record<string, number> };
}
export interface CortexApiGap {
  key: string; label: string; detail: string | null; kind: string; priority: number; status: string;
  owner: string | null; ownerUserId: number | null; unowned: boolean; on: string | null; onLabel: string | null; onType: string | null;
  provenance: CortexProvenance; rationale: string | null; data: string | null; updatedAt: string;
}
export interface CortexNodeDetail {
  node: CortexApiNode; children: CortexApiNode[]; edges: CortexApiEdge[]; neighbours: CortexApiNode[];
  history: { kind: string; field: string | null; oldValue: string | null; newValue: string | null; changedBy: string; userName: string | null; occurredAt: string }[];
}
export interface CortexCurateRequest { summary?: string | null; dataJson?: string | null; ownerUserId?: number | null; ownerLabel?: string | null; reviewDueAt?: string | null; }

@Injectable({ providedIn: 'root' })
export class FlowsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/flows`;
  private cortex = `${environment.apiUrl}/cortex`;

  // ── cortex ──
  cortexGraph(opts?: { layers?: string; root?: string; asOf?: string }): Observable<CortexGraph> {
    const params: Record<string, string> = {};
    if (opts?.layers) params['layers'] = opts.layers; if (opts?.root) params['root'] = opts.root; if (opts?.asOf) params['asOf'] = opts.asOf;
    return this.http.get<CortexGraph>(`${this.cortex}/graph`, { params });
  }
  cortexNode(key: string): Observable<CortexNodeDetail> { return this.http.get<CortexNodeDetail>(`${this.cortex}/nodes/${encodeURIComponent(key)}`); }
  cortexGaps(status = 'open'): Observable<CortexApiGap[]> { return this.http.get<CortexApiGap[]>(`${this.cortex}/gaps`, { params: { status } }); }
  cortexChanges(opts?: { since?: string; until?: string; key?: string; take?: number }): Observable<any[]> { return this.http.get<any[]>(`${this.cortex}/changes`, { params: { ...(opts as any ?? {}) } }); }
  cortexRebuild(): Observable<{ nodes: number; edges: number; created: number; updated: number; deactivated: number; reactivated: number; tookMs: number }> { return this.http.post<any>(`${this.cortex}/rebuild`, {}); }
  cortexCurate(key: string, req: CortexCurateRequest): Observable<any> { return this.http.put(`${this.cortex}/nodes/${encodeURIComponent(key)}/curate`, req); }
  cortexAccept(key: string, reason?: string): Observable<any> { return this.http.post(`${this.cortex}/nodes/${encodeURIComponent(key)}/accept`, { reason }); }
  cortexReject(key: string, reason: string): Observable<any> { return this.http.post(`${this.cortex}/nodes/${encodeURIComponent(key)}/reject`, { reason }); }
  cortexSetHandoff(edgeId: number, handoff: string, reason?: string): Observable<any> { return this.http.put(`${this.cortex}/edges/${edgeId}/handoff`, { handoff, reason }); }

  // ── widgets ──
  widgets(templates = false): Observable<FlowWidget[]> { return this.http.get<FlowWidget[]>(`${this.base}/widgets`, { params: { templates } }); }
  createWidget(req: SaveWidgetRequest): Observable<FlowWidget> { return this.http.post<FlowWidget>(`${this.base}/widgets`, req); }
  updateWidget(id: number, req: SaveWidgetRequest): Observable<FlowWidget> { return this.http.put<FlowWidget>(`${this.base}/widgets/${id}`, req); }
  deleteWidget(id: number): Observable<any> { return this.http.delete(`${this.base}/widgets/${id}`); }
  toggleWidget(id: number): Observable<{ id: number; isPublished: boolean }> { return this.http.post<{ id: number; isPublished: boolean }>(`${this.base}/widgets/${id}/toggle`, {}); }
  cloneWidget(id: number): Observable<FlowWidget> { return this.http.post<FlowWidget>(`${this.base}/widgets/${id}/clone`, {}); }
  widgetUsed(id: number): Observable<any> { return this.http.post(`${this.base}/widgets/${id}/used`, {}); }

  catalog(): Observable<FlowCatalog> { return this.http.get<FlowCatalog>(`${this.base}/catalog`); }
  stats(): Observable<FlowStats> { return this.http.get<FlowStats>(`${this.base}/stats`); }

  definitions(templates = false): Observable<FlowDefinition[]> { return this.http.get<FlowDefinition[]>(`${this.base}/definitions`, { params: { templates } }); }
  definition(id: number): Observable<FlowDefinition> { return this.http.get<FlowDefinition>(`${this.base}/definitions/${id}`); }
  create(req: SaveFlowRequest): Observable<FlowDefinition> { return this.http.post<FlowDefinition>(`${this.base}/definitions`, req); }
  update(id: number, req: SaveFlowRequest): Observable<FlowDefinition> { return this.http.put<FlowDefinition>(`${this.base}/definitions/${id}`, req); }
  toggle(id: number): Observable<{ id: number; isEnabled: boolean }> { return this.http.post<{ id: number; isEnabled: boolean }>(`${this.base}/definitions/${id}/toggle`, {}); }
  delete(id: number): Observable<any> { return this.http.delete(`${this.base}/definitions/${id}`); }
  clone(id: number): Observable<FlowDefinition> { return this.http.post<FlowDefinition>(`${this.base}/definitions/${id}/clone`, {}); }
  /** Link a human flow's employee owner to an intranet user (created when missing). */
  linkOwner(id: number, email: string, createUser = true): Observable<{ userId: number; email: string; name: string; created: boolean; tempPassword?: string | null; flowsLinked: number; message: string }> {
    return this.http.post<any>(`${this.base}/definitions/${id}/link-owner`, { email, createUser });
  }
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
