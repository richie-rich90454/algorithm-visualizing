/**
 * linked-hash-map.ts – Linked Hash Map (insertion-ordered)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A linked hash map combines a hash table (O(1) lookups) with a doubly linked
 * list that remembers insertion order. Iterating yields entries in the order
 * they were inserted. This powers LRU caches, ordered maps, and "most recent
 * item" tracking.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / lookup / delete: O(1) average
 *   Iterate:                  O(n) in insertion order
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The hash buckets are shown in one row.
 *   - The insertion-order chain is shown below.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "Hash table + a doubly linked list" is the entire idea.
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
 * The Linked Hash Map generator.
 *
 * @param input `{ keys, buckets }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; buckets?: number } | null) ?? {};
    const keys = task.keys ?? ["one", "two", "three", "four"];
    const buckets = typeof task.buckets === "number" ? task.buckets : 4;

    let step = 0;

    // Bucket assignment and insertion order.
    const order: string[] = [];
    const bucketsArr: string[][] = Array.from({ length: buckets }, () => []);
    for (const key of keys) {
        order.push(key);
        bucketsArr[hashKey(key, buckets)]?.push(key);
    }

    const makeCells = (): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        bucketsArr.forEach((chain, bucket) => {
            chain.forEach((key, index) => {
                cells.push({
                    id: `b-${bucket}-${index}`,
                    type: "cell" as const,
                    label: key,
                    value: key,
                    state: "unvisited",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: 0, col: bucket * 3 + index },
                });
            });
        });
        order.forEach((key, index) => {
            cells.push({
                id: `o-${index}`,
                type: "cell" as const,
                label: key,
                value: key,
                state: "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: index },
            });
        });
        return cells;
    };

    // Frame 0: buckets + order chain.
    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Linked hash map – buckets above, insertion order [${order.join(", ")}] below.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { buckets, keys: keys.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Lookups hit the buckets in O(1); iteration follows the order chain in O(n).`,
        codeLineNumber: 2,
        layout: "grid",
        meta: { buckets, keys: keys.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(),
        edges: [],
        description: `Linked hash map complete – the order chain is the doubly linked list.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { buckets, keys: keys.length },
    };
}

/** The Linked Hash Map module, registered with the engine. */
const module: AlgorithmModule = {
    id: "linked-hash-map",
    name: "Linked Hash Map",
    category: "data-structures",
    complexity: { time: "O(1) average", space: "O(n)" },
    defaultInput: { keys: ["one", "two", "three", "four"], buckets: 4 },
    visualType: "grid",
    run,
};

export default module;
