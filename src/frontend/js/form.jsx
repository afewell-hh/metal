import React, { useState, useEffect } from 'react';
import { generateConfig, generateSwitchName } from './configGenerator';
import jsyaml from 'js-yaml';
import { PortAllocationRules } from './portAllocationRules.js';

const portRules = new PortAllocationRules();

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
      fabricPortConfig: {
        breakout: null
      }
    },
    leaves: {
      model: 'dell-s5248f-on',
      count: 4,
      fabricPortsPerLeaf: 2,
      fabricPortConfig: {
        breakout: null
      },
      serverPortConfig: {
        breakout: null
      },
      totalServerPorts: 16
    }
  },
  switchSerials: {}
};

export function ConfigForm() {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [showSerialInput, setShowSerialInput] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initializeRules() {
      try {
        await portRules.initialize();
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize port rules:', error);
        setError('Failed to initialize port rules. Please check console for details.');
        setIsLoading(false);
      }
    }
    initializeRules();
  }, []);

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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    
    if (!showSerialInput) {
      setShowSerialInput(true);
      return;
    }

    try {
      console.log('Form Data: ', formData);
      const config = await generateConfig(formData);
      console.log('Generated Config: ', config);
      setGeneratedConfig(config);
    } catch (error) {
      console.error('Failed to generate config:', error);
      setError(error.message);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

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
        <h3>Spine Configuration</h3>
        <div>
          <label>Model:</label>
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
        </div>
        <div>
          <label>Count:</label>
          <input
            type="number"
            min="1"
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
        </div>
        <div>
          <label>Fabric Port Breakout:</label>
          <select
            value={formData.topology.spines.fabricPortConfig.breakout || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                spines: {
                  ...prev.topology.spines,
                  fabricPortConfig: {
                    breakout: e.target.value || null
                  }
                }
              }
            }))}
          >
            <option value="">Select Breakout</option>
            <option value="4x25G">4x25G</option>
            <option value="2x50G">2x50G</option>
            <option value="1x100G">1x100G</option>
          </select>
        </div>
      </div>

      {/* Leaf Configuration */}
      <div>
        <h3>Leaf Configuration</h3>
        <div>
          <label>Model:</label>
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
        </div>
        <div>
          <label>Count:</label>
          <input
            type="number"
            min="1"
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
        </div>
        <div>
          <label>Fabric Ports Per Leaf:</label>
          <input
            type="number"
            min="1"
            value={formData.topology.leaves.fabricPortsPerLeaf}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  fabricPortsPerLeaf: parseInt(e.target.value)
                }
              }
            }))}
          />
        </div>
        <div>
          <label>Fabric Port Breakout:</label>
          <select
            value={formData.topology.leaves.fabricPortConfig.breakout || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  fabricPortConfig: {
                    breakout: e.target.value || null
                  }
                }
              }
            }))}
          >
            <option value="">Select Breakout</option>
            <option value="4x25G">4x25G</option>
            <option value="2x50G">2x50G</option>
            <option value="1x100G">1x100G</option>
          </select>
        </div>
        <div>
          <label>Total Server Ports Needed:</label>
          <input
            type="number"
            min="1"
            value={formData.topology.leaves.totalServerPorts}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  totalServerPorts: parseInt(e.target.value)
                }
              }
            }))}
          />
        </div>
        <div>
          <label>Server Port Breakout:</label>
          <select
            value={formData.topology.leaves.serverPortConfig.breakout || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              topology: {
                ...prev.topology,
                leaves: {
                  ...prev.topology.leaves,
                  serverPortConfig: {
                    breakout: e.target.value || null
                  }
                }
              }
            }))}
          >
            <option value="">Select Breakout</option>
            <option value="fixed">Fixed (No Breakout)</option>
            <option value="4x10G">4x10G</option>
            <option value="4x25G">4x25G</option>
          </select>
        </div>
      </div>

      <button type="submit">Next: Enter Switch Serials</button>
    </form>
  );
}
