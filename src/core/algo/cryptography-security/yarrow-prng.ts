/**
 * yarrow-prng.ts - Yarrow Pseudorandom Number Generator (Toy Model)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Yarrow collects entropy into a fast pool for quick reseeds and a slow pool
 * for long-term reseeds. Once the fast pool has enough estimated entropy and
 * the reseed gate allows it, the two pools and the current key are hashed into
 * a new key. Output blocks are then produced by hashing the key with a counter.
 * This teaching model uses a small 32-bit mixer instead of a cryptographic
 * hash, so it illustrates the pool and gate structure without security claims.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(bytes) to absorb entropy, O(blocks) to generate output
 *   Space: O(pool sizes)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the pool fill levels, key, counter, and generated words.
 *   - A reseed is highlighted; generated words are green.
 *   - meta carries the key, counter, reseed count, and output words.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A 32-bit avalanche mixer used as the toy hash. */
export function mix32(bytes: number[]): number {
    let hash = 2166136261;
    for (const byte of bytes) {
        hash ^= byte & 255;
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 2246822507) >>> 0;
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 3266489909) >>> 0;
    return (hash ^ (hash >>> 16)) >>> 0;
}

export interface YarrowState {
    key: number;
    counter: number;
    reseeds: number;
    fast: number[];
    slow: number[];
    sinceReseed: number;
}

export function yarrowInit(seed = 1): YarrowState {
    return {
        key: mix32([seed & 255, (seed >>> 8) & 255, 7, 13]),
        counter: 0,
        reseeds: 0,
        fast: [],
        slow: [],
        sinceReseed: 1,
    };
}

function toBytes(value: number): number[] {
    return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}

/** Absorb entropy into a pool; reseed when the fast pool and gate allow it. */
export function addEntropy(state: YarrowState, pool: "fast" | "slow", bytes: number[], fastThreshold = 4): YarrowState {
    const fast = pool === "fast" ? [...state.fast, ...bytes.map((b) => b & 255)] : state.fast.slice();
    const slow = pool === "slow" ? [...state.slow, ...bytes.map((b) => b & 255)] : state.slow.slice();
    if (fast.length >= fastThreshold && state.sinceReseed >= 1) {
        const key = mix32([...toBytes(state.key), ...slow, ...fast]);
        return { key, counter: 0, reseeds: state.reseeds + 1, fast: [], slow: [], sinceReseed: 0 };
    }
    return { ...state, fast, slow };
}

/** Generate output words, performing a scheduled reseed after sixteen blocks. */
export function generate(state: YarrowState, count: number): { state: YarrowState; values: number[] } {
    let current = { ...state, fast: state.fast.slice(), slow: state.slow.slice() };
    const values: number[] = [];
    for (let i = 0; i < count; i += 1) {
        if (current.sinceReseed >= 16) {
            current = {
                key: mix32([...toBytes(current.key), ...current.slow, ...current.fast]),
                counter: 0,
                reseeds: current.reseeds + 1,
                fast: [],
                slow: [],
                sinceReseed: 0,
            };
        }
        values.push(mix32([...toBytes(current.key), current.counter & 255, 9]));
        current = { ...current, counter: current.counter + 1, sinceReseed: current.sinceReseed + 1 };
    }
    return { state: current, values };
}

function makeBars(values: number[], labels: string[], active: number, state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels[index] ?? `${value}`,
        value,
        state: index === active ? "comparing" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: labels[index] ?? "", value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as {
        seed?: number;
        events?: Array<{ kind: "entropy"; pool: "fast" | "slow"; bytes: number[] } | { kind: "generate"; count: number }>;
    } | null) ?? {};
    const seed = Math.floor(Number(task.seed ?? 11)) || 11;
    const events = Array.isArray(task.events) && task.events.length > 0
        ? task.events
        : [
            { kind: "entropy" as const, pool: "slow" as const, bytes: [1, 2, 3] },
            { kind: "entropy" as const, pool: "fast" as const, bytes: [4, 5, 6, 7] },
            { kind: "generate" as const, count: 3 },
            { kind: "entropy" as const, pool: "fast" as const, bytes: [8, 9, 10, 11] },
            { kind: "generate" as const, count: 2 },
        ];

    let state = yarrowInit(seed);
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: makeBars([state.key], ["key"], 0, "idle"),
        edges: [],
        description: `Yarrow toy generator seeded at ${seed} with two entropy pools.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { toy: true, key: state.key, counter: 0, reseeds: 0, outputs: [] },
    };
    stepNumber += 1;

    for (let index = 0; index < events.length; index += 1) {
        const event = events[index]!;
        const before = state.reseeds;
        let outputs: number[] = [];
        if (event.kind === "entropy") {
            state = addEntropy(state, event.pool, event.bytes);
        } else {
            const result = generate(state, event.count);
            state = result.state;
            outputs = result.values;
        }
        const didReseed = state.reseeds > before;
        const shown = outputs.length > 0 ? outputs : [state.key, state.counter];
        const labels = outputs.length > 0 ? outputs.map((_, i) => `o${i}`) : ["key", "counter"];
        yield {
            stepNumber: stepNumber,
            entities: makeBars(shown, labels, didReseed ? 0 : -1, didReseed ? "comparing" : "sorted"),
            edges: [],
            description: event.kind === "entropy"
                ? `Event ${index}: absorb ${event.bytes.length} byte(s) into the ${event.pool} pool${didReseed ? ", triggering a reseed" : ""}.`
                : `Event ${index}: generate ${event.count} word(s)${didReseed ? " with a scheduled reseed" : ""}.`,
            codeLineNumber: event.kind === "entropy" ? (didReseed ? 3 : 1) : 5,
            layout: "array",
            meta: {
                toy: true,
                key: state.key,
                counter: state.counter,
                reseeds: state.reseeds,
                outputs,
                fast: state.fast.length,
                slow: state.slow.length,
            },
        };
        stepNumber += 1;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Keep two buckets of randomness: a fast one that fills quickly and a slow one that accumulates over time. When the fast bucket has collected enough entropy and enough output blocks have been produced since the last reseed, mix both buckets and the old key into a fresh key. Generate each output block by hashing that key together with a counter, so outputs never repeat until the counter resets.",
        invariants: [
            "The counter increases after every generated block and resets on a reseed.",
            "Each output word is a deterministic hash of the current key and counter.",
            "A reseed replaces the key only when the fast pool is full and the gate is open.",
        ],
        correctness:
            "Because the mixer is deterministic, replaying the same entropy events and generation requests reproduces every output word. The gate prevents frequent reseeds from destroying the accumulated slow-pool entropy, while the counter guarantees distinct inputs to the hash within one reseed period, so the generated words are distinct until the key changes.",
        complexityRationale:
            "Absorbing a batch of bytes touches each byte once, and generating a block hashes a fixed-size input, so total time is linear in the number of bytes and blocks. The two pools plus the key and counter use space proportional to the pool capacities.",
        uses: [
            "Operating-system random number generators",
            "Seeding simulation and randomized algorithms",
            "Teaching entropy pooling and forward secrecy",
        ],
        references: [
            "Kelsey, Schneier, and Ferguson, Yarrow-160, 2001",
            "NIST SP 800-90A, Recommendation for Random Number Generation, 2015",
        ],
        workedExample:
            "With a fast-pool threshold of four bytes, adding three slow-pool bytes does not reseed. Adding four fast-pool bytes fills the gate, so the key becomes a hash of the old key and both pools, the counter resets to zero, and the next generated word is the hash of that new key with counter zero.",
    },
    id: "yarrow-prng",
    name: "Yarrow PRNG (Toy Model)",
    category: "cryptography-security",
    complexity: { time: "O(bytes + blocks)", space: "O(pools)" },
    defaultInput: {
        seed: 11,
        events: [
            { kind: "entropy", pool: "slow", bytes: [1, 2, 3] },
            { kind: "entropy", pool: "fast", bytes: [4, 5, 6, 7] },
            { kind: "generate", count: 3 },
            { kind: "entropy", pool: "fast", bytes: [8, 9, 10, 11] },
            { kind: "generate", count: 2 },
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "derive an initial key from the seed",
        "for each event absorb entropy into the fast or slow pool",
        "when the fast pool is full and the gate is open, mix a new key",
        "reset the counter and empty both pools on a reseed",
        "for a generate event hash the key with the counter",
        "emit one word per requested block",
        "schedule another reseed after a fixed number of blocks",
        "done: report the key, counter, and generated words",
    ],
};

export default module;
