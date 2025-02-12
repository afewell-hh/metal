# Metal Implementation State

## Completed Features

### Configuration Generation
- Switch serial number management in form and config
  * Serial numbers stored by generated switch names (e.g., s5232-01)
  * Added to switch objects in boot.serial field
  * Form preserves serials during topology changes
- Switch naming standardization
  * Vendor-specific naming rules (e.g., dell-s5232f-on -> s5232-01)
  * Consistent zero-padded indexing
  * Standalone name generation function
- Port naming and assignment with proper validation
- Network configuration field generation
- Server port configuration and assignment:
  * Port profile analysis for server port identification
  * Breakout mode validation and support
  * Even distribution across leaf switches
  * Port naming with breakout subports
  * Port availability tracking per switch
- Server connection object generation:
  * Support for all connection types (unbundled-SH, bundled-LAG-SH, bundled-mclag, bundled-eslag)
  * Proper server port naming (enp2s{N})
  * Switch port allocation from port allocation rules
  * Connection object naming following Hedgehog conventions
  * Proper metadata.name field generation
  * Links array structure with server and switch endpoints

### Form Components
- Multi-step form workflow:
  1. Basic Configuration (switch counts, models, etc.)
  2. Serial Number Input (using generated switch names)
  3. Configuration Editor
  4. Final Configuration Display
- State preservation between steps
- Back navigation with state retention
- Dynamic model selection from SwitchProfileManager
- Validation for port counts and distributions

### User Interface
- YAML editor-based configuration editor with:
  * Readonly by default with edit toggle
  * VSCode-like styling and colors
  * Proper indentation (2 spaces per level)
  * Full YAML structure editing
  * Syntax validation
  * Line numbers and highlighting
- Card-based layout for object types
- Visual section separation with:
  * Section headers with "Add Object" buttons
  * Light gray section backgrounds
  * White object cards with shadows
- Download generated configuration
- Navigation between all steps
- VSCode-like styling for YAML keys
- Proper indentation (2 spaces per level)
- Array items with bullet points
- Empty object display as "{}"
- Monospace font for all fields
- Horizontal scrolling for wide content
- Responsive form layout:
  * Fields wrap to new rows when needed
  * Minimum field width prevents squeezing
  * Proper spacing and alignment
  * Clear field labels and sections
  * Vertical stacking for serial number inputs
  * Consistent spacing between form sections

## In Progress Features

### Configuration Validation
- Switch model compatibility checking
- Port speed validation
- Breakout configuration validation
- VLAN range overlap detection

### Advanced Features
- MCLAG support
- ESLAG support
- External connection support
- Advanced network configuration

## Known Issues

### Configuration Generation
- Need to validate switch model compatibility
- Need to implement MCLAG support
- Need to add comprehensive network configuration fields
- Need to validate breakout configurations

### User Interface
- Need to add form validation error messages
- Need to add loading states for async operations
- Need to add confirmation for destructive actions
- Need to improve empty state handling for arrays
- Need to implement field-level validation with error messages
- Need to add visual indicators for required fields

## Critical Dependencies

### SwitchProfileManager
- Required for switch model validation
- Manages supported switch profiles
- Handles model name normalization
- Must be initialized before form render

### Port Allocation Rules
- Defines valid port ranges
- Specifies breakout capabilities
- Controls port numbering scheme
- Must match physical switch capabilities

## Component Architecture

### Form Component
- Manages multi-step form state
- Handles navigation between steps
- Preserves state during navigation
- Coordinates with ConfigGenerator

### ConfigEditor Component
- Uses react-ace for YAML editing
- Renders K8s objects in exact YAML format
- Provides inline YAML editing with edit/readonly toggle
- Maintains object structure and order
- Groups objects by kind
- Handles both array and object input formats
- Uses internal state for visibility (_isVisible)
- Preserves proper YAML field order
- Adds new objects to top of sections
- Object templates:
  ```javascript
  {
    IPv4Namespace: {
      apiVersion: 'vpc.githedgehog.com/v1beta1',
      kind: 'IPv4Namespace',
      metadata: { name: '' },
      spec: { subnets: [''] }
    },
    VLANNamespace: {
      apiVersion: 'vpc.githedgehog.com/v1beta1',
      kind: 'VLANNamespace',
      metadata: { name: '' },
      spec: {
        ranges: [{
          from: '',
          to: ''
        }]
      }
    },
    Switch: {
      apiVersion: 'wiring.githedgehog.com/v1beta1',
      kind: 'Switch',
      metadata: { name: '' },
      spec: {
        boot: { mac: '' },
        profile: '',
        role: '',
        description: '',
        portBreakouts: {},
        serial: ''
      }
    },
    Connection: {
      apiVersion: 'wiring.githedgehog.com/v1beta1',
      kind: 'Connection',
      metadata: { name: '' },
      spec: {
        fabric: {
          links: [{
            spine: { port: '' },
            leaf: { port: '' }
          }]
        }
      }
    }
  }
  ```

### PortProfileAnalyzer
- Analyzes switch profiles for port capabilities
- Identifies server and fabric ports
- Validates breakout mode support
- Key methods:
  ```javascript
  class PortProfileAnalyzer {
    // Get all available server ports
    getServerPorts() {
      // Returns array of ports with profile info
      return [{
        name: string,          // Port name (e.g., "Ethernet1")
        profile: Object,       // Port profile with speed and breakout info
        portConfig: Object     // Port-specific configuration
      }];
    }

    // Get breakout capabilities for a port
    getBreakoutInfo(portName) {
      // Returns breakout mode info
      return {
        isFixed: boolean,           // True if port doesn't support breakout
        breakoutModes: string[],    // Supported breakout modes
        defaultMode: string         // Default breakout mode
      };
    }

    // Get next available server port
    getNextAvailablePort(usedPorts, breakoutMode) {
      // Returns port name or throws if none available
      return string;
    }

    // Get proper port name with breakout
    getPortName(basePort, breakoutMode, subPort) {
      // Returns formatted port name (e.g., "Ethernet1/1" for breakout)
      return string;
    }
  }
  ```

### ConnectionDistributor
- Manages server connection distribution
- Handles different connection types:
  * Single connections
  * LAG bundles
  * MCLAG configurations
  * ESLAG setups
- Key methods:
  ```javascript
  class ConnectionDistributor {
    // Get leaf switches for server connections
    getLeafSwitchesForServer(configType, connectionsPerServer, startIndex) {
      // Returns array of leaf switch names
      return string[];
    }
  }
  ```

### ConfigGenerator
- Generates K8s objects
- Handles port distribution
- Manages switch naming
- Creates fabric connections

## Data Flow

### Form State
```javascript
{
  topology: {
    spines: {
      model: string,
      count: number,
      fabricPortConfig: {
        breakout: string | null
      }
    },
    leaves: {
      model: string,
      count: number,
      fabricPortsPerLeaf: number,
      fabricPortConfig: {
        breakout: string | null
      },
      totalServerPorts: number,
      serverPortConfig: {
        breakout: string | null
      }
    }
  },
  switchSerials: {
    [switchName: string]: string
  },
  vlanNamespace: {
    ranges: [{
      from: number,
      to: number
    }]
  },
  ipv4Namespaces: [{
    subnets: string[]
  }]
}
```

### Server Port Configuration
```javascript
{
  serverConfig: {
    serverConfigType: string,     // 'single', 'lag', 'mclag', 'eslag'
    connectionsPerServer: number, // Number of connections per server
    breakoutType: string,         // 'Fixed', '1x25G', '4x25G', etc.
    serverCount: number          // Total number of servers to connect
  }
}
```

### Port Assignment State
```javascript
{
  usedPorts: {
    [switchName: string]: string[]  // Array of used port names per switch
  },
  portAssignments: {
    [serverName: string]: {
      [leafName: string]: string    // Port name assigned on each leaf
    }
  }
}
```

### Configuration Objects
Generated objects follow Hedgehog Wiring Diagram API:
- Switch objects with profile, role, ports
- Connection objects for fabric links
- VLANNamespace for VLAN ranges
- IPv4Namespace for subnets

## Validation Rules

### Port Distribution
- Uplinks must be evenly distributed across spines
- Port counts must match switch capabilities
- Port speeds must be compatible
- Breakout modes must be supported

### Configuration Structure
- Switch names must follow naming convention
- Port names must match device names
- VLAN ranges cannot overlap
- Fabric connections must be complete

## User Workflow

1. Basic Configuration
   - Enter switch counts and models
   - Configure port breakouts
   - Specify VLAN and IP ranges

2. Serial Number Input
   - Enter or use default serials
   - Can return to basic config

3. Configuration Editor
   - Edit generated objects
   - YAML-style interface
   - Grouped by object type
   - Can return to serial input

4. Final Configuration
   - Review complete config
   - Download YAML file
   - Can return to editor

## Future Enhancements

### Planned Features
- MCLAG configuration
- External connections
- Network policy generation
- Advanced validation rules

### UI Improvements
- Real-time validation
- Error highlighting
- Auto-completion
- Configuration templates

## Development Guidelines

### Code Organization
- React components in `frontend/js`
- CSS in `frontend/css`
- Configuration logic in separate modules
- Validation in dedicated functions

### State Management
- Form state preserved during navigation
- Configuration state separate from form
- Editor state tracks modifications
- Navigation state controls workflow

### Error Handling
- Validate inputs before generation
- Preserve state on error
- Show user-friendly messages
- Allow error recovery

### Testing Strategy
- Unit tests for generation logic
- Integration tests for workflow
- Validation tests for configs
- UI component tests

## Dependencies
- react-ace: YAML editor component
- ace-builds: Core ACE editor
- js-yaml: YAML parsing and validation
