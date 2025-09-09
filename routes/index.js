/**
 * Root Route Handler Module
 * 
 * Main route aggregator that exports the root route handler for the Express.js 
 * application. This module maintains backward compatibility by returning the 
 * exact 'Hello, World!' response at the root path while providing the foundation 
 * for additional route expansions.
 * 
 * Key Features:
 * - Maintains exact backward compatibility with original server.js response
 * - Returns 'Hello, World!\n' with status 200 and content-type text/plain
 * - Includes structured logging for route access tracking
 * - Provides modular routing foundation using Express Router
 * - Supports horizontal scaling across PM2 worker processes
 * - Thread-safe stateless design for production deployment
 * 
 * Backward Compatibility:
 * - Original: res.statusCode = 200, res.setHeader('Content-Type', 'text/plain'), res.end('Hello, World!\n')
 * - This module: res.status(200).set('Content-Type', 'text/plain').send('Hello, World!\n')
 * - Identical response output and HTTP headers maintained
 * 
 * Usage:
 *   const rootRoutes = require('./routes/index');
 *   app.use('/', rootRoutes);
 * 
 * Future Expansion:
 *   This router can be extended with additional root-level routes:
 *   - GET /favicon.ico
 *   - GET /robots.txt
 *   - GET /sitemap.xml
 */

const express = require('express');
const logger = require('../utils/logger');

/**
 * Express Router Instance
 * 
 * Creates a new Express Router instance for handling root-level routes.
 * The router provides modular route organization and supports middleware
 * attachment for route-specific processing while maintaining separation
 * of concerns from the main application configuration.
 */
const router = express.Router();

/**
 * Root Route Handler - GET /
 * 
 * Handles HTTP GET requests to the root path ('/') and returns the classic
 * "Hello, World!" response with exact backward compatibility to the original
 * Node.js HTTP server implementation. This endpoint serves as:
 * - Primary compatibility test point for Backprop tool evaluation
 * - Health check endpoint for basic service availability
 * - Default landing page for the application
 * 
 * Request Processing:
 * 1. Log incoming request with structured metadata
 * 2. Set HTTP status code to 200 (OK)
 * 3. Set Content-Type header to 'text/plain' 
 * 4. Send response body 'Hello, World!\n' (includes newline)
 * 
 * Response Format:
 * - Status: 200 OK
 * - Content-Type: text/plain
 * - Body: Hello, World!\n
 * 
 * @param {Object} req - Express request object containing request metadata
 * @param {Object} res - Express response object for sending HTTP response
 */
router.get('/', (req, res) => {
  try {
    // Log route access with structured metadata for monitoring and debugging
    logger.info('Root route accessed successfully', {
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      userAgent: req.get('user-agent'),
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });

    // Set response status and headers for exact backward compatibility
    res.status(200);
    res.set('Content-Type', 'text/plain');
    
    // Send the exact response body including newline character
    // This maintains 100% compatibility with the original server.js implementation
    res.send('Hello, World!\n');
  } catch (error) {
    // Log error with full context for troubleshooting
    logger.error('Error processing root route request', {
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown'
    });

    // Return error response while maintaining expected format
    res.status(500);
    res.set('Content-Type', 'text/plain');
    res.send('Internal Server Error\n');
  }
});

/**
 * Route Handler Documentation
 * 
 * This router instance exposes the following Express Router methods as per schema:
 * - get(): Handles HTTP GET requests with route pattern matching
 * - use(): Attaches middleware functions to the router for request processing  
 * - all(): Handles all HTTP methods for specified route patterns
 * 
 * These methods enable:
 * - Route-specific middleware attachment
 * - HTTP method filtering and routing
 * - Route pattern matching with parameters
 * - Nested router mounting for complex route hierarchies
 * 
 * Thread Safety:
 * - Router instance is stateless and thread-safe
 * - Request handlers do not modify shared state
 * - Compatible with PM2 cluster mode and horizontal scaling
 * - Each worker process operates independently
 */

/**
 * Export Router Instance
 * 
 * Exports the configured Express Router instance as the default export.
 * The router provides access to Express routing methods (get, use, all)
 * as specified in the exports schema, enabling modular route organization
 * and integration with the main Express application.
 * 
 * The exported router maintains:
 * - Backward compatibility with original server behavior
 * - Structured logging integration via Winston
 * - Error handling with graceful degradation
 * - Production-ready performance and reliability
 */
module.exports = router;