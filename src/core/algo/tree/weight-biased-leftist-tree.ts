/**
 * weight-biased-leftist-tree.ts - Weight-Biased Leftist Tree (WBLT)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A weight-biased leftist tree is a meldable min-priority queue. Every node
 * stores its subtree size (its "weight"), and the invariant requires the left
 * subtree to be at least as heavy as the right subtree. Merging walks only the
 * right spine of the larger root and swaps children to restore the invariant,
 * so the right spine is at most O(log n) long and every operation is logarithmic.
 *
 * This is distinct from a rank-based leftist heap: here balance is decided by
 * subtree size, which also lets the structure support selection by rank.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Merge / insert / extract-min: O(log n)
 *   Space:                        O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are drawn as a tree, labeled with their key.
 *   - The weight (subtree size) is shown in each node's metadata.
 *   - The node touched by the current operation is highlighted.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface WNode {
    id: number;
    key: number;
    left: WNode | null;
    right: WNode | null;
    size: number;
}

/** The Weight-Biased Leftist Tree generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { inserts?: number[] } | null) ?? {};
    const inserts = task.inserts ?? [5, 3, 8, 1, 9, 4, 7, 2, 6];

    let nextId = 0;
    let step = 0;

    const makeNode = (key: number): WNode => ({
        id: nextId++,
        key,
        left: null,
        right: null,
        size: 1,
    });
    const size = (node: WNode | null): number => (node === null ? 0 : node.size);

    /** Meld two heap-ordered trees, restoring the weight-biased invariant. */
    const merge = (a: WNode | null, b: WNode | null): WNode | null => {
        if (a === null) {
            return b;
        }
        if (b === null) {
            return a;
        }
        if (a.key > b.key) {
            const temp = a;
            a = b;
            b = temp;
        }
        a.right = merge(a.right, b);
        if (size(a.left) < size(a.right)) {
            const temp = a.left;
            a.left = a.right;
            a.right = temp;
        }
        a.size = 1 + size(a.left) + size(a.right);
        return a;
    };

    /** Turn the current tree into a well-formed tree-layout frame. */
    const snapshot = (
        root: WNode | null,
        highlight: Set<number>,
        message: string,
        codeLine: number,
        extra: Record<string, number | string | boolean | number[]>,
    ): VisualFrame => {
        const entities: VisualEntity[] = [];
        const edges: VisualEdge[] = [];
        const walk = (node: WNode | null, parentId: string | undefined, side: string): void => {
            if (node === null) {
                return;
            }
            const id = `wblt-${node.id}`;
            entities.push({
                id,
                type: "node" as const,
                label: String(node.key),
                value: node.key,
                state: highlight.has(node.id) ? ("active" as const) : ("unvisited" as const),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parentId ?? "root", weight: node.size, key: node.key, side },
            });
            if (parentId !== undefined) {
                edges.push({
                    id: `edge-${parentId}-${id}`,
                    sourceId: parentId,
                    targetId: id,
                    label: side,
                    state: highlight.has(node.id) ? ("active" as const) : ("idle" as const),
                    directed: false,
                });
            }
            walk(node.left, id, "L");
            walk(node.right, id, "R");
        };
        walk(root, undefined, "root");
        if (entities.length === 0) {
            entities.push({
                id: "empty",
                type: "node" as const,
                label: "-",
                value: 0,
                state: "unvisited" as const,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root", weight: 0, key: 0, side: "root" },
            });
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: codeLine,
            layout: "tree",
            meta: { ...extra, size: size(root) },
        };
    };

    // Frame 0: empty tree.
    yield snapshot(null, new Set(), "Empty weight-biased leftist tree, ready for merges.", 0, {
        operation: "init",
    });
    step += 1;

    // Build the heap by merging singleton trees.
    let root: WNode | null = null;
    for (const key of inserts) {
        const node = makeNode(key);
        root = merge(root, node);
        yield snapshot(
            root,
            new Set([node.id]),
            `Inserted ${key} by merging a singleton into the root ${String(root?.key)}.`,
            5,
            { operation: "insert", key },
        );
        step += 1;
    }

    // Drain the heap to show the sorted order the structure supports.
    const extracted: number[] = [];
    while (root !== null) {
        const minimum = root.key;
        root = merge(root.left, root.right);
        extracted.push(minimum);
        const highlight = root === null ? new Set<number>() : new Set([root.id]);
        yield snapshot(
            root,
            highlight,
            `Extracted minimum ${minimum}; merged its two subtrees in O(log n).`,
            6,
            { operation: "extract", key: minimum, extracted: [...extracted] },
        );
        step += 1;
    }

    // Final frame: the drained tree and the sorted extraction sequence.
    yield snapshot(
        null,
        new Set(),
        `Extracted ${extracted.length} keys in sorted order: ${extracted.join(", ")}.`,
        8,
        { operation: "done", extracted: [...extracted] },
    );
}

/** The Weight-Biased Leftist Tree module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of a meldable priority queue whose shape is kept lopsided on purpose. Each node records how many nodes sit below it, and the left child is always at least as heavy as the right child. Merging follows only the short right spine, compares the two roots, and swaps children when the weights get out of order.",
        invariants: [
            "Heap order: a node's key is no larger than either child's key.",
            "Weight bias: size(left) is at least size(right) at every node.",
            "A node's stored size equals one plus the sizes of its two children.",
        ],
        correctness:
            "The size invariant implies a right spine of length r contains at least 2^r - 1 nodes, so its length is at most log2(n+1). Merge recurses only along that short spine and swaps children to restore the weight rule, stopping in O(log n). Heap order keeps the minimum at the root, so repeated root removal yields keys in nondecreasing order; by induction each returned root is the smallest remaining key.",
        complexityRationale:
            "Each merge descends one right spine of logarithmic length, so merge, insert, and extract-min are O(log n). Storing one node per key plus a size field uses O(n) space.",
        uses: [
            "Meldable priority queues that must support fast union",
            "Parallel heap merging in graph algorithms such as multi-source shortest paths",
            "Purely functional data structures where sharing is cheap",
        ],
        references: [
            "Robert Sedgewick, Leftist Trees and the Weight-Biased Variant, Algorithms in C",
            "Atkinson, Sack, Santoro, and Wismath, The Design and Analysis of Structures for Databases and Information Systems",
        ],
        workedExample:
            "Insert 5, 3, 8, 1 by successive merges: the root becomes 1, with its heavier subtree always on the left. Extracting the root removes 1 and merges its children; the next root is 3, then 5, then 8, confirming the sorted order.",
    },
    id: "weight-biased-leftist-tree",
    name: "Weight-Biased Leftist Tree",
    category: "tree",
    complexity: { time: "O(log n) per operation", space: "O(n)" },
    defaultInput: { inserts: [5, 3, 8, 1, 9, 4, 7, 2, 6] },
    visualType: "tree",
    run,
    pseudocode: [
        "each node stores a key, two children, and its subtree weight",
        "merge two heaps, keeping the smaller key at the root",
        "recursively merge the larger root's right child with the other heap",
        "swap children when the left subtree is lighter than the right",
        "update the root weight from its two children",
        "insert a key by merging a singleton heap into the root",
        "extract the minimum by merging the root's two children",
        "repeat extraction to obtain the keys in sorted order",
        "done: the structure is empty and extraction order is sorted",
    ],
};

export default module;
