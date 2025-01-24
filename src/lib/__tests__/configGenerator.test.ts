import { ConfigGenerator } from '../configGenerator';
import { SpineLeafConfig, SwitchProfile } from '../../types/config';
import { switchProfiles } from '../../data/switchProfiles';

describe('ConfigGenerator', () => {
  let generator: ConfigGenerator;

  beforeEach(() => {
    generator = new ConfigGenerator(switchProfiles);
  });

  describe('Spine-Leaf Configuration', () => {
    const validConfig: SpineLeafConfig = {
      leafModel: 'dell-s5248f-on',
      spineModel: 'dell-s5232f-on',
      leafCount: 4,
      spineCount: 2,
      totalServerPorts: 96,
      uplinksPerLeaf: 4
    };

    it('generates valid configuration for spine-leaf topology', () => {
      const result = generator.generateSpineLeafConfig(validConfig);

      // Verify switches are created
      expect(Object.keys(result.switches)).toHaveLength(6); // 4 leaf + 2 spine
      expect(Object.keys(result.switches).filter(id => id.startsWith('leaf-'))).toHaveLength(4);
      expect(Object.keys(result.switches).filter(id => id.startsWith('spine-'))).toHaveLength(2);

      // Verify uplink assignments
      Object.entries(result.switches)
        .filter(([id]) => id.startsWith('leaf-'))
        .forEach(([_, leaf]) => {
          const uplinkPorts = leaf.ports.filter(p => p.type === 'uplink');
          expect(uplinkPorts).toHaveLength(validConfig.uplinksPerLeaf);
          
          // Verify uplinks are assigned to the first available ports
          const portNumbers = uplinkPorts
            .map(p => parseInt(p.portId.replace('E1/', '')))
            .filter(n => !isNaN(n));
          expect(Math.max(...portNumbers)).toBeLessThanOrEqual(validConfig.uplinksPerLeaf);
        });

      // Verify server port assignments
      const totalServerPortsAssigned = Object.values(result.switches)
        .filter(sw => sw.model === validConfig.leafModel)
        .reduce((sum, leaf) => sum + leaf.ports.filter(p => p.type === 'server').length, 0);
      expect(totalServerPortsAssigned).toBe(validConfig.totalServerPorts);

      // Verify uplink symmetry
      Object.entries(result.switches)
        .filter(([id]) => id.startsWith('spine-'))
        .forEach(([_, spine]) => {
          const connectedLeaves = new Set(
            spine.ports
              .filter(p => p.type === 'uplink')
              .map(p => p.connectedTo?.switchId)
          );
          expect(connectedLeaves.size).toBe(validConfig.leafCount);
        });

      // Verify diagrams are generated
      expect(result.diagrams.topology).toContain('graph TD');
      expect(result.diagrams.cabling).toContain('graph LR');
    });

    it('validates port capacity', () => {
      const invalidConfig = {
        ...validConfig,
        totalServerPorts: 1000 // More than available ports
      };

      expect(() => generator.generateSpineLeafConfig(invalidConfig))
        .toThrow('Not enough ports available on leaf switches');
    });

    it('validates uplink symmetry', () => {
      const invalidConfig = {
        ...validConfig,
        uplinksPerLeaf: 3 // Not divisible by spine count (2)
      };

      expect(() => generator.generateSpineLeafConfig(invalidConfig))
        .toThrow('Number of uplinks per leaf must be divisible by number of spine switches');
    });

    it('handles optional server ports', () => {
      const configWithoutServers = {
        ...validConfig,
        totalServerPorts: undefined
      };

      const result = generator.generateSpineLeafConfig(configWithoutServers);
      
      // Should only have uplink ports
      Object.entries(result.switches)
        .filter(([id]) => id.startsWith('leaf-'))
        .forEach(([_, leaf]) => {
          expect(leaf.ports.filter(p => p.type === 'server')).toHaveLength(0);
          expect(leaf.ports.filter(p => p.type === 'uplink')).toHaveLength(configWithoutServers.uplinksPerLeaf);
        });
    });

    it('distributes server ports evenly', () => {
      const result = generator.generateSpineLeafConfig(validConfig);
      
      const leafSwitches = Object.entries(result.switches)
        .filter(([id]) => id.startsWith('leaf-'));
      
      const serverPortCounts = leafSwitches.map(
        ([_, leaf]) => leaf.ports.filter(p => p.type === 'server').length
      );

      // Maximum difference in server ports between any two leaves should be 1
      const maxPorts = Math.max(...serverPortCounts);
      const minPorts = Math.min(...serverPortCounts);
      expect(maxPorts - minPorts).toBeLessThanOrEqual(1);
    });

    it('validates switch models', () => {
      const invalidConfig = {
        ...validConfig,
        leafModel: 'invalid-model'
      };

      expect(() => generator.generateSpineLeafConfig(invalidConfig))
        .toThrow('Invalid switch model specified');
    });
  });
});
