/**
 * Express.js Application Server
 * 
 * This server transforms the original minimal Node.js HTTP server into a
 * production-ready Express.js application with enterprise-grade features
 * including comprehensive middleware pipeline, modular routing architecture,
 * environment configuration, and production deployment capabilities.
 * 
 * Key Features:
 * - Express.js framework with robust routing and middleware support
 * - Environment-based configuration using dotenv
 * - Comprehensive middleware stack: security, CORS, compression, logging
 * - Modular routing architecture with separate route modules
 * - Winston and Morgan logging integration for production monitoring
 * - Graceful shutdown handling for production deployment
 * - PM2 process manager compatibility with cluster mode support
 * - Backward compatibility with original "Hello, World!" endpoint
 */

// Load environment variables first (before other imports)
const dotenv = require('dotenv');
dotenv.config();

// Express framework and middleware imports
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const bodyParser = require('body-parser');

// Internal configuration and utilities
const config = require('./config/index');
const logger = require('./utils/logger');

// Middleware imports
const loggerMiddleware = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

// Route module imports  
const rootRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');

/**
 * Express Application Initialization
 * 
 * Creates Express application instance and configures it with production-ready
 * middleware pipeline, security headers, and routing capabilities while
 * maintaining backward compatibility with the original server functionality.
 */
const app = express();

/**
 * Trust Proxy Configuration
 * 
 * Configure Express to trust reverse proxy headers for accurate client IP
 * detection when deployed behind load balancers or reverse proxies in
 * production environments.
 */
if (config.api && config.api.enableTrustProxy) {
  app.set('trust proxy', 1);
}

/**
 * Security Middleware Configuration
 * 
 * Helmet provides OWASP recommended security headers to protect against
 * common web vulnerabilities including XSS, clickjacking, and MIME sniffing.
 * Configuration is environment-aware with stricter policies in production.
 */
if (config.security && config.security.helmet && config.security.helmet.enabled) {
  app.use(helmet({
    contentSecurityPolicy: config.security.helmet.contentSecurityPolicy,
    crossOriginEmbedderPolicy: config.security.helmet.crossOriginEmbedderPolicy,
    crossOriginOpenerPolicy: config.security.helmet.crossOriginOpenerPolicy,
    crossOriginResourcePolicy: config.security.helmet.crossOriginResourcePolicy,
    dnsPrefetchControl: config.security.helmet.dnsPrefetchControl,
    frameguard: config.security.helmet.frameguard,
    hidePoweredBy: config.security.helmet.hidePoweredBy,
    hsts: config.security.helmet.hsts,
    ieNoOpen: config.security.helmet.ieNoOpen,
    noSniff: config.security.helmet.noSniff,
    originAgentCluster: config.security.helmet.originAgentCluster,
    permittedCrossDomainPolicies: config.security.helmet.permittedCrossDomainPolicies,
    referrerPolicy: config.security.helmet.referrerPolicy,
    xssFilter: config.security.helmet.xssFilter
  }));
} else {
  // Use default Helmet configuration as fallback
  app.use(helmet());
}

/**
 * CORS Middleware Configuration
 * 
 * Cross-Origin Resource Sharing configuration enables API consumption
 * from different origins while maintaining security. Configuration is
 * environment-specific with restrictive policies in production.
 */
if (config.cors && config.cors.enabled) {
  const corsOptions = {
    origin: config.cors.origin,
    methods: config.cors.methods.split(','),
    allowedHeaders: config.cors.allowedHeaders.split(','),
    exposedHeaders: config.cors.exposedHeaders ? config.cors.exposedHeaders.split(',') : [],
    credentials: config.cors.credentials,
    maxAge: config.cors.maxAge,
    preflightContinue: config.cors.preflightContinue,
    optionsSuccessStatus: config.cors.optionsSuccessStatus
  };
  app.use(cors(corsOptions));
} else {
  // Use default CORS configuration as fallback
  app.use(cors());
}

/**
 * Response Compression Middleware
 * 
 * Gzip/deflate compression reduces bandwidth usage and improves response times
 * for JSON, HTML, and other compressible content. Configuration includes
 * compression level, threshold, and algorithm parameters.
 */
if (config.compression && config.compression.enabled) {
  app.use(compression({
    level: config.compression.level,
    threshold: config.compression.threshold,
    chunkSize: config.compression.chunkSize,
    windowBits: config.compression.windowBits,
    memLevel: config.compression.memLevel,
    strategy: config.compression.strategy
  }));
} else {
  // Use default compression as fallback
  app.use(compression());
}

/**
 * Request Body Parsing Middleware
 * 
 * Body parsing middleware supports JSON, URL-encoded, text, and raw payloads
 * with configurable size limits. Essential for API request processing and
 * form data handling.
 */
const maxPayloadSize = config.api ? config.api.maxPayloadSize : '10mb';

// JSON body parsing with size limits
app.use(bodyParser.json({ 
  limit: maxPayloadSize,
  strict: true,
  type: 'application/json'
}));

// URL-encoded form data parsing
app.use(bodyParser.urlencoded({ 
  limit: maxPayloadSize,
  extended: true,
  parameterLimit: 1000
}));

// Text body parsing for plain text requests
app.use(bodyParser.text({ 
  limit: maxPayloadSize,
  type: 'text/plain'
}));

// Raw body parsing for binary data
app.use(bodyParser.raw({ 
  limit: maxPayloadSize,
  type: 'application/octet-stream'
}));

/**
 * HTTP Request Logging Middleware
 * 
 * Morgan and Winston integration provides comprehensive request/response
 * logging for monitoring, debugging, and analytics. Environment-specific
 * formatting ensures appropriate log detail for each deployment environment.
 */
app.use(loggerMiddleware());

/**
 * Route Configuration
 * 
 * Modular routing architecture with separate concerns:
 * - Root routes: Backward compatibility and basic endpoints
 * - API routes: RESTful API endpoints mounted at /api
 * - Health routes: Health checks and monitoring endpoints
 */

// Mount root routes (maintains backward compatibility)
app.use('/', rootRoutes);

// Mount API routes with /api prefix
app.use('/api', apiRoutes);

// Mount health check routes with /health prefix  
app.use('/health', healthRoutes);

/**
 * Global Error Handling Middleware
 * 
 * Centralized error processing with structured JSON responses,
 * environment-specific error disclosure, and Winston logging integration.
 * Must be defined after all routes and middleware to catch errors properly.
 */
app.use(errorHandler);

/**
 * Server Configuration and Startup
 * 
 * Extract server configuration from environment with fallback defaults
 * maintaining backward compatibility with original hardcoded values.
 */
const serverPort = config.port || 3000;
const serverHostname = config.hostname || '127.0.0.1';

/**
 * Server Instance Creation and Startup
 * 
 * Start the Express server with configured port and hostname.
 * Log startup information using Winston logger for production monitoring.
 */
const server = app.listen(serverPort, serverHostname, () => {
  logger.info('Express server started successfully', {
    port: serverPort,
    hostname: serverHostname,
    environment: config.nodeEnv,
    url: `http://${serverHostname}:${serverPort}/`,
    pid: process.pid,
    nodeVersion: process.version,
    logLevel: config.logLevel
  });
  
  // Maintain backward compatibility with original console output
  console.log(`Server running at http://${serverHostname}:${serverPort}/`);
});

/**
 * Server Configuration
 * 
 * Configure server timeouts and keep-alive settings for production deployment.
 * These settings ensure proper connection handling and resource management.
 */
if (config.server) {
  // Set server timeout for request processing
  if (config.server.timeout) {
    server.timeout = config.server.timeout;
  }
  
  // Set keep-alive timeout for connection reuse
  if (config.server.keepAliveTimeout) {
    server.keepAliveTimeout = config.server.keepAliveTimeout;
  }
}

/**
 * Graceful Shutdown Handler
 * 
 * Implement graceful shutdown for production deployment with PM2 process
 * manager compatibility. Handles SIGTERM and SIGINT signals to close
 * connections cleanly and prevent data loss during deployments.
 */
function gracefulShutdown(signal) {
  logger.info('Graceful shutdown initiated', {
    signal: signal,
    pid: process.pid,
    timestamp: new Date().toISOString()
  });
  
  // Close server and stop accepting new connections
  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', {
        error: err.message,
        stack: err.stack,
        signal: signal
      });
      process.exit(1);
    }
    
    logger.info('Server shutdown completed successfully', {
      signal: signal,
      pid: process.pid,
      timestamp: new Date().toISOString()
    });
    
    process.exit(0);
  });
  
  // Force shutdown if graceful shutdown takes too long
  const shutdownTimeout = config.server && config.server.gracefulShutdownTimeout 
    ? config.server.gracefulShutdownTimeout 
    : 10000;
    
  setTimeout(() => {
    logger.warn('Forced shutdown due to timeout', {
      signal: signal,
      timeout: shutdownTimeout,
      pid: process.pid
    });
    process.exit(1);
  }, shutdownTimeout);
}

/**
 * Process Signal Handlers
 * 
 * Register signal handlers for graceful shutdown in production environments.
 * SIGTERM is sent by PM2 and orchestration systems for graceful shutdowns.
 * SIGINT handles Ctrl+C in development environments.
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Unhandled Error Handlers
 * 
 * Catch unhandled promise rejections and uncaught exceptions to prevent
 * application crashes and log errors for debugging. In production, these
 * should be rare due to proper error handling in the application code.
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason,
    promise: promise,
    stack: reason && reason.stack,
    timestamp: new Date().toISOString()
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  // Graceful shutdown after uncaught exception
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
