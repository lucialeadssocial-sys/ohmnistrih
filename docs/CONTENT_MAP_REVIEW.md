# Krok 3 — Content Map review: Odporúčané / Nepoužité / WHY NOT

## Cieľ

Doplniť nad existujúcu `ContentMap` prehľad, v ktorom možno odfiltrovať odporúčané pasáže,
nepoužité médiá a dôvody „WHY NOT“. Nezakladať druhý Director, editor, timeline ani model projektu.

## Reality Gate pred zmenou

| Oblasť | Stav pred krokom | Dôkaz / hranica |
|---|---|---|
| Content Map + roly OPEN/BODY/PRODUCT/PROOF/END/OMIT | YES | `src/core/media/contentMap.ts` |
| WHY NOT dôvody pri vyradených pasážach | YES | `whySk` + `whyNotList()` |
| Súhrnná karta v Media Intelligence Inspector | YES | `src/components/MediaIntelligenceInspector.tsx` |
| Samostatný prehľad s filtrami | NO | predtým iba krátka ukážka 6 WHY NOT riadkov |
| Skutočné použitie v canonical timeline | NO | Content Map je read-only; nič sa nesmie vydávať za aplikované |
| Browser overenie | UNKNOWN | SSR a testy samy osebe nedokazujú kliknutia v prehliadači |

## Čo pribudlo

- Nový tab **Content Map / WHY NOT** v existujúcom Media Intelligence Inspector.
- Tabuľkový prehľad: Source, obsah a čas, relatívna relevance, navrhovaná rola, WHY/WHY NOT.
- Filtre:
  - všetky položky;
  - odporúčané pasáže (roly okrem OMIT);
  - médiá bez použiteľnej pasáže;
  - WHY NOT (vyradené pasáže a médiá bez textu);
  - rola/stav dát, vyhľadávanie podľa zdroja/textu/dôvodu;
  - v WHY NOT: opakovanie, slabá pointa alebo chýbajúci prepis/titulky.
- Výsledky sa zobrazujú po 40 položkách; ďalšie sa načítajú až po kliknutí.
- Médium bez tituliek je **NEMÁ DÁTA / neposúdené**, nie „slabý obsah“. Časy sa zobrazia iba ak sú v mape; inak UI povie, že ich nemožno určiť.
- Zmena zvoleného cieľa neprepočítava mapu automaticky. Nový cieľ sa použije až po kliknutí na výpočet.
- Chyba výpočtu sa zobrazí v UI. Ak už existovala mapa pre predchádzajúci cieľ, zostáva zobrazená a označená ako staršia.

## Dôležité: návrh nie je aplikovaný strih

Text v UI výslovne hovorí, že Content Map je **návrh**. Krok nemení `EditDecision[]`,
`CommandManager`, snapshot, rollback ani canonical timeline; neprehlasuje odporúčané pasáže za
reálne použité v zostrihu. Apply a prenos výberu do timeline zostávajú mimo tohto kroku.

## Reality Gate po zmene

| Oblasť | Code Exists | Wired | UI | Interactive | Real Data | Runtime | Reusable |
|---|---|---|---|---|---|---|---|
| Content Map filter logic | YES | YES | YES | PARTIAL | PARTIAL | YES | YES |
| WHY NOT role/reason/search filters | YES | YES | YES | PARTIAL | PARTIAL | YES | YES |
| NEMÁ DÁTA rows | YES | YES | YES | PARTIAL | PARTIAL | YES | YES |
| Apply to canonical timeline | NO | NO | NO | NO | NO | NO | NO |

**Interactive = PARTIAL** znamená: čistá filter logika je unit-testovaná a ovládače sú zapojené
v Reacte; používateľské kliknutia v reálnom prehliadači ešte neboli overené.

## Testy a hranice dôkazov

- `tests/contentMapReview.test.tsx`: **9 pass / 0 fail, 32 assertions**; unit testy pre status, rolu,
  príčinu a textové filtre; SSR pre tabuľku, prázdny stav, chybu a upozornenie „nič nebolo aplikované“.
- Full `bun test`: **893 pass / 13 skipped / 0 fail** (906 testov, 41 súborov, 4 237 assertions).
- `bun run lint`: TypeScript 0 chýb. `bun run build`: exit 0; upozornenia Vite na `__dirname`, veľké
  chunky a ineffective dynamic import zostávajú.
- Dev server v tomto behu vrátil HTTP 200 na `/`; Vite servoval oba zmenené UI moduly s HTTP 200.
- **BROWSER VERIFIED: NOT VERIFIED.**
- **REAL 30-VIDEO PROJECT VERIFIED: NOT VERIFIED.** Test fixture je syntetická; existujúci dôkaz Content Mapu
  (krok 2) používal 12 popisov videí a jeden reálny word-level prepis, nie 30 plných transcriptov.
- **REAL EXPORT VERIFIED: NOT VERIFIED for this screen.** Obrazovka je read-only a nespúšťa export.
