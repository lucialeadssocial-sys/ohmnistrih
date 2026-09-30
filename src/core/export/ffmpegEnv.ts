/**
 * KDE JE FFMPEG (a písmo pre titulky) — krok B.
 *
 * Prečo samostatný modul: vypálenie titulkov je jediná vec v appke, ktorá
 * **naozaj potrebuje ffmpeg na serveri**. Keď tam nie je, nesmie sa stať, že
 * tlačidlo „vypáliť“ len tak zlyhá bez vysvetlenia — appka to musí povedať
 * vopred, sobotným dôvodom a s cestou, ako to spraviť.
 *
 * Poradie hľadania (od najspoľahlivejšieho):
 *   1. `FFMPEG_PATH` — keď to niekto nastaví, jeho slovo platí.
 *   2. `imageio-ffmpeg` (pip) — v tomto prostredí jediná cesta, ako ffmpeg mať.
 *   3. `ffmpeg` v systémovej PATH.
 *   4. bežné systémové cesty.
 *
 * Modul je čistý a testovateľný: hľadanie je oddelené od používania.
 */

import { execSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

export type FfmpegSource = "env" | "imageio" | "path" | "common";

export interface FfmpegLocation {
  path: string;
  source: FfmpegSource;
  /** Ľudská veta, odkiaľ ffmpeg je — ukazuje sa v UI a v logu. */
  labelSk: string;
}

/** Poctivá veta, keď ffmpeg nie je — vrátane toho, čo s tým robiť. */
export const FFMPEG_MISSING_SK =
  "Na serveri nie je ffmpeg, a bez neho sa titulky do obrazu vypáliť nedajú " +
  "(prekódovanie obrazu vie len ffmpeg — prehliadač toto nerobí). " +
  "Nainštaluj ffmpeg alebo nastav premennú FFMPEG_PATH a skús znova. " +
  "Ostatné funkcie appky fungujú ďalej — nič sa nemení.";

function tryExec(command: string): string {
  try {
    return execSync(command, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * Nájde ffmpeg. Vracia `null`, keď naozaj nie je — volajúci to musí povedať
 * používateľovi (nie spadnúť a nie predstierať úspech).
 */
export function findFfmpegPath(env: NodeJS.ProcessEnv = process.env): FfmpegLocation | null {
  const fromEnv = (env.FFMPEG_PATH || "").trim();
  if (fromEnv && existsSync(fromEnv)) {
    return { path: fromEnv, source: "env", labelSk: "z premennej FFMPEG_PATH" };
  }

  const fromPy = tryExec(
    'python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"',
  );
  if (fromPy && existsSync(fromPy)) {
    return { path: fromPy, source: "imageio", labelSk: "z imageio-ffmpeg (pip balík)" };
  }

  const which = tryExec("which ffmpeg") || tryExec("command -v ffmpeg");
  if (which && existsSync(which)) {
    return { path: which, source: "path", labelSk: "zo systémovej PATH" };
  }

  for (const candidate of [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/opt/homebrew/bin/ffmpeg",
  ]) {
    if (existsSync(candidate)) {
      return { path: candidate, source: "common", labelSk: `zo systémovej cesty ${candidate}` };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Písmo pre titulky
// ---------------------------------------------------------------------------

export interface CaptionFontLocation {
  /** Názov rodiny pre ASS (`Fontname:`). */
  fontName: string;
  /** Adresár, ktorý dostane libass cez `fontsdir=`. */
  fontsDir: string;
  sourceSk: string;
}

interface FontCandidate {
  file: string;
  family: string;
  labelSk: string;
}

/**
 * Kandidáti v tomto poradí. Zámerne DejaVu (má úplnú slovenskú diakritiku a je
 * overené testom) — Montserrat tu existuje len v Medium/BoldItalic, takže ako
 * predvolené „tučné virálne“ písmo nesedí.
 */
const FONT_CANDIDATES: FontCandidate[] = [
  {
    file: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    family: "DejaVu Sans",
    labelSk: "DejaVu Sans Bold (systém)",
  },
  {
    file: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    family: "DejaVu Sans",
    labelSk: "DejaVu Sans (systém)",
  },
  {
    file: "/usr/local/lib/python3.13/site-packages/cv2/qt/fonts/DejaVuSans-Bold.ttf",
    family: "DejaVu Sans",
    labelSk: "DejaVu Sans Bold (OpenCV)",
  },
  {
    file: "/usr/lib/R/library/grDevices/fonts/Montserrat/static/Montserrat-Medium.ttf",
    family: "Montserrat",
    labelSk: "Montserrat Medium (R balík)",
  },
];

/**
 * Skopíruje nájdené písmo do `targetDir` a vráti cestu pre `fontsdir=`.
 *
 * Prečo kopírovať: libass dostane presne ten adresár, ktorý mu povieme. Nemusí
 * tak závisieť od fontconfig-u prostredia (a v kontajneroch to často nefunguje).
 * Keď sa nič nenájde, vráti `null` — appka potom použije písmo, ktoré má libass
 * sám, a v poznámkach to prizná.
 */
export function prepareCaptionFont(
  targetDir: string,
  preferredFamily?: string,
): CaptionFontLocation | null {
  const ordered = preferredFamily
    ? [
        ...FONT_CANDIDATES.filter((c) => c.family === preferredFamily),
        ...FONT_CANDIDATES.filter((c) => c.family !== preferredFamily),
      ]
    : FONT_CANDIDATES;

  for (const candidate of ordered) {
    if (!existsSync(candidate.file)) continue;
    try {
      mkdirSync(targetDir, { recursive: true });
      const target = path.join(targetDir, path.basename(candidate.file));
      if (!existsSync(target)) copyFileSync(candidate.file, target);
      return {
        fontName: candidate.family,
        fontsDir: targetDir,
        sourceSk: candidate.labelSk,
      };
    } catch {
      // kopírovanie zlyhalo (práva) — skús ďalšieho kandidáta
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Zistenie parametrov videa (bez ffprobe — imageio-ffmpeg ho nemá)
// ---------------------------------------------------------------------------

export interface VideoProbe {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
}

/**
 * Prečíta výstup z `ffmpeg -i súbor` (ffmpeg ho píše na stderr a skončí s kódom 1).
 *
 * Prečo to robíme: rozmery a snímkovú frekvenciu **nesmieme hádať z prehliadača**.
 * ASS sa kreslí v rozmeroch videa a strih+spojenie potrebuje poznať fps zdroja —
 * bez toho ffmpeg spojí úseky v inej snímkovej frekvencii a klip potichu stratí
 * plynulosť (odhalené live testom: 30 fps zdroj → 25 fps výstup, 93 → 78 snímok).
 */
export function parseFfmpegProbe(text: string): VideoProbe {
  const probe: VideoProbe = {
    durationSec: null,
    width: null,
    height: null,
    fps: null,
    hasAudio: false,
    videoCodec: null,
    audioCodec: null,
  };

  const dur = String(text ?? "").match(/Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (dur) {
    probe.durationSec = Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3]);
  }

  for (const line of String(text ?? "").split("\n")) {
    const stream = line.match(/Stream #\d+:\d+.*?:\s*Video:\s*([A-Za-z0-9_]+)[^,]*,\s*[^,]*(?:,\s*)?(\d{2,5})x(\d{2,5})/);
    if (stream && probe.width === null) {
      probe.videoCodec = stream[1];
      probe.width = Number(stream[2]);
      probe.height = Number(stream[3]);
      const fps = line.match(/(\d+(?:\.\d+)?)\s*fps/);
      if (fps) probe.fps = Number(fps[1]);
    }
    if (/Stream #\d+:\d+.*?:\s*Audio:/.test(line)) {
      probe.hasAudio = true;
      const codec = line.match(/Audio:\s*([A-Za-z0-9_]+)/);
      if (codec) probe.audioCodec = codec[1];
    }
  }

  return probe;
}

/** Zistí parametre videa priamo ffmpeg-om. Keď sa nedá, vráti `null`. */
export function probeVideoFile(ffmpegPath: string, filePath: string): VideoProbe | null {
  try {
    const run = spawnSync(ffmpegPath, ["-hide_banner", "-i", filePath], {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const text = `${run.stderr ?? ""}${run.stdout ?? ""}`;
    if (!text.includes("Input #0")) return null;
    return parseFfmpegProbe(text);
  } catch {
    return null;
  }
}
