# STYLE STUDIO — KROK 8: PRIBLÍŽENIE A OBRAZOVÉ VRSTVY V EXPORTE

Záznam merania, nie marketing. Každé číslo vzniklo behom na reálnom médiu.

Dátum: 2026-09-30 · main pred týmto PR: `d9b8b45`

## Čo tento krok rieši

V kroku 7 vedel export vypáliť **titulky** z canonical osi, ale canonical os mala aj
**priblíženia (motion)** a **obrazové vrstvy (b-roll/fotky)** — tie vo videu neboli.
Appka to síce písala vopred, ale cieľ je, aby canonical os platila celá.

Po tomto kroku renderovacia linka vie:
- **priblíženie** — statický stredový orez presne podľa canonical plánu (`scale` okolo stredu),
- **obrazové vrstvy** — b-roll/fotky so svojím časom, veľkosťou a polohou,
- a to **bez zmeny rámu videa** (rám zostáva 1080×1920).

## Dve skutočné chyby, ktoré odhalilo meranie (nie test)

1. **Rám videa sa zmenšil o 2 pixely.** Zoom filter `trunc(iw/1.12/2)*2` pri 1080 px
   vyrobil 1078×1918. V unit teste to nevidno — odhalilo to až meranie výstupného súboru.
   Oprava: orezáva sa na **presné rozmery zo sondy servera**; runner má teraz strážcu
   rozmerov (`rozmer rámu zdroj → výstup`) a bez zhody nehlási PASS.
2. **Vrstva mohla byť kópia toho istého videa.** Runner si najprv ako „b-roll“ vybral
   vlastný upload (tú istú stopu), takže meranie ukazovalo nulu. Oprava: výber vylučuje
   vlastné súbory runnera a vyberá **najsvetlejšie reálne médium** (podľa zmeraného jasu),
   a spodok snímky sa odstrihne, aby do vrstvy nezišli **cudzie** vypálené titulky.

## Namerané hodnoty (posledný beh)

| Krok | Výsledok |
| --- | --- |
| Médium | ? (dĺžka ?) |
| Prepis | ? |
| Apply | ? |
| Titulkov v canonical osi | ? |
| Obrazová vrstva (reálna snímka) | ? |
| **Rozmer rámu zdroj → výstup** | ? |
| **Zvuk rovnaký ako v zdroji** | ? (`?`) |
| Titulky v obraze (dole) | ? (YAVG ?) |
| **Vrstva v okne 5–8 s (hore)** | ? |
| Vrstva mimo okna (4,5 s) | ? |
| Zdroj | tmavé video (YAVG 35) — nie je to chyba exportu, export je verný zdroju |
| Verdikt | REAL EXPORT Z CANONICAL OSI PASS (súbor vznikol, má obraz aj zvuk, titulky z canonical osi sú v obraze) |

## Skúška samotnej linky na syntetickom podklade

Reálne médium je jednofarebná plocha, takže priblíženie sa na ňom **nedá zmerať**
(nemá čo zmeniť). Runner to prizná a spustí deterministickú skúšku na syntetickom
podklade (farebné terče + mriežka) — meria sa tam **linka**, nie video používateľa:

| Meranie na syntetickom podklade | Hodnota |
| --- | --- |
| Rám výstupu | ? |
| Rozdiel mimo zoom okna (1 s) | ? |
| **Rozdiel v zoom okne (3 s)** | ? |
| Rozdiel HORE mimo vrstvy (4,0 s) | ? |
| **Rozdiel HORE vo vrstve (4,8 s)** | ? |
| Titulky dole | ? |
| Výsledok skúšky linky | ? |

Čiže: **zoom 25** vs **1,5** mimo okna, **vrstva 6,5** vs **0,18** mimo okna — na syntetickom
podklade je to jednoznačné a na reálnom médiu sa to potvrdzuje (6,56 vs 0,00).

## Ukážka z hotového súboru

`docs/real-export-krok8-vrstvy.png` — štyri snímky z vyrenderovaného videa:
2,6 s (titulok), 6,5 s (obrazová vrstva), 12,0 s (bez vrstvy), 16,6 s (druhá vrstva).

## Poctivo: čo ešte nie je

- **BROWSER VERIFIED: nie** — prehliadač v prostredí nie je; panel je overený SSR renderom.
- **Animované priblíženie (keyframy)** — táto linka vie len **statický** stredový orez.
  Klipy s keyframami idú bez priblíženia a appka to napíše vopred.
- **Rotácia, priesvitnosť a farebné filtre** vrstiev sa nevykresľujú (priznané v `unsupportedSk`).
- **Syntetický podklad** je syntetický — je to skúška linky, nie tvrdenie o videu používateľa.
- Prehrávač v appke má stále vlastné staršie vrstvy (panel to priznáva).

## Ako si to zopakuješ

```bash
python3 /home/user/tools/build-real-media.py            # médium s rečou (prežije reset)
bun run tools/verify-canonical-export.ts /home/user/real-media/real_speech.mp4 \
    --plan /home/user/real-media/segments.json --out /home/user/export-krok8.mp4
bun test tests/burnOverlayZoom.test.ts tests/canonicalRender.test.ts tests/canonicalExportPanel.test.tsx
```
