/**
 * perfect-hashing.ts - FKS Two-Level Perfect Hashing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A perfect hash function maps a fixed set of keys to distinct slots with no
 * collisions. The FKS construction uses two levels: a universal hash spreads
 * the keys into buckets, then each bucket gets its own small universal hash
 * into a table of size s squared, where s is the bucket size. Because the
 * family is universal, a collision-free second-level function is guaranteed to
 * exist for every bucket. Total space is linear in the number of keys.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m + p^2 * s) build time for m keys and small prime p
 *   Space: O(m) slots in expectation, exactly m + sum of s squared here
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per top-level bucket shows how many keys landed there.
 *   - Buckets with collisions are BLUE (comparing); singleton buckets GREEN.
 *   - The final frame reports bucket sizes, second-level tables and total slots.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    keys?: number[];
    seed?: number;
}

const DEFAULT_INPUT: Required<Input> = {
    keys: [12, 25, 38, 41, 57, 63, 79, 84],
    seed: 987,
};

function isPrime(n: number): boolean {
    if (n < 2) {
        return false;
    }
    for (let d = 2; d * d <= n; d += 1) {
        if (n % d === 0) {
            return false;
        }
    }
    return true;
}

function primeAtLeast(n: number): number {
    let value = Math.max(2, Math.ceil(n));
    while (!isPrime(value)) {
        value += 1;
    }
    return value;
}

function lcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state * 1103515245 + 12345) >>> 0;
        return state / 4294967296;
    };
}

function makeBars(sizes: number[], collisionFlags: boolean[], states: Map<number, EntityState>): VisualEntity[] {
    return sizes.map((size, index) => ({
        id: `bar-bucket-${index}`,
        type: "bar" as const,
        label: `B${index}`,
        value: size,
        state: states.get(index) ?? (collisionFlags[index] ? "comparing" : "sorted"),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { bucket: index, size, collided: collisionFlags[index] ?? false },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const raw = (input as Input | null) ?? {};
    const keys: number[] = raw.keys ?? DEFAULT_INPUT.keys;
    const seed = typeof raw.seed === "number" ? raw.seed : DEFAULT_INPUT.seed;
    const uniqueKeys = [...new Set(keys)];
    const m = uniqueKeys.length;
    const maxKey = uniqueKeys.reduce((max, key) => Math.max(max, key), 0);
    const p = primeAtLeast(Math.max(m, maxKey + 1, 2));
    const random = lcg(seed);

    const firstA = 1 + Math.floor(random() * (p - 1));
    const firstB = Math.floor(random() * p);
    const buckets: number[][] = Array.from({ length: m }, () => []);
    for (const key of uniqueKeys) {
        const index = ((firstA * key + firstB) % p) % Math.max(1, m);
        buckets[index]?.push(key);
    }

    const secondA: number[] = [];
    const secondB: number[] = [];
    const secondSize: number[] = [];
    for (const bucket of buckets) {
        const size = bucket.length;
        const tableSize = size * size;
        let chosenA = 1;
        let chosenB = 0;
        let found = false;
        for (let a = 1; a < p && !found; a += 1) {
            for (let b = 0; b < p && !found; b += 1) {
                const seen = new Set<number>();
                let ok = true;
                for (const key of bucket) {
                    const slot = ((a * key + b) % p) % tableSize;
                    if (seen.has(slot)) {
                        ok = false;
                        break;
                    }
                    seen.add(slot);
                }
                if (ok) {
                    chosenA = a;
                    chosenB = b;
                    found = true;
                }
            }
        }
        secondA.push(chosenA);
        secondB.push(chosenB);
        secondSize.push(tableSize);
    }

    const sizes = buckets.map((bucket) => bucket.length);
    const collisionFlags = sizes.map((size) => size > 1);
    const totalSlots = m + secondSize.reduce((sum, size) => sum + size, 0);
    const collisionBuckets = collisionFlags.filter(Boolean).length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(sizes, collisionFlags, new Map()),
        edges: [],
        description: `Building a perfect hash for ${m} key(s) with prime ${p}; first-level hash uses a=${firstA}, b=${firstB}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { keys: m, prime: p, firstA, firstB, buckets: sizes, totalSlots, collisionBuckets },
    };
    step += 1;

    const states = new Map<number, EntityState>();
    for (let index = 0; index < buckets.length; index += 1) {
        states.set(index, "active");
        yield {
            stepNumber: step,
            entities: makeBars(sizes, collisionFlags, states),
            edges: [],
            description: `Bucket ${index} holds ${sizes[index]} key(s) and gets a second-level table of ${secondSize[index]} slot(s).`,
            codeLineNumber: 2,
            layout: "array",
            meta: {
                bucket: index,
                size: sizes[index] ?? 0,
                tableSize: secondSize[index] ?? 0,
                secondA: secondA[index] ?? 0,
                secondB: secondB[index] ?? 0,
            },
        };
        step += 1;
        states.set(index, collisionFlags[index] ? "comparing" : "sorted");
    }

    yield {
        stepNumber: step,
        entities: makeBars(sizes, collisionFlags, states),
        edges: [],
        description: `Perfect hash complete: ${m} key(s) map to distinct slots using ${totalSlots} total slots across ${buckets.length} bucket(s).`,
        codeLineNumber: 5,
        layout: "array",
        meta: {
            keys: m,
            prime: p,
            firstA,
            firstB,
            buckets: sizes,
            secondA,
            secondB,
            secondSize,
            totalSlots,
            collisionBuckets,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single hash function into a table with one slot per key will almost surely collide. FKS fixes this by using two levels. The first function scatters keys into buckets; a bucket with s keys receives its own tiny table of s squared slots and its own function chosen so that its keys miss each other. Search is still two arithmetic operations, and the total number of slots stays linear.",
        invariants: [
            "Keys in the same bucket receive distinct slots in that bucket's second-level table.",
            "A bucket of size s uses exactly s squared second-level slots.",
            "Different buckets occupy disjoint slot ranges, so no two keys collide anywhere.",
        ],
        correctness:
            "A universal hash family guarantees that for a bucket of s keys and a table of s squared slots, more than half of the functions are collision-free, so exhaustive search finds one. Since each bucket's function separates its own keys and buckets are disjoint, every key maps to a unique global slot. Lookup recomputes the same two hashes and therefore always finds the stored key in constant time.",
        complexityRationale:
            "Building the first level is linear in the key count. The exhaustive second-level search is bounded by the small prime squared times the bucket size, and the resulting space is the top-level table plus the sum of s squared, which is linear in expectation for a universal first-level hash.",
        uses: [
            "Static dictionaries with guaranteed worst-case constant lookup",
            "Keyword recognition in compilers",
            "Router forwarding tables built once and queried frequently",
        ],
        references: [
            "Fredman, Komlos and Szemeredi, Storing a Sparse Table with O(1) Worst Case Access Time, 1984",
            "Cormen et al., Introduction to Algorithms, Chapter 11",
        ],
        workedExample:
            "Hashing eight keys into eight buckets may put three keys in one bucket. That bucket gets a table of nine slots and a second hash chosen so the three keys land in slots 1, 4 and 7. Singleton buckets need only one slot each, so the whole structure uses well under a hundred slots.",
    },
    id: "perfect-hashing",
    name: "Perfect Hashing (FKS)",
    category: "searching",
    complexity: { time: "O(m + p^2 * s)", space: "O(m)" },
    defaultInput: DEFAULT_INPUT,
    visualType: "array",
    run,
    pseudocode: [
        "choose a prime p at least as large as the key count",
        "pick universal coefficients a and b for the top-level hash",
        "distribute the keys into top-level buckets",
        "for each bucket of size s build a table of s squared slots",
        "search universal coefficients that separate the bucket's keys",
        "store each key at its second-level slot",
        "look up a key by recomputing both hashes",
    ],
};

export default module;
