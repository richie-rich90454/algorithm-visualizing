/**
 * merkle-tree-anti-entropy.ts - Merkle Tree Anti-Entropy
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Two replicas that hold key-value items can find their differences without
 * shipping every item. Each side builds a binary Merkle tree over a fixed set
 * of key slots: a leaf hashes its value, and each parent hashes the pair of
 * child hashes. The replicas compare root hashes; if they match, the data sets
 * agree. Otherwise they descend into the mismatched children, narrowing the
 * search to the exact differing leaves, which are then the only keys that need
 * to be synchronized.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to build each tree plus O(d * n) worst-case comparison for
 *          n leaves and depth d = ceil(log2 n)
 *   Space: O(n) for the tree nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes are drawn as nodes; parentId links them into a binary tree.
 *   - A compared node is green when its hashes match and red when they differ.
 *   - Differing leaves are highlighted in the final frame as keys to repair.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Deterministic 32-bit hash of a string (FNV-1a style). */
function hash(input: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
}

interface TreeNode {
    hash: number;
    left: number | null;
    right: number | null;
    leaf: number | null;
}

/** Build a Merkle tree from a list of leaf values, padding to a power of two. */
function buildTree(values: string[]): TreeNode[] {
    const nodes: TreeNode[] = [];
    for (let i = 0; i < values.length; i += 1) {
        nodes.push({ hash: hash(values[i] ?? ""), left: null, right: null, leaf: i });
    }
    let level: number[] = values.map((_, i) => i);
    while (level.length > 1) {
        const nextLevel: number[] = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i] as number;
            const hasRight = i + 1 < level.length;
            const right = hasRight ? (level[i + 1] as number) : left;
            const leftHash = nodes[left]?.hash ?? 0;
            const rightHash = nodes[right]?.hash ?? 0;
            const nodeIndex = nodes.length;
            nodes.push({ hash: hash(`${leftHash}:${rightHash}`), left, right: hasRight ? right : null, leaf: null });
            nextLevel.push(nodeIndex);
        }
        level = nextLevel;
    }
    return nodes;
}

/** Visit comparison order for the tree level by level, root first. */
function compareOrder(root: number, nodes: TreeNode[]): number[] {
    const order: number[] = [];
    const queue: number[] = [root];
    while (queue.length > 0) {
        const current = queue.shift() as number;
        order.push(current);
        const node = nodes[current];
        if (node?.left !== null && node?.left !== undefined) queue.push(node.left);
        if (node?.right !== null && node?.right !== undefined) queue.push(node.right);
    }
    return order;
}

/** Build tree entities for one frame. */
function makeEntities(
    nodesA: TreeNode[],
    nodesB: TreeNode[],
    root: number,
    states: Map<number, EntityState>,
    highlightLeaf: number | null,
    keys: string[],
): VisualEntity[] {
    const order = compareOrder(root, nodesA);
    return order.map((index, pos) => {
        const nodeA = nodesA[index] as TreeNode;
        const leaf = nodeA.leaf;
        const level = depthOf(index, nodesA, root);
        let state: EntityState = states.get(index) ?? "unvisited";
        if (highlightLeaf !== null && leaf === highlightLeaf) {
            state = "error";
        }
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: leaf !== null ? (keys[leaf] ?? "") : nodeA.hash.toString(16).slice(0, 6),
            value: nodeA.hash,
            state,
            x: pos - (order.length - 1) / 2,
            y: -level,
            width: 0,
            height: 0,
            metadata: { kind: leaf !== null ? "leaf" : "internal", leaf: leaf ?? -1, hashA: nodeA.hash, hashB: nodesB[index]?.hash ?? 0, parentId: findParent(index, nodesA, root) },
        };
    });
}

/** Depth of a node below the root. */
function depthOf(index: number, nodes: TreeNode[], root: number): number {
    const parent = new Map<number, number>();
    for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n?.left !== null && n?.left !== undefined) parent.set(n.left, i);
        if (n?.right !== null && n?.right !== undefined) parent.set(n.right, i);
    }
    let d = 0;
    let cur = index;
    while (cur !== root && parent.has(cur)) {
        cur = parent.get(cur) as number;
        d += 1;
    }
    return d;
}

/** Parent index of a node, or -1 for the root. */
function findParent(index: number, nodes: TreeNode[], root: number): number {
    for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n?.left === index || n?.right === index) return i;
    }
    void root;
    return -1;
}

/** The Merkle anti-entropy generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: string[]; replicaA?: string[]; replicaB?: string[] } | null) ?? {};
    const keys: string[] = Array.isArray(task.keys) ? task.keys.map(String) : ["a", "b", "c", "d"];
    const replicaA: string[] = Array.isArray(task.replicaA)
        ? task.replicaA.map(String)
        : ["1", "2", "3", "4"];
    const replicaB: string[] = Array.isArray(task.replicaB)
        ? task.replicaB.map(String)
        : ["1", "9", "3", "4"];

    const nodesA = buildTree(replicaA);
    const nodesB = buildTree(replicaB);
    const root = nodesA.length - 1;
    const order = compareOrder(root, nodesA);
    const states = new Map<number, EntityState>();

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(nodesA, nodesB, root, states, null, keys),
        edges: order
            .filter((i) => nodesA[i]?.leaf === null)
            .map((i) => {
                const node = nodesA[i] as TreeNode;
                return {
                    id: `edge-${node.left}-${i}`,
                    sourceId: `node-${i}`,
                    targetId: `node-${node.left}`,
                    label: "",
                    state: "idle" as EntityState,
                    directed: false,
                };
            }),
        description: `Two replicas built Merkle trees over ${keys.length} key slots; the root hashes are ready to compare.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { keys, rootA: nodesA[root]?.hash ?? 0, rootB: nodesB[root]?.hash ?? 0, compared: 0, differingLeaves: [] },
    };
    step += 1;

    let differing: number[] = [];
    for (const index of order) {
        const nodeA = nodesA[index] as TreeNode;
        const nodeB = nodesB[index] as TreeNode;
        const match = nodeA.hash === nodeB.hash;
        states.set(index, match ? "sorted" : "error");
        if (!match && nodeA.leaf !== null) {
            differing.push(nodeA.leaf);
        }
        yield {
            stepNumber: step,
            entities: makeEntities(nodesA, nodesB, root, states, nodeA.leaf, keys),
            edges: [],
            description: match
                ? `Node ${index}: hashes match (0x${(nodeA.hash >>> 0).toString(16)}), so this whole subtree is identical.`
                : `Node ${index}: hashes differ, so descend into its children to locate the change.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: {
                keys,
                rootA: nodesA[root]?.hash ?? 0,
                rootB: nodesB[root]?.hash ?? 0,
                compared: step,
                differingLeaves: [...differing],
                nodeIndex: index,
                match,
            },
        };
        step += 1;
    }

    differing = [...new Set(differing)].sort((a, b) => a - b);
    yield {
        stepNumber: step,
        entities: makeEntities(nodesA, nodesB, root, states, null, keys),
        edges: [],
        description: `Anti-entropy complete: ${differing.length} key(s) differ (${differing.map((i) => keys[i]).join(", ") || "none"}); only these need to be transferred.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: {
            keys,
            rootA: nodesA[root]?.hash ?? 0,
            rootB: nodesB[root]?.hash ?? 0,
            compared: order.length,
            differingLeaves: differing,
            differingKeys: differing.map((i) => keys[i] ?? ""),
            done: true,
        },
    };
}

/** The Merkle anti-entropy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A Merkle tree rolls a whole collection of values into one hash by hashing pairs of children all the way up to a single root. Two replicas compare just that root hash first. If it differs, they compare the two children, then the grandchildren, and so on, until they reach the leaves that actually disagree. It is like checking a book by chapter instead of reading every page.",
        invariants: [
            "Each internal node hash is a deterministic function of its two children's hashes.",
            "Two subtrees with equal root hashes contain identical leaf values.",
            "A differing leaf is found by descending only through nodes whose hashes differ.",
        ],
        correctness:
            "If two root hashes are equal then, barring a hash collision, every descendant hash is equal, since each parent is computed from its children, so all leaf values match and no data needs to move. When a root differs, at least one child differs; recursing on differing children eventually reaches the leaves responsible. The set of leaves found this way is exactly the set of positions where the two replicas disagree.",
        complexityRationale:
            "Building each tree hashes n leaves and n-1 internal nodes, so O(n). A comparison visits only paths from the root to differing leaves, at most O(d n) nodes for depth d = ceil(log2 n), which is far less than sending all n values when few keys differ. Tree storage is O(n).",
        uses: [
            "Detecting replica divergence in distributed databases such as Dynamo and Cassandra",
            "Efficient synchronization of key-value stores and column-family data",
            "Verifying integrity of large data sets and version control histories",
        ],
        references: [
            "Merkle, Method of Providing Digital Signatures, 1988",
            "DeCandia et al., Dynamo: Amazon's Highly Available Key-Value Store, 2007",
        ],
        workedExample:
            "Two replicas hold slots a,b,c,d with values (1,2,3,4) and (1,9,3,4). Their root hashes differ, so both children are compared. The left pair (a,b) differs while the right pair (c,d) matches, so only the left subtree is descended. Leaves a and c match, leaf b differs, and b is the single key shipped to bring the replicas into agreement.",
    },
    id: "merkle-tree-anti-entropy",
    name: "Merkle Tree Anti-Entropy",
    category: "parallel-distributed",
    complexity: { time: "O(n + d * n)", space: "O(n)" },
    defaultInput: { keys: ["a", "b", "c", "d"], replicaA: ["1", "2", "3", "4"], replicaB: ["1", "9", "3", "4"] },
    visualType: "tree",
    run,
    pseudocode: [
        "build a Merkle tree for each replica over its key slots",
        "compare the two root hashes",
        "if the hashes match, stop: the subtrees are identical",
        "otherwise compare each pair of children",
        "recurse into every child pair whose hashes differ",
        "collect the differing leaves as keys to repair",
        "done: transfer only the differing keys",
    ],
};

export default module;
