/**
 * PM2 Ecosystem Configuration
 * Production-grade process management for Express.js Hello World application
 * 
 * This configuration provides:
 * - Multi-environment deployment settings (development, staging, production)
 * - Cluster mode with automatic CPU core utilization
 * - Process monitoring and auto-restart capabilities
 * - Comprehensive logging integration with Winston
 * - Memory management and resource optimization
 * - Zero-downtime deployment support via PM2 reload
 * - Graceful shutdown handling with configurable timeouts
 * - Error recovery strategies with restart limits
 * 
 * Usage:
 * - Start production: pm2 start ecosystem.config.js --env production
 * - Start development: pm2 start ecosystem.config.js --env development
 * - Start staging: pm2 start ecosystem.config.js --env staging
 * - Zero-downtime reload: pm2 reload ecosystem.config.js --env production
 * - Stop all processes: pm2 stop ecosystem.config.js
 * - View status: pm2 status
 * - Monitor processes: pm2 monit
 * - View logs: pm2 logs
 */

module.exports = {
  /**
   * Main application configuration
   * Defines the core process settings and behavior
   */
  apps: [
    {
      // Application identification
      name: 'hello-world-express',
      script: './server.js',
      
      // Cluster configuration for production scalability
      instances: 'max', // Uses all available CPU cores
      exec_mode: 'cluster', // Enable cluster mode for load balancing
      
      // Process management and monitoring
      watch: false, // Disable file watching in production (use pm2 reload for updates)
      ignore_watch: ['node_modules', 'logs', '.git', '.env'], // Files/folders to ignore if watch enabled
      
      // Memory management and restart policies
      max_memory_restart: '100M', // Restart if process exceeds 100MB (per spec requirement)
      restart_delay: 4000, // Wait 4 seconds before restart attempts
      max_restarts: 10, // Maximum restart attempts within reset time window
      min_uptime: '10s', // Minimum uptime to consider restart successful
      
      // Graceful shutdown configuration
      kill_timeout: 10000, // 10 second graceful shutdown timeout (per spec requirement)
      listen_timeout: 3000, // Time to wait for app to be ready after start
      shutdown_with_message: true, // Enable graceful shutdown with SIGTERM
      
      // Logging configuration (integrated with Winston)
      log_type: 'json', // JSON format for structured logging
      merge_logs: true, // Merge cluster worker logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z', // Standardized timestamp format
      
      // Development environment specific settings
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug',
        PM2_SERVE_PATH: './',
        PM2_SERVE_PORT: 8080,
        PM2_SERVE_SPA: 'false',
        PM2_SERVE_HOMEPAGE: '/health'
      },
      
      // Staging environment configuration
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
        LOG_LEVEL: 'info',
        CORS_ORIGIN: 'https://staging.example.com',
        MAX_REQUEST_SIZE: '10mb',
        RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
        RATE_LIMIT_MAX_REQUESTS: 100,
        WINSTON_LOG_LEVEL: 'info',
        MORGAN_FORMAT: 'combined'
      },
      
      // Production environment configuration
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'warn',
        CORS_ORIGIN: 'https://production.example.com',
        MAX_REQUEST_SIZE: '1mb',
        RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
        RATE_LIMIT_MAX_REQUESTS: 50,
        WINSTON_LOG_LEVEL: 'error',
        MORGAN_FORMAT: 'combined',
        
        // Production security and performance settings
        HELMET_ENABLED: 'true',
        COMPRESSION_ENABLED: 'true',
        TRUST_PROXY: 'true',
        
        // Health check configuration
        HEALTH_CHECK_ENABLED: 'true',
        HEALTH_CHECK_ENDPOINT: '/health',
        
        // Log management for production
        LOG_MAX_SIZE: '20m',
        LOG_MAX_FILES: '14d',
        LOG_COMPRESS: 'true'
      },
      
      // Advanced process configuration
      source_map_support: false, // Disable source maps in production for performance
      instance_var: 'INSTANCE_ID', // Environment variable to distinguish cluster instances
      
      // Process monitoring and health checks
      pmx: true, // Enable PM2+ monitoring
      automation: false, // Disable PM2+ automation features for self-managed deployment
      
      // Node.js specific settings
      node_args: [
        '--max-old-space-size=256', // Limit heap size to 256MB per process
        '--enable-source-maps=false' // Disable source maps for production performance
      ],
      
      // Error handling configuration
      error_file: './logs/pm2-error.log', // PM2 error log location
      out_file: './logs/pm2-out.log', // PM2 output log location
      log_file: './logs/pm2-combined.log', // Combined PM2 logs
      
      // Time-based settings
      cron_restart: null, // No scheduled restarts by default
      autorestart: true, // Enable automatic restart on crashes
      
      // Development debugging support
      inspect: false, // Disable Node.js inspector by default
      inspect_port: 9229, // Inspector port for debugging (when enabled)
      
      // Process identification and versioning
      version: '1.0.0',
      vizion: true, // Enable git-based versioning information
      
      // Interpreter settings
      interpreter: 'node', // Use Node.js interpreter
      interpreter_args: '--harmony', // Enable Node.js harmony features
      
      // Working directory
      cwd: './', // Set working directory to project root
      
      // Environment file loading (PM2 will load .env automatically)
      env_file: '.env', // Default environment file
      
      // Process priority and resource limits
      uid: process.getuid ? process.getuid() : undefined, // Run as current user
      gid: process.getgid ? process.getgid() : undefined, // Run as current group
      
      // Startup and shutdown hooks
      post_update: ['npm install', 'echo "Application updated successfully"'],
      pre_deploy: 'echo "Starting deployment process"',
      post_deploy: 'pm2 reload ecosystem.config.js --env production && echo "Deployment completed"'
    }
  ],
  
  /**
   * Deployment configuration for different environments
   * Supports automated deployment workflows and zero-downtime updates
   */
  deploy: {
    // Production deployment configuration
    production: {
      user: 'deploy', // Deployment user
      host: ['production-server'], // Production server hostnames
      ref: 'origin/main', // Git branch for production
      repo: 'git@github.com:username/hello-world-express.git', // Repository URL
      path: '/var/www/hello-world-express', // Deployment path
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'post-setup': 'ls -la && npm install && npm run build:production',
      'pre-setup': 'echo "Setting up production environment"',
      
      // SSH and deployment settings
      ssh_options: 'StrictHostKeyChecking=no',
      key: '~/.ssh/deploy_key', // SSH key for deployment
      
      // Environment variables for deployment
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    
    // Staging deployment configuration  
    staging: {
      user: 'deploy',
      host: ['staging-server'],
      ref: 'origin/develop',
      repo: 'git@github.com:username/hello-world-express.git',
      path: '/var/www/staging/hello-world-express',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      'post-setup': 'ls -la && npm install',
      
      ssh_options: 'StrictHostKeyChecking=no',
      key: '~/.ssh/deploy_key',
      
      env: {
        NODE_ENV: 'staging',
        PORT: 3000
      }
    },
    
    // Development deployment (for shared development servers)
    development: {
      user: 'developer',
      host: ['dev-server'],
      ref: 'origin/develop', 
      repo: 'git@github.com:username/hello-world-express.git',
      path: '/var/www/development/hello-world-express',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env development',
      
      ssh_options: 'StrictHostKeyChecking=no',
      
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        LOG_LEVEL: 'debug'
      }
    }
  }
};