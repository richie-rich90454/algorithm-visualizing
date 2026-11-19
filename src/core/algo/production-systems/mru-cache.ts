/**
 * mru-cache.ts - Most Recently Used Cache
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MRU is the opposite of LRU: when the cache is full it evicts the item that
 * was just used. This is useful when old items are more likely to be needed
 * again, as in a nested loop where the most recently touched block is no
 * longer relevant once the inner loop advances.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * capacity) for m accesses
 *   Space: O(capacity) for the resident items
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Top row: the reference string; the current access is highlighted.
 *   - Bottom row: cache slots, ordered oldest to newest; the newest is evicted.
 *   - Metadata records hits, faults, and the eviction history.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface CacheInput {
    capacity?: number;
    accesses?: number[];
}

/** Build the reference and cache cells for one step. */
function makeCells(
    accesses: number[],
    cache: number[],
    capacity: number,
    current: number,
    evicted: number | null,
): VisualEntity[] {
    const entities: VisualEntity[] = accesses.map((page, index) => {
        const state: EntityState =
            index === current ? "comparing" : index < current ? "visited" : "unvisited";
        return {
            id: `ref-${index}`,
            type: "cell" as const,
            label: String(page),
            value: page,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, page },
        };
    });
    for (let slot = 0; slot < capacity; slot += 1) {
        const page = cache[slot];
        const state: EntityState =
            page === undefined ? "idle" : page === evicted ? "error" : page === accesses[current] ? "active" : "visited";
        entities.push({
            id: `slot-${slot}`,
            type: "cell" as const,
            label: page === undefined ? "-" : String(page),
            value: page ?? -1,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: slot, page: page ?? -1 },
        });
    }
    return entities;
}

/** The MRU cache generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CacheInput | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 3;
    const accesses = Array.isArray(task.accesses)
        ? [...task.accesses]
        : [1, 2, 3, 2, 4, 2, 3, 1, 5, 2];
    const cols = Math.max(accesses.length, capacity);
    const cache: number[] = [];
    const faultLog: number[] = [];
    let hits = 0;
    let faults = 0;
    let evictions = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, cache, capacity, -1, null),
        edges: [],
        description: `Starting an empty MRU cache with ${capacity} slot(s) over ${accesses.length} accesses.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hits, faults, evictions, cache: [], faultLog: [] },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const page = accesses[i] ?? 0;
        let evicted: number | null = null;
        const at = cache.indexOf(page);
        if (at >= 0) {
            hits += 1;
            faultLog.push(0);
            cache.splice(at, 1);
            cache.push(page);
        } else {
            faults += 1;
            faultLog.push(1);
            if (cache.length >= capacity) {
                evicted = cache.pop() ?? null;
                evictions += 1;
            }
            cache.push(page);
        }
        yield {
            stepNumber: step,
            entities: makeCells(accesses, cache, capacity, i, evicted),
            edges: [],
            description:
                at >= 0
                    ? `Access ${page}: hit, moved to the newest end.`
                    : `Access ${page}: fault${evicted === null ? ", free slot used" : `, evicted newest page ${evicted}`}.`,
            codeLineNumber: at >= 0 ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 2,
                cols,
                capacity,
                hits,
                faults,
                evictions,
                cache: [...cache],
                faultLog: [...faultLog],
            },
        };
        step += 1;
    }
}

/** The MRU cache module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep items ordered from oldest to newest. A hit moves the item to the newest end. When a new item needs space and the cache is full, throw away the newest item instead of the oldest. This favors data that is revisited only after a long delay.",
        invariants: [
            "The cache order runs from least to most recently used.",
            "A hit never changes the number of resident items.",
            "On a full-cache fault the most recently used item is removed.",
        ],
        correctness:
            "Hits append the page to the new end, so the rightmost resident page is by construction the most recently used. On a miss with a full cache the algorithm removes exactly that page, which implements the most-recently-used rule. Cache size is restored to capacity by appending the new page, so all states satisfy the policy definition.",
        complexityRationale:
            "Each access uses an index search, a splice, and a push on an array of length at most capacity, so an access costs O(capacity) and m accesses cost O(m * capacity). Only the resident keys are stored, giving O(capacity) space.",
        uses: [
            "Nested-loop join and scan processing in databases",
            "Tape and block reuse patterns where the newest block is stale",
            "A teaching contrast to least-recently-used replacement",
        ],
        references: [
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 9",
            "Knuth, The Art of Computer Programming Vol. 1, Cache Memory subsection",
        ],
        workedExample:
            "With capacity three and accesses 1, 2, 3, 2, 4: after filling the cache as [1, 2, 3], the hit on 2 reorders it to [1, 3, 2]. The access to 4 faults and evicts the newest page 2, leaving [1, 3, 4].",
    },
    id: "mru-cache",
    name: "Most Recently Used Cache",
    category: "production-systems",
    complexity: { time: "O(m * capacity)", space: "O(capacity)" },
    defaultInput: {
        capacity: 3,
        accesses: [1, 2, 3, 2, 4, 2, 3, 1, 5, 2],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize an empty cache with the given capacity",
        "for each page in the reference string",
        "if the page is resident, record a hit",
        "remove it and append it at the newest end",
        "otherwise record a fault",
        "if the cache is full, remove the newest page",
        "append the requested page at the newest end",
        "done: report hits, faults, and evictions",
    ],
};

export default module;
