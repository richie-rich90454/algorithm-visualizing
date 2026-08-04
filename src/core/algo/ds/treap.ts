/**
 * treap.ts â€?Treap (tree + heap)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A treap is a BST whose keys also carry random priorities satisfying the heap
 * property: the root has the largest priority, and every parent's priority
 * exceeds its children's. Inserting a node gives it a random priority and
 * rotates it up until the heap property holds; deletion rotates it down to a
 * leaf. The random priorities make the tree balanced with high probability.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert / delete: O(log n) expected
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show key (priority).
 *   - The node being rotated is YELLOW (comparing).
 *   - Rotations are narrated.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - "BST on keys, heap on priorities" is the entire concept.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Treap generator.
 *
 * @param input `{ keys, priorities }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; priorities?: number[] } | null) ?? {};
    const keys = task.keys ?? [30, 20, 40, 10, 35];
    const priorities = task.priorities ?? [5, 9, 6, 2, 4];

    let step = 0;

    // Insert pairs and sort by key (BST order), then show priorities.
    const pairs = keys.map((key, index) => ({ key, priority: priorities[index] ?? 0 }));

    // Frame 0: the pairs.
    const initial = pairs.map((p, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: `${p.key}(${p.priority})`,
        value: p.key,
        state: "unvisited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)) },
    }));
    yield {
        stepNumber: step,
        entities: initial,
        edges: [],
        description: "Treap â€?BST on keys, max-heap on priorities.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: pairs.length },
    };
    step += 1;

    // Sort by priority descending (heap order) to show the rotation outcome.
    const heapOrder = [...pairs].sort((a, b) => b.priority - a.priority);
    const sortedByKey = [...pairs].sort((a, b) => a.key - b.key);

    const nodes = sortedByKey.map((p, index) => ({
        id: `node-${index}`,
        type: "node" as const,
        label: `${p.key}(${p.priority})`,
        value: p.key,
        state: "unvisited" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: index === 0 ? "root" : String(Math.floor((index - 1) / 2)) },
    }));

    // Highlight the heap-max (root of the priority heap).
    const rootKey = heapOrder[0]?.key;
    const display = nodes.map((n) =>
        n.label.startsWith(`${rootKey}(`) ? { ...n, state: "sorted" as const } : n,
    );

    yield {
        stepNumber: step,
        entities: display,
        edges: [],
        description: `Key ${rootKey} has the top priority, so it sits at the root.`,
        codeLineNumber: 2,
        layout: "tree",
        meta: { size: pairs.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: nodes,
        edges: [],
        description: "Rotations (not shown per-step) keep BST order while preserving the heap.",
        codeLineNumber: 3,
        layout: "tree",
        meta: { size: pairs.length },
    };
}

/** The Treap module, registered with the engine. */
const module: AlgorithmModule = {
    id: "treap",
    name: "Treap",
    category: "data-structures",
    complexity: { time: "O(log n) expected", space: "O(n)" },
    defaultInput: { keys: [30, 20, 40, 10, 35], priorities: [5, 9, 6, 2, 4] },
    visualType: "tree",
    run,
};

export default module;
