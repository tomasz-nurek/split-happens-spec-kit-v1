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
