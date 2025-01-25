# Current Implementation State

## Project Status Overview
Metal is a network fabric configuration generator that takes user inputs about desired topology and generates appropriate switch configurations. The project is in active development with core functionality in place and several key features in progress.

## Core Architecture
The application follows a modular design with clear separation of concerns:
1. Frontend UI for user input
2. Profile management for switch capabilities
3. Port allocation and validation
4. Configuration generation

## Completed Features

### 1. Frontend Structure
- React-based form components for user input
- Vite development server configuration
- Static file serving for profiles and rules
- Basic error handling and user feedback

### 2. Profile Management
- Go profile parsing implementation
- Support for profile inheritance
- Port rule validation
- Profile initialization checks
- Error handling for missing files

### 3. Port Rules
- YAML-based port rule definition
- Support for overlapping port ranges
- Port validation against profiles
- Management port handling

### 4. Configuration Generation
- Basic structure implemented
- Port assignment framework
- Validation checks
- Output format defined

## In Progress Features

### 1. Port Assignment Logic
- Need to implement:
  - Breakout handling
  - Port capacity validation
  - Port distribution algorithm
  - Speed determination from profiles

### 2. Configuration Generation
- Need to enhance:
  - Breakout support
  - Comprehensive validation
  - Error reporting
  - Configuration versioning

### 3. Testing Infrastructure
- Need to add:
  - Unit tests for core components
  - Integration tests for configuration generation
  - Validation test cases
  - Edge case coverage

## Known Issues

### 1. Profile Loading
- Requires specific file structure
- Error handling needs improvement
- Better feedback for missing files needed
- Profile inheritance edge cases

### 2. Validation
- Basic port validation only
- Need fabric design validation
- Need capacity checks
- Breakout validation missing

### 3. Error Handling
- Some error messages need improvement
- Stack traces not properly captured
- User feedback could be more detailed
- Async error handling needs work

## Critical Dependencies
1. Frontend:
   - React for UI components
   - Vite for development server
   - js-yaml for YAML parsing

2. Backend Dependencies:
   - Go profiles from switch definitions
   - YAML port allocation rules
   - SONiC configuration templates

## Next Steps

### 1. Immediate Priorities
- Implement comprehensive port assignment logic
- Add breakout configuration support
- Enhance validation rules
- Improve error handling

### 2. Medium-term Goals
- Add unit tests for core functionality
- Implement configuration versioning
- Add profile validation
- Enhance user feedback

### 3. Long-term Goals
- Add configuration preview
- Support for more switch models
- Enhanced error reporting
- Performance optimizations

## Recent Changes

### 1. Profile Management
- Updated SwitchProfileManager to handle Go profiles
- Added proper initialization checks
- Improved error handling
- Added profile inheritance support

### 2. Port Assignment
- Implemented basic port assignment logic
- Added validation framework
- Support for overlapping ports
- Prepared for breakout support

### 3. Configuration
- Updated Vite config for proper file serving
- Added static file handling
- Improved development workflow
- Enhanced error reporting

## Development Guidelines

### 1. Code Organization
- Keep components modular
- Document complex logic
- Use TypeScript where possible
- Follow React best practices

### 2. Testing
- Write tests for new features
- Cover edge cases
- Test error conditions
- Validate configurations

### 3. Documentation
- Update TOI documents
- Document complex logic
- Keep README current
- Add inline documentation

## Getting Started
1. Review `architecture.md` for system overview
2. Examine switch profiles in `/switch_profiles/`
3. Check port rules in `/src/frontend/port_allocation_rules/`
4. Review core logic in `/src/frontend/js/`

## Common Workflows
1. Adding new switch model:
   - Create Go profile
   - Add PAR rules
   - Update profile manager
   - Add validation tests

2. Modifying port assignment:
   - Update `portAssignmentManager.js`
   - Modify validation rules
   - Update configuration generator
   - Add test cases

3. Debugging issues:
   - Check browser console
   - Verify profile loading
   - Validate port rules
   - Review error logs
