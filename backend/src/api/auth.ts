import { Router, Request, Response, NextFunction } from 'express';
import { AuthService, LoginCredentials } from '../services/AuthService';
import { validateString, combineValidationResults, formatValidationErrors } from '../utils/validation';
import { asyncHandler, ValidationError, AuthError } from '../middleware/error';
import { serializeUser } from '../utils/serializers';

const router = Router();
const authService = new AuthService();

/**
 * POST /api/auth/login
 * Admin login endpoint
 */
router.post('/login', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { username, password }: LoginCredentials = req.body;

    // Validate required fields using centralized validation utilities
    const usernameValidation = validateString(username, 'Username', 1, 100);
    const passwordValidation = validateString(password, 'Password', 1, 255);
    
    const validationResult = combineValidationResults(usernameValidation, passwordValidation);
    
    if (!validationResult.isValid) {
      const errorResponse = formatValidationErrors(validationResult);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    // Attempt login
    const result = await authService.login({ username, password });

    if (!result) {
      return next(new AuthError('Invalid username or password'));
    }

    return res.status(200).json(result);
}));

/**
 * POST /api/auth/logout
 * Admin logout endpoint
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return next(new AuthError('Unauthorized'));
    }

    // Verify token is valid before logout
    const isValid = await authService.isTokenValid(token);
    if (!isValid) {
      return next(new AuthError('Unauthorized'));
    }

    // Logout (add token to blacklist)
    await authService.logout(token);

    return res.status(200).json({ 
      message: 'Logged out successfully' 
    });
}));

/**
 * GET /api/auth/verify
 * Verify token endpoint
 */
router.get('/verify', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return next(new AuthError('Invalid token'));
    }

    // Verify token
    const payload = await authService.verifyToken(token);

    if (!payload) {
      return next(new AuthError('Invalid token'));
    }

  // Build minimal user object (single admin user for MVP)
  const user = serializeUser({ id: 1, name: 'Admin User', role: payload.role });
    return res.status(200).json({ 
      valid: true,
      user
    });
}));

export { router as authRouter };