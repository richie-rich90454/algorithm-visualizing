/**
 * treap-split-merge.ts - Ordered treap built from split and merge primitives.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A treap is a binary search tree on keys and a max-heap on priorities. The
 * split/merge formulation builds it without rotations. split(T, k) returns two
 * treaps: every key < k and every key >= k. merge(A, B) combines two treaps
 * whose keys are all ordered (all of A below all of B) by recursing down the
 * right spine of A and the left spine of B and keeping the higher priority at
 * the top. Insertion is then split, wrap the new node with two merges.
 *
 * This is distinct from the rotation-based treap module: there a node bubbles
 * up via rotations, while here the entire structure is assembled from the two
 * recursive primitives that also power implicit treaps and treap sequences.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) expected per split, merge, or insert
 *   Space: O(n) for the nodes and O(log n) expected recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are drawn with the tree layout; parentId metadata drives edges.
 *   - Each key triggers a split frame then a merge frame.
 *   - The freshly inserted node is SORTED in the merge frame.
 *   - Final meta exposes inorder, priorities, and parents for verification.
 * ---------------------------------------------------------------------------
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface Node {
    key: number;
    priority: number;
    left: Node | null;
    right: Node | null;
}

/** Deterministic mixed-hash priority, so replays are reproducible. */
function priorityOf(key: number): number {
    let h = Math.imul(key | 0, 2654435761);
    h ^= h >>> 15;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return h >>> 0;
}

/** Split into keys < key and keys >= key. */
function split(root: Node | null, key: number): [Node | null, Node | null] {
    if (!root) return [null, null];
    if (root.key < key) {
        const [left, right] = split(root.right, key);
        root.right = left;
        return [root, right];
    }
    const [left, right] = split(root.left, key);
    root.left = right;
    return [left, root];
}

/** Merge two treaps where every key in a is less than every key in b. */
function merge(a: Node | null, b: Node | null): Node | null {
    if (!a) return b;
    if (!b) return a;
    if (a.priority > b.priority) {
        a.right = merge(a.right, b);
        return a;
    }
    b.left = merge(a, b.left);
    return b;
}

function keyList(root: Node | null): number[] {
    const out: number[] = [];
    const walk = (n: Node | null): void => {
        if (!n) return;
        walk(n.left);
        out.push(n.key);
        walk(n.right);
    };
    walk(root);
    return out;
}

function snapshot(root: Node | null, highlight: number | null): { nodes: VisualEntity[]; edges: VisualEdge[] } {
    const nodes: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (n: Node | null, parent: number | null): void => {
        if (!n) return;
        nodes.push({
            id: `node-${n.key}`,
            type: "node" as const,
            label: `${n.key}`,
            value: n.key,
            state: n.key === highlight ? "sorted" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parent === null ? "root" : String(parent), priority: n.priority },
        });
        for (const child of [n.left, n.right]) {
            if (child) {
                edges.push({
                    id: `edge-${n.key}-${child.key}`,
                    sourceId: `node-${n.key}`,
                    targetId: `node-${child.key}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
        walk(n.left, n.key);
        walk(n.right, n.key);
    };
    walk(root, null);
    return { nodes, edges };
}

interface TreapInput {
    keys?: number[];
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TreapInput | null) ?? {};
    const keys = (Array.isArray(task.keys) ? task.keys : [30, 20, 40, 10, 35, 50]).slice(0, 12);

    let root: Node | null = null;
    let step = 0;
    const frame = (description: string, line: number, highlight: number | null, meta: VisualFrame["meta"]): VisualFrame => {
        const snap = snapshot(root, highlight);
        return {
            stepNumber: step,
            entities: snap.nodes,
            edges: snap.edges,
            description,
            codeLineNumber: line,
            layout: "tree",
            meta,
        };
    };

    yield frame("Start with an empty treap; priorities come from a deterministic hash of each key.", 0, null, {
        size: 0,
    });
    step += 1;

    for (const key of keys) {
        const [leftPart, rightPart] = split(root, key);
        const leftKeys = keyList(leftPart);
        const rightKeys = keyList(rightPart);
        yield frame(
            `Split at ${key}: keys [${leftKeys.join(",")}] go left, keys [${rightKeys.join(",")}] go right.`,
            1,
            null,
            { splitKey: key, leftKeys, rightKeys },
        );
        step += 1;

        const node: Node = { key, priority: priorityOf(key), left: null, right: null };
        root = merge(merge(leftPart, node), rightPart);
        yield frame(`Merge left, new node ${key}, and right; heap order puts the top priority on top.`, 2, key, {
            inserted: key,
            size: keyList(root).length,
        });
        step += 1;
    }

    const inorder = keyList(root);
    const priorities: number[] = [];
    const parents: number[] = [];
    const collect = (n: Node | null, parent: number): void => {
        if (!n) return;
        collect(n.left, n.key);
        inorder.push(n.key);
        priorities.push(n.priority);
        parents.push(parent);
        collect(n.right, n.key);
    };
    // Rebuild the parallel arrays cleanly (inorder currently holds the keys).
    inorder.length = 0;
    collect(root, -1);

    yield frame(
        `Done: treap holds ${inorder.length} key(s); inorder is [${inorder.join(",")}].`,
        3,
        null,
        { inorder, priorities, parents, size: inorder.length },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A treap keeps two promises at once: keys read left to right are sorted, and the highest priority sits at the root. Split and merge are the two Lego bricks that build it. Split cuts a treap at a key into a small side and a large side; merge stacks two already-ordered treaps by following their inner spines and keeping whichever root has the better priority on top. Insertion is just split, merge with the new node, merge back.",
        invariants: [
            "After split, every key in the left result is less than every key in the right result.",
            "merge is only called when all keys in the first treap are less than all keys in the second.",
            "At every node the priority is at least the priority of each child (max-heap).",
            "Inorder traversal of any treap yields its keys in strictly increasing order.",
        ],
        correctness:
            "split recurses on one spine and reattaches the returned subtree, producing exactly the keys below and at-or-above the split key, each still a valid treap. merge compares the two root priorities; the higher one becomes the root and the recursive call on its inner child preserves both the key ordering (all left keys remain less than all right keys) and the heap property. Wrapping a new node between split results therefore inserts it in sorted position without violating either invariant, so the final inorder list is the sorted input.",
        complexityRationale:
            "With random priorities a treap has O(log n) expected height, and split and merge each follow a single root-to-leaf path, giving O(log n) expected time per operation. Storing one node per key uses O(n) space, plus O(log n) expected recursion stack.",
        uses: [
            "Implicit treaps for sequence editing, splits, and concatenation",
            "Persistent and functional ordered maps built from shareable split/merge nodes",
            "Randomized priority search structures with simple recursive implementations",
        ],
        references: [
            "Seidel and Aragon, Randomized Search Trees, Algorithmica 15 (1996)",
            "CLRS, Introduction to Algorithms, Chapter 13 (Red-Black Trees) for the ordering invariant",
        ],
        workedExample:
            "Inserting keys 30, 20, 40: split the empty tree at 30 gives two empties, merge with node 30 yields [30]. Split at 20 returns left empty and right [30]; merge empty with 20 with [30] gives a treap whose inorder is [20, 30]. Splitting at 40 appends 40, so the final inorder is [20, 30, 40] regardless of the priorities' shape.",
    },
    id: "treap-split-merge",
    name: "Treap Split and Merge",
    category: "data-structures",
    complexity: { time: "O(log n) expected", space: "O(n)" },
    defaultInput: { keys: [30, 20, 40, 10, 35, 50] },
    visualType: "tree",
    run,
    pseudocode: [
        "priority of a key <- a fixed hash of the key",
        "split(T, k): if T empty return two empty treaps",
        "if T.key < k: split right subtree, reattach its left part",
        "else: split left subtree, reattach its right part",
        "merge(A, B): higher-priority root wins, recurse on its inner child",
        "insert k: split at k, then merge left, new node, right",
        "done: inorder traversal of the treap is the sorted key list",
    ],
};

export default module;
