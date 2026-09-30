/**
 * KROK 29 — DÔKAZ: „appka nesmie tvrdiť, čo nemá zmerané“.
 *
 * Tento runner prehľadá kód a povie, či sa doň nevrátili zakázané vzory:
 *   • simulácie, ktoré nastavujú všetko na PASS,
 *   • vymyslené čísla prezentované ako výsledok (742 s, -14 LUFS, 5.8x…),
 *   • `Math.random()` v meracích/analytických paneloch,
 *   • nedeterministické `Date.now()` v plánoch,
 *   • fake zdroje v knowledge base.
 *
 * Je to zároveň **trvalá ochrana** — test `tests/honesty.test.ts` ho zdvojuje
 * na úrovni CI (UNIT TESTED), tento runner dáva čitateľný report pre človeka.
 *
 * Spustenie: bun run tools/verify-honesty.ts
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", "__pycache__", ".cache", ".bun"]);

interface Rule {
  id: string;
  whySk: string;
  /** Súbory, na ktoré sa pravidlo vzťahuje (relatívne cesty alebo koncovky). */
  scope: (rel: string) => boolean;
  /** Zakázaný vzor v KÓDE (komentáre sa pred skenovaním odstránia). */
  forbidden: RegExp;
  /** Povolené výnimky (napr. samotné vysvetlenie histórie je v poriadku). */
  allow?: (line: string) => boolean;
}

const RULES: Rule[] = [
  {
    id: "NO_FAKE_PASS",
    whySk: "Kontrola kvality nesmie nastaviť PASS bez merania (bola tu simulácia „stress test“).",
    scope: (rel) => rel === "src/components/QualityControlAndAnalytics.tsx" || rel === "src/data/qcGateChecksData.ts",
    // Iba PRIHRADENIE (priradenie hodnoty), nie typový zväzok `status: "PASS" | …`.
    forbidden: /status:\s*["']PASS["']\s*(,|as\s+const)/,
  },
  {
    id: "NO_FAKE_CLAIMS",
    whySk: "Zakázané tvrdenia, ktoré sa vydávali za meranie (stress test, bitstream, vymyslené hodnoty).",
    scope: (rel) => rel.startsWith("src/"),
    forbidden: /STRESS TEST VERIFIED|Real WebM bitstream|Hook Score:\s*\d|Reach Multiplier/i,
  },
  {
    id: "NO_RANDOM_IN_MEASUREMENT",
    whySk: "Meranie a prehľady musia byť deterministické (bola tu krivka cez Math.random()).",
    scope: (rel) =>
      rel.endsWith("RetentionSimulator.tsx") ||
      rel.endsWith("ContentGraphStudio.tsx") ||
      rel.endsWith("qcMeasure.ts"),
    forbidden: /Math\.random\(/,
  },
  {
    id: "NO_TIME_IN_PLAN",
    whySk: "Director plán nesmie byť nedeterministický (bol tu createdAt: Date.now()).",
    scope: (rel) => rel.endsWith("directorEngine.ts"),
    forbidden: /createdAt:\s*Date\.now\(\)/,
  },
  {
    id: "NO_FAKE_KNOWLEDGE",
    whySk: "Knowledge base nesmie obsahovať zdroje, ktoré v repozitári neexistujú.",
    scope: (rel) => rel.endsWith("knowledgeBase.ts"),
    forbidden: /OmniStrih SK Content Intelligence Data 2026/,
  },
  {
    id: "NO_FAKE_GENERATION",
    whySk: "Generovanie obsahu (Content Pack, A/B) sa nesmie predstierať.",
    scope: (rel) => rel === "src/App.tsx",
    forbidden: /contentPack,\s*isGenerated:\s*true|AI vyťahuje virálne momenty|AI simuluje správanie diváka/,
  },
];

/** Odstráni komentáre — aby pravidlá nepadali na histórii vysvetlenej v komentári. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const files = walk(REPO).map((f) => relative(REPO, f).replace(/\\/g, "/")).filter((f) => !f.startsWith("tests/") === true ? true : true);

const results: { rule: string; file: string; line: number; text: string }[] = [];
let scanned = 0;

for (const rel of files) {
  // Testy nie sú cieľom (obsahujú zakázané reťazce ako očakávané hodnoty).
  if (rel.startsWith("tests/") || rel.startsWith("tools/")) continue;
  for (const rule of RULES) {
    if (!rule.scope(rel)) continue;
    scanned += 1;
    const src = stripComments(readFileSync(join(REPO, rel), "utf8"));
    const lines = src.split("\n");
    lines.forEach((line, idx) => {
      if (rule.allow && rule.allow(line)) return;
      rule.forbidden.lastIndex = 0;
      if (rule.forbidden.test(line)) {
        results.push({ rule: rule.id, file: rel, line: idx + 1, text: line.trim().slice(0, 160) });
      }
    });
  }
}

const lines: string[] = [];
lines.push("=== OMNISTRIH — DÔKAZ POCTIVOSTI (krok 29) ===");
lines.push(`Skenovaných kombinácií súbor×pravidlo: ${scanned}`);
lines.push(`Nájdené porušenia: ${results.length}`);
for (const rule of RULES) {
  const hits = results.filter((r) => r.rule === rule.id);
  lines.push("");
  lines.push(`[${hits.length === 0 ? "OK" : "FAIL"}] ${rule.id} — ${rule.whySk}`);
  for (const h of hits) lines.push(`      ${h.file}:${h.line}  ${h.text}`);
}
lines.push("");
lines.push(results.length === 0 ? "VÝSLEDOK: PASS — v kóde nie sú zakázané vzory." : "VÝSLEDOK: FAIL — nájdené vzory treba odstrániť.");
lines.push("Poznámka: tento test číta kód. Neoveruje správanie v prehliadači (to vie len používateľ).");

const report = lines.join("\n");
console.log(report);
writeFileSync(join(REPO, "docs", "proof-honesty.txt"), report + "\n", "utf8");
process.exit(results.length === 0 ? 0 : 1);
