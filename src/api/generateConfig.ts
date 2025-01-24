import { SpineLeafConfig, GeneratedConfig } from '../types/config';
import { ConfigGenerator } from '../lib/configGenerator';
import { switchProfiles } from '../data/switchProfiles';

interface ApiResponse {
  success: boolean;
  data?: GeneratedConfig;
  error?: string;
}

export async function handler(event: any): Promise<ApiResponse> {
  try {
    // Parse input configuration
    const config: SpineLeafConfig = JSON.parse(event.body);

    // Initialize config generator with switch profiles
    const generator = new ConfigGenerator(switchProfiles);

    // Generate configuration
    const generatedConfig = generator.generateSpineLeafConfig(config);

    return {
      success: true,
      data: generatedConfig
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Example usage:
/*
curl -X POST https://your-api-endpoint/generate-config \
-H "Content-Type: application/json" \
-d '{
  "leafModel": "dell-s5248f-on",
  "spineModel": "dell-s5232f-on",
  "leafCount": 4,
  "spineCount": 2,
  "totalServerPorts": 96,
  "uplinksPerLeaf": 4
}'
*/
