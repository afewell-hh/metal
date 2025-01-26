import jsyaml from 'js-yaml';

// Manages switch profiles and port allocation rules
export class SwitchProfileManager {
    constructor() {
        this.profiles = new Map();
        this.portRules = new Map();
        this._initialized = false;
        this.baseProfiles = [
            'dell_s5248f_on',
            'dell_s5232f_on',
            'celestica_ds3000',
            'celestica_ds4000',
            'edgecore_dcs203',
            'edgecore_dcs204',
            'edgecore_dcs501',
            'edgecore_eps203',
            'dell_z9332f_on',
            'supermicro_sse_c4632',
            'vs'
        ];
    }

    get initialized() {
        return this._initialized;
    }

    async initialize() {
        if (this._initialized) return;

        try {
            // Load port rules, which now contain all the necessary information
            await this.loadPortRules();
            
            this._initialized = true;
        } catch (error) {
            console.error('Failed to initialize SwitchProfileManager:', error);
            throw error;
        }
    }

    // Load all port allocation rules
    async loadPortRules() {
        for (const model of this.baseProfiles) {
            try {
                const response = await fetch(`/port_allocation_rules/${model}.yaml`);
                if (!response.ok) {
                    console.error(`Failed to load PAR for ${model}: ${response.status}`);
                    continue;
                }
                const text = await response.text();
                const rules = jsyaml.load(text);

                // Convert the YAML format to our internal format
                const profile = {
                    metadata: {
                        name: model,
                        displayName: model.replace(/_/g, ' ').toUpperCase()
                    },
                    portRules: {
                        fabric: { validPorts: this.expandPortRanges(rules.fabric || []) },
                        server: { validPorts: this.expandPortRanges(rules.server || []) },
                        management: { validPorts: this.expandPortRanges(rules.management || []) }
                    }
                };

                this.profiles.set(model, profile);
                this.portRules.set(model, rules);
            } catch (error) {
                console.error(`Failed to load PAR for ${model}:`, error);
            }
        }
    }

    // Helper to expand port ranges like ["1-4", "6", "8-10"] to ["1","2","3","4","6","8","9","10"]
    expandPortRanges(ranges) {
        const ports = new Set();
        ranges.forEach(range => {
            if (typeof range === 'string' && range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    ports.add(i.toString());
                }
            } else {
                ports.add(range.toString());
            }
        });
        return Array.from(ports).sort((a, b) => parseInt(a) - parseInt(b));
    }

    // Get valid ports for a given role
    getValidPorts(model, role) {
        if (!this._initialized) {
            throw new Error('SwitchProfileManager not initialized');
        }

        const profile = this.profiles.get(model);
        if (!profile) {
            throw new Error(`Profile not found for model: ${model}`);
        }

        if (!profile.portRules || !profile.portRules[role]) {
            throw new Error(`No port rules found for ${role} ports in model ${model}`);
        }

        return profile.portRules[role].validPorts || [];
    }

    // Get the effective profile for a switch model
    getEffectiveProfile(model) {
        if (!this.profiles.has(model)) {
            throw new Error(`Profile not found for model: ${model}`);
        }
        return this.profiles.get(model);
    }

    // Get all supported switch models
    getSupportedModels() {
        return Array.from(this.profiles.keys());
    }

    // Validate if a port can be used for a specific role
    isValidPort(model, role, port) {
        const validPorts = this.getValidPorts(model, role);
        return validPorts.includes(port);
    }
}
