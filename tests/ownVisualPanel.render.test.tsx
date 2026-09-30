import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { OwnVisualPanel } from "../src/components/OwnVisualPanel";
import { STYLE_FIXTURE_SEGMENTS } from "./fixtures/styleFixture";

/**
 * KROK 27 — obrazovka „Vlastný vizuál“ (server-side render, žiadny prehliadač).
 *
 * Čo to dokazuje (UI PRESENT): panel sa vykreslí, ponúka **štyri reálne cesty**
 * a v predvolenej ceste (vytvoriť v štýle) už dopredu ukáže paletu, typografiu
 * a vzor z receptu — takže človek vidí, čo dostane, ešte pred vytvorením.
 *
 * Čo to NEDOKAZUJE: klikanie a sťahovanie v prehliadači (to je samostatná úroveň
 * dôkazu). Preto sa nižšie nikde nepíše, že obrázok „vznikol“.
 */

const html = (props: Partial<React.ComponentProps<typeof OwnVisualPanel>> = {}) =>
  renderToStaticMarkup(<OwnVisualPanel language="sk" segments={STYLE_FIXTURE_SEGMENTS} {...props} />);

let originalFetch: typeof globalThis.fetch;
beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("Panel nesmie volať sieť pri vykreslení — náhľad sa robí lokálne");
  }) as typeof globalThis.fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("J) Vlastný vizuál — obrazovka hovorí pravdu", () => {
  test("J1 — vykreslí sa a ponúka štyri cesty (vytvoriť, knižnica, súbor, AI)", () => {
    const markup = html();
    expect(markup).toContain('data-testid="own-visual-panel"');
    expect(markup).toContain('data-testid="visual-source-generate"');
    expect(markup).toContain('data-testid="visual-source-library"');
    expect(markup).toContain('data-testid="visual-source-file"');
    expect(markup).toContain('data-testid="visual-source-ai"');
    expect(markup).toContain("štyri cesty");
  });

  test("J2 — pri vytváraní ukáže paletu a typografiu receptu ešte pred vytvorením", () => {
    const markup = html({ initialText: "70%", initialSubText: "kratší strih" });
    expect(markup).toContain('data-testid="visual-recipe"');
    expect(markup).toContain('data-testid="visual-kind"');
    expect(markup).toContain("Farby z receptu");
    expect(markup).toMatch(/#[0-9A-Fa-f]{6}/);
    expect(markup).toContain("Typografia");
  });

  test("J3 — keď text chýba, appka to povie (nič si nevymyslí)", () => {
    const markup = html();
    expect(markup).toContain("nevymýšľa");
  });

  test("J4 — AI cesta priznáva, že sa riadi skutočnou odpoveďou providera", () => {
    const markup = html({ initialSource: "ai" });
    expect(markup).toContain('data-testid="visual-ai-prompt"');
    expect(markup).toContain('data-testid="visual-ai-run"');
    expect(markup).toContain("len ak provider naozaj funguje");
    expect(markup).toContain("nepovie „vygenerované“, keď obrázok nevznikol");
  });

  test("J7 — cesta zo súboru ponúka aj fotenie z telefónu (bez internetu)", () => {
    const markup = html({ initialSource: "file" });
    expect(markup).toContain('data-testid="visual-file-input"');
    expect(markup).toContain('data-testid="visual-camera-input"');
    expect(markup).toContain("Odfotiť (telefón)");
  });

  test("J5 — slová a čísla z videa sa ponúkajú ako text vizuálu (doslovne z prepisu)", () => {
    const markup = html();
    expect(markup).toContain("Vezmi z videa");
  });

  test("J6 — priznania autora sa zobrazia, keď existujú (a nedajú sa prehliadnuť)", () => {
    const markup = html({ attributions: ["„The New Study“ — KevinJump, licencia BY 2.0, zdroj: https://example.org/1"] });
    expect(markup).toContain("Priznania autora");
    expect(markup).toContain("KevinJump");
  });
});
