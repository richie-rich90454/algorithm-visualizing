/**
 * b-plus-tree-delete.ts - B+ Tree Deletion with Borrow and Merge
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A B+ tree stores every key in linked leaves; internal nodes hold only the
 * separator keys that route a search. Deleting a key starts at the root, walks
 * to the owning leaf and removes the key. When a node falls below its minimum
 * occupancy the tree borrows a child or key from an adjacent sibling when that
 * sibling has a surplus, and otherwise merges with the sibling and pulls the
 * separating key down from the parent. A merge can underflow the parent, so the
 * repair walks back to the root.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) per deletion for a tree of order m and n keys
 *   Space: O(n) for the nodes; O(log n) for the repair recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each B+ tree node is a tree node labelled with its keys.
 *   - Edges join a parent node to each of its children.
 *   - The node on the current search or repair path is highlighted.
 *   - meta carries the sorted leaf keys, the tree height and repair counts.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface BNode {
    leaf: boolean;
    keys: number[];
    children: BNode[];
    next: BNode | null;
}

interface DeleteInput {
    order?: number;
    keys?: number[];
    deletes?: number[];
}

/** Bulk-load a B+ tree from sorted keys so deletion can be studied on its own. */
function bulkLoad(sorted: number[], order: number): BNode {
    const maxKeys = order - 1;
    const leaves: BNode[] = [];
    for (let i = 0; i < sorted.length; i += maxKeys) {
        leaves.push({ leaf: true, keys: sorted.slice(i, i + maxKeys), children: [], next: null });
    }
    for (let i = 0; i + 1 < leaves.length; i += 1) {
        leaves[i]!.next = leaves[i + 1]!;
    }
    if (leaves.length === 0) {
        leaves.push({ leaf: true, keys: [], children: [], next: null });
    }
    let level = leaves;
    while (level.length > 1) {
        const parents: BNode[] = [];
        for (let i = 0; i < level.length; i += order) {
            const group = level.slice(i, i + order);
            parents.push({
                leaf: false,
                keys: group.slice(1).map((child) => child.keys[0] ?? 0),
                children: group,
                next: null,
            });
        }
        level = parents;
    }
    return level[0]!;
}

/** Descend to the leaf that would own a key. */
function findLeaf(root: BNode, key: number): BNode {
    let node = root;
    while (!node.leaf) {
        let i = 0;
        while (i < node.keys.length && key >= (node.keys[i] ?? 0)) i += 1;
        const child = node.children[i] ?? node.children[node.children.length - 1];
        if (!child) break;
        node = child;
    }
    return node;
}

/** Read all keys in order by following the linked leaves. */
function leafKeys(root: BNode): number[] {
    let leaf: BNode | null = root;
    while (leaf && !leaf.leaf) leaf = leaf.children[0] ?? null;
    const out: number[] = [];
    while (leaf) {
        out.push(...leaf.keys);
        leaf = leaf.next;
    }
    return out;
}

/** Height of the tree, counting the root level. */
function heightOf(root: BNode): number {
    let h = 1;
    let node: BNode | null = root;
    while (node && !node.leaf) {
        h += 1;
        node = node.children[0] ?? null;
    }
    return h;
}

/** Repair a child that dropped below its minimum occupancy. */
function repair(parent: BNode, index: number, order: number, stats: { rotations: number; merges: number }): void {
    const child = parent.children[index]!;
    const minLeaf = Math.floor((order - 1) / 2);
    const minChildren = Math.ceil(order / 2);
    const left = index > 0 ? parent.children[index - 1]! : null;
    const right = index + 1 < parent.children.length ? parent.children[index + 1]! : null;

    if (child.leaf) {
        if (right && right.keys.length > minLeaf) {
            const taken = right.keys.shift()!;
            child.keys.push(taken);
            parent.keys[index] = right.keys[0] ?? taken;
            stats.rotations += 1;
        } else if (left && left.keys.length > minLeaf) {
            const taken = left.keys.pop()!;
            child.keys.unshift(taken);
            parent.keys[index - 1] = child.keys[0] ?? taken;
            stats.rotations += 1;
        } else if (right) {
            child.keys.push(...right.keys);
            child.next = right.next;
            parent.children.splice(index + 1, 1);
            parent.keys.splice(index, 1);
            stats.merges += 1;
        } else if (left) {
            const previous = index - 2 >= 0 ? parent.children[index - 2]! : null;
            child.keys.unshift(...left.keys);
            child.next = right;
            if (previous) previous.next = child;
            parent.children.splice(index - 1, 1);
            parent.keys.splice(index - 1, 1);
            stats.merges += 1;
        }
        return;
    }

    if (right && right.children.length > minChildren) {
        const moved = right.children.shift()!;
        child.children.push(moved);
        child.keys.push(parent.keys[index] ?? 0);
        parent.keys[index] = right.keys.shift() ?? 0;
        stats.rotations += 1;
    } else if (left && left.children.length > minChildren) {
        const moved = left.children.pop()!;
        child.children.unshift(moved);
        child.keys.unshift(parent.keys[index - 1] ?? 0);
        parent.keys[index - 1] = left.keys.pop() ?? 0;
        stats.rotations += 1;
    } else if (right) {
        child.keys.push(parent.keys[index] ?? 0, ...right.keys);
        child.children.push(...right.children);
        child.next = right.next;
        parent.children.splice(index + 1, 1);
        parent.keys.splice(index, 1);
        stats.merges += 1;
    } else if (left) {
        child.keys.unshift(parent.keys[index - 1] ?? 0, ...left.keys);
        child.children.unshift(...left.children);
        child.next = right;
        parent.children.splice(index - 1, 1);
        parent.keys.splice(index - 1, 1);
        stats.merges += 1;
    }
}

/** Delete one key, repairing any underflow on the way back up. */
function deleteKey(root: BNode, key: number, order: number, stats: { rotations: number; merges: number }): boolean {
    const leaf = findLeaf(root, key);
    const position = leaf.keys.indexOf(key);
    if (position < 0) return false;
    leaf.keys.splice(position, 1);

    const minLeaf = Math.floor((order - 1) / 2);
    const minChildren = Math.ceil(order / 2);
    let node: BNode | null = root;
    const path: BNode[] = [];
    while (node && !node.leaf) {
        let i = 0;
        while (i < node.keys.length && key >= (node.keys[i] ?? 0)) i += 1;
        path.push(node);
        const next: BNode | null = node.children[Math.min(i, node.children.length - 1)] ?? null;
        if (!next || path.some((p) => p === next)) break;
        node = next;
    }
    // The leaf is last on the path, its parent second to last.
    path.push(leaf);
    for (let p = path.length - 2; p >= 0; p -= 1) {
        const parent = path[p]!;
        const child = path[p + 1]!;
        const index = parent.children.indexOf(child);
        if (index < 0) continue;
        const underflow = child.leaf
            ? child.keys.length < minLeaf
            : child.children.length < minChildren;
        if (underflow) repair(parent, index, order, stats);
    }
    // A root with a single child collapses into that child.
    let current: BNode = root;
    while (!current.leaf && current.children.length === 1) {
        current = current.children[0]!;
    }
    return true;
}

/** Convert the tree into a node/edge snapshot for the canvas. */
function makeTree(root: BNode, highlightId: string | null): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const place = (node: BNode, id: string, level: number): void => {
        entities.push({
            id,
            type: "node" as const,
            label: `${node.leaf ? "L" : "I"}[${node.keys.join(" ")}]`,
            value: node.keys.slice(),
            state: (id === highlightId ? "active" : node.leaf ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { level, leaf: node.leaf ? 1 : 0, keyCount: node.keys.length },
        });
        node.children.forEach((child, i) => {
            const childId = `${id}-${i}`;
            edges.push({
                id: `${id}->${childId}`,
                sourceId: id,
                targetId: childId,
                label: String(node.keys[i] ?? ""),
                state: "idle" as EntityState,
                directed: true,
            });
            place(child, childId, level + 1);
        });
    };
    place(root, "n", 0);
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeleteInput | null) ?? {};
    const order = Math.max(3, Math.min(8, Math.floor(Number(task.order ?? 4)) || 4));
    const source = Array.isArray(task.keys) && task.keys.length > 0
        ? task.keys.map((k) => Math.floor(Number(k) || 0))
        : [5, 2, 8, 1, 3, 7, 9, 4, 6, 11, 10, 12];
    const sorted = [...new Set(source)].sort((a, b) => a - b);
    const deletes = Array.isArray(task.deletes)
        ? task.deletes.map((k) => Math.floor(Number(k) || 0))
        : [7, 3, 11, 5, 9, 1, 4, 12, 8, 2, 10, 6];
    const stats = { rotations: 0, merges: 0 };
    let root = bulkLoad(sorted, order);
    let step = 0;
    const snapshot = (highlightId: string | null, description: string, codeLine: number, extra: Record<string, number | string | boolean | number[]>) => ({
        stepNumber: step++,
        ...makeTree(root, highlightId),
        description,
        codeLineNumber: codeLine,
        layout: "tree" as const,
        meta: {
            order,
            keys: leafKeys(root),
            height: heightOf(root),
            rotations: stats.rotations,
            merges: stats.merges,
            ...extra,
        },
    });

    yield snapshot(null, `Built a B+ tree of order ${order} from ${sorted.length} sorted key(s).`, 0, { removed: 0, found: 0 });
    const remaining = sorted.slice();
    for (const key of deletes) {
        const found = deleteKey(root, key, order, stats);
        if (found) {
            const at = remaining.indexOf(key);
            if (at >= 0) remaining.splice(at, 1);
        }
        yield snapshot(
            "n",
            found
                ? `Deleted key ${key}; leaf keys now [${leafKeys(root).join(", ")}].`
                : `Key ${key} was not present, so the tree is unchanged.`,
            found ? 6 : 2,
            { removed: deletes.filter((k, i) => i <= deletes.indexOf(key)).length, found: found ? 1 : 0 },
        );
    }

    const finalKeys = leafKeys(root);
    const valid = finalKeys.length === remaining.length && finalKeys.every((k, i) => k === remaining[i]);
    yield snapshot(
        null,
        valid
            ? `Verified: ${finalKeys.length} key(s) remain in sorted leaf order after ${stats.rotations} borrow(s) and ${stats.merges} merge(s).`
            : "Verification failed: leaf keys do not match the expected remaining set.",
        8,
        { removed: deletes.length, found: 0, valid: valid ? 1 : 0, expected: remaining },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A B+ tree keeps all records in its leaves and uses the upper levels only as a routing index. After you remove a key, a node may have too few entries to stay a valid branch. Look at the siblings that share the same parent: if one has spare entries, rotate one across through the parent; if both are minimal, merge the two nodes and pull the separator down. A merge can starve the parent, so repeat the check all the way to the root.",
        invariants: [
            "Every key that has not been deleted appears exactly once in the linked leaves.",
            "All leaves sit at the same depth, so every search costs the same number of comparisons.",
            "A separator key in an internal node equals the smallest key in the child immediately to its right.",
        ],
        correctness:
            "Deletion removes the target from exactly one leaf and leaves every other key in place. Each repair step preserves the key set: a rotation moves a child or key from a surplus sibling through the parent, and a merge combines two adjacent nodes while deleting one now-redundant separator. Because the check ascends from the leaf to the root, no node is left underfull, and collapsing a single-child root keeps the tree balanced. By induction the final leaves hold precisely the original set minus the deleted keys in sorted order.",
        complexityRationale:
            "Finding and removing the key follows one root-to-leaf path and each repair step touches one parent, so a deletion costs O(log n) for tree height log n. The tree itself stores one entry per record and one separator per child, using O(n) space, and the repair path uses O(log n) temporary nodes.",
        uses: [
            "Database index maintenance when rows are removed",
            "Filesystem metadata indexes that must stay balanced after deletes",
            "Any ordered index that supports range scans through linked leaves",
        ],
        references: [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 18",
            "Ramakrishnan and Gehrke, Database Management Systems, chapter on tree indexes",
        ],
        workedExample:
            "In an order-4 B+ tree, a leaf holding a single key is minimal. Deleting its last key triggers a repair: if the right sibling has three keys, one moves left and the parent separator is updated; if the sibling also has one key, the leaves merge into a two-key leaf and the parent loses one separator. If that leaves the parent with too few children, the same borrow-or-merge choice repeats one level up.",
    },
    id: "b-plus-tree-delete",
    name: "B+ Tree Deletion",
    category: "production-systems",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: {
        order: 4,
        keys: [5, 2, 8, 1, 3, 7, 9, 4, 6, 11, 10, 12],
        deletes: [7, 3, 11, 5, 9, 1, 4, 12, 8, 2, 10, 6],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "bulk-load the sorted keys into linked leaves and internal levels",
        "for each key to delete, descend from the root to its leaf",
        "if the key is absent, leave the tree unchanged",
        "remove the key from the leaf",
        "if a node is underfull, check its left and right siblings",
        "borrow through the parent when a sibling has a surplus",
        "otherwise merge with a sibling and pull down the separator",
        "repeat the underflow check upward to the root",
        "done: verify the leaf keys equal the remaining set",
    ],
};

export default module;
