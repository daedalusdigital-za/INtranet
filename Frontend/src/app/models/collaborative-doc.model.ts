export interface CollaborativeDocument {
  id: number;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: number;
  createdByName: string;
  lastModifiedByName?: string;
  isPublic: boolean;
  userRole: string;
  collaboratorCount: number;
}

export interface DocumentDetail {
  id: number;
  title: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: number;
  createdByName: string;
  isPublic: boolean;
  yjsState?: string;
  version: number;
  collaborators: Collaborator[];
}

export interface Collaborator {
  id: number;
  userId: number;
  userName: string;
  email: string;
  role: string;
  addedAt: Date;
}

export interface DocumentSnapshot {
  id: number;
  documentId: number;
  yjsState: string;
  version: number;
  createdAt: Date;
}

export interface CreateDocumentDto {
  title: string;
  description?: string;
  isPublic?: boolean;
}

export interface UpdateDocumentDto {
  title?: string;
  description?: string;
  isPublic?: boolean;
}

export interface SaveSnapshotDto {
  documentId: number;
  yjsState: string;
}

export interface AddCollaboratorDto {
  userId: number;
  role: string;
}

export interface UserPresence {
  userId: number;
  userName: string;
  color: string;
  cursor?: CursorPosition;
}

export interface CursorPosition {
  from: number;
  to: number;
}

export interface DocumentUser {
  id: number;
  fullName: string;
  email: string;
  department?: string;
}
