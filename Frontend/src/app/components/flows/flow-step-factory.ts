import { FlowAssignee, FlowCatalog, FlowStep, FlowStepType } from '../../services/flows.service';

export const STEP_ID_PREFIX: Record<FlowStepType, string> = {
  condition: 'decide', ai_analyze: 'analyse', task: 'task', approval: 'approve', notify: 'notify',
  email: 'email', welly_action: 'action', set: 'set', wait: 'wait', end: 'end'
};

export const STEP_COLOR: Record<FlowStepType, string> = {
  task: '#2563eb', approval: '#2563eb', condition: '#f59e0b', ai_analyze: '#7c3aed', notify: '#0891b2',
  email: '#0891b2', welly_action: '#db2777', set: '#64748b', wait: '#64748b', end: '#16a34a'
};

/** Branch keys a step can link from. `next` maps to step.nextStepId, others to config[`${key}StepId`]. */
export type FlowPortKey = 'next' | 'true' | 'false' | 'approved' | 'rejected';

export function outPorts(type: FlowStepType): { key: FlowPortKey; label: string }[] {
  switch (type) {
    case 'condition': return [{ key: 'true', label: 'Yes' }, { key: 'false', label: 'No' }];
    case 'approval': return [{ key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }];
    case 'end': return [];
    default: return [{ key: 'next', label: 'Next' }];
  }
}

export function getTarget(s: FlowStep, key: FlowPortKey): string | null {
  if (key === 'next') return s.nextStepId ?? null;
  return s.config?.[`${key}StepId`] ?? null;
}

export function setTarget(s: FlowStep, key: FlowPortKey, id: string | null) {
  if (key === 'next') s.nextStepId = id;
  else { s.config ||= {}; s.config[`${key}StepId`] = id; }
}

export function uniqueStepId(type: FlowStepType, steps: FlowStep[]): string {
  const prefix = STEP_ID_PREFIX[type];
  let i = 1; let id = `${prefix}${i}`;
  while (steps.some(s => s.id === id)) id = `${prefix}${++i}`;
  return id;
}

export function makeStep(type: FlowStepType, id: string, name: string, preset?: Record<string, any>): FlowStep {
  const step: FlowStep = { id, type, name, nextStepId: null, config: {} };
  switch (type) {
    case 'task': step.config = { title: '', description: '', priority: 'Normal', dueInHours: 24, form: [] }; break;
    case 'approval': step.config = { title: '', description: '', priority: 'Normal', dueInHours: 24, form: [], approvedStepId: null, rejectedStepId: null }; break;
    case 'condition': step.config = { expression: '', trueStepId: null, falseStepId: null }; break;
    case 'ai_analyze': step.config = { outputKey: 'ai', prompt: '', fields: [{ key: 'summary', description: 'A short summary' }, { key: 'priority', description: 'Low, Normal, High or Urgent' }] }; break;
    case 'notify': step.config = { title: '', body: '' }; break;
    case 'email': step.config = { to: '', subject: '', body: '' }; break;
    case 'welly_action': step.config = { action: 'CREATE_TICKET', payload: {}, failOnError: false }; break;
    case 'set': step.config = { key: '', value: '' }; break;
    case 'wait': step.config = { hours: 1 }; break;
    case 'end': step.config = { outcome: 'completed' }; break;
  }
  if (preset) Object.assign(step.config, preset);
  return step;
}

/** Re-point every reference to `oldId` (or drop it when newId is null, falling back to the removed step's own next). */
export function relinkAll(steps: FlowStep[], oldId: string, newId: string | null) {
  for (const o of steps) {
    if (o.nextStepId === oldId) o.nextStepId = newId;
    for (const k of ['trueStepId', 'falseStepId', 'approvedStepId', 'rejectedStepId']) if (o.config?.[k] === oldId) o.config[k] = newId;
  }
}

export function assigneeLabel(a: FlowAssignee | undefined, catalog: FlowCatalog): string {
  if (!a) return '';
  if (a.starter) return 'Person who started it';
  if (a.starterManager) return "Starter's manager";
  if ('userId' in a) return catalog.users.find(u => u.id === a.userId)?.name ?? 'Pick a person';
  if ('expression' in a) return a.expression || 'From a variable';
  const dept = a.departmentName || catalog.departments.find(d => d.id === a.departmentId)?.name;
  if (dept && a.role) return `${a.role} · ${dept}`;
  if (dept) return dept;
  if (a.role) return `Any ${a.role}`;
  if (a.email) return a.email;
  return '';
}
