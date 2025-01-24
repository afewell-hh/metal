# HH-Metal (Hedgehog Configuration Generator)

A tool to simplify the generation of Hedgehog network fabric configurations.

## Overview

HH-Metal helps network engineers generate Kubernetes manifest files needed for Hedgehog fabric installation by deriving complex configuration details from a minimal set of user inputs. It supports both spine-leaf and collapsed core topologies.

## Features

- Spine-leaf topology configuration generation
- Automatic port assignment optimization
- Built-in validation rules
- Network topology visualization
- Physical connection diagrams for cabling teams

## Development

### Prerequisites

- Node.js 18+
- Python 3.9+
- AWS Lambda (or other FaaS provider) account
- HubSpot CMS access

### Local Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test
```

## Architecture

- Frontend: HubSpot CMS
- Backend: Serverless Functions
- Configuration: Kubernetes manifests

## License

MIT
