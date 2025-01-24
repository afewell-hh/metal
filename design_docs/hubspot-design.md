# HubSpot CMS Implementation Design

## Architecture Overview

### Frontend Components (HubSpot CMS)
1. **Custom Modules**
   - Topology selection form
   - Switch model selection
   - Port configuration input
   - Results display
   ```hubl
   {% module "topology_selection"
      path="./modules/topology_selection.module"
      label="Network Topology Configuration" 
   %}
   ```

2. **Theme Components**
   - Layout templates
   - Navigation
   - Styling
   ```hubl
   {% extends "./layouts/base.html" %}
   {% block content %}
     {# Configuration tool content #}
   {% endblock %}
   ```

## Module Structure

### 1. Topology Selection Module
```hubl
{# modules/topology_selection.module/module.html #}
<div class="topology-selection">
  <form id="topologyForm">
    <div class="form-group">
      <label>Topology Type</label>
      <select name="topologyType" required>
        <option value="spine-leaf">Spine-Leaf</option>
        <option value="collapsed-core">Collapsed Core</option>
      </select>
    </div>
    
    <!-- Spine-Leaf specific fields -->
    <div id="spineLeafFields" class="conditional-fields">
      <div class="form-group">
        <label>Leaf Switch Model</label>
        <select name="leafModel" required></select>
      </div>
      <div class="form-group">
        <label>Spine Switch Model</label>
        <select name="spineModel" required></select>
      </div>
      <div class="form-group">
        <label>Number of Leaf Switches</label>
        <input type="number" name="leafCount" required>
      </div>
      <div class="form-group">
        <label>Number of Spine Switches</label>
        <input type="number" name="spineCount" required>
      </div>
      <div class="form-group">
        <label>Uplinks per Leaf</label>
        <input type="number" name="uplinksPerLeaf" required>
      </div>
    </div>
    
    <!-- Collapsed Core specific fields -->
    <div id="collapsedCoreFields" class="conditional-fields">
      <div class="form-group">
        <label>Switch Model</label>
        <select name="switchModel" required></select>
      </div>
      <div class="form-group">
        <label>Number of Core Links</label>
        <input type="number" name="coreLinks" required>
      </div>
    </div>
    
    <!-- Optional server count -->
    <div class="form-group">
      <label>Number of Servers (Optional)</label>
      <input type="number" name="serverCount">
    </div>
  </form>
</div>

{% require_js %}
<script>
  document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('topologyForm');
    const topologySelect = form.querySelector('[name="topologyType"]');
    
    // Handle form visibility
    function updateFormFields() {
      const topology = topologySelect.value;
      document.getElementById('spineLeafFields').style.display = 
        topology === 'spine-leaf' ? 'block' : 'none';
      document.getElementById('collapsedCoreFields').style.display = 
        topology === 'collapsed-core' ? 'block' : 'none';
    }
    
    // Initial setup
    updateFormFields();
    topologySelect.addEventListener('change', updateFormFields);
    
    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      try {
        const response = await fetch('/api/generate-config', {
          method: 'POST',
          body: JSON.stringify(Object.fromEntries(formData))
        });
        // Handle response
      } catch (error) {
        // Handle error
      }
    });
  });
</script>
{% end_require_js %}
```

### 2. Results Display Module
```hubl
{# modules/results_display.module/module.html #}
<div class="results-display">
  <div id="configResults">
    <!-- Configuration results will be displayed here -->
  </div>
  <div id="downloadSection" style="display: none;">
    <button id="downloadConfig">Download Configuration</button>
  </div>
</div>

{% require_js %}
<script>
  class ResultsDisplay {
    constructor() {
      this.resultsDiv = document.getElementById('configResults');
      this.downloadSection = document.getElementById('downloadSection');
    }
    
    displayResults(config) {
      // Display formatted results
      this.resultsDiv.innerHTML = this.formatConfig(config);
      this.downloadSection.style.display = 'block';
    }
    
    formatConfig(config) {
      // Format configuration for display
      return `<pre>${JSON.stringify(config, null, 2)}</pre>`;
    }
  }
  
  window.resultsDisplay = new ResultsDisplay();
</script>
{% end_require_js %}
```

## Validation Implementation

```javascript
class ConfigurationValidator {
  validateSpineLeaf(input) {
    const validations = [
      this.validateSwitchCounts(input),
      this.validateUplinkCount(input),
      this.validatePortAvailability(input)
    ];
    
    return validations.every(v => v.valid);
  }
  
  validateCollapsedCore(input) {
    if (input.coreLinks < 1) {
      return { valid: false, error: 'At least one core link required' };
    }
    
    return { valid: true };
  }
  
  validatePortAvailability(input) {
    // Validate port counts based on switch models
    return { valid: true }; // Implement actual validation
  }
}
```

## Error Handling

```javascript
class ErrorHandler {
  static handleError(error) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = this.formatError(error);
    
    document.getElementById('configResults').appendChild(errorDiv);
  }
  
  static formatError(error) {
    // Format error message for display
    return `Error: ${error.message}`;
  }
}
```

## Styling

```css
/* modules/topology_selection.module/styles/main.css */
.topology-selection {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.conditional-fields {
  margin-top: 1.5rem;
  padding: 1rem;
  border: 1px solid #eee;
  border-radius: 4px;
}

.error-message {
  color: #dc3545;
  padding: 0.5rem;
  margin-top: 1rem;
  border: 1px solid #dc3545;
  border-radius: 4px;
}
```

## Development Notes

### Key Implementation Points
1. Form fields show/hide based on topology selection
2. Real-time validation as user inputs data
3. Clear error messaging
4. Simple, intuitive interface

### Performance Considerations
1. Lazy load switch model data
2. Implement client-side validation
3. Cache API responses where appropriate

### Security Considerations
1. Input validation on both client and server
2. CORS configuration for API access
3. Rate limiting implementation

## Testing Requirements

### Unit Tests
```javascript
describe('Configuration Validator', () => {
  const validator = new ConfigurationValidator();
  
  test('validates spine-leaf configuration', () => {
    const input = {
      leafModel: 'dell-s5248f-on',
      spineModel: 'dell-s5232f-on',
      leafCount: 4,
      spineCount: 2,
      uplinksPerLeaf: 4
    };
    
    expect(validator.validateSpineLeaf(input).valid).toBe(true);
  });
});
```

### Integration Tests
- Form submission flow
- API communication
- Error handling
- Results display