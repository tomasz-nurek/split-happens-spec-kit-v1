import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthError } from './error';
import { logger } from '../utils/logger';

const authService = new AuthService();

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 * 
 * This middleware validates the Bearer token in the Authorization header
 * and ensures only authenticated admin users can access protected routes.
 * 
 * @param req - Express request object
 * @param res - Express response object  
 * @param next - Express next function
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (!token) {
      return next(new AuthError('Unauthorized'));
    }

    const isValid = await authService.isTokenValid(token);
    if (!isValid) {
      return next(new AuthError('Unauthorized'));
    }

    // Token is valid, proceed to next middleware/route handler
    next();
  } catch (error) {
    logger.error('Authentication middleware error', error, { method: req.method, url: req.url, ip: req.ip });
    next(error as Error);
  }
};

/**
 * Optional authentication middleware
 * Attempts to verify JWT token but doesn't block request if invalid
 * 
 * This middleware checks for authentication but allows the request to continue
 * even if no token is provided or if the token is invalid. It attaches user
 * information to the request object if authentication succeeds.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = await authService.verifyToken(token);
      if (payload) {
        // Attach user info to request for use in route handlers
        (req as any).user = {
          username: payload.username,
          role: payload.role
        };
      }
    }

    // Always proceed to next middleware/route handler
    next();
  } catch (error) {
    logger.warn('Optional authentication middleware error', { method: req.method, url: req.url, ip: req.ip });
    // Don't block the request on error, just proceed without user info
    next();
  }
};