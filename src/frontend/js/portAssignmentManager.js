/**
 * Manages port assignment and validation logic for fabric designs
 */
export class PortAssignmentManager {
    constructor(portRules) {
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

        return {
            isValid: errors.length === 0,
            errors
        };
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
        const baseAsn = role === 'spine' ? 65000 : 65100;
        const baseIP = role === 'spine' ? '10.0.0.' : '10.0.1.';
        
        return {
            role,
            asn: baseAsn + index,
            ip: baseIP + (index + 1),
            vtepIP: role === 'leaf' ? `10.0.2.${index + 1}` : undefined,
            protocolIP: `10.0.3.${index + 1}`
        };
    }

    async validateAndAssignPorts(formData) {
        // Extract topology information
        const numSpineSwitches = formData.topology.spines.count;
        const numLeafSwitches = formData.topology.leaves.count;
        const uplinksPerLeaf = formData.topology.leaves.fabricPortConfig?.breakout || 1;
        const spineModel = formData.topology.spines.model;
        const leafModel = formData.topology.leaves.model;

        // Validate the fabric design
        const validation = this.validateFabricDesign({
            leafSwitches: numLeafSwitches,
            spineSwitches: numSpineSwitches,
            uplinksPerLeaf,
            leafModel,
            spineModel
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
            const fabricPorts = [];
            
            // Calculate fabric ports needed for this spine
            for (let j = 0; j < numLeafSwitches; j++) {
                for (let k = 0; k < uplinksPerLeaf; k++) {
                    if (k % numSpineSwitches === i) {
                        fabricPorts.push({
                            id: `${j * uplinksPerLeaf + k + 1}`
                        });
                    }
                }
            }

            configs.spines.push({
                ...networkConfig,
                portBreakouts: {},  // No breakouts by default for spine switches
                ports: {
                    fabric: fabricPorts
                }
            });
        }

        // Configure leaf switches
        for (let i = 0; i < numLeafSwitches; i++) {
            const networkConfig = this.generateNetworkConfig('leaf', i);
            const fabricPorts = [];
            
            // Calculate fabric ports for this leaf
            for (let j = 0; j < uplinksPerLeaf; j++) {
                const spineIndex = j % numSpineSwitches;
                fabricPorts.push({
                    id: `${i + 1}`,
                    spine: spineIndex
                });
            }

            configs.leaves.push({
                ...networkConfig,
                portBreakouts: formData.topology.leaves.fabricPortConfig?.breakout ? {
                    mode: formData.topology.leaves.fabricPortConfig.breakout
                } : {},
                ports: {
                    fabric: fabricPorts
                }
            });
        }

        return {
            isValid: true,
            configs
        };
    }
}
