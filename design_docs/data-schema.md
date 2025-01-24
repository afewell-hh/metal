# Data Persistence Schema

## Overview

This document outlines a lightweight data persistence approach that can be implemented as needed. Initially, we can store data in memory or files, with the ability to migrate to a database as requirements grow.

## Initial Approach: File-based Storage

### Configuration Templates
```typescript
interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  created: Date;
  updated: Date;
  template: {
    topology: TopologyConfig;
    network: NetworkConfig;
    connections: ConnectionConfig[];
  };
  metadata: {
    tags: string[];
    author: string;
    version: string;
  };
}
```

### Storage Implementation
```python
import json
from pathlib import Path
from typing import Dict, List

class FileStorage:
    def __init__(self, base_path: Path):
        self.base_path = base_path
        self.templates_path = base_path / "templates"
        self.templates_path.mkdir(parents=True, exist_ok=True)
    
    async def save_template(self, template: dict) -> str:
        template_id = template["id"]
        path = self.templates_path / f"{template_id}.json"
        async with aiofiles.open(path, "w") as f:
            await f.write(json.dumps(template))
        return template_id
    
    async def get_template(self, template_id: str) -> dict:
        path = self.templates_path / f"{template_id}.json"
        async with aiofiles.open(path) as f:
            return json.loads(await f.read())
```

## Future Database Schema

If we need to move to a database later, here's a suggested schema:

### Switch Profiles
```sql
CREATE TABLE switch_profiles (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    vendor TEXT NOT NULL,
    capabilities JSONB NOT NULL,
    port_config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Configuration Templates
```sql
CREATE TABLE config_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    topology_config JSONB NOT NULL,
    network_config JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Generated Configurations
```sql
CREATE TABLE generated_configs (
    id TEXT PRIMARY KEY,
    template_id TEXT REFERENCES config_templates(id),
    input_params JSONB NOT NULL,
    output_config JSONB NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    validation_results JSONB
);
```

### Audit Log
```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id TEXT,
    ip_address TEXT
);
```

## Migration Strategy

### Phase 1: File-based
```python
class Storage(Protocol):
    async def save_template(self, template: dict) -> str: ...
    async def get_template(self, template_id: str) -> dict: ...
    async def list_templates(self) -> List[dict]: ...
```

### Phase 2: Database Migration
```python
from sqlalchemy.ext.asyncio import AsyncSession

class DatabaseStorage:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def save_template(self, template: dict) -> str:
        stmt = insert(config_templates).values(
            id=template["id"],
            name=template["name"],
            topology_config=template["topology"],
            network_config=template["network"]
        )
        await self.session.execute(stmt)
        await self.session.commit()
        return template["id"]
```

## Cache Strategy

### In-Memory Cache
```python
from functools import lru_cache
from typing import Optional

class CacheManager:
    def __init__(self):
        self.template_cache = {}
    
    @lru_cache(maxsize=100)
    async def get_template(self, template_id: str) -> Optional[dict]:
        return self.template_cache.get(template_id)
    
    async def invalidate_template(self, template_id: str):
        self.get_template.cache_clear()
        self.template_cache.pop(template_id, None)
```

### Redis Cache (Future)
```python
from redis import asyncio as aioredis

class RedisCache:
    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
    
    async def get_template(self, template_id: str) -> Optional[dict]:
        data = await self.redis.get(f"template:{template_id}")
        return json.loads(data) if data else None
    
    async def set_template(self, template_id: str, data: dict):
        await self.redis.set(
            f"template:{template_id}",
            json.dumps(data),
            ex=3600  # 1 hour expiration
        )
```

## Data Access Layer

### Repository Pattern
```python
class ConfigurationRepository:
    def __init__(
        self,
        storage: Storage,
        cache: Optional[CacheManager] = None
    ):
        self.storage = storage
        self.cache = cache or CacheManager()
    
    async def get_template(self, template_id: str) -> dict:
        if self.cache:
            cached = await self.cache.get_template(template_id)
            if cached:
                return cached
        
        template = await self.storage.get_template(template_id)
        if self.cache:
            await self.cache.set_template(template_id, template)
        return template
```

## Backup Strategy

### File-based Backup
```python
async def backup_templates(storage: Storage, backup_path: Path):
    templates = await storage.list_templates()
    backup_data = {
        "version": "1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "templates": templates
    }
    
    backup_file = backup_path / f"backup_{datetime.utcnow().date()}.json"
    async with aiofiles.open(backup_file, "w") as f:
        await f.write(json.dumps(backup_data))
```

### Restoration
```python
async def restore_from_backup(
    storage: Storage,
    backup_file: Path
) -> List[str]:
    async with aiofiles.open(backup_file) as f:
        backup_data = json.loads(await f.read())
    
    restored_ids = []
    for template in backup_data["templates"]:
        template_id = await storage.save_template(template)
        restored_ids.append(template_id)
    
    return restored_ids
```