/**
 * jump-consistent-hashing.ts - Jump Consistent Hashing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Jump consistent hashing maps a 64-bit key to one of b buckets without a hash
 * ring or a table. A pseudo-random generator walks a chain of candidate
 * buckets; each step jumps to a bucket that grows roughly by the golden ratio,
 * and the walk stops when the next jump would reach or pass b. The result is
 * uniform and has minimal disruption: growing the bucket count from b to b+1
 * moves only keys that land in the new bucket. BigInt keeps the multiply exact.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log b) expected jumps per lookup
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar represents each bucket.
 *   - The selected bucket is green, skipped candidates are yellow.
 *   - The meta reports the chosen bucket and the number of jumps made.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface JumpInput {
    keys?: number[];
    buckets?: number;
    seed?: number;
}

const MULTIPLIER = 2862933555777941757n;
const TWO31 = 2147483648n;

/** The jump hash chain for one key, using exact 64-bit arithmetic. */
function jumpChain(key: number, buckets: number, seed: number): { bucket: number; visited: number[] } {
    let state = BigInt.asUintN(64, BigInt(Math.trunc(key)) ^ BigInt(Math.trunc(seed)));
    let b = -1n;
    let j = 0n;
    const visited: number[] = [];
    const bound = BigInt(buckets);
    while (j < bound) {
        b = j;
        visited.push(Number(b));
        state = BigInt.asUintN(64, state * MULTIPLIER + 1n);
        j = ((b + 1n) * TWO31) / ((state >> 33n) + 1n);
    }
    return { bucket: Number(b), visited };
}

function makeBars(buckets: number, chosen: number, visited: number[]): VisualEntity[] {
    return Array.from({ length: buckets }, (_, index) => ({
        id: `bucket-${index}`,
        type: "bar" as const,
        label: String(index),
        value: index,
        state: (
            index === chosen
                ? "sorted"
                : visited.includes(index)
                  ? "comparing"
                  : "idle"
        ) as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, chosen: index === chosen },
    }));
}

/** The jump consistent hashing generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as JumpInput | null) ?? {};
    const buckets = typeof task.buckets === "number" && task.buckets >= 1 ? Math.floor(task.buckets) : 8;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 0;
    const keys: number[] =
        Array.isArray(task.keys) && task.keys.length > 0
            ? task.keys.filter((k): k is number => typeof k === "number")
            : [11, 42, 99, 1234];

    let step = 0;
    yield {
        stepNumber: step++,
        entities: makeBars(buckets, -1, []),
        edges: [],
        description: `Mapping ${keys.length} key(s) into ${buckets} buckets with jump consistent hashing.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { buckets, seed, key: 0, bucket: -1, jumps: 0, done: false },
    };

    for (const key of keys) {
        const { bucket, visited } = jumpChain(key, buckets, seed);
        yield {
            stepNumber: step++,
            entities: makeBars(buckets, bucket, visited),
            edges: [],
            description: `Key ${key}: ${visited.length} jump(s) through ${visited.join(" -> ")}; bucket ${bucket} chosen.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { buckets, seed, key, bucket, jumps: visited.length, visited, done: false },
        };
    }

    const last = keys[keys.length - 1] ?? 0;
    const finalBucket = jumpChain(last, buckets, seed).bucket;
    yield {
        stepNumber: step,
        entities: makeBars(buckets, finalBucket, []),
        edges: [],
        description: `Mapped all ${keys.length} key(s); the last key landed in bucket ${finalBucket}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { buckets, seed, key: last, bucket: finalBucket, jumps: jumpChain(last, buckets, seed).visited.length, done: true },
    };
}

/** The jump consistent hashing module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A classical hash ring needs a sorted table and binary search on every lookup. Jump hashing needs neither: it walks a short pseudo-random chain of candidate bucket numbers and stops as soon as the next candidate would be at least the bucket count. Because each candidate is a deterministic function of the key, the same key always lands in the same bucket, and adding one bucket only steals keys from the bucket that becomes reachable.",
        invariants: [
            "The chosen bucket always lies in the range zero to b minus one.",
            "A key and seed always produce the same bucket and the same chain.",
            "Increasing the bucket count by one moves only keys whose new bucket is b.",
            "The pseudo-random state uses exact 64-bit unsigned arithmetic.",
        ],
        correctness:
            "The jump chain is a deterministic function of the key and multiplier, so equal keys always map to equal buckets. Each iteration sets the current bucket to the previous jump target and only stops when the next target is at least b, which guarantees the returned value is below b. When b grows to b+1, at most one extra iteration runs, so a key either keeps its old bucket or moves to the new bucket b; no key ever moves between two old buckets. This is exactly minimal disruption.",
        complexityRationale:
            "The next jump grows by a factor averaging about 1.46, so the chain length is O(log b) in expectation. Each step is a handful of integer operations and the algorithm stores only the key state and the current candidate, so space is O(1).",
        uses: [
            "Sharding keys across a fixed set of cache servers",
            "Distributed storage placement with minimal remapping",
            "Load balancing where consistent membership matters",
        ],
        references: [
            "Lamping and Veeraraghavan, Jump Consistent Hash: A Simple, Fast, and Space-Efficient Algorithm, 2014",
            "Karger et al., Consistent Hashing and Random Trees, 1997",
        ],
        workedExample:
            "With eight buckets and key 42, the chain starts at bucket 0 and jumps through increasing candidates until the next candidate reaches eight; the last visited candidate is the answer. If the bucket count grows to nine, a key that previously landed in bucket 7 either stays at 7 or moves to the new bucket 8, and no other key changes bucket.",
    },
    id: "jump-consistent-hashing",
    name: "Jump Consistent Hashing",
    category: "parallel-distributed",
    complexity: { time: "O(log b)", space: "O(1)" },
    defaultInput: { keys: [11, 42, 99, 1234], buckets: 8, seed: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the pseudo-random state from the key and seed",
        "set the current bucket to minus one and the jump target to zero",
        "while the jump target is below the bucket count",
        "set the current bucket to the jump target",
        "advance the pseudo-random state with a 64-bit multiply",
        "compute the next jump target from the state",
        "return the current bucket once the target reaches the count",
        "done: report the bucket for every key",
    ],
};

export default module;
