# Test Plan

## Test Strategy

### Unit Tests

1. **Input Validation**
   ```python
   def test_spine_leaf_validation():
       calculator = TopologyValidator()
       input_data = {
           "topology": "spine-leaf",
           "leafModel": "dell-s5248f-on",
           "spineModel": "dell-s5232f-on",
           "leafCount": 4,
           "spineCount": 2,
           "uplinksPerLeaf": 4,
           "serverCount": 96
       }
       result = calculator.validate(input_data)
       assert result.valid == True
   ```

2. **Port Calculation**
   ```python
   def test_port_availability():
       validator = PortValidator()
       config = {
           "switchModel": "dell-s5248f-on",
           "requiredPorts": 48
       }
       result = validator.check_port_availability(config)
       assert result.has_sufficient_ports == True
   ```

3. **Configuration Generation**
   ```python
   def test_collapsed_core_config():
       generator = ConfigGenerator()
       input_data = {
           "topology": "collapsed-core",
           "switchModel": "dell-s5248f-on",
           "coreLinks": 4,
           "serverCount": 48
       }
       config = generator.generate(input_data)
       assert len(config.switches) == 2
       assert all(switch.model == "dell-s5248f-on" for switch in config.switches)
   ```

### Integration Tests

1. **API Integration**
   ```python
   def test_config_generation_flow():
       input_data = {
           "topology": "spine-leaf",
           "leafModel": "dell-s5248f-on",
           "spineModel": "dell-s5232f-on",
           "leafCount": 4,
           "spineCount": 2,
           "uplinksPerLeaf": 4
       }
       response = client.post("/api/v1/config/generate", json=input_data)
       assert response.status_code == 200
       assert "manifests" in response.json()
   ```

2. **Frontend Integration**
   ```typescript
   describe('Form Submission', () => {
       it('should handle spine-leaf form submission', async () => {
           await page.selectOption('#topology', 'spine-leaf');
           await page.fill('#leafCount', '4');
           await page.fill('#spineCount', '2');
           await page.fill('#uplinksPerLeaf', '4');
           await page.click('#submit');
           
           const response = await page.waitForResponse('/api/v1/config/generate');
           expect(response.status()).toBe(200);
       });
   });
   ```

### End-to-End Tests

1. **Complete Workflows**
   ```typescript
   describe('Configuration Workflow', () => {
       it('should generate collapsed-core configuration', async () => {
           // Select topology
           await page.selectOption('#topology', 'collapsed-core');
           
           // Fill form
           await page.fill('#switchModel', 'dell-s5248f-on');
           await page.fill('#coreLinks', '4');
           await page.fill('#serverCount', '48');
           
           // Submit and verify
           await page.click('#submit');
           const config = await page.textContent('#configOutput');
           expect(JSON.parse(config)).toMatchSnapshot();
       });
   });
   ```

2. **Validation Testing**
   ```typescript
   describe('Input Validation', () => {
       it('should validate port counts', async () => {
           await page.fill('#serverCount', '1000');  // Too many for switch
           await page.click('#submit');
           
           const error = await page.textContent('.error-message');
           expect(error).toContain('Insufficient ports');
       });
   });
   ```

### Performance Tests

1. **API Response Times**
   ```javascript
   describe('API Performance', () => {
       it('should generate config within 500ms', async () => {
           const start = Date.now();
           const response = await api.generateConfig(testConfig);
           const duration = Date.now() - start;
           expect(duration).toBeLessThan(500);
       });
   });
   ```

2. **Load Testing**
   ```python
   from locust import HttpUser, task, between

   class ConfigGenerator(HttpUser):
       wait_time = between(1, 3)

       @task
       def generate_config(self):
           self.client.post("/api/v1/config/generate", json={
               "topology": "spine-leaf",
               "leafModel": "dell-s5248f-on",
               "spineModel": "dell-s5232f-on",
               "leafCount": 4,
               "spineCount": 2,
               "uplinksPerLeaf": 4
           })
   ```

## Test Data

### Sample Configurations

1. **Spine-Leaf**
   ```json
   {
       "topology": "spine-leaf",
       "leafModel": "dell-s5248f-on",
       "spineModel": "dell-s5232f-on",
       "leafCount": 4,
       "spineCount": 2,
       "uplinksPerLeaf": 4,
       "serverCount": 96
   }
   ```

2. **Collapsed Core**
   ```json
   {
       "topology": "collapsed-core",
       "switchModel": "dell-s5248f-on",
       "coreLinks": 4,
       "serverCount": 48
   }
   ```

### Edge Cases

1. **Maximum Configuration**
   ```json
   {
       "topology": "spine-leaf",
       "leafModel": "dell-s5248f-on",
       "spineModel": "dell-s5232f-on",
       "leafCount": 8,
       "spineCount": 4,
       "uplinksPerLeaf": 8,
       "serverCount": 384
   }
   ```

2. **Minimum Configuration**
   ```json
   {
       "topology": "collapsed-core",
       "switchModel": "dell-s5248f-on",
       "coreLinks": 1,
       "serverCount": 2
   }
   ```

## Acceptance Criteria

### Functional Requirements
- All generated configurations must be valid
- Port assignments must be within switch capabilities
- Server distribution must be even when specified
- Uplink distribution must be even across spine switches

### Performance Requirements
- Configuration generation under 500ms
- API response time under 1 second
- Smooth UI interactions

### Quality Requirements
- Zero critical defects
- Test coverage > 80%
- All major workflows tested

## Test Environment Setup

### Local Development
```bash
# Setup test environment
npm install --dev
python -m venv venv
source venv/bin/activate
pip install -r requirements-test.txt

# Run tests
npm test
pytest
```

### CI Pipeline
```yaml
test:
  script:
    - npm ci
    - npm run test
    - python -m pytest
    - npm run e2e
  artifacts:
    reports:
      junit: junit.xml
```

## Monitoring and Reporting

### Test Coverage
```bash
# Generate coverage report
pytest --cov=app --cov-report=html
```

### Performance Metrics
```python
@app.middleware("http")
async def track_performance(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    logger.info(f"Request duration: {duration}")
    return response
```

## Continuous Testing

### Pre-commit Hooks
```yaml
- repo: local
  hooks:
    - id: pytest
      name: pytest
      entry: pytest
      language: system
      pass_filenames: false
      always_run: true
```

### Automated Checks
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: |
          npm test
          python -m pytest
```