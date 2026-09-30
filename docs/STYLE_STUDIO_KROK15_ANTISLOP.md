# Krok 15 — jeho ďalšie postupy + „nič nenechaj modelu na domyslenie"

**Zadanie usera (jeho vlastné slová):** „Pozeraj aj ďalej od neho na TikToku alebo nájdi od neho viac videí alebo postupov, ak má."

**Výsledok v jednej vete:** našiel som **jeho ďalšie postupy** (jeho vlastné slová, celé popisy videí) a **2 videá, ktoré sme predtým nemali** (stiahnuté a zmerané) — a najsilnejší z jeho postupov som postavil do appky: **kontrolu, či máš pomenované svetlo, kompozíciu, farby a štýl** (lebo čo nepomenuješ, to si model domyslí).

---

## 1 · Jeho postupy — čo pribudlo (a odkiaľ to je)

Celé popisy všetkých 12 tiktokov som vytiahol cez TikTok oEmbed API (funguje bez prihlásenia a vracia celý text). Uložené mimo repa: `/home/user/referencie/popisy-tiktok.json`.

Nové metódy, ktoré sme doteraz nemali (jeho vlastné slová):

| # | Jeho slová (citát) | Zdroj |
|---|---|---|
| 1 | „Keď AI nepovieš, aké má byť **svetlo, kompozícia, farby alebo celkový štýl**, musí si to všetko nejako domyslieť. A väčšinou siahne po vzoroch, ktoré si s danou vecou spája najviac. … čím viac rozhodnutí necháš na AI, tým viac sa prikloní k tomu najpravdepodobnejšiemu. A to najpravdepodobnejšie býva často aj to **najgenerickejšie**.“ | `tiktok-7673961257115979030` („Prečo práve 10:10?“) |
| 2 | „…nemusíš všetko generovať nanovo ako napr. pri videu, ale stačí, aby AI **zmenilo riadok v kóde**.“ | `tiktok-7690550368333499650` |
| 3 | „**Vygeneruj si najskôr jeden obrázok ako grid / moodboard**… Ten potom použiješ ako referenciu… Nie vždy potrebuješ lepší prompt. Niekedy potrebuješ lepšiu referenciu.“ | `tiktok-7680609867467345174` (krok 14) |
| 4 | „…nie len používanie referencií, ale **priame kreslenie a písanie v nich**.“ | `tiktok-7678009554033970454` (krok 14) |
| 5 | „Skôr než za niečo vyhodíš peniaze, skús si najprv prejsť **materiály priamo od tvorcov** (Claude/ChatGPT majú vlastné kurzy, zadarmo).“ | `tiktok-7689405350226775318` |
| 6 | „…každý deepfake sa musí jasne **označiť**, inak pokuta do 15 mil. eur alebo 3 % obratu. Fyzická osoba, ktorá doma naklonuje hlas a hodí to na sieť? Nič.“ (o AI Act, od 2. augusta) | `tiktok-7685413335948397846` |
| 7 | Pravidlá pre AI agentov („nedávaj mu hlavnú kartu“, „potvrdenie pred platbou“, „pozor na prompt injection“) | `tiktok-7665741304122445078` |
| 8 | „Toto je **vibe coding** … pri komplexnejších veciach je to iné, tam vstupuje bezpečnosť, databázy, autentifikácia…“ | `tiktok-7662872350953737495` |

Jeho web (`aiktivista.sk`) vydal viac, než hovorí sitemap — odkazy na 4 YouTube videá (reklama rajo, dva klipy Miro Jaroša, podcast **„Peniaze s Helenou Tomkovou“, epizóda 14. 12. 2025: Umelá inteligencia mení svet**) a na články (Refresher 2023 — *„pomocou Midjourney a AI pluginu inswapper“*, StartItUp, Soda O2).

**Čo som NEdostal (a netvrdím o tom nič):**
- **Masterclass je naozaj zamknutý** — stránka vracia iba prihlasovací formulár, žiadna osnova ani zoznam lekcií. Overené dnes znovu → **NEPOUŽITÉ**.
- YouTube z tohto prostredia vrátil **HTTP 429** (rate limit) → obsah podcastu **NOT VERIFIED**; neobchádzal som to.
- Jeho tvrdenia o AI Act (pokuty, výnimky) som **neoveroval** → je to jeho vyjadrenie, nie overený fakt.

---

## 2 · Viac videí — čo sa podarilo a čo nie

**Podarilo sa (nová cesta):** staršie videá sú indexované vyhľadávačmi a z ich TikTok stránky sa dá cez **`player/api/v1/items`** získať stiahnuteľná adresa. Takto som stiahol **2 videá, ktoré sme nikdy nemali**:

| video | dátum | trvanie | popis (jeho slová) |
|---|---|---|---|
| `tiktok-7311061470731570465` | 12/2023 | 108 s | „Umelá inteligencia vie byť aj dosť nebezpečná… nemecký telekom prišiel so zaujímavou reklamou o hrozbách.“ |
| `tiktok-7243866775601892634` | 06/2023 | 13 s | „Influenceri po týždni v Sobranciach…“ |

Obe som **zmeral existujúcim nástrojom** (nič nové sa nevymýšľalo), log: `docs/nove-videa-verify-output.txt`.

**A tu je dôležité zistenie — jeho staršie videá sú merateľne INÉ:**

| sada | videí | strihy/s | záber | jas | kontrast | sýtosť |
|---|---|---|---|---|---|---|
| **staršie (2023, nové)** | 2 | **0,41** | 2,15 s | **62,3** | 48,4 | **37 %** |
| IG klipy (krok 12) | 6 | 0,14 | 9,25 s | 87,5 | 55,9 | 25 % |
| TikToky (krok 13) | 12 | 0,21 | 4,17 s | 114,0 | 55,8 | 30 % |

→ Staršie klipy **nezlúčim do receptov**: jeho štýl sa medzi rokmi zmenil (rýchlejší strih, tmavšie, sýtejšie). Recepty preto ostávajú postavené len na nedávnych klipoch a appka to musí **povedať**, nie zlievať do jedného priemeru.

**Čo nešlo (a nebudem to skúšať znova):** profile feed cez player API (vracia len stav bez videí), embed (stále tých istých 12), discover stránky (0 jeho videí), urlebird mirror (403), IG pagination (401 rate limit), Threads (len JS), mobilné `aweme` API (429), CDN adresa z HTML video stránky (403 — prejde len tá z player API).

---

## 3 · Čo z toho je teraz v appke

### `src/core/style/styleExplicitness.ts` — kontrola štyroch pilierov

Audit pomenúva pri každom pilieri (svetlo, kompozícia, farby, štýl) **odkiaľ hodnota je**:

| pôvod | význam |
|---|---|
| `user` | rozhodol si ty (ovládač v Style Studiu) |
| `measurement` | je to zmerané z reálnej referencie (kroky 11–14) |
| `recipe` | určuje to recept |
| `app_default` | **nikde to nie je** → appka doplní default a model by si to domyslel |

Výstup obsahuje: verdikt („podložené 3 zo 4; model by si domyslel: svetlo“), zoznam otvorených pilierov, čo appka doplní, **konkrétny krok na zavretie medzery** a pomenovanie štruktúry (tvoje číslo rečníka vs číslo z enginu).

### Recepty teraz nesú svoje namerané svetlo (len tie, ktoré naozaj stoja na meraní)

`AI_CINEMATIC_TAKE` → jas **87,51** / kontrast **55,92** (`analyza-videa.json`, medián cez 6 klipov, krok 12)
`EDU_WORD_TALK` → jas **114,04** / kontrast **55,8** (`analyza-tiktok.json`, medián cez 12 klipov, krok 13)

Ostatných 13 receptov namerané svetlo **nemá** a appka to nepredstiera.

### Výsledok cez všetkých 15 receptov (reálny beh nástroja)

```
recept                podložené  otvorené  čo by si model domyslel
EDITORIAL_COLLAGE     3/4        1         svetlo
DOCUMENTARY           3/4        1         svetlo
MODERN_SOCIAL         3/4        1         svetlo
DARK_EDITORIAL        3/4        1         svetlo
KINETIC_TYPOGRAPHY    3/4        1         svetlo
MINIMAL               3/4        1         svetlo
CINEMATIC             3/4        1         svetlo
PODCAST_VISUAL        3/4        1         svetlo
UGC_PERFORMANCE       3/4        1         svetlo
AI_CARD_DEMO          3/4        1         svetlo
FILM_MONTAGE          3/4        1         svetlo
EXPERT_COLLAGE_TALK   3/4        1         svetlo
AI_CINEMATIC_TAKE     4/4        0         —
EDU_WORD_TALK         4/4        0         —
CUSTOM                3/4        1         svetlo
```

### Napojenie do plánu (aby to nebolo mŕtve API)

`buildStylePlan` teraz do svojich poznámok pridáva:

```
Kontrola štýlu: podložené 3/4 (0× tvoje alebo zmerané, 3× z receptu); modelu na domyslenie by ostalo: svetlo.
Chýba pilier → Svetlo: zmeraj referenciu (analyzeReferencePixels na obrázok alebo analyzeMoodboard na grid) a daj appke jas a kontrast ako čísla.
```

### Jeho druhá metóda: „stačí zmeniť riadok v kóde“

`describeControlChangeSk` pomenuje zmenu jedného ovládača (napr. „Motion: calm → dynamic“) a appka nič iné nemení — nič sa negeneruje nanovo. Testy to overujú.

---

## 4 · Poctivo — čo to NIE je

- **Svetlo je zatiaľ len číslo pre zadanie** (do AI nástroja mimo appky). Appka ním **svoj render nemení** → `IMPLEMENTED, NOT WIRED TO RENDER`. Priznané v logu aj tu.
- **Panel v UI to zatiaľ nezobrazuje** → `IMPLEMENTED BUT NOT WIRED` (plán to nesie ako poznámku, takže to nie je ticho).
- **Appka negeneruje obrázky ani video** — `PROVIDER UNAVAILABLE`. Audít len hovorí, čo je pomenované a čo nie.
- **Nemerá scénu v tvojom videu** — na to treba tvoje médium; to je iný krok.
- **„Podložený pilier“ neznamená, že výstup bude dobrý** — len že nie je na domyslenie.
- **Kreslené poznámky v referencii appka stále nečíta** (jeho červený rámik) — medzera z kroku 14 trvá.
- Staršie klipy (2023) **nie sú** v receptoch — appka ich nezlúčila; rozdiel je v tabuľke vyššie.

---

## 5 · Reprodukcia

```bash
# audit štýlu na reálnych nameraných dátach (15 receptov, 2 merania na disku)
bun run tools/verify-style-explicitness.ts --out docs/style-explicitness-output.txt

# jeden recept podrobne
bun run tools/verify-style-explicitness.ts --recipe EDU_WORD_TALK

# meranie nových videí (2023) — tie isté nástroje ako v krokoch 12–13
bun run tools/measure-reference-video.ts /home/user/referencie/tiktok-7311061470731570465.mp4 \
  /home/user/referencie/tiktok-7243866775601892634.mp4 --out /home/user/referencie/analyza-nove.json

# testy
bun test            # 632 pass / 0 fail / 25 súborov
bunx tsc --noEmit   # čisté
```

Stiahnutie ďalšieho jeho videa (keď poznáš ID):

```bash
curl -s -A "Mozilla/5.0" "https://www.tiktok.com/player/api/v1/items?item_ids=<ID>"
# z odpovede: video_info.profiles[].play_addr.url_list (najväčší data_size) → stiahni tou adresou
```

---

## 6 · Otvorené po kroku 15

1. **Titulky po slovách** do canonical + renderu (stále najväčšia medzera jeho najčastejšieho formátu).
2. **Zobraziť kontrolu štýlu v paneli** (dnes len v poznámkach plánu) — IMPLEMENTED BUT NOT WIRED.
3. **Svetlo preniesť do renderu** (dnes len číslo pre zadanie) — `applyReferencePalette` je tiež stále nepripojené.
4. **Kreslené poznámky v referencii** (červený rámik) — appka vidí len farbu.
5. Retroz pixel skeč (jeho formát z 2023–2024) sa nevyrába; easing medzi keyframami je lineárny.
