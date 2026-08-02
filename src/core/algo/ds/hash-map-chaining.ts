/**
 * hash-map-chaining.ts – Hash Map (separate chaining)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hash map stores key-value pairs in an array of "buckets". Each bucket is
 * a small chain (linked list) holding every key that hashes to that bucket.
 * On average each bucket holds n/m entries (the load factor), so lookups are
 * O(1 + α) ≈ O(1). Chaining is the simplest collision-resolution strategy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / lookup / delete: O(1) average, O(n) worst
 *   Space:                    O(n + m)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Buckets are columns; chains are the entries within them.
 *   - The probed bucket is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Buckets with chains" is the entire idea.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A tiny string hash. */
function hashKey(key: string, buckets: number): number {
    let hash = 0;
    for (const char of key) {
        hash = (hash * 31 + char.charCodeAt(0)) % buckets;
    }
    return hash;
}

/**
 * The Hash Map (chaining) generator.
 *
 * @param input `{ keys, buckets, probe }` – keys to insert and a key to probe.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; buckets?: number; probe?: string } | null) ?? {};
    const keys = task.keys ?? ["cat", "dog", "car", "cow", "bat"];
    const buckets = typeof task.buckets === "number" ? task.buckets : 3;
    const probe = task.probe ?? "dog";

    let step = 0;

    // Distribute keys into buckets.
    const chains: string[][] = Array.from({ length: buckets }, () => []);
    for (const key of keys) {
        chains[hashKey(key, buckets)]?.push(key);
    }

    const makeCells = (activeBucket = -1): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        chains.forEach((chain, bucket) => {
            chain.forEach((key, index) => {
                cells.push({
                    id: `cell-${bucket}-${index}`,
                    type: "cell" as const,
                    label: key,
                    value: key,
                    state: (bucket === activeBucket ? "comparing" : "unvisited") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: index, col: bucket },
                });
            });
        });
        return cells;
    };

    // Frame 0: the filled buckets.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Hash map with ${buckets} bucket(s) – [${keys.join(", ")}] inserted by chaining.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { buckets, keys: keys.length },
    };
    step += 1;

    // Probe a key.
    const targetBucket = hashKey(probe, buckets);
    const found = (chains[targetBucket] ?? []).includes(probe);
    yield {
        stepNumber: step,
        entities: makeCells(targetBucket),
        edges: [],
        description: `"${probe}" hashes to bucket ${targetBucket} – ${found ? "FOUND" : "not found"} by scanning its chain.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { buckets, probe, found },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Average chain length = load factor α = ${keys.length}/${buckets} ≈ ${(keys.length / buckets).toFixed(1)} – lookups are ~O(1).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { buckets, keys: keys.length },
    };
}

/** The Hash Map (chaining) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "hash-map-chaining",
    name: "Hash Map (Chaining)",
    category: "data-structures",
    complexity: { time: "O(1) average", space: "O(n + m)" },
    defaultInput: { keys: ["cat", "dog", "car", "cow", "bat"], buckets: 3, probe: "dog" },
    visualType: "grid",
    run,
};

export default module;
