import { PortAssignmentManager } from './portAssignmentManager';
import { SwitchProfileManager } from './switchProfileManager'; // Import SwitchProfileManager
import { PortProfileAnalyzer } from './portProfileAnalyzer';
import { ConnectionDistributor } from './connectionDistributor';
import { ServerConnectionGenerator } from './serverConnectionGenerator';

class ConfigGenerator {
    constructor(switchProfileManager, portRules) {
        if (!switchProfileManager || !portRules) {
            throw new Error('ConfigGenerator requires switchProfileManager and portRules');
        }
        this.portAssignmentManager = new PortAssignmentManager(switchProfileManager, portRules);
        this.switchProfileManager = switchProfileManager;
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
            portBreakouts: config.portBreakouts || {},
            boot: {
                serial: config.serial
            }
        });
    }

    // Generate fabric connections between spine and leaf switches
    generateFabricConnections(spines, leaves, config) {
        const connections = [];
        const uplinksPerLeaf = config.uplinksPerLeaf;
        const numSpines = spines.length;

        // For each leaf switch
        leaves.forEach((leaf, leafIndex) => {
            // Calculate how many uplinks should go to each spine
            const uplinksPerSpine = Math.floor(uplinksPerLeaf / numSpines);
            if (uplinksPerSpine === 0) {
                throw new Error(`Cannot evenly distribute ${uplinksPerLeaf} uplinks across ${numSpines} spines`);
            }

            // For each spine switch
            spines.forEach((spine, spineIndex) => {
                const links = [];
                
                // Generate the links for this spine-leaf pair
                for (let i = 0; i < uplinksPerSpine; i++) {
                    // Calculate spine port number - each leaf gets a dedicated range on the spine
                    const spinePort = leafIndex * uplinksPerSpine + i + 1;
                    
                    // Calculate leaf port number - distribute across 49,51,53,55
                    // spineIndex determines which set of ports to use
                    const leafPort = 49 + (spineIndex * uplinksPerSpine * 2) + (i * 2);
                    
                    links.push({
                        spine: {
                            port: `${spine.metadata.name}/E1/${spinePort}`
                        },
                        leaf: {
                            port: `${leaf.metadata.name}/E1/${leafPort}`
                        }
                    });
                }

                if (links.length > 0) {
                    connections.push(
                        this.createK8sObject('Connection', 
                            `${spine.metadata.name}--fabric--${leaf.metadata.name}`,
                            { fabric: { links } }
                        )
                    );
                }
            });
        });

        return connections;
    }

    // Add server distribution helper functions
    generateServerName(index) {
        return `server-${index + 1}`;
    }

    generateSwitchName(model, index) {
        const role = model.toLowerCase().includes('spine') ? 'spine' : 'leaf';
        return `${role}-${index + 1}`;
    }

    distributeServersAcrossLeaves(serverCount, leafCount) {
        if (serverCount <= 0) throw new Error('Server count must be positive');
        if (leafCount <= 0) throw new Error('Leaf count must be positive');

        // Calculate base number of servers per leaf and remainder
        const baseServersPerLeaf = Math.floor(serverCount / leafCount);
        const remainingServers = serverCount % leafCount;
        
        // Create distribution map
        const distribution = {};
        let currentServer = 0;
        
        for (let leafIndex = 0; leafIndex < leafCount; leafIndex++) {
            const leafName = `leaf-${leafIndex + 1}`;
            // Add one extra server to some leaves if we have remainders
            const serversForThisLeaf = leafIndex < remainingServers ? 
              baseServersPerLeaf + 1 : baseServersPerLeaf;
            
            distribution[leafName] = [];
            for (let i = 0; i < serversForThisLeaf; i++) {
                distribution[leafName].push(`server-${currentServer + 1}`);
                currentServer++;
            }
        }
        
        return distribution;
    }

    generateServerPortName(index) {
        return `enp${Math.floor(index/2)}s${(index % 2) + 1}`;
    }

    async generateConfig(formData) {
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

            // Initialize port tracking
            const usedPorts = {};

            // Generate spine switch objects
            const spines = [];
            for (let i = 0; i < formData.topology.spines.count; i++) {
                const spineName = this.generateSwitchName(spineModel, i);
                usedPorts[spineName] = [];
                const spineObj = this.generateSwitch(spineName, spineModel, 'spine', {
                    portBreakouts: config.configs.spines[i].portBreakouts,
                    serial: formData.switchSerials[spineName]
                });
                spines.push(spineObj);
                k8sObjects.push(spineObj);
            }

            // Generate leaf switch objects
            const leaves = [];
            for (let i = 0; i < formData.leafCount; i++) {
                const leafName = this.generateSwitchName(leafModel, i);
                usedPorts[leafName] = [];
                const leafObj = this.generateSwitch(leafName, leafModel, 'leaf', {
                    portBreakouts: config.configs.leaves[i].portBreakouts,
                    serial: formData.switchSerials[leafName]
                });
                leaves.push(leafObj);
                k8sObjects.push(leafObj);
            }

            // Generate fabric connections
            const fabricConnections = this.generateFabricConnections(spines, leaves, config);
            k8sObjects.push(...fabricConnections);

            // Initialize port analyzers for each switch type
            const spineProfile = await this.switchProfileManager.getSwitchProfile(spineModel);
            const leafProfile = await this.switchProfileManager.getSwitchProfile(leafModel);
            const portAnalyzer = new PortProfileAnalyzer(leafProfile);

            // Initialize connection distributor
            const distributor = new ConnectionDistributor(leaves.length);

            // Generate server objects with port allocation
            const serverDistribution = this.distributeServersAcrossLeaves(
                parseInt(formData.serverCount),
                parseInt(formData.leafCount)
            );

            let currentLeafIndex = 0;
            Object.entries(serverDistribution).forEach(([_, servers]) => {
                servers.forEach(serverName => {
                    // Get leaf switches for this server's connections
                    const targetLeaves = distributor.getLeafSwitchesForServer(
                        formData.serverConfig.serverConfigType,
                        formData.serverConfig.connectionsPerServer,
                        currentLeafIndex
                    );

                    const serverPorts = [];
                    targetLeaves.forEach(leafName => {
                        const port = portAnalyzer.getNextAvailablePort(
                            usedPorts[leafName],
                            formData.serverConfig.breakoutType
                        );
                        usedPorts[leafName].push(port);
                        
                        const portName = portAnalyzer.getPortName(
                            port,
                            formData.serverConfig.breakoutType,
                            serverPorts.length
                        );
                        serverPorts.push(portName);
                    });

                    k8sObjects.push({
                        apiVersion: 'wiring.githedgehog.com/v1beta1',
                        kind: 'Server',
                        metadata: {
                            name: serverName
                        },
                        spec: {
                            description: `${formData.serverConfig.serverConfigType} server with ${serverPorts.length} connections`,
                            ports: serverPorts.map((_, i) => this.generateServerPortName(i))
                        }
                    });

                    // Generate connections for this server
                    const connectionGenerator = new ServerConnectionGenerator(
                        serverName,
                        formData.serverConfig.serverConfigType,
                        serverPorts
                    );

                    const connections = connectionGenerator.generateConnections(targetLeaves);
                    k8sObjects.push(...connections);
                });
                currentLeafIndex = (currentLeafIndex + 1) % parseInt(formData.leafCount);
            });

            return k8sObjects;
        } catch (error) {
            console.error('Error generating config:', error);
            throw error;
        }
    }
}

export { ConfigGenerator };
