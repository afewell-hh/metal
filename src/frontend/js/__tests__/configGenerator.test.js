import { ConfigGenerator } from '../configGenerator';
import { PortProfileAnalyzer } from '../portProfileAnalyzer';
import { ConnectionDistributor } from '../connectionDistributor';
import { ServerConnectionGenerator } from '../serverConnectionGenerator';
import { PortAssignmentManager } from '../portAssignmentManager';
import { SwitchProfileManager } from '../switchProfileManager';

// Mock switch profile data
const mockSwitchProfile = {
    PortProfiles: {
        'server-25g': {
            Speed: '25G',
            Breakout: {
                Default: 'Fixed',
                Supported: {
                    'Fixed': {},
                    '1x25G': {}
                }
            }
        },
        'fabric-100g': {
            Speed: '100G',
            Breakout: {
                Default: 'Fixed',
                Supported: {
                    'Fixed': {},
                    '4x25G': {}
                }
            }
        }
    },
    Ports: {
        'Ethernet1': {
            Profile: 'server-25g'
        },
        'Ethernet2': {
            Profile: 'fabric-100g'
        },
        'Ethernet3': {
            Profile: 'server-25g'
        },
        'Ethernet4': {
            Profile: 'server-25g'
        },
        'Ethernet5': {
            Profile: 'server-25g'
        },
        'Ethernet6': {
            Profile: 'server-25g'
        },
        'Ethernet7': {
            Profile: 'server-25g'
        },
        'Ethernet8': {
            Profile: 'server-25g'
        }
    }
};

// Mock implementations
jest.mock('../switchProfileManager', () => ({
    SwitchProfileManager: jest.fn().mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(),
        getValidPorts: jest.fn().mockImplementation((model, type) => {
            if (type === 'fabric') {
                return ['Ethernet2', 'Ethernet3', 'Ethernet4', 'Ethernet5'];
            }
            return ['Ethernet1', 'Ethernet6', 'Ethernet7', 'Ethernet8'];
        }),
        getSwitchProfile: jest.fn().mockResolvedValue(mockSwitchProfile)
    }))
}));

describe('Server Distribution Logic', () => {
    let generator;
    let switchProfileManager;
    let portRules;

    beforeEach(() => {
        switchProfileManager = new SwitchProfileManager();
        portRules = {
            initialize: jest.fn().mockResolvedValue(),
            getValidPorts: jest.fn().mockImplementation((model, type) => {
                if (type === 'fabric') {
                    return ['Ethernet2', 'Ethernet3', 'Ethernet4', 'Ethernet5'];
                }
                return ['Ethernet1', 'Ethernet6', 'Ethernet7', 'Ethernet8'];
            })
        };
        generator = new ConfigGenerator(switchProfileManager, portRules);
    });

    test('distributes servers evenly across leaves', () => {
        const distribution = generator.distributeServersAcrossLeaves(4, 2);
        expect(Object.keys(distribution)).toHaveLength(2);
        expect(distribution['leaf-1']).toHaveLength(2);
        expect(distribution['leaf-2']).toHaveLength(2);
    });

    test('validates server count against leaf count', () => {
        expect(() => generator.distributeServersAcrossLeaves(0, 2))
            .toThrow('Server count must be positive');
        expect(() => generator.distributeServersAcrossLeaves(2, 0))
            .toThrow('Leaf count must be positive');
    });
});

describe('Port Profile Analysis', () => {
    let analyzer;

    beforeEach(() => {
        analyzer = new PortProfileAnalyzer(mockSwitchProfile);
    });

    test('identifies server ports correctly', () => {
        const serverPorts = analyzer.getServerPorts();
        expect(serverPorts).toHaveLength(7);
        expect(serverPorts[0].name).toBe('Ethernet1');
        expect(serverPorts[0].profile.Speed).toBe('25G');
    });

    test('returns breakout info for ports', () => {
        const info = analyzer.getBreakoutInfo('Ethernet1');
        expect(info.isFixed).toBe(false);
        expect(info.breakoutModes).toContain('Fixed');
        expect(info.breakoutModes).toContain('1x25G');
        expect(info.defaultMode).toBe('Fixed');
    });
});

describe('Connection Distribution', () => {
    let distributor;
    let switchProfileManager;
    let portRules;

    beforeEach(() => {
        switchProfileManager = new SwitchProfileManager();
        portRules = {
            initialize: jest.fn().mockResolvedValue(),
            getValidPorts: jest.fn().mockImplementation((model, type) => {
                if (type === 'fabric') {
                    return ['Ethernet2', 'Ethernet3', 'Ethernet4', 'Ethernet5'];
                }
                return ['Ethernet1', 'Ethernet6', 'Ethernet7', 'Ethernet8'];
            })
        };
        distributor = new ConnectionDistributor(4, switchProfileManager, portRules);
    });

    test('validates connection counts', () => {
        expect(() => distributor.validateConnectionCount(3))
            .toThrow('Invalid connection count');
        expect(() => distributor.validateConnectionCount(1)).not.toThrow();
    });

    test('handles single connections', () => {
        const leaves = distributor.getLeafSwitchesForServer('unbundled-SH', 1, 0);
        expect(leaves).toHaveLength(1);
        expect(leaves[0]).toBe('leaf-1');
    });

    test('handles bundled-LAG-SH', () => {
        const leaves = distributor.getLeafSwitchesForServer('bundled-LAG-SH', 2, 0);
        expect(leaves).toHaveLength(2);
        expect(leaves[0]).toBe('leaf-1');
        expect(leaves[1]).toBe('leaf-1');
    });

    test('handles MCLAG configuration', () => {
        const leaves = distributor.getLeafSwitchesForServer('bundled-mclag', 2, 0);
        expect(leaves).toHaveLength(2);
        expect(leaves[0]).toBe('leaf-1');
        expect(leaves[1]).toBe('leaf-2');
    });

    test('validates leaf count for MCLAG', () => {
        const smallDistributor = new ConnectionDistributor(1, switchProfileManager, portRules);
        expect(() => smallDistributor.getLeafSwitchesForServer('bundled-mclag', 2, 0))
            .toThrow('Not enough leaf switches for MCLAG configuration');
    });

    test('handles ESLAG configuration', () => {
        const leaves = distributor.getLeafSwitchesForServer('bundled-eslag', 4, 0);
        expect(leaves).toHaveLength(4);
        expect(leaves).toEqual(['leaf-1', 'leaf-2', 'leaf-3', 'leaf-4']);
    });
});

describe('Connection Generation', () => {
    let generator;
    let switchProfileManager;
    let portRules;
    const serverName = 'server-1';
    const serverPorts = ['Ethernet1', 'Ethernet2'];

    beforeEach(() => {
        switchProfileManager = new SwitchProfileManager();
        portRules = {
            initialize: jest.fn().mockResolvedValue(),
            getValidPorts: jest.fn().mockImplementation((model, type) => {
                if (type === 'fabric') {
                    return ['Ethernet2', 'Ethernet3', 'Ethernet4', 'Ethernet5'];
                }
                return ['Ethernet1', 'Ethernet6', 'Ethernet7', 'Ethernet8'];
            })
        };
        generator = new ServerConnectionGenerator(serverName, 'unbundled-SH', serverPorts, switchProfileManager, portRules);
    });

    test('generates server port names correctly', () => {
        expect(generator.generateServerPortName(0)).toBe('enp0s1');
        expect(generator.generateServerPortName(1)).toBe('enp0s2');
        expect(generator.generateServerPortName(2)).toBe('enp1s1');
    });

    test('generates unbundled connections', () => {
        const connections = generator.generateConnections(['leaf-1']);
        expect(connections).toHaveLength(2);
        expect(connections[0].spec.unbundled).toBeDefined();
        expect(connections[0].spec.unbundled.link.endpoints).toHaveLength(2);
    });

    test('generates bundled LAG connections', () => {
        generator = new ServerConnectionGenerator(serverName, 'bundled-LAG-SH', serverPorts, switchProfileManager, portRules);
        const connections = generator.generateConnections(['leaf-1']);
        expect(connections).toHaveLength(1);
        expect(connections[0].spec.bundled).toBeDefined();
        expect(connections[0].spec.bundled.links).toHaveLength(2);
    });

    test('generates MCLAG connections', () => {
        generator = new ServerConnectionGenerator(serverName, 'bundled-mclag', serverPorts, switchProfileManager, portRules);
        const connections = generator.generateConnections(['leaf-1', 'leaf-2']);
        expect(connections).toHaveLength(1);
        expect(connections[0].spec.mclag).toBeDefined();
        expect(connections[0].spec.mclag.links).toHaveLength(2);
    });

    test('generates ESLAG connections', () => {
        generator = new ServerConnectionGenerator(serverName, 'bundled-eslag', serverPorts, switchProfileManager, portRules);
        const connections = generator.generateConnections(['leaf-1', 'leaf-2']);
        expect(connections).toHaveLength(1);
        expect(connections[0].spec.eslag).toBeDefined();
        expect(connections[0].spec.eslag.links).toHaveLength(2);
    });
});

describe('End-to-End Config Generation', () => {
    let generator;
    let switchProfileManager;
    let portRules;

    beforeEach(() => {
        switchProfileManager = new SwitchProfileManager();
        portRules = {
            initialize: jest.fn().mockResolvedValue(),
            getValidPorts: jest.fn().mockImplementation((model, type) => {
                if (type === 'fabric') {
                    return ['Ethernet2', 'Ethernet3', 'Ethernet4', 'Ethernet5'];
                }
                return ['Ethernet1', 'Ethernet6', 'Ethernet7', 'Ethernet8'];
            })
        };
        generator = new ConfigGenerator(switchProfileManager, portRules);
    });

    test('generates complete configuration', async () => {
        // Initialize dependencies
        await switchProfileManager.initialize();
        await portRules.initialize();

        const formData = {
            leafCount: 4,
            serverCount: 8,
            topology: {
                spines: {
                    model: 'dell-s5232f-on',
                    count: 2,
                    fabricPortsPerSpine: 4
                },
                leaves: {
                    model: 'dell-s5248f-on',
                    fabricPortsPerLeaf: 2  // Must be >= number of spine switches
                }
            },
            serverConfig: {
                serverConfigType: 'unbundled-SH',
                connectionsPerServer: 1,
                breakoutType: 'Fixed'
            },
            vlanNamespace: {
                ranges: [
                    { start: 100, end: 200 },
                    { start: 300, end: 400 }
                ]
            },
            ipv4Namespaces: [
                {
                    name: 'fabric',
                    subnets: ['10.0.0.0/16']
                },
                {
                    name: 'servers',
                    subnets: ['192.168.0.0/16']
                }
            ],
            switchSerials: {
                'spine-1': 'SPINE001',
                'spine-2': 'SPINE002',
                'leaf-1': 'LEAF001',
                'leaf-2': 'LEAF002',
                'leaf-3': 'LEAF003',
                'leaf-4': 'LEAF004'
            }
        };

        const config = await generator.generateConfig(formData);
        expect(config).toBeDefined();
        expect(config).toBeInstanceOf(Array);
        expect(config.length).toBeGreaterThan(0);

        // Verify server objects
        const serverObjects = config.filter(obj => obj.kind === 'Server');
        expect(serverObjects).toHaveLength(8);

        // Verify connection objects
        const connectionObjects = config.filter(obj => obj.kind === 'Connection');
        expect(connectionObjects).toHaveLength(8);

        // Verify server distribution
        const serverDistribution = {};
        connectionObjects.forEach(conn => {
            const leafName = conn.spec.unbundled.link.endpoints[1].device;
            serverDistribution[leafName] = (serverDistribution[leafName] || 0) + 1;
        });

        // Each leaf should have 2 servers (8 servers / 4 leaves)
        Object.values(serverDistribution).forEach(count => {
            expect(count).toBe(2);
        });
    });
});
