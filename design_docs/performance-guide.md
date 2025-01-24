# Performance Optimization Guidelines

## Frontend Optimization

### HubSpot Module Optimization

1. **Form Handling**
   ```typescript
   class FormManager {
     constructor() {
       this.form = document.getElementById('configForm');
       this.debounceValidation = _.debounce(this.validate, 300);
     }
     
     // Use efficient event handling
     initializeListeners() {
       this.form.addEventListener('input', this.debounceValidation);
     }
   }
   ```

2. **Switch Profile Data**
   ```typescript
   // Cache switch profile data
   const SwitchProfileCache = {
     async getProfiles() {
       if (this.cachedProfiles) {
         return this.cachedProfiles;
       }
       
       const response = await fetch('/api/switch-profiles');
       this.cachedProfiles = await response.json();
       return this.cachedProfiles;
     }
   };
   ```

### API Integration

1. **Efficient Requests**
   ```typescript
   class ApiClient {
     constructor() {
       this.pendingRequests = new Map();
     }
     
     // Prevent duplicate requests
     async validateConfig(config) {
       const key = JSON.stringify(config);
       if (this.pendingRequests.has(key)) {
         return this.pendingRequests.get(key);
       }
       
       const promise = fetch('/api/validate', {
         method: 'POST',
         body: JSON.stringify(config)
       });
       
       this.pendingRequests.set(key, promise);
       return promise;
     }
   }
   ```

## Backend Optimization

### Configuration Generation

1. **Efficient Port Assignment**
   ```python
   class PortAssigner:
       def assign_ports(self, switch_config):
           # Use pre-calculated ranges for efficiency
           port_ranges = self.get_port_ranges(switch_config.model)
           return self.assign_from_ranges(port_ranges)
           
       def get_port_ranges(self, model):
           # Cache port ranges
           if model in self.port_range_cache:
               return self.port_range_cache[model]
           
           ranges = calculate_port_ranges(model)
           self.port_range_cache[model] = ranges
           return ranges
   ```

2. **Validation Optimization**
   ```python
   class ConfigValidator:
       def validate(self, config):
           # Run validations in parallel where possible
           tasks = [
               self.validate_ports(config),
               self.validate_uplinks(config),
               self.validate_server_distribution(config)
           ]
           return await asyncio.gather(*tasks)
   ```

### Memory Management

1. **Efficient Data Structures**
   ```python
   from typing import NamedTuple
   
   class SwitchConfig(NamedTuple):
       model: str
       ports: list
       uplinks: list
       
   # Use memory-efficient data structures
   def process_config(config: SwitchConfig):
       return {
           'model': config.model,
           'ports': list(config.ports),  # Convert iterator to list only when needed
           'uplinks': list(config.uplinks)
       }
   ```

2. **Resource Cleanup**
   ```python
   class ConfigGenerator:
       def __init__(self):
           self.temp_data = {}
           
       async def generate(self, config):
           try:
               return await self._generate_config(config)
           finally:
               # Clean up temporary data
               self.temp_data.clear()
   ```

## API Optimization

### Request Handling

1. **Input Validation**
   ```python
   from pydantic import BaseModel, validator
   
   class ConfigInput(BaseModel):
       topology: str
       leaf_count: int = None
       spine_count: int = None
       
       @validator('leaf_count')
       def validate_leaf_count(cls, v):
           if v is not None and v <= 0:
               raise ValueError('Leaf count must be positive')
           return v
   ```

2. **Response Optimization**
   ```python
   @app.post("/api/generate")
   async def generate_config(config: ConfigInput):
       # Generate only needed fields
       result = await generate_minimal_config(config)
       
       # Stream large responses
       return StreamingResponse(
           generate_config_stream(result),
           media_type="application/json"
       )
   ```

## Caching Strategy

### Frontend Caching

1. **Switch Profile Cache**
   ```typescript
   const SwitchProfileManager = {
     profiles: new Map(),
     
     async getProfile(model) {
       if (!this.profiles.has(model)) {
         const profile = await fetchProfile(model);
         this.profiles.set(model, profile);
       }
       return this.profiles.get(model);
     }
   };
   ```

2. **Validation Results**
   ```typescript
   const ValidationCache = {
     maxSize: 100,
     cache: new Map(),
     
     getValidation(config) {
       const key = JSON.stringify(config);
       return this.cache.get(key);
     },
     
     setValidation(config, result) {
       const key = JSON.stringify(config);
       if (this.cache.size >= this.maxSize) {
         const firstKey = this.cache.keys().next().value;
         this.cache.delete(firstKey);
       }
       this.cache.set(key, result);
     }
   };
   ```

## Monitoring and Profiling

### Performance Monitoring

1. **API Metrics**
   ```python
   from prometheus_client import Counter, Histogram
   
   REQUESTS = Counter('http_requests_total', 'Total requests')
   LATENCY = Histogram('request_latency_seconds', 'Request latency')
   
   @app.middleware("http")
   async def monitor_requests(request: Request, call_next):
       REQUESTS.inc()
       with LATENCY.time():
           response = await call_next(request)
       return response
   ```

2. **Resource Usage**
   ```python
   import resource
   
   def log_resource_usage():
       usage = resource.getrusage(resource.RUSAGE_SELF)
       logger.info(f"Memory usage: {usage.ru_maxrss}")
       logger.info(f"CPU time: {usage.ru_utime}")
   ```

## Best Practices

### Code Organization

1. **Modular Design**
   ```python
   class ConfigurationService:
       def __init__(
           self,
           validator: ConfigValidator,
           generator: ConfigGenerator,
           cache: CacheManager
       ):
           self.validator = validator
           self.generator = generator
           self.cache = cache
   ```

2. **Efficient Imports**
   ```python
   # Use specific imports
   from .models import ConfigInput
   from .validators import validate_config
   
   # Avoid
   # from .models import *
   ```

### Error Handling

1. **Graceful Degradation**
   ```python
   async def generate_config(config: ConfigInput):
       try: