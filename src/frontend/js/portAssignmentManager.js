/**
 * Manages port assignment and validation logic for fabric designs
 */
export class PortAssignmentManager {
    constructor(switchProfileManager, portRules) {
        this.switchProfileManager = switchProfileManager;
        this.portRules = portRules;
    }

    /**
     * Validates a fabric design configuration
     * @param {Object} config - The fabric design configuration
     * @returns {Object} Validation result with isValid and any errors
     */
    validateFabricDesign(config) {
        const {
            leafSwitches,
            spineSwitches,
            uplinksPerLeaf,
            totalServerPorts,
            leafModel,
            spineModel
        } = config;

        const errors = [];

        // 1. Basic quantity validation
        if (leafSwitches < 1) {
            errors.push('Must have at least 1 leaf switch');
        }
        if (spineSwitches < 1) {
            errors.push('Must have at least 1 spine switch');
        }

        // 2. Uplink validation
        // Each leaf must connect to all spines
        if (uplinksPerLeaf < spineSwitches) {
            errors.push(`Uplinks per leaf (${uplinksPerLeaf}) must be >= number of spine switches (${spineSwitches})`);
        }

        try {
            // 3. Port capacity validation for leaves
            const leafFabricPorts = this.switchProfileManager.getValidPorts(leafModel, 'fabric');
            const leafServerPorts = this.switchProfileManager.getValidPorts(leafModel, 'server');

            if (!leafFabricPorts || leafFabricPorts.length === 0) {
                errors.push(`No valid fabric ports found for leaf model ${leafModel}`);
            }
            if (!leafServerPorts || leafServerPorts.length === 0) {
                errors.push(`No valid server ports found for leaf model ${leafModel}`);
            }

            // Calculate ports needed per leaf
            const serverPortsPerLeaf = Math.ceil(totalServerPorts / leafSwitches);

            if (uplinksPerLeaf > leafFabricPorts.length) {
                errors.push(`Too many uplinks requested (${uplinksPerLeaf}) for leaf model ${leafModel}. Maximum available: ${leafFabricPorts.length}`);
            }

            if (serverPortsPerLeaf > leafServerPorts.length) {
                errors.push(`Too many server ports requested per leaf (${serverPortsPerLeaf}) for leaf model ${leafModel}. Maximum available: ${leafServerPorts.length}`);
            }

            // 4. Port capacity validation for spines
            const spineFabricPorts = this.switchProfileManager.getValidPorts(spineModel, 'fabric');
            
            if (!spineFabricPorts || spineFabricPorts.length === 0) {
                errors.push(`No valid fabric ports found for spine model ${spineModel}`);
            }

            // Calculate ports needed per spine
            const portsPerSpine = Math.ceil((leafSwitches * uplinksPerLeaf) / spineSwitches);
            
            if (portsPerSpine > spineFabricPorts.length) {
                errors.push(`Too many ports required per spine (${portsPerSpine}) for model ${spineModel}. Maximum available: ${spineFabricPorts.length}`);
            }

        } catch (error) {
            errors.push(`Error validating port configuration: ${error.message}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Calculates port assignments for a validated fabric design
     * @param {Object} config - The fabric design configuration
     * @returns {Object} Port assignments for each switch
     */
    generatePortAssignments(config) {
        const validation = this.validateFabricDesign(config);
        if (!validation.isValid) {
            throw new Error(`Invalid fabric design: ${validation.errors.join(', ')}`);
        }

        const {
            leafSwitches,
            spineSwitches,
            uplinksPerLeaf,
            totalServerPorts,
            leafModel,
            spineModel
        } = config;

        const assignments = {
            leaves: [],
            spines: []
        };

        // Get valid ports for leaf switches
        const leafFabricPorts = this.switchProfileManager.getValidPorts(leafModel, 'fabric');
        const leafServerPorts = this.switchProfileManager.getValidPorts(leafModel, 'server');

        // Calculate server ports per leaf
        const serverPortsPerLeaf = Math.ceil(totalServerPorts / leafSwitches);

        // Generate assignments for each leaf switch
        for (let leafIdx = 0; leafIdx < leafSwitches; leafIdx++) {
            const leafAssignment = {
                switchId: `leaf${leafIdx + 1}`,
                model: leafModel,
                ports: {
                    fabric: [],
                    server: []
                }
            };

            // Assign fabric ports
            const fabricPortStart = parseInt(leafFabricPorts[0]);
            for (let i = 0; i < uplinksPerLeaf; i++) {
                const portId = (fabricPortStart + i).toString();
                leafAssignment.ports.fabric.push({
                    id: portId,
                    speed: '100G'
                });
            }

            // Assign server ports
            const serverPortStart = parseInt(leafServerPorts[0]);
            for (let i = 0; i < serverPortsPerLeaf; i++) {
                const portId = (serverPortStart + i).toString();
                leafAssignment.ports.server.push({
                    id: portId,
                    speed: '25G'
                });
            }

            assignments.leaves.push(leafAssignment);
        }

        // Get valid ports for spine switches
        const spineFabricPorts = this.switchProfileManager.getValidPorts(spineModel, 'fabric');
        const downlinksPerSpine = Math.ceil(leafSwitches * (uplinksPerLeaf / spineSwitches));

        // Generate assignments for each spine switch
        for (let spineIdx = 0; spineIdx < spineSwitches; spineIdx++) {
            const spineAssignment = {
                switchId: `spine${spineIdx + 1}`,
                model: spineModel,
                ports: {
                    fabric: []
                }
            };

            // Assign fabric ports
            const fabricPortStart = parseInt(spineFabricPorts[0]);
            for (let i = 0; i < downlinksPerSpine; i++) {
                const portId = (fabricPortStart + i).toString();
                spineAssignment.ports.fabric.push({
                    id: portId,
                    speed: '100G'
                });
            }

            assignments.spines.push(spineAssignment);
        }

        return assignments;
    }

    /**
     * Assigns ports from available pool considering breakout configurations
     * @param {Array<string>} availablePorts - List of available physical ports
     * @param {number} requiredPorts - Number of logical ports needed
     * @param {Object} profile - Switch profile containing breakout capabilities
     * @param {string} speed - Required port speed (e.g., "100G", "25G")
     * @returns {Array<Object>} Assigned ports with breakout information
     * @private
     */
    assignPorts(availablePorts, requiredPorts, profile, speed) {
        const assignments = [];
        let remainingPorts = requiredPorts;
        let portIndex = 0;

        while (remainingPorts > 0 && portIndex < availablePorts.length) {
            const physicalPort = availablePorts[portIndex];
            const breakoutCapabilities = profile.getPortBreakoutCapabilities(physicalPort);
            
            // Find the most suitable breakout mode based on speed and remaining ports
            const breakoutMode = this.selectBreakoutMode(breakoutCapabilities, speed, remainingPorts);
            
            if (!breakoutMode) {
                // No suitable breakout mode found, use port as is if speed matches
                if (profile.getPortSpeed(physicalPort) === speed) {
                    assignments.push({
                        id: physicalPort,
                        speed: speed,
                        breakout: null,
                        subPorts: null
                    });
                    remainingPorts--;
                }
            } else {
                // Apply breakout configuration
                const [numSubPorts] = breakoutMode.match(/\d+/);
                const subPortSpeed = breakoutMode.split('x')[1];
                const subPorts = Array.from(
                    { length: parseInt(numSubPorts) },
                    (_, i) => `${physicalPort}/${i + 1}`
                );

                assignments.push({
                    id: physicalPort,
                    speed: subPortSpeed,
                    breakout: breakoutMode,
                    subPorts: subPorts
                });
                remainingPorts -= parseInt(numSubPorts);
            }
            portIndex++;
        }

        if (remainingPorts > 0) {
            throw new Error(`Not enough ports available. Still need ${remainingPorts} more ports.`);
        }

        return assignments;
    }

    /**
     * Selects the most appropriate breakout mode based on required speed and port count
     * @param {Array<string>} breakoutCapabilities - Available breakout modes
     * @param {string} requiredSpeed - Required port speed
     * @param {number} remainingPorts - Number of ports still needed
     * @returns {string|null} Selected breakout mode or null if none suitable
     * @private
     */
    selectBreakoutMode(breakoutCapabilities, requiredSpeed, remainingPorts) {
        if (!breakoutCapabilities || breakoutCapabilities.length === 0) {
            return null;
        }

        // Filter breakout modes that match the required speed
        const validModes = breakoutCapabilities.filter(mode => {
            const [, speed] = mode.split('x');
            return speed === requiredSpeed;
        });

        if (validModes.length === 0) {
            return null;
        }

        // Sort by number of subports, prioritizing modes that waste fewer ports
        return validModes.sort((a, b) => {
            const aPorts = parseInt(a.match(/\d+/)[0]);
            const bPorts = parseInt(b.match(/\d+/)[0]);
            
            // Calculate waste (negative numbers mean not enough ports)
            const aWaste = aPorts - remainingPorts;
            const bWaste = bPorts - remainingPorts;
            
            // Prefer positive but minimal waste
            if (aWaste >= 0 && bWaste >= 0) {
                return aWaste - bWaste;
            }
            // Prefer the one that provides more ports if both insufficient
            if (aWaste < 0 && bWaste < 0) {
                return bPorts - aPorts;
            }
            // Prefer the one that can fulfill the requirement
            return bWaste - aWaste;
        })[0];
    }

    /**
     * Calculates available ports considering breakout configurations
     * @param {Object} profile - Switch profile containing breakout capabilities
     * @param {Array<string>} fabricPorts - List of valid fabric ports
     * @param {Array<string>} serverPorts - List of valid server ports
     * @returns {Object} Available port counts and breakout information
     * @private
     */
    calculateAvailablePorts(profile, fabricPorts, serverPorts) {
        const uniquePorts = new Set([...fabricPorts, ...serverPorts]);
        let totalLogicalPorts = 0;
        const breakoutInfo = {};

        // Process each physical port
        for (const port of uniquePorts) {
            const breakoutCapabilities = profile.getPortBreakoutCapabilities(port);
            if (!breakoutCapabilities || breakoutCapabilities.length === 0) {
                // Port doesn't support breakout, count as single port
                totalLogicalPorts += 1;
                breakoutInfo[port] = {
                    maxLogicalPorts: 1,
                    supportedBreakouts: []
                };
                continue;
            }

            // Find the breakout mode that provides the most logical ports
            const maxBreakout = breakoutCapabilities.reduce((max, current) => {
                const portCount = parseInt(current.split('x')[0]);
                return portCount > max ? portCount : max;
            }, 1);

            totalLogicalPorts += maxBreakout;
            breakoutInfo[port] = {
                maxLogicalPorts: maxBreakout,
                supportedBreakouts: breakoutCapabilities
            };
        }

        return {
            totalLogicalPorts,
            breakoutInfo,
            physicalPorts: uniquePorts.size
        };
    }

    // Generate network configuration for a switch
    generateNetworkConfig(role, index) {
        // Generate unique ASN and IPs for each switch
        // Using private ASN range 64512-65534 for private use
        const baseAsn = role === 'spine' ? 64512 : 64768;
        const asn = baseAsn + index;

        // Using 172.16.0.0/12 for management IPs
        const managementOctet = role === 'spine' ? 1 : 2;
        const ip = `172.16.${managementOctet}.${index + 1}`;

        // Using 172.20.0.0/12 for VTEP IPs
        const vtepOctet = role === 'spine' ? 1 : 2;
        const vtepIP = `172.20.${vtepOctet}.${index + 1}`;

        // Using 172.24.0.0/12 for protocol IPs (BGP Router ID)
        const protocolOctet = role === 'spine' ? 1 : 2;
        const protocolIP = `172.24.${protocolOctet}.${index + 1}`;

        return {
            asn,
            ip,
            vtepIP,
            protocolIP
        };
    }

    async validateAndAssignPorts(formData) {
        // Extract topology data
        const {
            model: leafModel,
            count: numLeafSwitches,
            fabricPortsPerLeaf: uplinksPerLeaf,
            totalServerPorts
        } = formData.topology.leaves;

        const {
            model: spineModel,
            count: numSpineSwitches
        } = formData.topology.spines;

        // Normalize model names
        const normalizedLeafModel = leafModel.replace(/-/g, '_');
        const normalizedSpineModel = spineModel.replace(/-/g, '_');

        // Validate the fabric design
        const validation = await this.validateFabricDesign({
            leafSwitches: numLeafSwitches,
            spineSwitches: numSpineSwitches,
            uplinksPerLeaf,
            totalServerPorts,
            leafModel: normalizedLeafModel,
            spineModel: normalizedSpineModel
        });

        if (!validation.isValid) {
            throw new Error(`Invalid fabric design: ${validation.errors.join(', ')}`);
        }

        // Generate configurations
        const configs = {
            spines: [],
            leaves: []
        };

        // Configure spine switches
        for (let i = 0; i < numSpineSwitches; i++) {
            const networkConfig = this.generateNetworkConfig('spine', i);
            configs.spines.push({
                ...networkConfig,
                portGroupSpeeds: {
                    "1": "100G"  // Default spine ports to 100G
                },
                portBreakouts: {},  // No breakouts by default for spine switches
                ports: {
                    fabric: Array(uplinksPerLeaf * numLeafSwitches).fill(null).map((_, j) => {
                        // Calculate port number based on leaf index and uplink number
                        // Each leaf gets a dedicated set of ports on the spine
                        const leafIndex = Math.floor(j / uplinksPerLeaf);
                        const uplinkIndex = j % uplinksPerLeaf;
                        const portNumber = leafIndex * uplinksPerLeaf * numSpineSwitches + uplinkIndex * numSpineSwitches + i + 1;
                        return {
                            id: `${portNumber}`,
                            speed: "100G"
                        };
                    })
                }
            });
        }

        // Configure leaf switches
        for (let i = 0; i < numLeafSwitches; i++) {
            const networkConfig = this.generateNetworkConfig('leaf', i);
            configs.leaves.push({
                ...networkConfig,
                portGroupSpeeds: {
                    "1": "100G",  // Fabric ports
                    "2": "25G"    // Server ports
                },
                portBreakouts: {},  // Add breakouts if needed
                ports: {
                    fabric: Array(uplinksPerLeaf).fill(null).map((_, j) => ({
                        // Use 49, 51, 53, 55 for fabric ports
                        id: `${49 + j * 2}`,
                        speed: "100G"
                    })),
                    server: Array(totalServerPorts).fill(null).map((_, j) => ({
                        id: `${j + 1}`,  // Starting from port 1 for server ports
                        speed: "25G"
                    }))
                }
            });
        }

        return { configs };
    }
}
