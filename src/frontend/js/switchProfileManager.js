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
            // First load base profiles (those without dependencies)
            await this.loadBaseProfiles();
            // Then load dependent profiles
            await this.loadDependentProfiles();
            // Finally load port rules
            await this.loadPortRules();
            
            this._initialized = true;
        } catch (error) {
            console.error('Failed to initialize SwitchProfileManager:', error);
            throw error;
        }
    }

    // Load all base profiles (those without dependencies)
    async loadBaseProfiles() {
        await Promise.all(
            this.baseProfiles.map(model => this.loadProfile(model))
        );
    }

    // Load profiles that depend on other profiles
    async loadDependentProfiles() {
        // For each profile we've loaded
        for (const [model, profile] of this.profiles.entries()) {
            if (profile.useProfileFrom) {
                const baseModel = profile.useProfileFrom.model;
                const baseProfile = this.profiles.get(baseModel);
                if (!baseProfile) {
                    throw new Error(`Base profile ${baseModel} not found for ${model}`);
                }
                // Merge the base profile into this profile
                this.profiles.set(model, {
                    ...baseProfile,
                    ...profile,
                    // Deep merge any nested objects
                    portRules: {
                        ...baseProfile.portRules,
                        ...profile.portRules
                    }
                });
            }
        }
    }

    // Load all port allocation rules
    async loadPortRules() {
        for (const model of this.profiles.keys()) {
            try {
                const response = await fetch(`/port_allocation_rules/${model}.yaml`);
                if (!response.ok) {
                    console.error(`Failed to load PAR for ${model}: ${response.status}`);
                    continue;
                }
                const text = await response.text();
                const rules = jsyaml.load(text);
                this.portRules.set(model, rules);
            } catch (error) {
                console.error(`Failed to load PAR for ${model}:`, error);
            }
        }
    }

    // Load a single switch profile
    async loadProfile(model) {
        try {
            const response = await fetch(`/switch_profiles/profile_${model}.go`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            
            // Parse the Go profile into a JavaScript object
            const profile = this.parseGoProfile(text);
            this.profiles.set(model, profile);
        } catch (error) {
            console.error(`Failed to load switch profile for ${model}:`, error);
            throw error;
        }
    }

    // Simple parser for Go switch profiles
    parseGoProfile(goCode) {
        const profile = {
            metadata: {},
            portRules: {
                fabric: { validPorts: [] },
                server: { validPorts: [] },
                management: { validPorts: [] }
            }
        };

        // Extract basic metadata using regex
        const nameMatch = goCode.match(/Name:\s*"([^"]+)"/);
        if (nameMatch) profile.metadata.name = nameMatch[1];

        const displayNameMatch = goCode.match(/DisplayName:\s*"([^"]+)"/);
        if (displayNameMatch) profile.metadata.displayName = displayNameMatch[1];

        // Extract port rules
        const fabricPortsMatch = goCode.match(/FabricPorts:\s*\[\]string\{([^}]+)\}/);
        if (fabricPortsMatch) {
            profile.portRules.fabric.validPorts = fabricPortsMatch[1]
                .split(',')
                .map(p => p.trim().replace(/"/g, ''))
                .filter(p => p);
        }

        const serverPortsMatch = goCode.match(/ServerPorts:\s*\[\]string\{([^}]+)\}/);
        if (serverPortsMatch) {
            profile.portRules.server.validPorts = serverPortsMatch[1]
                .split(',')
                .map(p => p.trim().replace(/"/g, ''))
                .filter(p => p);
        }

        const mgmtPortsMatch = goCode.match(/ManagementPorts:\s*\[\]string\{([^}]+)\}/);
        if (mgmtPortsMatch) {
            profile.portRules.management.validPorts = mgmtPortsMatch[1]
                .split(',')
                .map(p => p.trim().replace(/"/g, ''))
                .filter(p => p);
        }

        return profile;
    }

    // Get the effective profile for a switch model
    getEffectiveProfile(model) {
        if (!this._initialized) {
            throw new Error('SwitchProfileManager not initialized');
        }

        const profile = this.profiles.get(model);
        if (!profile) {
            throw new Error(`Profile not found for model: ${model}`);
        }

        return profile;
    }

    // Get valid ports for a specific role
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

    // Get all supported switch models
    getSupportedModels() {
        return Array.from(this.profiles.keys());
    }

    // Validate if a port can be used for a specific role
    isValidPort(model, role, port) {
        const validPorts = this.getValidPorts(model, role);
        return validPorts.includes(port);
    }

    // Helper to expand port ranges like ["1-4", "6", "8-10"] to [1,2,3,4,6,8,9,10]
    expandPortRanges(ranges) {
        const ports = new Set();
        ranges.forEach(range => {
            if (range.includes('-')) {
                const [start, end] = range.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    ports.add(i);
                }
            } else if (range.toLowerCase() === 'm1') {
                ports.add('M1');
            } else {
                ports.add(Number(range));
            }
        });
        return Array.from(ports).sort((a, b) => {
            if (a === 'M1') return -1;
            if (b === 'M1') return 1;
            return a - b;
        });
    }
}
