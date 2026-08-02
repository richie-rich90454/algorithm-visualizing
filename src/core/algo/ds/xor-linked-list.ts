/**
 * xor-linked-list.ts – XOR Linked List (memory-efficient doubly linked list)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A XOR linked list stores only ONE pointer per node instead of two: the XOR
 * of the previous and next node addresses. Traversing forward recovers the
 * next node as `prev XOR node->both`; traversing backward recovers the
 * previous as `next XOR node->both`. It halves the pointer overhead of a
 * doubly linked list at the cost of losing the ability to walk backwards
 * from an arbitrary node (you need the previous node).
 *
 * This educational version demonstrates the XOR bookkeeping on node indices.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Traversal: O(n) forward or backward (from an end)
 *   Space:     O(n) with half the pointers of a doubly linked list
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their stored XOR value.
 *   - The current node is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "One pointer instead of two" is the entire trick.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a row of cells for the nodes.
 *
 * @param values The node values.
 * @param xors The stored XOR values.
 * @param active The active node index (or -1).
 * @returns Cell entities in a single row (two rows: value, stored xor).
 */
function makeGrid(values: number[], xors: number[], active = -1): VisualEntity[] {
    const cells: VisualEntity[] = [];
    values.forEach((value, index) => {
        cells.push({
            id: `v-${index}`,
            type: "cell" as const,
            label: String(value),
            value,
            state: (index === active ? "comparing" : "unvisited") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        });
    });
    xors.forEach((value, index) => {
        cells.push({
            id: `x-${index}`,
            type: "cell" as const,
            label: `⊕${value}`,
            value,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 1, col: index },
        });
    });
    return cells;
}

/**
 * The XOR Linked List generator.
 *
 * @param input `{ values }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [10, 20, 30, 40];

    const n = values.length;
    let step = 0;

    // Stored value per node = prevIndex XOR nextIndex (sentinels as -1).
    const xors = values.map(
        (_, index) => (index > 0 ? index - 1 : -1) ^ (index < n - 1 ? index + 1 : -1),
    );

    // Frame 0: all nodes with their XOR values.
    yield {
        stepNumber: step,
        entities: makeGrid(values, xors),
        edges: [],
        description: "XOR linked list – each node stores prev ⊕ next.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { size: n },
    };
    step += 1;

    // Traverse forward from the head using prev XOR both.
    let prev = -1;
    let current = 0;
    while (current >= 0 && current < n) {
        yield {
            stepNumber: step,
            entities: makeGrid(values, xors, current),
            edges: [],
            description: `At node ${current} (value ${values[current]}) – next = ${prev} ⊕ ${xors[current]} = ${prev ^ (xors[current] ?? 0)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { size: n, current },
        };
        step += 1;

        const next = prev ^ (xors[current] ?? 0);
        prev = current;
        current = next;
    }

    yield {
        stepNumber: step,
        entities: makeGrid(values, xors),
        edges: [],
        description: "Forward traversal complete using only the XOR pointers.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { size: n },
    };
}

/** The XOR Linked List module, registered with the engine. */
const module: AlgorithmModule = {
    id: "xor-linked-list",
    name: "XOR Linked List",
    category: "data-structures",
    complexity: { time: "O(n) traversal", space: "O(n)" },
    defaultInput: { values: [10, 20, 30, 40] },
    visualType: "grid",
    run,
};

export default module;
