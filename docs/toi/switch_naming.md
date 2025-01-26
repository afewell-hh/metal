# Switch Naming Conventions

## Overview
The Metal project uses a consistent naming scheme for switches that ensures uniqueness and readability while maintaining compatibility with the Hedgehog Wiring Diagram API. This document details the naming rules and provides examples for all supported switch types.

## Naming Rules

### 1. Base Rules
- Names must be unique within the configuration
- Names must be valid Kubernetes resource names
- Format: `{model-prefix}-{index}`
- Index is zero-padded to 2 digits (e.g., "01", "02")

### 2. Model Name Processing
1. Input Processing:
   ```javascript
   // 1. Convert to lowercase
   model = model.toLowerCase()
   // 2. Remove hyphens
   model = model.replace(/-/g, '')
   ```

2. Vendor Prefix/Suffix Removal:
   ```javascript
   // Remove vendor names and suffixes
   model = model
     .replace('dell', '')
     .replace('celestica', '')
     .replace('edgecore', '')
     .replace('supermicro', '')
     .replace('on', '')
   ```

### 3. Examples by Vendor

#### Dell Switches
- Input: `dell-s5232f-on`
  - Processing: dell-s5232f-on → s5232f → s5232
  - Result: `s5232-01`, `s5232-02`, etc.
- Input: `dell-s5248f-on`
  - Processing: dell-s5248f-on → s5248f → s5248
  - Result: `s5248-01`, `s5248-02`, etc.
- Input: `dell-z9332f-on`
  - Processing: dell-z9332f-on → z9332f → z9332
  - Result: `z9332-01`, `z9332-02`, etc.

#### Celestica Switches
- Input: `celestica-ds3000`
  - Processing: celestica-ds3000 → ds3000
  - Result: `ds3000-01`, `ds3000-02`, etc.
- Input: `celestica-ds4000`
  - Processing: celestica-ds4000 → ds4000
  - Result: `ds4000-01`, `ds4000-02`, etc.

#### Edgecore Switches
- Input: `edgecore-dcs203`
  - Processing: edgecore-dcs203 → dcs203
  - Result: `dcs203-01`, `dcs203-02`, etc.
- Input: `edgecore-dcs204`
  - Processing: edgecore-dcs204 → dcs204
  - Result: `dcs204-01`, `dcs204-02`, etc.
- Input: `edgecore-dcs501`
  - Processing: edgecore-dcs501 → dcs501
  - Result: `dcs501-01`, `dcs501-02`, etc.
- Input: `edgecore-eps203`
  - Processing: edgecore-eps203 → eps203
  - Result: `eps203-01`, `eps203-02`, etc.

#### Supermicro Switches
- Input: `supermicro-sse-c4632`
  - Processing: supermicro-sse-c4632 → ssec4632
  - Result: `ssec4632-01`, `ssec4632-02`, etc.

## Usage in Configuration

### 1. Switch Objects
```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Switch
metadata:
  name: ds4000-01  # Generated switch name
spec:
  profile: celestica-ds4000  # Original model name
  role: spine
```

### 2. Connection Objects
```yaml
apiVersion: wiring.githedgehog.com/v1beta1
kind: Connection
metadata:
  name: ds4000-01--fabric--ds3000-01  # Generated connection name
spec:
  fabric:
    links:
      - spine:
          port: ds4000-01/E1/1  # Generated port name
        leaf:
          port: ds3000-01/E1/49  # Generated port name
```

## Important Notes
1. The naming scheme is deterministic - the same input will always produce the same output
2. Names are designed to be human-readable while maintaining uniqueness
3. Port names incorporate the generated switch names for consistency
4. Connection names are derived from the switches they connect
5. All generated names are compatible with Kubernetes resource naming rules
