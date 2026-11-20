/**
 * btree-delete-redistribution.ts - B-Tree Deletion with Redistribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Removing a key from a B-tree must keep every node (except possibly the root)
 * between t-1 and 2t-1 keys. When a descent would enter an underfull child,
 * the algorithm first borrows a key from a sibling (redistribution) or merges
 * two children around their separating key. Deleting an internal key replaces
 * it with its inorder predecessor or successor. This complements the
 * insert-and-split b-tree module, which never removes keys.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log_t n) per deletion
 *   Space: O(n) for all nodes plus O(log_t n) recursion stack
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node's keys are drawn as a contiguous group of grid cells.
 *   - The key being deleted is YELLOW (comparing).
 *   - Borrowed and promoted keys are CYAN (active).
 *   - The final tree is GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Node {
    keys: number[];
    leaf: boolean;
    children: Node[];
}

const newNode = (leaf = false): Node => ({ keys: [], leaf, children: [] });

function getPred(node: Node): number {
    let cursor = node;
    while (!cursor.leaf) {
        cursor = cursor.children[cursor.children.length - 1] as Node;
    }
    return cursor.keys[cursor.keys.length - 1] as number;
}

function getSucc(node: Node): number {
    let cursor = node;
    while (!cursor.leaf) {
        cursor = cursor.children[0] as Node;
    }
    return cursor.keys[0] as number;
}

function splitChild(parent: Node, index: number, t: number): void {
    const child = parent.children[index] as Node;
    const right = newNode(child.leaf);
    const fullKeys = child.keys;
    const medianKey = fullKeys[t - 1] as number;
    right.keys = fullKeys.slice(t);
    child.keys = fullKeys.slice(0, t - 1);
    if (!child.leaf) {
        right.children = child.children.slice(t);
        child.children = child.children.slice(0, t);
    }
    parent.keys.splice(index, 0, medianKey);
    parent.children.splice(index + 1, 0, right);
}

function insertNonFull(node: Node, key: number, t: number): void {
    let i = node.keys.length - 1;
    if (node.leaf) {
        while (i >= 0 && key < (node.keys[i] as number)) {
            node.keys[i + 1] = node.keys[i] as number;
            i -= 1;
        }
        node.keys[i + 1] = key;
        return;
    }
    while (i >= 0 && key < (node.keys[i] as number)) {
        i -= 1;
    }
    i += 1;
    const child = node.children[i] as Node;
    if (child.keys.length === 2 * t - 1) {
        splitChild(node, i, t);
        if (key > (node.keys[i] as number)) {
            i += 1;
        }
    }
    insertNonFull(node.children[i] as Node, key, t);
}

function insert(root: Node, key: number, t: number): Node {
    if (root.keys.length === 2 * t - 1) {
        const newRoot = newNode(false);
        newRoot.children.push(root);
        splitChild(newRoot, 0, t);
        insertNonFull(newRoot, key, t);
        return newRoot;
    }
    insertNonFull(root, key, t);
    return root;
}

function borrowFromPrev(parent: Node, index: number): void {
    const child = parent.children[index] as Node;
    const sibling = parent.children[index - 1] as Node;
    child.keys.unshift(parent.keys[index - 1] as number);
    parent.keys[index - 1] = sibling.keys.pop() as number;
    if (!sibling.leaf) {
        child.children.unshift(sibling.children.pop() as Node);
    }
}

function borrowFromNext(parent: Node, index: number): void {
    const child = parent.children[index] as Node;
    const sibling = parent.children[index + 1] as Node;
    child.keys.push(parent.keys[index] as number);
    parent.keys[index] = sibling.keys.shift() as number;
    if (!sibling.leaf) {
        child.children.push(sibling.children.shift() as Node);
    }
}

function merge(parent: Node, index: number): void {
    const child = parent.children[index] as Node;
    const sibling = parent.children[index + 1] as Node;
    child.keys.push(parent.keys[index] as number);
    for (const key of sibling.keys) {
        child.keys.push(key);
    }
    if (!sibling.leaf) {
        for (const c of sibling.children) {
            child.children.push(c);
        }
    }
    parent.keys.splice(index, 1);
    parent.children.splice(index + 1, 1);
}

function fill(parent: Node, index: number, t: number): void {
    if (index > 0 && (parent.children[index - 1] as Node).keys.length >= t) {
        borrowFromPrev(parent, index);
    } else if (
        index < parent.children.length - 1 &&
        (parent.children[index + 1] as Node).keys.length >= t
    ) {
        borrowFromNext(parent, index);
    } else if (index < parent.children.length - 1) {
        merge(parent, index);
    } else {
        merge(parent, index - 1);
    }
}

function deleteFrom(node: Node, key: number, t: number): void {
    let index = 0;
    while (index < node.keys.length && key > (node.keys[index] as number)) {
        index += 1;
    }
    if (index < node.keys.length && node.keys[index] === key) {
        if (node.leaf) {
            node.keys.splice(index, 1);
            return;
        }
        deleteInternal(node, index, t);
        return;
    }
    if (node.leaf) {
        return; // key not present
    }
    const isLast = index === node.keys.length;
    const child = node.children[index] as Node;
    if (child.keys.length === t - 1) {
        fill(node, index, t);
    }
    if (isLast && index > node.keys.length) {
        deleteFrom(node.children[index - 1] as Node, key, t);
    } else {
        deleteFrom(node.children[Math.min(index, node.children.length - 1)] as Node, key, t);
    }
}

function deleteInternal(node: Node, index: number, t: number): void {
    const key = node.keys[index] as number;
    const left = node.children[index] as Node;
    const right = node.children[index + 1] as Node;
    if (left.keys.length >= t) {
        const pred = getPred(left);
        node.keys[index] = pred;
        deleteFrom(left, pred, t);
    } else if (right.keys.length >= t) {
        const succ = getSucc(right);
        node.keys[index] = succ;
        deleteFrom(right, succ, t);
    } else {
        merge(node, index);
        deleteFrom(node.children[index] as Node, key, t);
    }
}

/** Collect all keys in sorted order plus a structural validity verdict. */
function collect(root: Node | null, t: number): { keys: number[]; valid: boolean; depth: number } {
    const keys: number[] = [];
    let valid = true;
    let leafDepth = -1;
    const walk = (node: Node, depth: number, min: number, max: number): boolean => {
        if (node.keys.length === 0 && depth === 0) {
            return true; // empty root
        }
        if (depth === 0) {
            if (node.keys.length > 2 * t - 1 || (node.keys.length < 1 && node.children.length > 0)) {
                valid = false;
            }
        } else if (node.keys.length < t - 1 || node.keys.length > 2 * t - 1) {
            valid = false;
        }
        for (let i = 0; i < node.keys.length; i += 1) {
            const key = node.keys[i] as number;
            if (key <= min || key >= max) {
                valid = false;
            }
            if (i > 0 && (node.keys[i - 1] as number) >= key) {
                valid = false;
            }
            keys.push(key);
        }
        if (node.leaf) {
            if (node.children.length !== 0) {
                valid = false;
            }
            if (leafDepth === -1) {
                leafDepth = depth;
            } else if (leafDepth !== depth) {
                valid = false;
            }
            return true;
        }
        if (node.children.length !== node.keys.length + 1) {
            valid = false;
        }
        let low = min;
        for (let i = 0; i < node.children.length; i += 1) {
            const high = i < node.keys.length ? (node.keys[i] as number) : max;
            if (!walk(node.children[i] as Node, depth + 1, low, high)) {
                valid = false;
            }
            low = high;
        }
        return true;
    };
    if (root) {
        walk(root, 0, -Infinity, Infinity);
    }
    return { keys: keys.sort((a, b) => a - b), valid, depth: leafDepth };
}

/** Flatten the tree into grid cells for visualization. */
function renderCells(root: Node | null, states: Map<number, EntityState>): VisualEntity[] {
    const entities: VisualEntity[] = [];
    if (!root || root.keys.length === 0) {
        return [
            {
                id: "cell-empty",
                type: "cell" as const,
                label: "(empty)",
                value: 0,
                state: "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 0, col: 0 },
            },
        ];
    }
    const levels: Node[][] = [[root]];
    while (true) {
        const level = levels[levels.length - 1] as Node[];
        const next: Node[] = [];
        for (const node of level) {
            if (!node.leaf) {
                for (const child of node.children) {
                    next.push(child);
                }
            }
        }
        if (next.length === 0) {
            break;
        }
        levels.push(next);
    }
    levels.forEach((level, row) => {
        let col = 0;
        for (const node of level) {
            for (const key of node.keys) {
                entities.push({
                    id: `cell-${key}`,
                    type: "cell" as const,
                    label: String(key),
                    value: key,
                    state: states.get(key) ?? "unvisited",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row, col, key },
                });
                col += 1;
            }
            col += 1; // gap between nodes on the same level
        }
    });
    return entities;
}

/** The B-Tree Deletion generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; deletions?: number[]; order?: number } | null) ?? {};
    const values = [...new Set(task.values ?? [10, 20, 5, 6, 12, 30, 7, 17, 3, 4, 2, 1])];
    const deletions = task.deletions ?? [6, 13, 7, 4, 2, 16, 12];
    const t = typeof task.order === "number" && task.order >= 2 ? Math.floor(task.order) : 2;

    let root: Node = newNode(true);
    let step = 0;
    const states = new Map<number, EntityState>();

    yield {
        stepNumber: step,
        entities: renderCells(root, states),
        edges: [],
        description: `B-tree of minimum degree ${t} - insert keys before deleting.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { keys: [], valid: true, order: t },
    };
    step += 1;

    for (const value of values) {
        root = insert(root, value, t);
    }
    states.clear();
    yield {
        stepNumber: step,
        entities: renderCells(root, states),
        edges: [],
        description: `Built the B-tree; ${collect(root, t).keys.length} keys across several levels.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { keys: collect(root, t).keys, valid: collect(root, t).valid, order: t },
    };
    step += 1;

    for (const target of deletions) {
        const present = collect(root, t).keys.includes(target);
        states.clear();
        states.set(target, "comparing");
        yield {
            stepNumber: step,
            entities: renderCells(root, states),
            edges: [],
            description: present
                ? `Deleting ${target} - borrow from a sibling or merge if a child is underfull.`
                : `Key ${target} is absent - the tree is unchanged.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { keys: collect(root, t).keys, valid: collect(root, t).valid, order: t },
        };
        step += 1;

        deleteFrom(root, target, t);
        if (root.keys.length === 0 && !root.leaf) {
            root = root.children[0] as Node;
        }
        const check = collect(root, t);
        states.clear();
        for (const key of check.keys) {
            states.set(key, "active");
        }
        yield {
            stepNumber: step,
            entities: renderCells(root, states),
            edges: [],
            description: `After deleting ${target}: ${check.keys.length} keys remain, valid ${check.valid}.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { keys: check.keys, valid: check.valid, order: t },
        };
        step += 1;
    }

    const final = collect(root, t);
    states.clear();
    for (const key of final.keys) {
        states.set(key, "sorted");
    }
    yield {
        stepNumber: step,
        entities: renderCells(root, states),
        edges: [],
        description: `Done - B-tree holds ${final.keys.length} keys with all nodes in range.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: { keys: final.keys, valid: final.valid, order: t },
    };
}

/** The B-Tree Deletion module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A B-tree node must hold between t-1 and 2t-1 keys, so deletion cannot simply remove a key everywhere. If the node is a leaf, removing a key is fine unless it leaves too few. On the way down, whenever the next child is minimal, the algorithm first borrows a key from an adjacent sibling or merges two children. Internal keys are replaced by their inorder predecessor or successor, which pushes the real removal down to a leaf.",
        invariants: [
            "Every non-root node holds between t-1 and 2t-1 keys.",
            "A non-leaf node has exactly one more child than keys, and all leaves sit at the same depth.",
            "Keys within a node and across the tree stay in sorted order.",
        ],
        correctness:
            "Borrowing shifts a separating key down into an underfull child and pulls a key from a sibling, so both nodes stay within their bounds and the key ranges remain ordered. Merging combines two minimal children and their separator into one full node, again within bounds. Removing an internal key by replacing it with its inorder predecessor preserves order and reduces the problem to deleting that predecessor from a leaf. These local repairs restore every invariant after each deletion.",
        complexityRationale:
            "The tree has height O(log_t n). Each level of the deletion descent performs constant-time borrowing, merging, and key shifts on arrays of size O(t), so the total is O(t log_t n) which is O(log n) for fixed t. All nodes together store O(n) keys.",
        uses: [
            "Database and filesystem index deletion",
            "Block-oriented ordered dictionaries",
            "Maintaining B-tree indexes after record removal",
        ],
        references: [
            "Bayer and McCreight, Organization and Maintenance of Large Ordered Indexes, 1972",
            "CLRS, Introduction to Algorithms, Chapter 18 (B-Tree delete)",
        ],
        workedExample:
            "In a B-tree of minimum degree 2, a node may hold one to three keys. Deleting a key from a leaf that has only one key would underflow, so the algorithm first borrows a key from a sibling through the parent, or merges with a sibling if neither can spare one. Deleting an internal key swaps in its inorder predecessor and then removes that predecessor from a leaf.",
    },
    id: "btree-delete-redistribution",
    name: "B-Tree Delete with Redistribution",
    category: "data-structures",
    complexity: { time: "O(log n) per deletion", space: "O(n)" },
    defaultInput: {
        values: [10, 20, 5, 6, 12, 30, 7, 17, 3, 4, 2, 1],
        deletions: [6, 13, 7, 4, 2, 16, 12],
        order: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "insert keys splitting full nodes around their median",
        "for each key to delete search from the root",
        "if the key is in a leaf remove it directly",
        "if internal replace it with its inorder predecessor",
        "before descending into a minimal child borrow from a sibling",
        "if no sibling can lend merge two children around the separator",
        "if the root empties promote its only child",
        "done: every node keeps between t-1 and 2t-1 keys",
    ],
};

export default module;
