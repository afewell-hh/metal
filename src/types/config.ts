export interface SpineLeafConfig {
  // Switch Selection
  leafModel: string;
  spineModel: string;
  leafCount: number;
  spineCount: number;
  
  // Port Configuration
  totalServerPorts?: number;
  uplinksPerLeaf: number;
  
  // Optional Metadata
  serialNumbers?: {
    leaf: Record<string, string>;
    spine: Record<string, string>;
  };
}

export interface CollapsedCoreConfig {
  // Switch Selection
  switchModel: string;
  switchCount: number;
  
  // Port Configuration
  totalServerPorts?: number;
  interCoreLinks: number;
  
  // Optional Metadata
  serialNumbers?: Record<string, string>;
}

export interface PortAssignment {
  switchId: string;
  portId: string;
  type: 'server' | 'uplink' | 'intercore';
  connectedTo?: {
    switchId: string;
    portId: string;
  };
}

export interface SwitchProfile {
  name: string;
  model: string;
  ports: {
    id: string;
    label: string;
    type: 'Management' | 'Breakout' | 'Direct';
    defaultSpeed: string;
    supportedSpeeds: string[];
  }[];
  features: {
    subinterfaces: boolean;
    vxlan: boolean;
    acls: boolean;
  };
}

export interface GeneratedConfig {
  switches: {
    [key: string]: {
      model: string;
      serialNumber?: string;
      ports: PortAssignment[];
    };
  };
  connections: {
    [key: string]: {
      from: {
        switchId: string;
        portId: string;
      };
      to: {
        switchId: string;
        portId: string;
      };
      type: 'server' | 'uplink' | 'intercore';
    };
  };
  diagrams: {
    topology: string;  // Mermaid diagram string
    cabling: string;   // Mermaid diagram string
  };
}
