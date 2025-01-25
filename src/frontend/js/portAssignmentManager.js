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

        if (totalPortsNeededPerLeaf > availablePortsPerLeaf) {
            errors.push(
                `Leaf switch ${leafModel} cannot support ${uplinksPerLeaf} uplinks and ${serverPortsPerLeaf} server ports. ` +
                `Maximum available ports: ${availablePortsPerLeaf}`
            );
        }

        // 4. Port capacity validation for spines
        const spineProfile = this.switchProfileManager.getEffectiveProfile(spineModel);
        const spineFabricPorts = this.switchProfileManager.getValidPorts(spineModel, 'fabric');
        
        // Calculate downlinks needed per spine
        const downlinksPerSpine = leafSwitches * (uplinksPerLeaf / spineSwitches);
        
        // Validate spine has enough ports
        const availableSpinePorts = this.calculateAvailablePorts(spineProfile, spineFabricPorts, []);
        if (downlinksPerSpine > availableSpinePorts) {
            errors.push(
                `Spine switch ${spineModel} cannot support ${downlinksPerSpine} downlinks. ` +
                `Maximum available ports: ${availableSpinePorts}`
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
     * @private
     */
    calculateAvailablePorts(profile, fabricPorts, serverPorts) {
        // TODO: Implement breakout logic using profile information
        // For now, return the total number of unique ports
        const uniquePorts = new Set([...fabricPorts, ...serverPorts]);
        return uniquePorts.size;
    }

    /**
     * Assigns ports from available pool
     * @private
     */
    assignPorts(availablePorts, count) {
        return availablePorts.slice(0, count);
    }
}
