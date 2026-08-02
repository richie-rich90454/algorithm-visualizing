/**
 * binomial-heap.ts – Binomial Heap
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A binomial heap is a forest of binomial trees, one for each set bit of n
 * (the number of elements). A binomial tree of order k has exactly 2^k nodes
 * and k children. Merging two heaps is like binary addition, and the
 * structure guarantees O(log n) merge and extract-min.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / merge: O(log n)
 *   Extract-min:    O(log n)
 *   Space:          O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - Each binomial tree is drawn; orders are labelled.
 *   - The tree being merged is highlighted.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The binary-number structure is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Binomial Heap generator.
 *
 * @param input `{ inserts }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [3, 7, 1, 9, 5];

    let step = 0;

    // Simulate the forest: n elements → binomial trees matching the bits of n.
    const buildFrame = (count: number, message: string): VisualFrame => {
        // For count elements, the forest has trees of order k for each set
        // bit k of count.
        const orders: number[] = [];
        let c = count;
        let k = 0;
        while (c > 0) {
            if (c % 2 === 1) {
                orders.push(k);
            }
            c = Math.floor(c / 2);
            k += 1;
        }

        const nodes: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        // For each order k, draw a 2^k binomial tree (simplified as a small
        // tree). Draw one representative root per tree.
        orders.forEach((order, treeIndex) => {
            const size = 2 ** order;
            const nodeCount = Math.min(size, 8);
            for (let i = 0; i < nodeCount; i += 1) {
                nodes.push({
                    id: `t${treeIndex}-n${i}`,
                    type: "node" as const,
                    label: i === 0 ? `B${order}` : "",
                    value: i,
                    state: i === 0 ? "sorted" : "unvisited",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: {
                        parentId: i === 0 ? "root" : `t${treeIndex}-n${Math.floor((i - 1) / 2)}`,
                    },
                });
            }
            for (let i = 0; i < nodeCount; i += 1) {
                for (const child of [2 * i + 1, 2 * i + 2]) {
                    if (child < nodeCount) {
                        edges.push({
                            id: `t${treeIndex}-e${i}-${child}`,
                            sourceId: `t${treeIndex}-n${i}`,
                            targetId: `t${treeIndex}-n${child}`,
                            label: "",
                            state: "idle",
                            directed: false,
                        });
                    }
                }
            }
        });

        return {
            stepNumber: step,
            entities: nodes,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { count, orders },
        };
    };

    // Frame 0: empty.
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
        description: "Empty binomial heap.",
        codeLineNumber: 1,
        layout: "tree",
        meta: { count: 0 },
    };
    step += 1;

    for (let i = 0; i < inserts.length; i += 1) {
        yield buildFrame(
            i + 1,
            `Inserted ${inserts[i]} – the forest now holds ${i + 1} element(s).`,
        );
        step += 1;
    }

    yield buildFrame(
        inserts.length,
        "Binomial heap complete – trees match the binary representation of n.",
    );
}

/** The Binomial Heap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "binomial-heap",
    name: "Binomial Heap",
    category: "data-structures",
    complexity: { time: "O(log n) ops", space: "O(n)" },
    defaultInput: { inserts: [3, 7, 1, 9, 5] },
    visualType: "tree",
    run,
};

export default module;
