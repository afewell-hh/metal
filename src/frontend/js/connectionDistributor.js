export class ConnectionDistributor {
    constructor(leafCount) {
        this.leafCount = leafCount;
    }

    validateConnectionCount(count) {
        const validCounts = [1, 2, 4, 8];
        if (!validCounts.includes(count)) {
            throw new Error(`Invalid connection count: ${count}. Must be one of: ${validCounts.join(', ')}`);
        }
    }

    getLeafSwitchesForServer(configType, connectionsPerServer, startLeafIndex) {
        this.validateConnectionCount(connectionsPerServer);

        // For bundled-LAG-SH, all connections go to the same leaf
        if (configType === 'bundled-LAG-SH') {
            return Array(connectionsPerServer).fill(`leaf-${startLeafIndex + 1}`);
        }

        const leafSwitches = [];
        switch (connectionsPerServer) {
            case 1:
                // Single connection goes to the start leaf
                leafSwitches.push(`leaf-${startLeafIndex + 1}`);
                break;

            case 2:
                if (configType === 'bundled-mclag') {
                    // For MCLAG, need two consecutive leaves
                    if (startLeafIndex + 1 >= this.leafCount) {
                        throw new Error('Not enough leaf switches for MCLAG configuration');
                    }
                    leafSwitches.push(`leaf-${startLeafIndex + 1}`);
                    leafSwitches.push(`leaf-${startLeafIndex + 2}`);
                } else {
                    // Split across two leaves round-robin style
                    leafSwitches.push(`leaf-${startLeafIndex + 1}`);
                    leafSwitches.push(`leaf-${((startLeafIndex + 1) % this.leafCount) + 1}`);
                }
                break;

            case 4:
                if (this.leafCount < 4) {
                    throw new Error('Need at least 4 leaf switches for 4 connections');
                }
                // Distribute across 4 leaves round-robin style
                for (let i = 0; i < 4; i++) {
                    leafSwitches.push(`leaf-${((startLeafIndex + i) % this.leafCount) + 1}`);
                }
                break;

            case 8:
                if (this.leafCount < 4) {
                    throw new Error('Need at least 4 leaf switches for 8 connections');
                }
                // Two connections per leaf across 4 leaves
                for (let i = 0; i < 4; i++) {
                    const leafName = `leaf-${((startLeafIndex + i) % this.leafCount) + 1}`;
                    leafSwitches.push(leafName, leafName);
                }
                break;
        }

        return leafSwitches;
    }
}
