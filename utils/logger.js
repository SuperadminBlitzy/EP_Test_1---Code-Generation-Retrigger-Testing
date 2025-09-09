/**
 * Winston Logger Instance Export
 * 
 * This module creates and exports a centralized Winston logger instance that
 * provides structured application logging throughout the system. The logger
 * is configured with environment-specific transports (console, file) and 
 * log levels (debug, info, warn, error) for comprehensive production-grade
 * logging capabilities.
 * 
 * Features:
 * - Winston logger instance with full logging interface (info, warn, error, debug, etc.)
 * - Environment-driven configuration through config system
 * - Multiple transport support (console for development, file for production)
 * - Structured JSON logging for production log aggregation
 * - Stream interface for Morgan HTTP request logging integration
 * - Consistent logging format and metadata across the application
 * - Error handling with stack trace capture
 * 
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Application started successfully');
 *   logger.error('Error occurred', { error: err, context: 'server startup' });
 *   logger.debug('Debug information', { user: userId, action: 'login' });
 * 
 * Integration:
 *   - Middleware logging: logger.info('Request processed', { method, url, status });
 *   - Error handling: logger.error('Unhandled error', { error, stack, request });
 *   - Morgan streaming: { stream: { write: (message) => logger.info(message.trim()) } }
 */

const winston = require('winston');
const config = require('../config/index');
const winstonConfig = require('../config/winston');

/**
 * Create Winston Logger Instance
 * 
 * Initializes Winston logger with configuration from winston.js config file.
 * The configuration includes:
 * - Environment-specific log levels (debug in development, info in production)
 * - Multiple transports (console, file rotation, error-specific files) 
 * - Structured JSON formatting for production environments
 * - Colorized console output for development debugging
 * - Exception and rejection handling for comprehensive error capture
 * - Log rotation and retention policies for production deployments
 */
const logger = winston.createLogger(winstonConfig);

/**
 * Development Environment Initialization Logging
 * 
 * Provides immediate feedback about logger initialization in development mode
 * with key configuration details for debugging and verification purposes.
 */
if (config.nodeEnv === 'development') {
  logger.info('Winston logger initialized successfully', {
    logLevel: config.logLevel,
    environment: config.nodeEnv,
    transports: winstonConfig.transports.length,
    fileLoggingEnabled: config.logging.enableFileLogging,
    consoleLoggingEnabled: config.logging.enableConsoleLogging
  });
}

/**
 * Production Environment Validation Logging
 * 
 * Confirms proper logger configuration for production deployment with
 * validation of critical settings and transport configuration.
 */
if (config.nodeEnv === 'production') {
  logger.info('Production logger configured', {
    service: 'hello-world-app',
    environment: config.nodeEnv,
    logLevel: config.logLevel,
    transportsConfigured: winstonConfig.transports.length,
    fileLogging: config.logging.enableFileLogging,
    logDirectory: config.logging.directory,
    maxLogFiles: config.logging.maxFiles,
    logRotationEnabled: true
  });
}

/**
 * Logger Stream Interface for Morgan Integration
 * 
 * Provides a write() method compatible with Morgan HTTP request logging
 * middleware, enabling seamless integration of HTTP request logs with
 * the centralized Winston logging system. This allows HTTP request/response
 * logs to be formatted, transported, and rotated consistently with other
 * application logs.
 * 
 * Usage with Morgan:
 *   app.use(morgan('combined', { stream: logger.stream }));
 */
logger.stream = {
  write: function(message) {
    // Remove trailing newlines that Morgan adds by default
    // Log as info level for HTTP request tracking
    logger.info(message.trim());
  }
};

/**
 * Export Winston Logger Instance
 * 
 * The exported logger provides the complete Winston logging interface:
 * - info(message, meta): Info-level logging for general application events
 * - warn(message, meta): Warning-level logging for potential issues
 * - error(message, meta): Error-level logging for errors and exceptions
 * - debug(message, meta): Debug-level logging for detailed troubleshooting
 * - log(level, message, meta): Generic logging with specified level
 * - verbose(message, meta): Verbose-level logging for detailed information
 * - silly(message, meta): Silly-level logging for maximum detail
 * - stream: Stream interface for Morgan HTTP logging integration
 * 
 * All methods support structured metadata objects for contextual information
 * and are automatically formatted according to environment-specific settings
 * defined in the Winston configuration.
 */
module.exports = logger;