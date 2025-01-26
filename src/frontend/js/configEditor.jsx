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

const renderValue = (value, path, onChange, isVisible) => {
  if (path === 'isVisible') return null;

  // Special handling for subnets array in IPv4Namespace
  if (path === 'spec.subnets[0]') {
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

  if (Array.isArray(value)) {
    return (
      <div className="yaml-array">
        {value.map((item, index) => (
          <div key={index} className="yaml-array-item">
            <span className="yaml-array-bullet">-</span>
            <div className="yaml-array-content">
              {typeof item === 'object' ? 
                renderObject(item, `${path}[${index}]`, onChange, isVisible) :
                renderValue(item, `${path}[${index}]`, onChange, isVisible)
              }
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 0) {
      return <span className="yaml-empty-object">{"{}"}</span>;
    }
    return renderObject(value, path, onChange, isVisible);
  }

  return (
    <span className="yaml-value">
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(path, e.target.value)}
      />
    </span>
  );
};

const renderObject = (obj, path, onChange, isVisible) => {
  if (!obj || typeof obj !== 'object') return null;
  
  return Object.entries(obj).map(([key, value]) => {
    if (key === 'isVisible') return null;
    
    const newPath = path ? `${path}.${key}` : key;
    const indent = path ? path.split('.').length : 0;
    
    // Special handling for empty objects
    if (value && typeof value === 'object' && Object.keys(value).length === 0) {
      return (
        <div key={key} className={`yaml-line indent-${indent}`}>
          <span className="yaml-key">{key}:</span>
          <span className="yaml-empty-object">{"{}"}</span>
        </div>
      );
    }

    return (
      <div key={key} className={`yaml-line indent-${indent}`}>
        <span className="yaml-key">{key}:</span>
        {renderValue(value, newPath, onChange, isVisible)}
      </div>
    );
  });
};

export function ConfigEditor({ configs, onSave }) {
  const initialConfigState = configs.reduce((acc, config) => {
    if (!acc[config.kind]) {
      acc[config.kind] = [];
    }
    acc[config.kind].push({
      ...config,
      isVisible: true
    });
    return acc;
  }, {});

  const [groupedConfigs, setGroupedConfigs] = useState(initialConfigState);
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  const handleObjectChange = (kind, index, path, value) => {
    setGroupedConfigs(prev => ({
      ...prev,
      [kind]: prev[kind].map((obj, i) => {
        if (i !== index) return obj;
        
        const newObj = { ...obj };
        const parts = path.split('.');
        let current = newObj;
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (part.includes('[') && part.includes(']')) {
            const arrayName = part.split('[')[0];
            const arrayIndex = parseInt(part.split('[')[1].split(']')[0]);
            if (!current[arrayName]) current[arrayName] = [];
            if (!current[arrayName][arrayIndex]) current[arrayName][arrayIndex] = {};
            current = current[arrayName][arrayIndex];
          } else {
            if (!current[part]) current[part] = {};
            current = current[part];
          }
        }
        
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
        
        return newObj;
      })
    }));
  };

  const handleVisibilityChange = (kind, index) => {
    setGroupedConfigs(prev => ({
      ...prev,
      [kind]: prev[kind].map((obj, i) => 
        i === index ? { ...obj, isVisible: !obj.isVisible } : obj
      )
    }));
  };

  const handleDeleteObject = (kind, index) => {
    setDeleteConfirmation({ kind, index });
  };

  const confirmDelete = () => {
    if (!deleteConfirmation) return;

    const { kind, index } = deleteConfirmation;
    setGroupedConfigs(prev => ({
      ...prev,
      [kind]: prev[kind].filter((_, i) => i !== index)
    }));
    setDeleteConfirmation(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const handleAddObject = (kind) => {
    const template = objectTemplates[kind];
    if (!template) return;

    setGroupedConfigs(prev => ({
      ...prev,
      [kind]: [...(prev[kind] || []), { ...template, isVisible: true }]
    }));
  };

  const handleSave = () => {
    const finalConfigs = Object.values(groupedConfigs)
      .flat()
      .filter(obj => obj.isVisible)
      .map(({ isVisible, ...config }) => config);
    
    onSave(finalConfigs);
  };

  const handleBack = () => {
    onSave(null);
  };

  return (
    <div className="config-editor">
      <h2>Edit Configuration</h2>
      
      {Object.entries(groupedConfigs).map(([kind, objects]) => (
        <div key={kind} className="config-section">
          <div className="section-header">
            <h3>{kind}</h3>
            <button 
              className="add-object-button"
              onClick={() => handleAddObject(kind)}
            >
              Add {kind}
            </button>
          </div>
          
          {objects.map((obj, index) => (
            <div key={index} className={`config-object ${!obj.isVisible ? 'invisible' : ''}`}>
              <div className="object-controls">
                <label className="visibility-control">
                  <input
                    type="checkbox"
                    checked={obj.isVisible}
                    onChange={() => handleVisibilityChange(kind, index)}
                  />
                  Include in final config
                </label>
                <button
                  className="delete-button"
                  onClick={() => handleDeleteObject(kind, index)}
                >
                  Delete
                </button>
              </div>
              
              {renderObject(obj, '', (path, value) => 
                handleObjectChange(kind, index, path, value),
                obj.isVisible
              )}
            </div>
          ))}
        </div>
      ))}

      <div className="button-group">
        <button onClick={handleBack} className="back-button">
          Back
        </button>
        <button onClick={handleSave} className="save-button">
          Save Configuration
        </button>
      </div>

      {deleteConfirmation && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this {deleteConfirmation.kind} object?</p>
            <p>This action cannot be undone.</p>
            <div className="modal-buttons">
              <button onClick={cancelDelete} className="cancel-button">
                Cancel
              </button>
              <button onClick={confirmDelete} className="confirm-delete-button">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
