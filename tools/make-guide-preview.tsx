/**
 * KROK 19 — vygeneruje statickú ukážku Sprievodcu do /home/user/ukazka-krok19-sprievodca.html.
 *
 * Je to naozaj výstup našich komponentov (server-side render), nie ručne písané HTML —
 * takže to, čo user vidí v ukážke, je to isté, čo appka zobrazuje v Sprievodcovi.
 *
 * Spustenie: bun run tools/make-guide-preview.tsx
 */
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { GuideModal } from "../src/components/ToolGuide";
import { FLOW_STEPS, TOOL_GUIDES, SIMPLE_MODE_TABS } from "../src/ui/toolGuides";

const inner = renderToStaticMarkup(<GuideModal open language="sk" onClose={() => {}} onGoToTool={() => {}} />);
const simple = TOOL_GUIDES.filter((g) => SIMPLE_MODE_TABS.includes(g.id)).map((g) => g.title);
const expert = TOOL_GUIDES.filter((g) => g.expert).length;
const legacy = TOOL_GUIDES.filter((g) => g.legacy).length;

const html = `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>OmniStrih — krok 19: Sprievodca appkou (výučba popri práci)</title></head>
<body style="margin:0;background:#0a0a0a;color:#e5e5e5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
<div style="max-width:900px;margin:0 auto;padding:26px 18px 60px">
  <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#fb7185">OmniStrih · krok 19</div>
  <h1 style="margin:6px 0 8px;font-size:27px">Jednoduchšie rozhranie + výučba popri práci</h1>
  <p style="margin:0 0 18px;color:#a3a3a3;line-height:1.6">
    Presne toto uvidíš v appke: <b style="color:#fff">${TOOL_GUIDES.length} nástrojov</b>, každý s vysvetlením
    <b style="color:#fff">čo to robí</b>, <b style="color:#fff">kedy sa to hodí</b>, <b style="color:#fff">čo potrebuješ mať</b> a <b style="color:#fff">ako na to</b>.
    Nič sa nedá stratí — všetky pôvodné funkcie ostávajú, len pribudla výučba a krokový pás.
  </p>

  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
    <div style="flex:1;min-width:150px;background:#141414;border:1px solid #262626;border-radius:14px;padding:12px">
      <div style="font-size:22px;font-weight:900;color:#fb7185">${TOOL_GUIDES.length}</div>
      <div style="font-size:12px;color:#a3a3a3">nástrojov s výučbou (každý v appke)</div></div>
    <div style="flex:1;min-width:150px;background:#141414;border:1px solid #262626;border-radius:14px;padding:12px">
      <div style="font-size:22px;font-weight:900;color:#fb7185">5</div>
      <div style="font-size:12px;color:#a3a3a3">krokov: nahraj → prečítaj → štýl → skontroluj → exportuj</div></div>
    <div style="flex:1;min-width:150px;background:#141414;border:1px solid #262626;border-radius:14px;padding:12px">
      <div style="font-size:22px;font-weight:900;color:#fb7185">${simple.length}</div>
      <div style="font-size:12px;color:#a3a3a3">nástrojov ti stačí na bežné video; ostatné ${expert} sú „expert“ (ostávajú dostupné)</div></div>
  </div>

  <div style="background:#141414;border:1px solid #262626;border-radius:16px;padding:6px">
    <style>
      [data-testid="guide-modal"]{position:static!important;display:block!important;background:transparent!important;padding:0!important;backdrop-filter:none!important}
      [data-testid="guide-modal"] > div{box-shadow:none!important;max-width:100%!important;margin:0!important;border:none!important;background:transparent!important}
      [data-testid="guide-modal"] .max-h-\\[70vh\\]{max-height:none!important}
      [data-testid="guide-modal"] input{pointer-events:none}
    </style>
    ${inner}
  </div>

  <p style="margin:22px 0 0;font-size:12px;color:#737373;line-height:1.7">
    Ako to overiť sám: <code style="background:#1a1a1a;padding:2px 5px;border-radius:5px">bun test tests/toolGuides.test.tsx</code> — 17 testov, ktoré okrem iného kontrolujú,
    že <b>naozaj každý nástroj z App.tsx</b> má svoje vysvetlenie (kedysi pribudne nástroj bez textu, test spadne).<br>
    Priznané obmedzenia: texty sú zatiaľ len po slovensky (v angličtine to appka prizná); vzhľad a klikanie v prehliadači
    som v tomto prostredí nemohol overiť (nie je tu DOM) — overené je vykreslenie (server-side) a testy.
  </p>
</div></body></html>`;
writeFileSync("/home/user/ukazka-krok19-sprievodca.html", html);
console.log("ukazka:", html.length, "znakov");
