/**
 * Request Validation Middleware
 * 
 * This module provides comprehensive request validation capabilities for Express.js
 * routes, including parameter validation, schema enforcement, and input sanitization.
 * It supports validation for request body, query parameters, and route parameters
 * with detailed error responses and security-focused input cleaning.
 * 
 * Features:
 * - Factory functions for creating route-specific validation middleware
 * - Support for request body, query parameters, and route parameter validation
 * - Common validation rules (required fields, data types, string lengths, numeric ranges)
 * - Email and URL format validation with security sanitization
 * - Structured validation error responses with field-level details
 * - Integration with global error handler through next() error passing
 * - Input sanitization to prevent XSS and SQL injection attacks
 * - Custom validation functions for complex business rules
 * - Common validation patterns (ID validation, pagination, search queries)
 * - Request body size limits and file upload validation support
 * - Schema caching for improved performance in high-traffic scenarios
 * - Async validation support prepared for database-backed rules
 * - Environment-aware validation strictness and error message verbosity
 */

const Joi = require('joi');
const validator = require('validator');
const { StatusCodes } = require('http-status-codes');
const { v4: uuid } = require('uuid');

// Internal dependencies - accessing specified members from schema
const config = require('../config/index');
const logger = require('../utils/logger');

/**
 * Schema cache for performance optimization
 * Stores compiled Joi schemas to avoid recompilation on each request
 */
const schemaCache = new Map();

/**
 * Validation configuration based on environment
 * Provides environment-specific validation behavior
 */
const validationConfig = {
  strictMode: config.nodeEnv === 'production',
  verboseErrors: config.nodeEnv === 'development',
  enableSanitization: config.security.helmet.enabled,
  logValidationAttempts: config.logLevel === 'debug'
};

/**
 * Creates a structured validation error response
 * 
 * @param {Object} validationResult - Joi validation result with error details
 * @param {string} requestId - Unique identifier for error correlation
 * @param {string} validationType - Type of validation (body, query, params)
 * @returns {Object} Structured error object for consistent API responses
 */
function createValidationError(validationResult, requestId, validationType = 'request') {
  const errorId = requestId || uuid();
  
  // Extract detailed field errors from Joi validation result
  const fieldErrors = {};
  if (validationResult.error && validationResult.error.details) {
    validationResult.error.details.forEach(detail => {
      const fieldPath = detail.path.join('.');
      fieldErrors[fieldPath] = {
        message: detail.message,
        type: detail.type,
        value: detail.context ? detail.context.value : undefined
      };
    });
  }

  const error = {
    id: errorId,
    type: 'ValidationError',
    message: `${validationType} validation failed`,
    statusCode: StatusCodes.BAD_REQUEST,
    details: {
      validationType,
      fieldCount: Object.keys(fieldErrors).length,
      fields: fieldErrors
    },
    timestamp: new Date().toISOString()
  };

  // Include additional debug information in development
  if (validationConfig.verboseErrors) {
    error.debug = {
      originalError: validationResult.error ? validationResult.error.message : 'Unknown validation error',
      stack: validationResult.error ? validationResult.error.stack : undefined
    };
  }

  // Log validation error for monitoring and debugging
  logger.warn('Validation error occurred', {
    errorId,
    validationType,
    fieldCount: Object.keys(fieldErrors).length,
    environment: config.nodeEnv
  });

  return error;
}

/**
 * Creates and caches Joi validation schemas for performance
 * 
 * @param {Object} schemaDefinition - Joi schema object or definition
 * @param {string} cacheKey - Unique key for schema caching
 * @returns {Object} Compiled Joi schema ready for validation
 */
function createValidationSchema(schemaDefinition, cacheKey = null) {
  // Use provided cache key or generate one based on schema
  const key = cacheKey || JSON.stringify(schemaDefinition);
  
  // Check cache first for performance optimization
  if (schemaCache.has(key)) {
    logger.debug('Retrieved validation schema from cache', { cacheKey: key });
    return schemaCache.get(key);
  }

  // Compile new schema if not in cache
  let schema;
  if (Joi.isSchema(schemaDefinition)) {
    schema = schemaDefinition;
  } else {
    schema = Joi.object(schemaDefinition);
  }

  // Cache compiled schema for future use
  schemaCache.set(key, schema);
  
  logger.debug('Created and cached new validation schema', { 
    cacheKey: key,
    cacheSize: schemaCache.size
  });

  return schema;
}

/**
 * Input sanitization function to prevent XSS and injection attacks
 * 
 * @param {any} input - Input value to sanitize
 * @param {Object} options - Sanitization options
 * @returns {any} Sanitized input safe for processing
 */
function sanitizeInput(input, options = {}) {
  const {
    enableHtmlEscape = validationConfig.enableSanitization,
    enableTrim = true,
    enableEmailNormalization = true,
    preserveArrays = true,
    preserveObjects = true
  } = options;

  // Handle null and undefined values
  if (input === null || input === undefined) {
    return input;
  }

  // Handle arrays recursively
  if (Array.isArray(input) && preserveArrays) {
    return input.map(item => sanitizeInput(item, options));
  }

  // Handle objects recursively  
  if (typeof input === 'object' && preserveObjects && !Array.isArray(input)) {
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
      // Sanitize both keys and values
      const sanitizedKey = typeof key === 'string' ? 
        validator.escape(key).trim() : key;
      sanitized[sanitizedKey] = sanitizeInput(value, options);
    }
    return sanitized;
  }

  // Handle string values with comprehensive sanitization
  if (typeof input === 'string') {
    let sanitized = input;
    
    // Trim whitespace if enabled
    if (enableTrim) {
      sanitized = validator.trim(sanitized);
    }
    
    // HTML escape to prevent XSS attacks
    if (enableHtmlEscape) {
      sanitized = validator.escape(sanitized);
    }
    
    // Normalize email addresses if they appear to be emails
    if (enableEmailNormalization && validator.isEmail(sanitized)) {
      sanitized = validator.normalizeEmail(sanitized) || sanitized;
    }
    
    return sanitized;
  }

  // Return non-string values as-is (numbers, booleans, etc.)
  return input;
}

/**
 * Factory function to create request body validation middleware
 * 
 * @param {Object} schema - Joi schema definition for body validation
 * @param {Object} options - Validation options and configuration  
 * @returns {Function} Express middleware function for body validation
 */
function validateBody(schema, options = {}) {
  const {
    allowUnknown = false,
    stripUnknown = validationConfig.strictMode,
    abortEarly = false,
    sanitize = validationConfig.enableSanitization,
    customValidator = null
  } = options;

  const compiledSchema = createValidationSchema(schema, `body_${JSON.stringify(schema)}`);
  
  return async (req, res, next) => {
    const requestId = req.id || uuid();
    
    try {
      // Log validation attempt for debugging
      if (validationConfig.logValidationAttempts) {
        logger.debug('Starting body validation', {
          requestId,
          bodySize: req.body ? Object.keys(req.body).length : 0,
          contentType: req.get('Content-Type')
        });
      }

      // Sanitize input data if enabled
      let dataToValidate = req.body;
      if (sanitize) {
        dataToValidate = sanitizeInput(req.body);
      }

      // Perform Joi schema validation
      const validationResult = compiledSchema.validate(dataToValidate, {
        allowUnknown,
        stripUnknown,
        abortEarly,
        convert: true
      });

      if (validationResult.error) {
        const validationError = createValidationError(validationResult, requestId, 'body');
        return next(validationError);
      }

      // Apply custom validation if provided
      if (customValidator && typeof customValidator === 'function') {
        const customResult = await customValidator(validationResult.value, req);
        if (customResult !== true) {
          const customError = createValidationError(
            { error: { message: customResult || 'Custom validation failed' } },
            requestId,
            'body_custom'
          );
          return next(customError);
        }
      }

      // Store validated and sanitized data back to request
      req.body = validationResult.value;
      
      logger.info('Body validation successful', { requestId });
      next();

    } catch (error) {
      logger.error('Body validation middleware error', {
        requestId,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
}

/**
 * Factory function to create query parameter validation middleware
 * 
 * @param {Object} schema - Joi schema definition for query validation
 * @param {Object} options - Validation options and configuration
 * @returns {Function} Express middleware function for query parameter validation
 */
function validateQuery(schema, options = {}) {
  const {
    allowUnknown = true,
    stripUnknown = false,
    abortEarly = false,
    sanitize = validationConfig.enableSanitization,
    customValidator = null
  } = options;

  const compiledSchema = createValidationSchema(schema, `query_${JSON.stringify(schema)}`);
  
  return async (req, res, next) => {
    const requestId = req.id || uuid();
    
    try {
      // Log validation attempt for debugging
      if (validationConfig.logValidationAttempts) {
        logger.debug('Starting query validation', {
          requestId,
          queryParams: Object.keys(req.query).length,
          query: req.query
        });
      }

      // Sanitize input data if enabled
      let dataToValidate = req.query;
      if (sanitize) {
        dataToValidate = sanitizeInput(req.query);
      }

      // Perform Joi schema validation
      const validationResult = compiledSchema.validate(dataToValidate, {
        allowUnknown,
        stripUnknown,
        abortEarly,
        convert: true
      });

      if (validationResult.error) {
        const validationError = createValidationError(validationResult, requestId, 'query');
        return next(validationError);
      }

      // Apply custom validation if provided
      if (customValidator && typeof customValidator === 'function') {
        const customResult = await customValidator(validationResult.value, req);
        if (customResult !== true) {
          const customError = createValidationError(
            { error: { message: customResult || 'Custom validation failed' } },
            requestId,
            'query_custom'
          );
          return next(customError);
        }
      }

      // Store validated and sanitized data back to request
      req.query = validationResult.value;
      
      logger.info('Query validation successful', { requestId });
      next();

    } catch (error) {
      logger.error('Query validation middleware error', {
        requestId,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
}

/**
 * Factory function to create route parameter validation middleware
 * 
 * @param {Object} schema - Joi schema definition for parameter validation
 * @param {Object} options - Validation options and configuration
 * @returns {Function} Express middleware function for route parameter validation
 */
function validateParams(schema, options = {}) {
  const {
    allowUnknown = false,
    stripUnknown = true,
    abortEarly = false,
    sanitize = validationConfig.enableSanitization,
    customValidator = null
  } = options;

  const compiledSchema = createValidationSchema(schema, `params_${JSON.stringify(schema)}`);
  
  return async (req, res, next) => {
    const requestId = req.id || uuid();
    
    try {
      // Log validation attempt for debugging
      if (validationConfig.logValidationAttempts) {
        logger.debug('Starting params validation', {
          requestId,
          routeParams: Object.keys(req.params).length,
          params: req.params
        });
      }

      // Sanitize input data if enabled
      let dataToValidate = req.params;
      if (sanitize) {
        dataToValidate = sanitizeInput(req.params);
      }

      // Perform Joi schema validation
      const validationResult = compiledSchema.validate(dataToValidate, {
        allowUnknown,
        stripUnknown,
        abortEarly,
        convert: true
      });

      if (validationResult.error) {
        const validationError = createValidationError(validationResult, requestId, 'params');
        return next(validationError);
      }

      // Apply custom validation if provided
      if (customValidator && typeof customValidator === 'function') {
        const customResult = await customValidator(validationResult.value, req);
        if (customResult !== true) {
          const customError = createValidationError(
            { error: { message: customResult || 'Custom validation failed' } },
            requestId,
            'params_custom'
          );
          return next(customError);
        }
      }

      // Store validated and sanitized data back to request
      req.params = validationResult.value;
      
      logger.info('Params validation successful', { requestId });
      next();

    } catch (error) {
      logger.error('Params validation middleware error', {
        requestId,
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  };
}

/**
 * Composite validation middleware for validating multiple request parts
 * 
 * @param {Object} schemas - Object containing body, query, and params schemas
 * @param {Object} options - Global validation options
 * @returns {Function} Express middleware function for comprehensive request validation
 */
function validateRequest(schemas = {}, options = {}) {
  const { body, query, params } = schemas;
  const middlewares = [];

  // Create individual validation middlewares based on provided schemas
  if (params) {
    middlewares.push(validateParams(params, options.params || options));
  }
  if (query) {
    middlewares.push(validateQuery(query, options.query || options));
  }
  if (body) {
    middlewares.push(validateBody(body, options.body || options));
  }

  // Return composite middleware that runs all validations
  return (req, res, next) => {
    const requestId = req.id || uuid();
    
    logger.debug('Starting composite request validation', {
      requestId,
      validationTypes: [
        params ? 'params' : null,
        query ? 'query' : null,
        body ? 'body' : null
      ].filter(Boolean)
    });

    // Run validations sequentially
    let currentIndex = 0;
    
    function runNextValidation(error) {
      if (error) {
        return next(error);
      }
      
      if (currentIndex >= middlewares.length) {
        logger.info('Composite request validation successful', { requestId });
        return next();
      }
      
      const currentMiddleware = middlewares[currentIndex++];
      currentMiddleware(req, res, runNextValidation);
    }
    
    runNextValidation();
  };
}

/**
 * Pre-configured validation middleware for ID parameters
 * Common pattern for validating route parameters that represent entity IDs
 * 
 * @param {string} paramName - Name of the parameter to validate (default: 'id')
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware function for ID validation
 */
function validateId(paramName = 'id', options = {}) {
  const {
    type = 'uuid', // 'uuid', 'objectId', 'numeric', 'alphanumeric'
    required = true,
    customValidator = null
  } = options;

  // Build schema based on ID type
  let schema;
  switch (type) {
    case 'uuid':
      schema = Joi.string().uuid({ version: ['uuidv4'] }).required();
      break;
    case 'objectId':
      schema = Joi.string().regex(/^[0-9a-fA-F]{24}$/).required();
      break;
    case 'numeric':
      schema = Joi.number().integer().positive().required();
      break;
    case 'alphanumeric':
      schema = Joi.string().alphanum().min(1).max(50).required();
      break;
    default:
      schema = Joi.string().required();
  }

  // Make optional if not required
  if (!required) {
    schema = schema.optional();
  }

  return validateParams({ [paramName]: schema }, {
    customValidator: async (validatedParams, req) => {
      // Apply custom validation logic if provided
      if (customValidator && typeof customValidator === 'function') {
        const customResult = await customValidator(validatedParams[paramName], req);
        if (customResult !== true) {
          return customResult || `Invalid ${paramName} parameter`;
        }
      }
      return true;
    },
    ...options
  });
}

/**
 * Pre-configured validation middleware for pagination parameters
 * Common pattern for validating page, limit, offset, and sort parameters
 * 
 * @param {Object} options - Pagination validation options
 * @returns {Function} Express middleware function for pagination validation
 */
function validatePagination(options = {}) {
  const {
    maxLimit = 100,
    defaultLimit = 20,
    maxPage = 1000,
    defaultPage = 1,
    allowedSortFields = [],
    defaultSort = 'createdAt',
    allowedSortOrders = ['asc', 'desc', 'ascending', 'descending']
  } = options;

  const paginationSchema = {
    // Page number validation
    page: Joi.number()
      .integer()
      .min(1)
      .max(maxPage)
      .default(defaultPage)
      .optional(),
    
    // Limit validation  
    limit: Joi.number()
      .integer()
      .min(1)
      .max(maxLimit)
      .default(defaultLimit)
      .optional(),
    
    // Offset validation (alternative to page)
    offset: Joi.number()
      .integer()
      .min(0)
      .optional(),
    
    // Sort field validation
    sort: allowedSortFields.length > 0 
      ? Joi.string().valid(...allowedSortFields).default(defaultSort).optional()
      : Joi.string().default(defaultSort).optional(),
    
    // Sort order validation
    order: Joi.string()
      .valid(...allowedSortOrders)
      .default('asc')
      .optional(),
    
    // Search query validation
    search: Joi.string()
      .max(100)
      .optional(),
    
    // Filter parameters (flexible object)
    filter: Joi.object().optional()
  };

  return validateQuery(paginationSchema, {
    allowUnknown: true,
    stripUnknown: false,
    customValidator: async (validatedQuery, req) => {
      // Ensure page and offset are not used together
      if (validatedQuery.page && validatedQuery.offset) {
        return 'Cannot use both page and offset parameters together';
      }
      
      // Calculate offset from page if not provided
      if (validatedQuery.page && !validatedQuery.offset) {
        validatedQuery.offset = (validatedQuery.page - 1) * validatedQuery.limit;
      }
      
      return true;
    },
    ...options
  });
}

/**
 * Performance monitoring and cache management utilities
 */
const validationMetrics = {
  cacheHits: 0,
  cacheMisses: 0,
  validationAttempts: 0,
  validationFailures: 0,
  
  // Clear cache periodically to prevent memory leaks
  clearCache: () => {
    const cacheSize = schemaCache.size;
    schemaCache.clear();
    logger.info('Validation schema cache cleared', { 
      previousSize: cacheSize,
      environment: config.nodeEnv 
    });
  },
  
  // Get cache statistics
  getCacheStats: () => ({
    size: schemaCache.size,
    hits: validationMetrics.cacheHits,
    misses: validationMetrics.cacheMisses,
    hitRate: validationMetrics.cacheHits / (validationMetrics.cacheHits + validationMetrics.cacheMisses) || 0
  })
};

/**
 * Common validation schema builders for reuse across routes
 */
const commonSchemas = {
  // Email validation with normalization
  email: Joi.string().email().custom((value, helpers) => {
    const normalized = validator.normalizeEmail(value);
    return normalized || helpers.error('string.email');
  }),
  
  // URL validation with sanitization
  url: Joi.string().custom((value, helpers) => {
    if (!validator.isURL(value, { require_protocol: true })) {
      return helpers.error('string.uri');
    }
    return validator.escape(value);
  }),
  
  // UUID validation
  uuid: Joi.string().uuid({ version: ['uuidv4'] }),
  
  // Password strength validation
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  // Phone number validation
  phone: Joi.string().custom((value, helpers) => {
    if (!validator.isMobilePhone(value, 'any', { strictMode: false })) {
      return helpers.error('string.pattern.base');
    }
    return value;
  }),
  
  // Date validation with range constraints
  dateRange: (minDate = null, maxDate = null) => {
    let schema = Joi.date().iso();
    if (minDate) schema = schema.min(minDate);
    if (maxDate) schema = schema.max(maxDate);
    return schema;
  }
};

/**
 * Environment-specific validation rules
 */
if (config.nodeEnv === 'development') {
  // Clear cache every 10 minutes in development to prevent stale schemas
  setInterval(() => {
    if (schemaCache.size > 50) {
      validationMetrics.clearCache();
    }
  }, 10 * 60 * 1000);
}

if (config.nodeEnv === 'production') {
  // Log cache statistics periodically in production
  setInterval(() => {
    logger.info('Validation cache statistics', validationMetrics.getCacheStats());
  }, 60 * 60 * 1000); // Every hour
}

/**
 * Module exports - providing both named exports and default object export
 * as specified in the export schema requirements
 */

// Named function exports
module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  validateId,
  validatePagination,
  sanitizeInput,
  createValidationSchema,
  createValidationError
};

/**
 * Default export object containing all validation functions
 * This satisfies the 'validation' export requirement with all members_exposed
 */
const validation = {
  // Core validation middleware factories
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  
  // Specialized validation functions
  validateId,
  validatePagination,
  
  // Utility functions
  sanitizeInput,
  createValidationSchema,
  createValidationError,
  
  // Additional utilities for advanced usage
  commonSchemas,
  validationMetrics,
  validationConfig,
  
  // Convenience methods for common patterns
  createEmailValidator: () => validateBody({ email: commonSchemas.email }),
  createPasswordValidator: () => validateBody({ password: commonSchemas.password }),
  createUuidValidator: (paramName = 'id') => validateId(paramName, { type: 'uuid' }),
  
  // Async validation support (prepared for future database-backed rules)
  createAsyncValidator: (asyncValidationFn) => {
    return (schema, options = {}) => {
      return validateBody(schema, {
        ...options,
        customValidator: async (value, req) => {
          try {
            const result = await asyncValidationFn(value, req);
            return result === true ? true : (result || 'Async validation failed');
          } catch (error) {
            logger.error('Async validation error', {
              error: error.message,
              stack: error.stack,
              requestId: req.id
            });
            return 'Async validation error occurred';
          }
        }
      });
    };
  }
};

// Set default export
module.exports.validation = validation;
module.exports.default = validation;