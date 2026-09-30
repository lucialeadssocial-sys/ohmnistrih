# STYLE STUDIO — KROK 11: REFERENČNÝ OBRÁZOK → MERANÝ ŠTÝL + DESKA ŠTYLU

Záznam merania, nie marketing. Každé číslo vzniklo behom na reálnych pixeloch.

Dátum: 2026-09-30 · main pred týmto PR: `a42beb6` (krok 10)

## Čo tento krok rieši (a čo v ňom bolo zlé predtým)

V appke bola „analýza referenčného obrázka", ktorá štýl určovala **podľa mena súboru**:

```ts
if (nameLower.includes("clean") || nameLower.includes("minimal")) { … }
else if (nameLower.includes("cinematic") || nameLower.includes("dark")) { … }
```

Súbor `cinematic-dark.png` teda „nameral" tmavý filmový štýl, aj keby obsahoval bielu kresbu.
Podľa pravidla **„referenčná analýza bez pixelovej analýzy = NOT AVAILABLE"** to bolo neprijateľné.

Po tomto kroku:
- obrázok sa **naozaj prečíta z pixelov** a zmeria,
- keď pixely nie sú, appka vráti **NOT AVAILABLE** s dôvodom (a nikdy nepoužije meno súboru),
- z obrázka sa **netvrdí** nič, čo sa zmerať nedá (font, tempo, textúra, zvuk) — tie sa **prevezmú
  z receptu** a appka to vypíše,
- k obrázku sa vykreslí **deska štýlu**: referenčná snímka + pruhy nameraných farieb + čísla.
  Žiadne obrázky sa **negenerujú** → `PROVIDER UNAVAILABLE` je napísané priamo v deske.

## Jedna funkcia pre obe cesty

`src/core/style/referencePixels.ts` je **čistá funkcia nad pixelmi** — žiadny DOM, canvas,
server ani provider. Prehliadač jej pošle pixely z canvasu, verifikačný runner z ffmpeg
(`rawvideo → RGBA`). Keby sa cesty rozslišli, runner to ukáže.

**Čo sa meria:** dominantné farby (kvantovaný histogram 32×32×32 + zlučovanie blízkych odtieňov),
jas (luma Rec. 709), kontrast (smerodajná odchýlka), sýtosť, teplota (R − B), podiel
tmavých/stredných/svetlých pixelov, hustota hrán (gradient lumy), jas v troch pásmach.

**Čo sa nemeria (a preto to appka netvrdí):** meno a veľkosť fontu, pohyb/easing/strih,
zvuk, sémantika obsahu.

## Namerané na troch reálnych videách používateľa

Každý klip dal **inú, obsahovo sediacu** paletu — to je dôkaz, že analýza reaguje na obsah,
nie na meno:

| Klip | Paleta (pokrytie) | Zvýraznenie | Jas | Kontrast | Tmavé/svetlé | Hustota hrán |
| --- | --- | --- | --- | --- | --- | --- |
| AI karta (vonku, deň) | #0E0E17 12,9 % · #FAFAFB 9,1 % · **#599CF3 8,8 %** · #393A2D 5,4 % | **#599CF3** (modrá) | 117,68 | 71,75 | 27 % / 15 % | 0,077 |
| Filmová montáž (dráha) | **#B69975 28,7 %** · #27240A 26,8 % · #FEFCFD 7,6 % | **#B69975** (teplá béžová) | 105,34 | 71,89 | 43 % / 9 % | 0,024 |
| Expert (sála) | #110D0B 65,8 % · #503932 17,6 % · **#7D5F55 5,3 %** | **#7D5F55** (hnedá) | 36,66 | 38,97 | 79 % / 0 % | 0,033 |

Popisy, ktoré z toho appka sama napísala:
- AI karta: „stredne tmavý, neutrálna teplota, mierne sýte farby, vysoký kontrast" (0,077 = plnšia kompozícia)
- Filmová montáž: „teplý podtón, sýte farby, vysoký kontrast" (0,024 = pokojná kompozícia)
- Expert: „tmavý editorial, teplý podtón, stredný kontrast", a k tomu: „Podklad je prevažne tmavý (79 %) — svetlé titulky na ňom budú čitateľné bez podkladovej dosky."

Kontrola poctivosti: `cinematic-dark-clean-social.png` **bez pixelov** → **NOT AVAILABLE** (predtým by z toho appka „namerala" filmový štýl).

## Dve chyby, ktoré odhalil až reálny beh (a jedna skúška)

1. **„Najsýtejšia farba" bola skoro-čierna.** Pri sále appka vyhlásila zvýraznenie `#110D0B` (66 % plochy) —
   skoro čierna. Príčina: HSV sýtosť je **relatívna**, takže tmavá farba má vysokú sýtosť, ale v obraze
   nie je vidieť. Oprava: zvýraznenie sa vyberá podľa **absolútnej farebnosti (max − min ≥ 25)** a musí
   mať aj jas ≥ 48. Teraz je zvýraznenie `#7D5F55` — naozaj vidieť.
2. **Paleta plná šumu.** Farby s pokrytím 0,1 % (kompresné artefakty) sa tvárili ako platná paleta.
   Oprava: držia sa len farby s pokrytím ≥ 0,5 % (nikdy menej než tri).
3. **Nezmysel v odporúčaní:** pri jednofarebnom obrázku appka napísala „najtmavšie pásmo hore (245),
   najsvetlejšie dole (245)". Oprava: pásma sa porovnávajú **len keď sa líšia aspoň o 12 jasu**;
   inak appka povie, že z pásiem sa to určiť nedá.

## Čo je hotové, ale ešte NEDOJENÉ do UI

`applyReferencePalette()` a `referencePaletteForRecipe()` (nameraná paleta → existujúci `StyleRecipe`,
bez nového modelu) sú **implementované a otestované**, ale **nie sú napojené na Style Studio panel** —
v UI sa zatiaľ uloží len DNA (`VisualStyleManager`) a zobrazí deska. Preto je to v reporte
**IMPLEMENTED BUT NOT WIRED**, nie „hotové".

## Poctivo: čo ešte NIE je

- **BROWSER VERIFIED: nie** — v prostredí nie je prehliadač. Overená je **tá istá funkcia** cez runner
  (ffmpeg → rovnaký kód), ale cesta `createImageBitmap → canvas → getImageData` v prehliadači
  overená nie je: **UI PRESENT — FUNCTIONALITY NOT VERIFIED**.
- **Snímka z videa nie je dizajnérska predloha** — je to reálny obraz z reálneho videa. V reporte je to tak pomenované.
- **Rám sa pri analýze dopĺňa čiernymi pruhmi** (na tomto médiu 0–2 px), aby sedel pomer strán;
  tie pixely sa do štatistiky počítajú (vplyv je zanedbateľný, ale je to tak).
- **Nameraná paleta** ešte neovplyvňuje export (viď „NEDOJENÉ DO UI" vyššie).
- Analýza je **štatistická** — pri veľmi malom obrázku (pod ~50 px) sú čísla hrubšie.

## Ako si to zopakuješ

```bash
# reálne pixely z referenčného videa (snímka v 40. sekunde)
bun run tools/verify-reference-image.ts /home/user/referencie/ref-DXtdqsbAtEG.mp4 --at 40 \
    --out /home/user/referencia-deska-stylu.png
bun test tests/referencePixels.test.ts
```
