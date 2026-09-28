/**
 * Minimálny typový štít pre `bun:test`.
 *
 * Repo beží na Bun, ale nemá nainštalované typy pre jeho test runner. Namiesto
 * pridania ďalšej závislosti (a zmeny lockfile) si tu deklarujeme len to, čo
 * testy naozaj používajú. Testy sa spúšťajú cez `bun test`, ktorý si ich
 * transpiluje sám — tento súbor slúži iba na to, aby `tsc --noEmit` nezlyhal.
 */
declare module "bun:test" {
  type TestFn = () => void | Promise<void>;

  export function describe(name: string, fn: TestFn): void;
  export function test(name: string, fn: TestFn, timeout?: number): void;
  export function it(name: string, fn: TestFn, timeout?: number): void;
  export function beforeAll(fn: TestFn): void;
  export function beforeEach(fn: TestFn): void;
  export function afterAll(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;

  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(expected: unknown): void;
    toBeGreaterThan(expected: number): void;
    toBeGreaterThanOrEqual(expected: number): void;
    toBeLessThan(expected: number): void;
    toBeLessThanOrEqual(expected: number): void;
    toHaveLength(expected: number): void;
    toMatch(expected: RegExp | string): void;
    not: Matchers;
  }

  export function expect(actual: unknown): Matchers;
  export const mock: (...args: any[]) => any;
}
