export interface User {
  userId: number;
  name: string;
  surname?: string;
  email: string;
  role: string;
  title?: string;
  permissions?: string;
  departmentId?: number;
  departmentName?: string;
  profilePictureUrl?: string;
  lastLoginAt?: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Department {
  departmentId: number;
  name: string;
  managerName?: string;
  boardCount: number;
  userCount: number;
}

export interface Board {
  boardId: number;
  departmentId: number;
  departmentName: string;
  title: string;
  description?: string;
  lists: List[];
}

export interface List {
  listId: number;
  boardId: number;
  title: string;
  position: number;
  cards: Card[];
}

export interface Card {
  cardId: number;
  listId: number;
  title: string;
  description?: string;
  assignedToUserId?: number;
  assignedToName?: string;
  dueDate?: Date;
  status: string;
  position: number;
  commentCount: number;
  attachmentCount: number;
}

export interface CardDetail extends Card {
  comments: Comment[];
  attachments: Attachment[];
}

export interface Comment {
  commentId: number;
  cardId: number;
  userId: number;
  userName: string;
  content: string;
  createdAt: Date;
}

export interface Attachment {
  attachmentId: number;
  cardId: number;
  fileName: string;
  fileUrl: string;
  fileType?: string;
  fileSize: number;
  uploadedByUserName: string;
  createdAt: Date;
}

export interface CreateCardRequest {
  listId: number;
  title: string;
  description?: string;
  assignedToUserId?: number;
  dueDate?: Date;
  position: number;
}

export interface MoveCardRequest {
  targetListId: number;
  position: number;
}

export interface CreateCommentRequest {
  cardId: number;
  content: string;
}


