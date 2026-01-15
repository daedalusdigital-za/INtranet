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

export interface BoardMember {
  boardMemberId: number;
  boardId: number;
  userId: number;
  userName: string;
  userEmail?: string;
  profilePictureUrl?: string;
  role: string;
  invitedAt: Date;
  invitedByUserId?: number;
  invitedByName?: string;
}

export interface Board {
  boardId: number;
  departmentId: number;
  departmentName: string;
  title: string;
  description?: string;
  createdByUserId?: number;
  createdByName?: string;
  status: string;
  progress: number;
  totalChecklistItems: number;
  completedChecklistItems: number;
  createdAt?: Date;
  lists: List[];
  checklistItems: BoardChecklistItem[];
  members: BoardMember[];
}

export interface BoardChecklistItem {
  checklistItemId: number;
  boardId: number;
  title: string;
  isCompleted: boolean;
  position: number;
  createdAt: Date;
  completedAt?: Date;
  completedByUserId?: number;
  completedByName?: string;
}

export interface CreateChecklistItemRequest {
  title: string;
  position?: number;
}

export interface UpdateChecklistItemRequest {
  isCompleted: boolean;
  completedByUserId?: number;
}

export interface UpdateBoardStatusRequest {
  status: string;
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
  createdByUserId?: number;
  createdByName?: string;
  assignedToUserId?: number;
  assignedToName?: string;
  dueDate?: Date;
  status: string;
  position: number;
  commentCount: number;
  attachmentCount: number;
  createdAt?: Date;
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
  createdByUserId?: number;
  assignedToUserId?: number;
  dueDate?: Date;
  position: number;
  inviteUserIds?: number[];
}

export interface InviteBoardMemberRequest {
  userId: number;
  role?: string;
  invitedByUserId?: number;
}

export interface CreateBoardRequest {
  departmentId: number;
  title: string;
  description?: string;
  createdByUserId?: number;
  invitedUserIds?: number[];
}

export interface MoveCardRequest {
  targetListId: number;
  position: number;
}

export interface CreateCommentRequest {
  cardId: number;
  content: string;
}

// PBX Active Calls Models
export interface ActiveCall {
  callId: string;
  callerNumber: string;
  callerName: string;
  calleeNumber: string;
  calleeName: string;
  direction: 'Inbound' | 'Outbound' | 'Internal';
  status: string;
  startTime: Date;
  duration: number;
  durationFormatted: string;
  trunkName: string;
  extension: string;
  extensionName: string;
  answered: boolean;
  onHold: boolean;
  isRecording: boolean;
}

export interface ActiveCallsResponse {
  calls: ActiveCall[];
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  internalCalls: number;
  timestamp: Date;
}

export interface CdrRecord {
  callId: string;
  callerNumber: string;
  callerName: string;
  calleeNumber: string;
  calleeName: string;
  direction: string;
  startTime: Date;
  answerTime: Date;
  endTime: Date;
  duration: number;
  durationFormatted: string;
  billableSeconds: number;
  disposition: string;
  trunkName: string;
  extension: string;
  extensionName: string;
  recordingUrl: string;
  didNumber: string;
  queueName: string;
}

export interface CdrQuery {
  startDate?: Date;
  endDate?: Date;
  extension?: string;
  callerNumber?: string;
  calleeNumber?: string;
  direction?: string;
  disposition?: string;
  minDuration?: number;
  maxDuration?: number;
  page?: number;
  pageSize?: number;
}

export interface CdrResponse {
  records: CdrRecord[];
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ExtensionStatus {
  extension: string;
  name: string;
  status: 'Available' | 'Busy' | 'Ringing' | 'Unavailable' | 'DND';
  statusText: string;
  ipAddress: string;
  deviceType: string;
  registered: boolean;
  lastSeen: Date;
  currentCallId: string;
  departmentId: number;
  departmentName: string;
}

export interface PbxStatus {
  connected: boolean;
  pbxModel: string;
  firmwareVersion: string;
  uptime: string;
  activeChannels: number;
  maxChannels: number;
  registeredExtensions: number;
  totalExtensions: number;
  lastUpdated: Date;
}


