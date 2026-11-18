/**
 * cache-replacement-lru.ts - Least Recently Used Cache Replacement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A fixed-size cache keeps the items accessed most recently. On a hit the item
 * moves to the most recently used end; on a miss it is inserted there, and if
 * the cache is full the least recently used item is evicted. This implementation
 * keeps a small array ordered from least to most recent so eviction removes the
 * front item.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(capacity) per access with an ordered array
 *   Space: O(capacity) for the resident keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The top row is the access stream; the bottom row is the cache.
 *   - A hit is green, a miss is yellow, and the active cache slot is purple.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build the access row and the cache row for one frame. */
function makeCells(
    accesses: number[],
    cache: number[],
    capacity: number,
    decisions: boolean[],
    current: number,
): VisualEntity[] {
    const entities: VisualEntity[] = accesses.map((key, index) => {
        let state: EntityState = "idle";
        if (index < decisions.length) {
            state = decisions[index] ? "sorted" : "comparing";
        }
        if (index === current) {
            state = "active";
        }
        return {
            id: `access-${index}`,
            type: "cell" as const,
            label: String(key),
            value: key,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index, key },
        };
    });
    for (let slot = 0; slot < capacity; slot += 1) {
        const key = cache[slot];
        entities.push({
            id: `slot-${slot}`,
            type: "cell",
            label: key === undefined ? "-" : String(key),
            value: key ?? -1,
            state: key === undefined ? "idle" : "visited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: slot, key: key ?? -1 },
        });
    }
    return entities;
}

/** The LRU cache generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { capacity?: number; accesses?: number[] } | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 3;
    const accesses = Array.isArray(task.accesses)
        ? [...task.accesses]
        : [1, 2, 3, 2, 4, 1, 5, 2, 3, 4, 5];
    const cols = Math.max(accesses.length, capacity);
    const cache: number[] = [];
    const decisions: boolean[] = [];
    let hits = 0;
    let misses = 0;
    let evictions = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, cache, capacity, decisions, -1),
        edges: [],
        description: `Starting an empty cache that holds up to ${capacity} item(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hits, misses, evictions, cache: [], decisions: [] },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const key = accesses[i] ?? 0;
        const position = cache.indexOf(key);
        if (position >= 0) {
            cache.splice(position, 1);
            cache.push(key);
            hits += 1;
            decisions.push(true);
        } else {
            misses += 1;
            decisions.push(false);
            if (cache.length >= capacity) {
                cache.shift();
                evictions += 1;
            }
            cache.push(key);
        }
        yield {
            stepNumber: step,
            entities: makeCells(accesses, cache, capacity, decisions, i),
            edges: [],
            description: `Access ${key}: ${position >= 0 ? "hit" : "miss"}, cache holds ${cache.join(", ") || "nothing"}.`,
            codeLineNumber: position >= 0 ? 4 : 6,
            layout: "grid",
            meta: {
                rows: 2,
                cols,
                capacity,
                hits,
                misses,
                evictions,
                cache: [...cache],
                decisions: decisions.map((d) => (d ? 1 : 0)),
            },
        };
        step += 1;
    }
}

/** The LRU cache module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep the cache as a line from oldest to newest. When an item is used, move it to the new end. If a new item must be added and the line is full, drop the item at the old end. The item that has gone unused the longest is the best candidate to evict.",
        invariants: [
            "The cache array is ordered from least recently used to most recently used.",
            "A hit never changes the number of resident items.",
            "The cache size never exceeds its capacity.",
        ],
        correctness:
            "Moving a hit to the new end makes the order always reflect recency of access. On a miss with a full cache, the front element is by definition the one used longest ago, so evicting it implements the least recently used policy exactly.",
        complexityRationale:
            "Finding, removing, and appending an item in the ordered array each take O(capacity) steps, so an access costs O(capacity). Only the resident keys and the decision log are stored.",
        uses: [
            "CPU and database page caches",
            "Content delivery network object caches",
            "In-memory application caches such as memoization layers",
        ],
        references: [
            "Mattson et al., Evaluation Techniques for Storage Hierarchies, 1970",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 10",
        ],
        workedExample:
            "With capacity three and accesses 1, 2, 3, 2, 4: after the first three misses the cache is [1, 2, 3]. Accessing 2 is a hit and reorders it to [1, 3, 2]. Accessing 4 misses and evicts 1, leaving [3, 2, 4].",
    },
    id: "cache-replacement-lru",
    name: "LRU Cache Replacement",
    category: "production-systems",
    complexity: { time: "O(capacity) per access", space: "O(capacity)" },
    defaultInput: { capacity: 3, accesses: [1, 2, 3, 2, 4, 1, 5, 2, 3, 4, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty least-to-most-recent list",
        "for each requested key in the access stream",
        "if the key is resident",
        "move it to the most recent end and count a hit",
        "otherwise count a miss and insert it at that end",
        "if the cache is now too large, evict the least recent key",
        "done: report hits, misses, evictions, and final cache",
    ],
};

export default module;
