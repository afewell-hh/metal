# Project Tracking

## Active Development (Last Updated: 2025-01-25)

### Current Sprint
We are implementing the port assignment and validation logic with a focus on proper handling of breakout configurations.

#### In Progress
1. **Port Assignment Logic Enhancement**
   - Implementing breakout configuration support in `portAssignmentManager.js`
   - Adding port speed determination from switch profiles
   - Enhancing validation rules for fabric design
   - Status: Breakout functionality implemented, working on integration
   - Next steps: 
     - Integrate with configuration generator
     - Add unit tests for port assignment logic
     - Complete breakout configuration handling

2. **Configuration Generation**
   - Updating output format to support breakout ports
   - Enhancing validation checks
   - Status: Basic structure in place, needs breakout support
   - Blocked by: Completion of breakout configuration handling

#### Recently Completed
1. **Switch Profile Management**
   - Implemented Go profile parsing
   - Added profile inheritance support
   - Enhanced error handling
   - Added initialization checks

2. **Port Allocation Rules**
   - Implemented YAML-based rule definition
   - Added support for overlapping port ranges
   - Enhanced validation against profiles

#### Immediate Next Tasks
1. Update configuration generator to handle new port assignment format
2. Add validation tests for breakout configurations
3. Implement error handling for breakout-specific scenarios
4. Add integration tests for the complete port assignment flow

## Future Enhancements

### Short-term (Next 2-3 Sprints)
1. **Enhanced Validation**
   - Add comprehensive fabric design validation
   - Implement port capacity checks
   - Add breakout compatibility validation
   - Rationale: Critical for preventing configuration errors

2. **Error Handling Improvements**
   - Enhance error messages
   - Add error recovery suggestions
   - Implement proper async error handling
   - Rationale: Better user experience and debugging

3. **Testing Infrastructure**
   - Add comprehensive test suite
   - Implement integration tests
   - Add performance benchmarks
   - Rationale: Ensure reliability and maintainability

### Medium-term (Next 2-3 Months)
1. **Configuration Preview**
   - Add visual topology preview
   - Show port assignments graphically
   - Provide configuration diff view
   - Rationale: Help users understand generated configurations

2. **Profile Management UI**
   - Add UI for viewing switch profiles
   - Allow profile customization
   - Provide profile comparison
   - Rationale: Easier profile management

3. **Validation Enhancement**
   - Add real-time validation
   - Provide suggested fixes
   - Support custom validation rules
   - Rationale: Prevent errors earlier in the process

### Long-term Vision
1. **Advanced Features**
   - Support for complex topology patterns
   - Custom port allocation strategies
   - Integration with network simulation
   - Rationale: Support more advanced use cases

2. **Automation**
   - CI/CD pipeline integration
   - Automated testing
   - Configuration deployment
   - Rationale: Streamline deployment process

3. **Platform Evolution**
   - Support for additional switch types
   - Custom profile creation
   - Third-party integrations
   - Rationale: Broader platform support

## Key Milestones and Commits

### Latest Milestone: Breakout Configuration Implementation
- Commit: `8d9fdc1` - Implement breakout port assignment
- Commit: `605a10c` - Implement breakout port calculation
- Commit: `a24d20f` - Initial port assignment and validation logic
- Commit: `4fb4ddc` - TOI documentation and profile management

### Previous Milestones
- Basic frontend structure: `<add-commit-hash>`
- Profile management: `<add-commit-hash>`
- Initial configuration generation: `<add-commit-hash>`

## Session Handoff (Updated: 2025-01-25)

### Current Focus
Implementing breakout configuration support in the port assignment system. The core breakout functionality is now implemented, including both port calculation and assignment.

### Key Context
1. **Latest Changes**
   - Implemented comprehensive breakout port assignment logic
   - Added smart breakout mode selection based on speed and port count
   - Updated port assignment data structure to include breakout information
   - Added proper subport identifier generation
   - Modified generatePortAssignments to use new breakout-aware port assignment

2. **Current Implementation State**
   ```javascript
   // Example of current port assignment output
   {
     "leaves": [{
       "switchId": "leaf1",
       "model": "celestica_ds3000",
       "ports": {
         "fabric": [{
           "id": "1",
           "speed": "25G",
           "breakout": "4x25G",
           "subPorts": ["1/1", "1/2", "1/3", "1/4"]
         }],
         "server": [{
           "id": "5",
           "speed": "100G",
           "breakout": null,
           "subPorts": null
         }]
       }
     }]
   }
   ```

3. **Important Decisions Made**
   - Breakout mode selection prioritizes minimizing wasted ports
   - Physical ports are tracked separately from logical ports
   - Port speeds are validated against profile capabilities
   - Subport identifiers follow the format `<physical_port>/<sub_port_number>`

4. **Expected Output Format**
   ```javascript
   // Target configuration format with breakout support
   {
     "leaves": [{
       "switchId": "leaf1",
       "model": "celestica_ds3000",
       "ports": {
         "fabric": [{
           "id": "1",
           "breakout": "4x25G",
           "subPorts": ["1/1", "1/2", "1/3", "1/4"],
           "speed": "25G"
         }],
         "server": [{
           "id": "5",
           "speed": "100G"
         }]
       }
     }]
   }
   ```

### Next Steps
1. Update configuration generator to handle new port assignment format
2. Add validation tests for breakout configurations
3. Implement error handling for breakout-specific scenarios
4. Add integration tests for the complete port assignment flow

### Current UI State
```
[Insert screenshot or ASCII diagram showing current UI state]
Form inputs:
- Leaf switch model dropdown
- Spine switch model dropdown
- Number of leaf switches
- Number of spine switches
- Uplinks per leaf
- Total server ports
```

### Known Issues
1. Breakout configuration not yet supported in configuration generator
2. Port speed determination pending
3. Need more comprehensive validation

### Helpful Resources
1. Switch Profiles: `/switch_profiles/profile_celestica_ds3000.go`
2. PAR Rules: `/src/frontend/port_allocation_rules/celestica_ds3000.yaml`
3. Core Logic: `/src/frontend/js/portAssignmentManager.js`

## Design Considerations

### Current Implementation Impact on Future Features
1. **Port Assignment**
   - Current design separates port validation from assignment
   - Allows future addition of custom assignment strategies
   - Breakout support being added with future expansion in mind

2. **Configuration Generation**
   - Output format designed for future extensions
   - Modular approach allows adding new features
   - Validation framework can be extended

3. **Profile Management**
   - Inheritance system supports future profile types
   - Extensible validation framework
   - Prepared for UI integration

## Technical Debt Tracking

### Current Technical Debt
1. **Error Handling**
   - Some error messages need improvement
   - Async error handling needs work
   - Priority: Medium

2. **Testing**
   - Missing unit tests for new features
   - Need integration tests
   - Priority: High

3. **Documentation**
   - Some complex logic needs better documentation
   - API documentation incomplete
   - Priority: Medium

### Planned Refactoring
1. **Port Assignment Logic**
   - Extract breakout handling to separate class
   - Improve validation organization
   - Timeline: After current sprint

2. **Configuration Generator**
   - Modularize output generation
   - Add plugin system for extensions
   - Timeline: Medium-term

## TOI Maintenance Guidelines

### Overview
The Transfer of Information (TOI) documents are critical for maintaining project continuity across different development sessions. These documents must be treated as living documentation that evolves with the project.

### TOI Structure
1. **architecture.md**
   - Contains core architectural concepts
   - Documents design decisions
   - Explains component relationships
   - Update when:
     - Adding new components
     - Changing architectural decisions
     - Modifying core workflows
     - Adding new file types or structures

2. **implementation_state.md**
   - Tracks current implementation status
   - Lists known issues
   - Documents dependencies
   - Update when:
     - Completing features
     - Finding new issues
     - Adding dependencies
     - Changing implementation details

3. **project_tracking.md**
   - Tracks active development
   - Plans future work
   - Monitors technical debt
   - Update when:
     - Starting new work
     - Completing features
     - Making design decisions
     - Identifying new requirements
     - Planning future enhancements

### Update Requirements
1. **Frequency**
   - Update TOI files with EVERY significant change
   - Commit updates alongside code changes
   - Review and update at the end of each session
   - Verify accuracy before session end

2. **Git Commits**
   - Make frequent, atomic commits
   - Write detailed commit messages
   - Follow commit message format:
     ```
     type: Brief summary

     - Detailed bullet points of changes
     - Reasoning for changes
     - Impact on other components

     Additional context if needed
     ```
   - Types: feat, fix, docs, style, refactor, test, chore

3. **Content Standards**
   - Keep information current and accurate
   - Remove outdated information
   - Include rationale for decisions
   - Document dependencies and relationships
   - Note potential future impacts

4. **Critical Updates**
   - Design decisions and rationale
   - New feature implementations
   - Bug fixes and workarounds
   - API changes
   - Dependency updates
   - Known issues
   - Future considerations

### Maintenance Workflow
1. Before starting work:
   - Review all TOI documents
   - Note current status
   - Identify relevant sections to update

2. During development:
   - Document design decisions as they're made
   - Update implementation status
   - Note any discovered issues
   - Track technical debt

3. After completing work:
   - Update all affected TOI sections
   - Review for accuracy
   - Make detailed commit
   - Ensure continuation instructions are clear

4. Before ending session:
   - Review all TOI documents
   - Update project tracking
   - Ensure clear continuation path
   - Commit final updates

### Quality Checks
1. **Accuracy**
   - Information reflects current state
   - No contradictions between documents
   - All sections are up to date
   - Links and references are valid

2. **Completeness**
   - All significant changes documented
   - Design decisions explained
   - Future impacts considered
   - Clear next steps provided

3. **Clarity**
   - Information is well-organized
   - Writing is clear and concise
   - Technical terms are explained
   - Examples provided where helpful

### Remember
- TOI documents are critical for project continuity
- Keep them updated with every significant change
- Write for future sessions
- Include context and rationale
- Make frequent, detailed commits
- Think about future implications

## Notes and Decisions
- Decided to prioritize breakout support before adding more validation
- Keeping configuration format extensible for future needs
- Planning to add visual topology preview after core features
- Need to consider performance implications of real-time validation

## Session Continuity
Last session ended while implementing port assignment logic. To continue:
1. Review `portAssignmentManager.js` implementation
2. Update configuration generator to handle new port assignment format
3. Add unit tests for new functionality
4. Implement error handling for breakout-specific scenarios
