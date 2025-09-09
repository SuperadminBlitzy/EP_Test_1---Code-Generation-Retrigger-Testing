/**
 * Global Error Handling Middleware
 * 
 * This module provides centralized error processing for the Express.js application.
 * It implements structured JSON error responses, environment-specific error disclosure,
 * Winston logging integration, and proper HTTP status code mapping for consistent
 * error handling across all routes and middleware.
 * 
 * Features:
 * - Express.js error middleware signature (err, req, res, next)
 * - Structured JSON error responses with consistent format
 * - Environment-specific error disclosure (full details in dev, sanitized in prod)
 * - Winston logging integration with appropriate log levels
 * - Request context logging for debugging and monitoring
 * - Unique request ID generation for error correlation
 * - HTTP status code mapping for different error types
 * - Rate limiting notification support
 * - Graceful error recovery without application crashes
 * - Custom error type handling with specific logic
 * 
 * Error Response Format:
 * {
 *   "error": {
 *     "message": "Human-readable error description",
 *     "code": "ERROR_CODE",
 *     "timestamp": "2024-01-01T00:00:00.000Z",
 *     "requestId": "uuid-v4-request-identifier"
 *   },
 *   "success": false
 * }
 */

const { v4: uuid } = require('uuid');
const { StatusCodes } = require('http-status-codes');
const logger = require('../utils/logger');
const config = require('../config/index');

/**
 * Error Type Classification
 * 
 * Maps different error types to appropriate HTTP status codes and logging levels.
 * This classification system ensures consistent error handling across the application
 * while providing proper HTTP semantics and logging granularity.
 */
const ERROR_TYPES = {
  // Validation and client-side errors (4xx range)
  VALIDATION_ERROR: {
    statusCode: StatusCodes.BAD_REQUEST,
    logLevel: 'warn',
    message: 'Request validation failed'
  },
  AUTHENTICATION_ERROR: {
    statusCode: StatusCodes.UNAUTHORIZED,
    logLevel: 'warn',
    message: 'Authentication required'
  },
  AUTHORIZATION_ERROR: {
    statusCode: StatusCodes.FORBIDDEN,
    logLevel: 'warn',
    message: 'Insufficient permissions'
  },
  NOT_FOUND_ERROR: {
    statusCode: StatusCodes.NOT_FOUND,
    logLevel: 'info',
    message: 'Resource not found'
  },
  RATE_LIMIT_ERROR: {
    statusCode: StatusCodes.TOO_MANY_REQUESTS,
    logLevel: 'warn',
    message: 'Too many requests'
  },
  UNPROCESSABLE_ENTITY_ERROR: {
    statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
    logLevel: 'warn',
    message: 'Request cannot be processed'
  },
  
  // Server-side errors (5xx range)
  INTERNAL_SERVER_ERROR: {
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
    logLevel: 'error',
    message: 'Internal server error'
  }
};

/**
 * Generate Unique Request ID
 * 
 * Creates a UUID v4 identifier for error correlation and tracking.
 * Each error response includes this unique ID for distributed tracing
 * and debugging support across the Express.js application pipeline.
 * 
 * @returns {string} UUID v4 string for request identification
 */
function generateRequestId() {
  return uuid();
}

/**
 * Determine Error Type and Status Code
 * 
 * Analyzes the error object to determine appropriate error type classification,
 * HTTP status code, and logging level. Supports custom error types with specific
 * handling logic while providing sensible defaults for unclassified errors.
 * 
 * @param {Error} error - The error object to classify
 * @returns {Object} Error classification with statusCode, logLevel, and message
 */
function determineErrorType(error) {
  // Handle custom error types with explicit type property
  if (error.type && ERROR_TYPES[error.type]) {
    return ERROR_TYPES[error.type];
  }
  
  // Handle HTTP status code errors from Express or middleware
  if (error.status || error.statusCode) {
    const statusCode = error.status || error.statusCode;
    
    // Map status codes to error types
    switch (statusCode) {
      case StatusCodes.BAD_REQUEST:
        return ERROR_TYPES.VALIDATION_ERROR;
      case StatusCodes.UNAUTHORIZED:
        return ERROR_TYPES.AUTHENTICATION_ERROR;
      case StatusCodes.FORBIDDEN:
        return ERROR_TYPES.AUTHORIZATION_ERROR;
      case StatusCodes.NOT_FOUND:
        return ERROR_TYPES.NOT_FOUND_ERROR;
      case StatusCodes.UNPROCESSABLE_ENTITY:
        return ERROR_TYPES.UNPROCESSABLE_ENTITY_ERROR;
      case StatusCodes.TOO_MANY_REQUESTS:
        return ERROR_TYPES.RATE_LIMIT_ERROR;
      default:
        // Default to internal server error for unknown status codes
        return {
          ...ERROR_TYPES.INTERNAL_SERVER_ERROR,
          statusCode: statusCode >= 400 && statusCode < 500 ? statusCode : StatusCodes.INTERNAL_SERVER_ERROR
        };
    }
  }
  
  // Handle specific error names and types
  if (error.name === 'ValidationError' || error.name === 'ValidatorError') {
    return ERROR_TYPES.VALIDATION_ERROR;
  }
  
  if (error.name === 'UnauthorizedError' || error.message.toLowerCase().includes('unauthorized')) {
    return ERROR_TYPES.AUTHENTICATION_ERROR;
  }
  
  if (error.name === 'ForbiddenError' || error.message.toLowerCase().includes('forbidden')) {
    return ERROR_TYPES.AUTHORIZATION_ERROR;
  }
  
  if (error.name === 'NotFoundError' || error.message.toLowerCase().includes('not found')) {
    return ERROR_TYPES.NOT_FOUND_ERROR;
  }
  
  // Default to internal server error for unclassified errors
  return ERROR_TYPES.INTERNAL_SERVER_ERROR;
}

/**
 * Extract Request Context for Logging
 * 
 * Captures comprehensive request context information for error logging
 * and debugging purposes. Includes HTTP method, URL, headers, body,
 * and other relevant request metadata while ensuring sensitive information
 * is properly handled based on environment configuration.
 * 
 * @param {Object} req - Express request object
 * @returns {Object} Structured request context for logging
 */
function extractRequestContext(req) {
  const context = {
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString(),
    headers: {}
  };
  
  // Include request headers for debugging (excluding sensitive ones in production)
  if (config.nodeEnv === 'development') {
    // In development, include all headers for comprehensive debugging
    context.headers = req.headers;
    
    // Include request body for debugging (if available and not too large)
    if (req.body && Object.keys(req.body).length > 0) {
      const bodySize = JSON.stringify(req.body).length;
      context.body = bodySize < 1024 ? req.body : { _note: `Body too large (${bodySize} bytes)` };
    }
    
    // Include query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      context.query = req.query;
    }
    
    // Include route parameters
    if (req.params && Object.keys(req.params).length > 0) {
      context.params = req.params;
    }
  } else {
    // In production, only include essential headers (excluding sensitive ones)
    const safeHeaders = ['content-type', 'content-length', 'accept', 'accept-encoding'];
    safeHeaders.forEach(header => {
      if (req.get(header)) {
        context.headers[header] = req.get(header);
      }
    });
  }
  
  return context;
}

/**
 * Format Error Message for Client Response
 * 
 * Determines the appropriate error message to send to the client based on
 * environment configuration. In development, detailed error messages are
 * provided for debugging. In production, generic sanitized messages are
 * used to prevent sensitive information disclosure.
 * 
 * @param {Error} error - The original error object
 * @param {Object} errorType - Error type classification
 * @returns {string} Formatted error message for client response
 */
function formatErrorMessage(error, errorType) {
  // In development, provide detailed error messages for debugging
  if (config.nodeEnv === 'development') {
    return error.message || errorType.message;
  }
  
  // In production, use generic messages to prevent information disclosure
  // Only provide specific messages for client-side errors (4xx)
  if (errorType.statusCode >= 400 && errorType.statusCode < 500) {
    // For client errors, provide specific but safe messages
    if (error.message && !error.message.includes('Error:') && !error.stack) {
      return error.message;
    }
  }
  
  // For server errors or sensitive client errors, use generic messages
  return errorType.message;
}

/**
 * Generate Error Code
 * 
 * Creates a standardized error code for API consumers. The code is derived
 * from the HTTP status code and error type, providing a consistent way for
 * client applications to handle different error scenarios programmatically.
 * 
 * @param {Object} errorType - Error type classification
 * @param {Error} error - The original error object
 * @returns {string} Standardized error code
 */
function generateErrorCode(errorType, error) {
  // Use custom error code if provided
  if (error.code && typeof error.code === 'string') {
    return error.code.toUpperCase();
  }
  
  // Generate error code based on status code
  const statusCode = errorType.statusCode;
  
  switch (statusCode) {
    case StatusCodes.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case StatusCodes.UNAUTHORIZED:
      return 'AUTHENTICATION_REQUIRED';
    case StatusCodes.FORBIDDEN:
      return 'ACCESS_FORBIDDEN';
    case StatusCodes.NOT_FOUND:
      return 'RESOURCE_NOT_FOUND';
    case StatusCodes.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_REQUEST';
    case StatusCodes.TOO_MANY_REQUESTS:
      return 'RATE_LIMIT_EXCEEDED';
    case StatusCodes.INTERNAL_SERVER_ERROR:
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Log Error with Winston Integration
 * 
 * Logs the error using Winston with appropriate log level and structured
 * metadata. Includes comprehensive error context, request information,
 * and stack traces for internal debugging while maintaining security
 * considerations for production environments.
 * 
 * @param {Error} error - The error object to log
 * @param {Object} req - Express request object
 * @param {Object} errorType - Error type classification
 * @param {string} requestId - Unique request identifier
 */
function logError(error, req, errorType, requestId) {
  const requestContext = extractRequestContext(req);
  
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      type: error.type,
      statusCode: errorType.statusCode
    },
    request: requestContext,
    requestId: requestId,
    timestamp: new Date().toISOString()
  };
  
  // Include stack trace for internal debugging
  if (error.stack) {
    logData.error.stack = error.stack;
  }
  
  // Include additional error properties if available
  if (error.details) {
    logData.error.details = error.details;
  }
  
  if (error.validationErrors) {
    logData.error.validationErrors = error.validationErrors;
  }
  
  // Log with appropriate level based on error type
  const logLevel = errorType.logLevel;
  const logMessage = `${errorType.statusCode >= 500 ? 'Server' : 'Client'} error occurred: ${error.message}`;
  
  logger[logLevel](logMessage, logData);
  
  // Additionally log as error level for server errors to ensure visibility
  if (errorType.statusCode >= 500 && logLevel !== 'error') {
    logger.error(`Critical server error: ${error.message}`, logData);
  }
}

/**
 * Build Structured Error Response
 * 
 * Constructs the standardized JSON error response that will be sent to the client.
 * The response follows the consistent format defined in the API specification
 * and includes all necessary information for client-side error handling.
 * 
 * @param {Error} error - The original error object
 * @param {Object} errorType - Error type classification
 * @param {string} requestId - Unique request identifier
 * @returns {Object} Structured JSON error response
 */
function buildErrorResponse(error, errorType, requestId) {
  return {
    error: {
      message: formatErrorMessage(error, errorType),
      code: generateErrorCode(errorType, error),
      timestamp: new Date().toISOString(),
      requestId: requestId
    },
    success: false
  };
}

/**
 * Express Global Error Handler Middleware
 * 
 * This is the main error handling middleware that implements the Express.js
 * error middleware signature (err, req, res, next). It provides centralized
 * error processing for all routes and middleware in the application.
 * 
 * The middleware:
 * - Processes both synchronous and asynchronous errors
 * - Generates unique request IDs for error correlation
 * - Maps errors to appropriate HTTP status codes
 * - Provides environment-specific error disclosure
 * - Integrates with Winston for comprehensive error logging
 * - Returns structured JSON error responses
 * - Ensures graceful error recovery without application crashes
 * 
 * @param {Error} err - The error object from Express or application code
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function errorHandler(err, req, res, next) {
  // Generate unique request ID for error correlation
  const requestId = generateRequestId();
  
  // Determine error type and appropriate response strategy
  const errorType = determineErrorType(err);
  
  // Log error with comprehensive context
  logError(err, req, errorType, requestId);
  
  // Build structured error response
  const errorResponse = buildErrorResponse(err, errorType, requestId);
  
  // Set appropriate HTTP status code
  const statusCode = errorType.statusCode;
  
  // Set security headers for error responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  // Handle rate limiting specific response headers
  if (statusCode === StatusCodes.TOO_MANY_REQUESTS) {
    // Add rate limit headers if available in the error object
    if (err.resetTime) {
      res.set('Retry-After', Math.round((err.resetTime - Date.now()) / 1000));
    }
    
    if (err.limit) {
      res.set('X-RateLimit-Limit', err.limit);
    }
    
    if (err.remaining) {
      res.set('X-RateLimit-Remaining', err.remaining);
    }
  }
  
  // Send structured JSON error response
  res.status(statusCode).json(errorResponse);
  
  // Log successful error handling for monitoring
  logger.debug('Error response sent successfully', {
    statusCode: statusCode,
    requestId: requestId,
    errorCode: errorResponse.error.code,
    method: req.method,
    url: req.originalUrl || req.url
  });
}

// Export the error handler as the default export
module.exports = errorHandler;