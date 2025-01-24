import { SwitchProfile } from '../types/config';

export const switchProfiles: SwitchProfile[] = [
  {
    name: 'Celestica DS3000',
    model: 'celestica-ds3000',
    features: {
      subinterfaces: true,
      vxlan: true,
      acls: true
    },
    ports: [
      { id: 'M1', label: '', type: 'Management' as const, defaultSpeed: '1G', supportedSpeeds: ['1G'] },
      ...Array.from({ length: 32 }, (_, i) => ({
        id: `E1/${i + 1}`,
        label: `${i + 1}`,
        type: 'Breakout' as const,
        defaultSpeed: '1x100G',
        supportedSpeeds: ['1x100G', '1x40G', '4x10G', '4x25G']
      })),
      {
        id: 'E1/33',
        label: '33',
        type: 'Direct' as const,
        defaultSpeed: '10G',
        supportedSpeeds: ['1G', '10G']
      }
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
      { id: 'M1', label: '', type: 'Management' as const, defaultSpeed: '1G', supportedSpeeds: ['1G'] },
      ...Array.from({ length: 32 }, (_, i) => ({
        id: `E1/${i + 1}`,
        label: `${i + 1}`,
        type: 'Breakout' as const,
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
      { id: 'M1', label: '', type: 'Management' as const, defaultSpeed: '1G', supportedSpeeds: ['1G'] },
      ...Array.from({ length: 48 }, (_, i) => ({
        id: `E1/${i + 1}`,
        label: `${i + 1}`,
        type: 'Breakout' as const,
        defaultSpeed: '1x25G',
        supportedSpeeds: ['1x25G', '1x10G', '1x1G']
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `E1/${i + 49}`,
        label: `${i + 49}`,
        type: 'Breakout' as const,
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
      { id: 'M1', label: '', type: 'Management' as const, defaultSpeed: '1G', supportedSpeeds: ['1G'] },
      ...Array.from({ length: 32 }, (_, i) => ({
        id: `E1/${i + 1}`,
        label: `${i + 1}`,
        type: 'Breakout' as const,
        defaultSpeed: '1x400G',
        supportedSpeeds: ['1x400G', '2x200G', '4x100G']
      }))
    ]
  }
];

export function getSwitchProfile(model: string): SwitchProfile | undefined {
  return switchProfiles.find(profile => profile.model === model);
}

export function listSwitchModels(): Array<{ model: string; name: string }> {
  return switchProfiles.map(({ model, name }) => ({ model, name }));
}
