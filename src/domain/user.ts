export type UserRole = 'customer' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface UserWithCredentials extends User {
  passwordHash: string;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
}
