/**
 * Main Configuration Module
 * 
 * This module serves as the central configuration loader for the Express.js application.
 * It implements twelve-factor app principles by loading configuration from environment
 * variables using dotenv, with support for environment-specific .env files and
 * cascading configuration patterns.
 * 
 * Features:
 * - Environment variable loading with dotenv integration
 * - Default values for all configuration settings
 * - Environment-specific configuration cascading (development -> staging -> production)
 * - Type coercion for numeric and boolean environment variables
 * - Validation for required environment variables
 * - Structured configuration object with logical sections
 */

const dotenv = require('dotenv');
const path = require('path');

// Load environment-specific configuration files with cascading support
// Order of precedence: .env.local > .env.[environment] > .env
const nodeEnv = process.env.NODE_ENV || 'development';

// Load base configuration
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Load environment-specific configuration (overrides base)
const envFiles = [
  `.env.${nodeEnv}`,
  `.env.${nodeEnv}.local`,
  '.env.local'
];

envFiles.forEach(envFile => {
  const envPath = path.resolve(__dirname, '../', envFile);
  dotenv.config({ path: envPath, override: false });
});

/**
 * Type coercion helpers for environment variables
 */
const parseNumber = (value, defaultValue) => {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === '') return defaultValue;
  return value.toLowerCase() === 'true';
};

const parseString = (value, defaultValue) => {
  return value !== undefined && value !== '' ? value : defaultValue;
};

/**
 * Configuration validation helper
 */
const validateRequired = (key, value) => {
  if (value === undefined || value === '') {
    console.warn(`Warning: Required environment variable ${key} is not set, using default value`);
  }
};

// Validate critical environment variables
validateRequired('NODE_ENV', process.env.NODE_ENV);
validateRequired('PORT', process.env.PORT);

/**
 * Main Configuration Object
 * 
 * Organized into logical sections for different aspects of the application:
 * - server: Basic server configuration
 * - logging: Logging system configuration  
 * - database: Database connection settings (prepared for future use)
 * - api: API-specific configuration
 * - cors: Cross-Origin Resource Sharing settings
 * - security: Security middleware configuration
 * - compression: Response compression settings
 */
const config = {
  // Basic server configuration
  port: parseNumber(process.env.PORT, 3000),
  hostname: parseString(process.env.HOSTNAME, '127.0.0.1'),
  
  // Environment configuration
  nodeEnv: parseString(process.env.NODE_ENV, 'development'),
  
  // Logging configuration
  logLevel: parseString(process.env.LOG_LEVEL, nodeEnv === 'production' ? 'info' : 'debug'),
  
  // Server configuration section (extended server settings)
  server: {
    port: parseNumber(process.env.PORT, 3000),
    hostname: parseString(process.env.HOSTNAME, '127.0.0.1'),
    timeout: parseNumber(process.env.SERVER_TIMEOUT, 30000),
    keepAliveTimeout: parseNumber(process.env.KEEP_ALIVE_TIMEOUT, 5000),
    gracefulShutdownTimeout: parseNumber(process.env.GRACEFUL_SHUTDOWN_TIMEOUT, 10000)
  },
  
  // Logging system configuration
  logging: {
    level: parseString(process.env.LOG_LEVEL, nodeEnv === 'production' ? 'info' : 'debug'),
    format: parseString(process.env.LOG_FORMAT, nodeEnv === 'production' ? 'json' : 'simple'),
    dateFormat: parseString(process.env.LOG_DATE_FORMAT, 'YYYY-MM-DD HH:mm:ss'),
    maxSize: parseString(process.env.LOG_MAX_SIZE, '20m'),
    maxFiles: parseNumber(process.env.LOG_MAX_FILES, 5),
    directory: parseString(process.env.LOG_DIRECTORY, 'logs'),
    enableFileLogging: parseBoolean(process.env.ENABLE_FILE_LOGGING, nodeEnv === 'production'),
    enableConsoleLogging: parseBoolean(process.env.ENABLE_CONSOLE_LOGGING, true),
    enableHttpLogging: parseBoolean(process.env.ENABLE_HTTP_LOGGING, true),
    httpLogFormat: parseString(process.env.HTTP_LOG_FORMAT, nodeEnv === 'production' ? 'combined' : 'dev')
  },
  
  // Database configuration (prepared for future use)
  database: {
    url: parseString(process.env.DATABASE_URL, ''),
    host: parseString(process.env.DB_HOST, 'localhost'),
    port: parseNumber(process.env.DB_PORT, 5432),
    name: parseString(process.env.DB_NAME, 'hello_world'),
    username: parseString(process.env.DB_USERNAME, ''),
    password: parseString(process.env.DB_PASSWORD, ''),
    ssl: parseBoolean(process.env.DB_SSL, false),
    poolMin: parseNumber(process.env.DB_POOL_MIN, 2),
    poolMax: parseNumber(process.env.DB_POOL_MAX, 10),
    connectionTimeout: parseNumber(process.env.DB_CONNECTION_TIMEOUT, 60000),
    idleTimeout: parseNumber(process.env.DB_IDLE_TIMEOUT, 30000)
  },
  
  // API configuration
  api: {
    baseUrl: parseString(process.env.API_BASE_URL, '/api'),
    version: parseString(process.env.API_VERSION, 'v1'),
    rateLimit: {
      windowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000), // 15 minutes
      maxRequests: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
      skipSuccessfulRequests: parseBoolean(process.env.RATE_LIMIT_SKIP_SUCCESS, false),
      skipFailedRequests: parseBoolean(process.env.RATE_LIMIT_SKIP_FAILED, false)
    },
    requestTimeout: parseNumber(process.env.API_REQUEST_TIMEOUT, 30000),
    maxPayloadSize: parseString(process.env.API_MAX_PAYLOAD_SIZE, '10mb'),
    enableEtag: parseBoolean(process.env.API_ENABLE_ETAG, true),
    enableTrustProxy: parseBoolean(process.env.API_TRUST_PROXY, false)
  },
  
  // CORS (Cross-Origin Resource Sharing) configuration
  cors: {
    enabled: parseBoolean(process.env.CORS_ENABLED, true),
    origin: parseString(process.env.CORS_ORIGIN, nodeEnv === 'development' ? true : false),
    methods: parseString(process.env.CORS_METHODS, 'GET,HEAD,PUT,PATCH,POST,DELETE'),
    allowedHeaders: parseString(process.env.CORS_ALLOWED_HEADERS, 'Content-Type,Authorization'),
    exposedHeaders: parseString(process.env.CORS_EXPOSED_HEADERS, ''),
    credentials: parseBoolean(process.env.CORS_CREDENTIALS, false),
    maxAge: parseNumber(process.env.CORS_MAX_AGE, 86400), // 24 hours
    preflightContinue: parseBoolean(process.env.CORS_PREFLIGHT_CONTINUE, false),
    optionsSuccessStatus: parseNumber(process.env.CORS_OPTIONS_SUCCESS_STATUS, 204)
  },
  
  // Security configuration (Helmet and other security middleware)
  security: {
    helmet: {
      enabled: parseBoolean(process.env.HELMET_ENABLED, true),
      contentSecurityPolicy: parseBoolean(process.env.HELMET_CSP_ENABLED, nodeEnv === 'production'),
      crossOriginEmbedderPolicy: parseBoolean(process.env.HELMET_COEP_ENABLED, false),
      crossOriginOpenerPolicy: parseBoolean(process.env.HELMET_COOP_ENABLED, true),
      crossOriginResourcePolicy: parseBoolean(process.env.HELMET_CORP_ENABLED, false),
      dnsPrefetchControl: parseBoolean(process.env.HELMET_DNS_PREFETCH_CONTROL, true),
      frameguard: parseBoolean(process.env.HELMET_FRAMEGUARD_ENABLED, true),
      hidePoweredBy: parseBoolean(process.env.HELMET_HIDE_POWERED_BY, true),
      hsts: parseBoolean(process.env.HELMET_HSTS_ENABLED, nodeEnv === 'production'),
      ieNoOpen: parseBoolean(process.env.HELMET_IE_NO_OPEN, true),
      noSniff: parseBoolean(process.env.HELMET_NO_SNIFF, true),
      originAgentCluster: parseBoolean(process.env.HELMET_ORIGIN_AGENT_CLUSTER, true),
      permittedCrossDomainPolicies: parseBoolean(process.env.HELMET_PERMITTED_CROSS_DOMAIN_POLICIES, true),
      referrerPolicy: parseBoolean(process.env.HELMET_REFERRER_POLICY, true),
      xssFilter: parseBoolean(process.env.HELMET_XSS_FILTER, true)
    },
    session: {
      secret: parseString(process.env.SESSION_SECRET, 'your-secret-key-change-in-production'),
      secure: parseBoolean(process.env.SESSION_SECURE, nodeEnv === 'production'),
      httpOnly: parseBoolean(process.env.SESSION_HTTP_ONLY, true),
      maxAge: parseNumber(process.env.SESSION_MAX_AGE, 24 * 60 * 60 * 1000), // 24 hours
      sameSite: parseString(process.env.SESSION_SAME_SITE, 'lax')
    }
  },
  
  // Response compression configuration
  compression: {
    enabled: parseBoolean(process.env.COMPRESSION_ENABLED, true),
    level: parseNumber(process.env.COMPRESSION_LEVEL, 6), // zlib compression level (1-9)
    threshold: parseNumber(process.env.COMPRESSION_THRESHOLD, 1024), // minimum bytes to compress
    chunkSize: parseNumber(process.env.COMPRESSION_CHUNK_SIZE, 16384),
    windowBits: parseNumber(process.env.COMPRESSION_WINDOW_BITS, 15),
    memLevel: parseNumber(process.env.COMPRESSION_MEM_LEVEL, 8),
    strategy: parseNumber(process.env.COMPRESSION_STRATEGY, 0), // Z_DEFAULT_STRATEGY
    filter: parseString(process.env.COMPRESSION_FILTER, '')
  }
};

/**
 * Development environment logging
 * Log configuration details in development mode for debugging
 */
if (config.nodeEnv === 'development') {
  console.log('Configuration loaded for environment:', config.nodeEnv);
  console.log('Server will run on:', `${config.hostname}:${config.port}`);
  console.log('Log level:', config.logLevel);
  console.log('CORS enabled:', config.cors.enabled);
  console.log('Compression enabled:', config.compression.enabled);
  console.log('Security (Helmet) enabled:', config.security.helmet.enabled);
}

/**
 * Production environment validation
 * Ensure critical production settings are configured properly
 */
if (config.nodeEnv === 'production') {
  const productionChecks = [
    { key: 'SESSION_SECRET', value: process.env.SESSION_SECRET, default: config.security.session.secret },
    { key: 'LOG_LEVEL', value: process.env.LOG_LEVEL, default: config.logLevel },
    { key: 'CORS_ORIGIN', value: process.env.CORS_ORIGIN, default: config.cors.origin }
  ];
  
  productionChecks.forEach(check => {
    if (check.value === undefined && check.default.includes('your-secret-key-change-in-production')) {
      console.warn(`Warning: ${check.key} should be set in production environment`);
    }
  });
}

module.exports = config;