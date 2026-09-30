# HOSTING — ako OmniStrih beží „na internete“ (a čo ešte nie je)

**Dátum:** 2026-09-30 · **Stav:** produkčný režim overený na tomto stroji; verejná doména/cloud **NIE JE**.

---

## 1. Čo je hotové (a čím je to overené)

| Krok | Príkaz | Výsledok (overené) |
|---|---|---|
| Produkčný balík | `bun run build` | `dist/index.html` + `dist/assets/*` + `dist/server.cjs`, build exit 0 |
| Produkčný server | `bash /home/user/tools/start-prod.sh` | `NODE_ENV=production`, `node dist/server.cjs`, beží na **0.0.0.0:3000** |
| Aplikácia sa načíta | `curl -s -o /dev/null -w %{http_code} http://127.0.0.1:3000/` | **200** |
| Statické súbory | `curl … http://127.0.0.1:3000/assets/index-*.js` | **200** |
| API beží | `curl … http://127.0.0.1:3000/api/health` | `{"status":"ok","hasGeminiKey":true,…}` |
| Je to naozaj produkcia | HTML obsahuje `/@vite/client`? | **nie** (0 výskytov) — dev server tam nie je |
| Jednostránková appka | `curl … http://127.0.0.1:3000/hocico` | **200** (SPA fallback na `index.html`) |

**Ako sa appka dostane k tebe:** appka je na tomto stroji a platforma ju sprístupňuje cez **živý náhľad** (`https://<port>-<id>.e2b.app`).
To je dnes jediná „internetová“ adresa appky. Keď je proces na portu 3000 spustený, náhľad funguje; keď proces spadne, náhľad nič neukáže.

**Prečo musí server počúvať na `0.0.0.0`:** keby počúval len na `127.0.0.1`, zvonka (ani z náhľadu) by sa nedal otvoriť. `start-prod.sh` aj `start-app.sh` to držia.

---

## 2. Čo je poctivo NEDOKONČENÉ (a prečo to nepredstieram)

| Vec | Stav | Vysvetlenie |
|---|---|---|
| Vlastná doména (napr. `omnistrih.sk`) | **NIE** | Nemám prístup k DNS tvojho účtu; dala by sa nastaviť len u poskytovateľa domény. |
| Cloud hosting (VPS / Render / Fly.io) | **NIE** | Vyžaduje účet a platbu u poskytovateľa; toto prostredie je dočasné a bez takejto služby. |
| HTTPS s vlastným certifikátom | **NIE** (rieši to platforma pre náhľad) | Náhľad ide cez HTTPS platformy; vlastný server je HTTP na porte 3000. |
| Prihlásenie / viac používateľov | **NIE** | Appka nemá login. Kto má adresu náhľadu, vidí appku. Pre súkromné používanie OK, pre verejné nie. |
| Ukladanie projektov na serveri | **NIE** (a je to tak naschvál) | Médiá a projekty zostávajú u teba (OPFS/prehliadač). Nič z tvojich videí neodchádza na náš server — jediné, čo odchádza von, sú volania AI (Gemini) s tvojím kľúčom. |

---

## 3. Ako si to spustíš sám

```bash
# 1) Produkčná verzia (stabilná, bez dev servera) — používa hotový balík
bash /home/user/tools/start-prod.sh

# 2) Vývojárska verzia (hot-reload, keď sa niečo upravuje)
bash /home/user/tools/start-app.sh
```

Obe skripty:
- doplnia `bun`, ak chýba, a nainštalujú závislosti, ak chýba `node_modules`,
- `start-prod.sh` **najprv postaví balík** a keď build zlyhá, appku **neštartuje** (radšej nič, než stará verzia),
- počúvajú na `0.0.0.0:3000`, takže appka je viditeľná cez náhľad.

Kontrola, že to naozaj beží:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/     # → 200
curl -s http://127.0.0.1:3000/api/health                            # → {"status":"ok",…}
```

---

## 4. Keď budeš chcieť ozajstnú verejnú adresu (postup, nič z toho dnes nie je spravené)

1. **Kde hostovať:** malý VPS (napr. Hetzner/Contabo, ~5 €/mes) alebo služba typu Render/Fly.io pre Node aplikáciu.
2. **Čo tam treba:** Node 20+, `bun install`, `bun run build`, `NODE_ENV=production PORT=3000 node dist/server.cjs`, plus `.env` s `GEMINI_API_KEY` (nikdy nie do repozitára).
3. **Predtým než to pustíš na verejnosť:** doplniť prihlásenie (appka dnes nemá), limit na Gemini kľúč, HTTPS (na VPS napr. Caddy/nginx), a zálohovanie `data/exports`.
4. **Overenie po nasadení:** `GET /api/health` musí vrátiť `ok` a build musí byť z aktuálneho `main`.

---

## 5. Bezpečnostné pravidlá, ktoré platia už dnes

- `.env` (s `GEMINI_API_KEY`) je **gitignored** a v repozitári nikdy nebol — na GitHub ide len kód.
- Referenčné médiá (`/home/user/referencie/`, `/home/user/real-media/`) sú **mimo repozitára** a na GitHub sa neposielajú.
- Appka sama neposiela tvoje médiá na žiadny server; AI volania idú priamo na Google s tvojím kľúčom.
