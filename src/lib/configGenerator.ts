import { SpineLeafConfig, GeneratedConfig, PortAssignment, SwitchProfile } from '../types/config';

export class ConfigGenerator {
  private switchProfiles: Map<string, SwitchProfile>;

  constructor(switchProfiles: SwitchProfile[]) {
    this.switchProfiles = new Map(switchProfiles.map(p => [p.model, p]));
  }

  generateSpineLeafConfig(config: SpineLeafConfig): GeneratedConfig {
    // Validate configuration
    this.validateSpineLeafConfig(config);

    // Generate switch configurations
    const switches: GeneratedConfig['switches'] = {};
    const connections: GeneratedConfig['connections'] = {};

    // Initialize leaf switches
    for (let i = 0; i < config.leafCount; i++) {
      const switchId = `leaf-${i + 1}`;
      switches[switchId] = {
        model: config.leafModel,
        serialNumber: config.serialNumbers?.leaf[switchId],
        ports: []
      };
    }

    // Initialize spine switches
    for (let i = 0; i < config.spineCount; i++) {
      const switchId = `spine-${i + 1}`;
      switches[switchId] = {
        model: config.spineModel,
        serialNumber: config.serialNumbers?.spine[switchId],
        ports: []
      };
    }

    // Assign uplink ports first (starting from lowest port numbers)
    this.assignUplinks(switches, connections, config);

    // Assign server ports if specified
    if (config.totalServerPorts) {
      this.assignServerPorts(switches, connections, config);
    }

    return {
      switches,
      connections,
      diagrams: this.generateDiagrams(switches, connections)
    };
  }

  private validateSpineLeafConfig(config: SpineLeafConfig): void {
    const leafProfile = this.switchProfiles.get(config.leafModel);
    const spineProfile = this.switchProfiles.get(config.spineModel);

    if (!leafProfile || !spineProfile) {
      throw new Error('Invalid switch model specified');
    }

    const availableLeafPorts = leafProfile.ports.filter(p => p.type !== 'Management').length;
    const availableSpinePorts = spineProfile.ports.filter(p => p.type !== 'Management').length;

    // Calculate required ports
    const requiredLeafPorts = (config.totalServerPorts || 0) / config.leafCount + config.uplinksPerLeaf;
    const requiredSpinePorts = config.leafCount * config.uplinksPerLeaf / config.spineCount;

    if (requiredLeafPorts > availableLeafPorts) {
      throw new Error('Not enough ports available on leaf switches');
    }

    if (requiredSpinePorts > availableSpinePorts) {
      throw new Error('Not enough ports available on spine switches');
    }

    // Validate uplink symmetry
    if ((config.uplinksPerLeaf % config.spineCount) !== 0) {
      throw new Error('Number of uplinks per leaf must be divisible by number of spine switches');
    }
  }

  private assignUplinks(
    switches: GeneratedConfig['switches'],
    connections: GeneratedConfig['connections'],
    config: SpineLeafConfig
  ): void {
    const uplinksPerSpine = config.uplinksPerLeaf / config.spineCount;

    Object.entries(switches)
      .filter(([id]) => id.startsWith('leaf-'))
      .forEach(([leafId, leaf]) => {
        const leafProfile = this.switchProfiles.get(leaf.model)!;
        let uplinkPortIndex = 0;

        Object.entries(switches)
          .filter(([id]) => id.startsWith('spine-'))
          .forEach(([spineId, spine]) => {
            const spineProfile = this.switchProfiles.get(spine.model)!;

            for (let i = 0; i < uplinksPerSpine; i++) {
              const leafPort = leafProfile.ports[uplinkPortIndex].id;
              const spinePort = spineProfile.ports[i].id;

              const connectionId = `${leafId}-to-${spineId}-${i}`;
              connections[connectionId] = {
                from: { switchId: leafId, portId: leafPort },
                to: { switchId: spineId, portId: spinePort },
                type: 'uplink'
              };

              // Add port assignments
              leaf.ports.push({
                switchId: leafId,
                portId: leafPort,
                type: 'uplink',
                connectedTo: { switchId: spineId, portId: spinePort }
              });

              spine.ports.push({
                switchId: spineId,
                portId: spinePort,
                type: 'uplink',
                connectedTo: { switchId: leafId, portId: leafPort }
              });

              uplinkPortIndex++;
            }
          });
      });
  }

  private assignServerPorts(
    switches: GeneratedConfig['switches'],
    connections: GeneratedConfig['connections'],
    config: SpineLeafConfig
  ): void {
    const totalServerPorts = config.totalServerPorts || 0;
    const portsPerLeaf = Math.ceil(totalServerPorts / config.leafCount);

    let serverPortsAssigned = 0;
    Object.entries(switches)
      .filter(([id]) => id.startsWith('leaf-'))
      .forEach(([leafId, leaf]) => {
        const leafProfile = this.switchProfiles.get(leaf.model)!;
        const startPort = config.uplinksPerLeaf; // Start after uplink ports

        for (let i = 0; i < portsPerLeaf && serverPortsAssigned < totalServerPorts; i++) {
          const portIndex = startPort + i;
          const portId = leafProfile.ports[portIndex].id;

          leaf.ports.push({
            switchId: leafId,
            portId,
            type: 'server'
          });

          serverPortsAssigned++;
        }
      });
  }

  private generateDiagrams(
    switches: GeneratedConfig['switches'],
    connections: GeneratedConfig['connections']
  ): GeneratedConfig['diagrams'] {
    // Generate high-level topology diagram
    const topology = this.generateTopologyDiagram(switches, connections);
    
    // Generate detailed cabling diagram
    const cabling = this.generateCablingDiagram(switches, connections);

    return { topology, cabling };
  }

  private generateTopologyDiagram(
    switches: GeneratedConfig['switches'],
    connections: GeneratedConfig['connections']
  ): string {
    let diagram = 'graph TD\n';
    
    // Add switches
    Object.keys(switches).forEach(switchId => {
      diagram += `  ${switchId}[${switchId}]\n`;
    });

    // Add connections
    Object.values(connections)
      .filter(conn => conn.type === 'uplink')
      .forEach(conn => {
        diagram += `  ${conn.from.switchId} --- ${conn.to.switchId}\n`;
      });

    return diagram;
  }

  private generateCablingDiagram(
    switches: GeneratedConfig['switches'],
    connections: GeneratedConfig['connections']
  ): string {
    let diagram = 'graph LR\n';
    
    // Create subgraphs for each switch
    Object.entries(switches).forEach(([switchId, sw]) => {
      diagram += `  subgraph ${switchId}\n`;
      sw.ports.forEach(port => {
        diagram += `    ${switchId}_${port.portId}[${port.portId}]\n`;
      });
      diagram += '  end\n';
    });

    // Add connections
    Object.values(connections).forEach(conn => {
      diagram += `  ${conn.from.switchId}_${conn.from.portId} --- ${conn.to.switchId}_${conn.to.portId}\n`;
    });

    return diagram;
  }
}
