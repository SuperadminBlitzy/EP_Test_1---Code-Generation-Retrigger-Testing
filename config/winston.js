/**
 * Winston Logger Configuration
 * 
 * This module configures Winston logger with environment-specific transports,
 * formatting, and log levels for comprehensive application logging. Provides
 * structured JSON logging for production environments and colorized console
 * output for development with automated log rotation and retention policies.
 * 
 * Features:
 * - Multi-transport configuration (console, file, daily rotation)
 * - Environment-specific log levels (debug for development, info for production)
 * - JSON structured formatting for production log aggregation
 * - Colorized console output for development debugging
 * - Daily log rotation with 14-day retention policy
 * - Separate error log file for error-level events
 * - Error stack trace capture and formatting
 * - Metadata support for contextual logging
 * - Integration with Morgan HTTP request logging
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('./index');

/**
 * Custom format for development console output
 * Provides colorized, readable formatting with timestamps and metadata
 */
const developmentFormat = winston.format.combine(
  winston.format.timestamp({
    format: config.logging.dateFormat
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, stack, ...meta } = info;
    
    // Handle error objects with stack traces
    if (stack) {
      return `${timestamp} [${level}]: ${message}\n${stack}`;
    }
    
    // Include metadata if present
    const metaString = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaString}`;
  })
);

/**
 * Production format for structured JSON logging
 * Enables programmatic log analysis and external log aggregation
 */
const productionFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' // ISO 8601 format for UTC timestamps
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Ensure consistent JSON structure with service identification
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: 'hello-world-app',
      environment: config.nodeEnv,
      ...info
    };
    
    // Clean up duplicate fields
    delete logEntry.timestamp;
    delete logEntry.level;
    delete logEntry.message;
    
    return JSON.stringify({
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      ...logEntry
    });
  })
);

/**
 * Configure Winston transports based on environment and configuration
 */
const transports = [];

/**
 * Console Transport Configuration
 * Always enabled for immediate visibility during development and debugging
 */
if (config.logging.enableConsoleLogging) {
  transports.push(new winston.transports.Console({
    level: config.logging.level,
    format: config.nodeEnv === 'production' ? productionFormat : developmentFormat,
    handleExceptions: true,
    handleRejections: true,
    silent: false
  }));
}

/**
 * File Transport Configuration for Production
 * Implements daily rotation with retention policies for persistent logging
 */
if (config.logging.enableFileLogging) {
  // Ensure logs directory exists and resolve absolute path
  const logsDirectory = path.resolve(process.cwd(), config.logging.directory);
  
  // Combined application logs (info level and above)
  transports.push(new DailyRotateFile({
    level: 'info',
    filename: path.join(logsDirectory, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: productionFormat,
    handleExceptions: true,
    handleRejections: true,
    maxSize: config.logging.maxSize,
    maxFiles: `${config.logging.maxFiles}d`, // 14 days retention
    createSymlink: true,
    symlinkName: 'app.log',
    zippedArchive: true,
    auditFile: path.join(logsDirectory, 'app-audit.json')
  }));
  
  // Separate error log file (error level only)
  transports.push(new DailyRotateFile({
    level: 'error',
    filename: path.join(logsDirectory, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    format: productionFormat,
    handleExceptions: true,
    handleRejections: true,
    maxSize: config.logging.maxSize,
    maxFiles: `${config.logging.maxFiles}d`, // 14 days retention
    createSymlink: true,
    symlinkName: 'error.log',
    zippedArchive: true,
    auditFile: path.join(logsDirectory, 'error-audit.json')
  }));
}

/**
 * Winston Logger Configuration Object
 * 
 * Exports complete Winston configuration with:
 * - Environment-specific transports (console + file rotation)
 * - Structured formatting for production log aggregation  
 * - Error handling for uncaught exceptions and promise rejections
 * - Log level management through environment configuration
 * - Silent mode control for testing environments
 */
const winstonConfig = {
  // Log level from environment configuration
  level: config.logging.level,
  
  // Format configuration (transport-specific formats applied individually)
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ 
      fillExcept: ['message', 'level', 'timestamp'] 
    })
  ),
  
  // Transport configuration array
  transports: transports,
  
  // Global exception handling
  exceptionHandlers: transports,
  rejectionHandlers: transports,
  
  // Prevent Winston from exiting on uncaught exceptions
  // Allow application-level error handling to manage process lifecycle
  exitOnError: false,
  
  // Silent mode configuration (can be overridden by environment)
  silent: config.nodeEnv === 'test' || process.env.WINSTON_SILENT === 'true'
};

/**
 * Development environment logging
 * Log Winston configuration details for debugging
 */
if (config.nodeEnv === 'development') {
  console.log('Winston Logger Configuration:');
  console.log(`- Log Level: ${config.logging.level}`);
  console.log(`- Console Logging: ${config.logging.enableConsoleLogging ? 'enabled' : 'disabled'}`);
  console.log(`- File Logging: ${config.logging.enableFileLogging ? 'enabled' : 'disabled'}`);
  console.log(`- Log Directory: ${config.logging.directory}`);
  console.log(`- Transports: ${transports.length} configured`);
  console.log(`- Format: ${config.logging.format} (${config.nodeEnv} environment)`);
}

/**
 * Production environment validation
 * Ensure critical logging settings are properly configured
 */
if (config.nodeEnv === 'production') {
  if (!config.logging.enableFileLogging) {
    console.warn('Warning: File logging is disabled in production environment');
  }
  
  if (config.logging.level === 'debug') {
    console.warn('Warning: Debug level logging enabled in production environment');
  }
  
  if (transports.length === 0) {
    console.error('Error: No Winston transports configured - logging will be unavailable');
  }
}

// Export Winston configuration object as default export
module.exports = winstonConfig;