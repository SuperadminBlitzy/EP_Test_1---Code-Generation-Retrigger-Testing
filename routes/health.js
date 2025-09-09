/**
 * Health Check Endpoints Module
 * 
 * This module provides comprehensive health monitoring endpoints for load balancer
 * and monitoring system integration. It implements multiple health check patterns
 * including basic health status, liveness probes, and readiness probes following
 * Kubernetes health check conventions.
 * 
 * Features:
 * - GET /health - Complete system health status with uptime and memory metrics
 * - GET /health/live - Simple liveness probe for basic process verification
 * - GET /health/ready - Readiness probe for dependency and service availability checks
 * - Environment-aware response content (includes NODE_ENV in non-production)
 * - Memory usage statistics for operational monitoring
 * - Structured JSON responses with consistent schema
 * - Integration points for future database and external service health checks
 * 
 * The health endpoints are designed to be stateless and thread-safe, supporting
 * horizontal scaling across PM2 worker processes without shared state dependencies.
 */

const express = require('express');
const { StatusCodes } = require('http-status-codes');
const config = require('../config/index.js');

// Create Express Router instance for modular health check routing
const healthRoutes = express.Router();

/**
 * GET /health
 * 
 * Primary health check endpoint providing comprehensive system status information.
 * Returns detailed health status including process uptime, memory usage, and
 * environment information (in non-production environments).
 * 
 * Response includes:
 * - status: 'healthy' indicator for load balancer integration
 * - uptime: Process uptime in seconds for availability tracking
 * - timestamp: ISO 8601 timestamp for request correlation
 * - memory: Node.js memory usage statistics (RSS, heap used/total, external)
 * - environment: NODE_ENV value (only in development/staging environments)
 * 
 * This endpoint serves as the primary health verification point for monitoring
 * systems and provides operational visibility into system performance.
 */
healthRoutes.get('/', (req, res) => {
  try {
    // Get process uptime in seconds
    const uptime = process.uptime();
    
    // Get current timestamp in ISO 8601 format
    const timestamp = new Date().toISOString();
    
    // Get detailed memory usage statistics
    const memoryUsage = process.memoryUsage();
    
    // Build base health response object
    const healthResponse = {
      status: 'healthy',
      uptime: uptime,
      timestamp: timestamp,
      memory: {
        rss: memoryUsage.rss,                    // Resident Set Size
        heapTotal: memoryUsage.heapTotal,        // Total heap allocated
        heapUsed: memoryUsage.heapUsed,          // Heap actually used
        external: memoryUsage.external,          // External memory usage
        arrayBuffers: memoryUsage.arrayBuffers   // Memory for ArrayBuffers
      }
    };
    
    // Add environment information for non-production environments
    // This provides deployment context for development and staging environments
    // while maintaining security by excluding sensitive environment data in production
    if (config.nodeEnv !== 'production') {
      healthResponse.environment = config.nodeEnv;
    }
    
    // Return successful health status with comprehensive metrics
    res.status(StatusCodes.OK).json(healthResponse);
    
  } catch (error) {
    // Handle any unexpected errors in health check processing
    // Return structured error response with 503 Service Unavailable
    const errorResponse = {
      status: 'unhealthy',
      error: 'Health check processing failed',
      timestamp: new Date().toISOString()
    };
    
    // Log error for debugging (error will be handled by application logging middleware)
    console.error('Health check error:', error.message);
    
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json(errorResponse);
  }
});

/**
 * GET /health/live
 * 
 * Liveness probe endpoint for basic process availability verification.
 * This endpoint follows Kubernetes liveness probe conventions and provides
 * a simple binary health indicator for load balancers and orchestration systems.
 * 
 * Returns minimal response to reduce overhead and latency for frequent
 * health check polling. The successful response indicates the process is
 * running and capable of handling HTTP requests.
 * 
 * Used by:
 * - Load balancers for traffic routing decisions
 * - Kubernetes liveness probes for container restart policies
 * - Monitoring systems for basic availability tracking
 */
healthRoutes.get('/live', (req, res) => {
  try {
    // Simple liveness confirmation with minimal response payload
    // Optimized for high-frequency health check polling
    const liveResponse = {
      status: 'alive',
      timestamp: new Date().toISOString()
    };
    
    res.status(StatusCodes.OK).json(liveResponse);
    
  } catch (error) {
    // Even basic liveness checks can fail due to system resource constraints
    // Return unhealthy status to trigger appropriate recovery actions
    const errorResponse = {
      status: 'dead',
      error: 'Liveness check failed',
      timestamp: new Date().toISOString()
    };
    
    console.error('Liveness check error:', error.message);
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json(errorResponse);
  }
});

/**
 * GET /health/ready
 * 
 * Readiness probe endpoint for dependency and service availability verification.
 * This endpoint checks application readiness to serve traffic by validating
 * critical dependencies and external service connections.
 * 
 * The readiness check verifies:
 * - Basic process functionality (always passing for this implementation)
 * - Database connectivity (prepared for future implementation)
 * - External service availability (prepared for future implementation)
 * - Configuration validity (verified through config.nodeEnv access)
 * 
 * Returns comprehensive readiness status including individual check results
 * and overall readiness determination. Designed to support future expansion
 * with additional dependency checks without breaking existing integrations.
 */
healthRoutes.get('/ready', (req, res) => {
  try {
    // Initialize readiness check results
    const readinessChecks = {
      process: true,      // Process is running (implicit by reaching this code)
      configuration: true, // Configuration loaded successfully (verified by config access)
      // Future expansion points for additional readiness checks:
      // database: false,  // Database connection status (to be implemented)
      // cache: false,     // Cache service availability (to be implemented)
      // storage: false    // File system/storage availability (to be implemented)
    };
    
    // Verify configuration accessibility as readiness indicator
    // This ensures the application configuration is properly loaded
    const configTest = config.nodeEnv !== undefined;
    readinessChecks.configuration = configTest;
    
    // Determine overall readiness based on individual check results
    // All checks must pass for the service to be considered ready
    const isReady = Object.values(readinessChecks).every(check => check === true);
    
    // Build comprehensive readiness response
    const readyResponse = {
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks: readinessChecks
    };
    
    // Add process uptime for readiness context
    readyResponse.uptime = process.uptime();
    
    // Return appropriate HTTP status based on readiness determination
    const statusCode = isReady ? StatusCodes.OK : StatusCodes.SERVICE_UNAVAILABLE;
    res.status(statusCode).json(readyResponse);
    
  } catch (error) {
    // Readiness check failures indicate the service should not receive traffic
    // Return structured error response with specific failure context
    const errorResponse = {
      status: 'not ready',
      error: 'Readiness check processing failed',
      timestamp: new Date().toISOString(),
      checks: {
        process: true,
        configuration: false  // Configuration check failed
      }
    };
    
    console.error('Readiness check error:', error.message);
    res.status(StatusCodes.SERVICE_UNAVAILABLE).json(errorResponse);
  }
});

// Export the health routes router for mounting in the main application
// The router provides all Express Router methods (get, post, put, delete, use, all, param, route)
// as required by the export schema specification
module.exports = healthRoutes;