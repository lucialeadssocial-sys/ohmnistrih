/**
 * Creative Provider Abstraction
 * Defines the contract for all generative AI capabilities.
 */
export type ProviderType = 'LOCAL' | 'REMOTE' | 'HYBRID' | 'MANUAL';

export interface CreativeProvider {
  id: string;
  name: string;
  type: ProviderType;
  capabilities: string[];
  estimateResourceCost: (params: any) => string;
  isAvailable: () => boolean;
}

export interface CreativeRequest {
  id: string;
  type: 'BROLL' | 'VOICE' | 'IMAGE' | 'SFX' | 'MOTION';
  prompt: string;
  params: Record<string, any>;
  status: 'QUEUED' | 'GENERATING' | 'PREVIEW_READY' | 'COMPLETED' | 'FAILED';
  result?: any;
}

export class CreativeHub {
  private static instance: CreativeHub;
  private providers: CreativeProvider[] = [];

  public static getInstance(): CreativeHub {
    if (!CreativeHub.instance) CreativeHub.instance = new CreativeHub();
    return CreativeHub.instance;
  }

  public registerProvider(provider: CreativeProvider) {
    this.providers.push(provider);
  }

  public async generate(request: CreativeRequest): Promise<any> {
    // Pipeline: PROMPT -> GENERATE -> PREVIEW
    console.log(`Generating ${request.type}: ${request.prompt}`);
    return { status: 'PREVIEW_READY', result: 'preview_asset_url' };
  }
}
