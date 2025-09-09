# hao-backprop-test

A **production-ready Express.js application with enterprise-grade features** designed as a test platform for Backprop integration capabilities. This project has evolved from a minimal "Hello, World!" HTTP server into a scalable Express.js platform while preserving backward compatibility.

## 🚀 Features

### Core Capabilities
- **Express.js Framework**: Modern web framework with comprehensive routing and middleware support
- **Production Logging**: Winston application logging with Morgan HTTP request logging
- **Environment Configuration**: dotenv-based configuration management for multiple deployment contexts  
- **Process Management**: PM2 clustering support for production deployment
- **Security Middleware**: CORS, Helmet security headers, and request compression
- **Health Monitoring**: Dedicated health check endpoints for system status
- **Backward Compatibility**: Original "Hello, World!" endpoint preserved at root path

### Enterprise Architecture
- **Modular Design**: Organized code structure with separated concerns
- **Middleware Pipeline**: Comprehensive request processing with error handling
- **Graceful Shutdown**: Proper signal handling for zero-downtime deployments
- **Log Rotation**: Automated log management with structured JSON output
- **Error Handling**: Global error middleware with environment-specific responses

## 📋 Prerequisites

- **Node.js**: >=18.0.0 (for native fetch and modern JavaScript features)
- **npm**: >=8.0.0
- **PM2**: Install globally for production deployment (`npm install -g pm2`)

## 🛠 Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd hao-backprop-test
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment configuration**:
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file with your specific configuration values.

## ⚙️ Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Logging Configuration  
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Security Configuration
CORS_ORIGIN=http://localhost:3000

# PM2 Configuration
PM2_INSTANCES=max
PM2_MAX_MEMORY_RESTART=100M
```

### Environment Files
- `.env` - Default environment variables
- `.env.development` - Development-specific overrides
- `.env.production` - Production-specific overrides
- `.env.example` - Template for required variables

## 📜 Available Scripts

### Development
```bash
# Start development server with auto-restart
npm run dev

# Start server normally  
npm start

# Debug mode with additional logging
npm run debug
```

### Production  
```bash
# Production start with PM2
npm run prod

# PM2 cluster management
npm run pm2:start    # Start PM2 cluster
npm run pm2:stop     # Stop all processes
npm run pm2:restart  # Restart all processes  
npm run pm2:reload   # Zero-downtime reload
npm run pm2:delete   # Delete all processes
npm run pm2:logs     # View logs
npm run pm2:monitor  # Open PM2 monitoring
```

### Maintenance
```bash
# View application logs
npm run logs

# Health check
npm run health

# Clean log files  
npm run clean:logs
```

## 🔌 API Endpoints

### Core Routes

#### Root Endpoint (Backward Compatibility)
```http
GET /
```
**Response**: `Hello, World!`
- Preserves original functionality for existing test workflows
- Maintains compatibility with Backprop evaluation systems

#### Health Check Endpoints
```http
GET /health
```
**Response**: 
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.67,
  "memory": {
    "used": 50.2,
    "total": 100.0
  }
}
```

```http
GET /health/ready  
```
**Response**: Application readiness status

```http
GET /health/live
```
**Response**: Application liveness status

### API Routes
```http
GET /api/status
```
**Response**: Detailed application status information

```http
GET /api/info
```  
**Response**: Application metadata and configuration

### Monitoring Routes
```http
GET /metrics
```
**Response**: Application metrics for monitoring systems

## 🏗 Development Workflow

### Getting Started
1. **Start development server**:
   ```bash
   npm run dev
   ```
   This starts the server with nodemon for automatic restarts on file changes.

2. **Access the application**:
   - Main endpoint: http://localhost:3000
   - Health check: http://localhost:3000/health
   - API status: http://localhost:3000/api/status

### Development Features
- **Auto-restart**: Nodemon automatically restarts the server on code changes
- **Debug logging**: Development mode enables verbose logging
- **Source maps**: Stack traces point to original source code
- **Hot reloading**: Changes reflect immediately without manual restart

### Code Organization
```
hao-backprop-test/
├── server.js                 # Express.js application bootstrap
├── package.json             # Dependencies and scripts
├── .env                     # Environment configuration
├── ecosystem.config.js      # PM2 deployment config
├── routes/                  # Route modules
│   ├── index.js            # Main route aggregator  
│   ├── api.js              # API endpoint routes
│   └── health.js           # Health check endpoints
├── middleware/              # Custom middleware
│   ├── logger.js           # Logging middleware config
│   ├── errorHandler.js     # Global error handling
│   └── validation.js       # Request validation
├── config/                  # Configuration modules
│   ├── index.js            # Configuration loader
│   ├── winston.js          # Winston logger config
│   └── morgan.js           # Morgan HTTP logger config
├── utils/                   # Utility functions
│   └── logger.js           # Logger instance export
└── logs/                    # Log file storage (gitignored)
```

## 📊 Logging and Monitoring

### Logging Architecture
The application implements a dual-logging approach with Winston and Morgan:

#### Winston Application Logging
- **Development**: Console output with colorized formatting
- **Production**: JSON-formatted file logging with rotation
- **Log Levels**: error, warn, info, http, verbose, debug, silly
- **Structured Output**: Consistent JSON format for parsing

#### Morgan HTTP Logging  
- **Request Tracking**: Every HTTP request logged with timing
- **Custom Format**: Includes request ID, method, URL, status, response time
- **Integration**: Morgan output streams to Winston for unified logging
- **Performance Metrics**: Response time and payload size tracking

### Log Configuration
```javascript
// Development logging
LOG_LEVEL=debug
NODE_ENV=development

// Production logging  
LOG_LEVEL=info
NODE_ENV=production
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
```

### Monitoring Endpoints
- `/health` - Overall application health
- `/health/ready` - Kubernetes readiness probe
- `/health/live` - Kubernetes liveness probe  
- `/metrics` - Prometheus-compatible metrics

### Log Analysis
```bash
# View real-time logs
npm run logs

# PM2 log management
pm2 logs hao-backprop-test

# Log file locations
./logs/app.log          # Application logs
./logs/error.log        # Error logs  
./logs/access.log       # HTTP access logs
```

## 🚀 PM2 Production Deployment

### PM2 Configuration
The application includes a complete PM2 ecosystem configuration (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'hao-backprop-test',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

### Deployment Commands
```bash
# Deploy to production
npm run prod

# Manual PM2 management
pm2 start ecosystem.config.js --env production
pm2 stop hao-backprop-test  
pm2 restart hao-backprop-test
pm2 reload hao-backprop-test     # Zero-downtime reload
pm2 delete hao-backprop-test

# Monitoring
pm2 status                       # Process status
pm2 logs hao-backprop-test      # View logs
pm2 monit                       # Real-time monitoring
```

### PM2 Features Enabled
- **Cluster Mode**: Multi-core CPU utilization
- **Auto-restart**: Automatic recovery from crashes  
- **Load Balancing**: Request distribution across workers
- **Zero-downtime Reload**: Graceful updates without service interruption
- **Memory Monitoring**: Automatic restart on memory limits
- **Log Management**: Centralized log collection and rotation

### Production Optimizations
- **Process Clustering**: Utilizes all available CPU cores
- **Memory Management**: Automatic restart at 100MB memory usage
- **Graceful Shutdown**: Proper signal handling (SIGTERM, SIGINT)
- **Health Monitoring**: Process health checks and auto-recovery
- **Log Rotation**: Prevents disk space exhaustion

## ✅ Production Deployment Checklist

### Pre-deployment Setup
- [ ] **Environment Variables**: Configure production `.env` file
- [ ] **Dependencies**: Run `npm install --production`
- [ ] **PM2 Installation**: Install PM2 globally (`npm install -g pm2`)
- [ ] **Log Directory**: Ensure `./logs` directory exists with write permissions
- [ ] **Port Configuration**: Set `PORT` environment variable
- [ ] **Memory Limits**: Configure `PM2_MAX_MEMORY_RESTART`

### Deployment Steps  
1. **Environment Configuration**:
   ```bash
   export NODE_ENV=production
   export PORT=3000
   export LOG_LEVEL=info
   ```

2. **Application Deployment**:
   ```bash
   npm install --production
   npm run prod
   ```

3. **Verification**:
   ```bash
   pm2 status                    # Verify processes running
   curl http://localhost:3000    # Test root endpoint
   curl http://localhost:3000/health  # Test health endpoint
   ```

4. **Monitor Initial Performance**:
   ```bash
   pm2 monit                     # Real-time monitoring
   pm2 logs --lines 50          # Recent log entries
   ```

### Security Configuration
- [ ] **CORS Origins**: Configure allowed origins in `.env`
- [ ] **Security Headers**: Helmet middleware configured
- [ ] **Request Limits**: Body parser limits configured  
- [ ] **Environment Secrets**: Sensitive data in environment variables only
- [ ] **Log Security**: No sensitive data logged in production

### Monitoring Setup
- [ ] **Health Endpoints**: `/health` endpoints responding correctly
- [ ] **Log Rotation**: Winston log rotation configured
- [ ] **PM2 Startup**: Configure PM2 to start on system boot
- [ ] **Process Monitoring**: PM2 monitoring dashboard accessible
- [ ] **Error Alerting**: Error threshold monitoring configured

## 🔧 Troubleshooting

### Common Issues

#### Server Won't Start
**Problem**: Application fails to start
```bash
Error: listen EADDRINUSE :::3000
```
**Solution**: 
- Check if port is already in use: `lsof -i :3000`
- Kill existing process: `kill -9 <PID>`  
- Or change port in `.env`: `PORT=3001`

#### Environment Variables Not Loading
**Problem**: Configuration values not applied
**Solution**:
- Verify `.env` file exists in project root
- Check file permissions: `chmod 644 .env`
- Validate syntax (no spaces around `=`)
- Restart application after changes

#### PM2 Processes Not Starting
**Problem**: PM2 cluster fails to initialize
**Solution**:
- Check PM2 status: `pm2 status`
- Review PM2 logs: `pm2 logs --lines 20`
- Restart PM2: `pm2 kill && pm2 start ecosystem.config.js`
- Verify Node.js version: `node --version` (requires >=18.0.0)

#### Logging Issues
**Problem**: Log files not created or empty
**Solution**:
- Check log directory permissions: `ls -la logs/`
- Create logs directory: `mkdir -p logs`
- Verify LOG_LEVEL in environment: `echo $LOG_LEVEL`
- Check Winston configuration in `/config/winston.js`

#### Memory Issues  
**Problem**: High memory usage or out of memory errors
**Solution**:
- Monitor PM2 processes: `pm2 monit`
- Adjust memory limit: Set `PM2_MAX_MEMORY_RESTART=150M`  
- Check for memory leaks in application code
- Restart processes: `pm2 restart all`

#### Health Check Failures
**Problem**: Health endpoints return errors
**Solution**:
- Test endpoint manually: `curl http://localhost:3000/health`
- Check application logs for errors
- Verify all dependencies are installed
- Restart application services

### Debug Mode
Enable debug logging for detailed troubleshooting:
```bash
export NODE_ENV=development
export LOG_LEVEL=debug
npm start
```

### Log Analysis
View recent logs for error investigation:
```bash
# Application logs
tail -f logs/app.log

# PM2 logs
pm2 logs --lines 100

# Error logs only
pm2 logs --err
```

### Performance Monitoring
Monitor application performance:
```bash
# Real-time monitoring
pm2 monit

# Process statistics
pm2 show hao-backprop-test

# System resources
htop
```

## 🧪 Testing Environment

This project is specifically designed as a **test platform for Backprop integration capabilities**. It provides a controlled environment for evaluating AI-assisted development tools on a production-ready Express.js architecture.

### Key Testing Features
- **Backward Compatibility**: Original "Hello, World!" endpoint preserved
- **Enterprise Patterns**: Production-grade architecture without production complexity
- **Isolated Environment**: No external dependencies or corporate infrastructure
- **Measurable Objectives**: Clear success metrics for tool evaluation

### Backprop Evaluation
The application enables assessment of:
- Express.js framework migration capabilities
- Middleware integration and configuration
- Logging system implementation (Winston/Morgan)
- Environment-based configuration management
- PM2 process management setup
- Security middleware integration

## 📚 Additional Resources

### Documentation
- [Express.js Guide](https://expressjs.com/en/guide/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Winston Logging](https://github.com/winstonjs/winston)
- [Morgan HTTP Logger](https://github.com/expressjs/morgan)

### Configuration References
- [dotenv Documentation](https://github.com/motdotla/dotenv)
- [Node.js Environment Variables](https://nodejs.org/api/process.html#processenv)
- [PM2 Ecosystem File](https://pm2.keymetrics.io/docs/usage/application-declaration/)

## 🤝 Contributing

This project is designed for Backprop integration testing. When making changes:

1. Preserve the original "Hello, World!" endpoint functionality
2. Maintain production-ready architecture patterns
3. Update documentation for any new features
4. Test with both development and production configurations
5. Ensure PM2 deployment compatibility

## 📄 License

This project is designed for testing and evaluation purposes. 
