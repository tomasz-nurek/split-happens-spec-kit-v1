import knex from 'knex';
const knexConfig = require('../../knexfile.js');
import { User } from '../models/User';
import { Group } from '../models/Group';

/**
 * Represents the balance of a single user within a specific group.
 */
export interface UserGroupBalance {
  userId: number;
  userName: string;
  /**
   * The net balance for the user in the group.
   * A positive value means the user is owed money by the group.
   * A negative value means the user owes money to the group.
   */
  balance: number;
}

/**
 * Represents a single transaction required to settle debts within a group.
 * This simplifies the "who owes whom" calculation into a list of direct payments.
 */
export interface DebtTransaction {
  from: { userId: number; userName: string };
  to: { userId: number; userName: string };
  amount: number;
}

/**
 * Represents the overall balance summary for a group, including
 * individual member balances and the simplified list of transactions
 * required to settle all debts.
 */
export interface GroupBalanceSummary {
  memberBalances: UserGroupBalance[];
  simplifiedDebts: DebtTransaction[];
}

/**
 * Represents the overall balance for a single user across all groups they are a member of.
 */
export interface UserOverallBalance {
  userId: number;
  userName: string;
  /**
   * The net balance for the user across all groups.
   * A positive value means the user is owed money overall.
   * A negative value means the user owes money overall.
   */
  overallBalance: number;
  /**
   * A breakdown of the user's balance in each group they are a member of.
   */
  groupBalances: Array<{
    groupId: number;
    groupName: string;
    balance: number;
  }>;
}

export class BalanceService {
  private db = knex(knexConfig[process.env.NODE_ENV || 'test']);

  /**
   * Calculates the balance of each member in a given group and provides a
   * simplified list of transactions to settle the debts.
   * @param groupId The ID of the group to calculate balances for.
   * @returns A promise that resolves to the group's balance summary.
   */
  async getGroupBalanceSummary(groupId: number): Promise<GroupBalanceSummary> {
    const members = await this.db('users')
      .join('group_members', 'users.id', 'group_members.user_id')
      .where('group_members.group_id', groupId)
      .select('users.id', 'users.name');

    const memberBalances: UserGroupBalance[] = [];

    for (const member of members) {
      const totalPaid = await this.db('expenses')
        .where({ group_id: groupId, paid_by: member.id })
        .sum('amount as total')
        .first();

      const totalOwed = await this.db('expense_splits')
        .join('expenses', 'expense_splits.expense_id', 'expenses.id')
        .where('expenses.group_id', groupId)
        .where('expense_splits.user_id', member.id)
        .sum('expense_splits.amount as total')
        .first();

      const balance = (totalPaid?.total || 0) - (totalOwed?.total || 0);

      memberBalances.push({
        userId: member.id,
        userName: member.name,
        balance: Number(balance.toFixed(2)),
      });
    }

    const simplifiedDebts = this.simplifyDebts(memberBalances);

    return {
      memberBalances,
      simplifiedDebts,
    };
  }

  /**
   * Calculates the overall balance for a specific user across all the groups
   * they are a member of.
   * @param userId The ID of the user to calculate the balance for.
   * @returns A promise that resolves to the user's overall balance summary.
   */
  async getUserOverallBalance(userId: number): Promise<UserOverallBalance | undefined> {
    const user = await this.db('users').where({ id: userId }).first();
    if (!user) {
      return undefined;
    }

    const groups = await this.db('groups')
      .join('group_members', 'groups.id', 'group_members.group_id')
      .where('group_members.user_id', userId)
      .select('groups.id', 'groups.name');

    let overallBalance = 0;
    const groupBalances: UserOverallBalance['groupBalances'] = [];

    for (const group of groups) {
      const groupSummary = await this.getGroupBalanceSummary(group.id);
      const userGroupBalance = groupSummary.memberBalances.find(b => b.userId === userId);
      
      if (userGroupBalance) {
        const balance = userGroupBalance.balance;
        overallBalance += balance;
        groupBalances.push({
          groupId: group.id,
          groupName: group.name,
          balance: balance,
        });
      }
    }

    return {
      userId: user.id,
      userName: user.name,
      overallBalance: Number(overallBalance.toFixed(2)),
      groupBalances,
    };
  }

  /**
   * A private helper method to simplify the debts within a group.
   * Given a list of member balances, it calculates the minimum number of
   * transactions required to settle all debts.
   * @param memberBalances An array of user balances within a group.
   * @returns An array of simplified debt transactions.
   */
  private simplifyDebts(memberBalances: UserGroupBalance[]): DebtTransaction[] {
    const debtors = memberBalances.filter(m => m.balance < 0).map(m => ({ ...m, balance: -m.balance }));
    const creditors = memberBalances.filter(m => m.balance > 0).map(m => ({ ...m }));

    const transactions: DebtTransaction[] = [];

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount = Math.min(debtor.balance, creditor.balance);

      if (amount > 0) {
        transactions.push({
          from: { userId: debtor.userId, userName: debtor.userName },
          to: { userId: creditor.userId, userName: creditor.userName },
          amount: Number(amount.toFixed(2)),
        });

        debtor.balance -= amount;
        creditor.balance -= amount;
      }

      if (debtor.balance === 0) {
        debtorIndex++;
      }
      if (creditor.balance === 0) {
        creditorIndex++;
      }
    }

    return transactions;
  }
}
