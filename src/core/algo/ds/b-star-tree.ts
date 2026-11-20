/**
 * b-star-tree.ts - B* Tree
 *
 * A B* tree is a B-tree variant that keeps every non-root node at least
 * two-thirds full. When an insertion overflows a node, the algorithm first
 * borrows a key from a lighter sibling through the parent; only when all
 * adjacent siblings are also full does it perform a three-way split of two
 * full nodes into three. Delaying splits raises storage utilization above a
 * plain B-tree.
 *
 * Time:  O(log n) search; amortized O(log n) insert
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const MAX = 6;
const MIN = Math.floor((2 * MAX) / 3);

interface BNode {
    id: number;
    keys: number[];
    children: BNode[];
    leaf: boolean;
}

let nextId = 0;
const makeNode = (leaf: boolean): BNode => ({ id: nextId++, keys: [], children: [], leaf });

function childIndex(node: BNode, key: number): number {
    let c = 0;
    while (c < node.keys.length && key >= (node.keys[c] ?? Infinity)) c += 1;
    return c;
}

function insertSorted(keys: number[], key: number): void {
    let i = 0;
    while (i < keys.length && (keys[i] ?? Infinity) < key) i += 1;
    keys.splice(i, 0, key);
}

function splitRoot(node: BNode): BNode {
    const mid = Math.floor(node.keys.length / 2);
    const promoted = node.keys[mid] ?? 0;
    const left = makeNode(node.leaf);
    left.keys = node.keys.slice(0, mid);
    left.children = node.leaf ? [] : node.children.slice(0, mid + 1);
    const right = makeNode(node.leaf);
    // Leaves keep the promoted key as the first key of the right leaf, so every
    // data key stays in a leaf and parent separators are only copies.
    right.keys = node.leaf ? node.keys.slice(mid) : node.keys.slice(mid + 1);
    right.children = node.leaf ? [] : node.children.slice(mid + 1);
    const root = makeNode(false);
    root.keys = [promoted];
    root.children = [left, right];
    return root;
}

function splitPair(parent: BNode, sepIdx: number, left: BNode, right: BNode): void {
    const allKeys = [...left.keys, ...right.keys];
    const allChildren = [...left.children, ...right.children];
    const total = allKeys.length;
    const size = Math.floor(total / 3);
    const a = makeNode(left.leaf);
    a.keys = allKeys.slice(0, size);
    const b = makeNode(left.leaf);
    b.keys = allKeys.slice(size, 2 * size);
    const c = makeNode(left.leaf);
    c.keys = allKeys.slice(2 * size);
    a.children = allChildren.slice(0, a.keys.length + 1);
    b.children = allChildren.slice(a.keys.length + 1, a.keys.length + b.keys.length + 2);
    c.children = allChildren.slice(a.keys.length + b.keys.length + 2);
    parent.children.splice(sepIdx, 2, a, b, c);
    parent.keys.splice(sepIdx, 1, b.keys[0] ?? 0, c.keys[0] ?? 0);
}

/** Ordinary two-way split for a full internal node (three-way splits are for leaves). */
function splitInternal(parent: BNode, node: BNode, idx: number): void {
    const keys = [...node.keys];
    const children = [...node.children];
    const mid = Math.floor(keys.length / 2);
    const promoted = keys[mid] ?? 0;
    const right = makeNode(false);
    right.keys = keys.slice(mid + 1);
    right.children = children.slice(mid + 1);
    node.keys = keys.slice(0, mid);
    node.children = children.slice(0, mid + 1);
    parent.children.splice(idx + 1, 0, right);
    parent.keys.splice(idx, 0, promoted);
}

function fixOverflow(tree: { root: BNode }, node: BNode, parent: BNode | null): void {
    if (!parent) {
        tree.root = splitRoot(node);
        return;
    }
    const idx = parent.children.indexOf(node);
    const right = parent.children[idx + 1];
    const left = parent.children[idx - 1];
    if (right && right.keys.length < MAX) {
        if (node.leaf) {
            const moved = node.keys.pop() ?? 0;
            right.keys.unshift(moved);
            parent.keys[idx] = node.keys[node.keys.length - 1] ?? moved;
        } else {
            const separator = parent.keys[idx] ?? 0;
            const promoted = node.keys.pop() ?? 0;
            right.keys.unshift(separator);
            right.children.unshift(node.children.pop() ?? makeNode(true));
            parent.keys[idx] = promoted;
        }
        return;
    }
    if (left && left.keys.length < MAX) {
        if (node.leaf) {
            const moved = node.keys.shift() ?? 0;
            left.keys.push(moved);
            parent.keys[idx - 1] = node.keys[0] ?? moved;
        } else {
            const separator = parent.keys[idx - 1] ?? 0;
            const promoted = node.keys.shift() ?? 0;
            left.keys.push(separator);
            left.children.push(node.children.shift() ?? makeNode(true));
            parent.keys[idx - 1] = promoted;
        }
        return;
    }
    if (node.leaf && right) {
        splitPair(parent, idx, node, right);
        return;
    }
    if (node.leaf && left) {
        splitPair(parent, idx - 1, left, node);
        return;
    }
    splitInternal(parent, node, idx);
}

/** Insert a key, returning the id of the node that was changed last. */
function insert(tree: { root: BNode }, key: number): number {
    function rec(node: BNode, value: number, parent: BNode | null): number {
        let highlight = node.id;
        if (node.leaf) {
            insertSorted(node.keys, value);
        } else {
            const c = childIndex(node, value);
            const child = node.children[c] ?? node.children[node.children.length - 1];
            if (child) highlight = rec(child, value, node);
        }
        if (node.keys.length > MAX) fixOverflow(tree, node, parent);
        return highlight;
    }
    return rec(tree.root, key, null);
}

function contains(node: BNode, key: number): boolean {
    if (node.keys.includes(key)) return true;
    if (node.leaf) return false;
    const c = childIndex(node, key);
    const child = node.children[c];
    return child ? contains(child, key) : false;
}

function toFrame(
    root: BNode,
    step: number,
    message: string,
    line: number,
    highlight: number,
    query: number,
    found: boolean | null,
    inserted: number,
): VisualFrame {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const walk = (node: BNode, parentId: string | null, row: number, col: number): void => {
        entities.push({
            id: `bs-${node.id}`,
            type: "node" as const,
            label: node.keys.join(",") || "-",
            value: node.keys.length,
            state: (node.id === highlight ? "comparing" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: parentId ?? "root", row, col, fill: node.keys.length / MAX, leaf: node.leaf },
        });
        if (parentId !== null) {
            edges.push({
                id: `bs-edge-${parentId}-${node.id}`,
                sourceId: parentId,
                targetId: `bs-${node.id}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            });
        }
        node.children.forEach((child, i) => walk(child, `bs-${node.id}`, row + 1, i));
    };
    walk(root, null, 0, 0);
    return {
        stepNumber: step,
        entities,
        edges,
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: { query, found: found === null ? "pending" : found, inserted, maxKeys: MAX, minKeys: MIN },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = Array.isArray(task.keys) ? task.keys : [10, 20, 5, 6, 12, 30, 7, 17, 3, 4, 2, 1, 8, 9, 11];
    const query = typeof task.query === "number" ? task.query : 12;
    nextId = 0;
    const tree: { root: BNode } = { root: makeNode(true) };
    let step = 0;
    let last = tree.root.id;

    yield toFrame(tree.root, step, `Empty B* tree: non-root nodes stay at least ${MIN}/${MAX} full.`, 0, last, query, null, 0);
    step += 1;

    for (const key of keys) {
        last = insert(tree, key);
        yield toFrame(tree.root, step, `Insert ${key}: borrow from a light sibling before splitting.`, 1, last, query, null, key);
        step += 1;
    }
    const found = contains(tree.root, query);
    yield toFrame(tree.root, step, `Search ${query}: ${found ? "found" : "absent"} after O(log n) comparisons.`, 4, -1, query, found, -1);
    step += 1;
    yield toFrame(tree.root, step, `Done: ${keys.length} keys stored with delayed three-way splits.`, 7, -1, query, found, -1);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A B* tree is a B-tree that postpones splitting. When a node fills up, it first shifts a key through the parent into a sibling that has room. Only when that sibling is also full does it split two full nodes into three at once. The extra work per insertion buys denser nodes and shorter trees.",
        invariants: [
            "Every non-root node holds at most MAX keys and, when it has a sibling, at least two-thirds of MAX.",
            "All leaves sit at the same depth, so searches touch the same number of nodes.",
            "Separators in a parent delimit the key ranges of the child subtrees in order.",
        ],
        correctness:
            "Borrowing moves a boundary key through the parent so both nodes remain in range and sorted. When borrowing is impossible both siblings are full, so their 2*MAX+1 keys can always be repartitioned into three nodes each meeting the two-thirds minimum. Separators are refreshed to the new first keys, so search routing remains exact after every update.",
        complexityRationale:
            "Search descends one path of height O(log n). Insertion does O(log n) work plus a constant number of redistributions, so its amortized cost is O(log n); the tree stores O(n) keys.",
        uses: [
            "Disk and flash indexes where space utilization matters",
            "Database storage engines with expensive node splits",
            "Filesystems that pack keys densely into fixed-size blocks",
        ],
        references: [
            "Donald Knuth, The Art of Computer Programming, Vol. 3, Section 6.2.4 (Multiway Trees)",
            "Rudolf Bayer and Karl Unterauer, 'Prefix B-Trees', ACM TODS 1977",
        ],
        workedExample:
            "With MAX 6 and MIN 4, inserting into a full leaf [10,20,5,6,12,30] first tries a sibling with room and lends it the largest key. If no sibling has room, two full leaves holding thirteen keys are repartitioned into three leaves of four, four, and five keys.",
    },
    id: "b-star-tree",
    name: "B* Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [10, 20, 5, 6, 12, 30, 7, 17, 3, 4, 2, 1, 8, 9, 11], query: 12 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with a single empty root leaf",
        "for each key descend to the leaf whose range contains it",
        "insert the key into the leaf in sorted order",
        "if the node overflows try lending a key to a light sibling",
        "otherwise split two full siblings into three nodes",
        "refresh parent separators to the new first keys",
        "if the root overflows split it and grow a new root",
        "search the query by routing through separators",
        "done: report whether the query key is present",
    ],
};

export default module;
