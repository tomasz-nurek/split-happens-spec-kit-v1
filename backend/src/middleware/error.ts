import { Request, Response, NextFunction } from 'express';

/**
 * Custom error classes for consistent error handling
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Centralized Express error handling middleware
 * 
 * This middleware catches all unhandled errors from routes and formats them
 * consistently according to the API contract specifications. It:
 * - Maps error types to appropriate HTTP status codes
 * - Formats all errors as { error: string } per API contracts
 * - Logs errors appropriately (console.error for 500s, debug info for others)
 * - Prevents sensitive information exposure in production
 * - Integrates with validation utilities error formatting
 * 
 * Must be added to Express app after all routes to catch unhandled errors.
 * 
 * @param error - The error object
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  const logContext = {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date().toISOString()
  };

  let statusCode = 500;
  let errorMessage = 'Internal server error';

  // Map error types to HTTP status codes and messages
  switch (error.name) {
    case 'ValidationError':
      statusCode = 400;
      errorMessage = error.message;
      console.log(`[${logContext.timestamp}] Validation Error (${logContext.method} ${logContext.url}):`, error.message);
      break;

    case 'AuthError':
      statusCode = 401;
      errorMessage = error.message;
      console.log(`[${logContext.timestamp}] Auth Error (${logContext.method} ${logContext.url}):`, error.message);
      break;

    case 'NotFoundError':
      statusCode = 404;
      errorMessage = error.message;
      console.log(`[${logContext.timestamp}] Not Found (${logContext.method} ${logContext.url}):`, error.message);
      break;

    case 'DatabaseError':
      statusCode = 500;
      errorMessage = 'Database operation failed';
      console.error(`[${logContext.timestamp}] Database Error (${logContext.method} ${logContext.url}):`, {
        message: error.message,
        originalError: (error as DatabaseError).originalError?.message,
        stack: error.stack
      });
      break;

    case 'SyntaxError':
      // Handle JSON parsing errors
      if (error.message.includes('JSON')) {
        statusCode = 400;
        errorMessage = 'Invalid JSON in request body';
        console.log(`[${logContext.timestamp}] JSON Parse Error (${logContext.method} ${logContext.url}):`, error.message);
      } else {
        statusCode = 500;
        errorMessage = 'Internal server error';
        console.error(`[${logContext.timestamp}] Syntax Error (${logContext.method} ${logContext.url}):`, {
          message: error.message,
          stack: error.stack
        });
      }
      break;

    default:
      // Handle unknown errors - log full details for debugging
      console.error(`[${logContext.timestamp}] Unhandled Error (${logContext.method} ${logContext.url}):`, {
        name: error.name,
        message: error.message,
        stack: error.stack,
        userAgent: logContext.userAgent
      });

      // In production, don't expose internal error details
      if (process.env.NODE_ENV === 'production') {
        errorMessage = 'Internal server error';
      } else {
        errorMessage = error.message || 'Internal server error';
      }
      break;
  }

  // Send consistent error response format per API contracts
  res.status(statusCode).json({
    error: errorMessage
  });
};

/**
 * 404 handler for unmatched routes
 * 
 * This middleware should be added after all routes but before the error handler
 * to catch requests to non-existent endpoints.
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.url} not found`);
  next(error);
};

/**
 * Async error wrapper utility
 * 
 * Wraps async route handlers to automatically catch and forward errors
 * to the error handling middleware. Use this to avoid try-catch blocks
 * in every async route handler.
 * 
 * Example usage:
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.findAll();
 *   res.json(users);
 * }));
 * 
 * @param fn - Async route handler function
 * @returns Wrapped function that catches errors
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};