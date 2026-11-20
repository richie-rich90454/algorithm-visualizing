/**
 * avl-deletion-rebalance.ts - AVL Tree Deletion and Rebalancing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Deleting from an AVL tree can unbalance several ancestors at once, unlike
 * insertion where a single rotation always restores balance. After splicing
 * out the node, each ancestor on the way back to the root updates its height
 * and, when its balance factor leaves [-1, 1], applies the correct single or
 * double rotation. This module is the deletion counterpart of the insert-only
 * avl-tree module.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) per deletion plus O(log n) rebalancing
 *   Space: O(n) for the tree plus O(log n) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their value and current balance factor.
 *   - The deleted node is YELLOW (comparing); the lifted successor is CYAN.
 *   - The final tree is GREEN (sorted) with every balance in range.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Node {
    value: number;
    left: Node | null;
    right: Node | null;
    height: number;
}

const heightOf = (node: Node | null): number => (node ? node.height : 0);
const balanceOf = (node: Node | null): number =>
    node ? heightOf(node.left) - heightOf(node.right) : 0;

function fixHeight(node: Node): void {
    node.height = 1 + Math.max(heightOf(node.left), heightOf(node.right));
}

function rotateRight(y: Node): Node {
    const x = y.left as Node;
    y.left = x.right;
    x.right = y;
    fixHeight(y);
    fixHeight(x);
    return x;
}

function rotateLeft(x: Node): Node {
    const y = x.right as Node;
    x.right = y.left;
    y.left = x;
    fixHeight(x);
    fixHeight(y);
    return y;
}

/** Update height and restore the AVL invariant at one node. */
function rebalance(node: Node): Node {
    fixHeight(node);
    const balance = balanceOf(node);
    if (balance > 1) {
        if (balanceOf(node.left) < 0) {
            node.left = rotateLeft(node.left as Node);
        }
        return rotateRight(node);
    }
    if (balance < -1) {
        if (balanceOf(node.right) > 0) {
            node.right = rotateRight(node.right as Node);
        }
        return rotateLeft(node);
    }
    return node;
}

function insert(node: Node | null, value: number): Node {
    if (!node) {
        return { value, left: null, right: null, height: 1 };
    }
    if (value < node.value) {
        node.left = insert(node.left, value);
    } else if (value > node.value) {
        node.right = insert(node.right, value);
    } else {
        return node;
    }
    return rebalance(node);
}

/** Remove a value, rebalancing every ancestor on the way back up. */
function remove(node: Node | null, value: number): { root: Node | null; successor?: number } {
    if (!node) {
        return { root: null };
    }
    if (value < node.value) {
        const result = remove(node.left, value);
        node.left = result.root;
        return { root: rebalance(node), successor: result.successor };
    }
    if (value > node.value) {
        const result = remove(node.right, value);
        node.right = result.root;
        return { root: rebalance(node), successor: result.successor };
    }
    if (!node.left) {
        return { root: node.right };
    }
    if (!node.right) {
        return { root: node.left };
    }
    let successor = node.right;
    while (successor.left) {
        successor = successor.left;
    }
    const successorValue = successor.value;
    node.value = successorValue;
    node.right = remove(node.right, successorValue).root;
    return { root: rebalance(node), successor: successorValue };
}

/** Independent check of the AVL invariants, returned through frame meta. */
function verify(node: Node | null): { ok: boolean; height: number; inorder: number[] } {
    const inorder: number[] = [];
    const walk = (current: Node | null, min: number, max: number): { ok: boolean; height: number } => {
        if (!current) {
            return { ok: true, height: 0 };
        }
        const left = walk(current.left, min, current.value);
        inorder.push(current.value);
        const right = walk(current.right, current.value, max);
        const ordered = current.value > min && current.value < max;
        const balanced = Math.abs(left.height - right.height) <= 1;
        const correctHeight = current.height === 1 + Math.max(left.height, right.height);
        return {
            ok: left.ok && right.ok && ordered && balanced && correctHeight,
            height: current.height,
        };
    };
    const result = walk(node, -Infinity, Infinity);
    return { ok: result.ok, height: result.height, inorder };
}

/** Build a frame from the current tree. */
function render(root: Node | null, step: number, message: string, line: number, states: Map<number, EntityState> = new Map()): VisualFrame {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: Node, parentId: string | null): void => {
        const id = `node-${node.value}`;
        entities.push({
            id,
            type: "node" as const,
            label: `${node.value}(b=${balanceOf(node)})`,
            value: node.value,
            state: states.get(node.value) ?? "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parentId ?? "root", value: node.value, balance: balanceOf(node) },
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
    const check = verify(root);
    return {
        stepNumber: step,
        entities,
        edges,
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: { size: entities.length, height: check.height, balanced: check.ok, inorder: check.inorder },
    };
}

/** The AVL Deletion generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; deletions?: number[] } | null) ?? {};
    const values = task.values ?? [10, 20, 30, 40, 50, 25, 5, 15];
    const deletions = task.deletions ?? [40, 10, 25, 50];

    let root: Node | null = null;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: "Empty AVL tree - build it with insertions before deleting.",
        codeLineNumber: 0,
        layout: "tree",
        meta: { size: 0, height: 0, balanced: true, inorder: [] },
    };
    step += 1;

    for (const value of values) {
        root = insert(root, value);
    }
    yield render(root, step, `Inserted ${values.length} keys; AVL height is ${verify(root).height}.`, 0);
    step += 1;

    for (const target of deletions) {
        yield render(root, step, `Deleting ${target} - rebalancing may ripple up several ancestors.`, 1, new Map([[target, "comparing" as EntityState]]));
        step += 1;
        const result = remove(root, target);
        root = result.root;
        const check = verify(root);
        const successorNote = result.successor !== undefined ? ` using successor ${result.successor}` : "";
        yield render(root, step, `After deleting ${target}${successorNote}: height ${check.height}, balanced ${check.ok}.`, result.successor !== undefined ? 6 : 7);
        step += 1;
    }

    const finalCheck = verify(root);
    const states = new Map<number, EntityState>();
    for (const value of finalCheck.inorder) {
        states.set(value, "sorted");
    }
    yield render(root, step, `Done - final AVL tree is balanced (${finalCheck.ok}) with height ${finalCheck.height}.`, 8, states);
}

/** The AVL Deletion module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An AVL tree keeps every node's left and right subtree heights within one of each other. Deleting a key can break that rule at the node removed and then again at each ancestor, so unlike insertion the rebalancing can continue all the way to the root. Each unbalanced node is repaired with one rotation for a same-side case or two rotations for a zig-zag case.",
        invariants: [
            "For every node the absolute difference of left and right heights is at most one.",
            "Each node stores a height equal to one plus the larger child height.",
            "The inorder keys remain strictly increasing after every deletion.",
        ],
        correctness:
            "Removing a leaf or a one-child node only shortens one subtree of its parent by one; the inorder order is unchanged. In the two-child case the inorder successor has no left child, so copying its value and deleting it preserves order and reduces to the simpler case. Walking back up, recomputing heights and applying the correct single or double rotation restores balance at each visited node; after the root, the whole tree again satisfies the AVL invariant.",
        complexityRationale:
            "The tree height is O(log n) because of the balance rule. A deletion descends one path and rebalances on the way back, touching O(log n) nodes with constant-time rotations. Storing one height per node uses O(n) space.",
        uses: [
            "Ordered maps needing worst-case logarithmic updates",
            "In-memory indexes with frequent insertions and deletions",
            "Real-time systems that cannot tolerate an unbalanced tree",
        ],
        references: [
            "Adelson-Velsky and Landis, An Algorithm for the Organization of Information, 1962",
            "CLRS, Introduction to Algorithms, Chapter 13 (Red-Black and AVL variants)",
        ],
        workedExample:
            "In an AVL tree built from 10, 20, 30, 40, 50, deleting 40 leaves its parent 30 with only a right child; that subtree shrinks and may unbalance 20, which is then rotated. Deleting a key with two children copies its inorder successor into place before removing the successor from the right subtree.",
    },
    id: "avl-deletion-rebalance",
    name: "AVL Deletion and Rebalancing",
    category: "data-structures",
    complexity: { time: "O(log n) per deletion", space: "O(n)" },
    defaultInput: { values: [10, 20, 30, 40, 50, 25, 5, 15], deletions: [40, 10, 25, 50] },
    visualType: "tree",
    run,
    pseudocode: [
        "insert values keeping each node height and balance current",
        "for each value to delete search down from the root",
        "remove a leaf or splice out a node with one child",
        "with two children copy the inorder successor value",
        "delete the successor from the right subtree",
        "update the node height after the recursive change",
        "if balance is plus two rotate at the left as needed then right",
        "if balance is minus two rotate at the right as needed then left",
        "done: the tree stays height balanced after every delete",
    ],
};

export default module;
