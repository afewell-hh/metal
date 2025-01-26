import React, { useState, useEffect } from 'react';
import { generateConfig, generateSwitchName } from './configGenerator';
import { SwitchProfileManager } from './switchProfileManager';
import ConfigEditor from './configEditor';
import jsyaml from 'js-yaml';
import { PortAllocationRules } from './portAllocationRules.js';

const portRules = new PortAllocationRules();
const switchProfileManager = new SwitchProfileManager();
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
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [generatedConfig, setGeneratedConfig] = useState(null);
  const [editedConfig, setEditedConfig] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supportedSwitches, setSupportedSwitches] = useState([]);

  useEffect(() => {
    async function initializeRules() {
      try {
        await portRules.initialize();
      } catch (error) {
        console.error('Failed to initialize port rules:', error);
        setError('Failed to initialize port rules. Please check console for details.');
      }
    }
    initializeRules();
  }, []);

  useEffect(() => {
    async function initializeProfiles() {
      try {
        await switchProfileManager.initialize();
        setSupportedSwitches(switchProfileManager.baseProfiles.map(model => model.replace(/_/g, '-')));
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize switch profiles:', error);
        setError('Failed to initialize switch profiles. Please check console for details.');
        setIsLoading(false);
      }
    }
    initializeProfiles();
  }, []);

  useEffect(() => {
    if (formData.topology) {
      const newSerials = {};
      
      // Clear all existing serials when topology changes
      // Generate spine switch names
      for (let i = 0; i < formData.topology.spines.count; i++) {
        const name = generateSwitchName(formData.topology.spines.model, i);
        newSerials[name] = 'TODO';
      }

      // Generate leaf switch names
      for (let i = 0; i < formData.topology.leaves.count; i++) {
        const name = generateSwitchName(formData.topology.leaves.model, i);
        newSerials[name] = 'TODO';
      }

      // Replace (not merge) the switchSerials object
      setFormData(prev => ({
        ...prev,
        switchSerials: newSerials
      }));
    }
  }, [formData.topology.spines.model, formData.topology.spines.count, 
      formData.topology.leaves.model, formData.topology.leaves.count]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    
    if (!showSerialInput) {
      setShowSerialInput(true);
      return;
    }

    if (!showConfigEditor) {
      try {
        const config = await generateConfig(formData);
        setGeneratedConfig(config);
        setShowConfigEditor(true);
      } catch (error) {
        console.error('Failed to generate config:', error);
        setError(error.message);
      }
      return;
    }
  };

  const handleSaveEdits = (editedConfigs) => {
    if (editedConfigs === null) {
      // User clicked back button
      setShowConfigEditor(false);
      return;
    }
    setEditedConfig(editedConfigs);
    setShowConfigEditor(false);
  };

  const handleBackToForm = () => {
    setShowSerialInput(false);
    // Preserve formData state
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  if (showConfigEditor && generatedConfig) {
    return (
      <ConfigEditor
        configs={generatedConfig}
        onSave={handleSaveEdits}
      />
    );
  }

  if (editedConfig) {
    // Convert array of k8s objects directly to YAML
    const yamlConfigs = editedConfig.map(config => 
      jsyaml.dump(config)
    ).join('---\n');

    return (
      <div className="generated-config">
        <h2>Final Configuration</h2>
        <div className="config-section">
          <h3>Configuration Files</h3>
          <pre>{yamlConfigs}</pre>
        </div>
        <div className="button-group">
          <button 
            onClick={() => {
              setShowConfigEditor(true);
              setEditedConfig(null);
            }} 
            className="back-button"
          >
            Back to Edit Configuration
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

  // Initial form for switch counts and models
  if (!showSerialInput) {
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
            {supportedSwitches.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
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
            {supportedSwitches.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
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

        <div className="button-group">
          <button type="submit">Continue to Serial Numbers</button>
        </div>
      </form>
    );
  }

  // Serial number input form
  if (showSerialInput && !showConfigEditor && !editedConfig) {
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

        <div className="button-group">
          <button 
            type="button" 
            onClick={handleBackToForm}
            className="back-button"
          >
            Back to Switch Configuration
          </button>
          <button type="submit">Generate Configuration</button>
        </div>
      </form>
    );
  }
}
