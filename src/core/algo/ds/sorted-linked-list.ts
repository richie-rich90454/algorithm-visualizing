/**
 * sorted-linked-list.ts – Sorted Linked List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A sorted linked list keeps its elements ordered at all times. Insertion
 * walks the list to find the correct position and splices the new node there
 * in O(n) worst case (but O(1) once the position is found). It is useful when
 * the list is small and insertions are infrequent relative to traversals.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert: O(n) to find the position, O(1) to splice
 *   Search: O(n)
 *   Space:  O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The list is a chain of nodes.
 *   - The insertion point being searched is YELLOW (comparing).
 *   - The spliced-in node is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The invariant "always sorted" is maintained by the insert.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a linked-list visualisation.
 *
 * @param values The node values in order.
 * @param highlight Index to highlight (or -1).
 * @returns { nodes, edges } entity pairs.
 */
function buildList(
    values: number[],
    highlight = -1,
): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = values.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: index === highlight ? "comparing" : "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index > 0 ? String(index - 1) : "root" },
    }));
    const edges: VisualEdge[] = [];
    for (let i = 0; i < values.length - 1; i += 1) {
        edges.push({
            id: `next-${i}`,
            sourceId: `node-${i}`,
            targetId: `node-${i + 1}`,
            label: "next",
            state: "idle",
            directed: true,
        });
    }
    return { nodes, edges };
}

/**
 * The Sorted Linked List generator.
 *
 * @param input `{ values, insert }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; insert?: number } | null) ?? {};
    const values = [...(task.values ?? [5, 10, 20, 30])];
    const insert = typeof task.insert === "number" ? task.insert : 15;

    let step = 0;

    // Frame 0: the sorted list.
    let { nodes, edges } = buildList(values);
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Sorted list: [${values.join(" → ")}].`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: values.length },
    };
    step += 1;

    // Walk to find the insertion point.
    let insertionIndex = values.length;
    for (let i = 0; i < values.length; i += 1) {
        ({ nodes, edges } = buildList(values, i));
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Checking ${values[i]} – is ${insert} smaller?`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;
        if (insert < (values[i] ?? 0)) {
            insertionIndex = i;
            break;
        }
    }

    // Splice the new node in.
    const newValues = [...values];
    newValues.splice(insertionIndex, 0, insert);
    ({ nodes, edges } = buildList(newValues, insertionIndex));
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Inserted ${insert} at position ${insertionIndex} – list stays sorted.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { size: newValues.length },
    };
}

/** The Sorted Linked List module, registered with the engine. */
const module: AlgorithmModule = {
    id: "sorted-linked-list",
    name: "Sorted Linked List",
    category: "data-structures",
    complexity: { time: "O(n) insert", space: "O(n)" },
    defaultInput: { values: [5, 10, 20, 30], insert: 15 },
    visualType: "tree",
    run,
};

export default module;
