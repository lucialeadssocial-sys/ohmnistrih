import { ProjectModel, MediaAsset } from '../types/project';
import { renderEngine } from './renderEngine';

/**
 * Media → render engine link.
 *
 * The compositor draws media from elements registered with `renderEngine.registerMediaElement`,
 * and the audio mixer decodes what those elements point at. Nothing was registering them, so the
 * compositor had nothing to draw and the mix had no clips to decode — an export could look and
 * sound empty even though the project had media.
 *
 * This module links the canonical project's assets to real DOM elements:
 *   - the URL comes from an explicit override (the file the editor just loaded), the asset's own
 *     `url`, or OPFS (`opfsManager.getMediaUrl`);
 *   - every failure is reported with its reason. Nothing is invented: an asset that cannot be
 *     resolved is listed as failed, never silently "linked".
 */

export interface MediaLinkFailure {
  assetId: string;
  name: string;
  reasonSk: string;
  reasonEn: string;
}

/** Injection point for tests or an alternative player; production uses document.createElement. */
export type MediaElementFactory = (asset: MediaAsset, url: string) => HTMLVideoElement | HTMLImageElement;

export interface MediaLinkReport {
  linked: { assetId: string; name: string; width: number; height: number; url: string }[];
  failed: MediaLinkFailure[];
  skipped: MediaLinkFailure[];
}

const registry = new Map<string, HTMLVideoElement | HTMLImageElement>();

/** Element already linked for an asset (used by the face measurement, which needs frames). */
export function getLinkedMediaElement(assetId: string): HTMLVideoElement | HTMLImageElement | undefined {
  return registry.get(assetId);
}

export function getLinkedMediaIds(): string[] {
  return [...registry.keys()];
}

/** Forgets the links (elements are released by the caller / GC). */
export function clearLinkedMedia(): void {
  registry.clear();
}

const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

function waitForEvent(element: HTMLVideoElement | HTMLImageElement, readyEvent: string, errorEvent: string, timeoutMs: number): Promise<boolean> {
  return new Promise(resolve => {
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      element.removeEventListener(readyEvent, onReady);
      element.removeEventListener(errorEvent, onError);
      resolve(ok);
    };
    const onReady = () => done(true);
    const onError = () => done(false);
    element.addEventListener(readyEvent, onReady);
    element.addEventListener(errorEvent, onError);
    setTimeout(() => done(false), timeoutMs);
  });
}

async function resolveAssetUrl(asset: MediaAsset, override?: string): Promise<string | null> {
  if (override) return override;
  if (asset.url) return asset.url;
  const opfsPath = asset.opfsPath;
  if (!opfsPath) return null;
  try {
    const { opfsManager } = await import('../storage/opfs');
    const url = await opfsManager.getMediaUrl(opfsPath);
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Links every visual asset of the project that is not linked yet.
 * `urlByAssetId` lets the caller hand over a URL it already knows (e.g. the loaded source file).
 */
export async function ensureProjectMediaElements(
  project: ProjectModel,
  options: { urlByAssetId?: Record<string, string>; timeoutMs?: number; reload?: boolean; elementFactory?: MediaElementFactory } = {}
): Promise<MediaLinkReport> {
  const timeoutMs = options.timeoutMs ?? 4000;
  const report: MediaLinkReport = { linked: [], failed: [], skipped: [] };

  if (options.reload) registry.clear();

  for (const asset of project.assets ?? []) {
    if (asset.type === 'audio') {
      // Audio-only assets are decoded from their URL by the mixer; no visual element is needed.
      report.skipped.push({
        assetId: asset.id,
        name: asset.name,
        reasonSk: 'Zvukový asset — kompozitor preň nekreslí element (mix si ho dekóduje z URL).',
        reasonEn: 'Audio-only asset — the compositor draws no element for it (the mix decodes it from its URL).',
      });
      continue;
    }

    if (registry.has(asset.id)) {
      report.skipped.push({
        assetId: asset.id,
        name: asset.name,
        reasonSk: 'Už prepojený v tomto behu.',
        reasonEn: 'Already linked in this run.',
      });
      continue;
    }

    if (!options.elementFactory && !hasDom()) {
      report.failed.push({
        assetId: asset.id,
        name: asset.name,
        reasonSk: 'Bez DOM (Node/jsdom bez média) sa nedá vytvoriť element — prepojenie sa nevykonalo.',
        reasonEn: 'Without a DOM (Node / jsdom without media) no element can be created — nothing was linked.',
      });
      continue;
    }

    const url = await resolveAssetUrl(asset, options.urlByAssetId?.[asset.id]);
    if (!url) {
      report.failed.push({
        assetId: asset.id,
        name: asset.name,
        reasonSk: `Asset nemá použiteľnú URL ani čitateľnú OPFS cestu (${asset.opfsPath || 'bez cesty'}).`,
        reasonEn: `The asset has no usable URL and no readable OPFS path (${asset.opfsPath || 'no path'}).`,
      });
      continue;
    }

    try {
      const element = options.elementFactory
        ? options.elementFactory(asset, url)
        : asset.type === 'image'
          ? document.createElement('img')
          : document.createElement('video');
      if (asset.type !== 'image' && 'playsInline' in element) {
        (element as HTMLVideoElement).muted = true;
        (element as HTMLVideoElement).playsInline = true;
        (element as HTMLVideoElement).preload = 'auto';
      }
      element.src = url;
      const ready = await waitForEvent(
        element,
        asset.type === 'image' ? 'load' : 'loadedmetadata',
        'error',
        timeoutMs
      );
      if (!ready) {
        report.failed.push({
          assetId: asset.id,
          name: asset.name,
          reasonSk: `Médium sa nepodarilo načítať do ${timeoutMs} ms (URL ${url.slice(0, 60)}…).`,
          reasonEn: `The media did not load within ${timeoutMs} ms (URL ${url.slice(0, 60)}…).`,
        });
        continue;
      }

      renderEngine.registerMediaElement(asset.id, element);
      registry.set(asset.id, element);

      const width = 'videoWidth' in element ? element.videoWidth : element.naturalWidth;
      const height = 'videoHeight' in element ? element.videoHeight : element.naturalHeight;
      report.linked.push({ assetId: asset.id, name: asset.name, width: width || 0, height: height || 0, url });
    } catch (error) {
      report.failed.push({
        assetId: asset.id,
        name: asset.name,
        reasonSk: `Prepojenie zlyhalo: ${(error as Error).message}`,
        reasonEn: `Linking failed: ${(error as Error).message}`,
      });
    }
  }

  return report;
}
