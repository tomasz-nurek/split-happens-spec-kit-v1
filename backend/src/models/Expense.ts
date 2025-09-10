export interface Expense {
  id?: number;
  group_id: number;
  amount: number; // decimal money value, stored as number (DB uses DECIMAL(10,2))
  description: string;
  paid_by: number; // user id
  created_at?: Date;
}
