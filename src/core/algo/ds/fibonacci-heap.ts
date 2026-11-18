/**
 * fibonacci-heap.ts – Fibonacci Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Fibonacci heap is a collection of min-heap-ordered trees. Its superpower
 * is O(1) amortized insert and decrease-key (thanks to lazy linking and
 * cascade cutting), making it ideal for Dijkstra's algorithm. Extracting the
 * minimum is O(log n) amortized, and the heap consolidates trees of equal
 * degree during extraction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / decrease-key / merge: O(1) amortized
 *   Extract-min:                   O(log n) amortized
 *   Space:                         O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Trees are drawn as small heap trees in a forest.
 *   - Inserted nodes are GREEN (sorted).
 *   - The root list is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Lazy operations + cascade cuts are the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Fibonacci Heap generator.
 *
 * @param input `{ inserts }` – values inserted lazily.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [7, 3, 9, 5, 2];

    let step = 0;
    let nextId = 0;

    // Each inserted node starts as its own tree in the root list.
    const roots: number[] = [];

    const buildFrame = (message: string): VisualFrame => {
        const nodes: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        roots.forEach((value, index) => {
            nodes.push({
                id: `n-${index}`,
                type: "node" as const,
                label: String(value),
                value,
                state: index === 0 ? "comparing" : "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
        });
        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "graph",
            meta: { roots: roots.length, nodes: nextId },
        };
    };

    // Frame 0: empty heap.
    yield {
        stepNumber: step,
        entities: [
            {
                id: "empty",
                type: "node" as const,
                label: "-",
                value: 0,
                state: "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            },
        ],
        edges: [],
        description: "Empty Fibonacci heap with no root trees ready for lazy inserts.",
        codeLineNumber: 1,
        layout: "graph",
        meta: { roots: 0, nodes: 0 },
    };
    step += 1;

    // Lazy inserts: each is a new root in O(1).
    for (const value of inserts) {
        roots.push(value);
        nextId += 1;
        yield buildFrame(
            `Inserted ${value} lazily in O(1) – root list has ${roots.length} tree(s).`,
        );
        step += 1;
    }

    yield buildFrame(
        `Fibonacci heap complete – all inserts were O(1); extract-min would consolidate these trees.`,
    );
}

/** The Fibonacci Heap module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A Fibonacci heap is a forest of heap-ordered trees that postpones work: insertions and decrease-key just add or cut nodes, and consolidation happens only during extract-min. When a node loses two children it is cascade-cut from its parent. This laziness gives O(1) amortized insert and decrease-key.",
        "invariants": [
            "Each tree is min-heap ordered, so its root is its minimum.",
            "A node that has lost one child is marked; losing a second triggers a cut.",
            "Consolidation leaves at most one tree of each degree."
        ],
        "correctness": "Linking two equal-degree trees by comparing roots preserves heap order and reduces duplicate degrees. Cascading cuts keep the potential of trees plus marks bounded, which pays for the work. Extract-min consolidates the forest so the minimum root can be removed safely, and the remaining trees still store all other keys.",
        "complexityRationale": "Insert, decrease-key, and meld are O(1) amortized because they are lazy; extract-min is O(log n) amortized because consolidation touches at most log n degrees. One node per key gives O(n) space.",
        "uses": [
            "Dijkstra and Prim with many decrease-key calls",
            "Minimum spanning tree algorithms",
            "Network optimization and shortest paths"
        ],
        "references": [
            "Michael L. Fredman and Robert E. Tarjan, \"Fibonacci Heaps and Their Uses in Improved Network Optimization Algorithms\", JACM 1987",
            "CLRS, Introduction to Algorithms, Chapter 20"
        ],
        "workedExample": "Insert 7, 3, 9, 5, 2 as singleton root trees; the min pointer targets 2. Extract-min removes 2 and links equal-degree trees, leaving a small forest. Decrease-key of 9 to 1 cuts it from its parent and moves it to the root list, updating the min pointer."
    },
    id: "fibonacci-heap",
    name: "Fibonacci Heap",
    category: "data-structures",
    complexity: { time: "O(1) insert amortized", space: "O(n)" },
    defaultInput: { inserts: [7, 3, 9, 5, 2] },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize empty Fibonacci heap with empty root list",
        "insert key as singleton tree in root list in O(1)",
        "compare new key against minimum pointer",
        "extract minimum and consolidate equal-degree trees",
        "link trees by comparing roots during consolidation",
        "decrease key with cascading cuts if needed",
        "done: heap holds keys with minimum identified",
    ],
};

export default module;
