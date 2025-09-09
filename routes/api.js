/**
 * API Routes Module
 * 
 * This module implements RESTful API endpoints for the Express.js application,
 * providing structured JSON responses with proper HTTP methods and status codes.
 * The router supports comprehensive API operations including CRUD operations,
 * health monitoring, and integration with validation middleware and logging.
 * 
 * Features:
 * - RESTful API endpoint patterns with proper HTTP method routing
 * - Structured JSON response format with consistent { success, data, message } pattern
 * - Integration with validation middleware for request body, query, and parameter validation
 * - Comprehensive request logging using Winston logger for API access tracking
 * - Proper HTTP status code implementation using http-status-codes constants
 * - UUID generation for new resource creation and request correlation
 * - Error handling that forwards to global error handler middleware
 * - Support for query parameters, request body parsing, and route parameters
 * - Thread-safe, stateless route handlers supporting PM2 clustering
 * - Production-ready placeholder endpoints ready for business logic implementation
 * 
 * Supported Endpoints:
 * - GET /api - API information and version details
 * - GET /api/users - List all users with pagination and filtering support
 * - POST /api/users - Create new user with validation and ID generation
 * - GET /api/users/:id - Retrieve specific user by ID with validation
 * - PUT /api/users/:id - Update existing user with validation and ID verification
 * - DELETE /api/users/:id - Delete user by ID with validation and confirmation
 * - GET /api/health - API health status and metrics
 * 
 * Integration:
 * - Winston Logger: Comprehensive request tracking and error logging
 * - Validation Middleware: Input validation, sanitization, and error handling
 * - HTTP Status Codes: Semantic status code constants for maintainability
 * - UUID Generation: Unique identifier creation for resources and correlation
 * - Express Router: Modular routing with middleware pipeline integration
 */

const express = require('express');
const { StatusCodes } = require('http-status-codes');
const { v4: uuid } = require('uuid');

// Internal dependencies - accessing specified members from schema
const logger = require('../utils/logger');
const { validateBody, validateQuery, validateParams, validateId, validatePagination } = require('../middleware/validation');

/**
 * Create Express Router Instance
 * 
 * Initialize Express Router for API endpoints with modular route organization.
 * The router provides RESTful API capabilities with comprehensive middleware
 * integration and structured response handling.
 */
const router = express.Router();

/**
 * API Information Endpoint
 * 
 * GET /api
 * 
 * Provides general API information, version details, and available endpoints.
 * This endpoint serves as the main API discovery point for clients and
 * monitoring systems to understand API capabilities and current status.
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     name: "Hello World API",
 *     version: "1.0.0",
 *     description: "Production-ready Express.js API with enterprise features",
 *     endpoints: [...],
 *     serverTime: "ISO timestamp",
 *     uptime: "process uptime in seconds"
 *   },
 *   message: "API information retrieved successfully"
 * }
 * 
 * Status Codes:
 * - 200 OK: API information returned successfully
 * - 500 Internal Server Error: Unexpected server error
 */
router.get('/', (req, res, next) => {
  const requestId = req.id || uuid();
  
  try {
    logger.info('API information endpoint accessed', {
      requestId,
      method: req.method,
      path: req.path,
      userAgent: req.get('User-Agent'),
      clientIp: req.ip || req.connection.remoteAddress
    });

    const apiInfo = {
      name: 'Hello World API',
      version: '1.0.0',
      description: 'Production-ready Express.js API with enterprise features',
      endpoints: [
        { method: 'GET', path: '/api', description: 'API information and version details' },
        { method: 'GET', path: '/api/users', description: 'List all users with pagination' },
        { method: 'POST', path: '/api/users', description: 'Create new user' },
        { method: 'GET', path: '/api/users/:id', description: 'Get specific user by ID' },
        { method: 'PUT', path: '/api/users/:id', description: 'Update existing user' },
        { method: 'DELETE', path: '/api/users/:id', description: 'Delete user by ID' },
        { method: 'GET', path: '/api/health', description: 'API health status and metrics' }
      ],
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version
    };

    const response = {
      success: true,
      data: apiInfo,
      message: 'API information retrieved successfully'
    };

    logger.info('API information returned successfully', {
      requestId,
      responseSize: JSON.stringify(response).length,
      endpointCount: apiInfo.endpoints.length
    });

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error in API information endpoint', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path
    });

    next(error);
  }
});

/**
 * List Users Endpoint
 * 
 * GET /api/users
 * 
 * Retrieves a paginated list of users with optional filtering and sorting.
 * Supports query parameters for pagination, search, and result customization.
 * Includes comprehensive parameter validation and structured response format.
 * 
 * Query Parameters:
 * - page: Page number for pagination (default: 1, max: 1000)
 * - limit: Number of results per page (default: 20, max: 100)
 * - sort: Sort field (default: 'createdAt')
 * - order: Sort order ('asc' or 'desc', default: 'asc')
 * - search: Search query for filtering users
 * - filter: Additional filter parameters
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     users: [...],
 *     pagination: {
 *       page: 1,
 *       limit: 20,
 *       total: 100,
 *       totalPages: 5,
 *       hasNext: true,
 *       hasPrev: false
 *     }
 *   },
 *   message: "Users retrieved successfully"
 * }
 * 
 * Status Codes:
 * - 200 OK: Users list returned successfully
 * - 400 Bad Request: Invalid query parameters
 * - 500 Internal Server Error: Unexpected server error
 */
router.get('/users', validatePagination({
  allowedSortFields: ['id', 'name', 'email', 'createdAt', 'updatedAt'],
  defaultSort: 'createdAt',
  maxLimit: 100,
  defaultLimit: 20
}), (req, res, next) => {
  const requestId = req.id || uuid();
  
  try {
    logger.info('Users list endpoint accessed', {
      requestId,
      method: req.method,
      path: req.path,
      queryParams: req.query,
      clientIp: req.ip || req.connection.remoteAddress
    });

    // Extract validated pagination parameters
    const { page = 1, limit = 20, offset = 0, sort = 'createdAt', order = 'asc', search, filter } = req.query;

    // Generate sample users data for demonstration
    const totalUsers = 250;
    const sampleUsers = [];
    const startIndex = offset;
    const endIndex = Math.min(startIndex + limit, totalUsers);

    for (let i = startIndex; i < endIndex; i++) {
      const userId = uuid();
      const user = {
        id: userId,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        status: i % 3 === 0 ? 'inactive' : 'active',
        role: i % 5 === 0 ? 'admin' : 'user',
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Apply search filtering if provided
      if (search) {
        const searchLower = search.toLowerCase();
        if (user.name.toLowerCase().includes(searchLower) || 
            user.email.toLowerCase().includes(searchLower)) {
          sampleUsers.push(user);
        }
      } else {
        sampleUsers.push(user);
      }
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalUsers / limit);
    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      offset: parseInt(offset),
      total: totalUsers,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
      sort,
      order
    };

    const response = {
      success: true,
      data: {
        users: sampleUsers,
        pagination
      },
      message: `Users retrieved successfully. Found ${sampleUsers.length} users.`
    };

    logger.info('Users list returned successfully', {
      requestId,
      userCount: sampleUsers.length,
      totalUsers,
      page,
      limit,
      hasSearch: !!search
    });

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error in users list endpoint', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      queryParams: req.query
    });

    next(error);
  }
});

/**
 * Create User Endpoint
 * 
 * POST /api/users
 * 
 * Creates a new user with the provided data. Validates request body according
 * to user schema requirements and generates unique ID for the new resource.
 * Returns the created user data with proper status code and location header.
 * 
 * Request Body:
 * {
 *   name: "string" (required, 2-100 characters),
 *   email: "string" (required, valid email format),
 *   role: "string" (optional, default: "user"),
 *   status: "string" (optional, default: "active")
 * }
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     name: "John Doe",
 *     email: "john@example.com",
 *     role: "user",
 *     status: "active",
 *     createdAt: "ISO timestamp",
 *     updatedAt: "ISO timestamp"
 *   },
 *   message: "User created successfully"
 * }
 * 
 * Status Codes:
 * - 201 Created: User created successfully
 * - 400 Bad Request: Invalid request body or validation errors
 * - 422 Unprocessable Entity: Business logic validation failed
 * - 500 Internal Server Error: Unexpected server error
 */
router.post('/users', validateBody({
  name: require('joi').string().min(2).max(100).trim().required(),
  email: require('joi').string().email().trim().lowercase().required(),
  role: require('joi').string().valid('admin', 'moderator', 'user').default('user'),
  status: require('joi').string().valid('active', 'inactive', 'pending').default('active')
}), (req, res, next) => {
  const requestId = req.id || uuid();
  
  try {
    logger.info('Create user endpoint accessed', {
      requestId,
      method: req.method,
      path: req.path,
      hasBody: !!req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      clientIp: req.ip || req.connection.remoteAddress
    });

    // Extract validated user data from request body
    const { name, email, role, status } = req.body;
    
    // Generate unique ID for new user
    const userId = uuid();
    const currentTimestamp = new Date().toISOString();
    
    // Create new user object with generated data
    const newUser = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: role || 'user',
      status: status || 'active',
      createdAt: currentTimestamp,
      updatedAt: currentTimestamp,
      metadata: {
        createdBy: 'api',
        source: 'direct_creation',
        requestId
      }
    };

    // Simulate business logic validation
    const existingEmails = ['admin@example.com', 'test@example.com']; // Mock existing emails
    if (existingEmails.includes(newUser.email)) {
      const validationError = {
        type: 'BusinessLogicError',
        message: 'Email address already exists',
        statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
        details: {
          field: 'email',
          value: newUser.email,
          reason: 'duplicate_email'
        }
      };
      
      logger.warn('User creation failed - duplicate email', {
        requestId,
        email: newUser.email,
        error: validationError
      });
      
      return next(validationError);
    }

    const response = {
      success: true,
      data: newUser,
      message: 'User created successfully'
    };

    logger.info('User created successfully', {
      requestId,
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status
    });

    // Set Location header for created resource
    res.location(`/api/users/${userId}`);
    res.status(StatusCodes.CREATED).json(response);

  } catch (error) {
    logger.error('Error in create user endpoint', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      requestBody: req.body
    });

    next(error);
  }
});

/**
 * Get User by ID Endpoint
 * 
 * GET /api/users/:id
 * 
 * Retrieves a specific user by their unique identifier. Validates the ID
 * parameter format and returns detailed user information or appropriate
 * error response if the user is not found.
 * 
 * Route Parameters:
 * - id: User UUID (required, valid UUID format)
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     name: "John Doe",
 *     email: "john@example.com",
 *     role: "user",
 *     status: "active",
 *     createdAt: "ISO timestamp",
 *     updatedAt: "ISO timestamp",
 *     profile: { ... }
 *   },
 *   message: "User retrieved successfully"
 * }
 * 
 * Status Codes:
 * - 200 OK: User found and returned successfully
 * - 400 Bad Request: Invalid ID format
 * - 404 Not Found: User not found with specified ID
 * - 500 Internal Server Error: Unexpected server error
 */
router.get('/users/:id', validateId('id', { type: 'uuid' }), (req, res, next) => {
  const requestId = req.id || uuid();
  
  try {
    logger.info('Get user by ID endpoint accessed', {
      requestId,
      method: req.method,
      path: req.path,
      userId: req.params.id,
      clientIp: req.ip || req.connection.remoteAddress
    });

    const { id } = req.params;
    
    // Simulate user lookup (in real application, this would query a database)
    const mockUsers = {
      '123e4567-e89b-12d3-a456-426614174000': {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        status: 'active',
        createdAt: '2023-01-15T10:30:00.000Z',
        updatedAt: '2023-12-01T14:22:00.000Z',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          avatar: null,
          timezone: 'UTC',
          language: 'en'
        },
        metadata: {
          lastLogin: '2023-12-01T14:20:00.000Z',
          loginCount: 157,
          source: 'registration'
        }
      }
    };

    const user = mockUsers[id];
    
    if (!user) {
      const notFoundError = {
        type: 'ResourceNotFound',
        message: `User not found with ID: ${id}`,
        statusCode: StatusCodes.NOT_FOUND,
        details: {
          resource: 'user',
          id: id,
          requestId
        }
      };
      
      logger.warn('User not found', {
        requestId,
        userId: id,
        error: notFoundError
      });
      
      return next(notFoundError);
    }

    const response = {
      success: true,
      data: user,
      message: 'User retrieved successfully'
    };

    logger.info('User retrieved successfully', {
      requestId,
      userId: user.id,
      userName: user.name,
      userRole: user.role
    });

    res.status(StatusCodes.OK).json(response);

  } catch (error) {
    logger.error('Error in get user by ID endpoint', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path,
      userId: req.params.id
    });

    next(error);
  }
});

/**
 * Update User Endpoint
 * 
 * PUT /api/users/:id
 * 
 * Updates an existing user with the provided data. Validates both the ID
 * parameter and request body, then returns the updated user information.
 * Supports partial updates while maintaining data integrity.
 * 
 * Route Parameters:
 * - id: User UUID (required, valid UUID format)
 * 
 * Request Body:
 * {
 *   name: "string" (optional, 2-100 characters),
 *   email: "string" (optional, valid email format),
 *   role: "string" (optional),
 *   status: "string" (optional)
 * }
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     name: "Updated Name",
 *     email: "updated@example.com",
 *     role: "user",
 *     status: "active",
 *     createdAt: "ISO timestamp",
 *     updatedAt: "ISO timestamp"
 *   },
 *   message: "User updated successfully"
 * }
 * 
 * Status Codes:
 * - 200 OK: User updated successfully
 * - 400 Bad Request: Invalid ID format or request body
 * - 404 Not Found: User not found with specified ID
 * - 422 Unprocessable Entity: Business logic validation failed
 * - 500 Internal Server Error: Unexpected server error
 */
router.put('/users/:id', 
  validateId('id', { type: 'uuid' }),
  validateBody({
    name: require('joi').string().min(2).max(100).trim().optional(),
    email: require('joi').string().email().trim().lowercase().optional(),
    role: require('joi').string().valid('admin', 'moderator', 'user').optional(),
    status: require('joi').string().valid('active', 'inactive', 'pending').optional()
  }),
  (req, res, next) => {
    const requestId = req.id || uuid();
    
    try {
      logger.info('Update user endpoint accessed', {
        requestId,
        method: req.method,
        path: req.path,
        userId: req.params.id,
        updateFields: req.body ? Object.keys(req.body) : [],
        clientIp: req.ip || req.connection.remoteAddress
      });

      const { id } = req.params;
      const updateData = req.body;
      
      // Simulate user lookup
      const existingUser = {
        id: id,
        name: 'Original Name',
        email: 'original@example.com',
        role: 'user',
        status: 'active',
        createdAt: '2023-01-15T10:30:00.000Z',
        updatedAt: '2023-11-01T12:00:00.000Z'
      };

      // Check if user exists
      if (!existingUser && id !== '123e4567-e89b-12d3-a456-426614174000') {
        const notFoundError = {
          type: 'ResourceNotFound',
          message: `User not found with ID: ${id}`,
          statusCode: StatusCodes.NOT_FOUND,
          details: {
            resource: 'user',
            id: id,
            operation: 'update',
            requestId
          }
        };
        
        logger.warn('User not found for update', {
          requestId,
          userId: id,
          error: notFoundError
        });
        
        return next(notFoundError);
      }

      // Merge existing user data with updates
      const updatedUser = {
        ...existingUser,
        ...updateData,
        id: id, // Ensure ID cannot be changed
        updatedAt: new Date().toISOString(),
        metadata: {
          ...existingUser.metadata,
          lastUpdated: new Date().toISOString(),
          updatedBy: 'api',
          requestId
        }
      };

      // Simulate email uniqueness check for email updates
      if (updateData.email && updateData.email !== existingUser.email) {
        const existingEmails = ['admin@example.com', 'test@example.com'];
        if (existingEmails.includes(updateData.email)) {
          const validationError = {
            type: 'BusinessLogicError',
            message: 'Email address already exists',
            statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
            details: {
              field: 'email',
              value: updateData.email,
              reason: 'duplicate_email'
            }
          };
          
          logger.warn('User update failed - duplicate email', {
            requestId,
            userId: id,
            email: updateData.email,
            error: validationError
          });
          
          return next(validationError);
        }
      }

      const response = {
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      };

      logger.info('User updated successfully', {
        requestId,
        userId: updatedUser.id,
        updatedFields: Object.keys(updateData),
        email: updatedUser.email,
        role: updatedUser.role
      });

      res.status(StatusCodes.OK).json(response);

    } catch (error) {
      logger.error('Error in update user endpoint', {
        requestId,
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        userId: req.params.id,
        requestBody: req.body
      });

      next(error);
    }
  }
);

/**
 * Delete User Endpoint
 * 
 * DELETE /api/users/:id
 * 
 * Deletes a user by their unique identifier. Validates the ID parameter
 * and performs soft or hard deletion based on business requirements.
 * Returns confirmation of deletion or appropriate error response.
 * 
 * Route Parameters:
 * - id: User UUID (required, valid UUID format)
 * 
 * Query Parameters:
 * - hard: Boolean flag for hard deletion (optional, default: false)
 * - reason: Deletion reason for audit trail (optional)
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     id: "uuid",
 *     deletedAt: "ISO timestamp",
 *     deletionType: "soft|hard",
 *     reason: "deletion reason"
 *   },
 *   message: "User deleted successfully"
 * }
 * 
 * Status Codes:
 * - 200 OK: User deleted successfully
 * - 400 Bad Request: Invalid ID format
 * - 404 Not Found: User not found with specified ID
 * - 422 Unprocessable Entity: User cannot be deleted due to business rules
 * - 500 Internal Server Error: Unexpected server error
 */
router.delete('/users/:id', 
  validateId('id', { type: 'uuid' }),
  validateQuery({
    hard: require('joi').boolean().default(false).optional(),
    reason: require('joi').string().max(200).trim().optional()
  }),
  (req, res, next) => {
    const requestId = req.id || uuid();
    
    try {
      logger.info('Delete user endpoint accessed', {
        requestId,
        method: req.method,
        path: req.path,
        userId: req.params.id,
        hardDelete: req.query.hard,
        reason: req.query.reason,
        clientIp: req.ip || req.connection.remoteAddress
      });

      const { id } = req.params;
      const { hard = false, reason } = req.query;
      
      // Simulate user lookup
      const existingUser = {
        id: id,
        name: 'User to Delete',
        email: 'delete@example.com',
        role: 'user',
        status: 'active',
        createdAt: '2023-01-15T10:30:00.000Z',
        updatedAt: '2023-11-01T12:00:00.000Z'
      };

      // Check if user exists
      if (!existingUser && id !== '123e4567-e89b-12d3-a456-426614174000') {
        const notFoundError = {
          type: 'ResourceNotFound',
          message: `User not found with ID: ${id}`,
          statusCode: StatusCodes.NOT_FOUND,
          details: {
            resource: 'user',
            id: id,
            operation: 'delete',
            requestId
          }
        };
        
        logger.warn('User not found for deletion', {
          requestId,
          userId: id,
          error: notFoundError
        });
        
        return next(notFoundError);
      }

      // Business logic: prevent deletion of admin users
      if (existingUser.role === 'admin') {
        const businessError = {
          type: 'BusinessLogicError',
          message: 'Admin users cannot be deleted',
          statusCode: StatusCodes.UNPROCESSABLE_ENTITY,
          details: {
            resource: 'user',
            id: id,
            role: existingUser.role,
            reason: 'admin_protection',
            requestId
          }
        };
        
        logger.warn('Admin user deletion blocked', {
          requestId,
          userId: id,
          userRole: existingUser.role,
          error: businessError
        });
        
        return next(businessError);
      }

      // Perform deletion (simulated)
      const deletionResult = {
        id: id,
        deletedAt: new Date().toISOString(),
        deletionType: hard ? 'hard' : 'soft',
        reason: reason || 'No reason provided',
        deletedBy: 'api',
        requestId,
        originalData: hard ? null : existingUser // Keep original data for soft deletes
      };

      const response = {
        success: true,
        data: deletionResult,
        message: `User ${hard ? 'permanently deleted' : 'deleted'} successfully`
      };

      logger.info('User deleted successfully', {
        requestId,
        userId: id,
        deletionType: deletionResult.deletionType,
        reason: deletionResult.reason,
        userName: existingUser.name
      });

      res.status(StatusCodes.OK).json(response);

    } catch (error) {
      logger.error('Error in delete user endpoint', {
        requestId,
        error: error.message,
        stack: error.stack,
        method: req.method,
        path: req.path,
        userId: req.params.id,
        queryParams: req.query
      });

      next(error);
    }
  }
);

/**
 * API Health Check Endpoint
 * 
 * GET /api/health
 * 
 * Provides comprehensive health status information for the API including
 * system metrics, dependency status, and operational indicators. This
 * endpoint is used by load balancers, monitoring systems, and operational
 * tools to assess API availability and performance.
 * 
 * Response Format:
 * {
 *   success: true,
 *   data: {
 *     status: "healthy|degraded|unhealthy",
 *     timestamp: "ISO timestamp",
 *     uptime: "process uptime in seconds",
 *     memory: { ... },
 *     dependencies: { ... },
 *     metrics: { ... }
 *   },
 *   message: "API health check completed"
 * }
 * 
 * Status Codes:
 * - 200 OK: API is healthy and operational
 * - 503 Service Unavailable: API is unhealthy or experiencing issues
 * - 500 Internal Server Error: Health check failed to complete
 */
router.get('/health', (req, res, next) => {
  const requestId = req.id || uuid();
  
  try {
    logger.info('Health check endpoint accessed', {
      requestId,
      method: req.method,
      path: req.path,
      clientIp: req.ip || req.connection.remoteAddress
    });

    // Gather system health metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();
    
    // Simulate dependency health checks (in real application, these would be actual checks)
    const dependencies = {
      database: {
        status: 'healthy',
        responseTime: Math.floor(Math.random() * 50) + 10, // 10-60ms
        lastChecked: new Date().toISOString()
      },
      redis: {
        status: 'healthy', 
        responseTime: Math.floor(Math.random() * 20) + 5, // 5-25ms
        lastChecked: new Date().toISOString()
      },
      externalApi: {
        status: Math.random() > 0.1 ? 'healthy' : 'degraded',
        responseTime: Math.floor(Math.random() * 200) + 100, // 100-300ms
        lastChecked: new Date().toISOString()
      }
    };

    // Determine overall health status
    const unhealthyDeps = Object.values(dependencies).filter(dep => dep.status === 'unhealthy').length;
    const degradedDeps = Object.values(dependencies).filter(dep => dep.status === 'degraded').length;
    
    let overallStatus = 'healthy';
    let httpStatusCode = StatusCodes.OK;
    
    if (unhealthyDeps > 0) {
      overallStatus = 'unhealthy';
      httpStatusCode = StatusCodes.SERVICE_UNAVAILABLE;
    } else if (degradedDeps > 0) {
      overallStatus = 'degraded';
      httpStatusCode = StatusCodes.OK; // Still available but degraded
    }

    // Additional system metrics
    const metrics = {
      requests: {
        total: Math.floor(Math.random() * 10000) + 1000,
        perMinute: Math.floor(Math.random() * 100) + 10,
        errors: Math.floor(Math.random() * 50)
      },
      performance: {
        averageResponseTime: Math.floor(Math.random() * 100) + 50,
        p95ResponseTime: Math.floor(Math.random() * 200) + 100,
        errorRate: (Math.random() * 5).toFixed(2) + '%'
      }
    };

    const healthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: uptime,
        human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      dependencies,
      metrics,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      nodeVersion: process.version
    };

    const response = {
      success: true,
      data: healthData,
      message: `API health check completed - Status: ${overallStatus}`
    };

    logger.info('Health check completed', {
      requestId,
      status: overallStatus,
      dependencyCount: Object.keys(dependencies).length,
      memoryUsedMB: healthData.memory.used,
      uptimeSeconds: Math.floor(uptime)
    });

    res.status(httpStatusCode).json(response);

  } catch (error) {
    logger.error('Error in health check endpoint', {
      requestId,
      error: error.message,
      stack: error.stack,
      method: req.method,
      path: req.path
    });

    // Return unhealthy status if health check itself fails
    const errorResponse = {
      success: false,
      data: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed to complete'
      },
      message: 'Health check error occurred'
    };

    res.status(StatusCodes.SERVICE_UNAVAILABLE).json(errorResponse);
  }
});

/**
 * Router Error Handling Middleware
 * 
 * Catches any errors that occur within this router's route handlers
 * and forwards them to the global error handling middleware. This ensures
 * consistent error processing and logging throughout the API.
 */
router.use((error, req, res, next) => {
  const requestId = req.id || uuid();
  
  logger.error('API router error caught', {
    requestId,
    error: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    statusCode: error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
  });

  // Forward error to global error handler
  next(error);
});

/**
 * Router Request Logging Middleware
 * 
 * Logs all API requests passing through this router for monitoring,
 * debugging, and analytics purposes. Captures essential request
 * metadata without sensitive information.
 */
router.use((req, res, next) => {
  const requestId = req.id || uuid();
  req.id = requestId; // Ensure request ID is available for downstream handlers
  
  logger.debug('API request received', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    clientIp: req.ip || req.connection.remoteAddress,
    timestamp: new Date().toISOString()
  });

  // Continue to next middleware/handler
  next();
});

/**
 * Export Express Router Instance
 * 
 * Exports the configured router as the default export to be mounted
 * at the '/api' path in the main Express application. The router
 * provides all standard Express Router methods for integration with
 * the middleware pipeline and main application routing.
 * 
 * Available Methods (members_exposed):
 * - get: Define GET route handlers
 * - post: Define POST route handlers  
 * - put: Define PUT route handlers
 * - delete: Define DELETE route handlers
 * - use: Mount middleware functions
 * - all: Handle all HTTP methods
 * - param: Parameter preprocessing
 * - route: Create chainable route handlers
 * 
 * The exported router is thread-safe and stateless, supporting
 * horizontal scaling across PM2 worker processes with no
 * synchronization requirements.
 */
module.exports = router;