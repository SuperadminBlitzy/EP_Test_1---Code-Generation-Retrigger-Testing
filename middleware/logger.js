/**
 * Logging Middleware Configuration Module
 * 
 * This module integrates Winston application logger and Morgan HTTP request logger
 * into the Express.js middleware pipeline. It configures Winston with multiple
 * transports (console, file, rotation) and integrates Morgan output through Winston
 * for unified logging infrastructure.
 * 
 * Features:
 * - Seamless Winston and Morgan integration for centralized logging
 * - Environment-specific logging behaviors (verbose in development, structured in production)
 * - Proper log level mapping between Morgan HTTP status codes and Winston log levels
 * - Request correlation through Winston metadata for distributed tracing
 * - Multi-transport configuration with console and file-based logging
 * - Support for custom log formatting for specific routes or request patterns
 * - Error handling for both successful requests (info level) and error responses (error level)
 * - Production-ready logging infrastructure with log rotation and retention policies
 * 
 * Architecture:
 * - Morgan middleware captures HTTP requests and streams to Winston
 * - Winston logger processes and routes logs to configured transports
 * - Unified log format ensures consistency across application and HTTP logs
 * - Environment configuration drives logging verbosity and output formats
 * 
 * Integration:
 * - Imports Winston logger instance from utils/logger.js for centralized logging
 * - Uses Morgan configuration from config/morgan.js for HTTP request logging
 * - Exports Express.js middleware function for automatic request logging
 * - Compatible with Express.js middleware pipeline and routing system
 * 
 * Usage:
 *   const loggerMiddleware = require('./middleware/logger');
 *   app.use(loggerMiddleware());
 */

const logger = require('../utils/logger');
const morganConfig = require('../config/morgan');

/**
 * Create Logging Middleware with Winston-Morgan Integration
 * 
 * This function creates and configures the unified logging middleware that
 * integrates Morgan HTTP request logging with Winston application logging.
 * The middleware automatically logs all HTTP requests through the Winston
 * transport system, enabling centralized log management, structured formatting,
 * and consistent log levels across the entire application.
 * 
 * Key Integration Points:
 * - Morgan middleware configured with Winston stream adapter
 * - HTTP status codes mapped to appropriate Winston log levels
 * - Request metadata enriched with contextual information
 * - Error responses logged at error level, success responses at info level
 * - Environment-specific logging behaviors (debug in development, structured in production)
 * - Request correlation supported through Winston metadata system
 * 
 * Log Level Mapping:
 * - 2xx responses: info level (successful requests)
 * - 3xx responses: info level (redirections)
 * - 4xx responses: warn level (client errors) 
 * - 5xx responses: error level (server errors)
 * 
 * Environment Behaviors:
 * - Development: Colorized console output with detailed request information
 * - Production: Structured JSON logs with rotation and centralized transport
 * - Staging: Combined log format with comprehensive request tracking
 * 
 * @returns {Function} Express.js middleware function for HTTP request logging
 */
function loggerMiddleware() {
  // Get configured Morgan middleware with Winston stream integration
  // This middleware is already configured with:
  // - Environment-specific format (dev/combined/JSON)
  // - Winston stream integration for centralized logging
  // - Custom tokens for enhanced request metadata
  // - Skip functions for excluding certain routes (health checks, static assets)
  // - Request correlation and performance metrics
  const morganMiddleware = morganConfig();
  
  // Enhanced middleware wrapper to provide additional logging context
  // and error handling capabilities beyond standard Morgan functionality
  return function(req, res, next) {
    // Add request correlation metadata for distributed tracing
    // This enables linking HTTP requests with application events in Winston logs
    if (!req.requestId) {
      req.requestId = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    
    // Capture original response end method for post-response logging
    const originalEnd = res.end;
    
    // Override response.end to add post-response logging with status code analysis
    res.end = function(chunk, encoding) {
      // Call original end method to complete the HTTP response
      originalEnd.call(this, chunk, encoding);
      
      // Log request completion with appropriate log level based on status code
      // This provides more granular control than Morgan's standard logging
      const statusCode = res.statusCode;
      const logLevel = getLogLevelForStatus(statusCode);
      const responseTime = res.get('X-Response-Time') || 'unknown';
      
      // Create comprehensive request metadata for Winston logging
      const requestMetadata = {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        status: statusCode,
        responseTime: responseTime,
        userAgent: req.get('User-Agent'),
        remoteAddr: req.ip || req.connection.remoteAddress,
        contentLength: res.get('Content-Length') || '0',
        referrer: req.get('Referrer'),
        timestamp: new Date().toISOString()
      };
      
      // Log with appropriate level based on HTTP status code
      // This provides more nuanced logging than Morgan's single-level approach
      const message = `HTTP ${statusCode} ${req.method} ${req.url}`;
      
      if (logLevel === 'error') {
        logger.error(message, {
          ...requestMetadata,
          category: 'http_request',
          severity: 'high'
        });
      } else if (logLevel === 'warn') {
        logger.warn(message, {
          ...requestMetadata,
          category: 'http_request',
          severity: 'medium'
        });
      } else {
        logger.info(message, {
          ...requestMetadata,
          category: 'http_request',
          severity: 'low'
        });
      }
    };
    
    // Store request start time for response time calculation
    req._startAt = process.hrtime();
    
    // Log request initiation for comprehensive request lifecycle tracking
    logger.debug('HTTP request initiated', {
      requestId: req.requestId,
      method: req.method,
      url: req.url,
      headers: req.headers,
      userAgent: req.get('User-Agent'),
      remoteAddr: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
      category: 'http_request_start'
    });
    
    // Execute Morgan middleware for standard HTTP request logging
    // Morgan will stream its output through Winston via the configured stream
    morganMiddleware(req, res, function(err) {
      if (err) {
        // Handle Morgan middleware errors by logging through Winston
        logger.error('Morgan middleware error', {
          error: err.message,
          stack: err.stack,
          requestId: req.requestId,
          requestUrl: req.url,
          requestMethod: req.method,
          category: 'middleware_error'
        });
      }
      
      // Continue to next middleware in the Express.js pipeline
      next(err);
    });
  };
}

/**
 * Map HTTP Status Codes to Winston Log Levels
 * 
 * Provides intelligent log level mapping based on HTTP response status codes
 * to ensure appropriate log severity for different response types. This enables
 * more effective log filtering and monitoring by categorizing responses based
 * on their operational significance.
 * 
 * @param {number} statusCode - HTTP response status code
 * @returns {string} Winston log level ('info', 'warn', 'error')
 */
function getLogLevelForStatus(statusCode) {
  if (statusCode >= 500) {
    // 5xx: Server errors - these indicate application problems
    return 'error';
  } else if (statusCode >= 400) {
    // 4xx: Client errors - these indicate invalid requests but not server issues
    return 'warn';
  } else {
    // 1xx, 2xx, 3xx: Informational, success, and redirection - normal operation
    return 'info';
  }
}

/**
 * Export Logger Middleware Function
 * 
 * The exported function creates Express.js middleware that integrates Morgan
 * HTTP request logging with Winston application logging. When called, it returns
 * a middleware function that automatically logs all HTTP requests through the
 * unified Winston transport system.
 * 
 * Integration Features:
 * - Winston stream adapter for Morgan output integration
 * - Environment-specific logging formats and behaviors
 * - Request correlation for distributed tracing capabilities
 * - Status code-based log level mapping for intelligent monitoring
 * - Comprehensive request metadata capture and structured logging
 * - Error handling for middleware failures and request processing issues
 * - Support for log rotation, retention, and external log aggregation
 * 
 * The middleware respects all Winston configuration including:
 * - Log levels (debug, info, warn, error)
 * - Transport configuration (console, file, rotation)
 * - Output formats (JSON for production, colorized for development)
 * - Environment-specific settings and log retention policies
 */
module.exports = loggerMiddleware;