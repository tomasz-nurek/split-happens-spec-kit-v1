export interface User {
  id: number;
  name: string;
  isAdmin?: boolean;
  role?: string;
  createdAt?: string;
}

export interface GroupMember {
  id: number;
  name: string;
}

export interface Group {
  id: number;
  name: string;
  createdAt?: string;
  members?: GroupMember[];
}

export interface ExpenseSplit {
  userId: number;
  amount: number;
  percentage?: number;
  userName?: string;
}

export interface Expense {
  id: number;
  groupId: number;
  description: string;
  amount: number;
  paidBy: number;
  paidByName?: string;
  createdAt?: string;
  splits?: ExpenseSplit[];
  participantIds?: number[];
  participantNames?: string[];
}

export interface UserBalanceSummary {
  userId: number;
  userName: string;
  balance: number;
  owes: Record<string, number>;
  owed: Record<string, number>;
}

export interface GroupBalances {
  groupId: number;
  balances: UserBalanceSummary[];
  settlements: unknown[];
}

export interface Activity {
  id: number;
  type: string;
  description?: string;
  userId?: number;
  userName?: string;
  groupId?: number;
  groupName?: string;
  expenseId?: number;
  expenseDescription?: string;
  amount?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ApiListResponse<T> {
  items: T[];
}

export interface PaginatedResponse<T> extends ApiListResponse<T> {
  nextCursor?: string | null;
  total?: number;
}

export interface ApplicationError {
  message: string;
  code?: string;
  status?: number;
  details?: unknown;
  timestamp?: string;
}

export interface AuthLoginResponse {
  token: string;
  user: User;
}

export interface AuthVerifyResponse {
  valid: boolean;
  user: User;
}
