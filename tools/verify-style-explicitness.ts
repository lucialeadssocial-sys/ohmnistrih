/**
 * Krok 15 — kontrola štýlu na reálnych nameraných dátach.
 *
 * Pýta sa jeho otázku: „Keď AI nepovieš, aké má byť svetlo, kompozícia, farby alebo
 * celkový štýl, musí si to všetko nejako domyslieť." Preto prejde všetky recepty
 * a povie, ktoré piliere sú podložené (tvoje / meranie / recept) a ktoré by si model
 * domyslel.
 *
 * Čísla berie z reálnych meraní v `/home/user/referencie/` (mediány cez jeho videá).
 * Keď meranie na disku nie je, appka to napíše a beží ďalej — nič nepredstiera.
 *
 * Spustenie:
 *   bun run tools/verify-style-explicitness.ts
 *   bun run tools/verify-style-explicitness.ts --recipe EDU_WORD_TALK
 *   bun run tools/verify-style-explicitness.ts --out docs/style-explicitness-output.txt
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  auditStyleExplicitness,
  describeControlChangeSk,
  explicitnessLineSk,
  type MeasuredLight,
} from "../src/core/style/styleExplicitness";
import { STYLE_PRESET_IDS, getStyleRecipe } from "../src/core/style/styleRecipes";

const args = process.argv.slice(2);
function argValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
}

const outPath = argValue("--out");
const onlyRecipe = argValue("--recipe");

const lines: string[] = [];
function say(s = ""): void {
  lines.push(s);
  console.log(s);
}

const MERANIA = [
  { subor: "/home/user/referencie/analyza-videa.json", popisSk: "6 jeho IG klipov (krok 12)" },
  { subor: "/home/user/referencie/analyza-tiktok.json", popisSk: "12 jeho tiktokov (krok 13)" },
];

interface Meranie {
  subor: string;
  popisSk: string;
  svetlo?: MeasuredLight;
  paleta?: string[];
  poznamkaKPaleteSk?: string;
}

function nacitaj(spec: { subor: string; popisSk: string }): Meranie {
  if (!existsSync(spec.subor)) {
    say(`  ! ${spec.subor} NEEXISTUJE → pre tento zdroj neuvádzam žiadne čísla.`);
    return { subor: spec.subor, popisSk: spec.popisSk };
  }
  const data = JSON.parse(readFileSync(spec.subor, "utf8")) as Record<string, unknown>;
  const suhrn = (data["_suhrn"] ?? {}) as Record<string, unknown>;
  const jas = Number(suhrn["median_jas"]);
  const kontrast = Number(suhrn["median_kontrast"]);
  const stala = Array.isArray(suhrn["stala_paleta"]) ? (suhrn["stala_paleta"] as string[]) : [];
  const obcasna = Array.isArray(suhrn["obcasna_paleta"]) ? (suhrn["obcasna_paleta"] as string[]) : [];
  // Paleta sa v jeho klipoch NEopakuje (krok 12) → beriem najčastejšie odtiene a poviem to.
  const zdrojPalety = stala.length >= 2 ? stala : obcasna;
  const paleta = zdrojPalety
    .map((s) => String(s).split(" ")[0])
    .filter((s) => /^#[0-9A-Fa-f]{6}$/.test(s));
  const poznamka =
    stala.length >= 2
      ? `Paleta sa opakuje vo väčšine videí (${stala.length} odtieňov).`
      : paleta.length >= 2
        ? "Paleta sa medzi klipmi NEopakuje — to sú najčastejšie odtiene, každý len v menšine videí."
        : undefined;
  const s: Meranie = { subor: spec.subor, popisSk: spec.popisSk };
  if (Number.isFinite(jas) && Number.isFinite(kontrast)) {
    s.svetlo = {
      brightness: jas,
      contrast: kontrast,
      sourceSk: `${spec.subor.split("/").pop()}, medián cez ${String(suhrn["pocet_videi"] ?? "?")} videí — ${spec.popisSk}`,
    };
  }
  if (paleta.length >= 2) s.paleta = paleta;
  if (poznamka) s.poznamkaKPaleteSk = poznamka;
  return s;
}

say("=".repeat(100));
say("KROK 15 — „nič nenechaj modelu na domyslenie“ (jeho pravidlo z tiktoku 7673961257115979030)");
say("=".repeat(100));
say();
say("Jeho veta: „Keď AI nepovieš, aké má byť svetlo, kompozícia, farby alebo celkový štýl,");
say("musí si to všetko nejako domyslieť… čím viac rozhodnutí necháš na AI, tým viac sa");
say("prikloní k tomu najpravdepodobnejšiemu. A to najpravdepodobnejšie býva často aj to");
say("najgenerickejšie.“");
say();
say("Čo robí tento nástroj: pýta sa presne na tie štyri piliere a hovorí, čo je podložené");
say("(tvoje nastavenie / meranie / recept) a čo by si model domyslel. Nič nemeria nanovo");
say("a nič negeneruje — číta existujúce recepty a existujúce merania.");
say();

// ---------------------------------------------------------------------------
// 1) Reálne merania
// ---------------------------------------------------------------------------

say("1) REÁLNE MERANIA NA DISKU");
const merania = MERANIA.map(nacitaj);
for (const m of merania) {
  say(`   ${m.subor}`);
  if (m.svetlo) {
    say(`     svetlo: jas ${m.svetlo.brightness.toFixed(2).replace(".", ",")} / kontrast ${m.svetlo.contrast.toFixed(2).replace(".", ",")}`);
  } else {
    say("     svetlo: NEDOSTUPNÉ v tomto súbore");
  }
  say(m.paleta ? `     paleta: ${m.paleta.slice(0, 6).join(", ")}${m.paleta.length > 6 ? " …" : ""}` : "     paleta: NEDOSTUPNÁ");
  if (m.poznamkaKPaleteSk) say(`     poznámka: ${m.poznamkaKPaleteSk}`);
}
say();

// ---------------------------------------------------------------------------
// 2) Všetky recepty bez akéhokoľvek merania
// ---------------------------------------------------------------------------

say("2) VŠETKY RECEPTY BEZ TVOJHO MERANIA (čo appka vie sama)");
say();
const hlavicka = "recept".padEnd(22) + "podložené".padEnd(11) + "otvorené".padEnd(10) + "čo by si model domyslel";
say(hlavicka);
say("-".repeat(100));

const bezMerania: { id: string; covered: number; open: string[] }[] = [];
for (const id of STYLE_PRESET_IDS) {
  if (onlyRecipe && id !== onlyRecipe) continue;
  const r = auditStyleExplicitness({ recipe: id });
  bezMerania.push({ id, covered: r.coveredCount, open: r.openToModelSk.map((s) => s.split(" — ")[0]) });
  say(id.padEnd(22) + `${r.coveredCount}/4`.padEnd(11) + String(r.openCount).padEnd(10) + (r.openToModelSk.map((s) => s.split(" — ")[0]).join(", ") || "—"));
}
say();
const soSvetlom = bezMerania.filter((r) => r.covered === 4).length;
const bezSvetla = bezMerania.filter((r) => r.covered === 3 && r.open.includes("svetlo")).length;
say(`Súhrn: ${soSvetlom} z ${bezMerania.length} receptov má podložené všetky 4 piliere;`);
say(`       ${bezSvetla} z ${bezMerania.length} má svetlo NEPODLOŽENÉ (recept ho neuvádza ako číslo a ty si nič nezmeral).`);
say("Toto nie je chyba appky — je to presne to, pred čím on varuje: čo nie je pomenované,");
say("to si model domyslí. Preto to appka píše do plánu (viď bod 4).");
say();

// ---------------------------------------------------------------------------
// 3) Keď k receptu priložíš reálne meranie
// ---------------------------------------------------------------------------

say("3) DVE REÁLNE REFERENCIE VEDĽA SEBA (svetlo nesie recept aj meranie)");
say();
for (const id of ["AI_CINEMATIC_TAKE", "EDU_WORD_TALK"] as const) {
  if (onlyRecipe && id !== onlyRecipe) continue;
  const r = auditStyleExplicitness({ recipe: id });
  say(`${id} (${getStyleRecipe(id).labelSk}):`);
  for (const p of r.pillars) {
    say(`   • ${p.labelSk.padEnd(15)} ${p.originSk.padEnd(34)} ${p.valueSk}`);
  }
  say(`   verdikt: ${r.verdictSk}`);
  say();
}
if (!onlyRecipe) {
  const a = merania[0];
  const b = merania[1];
  say("Jeho dve skupiny videí majú INÉ svetlo, a appka to nezlieva do jedného čísla:");
  say(`   IG klipy (krok 12)  : ${a.svetlo ? `jas ${a.svetlo.brightness.toFixed(2).replace(".", ",")}` : "NEDOSTUPNÉ"}`);
  say(`   TikToky (krok 13)   : ${b.svetlo ? `jas ${b.svetlo.brightness.toFixed(2).replace(".", ",")}` : "NEDOSTUPNÉ"} — svetlejšie prostredie`);
  const vlastne = auditStyleExplicitness({
    recipe: "AI_CINEMATIC_TAKE",
    measuredLight: { ...b.svetlo!, sourceSk: "vlastná referencia — analyza-tiktok.json" },
    measuredPalette: b.paleta,
  });
  const svetloPilier = vlastne.pillars.find((p) => p.id === "svetlo");
  say("Keď dáš receptu inú referenciu, číslo sa zmení a appka vždy povie, odkiaľ je:");
  say(`   → ${svetloPilier ? svetloPilier.valueSk : "—"}`);
  say();
}

// ---------------------------------------------------------------------------
// 4) Ako to vyzerá v pláne
// ---------------------------------------------------------------------------

say("4) ČO APPKA NAPÍŠE DO PLÁNU (nič sa nedeje ticho)");
say();
for (const id of onlyRecipe ? [onlyRecipe] : ["EDITORIAL_COLLAGE", "AI_CINEMATIC_TAKE"]) {
  const r = auditStyleExplicitness({ recipe: id });
  say(`   ${id}: ${explicitnessLineSk(r)}`);
  for (const gap of r.closeGapsSk) say(`      chýba → ${gap}`);
  for (const fill of r.appFillsSk) say(`      appka doplní → ${fill}`);
}
say();

// ---------------------------------------------------------------------------
// 5) Jeho druhá metóda: „stačí zmeniť riadok v kóde"
// ---------------------------------------------------------------------------

say("5) „STAČÍ ZMENIŤ RIADOK V KÓDE“ (jeho druhá metóda, tiktok 7690550368333499650)");
say();
const jedna = describeControlChangeSk(
  { intensity: "balanced", motion: "calm", texture: "editorial" },
  { intensity: "balanced", motion: "dynamic", texture: "editorial" },
);
say(`   ${jedna.noteSk}`);
say(`   zmenené: ${jedna.changedSk.join("; ")}`);
say("   V appke to znamená: mení sa jedna vec, zvyšok ostáva — nič sa negeneruje nanovo.");
say("   (Testy overujú, že sa naozaj nič iné nemení.)");
say();

// ---------------------------------------------------------------------------
// 6) Poctivosť
// ---------------------------------------------------------------------------

say("6) POCTIVOSŤ — ČO TENTO NÁSTROJ NEROBÍ");
say("   • Negeneruje obrázky ani video — appka nemá providera (PROVIDER UNAVAILABLE).");
say("   • Nepredpovedá, ako bude výsledok vyzerať — len hovorí, čo je pomenované a čo nie.");
say("   • Nemerá scénu v tvojom videu — na to treba tvoje médium (to je iný krok).\n   • Namerané svetlo je zatiaľ len ČÍSLO PRE ZADANIE (do AI nástroja mimo appky); appka\n     ním svoj vlastný render nemení — to je priznané, nie zamlčané (IMPLEMENTED, NOT WIRED TO RENDER).");
say("   • „Podložený pilier“ neznamená, že výstup bude dobrý — len že nie je na domyslenie.");
say("   • Recepty, ktoré nemajú namerané svetlo, ho NEMAJÚ — appka to nepredstiera.");
say();

const text = lines.join("\n") + "\n";
if (outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, text, "utf8");
  console.log(`(zapísané do ${outPath})`);
}
