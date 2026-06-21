/**
 * @pfp/data — local-first persistence: profiles + immutable match records, with
 * derived stats and (later) achievements/overall score. See §7.
 */
export * from "./types.js";
export * from "./store.js";
export * from "./memory.js";
export * from "./indexeddb.js";
export * from "./stats.js";
export { matchHasProfile } from "./util.js";
