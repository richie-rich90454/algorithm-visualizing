/**
 * b-plus-tree-insert.ts - B+ Tree Insertion with Leaf Linking
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A B+ tree stores every value in its leaves and uses internal nodes only as
 * a routing index of separator keys. Insertion descends to the correct leaf,
 * adds the key in sorted order, and splits an overflowing node upward. The
 * first key of a split right leaf is promoted as a separator, and leaves are
 * chained with sibling pointers so range scans are a linear walk.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) descent plus O(order) work per split
 *   Space: O(n) for the nodes and leaf keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are drawn as a tree; internal labels are separator keys.
 *   - Solid edges are parent links; arrow edges chain the leaves.
 *   - The node touched by the current insert is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

type BPlusNode = {
    id: number;
    leaf: boolean;
    keys: number[];
    children: number[];
    next: number | null;
};

type Split = { promoted: number; rightId: number };

/** The B+ tree insertion module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; order?: number } | null) ?? {};
    const keys = Array.isArray(task.keys) ? task.keys.map(Number) : [10, 20, 5, 6, 12, 30, 7, 17, 3, 4];
    const order = typeof task.order === "number" ? Math.max(3, Math.floor(task.order)) : 4;
    const leafMax = order - 1;

    const nodes = new Map<number, BPlusNode>();
    let nextId = 1;
    const root: BPlusNode = { id: 0, leaf: true, keys: [], children: [], next: null };
    nodes.set(0, root);
    let rootId = 0;

    const minKey = (id: number): number => {
        const node = nodes.get(id) as BPlusNode;
        if (node.leaf) return node.keys[0] ?? Number.POSITIVE_INFINITY;
        return minKey(node.children[0] as number);
    };

    const insertKey = (nodeId: number, key: number): Split | null => {
        const node = nodes.get(nodeId) as BPlusNode;
        if (node.leaf) {
            if (node.keys.includes(key)) return null;
            node.keys.push(key);
            node.keys.sort((a, b) => a - b);
            if (node.keys.length > leafMax) {
                const mid = Math.ceil(node.keys.length / 2);
                const rightKeys = node.keys.slice(mid);
                node.keys = node.keys.slice(0, mid);
                const rightId = nextId;
                nextId += 1;
                nodes.set(rightId, {
                    id: rightId,
                    leaf: true,
                    keys: rightKeys,
                    children: [],
                    next: node.next,
                });
                node.next = rightId;
                return { promoted: rightKeys[0] as number, rightId };
            }
            return null;
        }
        let index = 0;
        while (index < node.keys.length && key >= (node.keys[index] as number)) index += 1;
        const childId = node.children[index] as number;
        const result = insertKey(childId, key);
        if (!result) return null;
        node.keys.splice(index, 0, result.promoted);
        node.children.splice(index + 1, 0, result.rightId);
        if (node.children.length > order) {
            const mid = Math.floor(node.children.length / 2);
            const promoted = node.keys[mid - 1] as number;
            const rightId = nextId;
            nextId += 1;
            nodes.set(rightId, {
                id: rightId,
                leaf: false,
                keys: node.keys.slice(mid),
                children: node.children.slice(mid),
                next: null,
            });
            node.keys = node.keys.slice(0, mid - 1);
            node.children = node.children.slice(0, mid);
            return { promoted, rightId };
        }
        return null;
    };

    const emit = (
        stepNumber: number,
        highlight: Set<number>,
        description: string,
        codeLineNumber: number,
        lastKey: number | null,
        didSplit: boolean,
    ): VisualFrame => {
        const parentOf = new Map<number, number>();
        const depthOf = new Map<number, number>();
        const leafKeys: number[] = [];
        let valid = true;
        const visit = (id: number, parent: number, depth: number): void => {
            parentOf.set(id, parent);
            depthOf.set(id, depth);
            const node = nodes.get(id) as BPlusNode;
            if (node.leaf) {
                leafKeys.push(...node.keys);
            } else {
                for (let i = 0; i < node.children.length; i += 1) {
                    const child = node.children[i] as number;
                    if (i > 0 && (node.keys[i - 1] as number) !== minKey(child)) valid = false;
                    visit(child, id, depth + 1);
                }
            }
        };
        visit(rootId, -1, 0);

        const entities: VisualEntity[] = [...nodes.keys()]
            .sort((a, b) => a - b)
            .map((id) => {
                const node = nodes.get(id) as BPlusNode;
                const parent = parentOf.get(id) ?? -1;
                return {
                    id: `node-${id}`,
                    type: "node" as const,
                    label: node.keys.length > 0 ? node.keys.join(",") : "empty",
                    value: node.keys.slice(),
                    state: (highlight.has(id) ? "active" : node.leaf ? "visited" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: {
                        parentId: parent < 0 ? "root" : `node-${parent}`,
                        keys: node.keys.join(","),
                        leaf: node.leaf,
                        depth: depthOf.get(id) ?? 0,
                        next: node.next === null ? "none" : `node-${node.next}`,
                    },
                };
            });

        const edges: VisualEdge[] = [];
        for (const [id, parent] of parentOf) {
            if (parent >= 0) {
                edges.push({
                    id: `edge-${parent}-${id}`,
                    sourceId: `node-${parent}`,
                    targetId: `node-${id}`,
                    label: "",
                    state: "idle" as EntityState,
                    directed: false,
                });
            }
        }
        for (const node of nodes.values()) {
            if (node.leaf && node.next !== null) {
                edges.push({
                    id: `next-${node.id}-${node.next}`,
                    sourceId: `node-${node.id}`,
                    targetId: `node-${node.next}`,
                    label: "next",
                    state: "path" as EntityState,
                    directed: true,
                });
            }
        }

        const leafDepths = [...nodes.values()]
            .filter((n) => n.leaf)
            .map((n) => depthOf.get(n.id) as number);
        return {
            stepNumber,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "tree",
            meta: {
                order,
                nodeCount: nodes.size,
                height: Math.max(...depthOf.values()),
                inserted: lastKey ?? -1,
                split: didSplit,
                leafKeys,
                leafDepths,
                valid,
            },
        };
    };

    yield emit(0, new Set([0]), "Start with a single empty root leaf.", 0, null, false);
    let step = 1;
    for (const key of keys) {
        const before = new Set(nodes.keys());
        const result = insertKey(rootId, key);
        const highlight = new Set<number>();
        if (result) {
            const newRootId = nextId;
            nextId += 1;
            nodes.set(newRootId, {
                id: newRootId,
                leaf: false,
                keys: [result.promoted],
                children: [rootId, result.rightId],
                next: null,
            });
            rootId = newRootId;
            highlight.add(rootId);
            highlight.add(result.rightId);
        }
        for (const id of before) {
            const node = nodes.get(id) as BPlusNode;
            if (node.keys.includes(key)) highlight.add(id);
        }
        yield emit(
            step,
            highlight,
            `Insert ${key}${result ? " - a node split and promoted its first right key" : ""}; ${nodes.size} node(s) now hold ${[...nodes.values()].filter((n) => n.leaf).reduce((sum, n) => sum + n.keys.length, 0)} key(s) in the leaves.`,
            result ? 6 : 4,
            key,
            Boolean(result),
        );
        step += 1;
    }
    yield emit(step, new Set(), `Insertion complete: ${new Set(keys).size} distinct key(s) stored in linked, balanced leaves.`, 9, null, false);
}

/** The B+ tree insertion module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A B+ tree keeps all values in its leaves and turns its internal nodes into a routing table of separator keys. To insert, descend to the one leaf whose range contains the key and add it in sorted order. When a node fills past its capacity, split it in two and promote the first key of the new right node, leaving every leaf at the same depth.",
        invariants: [
            "Every value lives in a leaf, and the leaves are chained left to right.",
            "Each separator in an internal node equals the smallest key in the child immediately to its right.",
            "All leaves stay at the same depth.",
        ],
        correctness:
            "Descent follows the unique separator interval containing the key, so it reaches the only leaf that can hold it. Splitting a leaf at its midpoint promotes the smallest key of the right half, which is exactly the boundary between the two halves, so routing remains correct. Inserting that separator into the parent preserves the separator invariant, and an internal split repeats the same argument one level up. Growing a new root adds one level to every leaf at once, so balance is never broken.",
        complexityRationale:
            "A descent visits one node per level, which is O(log n) because the tree is balanced. A split copies at most O(order) keys and pointers, so the total per insert is O(log n + order) with a constant factor of order in practice. The nodes and their key arrays use O(n) space.",
        uses: [
            "Database indexes that need fast point and range queries",
            "Filesystems that store directory entries in a B+ tree",
            "Key-value stores whose scans follow the linked leaves",
        ],
        references: [
            "Bayer and McCreight, Organization and Maintenance of Large Ordered Indexes, 1972",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 18",
        ],
        workedExample:
            "With order four a leaf holds at most three keys. Inserting 10, 20, 5 fills the root leaf; inserting 6 sorts it to [5, 6, 10, 20], which overflows. Splitting gives left [5, 6] and right [10, 20]; promoting 10 creates a root whose children are those two linked leaves.",
    },
    id: "b-plus-tree-insert",
    name: "B+ Tree Insertion",
    category: "production-systems",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [10, 20, 5, 6, 12, 30, 7, 17, 3, 4], order: 4 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with a single empty root leaf",
        "for each key to insert",
        "descend to the leaf by comparing with separators",
        "if the key already exists, stop",
        "insert the key in sorted order in the leaf",
        "if the leaf overflows, split it and promote its first right key",
        "insert the promoted key and new child into the parent",
        "if the parent overflows, split it and continue upward",
        "if the root splits, create a new root and grow the tree",
        "done: report the balanced tree and linked leaf keys",
    ],
};

export default module;
