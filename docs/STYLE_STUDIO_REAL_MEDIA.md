# STYLE STUDIO — REAL-MEDIA VERIFIKÁCIA (krok 5–6)

Tento dokument je **záznam merania**, nie marketing. Každé číslo tu vzniklo spustením
`tools/verify-style-real-media.ts` na reálnom médiu. Kde niečo overené nebolo, je to napísané.

Dátum: 2026-09-30 · main: `89f15c9` (PR #27)

## Čo je reálne a čo je syntetizované (bez prikrášlenia)

| Zložka | Stav |
| --- | --- |
| Médium (obraz) | **REÁLNE** — `real_speech.mp4` z prostredia používateľa, 330049 B / 21.53 s |
| Poskladanie média | **SYNTETICKÉ** — reálne video zacyklené (`-stream_loop 3`), aby vznikol súvislý 21,5 s záznam |
| Reč | **SYNTETIZOVANÁ** — Gemini TTS (`gemini-3.8-flash-tts`, hlas Kore), **nie je to pôvodné VO** |
| Prepis | **REÁLNY** — odpoveď reálneho AI modelu na tomto audiu: `200 | success=true | hasSpeech=true`, 16 / 51 |
| Plán štýlu | **DETERMINISTICKÝ, LOKÁLNY** — provider: žiadny, AI sa na Apply nepoužíva |
| Apply (zmena projektu) | **REÁLNA** — zmena canonical timeline cez existujúci CommandManager |
| Prehliadač | **NEVERIFIKOVANÉ** — v prostredí nie je prehliadač; panel je overený len SSR renderom |
| Export / preview z canonical timeline | **NEZAČATÉ** — krok 7 |

## Namerané hodnoty (posledný beh)

| Krok | Výsledok |
| --- | --- |
| Médium | real_speech.mp4 — 330049 B / 21.53 s |
| Recept | Editoriálna koláž (EDITORIAL_COLLAGE) |
| Rozhodnutí v pláne | 17 |
| Podiel rečníka | 30 % (recept 30 %) |
| Apply | aplikované / dodržané / nevykonané = **14 / 1 / 2** |
| Časová os zmenená | true |
| Audio nedotknuté (bajtová kontrola) | true |
| Klipy video/b-roll/titulky pred → po | 1/0/0 → 1/2/6 |
| Rozhodnutia v projekte pred → po | 0/17 |
| Snapshot pred zmenou | `ver_ff22f238-f6a8-4c08-a9c1-dfdafd31b823` |
| Rollback — obnovené presne (bajty) | true |
| Rollback — audio späť | true |
| Verdikt runnera | REAL-MEDIA PIPELINE PASS (apply zmenil projekt, audio nedotknuté, rollback presný) |

## Čo je v projekte po Apply (konkrétne)

- 6 titulkových klipov s textom z **reálneho prepisu** (napr. „Za päť minút“, „Najprv som robil“, „Ráno plán, večer“, „strih o 70 percent.“, „Klient zaplatil 3 000“) — nie z vymysleného textu.
- 2 b-roll klipy s **reálnou snímkou z toho istého videa** (`asset_real_shot`) — žiadne vymyslené vizuály, žiadny provider.
- Priblíženia (motion) na hlavnom video klipe v úsekoch, ktoré plán označil.
- Kompozičné pravidlá zapísané ako pravidlá (`SKIPPED`), pretože na preloženie vrstiev nemám čím — appka to **povie**, nezamlčí.

## Chyba, ktorú táto verifikácia odhalila (a je opravená)

Preťažený model (HTTP 503) sa v `/api/transcribe-speech` tváril ako **„v tomto videu nie je reč“**.
Človek by hľadal chybu vo svojom videe. Po oprave: chyba = HTTP 502 s dôvodom, zoznamom
skúšaných modelov a vetou pre človeka; ticho vznikne **len** vtedy, keď to model naozaj povie.
Reťaz modelov má 7 položiek (vrátane `gemini-flash-latest`), `gemini-2.5-flash` je vyradený
(HTTP 404 pre nových používateľov — overené reálnym volaním).

## Ako si to overiť sám/sama

```bash
bun run tools/verify-style-real-media.ts /tmp/real_speech.mp4            # celý reťazec cez appku
bun run tools/verify-style-real-media.ts /tmp/real_speech.mp4 --plan /tmp/real_segments.json   # bez AI (z uloženého prepisu)
bun test tests/transcriptionGuard.test.ts                                # poctivosť prepisu
```

Surový výstup posledného behu je priložený v `docs/real-media-verify-output.txt`.
