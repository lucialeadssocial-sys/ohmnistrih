import { describe, expect, test } from "bun:test";
import {
  emptyProfile,
  loadEditDna,
  saveEditDna,
  resetEditDna,
  recordDecisions,
  acceptRate,
  resolveStats,
  applyDnaBias,
  dnaTypeRows,
  dnaSummarySk,
  totalDecisions,
  EDIT_DNA_STORAGE_KEY,
  MIN_SAMPLES,
  type EditDnaProfile,
  type StorageLike,
} from "../src/core/learning/editDna";

/** Pamäťové úložisko — testy nesmú závisieť od prehliadača. */
function memoryStorage(initial: Record<string, string> = {}): StorageLike & { dump: () => Record<string, string> } {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
    dump: () => ({ ...data }),
  };
}

function profileWith(type: string, accepted: number, rejected: number, mode = "SOCIAL"): EditDnaProfile {
  const decisions = [
    ...Array.from({ length: accepted }, () => ({ type, decision: "accept" as const })),
    ...Array.from({ length: rejected }, () => ({ type, decision: "reject" as const })),
  ];
  return recordDecisions(emptyProfile(), mode, decisions);
}

describe("Edit DNA — ukladanie", () => {
  test("prázdne úložisko vráti prázdny profil", () => {
    const p = loadEditDna(memoryStorage());
    expect(totalDecisions(p.totals)).toBe(0);
    expect(Object.keys(p.byType)).toHaveLength(0);
  });

  test("uloží a načíta profil bez straty", () => {
    const store = memoryStorage();
    const profile = profileWith("CUT", 7, 1);
    expect(saveEditDna(profile, store)).toBe(true);
    const loaded = loadEditDna(store);
    expect(loaded.byType.CUT).toEqual({ accepted: 7, rejected: 1 });
    expect(loaded.totals.sessions).toBe(1);
  });

  test("poškodené dáta v úložisku nesmú zhodiť aplikáciu", () => {
    const store = memoryStorage({ [EDIT_DNA_STORAGE_KEY]: "{ toto nie je json" });
    const p = loadEditDna(store);
    expect(totalDecisions(p.totals)).toBe(0);
  });

  test("nezmyselné hodnoty (záporné, textové) sa vyčistia", () => {
    const store = memoryStorage({
      [EDIT_DNA_STORAGE_KEY]: JSON.stringify({
        version: 1,
        totals: { accepted: -5, rejected: "veľa", sessions: "x" },
        byType: { cut: { accepted: 3.7, rejected: -1 } },
        byMode: { social: { zoom: { accepted: 2, rejected: 1 } } },
      }),
    });
    const p = loadEditDna(store);
    expect(p.totals.accepted).toBe(0);
    expect(p.totals.rejected).toBe(0);
    expect(p.byType.CUT).toEqual({ accepted: 3, rejected: 0 });
    expect(p.byMode.SOCIAL.ZOOM).toEqual({ accepted: 2, rejected: 1 });
  });

  test("reset vymaže aj úložisko", () => {
    const store = memoryStorage();
    saveEditDna(profileWith("CUT", 6, 0), store);
    const cleared = resetEditDna(store);
    expect(totalDecisions(cleared.totals)).toBe(0);
    expect(store.getItem(EDIT_DNA_STORAGE_KEY)).toBeNull();
  });

  test("úložisko, ktoré zlyhá, nesmie zhodiť aplikáciu", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("zakázané");
      },
      setItem: () => {
        throw new Error("plné");
      },
      removeItem: () => {
        throw new Error("zakázané");
      },
    };
    expect(totalDecisions(loadEditDna(broken).totals)).toBe(0);
    expect(saveEditDna(profileWith("CUT", 5, 0), broken)).toBe(false);
  });

  test("prázdne rozhodnutia nezmenia profil", () => {
    const before = profileWith("CUT", 5, 0);
    const after = recordDecisions(before, "SOCIAL", []);
    expect(after).toBe(before);
  });
});

describe("Edit DNA — prahy a čestnosť", () => {
  test("pod minimom vzoriek sa podiel NEreportuje (žiadne hádanie z dvoch klikov)", () => {
    expect(acceptRate({ accepted: 2, rejected: 0 })).toBeNull();
    expect(acceptRate({ accepted: MIN_SAMPLES - 1, rejected: 0 })).toBeNull();
    expect(acceptRate({ accepted: MIN_SAMPLES, rejected: 0 })).toBe(1);
  });

  test("resolveStats dá prednosť režimu, keď má dosť dát", () => {
    let p = recordDecisions(emptyProfile(), "SOCIAL", [
      ...Array.from({ length: 6 }, () => ({ type: "ZOOM", decision: "accept" as const })),
    ]);
    p = recordDecisions(p, "PODCAST", [
      ...Array.from({ length: 6 }, () => ({ type: "ZOOM", decision: "reject" as const })),
    ]);
    expect(resolveStats(p, "PODCAST", "ZOOM").scope).toBe("mode");
    expect(resolveStats(p, "PODCAST", "ZOOM").counters.accepted).toBe(0);
    expect(resolveStats(p, "ADS", "ZOOM").scope).toBe("type");
  });

  test("bez dát nič neupravuje a povie to", () => {
    const result = applyDnaBias(
      [{ id: "a", type: "CUT", confidence: 0.6 }],
      emptyProfile(),
    );
    expect(result.adjustedCount).toBe(0);
    expect(result.learned).toBe(false);
    expect(result.plan[0].confidence).toBe(0.6);
    expect(result.plan[0].dnaNote).toBeUndefined();
    expect(result.insights.join(" ")).toContain("nemám žiadne tvoje rozhodnutia");
  });

  test("málo dát → prizná sa a plán zostane nedotknutý", () => {
    const profile = profileWith("CUT", 2, 0);
    const result = applyDnaBias([{ id: "a", type: "CUT", confidence: 0.6 }], profile);
    expect(result.adjustedCount).toBe(0);
    expect(result.learned).toBe(false);
    expect(result.plan[0].confidence).toBe(0.6);
    expect(result.insights.join(" ")).toContain("potrebujem aspoň");
  });

  test("vypnuté učenie = plán presne ako prišiel", () => {
    const profile = profileWith("CUT", 8, 0);
    const result = applyDnaBias([{ id: "a", type: "CUT", confidence: 0.6 }], profile, { enabled: false });
    expect(result.plan[0].confidence).toBe(0.6);
    expect(result.plan[0].dnaNote).toBeUndefined();
    expect(result.adjustedCount).toBe(0);
  });

  test("akceptovaný typ → istota hore, zamietaný → dole, vždy s vysvetlením", () => {
    const liked = applyDnaBias([{ id: "a", type: "CUT", confidence: 0.6 }], profileWith("CUT", 8, 1));
    const disliked = applyDnaBias([{ id: "a", type: "SPEED", confidence: 0.6 }], profileWith("SPEED", 1, 8));

    expect(liked.plan[0].confidence).toBeGreaterThan(0.6);
    expect(liked.plan[0].dnaNote).toContain("prijímaš");
    expect(disliked.plan[0].confidence).toBeLessThan(0.6);
    expect(disliked.plan[0].dnaNote).toContain("zamietaš");
  });

  test("úprava istoty je malá a nikdy nevypadne z rozsahu 0,05–0,97", () => {
    const extremeUp = applyDnaBias([{ id: "a", type: "CUT", confidence: 0.95 }], profileWith("CUT", 20, 0));
    const extremeDown = applyDnaBias([{ id: "a", type: "CUT", confidence: 0.07 }], profileWith("CUT", 0, 20));
    expect(extremeUp.plan[0].confidence).toBeLessThanOrEqual(0.97);
    expect(extremeDown.plan[0].confidence).toBeGreaterThanOrEqual(0.05);
    expect(Math.abs(extremeUp.plan[0].dnaDelta ?? 0)).toBeLessThanOrEqual(0.15);
    expect(Math.abs(extremeDown.plan[0].dnaDelta ?? 0)).toBeLessThanOrEqual(0.15);
  });

  test("DNA nikdy nemení štruktúru plánu — počet, poradie ani typy", () => {
    const plan = [
      { id: "1", type: "HOOK", confidence: 0.6 },
      { id: "2", type: "CUT", confidence: 0.6 },
      { id: "3", type: "SPEED", confidence: 0.6 },
      { id: "4", type: "CUT", confidence: 0.5 },
    ];
    let profile = profileWith("CUT", 8, 1);
    profile = recordDecisions(profile, "SOCIAL", [
      ...Array.from({ length: 8 }, () => ({ type: "SPEED", decision: "reject" as const })),
    ]);
    const result = applyDnaBias(plan, profile);
    expect(result.plan.map((i) => i.id)).toEqual(["1", "2", "3", "4"]);
    expect(result.plan.map((i) => i.type)).toEqual(["HOOK", "CUT", "SPEED", "CUT"]);
    expect(result.plan).toHaveLength(4);
  });

  test("typu na hrane (cca 50 %) sa istota nemení, ale má poznámku", () => {
    const result = applyDnaBias([{ id: "a", type: "BROLL", confidence: 0.6 }], profileWith("BROLL", 3, 3));
    expect(result.plan[0].confidence).toBe(0.6);
    expect(result.plan[0].dnaNote).toContain("na hrane");
  });
});

describe("Edit DNA — prehľad pre používateľa", () => {
  test("zhrnutie bez dát prizná, že sa nič nenaučilo", () => {
    expect(dnaSummarySk(emptyProfile())).toContain("nič nenaučil");
  });

  test("zhrnutie s dátami uvádza počty a spoľahlivé typy", () => {
    const profile = profileWith("CUT", 7, 1);
    const text = dnaSummarySk(profile);
    expect(text).toContain("8 rozhodnutí");
    expect(text).toContain("prijatých 7");
    expect(text).toContain("Spoľahlivo ti rozumiem pri 1 type");
  });

  test("tabuľka typov radí spoľahlivé typy prvé a označí málo dát", () => {
    let p = profileWith("CUT", 6, 1);
    p = recordDecisions(p, "SOCIAL", [{ type: "MUSIC", decision: "reject" }]);
    const rows = dnaTypeRows(p);
    expect(rows[0].type).toBe("CUT");
    expect(rows[0].reliable).toBe(true);
    expect(rows[0].rate).toBeCloseTo(6 / 7, 5);
    const music = rows.find((r) => r.type === "MUSIC");
    expect(music?.reliable).toBe(false);
    expect(music?.rate).toBeNull();
  });
});
