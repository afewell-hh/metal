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

## Server Port Configuration

### Port Profile Analysis
1. Server Port Identification:
   ```javascript
   // Filter ports by profile type
   getServerPorts() {
     return Object.entries(ports)
       .filter(([_, port]) => 
         port.Profile && !port.Profile.includes('fabric'))
       .map(([name, port]) => ({
         name,
         profile: portProfiles[port.Profile],
         portConfig: port
       }));
   }
   ```

2. Breakout Mode Handling:
   ```javascript
   // Determine breakout capabilities
   getBreakoutInfo(portName) {
     const port = ports[portName];
     const profile = portProfiles[port.Profile];
     
     if (!profile?.Breakout) {
       return { isFixed: true, breakoutModes: [], defaultMode: 'Fixed' };
     }

     return {
       isFixed: false,
       breakoutModes: Object.keys(profile.Breakout.Supported),
       defaultMode: profile.Breakout.Default
     };
   }
   ```

3. Port Assignment:
   ```javascript
   // Get next available port with breakout support
   getNextAvailablePort(usedPorts = [], breakoutMode = 'Fixed') {
     const availablePorts = getServerPorts()
       .filter(port => !usedPorts.includes(port.name));

     const port = availablePorts.find(port => {
       const breakoutInfo = getBreakoutInfo(port.name);
       if (breakoutMode === 'Fixed') {
         return breakoutInfo.isFixed || breakoutInfo.breakoutModes.includes('Fixed');
       }
       return breakoutInfo.breakoutModes.includes(breakoutMode);
     });

     return port?.name;
   }
   ```

### Server Connection Distribution
1. Distribution Algorithm:
   ```javascript
   // Distribute servers across leaves
   distributeServersAcrossLeaves(serverCount, leafCount) {
     if (serverCount <= 0 || leafCount <= 0) {
       throw new Error('Invalid counts');
     }

     const distribution = {};
     const baseCount = Math.floor(serverCount / leafCount);
     const remainder = serverCount % leafCount;

     for (let i = 0; i < leafCount; i++) {
       const count = i < remainder ? baseCount + 1 : baseCount;
       distribution[`leaf-${i + 1}`] = Array.from(
         { length: count },
         (_, j) => `server-${j + 1}`
       );
     }

     return distribution;
   }
   ```

2. Connection Type Handling:
   ```javascript
   // Get leaf switches for server connections
   getLeafSwitchesForServer(configType, connectionsPerServer, startIndex) {
     const leaves = [];
     switch (configType) {
       case 'single':
         leaves.push(`leaf-${startIndex + 1}`);
         break;
       case 'lag':
         for (let i = 0; i < connectionsPerServer; i++) {
           leaves.push(`leaf-${startIndex + 1}`);
         }
         break;
       case 'mclag':
         leaves.push(`leaf-${startIndex + 1}`);
         leaves.push(`leaf-${startIndex + 2}`);
         break;
       case 'eslag':
         for (let i = 0; i < connectionsPerServer; i++) {
           leaves.push(`leaf-${startIndex + i + 1}`);
         }
         break;
     }
     return leaves;
   }
   ```

### Port Naming
1. Breakout Port Names:
   ```javascript
   // Generate port names with breakout
   getPortName(basePort, breakoutMode, subPort = 0) {
     if (breakoutMode === 'Fixed' || !breakoutMode) {
       return basePort;
     }

     const [prefix, number] = basePort.match(/([a-zA-Z]+)(\d+)/).slice(1);
     return `${prefix}${number}/${subPort + 1}`;
   }
   ```

2. Port Tracking:
   ```javascript
   // Initialize port tracking per switch
   const usedPorts = {};
   switches.forEach(sw => {
     usedPorts[sw.metadata.name] = [];
   });

   // Track port assignments
   usedPorts[switchName].push(portName);
   ```

### Critical Implementation Details
1. Port Selection Rules:
   - Must check both fixed ports and breakout-capable ports for Fixed mode
   - Must validate breakout mode support before assignment
   - Must track used ports per switch to prevent duplicates
   - Must handle subport numbering for breakout ports

2. Distribution Requirements:
   - Servers must be evenly distributed across leaves
   - Connection types must determine leaf switch selection
   - Port assignments must be deterministic
   - Must handle remainder servers properly

3. Error Handling:
   - Throw specific errors for:
     * No available ports
     * Unsupported breakout modes
     * Invalid server/leaf counts
     * Invalid connection types
   - Include error context for debugging

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
