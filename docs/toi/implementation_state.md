# Metal Implementation State

## Completed Features

### Configuration Generation
- Switch serial number management in form and config
- Proper fabric port distribution across spines
- Dynamic switch model selection from profiles
- Kubernetes CRD object generation with correct metadata
- Port naming and assignment with proper validation
- Switch name generation with vendor normalization
- Network configuration field generation

### Form Components
- Multi-step form workflow:
  1. Basic Configuration (switch counts, models, etc.)
  2. Serial Number Input
  3. Configuration Editor
  4. Final Configuration Display
- State preservation between steps
- Back navigation with state retention
- Dynamic model selection from SwitchProfileManager
- Validation for port counts and distributions

### User Interface
- YAML-style configuration editor
- Card-based layout for object types
- Visual section separation
- Editable fields within YAML structure
- Download generated configuration
- Navigation between all steps

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
- Renders K8s objects in YAML format
- Provides inline editing capability
- Maintains object structure
- Groups objects by kind

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
