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
  private db = knex(knexConfig);

  async create(groupId: number, expenseData: CreateExpenseRequest): Promise<ExpenseWithSplits> {
    const { amount, description, paidBy, participantIds } = expenseData;

    // Validate that the group exists
    const group = await this.db('groups').where({ id: groupId }).first();
    if (!group) {
      throw new Error('Group not found');
    }

    // Validate that the payer is a valid user
    const payer = await this.db('users').where({ id: paidBy }).first();
    if (!payer) {
      throw new Error('Payer user not found');
    }

    // Validate that all participants are valid users
    const participants = await this.db('users').whereIn('id', participantIds).select('id');
    if (participants.length !== participantIds.length) {
      throw new Error('One or more participant users not found');
    }

    // Calculate equal split amounts
    const splitAmount = Number((amount / participantIds.length).toFixed(2));
    const totalSplitAmount = splitAmount * participantIds.length;
    
    // Handle rounding by adding the difference to the first participant
    let adjustmentAmount = Number((amount - totalSplitAmount).toFixed(2));

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
      for (let i = 0; i < participantIds.length; i++) {
        const userId = participantIds[i];
        let userSplitAmount = splitAmount;
        
        // Add adjustment to first participant to handle rounding
        if (i === 0) {
          userSplitAmount = Number((splitAmount + adjustmentAmount).toFixed(2));
        }

        const split: ExpenseSplit = {
          expense_id: expenseId,
          user_id: userId,
          amount: userSplitAmount,
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
    // Validate that the group exists
    const group = await this.db('groups').where({ id: groupId }).first();
    if (!group) {
      throw new Error('Group not found');
    }

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
    const expense = await this.db('expenses').where({ id }).first();
    if (!expense) {
      throw new Error('Expense not found');
    }

    await this.db.transaction(async (trx) => {
      // Delete expense splits first (due to foreign key constraint)
      await trx('expense_splits').where({ expense_id: id }).del();
      
      // Delete the expense
      await trx('expenses').where({ id }).del();
    });
  }
}
