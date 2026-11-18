/**
 * singly-linked-list.ts – Singly Linked List
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A singly linked list is a sequence of nodes, each holding a value and a
 * pointer to the next node. It trades the array's O(1) random access for O(1)
 * insertions/deletions at the front (when the head is known). Each node is
 * allocated separately, so traversal must follow the pointers one at a time.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Front insert/delete: O(1)
 *   Access / search:     O(n)
 *   Insert/delete at tail: O(n) (need to find the tail first)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is a circle labeled with its value.
 *   - Edges are the "next" pointers.
 *   - The node being visited is YELLOW (comparing).
 *   - Newly inserted nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The simplest dynamic structure; many others build on it.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a linked list visualization from an array of values.
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
    }
    return { nodes, edges };
}

/**
 * The Singly Linked List generator.
 *
 * @param input `{ values, insert? }` – initial values and an optional insert.
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
        description: `Singly linked list: [${values.join(" → ")}].`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: values.length },
    };
    step += 1;

    // Traverse the list to show O(n) access.
    for (let i = 0; i < values.length; i += 1) {
        ({ nodes, edges } = buildList(values, new Map([[i, "comparing"]])));
        yield {
            stepNumber: step,
            entities: nodes.map((n) => ({ ...n })),
            edges: edges.map((e) => ({ ...e })),
            description: `Traversing – visiting node with value ${values[i]}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;
    }

    // Insert a new node at the front (O(1)).
    const newValues = [insertValue, ...values];
    ({ nodes, edges } = buildList(newValues, new Map([[0, "sorted"]])));
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Inserted ${insertValue} at the front in O(1).`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { size: newValues.length },
    };
}

/** The Singly Linked List module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A singly linked list is a chain of nodes, each holding a value and a pointer to the next. Front insertion is a constant-time pointer change when the head is known, but reaching an arbitrary node requires following pointers from the head.",
        "invariants": [
            "Each next pointer leads to the following node.",
            "The last node points to null.",
            "The chain contains every stored value once in order."
        ],
        "correctness": "Traversal from the head visits nodes in stored order because each link points to the immediate successor. Front insertion sets the new node next to the old head and moves the head, so the new chain is the old chain with one extra value at the front.",
        "complexityRationale": "Front insert and delete are O(1) pointer changes; search and tail operations are O(n) because they walk the chain. One node per value gives O(n) space.",
        "uses": [
            "Stacks and queues built from nodes",
            "Adjacency lists for sparse graphs",
            "Cons lists in functional languages"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 10",
            "Knuth, The Art of Computer Programming, Vol. 1, Section 2.2.3 on linear linked lists"
        ],
        "workedExample": "Chain 10 to 20 to 30; inserting 15 at the front yields 15 to 10 to 20 to 30; traversal from the head visits 15, 10, 20, 30 in that order."
    },
    id: "singly-linked-list",
    name: "Singly Linked List",
    category: "data-structures",
    complexity: { time: "O(1) front ops, O(n) search", space: "O(n)" },
    defaultInput: { values: [10, 20, 30], insert: 15 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with the chain of linked nodes in order",
        "traverse from the head following next pointers",
        "visit each node value in chain order",
        "insert value at the front by pointing it at the old head",
        "the old chain stays linked behind the new head",
        "verify order by walking the updated chain once",
        "done: chain order holds and the inserted value is at the front",
    ],
};

export default module;
