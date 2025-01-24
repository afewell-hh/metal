import React, { useState, useEffect } from 'react';
import { generateConfig, generateSwitchName } from './configGenerator';
import jsyaml from 'js-yaml';

const DEFAULT_VLAN_RANGE = { from: 1000, to: 2999 };
const DEFAULT_IPV4_SUBNET = '10.10.0.0/16';

const DEFAULT_FORM_DATA = {
  vlanNamespace: {
    ranges: [DEFAULT_VLAN_RANGE]
  },
  ipv4Namespaces: [{
    name: 'default',
    subnets: [DEFAULT_IPV4_SUBNET]
  }],
  topology: {
    spines: {
      model: 'dell-s5232f-on',
      count: 2,
      portConfig: {
        speed: '100G',
        breakout: null
      }
    },
    leaves: {
      model: 'dell-s5248f-on',
      count: 4,
      fabricPorts: {
        speed: '100G',
        breakout: null
      },
      serverPorts: {
        speed: '10G',
        breakout: null
      }
    }
  },
  switchSerials: {}
};

export function ConfigForm() {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);

  // Step 2 state after initial topology is set
  const [showSerialInput, setShowSerialInput] = useState(false);

  // Generate switch names when topology changes
  useEffect(() => {
    if (formData.topology) {
      const newSerials = {};
      
      // Generate spine switch names
      for (let i = 0; i < formData.topology.spines.count; i++) {
        const name = generateSwitchName(formData.topology.spines.model, i);
        if (!formData.switchSerials[name]) {
          newSerials[name] = '';
        }
      }

      // Generate leaf switch names
      for (let i = 0; i < formData.topology.leaves.count; i++) {
        const name = generateSwitchName(formData.topology.leaves.model, i);
        if (!formData.switchSerials[name]) {
          newSerials[name] = '';
        }
      }

      if (Object.keys(newSerials).length > 0) {
        setFormData(prev => ({
          ...prev,
          switchSerials: {
            ...prev.switchSerials,
            ...newSerials
          }
        }));
      }
    }
  }, [formData.topology]);

  const [generatedConfig, setGeneratedConfig] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!showSerialInput) {
      setShowSerialInput(true);
      return;
    }

    // Generate final config
    console.log('Form Data:', formData);
    const config = generateConfig(formData);
    console.log('Generated Config:', config);
    setGeneratedConfig(config);
  };

  if (showSerialInput && generatedConfig) {
    const yamlConfigs = generatedConfig.configs.map(config => 
      jsyaml.dump(config)
    ).join('---\n');

    return (
      <div className="generated-config">
        <h2>Generated Configuration</h2>
        <div className="config-section">
          <h3>Configuration Files</h3>
          <pre>{yamlConfigs}</pre>
        </div>
        <div className="button-group">
          <button onClick={() => {
            setShowSerialInput(false);
            setGeneratedConfig(null);
            setFormData(DEFAULT_FORM_DATA);
          }} className="back-button">
            Start Over
          </button>
          <button onClick={() => {
            const blob = new Blob([yamlConfigs], { type: 'text/yaml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'hedgehog-config.yaml';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}>
            Download YAML
          </button>
        </div>
      </div>
    );
  }

  if (showSerialInput) {
    return (
      <form onSubmit={handleSubmit}>
        <h2>Step 2: Enter Switch Serial Numbers</h2>
        
        {/* Serial number inputs */}
        {Object.keys(formData.switchSerials).map(switchName => (
          <div key={switchName}>
            <label>{switchName}</label>
            <input
              type="text"
              value={formData.switchSerials[switchName]}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                switchSerials: {
                  ...prev.switchSerials,
                  [switchName]: e.target.value
                }
              }))}
            />
          </div>
        ))}

        <button type="submit">Generate Configuration</button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Step 1: Basic Configuration</h2>
      
      {/* VLAN Range */}
      <div>
        <h3>VLAN Range</h3>
        <input
          type="number"
          value={formData.vlanNamespace.ranges[0].from}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            vlanNamespace: {
              ranges: [{
                ...prev.vlanNamespace.ranges[0],
                from: parseInt(e.target.value)
              }]
            }
          }))}
        />
        <input
          type="number"
          value={formData.vlanNamespace.ranges[0].to}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            vlanNamespace: {
              ranges: [{
                ...prev.vlanNamespace.ranges[0],
                to: parseInt(e.target.value)
              }]
            }
          }))}
        />
      </div>

      {/* IPv4 Subnet */}
      <div>
        <h3>IPv4 Subnet</h3>
        <input
          type="text"
          value={formData.ipv4Namespaces[0].subnets[0]}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            ipv4Namespaces: [{
              ...prev.ipv4Namespaces[0],
              subnets: [e.target.value]
            }]
          }))}
        />
      </div>

      {/* Spine Configuration */}
      <div>
        <h3>Spine Switches</h3>
        <select
          value={formData.topology.spines.model}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            topology: {
              ...prev.topology,
              spines: {
                ...prev.topology.spines,
                model: e.target.value
              }
            }
          }))}
        >
          <option value="dell-s5232f-on">Dell S5232F-ON</option>
        </select>
        <input
          type="number"
          value={formData.topology.spines.count}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            topology: {
              ...prev.topology,
              spines: {
                ...prev.topology.spines,
                count: parseInt(e.target.value)
              }
            }
          }))}
        />
        <select
          value={formData.topology.spines.portConfig.speed}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            topology: {
              ...prev.topology,
              spines: {
                ...prev.topology.spines,
                portConfig: {
                  ...prev.topology.spines.portConfig,
                  speed: e.target.value
                }
              }
            }
          }))}
        >
          <option value="100G">100G</option>
          <option value="40G">40G</option>
        </select>
        <select
          value={formData.topology.spines.portConfig.breakout || ''}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            topology: {
              ...prev.topology,
              spines: {
                ...prev.topology.spines,
                portConfig: {
                  ...prev.topology.spines.portConfig,
                  breakout: e.target.value || null
                }
              }
            }
          }))}
        >
          <option value="">No Breakout</option>
          <option value="4x25G">4x25G</option>
          <option value="4x10G">4x10G</option>
        </select>
      </div>

      {/* Leaf Configuration */}
      <div>
        <h3>Leaf Switches</h3>
        <select
          value={formData.topology.leaves.model}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            topology: {
              ...prev.topology,
              leaves: {
                ...prev.topology.leaves,
                model: e.target.value
              }
            }
          }))}
        >
          <option value="dell-s5248f-on">Dell S5248F-ON</option>
        </select>
        <input
          type="number"
          value={formData.topology.leaves.count}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            topology: {
              ...prev.topology,
              leaves: {
                ...prev.topology.leaves,
                count: parseInt(e.target.value)
              }
            }
          }))}
        />
        
        {/* Fabric Ports */}
        <div>
          <h4>Fabric Ports</h4>
          <select
            value={formData.topology.leaves.fabricPorts.speed}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  fabricPorts: {
                    ...prev.topology.leaves.fabricPorts,
                    speed: e.target.value
                  }
                }
              }
            }))}
          >
            <option value="100G">100G</option>
            <option value="40G">40G</option>
          </select>
          <select
            value={formData.topology.leaves.fabricPorts.breakout || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  fabricPorts: {
                    ...prev.topology.leaves.fabricPorts,
                    breakout: e.target.value || null
                  }
                }
              }
            }))}
          >
            <option value="">No Breakout</option>
            <option value="4x25G">4x25G</option>
            <option value="4x10G">4x10G</option>
          </select>
        </div>

        {/* Server Ports */}
        <div>
          <h4>Server Ports</h4>
          <select
            value={formData.topology.leaves.serverPorts.speed}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  serverPorts: {
                    ...prev.topology.leaves.serverPorts,
                    speed: e.target.value
                  }
                }
              }
            }))}
          >
            <option value="10G">10G</option>
            <option value="25G">25G</option>
          </select>
          <select
            value={formData.topology.leaves.serverPorts.breakout || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  serverPorts: {
                    ...prev.topology.leaves.serverPorts,
                    breakout: e.target.value || null
                  }
                }
              }
            }))}
          >
            <option value="">No Breakout</option>
            <option value="4x10G">4x10G</option>
          </select>
        </div>
      </div>

      <button type="submit">Next: Enter Switch Serials</button>
    </form>
  );
}
