import React, { useState } from 'react';
import '../css/configEditor.css';

// Templates for new objects
const objectTemplates = {
  IPv4Namespace: {
    apiVersion: 'vpc.githedgehog.com/v1beta1',
    kind: 'IPv4Namespace',
    metadata: {
      name: ''
    },
    spec: {
      subnets: ['']
    }
  },
  Switch: {
    apiVersion: 'wiring.githedgehog.com/v1beta1',
    kind: 'Switch',
    metadata: {
      name: ''
    },
    spec: {
      boot: {
        mac: ''
      },
      profile: '',
      role: '',
      description: '',
      portBreakouts: {},
      serial: ''
    }
  },
  Connection: {
    apiVersion: 'wiring.githedgehog.com/v1beta1',
    kind: 'Connection',
    metadata: {
      name: ''
    },
    spec: {
      fabric: {
        links: [{
          spine: {
            port: ''
          },
          leaf: {
            port: ''
          }
        }]
      }
    }
  }
};

const renderIndent = (depth) => {
  return Array(depth).fill().map((_, i) => (
    <div key={i} className="yaml-indent" />
  ));
};

const renderValue = (value, path, onChange, depth = 0) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="yaml-empty-object">[]</span>;
    }
    return (
      <div className="yaml-array">
        {value.map((item, index) => (
          <div key={index} className="yaml-array-item">
            <span className="yaml-array-bullet">-</span>
            <div className="yaml-array-content">
              {typeof item === 'object' ? 
                renderObject(item, `${path}[${index}]`, onChange, depth + 1) :
                renderValue(item, `${path}[${index}]`, onChange, depth + 1)
              }
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      return <span className="yaml-empty-object">{"{}"}</span>;
    }
    return renderObject(value, path, onChange, depth);
  }

  // Special handling for CIDR notation in IPv4Namespace
  if (path.includes('spec.subnets')) {
    return (
      <span className="yaml-value">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(path, e.target.value)}
          className="cidr-input"
          placeholder="e.g., 10.10.0.0/16"
        />
      </span>
    );
  }

  // Special handling for port values in Connection objects
  if (typeof value === 'string' && path.includes('port')) {
    return (
      <span className="yaml-value">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(path, e.target.value)}
          className="port-input"
          placeholder="e.g., spine-1/Ethernet1"
        />
      </span>
    );
  }

  return (
    <span className="yaml-value">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(path, e.target.value)}
      />
    </span>
  );
};

const renderObject = (obj, basePath = '', onChange, depth = 0) => {
  if (!obj || typeof obj !== 'object') return null;

  // Order of fields in YAML, excluding _isVisible
  const orderedKeys = [
    'apiVersion',
    'kind',
    'metadata',
    'spec',
    ...Object.keys(obj).filter(key => 
      !['apiVersion', 'kind', 'metadata', 'spec', '_isVisible'].includes(key)
    )
  ].filter(key => obj.hasOwnProperty(key) && key !== '_isVisible');

  return (
    <div className="yaml-object">
      {orderedKeys.map(key => {
        const value = obj[key];
        const path = basePath ? `${basePath}.${key}` : key;
        
        return (
          <div key={key} className="yaml-field">
            {renderIndent(depth)}
            <span className="yaml-key">{key}:</span>
            {renderValue(value, path, onChange, depth + 1)}
          </div>
        );
      })}
    </div>
  );
};

export function ConfigEditor({ configs, onSave }) {
  // Group configs by kind if they're in array format
  const [objects, setObjects] = useState(() => {
    const groupedConfigs = Array.isArray(configs)
      ? configs.reduce((acc, config) => {
          if (!acc[config.kind]) {
            acc[config.kind] = [];
          }
          acc[config.kind].push({ ...config, _isVisible: true });
          return acc;
        }, {})
      : Object.entries(configs).reduce((acc, [kind, items]) => {
          acc[kind] = items.map(item => ({
            ...item,
            _isVisible: true
          }));
          return acc;
        }, {});
    return groupedConfigs;
  });

  const handleObjectChange = (kind, index, path, value) => {
    setObjects(prev => {
      const newObjects = { ...prev };
      const objectToUpdate = { ...newObjects[kind][index] };
      
      // Handle nested path updates
      const pathParts = path.split('.');
      let current = objectToUpdate;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (part.includes('[')) {
          // Handle array paths
          const [arrayName, indexStr] = part.split('[');
          const arrayIndex = parseInt(indexStr);
          current = current[arrayName][arrayIndex];
        } else {
          current = current[part];
        }
      }
      
      current[pathParts[pathParts.length - 1]] = value;
      newObjects[kind][index] = objectToUpdate;
      
      return newObjects;
    });
  };

  const toggleVisibility = (kind, index) => {
    setObjects(prev => {
      const newObjects = { ...prev };
      newObjects[kind][index] = {
        ...newObjects[kind][index],
        _isVisible: !newObjects[kind][index]._isVisible
      };
      return newObjects;
    });
  };

  const addObject = (kind) => {
    setObjects(prev => {
      const newObjects = { ...prev };
      newObjects[kind] = [
        ...newObjects[kind],
        {
          ...objectTemplates[kind],
          _isVisible: true
        }
      ];
      return newObjects;
    });
  };

  const deleteObject = (kind, index) => {
    setObjects(prev => {
      const newObjects = { ...prev };
      newObjects[kind] = newObjects[kind].filter((_, i) => i !== index);
      return newObjects;
    });
  };

  const handleSave = () => {
    // Convert objects back to array format, removing _isVisible
    const cleanedConfigs = Object.entries(objects)
      .reduce((acc, [kind, items]) => [
        ...acc,
        ...items
          .filter(item => item._isVisible)
          .map(({ _isVisible, ...item }) => item)
      ], []);
    onSave(cleanedConfigs);
  };

  return (
    <div className="config-editor">
      <h2>Configuration Editor</h2>
      {Object.entries(objects).map(([kind, items]) => (
        <div key={kind} className="config-section">
          <div className="section-header">
            <h3>{kind}</h3>
            <button
              className="add-object-button"
              onClick={() => addObject(kind)}
            >
              Add {kind}
            </button>
          </div>
          
          {items.map((obj, index) => (
            <div key={index} className="config-object">
              <div className="object-controls">
                <div className="visibility-control">
                  <input
                    type="checkbox"
                    checked={obj._isVisible}
                    onChange={() => toggleVisibility(kind, index)}
                  />
                  <span>Show/Hide</span>
                </div>
                <button
                  className="delete-button"
                  onClick={() => deleteObject(kind, index)}
                >
                  Delete
                </button>
              </div>
              
              {obj._isVisible && renderObject(obj, '', (path, value) => 
                handleObjectChange(kind, index, path, value),
                0
              )}
            </div>
          ))}
        </div>
      ))}
      
      <div className="button-group">
        <button className="save-button" onClick={handleSave}>
          Save Configuration
        </button>
      </div>
    </div>
  );
}
