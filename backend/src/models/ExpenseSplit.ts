export interface ExpenseSplit {
  expense_id: number;
  user_id: number;
  amount: number; // decimal money value, stored as number (DB uses DECIMAL(10,2))
}
