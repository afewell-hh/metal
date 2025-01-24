# API Specification

## Overview
RESTful API for Hedgehog configuration generation. All endpoints return JSON and accept JSON for POST requests.

## Base URL
`/api/v1`

## Endpoints

### Switch Profiles
```plaintext
GET /switch-profiles
Description: Get list of available switch profiles
Response: {
    "profiles": [
        {
            "model": "dell-s5248f-on",
            "description": "Dell S5248F-ON",
            "standardPorts": ["1-48"],
            "uplinkPorts": ["49-56"],
            "breakoutCapabilities": [...]
        }
    ]
}
```

### Generate Configuration
```plaintext
POST /config/generate
Description: Generate network configuration based on user inputs
Request:
{
    "topology": "spine-leaf" | "collapsed-core",
    "spineLeaf": {
        "leafModel": "dell-s5248f-on",
        "spineModel": "dell-s5232f-on",
        "leafCount": 4,
        "spineCount": 2,
        "uplinksPerLeaf": 4,
        "serverCount": 96  // optional
    } | 
    "collapsedCore": {
        "switchModel": "dell-s5248f-on",
        "coreLinks": 4,
        "serverCount": 48  // optional
    }
}
Response: {
    "manifests": {
        "wiring": [...],
        "fabric": [...],
        "control": [...]
    },
    "validation": {
        "status": "valid",
        "warnings": []
    }
}
```

### Validate Configuration
```plaintext
POST /validate
Description: Validate configuration inputs
Request: {
    // Same as generate configuration request
}
Response: {
    "valid": true,
    "errors": [],
    "warnings": [
        {
            "type": "port_usage",
            "message": "High port utilization on leaf switches",
            "details": {...}
        }
    ]
}
```

## Error Handling
All endpoints follow standard HTTP status codes:
- 200: Success
- 400: Bad Request (invalid input)
- 422: Unprocessable Entity (valid input but cannot be processed)
- 500: Server Error

Error response format:
```json
{
    "error": {
        "code": "INVALID_INPUT",
        "message": "Detailed error message",
        "details": {}
    }
}
```

## Validation Rules

### Spine-Leaf Validation
```typescript
interface SpineLeafValidation {
    // Required valid port counts
    leafPorts: {
        required: number;  // servers + uplinks
        available: number;
    };
    spinePorts: {
        required: number;  // total leaf uplinks
        available: number;
    };
}
```

### Collapsed Core Validation
```typescript
interface CollapsedCoreValidation {
    // Required valid port counts
    corePorts: {
        required: number;  // core links + servers
        available: number;
    };
}
```

## Generated Configuration Examples

### Spine-Leaf Example
```yaml
switches:
  leaf-1:
    model: dell-s5248f-on
    uplinks:
      - to: spine-1
        ports: [49, 50]
      - to: spine-2
        ports: [51, 52]
    servers: ["server-1", "server-2"]  # Auto-generated if serverCount provided

  spine-1:
    model: dell-s5232f-on
    downlinks:
      - to: leaf-1
        ports: [1, 2]
      - to: leaf-2
        ports: [3, 4]
```

### Collapsed Core Example
```yaml
switches:
  core-1:
    model: dell-s5248f-on
    peer_links:
      - to: core-2
        ports: [49, 50, 51, 52]
    servers: ["server-1", "server-2"]  # Auto-generated if serverCount provided

  core-2:
    model: dell-s5248f-on
    peer_links:
      - to: core-1
        ports: [49, 50, 51, 52]
    servers: ["server-3", "server-4"]  # Auto-generated if serverCount provided
```

## Rate Limiting
- 100 requests per minute per IP
- 429 Too Many Requests response when exceeded

## Input Validation Examples

### Valid Spine-Leaf Input
```json
{
    "topology": "spine-leaf",
    "spineLeaf": {
        "leafModel": "dell-s5248f-on",
        "spineModel": "dell-s5232f-on",
        "leafCount": 4,
        "spineCount": 2,
        "uplinksPerLeaf": 4,
        "serverCount": 96
    }
}
```

### Valid Collapsed Core Input
```json
{
    "topology": "collapsed-core",
    "collapsedCore": {
        "switchModel": "dell-s5248f-on",
        "coreLinks": 4,
        "serverCount": 48
    }
}
```