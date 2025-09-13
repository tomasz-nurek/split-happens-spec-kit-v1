import { Router, Request, Response } from 'express';
import { requireAuth } from './auth';
import { ExpenseService, CreateExpenseRequest } from '../services/ExpenseService';
import { GroupService } from '../services/GroupService';
import { UserService } from '../services/UserService';

const router = Router();
const expenseService = new ExpenseService();
const groupService = new GroupService();
const userService = new UserService();

/**
 * GET /api/groups/:id/expenses
 * List all expenses for a group
 */
router.get('/groups/:id/expenses', requireAuth, async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId) || groupId <= 0) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const group = await groupService.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const expenses = await expenseService.findByGroupId(groupId);
    return res.status(200).json(expenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/groups/:id/expenses
 * Create a new expense for a group
 */
router.post('/groups/:id/expenses', requireAuth, async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId) || groupId <= 0) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const group = await groupService.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const { amount, description, paidBy, participantIds } = req.body || {};

    // Validate required fields
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount (positive number) is required' });
    }

    if (!description || typeof description !== 'string' || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!paidBy || typeof paidBy !== 'number' || paidBy <= 0) {
      return res.status(400).json({ error: 'Valid paidBy (user ID) is required' });
    }

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'participantIds (non-empty array) is required' });
    }

    // Validate that paidBy user exists
    const payer = await userService.findById(paidBy);
    if (!payer) {
      return res.status(400).json({ error: 'Payer user not found' });
    }

    // Validate that all participant users exist
    for (const participantId of participantIds) {
      if (typeof participantId !== 'number' || participantId <= 0) {
        return res.status(400).json({ error: 'All participantIds must be valid positive numbers' });
      }
      const participant = await userService.findById(participantId);
      if (!participant) {
        return res.status(400).json({ error: `Participant user ${participantId} not found` });
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
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/expenses/:id
 * Delete an expense
 */
router.delete('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const expenseId = parseInt(req.params.id, 10);
    if (isNaN(expenseId) || expenseId <= 0) {
      return res.status(400).json({ error: 'Invalid expense ID' });
    }

    const expense = await expenseService.findById(expenseId);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    await expenseService.delete(expenseId);
    return res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as expensesRouter };
