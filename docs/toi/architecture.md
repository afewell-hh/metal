# Metal Architecture and Design Considerations

## Project Overview
Metal is a configuration generation tool for network fabric designs. It takes user inputs about their desired network topology and generates appropriate switch configurations, considering complex port allocation rules and hardware capabilities.

## Key Concepts
1. **Fabric Design**
   - A fabric consists of spine and leaf switches in a Clos architecture
   - Each leaf switch must connect to every spine switch
   - Server connections are distributed across leaf switches
   - Port speeds and breakout configurations affect available connectivity

2. **Switch Models**
   - Each switch model has specific capabilities defined in Go profile files
   - Models can inherit properties from other models (e.g., Supermicro inheriting from Celestica)
   - Models define available ports, speeds, and breakout capabilities

## Core Components

### Configuration Generation (`/src/frontend/js/configGenerator.js`)
- Generates Kubernetes CRD objects for Hedgehog's Wiring Diagram API
- Key object types:
  - Switch: Physical switch configuration with profile, role, and serial number
  - Connection: Physical connections between devices (fabric, MCLAG)
  - VLANNamespace: Non-overlapping VLAN ranges
  - SwitchGroup: Groups of switches (e.g., MCLAG pairs)
- Object format follows Kubernetes CRD structure:
  ```yaml
  apiVersion: wiring.githedgehog.com/v1beta1
  kind: <ObjectType>
  metadata:
    name: <unique-name>
  spec:
    # Type-specific fields
  ```
- Port naming follows format: "device/port" (e.g., "spine-1/E1/1")
- Switch naming convention:
  ```javascript
  // Example switch name generation:
  dell-s5232f-on -> s5232-01
  celestica-ds4000 -> ds4000-01
  edgecore-dcs501 -> dcs501-01
  ```
- Fabric connection distribution:
  - Each leaf gets equal uplinks to each spine
  - Port numbering is sequential and unique
  - Example with 2 spines, 4 uplinks per leaf:
    ```
    Leaf 1 -> Spine 1: ports 1,2 (leaf ports 49,51)
    Leaf 1 -> Spine 2: ports 1,2 (leaf ports 53,55)
    Leaf 2 -> Spine 1: ports 3,4 (leaf ports 49,51)
    Leaf 2 -> Spine 2: ports 3,4 (leaf ports 53,55)
    ```

### Switch Profiles (`/switch_profiles/`)
- Go files containing comprehensive switch specifications
- Naming pattern: `profile_<model>.go`
- Contains critical logic for:
  - Port mappings (physical to logical)
  - Breakout configurations
  - Speed capabilities
  - Port naming conventions
  - Platform-specific attributes
- Key files to examine:
  - `profile_celestica_ds3000.go`: Base model example
  - `profile_supermicro_sse_c4632.go`: Inheritance example

### Port Allocation Rules (`/src/frontend/port_allocation_rules/`)
- YAML files defining valid port assignments
- Naming pattern: `<model>.yaml`
- Key characteristics:
  - Ports can be valid for multiple roles (fabric/server overlap allowed)
  - Port ranges use inclusive notation (e.g., "1-32")
  - Must be considered alongside breakout configurations
- Example structure:
  ```yaml
  fabric: ["1-32"]     # QSFP28 ports for fabric connections
  server: ["1-32"]     # SFP28 port for server connections
  management: ["M1"]   # Management port
  ```

### Frontend Components (`/src/frontend/js/`)
1. **SwitchProfileManager** (`switchProfileManager.js`)
   - Loads and parses Go profile files
   - Handles profile inheritance
   - Provides port validation methods

2. **PortAllocationRules** (`portAllocationRules.js`)
   - Loads and parses YAML rules
   - Validates port assignments
   - Handles overlapping port ranges

3. **PortAssignmentManager** (`portAssignmentManager.js`)
   - Implements port assignment algorithm
   - Validates fabric designs
   - Handles breakout configurations

4. **ConfigGenerator** (`configGenerator.js`)
   - Generates final switch configurations
   - Applies port assignments
   - Creates output configuration objects

5. **ConfigEditor** (`configEditor.jsx`)
   - YAML-based object editor with readonly/edit modes
   - Component Structure:
     ```javascript
     // Main component structure
     ConfigEditor
     ├── Object Groups (by kind)
     │   ├── Section Header
     │   │   ├── Title
     │   │   └── Add Object Button
     │   └── Object Cards
     │       ├── Object Controls
     │       │   ├── Include in Configuration Toggle
     │       │   ├── Edit/Done Button
     │       │   └── Delete Button
     │       └── YAML Editor (react-ace)
     └── Save Button
     ```
   - State Management:
     ```javascript
     // Internal state structure
     {
       [kind: string]: Array<{
         ...objectData,
         _isVisible: boolean,  // Controls inclusion in final config
         _isEditing: boolean, // Controls editor readonly state
         _yamlText: string    // Current YAML content
       }>
     }
     ```
   - Key Features:
     - Full YAML editing with syntax validation
     - VSCode-like styling
     - Readonly by default with edit toggle
     - New objects added to top of sections
     - Object visibility control
     - Proper YAML field ordering
   - Input/Output:
     - Accepts array of K8s objects
     - Groups by kind internally
     - Returns array of visible objects
     - Strips internal state on save
   - Dependencies:
     ```json
     {
       "react-ace": "^10.1.0",
       "ace-builds": "^1.23.4",
       "js-yaml": "^4.1.0"
     }
     ```

### CSS Architecture (`/src/frontend/css/`)
- BEM-like naming convention
- Visual hierarchy:
  ```
  config-editor
  └── object-group (light gray background)
      ├── section-header
      │   ├── title
      │   └── add-object-button (blue)
      └── object-card (white with shadow)
          ├── object-controls (light gray)
          │   ├── visibility toggle
          │   ├── edit button (blue outline)
          │   └── delete button (red outline)
          └── ace-editor
              ├── normal mode (VSCode-like)
              └── readonly mode (grayed background)
  ```
- Editor customization:
  ```css
  /* Editor states */
  .ace_editor {
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 14px;
    line-height: 1.5;
  }
  
  .ace_editor.readonly {
    background-color: #f8f9fa;
    opacity: 0.9;
  }
  
  /* Hide cursor in readonly */
  .ace_editor.readonly .ace_cursor {
    display: none !important;
  }
  ```

### Form Component (`/src/frontend/js/form.jsx`)
- Two-step configuration process:
  1. Basic Configuration:
     - Switch model selection (dynamic from profiles)
     - Switch quantities
     - Port configurations
  2. Serial Number Entry:
     - Pre-populated with "TODO"
     - One field per switch
     - Validates input format
- State Management:
  - Maintains form data across steps
  - Updates serial numbers when topology changes
  - Validates input combinations
- Switch Model Selection:
  - Dynamically loads supported models
  - Converts profile names to display format
  - Groups by vendor (Dell, Celestica, etc.)

## Metal Architecture

### Overview
Metal is a network fabric configuration generator that creates Kubernetes CRD objects for the Hedgehog Wiring Diagram API. It provides a multi-step form interface for users to specify their desired network topology and generates the appropriate configuration objects.

### Core Components

#### 1. Form Component
The form component manages the user input workflow through multiple steps:

##### Step 1: Basic Configuration
- Switch counts and models
- Port breakout configurations
- VLAN and IP ranges
- Fabric port distribution settings

##### Step 2: Serial Numbers
- Input for switch serial numbers
- Default "TODO" values provided
- Validation for serial format
- Back navigation support

##### Step 3: Configuration Editor
- YAML-style editing interface
- Objects grouped by kind
- Card-based visual organization
- Inline value editing
- Back navigation to serial input

##### Step 4: Final Configuration
- Complete YAML display
- Download functionality
- Back navigation to editor
- Configuration review

#### 2. Configuration Generator

##### Switch Object Generation
```javascript
{
  apiVersion: 'wiring.githedgehog.com/v1beta1',
  kind: 'Switch',
  metadata: {
    name: generateSwitchName(model, index)
  },
  spec: {
    profile: model,
    role: 'spine|leaf',
    serial: serial,
    portGroupSpeeds: {...},
    portBreakouts: {...}  // optional
  }
}
```

##### Connection Object Generation
```javascript
{
  apiVersion: 'wiring.githedgehog.com/v1beta1',
  kind: 'Connection',
  metadata: {
    name: `${spineName}--fabric--${leafName}`
  },
  spec: {
    fabric: {
      links: [{
        spine: { port: `${spineName}/E1/${spinePort}` },
        leaf: { port: `${leafName}/E1/${leafPort}` }
      }]
    }
  }
}
```

##### Port Distribution Algorithm
1. Calculate ports needed per spine:
   ```javascript
   portsPerSpine = totalLeaves * uplinksPerLeaf / numSpines
   ```

2. Distribute ports evenly:
   ```javascript
   spinePort = leafIndex * uplinksPerSpine + i + 1
   leafPort = 49 + (spineIndex * uplinksPerSpine * 2) + (i * 2)
   ```

3. Validate distribution:
   - Check port availability
   - Verify speed compatibility
   - Ensure even distribution

#### 3. SwitchProfileManager

##### Profile Loading
- Loads supported switch models
- Validates profile compatibility
- Manages model normalization
- Provides port capabilities

##### Model Name Processing
1. Convert to lowercase
2. Remove vendor prefixes/suffixes
3. Normalize format
4. Generate consistent names

#### 4. Port Allocation Rules

##### Rule Structure
```yaml
portRanges:
  - name: "fabric"
    first: 49
    count: 8
    speed: "100G"
    breakoutCapable: true
    allowedBreakouts: ["4x25G", "2x50G", "1x100G"]
```

##### Port Assignment
1. Load port ranges from rules
2. Validate against profile
3. Apply breakout configuration
4. Generate port names

## State Management

### Form State
```javascript
const [formData, setFormData] = useState({
  topology: {
    spines: { model, count, fabricPortConfig },
    leaves: { model, count, fabricPortsPerLeaf, ... }
  },
  switchSerials: {},
  vlanNamespace: { ranges: [{ from, to }] },
  ipv4Namespaces: [{ subnets: [] }]
});
```

### Navigation State
```javascript
const [showSerialInput, setShowSerialInput] = useState(false);
const [showConfigEditor, setShowConfigEditor] = useState(false);
const [editedConfig, setEditedConfig] = useState(null);
```

### Configuration State
```javascript
const [generatedConfig, setGeneratedConfig] = useState(null);
const [editedConfig, setEditedConfig] = useState(null);
```

## Validation Framework

### Input Validation
- Switch model compatibility
- Port count validation
- Serial number format
- VLAN range checks

### Configuration Validation
- Port distribution rules
- Connection completeness
- Object structure
- Name consistency

### Error Handling
- User-friendly messages
- State preservation
- Recovery options
- Detailed logging

## Port Assignment Logic

### Validation Rules
1. Fabric Design Requirements:
   - Each leaf must connect to all spine switches
   - Minimum uplinks per leaf = number of spine switches
   - All leaf switches must have equal spine connections
   - Uplinks must be evenly distributed across spines
   - Port counts must account for breakout configurations

2. Port Distribution Rules:
   - Each leaf gets dedicated port range on spines
   - Leaf ports are assigned in pairs (49,51,53,55)
   - Spine ports are sequential within each leaf's range
   - Port assignments must be deterministic

3. Switch Compatibility:
   - Models must support required port speeds
   - Must have sufficient ports for topology
   - Port breakout configurations must be compatible

### Port Assignment Algorithm
1. Fabric Ports:
   - Start with lowest valid fabric port number
   - Consider breakout configurations
   - Example: With 4x25G breakout, one physical port provides 4 logical uplinks

2. Server Ports:
   - Start with lowest available valid server port
   - Skip ports already assigned as fabric ports
   - Distribute evenly across leaf switches
   - Consider breakout configurations

## Breakout Handling
1. Impact on Port Capacity:
   - Physical ports can provide multiple logical ports
   - Speed determined by breakout type
   - Must track both physical and logical port assignments

2. Port Naming:
   - Different naming schemes for breakout vs non-breakout
   - Must use correct format for target platform (SONiC)
   - Reference switch profile for naming logic

3. Breakout Types:
   - 4x25G: One 100G port into four 25G ports
   - 2x50G: One 100G port into two 50G ports
   - Must validate speed compatibility with switch model

## Configuration Output Format
```javascript
{
  metadata: {
    generatedAt: string,
    version: string
  },
  fabric: {
    name: string,
    description: string,
    switches: {
      leaves: Array<{
        id: string,
        model: string,
        ports: {
          fabric: Array<PortConfig>,
          server: Array<PortConfig>
        }
      }>,
      spines: Array<{
        id: string,
        model: string,
        ports: {
          fabric: Array<PortConfig>
        }
      }>
    }
  }
}
```

## Testing Considerations
1. Test with various breakout configurations
2. Validate edge cases in port assignments
3. Verify port overlap handling
4. Test different spine/leaf quantities
5. Verify even distribution of server ports

## Important Files to Review
1. Switch Profiles: Review all files in `/switch_profiles/` to understand model capabilities
2. PAR Rules: Check `/src/frontend/port_allocation_rules/` for port rules
3. Core Logic: 
   - `switchProfileManager.js`: Profile handling
   - `portAssignmentManager.js`: Port assignment logic
   - `configGenerator.js`: Configuration generation
4. Tests: Review test files for examples of expected behavior
