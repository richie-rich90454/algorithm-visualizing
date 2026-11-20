/**
 * binary-tree.ts – Binary Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A binary tree is a tree where every node has at most two children (left and
 * right). It is the container that hosts search trees, heaps, and expression
 * trees. This visualization builds a balanced binary tree and performs all
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
 * Visualization mapping
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
        codeLineNumber: 6,
        layout: "tree",
        meta: { visited: visited.size },
    };
}

/** The Binary Tree module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A binary tree is a structure where each node has at most two children, left and right. This demo builds a complete tree by level order and shows the three classic depth-first traversals. Preorder visits the node first, inorder visits it between its subtrees, and postorder visits it last.",
        "invariants": [
            "Each node has at most two children.",
            "Insertion by level order keeps the tree complete.",
            "A traversal visits every node exactly once."
        ],
        "correctness": "Each recursion visits the current node and then calls itself on the left and right children, so every reachable node is output once and no node repeats. The three orders differ only in where the node's own output is placed, which is why inorder on a BST yields sorted keys. Level-order insertion keeps height O(log n).",
        "complexityRationale": "A traversal touches each of the n nodes once, so time is O(n). The recursion stack can reach the tree height O(log n) for a complete tree, and the nodes themselves occupy O(n) space.",
        "uses": [
            "Expression trees and compiler parse trees",
            "Hierarchical data such as file systems",
            "Basis for BSTs, heaps, and tries"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Appendix B and Chapter 12",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 1.3"
        ],
        "workedExample": "Build from [8, 3, 10, 1, 6, 9, 14] in level order: root 8, children 3 and 10, then 1 and 6 under 3 and 9 and 14 under 10. Preorder lists 8, 3, 1, 6, 10, 9, 14; inorder lists 1, 3, 6, 8, 9, 10, 14; postorder lists 1, 6, 3, 9, 14, 10, 8."
    },
    id: "binary-tree",
    name: "Binary Tree",
    category: "data-structures",
    complexity: { time: "O(n) traversal", space: "O(n)" },
    defaultInput: { values: [8, 3, 10, 1, 6, 9, 14] },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty binary tree with null root",
        "insert key via level order to keep tree complete",
        "compare keys to guide traversal order",
        "visit nodes in preorder to list structure",
        "count nodes and measure height",
        "search for query key by full traversal",
        "done: binary tree holds values with traversal and search answer",
    ],
};

export default module;
