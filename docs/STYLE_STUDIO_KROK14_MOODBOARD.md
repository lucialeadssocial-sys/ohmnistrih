# Krok 14 — jeho zverejnený postup + meranie grid/moodboard referencie

**Zadanie (user):** „Pozeraj aj ďalej od neho na TikToku alebo nájdi od neho viac videí alebo postupov, ak má.“

**Výsledok:** našiel som **jeho vlastný, zverejnený postup** (v popisoch videí a v rozhovoroch),
vytiahol som z neho to, čo sa dá overiť, a postavil som na ňom **meranie grid/moodboard referencie**
(`src/core/style/referenceGrid.ts` + runner `tools/verify-moodboard.ts`).

---

## 1. Jeho postup — jeho vlastnými slovami

### a) Najprv grid/moodboard, potom video (jeho kľúčová rada)

> „🎬 Chceš mať väčšiu kontrolu nad AI videom a zároveň nemíňať zbytočne kredity? **Vygeneruj si najskôr
> jeden obrázok ako grid / moodboard**, do ktorého dáš všetko, čo AI potrebuje vedieť o tvojej scéne.
> Ten potom použiješ **ako referenciu pri generovaní AI videa**. Model tak nemusí iba hádať z textového
> promptu… Výsledok? Väčšia konzistentnosť medzi zábermi, menej náhodných rozhodnutí AI…
> **Nie vždy potrebuješ lepší prompt. Niekedy potrebuješ lepšiu referenciu.**“
> — popis jeho videa `7680609867467345174` (TikTok, 719 videní)

### b) Do referencie sa dá aj kresliť a písať

> „Je mnoho spôsobov ako dostať lepšiu kontrolu nad výstupom z Ai. Jeden z takých je **nie len používanie
> referencií, ale priame kreslenie a písanie v nich**, ako je napríklad toto video.“
> — popis jeho videa `7678009554033970454` (TikTok, 28 000 videní)

V tom videu je vidieť aj **ako to vyzerá**: hore hotové AI klipy, dole skicový storyboard
a v ňom **červený rámik**, ktorý sa posúva medzi panelmi — teda kreslená poznámka „túto časť použi“.

### c) Jeho nástroje a práca s promptom

- nástroje: „**Najmä ChatGPT**… Používam aj online platformy, ktoré kombinujú viacero nástrojov v jednom…
- Takéto riešenie ponúka **Freepik**, kde je všetko v jednom balíku.“ (rozhovor, Sóda O2, 18. 9. 2025)
- prompt: „kľúčové sú **špecifickosť a jasnosť**… definovať si cieľ, poskytnúť kontext, povedať, aby sa
  zhostil nejakej **role alebo profesie**, či v prípade komplexných výziev ich **rozdeliť na jednotlivé časti**“
  (rozhovor, StartItUp, 8. 3. 2024)
- animácia bez video modelu: „Toto celé trvalo 15 minút a **nie je to žiaden video model, je to čistý kód**…
  ak chceš niečo zmeniť, nemusíš všetko generovať nanovo ako pri videu, ale stačí, aby AI **zmenilo riadok v kóde**“
  — popis videa `7690550368333499650`

### d) Čo sa z postupu **nedá** získať

- **Jeho Masterclass je za prihlásením** (e-mail + heslo) → obsah som nečítal a **nemôžem ho použiť**.
- Návody a prompty posiela **súkromne** („komentuj Bratislava a pošlem ti návod a prompty“) — nie sú verejné.
- **Threads** (`threads.com/@ai_ktivista`) — profil existuje, ale texty sa načítavajú cez JS a získať sa nedali.
- **YouTube** — kanál má vo feede len 3 videá (Mortal Kombat Slovakia, Fico vs Komár, dôchodci),
  stránka kanála titulky nevydala (JS). Viac videí než 12 z TikToku a 12 z Instagramu sa z tohto
  prostredia nedá získať — **nerobím preto záver o celom účte**.

---

## 2. Čo z toho appka naozaj vie (a čo je nové v tomto kroku)

Jeho postup má jednu vetu, ktorú appka vedela len na polovicu:

| jeho krok | appka pred krokom 14 | po kroku 14 |
|---|---|---|
| „vygeneruj si **grid / moodboard**“ | krok 11 zmeral referenciu ako **jeden obrázok** | **zmeria každý panel zvlášť** (`analyzeMoodboard`) |
| „použi ju ako referenciu“ | merané hodnoty → recept → canonical os | to isté (bez zmeny) |
| „kresli a píš do referencie“ | appka kreslené poznámky **nečíta** (číta pixely) | **stále nečíta** — priznané nižšie |

### Nové: `src/core/style/referenceGrid.ts`

Čisté funkcie (bez DOM, bez ffmpeg, bez servera), všetko merané z pixelov:

- `rowAndColumnLuma` — priemerná luma každého riadku a stĺpca,
- `findGutterBands` — nájde medzery: index je medzera, ak je **výrazne tmavší než jeho okolie**
  (`≤ 0,5 × lokálny medián`) alebo úplne čierny; hrubé pásy sa zahadzujú (tmavý panel nie je medzera),
- `bandIsFlat` — medzera musí byť **jednofarebná plocha** (tmavý pruh vo filme nie je),
- `bandsLookConsistent` / `segmentsLookRegular` — medzery musia byť rovnako hrubé a panely rovnako veľké,
- `contentSegments` — panely sú obsah **medzi** medzerami (medzera do panelu nepatrí),
- `analyzeMoodboard` — zmeria každý panel tou istou funkciou ako krok 11; vráti `modeSk`
  (ako sa panely určili), `gutterShare`, priemer a **poznámky** (napr. že priemer neopisuje ani jednu scénu),
- `panelPaletteSpread` — farba + v koľkých paneloch sa objavila.

### Ako sa vyberá rozdelenie (a prečo je to takto napísané)

Appka zostaví možné rozdelenia (len stĺpce / len riadky / oboje), overí pravidelnosť a vyberie:

1. to, ktoré **najlepšie sedí na očakávaný pomer strán** panelu (`preferAspect` — napr. 9:16 cieľového videa),
2. bez očakávania to, ktoré dáva panely najbližšie k štvorcu (moodboard býva mriežka),
3. a keď ani najlepšia možnosť nesedí (pomer mimo ±40 %), **vráti `null`** — appka potom napíše,
   že grid sa nedá určiť, a vyzve zadať riadky/stĺpce. Radšej otázka než vymyslené panely.

---

## 3. Tri skutočné chyby, ktoré odhalili testy (nie oko)

1. **Vzorkovanie „každý druhý pixel“** v `rowAndColumnLuma` nechávalo nepárne stĺpce ako nuly →
   vyzerali ako čierna medzera 36 px a panely sa zlúčili. Riešenie: meria sa každý pixel.
2. **Rez v strede medzery** — panely obsahovali polovicu čierneho pruhu, takže ich šírka aj jas boli zlé
   (`264×60 jas 49` namiesto `254×480 jas 46`). Riešenie: `contentSegments` (medzera sa vynecháva).
3. **Ternárny výraz so zlými zátvorkami**: `"text" + spread >= 25 ? A : B` sa vyhodnotil ako
   `("text" + spread) >= 25` → vždy `B`. Pri rozdiele jasu 240 appka tvrdila, že panely „držia pri sebe“.

A jedna chyba, ktorú odhalil **reálny beh** (nie test): auto-detekcia vrátila na jeho nočných záberoch
**8 panelov namiesto 4** — tmavý pruh v scéne (obzor/most) prechádza všetkými panelmi a vyzerá ako medzera.
Riešenie: jednofarebnosť pásu + výber rozdelenia podľa pomeru strán (vyššie).

---

## 4. Reálne overenie

```
bun run tools/verify-moodboard.ts /home/user/referencie/aikt-DcdveR6u5Ow.mp4 \
  --at 2,8,14,20 --out /home/user/kontrola-krok14-moodboard.png
```

Runner vezme **jeho reálne video**, vytiahne 4 snímky, poskladá z nich **1×4 grid s čiernymi medzerami**
(presne ten typ referencie, aký jeho postup popisuje) a zmeria panely tou istou funkciou, akú používa appka.

**Výsledok** (`docs/moodboard-verify-output.txt`):

- panely nájdené **samo, bez zadania**: **4** — „vybrané rozdelenie najlepšie sedí na pomer strán 0,56“,
- podiel medzier na ploche: 0,104,
- panely: `254×480 jas 46 · kontrast 61`, `238×480 jas 37 · kontrast 50`, `238×480 jas 47 · kontrast 54`,
  `254×480 jas 41 · kontrast 58`,
- priemer cez panely: jas 42,9 · kontrast 55,8; poznámka appky: „Panely sa v jase líšia o 10 úrovní (37–47).
  Držia sa pri sebe, takže priemer dáva zmysel.“
- protokol obsahuje aj vetu: **„grid som poskladal ja z jeho reálnych snímok; jeho vlastný moodboard nemám“**.

---

## 5. Poctivo: čo to NIE je

- **Nie je to jeho moodboard.** Jeho referenčný obrázok nemám — grid som poskladal z jeho snímok a je to
  v každom výstupe napísané.
- **Kreslené poznámky v referencii appka nečíta.** Jeho technika „kresli a píš do referencie“ znamená,
  že v obrázku je napr. červený rámik. Appka dnes vidí pixely, ale **nerozpozná, že červený rámik je pokyn** —
  vyhodnotí ho ako farbu v obraze. Toto je **overená medzera**, nie hotová vec.
- **UI nie je napojené**: `analyzeMoodboard` je hotová a otestovaná funkcia a runner ju reálne používa,
  ale panel v appke zatiaľ ponúka len meranie jednej referencie (krok 11) → **IMPLEMENTED BUT NOT WIRED**;
  cesta `createImageBitmap → canvas → panely` v prehliadači nie je overená (**UI PRESENT — FUNCTIONALITY NOT VERIFIED**).
- **Appka obrázky ani video negeneruje** — jeho postup generovanie gridu predpokladá; appka vie grid len
  **zmerať**, keď ho používateľ dodá.
- **Nepoužil som Masterclass** (za prihlásením) ani súkromné návody, ktoré posiela cez správy.

---

## 6. Testy a reprodukcia

- `tests/referenceGrid.test.ts` — **36 testov** v skupinách A–G: rovnomerné delenie, hľadanie medzier
  (tmavý panel ≠ medzera), rozdelenie podľa medzier, meranie panelov, paleta naprieč panelmi,
  pravidelnosť a výber rozdelenia podľa pomeru strán (vrátane reálneho nočného záberu).
- Celkovo **592 testov / 0 fail / 24 súborov**; `tsc --noEmit` čistý; build OK.
- Log: `docs/moodboard-verify-output.txt`; výstupné súbory: `/home/user/kontrola-krok14-moodboard.png`
  a `.json`; ukážka pre používateľa: `/home/user/ukazka-krok14-moodboard.html`.
