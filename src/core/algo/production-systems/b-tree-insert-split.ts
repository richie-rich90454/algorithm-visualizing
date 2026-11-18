/**
 * b-tree-insert-split.ts - B-Tree Insertion with Node Splitting
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A B-tree keeps keys sorted inside nodes and maintains balance by allowing
 * nodes to hold several keys. Insertion descends to a leaf and adds the key;
 * when a node overflows its maximum it splits around the median key, promoting
 * that median to the parent and dividing the remaining keys and children into
 * two nodes. If the root splits, a new root is created and the tree grows one
 * level, keeping every leaf at the same depth.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log n) search plus O(order) work to split each overflowing node
 *   Space: O(n) for all nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each B-tree node is a circle labeled with its keys.
 *   - Edges connect a parent to its children; the node just changed is yellow.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type BNode = { id: number; keys: number[]; children: number[]; leaf: boolean };
type Split = { promoted: number; rightId: number };

/** The B-tree module. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; order?: number } | null) ?? {};
    const keys = Array.isArray(task.keys) ? task.keys.map(Number) : [10, 20, 5, 6, 12, 30, 7, 17, 3, 4];
    const order = typeof task.order === "number" ? Math.max(3, Math.floor(task.order)) : 4;
    const maxKeys = order - 1;

    const nodes = new Map<number, BNode>();
    let nextId = 1;
    const root: BNode = { id: 0, keys: [], children: [], leaf: true };
    nodes.set(0, root);
    let rootId = 0;

    const split = (nodeId: number): Split => {
        const node = nodes.get(nodeId) as BNode;
        const mid = Math.floor(node.keys.length / 2);
        const promoted = node.keys[mid] as number;
        const rightId = nextId;
        nextId += 1;
        const rightKeys = node.keys.slice(mid + 1);
        const rightChildren = node.leaf ? [] : node.children.slice(mid + 1);
        node.keys = node.keys.slice(0, mid);
        if (!node.leaf) node.children = node.children.slice(0, mid + 1);
        nodes.set(rightId, { id: rightId, keys: rightKeys, children: rightChildren, leaf: node.leaf });
        return { promoted, rightId };
    };

    const insert = (nodeId: number, key: number): Split | null => {
        const node = nodes.get(nodeId) as BNode;
        if (node.leaf) {
            if (node.keys.includes(key)) return null;
            node.keys.push(key);
            node.keys.sort((a, b) => a - b);
            return node.keys.length > maxKeys ? split(nodeId) : null;
        }
        let index = 0;
        while (index < node.keys.length && key > (node.keys[index] as number)) index += 1;
        if (node.keys[index] === key) return null;
        const childId = node.children[index] as number;
        const result = insert(childId, key);
        if (!result) return null;
        node.keys.splice(index, 0, result.promoted);
        node.children.splice(index + 1, 0, result.rightId);
        return node.keys.length > maxKeys ? split(nodeId) : null;
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
        const visit = (id: number, parent: number, depth: number): void => {
            parentOf.set(id, parent);
            depthOf.set(id, depth);
            const node = nodes.get(id) as BNode;
            if (!node.leaf) {
                for (const child of node.children) visit(child, id, depth + 1);
            }
        };
        visit(rootId, -1, 0);

        const entities: VisualEntity[] = [...nodes.keys()]
            .sort((a, b) => a - b)
            .map((id) => {
                const node = nodes.get(id) as BNode;
                const parent = parentOf.get(id) ?? -1;
                return {
                    id: `node-${id}`,
                    type: "node" as const,
                    label: node.keys.length > 0 ? node.keys.join(",") : "empty",
                    value: node.keys.slice(),
                    state: (highlight.has(id) ? "comparing" : "visited") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: {
                        parentId: parent < 0 ? "root" : `node-${parent}`,
                        keys: node.keys.join(","),
                        leaf: node.leaf,
                        depth: depthOf.get(id) ?? 0,
                    },
                };
            });

        const edges = [...parentOf.entries()]
            .filter(([, parent]) => parent >= 0)
            .map(([id, parent]) => ({
                id: `edge-${parent}-${id}`,
                sourceId: `node-${parent}`,
                targetId: `node-${id}`,
                label: "",
                state: "idle" as EntityState,
                directed: false,
            }));

        const height = Math.max(...depthOf.values());
        return {
            stepNumber,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "tree",
            meta: {
                order,
                maxKeys,
                nodeCount: nodes.size,
                height,
                inserted: lastKey ?? -1,
                split: didSplit,
            },
        };
    };

    yield emit(0, new Set([rootId]), "Starting with an empty B-tree root.", 0, null, false);
    let step = 1;

    for (const key of keys) {
        const before = new Set(nodes.keys());
        const oldRoot = rootId;
        const result = insert(rootId, key);
        let splitOccurred = false;
        if (result) {
            splitOccurred = true;
            const newRootId = nextId;
            nextId += 1;
            nodes.set(newRootId, {
                id: newRootId,
                keys: [result.promoted],
                children: [rootId, result.rightId],
                leaf: false,
            });
            rootId = newRootId;
        }
        const highlight = new Set<number>([...before].filter((id) => nodes.has(id)));
        if (result) highlight.add(rootId);
        for (const id of nodes.keys()) {
            const node = nodes.get(id) as BNode;
            if (node.keys.includes(key)) highlight.add(id);
        }
        const grew = rootId !== oldRoot;
        yield emit(
            step,
            highlight,
            `Insert ${key}${grew ? " - the root split and the tree grew" : splitOccurred ? " - a node split and promoted its median" : ""}; root keys [${(nodes.get(rootId) as BNode).keys.join(", ")}].`,
            splitOccurred ? 4 : 2,
            key,
            splitOccurred,
        );
        step += 1;
    }

    yield emit(step, new Set(), `Insertion complete: ${nodes.size} node(s) hold the ${new Set(keys).size} distinct key(s) in a balanced tree.`, 6, null, false);
}

/** The B-tree insertion module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A B-tree is a balanced search tree whose nodes hold many keys, which keeps it shallow on disk. Insert a key into its leaf; if the leaf is full, split it into two and promote the middle key to the parent. Repeating this upward keeps all leaves at the same depth, and splitting the root is the only event that increases the tree's height.",
        invariants: [
            "Every node except the root holds between order/2 minus one and order minus one keys.",
            "Keys inside a node are sorted, and all keys in a child lie between the parent's separator keys.",
            "All leaves remain at the same depth.",
        ],
        correctness:
            "Insertion descends to the unique leaf whose key range contains the new key, so the search property is preserved. A full node has an odd or even count and splits at its median: the median is promoted as a valid separator because every left key is smaller and every right key is larger. Splitting a node adds one child to the parent and preserves its key ranges. If the root splits, the new root has one promoted key and two children, so every leaf gains exactly one level and balance is maintained.",
        complexityRationale:
            "Descending the tree visits O(log n) nodes, and each overflowing node costs O(order) work to copy half its keys and children. Only the nodes and their key arrays are stored, using O(n) space.",
        uses: [
            "Database indexes in systems such as PostgreSQL and MySQL",
            "Filesystem indexes including Btrfs and NTFS",
            "Ordered key-value stores that need efficient range queries",
        ],
        references: [
            "Bayer and McCreight, Organization and Maintenance of Large Ordered Indexes, 1972",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 18",
        ],
        workedExample:
            "In a order-four B-tree a node holds at most three keys. Inserting 10, 20, 5 fills the root; inserting 6 overflows it into [5, 6, 10] and splits around 6, promoting 6 to a new root with children [5] and [10]. All leaves now sit at depth one.",
    },
    id: "b-tree-insert-split",
    name: "B-Tree Insert and Split",
    category: "production-systems",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: { keys: [10, 20, 5, 6, 12, 30, 7, 17, 3, 4], order: 4 },
    visualType: "tree",
    run,
    pseudocode: [
        "start with a single empty root leaf",
        "for each key to insert",
        "descend to the leaf whose range contains the key",
        "insert the key in sorted order in that leaf",
        "if a node overflows, split at the median and promote it",
        "if the root overflows, create a new root",
        "done: report the balanced tree and node count",
    ],
};

export default module;
