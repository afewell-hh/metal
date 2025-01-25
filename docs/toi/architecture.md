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

## Port Assignment Logic

### Validation Rules
1. Fabric Design Requirements:
   - Each leaf must connect to all spine switches
   - Minimum uplinks per leaf = number of spine switches
   - All leaf switches must have equal spine connections
   - Port counts must account for breakout configurations

2. Switch Quantity Validation:
   - Spine/leaf quantities need not be even numbers
   - Key formula: total_fabric_connections = num_leaves * uplinks_per_leaf
   - Must validate against available ports considering breakout modes

3. Port Capacity Validation:
   - Must consider both fabric and server port requirements
   - Account for breakout configurations in capacity calculations
   - Example: 4x25G breakout creates 4 logical ports from 1 physical port

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

## Development Guidelines
1. Always validate against switch profiles before making port assignments
2. Consider breakout configurations in all port calculations
3. Maintain clear separation between physical and logical port tracking
4. Keep PAR rules updated with accurate port ranges
5. Document complex logic in code comments
6. Make frequent, well-documented git commits

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
