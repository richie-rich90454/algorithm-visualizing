/**
 * index.ts – The algorithm registry.
 *
 * The registry is a central lookup table that maps kebab-case algorithm ids
 * (e.g. `"bubble-sort"`) to their metadata, plus a lazy loader per module.
 * The sidebar builds its category tree from `getAllAlgorithms()`, the store
 * resolves display metadata with `getAlgorithm()`, and fetches executable
 * code on demand with `loadAlgorithmModule()`.
 *
 * Metadata lives in the GENERATED `manifest.ts` (id, name, category,
 * complexity, defaultInput, visualType) so the production bundle ships the
 * gallery shell first: each algorithm's generator code becomes its own
 * code-split chunk, fetched only when the algorithm is opened. This keeps
 * the initial download small no matter how large the library grows.
 */

import type { AlgorithmModule } from "@/types";
import { LOADERS, MANIFEST, type AlgorithmMeta } from "./manifest";

/** Full module objects already fetched, so reopening is instant. */
const moduleCache = new Map<string, AlgorithmModule>();

/**
 * Look up an algorithm's metadata by its kebab-case id.
 *
 * Synchronous and allocation-free after startup: metadata is plain data,
 * so the sidebar, search, and info panel never wait on code fetching.
 *
 * @param id The algorithm identifier, e.g. `"bubble-sort"`.
 * @returns The matching metadata, or `null` when unknown.
 */
export function getAlgorithm(id: string): AlgorithmMeta | null {
    return MANIFEST.find((m) => m.id === id) ?? null;
}

/**
 * @returns Metadata for every registered algorithm, in alphabetical id order.
 */
export function getAllAlgorithms(): AlgorithmMeta[] {
    return MANIFEST;
}

/**
 * Fetch an algorithm's executable module, caching it for reopen visits.
 *
 * @param id The algorithm identifier, e.g. `"bubble-sort"`.
 * @returns The full module (including `run`), or `null` when unknown.
 */
export async function loadAlgorithmModule(id: string): Promise<AlgorithmModule | null> {
    const cached = moduleCache.get(id);
    if (cached) {
        return cached;
    }
    const loader = LOADERS[id];
    if (!loader) {
        return null;
    }
    const module = (await loader()).default;
    moduleCache.set(id, module);
    return module;
}
