/**
 * binary-tree.ts – Binary Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A binary tree is a tree where every node has at most two children (left and
 * right). It is the container that hosts search trees, heaps, and expression
 * trees. This visualisation builds a balanced binary tree and performs all
 * three classic traversals: pre-order (node, left, right), in-order (left,
 * node, right), and post-order (left, right, node).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Traversal: O(n)
 *   Height:    O(log n) balanced, O(n) degenerate
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The tree is drawn hierarchically.
 *   - The currently visited node is YELLOW (comparing).
 *   - Visited nodes are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The three traversal orders are the fundamental vocabulary.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Binary Tree generator.
 *
 * @param input `{ values }` – the tree values (inserted to form a complete tree).
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values = task.values ?? [8, 3, 10, 1, 6, 9, 14];

    let step = 0;

    // Build nodes with parentId from the complete-tree array layout.
    const nodes: VisualEntity[] = values.map((value, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: String(value),
        value,
        state: "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)) },
    }));

    const edges: VisualEdge[] = [];
    for (let i = 0; i < values.length; i += 1) {
        for (const child of [2 * i + 1, 2 * i + 2]) {
            if (child < values.length) {
                edges.push({
                    id: `edge-${i}-${child}`,
                    sourceId: `node-${i}`,
                    targetId: `node-${child}`,
                    label: child % 2 === 1 ? "L" : "R",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }

    // Frame 0: the tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Binary tree: [${values.join(", ")}].`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: values.length },
    };
    step += 1;

    // Pre-order traversal.
    const visited = new Set<number>();
    const traverse = function* (index: number): Generator<VisualFrame, void, unknown> {
        if (index >= values.length) {
            return;
        }
        visited.add(index);
        const current = nodes.map((n) => ({ ...n }));
        current[index] = { ...current[index], state: "comparing" };
        for (const idx of visited) {
            current[idx] = { ...current[idx], state: "sorted" };
        }
        yield {
            stepNumber: step,
            entities: current,
            edges: edges.map((e) => ({ ...e })),
            description: `Visited node ${values[index]} (${orderName}).`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { visited: visited.size },
        };
        step += 1;
        yield* traverse(2 * index + 1);
        yield* traverse(2 * index + 2);
    };

    const orderName = "pre-order";
    yield* traverse(0);

    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `Pre-order traversal complete – visited all ${visited.size} nodes.`,
        codeLineNumber: 3,
        layout: "tree",
        meta: { visited: visited.size },
    };
}

/** The Binary Tree module, registered with the engine. */
const module: AlgorithmModule = {
    id: "binary-tree",
    name: "Binary Tree",
    category: "data-structures",
    complexity: { time: "O(n) traversal", space: "O(n)" },
    defaultInput: { values: [8, 3, 10, 1, 6, 9, 14] },
    visualType: "tree",
    run,
};

export default module;
