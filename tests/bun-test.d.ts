/**
 * Minimálny typový štít pre `bun:test` a Bun globály.
 *
 * Repo beží na Bun, ale nemá nainštalované typy pre jeho test runner. Namiesto
 * pridania ďalšej závislosti (a zmeny lockfile) si tu deklarujeme len to, čo
 * testy naozaj používajú. Testy sa spúšťajú cez `bun test`, ktorý si ich
 * transpiluje sám — tento súbor slúži iba na to, aby `tsc --noEmit` nezlyhal.
 */

/** Bun globál (testy používajú Bun.file a Bun.write). */
declare const Bun: {
  file(path: string): {
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    json(): Promise<any>;
    exists(): Promise<boolean>;
  };
  write(path: string, data: Uint8Array | ArrayBuffer | Blob | string): Promise<number>;
};

declare module "bun:test" {
  type TestFn = () => void | Promise<void>;

  export function describe(name: string, fn: TestFn): void;
  interface TestFnWithSkip {
    (name: string, fn: TestFn, timeout?: number): void;
    skip(name: string, fn: TestFn, timeout?: number): void;
    only(name: string, fn: TestFn, timeout?: number): void;
    todo(name: string): void;
  }

  export const test: TestFnWithSkip;
  export const it: TestFnWithSkip;
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
    toBeCloseTo(expected: number, precision?: number): void;
    toMatchObject(expected: unknown): void;
    toHaveProperty(path: string | string[], value?: unknown): void;
    toThrow(expected?: unknown): void;
    toBeInstanceOf(expected: unknown): void;
    not: Matchers;
    resolves: Matchers;
    rejects: Matchers;
  }

  export function expect(actual: unknown): Matchers;
  export const mock: (...args: any[]) => any;
}
