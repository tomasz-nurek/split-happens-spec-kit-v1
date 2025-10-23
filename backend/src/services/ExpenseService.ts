import { getDb } from '../database';
import { Expense } from '../models/Expense';
import { ExpenseSplit } from '../models/ExpenseSplit';
import { ActivityService } from './ActivityService';
import { ActivityAction, ActivityEntityType } from '../models/ActivityLog';
import { serializeExpense, ExpenseDTO } from '../utils/serializers';

// Legacy internal type retained for internal calculations; external callers should use ExpenseDTO now
export interface ExpenseWithSplits extends Expense { splits: ExpenseSplit[]; }

export interface CreateExpenseRequest {
  amount: number;
  description: string;
  paidBy: number;
  participantIds: number[];
}

export class ExpenseService {
  private db = getDb();
  private activityService = new ActivityService();

  async create(groupId: number, expenseData: CreateExpenseRequest): Promise<ExpenseDTO> {
    const { amount, description, paidBy, participantIds } = expenseData;

    // Calculate equal split amounts with proper rounding to ensure sum equals original amount
    const participantCount = participantIds.length;
    const amountInCents = Math.round(amount * 100); // Work in cents to avoid floating point precision issues
    const baseSplitInCents = Math.floor(amountInCents / participantCount);
    const remainderCents = amountInCents % participantCount;

    return this.db.transaction(async (trx) => {
      // Create the expense
      const [expenseId] = await trx('expenses').insert({
        group_id: groupId,
        amount,
        description,
        paid_by: paidBy,
      });

      // Create expense splits - distribute remainder cents to first participants
      const splits: ExpenseSplit[] = [];
      for (let i = 0; i < participantCount; i++) {
        const userId = participantIds[i];
        // Add one extra cent to the first 'remainderCents' participants
        const splitInCents = baseSplitInCents + (i < remainderCents ? 1 : 0);
        const splitAmount = splitInCents / 100; // Convert back to dollars

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
      } as ExpenseWithSplits;
    }).then(async (result) => {
      // fetch participant info for metadata enrichment
      const users = await this.db('users').whereIn('id', participantIds).select('id','name');
      const payer = await this.db('users').where({ id: paidBy }).first();
      const splitsMeta = result.splits.map(s => ({ userId: s.user_id, amount: s.amount }));
      await this.activityService.logActivity(
        ActivityAction.CREATE,
        ActivityEntityType.expense,
        result.id,
        { expenseId: result.id, description: description, amount, groupId, participantIds, participantNames: users.map(u=>u.name), splits: splitsMeta, paidBy: paidBy, paidByName: payer?.name },
        groupId // Pass group_id for efficient queries
      );
      return serializeExpense(result, result.splits);
    });
  }

  async findByGroupId(groupId: number): Promise<ExpenseDTO[]> {
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
    return expenses.map(expense => {
      const linkedSplits = splits.filter(split => split.expense_id === expense.id);
      return serializeExpense(expense, linkedSplits);
    });
  }

  async findById(id: number): Promise<ExpenseDTO | undefined> {
    const expense = await this.db('expenses').where({ id }).first();
    if (!expense) {
      return undefined;
    }

    const splits = await this.db('expense_splits').where({ expense_id: id });
    return serializeExpense(expense, splits);
  }

  async delete(id: number): Promise<void> {
    const existing = await this.db('expenses').where({ id }).first();
    await this.db.transaction(async (trx) => {
      await trx('expense_splits').where({ expense_id: id }).del();
      await trx('expenses').where({ id }).del();
    });
    if (existing) {
      await this.activityService.logActivity(
        ActivityAction.DELETE,
        ActivityEntityType.expense,
        id,
        { expenseId: id, description: existing.description, groupId: existing.group_id },
        existing.group_id // Pass group_id for efficient queries
      );
    }
  }

  async updateDescription(id: number, newDescription: string): Promise<ExpenseDTO | undefined> {
    const expense = await this.db('expenses').where({ id }).first();
    if (!expense) return undefined;
    await this.db('expenses').where({ id }).update({ description: newDescription });
    const updated = await this.findById(id);
    if (updated) {
      await this.activityService.logActivity(
        ActivityAction.UPDATE,
        ActivityEntityType.expense,
        id,
        { expenseId: id, description: newDescription },
        expense.group_id // Pass group_id for efficient queries
      );
    }
    return updated;
  }
}
