import { PortAssignmentManager } from './portAssignmentManager';
import { SwitchProfileManager } from './switchProfileManager';
import { PortProfileAnalyzer } from './portProfileAnalyzer';
import { ConnectionDistributor } from './connectionDistributor';
import { ServerConnectionGenerator } from './serverConnectionGenerator';

export class ConfigGenerator {
    constructor(switchProfileManager, portRules) {
        if (!switchProfileManager || !portRules) {
            throw new Error('ConfigGenerator requires switchProfileManager and portRules');
        }
        this.switchProfileManager = switchProfileManager;
        this.portRules = portRules;
        this.portAssignmentManager = new PortAssignmentManager(portRules);
        this.portProfileAnalyzer = new PortProfileAnalyzer();
        this.connectionDistributor = new ConnectionDistributor();
        this.serverConnectionGenerator = new ServerConnectionGenerator();
        this.usedPorts = {};
    }

    async generateConfig(formData) {
        try {
            // Ensure switch profiles are loaded
            if (!this.switchProfileManager.initialized) {
                await this.switchProfileManager.initialize();
            }

            // Get switch profiles
            const spineModel = formData.topology.spines.model;
            const leafModel = formData.topology.leaves.model;

            const spineProfile = await this.switchProfileManager.getSwitchProfile(spineModel);
            const leafProfile = await this.switchProfileManager.getSwitchProfile(leafModel);

            if (!spineProfile || !leafProfile) {
                throw new Error('Failed to load switch profiles');
            }

            // Generate port assignments
            const portAssignments = await this.portAssignmentManager.validateAndAssignPorts(formData);

            // Generate all required Kubernetes CRD objects
            const k8sObjects = [];

            // Add VLANNamespace
            k8sObjects.push(this.generateVLANNamespace(formData.vlanNamespace.ranges));

            // Add IPv4Namespaces
            formData.ipv4Namespaces.forEach(ns => {
                k8sObjects.push(this.generateIPv4Namespace(ns.name, ns.subnets));
            });

            // Initialize port tracking
            const usedPorts = {};

            // Generate spine switch objects
            const spines = [];
            for (let i = 0; i < formData.topology.spines.count; i++) {
                const spineName = this.getSwitchNameFromProfile(spineModel, i + 1);
                usedPorts[spineName] = [];
                const spineObj = this.generateSwitch(spineName, spineModel, 'spine', {
                    portBreakouts: portAssignments.configs.spines[i].portBreakouts || {},
                    serial: formData.switchSerials[spineName]
                });
                spines.push(spineObj);
                k8sObjects.push(spineObj);
            }

            // Generate leaf switch objects
            const leaves = [];
            for (let i = 0; i < formData.topology.leaves.count; i++) {
                const leafName = this.getSwitchNameFromProfile(leafModel, i + 1);
                usedPorts[leafName] = [];
                const leafObj = this.generateSwitch(leafName, leafModel, 'leaf', {
                    portBreakouts: portAssignments.configs.leaves[i].portBreakouts || {},
                    serial: formData.switchSerials[leafName]
                });
                leaves.push(leafObj);
                k8sObjects.push(leafObj);
            }

            // Generate fabric connections
            const fabricConnections = this.generateFabricConnections(formData, spines, leaves, portAssignments);
            k8sObjects.push(...fabricConnections);

            // Generate server objects and connections
            const serverObjects = this.generateServerObjects(formData);
            k8sObjects.push(...serverObjects);

            const serverConnections = this.generateServerConnections(formData, leaves, portAssignments);
            k8sObjects.push(...serverConnections);

            return k8sObjects;
        } catch (error) {
            console.error('Error generating config:', error);
            throw error;
        }
    }

    generateVLANNamespace(ranges) {
        return this.createK8sObject('VLANNamespace', 'default', {
            ranges: ranges.map(range => ({
                from: range.from,
                to: range.to
            }))
        });
    }

    generateIPv4Namespace(name, subnets) {
        return this.createK8sObject('IPv4Namespace', name, {
            subnets: subnets.map(subnet => subnet)
        });
    }

    generateSwitch(name, model, role, config) {
        const switchObj = {
            apiVersion: 'wiring.githedgehog.com/v1beta1',
            kind: 'Switch',
            metadata: {
                name: name,
                annotations: {
                    'type.hhfab.githedgehog.com': 'hw'
                }
            },
            spec: {
                profile: model,
                role: role,
                description: name,
                boot: {},
                portBreakouts: {}  // Always empty for now
            }
        };

        // Add serial number if provided
        if (config.serial) {
            switchObj.metadata.annotations['serial.hhfab.githedgehog.com'] = `ssh://192.168.88.10:${config.serial}`;
            switchObj.spec.boot.serial = config.serial;
        }

        return switchObj;
    }

    // Helper function to generate switch names from switch profiles
    getSwitchNameFromProfile(profile, index) {
        // Extract model number for different switch types
        if (profile.startsWith('dell-s')) {
            // For Dell switches: dell-s5232f-on -> s5232-XX
            const modelNum = profile.match(/dell-s(\d+)f-on/)[1];
            return `s${modelNum}-${String(index).padStart(2, '0')}`;
        } else if (profile.startsWith('celestica-ds')) {
            // For Celestica switches: celestica-ds3000 -> ds3000-XX
            const modelNum = profile.match(/celestica-ds(\d+)/)[1];
            return `ds${modelNum}-${String(index).padStart(2, '0')}`;
        }
        // Fallback case - should not happen with valid profiles
        throw new Error(`Unsupported switch profile format: ${profile}`);
    }

    generateFabricConnections(formData, spines, leaves, portAssignments) {
        const connections = [];
        const uplinksPerLeaf = formData.topology.leaves.fabricPortsPerLeaf;
        const numSpines = spines.length;

        // For each leaf switch
        leaves.forEach((leaf, leafIndex) => {
            // Calculate how many uplinks should go to each spine
            const uplinksPerSpine = Math.floor(uplinksPerLeaf / numSpines);
            if (uplinksPerSpine === 0) {
                throw new Error(`Cannot evenly distribute ${uplinksPerLeaf} uplinks across ${numSpines} spines. Each leaf needs at least ${numSpines} uplinks.`);
            }

            // Get proper switch names based on profile
            const leafName = this.getSwitchNameFromProfile(leaf.spec.profile, leafIndex + 1);

            // For each spine switch
            spines.forEach((spine, spineIndex) => {
                const links = [];
                const spineName = this.getSwitchNameFromProfile(spine.spec.profile, spineIndex + 1);
                
                // Generate the links for this spine-leaf pair
                for (let i = 0; i < uplinksPerSpine; i++) {
                    // Calculate spine port number - each leaf gets a dedicated range on the spine
                    const spinePortNum = leafIndex * uplinksPerSpine + i + 1;
                    
                    // Calculate leaf port number - use fabric ports (49,51,53,55)
                    // Each spine gets its own set of ports
                    const leafBasePort = 49 + (spineIndex * 4); // 4 ports reserved per spine
                    const leafPortNum = leafBasePort + (i * 2); // Skip every other port
                    
                    links.push({
                        spine: {
                            port: `${spineName}/E1/${spinePortNum}`
                        },
                        leaf: {
                            port: `${leafName}/E1/${leafPortNum}`
                        }
                    });
                }

                if (links.length > 0) {
                    connections.push(
                        this.createK8sObject('Connection', 
                            `${spineName}--fabric--${leafName}`,
                            { fabric: { links } }
                        )
                    );
                }
            });
        });

        return connections;
    }

    generateServerObjects(formData) {
        const servers = [];
        const serverCount = parseInt(formData.serverCount);
        const serverType = formData.serverConfig.serverConfigType;
        
        for (let i = 0; i < serverCount; i++) {
            const serverName = `server-${i + 1}`;
            const leafIndex = Math.floor(i / Math.ceil(serverCount / formData.topology.leaves.count));
            const leafName = `leaf-${leafIndex + 1}`;
            const portBase = (i % Math.ceil(serverCount / formData.topology.leaves.count)) + 1;

            // Generate description based on server type
            let description;
            switch (serverType) {
                case 'unbundled-SH':
                    description = `SH ${leafName}/E${portBase}`;
                    break;
                case 'bundled-LAG-SH':
                    description = `SH LAG ${leafName}/E${portBase}-${portBase + 1}`;
                    break;
                case 'bundled-mclag':
                    const nextLeafName = `leaf-${(leafIndex + 1) % formData.topology.leaves.count + 1}`;
                    description = `MCLAG ${leafName}/E${portBase} ${nextLeafName}/E${portBase}`;
                    break;
                case 'bundled-eslag':
                    const eslagLeafName = `leaf-${(leafIndex + 1) % formData.topology.leaves.count + 1}`;
                    description = `ESLAG ${leafName}/E${portBase} ${eslagLeafName}/E${portBase}`;
                    break;
                default:
                    description = `Unknown configuration type`;
            }

            servers.push(this.createK8sObject('Server', serverName, {
                description
            }));
        }

        return servers;
    }

    generateServerConnections(formData, leaves, portAssignments) {
        const connections = [];
        const serverCount = formData.serverConfig.totalServerPorts;
        const connectionsPerServer = formData.serverConfig.connectionsPerServer;
        const serverConfigType = formData.serverConfig.serverConfigType;

        console.log('Generating server connections:', {
            serverCount,
            connectionsPerServer,
            serverConfigType,
            leavesCount: leaves.length
        });

        // For each server
        for (let serverIndex = 0; serverIndex < serverCount; serverIndex++) {
            const serverNum = serverIndex + 1;
            const serverName = `server-${serverNum}`;
            let interfaceIndex = 1; // For enp2s{N} interfaces

            // Get the leaf switch(es) and ports for this server based on configuration type
            switch (serverConfigType) {
                case 'unbundled-SH': {
                    // Single connection to a single leaf
                    const leafIndex = Math.floor(serverIndex / Math.floor(serverCount / leaves.length));
                    const leaf = leaves[leafIndex];
                    const leafName = this.getSwitchNameFromProfile(leaf.spec.profile, leafIndex + 1);
                    
                    const links = [{
                        server: {
                            port: `${serverName}/enp2s${interfaceIndex}`
                        },
                        switch: {
                            port: `${leafName}/E1/${serverIndex + 1}`
                        }
                    }];

                    connections.push(
                        this.createK8sObject('Connection',
                            `${serverName}--unbundled--${leafName}`,
                            { unbundled: { links } }
                        )
                    );
                    break;
                }
                case 'bundled-LAG-SH': {
                    // Multiple connections to the same leaf (LAG)
                    const leafIndex = Math.floor(serverIndex / Math.floor(serverCount / leaves.length));
                    const leaf = leaves[leafIndex];
                    const leafName = this.getSwitchNameFromProfile(leaf.spec.profile, leafIndex + 1);
                    const links = [];

                    // Add multiple links for the LAG
                    for (let i = 0; i < connectionsPerServer; i++) {
                        links.push({
                            server: {
                                port: `${serverName}/enp2s${interfaceIndex + i}`
                            },
                            switch: {
                                port: `${leafName}/E1/${serverIndex * connectionsPerServer + i + 1}`
                            }
                        });
                    }

                    connections.push(
                        this.createK8sObject('Connection',
                            `${serverName}--bundled--${leafName}`,
                            { bundled: { links } }
                        )
                    );
                    break;
                }
                case 'bundled-mclag': {
                    // Connections split between two leaves (MLAG)
                    const leafPairIndex = Math.floor(serverIndex / Math.floor(serverCount / (leaves.length / 2)));
                    const leaf1 = leaves[leafPairIndex * 2];
                    const leaf2 = leaves[leafPairIndex * 2 + 1];
                    const leaf1Name = this.getSwitchNameFromProfile(leaf1.spec.profile, leafPairIndex * 2 + 1);
                    const leaf2Name = this.getSwitchNameFromProfile(leaf2.spec.profile, leafPairIndex * 2 + 2);
                    
                    const links = [
                        {
                            server: {
                                port: `${serverName}/enp2s${interfaceIndex}`
                            },
                            switch: {
                                port: `${leaf1Name}/E1/${serverIndex + 1}`
                            }
                        },
                        {
                            server: {
                                port: `${serverName}/enp2s${interfaceIndex + 1}`
                            },
                            switch: {
                                port: `${leaf2Name}/E1/${serverIndex + 1}`
                            }
                        }
                    ];

                    connections.push(
                        this.createK8sObject('Connection',
                            `${serverName}--mclag--${leaf1Name}--${leaf2Name}`,
                            { mclag: { links } }
                        )
                    );
                    break;
                }
                case 'bundled-eslag': {
                    // Connections split between two non-MLAG leaves (ESLAG)
                    const leaf1Index = serverIndex % leaves.length;
                    const leaf2Index = (serverIndex + 1) % leaves.length;
                    const leaf1 = leaves[leaf1Index];
                    const leaf2 = leaves[leaf2Index];
                    const leaf1Name = this.getSwitchNameFromProfile(leaf1.spec.profile, leaf1Index + 1);
                    const leaf2Name = this.getSwitchNameFromProfile(leaf2.spec.profile, leaf2Index + 1);
                    
                    const links = [
                        {
                            server: {
                                port: `${serverName}/enp2s${interfaceIndex}`
                            },
                            switch: {
                                port: `${leaf1Name}/E1/${serverIndex + 1}`
                            }
                        },
                        {
                            server: {
                                port: `${serverName}/enp2s${interfaceIndex + 1}`
                            },
                            switch: {
                                port: `${leaf2Name}/E1/${serverIndex + 1}`
                            }
                        }
                    ];

                    connections.push(
                        this.createK8sObject('Connection',
                            `${serverName}--eslag--${leaf1Name}--${leaf2Name}`,
                            { eslag: { links } }
                        )
                    );
                    break;
                }
            }
        }

        return connections;
    }

    generateServerPortName(index) {
        return `enp${Math.floor(index/2)}s${(index % 2) + 1}`;
    }

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
}

// Export standalone utility functions
export function generateSwitchName(role, index) {
    return `${role}-${index + 1}`;
}

// Main config generation function that uses ConfigGenerator class
export function generateConfig(formData, switchProfileManager, portRules) {
    const generator = new ConfigGenerator(switchProfileManager, portRules);
    return generator.generateConfig(formData);
}
