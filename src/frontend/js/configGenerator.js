import { PortAssignmentManager } from './portAssignmentManager';

class ConfigGenerator {
    constructor(switchProfileManager) {
        this.switchProfileManager = switchProfileManager;
        this.portAssignmentManager = new PortAssignmentManager(switchProfileManager);
    }

    async generateConfig(formData) {
        // First validate the fabric design
        const validation = this.portAssignmentManager.validateFabricDesign({
            leafSwitches: formData.numLeafSwitches,
            spineSwitches: formData.numSpineSwitches,
            uplinksPerLeaf: formData.uplinksPerLeaf,
            totalServerPorts: formData.numServerPorts,
            leafModel: formData.leafSwitchModel,
            spineModel: formData.spineSwitchModel
        });

        if (!validation.isValid) {
            throw new Error(`Invalid fabric design: ${validation.errors.join(', ')}`);
        }

        // Generate port assignments
        const portAssignments = this.portAssignmentManager.generatePortAssignments({
            leafSwitches: formData.numLeafSwitches,
            spineSwitches: formData.numSpineSwitches,
            uplinksPerLeaf: formData.uplinksPerLeaf,
            totalServerPorts: formData.numServerPorts,
            leafModel: formData.leafSwitchModel,
            spineModel: formData.spineSwitchModel
        });

        // Generate the final configuration using port assignments
        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                version: '1.0.0'
            },
            fabric: {
                name: formData.fabricName,
                description: formData.description || '',
                switches: {
                    leaves: portAssignments.leaves.map(leaf => ({
                        id: leaf.switchId,
                        model: leaf.model,
                        ports: {
                            fabric: leaf.fabricPorts.map(port => ({
                                id: port,
                                role: 'fabric',
                                speed: this.getPortSpeed(leaf.model, port)
                            })),
                            server: leaf.serverPorts.map(port => ({
                                id: port,
                                role: 'server',
                                speed: this.getPortSpeed(leaf.model, port)
                            }))
                        }
                    })),
                    spines: portAssignments.spines.map(spine => ({
                        id: spine.switchId,
                        model: spine.model,
                        ports: {
                            fabric: spine.fabricPorts.map(port => ({
                                id: port,
                                role: 'fabric',
                                speed: this.getPortSpeed(spine.model, port)
                            }))
                        }
                    }))
                }
            }
        };
    }

    getPortSpeed(model, port) {
        // TODO: Implement port speed determination using switch profile
        return '100G';
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

    // Get effective profiles for the switches
    const spineProfile = await portRules.getEffectiveProfile(formData.topology.spines.model);
    const leafProfile = await portRules.getEffectiveProfile(formData.topology.leaves.model);

    // Validate port assignments
    const validFabricPortsPerLeaf = portRules.getValidPorts(formData.topology.leaves.model, 'fabric').length;
    if (formData.topology.leaves.fabricPortsPerLeaf > validFabricPortsPerLeaf) {
        throw new Error(`Too many fabric ports requested. Maximum allowed is ${validFabricPortsPerLeaf}`);
    }

    const validServerPorts = portRules.getValidPorts(formData.topology.leaves.model, 'server');
    const totalServerPortsAvailable = validServerPorts.length * formData.topology.leaves.count;
    if (formData.topology.leaves.totalServerPorts > totalServerPortsAvailable) {
        throw new Error(`Too many server ports requested. Maximum available is ${totalServerPortsAvailable}`);
    }

    const configs = [];
  
    // Add VLANNamespace
    configs.push(generateVLANNamespace(formData.vlanNamespace.ranges));

    // Add IPv4Namespace
    formData.ipv4Namespaces.forEach(ns => {
        configs.push(generateIPv4Namespace(ns.name, ns.subnets));
    });

    // Generate spine switches
    const spineNames = [];
    for (let i = 0; i < formData.topology.spines.count; i++) {
        const name = generateSwitchName(formData.topology.spines.model, i);
        spineNames.push(name);
        configs.push(generateSwitch(
            name,
            formData.topology.spines.model,
            'spine',
            formData.switchSerials[name],
            {
                breakout: formData.topology.spines.fabricPortConfig.breakout
            }
        ));
    }

    // Generate leaf switches
    const leafNames = [];
    for (let i = 0; i < formData.topology.leaves.count; i++) {
        const name = generateSwitchName(formData.topology.leaves.model, i);
        leafNames.push(name);
        configs.push(generateSwitch(
            name,
            formData.topology.leaves.model,
            'leaf',
            formData.switchSerials[name],
            {
                breakout: formData.topology.leaves.fabricPortConfig.breakout,
                serverBreakout: formData.topology.leaves.serverPortConfig.breakout
            }
        ));

        // Add VPC loopback for each leaf
        configs.push(generateVPCLoopback(name));
    }

    // Generate fabric connections
    const fabricPortsPerSpine = Math.ceil(
        (formData.topology.leaves.count * formData.topology.leaves.fabricPortsPerLeaf) / 
        formData.topology.spines.count
    );

    let currentSpinePort = 1;
    let currentSpineIndex = 0;

    // For each leaf switch
    leafNames.forEach((leafName, leafIndex) => {
        // Calculate which ports to use on this leaf
        const leafPortStart = 49; // First fabric port on S5248
        
        // For each fabric port needed on this leaf
        for (let i = 0; i < formData.topology.leaves.fabricPortsPerLeaf; i++) {
            const spineName = spineNames[currentSpineIndex];
            const spinePort = getPortName(spineName, currentSpinePort, formData.topology.spines.fabricPortConfig.breakout);
            const leafPort = getPortName(leafName, leafPortStart + i, formData.topology.leaves.fabricPortConfig.breakout);

            configs.push(generateFabricConnection(spineName, leafName, spinePort, leafPort));

            // Move to next spine port/switch
            currentSpinePort++;
            if (currentSpinePort > fabricPortsPerSpine) {
                currentSpinePort = 1;
                currentSpineIndex = (currentSpineIndex + 1) % spineNames.length;
            }
        }
    });

    return { configs };
}

export function generateSwitchName(model, index) {
    const modelPrefix = model.includes('s5232') ? 's5232' : 
                       model.includes('s5248') ? 's5248' : 
                       model.replace(/[^a-zA-Z0-9]/g, '');
    return `${modelPrefix}-${String(index + 1).padStart(2, '0')}`;
}
