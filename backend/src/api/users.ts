import { Router, Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { AuthService } from '../services/AuthService';

const router = Router();
const userService = new UserService();
const authService = new AuthService();

/**
 * Authentication helper function
 */
const requireAuth = async (req: Request, res: Response): Promise<boolean> => {
  const authHeader = req.headers.authorization;
  const token = authService.extractTokenFromHeader(authHeader);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  const isValid = await authService.isTokenValid(token);
  if (!isValid) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  return true;
};

/**
 * GET /api/users
 * List all users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check authentication
    if (!(await requireAuth(req, res))) {
      return;
    }

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
router.post('/', async (req: Request, res: Response) => {
  try {
    // Check authentication
    if (!(await requireAuth(req, res))) {
      return;
    }

    const { name } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Name is required' 
      });
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
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Check authentication
    if (!(await requireAuth(req, res))) {
      return;
    }

    const { id } = req.params;
    const userId = parseInt(id, 10);

    // Validate ID parameter
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ 
        error: 'Invalid user ID' 
      });
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
