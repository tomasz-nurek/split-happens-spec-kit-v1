import { Router, Request, Response } from 'express';
import { AuthService, LoginCredentials } from '../services/AuthService';
import { validateString, combineValidationResults, formatValidationErrors } from '../utils/validation';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/login
 * Admin login endpoint
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginCredentials = req.body;

    // Validate required fields using centralized validation utilities
    const usernameValidation = validateString(username, 'Username', 1, 100);
    const passwordValidation = validateString(password, 'Password', 1, 255);
    
    const validationResult = combineValidationResults(usernameValidation, passwordValidation);
    
    if (!validationResult.isValid) {
      const errorResponse = formatValidationErrors(validationResult);
      return res.status(400).json(errorResponse);
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

export { router as authRouter };