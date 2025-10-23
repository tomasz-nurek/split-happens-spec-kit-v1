export enum ActivityAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export enum ActivityEntityType {
  expense = 'expense',
  user = 'user',
  group = 'group',
}

export interface ActivityLog {
  id?: number;
  action: ActivityAction;
  entity_type: ActivityEntityType;
  entity_id?: number;
  group_id?: number; // Denormalized for efficient group-scoped queries
  details?: string;
  created_at?: Date;
}
