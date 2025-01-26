export class ServerConnectionGenerator {
    constructor(serverName, configType, serverPorts) {
        this.serverName = serverName;
        this.configType = configType;
        this.serverPorts = serverPorts;
    }

    generateServerPortName(index) {
        return `enp${Math.floor(index/2)}s${(index % 2) + 1}`;
    }

    generateConnectionName(switchName) {
        return `${this.serverName}--${this.configType}--${switchName}`;
    }

    generateUnbundledConnection(switchName, switchPort, serverPortIndex) {
        return {
            apiVersion: 'wiring.githedgehog.com/v1beta1',
            kind: 'Connection',
            metadata: {
                name: this.generateConnectionName(switchName)
            },
            spec: {
                unbundled: {
                    link: {
                        endpoints: [
                            {
                                device: this.serverName,
                                port: this.generateServerPortName(serverPortIndex)
                            },
                            {
                                device: switchName,
                                port: switchPort
                            }
                        ]
                    }
                }
            }
        };
    }

    generateBundledLAGConnection(switchName) {
        return {
            apiVersion: 'wiring.githedgehog.com/v1beta1',
            kind: 'Connection',
            metadata: {
                name: this.generateConnectionName(switchName)
            },
            spec: {
                bundled: {
                    links: this.serverPorts.map((switchPort, index) => ({
                        endpoints: [
                            {
                                device: this.serverName,
                                port: this.generateServerPortName(index)
                            },
                            {
                                device: switchName,
                                port: switchPort
                            }
                        ]
                    }))
                }
            }
        };
    }

    generateMCLAGConnection(switchPair) {
        return {
            apiVersion: 'wiring.githedgehog.com/v1beta1',
            kind: 'Connection',
            metadata: {
                name: `${this.serverName}--mclag--${switchPair.join('-')}`
            },
            spec: {
                mclag: {
                    links: this.serverPorts.map((switchPort, index) => ({
                        endpoints: [
                            {
                                device: this.serverName,
                                port: this.generateServerPortName(index)
                            },
                            {
                                device: index % 2 === 0 ? switchPair[0] : switchPair[1],
                                port: switchPort
                            }
                        ]
                    }))
                }
            }
        };
    }

    generateESLAGConnection(switches) {
        return {
            apiVersion: 'wiring.githedgehog.com/v1beta1',
            kind: 'Connection',
            metadata: {
                name: `${this.serverName}--eslag--${switches.join('-')}`
            },
            spec: {
                eslag: {
                    links: this.serverPorts.map((switchPort, index) => ({
                        endpoints: [
                            {
                                device: this.serverName,
                                port: this.generateServerPortName(index)
                            },
                            {
                                device: switches[index % switches.length],
                                port: switchPort
                            }
                        ]
                    }))
                }
            }
        };
    }

    generateConnections(leafSwitches) {
        switch (this.configType) {
            case 'unbundled-SH':
                return this.serverPorts.map((port, index) => 
                    this.generateUnbundledConnection(
                        leafSwitches[0],
                        port,
                        index
                    )
                );
            
            case 'bundled-LAG-SH':
                return [this.generateBundledLAGConnection(leafSwitches[0])];
            
            case 'bundled-mclag':
                if (leafSwitches.length < 2) {
                    throw new Error('MCLAG requires at least 2 leaf switches');
                }
                return [this.generateMCLAGConnection([leafSwitches[0], leafSwitches[1]])];
            
            case 'bundled-eslag':
                if (leafSwitches.length < this.serverPorts.length) {
                    throw new Error('ESLAG requires one leaf switch per connection');
                }
                return [this.generateESLAGConnection(leafSwitches)];
            
            default:
                throw new Error(`Unknown server config type: ${this.configType}`);
        }
    }
}
