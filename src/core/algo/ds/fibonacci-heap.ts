/**
 * fibonacci-heap.ts â€?Fibonacci Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Fibonacci heap is a collection of min-heap-ordered trees. Its superpower
 * is O(1) amortised insert and decrease-key (thanks to lazy linking and
 * cascade cutting), making it ideal for Dijkstra's algorithm. Extracting the
 * minimum is O(log n) amortised, and the heap consolidates trees of equal
 * degree during extraction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / decrease-key / merge: O(1) amortised
 *   Extract-min:                   O(log n) amortised
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
 * @param input `{ inserts }` â€?values inserted lazily.
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
            layout: "tree",
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
        description: "Empty Fibonacci heap.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { roots: 0, nodes: 0 },
    };
    step += 1;

    // Lazy inserts: each is a new root in O(1).
    for (const value of inserts) {
        roots.push(value);
        nextId += 1;
        yield buildFrame(
            `Inserted ${value} lazily in O(1) â€?root list has ${roots.length} tree(s).`,
        );
        step += 1;
    }

    yield buildFrame(
        `Fibonacci heap complete â€?all inserts were O(1); extract-min would consolidate these trees.`,
    );
}

/** The Fibonacci Heap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "fibonacci-heap",
    name: "Fibonacci Heap",
    category: "data-structures",
    complexity: { time: "O(1) insert amortised", space: "O(n)" },
    defaultInput: { inserts: [7, 3, 9, 5, 2] },
    visualType: "graph",
    run,
};

export default module;
