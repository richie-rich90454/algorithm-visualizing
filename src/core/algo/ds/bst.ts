/**
 * bst.ts – Binary Search Tree
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A binary search tree keeps the invariant: for every node, all values in its
 * left subtree are smaller and all values in its right subtree are larger.
 * This makes search, insert, and delete guided by comparisons, visiting only
 * O(h) nodes where h is the tree height.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Search / insert / delete: O(h) = O(log n) balanced, O(n) worst
 *   Space:                    O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The node being compared against is YELLOW (comparing).
 *   - The search path is highlighted.
 *   - A found node is GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The comparison-guided search is the entire idea.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * Build a BST from values, computing parentId metadata.
 *
 * @param values The values to insert in order.
 * @returns { nodes, edges } entity pairs.
 */
function buildBst(values: number[]): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    // Insert into a simple BST structure.
    type BNode = { value: number; left: BNode | null; right: BNode | null };
    let root: BNode | null = null;

    for (const value of values) {
        const node: BNode = { value, left: null, right: null };
        if (!root) {
            root = node;
        } else {
            let current = root;
            for (;;) {
                if (value < current.value) {
                    if (current.left) {
                        current = current.left;
                    } else {
                        current.left = node;
                        break;
                    }
                } else {
                    if (current.right) {
                        current = current.right;
                    } else {
                        current.right = node;
                        break;
                    }
                }
            }
        }
    }

    // Flatten to entities.
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    let idCounter = 0;

    const walk = (node: BNode, parentId: string | null): void => {
        const id = `node-${node.value}-${idCounter}`;
        idCounter += 1;
        nodes.push({
            id,
            type: "node" as const,
            label: String(node.value),
            value: node.value,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parentId ?? "root" },
        });
        if (node.left) {
            const leftId = `node-${node.left.value}-${idCounter}`;
            edges.push({
                id: `${id}-L`,
                sourceId: id,
                targetId: leftId,
                label: "L",
                state: "idle",
                directed: false,
            });
            walk(node.left, id);
        }
        if (node.right) {
            const rightId = `node-${node.right.value}-${idCounter}`;
            edges.push({
                id: `${id}-R`,
                sourceId: id,
                targetId: rightId,
                label: "R",
                state: "idle",
                directed: false,
            });
            walk(node.right, id);
        }
    };

    if (root) {
        walk(root, null);
    }
    return { nodes, edges };
}

/**
 * The BST generator.
 *
 * @param input `{ values, search }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; search?: number } | null) ?? {};
    const values = task.values ?? [8, 3, 10, 1, 6, 14];
    const search = typeof task.search === "number" ? task.search : 6;

    let step = 0;

    const { nodes, edges } = buildBst(values);

    // Frame 0: the tree.
    yield {
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description: `BST with values [${values.join(", ")}] – searching for ${search}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: values.length },
    };
    step += 1;

    // Search following the comparisons.
    const current = nodes.map((n) => ({ ...n }));
    let found = false;
    let currentValue = values[0];

    for (let guard = 0; guard < values.length; guard += 1) {
        const idx = current.findIndex((n) => n.label === String(currentValue));
        if (idx >= 0) {
            current[idx] = { ...current[idx], state: "comparing" };
        }
        yield {
            stepNumber: step,
            entities: current,
            edges: edges.map((e) => ({ ...e })),
            description: `Comparing ${search} with ${currentValue}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { size: values.length },
        };
        step += 1;

        if (search === currentValue) {
            found = true;
            if (idx >= 0) {
                current[idx] = { ...current[idx], state: "sorted" };
            }
            break;
        }
        // Decide which child to visit.
        const idx2 = current.findIndex((n) => n.label === String(currentValue));
        const children = edges
            .filter((e) => e.sourceId === (idx2 >= 0 ? current[idx2].id : ""))
            .map((e) => e.targetId);
        if (search < currentValue) {
            const leftTarget = children.find(
                (t) =>
                    edges.find(
                        (e) =>
                            e.sourceId === (idx2 >= 0 ? current[idx2].id : "") && e.targetId === t,
                    )?.label === "L",
            );
            if (!leftTarget) {
                break;
            }
            currentValue = Number(current.find((n) => n.id === leftTarget)?.label ?? currentValue);
        } else {
            const rightTarget = children.find(
                (t) =>
                    edges.find(
                        (e) =>
                            e.sourceId === (idx2 >= 0 ? current[idx2].id : "") && e.targetId === t,
                    )?.label === "R",
            );
            if (!rightTarget) {
                break;
            }
            currentValue = Number(current.find((n) => n.id === rightTarget)?.label ?? currentValue);
        }
    }

    yield {
        stepNumber: step,
        entities: current,
        edges: edges.map((e) => ({ ...e })),
        description: found ? `Found ${search} in the BST!` : `${search} is not in the tree.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { found },
    };
}

/** The BST module, registered with the engine. */
const module: AlgorithmModule = {

    education: {
        "intuition": "A binary search tree keeps every left-subtree key smaller than the node and every right-subtree key larger. A search compares the target with the current node and discards half the remaining tree at each step. Insert and delete are guided by the same comparisons, so cost is proportional to tree height.",
        "invariants": [
            "For any node, all left keys are smaller and all right keys are larger.",
            "Inorder traversal yields keys in sorted order.",
            "Search follows exactly one root-to-leaf path."
        ],
        "correctness": "Because the subtree ranges are disjoint, if the target is smaller than the node it can only be in the left subtree, and similarly for larger. Following that rule reaches the target if it exists. Insertion attaches a new leaf in the gap where the key belongs, preserving the ordering for every ancestor.",
        "complexityRationale": "Each operation follows a single path of length equal to height h, so time is O(h): O(log n) when balanced, O(n) when degenerate. One node per key gives O(n) space.",
        "uses": [
            "In-memory ordered sets and maps",
            "Symbol tables and language runtime indexes",
            "Basis for AVL, red-black, and splay trees"
        ],
        "references": [
            "CLRS, Introduction to Algorithms, Chapter 12",
            "Robert Sedgewick and Kevin Wayne, Algorithms, Section 3.2"
        ],
        "workedExample": "Insert 8, 3, 10, 1, 6, 14: 8 is root, 3 and 10 its children, then 1 and 6 under 3 and 14 under 10. Searching 6 compares with 8, goes left to 3, then right to 6 and succeeds. Searching 7 follows the same path but reaches an empty right child of 6 and fails."
    },
    id: "bst",
    name: "Binary Search Tree",
    category: "data-structures",
    complexity: { time: "O(h) ops", space: "O(n)" },
    defaultInput: { values: [8, 3, 10, 1, 6, 14], search: 6 },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize empty binary search tree with null root",
        "compare insert key against node and go left if smaller else right",
        "attach new leaf where child pointer is null",
        "compare search key against node along guided path",
        "move left on smaller and right on larger",
        "count comparisons along search path",
        "done: BST holds values with search found answer",
    ],
};

export default module;
