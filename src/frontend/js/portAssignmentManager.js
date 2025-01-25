/**
 * Manages port assignment and validation logic for fabric designs
 */
export class PortAssignmentManager {
    constructor(switchProfileManager) {
        this.switchProfileManager = switchProfileManager;
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

        // 3. Port capacity validation for leaves
        const leafProfile = this.switchProfileManager.getEffectiveProfile(leafModel);
        const leafFabricPorts = this.switchProfileManager.getValidPorts(leafModel, 'fabric');
        const leafServerPorts = this.switchProfileManager.getValidPorts(leafModel, 'server');

        // Calculate ports needed per leaf
        const serverPortsPerLeaf = Math.ceil(totalServerPorts / leafSwitches);
        const totalPortsNeededPerLeaf = uplinksPerLeaf + serverPortsPerLeaf;

        // Get available ports considering breakouts
        const availablePortsPerLeaf = this.calculateAvailablePorts(leafProfile, leafFabricPorts, leafServerPorts);

        if (totalPortsNeededPerLeaf > availablePortsPerLeaf.totalLogicalPorts) {
            errors.push(
                `Leaf switch ${leafModel} cannot support ${uplinksPerLeaf} uplinks and ${serverPortsPerLeaf} server ports. ` +
                `Maximum available ports: ${availablePortsPerLeaf.totalLogicalPorts}`
            );
        }

        // 4. Port capacity validation for spines
        const spineProfile = this.switchProfileManager.getEffectiveProfile(spineModel);
        const spineFabricPorts = this.switchProfileManager.getValidPorts(spineModel, 'fabric');
        
        // Calculate downlinks needed per spine
        const downlinksPerSpine = leafSwitches * (uplinksPerLeaf / spineSwitches);
        
        // Validate spine has enough ports
        const availableSpinePorts = this.calculateAvailablePorts(spineProfile, spineFabricPorts, []);
        if (downlinksPerSpine > availableSpinePorts.totalLogicalPorts) {
            errors.push(
                `Spine switch ${spineModel} cannot support ${downlinksPerSpine} downlinks. ` +
                `Maximum available ports: ${availableSpinePorts.totalLogicalPorts}`
            );
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
                fabricPorts: [],
                serverPorts: []
            };

            // Assign fabric ports first
            const fabricPorts = this.assignPorts(leafFabricPorts, uplinksPerLeaf);
            leafAssignment.fabricPorts = fabricPorts;

            // Then assign server ports from remaining available ports
            const usedPorts = new Set(fabricPorts);
            const availableServerPorts = leafServerPorts.filter(port => !usedPorts.has(port));
            leafAssignment.serverPorts = this.assignPorts(availableServerPorts, serverPortsPerLeaf);

            assignments.leaves.push(leafAssignment);
        }

        // Get valid ports for spine switches
        const spineFabricPorts = this.switchProfileManager.getValidPorts(spineModel, 'fabric');
        const downlinksPerSpine = leafSwitches * (uplinksPerLeaf / spineSwitches);

        // Generate assignments for each spine switch
        for (let spineIdx = 0; spineIdx < spineSwitches; spineIdx++) {
            const spineAssignment = {
                switchId: `spine${spineIdx + 1}`,
                model: spineModel,
                fabricPorts: this.assignPorts(spineFabricPorts, downlinksPerSpine)
            };
            assignments.spines.push(spineAssignment);
        }

        return assignments;
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

    /**
     * Assigns ports from available pool
     * @private
     */
    assignPorts(availablePorts, count) {
        return availablePorts.slice(0, count);
    }
}
