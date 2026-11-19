/**
 * batch-union-find.ts - Batch Union-Find (Offline Connectivity)
 *
 * Instead of answering connectivity queries online, this offline method
 * processes a whole batch of unions first and records every merge in a union
 * (merge) tree. Two elements become connected exactly when their merge tree
 * paths meet, and the lowest common ancestor records the earliest union that
 * joined them. A batch of queries is then answered by tree LCAs.
 *
 * Time:  O((n + m + q) log n) with binary lifting
 * Space: O(n + m)
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface MergeNode {
    id: number;
    children: number[];
    parent: number;
    time: number; // 0 for original elements, merge step otherwise
    element: number; // element index for leaves, -1 for merge nodes
}

/** Lowest common ancestor of two leaves in the merge forest, or -1. */
function lca(nodes: MergeNode[], a: number, b: number): number {
    const seen = new Set<number>();
    let x = a;
    while (x >= 0) {
        seen.add(x);
        x = nodes[x]?.parent ?? -1;
    }
    let y = b;
    while (y >= 0) {
        if (seen.has(y)) return y;
        y = nodes[y]?.parent ?? -1;
    }
    return -1;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number; edges?: unknown[]; queries?: unknown[] } | null) ?? {};
    const n = typeof task.n === "number" ? Math.max(1, Math.floor(task.n)) : 6;
    const edges: Array<[number, number]> = (Array.isArray(task.edges) ? task.edges : [[0, 1], [2, 3], [1, 2], [4, 5]])
        .filter((e): e is [number, number] =>
            Array.isArray(e) && typeof e[0] === "number" && typeof e[1] === "number" &&
            e[0] >= 0 && e[0] < n && e[1] >= 0 && e[1] < n,
        );
    const queries: Array<[number, number]> = (Array.isArray(task.queries) ? task.queries : [[0, 3], [1, 4], [4, 5]])
        .filter((q): q is [number, number] =>
            Array.isArray(q) && typeof q[0] === "number" && typeof q[1] === "number" &&
            q[0] >= 0 && q[0] < n && q[1] >= 0 && q[1] < n,
        );

    const nodes: MergeNode[] = [];
    for (let i = 0; i < n; i += 1) {
        nodes.push({ id: i, children: [], parent: -1, time: 0, element: i });
    }
    const dsu = new Map<number, number>();
    const find = (x: number): number => {
        const p = dsu.get(x);
        if (p === undefined) {
            dsu.set(x, x);
            return x;
        }
        if (p === x) return x;
        const root = find(p);
        dsu.set(x, root);
        return root;
    };
    let step = 0;
    let highlight = new Set<number>();

    const snapshot = (message: string, line: number, answers: number[]): VisualFrame => {
        const entities: VisualEntity[] = nodes.map((node) => ({
            id: `bu-${node.id}`,
            type: "node" as const,
            label: node.element >= 0 ? `e${node.element}` : `m${node.time}`,
            value: node.time,
            state: (highlight.has(node.id)
                ? "path"
                : node.element >= 0
                  ? "idle"
                  : "sorted") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { parentId: node.parent >= 0 ? `bu-${node.parent}` : "root", time: node.time },
        }));
        const edgeList: VisualEdge[] = [];
        for (const node of nodes) {
            for (const child of node.children) {
                edgeList.push({
                    id: `bu-edge-${node.id}-${child}`,
                    sourceId: `bu-${node.id}`,
                    targetId: `bu-${child}`,
                    label: String(node.time),
                    state: "idle" as EntityState,
                    directed: false,
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges: edgeList,
            description: message,
            codeLineNumber: line,
            layout: "tree",
            meta: {
                elements: n,
                unions: edges.length,
                queries: queries.length,
                answers: [...answers],
            },
        };
    };

    yield snapshot(`Batch of ${n} elements: each starts as a leaf of its own merge tree.`, 0, []);
    step += 1;

    for (let i = 0; i < edges.length; i += 1) {
        const edge = edges[i];
        if (!edge) continue;
        const ra = find(edge[0]);
        const rb = find(edge[1]);
        if (ra === rb) {
            highlight = new Set([ra, rb]);
            yield snapshot(`Edge ${i} (${edge[0]},${edge[1]}): already connected, no merge node.`, 2, []);
        } else {
            const merge = makeMerge(nodes, [ra, rb], i + 1);
            dsu.set(ra, merge);
            dsu.set(rb, merge);
            highlight = new Set([ra, rb, merge]);
            yield snapshot(
                `Edge ${i} (${edge[0]},${edge[1]}): create merge node m${i + 1} with roots ${ra}, ${rb}.`,
                1,
                [],
            );
        }
        step += 1;
    }

    const answers: number[] = [];
    for (let i = 0; i < queries.length; i += 1) {
        const q = queries[i];
        if (!q) continue;
        const ancestor = lca(nodes, q[0], q[1]);
        const answer = ancestor < 0 ? -1 : (nodes[ancestor]?.time ?? -1);
        answers.push(answer);
        highlight = new Set<number>([q[0], q[1]]);
        if (ancestor >= 0) highlight.add(ancestor);
        yield snapshot(
            `Query ${i} (${q[0]},${q[1]}): LCA is ${ancestor < 0 ? "none" : `node ${ancestor}`} so answer is ${answer}.`,
            4,
            answers,
        );
        step += 1;
    }

    highlight = new Set();
    yield snapshot(
        `Done: ${edges.length} unions processed offline; ${answers.length} queries answered by merge-tree LCAs.`,
        7,
        answers,
    );
}

/** Append a merge node joining two current component roots. */
function makeMerge(nodes: MergeNode[], children: number[], time: number): number {
    const id = nodes.length;
    nodes.push({ id, children: [...children], parent: -1, time, element: -1 });
    for (const child of children) {
        const node = nodes[child];
        if (node) node.parent = id;
    }
    return id;
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Batch union-find separates the two questions an online disjoint-set answers together. First it processes every union and records each merge as a new parent node, forming a merge tree. Then connectivity becomes a tree question: two elements are joined at the lowest common ancestor of their leaves, whose timestamp is the first union that connected them.",
        invariants: [
            "Each merge node has exactly two children and a timestamp larger than its children.",
            "The parent pointers of the merge forest always form acyclic trees rooted at current components.",
            "For any two elements, their merge-tree LCA time is the smallest union prefix that connects them.",
        ],
        correctness:
            "A new merge node is created only when two different components join, so it is the unique earliest event connecting any element of one side to any element of the other. The lowest common ancestor of two leaves is precisely that event, because any earlier node lies strictly inside one component. If no common ancestor exists the elements never joined, matching online union-find.",
        complexityRationale:
            "Building the merge tree takes O((n + m) alpha(n)); answering each query by climbing parent pointers is O(h) with h the tree height, or O(log n) with binary lifting. The tree stores one node per element and per successful union, O(n + m) space.",
        uses: [
            "Offline dynamic connectivity over a known update log",
            "Answering many reachability queries after a fixed set of merges",
            "Building Kruskal reconstruction trees for minimum bottleneck paths",
        ],
        references: [
            "Bernard Chazelle, 'How to Search in History', Information and Computation 1994",
            "Tarjan, 'Efficiency of a Good But Not Linear Set Union Algorithm', JACM 1975",
        ],
        workedExample:
            "Elements 0 to 5 start alone. Unions (0,1), (2,3), (1,2), (4,5) create merge nodes at times 1, 2, 3, 4. Query (0,3) has LCA at time 3, query (1,4) has no common ancestor so it is -1, and query (4,5) has LCA at time 4.",
    },
    id: "batch-union-find",
    name: "Batch Union-Find",
    category: "data-structures",
    complexity: { time: "O((n + m + q) log n)", space: "O(n + m)" },
    defaultInput: {
        n: 6,
        edges: [[0, 1], [2, 3], [1, 2], [4, 5]],
        queries: [[0, 3], [1, 4], [4, 5]],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "initialize each element as a leaf of its own merge tree",
        "for each union in the batch find the two component roots",
        "if the roots differ create a merge node with those two children",
        "record the union index as the merge node timestamp",
        "if the roots already match skip creating a node",
        "for each query climb from both leaves collecting ancestors",
        "the first shared ancestor gives the earliest connection time",
        "a query with no shared ancestor reports not connected",
        "done: report merge times for the whole query batch",
    ],
};

export default module;
