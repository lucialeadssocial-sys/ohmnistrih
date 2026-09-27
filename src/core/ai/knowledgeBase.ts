/**
 * Knowledge Base & Edit Academy Explanation Engine
 * Grounding explanations with WHAT, WHY, WHEN, WHEN_NOT, HOW, SK+GLOBAL context, and provenance.
 */

import { TeachMeExplanation, CreativePattern } from './analysisTypes';

export const EDIT_KNOWLEDGE_BASE: Record<string, TeachMeExplanation> = {
  J_CUT: {
    topic: 'J-Cut (Audio Lead)',
    principle: 'Zvuk nasledujúceho záberu začína skôr než sa zmení obraz.',
    context: 'Prechody medzi hovoriacimi osobami alebo úvod do novej scény.',
    explanation: 'J-cut vytvára plynulejšiu vizuálnu naratívu tým, že poslucháča najprv pripraví zvukovým podnetom.',
    why: 'Ľudský mozog spracováva zvukové zmeny prirodzenejšie ak obraz nasleduje tesne po zvuku, čím sa eliminuje pocit "tvrdého strihu".',
    whenToUse: 'Pri rozhovoroch, pri prechode na novú tému, alebo pri uvedení B-roll materiálu.',
    whenNotToUse: 'Pri rýchlych rytmických sekvenciách (montážach) alebo dramatičnosti skokového záberu (Jump Cut).',
    example: 'V 00:12s už počujeme hlas nového rečníka, zatiaľ čo obraz sa zmení až v 00:13.5s.',
    antiPattern: 'Slepé synchronizovanie zvuku a videa presne na rovnaký frame pri každom strihu.',
    source: 'Walter Murch — In the Blink of an Eye',
    sourceType: 'editorial_guideline',
    region: 'GLOBAL',
    platformTarget: 'General',
    confidence: 0.98,
    category: 'professional_convention',
    manualWorkflowSteps: [
      '1. Na timeline označ video a audio klip v mieste prechodu.',
      '2. Stlač tlačidlo Oddeliť Audio/Video (alebo rozpoj A/V zamknutím stopy).',
      '3. Posuň začiatočný bod (In-point) zvuku na stope A1 o 1.0s – 1.5s vľavo pred obrazový strih.',
      '4. Ponechaj video strih na stope V1 na pôvodnom mieste.',
      '5. Pridaj 0.2s Fade-in na začiatok posunutého audia pre hladký nábeh.',
      '6. Prehraj prechod 2 sekundy pred a po strihu a skontroluj prirodzenosť toku slov.'
    ],
    alternativeChoices: [
      'Použiť L-cut (zvuk predchádzajúceho záberu presahuje do nového obrazu).',
      'Použiť rovný strih (Hard Cut) s krátkym zvukovým prechodom (Crossfade 0.1s).'
    ]
  },
  L_CUT: {
    topic: 'L-Cut (Video Lead / Audio Extension)',
    principle: 'Obraz sa zmení na nový záber, ale zvuk pôvodného hovorcu/scény ešte na chvíľu pokračuje.',
    context: 'Reakčné zábery, doznievanie myšlienky rečníka, prechody v rozhovoroch.',
    explanation: 'L-cut umožňuje vidieť reakciu druhej osoby alebo nový obraz, zatiaľ čo prvá osoba dokončuje vetu.',
    why: 'Udržuje citové a naratívne prepojenie medzi dvoma zábormi bez prerušenia toku myšlienky.',
    whenToUse: 'Pri reakčných záberoch (Reaction shots) alebo keď chceme ukázať kontext pred zmenou rečníka.',
    whenNotToUse: 'Keď je kľúčové vidieť ústa hovorcu pre odčítanie výrazu pri vyvrcholení.',
    example: 'Rečník povie "...a to je ten hlavný dôvod", obraz sa zmení na poslucháča v čase "...hlavný dôvod", ale hlas doznieva pod novým obrazom.',
    antiPattern: 'Prestrihnutie obrazu presne v momente, keď sa zastaví zvuk rečníka.',
    source: 'Academy of Motion Picture Arts & Sciences Film Editing Manual',
    sourceType: 'industry_standard',
    region: 'GLOBAL',
    platformTarget: 'General',
    confidence: 0.96,
    category: 'professional_convention',
    manualWorkflowSteps: [
      '1. Nájdi edit point dvoch nadväzujúcich klipov na timeline.',
      '2. Rozpoj audio a video stopu (Unlink A/V alebo použi oddelené stopy).',
      '3. Posuň In-point nového video klipu na stope V1 o 1.0s vľavo (skôr než skončí audio predchádzajúceho klipu).',
      '4. Ponechaj audio predchádzajúceho klipu na stope A1 nedotknuté, aby dobiehalo pod novým obrazom.',
      '5. Pridaj jemný Crossfade 0.2s na audio prechod.',
      '6. Prehraj sekvenciu a over, či reakcia alebo nový obraz esteticky ladí s dobiehajúcim hlasom.'
    ],
    alternativeChoices: [
      'Použiť J-cut ak chceš najprv uviesť nový zvuk.',
      'Aplikovať B-roll overlay nad dobiehajúci hlas.'
    ]
  },
  PAUSE_TRIMMING: {
    topic: 'Odstránenie Neprirodzených Pauz',
    principle: 'Skrátenie dlhých pomlčiek a váhania v reči bez narušenia prirodzeného dýchania.',
    context: 'Hovorené slovo, e-learning, UGC, reklamné spoty.',
    explanation: 'Rytmus reči má priamy vplyv na retenciu diváka. Váhanie a ticho nad 1.2s znižujú pozornosť.',
    why: 'Divák v online prostredí očakáva dynamický tok informácií. Krátke pauzy udržujú napätie, príliš dlhé spôsobujú odchod.',
    whenToUse: 'Pri nechcených pomlčkách, nádychoch a hezitáciách ("ehm", "ee").',
    whenNotToUse: 'Pri dramatických pauzách pred kľúčovou pointou alebo emocionálnym vyvrcholením.',
    example: 'Pauza 1.8s medzi vetami skrátená na 0.4s zachováva dych, ale zrýchľuje tempo.',
    antiPattern: 'Vymazanie všetkých pauz na 0s, čo spôsobí robotický a nepřirozený prejav.',
    source: 'BBC Film & Editing Guidelines',
    sourceType: 'industry_standard',
    region: 'GLOBAL',
    platformTarget: 'TikTok / YouTube Shorts',
    confidence: 0.95,
    category: 'heuristic',
    manualWorkflowSteps: [
      '1. Presuň playhead na presný začiatok nepotrebnej pauzy v reči na timeline.',
      '2. Stlač kláves S (alebo vyber Razor Tool) pre vykonanie prvého rozstrihnutia.',
      '3. Posuň playhead na koniec pauzy, presne pred prvú slabiku nasledujúceho slova.',
      '4. Stlač opäť S pre druhý rozstrih.',
      '5. Klikni na vybraný úsek ticha a stlač Delete (alebo Ripple Delete pre automatický posun).',
      '6. Prehraj prechod od 1.5s pred strihom a skontroluj, či rečník znie prirodzene.'
    ],
    alternativeChoices: [
      'Ponechať pauzu a vložiť do nej vizuálny akcent alebo B-roll.',
      'Použiť mierne zrýchlenie clipu (Speed 1.15x) namiesto natvrdo vystrihnutia.'
    ]
  },
  BROLL_INSERTION: {
    topic: 'Aplikácia B-Rollu (Ilustračných Záberov)',
    principle: 'Vloženie vizuálneho materiálu podporujúceho hovorený text.',
    context: 'Vysvetľujúce videá, recenzie, dokumenty, vzdelávací obsah.',
    explanation: 'B-roll vizualizuje to, o čom hovorca rozpráva, čím zvyšuje porozumenie a vizuálnu pestrosť.',
    why: 'Kombinácia sluchového a vizuálneho kanálu (Dual-Coding Theory) zdvojnásobuje zapamätateľnosť informácie.',
    whenToUse: 'Keď rečník opisuje konkrétny objekt, proces, štatistiku alebo miesto dlhšie ako 3 sekundy.',
    whenNotToUse: 'Pri silnom emocionálnom očnom kontakte rečníka s kamerou v kľúčovom momente.',
    example: 'Keď rečník spomenie "rast predajov o 40%", zobrazí sa na 2s animovaný graf.',
    antiPattern: 'Pridávanie B-rollu, ktorý nesúvisí s rečou len kvôli tomu, aby sa "niečo hýbalo".',
    source: 'Murch Editorial Rules & Visual Cognition Studies',
    sourceType: 'academic',
    region: 'GLOBAL',
    platformTarget: 'YouTube / Educational',
    confidence: 0.96,
    category: 'professional_convention',
    manualWorkflowSteps: [
      '1. Nájdi na timeline časový úsek označený AI pre vloženie ilustrácie.',
      '2. Otvor Media Library a vyber vhodný B-roll klip (alebo vygeneruj v B-Roll Engine).',
      '3. Nastav In a Out body B-rollu na dĺžku hovorenej myšlienky (napr. 2.5s - 3.5s).',
      '4. Presuň klip na stopu V2 (B-Roll stopa) presne nad rečovú stopu V1.',
      '5. Uisti sa, že hlavná audio stopa A1 zostala nedotknutá a hovorca je plne počuteľný.',
      '6. Prehraj sekvenciu a over, či B-roll záber plynule dopĺňa reč.'
    ],
    alternativeChoices: [
      'Použiť Punch-in zoom na hlavnom zábere namiesto B-rollu.',
      'Vložiť textový callout / grafiku s kľúčovým slovom na stopu T1.'
    ]
  },
  HOOK_PUNCHIN: {
    topic: 'Punch-in Zoom (Dynamický Vizuálny Hook)',
    principle: 'Mierne zväčšenie záberu (105% - 115%) na začiatku kľúčovej vety alebo v prvých 3 sekundách.',
    context: 'Short-form videá, úvodné hooky, zdôraznenie hlavného argumentu.',
    explanation: 'Punch-in zoom skokovo zmení veľkosť záberu bez potreby druhého fotoaparátu, čím resetuje pozornosť diváka.',
    why: 'Zmena vizuálnej veľkosti v kľúčovom momente aktivuje orientačný reflex mozgu a bráni preskakovaniu (Scroll-Stop).',
    whenToUse: 'V prvých 3 sekundách videa, pri položení otázky alebo pri nečakanom tvrdení.',
    whenNotToUse: 'Pri uvoľnených, rozvážnych rozhovoroch alebo keď je záber už v tesnom detaile (Close-up).',
    example: 'V čase 00:00 - 00:03s sa Scale zmení zo 100% na 115%, tvár hovorcu je väčšia a výraznejšia.',
    antiPattern: 'Aplikovanie Punch-in zoomu každú sekundu bez ohľadu na obsah reči.',
    source: 'TikTok & YouTube Shorts Retention Benchmarks 2026',
    sourceType: 'platform_best_practice',
    region: 'GLOBAL',
    platformTarget: 'TikTok / Shorts / Reels',
    confidence: 0.94,
    category: 'trend_platform_pattern',
    manualWorkflowSteps: [
      '1. Nastav playhead na začiatok vety alebo hooku na V1.',
      '2. Stlač kláves S pre rozdelenie klipu na začiatku aj na konci hook úseku (napr. 0s až 3s).',
      '3. Kliknutím vyber rozdelený segment klipu na timeline.',
      '4. Otvor Inspector Panel (vpravo) a v záložke Transform zmeň parameter Scale zo 100% na 115%.',
      '5. Jemne uprav Position X / Y tak, aby oči hovorcu zostali v hornej tretine obrazu (Rule of Thirds).',
      '6. Prehraj prechod na začiatku aj konci pre overenie dynamiky.'
    ],
    alternativeChoices: [
      'Pridať animovaný textový titulok s kľúčovým slovom.',
      'Použiť pomalý plynulý zoom (Ken Burns efekt).'
    ]
  },
  CAPTIONS_EMPHASIS: {
    topic: 'Titulky a Zvýraznenie Kľúčových Slov',
    principle: 'Pridanie dynamických titulkov s farebným zvýraznením 1-2 kľúčových slov v každej vete.',
    context: 'Short-form obsah, sledovanie bez zvuku, edukačné videá.',
    explanation: 'Zvýraznené titulky vedú oko diváka po texte a udržujú kognitívne zapojenie.',
    why: 'Až 70% používateľov na sociálnych sieťach sledovateľný obsah konzumuje bez zapnutého zvuku.',
    whenToUse: 'Pri každom hovorenom Short-form videu na TikTok, Reels alebo Shorts.',
    whenNotToUse: 'Pri umeleckých filmových projektoch alebo tradičnom televíznom vysielaní.',
    example: 'Slovo "TAJOMSTVO" v vete je zvýraznené žltou farbou a zväčšeným písmom.',
    antiPattern: 'Zobrazenie celého odseku textu naraz v 4 riadkoch cez stred tváre hovorcu.',
    source: 'Meta & ByteDance Creator Engagement Guidelines',
    sourceType: 'platform_best_practice',
    region: 'GLOBAL',
    platformTarget: 'Short-form Platforms',
    confidence: 0.97,
    category: 'professional_convention',
    manualWorkflowSteps: [
      '1. Otvor Auto-Captions / Smart Caption Studio panel.',
      '2. Skontroluj vygenerovaný prepis reči pre daný úsek.',
      '3. Nastav maximálny počet slov na riadok na 3 – 5 slov.',
      '4. Vyber kľúčové slovo (napr. podstatné meno alebo sloveso) a zmeň jeho farbu na žltú/neon zelenú.',
      '5. Uisti sa, že pozícia titulkov je v bezpečnej zóne (Safe Zone) nad spodným menu TikToku.',
      '6. Prehraj video so zvukom aj bez zvuku pre kontrolu čitateľnosti.'
    ],
    alternativeChoices: [
      'Použiť iba spodný klasický dvojriadkový titulok s čiernym pozadím.',
      'Použiť vyskakovacie heslo (Text Callout) v hornej časti obrazovky.'
    ]
  },
  AUDIO_DUCKING: {
    topic: 'Audio Ducking (Stíšenie Hudby pod Hlasom)',
    principle: 'Automatické zníženie hlasitosti hudobnej podmazovej stopy počas trvania hovoreného slova.',
    context: 'Mixovanie hudby a hovoreného slova vo všetkých typoch videí.',
    explanation: 'Hudba na pozadí dodáva atmosféru, ale nesmie konkurovať frekvenciám ľudského hlasu (800Hz - 4kHz).',
    why: 'Zrozumiteľnosť hovoreného slová je primárny faktor porozumenia videa. Ak hudba prekrýva hlas, divák video opustí.',
    whenToUse: 'Vždy, keď pozadí hrá hudba (A2/A3) súčasne s rečou na hlavnej stope A1.',
    whenNotToUse: 'V úsekoch bez reči, kde hudba tvorí hlavný dramatický prvok.',
    example: 'Počas reči je hudba na -22dB, keď hovorca prestane rozprávať, hudba plynulo stúpne na -12dB.',
    antiPattern: 'Ponechanie rovnakej hlasitosti hudby bez ohľadu na to, či hovorca rozpráva.',
    source: 'AES (Audio Engineering Society) Broadcast Standards',
    sourceType: 'industry_standard',
    region: 'GLOBAL',
    platformTarget: 'General',
    confidence: 0.98,
    category: 'technical_constraint',
    manualWorkflowSteps: [
      '1. Vyber hudobnú stopu A2 na timeline.',
      '2. Otvor Audio Mixer / Audio Panel.',
      '3. Zapni funkciu Auto-Ducking a zvoľ cieľovú stopu A1 (Hlas).',
      '4. Nastav úroveň útlmu (Ducking Amount) na -12dB až -15dB.',
      '5. Nastav čas nábehu a dobehu (Fade In / Out) na 0.4s pre plynulý prechod.',
      '6. Prehraj úsek a skontroluj, či hlas rečníka jasne vyniká nad hudbou.'
    ],
    alternativeChoices: [
      'Ručné vloženie Volume Keyframov na hudobnú stopu v miestach pauz.',
      'Použitie ekvalizéra (Sidechain EQ cutout) na vystrihnutie frekvencií 1kHz-3kHz z hudby.'
    ]
  },
  COLOR_BALANCING: {
    topic: 'Korekcia a Vyváženie Farieb (Color Workflow)',
    principle: 'Postupná korekcia expozície, vyváženia bielej a až následná aplikácia kreatívneho štýlu.',
    context: 'Akékoľvek video pred finálnym exportom.',
    explanation: 'Profesionálny color workflow sa vždy delí na 3 kroky: Correct -> Balance -> Grade.',
    why: 'Snažiť sa aplikovať farebný filter (LUT) na podexponovaný alebo nesprávne vyvážený záber spôsobí deformáciu tónov pleti.',
    whenToUse: 'Pri každom záverečnom dolaďovaní vizuálu.',
    whenNotToUse: 'Nepreskakovať prvý krok (Primary Correction) priamo k stylingu.',
    example: 'Najprv uprav Expozíciu (+0.3 EV) a White Balance (5600K), až potom priradiť Teal & Orange look.',
    antiPattern: 'Aplikácia agresívneho LUT filtra na nevyvážený záber.',
    source: 'Color Grading Central & SMPTE Standards',
    sourceType: 'industry_standard',
    region: 'GLOBAL',
    platformTarget: 'General',
    confidence: 0.95,
    category: 'technical_constraint',
    manualWorkflowSteps: [
      '1. Kliknutím vyber klip na V1 a otvor Color / Inspector panel.',
      '2. KROK 1 (Correct): Uprav Exposure (Expozíciu) tak, aby tiene neboli úplne čierne a jasy vypálené.',
      '3. KROK 2 (Balance): Nastav Temperature (Teplotu) pre prirodzený tón pleti (Skin Tones).',
      '4. KROK 3 (Contrast): Dolaď kontrast a sýtosť (Saturation 100-110%).',
      '5. KROK 4 (Grade): Voliteľne aplikuj štýl / LUT preset s opacity 50%.',
      '6. Porovnaj stav pred a po pomocou prepínača Bypass Color.'
    ],
    alternativeChoices: [
      'Použiť automatické vyváženie bielej pomocou kvapkadla (White Balance Picker).',
      'Kopírovať farebný profil z predchádzajúceho klipu.'
    ]
  },
  TRANSITION_SELECTION: {
    topic: 'Výber Prechodov (Transition Discipline)',
    principle: 'Uprednostnenie čistého strihu (Cut). Prechody používať iba pri zmene času, miesta alebo témy.',
    context: 'Strih všetkých žánrov.',
    explanation: 'Čistý strih tvorí 95% profesionálnych videí. Prechody ako Dissolve či Wipe označujú posun v naratíve.',
    why: 'Nadmerné používanie efektových prechodov pôsobí amatersky a odvádza pozornosť od obsahu.',
    whenToUse: 'Cross Dissolve pri prechode v čase/spomienke, Wipe pri posune miesta.',
    whenNotToUse: 'Medzi dvoma vetami toho istého hovorcu v tej istej miestnosti.',
    example: 'Zmena kapitoly po 2 minútach s jemným Cross Dissolve 0.4s.',
    antiPattern: 'Použitie 3D kocky alebo Spin prechodu medzi každou vetou.',
    source: 'Walter Murch & Hollywood Editorial Tradition',
    sourceType: 'editorial_guideline',
    region: 'GLOBAL',
    platformTarget: 'General',
    confidence: 0.96,
    category: 'professional_convention',
    manualWorkflowSteps: [
      '1. Nájdi strihový bod medzi dvoma klipmi na timeline.',
      '2. Zváž, či je potrebné vyjadriť posun v čase alebo mieste.',
      '3. Ak áno, otvorte Transition Studio / Preset Drawer.',
      '4. Vyber jemný Cross Dissolve alebo Dip to Black.',
      '5. Nastav dĺžku prechodu na 0.3s – 0.5s.',
      '6. Prehraj prechod a uisti sa, že neruší rytmus reči.'
    ],
    alternativeChoices: [
      'Ponechať rovný strih (Hard Cut) a použiť zvukovú nápovedu (SFX Whoosh).',
      'Použiť J-cut namiesto vizuálneho prechodu.'
    ]
  },
  INFORMATION_DENSITY: {
    topic: 'Hustota Informácií (Information Density)',
    principle: 'Vyváženie počtu slov za minútu a rýchlosti strihu podľa náročnosti témy.',
    context: 'Vzdelávacie videá, zložité koncepty, SK vs GLOBAL publikum.',
    explanation: 'Slovenskí diváci (SK) vo všeobecnosti preferujú mierne uvoľnenejšie tempo pri odborných témach než US Short-form publikum.',
    why: 'Príliš vysoká hustota informácií na TikTok bez vizuálnych záchytných bodov vedie ku kognitívnemu preťaženiu.',
    whenToUse: 'Prispôsobenie strihu podľa cieľovej platformy (Shorts vs Long-form YouTube).',
    whenNotToUse: 'Nenucovať rýchle tempo tam, kde je cieľom upokojenie alebo hlboká reflexia.',
    example: '180 slov/min na SK TikToku vyžaduje viac titulkov a kapitol pre udržanie kontextu.',
    antiPattern: 'Snaha aplikovať TikTok zrýchlenie 1.5x na rozhovor o psychológii.',
    source: 'SK Media Consumption Research & YouTube Analytics Best Practices',
    sourceType: 'platform_best_practice',
    region: 'SK',
    platformTarget: 'SK & Czech Market',
    confidence: 0.92,
    category: 'trend_platform_pattern',
    manualWorkflowSteps: [
      '1. Skontroluj metriku WPM v Analyze Paneli.',
      '2. Pri WPM > 170 zapni zvýrazňovanie kľúčových slov v Captions Paneli.',
      '3. Rozdeľ dlhé súvislé bloky textu na 3-5 sekundové kapitoly s textovým nadpisom.',
      '4. Nechaj 0.3s mikro-pauzy po kľúčových definíciách.'
    ],
    alternativeChoices: [
      'Mierne spomalenie audia o 5%.',
      'Pridanie infografiky pre vizuálnu podporu zložitej myšlienky.'
    ]
  }
};

export const CREATIVE_PATTERNS_DB: CreativePattern[] = [
  {
    id: 'pat_sk_hook_question',
    type: 'Evergreen',
    platform: 'TikTok',
    region: 'SK',
    contentType: 'Talking Head / Educational',
    description: 'Položenie priamej otázky v prvých 2.5 sekundách s textovým zvýraznením.',
    signal: 'Question mark in transcript within first 30 words + zoom-in effect',
    principle: 'Aktivuje zvedavosť diváka a priamo definuje hodnotu videa.',
    confidence: 0.91,
    source: 'OmniStrih SK Content Intelligence Data 2026',
    observedAt: Date.now()
  },
  {
    id: 'pat_yt_broll_pacing',
    type: 'Evergreen',
    platform: 'YouTube',
    region: 'GLOBAL',
    contentType: 'Educational / Tech Review',
    description: 'Zmena vizuálneho ula každých 4-6 sekúnd pomocou B-rollu alebo zmeny zoomu.',
    signal: 'Shot duration > 5s with static talking head',
    principle: 'Predchádza vizuálnej únavovému efektu.',
    confidence: 0.94,
    source: 'YouTube Creator Academy Guidelines',
    observedAt: Date.now()
  }
];

export function getTeachMeExplanation(topicKey: string): TeachMeExplanation {
  const explanation = EDIT_KNOWLEDGE_BASE[topicKey];
  if (explanation) return explanation;

  // Generic fallback explanation based on editing principles
  return {
    topic: topicKey,
    principle: 'Profesionálny strihový princíp založený na naratívnom toku a rytme.',
    context: 'Všeobecný video editing.',
    explanation: 'Každé strihové rozhodnutie má podporovať príbeh a pozornosť diváka.',
    why: 'Strih bez opodstatnenia vyrušuje diváka od obsahu.',
    whenToUse: 'Keď slúži lepšej zrozumiteľnosti alebo emócii.',
    whenNotToUse: 'Keď narúša prirodzený zámer autora.',
    example: 'Úprava timingu na základe vety a myšlienkového bloku.',
    antiPattern: 'Aplikácia pravidiel bez ohľadu na kontext.',
    source: 'OmniStrih Professional Editing Knowledge Base',
    sourceType: 'editorial_guideline',
    region: 'BOTH',
    platformTarget: 'General',
    confidence: 0.85
  };
}
