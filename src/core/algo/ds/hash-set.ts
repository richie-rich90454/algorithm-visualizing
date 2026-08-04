/**
 * hash-set.ts – Hash Set
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A hash set stores unique values with the same hash-table mechanics as a hash
 * map, but without values – only keys. Membership tests are O(1) average.
 * Duplicates are rejected on insert, which is the defining behavior.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / contains / delete: O(1) average
 *   Space:                      O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Buckets are shown as cells.
 *   - The probed value is YELLOW (comparing).
 *   - Duplicate rejections are RED (swapped).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Membership, not values" is the entire idea.
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
 * The Hash Set generator.
 *
 * @param input `{ keys, buckets }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; buckets?: number } | null) ?? {};
    const keys = task.keys ?? ["cat", "dog", "cat", "bird", "dog"];
    const buckets = typeof task.buckets === "number" ? task.buckets : 4;

    let step = 0;

    const table = new Array<string | null>(buckets).fill(null);
    const inserts: string[] = [];

    const makeCells = (active = -1): VisualEntity[] =>
        table.map((value, index) => ({
            id: `cell-${index}`,
            type: "cell" as const,
            label: value ?? "",
            value: value ?? "",
            state: (index === active
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

    // Frame 0: the empty set.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Hash set with ${buckets} bucket(s) – inserting [${keys.join(", ")}].`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { buckets, unique: 0 },
    };
    step += 1;

    // Insert, rejecting duplicates.
    for (const key of keys) {
        let slot = hashKey(key, buckets);
        let found = false;
        let scanned = 0;
        while (table[slot] !== null && scanned < buckets) {
            if (table[slot] === key) {
                found = true;
                break;
            }
            slot = (slot + 1) % buckets;
            scanned += 1;
        }

        if (!found && table[slot] === null) {
            table[slot] = key;
            inserts.push(key);
        }

        yield {
            stepNumber: step,
            entities: makeCells(slot),
            edges: [],
            description: found
                ? `"${key}" is already present – duplicate rejected.`
                : `"${key}" inserted at slot ${slot}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { buckets, unique: inserts.length },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Set contains ${inserts.length} unique value(s): [${inserts.join(", ")}].`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { buckets, unique: inserts.length },
    };
}

/** The Hash Set module, registered with the engine. */
const module: AlgorithmModule = {
    id: "hash-set",
    name: "Hash Set",
    category: "data-structures",
    complexity: { time: "O(1) average", space: "O(n)" },
    defaultInput: { keys: ["cat", "dog", "cat", "bird", "dog"], buckets: 4 },
    visualType: "grid",
    run,
};

export default module;
