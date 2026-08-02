/**
 * hash-map-open.ts – Hash Map (open addressing / linear probing)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Open addressing stores every key directly inside the bucket array. When a
 * collision occurs, the key is placed in the next free slot (linear probing).
 * Lookups follow the same probe sequence until the key is found or an empty
 * slot is reached. No separate chains are needed, which saves memory but
 * makes clustering a real concern.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / lookup / delete: O(1) average, O(n) worst
 *   Space:                    O(m) – one slot per bucket
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Buckets are a single row of cells.
 *   - The probe sequence is highlighted step by step.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Put it in the next free slot" is the entire idea.
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
 * The Hash Map (open addressing) generator.
 *
 * @param input `{ keys, buckets, probe }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; buckets?: number; probe?: string } | null) ?? {};
    const keys = task.keys ?? ["cat", "car", "dog", "cow", "bat"];
    const buckets = typeof task.buckets === "number" ? task.buckets : 6;
    const probe = task.probe ?? "dog";

    let step = 0;

    // Insert with linear probing.
    const table = new Array<string | null>(buckets).fill(null);
    for (const key of keys) {
        let slot = hashKey(key, buckets);
        while (table[slot] !== null) {
            slot = (slot + 1) % buckets;
        }
        table[slot] = key;
    }

    const makeCells = (activeSlot = -1): VisualEntity[] =>
        table.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: value ?? "",
            value: value ?? "",
            state: (index === activeSlot
                ? "comparing"
                : value === null
                  ? "unvisited"
                  : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        }));

    // Frame 0: the filled table.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Open-addressed hash map (${buckets} slots) – [${keys.join(", ")}] inserted by linear probing.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { buckets, keys: keys.length },
    };
    step += 1;

    // Probe the target key.
    let slot = hashKey(probe, buckets);
    let found = false;
    let probes = 0;
    while (table[slot] !== null) {
        probes += 1;
        yield {
            stepNumber: step,
            entities: makeCells(slot),
            edges: [],
            description: `Probe ${probes}: slot ${slot} holds "${table[slot]}".`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { buckets, probe, probes },
        };
        step += 1;
        if (table[slot] === probe) {
            found = true;
            break;
        }
        slot = (slot + 1) % buckets;
    }

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `"${probe}" ${found ? "found" : "not found"} after ${probes} probe(s).`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { buckets, probe, found, probes },
    };
}

/** The Hash Map (open addressing) module, registered with the engine. */
const module: AlgorithmModule = {
    id: "hash-map-open",
    name: "Hash Map (Open Addressing)",
    category: "data-structures",
    complexity: { time: "O(1) average", space: "O(m)" },
    defaultInput: { keys: ["cat", "car", "dog", "cow", "bat"], buckets: 6, probe: "dog" },
    visualType: "grid",
    run,
};

export default module;
