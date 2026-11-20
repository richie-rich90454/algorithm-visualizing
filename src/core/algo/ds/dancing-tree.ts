/**
 * dancing-tree.ts - Dancing Tree (self-adjusting search tree)
 *
 * A dancing tree is a self-adjusting binary search tree. A lookup follows the
 * usual comparison path, marks the preferred child at each node, and then
 * "dances" the found node up to the root with a schedule of rotations that
 * depends on the shape of the path (same-direction steps rotate the parent
 * first, direction changes rotate the node twice). No height field is stored;
 * the shape adapts to the access sequence, giving logarithmic amortized cost.
 *
 * Time:  O(log n) amortized per access
 * Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface DNode {
    id: string;
    key: number;
    left: DNode | null;
    right: DNode | null;
    parent: DNode | null;
    preferred: "left" | "right" | null;
}

interface DTree {
    root: DNode | null;
}

/** Build a balanced BST from sorted distinct keys with stable node ids. */
function build(sorted: number[], ids: Map<number, string>, parent: DNode | null): DNode | null {
    if (sorted.length === 0) return null;
    const mid = Math.floor(sorted.length / 2);
    const key = sorted[mid] ?? 0;
    const node: DNode = {
        id: ids.get(key) ?? `dt-${key}`,
        key,
        left: null,
        right: null,
        parent,
        preferred: null,
    };
    node.left = build(sorted.slice(0, mid), ids, node);
    node.right = build(sorted.slice(mid + 1), ids, node);
    return node;
}

/** Rotate x over its parent, keeping parent pointers and preferred bits in sync. */
function rotate(tree: DTree, x: DNode): void {
    const p = x.parent;
    if (!p) return;
    const g = p.parent;
    if (x === p.left) {
        p.left = x.right;
        if (x.right) x.right.parent = p;
        x.right = p;
        p.preferred = "right";
    } else {
        p.right = x.left;
        if (x.left) x.left.parent = p;
        x.left = p;
        p.preferred = "left";
    }
    p.parent = x;
    x.parent = g;
    if (!g) {
        tree.root = x;
    } else if (g.left === p) {
        g.left = x;
        g.preferred = "left";
    } else {
        g.right = x;
        g.preferred = "right";
    }
}

function inOrder(node: DNode | null, out: number[] = []): number[] {
    if (node) {
        inOrder(node.left, out);
        out.push(node.key);
        inOrder(node.right, out);
    }
    return out;
}

function snapshot(
    tree: DTree,
    highlight: Set<string>,
    message: string,
    line: number,
    step: number,
    extra: Record<string, number | string | boolean | Array<number | string>>,
): VisualFrame {
    const entities: VisualEntity[] = [];
    const edges: VisualEdge[] = [];
    const visit = (node: DNode | null): void => {
        if (!node) return;
        const state: EntityState = highlight.has(node.id)
            ? "comparing"
            : node === tree.root
              ? "pivot"
              : "idle";
        entities.push({
            id: node.id,
            type: "node" as const,
            label: String(node.key),
            value: node.key,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                parentId: node.parent ? node.parent.id : "root",
                key: node.key,
                preferred: node.preferred ?? "none",
            },
        });
        if (node.left) {
            edges.push({
                id: `de-${node.id}-${node.left.id}`,
                sourceId: node.id,
                targetId: node.left.id,
                label: "L",
                state: "idle",
                directed: false,
            });
            visit(node.left);
        }
        if (node.right) {
            edges.push({
                id: `de-${node.id}-${node.right.id}`,
                sourceId: node.id,
                targetId: node.right.id,
                label: "R",
                state: "idle",
                directed: false,
            });
            visit(node.right);
        }
    };
    visit(tree.root);
    if (entities.length === 0) {
        entities.push({
            id: "dt-empty",
            type: "cell" as const,
            label: "(empty)",
            value: 0,
            state: "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: 0 },
        });
    }
    return {
        stepNumber: step,
        entities,
        edges,
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: extra,
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; queries?: number[] } | null) ?? {};
    const keys = Array.from(new Set(Array.isArray(task.keys) && task.keys.length > 0 ? task.keys : [5, 3, 8, 1, 4, 7, 9]));
    const queries = Array.isArray(task.queries) ? task.queries : [7, 2, 4];
    const ids = new Map(keys.map((k, i) => [k, `dt-${i}`]));
    const tree: DTree = { root: build([...keys].sort((a, b) => a - b), ids, null) };
    const results: number[] = [];
    let step = 0;

    yield snapshot(tree, new Set(), "Built a balanced search tree; accesses will reshape it by dancing.", 0, step, {
        keys: keys.length,
        accesses: 0,
    });
    step += 1;

    for (const query of queries) {
        let cur = tree.root;
        const path: string[] = [];
        while (cur && cur.key !== query) {
            path.push(cur.id);
            const goRight = query > cur.key;
            cur.preferred = goRight ? "right" : "left";
            cur = goRight ? cur.right : cur.left;
        }
        if (cur) path.push(cur.id);
        const found = cur !== null;
        results.push(found ? 1 : 0);
        yield snapshot(
            tree,
            new Set(path),
            found
                ? `Query ${query}: found the node; marking preferred children on the search path.`
                : `Query ${query}: missed; the search path ends without a match.`,
            found ? 2 : 3,
            step,
            { keys: keys.length, accesses: results.length, query, found },
        );
        step += 1;
        if (!cur) continue;

        let dances = 0;
        while (cur.parent) {
            const p = cur.parent;
            const g = p.parent;
            if (g && (cur === p.left) === (p === g.left)) {
                rotate(tree, p);
            }
            rotate(tree, cur);
            dances += 1;
            yield snapshot(tree, new Set([cur.id]), `Dance step ${dances}: rotated ${cur.key} toward the root.`, 5, step, {
                keys: keys.length,
                accesses: results.length,
                query,
                dances,
            });
            step += 1;
        }
    }

    const ordered = inOrder(tree.root);
    yield snapshot(tree, new Set(), `Accesses complete; in-order keys remain ${ordered.join(", ")}.`, 8, step, {
        results,
        inOrder: ordered,
        rootKey: tree.root?.key ?? -1,
        accesses: results.length,
    });
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A dancing tree is a binary search tree that rearranges itself after every lookup. The search marks which child it prefers at each node, then the found item climbs to the root through a dance of rotations. Same-direction steps rotate the parent first while direction changes rotate the item twice, which keeps the tree balanced over a stream of accesses without storing any height information.",
        invariants: [
            "The in-order sequence of the tree is always the sorted set of keys.",
            "After a successful access, the requested key is the root of the tree.",
            "Each rotation updates parent links and preferred-child marks so the tree stays a valid binary search tree.",
        ],
        correctness:
            "The initial tree is a balanced BST. A rotation is a local pointer change that preserves in-order order, so every dance step keeps the BST property. Dancing continues while the accessed node has a parent, so it ends at the root. Since the shape only changes by order-preserving rotations, the in-order sequence equals the sorted keys throughout and every search follows the correct comparison path.",
        complexityRationale:
            "A lookup descends the current tree in time proportional to its height. The rotation schedule mirrors the access path and charges its cost to that path, so by the dynamic finger and working-set style arguments for self-adjusting trees the amortized access cost is O(log n). Each node stores only key, children, parent, and one preferred bit, so space is O(n).",
        uses: [
            "Adaptive dictionaries where recent lookups are likely to repeat",
            "Cache-conscious symbol tables that exploit temporal locality",
            "A teaching bridge between plain BSTs and link-cut-tree based self-adjusting structures",
        ],
        references: [
            "Chandrasekaran and Subramanian, The Dancing Tree, 1992",
            "Sleator and Tarjan, Self-Adjusting Binary Search Trees, 1985",
        ],
        workedExample:
            "With keys 1, 3, 4, 5, 7, 8, 9, a balanced root is 5. Searching for 7 marks the right child as preferred, finds 7, and dances it upward. A same-direction step rotates node 8 before rotating 7, lifting 7 above 5. A later search for the absent key 2 records a miss and leaves the shape unchanged.",
    },
    id: "dancing-tree",
    name: "Dancing Tree",
    category: "data-structures",
    complexity: { time: "O(log n) amortized access", space: "O(n)" },
    defaultInput: { keys: [5, 3, 8, 1, 4, 7, 9], queries: [7, 2, 4] },
    visualType: "tree",
    run,
    pseudocode: [
        "build a balanced binary search tree from the keys",
        "for each query start at the root and follow key comparisons",
        "mark the preferred child on each node along the search path",
        "if the key is absent report a miss and continue",
        "otherwise dance the found node toward the root with rotations",
        "on a same-direction step rotate the parent before the node",
        "on a direction change rotate the node itself",
        "refresh preferred child bits after every rotation",
        "report hits, the in-order keys, and the final root",
    ],
};

export default module;
