/**
 * binary-search-tree-delete.ts - Binary Search Tree Deletion
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Deleting from a binary search tree must preserve the search order. There
 * are three cases: a leaf is removed outright, a node with one child is
 * replaced by that child, and a node with two children takes the value of its
 * inorder successor (the smallest node of the right subtree) before that
 * successor is removed. This module is the deletion counterpart of the
 * insertion/search-only bst module.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(h) per deletion, h the tree height
 *   Space: O(n) for the tree plus O(h) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are drawn as circles arranged by the tree layout.
 *   - The node being deleted is YELLOW (comparing).
 *   - The inorder successor is CYAN (active) when it is lifted.
 *   - The final tree shows all remaining keys in GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Node {
    value: number;
    left: Node | null;
    right: Node | null;
}

/** Build a frame from the current tree, with optional per-value state overrides. */
function render(root: Node | null, step: number, message: string, line: number, states: Map<number, EntityState> = new Map()): VisualFrame {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: Node, parentId: string | null): void => {
        const id = `node-${node.value}`;
        entities.push({
            id,
            type: "node" as const,
            label: String(node.value),
            value: node.value,
            state: states.get(node.value) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parentId ?? "root", value: node.value },
        });
        for (const child of [node.left, node.right]) {
            if (child) {
                edges.push({
                    id: `edge-${node.value}-${child.value}`,
                    sourceId: id,
                    targetId: `node-${child.value}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
                walk(child, id);
            }
        }
    };
    if (root) {
        walk(root, null);
    }
    return {
        stepNumber: step,
        entities,
        edges,
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: { size: entities.length, inorder: inorder(root) },
    };
}

/** Inorder traversal, used both for display and for the test oracle. */
function inorder(root: Node | null): number[] {
    const out: number[] = [];
    const walk = (node: Node | null): void => {
        if (!node) {
            return;
        }
        walk(node.left);
        out.push(node.value);
        walk(node.right);
    };
    walk(root);
    return out;
}

/** Insert a value into the tree (duplicates are ignored). */
function insert(root: Node | null, value: number): Node {
    if (!root) {
        return { value, left: null, right: null };
    }
    if (value < root.value) {
        root.left = insert(root.left, value);
    } else if (value > root.value) {
        root.right = insert(root.right, value);
    }
    return root;
}

/** Remove a value and report which case was used. */
function remove(root: Node | null, value: number): { root: Node | null; successor?: number } {
    if (!root) {
        return { root: null };
    }
    if (value < root.value) {
        const result = remove(root.left, value);
        root.left = result.root;
        return { root, successor: result.successor };
    }
    if (value > root.value) {
        const result = remove(root.right, value);
        root.right = result.root;
        return { root, successor: result.successor };
    }
    // Found the node.
    if (!root.left) {
        return { root: root.right };
    }
    if (!root.right) {
        return { root: root.left };
    }
    let successor = root.right;
    while (successor.left) {
        successor = successor.left;
    }
    const successorValue = successor.value;
    root.value = successorValue;
    root.right = remove(root.right, successorValue).root;
    return { root, successor: successorValue };
}

/** The Binary Search Tree Deletion generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; deletions?: number[] } | null) ?? {};
    const values = task.values ?? [8, 3, 10, 1, 6, 14, 4, 7];
    const deletions = task.deletions ?? [1, 10, 8];

    let root: Node | null = null;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: "Empty binary search tree - insert values before deleting them.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0, inorder: [] },
    };
    step += 1;

    for (const value of values) {
        root = insert(root, value);
    }
    yield render(root, step, `Built the tree from ${values.length} values; inorder is ${inorder(root).join(", ")}.`, 0);
    step += 1;

    for (const target of deletions) {
        const present = inorder(root).includes(target);
        yield render(
            root,
            step,
            present ? `Searching for ${target} to delete.` : `Value ${target} is not in the tree - nothing to remove.`,
            1,
            new Map([[target, "comparing" as EntityState]]),
        );
        step += 1;

        const result = remove(root, target);
        root = result.root;
        const note = result.successor !== undefined
            ? `Deleted ${target} using inorder successor ${result.successor}; inorder is now ${inorder(root).join(", ")}.`
            : `Deleted ${target}; inorder is now ${inorder(root).join(", ")}.`;
        yield render(root, step, note, result.successor !== undefined ? 5 : 3);
        step += 1;
    }

    const finalStates = new Map<number, EntityState>();
    for (const value of inorder(root)) {
        finalStates.set(value, "sorted");
    }
    yield render(root, step, `Done - final inorder traversal is ${inorder(root).join(", ")}.`, 7, finalStates);
}

/** The Binary Search Tree Deletion module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Removing a node from a search tree has to leave every left-subtree key smaller and every right-subtree key larger. A leaf is simply cut away and a node with one child is replaced by that child. When the node has two children, its inorder successor is the next key in sorted order, so copying that key into the node and deleting the successor keeps the ordering intact.",
        invariants: [
            "The inorder traversal of the tree is always a strictly increasing sequence of the stored keys.",
            "After each deletion the tree contains exactly the original keys minus the values successfully removed.",
            "The two-child case removes a successor with at most one child, so it reduces to an easier case.",
        ],
        correctness:
            "For a leaf or one-child node, splicing out the node connects its parent directly to the surviving subtree; all keys in that subtree already lie on the correct side of the parent. For a two-child node, the inorder successor is the minimum of the right subtree, so it has no left child and copying its value into the node leaves both subtrees valid. Deleting the successor then uses the one-child or leaf case. By induction on the recursion, the BST property holds after every deletion.",
        complexityRationale:
            "Each deletion follows one root-to-node path of length equal to the tree height h and, in the two-child case, one extra descent to the successor. Height is O(log n) on a balanced tree and O(n) in the worst case, giving O(h) time per deletion and O(n) space for the tree.",
        uses: [
            "Dynamic ordered sets and dictionaries",
            "Deleting records from an in-memory index",
            "A teaching model for the three deletion cases",
        ],
        references: [
            "CLRS, Introduction to Algorithms, Chapter 12 (Binary Search Trees)",
            "Knuth, The Art of Computer Programming, Volume 3, Section 6.2.2",
        ],
        workedExample:
            "For the tree rooted at 8 with children 3 and 10, deleting leaf 1 simply detaches it. Deleting 10, which has only the right child 14, replaces it with 14. Deleting 8, which has two children, copies its inorder successor (the next key after 8) into the root and then removes that successor from the right subtree.",
    },
    id: "binary-search-tree-delete",
    name: "Binary Search Tree Delete",
    category: "data-structures",
    complexity: { time: "O(h) per deletion", space: "O(n)" },
    defaultInput: { values: [8, 3, 10, 1, 6, 14, 4, 7], deletions: [1, 10, 8] },
    visualType: "tree",
    run,
    pseudocode: [
        "build the search tree by inserting each value",
        "for each value to delete search down from the root",
        "a missing value leaves the tree unchanged",
        "a leaf or one-child node is spliced out directly",
        "with two children find the inorder successor",
        "copy the successor value into the current node",
        "delete the successor which has at most one child",
        "done: inorder order reflects all successful deletions",
    ],
};

export default module;
