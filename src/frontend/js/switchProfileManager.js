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
            // Load switch profiles
            for (const profile of this.baseProfiles) {
                await this.loadSwitchProfile(profile);
            }
            
            this._initialized = true;
        } catch (error) {
            console.error('Failed to initialize SwitchProfileManager:', error);
            throw error;
        }
    }

    async loadSwitchProfile(profile) {
        try {
            const response = await fetch(`/port_allocation_rules/${profile}.yaml`);
            if (!response.ok) {
                throw new Error(`Failed to load profile ${profile}: ${response.statusText}`);
            }
            const text = await response.text();
            const data = jsyaml.load(text);
            this.profiles.set(profile, data);
            return data;
        } catch (error) {
            console.error(`Error loading switch profile ${profile}:`, error);
            throw error;
        }
    }

    async getSwitchProfile(model) {
        if (!this._initialized) {
            await this.initialize();
        }

        // Convert model name from dell-s5248f-on to dell_s5248f_on format
        const normalizedModel = model.toLowerCase().replace(/-/g, '_');
        
        // Try to get from cache first
        let profile = this.profiles.get(normalizedModel);
        if (!profile) {
            // If not in cache, try to load it
            try {
                profile = await this.loadSwitchProfile(normalizedModel);
            } catch (error) {
                throw new Error(`Failed to get switch profile for ${model}: ${error.message}`);
            }
        }
        return profile;
    }

    getValidPorts(model, role) {
        const profile = this.profiles.get(model.toLowerCase().replace(/-/g, '_'));
        if (!profile) {
            throw new Error(`Profile not found for model ${model}`);
        }

        const ports = [];
        Object.entries(profile.Ports || {}).forEach(([portName, portConfig]) => {
            if (portConfig.Role === role) {
                ports.push(portName);
            }
        });

        return ports;
    }

    getEffectiveProfile(model) {
        if (!this.profiles.has(model)) {
            throw new Error(`Profile not found for model: ${model}`);
        }
        return this.profiles.get(model);
    }

    getSupportedModels() {
        return Array.from(this.profiles.keys());
    }

    isValidPort(model, role, port) {
        const validPorts = this.getValidPorts(model, role);
        return validPorts.includes(port);
    }

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
}
