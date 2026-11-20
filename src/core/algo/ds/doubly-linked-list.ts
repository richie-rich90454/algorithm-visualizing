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
        codeLineNumber: 6,
        layout: "tree",
        meta: { size: newValues.length },
    };
}

/** The Doubly Linked List module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A doubly linked list adds a previous pointer to each node of a singly linked list. This allows walking backward and deleting a node in O(1) when its pointer is known, at the cost of one extra pointer per node. It underlies many standard library containers.",
        "invariants": [
            "For interior nodes, node.next.prev equals node and node.prev.next equals node.",
            "head.prev is null and tail.next is null.",
            "Forward and backward traversals visit the same nodes in reverse orders."
        ],
        "correctness": "Insertion rewires four pointers around the new node, so every adjacent pair becomes consistent and no existing node is skipped. Deletion bypasses the removed node by linking its neighbors together. Because each pointer is updated symmetrically, both forward and backward walks remain valid.",
        "complexityRationale": "Deletion given a node, and insertion at a known position, are O(1) pointer updates. Search is O(n) because there is no random access, and two pointers per node give O(n) space.",
        "uses": [
            "LRU caches and ordered containers",
            "Undo histories and browser back-forward lists",
            "Deque and free-list implementations"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 10",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 1.3"
        ],
        "workedExample": "Start with 10 -> 20 -> 30. Insert 15 after 10 by setting 15.prev=10, 15.next=20, 10.next=15, 20.prev=15. Forward traversal gives 10, 15, 20, 30; backward from 30 gives 30, 20, 15, 10."
    },
    id: "doubly-linked-list",
    name: "Doubly Linked List",
    category: "data-structures",
    complexity: { time: "O(1) ends, O(n) search", space: "O(n)" },
    defaultInput: { values: [10, 20, 30], insert: 15 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize doubly linked list from input values",
        "traverse forward following next pointers comparing keys",
        "traverse backward following prev pointers comparing keys",
        "insert new value at front by rewiring next and prev",
        "update head and tail pointers after insert",
        "count nodes visited in both directions",
        "done: list holds values with bidirectional order",
    ],
};

export default module;
