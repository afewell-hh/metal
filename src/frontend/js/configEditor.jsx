import React, { useState } from 'react';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/theme-github';
import yaml from 'js-yaml';
import '../css/configEditor.css';

// Templates for new objects
const objectTemplates = {
  IPv4Namespace: {
    apiVersion: 'vpc.githedgehog.com/v1beta1',
    kind: 'IPv4Namespace',
    metadata: { name: '' },
    spec: { subnets: [''] }
  },
  VLANNamespace: {
    apiVersion: 'vpc.githedgehog.com/v1beta1',
    kind: 'VLANNamespace',
    metadata: { name: '' },
    spec: {
      ranges: [{
        from: '',
        to: ''
      }]
    }
  },
  Switch: {
    apiVersion: 'wiring.githedgehog.com/v1beta1',
    kind: 'Switch',
    metadata: { name: '' },
    spec: {
      boot: { mac: '' },
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
    metadata: { name: '' },
    spec: {
      fabric: {
        links: [{
          spine: { port: '' },
          leaf: { port: '' }
        }]
      }
    }
  }
};

const ConfigEditor = ({ configs, onSave }) => {
  // Group configs by kind, adding _isVisible and _isEditing flags
  const [objects, setObjects] = useState(() => {
    const grouped = {};
    configs.forEach(config => {
      const kind = config.kind;
      if (!grouped[kind]) grouped[kind] = [];
      grouped[kind].push({
        ...config,
        _isVisible: true,
        _isEditing: false,
        _yamlText: yaml.dump(config)
      });
    });
    return grouped;
  });

  const handleToggleVisibility = (kind, index) => {
    setObjects(prev => ({
      ...prev,
      [kind]: prev[kind].map((obj, i) => 
        i === index ? { ...obj, _isVisible: !obj._isVisible } : obj
      )
    }));
  };

  const handleToggleEdit = (kind, index) => {
    setObjects(prev => ({
      ...prev,
      [kind]: prev[kind].map((obj, i) => 
        i === index ? { ...obj, _isEditing: !obj._isEditing } : obj
      )
    }));
  };

  const handleYamlChange = (kind, index, newValue) => {
    try {
      // Parse YAML to ensure it's valid
      const parsed = yaml.load(newValue);
      setObjects(prev => ({
        ...prev,
        [kind]: prev[kind].map((obj, i) => 
          i === index ? {
            ...parsed,
            _isVisible: obj._isVisible,
            _isEditing: obj._isEditing,
            _yamlText: newValue
          } : obj
        )
      }));
    } catch (e) {
      // If YAML is invalid, just update the text without parsing
      setObjects(prev => ({
        ...prev,
        [kind]: prev[kind].map((obj, i) => 
          i === index ? { ...obj, _yamlText: newValue } : obj
        )
      }));
    }
  };

  const handleDelete = (kind, index) => {
    setObjects(prev => ({
      ...prev,
      [kind]: prev[kind].filter((_, i) => i !== index)
    }));
  };

  const handleAddObject = (kind) => {
    const template = objectTemplates[kind];
    setObjects(prev => ({
      ...prev,
      [kind]: [
        {
          ...template,
          _isVisible: true,
          _isEditing: false,
          _yamlText: yaml.dump(template)
        },
        ...prev[kind]
      ]
    }));
  };

  const handleSave = () => {
    // Convert objects back to array format, removing internal fields
    const cleanedConfigs = Object.entries(objects)
      .reduce((acc, [kind, items]) => [
        ...acc,
        ...items
          .filter(item => item._isVisible)
          .map(({ _isVisible, _isEditing, _yamlText, ...item }) => item)
      ], []);
    onSave(cleanedConfigs);
  };

  return (
    <div className="config-editor">
      {Object.entries(objects).map(([kind, items]) => (
        <div key={kind} className="object-group">
          <div className="section-header">
            <h3>{kind} Objects</h3>
            <button
              className="add-object-button"
              onClick={() => handleAddObject(kind)}
            >
              Add {kind}
            </button>
          </div>
          {items.map((obj, index) => (
            <div key={index} className="object-card">
              <div className="object-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={obj._isVisible}
                    onChange={() => handleToggleVisibility(kind, index)}
                  />
                  Include in Configuration
                </label>
                <button
                  onClick={() => handleToggleEdit(kind, index)}
                  className="edit-button"
                >
                  {obj._isEditing ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={() => handleDelete(kind, index)}
                  className="delete-button"
                >
                  Delete
                </button>
              </div>
              <AceEditor
                mode="yaml"
                theme="github"
                value={obj._yamlText}
                onChange={(newValue) => handleYamlChange(kind, index, newValue)}
                readOnly={!obj._isEditing}
                width="100%"
                minLines={5}
                maxLines={30}
                showPrintMargin={false}
                showGutter={true}
                highlightActiveLine={obj._isEditing}
                className={obj._isEditing ? '' : 'readonly'}
                setOptions={{
                  showLineNumbers: true,
                  tabSize: 2,
                  useWorker: false
                }}
              />
            </div>
          ))}
        </div>
      ))}
      <button onClick={handleSave} className="save-button">Save</button>
    </div>
  );
};

export default ConfigEditor;
