import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { requireAuth } from '../middleware/auth';
import { validateUserName, validateId, formatValidationErrors } from '../utils/validation';

const router = Router();
const userService = new UserService();

/**
 * GET /api/users
 * List all users
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const users = await userService.findAll();
    return res.status(200).json(users);
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * POST /api/users
 * Create user
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    // Validate required fields using centralized validation utilities
    const nameValidation = validateUserName(name);
    
    if (!nameValidation.isValid) {
      const errorResponse = formatValidationErrors(nameValidation);
      return res.status(400).json(errorResponse);
    }

    // Create user
    const user = await userService.create({ name: name.trim() });

    return res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * DELETE /api/users/:id
 * Delete user
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id, 10);

    // Validate ID parameter using centralized validation utilities
    const idValidation = validateId(userId, 'User ID');
    
    if (!idValidation.isValid) {
      const errorResponse = formatValidationErrors(idValidation);
      return res.status(400).json(errorResponse);
    }

    // Check if user exists
    const existingUser = await userService.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Delete user
    await userService.delete(userId);

    return res.status(200).json({ 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

export { router as usersRouter };
