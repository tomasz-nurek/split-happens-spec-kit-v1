import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { ExpenseService, CreateExpenseRequest } from '../services/ExpenseService';
import { GroupService } from '../services/GroupService';
import { UserService } from '../services/UserService';
import { validateId, validateAmount, validateExpenseDescription, validateIdArray, validateNoDuplicateIds, combineValidationResults, formatValidationErrors } from '../utils/validation';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error';

const router = Router();
const expenseService = new ExpenseService();
const groupService = new GroupService();
const userService = new UserService();

/**
 * GET /api/groups/:id/expenses
 * List all expenses for a group
 */
router.get('/groups/:id/expenses', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const groupId = parseInt(req.params.id, 10);
    
    // Validate group ID parameter using centralized validation utilities
    const groupIdValidation = validateId(groupId, 'Group ID');
    
    if (!groupIdValidation.isValid) {
      const errorResponse = formatValidationErrors(groupIdValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const group = await groupService.findById(groupId);
    if (!group) {
      return next(new NotFoundError('Group not found'));
    }

    const expenses = await expenseService.findByGroupId(groupId);
    return res.status(200).json(expenses);
}));

/**
 * POST /api/groups/:id/expenses
 * Create a new expense for a group
 */
router.post('/groups/:id/expenses', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const groupId = parseInt(req.params.id, 10);
    
    // Validate group ID parameter using centralized validation utilities
    const groupIdValidation = validateId(groupId, 'Group ID');
    
    if (!groupIdValidation.isValid) {
      const errorResponse = formatValidationErrors(groupIdValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const group = await groupService.findById(groupId);
    if (!group) {
      return next(new NotFoundError('Group not found'));
    }

    const { amount, description, paidBy, participantIds } = req.body || {};

    // Validate required fields using centralized validation utilities
    const amountValidation = validateAmount(amount);
    const descriptionValidation = validateExpenseDescription(description);
    const paidByValidation = validateId(paidBy, 'Paid by user ID');
    const participantIdsValidation = validateIdArray(participantIds, 'Participant IDs');
    const noDuplicatesValidation = validateNoDuplicateIds(participantIds || [], 'Participant IDs');
    
    const validationResult = combineValidationResults(
      amountValidation, 
      descriptionValidation, 
      paidByValidation, 
      participantIdsValidation, 
      noDuplicatesValidation
    );
    
    if (!validationResult.isValid) {
      const errorResponse = formatValidationErrors(validationResult);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    // Validate that paidBy user exists
    const payer = await userService.findById(paidBy);
    if (!payer) {
      return next(new ValidationError('Payer user not found'));
    }

    // Validate that all participant users exist
    for (const participantId of participantIds) {
      const participant = await userService.findById(participantId);
      if (!participant) {
        return next(new ValidationError(`Participant user ${participantId} not found`));
      }
    }

    // Create the expense
    const expenseData: CreateExpenseRequest = {
      amount,
      description: description.trim(),
      paidBy,
      participantIds
    };

    const expense = await expenseService.create(groupId, expenseData);
    return res.status(201).json(expense);
}));

/**
 * PATCH /api/expenses/:id
 * Update an expense (currently supports description and amount change)
 */
router.patch('/expenses/:id', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const expenseId = parseInt(req.params.id, 10);
    const { description, amount } = req.body || {};

    const idValidation = validateId(expenseId, 'Expense ID');
    if (!idValidation.isValid) {
      const errorResponse = formatValidationErrors(idValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const existing = await expenseService.findById(expenseId);
    if (!existing) return next(new NotFoundError('Expense not found'));

    // Optional updates; validate when provided
    if (description !== undefined) {
      const descValidation = validateExpenseDescription(description);
      if (!descValidation.isValid) {
        const errorResponse = formatValidationErrors(descValidation);
        return next(new ValidationError(errorResponse?.error || 'Validation error'));
      }
    }
    if (amount !== undefined) {
      const amtValidation = validateAmount(amount);
      if (!amtValidation.isValid) {
        const errorResponse = formatValidationErrors(amtValidation);
        return next(new ValidationError(errorResponse?.error || 'Validation error'));
      }
    }

    // Apply updates individually to preserve existing splits logic (splits unaffected for now)
    if (description !== undefined) {
      await expenseService.updateDescription(expenseId, description.trim());
    }
    if (amount !== undefined) {
      // NOTE: For MVP we simply update the amount without recalculating historical splits.
      // Future enhancement could re-normalize splits.
      const db = (expenseService as any).db; // access underlying knex
      await db('expenses').where({ id: expenseId }).update({ amount });
      // Log separate update for amount change (treated as update activity)
      // Activity logging of description change handled inside updateDescription; we add amount change metadata here.
      const { ActivityService } = await import('../services/ActivityService');
      const { ActivityAction, ActivityEntityType } = await import('../models/ActivityLog');
      const actSvc = new ActivityService();
      await actSvc.logActivity(ActivityAction.UPDATE, ActivityEntityType.expense, expenseId, { expenseId: expenseId, amount, description: description ?? existing.description });
    }

    const updated = await expenseService.findById(expenseId);
    return res.status(200).json(updated);
}));

/**
 * DELETE /api/expenses/:id
 * Delete an expense
 */
router.delete('/expenses/:id', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const expenseId = parseInt(req.params.id, 10);
    
    // Validate expense ID parameter using centralized validation utilities
    const expenseIdValidation = validateId(expenseId, 'Expense ID');
    
    if (!expenseIdValidation.isValid) {
      const errorResponse = formatValidationErrors(expenseIdValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const expense = await expenseService.findById(expenseId);
    if (!expense) {
      return next(new NotFoundError('Expense not found'));
    }

    await expenseService.delete(expenseId);
    return res.status(200).json({ message: 'Expense deleted successfully' });
}));

export { router as expensesRouter };
