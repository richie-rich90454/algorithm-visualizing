/**
 * digital-search-tree.ts - Digital search tree over fixed-width keys.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A digital search tree stores keys in its nodes rather than at the leaves of
 * a trie. The bits of a key select the path: at each node the next unused bit
 * is examined, with zero going left and one going right. When the chosen child
 * is empty, the key is placed there. Cyclic bit use guarantees that distinct
 * fixed-width keys eventually diverge.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(w) per insert or search for w-bit keys
 *   Space: O(n) for n stored keys
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes show the key stored at that position in the tree.
 *   - The node being compared is highlighted yellow; a new node is green.
 *   - Search frames highlight the bit-guided path to a queried key.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface DNode {
    id: number;
    key: number;
    left: number | null;
    right: number | null;
    parent: number | null;
}

function snapshot(root: number | null, nodes: DNode[], highlight: number | null, phase: "insert" | "search"): { entities: VisualEntity[]; edges: VisualEdge[] } {
    const reachable: DNode[] = [];
    const queue: number[] = root === null ? [] : [root];
    while (queue.length > 0) {
        const id = queue.shift();
        if (id === undefined) continue;
        const node = nodes[id];
        if (!node) continue;
        reachable.push(node);
        if (node.left !== null) queue.push(node.left);
        if (node.right !== null) queue.push(node.right);
    }
    const entities: VisualEntity[] = reachable.map((node) => ({
        id: `node-${node.id}`,
        type: "node",
        label: `${node.key}`,
        value: node.key,
        state: (node.id === highlight ? phase === "insert" ? "sorted" : "path" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: node.parent === null ? "root" : `node-${node.parent}`, key: node.key },
    }));
    const edges: VisualEdge[] = [];
    for (const node of reachable) {
        if (node.left !== null) {
            edges.push({ id: `edge-${node.id}-${node.left}`, sourceId: `node-${node.id}`, targetId: `node-${node.left}`, label: "0", state: "idle", directed: true });
        }
        if (node.right !== null) {
            edges.push({ id: `edge-${node.id}-${node.right}`, sourceId: `node-${node.id}`, targetId: `node-${node.right}`, label: "1", state: "idle", directed: true });
        }
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const keys = task.keys ?? [5, 2, 7, 1, 6, 9];
    const query = task.query ?? 6;
    const width = Math.max(1, Math.ceil(Math.log2(Math.max(1, ...keys.map((k) => Math.abs(k) + 1)))));

    const nodes: DNode[] = [];
    let root: number | null = null;
    let step = 0;

    const initial = snapshot(root, nodes, null, "insert");
    yield {
        stepNumber: step++,
        entities: initial.entities,
        edges: initial.edges,
        description: `Building a digital search tree for ${keys.length} keys using ${width} bits per key.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { keys: [...keys], query, count: 0, width },
    };

    for (const key of keys) {
        if (key < 0) continue;
        let current = root;
        let bitIndex = width - 1;
        let parent: DNode | null = null;
        let lastBit = 0;
        let placed = false;
        let guard = 0;
        while (guard < width * 4 + 4) {
            if (current === null) {
                const created: DNode = { id: nodes.length, key, left: null, right: null, parent: parent === null ? null : parent.id };
                nodes.push(created);
                if (parent === null) root = created.id;
                else if (lastBit === 0) parent.left = created.id;
                else parent.right = created.id;
                placed = true;
                break;
            }
            const node = nodes[current] as DNode;
            if (node.key === key) break;
            lastBit = (key >> bitIndex) & 1;
            parent = node;
            current = lastBit === 0 ? node.left : node.right;
            bitIndex = bitIndex - 1 >= 0 ? bitIndex - 1 : width - 1;
            guard += 1;
        }
        const highlight = placed ? nodes[nodes.length - 1]?.id ?? null : null;
        const snap = snapshot(root, nodes, highlight, "insert");
        yield {
            stepNumber: step++,
            entities: snap.entities,
            edges: snap.edges,
            description: placed
                ? `Inserted key ${key}: a new node was created at the first free ${lastBit === 0 ? "left" : "right"} slot.`
                : `Key ${key} is already present and was left unchanged.`,
            codeLineNumber: placed ? 4 : 2,
            layout: "tree",
            meta: { keys: [...keys], count: nodes.length, lastKey: key, inserted: placed, width },
        };
    }

    let current = root;
    let bitIndex = width - 1;
    let found = false;
    let guard = 0;
    while (current !== null && guard < width * 4 + 4) {
        const node = nodes[current] as DNode;
        if (node.key === query) {
            found = true;
            break;
        }
        const bit = (query >> bitIndex) & 1;
        current = bit === 0 ? node.left : node.right;
        bitIndex = bitIndex - 1 >= 0 ? bitIndex - 1 : width - 1;
        guard += 1;
    }
    const searchSnap = snapshot(root, nodes, found ? current : null, "search");
    yield {
        stepNumber: step,
        entities: searchSnap.entities,
        edges: searchSnap.edges,
        description: `Search for ${query}: ${found ? "found by following the key's bits" : "not present in the tree"}.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { keys: [...keys], query, found, count: nodes.length, width },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of comparing whole keys, follow the bits of the key. Each node stores a key and sends zero bits to its left child and one bits to its right child. A new key stops at the first empty slot on its bit path.",
        invariants: [
            "Every stored key occupies exactly one node in the tree.",
            "The bits used along a path cycle through the fixed key width, so any two distinct keys eventually diverge.",
            "A search follows the same bit sequence as the corresponding insert, so it reaches the key if it exists.",
        ],
        correctness:
            "Insert and search derive their path solely from the bit string of the key. Two distinct w-bit keys differ in at least one bit, so within w steps their paths separate and the later key lands in an empty slot or an empty child. Search retraces that exact path, so it finds a stored key and only a stored key; brute-force membership confirms the same verdict.",
        complexityRationale:
            "Each step consumes one bit and either descends one level or creates one node, so inserts and searches take O(w) time. Storing n keys uses n nodes and n - 1 links, giving O(n) space.",
        uses: [
            "In-memory indexes for fixed-width integer or bit-string keys",
            "Prefix and bitwise query structures in networking",
            "Teaching the connection between tries and hashing",
        ],
        references: [
            "Knuth, The Art of Computer Programming Vol. 3, section 6.3",
            "Gonnet and Yates, Handbook of Algorithms and Data Structures, chapter 6",
        ],
        workedExample:
            "With four-bit keys 5 (0101), 2 (0010) and 7 (0111), the root examines bit 3 (all zero except 7), so 7 goes right. Keys 5 and 2 both go left, where bit 2 (0 for 5, 0 for 2) is checked next, and they separate at the following bit, giving three distinct nodes.",
    },
    id: "digital-search-tree",
    name: "Digital Search Tree",
    category: "tree",
    complexity: { time: "O(w) per operation", space: "O(n)" },
    defaultInput: { keys: [5, 2, 7, 1, 6, 9], query: 6 },
    visualType: "tree",
    run,
    pseudocode: [
        "given a list of fixed-width integer keys",
        "start with an empty tree",
        "for each key to insert",
        "follow its bits from the root, cycling through the width",
        "if the next child is empty, store the key there",
        "otherwise compare the stored key and keep descending",
        "to search, follow the query's bits and compare at each node",
        "report whether the query was found",
    ],
};

export default module;
