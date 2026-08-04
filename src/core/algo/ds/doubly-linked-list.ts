/**
 * doubly-linked-list.ts – Doubly Linked List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A doubly linked list adds a "prev" pointer to every node of a singly linked
 * list. This makes traversal and deletion work in both directions, enabling
 * O(1) deletion of a node given a pointer to it, and O(1) access to the tail
 * (when a tail pointer is kept). The cost is one extra pointer per node.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Front/tail insert & delete: O(1)
 *   Delete given a node:        O(1)
 *   Search:                     O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are circles; "next" edges point right, "prev" edges point left.
 *   - The node being visited is YELLOW (comparing).
 *   - Newly inserted nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The base of many containers (std::list, LRU caches, deque impls).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a doubly linked list visualization.
 *
 * @param values The node values in order.
 * @param states Optional index → state overrides.
 * @returns { nodes, edges } entity pairs.
 */
function buildList(
    values: number[],
    states: Map<number, string> = new Map(),
): {
    nodes: VisualEntity[];
    edges: VisualEdge[];
} {
    const nodes: VisualEntity[] = values.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: (states.get(index) ?? "unvisited") as VisualEntity["state"],
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
        edges.push({
            id: `prev-${i + 1}`,
            sourceId: `node-${i + 1}`,
            targetId: `node-${i}`,
            label: "prev",
            state: "highlight",
            directed: true,
        });
    }
    return { nodes, edges };
}

/**
 * The Doubly Linked List generator.
 *
 * @param input `{ values, insert? }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; insert?: number } | null) ?? {};
    const values = [...(task.values ?? [10, 20, 30])];
    const insertValue = task.insert ?? 15;

    let step = 0;

    // Frame 0: the initial list.
    let { nodes, edges } = buildList(values);
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Doubly linked list: [${values.join(" ↔ ")}].`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: values.length },
    };
    step += 1;

    // Traverse both directions.
    for (let i = 0; i < values.length; i += 1) {
        ({ nodes, edges } = buildList(values, new Map([[i, "comparing"]])));
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Forward traversal – visiting ${values[i]}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;
    }
    for (let i = values.length - 1; i >= 0; i -= 1) {
        ({ nodes, edges } = buildList(values, new Map([[i, "comparing"]])));
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Backward traversal – visiting ${values[i]}.`,
            codeLineNumber: 3,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;
    }

    // Insert at the front.
    const newValues = [insertValue, ...values];
    ({ nodes, edges } = buildList(newValues, new Map([[0, "sorted"]])));
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Inserted ${insertValue} at the front in O(1).`,
        codeLineNumber: 4,
        layout: "tree",
        meta: { size: newValues.length },
    };
}

/** The Doubly Linked List module, registered with the engine. */
const module: AlgorithmModule = {
    id: "doubly-linked-list",
    name: "Doubly Linked List",
    category: "data-structures",
    complexity: { time: "O(1) ends, O(n) search", space: "O(n)" },
    defaultInput: { values: [10, 20, 30], insert: 15 },
    visualType: "tree",
    run,
};

export default module;
