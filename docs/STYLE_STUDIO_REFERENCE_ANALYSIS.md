# STYLE STUDIO — ANALÝZA REÁLNYCH REFERENCIÍ (merania, nie dojmy)

Dátum: 2026-09-30 · Zdroj: verejný profil `instagram.com/denis_vencel` (3 najnovšie videá s najväčším dosahom)

## Ako som sa k materiálu dostal (poctivo)

- Priamy web aj `oembed` sú pre neprihlásených **zavreté** (302 na login), `yt-dlp` dostal **HTTP 429**.
- Fungovala **verejná JSON odpoveď profilu** (`i.instagram.com/api/v1/users/web_profile_info`) — vracia 12 najnovších príspevkov.
- Videá sú uložené **lokálne** v `/home/user/referencie/` a **nie sú v repozitári** (cudzí obsah tam nepatrí). Do repa ide **len to, čo som nameral**.

## Čo som nameral (ffmpeg, reálne súbory)

| Klip | Dĺžka | Rezy | Rez/s | Priemerný záber | Videnia | Lajky |
| --- | --- | --- | --- | --- | --- | --- |
| `Dd3vH4_FKAx` — AI karta | 18.0 s | 0 | 0.0 | 18.0 s | 49 495 | 1 066 |
| `DB6o-r3qWcl` — filmová montáž | 54.33 s | 88 | 1.62 | 0.61 s | 16 359 | 1 127 |
| `DXtdqsbAtEG` — expert + koláž | 93.64 s | 43 | 0.46 | 2.13 s | 27 779 | 1 347 |

Rezy merané filtrom `scdet` (zmena scény v obraze), jas pásiem filtrom `signalstats`.
Všetky tri sú **720×1280 (9:16)** s AAC zvukom.

Kontrolné čísla jasu (podklad pre rozhodnutia o vrstvách a kontraste):

| Klip | jas stredného pásma | jas spodného pásma | podiel snímok so svetlým spodkom |
| --- | --- | --- | --- |
| AI karta | 130.8 | 93.2 | 1.0 |
| Filmová montáž | 94.0 | 89.4 | 0.7 |
| Expert + koláž | 110.9 | 97.2 | 0.59 |

## Čo som videl na snímkach (vizuálne, nie merané strojom)

**1) AI karta (18 s, 0 rezov)** — rečník dole, cez obraz veľká svetlá zaoblená karta s výstupom.
Dva popisky: `ZADAJ:` biely a `VÝSLEDOK:` oranžový, oba **silný kondenzovaný, VERZÁLKY, tmavý obtiahnutý obrys**.
Obsah karty sa mení, záber nie. Pozadie reálne (stromy, panelák), nie štúdio.

**2) Filmová montáž (54 s, 88 rezov)** — b-roll zo skutočných miest (bežecká dráha, kancelária, aula, filmový štáb),
rečník prestrihnutý medzi zábermi. Titulky **dole na tmavom podklade**, jedno slovo zvýraznené.
Na tretej snímke sa objaví samostatné slovo v strede (`AROUND`) — kinetický nadpis, nie titulok.

**3) Expert + koláž (94 s, 43 rezov)** — rečník vysvetľuje, na obrazovke sa **vrstvia čiernobiele fotky**
(polaroidový dojem, jedna oranžová línia) a **ručne kreslené diagramy** (postava + otázniky).
V titulkoch je vždy **jedno zvýraznené slovo** (`NESMÍŠ ZABUDNÚŤ`, `A NÁJDE`, `4. YO BOX`).

## Ako som to premenil na recepty (kód)

| Recept v kóde | Z čoho vychádza | Kľúčové namerané hodnoty, ktoré nesie |
| --- | --- | --- |
| `AI_CARD_DEMO` („AI karta (zadaj → výsledok)") | klip 1 | 0 rezov → `punchIn: false`, `whipPan: "none"`; rečník dominantný → `talkingHeadRatio: 0.85`; karta nad obrazom → `picture_in_picture`; popisky → `bold-condensed`, VERZÁLKY, `staggerMs: 140`; `MINIMAL` titulky, lebo text nesie karta |
| `FILM_MONTAGE` („Filmová montáž") | klip 2 | 1,62 rezu/s → strih ako základ (`transitionStyle.base: "cut"`), b-roll `talkingHeadRatio: 0.25`, `elementPool` bez koláže, `CLEAN` titulky na podklade |
| `EXPERT_COLLAGE_TALK` („Expert + koláž na obrazovke") | klip 3 | 0,46 rezu/s, záber 2,13 s → pokojné tempo; `layered_collage`, `depthLayers: 3`; `HORMOZI` titulky (zvýraznené slovo); `talkingHeadRatio: 0.6` |

Recepty **nič nevykresľujú samy** — sú len slovník pre existujúci Director/Apply. Platí pravidlo:
keď na to nie je médium, recept to **napíše** (`requiresSk`), nevymyslí.

## NOT VERIFIED / čo z referencií neviem

- **Presné fonty** — určené vizuálne (kondenzovaný bold), **nie podľa mena**. Meno fontu netvrdím.
- **Easing a motion blur** — z hotového encodu sa nedajú spoľahlivo zmerať.
- **Whip-pan** v recepte `FILM_MONTAGE` je **odhad z vizuálu**, nie meranie; označené ako „occasional".
- **Hudba a zvuková stopa** v referenciách — neanalyzoval som (audio master je u nás chránený, cudzie audio nepreberám).
- **Videnia/lajky** sú čísla z Instagramu (self-reported), nie môj výpočet.
- Verejná JSON vracia len **12 najnovších** príspevkov; staršie sa takto nedajú získať.
