import { PortAssignmentManager } from './portAssignmentManager';

class ConfigGenerator {
    constructor(switchProfileManager) {
        this.switchProfileManager = switchProfileManager;
        this.portAssignmentManager = new PortAssignmentManager(switchProfileManager);
    }

    /**
     * Gets the port speed from the switch profile
     * @param {string} model - Switch model
     * @param {string} port - Port identifier
     * @returns {string} Port speed (e.g., "100G", "25G")
     */
    getPortSpeed(model, port) {
        const profile = this.switchProfileManager.getEffectiveProfile(model);
        return profile.getPortSpeed(port);
    }

    /**
     * Formats port configuration with breakout information
     * @param {Object} portConfig - Port configuration from port assignment
     * @param {string} role - Port role (fabric/server)
     * @returns {Object} Formatted port configuration
     * @private
     */
    formatPortConfig(portConfig, role) {
        const baseConfig = {
            id: portConfig.id,
            role: role,
            speed: portConfig.speed
        };

        if (portConfig.breakout) {
            return {
                ...baseConfig,
                breakout: portConfig.breakout,
                subPorts: portConfig.subPorts.map(subPort => ({
                    id: subPort,
                    role: role,
                    speed: portConfig.speed
                }))
            };
        }

        return baseConfig;
    }

    // Normalize model name to use underscores instead of dashes
    normalizeModelName(model) {
        if (!model) {
            throw new Error('Model name is required');
        }
        return model.replace(/-/g, '_');
    }

    async generateConfig(formData) {
        console.log('Received form data:', formData);

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
        const normalizedLeafModel = this.normalizeModelName(leafModel);
        const normalizedSpineModel = this.normalizeModelName(spineModel);

        // Validate the fabric design
        const validation = await this.portAssignmentManager.validateFabricDesign({
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

        // Generate port assignments
        const portAssignments = await this.portAssignmentManager.generatePortAssignments({
            leafSwitches: numLeafSwitches,
            spineSwitches: numSpineSwitches,
            uplinksPerLeaf,
            totalServerPorts,
            leafModel: normalizedLeafModel,
            spineModel: normalizedSpineModel
        });

        const configs = [];

        // Add VLANNamespace
        configs.push(generateVLANNamespace(formData.vlanNamespace.ranges));

        // Add IPv4Namespace
        formData.ipv4Namespaces.forEach(ns => {
            configs.push(generateIPv4Namespace(ns.name, ns.subnets));
        });

        // Generate switch configurations using port assignments
        portAssignments.leaves.forEach(leaf => {
            configs.push({
                apiVersion: 'wiring.githedgehog.com/v1beta1',
                kind: 'Switch',
                metadata: {
                    name: leaf.switchId,
                    namespace: 'default'
                },
                spec: {
                    model: normalizedLeafModel,
                    role: 'leaf',
                    serial: formData.switchSerials[leaf.switchId],
                    ports: {
                        fabric: leaf.ports.fabric.map(port => ({
                            id: port.id,
                            speed: port.speed
                        })),
                        server: leaf.ports.server.map(port => ({
                            id: port.id,
                            speed: port.speed
                        }))
                    }
                }
            });

            // Add VPC loopback for each leaf
            configs.push(generateVPCLoopback(leaf.switchId));
        });

        portAssignments.spines.forEach(spine => {
            configs.push({
                apiVersion: 'wiring.githedgehog.com/v1beta1',
                kind: 'Switch',
                metadata: {
                    name: spine.switchId,
                    namespace: 'default'
                },
                spec: {
                    model: normalizedSpineModel,
                    role: 'spine',
                    serial: formData.switchSerials[spine.switchId],
                    ports: {
                        fabric: spine.ports.fabric.map(port => ({
                            id: port.id,
                            speed: port.speed
                        }))
                    }
                }
            });
        });

        // Add fabric connections
        portAssignments.leaves.forEach((leaf, leafIdx) => {
            leaf.ports.fabric.forEach((fabricPort, portIdx) => {
                const spineIdx = Math.floor(portIdx / uplinksPerLeaf);
                const spine = portAssignments.spines[spineIdx];
                const spinePortIdx = leafIdx % numSpineSwitches;
                const spinePort = spine.ports.fabric[spinePortIdx];

                configs.push(generateFabricConnection(
                    spine.switchId,
                    leaf.switchId,
                    spinePort.id,
                    fabricPort.id
                ));
            });
        });

        return { configs };
    }
}

import { PortAllocationRules } from './portAllocationRules.js';

// Supported switch models
const SUPPORTED_SWITCHES = [
    'dell_s5248f_on',
    'dell_s5232f_on',
    'supermicro_sse_c4632'
];

// Get the shared portRules instance
const portRules = new PortAllocationRules();

// Initialize port allocation rules
export async function initializePortRules() {
    await portRules.initialize();
    return portRules;
}

// Validate port assignments
function validatePorts(config) {
    if (!portRules) {
        throw new Error('Port rules not initialized');
    }

    const switchModel = config.switchModel;
    const errors = [];

    // Validate fabric ports
    config.fabricPorts.forEach(port => {
        if (!portRules.isValidPort(switchModel, 'fabric', port)) {
            errors.push(`Port ${port} is not a valid fabric port for ${switchModel}`);
        }
    });

    // Validate server ports
    config.serverPorts.forEach(port => {
        if (!portRules.isValidPort(switchModel, 'server', port)) {
            errors.push(`Port ${port} is not a valid server port for ${switchModel}`);
        }
    });

    return errors;
}

function getPortName(switchName, portNum, breakout) {
    const portStr = `E1/${portNum}`;
    if (breakout && breakout !== 'fixed') {
        return `${switchName}/${portStr}/1`; // For now, always use first breakout port
    }
    return `${switchName}/${portStr}`;
}

function generateVLANNamespace(ranges = [{ from: 1000, to: 2999 }]) {
    return {
        apiVersion: 'wiring.githedgehog.com/v1beta1',
        kind: 'VLANNamespace',
        metadata: {
            name: 'default'
        },
        spec: {
            ranges
        }
    };
}

function generateIPv4Namespace(name = 'default', subnets = ['10.10.0.0/16']) {
    return {
        apiVersion: 'vpc.githedgehog.com/v1beta1',
        kind: 'IPv4Namespace',
        metadata: {
            name
        },
        spec: {
            subnets
        }
    };
}

function generateSwitch(name, model, role, serial, breakoutConfig) {
    const spec = {
        profile: model,
        role,
        description: role === 'spine' ? `spine-${name.split('-')[1]}` : `leaf-${name.split('-')[1]}`,
        boot: {
            serial
        }
    };

    // Add breakout configuration if specified
    if (breakoutConfig?.breakout) {
        spec.portBreakouts = {};
        
        // For spine switches, configure fabric ports
        if (role === 'spine') {
            const validFabricPorts = portRules.getValidPorts(model, 'fabric');
            validFabricPorts.forEach(port => {
                if (breakoutConfig.breakout !== 'fixed') {
                    spec.portBreakouts[`E1/${port}`] = breakoutConfig.breakout;
                }
            });
        }
        // For leaf switches, configure both fabric and server ports
        else {
            // Configure fabric ports
            const validFabricPorts = portRules.getValidPorts(model, 'fabric');
            validFabricPorts.forEach(port => {
                if (breakoutConfig.breakout !== 'fixed') {
                    spec.portBreakouts[`E1/${port}`] = breakoutConfig.breakout;
                }
            });

            // Configure server ports if they need breakout
            if (breakoutConfig.serverBreakout && breakoutConfig.serverBreakout !== 'fixed') {
                const validServerPorts = portRules.getValidPorts(model, 'server');
                validServerPorts.forEach(port => {
                    spec.portBreakouts[`E1/${port}`] = breakoutConfig.serverBreakout;
                });
            }
        }
    }

    return {
        apiVersion: 'wiring.githedgehog.com/v1beta1',
        kind: 'Switch',
        metadata: {
            name,
            namespace: 'default',
            annotations: {
                'type.hhfab.githedgehog.com': 'hw'
            }
        },
        spec
    };
}

function generateFabricConnection(spineName, leafName, spinePort, leafPort) {
    return {
        apiVersion: 'wiring.githedgehog.com/v1beta1',
        kind: 'Connection',
        metadata: {
            name: `${spineName}--fabric--${leafName}`,
            namespace: 'default'
        },
        spec: {
            fabric: {
                links: [{
                    spine: {
                        port: spinePort
                    },
                    leaf: {
                        port: leafPort
                    }
                }]
            }
        }
    };
}

function generateVPCLoopback(switchName) {
    return {
        apiVersion: 'wiring.githedgehog.com/v1beta1',
        kind: 'Connection',
        metadata: {
            name: `${switchName}--vpc-loopback`,
            namespace: 'default'
        },
        spec: {
            vpcLoopback: {
                switch: switchName
            }
        }
    };
}

export async function generateConfig(formData) {
    // Ensure port rules are initialized
    if (!portRules.initialized) {
        await portRules.initialize();
    }

    // Create a configuration generator instance with the initialized port rules
    const configGenerator = new ConfigGenerator(portRules);

    // Generate port assignments and configuration
    try {
        const config = await configGenerator.generateConfig(formData);

        const configs = [];

        // Add VLANNamespace
        configs.push(generateVLANNamespace(formData.vlanNamespace.ranges));

        // Add IPv4Namespace
        formData.ipv4Namespaces.forEach(ns => {
            configs.push(generateIPv4Namespace(ns.name, ns.subnets));
        });

        // Generate switch configurations using the port assignments from config
        config.configs.leaves.forEach(leaf => {
            configs.push(generateSwitch(
                leaf.id,
                leaf.model,
                'leaf',
                formData.switchSerials[leaf.id],
                {
                    breakout: formData.fabricPortConfig.breakout,
                    serverBreakout: formData.serverPortConfig.breakout
                }
            ));

            // Add VPC loopback for each leaf
            configs.push(generateVPCLoopback(leaf.id));
        });

        config.configs.spines.forEach(spine => {
            configs.push(generateSwitch(
                spine.id,
                spine.model,
                'spine',
                formData.switchSerials[spine.id],
                {
                    breakout: formData.fabricPortConfig.breakout
                }
            ));
        });

        // Generate fabric connections
        config.configs.leaves.forEach(leaf => {
            leaf.ports.fabric.forEach((fabricPort, index) => {
                const spineIndex = Math.floor(index / formData.topology.leaves.fabricPortsPerLeaf);
                const spineName = generateSwitchName(formData.topology.spines.model, spineIndex);
                const spinePortIndex = index % formData.topology.spines.count;
                
                configs.push(generateFabricConnection(
                    spineName,
                    leaf.id,
                    fabricPort.id,
                    config.configs.spines[spineIndex].ports.fabric[spinePortIndex].id
                ));
            });
        });

        return configs;
    } catch (error) {
        console.error('Error generating configuration:', error);
        throw error;
    }
}

export function generateSwitchName(model, index) {
    const modelPrefix = model.includes('s5232') ? 's5232' : 
                       model.includes('s5248') ? 's5248' : 
                       model.replace(/[^a-zA-Z0-9]/g, '');
    return `${modelPrefix}-${String(index + 1).padStart(2, '0')}`;
}
