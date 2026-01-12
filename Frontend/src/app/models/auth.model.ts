export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: import('./user.model').User;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: string;
  departmentId?: number;
}
