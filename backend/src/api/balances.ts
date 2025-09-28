import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { BalanceService } from '../services/BalanceService';
import { GroupService } from '../services/GroupService';
import { UserService } from '../services/UserService';
import { validateId, formatValidationErrors } from '../utils/validation';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error';

// API response types matching the contract
interface DebtRelationship {
  user_id: number;
  user_name: string;
  amount: number;
}

interface GroupBalance {
  user_id: number;
  user_name: string;
  balance: number;
  owes: DebtRelationship[];
  owed_by: DebtRelationship[];
}

interface GroupBalanceSummary {
  group_id: number;
  group_name: string;
  balance: number;
}

interface UserBalance {
  user_id: number;
  user_name: string;
  overall_balance: number;
  group_balances: GroupBalanceSummary[];
}

const router = Router();
const balanceService = new BalanceService();
const groupService = new GroupService();
const userService = new UserService();

/**
 * GET /api/groups/:id/balances
 * Get balance information for all users in a group
 */
router.get('/groups/:id/balances', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    
    // Validate group ID parameter using centralized validation utilities
    const idValidation = validateId(id, 'Group ID');
    
    if (!idValidation.isValid) {
      const errorResponse = formatValidationErrors(idValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    // Check if group exists
    const group = await groupService.findById(id);
    if (!group) {
      return next(new NotFoundError('Group not found'));
    }

    // Get balance summary from service
    const balanceSummary = await balanceService.getGroupBalanceSummary(id);

    // Transform to API contract format
    const groupBalances: GroupBalance[] = balanceSummary.memberBalances.map(member => ({
      user_id: member.userId,
      user_name: member.userName,
      balance: member.balance,
      owes: [],
      owed_by: []
    }));

    // Transform simplified debts to owes/owed_by format
    const debtMap = new Map<number, { owes: DebtRelationship[], owed_by: DebtRelationship[] }>();

    // Initialize debt tracking for each user
    balanceSummary.memberBalances.forEach(member => {
      debtMap.set(member.userId, { owes: [], owed_by: [] });
    });

    // Process simplified debts
    balanceSummary.simplifiedDebts.forEach(debt => {
      const fromDebts = debtMap.get(debt.from.userId)!;
      const toDebts = debtMap.get(debt.to.userId)!;

      fromDebts.owes.push({
        user_id: debt.to.userId,
        user_name: debt.to.userName,
        amount: debt.amount
      });

      toDebts.owed_by.push({
        user_id: debt.from.userId,
        user_name: debt.from.userName,
        amount: debt.amount
      });
    });

    // Apply debt relationships to response
    groupBalances.forEach(balance => {
      const debts = debtMap.get(balance.user_id)!;
      balance.owes = debts.owes;
      balance.owed_by = debts.owed_by;
    });

    return res.status(200).json(groupBalances);
}));

/**
 * GET /api/users/:id/balance
 * Get overall balance across all groups for a user
 */
router.get('/users/:id/balance', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    
    // Validate user ID parameter using centralized validation utilities
    const idValidation = validateId(id, 'User ID');
    
    if (!idValidation.isValid) {
      const errorResponse = formatValidationErrors(idValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    // Get user balance from service
    const userBalance = await balanceService.getUserOverallBalance(id);
    if (!userBalance) {
      return next(new NotFoundError('User not found'));
    }

    // Transform to API contract format
    const response = {
      user_id: userBalance.userId,
      user_name: userBalance.userName,
      overall_balance: userBalance.overallBalance,
      group_balances: userBalance.groupBalances.map(group => ({
        group_id: group.groupId,
        group_name: group.groupName,
        balance: group.balance
      }))
    };

    return res.status(200).json(response);
}));

export { router as balancesRouter };
