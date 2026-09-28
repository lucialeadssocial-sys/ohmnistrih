/**
 * Trend & Virálny engine — znalostná knižnica + kontrola virality.
 *
 * Dôležité rozlíšenie, ktoré drží nástroj čestný:
 *  - PRINCÍPY = veci, ktoré platia roky (mechanizmy ľudskej pozornosti a algoritmov).
 *    Sem sa nič nedostane, čo je len módny výstrelok.
 *  - TRENDY = dnešné formáty. Majú dátum overenia a riziko. Trendy sa menia —
 *    nástroj to musí povedať, nie predstierať večnú pravdu.
 *
 * Nič tu negarantuje zhliadnutia. Každá položka vysvetľuje MECHANIZMUS (prečo to
 * funguje) a KEDY TO NEPOUŽIŤ. To je rozdiel medzi návodom a horoskopom.
 */

export type TrendPlatform = "TIKTOK" | "REELS" | "SHORTS" | "YOUTUBE_LONG" | "ADS";

export type Niche =
  | "univerzalne"
  | "sluzby"
  | "ecommerce"
  | "vzdelavanie"
  | "osobny-brand"
  | "fitness"
  | "krasa"
  | "gastro"
  | "nehnutelnosti"
  | "b2b";

export const NICHES: { id: Niche; labelSk: string }[] = [
  { id: "univerzalne", labelSk: "Univerzálne" },
  { id: "sluzby", labelSk: "Služby / remeslo" },
  { id: "ecommerce", labelSk: "E-shop / produkt" },
  { id: "vzdelavanie", labelSk: "Vzdelávanie / kurz" },
  { id: "osobny-brand", labelSk: "Osobný brand" },
  { id: "fitness", labelSk: "Fitness / zdravie" },
  { id: "krasa", labelSk: "Krása / beauty" },
  { id: "gastro", labelSk: "Gastro / cestovanie" },
  { id: "nehnutelnosti", labelSk: "Nehnuteľnosti" },
  { id: "b2b", labelSk: "B2B / firemné" },
];

export interface PlatformSpec {
  id: TrendPlatform;
  labelSk: string;
  minSeconds: number;
  maxSeconds: number;
  sweetSpotSk: string;
  /** Zdravé tempo strihu v strihoch za minútu pre tento typ obsahu. */
  idealCutsPerMinute: [number, number];
  captionRuleSk: string;
  noteSk: string;
}

export const PLATFORMS: PlatformSpec[] = [
  {
    id: "TIKTOK",
    labelSk: "TikTok",
    minSeconds: 7,
    maxSeconds: 90,
    sweetSpotSk: "15–34 s",
    idealCutsPerMinute: [8, 20],
    captionRuleSk: "titulky vždy, veľké a do stredu bezpečnej zóny",
    noteSk: "Najrýchlejší spád. Prvá sekunda rozhoduje o všetkom, druhá o zvyšku. Loop (napojenie konca na začiatok) je legitímna technika.",
  },
  {
    id: "REELS",
    labelSk: "Instagram Reels",
    minSeconds: 7,
    maxSeconds: 120,
    sweetSpotSk: "15–45 s",
    idealCutsPerMinute: [7, 18],
    captionRuleSk: "titulky menšie (safe zóna kvôli UI) — cca 20 % výšky od okrajov",
    noteSk: "Estetika a vizuálna konzistencia nesú viac než na TikToku. Prvý frame musí vyzerať dobre aj ako statická fotka (cover).",
  },
  {
    id: "SHORTS",
    labelSk: "YouTube Shorts",
    minSeconds: 10,
    maxSeconds: 180,
    sweetSpotSk: "20–60 s",
    idealCutsPerMinute: [6, 15],
    captionRuleSk: "titulky áno, ale čitateľné — Shorts divák často sedí pri počítači",
    noteSk: "Divák má vyššiu toleranciu na hovorené slovo než na TikToku. Titulok Shortu funguje ako mini-hook v rozhraní.",
  },
  {
    id: "YOUTUBE_LONG",
    labelSk: "YouTube long-form",
    minSeconds: 120,
    maxSeconds: 3600,
    sweetSpotSk: "8–15 min",
    idealCutsPerMinute: [1, 6],
    captionRuleSk: "titulky voliteľné, skôr kapitoly",
    noteSk: "Tu sa nehrá na hook do 3 s, ale na sľub v prvých 30 s a na štruktúru. Kapitoly a kontinuita > efekty.",
  },
  {
    id: "ADS",
    labelSk: "Reklama / UGC",
    minSeconds: 6,
    maxSeconds: 60,
    sweetSpotSk: "15–30 s",
    idealCutsPerMinute: [8, 22],
    captionRuleSk: "titulky vždy — veľká časť zobrazení je bez zvuku",
    noteSk: "Štruktúra: hook → problém → riešenie → dôkaz → CTA. Dôveryhodnosť (nedokonalý záber, reálna reč) poráža dokonalosť.",
  },
];

export function getPlatform(id: TrendPlatform): PlatformSpec {
  return PLATFORMS.find((p) => p.id === id) || PLATFORMS[0];
}

// ============================================================
// 1) PRINCÍPY — trvalé mechanizmy, nie módne vlny
// ============================================================

export interface TrendPrinciple {
  id: string;
  titleSk: string;
  whatSk: string;
  whySk: string;
  whenNotSk: string;
  platforms: TrendPlatform[];
  niches: Niche[];
}

export const PRINCIPLES: TrendPrinciple[] = [
  {
    id: "hook-3s",
    titleSk: "Prvé 3 sekundy sú rozhodnutie, nie úvod",
    whatSk: "Najsilnejšiu vetu daj na úplný začiatok. Žiadne „ahoj, dnes si povieme“, žiadne logo.",
    whySk: "Algoritmus meria, koľko ľudí odíde v prvých sekundách. Aj človek rozhoduje o videu skôr, než ho začne vnímať — podľa prvého dojmu.",
    whenNotSk: "Long-form a firemné video: tam slušný úvod a kontext majú zmysel, ale aj tak až po sľube.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["univerzalne"],
  },
  {
    id: "open-loop",
    titleSk: "Otvorená slučka (otázka bez odpovede)",
    whatSk: "Na začiatku sľúb konkrétny výsledok, ale odpoveď daj až neskôr (a nie na konci, inak odídu).",
    whySk: "Mozog neznáša nedokončené veci — nutká ho zostať. Ale nesmie to byť podvod: ak odpoveď nepríde, divák sa cíti okradnutý a nezostane ani na ďalšom videu.",
    whenNotSk: "Nehnuteľnosti a reklama na produkt: tam chcú ľudia odpoveď hneď, zdržiavanie pôsobí ako manipulácia.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "YOUTUBE_LONG"],
    niches: ["vzdelavanie", "osobny-brand", "sluzby", "b2b"],
  },
  {
    id: "pattern-interrupt",
    titleSk: "Prerušenie vzorca",
    whatSk: "Zmeň framing, pohyb, zvuk alebo uhlo kamery presne v momente, keď pozornosť prirodzene klesá (cca každých 3–7 s).",
    whySk: "Pozornosť nepadá plynule, ale skokovo — mozog si zmeny všíma. Rovnaký záber s rovnakým tempom sa po pár sekundách stáva „kulisou“.",
    whenNotSk: "Emocionálna scéna a hudobný moment: tam prerušenie zabije atmosféru. Niekedy je silnejšie nechať kameru dýchať.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["univerzalne"],
  },
  {
    id: "specific-numbers",
    titleSk: "Konkrétnosť poráža prídavné mená",
    whatSk: "„ušetríš 4 hodiny týždenne“ poráža „ušetríš veľa času“. Konkrétne číslo je dôkaz, že to robíš naozaj.",
    whySk: "Konkrétne číslo je overiteľné, a teda dôveryhodné. Vágne tvrdenie si mozog hodí do kategórie reklama.",
    whenNotSk: "Neznáme výsledky: radšej priznaj rozsah („u nás to bolo 3–5 h“), než si vymyslieť jedno číslo.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS", "YOUTUBE_LONG"],
    niches: ["univerzalne"],
  },
  {
    id: "sound-off",
    titleSk: "Video musí dávať zmysel bez zvuku",
    whatSk: "Titulky + vizuálne podanie informácie. Zvuk je bonus, nie podmienka.",
    whySk: "Veľká časť sociálnych zobrazení je bez zvuku a automaticky prehrávaná. Ak video bez zvuku nedáva zmysel, polovica divákov ho nikdy nepochopí.",
    whenNotSk: "Hudobné a ASMR typy obsahu: tam je zvuk obsah, nie bonus — titulky ho len dopĺňajú.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["univerzalne"],
  },
  {
    id: "one-idea",
    titleSk: "Na jeden klip jedna myšlienka",
    whatSk: "Jedna veta = jeden nápad. Zvyšok patrí do iného videa.",
    whySk: "Divák si z videa zapamätá jednu vec. Ak mu dáš tri, nezapamätá si ani jednu a klip prestane fungovať ako samostatná jednotka.",
    whenNotSk: "Long-form a vzdelávacie série: tam má zmysel ísť do hĺbky, ale aj tak jednu myšlienku na jednu kapitolu.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["univerzalne"],
  },
  {
    id: "earned-cta",
    titleSk: "Výzva funguje, len keď je zarobená",
    whatSk: "„Napíš X“ funguje až vtedy, keď divákovi niečo dáš. CTA na konci bez hodnoty = ignorovanie.",
    whySk: "Ľudia reagujú na odplatu, nie na príkaz. CTA je platba za pozornosť — ak pozornosť nedostali nazad, platba neprejde.",
    whenNotSk: "Pri reklame na výkon: tam je CTA meraná konverziou, takže treba merať, nie odhadovať.",
    platforms: ["TIKTOK", "REELS", "ADS"],
    niches: ["sluzby", "ecommerce", "osobny-brand"],
  },
  {
    id: "retention-curve",
    titleSk: "Diery v retencii ukazujú, kde si stratila diváka",
    whatSk: "Sleduj miesta, kde ľudia odchádzajú. Nie je to nálada publika, ale konkrétne sekundy.",
    whySk: "Retenčná krivka je meradlo, nie pocit. Každý skok nadol má príčinu v konkrétnom zábere alebo vete.",
    whenNotSk: "Pri malom počte zobrazení (< 1 000) je krivka šum — z nej sa nič rozumné vyčítať nedá.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "YOUTUBE_LONG", "ADS"],
    niches: ["univerzalne"],
  },
  {
    id: "context-cost",
    titleSk: "Kontext nie je nuda, ale platí sa zaň časom",
    whatSk: "Divák nestrávi s videom energiu navyše. Každá veta, ktorá len uvádza, je daň.",
    whySk: "Pri 15 000 klipoch denne nikto nie je ochotný čakať na rozbeh. Rozbeh je práve to, čo profesionál strihá najčastejšie.",
    whenNotSk: "B2B a dlhé vzdelávacie videá: kontext je tam často celý produkt (napr. právne upozornenia).",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["univerzalne", "b2b"],
  },
  {
    id: "authenticity-beats-polish",
    titleSk: "Dôveryhodnosť poráža lesk",
    whatSk: "Mierne nedokonalý záber, reálna reč a konkrétne miesto pôsobia dôveryhodnejšie než čistý štúdiový obraz.",
    whySk: "Divák si všimne, keď je niečo „kampaň“. Autenticita je preto najsilnejší prvok UGC reklamy.",
    whenNotSk: "Luxus a firemná identita: tam je lesk súčasťou produktu. (Aj tak: ľudský hlas nikdy nezaškodí.)",
    platforms: ["TIKTOK", "REELS", "ADS"],
    niches: ["ecommerce", "sluzby", "fitness", "krasa"],
  },
  {
    id: "loop-friendly",
    titleSk: "Koniec, ktorý sa napojí na začiatok",
    whatSk: "Ak posledná veta prirodzene vedie k prvej, prehrávanie sa zopakuje — a to algoritmus vidí.",
    whySk: "Opakované prehratie = nové zobrazenie a vyšší watch time. Je to legitímne, ak to nie je podvod a video dáva zmysel.",
    whenNotSk: "Tematické a vzdelávacie klipy, kde je zjavné, že ide o trik: pôsobí to ako podvod a komentáre sú brutálne.",
    platforms: ["TIKTOK", "REELS", "SHORTS"],
    niches: ["osobny-brand", "gastro", "krasa"],
  },
  {
    id: "comment-bait-honest",
    titleSk: "Otázka, na ktorú sa dá odpovedať v jednej vete",
    whatSk: "Nekonči len tým, že video skončilo. Daj divákovi dovnútra jednoduchú otázku, na ktorú vedia odpovedať bez premýšľania.",
    whySk: "Komentáre sú druhý najsilnejší signál po dohľadaní. Ľudia nekomentujú, keď nevedia, čo napísať.",
    whenNotSk: "Kontroverzná téma: otázka nesmie vyzerať ako pozvánka na hádku, lebo to otravuje komunitu.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "YOUTUBE_LONG"],
    niches: ["univerzalne"],
  },
];

// ============================================================
// 2) HOOK VZORCE — dajú sa použiť hneď, v reči klienta
// ============================================================

export interface HookFormula {
  id: string;
  titleSk: string;
  templateSk: string;
  exampleSk: string;
  whySk: string;
  riskSk: string;
  platforms: TrendPlatform[];
  niches: Niche[];
}

export const HOOK_FORMULAS: HookFormula[] = [
  {
    id: "mistake",
    titleSk: "Chyba, ktorú robíš",
    templateSk: "[Konkrétna činnosť] robíš zle a ani o tom nevieš.",
    exampleSk: "Pri strihaní Reels zbytočne čakáš na rozbeh — a to ťa stojí prvých 3 sekundy.",
    whySk: "Každý chce vedieť, či nie je ten, kto niečo robí zle. Chyba je osobná, ale nie útočná.",
    riskSk: "Nesmieš obviňovať diváka. Vina musí ležať na situácii, nie na ňom.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["sluzby", "vzdelavanie", "osobny-brand"],
  },
  {
    id: "before-after",
    titleSk: "Pred a po (bez reči)",
    templateSk: "Ukáž výsledok → prvý frame → potom proces.",
    exampleSk: "Prvá sekunda: hotový výsledok. Zvyšok: ako si sa tam dostal.",
    whySk: "Divák dostane dôkaz hneď a proces ho zaujíma preto, lebo už vidí, že má zmysel.",
    riskSk: "Nefunguje, ak je rozdiel nepatrný. Divák to zistí do 2 s.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["sluzby", "fitness", "krasa", "gastro", "nehnutelnosti"],
  },
  {
    id: "cost-of-inaction",
    titleSk: "Koľko ťa stojí nečinnosť",
    templateSk: "Každý [časové obdobie] prídeš o [konkrétna hodnota].",
    exampleSk: "Každý týždeň prídeš o 4 hodiny, ktoré mohla stihnúť ďalšie klientské video.",
    whySk: "Strata bolí viac než zisk. Konkrétny údaj z toho robí fakt, nie pocit.",
    riskSk: "Prehnané čísla zabijú dôveru — ak si ich nevieš obhájiť, použi rozsah.",
    platforms: ["TIKTOK", "REELS", "ADS"],
    niches: ["b2b", "sluzby", "ecommerce"],
  },
  {
    id: "secret",
    titleSk: "Tajomstvo / trik profesionálov",
    templateSk: "Profesionáli [odbor] robia jednu vec, o ktorej sa verejne nehovorí.",
    exampleSk: "Profesionálni editori vždy strihajú rozbeh vety, nikdy celý úvod.",
    whySk: "Efekt „vnútornej informácie“ dáva divákovi pocit výhody.",
    riskSk: "Musí to byť pravda a naozaj konkrétne — inak ide o clickbait a algoritmus to spozná podľa odchodov.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "YOUTUBE_LONG"],
    niches: ["vzdelavanie", "osobny-brand", "sluzby"],
  },
  {
    id: "myth-bust",
    titleSk: "Bežný mýtus, ktorý treba zbúrať",
    templateSk: "Všetci hovoria, že [mýtus]. Nie je to pravda, a tu je prečo.",
    exampleSk: "Hovorí sa, že na TikTok treba tancovať. Prvá sekunda vety porazí choreografiu.",
    whySk: "Protirečenie vyvolá okamžitú pozornosť a túžbu dokončiť vetu.",
    riskSk: "Nesmie byť postavený na niekom konkrétnom — útočenie na ľudí sa obráti proti tebe.",
    platforms: ["TIKTOK", "SHORTS", "YOUTUBE_LONG", "REELS"],
    niches: ["vzdelavanie", "osobny-brand", "fitness", "krasa"],
  },
  {
    id: "direct-question",
    titleSk: "Priama otázka do publika",
    templateSk: "Stáva sa ti, že [presná situácia]?",
    exampleSk: "Sedíš nad 40-minútovým RAW a nevieš, kde začať?",
    whySk: "Otázka v prvej sekunde vytvorí v hlave diváka „áno“ a tým aj záväzok zostať.",
    riskSk: "Otázka musí byť taká presná, aby si väčšina povedala áno. Príliš široká otázka nezachytí nikoho.",
    platforms: ["TIKTOK", "REELS", "ADS", "YOUTUBE_LONG"],
    niches: ["sluzby", "osobny-brand", "vzdelavanie"],
  },
  {
    id: "number-list",
    titleSk: "Tri veci / číslo v nadpise",
    templateSk: "3 veci, ktoré urobia [výsledok] — a nikto ich nepoužíva.",
    exampleSk: "3 strihy, ktoré z každého klipu spravia kratší a silnejší.",
    whySk: "Číslo dáva predpovedateľnú štruktúru. Divák vie, čo ho čaká, a preto zostane.",
    riskSk: "Ak je vecí naozaj len dve, pozná to — a stratí dôveru. Slúb presne toľko, koľko dáš.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "YOUTUBE_LONG"],
    niches: ["vzdelavanie", "b2b", "sluzby"],
  },
  {
    id: "visual-reveal",
    titleSk: "Vizuálne odhalenie",
    templateSk: "Začni najzaujímavejším záberom bez vysvetlenia. Vysvetlenie príde o 2 s.",
    exampleSk: "Detail ruky, ktorá strihá presne na reč — bez reči.",
    whySk: "Zvedavosť vznikne skôr z obrazu než z vety. Obraz nepotrebuje jazykovú bariéru.",
    riskSk: "Musí byť zrozumiteľný v kontexte do 2 s, inak pôsobí ako náhodný záber.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["gastro", "fitness", "krasa", "nehnutelnosti", "ecommerce"],
  },
  {
    id: "price-truth",
    titleSk: "Koľko to naozaj stojí",
    templateSk: "Toto stojí [suma] — a tu je celý rozpis.",
    exampleSk: "Tento klip stál 0 € a 20 minút môjho času. Tu je postup.",
    whySk: "Cena je najčastejšia nezodpovedaná otázka. Keď ju zodpovieš, si dôveryhodný.",
    riskSk: "Ak cenu zatajíš, komentáre sa zmenia na výsluch. Radšej povedz rozsah.",
    platforms: ["TIKTOK", "REELS", "ADS"],
    niches: ["sluzby", "ecommerce", "b2b", "nehnutelnosti"],
  },
  {
    id: "one-sentence-promise",
    titleSk: "Sľub v jednej vete",
    templateSk: "Za [krátky čas] budeš mať [konkrétny výsledok].",
    exampleSk: "Za 20 minút budeš mať hotový strih na tri platformy.",
    whySk: "Konkrétny čas a výsledok dovolia divákovi rozhodnúť sa v jednej sekunde.",
    riskSk: "Nesľubuj nemožné. Video o tom, ako niečo nevyšlo, môže fungovať ešte lepšie.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS", "YOUTUBE_LONG"],
    niches: ["univerzalne"],
  },
  {
    id: "client-voice",
    titleSk: "Hlas klienta (citát)",
    templateSk: "Začni presnou vetou klienta v úvodzovkách.",
    exampleSk: "„Toto sa mi nikdy nestihlo dokončiť.“ — a potom riešenie.",
    whySk: "Cudzia veta je dôkaz, nie tvrdenie. Znie ako realita, nie ako reklama.",
    riskSk: "Len so súhlasom klienta. Vymyslený citát je podvod a zistí sa to.",
    platforms: ["ADS", "REELS", "TIKTOK"],
    niches: ["b2b", "sluzby", "ecommerce"],
  },
  {
    id: "mistake-in-process",
    titleSk: "Otvorený proces vrátane zlyhania",
    templateSk: "Ukáž aj to, čo sa nepodarilo. Prvý pokus bol zlý — tu je prečo.",
    whySk: "Zlyhanie robí video vierohodné a divák sa v ňom nájde.",
    riskSk: "Zlyhanie nesmie vyzerať ako nedbalosť voči klientovi.",
    exampleSk: "Prvý strih bol o 20 s dlhší a stratil pointu. Tu je rozdiel.",
    platforms: ["TIKTOK", "SHORTS", "REELS", "YOUTUBE_LONG"],
    niches: ["osobny-brand", "vzdelavanie", "sluzby"],
  },
];

// ============================================================
// 3) FORMÁTY — konkrétne, s dátumom overenia (dnešné trendy)
// ============================================================

export const TREND_LIBRARY_VERIFIED_AT = "2026-09-28";

export interface TrendFormat {
  id: string;
  titleSk: string;
  howSk: string;
  whySk: string;
  effortSk: string;
  riskSk: string;
  platforms: TrendPlatform[];
  niches: Niche[];
}

export const FORMATS: TrendFormat[] = [
  {
    id: "raw-to-ready-pov",
    titleSk: "RAW → READY v jednom zábere (time-lapse strihu)",
    howSk: "Ukáž surový materiál a potom zrýchlene proces strihu. Bez hudobnej dramaturgie, len rytmu.",
    whySk: "Divák vidí hodnotu práce a to, ako sa zo „surového balastu“ stane výsledok. Patrí to medzi najvernejšie formáty procesu.",
    effortSk: "30 min",
    riskSk: "Proces musí byť reálny. Zrýchlenie nesmie zakryť, že sa nič nedeje.",
    platforms: ["TIKTOK", "REELS", "SHORTS"],
    niches: ["sluzby", "osobny-brand", "vzdelavanie"],
  },
  {
    id: "three-cuts",
    titleSk: "Tri strihy, ktoré zmenia klip",
    howSk: "Jeden záber, tri ukážky: pred / po každom strihu s popisom, prečo.",
    whySk: "Vzdelávací formát s okamžitým dôkazom. Funguje, lebo je použiteľný pre iných.",
    effortSk: "20 min",
    riskSk: "Nesmie byť len o efektoch. Musí ukázať dôvod, nie estetiku.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "YOUTUBE_LONG"],
    niches: ["vzdelavanie", "osobny-brand", "sluzby"],
  },
  {
    id: "screen-narration",
    titleSk: "Obrazovka + hlas (screen narration)",
    howSk: "Nahrávaj obrazovku editora a hovor, čo robíš a prečo (nie „kliknem tu“).",
    whySk: "Najnižší vstupný práh na produkciu a najvyššia hustota informácie pre publikum, ktoré chce robiť to isté.",
    effortSk: "15 min",
    riskSk: "Musíš hovoriť o rozhodnutiach, nie o ovládaní. Inak je to nudné.",
    platforms: ["SHORTS", "YOUTUBE_LONG", "TIKTOK"],
    niches: ["vzdelavanie", "b2b", "osobny-brand"],
  },
  {
    id: "before-after-reveal",
    titleSk: "Pred / po s rozmazaním na začiatku",
    howSk: "Prvých 1,5 s nechaj výsledok rozmazaný alebo odstrihnutý. Odhalenie príde hneď potom.",
    whySk: "Zvedavosť + dôkaz v jednej sekvencii. Divák musí zostať, aby videl rozdiel.",
    effortSk: "20 min",
    riskSk: "Rozdiel musí byť viditeľný aj na malom displeji.",
    platforms: ["TIKTOK", "REELS", "SHORTS", "ADS"],
    niches: ["krasa", "fitness", "nehnutelnosti", "gastro", "sluzby"],
  },
  {
    id: "client-reaction",
    titleSk: "Reakcia klienta na prvý strih",
    howSk: "Autentická reakcia (so súhlasom), potom ukážka záberu, ktorá ju spôsobila.",
    whySk: "Sociálny dôkaz v neupravenej podobe. Dôveryhodnosť je najvyššia z možných.",
    effortSk: "20 min",
    riskSk: "Len so súhlasom a bez zosmiešňovania. Reakcia musí byť skutočná.",
    platforms: ["ADS", "REELS", "TIKTOK"],
    niches: ["sluzby", "b2b", "osobny-brand"],
  },
  {
    id: "cost-breakdown",
    titleSk: "Rozpis ceny na obrazovke",
    howSk: "Krok za krokom na obrazovke: koľko stojí čas, nástroje, koľko by stál človek.",
    whySk: "Odpovedá na najčastejšiu otázku a robí z ceny fakt, nie dohad.",
    effortSk: "25 min",
    riskSk: "Čísla musia byť pravdivé a aktuálne.",
    platforms: ["TIKTOK", "REELS", "YOUTUBE_LONG", "ADS"],
    niches: ["sluzby", "b2b", "ecommerce"],
  },
  {
    id: "one-take-teaching",
    titleSk: "Jedna technika, jeden záber, jedna veta",
    howSk: "Bez prestrihov vo vnútri vety. Strihy len medzi myšlienkami — čistý rez.",
    whySk: "Pôsobí profesionálne a pokojne. Vhodné pre publikum, ktoré je unavené z rýchlosti.",
    effortSk: "10 min",
    riskSk: "Nesmie byť nudné: bez zmeny framing budeš potrebovať silnú vetu každých 5 s.",
    platforms: ["YOUTUBE_LONG", "SHORTS", "REELS"],
    niches: ["b2b", "vzdelavanie", "sluzby"],
  },
  {
    id: "objection-answer",
    titleSk: "Námietka, ktorú si každý myslí nahlas",
    howSk: "Pomenuj presnú námietku („je to drahé“) a odpovedz v 10 sekundách.",
    whySk: "Odstráni prekážku predtým, než sa objaví. Funguje v predaji aj v obsahu.",
    effortSk: "15 min",
    riskSk: "Odpoveď musí byť konkrétna — inak si len priznal problém.",
    platforms: ["ADS", "REELS", "TIKTOK"],
    niches: ["sluzby", "ecommerce", "b2b"],
  },
  {
    id: "behind-the-numbers",
    titleSk: "Čísla za projektom",
    howSk: "Reálne čísla: koľko hodín, koľko verzií, koľko strihov.",
    whySk: "Konkrétne čísla pôsobia ako dôkaz a zároveň vzdelávajú o náročnosti práce.",
    effortSk: "20 min",
    riskSk: "Nezverejňuj údaje klientov bez súhlasu.",
    platforms: ["TIKTOK", "REELS", "YOUTUBE_LONG"],
    niches: ["b2b", "osobny-brand", "sluzby"],
  },
  {
    id: "loop-teach",
    titleSk: "Slučka: koniec = začiatok (vzdelávacia)",
    howSk: "Posledná veta prirodzene vedie k prvej otázke. Video tak funguje aj po druhom prehratí.",
    whySk: "Opakované zhliadnutie je legitímny bonus a neznižuje kvalitu, ak obsah drží.",
    effortSk: "20 min",
    riskSk: "Nesmie to byť trik. Ak koniec nemá logiku, pôsobí ako manipulácia.",
    platforms: ["TIKTOK", "REELS", "SHORTS"],
    niches: ["vzdelavanie", "osobny-brand"],
  },
];

// ============================================================
// 4) RED FLAGS — čo virálne nikdy nie je
// ============================================================

export interface RedFlag {
  id: string;
  titleSk: string;
  whatSk: string;
  fixSk: string;
}

export const RED_FLAGS: RedFlag[] = [
  {
    id: "logo-intro",
    titleSk: "Intro s logom na začiatku",
    whatSk: "Prvé sekundy patria logu alebo animácii.",
    fixSk: "Presuň branding na koniec alebo do titulku v obraze. Prvá sekunda musí niesť obsah.",
  },
  {
    id: "greeting",
    titleSk: "Pozdrav a predstavovanie",
    whatSk: "„Ahoj, som X a dnes si povieme…“",
    fixSk: "Začni vetou, ktorú si divák uloží. Predstavenie patrí do textu alebo na koniec.",
  },
  {
    id: "warm-up",
    titleSk: "Rozbeh vety („takže, ehm, vlastne…“)",
    whatSk: "Prvé slovo je výplň.",
    fixSk: "Vystrihni rozbeh. Vo väčšine prípadov 0,4–1,5 s stačí a pointa zostane celá.",
  },
  {
    id: "no-subtitles",
    titleSk: "Žiadne titulky",
    whatSk: "Video dáva zmysel, len keď ho počuješ.",
    fixSk: "Pridaj titulky s dôrazom na kľúčové slová. Nie všetko rovnako veľké.",
  },
  {
    id: "flat-pacing",
    titleSk: "Rovnaké tempo celých 30 sekúnd",
    whatSk: "Žiadna zmena framingu, hudby ani zvuku.",
    fixSk: "Pridaj jednu zmenu na 3–7 s: punch-in, zvuk, záber, alebo skrátenie.",
  },
  {
    id: "vague-cta",
    titleSk: "Vágna výzva („sleduj ma“)",
    whatSk: "CTA bez konkrétnej akcie.",
    fixSk: "Požiadaj o jednu konkrétnu vec, ktorú vie spraviť do 3 sekúnd.",
  },
  {
    id: "no-proof",
    titleSk: "Tvrdenie bez dôkazu",
    whatSk: "„Je to najlepší nástroj.“ Bez dôvodu.",
    fixSk: "Pridaj konkrétnosť alebo ukážku na obrazovke. Rovnaké tvrdenie s dôkazom pôsobí úplne inak.",
  },
  {
    id: "mismatched-text-video",
    titleSk: "Text v nadpise nesedí s videom",
    whatSk: "Titulok sľubuje niečo iné, než video dáva.",
    fixSk: "Sľub v nadpise musí byť splnený v prvých 5 s, inak je to podvod a algoritmus to vidí na odchodoch.",
  },
];

// ============================================================
// 5) KONTROLA VIRALITY — deterministická, 0 tokenov
// ============================================================

/** Minimálny tvar zásahu — aby kontrola nebola viazaná na konkrétny komponent. */
export interface PlanItemLike {
  type: string;
  start: number;
  end?: number;
  label?: string;
}

export interface ViralityCheck {
  id: string;
  labelSk: string;
  status: "pass" | "warn" | "fail";
  detailSk: string;
  fixSk?: string;
  whySk: string;
}

export interface ViralityAudit {
  platform: TrendPlatform;
  score: number; // 0–100, vážený (pass = 1, warn = 0,5)
  checks: ViralityCheck[];
  summarySk: string;
}

/**
 * Kontroluje PLÁN, nie video. Je to poctivé: vieme povedať, čo v pláne chýba,
 * a presne to aj pomenujeme. Žiadne „skóre z ničoho“.
 */
export function auditPlanForVirality(
  plan: PlanItemLike[],
  platform: TrendPlatform,
  durationSec: number,
): ViralityAudit {
  const spec = getPlatform(platform);
  const duration = Math.max(1, durationSec);
  const items = plan || [];
  const byType = (t: string) => items.filter((i) => i.type === t);
  const checks: ViralityCheck[] = [];

  // 1) Hook do 3 s
  const hook = byType("HOOK").sort((a, b) => a.start - b.start)[0];
  if (hook && hook.start <= 3) {
    checks.push({
      id: "hook-3s",
      labelSk: "Hook v prvých 3 sekundách",
      status: "pass",
      detailSk: `Hook je na ${hook.start.toFixed(1)} s — v správnom okne.`,
      whySk: "Väčšina odchodov sa deje v prvých sekundách, preto musí byť najsilnejšia veta hneď na začiatku.",
    });
  } else if (hook) {
    checks.push({
      id: "hook-3s",
      labelSk: "Hook v prvých 3 sekundách",
      status: "warn",
      detailSk: `Hook je až na ${hook.start.toFixed(1)} s — neskoro.`,
      fixSk: "Presuň hook na začiatok videa alebo prehoď poradie v úvode.",
      whySk: "Po 3 sekundách už divák rozhodnutý odísť.",
    });
  } else {
    checks.push({
      id: "hook-3s",
      labelSk: "Hook v prvých 3 sekundách",
      status: "fail",
      detailSk: "V pláne nie je žiadny HOOK.",
      fixSk: "Pridaj HOOK: najsilnejšiu vetu presuň na začiatok (front-loading).",
      whySk: "Bez hooku nemá video dôvod držať diváka.",
    });
  }

  // 2) Prvá sekunda nie je obetovaná
  const openingCut = byType("CUT").find((c) => c.start <= 0.5 && (c.end ?? c.start + 1.5) >= 2.5);
  checks.push(
    openingCut
      ? {
          id: "first-second",
          labelSk: "Prvá sekunda nesie obsah",
          status: "warn",
          detailSk: `Plán strihá ${(openingCut.end ?? 2.5).toFixed(1)} s na úplnom začiatku.`,
          fixSk: "Nechaj na začiatku pointu a strihni len rozbeh (max ~1,5 s).",
          whySk: "Prvá sekunda je najdrahšia — nemá sa minúť na výplň.",
        }
      : {
          id: "first-second",
          labelSk: "Prvá sekunda nesie obsah",
          status: "pass",
          detailSk: "Plán necháva začiatok videa čistý.",
          whySk: "Začiatok nesmie byť obetovaný výplni ani logu.",
        },
  );

  // 3) Titulky
  const hasCaptions = byType("CAPTION").length > 0;
  checks.push({
    id: "captions",
    labelSk: "Titulky pre režim bez zvuku",
    status: hasCaptions ? "pass" : "fail",
    detailSk: hasCaptions ? "Plán obsahuje titulky." : "V pláne nie sú titulky.",
    fixSk: hasCaptions ? undefined : "Zapni titulky s dôrazom na kľúčové slová.",
    whySk: "Veľká časť zobrazení prebieha bez zvuku; titulky držia pozornosť aj bez sluchu.",
  });

  // 4) Tempo (strihy za minútu) vs platforma
  const cutCount = byType("CUT").length;
  const cutsPerMinute = cutCount / (duration / 60);
  const [lo, hi] = spec.idealCutsPerMinute;
  const tempoOk = cutsPerMinute >= lo && cutsPerMinute <= hi;
  checks.push({
    id: "tempo",
    labelSk: `Tempo (${spec.labelSk})`,
    status: tempoOk ? "pass" : "warn",
    detailSk: `Plán má ${cutCount} strihov za ${(duration / 60).toFixed(1)} min = ${cutsPerMinute.toFixed(1)} / min. Odporúčanie pre ${spec.labelSk}: ${lo}–${hi} / min.`,
    fixSk: tempoOk
      ? undefined
      : cutsPerMinute < lo
        ? "Pridaj strihy na výplni a rozbehoch — tempo je pomalé pre tento formát."
        : "Uberá zásahy: pri takom tempe začne byť strih nervózny a divák sa stratí v kontexte.",
    whySk: `Každá platforma má vlastný spád: ${spec.noteSk}`,
  });

  // 5) Framing / zmena obrazu
  const zooms = byType("ZOOM").length;
  const zoomsNeeded = Math.max(1, Math.floor(duration / 60));
  checks.push({
    id: "framing",
    labelSk: "Zmena framingu (punch-in)",
    status: zooms >= zoomsNeeded ? "pass" : zooms > 0 ? "warn" : "fail",
    detailSk: `Plán má ${zooms} punch-in na ${Math.round(duration)} s (odporúčané aspoň ${zoomsNeeded}).`,
    fixSk: zooms >= zoomsNeeded ? undefined : "Pridaj punch-in na najsilnejšiu vetu — stačí jedna na minútu.",
    whySk: "Zmena framingu preruší vzorec pozornosti bez toho, aby si pridal efekt.",
  });

  // 6) Zvukový akcent
  const sfx = byType("SFX").length;
  const sfxNeeded = platform === "ADS" ? 2 : 1;
  checks.push({
    id: "sound-accent",
    labelSk: "Zvukový akcent",
    status: sfx >= sfxNeeded ? "pass" : "warn",
    detailSk: `Plán má ${sfx} zvukový akcent (odporúčané aspoň ${sfxNeeded}).`,
    fixSk: sfx >= sfxNeeded ? undefined : "Pridaj akcent na prechod alebo na pointu — zakryje strih a zvýrazní pointu.",
    whySk: "Zvuk zakryje strih, takže divák ho nepostrehne — strih potom pôsobí plynulo.",
  });

  // 7) Dĺžka vs platforma
  const lengthOk = duration >= spec.minSeconds && duration <= spec.maxSeconds;
  checks.push({
    id: "length",
    labelSk: `Dĺžka pre ${spec.labelSk}`,
    status: lengthOk ? "pass" : "warn",
    detailSk: `${Math.round(duration)} s (odporúčané ${spec.minSeconds}–${spec.maxSeconds} s, sladká zóna ${spec.sweetSpotSk}).`,
    fixSk: lengthOk
      ? undefined
      : duration > spec.maxSeconds
        ? `Skráť na ${spec.sweetSpotSk} alebo rozdeľ na viac klipov.`
        : "Video je príliš krátke na to, aby stihlo sľub — doplň kontext alebo spoj s ďalším klipom.",
    whySk: "Dĺžka určuje, akú štruktúru divák očakáva. Krátky klip musí mať jednu myšlienku, dlhý musí mať kapitoly.",
  });

  // 8) Podiel vystrihnutého materiálu (agresivita)
  const cutSeconds = byType("CUT").reduce(
    (sum, c) => sum + Math.max(0, (c.end ?? c.start + 1.5) - c.start),
    0,
  );
  const removedShare = cutSeconds / duration;
  const shareStatus: ViralityCheck["status"] =
    removedShare === 0 ? "fail" : removedShare > 0.35 ? "warn" : "pass";
  checks.push({
    id: "removed-share",
    labelSk: "Podiel vystrihnutého materiálu",
    status: shareStatus,
    detailSk: `Plán vystrihne ${cutSeconds.toFixed(1)} s z ${Math.round(duration)} s (${(removedShare * 100).toFixed(1)} %).`,
    fixSk:
      shareStatus === "fail"
        ? "Nič sa nestrihá — pozri výplň a rozbehy viet; práve tam sa zvyčajne skrývajú prvé sekundy zisku."
        : shareStatus === "warn"
          ? "Striháš viac než tretinu videa. Skontroluj, či po strihoch zostáva pointa celá."
          : undefined,
    whySk: "Zdravý strih z RAW materiálu zvyčajne odstráni 5–25 % času. Viac znamená riziko straty kontextu.",
  });

  // 9) Uzáver / CTA
  const tail = items.filter((i) => i.start >= duration * 0.8);
  const hasTailPlan = tail.length > 0;
  checks.push({
    id: "ending",
    labelSk: "Uzáver (CTA alebo pointa)",
    status: hasTailPlan ? "pass" : "warn",
    detailSk: hasTailPlan
      ? `V posledných 20 % videa je ${tail.length} zásahov — uzáver je pokrytý.`
      : "Plán nerieši posledných 20 % videa.",
    fixSk: hasTailPlan ? undefined : "Naplánuj uzáver: pointa alebo jedna konkrétna výzva (nekonči len tým, že video skončilo).",
    whySk: "Uzáver rozhoduje o komentároch a o tom, či si divák pozrie ďalšie video.",
  });

  // 10) Samostatný klip (highlight)
  if (platform !== "YOUTUBE_LONG") {
    const highlights = byType("HIGHLIGHT").length;
    checks.push({
      id: "standalone",
      labelSk: "Aspoň jeden samostatný klip",
      status: highlights > 0 ? "pass" : "warn",
      detailSk: highlights > 0 ? `Plán označil ${highlights} highlight.` : "Plán neoznačil žiadny samostatný klip.",
      fixSk: highlights > 0 ? undefined : "Označ najsilnejšiu vetu ako HIGHLIGHT — použiješ ju ako samostatný krátky klip.",
      whySk: "Jeden silný moment často funguje lepšie ako celé video a lacno z neho spravíš ďalší výstup.",
    });
  }

  const weights: Record<ViralityCheck["status"], number> = { pass: 1, warn: 0.5, fail: 0 };
  const score = Math.round(
    (checks.reduce((sum, c) => sum + weights[c.status], 0) / Math.max(1, checks.length)) * 100,
  );

  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  const summarySk =
    fails === 0 && warns === 0
      ? `Plán prešiel všetkými kontrolami pre ${spec.labelSk}. Skóre ${score} / 100.`
      : `Skóre ${score} / 100 pre ${spec.labelSk}: ${fails} vážnych dier, ${warns} odporúčaní na doladenie. Nižšie je presne to, čo opraviť — a prečo.`;

  return { platform, score, checks, summarySk };
}

// ============================================================
// 6) POMOCNÉ — výber relevantných položiek pre niche
// ============================================================

function matches<T extends { platforms: TrendPlatform[]; niches: Niche[] }>(
  item: T,
  platform: TrendPlatform,
  niche: Niche,
): boolean {
  const platformOk = item.platforms.includes(platform);
  const nicheOk = item.niches.includes(niche) || item.niches.includes("univerzalne") || niche === "univerzalne";
  return platformOk && nicheOk;
}

export function getTrendPack(platform: TrendPlatform, niche: Niche) {
  return {
    platform,
    niche,
    spec: getPlatform(platform),
    verifiedAt: TREND_LIBRARY_VERIFIED_AT,
    principles: PRINCIPLES.filter((p) => matches(p, platform, niche)),
    hooks: HOOK_FORMULAS.filter((h) => matches(h, platform, niche)),
    formats: FORMATS.filter((f) => matches(f, platform, niche)),
    redFlags: RED_FLAGS,
  };
}
