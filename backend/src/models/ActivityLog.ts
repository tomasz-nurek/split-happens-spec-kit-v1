export enum ActivityAction {
  CREATE = 'CREATE',
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
  details?: string;
  created_at?: Date;
}
