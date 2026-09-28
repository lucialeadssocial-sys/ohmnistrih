/**
 * jsdom ships no TypeScript declarations and the repository has no @types/jsdom.
 *
 * The verification harnesses (verify_academy.mjs, verify_director_ui.mjs, verify_shorts.ts) run the
 * real components in jsdom via tsx, so the module has to be resolvable during `tsc --noEmit`.
 * This declaration is intentionally loose: it covers only what the harnesses use and exists so a
 * missing type package cannot block the type check. It does not affect the application bundle.
 */
declare module 'jsdom' {
  export const JSDOM: any;
  export type JSDOM = any;
}
