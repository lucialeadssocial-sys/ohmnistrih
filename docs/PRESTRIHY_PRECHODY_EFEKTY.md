# PRESTRIHY, PRECHODY A EFEKTY — čo naozaj máme (audit + čo je nové)

**Otázka:** „Prestrihy a prechody máme? Efekty“

Odpoveď sa nedala dať z hlavy — preto je tu **audit kódu**: čo existuje, čo je prepojené a čo je overené. A hneď aj to, čo tento krok (krok 25) doplnil.

---

## 1. PRESTRIHY (vynechanie častí videa)

| | |
|---|---|
| Existuje? | **ÁNO** |
| Prepojené do videa? | **ÁNO** |
| Overené? | **REAL EXPORT VERIFIED** |

- Strih je v canonical osi ako klipy na video stope (`canonicalKeepRanges`) a render ho vykoná (`trim` úsekov + spojenie). Toto bolo hotové a overené už skôr (kroky 16–18, `docs/proof-*`).
- **Overené aj v tomto behu:** video rozrezané na tri úseky 0–4 / 6–10 / 12–16 s → hotové video **12,000 s**; so strihmi nič nepadá, zvuk sa pri strhovaní nekopíruje „naslepo“.
- Poctivo: keď strih vyhodí časť s titulkami, appka to napíše do poznámok (v dôkaze: „11 slov padlo do vystrihnutých častí…“, „3 slová strih preskolil…“).

## 2. PRECHODY (prelínač na strihu)

**Predtým (nález auditu):** prechody existovali **len ako rozhranie a prehrávač** — dali sa nastaviť a v prehrávači „vidieť“, ale v celej renderovacej linke nebol **ani jeden `xfade`**. Znamená to: do hotového videa sa nikdy nedostali.

**Teraz (krok 25):** prechod ide z rozhrania **do canonical osi** (CommandManager) a odtiaľ **do videa** (ffmpeg `xfade` + `acrossfade`).

### Dôkaz na reálnom videe (`docs/proof-prechody-na-realnom-videu.txt`)

Rovnaké zadanie dvakrát — len raz s prechodmi:

| | bez prechodov | s prechodmi |
|---|---|---|
| dĺžka videa | 12,000 s | **11,100 s** |
| rozdiel | — | **0,900 s = presne súčet prekrytí** (0,40 + 0,50) |
| snímka v strede spoja | tvrdý strih | **zmes oboch snímok** (prelína sa) |

Vizuál: `/home/user/porovnanie-prechody.png` (hore bez prechodu — tvrdý strih; dole s prechodom — v 3,8 s sa obrázky prelínajú).
Hotové videá: `/home/user/kontrola-prechody/bez-prechodov.mp4`, `/home/user/kontrola-prechody/s-prechodmi.mp4`.

### Čo z rozhrania „Prechody“ sa naozaj vykreslí

| Nastavenie v rozhraní | Vo videu |
|---|---|
| krížové prelínače (dissolve, crossfade) | **áno** (ffmpeg `dissolve` / `fade`) |
| posun (slide vľavo/vpravo/hore/dole) | **áno** (`slideleft`, `slideright`, `slideup`, `slidedown`) |
| šmuhy (wipe) | **áno** (`wipeleft`, `wiperight`) |
| záblesk do biela / do čierna | **áno** (`fadewhite`, `fadeblack`) |
| kruh (iris) | **áno** (`circleopen`) |
| priblíženie na strihu | **áno** (`zoomin`) |
| **glitch, otras kamery, TV statika, VHS, švih kamery, roztočenie, hranol, svetelná šmucha** | **NIE** — appka to napíše do poznámok a strih zostane obyčajný (nič sa nepredstiera) |

Bezpečné limity: prechod 0,10 – 2,00 s a najviac 40 % kratšieho úseku (inak by obraz skákal). Keď sa dĺžka oreže, appka to prizná.

**Zvuk:** na spoji **s prechodom** sa zvuk prelína (`acrossfade`) — je to dôsledok prechodu, ktorý si nastavil. Spoj bez prechodu necháva zvuk nedotknutý (žiadna tichá zmena pôvodného audia).

## 3. EFEKTY

**Poctivo: samostatné efekty (glitch, otras kamery, TV statika…) appka do videa NEVYKRESĽUJE.** Model na ne má miesto (`clip.effects`, ponuka v rozhraní), ale render ich ignoruje — a to je presne tá trieda veci, ktorú nechceme zamlčať.

Čo appka namiesto toho **naozaj** robí s obrazom (a je overené):

| Efekt | Stav |
|---|---|
| svetlo podľa ich videí (jas/kontrast) | **REAL EXPORT VERIFIED** (krok 24) |
| priblíženie vrátane animovaného (punch-in) | **REAL EXPORT VERIFIED** (kroky 16–18) |
| farebné filtre (Teal/Orange, Cinematic, Vintage, BW, Warm, Cool) | **REAL EXPORT VERIFIED** |
| obrazové vrstvy (b-roll, fotky) s priehľadnosťou a otočením | **REAL EXPORT VERIFIED** |
| oživenie zvýrazneného slova (pruženie) | **REAL EXPORT VERIFIED** (krok 18) |
| animácia vstupu titulku (pop) | **REAL EXPORT VERIFIED** |
| prechody (nové) | **REAL EXPORT VERIFIED** (krok 25) |
| kinematické efekty (glitch, otras…) | **NEVYKRESĽUJE SA** — priznané |

## 4. Chyba nájdená a opravená v tomto kroku

Pri prvom behu prechodov ffmpeg zlyhal (`kód 234`). Príčina nebola v prechodoch, ale v **zisťovaní parametrov videa**: `parseFfmpegProbe` mal regex, ktorý na bežnom riadku `Video: h264 (High) (avc1 …), yuv420p(tv, bt709, progressive), 720x1280, 30 fps` zlyhal (čiarky v pixelovom formáte), takže appka **nezistila snímkovú frekvenciu** — a `xfade` bez konštantnej frekvencie odmietne pracovať.

Opravené: rozmery aj fps sa hľadajú v celom riadku video stopy; keď sa fps nedá zistiť, render s prechodmi **vopred odmietne s jasnou chybou** (nič sa nerozbije na konci). Táto oprava pomáha aj priblíženiu a kvalite výstupu (`fps=` v linke).

## 5. Čo ešte chýba (poctivo, na ďalšie kroky)

- **samostatné efekty** (glitch/otras/statika) — vykresliť sa nedajú; dá sa doplniť pár bezpečných (`hblur`, `pixelize`) alebo ich nechať ako „len v rozhraní“ a pomenovať.
- **kinematické prechody** (švih kamery, roztočenie) — potrebovali by vlastné filtre.
- **náhľad v prehliadači** — kód je napojený (`xfade` v exporte, prehrávač prechody zobrazuje), ale **NOT VERIFIED** (v prostredí bez DOM).
- **prechody na spojoch s priblížením** — fungujú, ale pri veľmi krátkych úsekoch sa dĺžka oreže (vidno v poznámkach).
