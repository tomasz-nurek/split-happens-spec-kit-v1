import knex from 'knex';
const knexConfig = require('../../knexfile.js');
import { Expense } from '../models/Expense';
import { ExpenseSplit } from '../models/ExpenseSplit';

export interface ExpenseWithSplits extends Expense {
  splits: ExpenseSplit[];
}

export interface CreateExpenseRequest {
  amount: number;
  description: string;
  paidBy: number;
  participantIds: number[];
}

export class ExpenseService {
  private db = knex(knexConfig[process.env.NODE_ENV || 'development']);

  async create(groupId: number, expenseData: CreateExpenseRequest): Promise<ExpenseWithSplits> {
    const { amount, description, paidBy, participantIds } = expenseData;

    // Calculate equal split amounts
    const splitAmount = Number((amount / participantIds.length).toFixed(2));

    return this.db.transaction(async (trx) => {
      // Create the expense
      const [expenseId] = await trx('expenses').insert({
        group_id: groupId,
        amount,
        description,
        paid_by: paidBy,
      });

      // Create expense splits
      const splits: ExpenseSplit[] = [];
      for (const userId of participantIds) {
        const split: ExpenseSplit = {
          expense_id: expenseId,
          user_id: userId,
          amount: splitAmount,
        };

        await trx('expense_splits').insert(split);
        splits.push(split);
      }

      // Get the created expense
      const createdExpense = await trx('expenses').where({ id: expenseId }).first();

      return {
        ...createdExpense,
        splits,
      };
    });
  }

  async findByGroupId(groupId: number): Promise<ExpenseWithSplits[]> {
    // Get expenses for the group
    const expenses = await this.db('expenses')
      .where({ group_id: groupId })
      .orderBy('created_at', 'desc');

    // Get all splits for these expenses
    const expenseIds = expenses.map(e => e.id);
    const splits = expenseIds.length > 0 
      ? await this.db('expense_splits').whereIn('expense_id', expenseIds)
      : [];

    // Combine expenses with their splits
    return expenses.map(expense => ({
      ...expense,
      splits: splits.filter(split => split.expense_id === expense.id),
    }));
  }

  async findById(id: number): Promise<ExpenseWithSplits | undefined> {
    const expense = await this.db('expenses').where({ id }).first();
    if (!expense) {
      return undefined;
    }

    const splits = await this.db('expense_splits').where({ expense_id: id });

    return {
      ...expense,
      splits,
    };
  }

  async delete(id: number): Promise<void> {
    await this.db.transaction(async (trx) => {
      // Delete expense splits first (due to foreign key constraint)
      await trx('expense_splits').where({ expense_id: id }).del();
      
      // Delete the expense
      await trx('expenses').where({ id }).del();
    });
  }
}
