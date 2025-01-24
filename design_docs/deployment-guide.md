# Deployment Guide

## Overview

This application is designed to be deployed as a static frontend with serverless backend functions. This guide covers deployment using Vercel, though similar principles apply to other platforms.

## Prerequisites

- Git repository with source code
- Vercel account
- (Optional) Custom domain
- Node.js 18+ and Python 3.9+

## Development Environment

### Local Setup
```bash
# Clone repository
git clone <repo-url>
cd hedgehog-config-generator

# Frontend setup
cd frontend
npm install
npm run dev

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

### Environment Variables
```plaintext
# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000

# Backend (.env)
CORS_ORIGINS=http://localhost:3000
```

## Production Deployment

### Frontend Deployment (Vercel)

1. **Connect Repository**
   ```bash
   vercel link
   ```

2. **Configure Build**
   ```json
   {
     "builds": [
       {
         "src": "frontend/package.json",
         "use": "@vercel/next"
       }
     ]
   }
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add NEXT_PUBLIC_API_URL
   ```

### Backend Deployment (Vercel Functions)

1. **Configure Python Functions**
   ```json
   {
     "functions": {
       "api/*.py": {
         "runtime": "python3.9"
       }
     }
   }
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

## Infrastructure Setup

### DNS Configuration
```plaintext
# A Record
config.example.com.  IN  A  76.76.21.21

# CNAME Record
api.config.example.com.  IN  CNAME  cname.vercel-dns.com.
```

### SSL/TLS
- Automatic with Vercel
- Renews automatically
- Custom certificates supported

## Monitoring Setup

### Application Monitoring
```javascript
// Frontend monitoring
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: "https://xxx@xxx.ingest.sentry.io/xxx",
  tracesSampleRate: 1.0,
});

# Backend monitoring
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()
Instrumentator().instrument(app).expose(app)
```

### Health Checks
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow()
    }
```

## Backup and Recovery

### Configuration Backup
```bash
# Backup environment variables
vercel env pull .env.production

# Backup deployment configuration
vercel project download
```

### Recovery Procedures
1. Revert to previous deployment
   ```bash
   vercel rollback
   ```

2. Restore from backup
   ```bash
   vercel env push .env.production
   vercel deploy --prebuilt
   ```

## Security Considerations

### Frontend Security
- CSP headers configured
- XSS protection enabled
- CSRF tokens implemented

### API Security
- Rate limiting enabled
- Input validation
- Error handling

## Performance Optimization

### Frontend Optimization
```javascript
// Next.js config
module.exports = {
  images: {
    domains: ['assets.example.com'],
  },
  experimental: {
    optimizeCss: true,
  },
}
```

### API Optimization
```python
# FastAPI caching
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

@app.on_event("startup")
async def startup():
    FastAPICache.init(RedisBackend(), prefix="fastapi-cache")
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   ```bash
   # Check build logs
   vercel logs
   
   # Verify dependencies
   npm ci && npm run build
   ```

2. **API Issues**
   ```bash
   # Check API logs
   vercel logs api/calculate
   
   # Test locally
   vercel dev
   ```

### Monitoring Alerts

1. **Error Rate Alert**
   ```yaml
   alerts:
     - type: error_rate
       threshold: 1%
       window: 5m
   ```

2. **Performance Alert**
   ```yaml
   alerts:
     - type: p95_latency
       threshold: 500ms
       window: 5m
   ```

## Scaling Considerations

### Frontend Scaling
- Edge caching enabled
- Static generation where possible
- Image optimization

### API Scaling
- Serverless functions auto-scale
- Cache frequently accessed data
- Optimize heavy calculations

## Maintenance Procedures

### Regular Updates
```bash
# Update dependencies
npm update
pip install --upgrade -r requirements.txt

# Deploy updates
vercel --prod
```

### Monitoring Review
- Review error logs daily
- Check performance metrics
- Monitor resource usage