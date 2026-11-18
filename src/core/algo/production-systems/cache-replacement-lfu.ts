/**
 * cache-replacement-lfu.ts - Least Frequently Used Cache Replacement
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A fixed-size LFU cache keeps the items accessed most often. Each resident key
 * has a use count; on a hit its count rises and its recency is refreshed. On a
 * miss with a full cache, the least frequently used key is evicted, with least
 * recently used as the tie-breaker. This keeps the policy deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(capacity) per access to scan for the victim
 *   Space: O(capacity) for resident keys, counts, and recency stamps
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The top row is the access stream; the bottom row is the cache.
 *   - Each cache slot shows its key and frequency; a hit is green, a miss red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LfuInput {
    capacity?: number;
    accesses?: number[];
}

function makeCells(
    accesses: number[],
    keys: number[],
    frequencies: number[],
    capacity: number,
    decisions: boolean[],
    current: number,
): VisualEntity[] {
    const cols = Math.max(accesses.length, capacity);
    const entities: VisualEntity[] = accesses.map((key, index) => {
        let state: EntityState = "idle";
        if (index < decisions.length) {
            state = decisions[index] ? "sorted" : "error";
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
        const key = keys[slot];
        const frequency = frequencies[slot] ?? 0;
        entities.push({
            id: `slot-${slot}`,
            type: "cell",
            label: key === undefined ? "-" : `${key}:${frequency}`,
            value: key ?? -1,
            state: key === undefined ? "idle" : "visited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: slot, key: key ?? -1, frequency },
        });
    }
    return entities;
}

/** The LFU cache generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LfuInput | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 3;
    const accesses = Array.isArray(task.accesses)
        ? [...task.accesses]
        : [1, 2, 3, 1, 2, 4, 1, 5, 2, 3, 4, 5];
    const cols = Math.max(accesses.length, capacity);
    const keys: number[] = [];
    const frequencies: number[] = [];
    const recency: number[] = [];
    const decisions: boolean[] = [];
    const evictions: number[] = [];
    let clock = 0;
    let hits = 0;
    let misses = 0;

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, keys, frequencies, capacity, decisions, -1),
        edges: [],
        description: `Starting an empty LFU cache holding up to ${capacity} item(s); LRU breaks frequency ties.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hits, misses, evictions: 0, keys: [], frequencies: [], decisions: [], evicted: [] },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const key = accesses[i] ?? 0;
        clock += 1;
        const position = keys.indexOf(key);
        let evictedKey = -1;
        if (position >= 0) {
            frequencies[position] = (frequencies[position] ?? 0) + 1;
            recency[position] = clock;
            hits += 1;
            decisions.push(true);
        } else {
            misses += 1;
            decisions.push(false);
            if (keys.length >= capacity) {
                let victim = 0;
                for (let j = 1; j < keys.length; j += 1) {
                    const frequencyJ = frequencies[j] ?? 0;
                    const frequencyVictim = frequencies[victim] ?? 0;
                    if (frequencyJ < frequencyVictim || (frequencyJ === frequencyVictim && (recency[j] ?? 0) < (recency[victim] ?? 0))) {
                        victim = j;
                    }
                }
                evictedKey = keys[victim] ?? -1;
                keys.splice(victim, 1);
                frequencies.splice(victim, 1);
                recency.splice(victim, 1);
                evictions.push(evictedKey);
            }
            keys.push(key);
            frequencies.push(1);
            recency.push(clock);
        }
        yield {
            stepNumber: step,
            entities: makeCells(accesses, keys, frequencies, capacity, decisions, i),
            edges: [],
            description: `Access ${key}: ${position >= 0 ? "hit" : "miss"}${evictedKey >= 0 ? `, evicted ${evictedKey}` : ""}. Cache: ${keys.map((k, j) => `${k}:${frequencies[j]}`).join(", ") || "empty"}.`,
            codeLineNumber: position >= 0 ? 3 : 5,
            layout: "grid",
            meta: {
                rows: 2,
                cols,
                capacity,
                hits,
                misses,
                evictions: evictions.length,
                keys: [...keys],
                frequencies: [...frequencies],
                decisions: decisions.map((d) => (d ? 1 : 0)),
                evicted: [...evictions],
            },
        };
        step += 1;
    }
}

/** The LFU cache module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Count how often each cached item is used and keep the popular ones. When space runs out, drop the item with the smallest count. If several items are equally unpopular, remove the one that has gone unused the longest, which keeps the choice predictable and fair.",
        invariants: [
            "Every resident key has a positive integer frequency.",
            "A hit never changes the cache size and increments exactly one frequency.",
            "The cache size never exceeds its capacity.",
        ],
        correctness:
            "On a hit the key stays resident and its count rises. On a miss with a full cache the scan selects the minimum frequency and uses recency to break ties, which is exactly the LFU-with-LRU-tie policy. Inductively the resident set and counts match the policy after every access.",
        complexityRationale:
            "Each access does a linear search for the key and, on a full-cache miss, another linear scan for the victim, so the time is O(capacity). The resident keys, counts, and recency stamps use O(capacity) space.",
        uses: [
            "Application-level object caches with skewed popularity",
            "Database buffer pools where some pages are reused heavily",
            "A comparison point against LRU and ARC policies",
        ],
        references: [
            "Mattson et al., Evaluation Techniques for Storage Hierarchies, 1970",
            "Silberschatz, Galvin, and Gagne, Operating System Concepts, Chapter 10",
        ],
        workedExample:
            "With capacity three and accesses 1, 2, 3, 1, 2, 4: after the first three misses the counts are 1, 1, 1. Accesses 1 and 2 raise their counts to two. Access 4 misses and evicts key 3, the only key with count one, leaving 1:2, 2:2, 4:1.",
    },
    id: "cache-replacement-lfu",
    name: "LFU Cache Replacement (LRU Tie-Break)",
    category: "production-systems",
    complexity: { time: "O(capacity) per access", space: "O(capacity)" },
    defaultInput: { capacity: 3, accesses: [1, 2, 3, 1, 2, 4, 1, 5, 2, 3, 4, 5] },
    visualType: "grid",
    run,
    pseudocode: [
        "start with an empty cache and a recency clock",
        "for each requested key in the access stream",
        "if the key is resident, increment its frequency",
        "otherwise, if full, evict the least frequent key",
        "break frequency ties by oldest recency",
        "insert the new key with frequency one",
        "done: report hits, misses, and evictions",
    ],
};

export default module;
