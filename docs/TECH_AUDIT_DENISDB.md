# Audit: DenisDB (`hacimertgokhan/denis`) — 29. 9. 2026

> Overené **reálnym spustením** v prostredí (Temurin JRE 17.0.20.1 + `denis-0.6.1.jar`),
> údaje o projekte z GitHub API. Toto je **technický audit, nie právne stanovisko.**

## 0. Čo to je (jednou vetou)

Malý **key-value server v štýle Redis**, napísaný v Jave: dáta drží v pamäti, vie ich
uložiť do protobuf súboru, komunikuje sa s ním **riadkovým protokolom cez TCP** (port 5142)
a prístup sa delí na **projekty (tokeny) v rámci prihlasovacích skupín**.

## 1. Overené údaje o projekte

| Údaj | Hodnota |
|---|---|
| Repo | [hacimertgokhan/denis](https://github.com/hacimertgokhan/denis) |
| Licencia | **Apache-2.0** (permisívna, komerčné použitie OK, bez copyleftu) |
| Hviezdy / forky | 18 / 1 |
| Posledný push | 2026-09-23 (aktívny) |
| Commity | 131, verzia na masteri už 0.7.0 (23. 9. 2026) |
| Najnovší release | **v0.6.1** (21. 9. 2026) |
| Veľkosť balíkov | `denis-0.6.1.jar` **5,0 MB**, bundle `.zip`/`.tar.gz` **4,6 MB** |
| Runtime | **Java 17+** (povinné) |
| Node klient | `clients/node` v1.1.0, Apache-2.0, **nula závislostí**, Node ≥18 |
| Otvorené issues | 0 |

**Pozor na dokumentáciu:** `denisdb.vercel.app` je prepis README tretej strany a v rýchlom
štarte uvádza starú verziu `0.0.2.9-alpha`, ktorá nezodpovedá releaseom (jar sa dnes volá
`denis-0.6.1.jar`). Zdrojem pravdy je repo, nie tá stránka.

## 2. Čo som naozaj spustil a zmeral

| Zistenie | Výsledok |
|---|---|
| Server sa rozbehne? | **Áno** — `java -jar denis-0.6.1.jar server` |
| RAM pri štarte | **60,5 MB RSS** (22 vlákien), VSZ ~2,9 GB (bežné pre JVM, nie reálna spotreba) |
| RAM po zápise ~1 MB dát | 74–79 MB RSS |
| JRE na disku | 46 MB archív, ~120 MB rozbalené |
| 1 KB zápis / čítanie | 1 ms / 1 ms |
| 100 KB zápis / čítanie | 6 ms / 8 ms |
| 500 KB zápis / čítanie | 33 ms / 35 ms |
| Diakritika a medzery v hodnote | **funguje** („Kaviareň U Janka", aj odsadený text) |
| **Kľúč s medzerou** | **ticho inak, než by človek čakal** — `SET klient kaviaren text` uloží kľúč `klient` a hodnotu `kaviaren text` (žiadna chyba) |
| **Hodnota s odriadkovaním** | neprejde ako viac riadkov — JSON treba poslať v jednom riadku (`JSON.stringify` bez odsadenia) |
| **Perzistencia je opt-in** | `SET k v` = len pamäť → **neprežije reštart**; `-&protobuff` / `-&save` → zapíše sa do `database.bin` → **prežije** (po reštarte: „Cache warmed with 2 persisted keys") |
| `HEAVEN` | vyprázdni cache projektu (v teste zmazal 4 kľúče); vplyv na perzistentné dáta som neoveroval |
| SQL príkazy | `SELECT * FROM <kľúč>` → „Table not found" / „Unsupported SQL query" — **syntax som nedohľadal** (stránka `/sql-queries` na doc stránke vracia 404), beriem ako neoverené |
| Súbory na disku | `denis.properties` (obsahuje hlavný token), `denis.toml` (skupiny), `ddb.json` (**projektové tokeny v čitateľnom tvare**), `database.bin` (+ `.journal`), `pawd.dat`, `logs/` |

## 3. Licencia — prekážka?

**Žiadna.** Apache-2.0 umožňuje použitie, úpravy aj šírenie (vrátane komerčného), s
povinnosťou zachovať licenčné texty. Žiadny copyleft, ktorý by zasahoval do nášho kódu.

## 4. Závislosti, veľkosť, RAM

- Vyžaduje **druhý runtime: Java 17+**. V našom prostredí Java nebola (bola len verzia 11,
  Denis chce 17) — presne to je typ prekážky, ktorá sa pri „vyzerá to skvele" prehliadne.
- **Nezväčšuje bundle appky** — komunikuje sa cez TCP, klient má 0 závislostí. To je
  jediná výhoda oproti npm knižnici.
- Cena: ~120 MB na disku a **60+ MB RAM stále**, aj keď sa nič nedeje (JVM základ).

## 5. Duplicita s tým, čo už máme

| Potreba | Čo máme dnes | Čo by priniesol DenisDB |
|---|---|---|
| API kľúče | `.data/api-keys.json` + existujúci Bun server + UI | nový Java proces a nový protokol |
| Edit DNA / štýl klienta | lokálne (JSON / localStorage) | Java proces + klient |
| Trend knižnica | statické dáta v kóde | — |
| Video (Mediabunny) | jadro appky | žiadny vzťah |

Pre **lokálny nástroj pre jedného človeka** je to čistá duplicita: vymenili by sme
jednoduchosť (JSON súbor, ktorý vieme aj zobraziť, aj zálohovať) za druhý runtime.

## 6. Kedy by zmysel malo (a kedy nie)

- **Áno, ak** by OmniStrih mal byť viacužívateľský alebo viac-miestny: Denis má projekty
  ako menné priestory a TCP server, takže jeden bežiaci Denis by vedel obslúžiť viac
  zariadení (existuje aj Docker image s HEALTHCHECK-om).
- **Nie dnes**, pretože appka je lokálna, dáta sú malé JSON súbory a už fungujú.
- Ak raz pôjdeme do synchronizácie medzi zariadeniami, **lacnejšia cesta je HTTP endpoint
  na existujúcom Bun serveri** (pár desiatok riadkov, nulový nový runtime), nie nová
  databáza. Denis by bol kandidát až vtedy, keby sme potrebovali cache pre viac klientov
  naraz a veľa rýchlych zápisov.

## 7. Rozhodnutie

**Nepridávame do OmniStrihu.** Nie preto, že by bol zlý — na svoj účel je funkčný a čistý
(licencia v poriadku, klient bez závislostí, rozumná rýchlosť). Je to preto, že
**duplikuje to, čo už funguje**, a priniesol by do nástroja druhý runtime (Java) a novú
sieťovú službu za funkcionalitu, ktorú už máme.

Rozhodnutie sa dá kedykoľvek prehodnotiť — kritériom nech je konkrétna potreba
(viac zariadení / viac používateľov), nie to, že projekt vyzerá dobre.

## 8. Ako si ho vyskúšať mimo OmniStrihu

```bash
# 1. Java 17+ (napr. Temurin JRE)
# 2. stiahni release z GitHubu: denis-0.6.1.jar
mkdir -p ~/denis-run && cd ~/denis-run
DENIS_BOOTSTRAP_GROUP=test DENIS_BOOTSTRAP_GROUP_PASSWORD=heslo123 \
  java -jar ~/denis-0.6.1.jar server
# 3. beží na porte 5142; token a konfigurácia sa zapíšu do denis.properties / ddb.json
```

Poznámka pre bezpečnosť: `ddb.json` aj `denis.properties` obsahujú **tokeny v čitateľnom
tvare** — necommitovať, nezdieľať priečinok, nelogovať obsah.
