# Metal Architecture and Design Considerations

## Core Components

### Switch Profiles
- Located in `/switch_profiles/`
- Go files containing comprehensive switch specifications
- Contains critical logic for:
  - Port mappings (physical to logical)
  - Breakout configurations
  - Speed capabilities
  - Port naming conventions
  - Platform-specific attributes

### Port Allocation Rules (PAR)
- Located in `/src/frontend/port_allocation_rules/`
- YAML files defining valid port assignments
- Key characteristics:
  - Ports can be valid for multiple roles (fabric/server overlap allowed)
  - Port ranges use inclusive notation (e.g., "1-32")
  - Must be considered alongside breakout configurations

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

## Important Files
- Switch Profiles: `/switch_profiles/profile_*.go`
- PAR Rules: `/src/frontend/port_allocation_rules/*.yaml`
- Frontend Logic: `/src/frontend/js/`
  - `switchProfileManager.js`: Profile parsing and management
  - `portAllocationRules.js`: PAR rule handling
  - `configGenerator.js`: Configuration generation

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
