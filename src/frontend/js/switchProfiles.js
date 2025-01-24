const switchProfiles = [
    {
        name: 'Celestica DS3000',
        model: 'celestica-ds3000',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x100G',
                supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
            }))
        ]
    },
    {
        name: 'Celestica DS4000',
        model: 'celestica-ds4000',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x400G',
                supportedSpeeds: ['1x400G', '2x200G', '4x100G']
            }))
        ]
    },
    {
        name: 'Dell S5232F-ON',
        model: 'dell-s5232f-on',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x100G',
                supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
            }))
        ]
    },
    {
        name: 'Dell S5248F-ON',
        model: 'dell-s5248f-on',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 48 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x25G',
                supportedSpeeds: ['1x25G', '1x10G', '1x1G']
            })),
            ...Array.from({ length: 4 }, (_, i) => ({
                id: `E1/${i + 49}`,
                label: `${i + 49}`,
                type: 'Breakout',
                defaultSpeed: '1x100G',
                supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
            }))
        ]
    },
    {
        name: 'Dell Z9332F-ON',
        model: 'dell-z9332f-on',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x400G',
                supportedSpeeds: ['1x400G', '2x200G', '4x100G']
            }))
        ]
    },
    {
        name: 'Edgecore DCS203',
        model: 'edgecore-dcs203',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x100G',
                supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
            }))
        ]
    },
    {
        name: 'Edgecore DCS204',
        model: 'edgecore-dcs204',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x400G',
                supportedSpeeds: ['1x400G', '2x200G', '4x100G']
            }))
        ]
    },
    {
        name: 'Edgecore DCS501',
        model: 'edgecore-dcs501',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 48 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x25G',
                supportedSpeeds: ['1x25G', '1x10G', '1x1G']
            })),
            ...Array.from({ length: 8 }, (_, i) => ({
                id: `E1/${i + 49}`,
                label: `${i + 49}`,
                type: 'Breakout',
                defaultSpeed: '1x100G',
                supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
            }))
        ]
    },
    {
        name: 'Edgecore EPS203',
        model: 'edgecore-eps203',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x100G',
                supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
            }))
        ]
    },
    {
        name: 'Supermicro SSE-C4632SB',
        model: 'supermicro-sse-c4632sb',
        features: {
            subinterfaces: true,
            vxlan: true,
            acls: true
        },
        ports: [
            { id: 'M1', label: '', type: 'Management', defaultSpeed: '1G', supportedSpeeds: ['1G'] },
            ...Array.from({ length: 32 }, (_, i) => ({
                id: `E1/${i + 1}`,
                label: `${i + 1}`,
                type: 'Breakout',
                defaultSpeed: '1x100G',
                supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
            }))
        ]
    }
];

function getSwitchProfile(model) {
    return switchProfiles.find(profile => profile.model === model);
}

function listSwitchModels() {
    return switchProfiles.map(({ model, name }) => ({ model, name }));
}
