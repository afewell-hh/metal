# Server Configuration Implementation Plan

## Phase 1: Server Object Generation
Status: Complete 

### 1.1 Server Distribution Logic
- [x] Implement logic to evenly distribute servers across leaf switches
- [x] Add validation to ensure server count is valid for leaf count
- [x] Create server naming function (server-1, server-2, etc.)
- [x] Map servers to specific leaf switches

### 1.2 Server Object Templates
- [x] Create templates for Server objects based on configuration type:
  - [x] unbundled-SH
  - [x] bundled-LAG-SH
  - [x] bundled-mclag
  - [x] bundled-eslag
- [x] Implement description field generation based on connection type

## Phase 2: Port Allocation Logic
Status: Complete 

### 2.1 Port Profile Analysis
- [x] Create function to analyze switch profile for valid server ports
- [x] Implement logic to determine if ports have profiles or are fixed
- [x] Extract supported breakout modes from port profiles
- [x] Validate port allocation rules against switch profiles

### 2.2 Port Assignment
- [x] Implement logic to allocate fabric ports first
- [x] Create function to find first available server port
- [x] Add port naming logic based on breakout type
- [x] Ensure proper port distribution for multi-connection servers

## Phase 3: Connection Object Generation
Status: Complete 

### 3.1 Connection Templates
- [x] Create templates for Connection objects:
  - [x] unbundled.link structure
  - [x] bundled.links structure
  - [x] mclag.links structure
  - [x] eslag.links structure
- [x] Implement server port naming convention (enp2s1, enp2s2, etc.)
- [x] Add switch port naming based on breakout types

### 3.2 Connection Distribution
- [x] Implement logic for distributing multiple connections:
  - [x] Single connection: direct assignment
  - [x] Two connections: split across leaves
  - [x] Four connections: one per leaf
  - [x] Eight connections: two per leaf
- [x] Handle bundled-LAG-SH special case (all to same leaf)

## Phase 4: UI Updates
Status: Complete 

### 4.1 Form Updates
- [x] Add server port configuration type dropdown:
  - [x] unbundled-SH
  - [x] bundled-LAG-SH
  - [x] bundled-mclag
  - [x] bundled-eslag
- [x] Add connections per server dropdown (1,2,4,8)
- [x] Update breakout type dropdown:
  - [x] Dynamic population based on port profile
  - [x] "Fixed" state when appropriate
  - [x] Disable when port has no profile

### 4.2 ConfigEditor Updates
- [x] Add new Server objects section
- [x] Update Connection objects section to include server connections
- [x] Ensure proper ordering (fabric connections before server connections)

## Phase 5: Integration
Status: In Progress 

### 5.1 ConfigGenerator Integration
- [x] Integrate server object generation
- [x] Integrate connection object generation
- [x] Add validation for server/leaf ratio
- [x] Add validation for connection distribution

### 5.2 Testing
Status: Starting 
- [ ] Test server distribution logic
- [ ] Test port allocation logic
- [ ] Test all configuration types
- [ ] Test breakout handling
- [ ] Test multi-connection scenarios
- [ ] Validate generated YAML against examples

## Implementation Notes

### Port Profile Rules
1. Check if port has profile field in switch profile
2. If no profile: Fixed port, disable breakout selection
3. If has profile:
   - Look up profile in PortProfiles
   - Extract supported breakout modes
   - Populate breakout dropdown
   - Use breakout info for port naming

### Connection Distribution Rules
1. Single connection: Assign to primary leaf
2. Multiple connections:
   - bundled-LAG-SH: All to same leaf
   - Others: Distribute across leaves
   - Must be even number (2,4,8)
   - Must not exceed leaf count

### Port Naming Conventions
1. Server ports: Follow example pattern (enp2s1, enp2s2)
2. Switch ports: Based on profile and breakout
3. Connection names: Follow pattern (server-N--type--switch)
