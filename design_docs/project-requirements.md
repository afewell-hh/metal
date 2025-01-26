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
   - vlan range selection
     - used to generate the vlannamespace configuration object. Reference the current working frontend app and form to see the way vlans are input, this is the correct way to do it
   - ipv4e subnet
     - used to generate the ipv4namespace configuration object. Reference the current working frontend app and form to see the way ipv4namespace subnets are input, this is the correct way to do it for now
   - spine Switch model selection
     - in a given fabric there will be one model of spine switch, regardless of quantity.
   - spine switch quantity
   - Spine switch speed
     - in a given fabric there will be one speed for all ports configurations on the spine switch, regardless of quantity.
     - The current frontend gui has a form for users to input the speed of the spine switch, and this is incorrect and can be removed. Upon further reflection, its clear that only the breakout needs to be specified as each breakout option has an associated fixed speed - the app logic will need to consider port speeds but it can/should derive this information from the specified breakout selection for the leaf or spine fabric connection inputs.
   - spine switch breakout
     - Some switch models (spine or leaf)have fixed ports that cannot be broken out. Most if not all switch models have multiple ports that can be broken out. In a given fabric there will be one breakout for all ports configurations on the spine switch, regardless of quantity. The word breakout as used in the hedgehog documentation and switch profile code files is almost the same as the type of qsfp used as different qsfp's have different options for breaking out ports, for example 100Gbe qsfp's are often available in configurations like 4x25Gbe, 2x50Gbe, etc. A 100Gbe qsfp may be most commonly implemented as just a single 100Gbe port in which case we still just use the term breakout largely because that is the terminology used in the switch profile files in the source code that we need to use to dynamically determine each switch models capabilities and port naming/numbering schemes. Another reason these are called breakouts and not qsfps or something is because we do not need nor want to be concerned with exactly which qsfp or dac cable that would be used yet, we may want to validate all these details in the future but not yet. We will need to validate that the configuration of leaf fabric/uplink ports is compatible with the input values for leaf switch fabric ports, but we only need to be concerned with speeds for this validation. If the input value for the leaf switch fabric port speed/breakout were 4x25 and the quantity specified would indicate that one uplink port would be configured from that leaf switch, that would mean that while the 4x25 breakout means that a quantity of 4 25gbe uplink ports would be availalable on that one physical port, but only a single one of those 4 25gbe ports would be configured as an fabric port. This selection needs to be validated to ensure that the corresponding spine switch that the leaf switch is connecting to has enough uplink ports of the correct speed to support the uplink port requirements from leaf switches. Just because the leaf switch is configured to have 4 25gbe uplink ports doesn't mean that the spine switch has to have 4x25 breakout specifically, I think in the current switch models that might be the only compatible option but the important point here is that we do not need to validate if a breakout selection on one switch is compatible with the breakout selection on another switch, we just need to ensure that each leaf switch has enough available ports of the correct speed to support the uplink port requirements of the spine switches that it is connecting to, and likewise that the spine switches have enough available ports of the correct speed to support the uplink port requirements of the leaf switches that they are connecting to.
   - leaf Switch model selection
     - in a given fabric there will be one model of leaf switch, regardless of quantity.
   - leaf switch quantity
   - number of uplink/fabric ports per leaf
     - the current frontend form does not have a field for this, but it should be added. 
     - every time a user uses the metal app, they are creating the design for one fabric. Within a given fabric design generated by metal, all leaf switches will have the same number of uplink ports.
   - leaf switch fabric port speed
     - just like the spine switch speed field above, this can be removed as the speed value of ports should be derived from the breakout selection specified for leaf fabric connections. See above.
   - leaf switch fabric port breakout
     - all of the details I described above for the spine switch breakout field apply here as well. In addition I forgot to mention, and this applies to the spine switch breakout field as well, that every model of switch, spine or leaf, has a corresponding switch profile file in source code that lists the supported breakouts for each model of switch. The logic in metal should, when the user selects a switch model, update the corresponding field where the user inputs the breakout selection for that switches (spine or leaf) fabric ports, so the user can select from the list of breakouts supported for that switch model. Further, in the previous session I discussed an idea which I called Metal Switch Profile or MSP such that there would be one MSP for each model of switch, the purpose of which is to specify additional rules for how metal should restrict how it interprets the switch profile for that specific model of switch. The one key rule it had implemented was to filter which ports available in the switch profile were available to be specified as server ports, or as fabric ports - keeping in mind that any supported switch can be used as either a leaf or a spine, but only leaf switches can have server ports. Leaf switches also have fabric ports, but spine switches only have fabric ports, eg spine switches will only ever be connected to leaf switches, one end of a connection between a spine and leaf is the leaf fabric port (aka uplink port) and the other end of the connection is the spine fabric port. Some models of switches have specific ports that need to be used for uplinks, most models most ports can be used for either fabric or server ports, but different models have different quirks which we can deal with for the needs of metal by having a rule that can specify which ports are allowed to be configured as server ports, or as fabric ports, for each model of switch. I dont care if these rules are implemented as msp files or how they are implemented as long as they are implemented in a good way that works. I mention all this here because these MSP rules need to be considered when populating the dropdown for the user to select the breakout configuration for the switch fabric or server ports in their fabric design, once the user selects the model of switch (leaf or spine) the logic to populate the breakout dropdown with valid values should first check the msp rule and then use the msp rule to filter which breakout options should be available. The impact of the msp rule I described is that it ensures that each model of switch has exactly one type of port that can be used for server ports, and exactly one type of port that can be used for fabric ports, which ensures that whatever breakout type selected will be supported across all of the server or fabric ports in the fabric design. We use proper clos design which I am sure you know means that spines do not connect to each other, leafs do not connect to each other. Servers connect to leafs, leafs connect to servers and spines, and spines connect to leafs.  
   - Total number of server ports needed
     - This field is not currently present in the current frontend form, but it should be added. The frontend form should have a field for the number of server ports that are needed and this field should be used to validate that the number of leaf switches specified can support the number of server ports specified, as well as the number of leaf switch fabric ports specified. The total quantity of leaf switches specified must be able to provide the total number of ports with required speeds that are specified in the inputs. The number of spine switches input must provide a total number of ports of the correct speed to be able to support the number of fabric ports specified for leaf switches.
     - Optional: if specified create configurations for server port configurations on leaf switches using autogenerated names as needed, unique server names/details not included, we use a cattle vs pets approach as much as possible. The configuration for the server ports should be balanced equally among the number of leaf switches specified, so for example if 4 server ports and 4 leaf switches are specified, each leaf switch should have 1 server port configured.
   - Server port speed input field
     - like the other port speed input fields, this should be removed as the speed value of ports should be derived from the breakout selection specified for server ports. 
   - server port breakout dropdown field
     - like the other port breakout dropdown fields, this dropdown should be populated with after the leaf switch model is selected - the msp rule for the switch model should specify which ports within the switch profile can be used for server ports. This one may be a bit tricky because some switch models have fixed server ports which do not have any breakout options. Each switch profile code file has a list of all the ports that exist on that switch model, for each port on the switch, the switch profile has a record which includes values for the different logical switch port names that are associated with that physical port and each of these records has a field named "profile" which is mapped to another section of the same switch profile document under portProfiles, which has the information about breakout options for associated ports. If the record for a given port in this schema does not have the profile field present or its empty, that is a fixed value port and breakout options are not available or needed. If the recort for a given port in the switch profile does support any breakout options, it will have a profile field with a value that is the name of a port profile, and you can map that name to the port profile definitions which are also in the same switch profile file to ascertain which breakout options are available for a given port. Net net, if the record for a given port in the switch profile does not have a profile field or no profile field value specified, the dropdown should be locked to the value "fixed", and no additional configuration data is needed for this type of port. If a valid uplink port does have a profile, the breakout options available should be presented. 
   - Button "Next: enter switch serials"
     - this button exists because the user initialy only provides the switch model and quantity, and does not provide a way to enter a value specific to each individual switch as we need to do with serial numbers so when the button is clicked it generates names using a standard convention for each individual switch and directs to another page where a row for each switch is presented with an input field for the serial number. After the serial numbers are entered, the button to go to the next step is enabled, and it generates the kubernetes manifests for most of the objects that are part of the "wiring diagram" as that term is used in documentation, which is to refer to certain kubernetes object manifests and is not referring to an image or visual diagram - but note it is desirable to actually include associated visual diagrams but the much more important part is generating the configurations. 





2. Manual Input Form - additional needed
   - note that the values below are not needed for MVP as we do not need to generate the complete configurations, it is a goal to do eventually, but we are working in a stepwise way to get there. Any simplification of the effort needed for a person to create hedgehog config files right now is a big benefit, even if only partial. Once we get the most critical features working, we can add more.
   - Management network details (not yet implemented)
   - External network details (not yet implemented)
   - Credentials/SSH keys (not yet implemented)
   - LAG/MLAG/ESLAG (not yet implemented)

### Automated Generation
1. Configuration Generation
   - Generate all required kubernetes manifests
   - Create wiring diagrams
   - Produce inventory lists

2. Visual diagram generation (not yet implemented)
   - Generate network toplogy diagram per standard industry norms style of diagram
   - Generate cabling diagram for the wiring people who will be pluggin in the cables, this diagram should be optimized specifically for this persona and use case and not include details that are not relevant for them, and should follow industry best practices for this type of use case. 
   - diagrams are preferred to be made in drawio format, example network topology drawio diagrams can be found at ./reference/*.drawio
   - if drawio are not working well for you, mermaid is an acceptable alternative.
 
### Validation
1. Input Validation
   - Validate physical feasibility
   - Check port compatibility
   - Verify bandwidth calculations

2. Output Validation
   - Ensure all required fields are populated
   - Verify manifest syntax
   - Check for common configuration errors

## Success Criteria
1. Can generate complete, valid configuration from minimal inputs
2. Reduces configuration time by at least 50%
3. Eliminates common configuration errors
4. Provides clear validation feedback
5. Easy to use interface