# Development Environment Setup Guide

## Prerequisites

### Required Software
- Node.js 18+ (`nvm` recommended for version management)
- Python 3.9+
- Git
- VS Code (recommended) or preferred IDE
- Docker (optional, for containerized development)

### Recommended VS Code Extensions
```json
{
    "recommendations": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-python.python",
        "ms-python.vscode-pylance",
        "bradlc.vscode-tailwindcss",
        "eamodio.gitlens",
        "github.copilot"
    ]
}
```

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/hedgehog-config-generator.git
cd hedgehog-config-generator
```

### 2. Frontend Setup
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create local environment file
cp .env.example .env.local

# Start development server
npm run dev
```

### 3. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
.\venv\Scripts\activate
# On Unix or MacOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Create local environment file
cp .env.example .env

# Start development server
uvicorn main:app --reload
```

## Configuration Files

### Frontend Configuration
```typescript
// frontend/config/development.ts
export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  debug: true,
  features: {
    topologyVisualizer: true,
    advancedValidation: true
  }
};
```

### Backend Configuration
```python
# backend/config/settings.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    DEBUG: bool = True
    CORS_ORIGINS: list = ["http://localhost:3000"]
    CACHE_TTL: int = 3600
    
    class Config:
        env_file = ".env"

settings = Settings()
```

## Development Workflow

### Git Workflow
```bash
# Create new feature branch
git checkout -b feature/new-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push changes
git push origin feature/new-feature
```

### Running Tests
```bash
# Frontend tests
cd frontend
npm test
npm run test:watch  # for development

# Backend tests
cd backend
pytest
pytest --watch  # for development
```

### Code Formatting
```bash
# Frontend
npm run lint
npm run format

# Backend
black .
isort .
flake8
```

## Docker Development Environment

### Docker Compose Setup
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      target: development
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000

  backend:
    build:
      context: ./backend
      target: development
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    environment:
      - CORS_ORIGINS=http://localhost:3000
```

### Running with Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Development Tools

### API Documentation
```bash
# Access Swagger UI
open http://localhost:8000/docs

# Access ReDoc
open http://localhost:8000/redoc
```

### Debug Configuration
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Frontend",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    },
    {
      "name": "Debug Backend",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": ["main:app", "--reload"],
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

## Common Issues and Solutions

### Frontend Issues
1. **Module Not Found**
   ```bash
   # Clear Next.js cache
   rm -rf .next
   npm run dev
   ```

2. **Type Errors**
   ```bash
   # Regenerate TypeScript types
   npm run generate-types
   ```

### Backend Issues
1. **Dependencies Conflict**
   ```bash
   # Clean and recreate virtual environment
   deactivate
   rm -rf venv
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Database Migrations**
   ```bash
   # Reset development database
   python manage.py reset_db
   ```

## Best Practices

### Code Style
```bash
# Install pre-commit hooks
pre-commit install

# Frontend
npm run lint:fix

# Backend
black .
isort .
```

### Commit Messages
```bash
# Format: <type>(<scope>): <description>
git commit -m "feat(topology): add automatic calculation"
git commit -m "fix(api): resolve connection validation issue"
```

### Branch Naming
```bash
feature/descriptive-name
bugfix/issue-description
refactor/component-name
```

## Monitoring Development

### Frontend Monitoring
```bash
# Bundle analysis
npm run analyze

# Performance monitoring
npm run dev:perf
```

### Backend Monitoring
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
uvicorn main:app --reload --log-level debug

# Profile endpoint performance
python -m cProfile -o output.prof main.py
```