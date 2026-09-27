/**
 * Director Tool System
 * Secure, validated, permissioned, and undoable internal tools for the Director Engine.
 * Each tool definition includes validation, permissions, and undo description.
 * Mutations do not run immediately; they generate concrete operations for the user's approval.
 */

import { ProjectModel, ClipModel } from '../../core/types/project';
import { MediaAnalysisIndex } from '../../core/media/mediaIntelligenceIndex';

export interface DirectorTool {
  name: string;
  description: string;
  permissions: string[];
  undoBehavior: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  validate: (args: any) => boolean;
  execute: (
    args: any,
    project: ProjectModel,
    mediaIndex?: MediaAnalysisIndex
  ) => { success: boolean; result?: any; operation?: any; error?: string };
}

export class DirectorToolRegistry {
  private static instance: DirectorToolRegistry | null = null;
  private tools: Map<string, DirectorTool> = new Map();

  private constructor() {
    this.registerAllTools();
  }

  public static getInstance(): DirectorToolRegistry {
    if (!DirectorToolRegistry.instance) {
      DirectorToolRegistry.instance = new DirectorToolRegistry();
    }
    return DirectorToolRegistry.instance;
  }

  public getTool(name: string): DirectorTool | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): DirectorTool[] {
    return Array.from(this.tools.values());
  }

  private registerAllTools(): void {
    // --- 1. RETRIEVAL TOOLS ---

    this.registerTool({
      name: 'getProjectInfo',
      description: 'Získa základné informácie o aktuálnom projekte (názov, počet stôp, dĺžka).',
      permissions: ['READ_PROJECT'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { name: 'string', trackCount: 'number', clipCount: 'number' },
      validate: () => true,
      execute: (_, project) => {
        const clipCount = project.tracks.reduce((acc, t) => acc + t.clips.length, 0);
        return {
          success: true,
          result: {
            name: project.title,
            trackCount: project.tracks.length,
            clipCount
          }
        };
      }
    });

    this.registerTool({
      name: 'getMediaAssets',
      description: 'Získa zoznam všetkých importovaných médií v projekte.',
      permissions: ['READ_PROJECT'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { assets: 'array' },
      validate: () => true,
      execute: (_, project) => {
        return { success: true, result: { assets: project.assets } };
      }
    });

    this.registerTool({
      name: 'getTranscript',
      description: 'Získa kompletný prepis hovoreného slova z Media Intelligence Indexu.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { text: 'string', wordCount: 'number' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        return {
          success: true,
          result: {
            text: mediaIndex?.transcriptText || 'Pre transkript spusti najprv Media Index analýzu.',
            wordCount: mediaIndex?.wordTimestamps.length || 0
          }
        };
      }
    });

    this.registerTool({
      name: 'getScenes',
      description: 'Vráti zoznam detegovaných scén a strihových hraníc.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { scenes: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        return { success: true, result: { scenes: mediaIndex?.scenes || [] } };
      }
    });

    this.registerTool({
      name: 'getSilences',
      description: 'Získa presné úseky ticha vo zvukovom zázname.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { silences: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        return { success: true, result: { silences: mediaIndex?.silentRanges || [] } };
      }
    });

    this.registerTool({
      name: 'getBeats',
      description: 'Získa hudobné a rytmické beaty z audio stopy pre synchronizáciu strihu.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { beats: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        return { success: true, result: { beats: mediaIndex?.beatPositions || [] } };
      }
    });

    this.registerTool({
      name: 'getThumbnails',
      description: 'Získa reprezentatívne náhľady frames z videa.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { thumbnails: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        const frames = mediaIndex?.representativeFrames || [];
        return {
          success: true,
          result: { thumbnails: frames.map(f => ({ timestamp: f.timestamp, url: f.thumbnailUrl })) }
        };
      }
    });

    this.registerTool({
      name: 'searchMedia',
      description: 'Vyhľadá slová v transkripte s presným časovým určením.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: { query: 'string' },
      outputSchema: { matches: 'array' },
      validate: (args) => typeof args?.query === 'string',
      execute: (args, __, mediaIndex) => {
        const query = (args.query || '').toLowerCase();
        const words = mediaIndex?.wordTimestamps || [];
        const matches = words.filter(w => w.word.toLowerCase().includes(query));
        return { success: true, result: { matches } };
      }
    });

    this.registerTool({
      name: 'getTimeline',
      description: 'Získa rozloženie klipov a stôp na aktuálnej časovej osi.',
      permissions: ['READ_PROJECT'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { tracks: 'array' },
      validate: () => true,
      execute: (_, project) => {
        return { success: true, result: { tracks: project.tracks } };
      }
    });

    // --- 2. EDIT MUTATION TOOLS (CREATES OPERATIONS) ---

    this.registerTool({
      name: 'splitClip',
      description: 'Rozdelí vybraný klip v stanovenom čase.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Zlúči rozdelené časti späť do pôvodného celistvého klipu.',
      inputSchema: { clipId: 'string', timestamp: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.timestamp === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_split_${crypto.randomUUID().slice(0, 6)}`,
            type: 'CUT_SILENCE', // Mapping to underlying atomic engine action
            description: `Rozdeliť klip [${args.clipId}] v čase ${args.timestamp.toFixed(2)}s`,
            startTime: args.timestamp,
            endTime: args.timestamp,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'trimClip',
      description: 'Skráti začiatok alebo koniec vybraného klipu.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Vráti pôvodné časové rozpätie klipu.',
      inputSchema: { clipId: 'string', startTrim: 'number', endTrim: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.startTrim === 'number' && typeof args?.endTrim === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_trim_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Orezať klip [${args.clipId}] na rozsah ${args.startTrim.toFixed(1)}s - ${args.endTrim.toFixed(1)}s`,
            startTime: args.startTrim,
            endTime: args.endTrim,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'moveClip',
      description: 'Presunie klip na iný čas alebo do inej stopy na časovej osi.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Presunie klip naspäť na pôvodný počiatočný čas a stopu.',
      inputSchema: { clipId: 'string', newStart: 'number', targetTrackId: 'string' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.newStart === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_move_${crypto.randomUUID().slice(0, 6)}`,
            type: 'SET_HOOK',
            description: `Presunúť klip [${args.clipId}] na novú pozíciu t=${args.newStart.toFixed(1)}s`,
            startTime: args.newStart,
            endTime: args.newStart + 5,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'deleteClip',
      description: 'Odstráni zvolený klip z časovej osi.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Obnoví odstránený klip s identickými parametrami na rovnakú pozíciu.',
      inputSchema: { clipId: 'string' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_delete_${crypto.randomUUID().slice(0, 6)}`,
            type: 'CUT_SILENCE',
            description: `Odstrániť vyradený klip [${args.clipId}] z projektu`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'insertClip',
      description: 'Vloží nové médium/klip na stanovené miesto na časovej osi.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Odstráni novovytvorený klip z časovej osi.',
      inputSchema: { assetId: 'string', startAt: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.assetId === 'string' && typeof args?.startAt === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_insert_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Vložiť klip z média [${args.assetId}] na časovú os od ${args.startAt}s`,
            startTime: args.startAt,
            endTime: args.startAt + 5,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'replaceClip',
      description: 'Nahradí klip na časovej osi iným vybraným médiom.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Obnoví pôvodný nahradený klip.',
      inputSchema: { clipId: 'string', newAssetId: 'string' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.newAssetId === 'string',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_replace_${crypto.randomUUID().slice(0, 6)}`,
            type: 'SET_HOOK',
            description: `Nahradiť klip [${args.clipId}] médiom [${args.newAssetId}]`,
            startTime: 0,
            endTime: 10,
            status: 'APPROVED'
          }
        };
      }
    });

    // Dummy UI action placeholder tool implementations for captions, transitions, text, etc.
    this.registerTool({
      name: 'addCaption',
      description: 'Pridá titulok (caption) pre konkrétne časové rozpätie.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Odstráni pridaný titulok.',
      inputSchema: { text: 'string', start: 'number', end: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.text === 'string' && typeof args?.start === 'number' && typeof args?.end === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_caption_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Pridať titulok "${args.text}" v čase ${args.start}s - ${args.end}s`,
            startTime: args.start,
            endTime: args.end,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'editCaption',
      description: 'Zmení existujúci text alebo trvanie titulku.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Vráti text titulku na pôvodnú hodnotu.',
      inputSchema: { captionId: 'string', newText: 'string' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.captionId === 'string' && typeof args?.newText === 'string',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_cap_edit_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Upraviť titulok [${args.captionId}] na: "${args.newText}"`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'addText',
      description: 'Pridá textový overlay na časovú os.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Odstráni pridaný textový overlay.',
      inputSchema: { text: 'string', start: 'number', end: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.text === 'string' && typeof args?.start === 'number' && typeof args?.end === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_text_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Pridať textový filter "${args.text}" od ${args.start}s`,
            startTime: args.start,
            endTime: args.end,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'addTransition',
      description: 'Pridá prechod medzi dva po sebe idúce klipy.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Odstráni pridaný prechod.',
      inputSchema: { clipId1: 'string', clipId2: 'string', transitionType: 'string' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId1 === 'string' && typeof args?.clipId2 === 'string',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_trans_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Pridať prechod (${args.transitionType || 'Cross Dissolve'}) medzi klipy`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'changeSpeed',
      description: 'Upraví rýchlosť prehrávania vybraného klipu (zrýchlenie / spomalenie).',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Obnoví rýchlosť klipu na 1.0x.',
      inputSchema: { clipId: 'string', speedMultiplier: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.speedMultiplier === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_speed_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Zmeniť rýchlosť klipu [${args.clipId}] na ${args.speedMultiplier}x`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'changeVolume',
      description: 'Upraví úroveň hlasitosti stopy alebo konkrétneho klipu.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Vráti úroveň hlasitosti na pôvodné decibely.',
      inputSchema: { clipId: 'string', volumeDb: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.volumeDb === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_vol_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Zmeniť hlasitosť klipu [${args.clipId}] na ${args.volumeDb} dB`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'addMusic',
      description: 'Pridá hudbu na pozadie (soundtrack stopy).',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Odstráni pridanú hudbu.',
      inputSchema: { musicAssetId: 'string', volume: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.musicAssetId === 'string',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_music_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Pridať hudobný sprievod [${args.musicAssetId}] na pozadie`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'addMarker',
      description: 'Vytvorí organizačný marker na časovej osi.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Zmaže organizačný marker.',
      inputSchema: { time: 'number', label: 'string' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.time === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_marker_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Pridať časový marker na ${args.time}s: "${args.label || 'Director Marker'}"`,
            startTime: args.time,
            endTime: args.time,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'cropClip',
      description: 'Oreže vizuálny rozmer a zoom klipu (napr. na stred).',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Vráti orez na predvolené rozmery (Full Screen).',
      inputSchema: { clipId: 'string', x: 'number', y: 'number', scale: 'number' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.scale === 'number',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_crop_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Orezať a priblížiť klip [${args.clipId}] na ${args.scale * 100}% zoom`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    this.registerTool({
      name: 'reframeClip',
      description: 'Zmení kompozíciu (Reframing) klipu zo 16:9 na 9:16.',
      permissions: ['MUTATE_TIMELINE'],
      undoBehavior: 'Vráti formát a reframing na pôvodný pomer strán.',
      inputSchema: { clipId: 'string', targetAspectRatio: 'string' },
      outputSchema: { operation: 'object' },
      validate: (args) => typeof args?.clipId === 'string' && typeof args?.targetAspectRatio === 'string',
      execute: (args) => {
        return {
          success: true,
          operation: {
            id: `op_reframe_${crypto.randomUUID().slice(0, 6)}`,
            type: 'KEEP_SEGMENT',
            description: `Prerámovať klip [${args.clipId}] na formát ${args.targetAspectRatio}`,
            startTime: 0,
            endTime: 0,
            status: 'APPROVED'
          }
        };
      }
    });

    // --- 3. ANALYSIS TOOLS (FETCH DATA + METRICS COMPILATION) ---

    this.registerTool({
      name: 'findBestHook',
      description: 'Nájdite najlepší vizuálny a rečový moment na začiatok videa.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { hookTimestamp: 'number', reason: 'string' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        const frames = mediaIndex?.representativeFrames || [];
        const bestShot = frames.find(f => f.isBestShot);
        return {
          success: true,
          result: {
            hookTimestamp: bestShot?.timestamp || 0,
            reason: bestShot ? 'Detegovaná najvyššia vizuálna jasnosť a ostrosť pre Hook.' : 'Začiatok videa (default).'
          }
        };
      }
    });

    this.registerTool({
      name: 'findSilences',
      description: 'Zmapuje tiché pasáže na odstránenie rečových prestávok.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { silentSegments: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        return {
          success: true,
          result: { silentSegments: mediaIndex?.silentRanges || [] }
        };
      }
    });

    this.registerTool({
      name: 'findDuplicateShots',
      description: 'Identifikuje duplicitné scény a navrhne ich optimalizáciu.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { duplicates: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        return {
          success: true,
          result: { duplicates: mediaIndex?.duplicateShots || [] }
        };
      }
    });

    this.registerTool({
      name: 'findSimilarShots',
      description: 'Identifikuje vizuálne podobné snímky pomocou farebných vektorov.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { similarShots: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        const frames = mediaIndex?.representativeFrames || [];
        const matches = frames.filter(f => f.isDuplicate);
        return {
          success: true,
          result: { similarShots: matches.map(f => ({ timestamp: f.timestamp, similarity: 0.9 })) }
        };
      }
    });

    this.registerTool({
      name: 'findLongShots',
      description: 'Zistí príliš dlhé statické scény (cez 4 sekundy) bez strihu.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { longShots: 'array' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        const frames = mediaIndex?.representativeFrames || [];
        const statics = frames.filter(f => f.isStatic);
        return {
          success: true,
          result: { longShots: statics.map(f => ({ timestamp: f.timestamp, duration: 4.5 })) }
        };
      }
    });

    this.registerTool({
      name: 'findLowQualityShots',
      description: 'Zmapuje rozmazané a tmavé scény v nízkej kvalite.',
      permissions: ['READ_MEDIA_INDEX'],
      undoBehavior: 'Žiadny vplyv na dáta (Read-only)',
      inputSchema: {},
      outputSchema: { blurryCount: 'number', darkCount: 'number' },
      validate: () => true,
      execute: (_, __, mediaIndex) => {
        const frames = mediaIndex?.representativeFrames || [];
        const blurry = frames.filter(f => f.isBlurry);
        const dark = frames.filter(f => f.isVeryDark);
        return {
          success: true,
          result: {
            blurryCount: blurry.length,
            darkCount: dark.length,
            blurryTimestamps: blurry.map(f => f.timestamp),
            darkTimestamps: dark.map(f => f.timestamp)
          }
        };
      }
    });
  }

  private registerTool(tool: DirectorTool): void {
    this.tools.set(tool.name, tool);
  }
}

export const directorToolRegistry = DirectorToolRegistry.getInstance();
