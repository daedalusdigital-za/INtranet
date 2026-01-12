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
  isActive?: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
}

export interface UserProfile extends User {
  isActive: boolean;
  createdAt: Date;
}

export interface CreateUserRequest {
  name: string;
  surname?: string;
  email: string;
  password: string;
  role: string;
  title?: string;
  permissions?: string;
  departmentId?: number;
  profilePictureUrl?: string;
}

export interface UpdateUserRequest {
  name?: string;
  surname?: string;
  email?: string;
  role?: string;
  title?: string;
  permissions?: string;
  departmentId?: number;
  profilePictureUrl?: string;
  isActive?: boolean;
}

export interface UpdateProfileRequest {
  name?: string;
  surname?: string;
  title?: string;
  profilePictureUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}
