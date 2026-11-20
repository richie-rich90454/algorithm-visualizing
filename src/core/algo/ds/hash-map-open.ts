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
 * Visualization mapping
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
        codeLineNumber: 6,
        layout: "grid",
        meta: { buckets, probe, found, probes },
    };
}

/** The Hash Map (open addressing) module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "Open addressing stores keys directly in the bucket array. A key's hash gives a home slot; on collision, linear probing tries the next slot until an empty one is found. Lookups follow the same probe sequence and stop at an empty slot, so no chains are needed. Clustering is the main drawback.",
        "invariants": [
            "Each key resides in some slot on its linear probe sequence.",
            "An empty slot terminates a successful or failed search.",
            "Deleted slots are marked so probe sequences remain intact."
        ],
        "correctness": "Insertion places a key in the first free slot along its probe sequence, so a later lookup following the same sequence reaches it. Stopping at a truly empty slot proves the key is absent because no later slot would have been chosen. Tombstones preserve this reasoning after deletion.",
        "complexityRationale": "Expected probe count depends on load factor and is O(1) when the table is kept sparse; worst case is O(n) with heavy clustering. The array of slots uses O(m) space with no per-entry pointers.",
        "uses": [
            "Cache-friendly dictionaries",
            "Language runtime hash tables",
            "Small embedded symbol tables"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 11",
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.4"
        ],
        "workedExample": "With six buckets, cat hashes to slot 1 and car also to slot 1, so car goes to slot 2. Probing dog hashes to slot 3 and finds it there. When load passes the threshold, the table resizes and all keys are rehashed."
    },
    id: "hash-map-open",
    name: "Hash Map (Open Addressing)",
    category: "data-structures",
    complexity: { time: "O(1) average", space: "O(m)" },
    defaultInput: { keys: ["cat", "car", "dog", "cow", "bat"], buckets: 6, probe: "dog" },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize table with empty slots and deleted markers",
        "hash key to home slot by modulo size",
        "probe forward linearly on collision comparing slots",
        "insert into first empty or deleted slot found",
        "if load exceeds threshold then resize and rehash all",
        "lookup by probing until key or empty slot",
        "done: table holds keys with lookup answer",
    ],
};

export default module;
