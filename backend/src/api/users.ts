import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { requireAuth } from '../middleware/auth';
import { validateUserName, validateId, formatValidationErrors } from '../utils/validation';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error';

const router = Router();
const userService = new UserService();

/**
 * GET /api/users
 * List all users
 */
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const users = await userService.findAll();
    return res.status(200).json(users);
}));

/**
 * POST /api/users
 * Create user
 */
router.post('/', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name } = req.body;

    // Validate required fields using centralized validation utilities
    const nameValidation = validateUserName(name);
    
    if (!nameValidation.isValid) {
      const errorResponse = formatValidationErrors(nameValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    // Create user
    const user = await userService.create({ name: name.trim() });

    return res.status(201).json(user);
}));

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    // Validate ID parameter using centralized validation utilities
    const idValidation = validateId(userId, 'User ID');
    
    if (!idValidation.isValid) {
      const errorResponse = formatValidationErrors(idValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    // Check if user exists
    const existingUser = await userService.findById(userId);
    if (!existingUser) {
      return next(new NotFoundError('User not found'));
    }

    // Delete user
    await userService.delete(userId);

    return res.status(200).json({ 
      message: 'User deleted successfully' 
    });
}));

export { router as usersRouter };
