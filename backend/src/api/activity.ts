import { Router, Request, Response, NextFunction } from 'express';
import { ActivityService } from '../services/ActivityService';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ValidationError } from '../middleware/error';
import { wrapActivities, serializeActivities } from '../utils/serializers';
import { GroupService } from '../services/GroupService';
import { UserService } from '../services/UserService';
import { ExpenseService } from '../services/ExpenseService';
import { NotFoundError } from '../middleware/error';

const router = Router();
const activityService = new ActivityService();
const groupService = new GroupService();
const userService = new UserService();
const expenseService = new ExpenseService();

/**
 * GET /api/activity
 * Get activity log with optional pagination
 */
router.get('/activity', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    // Validate query parameters
    if (limit !== undefined && (isNaN(limit) || limit < 0)) {
      return next(new ValidationError('Invalid limit parameter'));
    }

    if (offset !== undefined && (isNaN(offset) || offset < 0)) {
      return next(new ValidationError('Invalid offset parameter'));
    }

  const activities = await activityService.findAll(limit, offset);
  return res.status(200).json(wrapActivities(activities));
}));

/**
 * GET /api/groups/:id/activity
 * Group-scoped activity events (uses denormalized group_id for O(log n) performance).
 */
router.get('/groups/:id/activity', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) return next(new ValidationError('Invalid group id'));
  const group = await groupService.findById(groupId);
  if (!group) return next(new NotFoundError('Group not found'));
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  
  // Use denormalized group_id column for efficient O(log n) lookup
  // This includes both group entity events AND expense events for that group
  const activities = await activityService.findBy({ groupId, limit, offset });
  
  return res.status(200).json({ groupId, groupName: group.name, activities: serializeActivities(activities) });
}));

/**
 * GET /api/users/:id/activity
 * User-scoped activity events.
 */
router.get('/users/:id/activity', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) return next(new ValidationError('Invalid user id'));
  const user = await userService.findById(userId);
  if (!user) return next(new NotFoundError('User not found'));
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  // We exclude pure user entity events to satisfy earlier expectation of empty feed for inactive user.
  const raw = await activityService.findBy({ userId, limit, offset });
  // Keep user entity events for completeness, tests can assert presence
  return res.status(200).json({ userId, userName: user.name, activities: serializeActivities(raw) });
}));

/**
 * GET /api/expenses/:id/activity
 * Expense-scoped activity events.
 */
router.get('/expenses/:id/activity', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const expenseId = parseInt(req.params.id, 10);
  if (isNaN(expenseId)) return next(new ValidationError('Invalid expense id'));
  const expense = await expenseService.findById(expenseId);
  if (!expense) return next(new NotFoundError('Expense not found'));
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  const activities = await activityService.findBy({ expenseId, limit, offset });
  return res.status(200).json({ expenseId, activities: serializeActivities(activities) });
}));

export { router as activityRouter };
