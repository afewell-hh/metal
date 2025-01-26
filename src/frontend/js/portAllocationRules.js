// Port Allocation Rules manager
import { SwitchProfileManager } from './switchProfileManager.js';

export class PortAllocationRules {
  constructor() {
    this.manager = new SwitchProfileManager();
  }

  async initialize() {
    await this.manager.initialize();
  }

  getValidPorts(model, role) {
    return this.manager.getValidPorts(model, role);
  }

  isValidPort(model, role, port) {
    return this.manager.isValidPort(model, role, port);
  }

  getSupportedModels() {
    return this.manager.getSupportedModels();
  }
}
