/**
 * bloom-filter.ts – Bloom Filter
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Bloom filter is a space-efficient probabilistic set. It stores a bit
 * array and k hash functions. Inserting a key sets the k bits at its hash
 * positions; membership checks test those bits. It never gives false
 * negatives, but it can give false positives (a key reported present that was
 * never inserted) as the array fills.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / membership: O(k) – k hash evaluations
 *   Space:               O(m) bits for an m-bit array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The bit array is shown as cells.
 *   - The k bits set by an insert are highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "False positives, never false negatives" is the entire trade-off.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Number of hash functions. */
const K = 3;

/** Two string hashes combined to produce k positions. */
function hash1(key: string): number {
    let h = 5381;
    for (const char of key) {
        h = (h * 33 + char.charCodeAt(0)) >>> 0;
    }
    return h;
}
function hash2(key: string): number {
    let h = 0;
    for (const char of key) {
        h = (h * 31 + char.charCodeAt(0)) >>> 0;
    }
    return h;
}

/**
 * The Bloom Filter generator.
 *
 * @param input `{ keys, m, probe }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; m?: number; probe?: string } | null) ?? {};
    const keys = task.keys ?? ["apple", "banana", "cherry"];
    // Only positive integers size the bit array (`new Array` throws on
    // floats/NaN).
    const rawM = typeof task.m === "number" ? task.m : 20;
    const m = Number.isInteger(rawM) && rawM > 0 ? rawM : 20;
    const probe = task.probe ?? "banana";

    let step = 0;
    const bits = new Array<boolean>(m).fill(false);

    const positions = (key: string): number[] => {
        const h1 = hash1(key);
        const h2 = hash2(key);
        const result: number[] = [];
        for (let i = 0; i < K; i += 1) {
            result.push((((h1 + i * h2) % m) + m) % m);
        }
        return result;
    };

    const makeCells = (active: number[] = []): VisualEntity[] =>
        bits.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: value ? "1" : "0",
            value: value ? 1 : 0,
            state: (active.includes(index)
                ? "comparing"
                : value
                  ? "sorted"
                  : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        }));

    // Frame 0: the empty bit array.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Bloom filter with ${m} bits and ${K} hash functions.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { m, k: K },
    };
    step += 1;

    // Insert keys.
    for (const key of keys) {
        const pos = positions(key);
        for (const p of pos) {
            bits[p] = true;
        }
        yield {
            stepNumber: step,
            entities: makeCells(pos),
            edges: [],
            description: `Inserted "${key}" – set bits at [${pos.join(", ")}].`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { m, k: K },
        };
        step += 1;
    }

    // Probe a key.
    const pos = positions(probe);
    const possiblyPresent = pos.every((p) => bits[p]);
    yield {
        stepNumber: step,
        entities: makeCells(pos),
        edges: [],
        description: possiblyPresent
            ? `"${probe}" may be present (all ${K} bits set – possibly a false positive).`
            : `"${probe}" is definitely NOT present (a bit is clear).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { m, k: K, present: possiblyPresent },
    };
}

/** The Bloom Filter module, registered with the engine. */
const module: AlgorithmModule = {
    id: "bloom-filter",
    name: "Bloom Filter",
    category: "data-structures",
    complexity: { time: "O(k)", space: "O(m)" },
    defaultInput: { keys: ["apple", "banana", "cherry"], m: 20, probe: "banana" },
    visualType: "grid",
    run,
};

export default module;
