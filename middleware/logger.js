/**
 * Logging Middleware Configuration Module
 * 
 * This module provides integrated logging middleware that combines Winston application
 * logging with Morgan HTTP request logging for comprehensive request tracking throughout
 * the Express.js application. It creates a unified logging infrastructure that captures
 * both application-level events and HTTP request/response data.
 * 
 * Features:
 * - Winston-Morgan integration with unified stream output
 * - Environment-specific logging behavior (verbose in development, structured in production)
 * - Request correlation through Winston metadata for distributed tracing
 * - Automatic log level mapping between Morgan HTTP status codes and Winston levels
 * - Express.js middleware pipeline integration for automatic request logging
 * - Custom log formatting support for specific routes or request patterns
 * - Error handling integration for failed request logging
 * - Performance monitoring with response time tracking
 * 
 * Integration:
 * - Uses Winston logger instance from utils/logger.js for centralized logging
 * - Imports Morgan HTTP configuration from config/morgan.js
 * - Integrates with Express.js middleware pipeline
 * - Supports structured logging in production and readable output in development
 * 
 * Usage:
 *   const loggerMiddleware = require('./middleware/logger');
 *   app.use(loggerMiddleware);
 */

// Internal dependencies from application modules
const logger = require('../utils/logger');
const morganConfig = require('../config/morgan');

/**
 * Create Integrated Logging Middleware
 * 
 * Creates Express.js middleware that combines Winston application logging
 * with Morgan HTTP request logging through a unified stream interface.
 * This ensures all logging output flows through the same Winston transports
 * for consistent formatting, storage, and rotation policies.
 * 
 * The middleware handles:
 * - HTTP request/response logging via Morgan
 * - Request correlation and tracking
 * - Environment-specific log formatting
 * - Error handling for logging failures
 * - Performance metrics and timing data
 * 
 * @returns {Function} Express.js middleware function for request logging
 */
function createLoggerMiddleware() {
  // Get configured Morgan middleware with Winston stream integration
  // This Morgan instance is already configured with:
  // - Environment-specific formats (dev, combined, JSON)
  // - Winston stream output for unified logging
  // - Custom tokens for request metadata
  // - Skip rules for static assets and health checks
  const morganMiddleware = morganConfig();
  
  // Create composite middleware that enhances Morgan with additional features
  return function loggerMiddleware(req, res, next) {
    // Add request start time for performance tracking
    req._startAt = process.hrtime();
    
    // Generate unique request ID if not already present
    if (!req.id && !req.requestId) {
      req.id = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      req.requestId = req.id;
    }
    
    // Log incoming request details for debugging and monitoring
    logger.debug('Incoming HTTP request', {
      requestId: req.id || req.requestId,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      remoteAddr: req.ip || req.connection.remoteAddress,
      headers: req.headers,
      query: req.query,
      timestamp: new Date().toISOString()
    });
    
    // Capture original res.end to add completion logging
    const originalEnd = res.end;
    
    res.end = function(chunk, encoding) {
      // Calculate response time
      const responseTime = req._startAt ? process.hrtime(req._startAt) : null;
      const responseTimeMs = responseTime ? 
        (responseTime[0] * 1000 + responseTime[1] * 1e-6).toFixed(2) : 'unknown';
      
      // Log response completion with appropriate level based on status code
      const statusCode = res.statusCode;
      const logLevel = statusCode >= 500 ? 'error' : 
                      statusCode >= 400 ? 'warn' : 'info';
      
      logger[logLevel]('HTTP request completed', {
        requestId: req.id || req.requestId,
        method: req.method,
        url: req.url,
        statusCode: statusCode,
        responseTime: responseTimeMs + 'ms',
        contentLength: res.get('Content-Length') || '0',
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      
      // Call original res.end method
      originalEnd.call(this, chunk, encoding);
    };
    
    // Add error handler for this specific request
    const onError = function(error) {
      logger.error('Request processing error', {
        requestId: req.id || req.requestId,
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString()
      });
    };
    
    // Attach error handler to request for downstream error handling
    req.on('error', onError);
    res.on('error', onError);
    
    // Execute Morgan middleware for HTTP request logging
    // This will stream the formatted log message through Winston
    morganMiddleware(req, res, function(err) {
      if (err) {
        // Handle Morgan middleware errors
        logger.error('Morgan middleware error', {
          requestId: req.id || req.requestId,
          error: err.message,
          stack: err.stack,
          method: req.method,
          url: req.url
        });
      }
      
      // Continue to next middleware
      next(err);
    });
  };
}

/**
 * Export Configured Logger Middleware
 * 
 * Exports the integrated logging middleware ready for use in Express.js
 * application pipeline. The middleware combines Winston and Morgan for
 * comprehensive request tracking and application logging.
 */
module.exports = createLoggerMiddleware();