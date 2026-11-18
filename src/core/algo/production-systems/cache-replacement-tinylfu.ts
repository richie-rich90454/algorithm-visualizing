/**
 * cache-replacement-tinylfu.ts - TinyLFU Cache Admission Policy
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * TinyLFU protects a cache from one-hit wonders by admitting a new item only
 * when its estimated frequency exceeds that of the least recently used victim.
 * Frequencies live in a compact count-min sketch of four-bit counters with
 * periodic aging, and the cache itself is managed as a small LRU list. A hit
 * always succeeds; a miss either displaces the victim or is rejected.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(capacity + rows) per access
 *   Space: O(capacity + rows * width) for the cache and the sketch
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero is the access stream; row one is the cache's resident keys.
 *   - A hit is green, an admitted miss is yellow, a rejected miss is red.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const ROWS = 4;
const WIDTH = 32;
const MAX_COUNTER = 15;
const PRIMES = [3, 5, 7, 11];
const SALTS = [1, 3, 5, 7];

/** One of four independent hash positions in the sketch. */
function hash(value: number, row: number): number {
    return (Math.imul(value + 1, PRIMES[row] as number) + (SALTS[row] as number)) % WIDTH;
}

/** Build the access row and the cache row for one frame. */
function makeCells(
    accesses: number[],
    decisions: string[],
    current: number,
    cache: number[],
    capacity: number,
): VisualEntity[] {
    const entities: VisualEntity[] = accesses.map((key, index) => {
        let state: EntityState = "idle";
        const decision = decisions[index];
        if (decision === "hit" || decision === "admit") state = "sorted";
        if (decision === "reject") state = "error";
        if (index === current) state = "comparing";
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
            type: "cell" as const,
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

/** The TinyLFU generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { capacity?: number; accesses?: number[] } | null) ?? {};
    const capacity = typeof task.capacity === "number" ? Math.max(1, Math.floor(task.capacity)) : 4;
    const accesses = Array.isArray(task.accesses)
        ? [...task.accesses].map(Number)
        : [1, 2, 3, 1, 2, 4, 5, 1, 3, 5, 6, 2, 4, 6, 7, 1];
    const cols = Math.max(accesses.length, capacity);
    const sketch: number[][] = Array.from({ length: ROWS }, () => new Array<number>(WIDTH).fill(0));
    const cache: number[] = [];
    const decisions: string[] = [];
    let increments = 0;
    let hits = 0;
    let misses = 0;
    let admits = 0;
    let rejects = 0;
    let evictions = 0;
    let resets = 0;
    const resetAt = 10 * capacity;

    const estimate = (key: number): number => {
        let min = MAX_COUNTER;
        for (let row = 0; row < ROWS; row += 1) {
            min = Math.min(min, sketch[row]?.[hash(key, row)] as number);
        }
        return min;
    };
    const increment = (key: number): void => {
        for (let row = 0; row < ROWS; row += 1) {
            const position = hash(key, row);
            const rowArray = sketch[row] as number[];
            rowArray[position] = Math.min(MAX_COUNTER, (rowArray[position] as number) + 1);
        }
        increments += 1;
        if (increments >= resetAt) {
            for (const rowArray of sketch) {
                for (let i = 0; i < WIDTH; i += 1) rowArray[i] = Math.floor((rowArray[i] as number) / 2);
            }
            increments = 0;
            resets += 1;
        }
    };

    yield {
        stepNumber: 0,
        entities: makeCells(accesses, decisions, -1, cache, capacity),
        edges: [],
        description: `Starting an empty TinyLFU cache of capacity ${capacity} with a ${ROWS}-row frequency sketch.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hits, misses, admits, rejects, evictions, resets, cache: [], decisions: [] },
    };
    let step = 1;

    for (let i = 0; i < accesses.length; i += 1) {
        const key = accesses[i] as number;
        increment(key);
        const position = cache.indexOf(key);
        let decision: string;
        if (position >= 0) {
            cache.splice(position, 1);
            cache.push(key);
            hits += 1;
            decision = "hit";
        } else {
            misses += 1;
            const candidateFrequency = estimate(key);
            if (cache.length < capacity) {
                cache.push(key);
                admits += 1;
                decision = "admit";
            } else {
                const victim = cache[0] as number;
                const victimFrequency = estimate(victim);
                if (candidateFrequency > victimFrequency) {
                    cache.shift();
                    cache.push(key);
                    evictions += 1;
                    admits += 1;
                    decision = "admit";
                } else {
                    rejects += 1;
                    decision = "reject";
                }
            }
        }
        decisions.push(decision);
        yield {
            stepNumber: step,
            entities: makeCells(accesses, decisions, i, cache, capacity),
            edges: [],
            description: `Access ${key}: ${decision}${decision === "reject" ? ` (frequency ${estimate(key)} not above victim)` : ""}; cache ${cache.join(", ") || "empty"}.`,
            codeLineNumber: decision === "hit" ? 2 : decision === "reject" ? 5 : 3,
            layout: "grid",
            meta: {
                rows: 2,
                cols,
                capacity,
                hits,
                misses,
                admits,
                rejects,
                evictions,
                resets,
                cache: [...cache],
                decisions: [...decisions],
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(accesses, decisions, accesses.length, cache, capacity),
        edges: [],
        description: `Trace complete: ${hits} hit(s), ${admits} admit(s), ${rejects} reject(s), ${evictions} eviction(s), ${resets} sketch reset(s).`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { rows: 2, cols, capacity, hits, misses, admits, rejects, evictions, resets, cache: [...cache], decisions: [...decisions] },
    };
}

/** The TinyLFU module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain least-recently-used cache can be fooled by a scan that touches each item once. TinyLFU adds a small frequency filter: before admitting a new key it compares the key's estimated popularity with the least recently used resident. A one-time visitor loses to a frequently seen resident and is rejected, while a genuinely hot newcomer earns its place.",
        invariants: [
            "Counter values stay between zero and fifteen.",
            "A hit never changes the number of resident keys.",
            "The cache never exceeds its capacity.",
        ],
        correctness:
            "The count-min sketch overestimates frequencies but never underestimates them, because each row hashes a key to one counter and the minimum of those counters is at least the true count. Admitting only when the candidate estimate exceeds the victim estimate therefore cannot admit an item less popular than the victim under the true counts. Aging halves all counters periodically so past popularity fades, letting the policy adapt to changing workloads while keeping the same overestimate guarantee.",
        complexityRationale:
            "Each access updates four sketch counters and scans at most capacity cache slots, so time is O(capacity plus rows), which is constant for fixed settings. The cache and the four-by-width sketch use O(capacity plus rows times width) space.",
        uses: [
            "Admission control in content delivery network caches",
            "Protecting in-memory caches from scan pollution",
            "Second-level caches in key-value stores and databases",
        ],
        references: [
            "Einziger, Friedman, and Manes, TinyLFU: A Highly Efficient Cache Admission Policy, 2017",
            "Brotman et al., On the Benefits and Pitfalls of Frequency-Based Caching, 2017",
        ],
        workedExample:
            "With capacity two and accesses 1, 2, 1, 3: keys 1 and 2 fill the cache. Key 1 appears again, raising its sketch frequency. When key 3 arrives once, its estimate is one while the victim key 2 has estimate one, so the comparison is not strictly greater and key 3 is rejected, leaving the frequently used key 1 protected.",
    },
    id: "cache-replacement-tinylfu",
    name: "TinyLFU Cache Replacement",
    category: "production-systems",
    complexity: { time: "O(capacity + rows)", space: "O(capacity + rows * width)" },
    defaultInput: { capacity: 4, accesses: [1, 2, 3, 1, 2, 4, 5, 1, 3, 5, 6, 2, 4, 6, 7, 1] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize an empty cache and a four-row frequency sketch",
        "for each requested key in the access stream",
        "increment its sketch counters and age them when due",
        "if the key is resident, move it to the most recent end",
        "otherwise estimate the candidate and the least recent victim",
        "admit when the candidate estimate exceeds the victim estimate",
        "otherwise reject the candidate and keep the cache unchanged",
        "done: report hits, admits, rejects, and final cache",
    ],
};

export default module;
