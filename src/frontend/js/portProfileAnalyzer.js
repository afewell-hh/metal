export class PortProfileAnalyzer {
    constructor(switchProfile) {
        this.switchProfile = switchProfile;
        this.portProfiles = switchProfile?.PortProfiles || {};
        this.ports = switchProfile?.Ports || {};
    }

    getServerPorts() {
        // Find all ports that have profiles and are not fabric ports
        return Object.entries(this.ports)
            .filter(([_, port]) => port.Profile && !port.Profile.includes('fabric'))
            .map(([name, port]) => ({
                name,
                profile: this.portProfiles[port.Profile],
                portConfig: port
            }));
    }

    getBreakoutInfo(portName) {
        const port = this.ports[portName];
        if (!port || !port.Profile) {
            return { isFixed: true, breakoutModes: [], defaultMode: 'Fixed' };
        }

        const profile = this.portProfiles[port.Profile];
        if (!profile || !profile.Breakout) {
            return { isFixed: true, breakoutModes: [], defaultMode: 'Fixed' };
        }

        return {
            isFixed: false,
            breakoutModes: Object.keys(profile.Breakout.Supported),
            defaultMode: profile.Breakout.Default
        };
    }

    getNextAvailablePort(usedPorts = [], breakoutMode = 'Fixed') {
        const serverPorts = this.getServerPorts();
        
        // Filter out ports that are already used
        const availablePorts = serverPorts.filter(port => 
            !usedPorts.includes(port.name));

        if (availablePorts.length === 0) {
            throw new Error('No available server ports');
        }

        // Find first port that supports the requested breakout mode
        const port = availablePorts.find(port => {
            const breakoutInfo = this.getBreakoutInfo(port.name);
            // For Fixed mode, we accept either truly fixed ports or ports that support Fixed breakout
            if (breakoutMode === 'Fixed') {
                return breakoutInfo.isFixed || breakoutInfo.breakoutModes.includes('Fixed');
            }
            // For other modes, check if the port supports that specific breakout mode
            return breakoutInfo.breakoutModes.includes(breakoutMode);
        });

        if (!port) {
            throw new Error(`No available ports support breakout mode: ${breakoutMode}`);
        }

        return port.name;
    }

    getPortName(basePort, breakoutMode, subPort = 0) {
        if (breakoutMode === 'Fixed' || !breakoutMode) {
            return basePort;
        }

        // Handle breakout naming based on mode
        const [prefix, number] = basePort.match(/([a-zA-Z]+)(\d+)/).slice(1);
        return `${prefix}${number}/${subPort + 1}`;
    }
}
