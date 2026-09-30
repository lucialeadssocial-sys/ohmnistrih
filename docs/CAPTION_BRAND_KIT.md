# Animácie titulkov a vlastný štýl klienta (krok B++)

> Stav: **hotové a overené na živom renderi** (30. 9. 2026).
> Kód: `src/core/export/subtitleRender.ts` (animácie, odchýlky, farby),
> `src/core/export/captionProfiles.ts` (profily klientov),
> `src/core/export/captionPreview.ts` + `src/components/CaptionStylePreview.tsx` (náhľad),
> `src/components/CaptionProfileBar.tsx` (UI), `server.ts` (`/api/captions/profiles`).
> Testy: `bun test tests/captionProfiles.test.ts` (47 testov).

## 1. Prečo animácie — a prečo len vstup

Titulok, ktorý sa hýbe celý čas, sa **nedá čítať**. Najčastejšia chyba „cool“
titulkov je, že sa slová neustále posúvajú alebo zväčšujú a divák nestíha.

Preto appka animuje **len objavenie** titulku. Počas čítania text stojí.

| Animácia | Čo robí | Dĺžka | Kde |
|---|---|---|---|
| `pop` | vyrastie z 86 % na 100 % | 130 ms | Virálny, Placka |
| `punch` | priletí zo 114 % a sadne na 100 % | 160 ms | pre hooky (voliteľné v profile) |
| `fade` | jemné objavenie a zmiznutie | 150 ms | Hormozi*, Zdôraznené čísla, Brand, firemné profily |
| `none` | bez animácie | — | Karaoke, Čistý, Podcast, Minimal |

\* Pri Hormozim je to **zámerné**: pozri §2.

Animácia **nezvyšuje počet udalostí** v ASS — jedno slovo = jedna udalosť, ako
predtým. Ak by sa počet menil, strih aj titulky by prestali sedieť na seba.

## 2. Zmeraná pasca: animácia veľkosti vs. zväčšené aktívne slovo

**Čo sa stalo:** štýl Hormozi zväčšuje aktívne (práve hovorené) slovo inline
príkazom `\fscx112`. Keď sa na tú istú udalosť pridala animácia zmeny veľkosti,
libass ju **ticho zrušil** — vo videu sa nehýbalo nič, ale appka by tvrdila, že
animácia je zapnutá.

**Ako sa to zistilo** (nie odhadom, meraním): vyrenderovali sa dve verzie toho
istého klipu a počítali sa pixely aktívneho slova v čase po animácii:

| Verzia | žlté pixely v t = 0,10 s | v t = 0,45 s |
|---|---|---|
| s `\fscx114\t(0,160,…)` | 50 070 | 50 070 |
| bez animácie | 50 063 | 50 063 |

Rozdiel 7 pixelov = animácia sa neprejavila. `fade` na tom istom štýle funguje
(priemerný jas textu 82,6 počas animácie vs. 248,1 ustálený).

**Riešenie (poctivé, nie tiché):**
1. Keď má štýl zväčšenie aktívneho slova a animácia je typu „zmena veľkosti“,
   appka ju **nahradí jemným objavením** (`fade`),
2. a napíše to do poznámok: *„Animáciu „punch“ som nahradil jemným objavením:
   tento štýl zväčšuje aktívne slovo a libass by animáciu veľkosti ticho zrušil
   (zmerané vo videu)."*
3. Hormozi má preto v katalógu priamo `fade`.

Regresný test na to existuje: `keď má štýl zväčšenie aktívneho slova, scale
animácia sa nahradí a prizná`.

## 3. Vlastný štýl klienta (brand kit)

**Problém:** typická práca je mix klientov. Každý má svoje farby, písmo a spôsob
titulkov — bez uloženého profilu sa pri každej zakázke znova klikajú farby.

**Riešenie:** profil = **základný hotový štýl + odchýlky** (nie nový štýl od
nuly). Používateľ si vyberie najbližší štýl, doladí farbu a veľkosť, pomenuje
profil („Klient A – beauty“) a nabudúce je to jeden klik.

### Čo sa dá nastaviť

| Nastavenie | Rozsah | Poznámka |
|---|---|---|
| Farba textu / zvýraznenia / obrysu / podkladu | `#RRGGBB` | z brand manuálu, prekladá sa do ASS |
| Veľkosť písma | 30–130 ‰ výšky videa | nad 130 ‰ už text preteká |
| Slová na obrazovke | 0–6 | 0 = celá veta naraz |
| Odstup od spodku | 4–35 % | kvôli rozhraniu aplikácií |
| Zväčšenie aktívneho slova | 100–160 ‰ | 100 = bez zväčšenia |
| Animácia vstupu | none / pop / punch / fade | s dĺžkou v ms |
| Umiestnenie | dole / stred / hore | hore a stred si samy posunú okraj |
| Veľké písmená, text na placce | áno / nie | placka bez farby dostane tmavú |

### Farby: `#RRGGBB` → ASS `&HAABBGGRR` (pozor na BGR)

Brand manuál dáva `#0A3D91`. ASS má poradie **BGR**, takže správne je
`&H00913D0A`. Zámena poradia je najčastejšia chyba pri prenose farieb — appka to prekladá obojsmerne
a testy to overujú (`hexToAssColor`/`assColorToHex`).

### Ukladanie

Profily sú **na serveri** (`.data/caption-profiles.json`), nie len v prehliadači:
prežijú nové nahranie videa aj iné zariadenie a render na serveri ich musí vidieť.

| Metóda | Cesta | Čo robí |
|---|---|---|
| GET | `/api/captions/profiles` | uložené profily + 3 štartovacie šablóny + popis, čo každý mení |
| POST | `/api/captions/profiles` | uloží/aktualizuje profil, vráti `notesSk` (čo sa orezalo) |
| DELETE | `/api/captions/profiles/:id` | zmaže profil (neplatné id odmietne) |

Limity: 50 profilov, názov 40 znakov, poznámka 200 znakov. Id profilu je vždy
bezpečné (`a–z`, `0–9`, `-`) — dá sa dať do URL.

### Štartovacie šablóny (aby sa dalo začať aj bez klikania farieb)

| Šablóna | Základ | Nastavenie |
|---|---|---|
| Firemné (modrá, pokojné) | Čistý | tmavomodrý obrys `#0A2E6B`, 52 ‰, celá veta |
| E-shop (zlatá, výrazné) | Zdôraznené čísla | zlaté zvýraznenie `#FFC400`, 62 ‰ |
| Podcast (teplá biela, pokojné) | Podcast | teplý text `#F5EFE6`, väčší okraj |

## 4. Poctivé mantinely (čo appka NIKDY neurobí ticho)

- **Orezanie do rozsahu sa vždy povie** — „veľkosť písma bolo mimo rozsahu,
  použil som 130 (rozsah 30–130)“.
- **Zlá farba sa vynechá, nie nahradí náhodnou** — „Farba „modrá“ nie je v tvare
  `#RRGGBB` — vynechal som ju".
- **Neznáma animácia sa nevymyslí** — appka vypíše, čo je na výber.
- **Profil nikdy nemení pôvodný štýl v katalógu** — inak by si jedna zakázka
  pokazila štýl pre všetkých (testované).
- **Náhľad = render.** Náhľad kreslí prehliadač (nie libass), takže farby
  a rozloženie sedia, ale písmo môže vyzerať o vlások inak. Appka to píše priamo
  pod náhľadom.
- **Profil nemôže vypnúť upozornenia** ani zmeniť to, že sa titulky pália do
  obrazu — mení len vzhľad.

## 5. Overené na živom renderi (nie v teste)

Klip `Klient_C_reklama.mp4` (1080×1920, 30 fps), profil „Klient A – beauty“
(zlaté zvýraznenie `#FFC400`, 64 ‰, animácia `pop`):

| Pozorovanie | Výsledok |
|---|---|
| Zlaté zvýraznenie vo videu | **12 994 zlatých pixelov** (t = 1,9 s) |
| Ten istý klip bez profilu | **0 zlatých pixelov**, 47 926 bielych |
| Animácia vstupu | `\fscx86\fscy86\t(0,130,\fscx100\fscy100)` v ASS |
| Zvuk/obraz | 3,2 s klip, CRF 20, rozmery zdroja zachované |

Dôkazy v `/home/user`: `ukazka-brand-zakaznik.mp4` (vypálený klip s profilom)
a `ukazka-brand-zakaznik.png`.

## 6. Ako to skúsiť v appke

1. Nahraj video a spusti „Automatické titulky“.
2. V sekcii vypálenia klikni na **„doladiť farby a veľkosť“**.
3. Zmeň farbu zvýraznenia (napr. na zlatú `#FFC400`) — náhľady vyššie sa hneď
   prekreslia tvojím vzhľadom.
4. Napíš názov profilu a klikni **„Uložiť profil“**. Nabudúce stačí „Použiť“.
5. Rýchly štart: sekcia **„Hotové štarty“** (Firemné / E-shop / Podcast).
