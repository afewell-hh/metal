import { PortAssignmentManager } from './portAssignmentManager';
import { SwitchProfileManager } from './switchProfileManager'; // Import SwitchProfileManager

class ConfigGenerator {
    constructor(switchProfileManager, portRules) {
        this.switchProfileManager = switchProfileManager;
        this.portAssignmentManager = new PortAssignmentManager(switchProfileManager, portRules);
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

    // Normalize model name to match profile format (replace hyphens with underscores)
    normalizeModelName(model) {
        return model.replace(/-/g, '_');
    }

    // Base function to create Kubernetes CRD objects
    createK8sObject(kind, name, spec, apiVersion = 'wiring.githedgehog.com/v1beta1') {
        return {
            apiVersion,
            kind,
            metadata: {
                name
            },
            spec
        };
    }

    // Generate VLANNamespace configuration
    generateVLANNamespace(ranges) {
        return this.createK8sObject('VLANNamespace', 'default', { ranges });
    }

    // Generate IPv4Namespace configuration
    generateIPv4Namespace(name, subnets) {
        return this.createK8sObject('IPv4Namespace', name, { subnets }, 'vpc.githedgehog.com/v1beta1');
    }

    // Generate proper port name following Hedgehog format
    generatePortName(deviceName, portNumber) {
        return `${deviceName}/E1/${portNumber}`;
    }

    // Generate Switch configuration
    generateSwitch(name, model, role, config) {
        const normalizedModel = this.normalizeModelName(model);
        const rolePrefix = role === 'spine' ? 'spine' : 'leaf';
        const switchNumber = name.split('-')[1];

        return this.createK8sObject('Switch', name, {
            profile: normalizedModel,
            role,
            description: `${rolePrefix}-${switchNumber}`,
            portBreakouts: config.portBreakouts || {}
        });
    }

    // Generate fabric Connection configuration
    generateFabricConnection(spineName, leafName, links) {
        return this.createK8sObject('Connection', `${spineName}--fabric--${leafName}`, {
            fabric: {
                links: links.map(link => ({
                    spine: { port: this.generatePortName(spineName, link.spinePort) },
                    leaf: { port: this.generatePortName(leafName, link.leafPort) }
                }))
            }
        });
    }

    async generateConfig(formData) {
        console.log('Received form data:', formData);

        try {
            // Validate the fabric design
            const config = await this.portAssignmentManager.validateAndAssignPorts(formData);

            // Generate all required Kubernetes CRD objects
            const k8sObjects = [];

            // Add VLANNamespace
            k8sObjects.push(this.generateVLANNamespace(formData.vlanNamespace.ranges));

            // Add IPv4Namespaces
            formData.ipv4Namespaces.forEach(ns => {
                k8sObjects.push(this.generateIPv4Namespace(ns.name, ns.subnets));
            });

            // Generate switch configurations
            const spineModel = formData.topology.spines.model;
            const leafModel = formData.topology.leaves.model;

            // Generate spine switch objects
            for (let i = 0; i < formData.topology.spines.count; i++) {
                const spineName = generateSwitchName(spineModel, i);
                k8sObjects.push(this.generateSwitch(spineName, spineModel, 'spine', {
                    portGroupSpeeds: config.configs.spines[i].portGroupSpeeds,
                    portBreakouts: config.configs.spines[i].portBreakouts,
                    asn: config.configs.spines[i].asn,
                    ip: config.configs.spines[i].ip,
                    vtepIP: config.configs.spines[i].vtepIP,
                    protocolIP: config.configs.spines[i].protocolIP
                }));
            }

            // Generate leaf switch objects
            for (let i = 0; i < formData.topology.leaves.count; i++) {
                const leafName = generateSwitchName(leafModel, i);
                k8sObjects.push(this.generateSwitch(leafName, leafModel, 'leaf', {
                    portGroupSpeeds: config.configs.leaves[i].portGroupSpeeds,
                    portBreakouts: config.configs.leaves[i].portBreakouts,
                    asn: config.configs.leaves[i].asn,
                    ip: config.configs.leaves[i].ip,
                    vtepIP: config.configs.leaves[i].vtepIP,
                    protocolIP: config.configs.leaves[i].protocolIP
                }));
            }

            // Generate fabric connections
            config.configs.leaves.forEach((leaf, leafIndex) => {
                const leafName = generateSwitchName(leafModel, leafIndex);
                config.configs.spines.forEach((spine, spineIndex) => {
                    const spineName = generateSwitchName(spineModel, spineIndex);
                    const links = leaf.ports.fabric.map((fabricPort, index) => ({
                        spinePort: spine.ports.fabric[index].id,
                        leafPort: fabricPort.id
                    }));
                    k8sObjects.push(this.generateFabricConnection(spineName, leafName, links));
                });
            });

            return k8sObjects;
        } catch (error) {
            console.error('Error generating configuration:', error);
            throw error;
        }
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

// Helper function to generate switch names
export function generateSwitchName(model, index) {
    const modelPrefix = model.includes('s5232') ? 's5232' : 
                       model.includes('s5248') ? 's5248' : 
                       model.replace(/[^a-zA-Z0-9]/g, '');
    return `${modelPrefix}-${String(index + 1).padStart(2, '0')}`;
}

export async function generateConfig(formData) {
    const portRules = new PortAllocationRules();
    await portRules.initialize();

    // Initialize switch profile manager
    const switchProfileManager = new SwitchProfileManager();
    await switchProfileManager.initialize();

    // Create config generator with initialized components
    const configGenerator = new ConfigGenerator(switchProfileManager, portRules);
    return configGenerator.generateConfig(formData);
}
