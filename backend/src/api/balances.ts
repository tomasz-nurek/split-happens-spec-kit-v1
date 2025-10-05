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

    // Get balance summary in new DTO shape
    const dto = await balanceService.getGroupBalancesDTO(id);
    return res.status(200).json(dto);
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

// Backward compatibility: alias plural endpoint expected by some tests (/users/:id/balances)
router.get('/users/:id/balances', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Delegate to singular handler logic by reusing implementation
  (req.url = req.url.replace('/balances', '/balance'));
  return (router as any).handle(req, res, next);
}));

export { router as balancesRouter };
