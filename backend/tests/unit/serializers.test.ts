import { describe, it, expect } from 'vitest';
import { camelCaseObject, serializeExpense, serializeGroupBalances, serializeActivity, wrapActivities } from '../../src/utils/serializers';

describe('Serializers Utility', () => {
  it('camelCaseObject converts snake_case keys', () => {
    const row = { user_id: 5, created_at: '2025-01-01T00:00:00Z', name: 'Alice' };
    const result = camelCaseObject(row);
    expect(result).toEqual(expect.objectContaining({ userId: 5, createdAt: '2025-01-01T00:00:00Z', name: 'Alice' }));
  });

  it('serializeExpense maps expense and splits with percentage', () => {
    const expense = { id: 10, group_id: 2, amount: 300, description: 'Test', paid_by: 1, created_at: '2025-01-01T00:00:00Z' };
    const splits = [
      { expense_id: 10, user_id: 1, amount: 100 },
      { expense_id: 10, user_id: 2, amount: 100 },
      { expense_id: 10, user_id: 3, amount: 100 },
    ];
    const dto = serializeExpense(expense, splits);
    // Percentages now derived from actual amounts; final entry may receive remainder to reach 100.00
    expect(dto).toEqual(expect.objectContaining({
      id: 10,
      groupId: 2,
      paidBy: 1,
      splits: expect.arrayContaining([
        expect.objectContaining({ userId: 1, amount: 100, percentage: 33.33 }),
        expect.objectContaining({ userId: 2, amount: 100, percentage: 33.33 }),
        expect.objectContaining({ userId: 3, amount: 100, percentage: 33.33 }),
      ])
    }));
  });

  it('serializeGroupBalances maps owes/owed arrays to objects', () => {
    const dto = serializeGroupBalances(5, [
      { userId: 1, userName: 'Alice', balance: 50, owes: [{ userId: 2, amount: 20 }], owed: [{ userId: 3, amount: 70 }] },
    ]);
    expect(dto).toEqual(expect.objectContaining({
      groupId: 5,
      balances: expect.arrayContaining([
        expect.objectContaining({
          userId: 1,
          owes: { '2': 20 },
          owed: { '3': 70 }
        })
      ])
    }));
  });

  it('serializeActivity maps activity to DTO', () => {
  const row = { id: 1, action: 'CREATE', entity_type: 'expense', details: JSON.stringify({ description: 'Sample Expense', amount: 10, expenseId: 1 }), created_at: '2025-01-01T00:00:00Z' };
    const dto = serializeActivity(row);
  expect(dto).toEqual(expect.objectContaining({ id: 1, type: expect.any(String), description: 'Created expense: Sample Expense', timestamp: expect.any(String) }));
  });

  it('wrapActivities returns object with activities array', () => {
    const out = wrapActivities([{ id: 1, action: 'CREATE', entity_type: 'expense', created_at: '2025-01-01T00:00:00Z' }]);
    expect(out).toEqual(expect.objectContaining({ activities: expect.any(Array) }));
  });
});
