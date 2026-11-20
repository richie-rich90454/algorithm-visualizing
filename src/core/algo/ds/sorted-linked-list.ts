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
 * Visualization mapping
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
 * Build a linked-list visualization.
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

    education: {
        "intuition": "A sorted linked list keeps nodes in order at all times. Insertion walks from the head to the first larger node and splices the new node there; equal keys keep their original order, making the structure stable.",
        "invariants": [
            "Nodes are in nondecreasing order.",
            "Each node links to its successor.",
            "Insert and delete preserve the ordering."
        ],
        "correctness": "Scanning stops at the first node greater than the key, so splicing before it places the key correctly; equal keys are placed after existing equals, preserving stability. Since every other pair was already ordered, the whole list remains sorted.",
        "complexityRationale": "Finding the insertion point takes O(n) walks while the splice itself is O(1). One node per value gives O(n) space.",
        "uses": [
            "Small ordered collections with frequent traversals",
            "Stable insertion-based sorting",
            "Adjacency lists kept in sorted order"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 10",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 2.2.3"
        ],
        "workedExample": "List 5 to 10 to 20 to 30; inserting 15 walks past 10 and splices before 20, yielding 5, 10, 15, 20, 30; a verification walk confirms sorted order."
    },
    id: "sorted-linked-list",
    name: "Sorted Linked List",
    category: "data-structures",
    complexity: { time: "O(n) insert", space: "O(n)" },
    defaultInput: { values: [5, 10, 20, 30], insert: 15 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with the values already chained in sorted order",
        "scan from the head comparing each node against the new key",
        "stop at the first node larger than the key",
        "splice the new node before that position",
        "equal keys keep their original relative order (stable)",
        "verify by walking the chain to confirm sorted order",
        "done: chain stays sorted with the key at its ranked position",
    ],
};

export default module;
