# Environments Configuration

PixelMorph supports three environments: Development, Staging, and Production.

## Environment Overview

### Development
- **Purpose**: Local development and testing
- **API**: ngrok tunnel to local backend (or local mocks)
- **Database**: Local SQLite + mock Firebase
- **Logging**: Verbose, includes debug info
- **Code**: Source maps enabled
- **Build**: Unoptimized, useful for debugging

### Staging
- **Purpose**: Pre-production testing
- **API**: Staging API endpoint
- **Database**: Staging database + test Firebase project
- **Logging**: Verbose, includes timings
- **Code**: Optimized
- **Build**: Release build with debugging symbols
- **Feature Flags**: All features enabled for testing

### Production
- **Purpose**: End-user app
- **API**: Production API endpoint
- **Database**: Production database + production Firebase
- **Logging**: Error level only
- **Code**: Fully optimized
- **Build**: Release build, stripped of debug info
- **Feature Flags**: Controlled by backend

---

## Environment Variables

### Base URL Configuration

**Development**
```
API_BASE_URL = https://[randomstring].ngrok.io
API_TIMEOUT = 30000ms
```

**Staging**
```
API_BASE_URL = https://staging-api.pixelmorph.com
API_TIMEOUT = 30000ms
```

**Production**
```
API_BASE_URL = https://api.pixelmorph.com
API_TIMEOUT = 30000ms
```

### Firebase Configuration

**Development**
```
FIREBASE_PROJECT_ID = pixelmorph-dev
FIREBASE_API_KEY = [dev-key]
FIREBASE_STORAGE_BUCKET = pixelmorph-dev.appspot.com
```

**Staging**
```
FIREBASE_PROJECT_ID = pixelmorph-staging
FIREBASE_API_KEY = [staging-key]
FIREBASE_STORAGE_BUCKET = pixelmorph-staging.appspot.com
```

**Production**
```
FIREBASE_PROJECT_ID = pixelmorph-prod
FIREBASE_API_KEY = [prod-key]
FIREBASE_STORAGE_BUCKET = pixelmorph-prod.appspot.com
```

### Logging Configuration

**Development**
```
LOG_LEVEL = DEBUG
LOG_FORMAT = detailed (include timestamps, module names)
LOG_OUTPUT = console + file
ENABLE_REMOTE_LOGGING = false
```

**Staging**
```
LOG_LEVEL = INFO
LOG_FORMAT = detailed
LOG_OUTPUT = console + file + remote
ENABLE_REMOTE_LOGGING = true
```

**Production**
```
LOG_LEVEL = ERROR
LOG_FORMAT = minimal
LOG_OUTPUT = remote
ENABLE_REMOTE_LOGGING = true
```

### Feature Flags

**Development**
```
ENABLE_EXPERIMENTAL_360_VIDEO = true
ENABLE_DEBUG_TOOLS = true
ENABLE_PERFORMANCE_MONITOR = true
ENABLE_MOCK_DATA = true (optional)
```

**Staging**
```
ENABLE_EXPERIMENTAL_360_VIDEO = true
ENABLE_DEBUG_TOOLS = false
ENABLE_PERFORMANCE_MONITOR = true
ENABLE_MOCK_DATA = false
```

**Production**
```
ENABLE_EXPERIMENTAL_360_VIDEO = [controlled by backend]
ENABLE_DEBUG_TOOLS = false
ENABLE_PERFORMANCE_MONITOR = false
ENABLE_MOCK_DATA = false
```

---

## Configuration File Structure

### `.env.development`
```
# API Configuration
API_BASE_URL=https://[your-ngrok-url].ngrok.io
API_TIMEOUT=30000

# Firebase
FIREBASE_PROJECT_ID=pixelmorph-dev
FIREBASE_API_KEY=***
FIREBASE_STORAGE_BUCKET=pixelmorph-dev.appspot.com

# Logging
LOG_LEVEL=DEBUG
ENABLE_REMOTE_LOGGING=false

# Features
ENABLE_EXPERIMENTAL_360_VIDEO=true
ENABLE_DEBUG_TOOLS=true
ENABLE_PERFORMANCE_MONITOR=true
```

### `.env.staging`
```
# API Configuration
API_BASE_URL=https://staging-api.pixelmorph.com
API_TIMEOUT=30000

# Firebase
FIREBASE_PROJECT_ID=pixelmorph-staging
FIREBASE_API_KEY=***
FIREBASE_STORAGE_BUCKET=pixelmorph-staging.appspot.com

# Logging
LOG_LEVEL=INFO
ENABLE_REMOTE_LOGGING=true

# Features
ENABLE_EXPERIMENTAL_360_VIDEO=true
ENABLE_DEBUG_TOOLS=false
ENABLE_PERFORMANCE_MONITOR=true
```

### `.env.production`
```
# API Configuration
API_BASE_URL=https://api.pixelmorph.com
API_TIMEOUT=30000

# Firebase
FIREBASE_PROJECT_ID=pixelmorph-prod
FIREBASE_API_KEY=***
FIREBASE_STORAGE_BUCKET=pixelmorph-prod.appspot.com

# Logging
LOG_LEVEL=ERROR
ENABLE_REMOTE_LOGGING=true

# Features
ENABLE_EXPERIMENTAL_360_VIDEO=false
ENABLE_DEBUG_TOOLS=false
ENABLE_PERFORMANCE_MONITOR=false
```

**Important**: 
- ❌ Never commit `.env.*` files with real credentials
- ✅ Use `.env.example` as template
- ✅ Store real credentials in secure management system

---

## ngrok Setup for Development

ngrok allows local development server to be accessible via internet (useful for testing webhooks, API integrations).

### Installation
```bash
npm install -g ngrok
# or download from ngrok.com
```

### Starting ngrok tunnel
```bash
# Forward local port 3000 to public URL
ngrok http 3000

# Output:
# Forwarding                    https://abc123.ngrok.io -> http://localhost:3000
```

### Using ngrok URL
1. Copy the HTTPS URL from ngrok output
2. Update `.env.development`:
   ```
   API_BASE_URL=https://abc123.ngrok.io
   ```
3. Restart the app
4. App will now communicate with your local backend

### ngrok Considerations
- ⚠️ URL changes every time ngrok restarts (unless paid plan)
- ⚠️ Only for development, not for production
- ⚠️ Rate limits on free tier
- ✅ Great for testing webhook callbacks
- ✅ Great for testing with real devices

### Alternative: Local Network Access
```bash
# On Mac/Linux, find your local IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# On Windows
ipconfig | findstr /I "IPv4"

# Use direct IP (192.168.x.x) with port
API_BASE_URL=http://192.168.1.100:3000
```

**Limitation**: Only works on same local network, requires consistent IP.

---

## Build Configuration

### Development Build
```bash
npm run build:dev
# or
npm run dev

# Output:
# - Source maps included
# - Debug symbols included
# - Performance optimization disabled
# - Large bundle size (~60MB)
# - Fast to build
```

### Staging Build
```bash
npm run build:staging

# Output:
# - Source maps included (for remote debugging)
# - Debug symbols included
# - Performance optimization enabled
# - Medium bundle size (~40MB)
# - Release build
```

### Production Build
```bash
npm run build:prod

# Output:
# - Source maps stripped or external
# - Debug symbols stripped
# - Performance optimization enabled
# - Small bundle size (~30MB)
# - Full optimization
```

---

## Testing Across Environments

### Development Environment
- Use ngrok or local network access
- Test with mock data
- Enable all debug features
- Monitor console logs
- Use debug tools

### Staging Environment
- Connect to real staging API
- Use real Firebase staging project
- Test with realistic data
- Monitor performance
- Test feature flags

### Production Environment
- ❌ Never test directly in production with user data
- ✅ Use staging for all testing
- ✅ Manual testing in production only if necessary
- ✅ Rollback plan for production issues

---

## Switching Environments

### Option 1: Build-time Environment
```bash
npm run build:dev    # Development
npm run build:staging # Staging
npm run build:prod   # Production
```

### Option 2: Runtime Environment Selection
```typescript
// src/app/configuration/environment.ts
const ENV = __DEV__ ? 'development' : 'production';

// or use react-native build flavor
import { Platform } from 'react-native';
```

### Option 3: Dynamic Configuration
```typescript
// Load config based on user preference or app build
const config = require(`./config.${ENVIRONMENT}.json`);
```

---

## Firebase Configuration

### Development
- Separate Firebase project
- Mock data pre-loaded
- Full read/write access for testing

### Staging
- Real Firebase project for staging
- Realistic quota limits
- Read/write access for testing team

### Production
- Production Firebase project
- Real quota limits and pricing
- Restricted access, production data only

**Rule**: Never mix environments. Always use correct Firebase project.

---

## API Contract Between App and Backend

The app always communicates via these contracts:

### Base Endpoint
```
GET /api/v1/health
→ { status: "ok", version: "1.0.0" }
```

### Authentication
```
POST /api/v1/auth/login
Body: { email, password }
→ { token, refreshToken, user }
```

### Project Management
```
GET /api/v1/projects
→ { projects: [...], total: N }

POST /api/v1/projects
Body: { name, description }
→ { id, ... }
```

*Full API contract documented separately*

### Error Handling
All errors follow pattern:
```
{
  "error": {
    "code": "ERR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
```

---

## Monitoring & Debugging

### Development
- Browser console / React Native debugger
- Redux DevTools
- Performance monitor
- Network inspection

### Staging
- Remote error logging (e.g., Sentry)
- Performance analytics
- User session recording (if available)

### Production
- Remote error logging
- Performance metrics
- User analytics
- Crash reporting

---

## Secrets Management

### Development
- Store in `.env.local` (not committed)
- Load from environment at runtime
- Don't commit real keys

### Staging
- Use environment variables on CI/CD
- Store in secure credential manager
- Audit access

### Production
- Use platform-specific secure storage
  - iOS Keychain
  - Android Keystore
- Never hardcode
- Rotate regularly
- Audit access

---

## Migration Between Environments

When moving code between environments:

1. **Dev → Staging**
   - Deploy to staging infrastructure
   - Test with staging API
   - Test with staging Firebase
   - Run full test suite

2. **Staging → Production**
   - After staging approval
   - Production build generated
   - Production API endpoints configured
   - Production Firebase project connected
   - Gradual rollout if possible

---

## Troubleshooting

### ngrok URL Not Working
- Check ngrok is running
- Verify URL in `.env.development`
- Check firewall allows ngrok
- Try restarting ngrok

### Firebase Connection Issues
- Verify correct Firebase project in config
- Check network connection
- Verify API key is valid
- Check Firebase project settings

### API Connection Fails
- Verify API_BASE_URL is correct
- Check backend is running
- Verify network connectivity
- Check firewall/proxy settings

### Build Issues
- Clear cache: `npm run clean`
- Reinstall dependencies: `npm install`
- Clear native build: `cd android && ./gradlew clean && cd ..`
- Check Node.js version

---

**Last Updated**: 2026-09-07  
**Owner**: Infrastructure Team

This document should be updated whenever environment configuration changes.
