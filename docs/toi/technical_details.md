# Technical Implementation Details

## Form State Management

### Serial Number Handling
1. Initial State:
   ```javascript
   // Default form data structure
   const DEFAULT_FORM_DATA = {
     // ... other fields ...
     switchSerials: {}  // Empty object to start
   };
   ```

2. Serial Number Updates:
   - Triggered by changes to:
     - Switch models
     - Switch counts
     - Topology changes
   - Always replaces entire switchSerials object
   - Never merges with existing serials
   - Prevents stale serial numbers from persisting

### Switch Model Selection
1. Model Loading:
   ```javascript
   // Convert profile names to display format
   switchProfileManager.baseProfiles.map(model => 
     model.replace(/_/g, '-')
   )
   ```
   
2. State Dependencies:
   - Must initialize SwitchProfileManager before form render
   - Model changes trigger serial number regeneration
   - Models must be normalized for comparison

## Configuration Generation

### K8s Object Generation
1. Object Creation Rules:
   ```javascript
   createK8sObject(kind, name, spec) {
     return {
       apiVersion: 'wiring.githedgehog.com/v1beta1',
       kind,
       metadata: { name },  // No generateName field
       spec
     };
   }
   ```

2. Critical Implementation Details:
   - Never include generateName in metadata
   - Always use consistent apiVersion
   - Spec must match Hedgehog API requirements

### Fabric Port Distribution
1. Port Assignment Algorithm:
   ```javascript
   // For each leaf-spine pair:
   const spinePort = leafIndex * uplinksPerSpine + i + 1;
   const leafPort = 49 + (spineIndex * uplinksPerSpine * 2) + (i * 2);
   ```

2. Key Implementation Rules:
   - Spine ports must be sequential within each leaf's range
   - Leaf ports must use even-numbered spacing
   - Must validate uplinksPerLeaf is divisible by numSpines
   - Port numbers must start from 1 for spines, 49 for leaves

### Form Validation
1. Required Validations:
   - Switch model compatibility
   - Port count sufficiency
   - Even distribution of uplinks
   - Serial number format (when provided)

2. Error Handling:
   - Show validation errors before serial number step
   - Prevent form submission if uplinks can't be distributed
   - Clear errors when input becomes valid

## Critical Dependencies

### SwitchProfileManager
1. Initialization Requirements:
   - Must be initialized before form render
   - Requires access to profile YAML files
   - Handles model name normalization

2. Usage Rules:
   - Always use normalized model names for comparison
   - Cache initialized instance for performance
   - Handle missing profile files gracefully

### Port Assignment
1. Distribution Requirements:
   - Must maintain deterministic port assignments
   - Must handle model-specific port ranges
   - Must validate against profile capabilities

2. Validation Rules:
   - Verify port speed compatibility
   - Check port availability
   - Validate breakout configurations

## Common Pitfalls

### Form State
1. Serial Number Management:
   - Don't merge serial numbers on topology changes
   - Always regenerate complete serial number set
   - Clear serials when switch counts change

### Configuration Generation
1. Port Naming:
   - Always use E1/{port} format
   - Include full switch name in port identifiers
   - Maintain consistent naming across objects

2. Switch Names:
   - Remove vendor prefixes before generation
   - Use consistent case (lowercase)
   - Maintain padding in indices

### Validation
1. Critical Checks:
   - Validate uplinks before distribution
   - Check port availability in profiles
   - Verify model compatibility
   - Ensure consistent port naming
