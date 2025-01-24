class ConfigGenerator {
    constructor(switchProfiles) {
        console.log('Initializing ConfigGenerator with profiles:', switchProfiles);
        this.switchProfiles = switchProfiles;
    }

    // Helper to generate MAC address
    generateMacAddress(switchIndex) {
        // Using a base MAC address and incrementing it
        const baseMac = '00:1B:44:11:3A';
        const hex = (switchIndex).toString(16).padStart(2, '0');
        return `${baseMac}:${hex}`;
    }

    // Helper to generate serial number
    generateSerialNumber(model, switchIndex) {
        // Format based on switch model examples from reference files
        const prefix = model.includes('s5232') ? 'CN123' : 
                      model.includes('s5248') ? 'DX030' : 'HX456';
        return `${prefix}F2B${switchIndex.toString().padStart(3, '0')}UB${(2000 + switchIndex).toString()}`;
    }

    generateSpineLeafConfig({ leafModel, spineModel, leafCount, spineCount, uplinksPerLeaf, totalServerPorts }) {
        console.log('Generating spine-leaf config with params:', {
            leafModel, spineModel, leafCount, spineCount, uplinksPerLeaf, totalServerPorts
        });

        // Validate inputs
        if (!leafModel || !spineModel || !leafCount || !spineCount || !uplinksPerLeaf) {
            throw new Error('Missing required parameters');
        }

        const leafProfile = this.switchProfiles.find(p => p.model === leafModel);
        const spineProfile = this.switchProfiles.find(p => p.model === spineModel);

        console.log('Found switch profiles:', { leafProfile, spineProfile });

        if (!leafProfile || !spineProfile) {
            throw new Error('Invalid switch models');
        }

        // Generate manifests
        const manifests = this.generateManifests(leafProfile, spineProfile, leafCount, spineCount, uplinksPerLeaf);
        console.log('Generated manifests:', manifests);

        // Generate diagrams
        const diagrams = this.generateDiagrams(leafProfile, spineProfile, leafCount, spineCount, uplinksPerLeaf);
        console.log('Generated diagrams:', diagrams);

        return {
            manifests,
            diagrams
        };
    }

    generateManifests(leafProfile, spineProfile, leafCount, spineCount, uplinksPerLeaf) {
        console.log('Generating manifests...');
        const manifests = [];

        // Add VLANNamespace
        manifests.push({
            apiVersion: 'wiring.githedgehog.com/v1beta1',
            kind: 'VLANNamespace',
            metadata: {
                name: 'default'
            },
            spec: {
                ranges: [
                    {
                        from: 1000,
                        to: 2999
                    }
                ]
            }
        });

        // Add IPv4Namespace
        manifests.push({
            apiVersion: 'vpc.githedgehog.com/v1beta1',
            kind: 'IPv4Namespace',
            metadata: {
                name: 'default'
            },
            spec: {
                subnets: ['10.10.0.0/16']
            }
        });

        // Generate switch names based on model
        const getLeafName = (index) => `${leafProfile.model}-${String(index + 1).padStart(2, '0')}`;
        const getSpineName = (index) => `${spineProfile.model}-${String(index + 1).padStart(2, '0')}`;

        // Add Switches
        for (let i = 0; i < spineCount; i++) {
            const switchName = getSpineName(i);
            const switchIndex = i + 1;
            manifests.push({
                apiVersion: 'wiring.githedgehog.com/v1beta1',
                kind: 'Switch',
                metadata: {
                    name: switchName,
                    namespace: 'default',
                    annotations: {
                        'type.hhfab.githedgehog.com': 'hw',
                        'serial.hhfab.githedgehog.com': `ssh://192.168.90.${10 + i}:8901`,
                        'power.hhfab.githedgehog.com/psu1': `http://192.168.90.142/outlet/${3 + i}`,
                        'link.hhfab.githedgehog.com/M1': `pci@0000:83:00.${i}`
                    }
                },
                spec: {
                    profile: spineProfile.model,
                    role: 'spine',
                    description: `spine-${i + 1}`,
                    boot: {
                        mac: this.generateMacAddress(switchIndex),
                        serial: this.generateSerialNumber(spineProfile.model, switchIndex)
                    },
                    portBreakouts: {
                        'E1/32': '4x25G'
                    },
                    portGroups: {
                        '1-48': {
                            speed: '100G'
                        }
                    }
                }
            });
        }

        for (let i = 0; i < leafCount; i++) {
            const switchName = getLeafName(i);
            const switchIndex = spineCount + i + 1;

            manifests.push({
                apiVersion: 'wiring.githedgehog.com/v1beta1',
                kind: 'Switch',
                metadata: {
                    name: switchName,
                    namespace: 'default',
                    annotations: {
                        'type.hhfab.githedgehog.com': 'hw',
                        'serial.hhfab.githedgehog.com': `ssh://192.168.90.${20 + i}:8901`,
                        'power.hhfab.githedgehog.com/psu1': `http://192.168.90.142/outlet/${10 + i}`,
                        'link.hhfab.githedgehog.com/M1': `pci@0000:84:00.${i}`
                    }
                },
                spec: {
                    profile: leafProfile.model,
                    role: 'leaf',
                    description: `leaf-${i + 1}`,
                    boot: {
                        mac: this.generateMacAddress(switchIndex),
                        serial: this.generateSerialNumber(leafProfile.model, switchIndex)
                    },
                    portBreakouts: {
                        'E1/55': '4x25G',
                        'E1/56': '4x25G'
                    },
                    portGroups: {
                        '1-48': {
                            speed: '25G'
                        },
                        '49-54': {
                            speed: '100G'
                        }
                    }
                }
            });

            // Add VPC loopback connections for each leaf
            manifests.push({
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
            });
        }

        // Add Fabric Connections
        for (let leafIdx = 0; leafIdx < leafCount; leafIdx++) {
            for (let spineIdx = 0; spineIdx < spineCount; spineIdx++) {
                const leafName = getLeafName(leafIdx);
                const spineName = getSpineName(spineIdx);
                
                manifests.push({
                    apiVersion: 'wiring.githedgehog.com/v1beta1',
                    kind: 'Connection',
                    metadata: {
                        name: `${spineName}--fabric--${leafName}`,
                        namespace: 'default'
                    },
                    spec: {
                        fabric: {
                            links: this.generateFabricLinks(spineName, leafName, spineIdx, leafIdx, uplinksPerLeaf / spineCount)
                        }
                    }
                });
            }
        }

        return manifests;
    }

    generateFabricLinks(spineName, leafName, spineIdx, leafIdx, linksPerSpine) {
        const links = [];
        const baseSpinePort = leafIdx * linksPerSpine + 1;
        const baseLeafPort = spineIdx * linksPerSpine + 49; // Start leaf uplinks at port 49

        for (let i = 0; i < linksPerSpine; i++) {
            links.push({
                spine: {
                    port: `${spineName}/E1/${baseSpinePort + i}`
                },
                leaf: {
                    port: `${leafName}/E1/${baseLeafPort + i}`
                }
            });
        }
        return links;
    }

    generateDiagrams(leafProfile, spineProfile, leafCount, spineCount, uplinksPerLeaf) {
        console.log('Generating diagrams...');
        
        // Generate topology diagram
        let topology = 'graph TD\n';
        
        // Add spine switches
        for (let i = 0; i < spineCount; i++) {
            topology += `    spine${i + 1}[${spineProfile.name} Spine ${i + 1}]\n`;
        }
        
        // Add leaf switches
        for (let i = 0; i < leafCount; i++) {
            topology += `    leaf${i + 1}[${leafProfile.name} Leaf ${i + 1}]\n`;
        }
        
        // Add connections
        for (let leafIdx = 0; leafIdx < leafCount; leafIdx++) {
            for (let uplinkIdx = 0; uplinkIdx < uplinksPerLeaf; uplinkIdx++) {
                const spineIdx = uplinkIdx % spineCount;
                topology += `    leaf${leafIdx + 1} --- spine${spineIdx + 1}\n`;
            }
        }

        // Generate cabling diagram
        let cabling = 'graph TD\n';
        
        // Add spine switches with port details
        for (let i = 0; i < spineCount; i++) {
            cabling += `    spine${i + 1}[Spine ${i + 1}\\n`;
            for (let j = 0; j < leafCount; j++) {
                cabling += `E1/${j + 1}\\n`;
            }
            cabling += ']\n';
        }
        
        // Add leaf switches with port details
        for (let i = 0; i < leafCount; i++) {
            cabling += `    leaf${i + 1}[Leaf ${i + 1}\\n`;
            for (let j = 0; j < uplinksPerLeaf; j++) {
                cabling += `E1/${49 + j}\\n`;
            }
            cabling += ']\n';
        }
        
        // Add connections with port details
        for (let leafIdx = 0; leafIdx < leafCount; leafIdx++) {
            for (let spineIdx = 0; spineIdx < spineCount; spineIdx++) {
                const linksPerSpine = uplinksPerLeaf / spineCount;
                const baseSpinePort = leafIdx * linksPerSpine + 1;
                const baseLeafPort = spineIdx * linksPerSpine + 49; // Start leaf uplinks at port 49
                
                for (let linkIdx = 0; linkIdx < linksPerSpine; linkIdx++) {
                    const spinePort = baseSpinePort + linkIdx;
                    const leafPort = baseLeafPort + linkIdx;
                    cabling += `    leaf${leafIdx + 1} -- E1/${leafPort} - E1/${spinePort} --- spine${spineIdx + 1}\n`;
                }
            }
        }

        return {
            topology,
            cabling
        };
    }
}

// Import metal switch profiles
import dellS5248ProfileRaw from './metalSwitchProfiles/dell_s5248f_on.json?raw';
import dellS5232ProfileRaw from './metalSwitchProfiles/dell_s5232f_on.json?raw';

const METAL_SWITCH_PROFILES = {
  'dell-s5248f-on': JSON.parse(dellS5248ProfileRaw),
  'dell-s5232f-on': JSON.parse(dellS5232ProfileRaw)
};

// Default values from working configs
const DEFAULT_VLAN_RANGE = { from: 1000, to: 2999 };
const DEFAULT_IPV4_SUBNET = '10.10.0.0/16';

export function generateSwitchName(model, index) {
  // Extract base name from model (e.g., s5248 from dell-s5248f-on)
  const baseName = model.includes('s5248') ? 's5248' : 's5232';
  return `${baseName}-${String(index + 1).padStart(2, '0')}`;
}

function getPortName(switchName, label, breakout) {
  return breakout 
    ? `${switchName}/E1/${label}/${breakout}`
    : `${switchName}/E1/${label}`;
}

function generateVLANNamespace(ranges = [DEFAULT_VLAN_RANGE]) {
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

function generateIPv4Namespace(name = 'default', subnets = [DEFAULT_IPV4_SUBNET]) {
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

function generateSwitch(name, model, role, serial, portConfig) {
  const metalProfile = METAL_SWITCH_PROFILES[model];
  
  return {
    apiVersion: 'wiring.githedgehog.com/v1beta1',
    kind: 'Switch',
    metadata: {
      name,
      annotations: {
        'type.hhfab.githedgehog.com': 'hw'
      }
    },
    spec: {
      profile: model,
      role,
      description: role === 'spine' ? 'spine' : 'leaf',
      boot: {
        serial
      },
      ...(portConfig.breakout && {
        portBreakouts: {
          [`E1/${portConfig.port}`]: portConfig.breakout
        }
      })
    }
  };
}

function generateFabricConnection(spineName, leafName, spinePort, leafPort) {
  return {
    apiVersion: 'wiring.githedgehog.com/v1beta1',
    kind: 'Connection',
    metadata: {
      name: `${spineName}--fabric--${leafName}`
    },
    spec: {
      fabric: {
        links: [
          {
            spine: {
              port: spinePort
            },
            leaf: {
              port: leafPort
            }
          }
        ]
      }
    }
  };
}

export function generateConfig(formData) {
  console.log('Generating config with:', formData);
  const configs = [];

  // Add VLAN namespace
  configs.push({
    apiVersion: 'wiring.githedgehog.com/v1beta1',
    kind: 'VLANNamespace',
    metadata: {
      name: 'default'
    },
    spec: {
      ranges: formData.vlanNamespace.ranges
    }
  });

  // Add IPv4 namespace
  configs.push({
    apiVersion: 'vpc.githedgehog.com/v1beta1',
    kind: 'IPv4Namespace',
    metadata: {
      name: 'default'
    },
    spec: {
      subnets: formData.ipv4Namespaces[0].subnets
    }
  });

  // Generate spine switches
  const spines = [];
  for (let i = 0; i < formData.topology.spines.count; i++) {
    const name = generateSwitchName(formData.topology.spines.model, i);
    spines.push(name);
    configs.push({
      apiVersion: 'wiring.githedgehog.com/v1beta1',
      kind: 'Switch',
      metadata: {
        name: name
      },
      spec: {
        boot: {
          serial: formData.switchSerials[name]
        },
        profile: formData.topology.spines.model,
        role: 'spine',
        description: `spine-${i + 1}`
      }
    });
  }

  // Generate leaf switches
  const leaves = [];
  for (let i = 0; i < formData.topology.leaves.count; i++) {
    const name = generateSwitchName(formData.topology.leaves.model, i);
    leaves.push(name);
    
    configs.push({
      apiVersion: 'wiring.githedgehog.com/v1beta1',
      kind: 'Switch',
      metadata: {
        name: name
      },
      spec: {
        boot: {
          serial: formData.switchSerials[name]
        },
        profile: formData.topology.leaves.model,
        role: 'leaf',
        description: `leaf-${i + 1}`
      }
    });
  }

  // Generate fabric connections between spines and leaves
  for (const spine of spines) {
    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const links = [];
      
      // Each leaf gets 2 uplinks to each spine
      const leafStartPort = 49; // Starting port number for leaf uplinks
      const spineStartPort = i * 2 + 1; // Each leaf uses 2 ports on the spine

      // Add two links to this spine
      links.push({
        spine: { port: `${spine}/E1/${spineStartPort}` },
        leaf: { port: `${leaf}/E1/${leafStartPort}` }
      });
      links.push({
        spine: { port: `${spine}/E1/${spineStartPort + 1}` },
        leaf: { port: `${leaf}/E1/${leafStartPort + 1}` }
      });

      configs.push({
        apiVersion: 'wiring.githedgehog.com/v1beta1',
        kind: 'Connection',
        metadata: {
          name: `${spine}--fabric--${leaf}`
        },
        spec: {
          fabric: {
            links: links
          }
        }
      });
    }
  }

  // Generate VPC loopback connections for each leaf
  for (const leaf of leaves) {
    configs.push({
      apiVersion: 'wiring.githedgehog.com/v1beta1',
      kind: 'Connection',
      metadata: {
        name: `${leaf}--vpc-loopback`
      },
      spec: {
        vpcLoopback: {
          links: [
            {
              switch1: { port: `${leaf}/E1/17` },
              switch2: { port: `${leaf}/E1/18` }
            },
            {
              switch1: { port: `${leaf}/E1/19` },
              switch2: { port: `${leaf}/E1/20` }
            }
          ]
        }
      }
    });
  }

  return {
    configs: configs
  };
}
