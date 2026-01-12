/**
 * Application constants and configuration
 */

export const Roles = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  EMPLOYEE: 'Employee',
  HR: 'HR',
  IT_SUPPORT: 'IT Support'
} as const;

export const AdminRoles = [Roles.SUPER_ADMIN, Roles.ADMIN];

export const AllRoles = Object.values(Roles);

export type RoleType = typeof Roles[keyof typeof Roles];

export const Permissions = {
  // User permissions
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',

  // Board permissions
  BOARDS_VIEW: 'boards.view',
  BOARDS_CREATE: 'boards.create',
  BOARDS_EDIT: 'boards.edit',
  BOARDS_DELETE: 'boards.delete',

  // Attendance permissions
  ATTENDANCE_VIEW: 'attendance.view',
  ATTENDANCE_MANAGE: 'attendance.manage',

  // Report permissions
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Document permissions
  DOCUMENTS_VIEW: 'documents.view',
  DOCUMENTS_UPLOAD: 'documents.upload',

  // Messaging permissions
  MESSAGES_VIEW: 'messages.view',
  MESSAGES_SEND: 'messages.send',

  // Knowledge Base permissions
  KB_VIEW: 'kb.view',
  KB_EDIT: 'kb.edit',

  // Support permissions
  SUPPORT_VIEW: 'support.view',
  SUPPORT_MANAGE: 'support.manage'
} as const;

export type PermissionType = typeof Permissions[keyof typeof Permissions];

export interface PermissionInfo {
  code: string;
  name: string;
  category: string;
}

export const AllPermissions: PermissionInfo[] = [
  { code: Permissions.USERS_VIEW, name: 'View Users', category: 'Users' },
  { code: Permissions.USERS_CREATE, name: 'Create Users', category: 'Users' },
  { code: Permissions.USERS_EDIT, name: 'Edit Users', category: 'Users' },
  { code: Permissions.USERS_DELETE, name: 'Delete Users', category: 'Users' },
  { code: Permissions.BOARDS_VIEW, name: 'View Boards', category: 'Boards' },
  { code: Permissions.BOARDS_CREATE, name: 'Create Boards', category: 'Boards' },
  { code: Permissions.BOARDS_EDIT, name: 'Edit Boards', category: 'Boards' },
  { code: Permissions.BOARDS_DELETE, name: 'Delete Boards', category: 'Boards' },
  { code: Permissions.ATTENDANCE_VIEW, name: 'View Attendance', category: 'Attendance' },
  { code: Permissions.ATTENDANCE_MANAGE, name: 'Manage Attendance', category: 'Attendance' },
  { code: Permissions.REPORTS_VIEW, name: 'View Reports', category: 'Reports' },
  { code: Permissions.REPORTS_EXPORT, name: 'Export Reports', category: 'Reports' },
  { code: Permissions.DOCUMENTS_VIEW, name: 'View Documents', category: 'Documents' },
  { code: Permissions.DOCUMENTS_UPLOAD, name: 'Upload Documents', category: 'Documents' },
  { code: Permissions.MESSAGES_VIEW, name: 'View Messages', category: 'Messages' },
  { code: Permissions.MESSAGES_SEND, name: 'Send Messages', category: 'Messages' },
  { code: Permissions.KB_VIEW, name: 'View Knowledge Base', category: 'Knowledge Base' },
  { code: Permissions.KB_EDIT, name: 'Edit Knowledge Base', category: 'Knowledge Base' },
  { code: Permissions.SUPPORT_VIEW, name: 'View Support Tickets', category: 'Support' },
  { code: Permissions.SUPPORT_MANAGE, name: 'Manage Support Tickets', category: 'Support' }
];

export function isAdmin(role: string): boolean {
  return AdminRoles.includes(role as RoleType);
}

export function hasPermission(userPermissions: string | null | undefined, permission: string): boolean {
  if (!userPermissions) return false;
  const permissions = userPermissions.split(',').map(p => p.trim());
  return permissions.includes(permission);
}
