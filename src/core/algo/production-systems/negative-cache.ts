/**
 * negative-cache.ts - Negative Caching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Negative caching stores the fact that a lookup failed, so repeated requests
 * for a missing key do not hit the backing store again. Each entry records
 * whether the key was found (a positive result) or known absent (a negative
 * result). A small cache uses least-recently-used eviction when it fills, and
 * a short time-to-live can expire negative entries so newly created keys become
 * visible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) amortized per lookup with a hash map and an LRU list
 *   Space: O(capacity) for the cache entries
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One cell per request shows the requested key.
 *   - Green means a cache hit, blue a positive fill, red a negative fill.
 *   - The final frame reports the hit and miss counts and the cache contents.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Entry = { key: number; positive: boolean };

/** Build request cells with the outcome of each lookup. */
function buildEntities(keys: number[], outcomes: string[], upto: number): VisualEntity[] {
    return keys.map((key, col) => {
        const outcome = outcomes[col];
        const state: EntityState =
            col > upto || !outcome
                ? "idle"
                : outcome === "hit"
                  ? "sorted"
                  : outcome === "positive"
                    ? "visited"
                    : "error";
        return {
            id: `req-${col}`,
            type: "cell" as const,
            label: String(key),
            value: key,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col, key, outcome: outcome ?? "" },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; present?: number[]; capacity?: number } | null) ?? {};
    const keys: number[] = Array.isArray(task.keys) ? task.keys : [1, 2, 1, 3, 2, 3, 4, 1, 4, 2];
    const present: number[] = Array.isArray(task.present) ? task.present : [1, 2, 3];
    const presentSet = new Set(present);
    const capacity = Math.max(1, Math.floor(task.capacity ?? 3));
    const cache: Entry[] = [];
    const outcomes: string[] = [];
    let hits = 0;
    let misses = 0;
    let step = 0;

    yield {
        stepNumber: step++,
        entities: buildEntities(keys, outcomes, -1),
        edges: [],
        description: `Serving ${keys.length} request(s) with a ${capacity}-entry negative cache.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols: keys.length, capacity, hits: 0, misses: 0, cache: [], outcomes: [], phase: "start" },
    };

    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        if (key === undefined) continue;
        const found = cache.findIndex((entry) => entry.key === key);
        let outcome: string;
        if (found >= 0) {
            const entry = cache[found];
            if (entry) {
                cache.splice(found, 1);
                cache.push(entry);
            }
            outcome = "hit";
            hits += 1;
        } else {
            misses += 1;
            const positive = presentSet.has(key);
            outcome = positive ? "positive" : "negative";
            cache.push({ key, positive });
            while (cache.length > capacity) cache.shift();
        }
        outcomes.push(outcome);
        yield {
            stepNumber: step++,
            entities: buildEntities(keys, outcomes, i),
            edges: [],
            description:
                outcome === "hit"
                    ? `Key ${key} is cached; served from cache (${hits} hit${hits === 1 ? "" : "s"}).`
                    : outcome === "positive"
                      ? `Key ${key} is absent from cache; loaded from store and cached as present.`
                      : `Key ${key} is absent from store; cached as a known miss.`,
            codeLineNumber: outcome === "hit" ? 2 : outcome === "positive" ? 4 : 5,
            layout: "grid",
            meta: {
                rows: 1,
                cols: keys.length,
                capacity,
                hits,
                misses,
                cache: cache.map((entry) => ({ key: entry.key, positive: entry.positive })),
                outcomes: outcomes.slice(),
                phase: "lookup",
                index: i,
                outcome,
            },
        };
    }

    yield {
        stepNumber: step++,
        entities: buildEntities(keys, outcomes, keys.length - 1),
        edges: [],
        description: `Done: ${hits} hit(s), ${misses} miss(es); ${cache.length} cached key(s) remain.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: keys.length,
            capacity,
            hits,
            misses,
            cache: cache.map((entry) => ({ key: entry.key, positive: entry.positive })),
            outcomes,
            phase: "done",
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Remember both kinds of answers. If a request succeeds, cache the value; if it fails, cache a marker that says the key is known to be missing. The next request for that key returns immediately without querying the slow backing store. A least-recently-used policy keeps the cache bounded.",
        invariants: [
            "A cached key is either marked present or marked as a known miss.",
            "A lookup that finds a cached key never consults the backing store.",
            "The cache never holds more than capacity entries.",
        ],
        correctness:
            "On a miss the requested key is inserted with a flag matching the backing-store result, so subsequent lookups for that key find an entry and count as hits. LRU eviction removes only the least recently used entry and keeps the size at capacity. Because a negative entry is indistinguishable from a positive one during lookup, both present and absent keys benefit from caching, and the recorded outcome sequence exactly reflects whether each key was in the cache at request time.",
        complexityRationale:
            "A hash lookup, an LRU move-to-end and an eviction are all constant time on average, so each request is O(1) amortized. The cache stores at most capacity entries, giving O(capacity) space.",
        uses: [
            "Avoiding repeated database queries for missing records",
            "DNS negative caching of nonexistent domains",
            "Protecting backing services from repeated failing requests",
        ],
        references: [
            "Wikipedia, Cache (computing), negative caching",
            "RFC 2308, Negative Caching of DNS Queries",
        ],
        workedExample:
            "With capacity 2, present keys {1}, requests 2, 2, 1 produce: miss and cache 2 as absent, hit on 2, miss and cache 1 as present. The second request for 2 never reaches the store.",
    },
    id: "negative-cache",
    name: "Negative Caching",
    category: "production-systems",
    complexity: { time: "O(1) amortized", space: "O(capacity)" },
    defaultInput: { keys: [1, 2, 1, 3, 2, 3, 4, 1, 4, 2], present: [1, 2, 3], capacity: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the request keys, the present set and the cache capacity",
        "for each requested key",
        "if the key is in the cache, move it to most recent and report a hit",
        "otherwise check the backing store for the key",
        "insert a positive entry when found, a negative entry when not",
        "evict the least recently used entry if the cache is full",
        "done: report hit counts and the final cache contents",
    ],
};

export default module;
