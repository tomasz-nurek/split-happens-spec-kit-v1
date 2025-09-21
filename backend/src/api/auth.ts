import { Router, Request, Response, NextFunction } from 'express';
import { AuthService, LoginCredentials } from '../services/AuthService';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/login
 * Admin login endpoint
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginCredentials = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    // Attempt login
    const result = await authService.login({ username, password });

    if (!result) {
      return res.status(401).json({ 
        error: 'Invalid username or password' 
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * POST /api/auth/logout
 * Admin logout endpoint
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized' 
      });
    }

    // Verify token is valid before logout
    const isValid = await authService.isTokenValid(token);
    if (!isValid) {
      return res.status(401).json({ 
        error: 'Unauthorized' 
      });
    }

    // Logout (add token to blacklist)
    await authService.logout(token);

    return res.status(200).json({ 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * GET /api/auth/verify
 * Verify token endpoint
 */
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({ 
        error: 'Invalid token' 
      });
    }

    // Verify token
    const payload = await authService.verifyToken(token);

    if (!payload) {
      return res.status(401).json({ 
        error: 'Invalid token' 
      });
    }

    return res.status(200).json({ 
      valid: true 
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authService.extractTokenFromHeader(authHeader);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const isValid = await authService.isTokenValid(token);
  if (!isValid) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
};

export { router as authRouter };