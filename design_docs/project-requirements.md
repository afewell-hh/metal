# Hedgehog Config Generator - Project Requirements Document

## Project Overview
A web-based tool to simplify the generation of Hedgehog network fabric configurations. The tool will automate the creation of kubernetes manifest files needed for Hedgehog fabric installation by deriving complex configuration details from a minimal set of user inputs.

## Business Goals
1. Simplify the configuration process for network engineers
2. Reduce manual input errors
3. Speed up deployment preparation time
4. Create foundation for future automation capabilities

## Technical Goals
1. Serverless/static web architecture where possible
2. Modern, maintainable tech stack
3. Easy to enhance with future capabilities
4. Leverage LLMs for ongoing development support

## Tech Stack Recommendation
- Frontend: Next.js (React)
  - TypeScript for type safety
  - Tailwind CSS for styling
  - Deployed as static site where possible
- Backend: Python FastAPI
  - FastAPI for modern async API development
  - Pydantic for data validation
  - Deployed as serverless functions
- Infrastructure
  - Vercel/Netlify for frontend hosting
  - Vercel/AWS Lambda for backend functions
  - Consider SQLite or PostgreSQL (via managed service) if needed

## Core Features - Phase 1

### Input Collection
1. Basic Requirements Input
   - Total number of server ports needed
   - Desired oversubscription ratio
   - Switch model selection
   - Basic network parameters

2. Manual Input Form
   - Switch serial numbers
   - Management network details
   - Credentials/SSH keys

### Automated Generation
1. Topology Generation
   - Calculate required number of switches
   - Generate port assignments
   - Create connection mappings

2. Configuration Generation
   - Generate all required kubernetes manifests
   - Create wiring diagrams
   - Produce inventory lists

### Validation
1. Input Validation
   - Validate physical feasibility
   - Check port compatibility
   - Verify bandwidth calculations

2. Output Validation
   - Ensure all required fields are populated
   - Verify manifest syntax
   - Check for common configuration errors

## Future Phases
1. Enhanced Automation
   - Template library for common configurations
   - Automatic serial number discovery
   - Integration with external systems

2. Advanced Features
   - Visual topology editor
   - Configuration versioning
   - Collaborative editing

## Success Criteria
1. Can generate complete, valid configuration from minimal inputs
2. Reduces configuration time by at least 50%
3. Eliminates common configuration errors
4. Provides clear validation feedback
5. Easy to use interface