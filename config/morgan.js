/**
 * Morgan HTTP Logger Configuration Module
 * 
 * This module provides Morgan HTTP request/response logging middleware setup
 * with comprehensive integration with Winston for centralized logging. The
 * configuration supports environment-specific formats and comprehensive
 * request tracking for monitoring and debugging purposes.
 * 
 * Features:
 * - Environment-specific logging formats (dev for development, combined for production)
 * - Winston stream integration for centralized log management
 * - Custom tokens for additional request metadata (request ID, timing metrics)
 * - Skip function to optionally exclude certain routes from logging
 * - JSON format output for production structured log analysis
 * - Request timing metrics for performance monitoring
 * - Comprehensive HTTP request/response tracking with status codes and user agents
 * 
 * Integration:
 * - Works seamlessly with Winston logger instance from utils/logger.js
 * - Respects environment configuration from config/index.js
 * - Provides middleware ready for Express.js application integration
 * 
 * Usage:
 *   const morganConfig = require('./config/morgan');
 *   app.use(morganConfig());
 */

const morgan = require('morgan');
const config = require('./index');
const logger = require('../utils/logger');

/**
 * Custom Morgan Tokens for Enhanced Request Metadata
 * 
 * Defines custom tokens to extend Morgan's built-in logging capabilities
 * with additional request metadata for comprehensive monitoring and debugging.
 */

// Request ID token for distributed tracing and request correlation
morgan.token('request-id', function (req, res) {
  // Generate unique request ID if not already present from upstream middleware
  if (!req.requestId) {
    req.requestId = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
  return req.requestId;
});

// Extended user agent token for detailed client identification
morgan.token('user-agent-extended', function (req, res) {
  const userAgent = req.get('User-Agent');
  return userAgent || 'Unknown';
});

// Response time with millisecond precision for performance monitoring
morgan.token('response-time-ms', function (req, res) {
  if (!req._startAt || !res._startAt) {
    return '-';
  }
  
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
             (res._startAt[1] - req._startAt[1]) * 1e-6;
  return Math.round(ms * 100) / 100 + 'ms';
});

// Content length with fallback for missing content-length headers
morgan.token('content-length-safe', function (req, res) {
  const length = res.get('Content-Length');
  return length || '0';
});

// Request timestamp in ISO format for precise time correlation
morgan.token('timestamp-iso', function (req, res) {
  return new Date().toISOString();
});

/**
 * Custom Morgan Format Definitions
 * 
 * Defines custom logging formats for different environments and use cases,
 * providing structured output suitable for both human reading and automated analysis.
 */

// Production JSON format for structured log analysis and external aggregation
const productionJsonFormat = JSON.stringify({
  timestamp: ':timestamp-iso',
  requestId: ':request-id',
  method: ':method',
  url: ':url',
  httpVersion: ':http-version',
  status: ':status',
  contentLength: ':content-length-safe',
  responseTime: ':response-time-ms',
  userAgent: ':user-agent-extended',
  remoteAddr: ':remote-addr',
  remoteUser: ':remote-user',
  referrer: ':referrer'
});

// Development extended format with enhanced readability and debugging information  
const developmentExtendedFormat = ':timestamp-iso [:request-id] :method :url HTTP/:http-version :status :content-length-safe - :response-time-ms ":user-agent-extended"';

/**
 * Morgan HTTP Logger Configuration Function
 * 
 * Creates and returns configured Morgan middleware based on environment settings
 * with Winston stream integration for unified logging. Supports development-friendly
 * colorized output and production-ready structured logging with custom tokens
 * for enhanced request metadata and performance monitoring.
 * 
 * @returns {Function} Configured Morgan middleware for Express.js
 */
function morganConfig() {
  // Determine logging format based on environment with custom format support
  let format;
  
  if (config.nodeEnv === 'production') {
    // Production: Use structured JSON format for log aggregation and analysis
    format = productionJsonFormat;
  } else if (config.nodeEnv === 'development') {
    // Development: Use colorized 'dev' format for immediate readability
    // but fallback to extended format if JSON parsing is preferred
    format = config.logLevel === 'debug' ? developmentExtendedFormat : 'dev';
  } else {
    // Staging/testing: Use combined format for comprehensive logging
    format = 'combined';
  }
  
  // Morgan middleware configuration options
  const options = {
    // Winston stream integration for centralized logging
    // Directs Morgan output through Winston transports (console, file, etc.)
    stream: logger.stream,
    
    // Skip function to optionally exclude certain routes from HTTP logging
    // Reduces log noise while preserving important request tracking
    skip: function (req, res) {
      // Skip health check endpoints in production to reduce log volume
      if (config.nodeEnv === 'production' && req.url === '/health') {
        return true;
      }
      
      // Skip static asset requests (images, CSS, JS) in all environments
      // to focus on application logic and API endpoints
      const staticExtensions = /\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i;
      if (staticExtensions.test(req.url)) {
        return true;
      }
      
      // Skip OPTIONS requests (CORS preflight) unless debug level logging
      if (req.method === 'OPTIONS' && config.logLevel !== 'debug') {
        return true;
      }
      
      return false; // Log all other requests
    },
    
    // Buffer requests for better performance in high-traffic scenarios
    buffer: config.nodeEnv === 'production' ? true : false,
    
    // Immediate logging for development debugging
    immediate: config.nodeEnv === 'development' ? false : false
  };
  
  // Create and return configured Morgan middleware
  // The middleware will log HTTP requests according to the specified format
  // and stream the output through Winston for consistent log management
  const middleware = morgan(format, options);
  
  // Add error handling middleware for failed request logging
  middleware.errorHandler = function(err, req, res, next) {
    logger.error('Morgan logging error', {
      error: err.message,
      stack: err.stack,
      requestUrl: req.url,
      requestMethod: req.method,
      requestId: req.requestId
    });
    next();
  };
  
  return middleware;
}

// Export the configuration function as default export
module.exports = morganConfig;