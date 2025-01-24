# Hedgehog Configuration Generator - Development Summary

## Project Overview
The Hedgehog Configuration Generator is a web application that generates Kubernetes configuration files for network switch configurations. It uses React for the frontend and generates configurations based on user inputs.

## Key Reference Files
- `/reference/wiring-0-base.yaml` and `/reference/wiring-1-spine-leaf.yaml`: These are working example configurations that demonstrate the correct structure and format for the generated configs
- `/src/data/switchProfiles.ts`: Contains switch profile definitions

## Configuration Objects
The generator needs to create several types of Kubernetes objects:

1. **VLANNamespace**
```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: VLANNamespace
metadata:
  name: default
spec:
  ranges:
    - from: 1000
      to: 2999
```

2. **IPv4Namespace**
```yaml
apiVersion: vpc.githedgehog.com/v1beta1
kind: IPv4Namespace
metadata:
  name: default
spec:
  subnets:
    - 10.10.0.0/16
```

3. **Switch Objects**: For both spine and leaf switches
```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Switch
metadata:
  name: [switch-name]
spec:
  boot:
    serial: [serial-number]
  profile: [switch-model]
  role: [spine|leaf]
  description: [description]
```

4. **Connection Objects**: For fabric connections between spines and leaves
```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Connection
metadata:
  name: [spine]--fabric--[leaf]
spec:
  fabric:
    links:
      - spine:
          port: [spine-port]
        leaf:
          port: [leaf-port]
```

## Switch Models and Port Rules

### Dell S5232F-ON (Spine)
- Used as spine switches
- Has QSFP28 ports that support 100G
- Port naming format: E1/[port-number]

### Dell S5248F-ON (Leaf)
- Used as leaf switches
- E1/1-E1/48: Fixed 10Gbase-T ports
- Higher numbered ports support 100G for uplinks
- Port naming format: E1/[port-number]

## Port Allocation Rules
1. Leaf uplink ports start at E1/49
2. Each leaf needs multiple uplinks distributed across spine switches
3. Port speeds must match between connected spine and leaf ports

## Form Data Structure
The form collects:
1. Number and model of spine switches
2. Number and model of leaf switches
3. VLAN range configuration
4. IPv4 subnet configuration
5. Serial numbers for each switch

## Key Implementation Notes
1. Port assignments must be valid according to the switch profiles
2. Each leaf switch must have enough uplink ports to connect to all spine switches
3. Spine switches must have enough ports to connect to all leaf switches
4. Port speeds must be compatible between connected ports

## Files to Review
1. Reference configurations in `/reference/` directory
2. Switch profiles in `/src/data/switchProfiles.ts`
3. Current implementation in:
   - `/src/frontend/js/configGenerator.js`
   - `/src/frontend/js/form.jsx`

## Current Status
- Basic configuration generation is working
- Fabric connections are being generated but need validation against switch profiles
- Port allocation logic needs review to ensure it follows hardware capabilities
- MCLAG configuration has been temporarily removed until core functionality is stable

## Next Steps
1. Validate port assignments against switch profiles
2. Ensure fabric connections use correct ports and speeds
3. Review and potentially restore MSP (Metal Switch Profile) files for port validation rules
4. Add validation for hardware constraints

## Questions to Resolve
1. Confirm correct port numbering scheme for fabric connections
2. Validate port speed compatibility rules
3. Locate or recreate MSP files for port validation

Note: This summary includes only the information I'm confident about based on our previous discussions. Some details may be missing or need verification.
