import { Request, Response, NextFunction } from 'express';
import { logger, genCorrelationId } from '../utils/logger';

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
  // Correlation id from header or generate new
  const correlationId = (req.headers['x-correlation-id'] as string) || genCorrelationId();
  // Basic request context (avoid user-agent to reduce PII)
  const logContext = {
    correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
  } as const;

  let statusCode = 500;
  let errorMessage = 'Internal server error';

  // Map error types to HTTP status codes and messages
  switch (error.name) {
    case 'ValidationError':
      statusCode = 400;
      // Sanitize: don't echo raw details, provide concise message
      errorMessage = 'Validation error';
      logger.info('Validation error', { ...logContext, statusCode });
      break;

    case 'AuthError':
      statusCode = 401;
      errorMessage = 'Unauthorized';
      logger.info('Auth error', { ...logContext, statusCode });
      break;

    case 'NotFoundError':
      statusCode = 404;
      errorMessage = 'Not found';
      logger.info('Not found', { ...logContext, statusCode });
      break;

    case 'DatabaseError':
      statusCode = 500;
      errorMessage = 'Database operation failed';
      logger.error('Database error', error, { ...logContext, statusCode });
      break;

    case 'SyntaxError':
      // Handle JSON parsing errors
      if (error.message.includes('JSON')) {
        statusCode = 400;
        errorMessage = 'Invalid JSON in request body';
        logger.info('JSON parse error', { ...logContext, statusCode });
      } else {
        statusCode = 500;
        errorMessage = 'Internal server error';
        logger.error('Syntax error', error, { ...logContext, statusCode });
      }
      break;

    // Payload too large from body parser
    case 'PayloadTooLargeError':
      statusCode = 413;
      errorMessage = 'Payload too large';
      logger.warn('Payload too large', { ...logContext, statusCode });
      break;

    default:
      // Detect body-parser style error objects that don't set name properly
      const anyErr: any = error as any;
      if (anyErr && (anyErr.type === 'entity.too.large' || anyErr.statusCode === 413 || anyErr.status === 413)) {
        statusCode = 413;
        errorMessage = 'Payload too large';
        logger.warn('Payload too large', { ...logContext, statusCode });
        break;
      }
      // Handle unknown errors - log full details for debugging
      logger.error('Unhandled error', error, { ...logContext, statusCode });
      // Do not expose internals in any environment
      errorMessage = 'Internal server error';
      break;
  }

  // Send consistent error response format per API contracts
  res.setHeader('x-correlation-id', correlationId);
  res.status(statusCode).json({ error: errorMessage });
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
  const error = new NotFoundError('Route not found');
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