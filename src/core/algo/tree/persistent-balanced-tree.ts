/**
 * persistent-balanced-tree.ts - Persistent AVL tree with path copying.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Each insertion of a key produces a new version of the tree. Only the nodes
 * on the root-to-leaf path and the nodes touched by rotations are reallocated;
 * every other subtree is shared with the previous version. Because the tree
 * is an AVL tree, each version keeps its logarithmic height while old roots
 * remain valid and answer queries forever.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) per insertion or search
 *   Space: O(log n) new nodes per insertion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show their key and are linked by parent-child edges.
 *   - Nodes newly allocated in the active version are highlighted.
 *   - The final frame reports the queried key's presence in the latest version.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface PNode {
    key: number;
    left: number;
    right: number;
    height: number;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; queryVersion?: number; query?: number } | null) ?? {};
    const keys = task.keys ?? [5, 3, 8, 1, 4, 7, 9];
    const queryVersion = Math.max(0, Math.min(keys.length, task.queryVersion ?? keys.length));
    const query = task.query ?? 4;

    const nodes: PNode[] = [];
    const roots: number[] = [];
    const heightOf = (id: number): number => (id < 0 ? 0 : nodes[id]?.height ?? 0);
    const alloc = (key: number, left: number, right: number): number => {
        const node: PNode = { key, left, right, height: 1 + Math.max(heightOf(left), heightOf(right)) };
        nodes.push(node);
        return nodes.length - 1;
    };
    const rotateRight = (y: number): number => {
        const yn = nodes[y] as PNode;
        const x = yn.left;
        const xn = nodes[x] as PNode;
        return alloc(xn.key, xn.left, alloc(yn.key, xn.right, yn.right));
    };
    const rotateLeft = (x: number): number => {
        const xn = nodes[x] as PNode;
        const y = xn.right;
        const yn = nodes[y] as PNode;
        return alloc(yn.key, alloc(xn.key, xn.left, yn.left), yn.right);
    };
    const rebalance = (id: number): number => {
        const n = nodes[id] as PNode;
        const balance = heightOf(n.left) - heightOf(n.right);
        if (balance > 1) {
            const left = nodes[n.left] as PNode;
            if (heightOf(left.left) - heightOf(left.right) >= 0) return rotateRight(id);
            return rotateRight(alloc(n.key, rotateLeft(n.left), n.right));
        }
        if (balance < -1) {
            const right = nodes[n.right] as PNode;
            if (heightOf(right.right) - heightOf(right.left) >= 0) return rotateLeft(id);
            return rotateLeft(alloc(n.key, n.left, rotateRight(n.right)));
        }
        return id;
    };
    const insert = (root: number, key: number): number => {
        if (root < 0) return alloc(key, -1, -1);
        const n = nodes[root] as PNode;
        if (key === n.key) return root;
        if (key < n.key) return rebalance(alloc(n.key, insert(n.left, key), n.right));
        return rebalance(alloc(n.key, n.left, insert(n.right, key)));
    };
    const search = (root: number, key: number): boolean => {
        let current = root;
        while (current >= 0) {
            const n = nodes[current] as PNode;
            if (n.key === key) return true;
            current = key < n.key ? n.left : n.right;
        }
        return false;
    };
    const inorder = (root: number): number[] => {
        const result: number[] = [];
        const walk = (id: number): void => {
            if (id < 0) return;
            const n = nodes[id] as PNode;
            walk(n.left);
            result.push(n.key);
            walk(n.right);
        };
        walk(root);
        return result;
    };
    const frameFor = (root: number, step: number, description: string, codeLine: number, highlight: Set<number>, found: boolean | null, version: number): VisualFrame => {
        const parentOf = new Map<number, number>();
        const order: number[] = [];
        const queue: number[] = root < 0 ? [] : [root];
        while (queue.length > 0) {
            const id = queue.shift();
            if (id === undefined) continue;
            order.push(id);
            const n = nodes[id] as PNode;
            if (n.left >= 0) { parentOf.set(n.left, id); queue.push(n.left); }
            if (n.right >= 0) { parentOf.set(n.right, id); queue.push(n.right); }
        }
        const entities: VisualEntity[] = order.map((id) => {
            const n = nodes[id] as PNode;
            return {
                id: `node-${id}`,
                type: "node" as const,
                label: `${n.key}`,
                value: n.key,
                state: (highlight.has(id) ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: parentOf.has(id) ? `node-${parentOf.get(id)}` : "root", key: n.key },
            };
        });
        const edges: VisualEdge[] = order.flatMap((id) => {
            const n = nodes[id] as PNode;
            const links: VisualEdge[] = [];
            if (n.left >= 0) links.push({ id: `edge-${id}-${n.left}`, sourceId: `node-${id}`, targetId: `node-${n.left}`, label: "", state: "idle", directed: true });
            if (n.right >= 0) links.push({ id: `edge-${id}-${n.right}`, sourceId: `node-${id}`, targetId: `node-${n.right}`, label: "", state: "idle", directed: true });
            return links;
        });
        const structure = order.map((id) => {
            const n = nodes[id] as PNode;
            return { id, key: n.key, left: n.left, right: n.right, height: n.height };
        });
        return {
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: codeLine,
            layout: "tree",
            meta: {
                version,
                root,
                found: found === null ? "pending" : found,
                keys: inorder(root),
                height: heightOf(root),
                structure,
            },
        };
    };

    let step = 0;
    roots.push(-1);
    yield frameFor(-1, step++, "An empty persistent tree: version 0 has no nodes.", 0, new Set(), null, 0);

    let previousRoot = -1;
    for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i] as number;
        const before = nodes.length;
        const nextRoot = insert(previousRoot, key);
        const created = new Set<number>();
        for (let id = before; id < nodes.length; id += 1) created.add(id);
        roots.push(nextRoot);
        const isNew = nextRoot !== previousRoot || nodes.length !== before;
        yield frameFor(
            nextRoot,
            step++,
            `Version ${i + 1}: inserted ${key}${isNew ? ", copying the affected path" : " (already present)"}; height is ${heightOf(nextRoot)}.`,
            isNew ? 3 : 2,
            created,
            null,
            i + 1,
        );
        previousRoot = nextRoot;
    }

    const selectedRoot = roots[Math.min(queryVersion, roots.length - 1)] ?? -1;
    const found = search(selectedRoot, query);
    yield frameFor(
        selectedRoot,
        step,
        `Version ${queryVersion}: search for ${query} ${found ? "succeeded" : "failed"}; the tree height is ${heightOf(selectedRoot)}.`,
        7,
        new Set(),
        found,
        queryVersion,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A persistent tree never overwrites a node. Updating a version copies only the nodes on the changed path and reuses the untouched subtrees, so every earlier version stays available. Keeping the tree balanced guarantees that each copy costs only logarithmically many new nodes.",
        invariants: [
            "Every version root points to a fully balanced AVL tree of the keys inserted up to that version.",
            "Nodes shared between versions are never mutated after creation.",
            "The height stored at each node equals one plus the larger child height.",
        ],
        correctness:
            "Insertion rebuilds the search path with fresh nodes and applies AVL rotations whenever a balance factor leaves the range minus one to plus one, restoring the height invariant. Since old nodes are immutable, earlier roots still describe their original trees. An in-order walk of a version returns its keys in sorted order, and the search follows the same comparison rule as insertion, so it reports membership correctly.",
        complexityRationale:
            "An AVL tree has height O(log n); insertion copies one node per level plus a constant number per rotation, so O(log n) new nodes and O(log n) time per version. Search uses O(log n) time and no new storage.",
        uses: [
            "Functional and purely functional data structures",
            "Persistent snapshots in versioned databases and file systems",
            "Undo and branching histories in editors",
        ],
        references: [
            "Okasaki, Purely Functional Data Structures, chapter 3",
            "Adelson-Velskii and Landis, An Algorithm for the Organization of Information, 1962",
        ],
        workedExample:
            "Inserting 5, then 3, then 8 creates version 1 with root 5, then version 2 with root 5 and a left child 3, then version 3 with root 5 and both children. Inserting 1 unbalances the left subtree and triggers a right rotation; only the path through 5, 3 and the new node is copied into version 4.",
    },
    id: "persistent-balanced-tree",
    name: "Persistent Balanced Tree",
    category: "tree",
    complexity: { time: "O(log n) per update", space: "O(log n) per version" },
    defaultInput: { keys: [5, 3, 8, 1, 4, 7, 9], queryVersion: 7, query: 4 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with an empty version zero",
        "for each key to insert into the latest version",
        "copy the path from the root down to the insertion point",
        "insert the new key at the empty child",
        "on return, recompute heights and rotate if unbalanced",
        "save the new root as the next version",
        "choose a version and search it for the query key",
        "report whether the query was found",
    ],
};

export default module;
