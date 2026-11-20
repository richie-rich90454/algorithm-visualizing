/**
 * maximum-spanning-tree.ts - Maximum Spanning Tree (Descending Kruskal)
 *
 * Sort every edge by descending weight, then add an edge whenever it joins two
 * different components. The union-find structure keeps the accepted edges
 * acyclic; once n-1 edges are accepted the result is a spanning tree of
 * maximum total weight. This is the exact mirror of minimum Kruskal.
 */

import type {
    AlgorithmModule,
    EntityState,
    VisualEdge,
    VisualEntity,
    VisualFrame,
} from "@/types";

type Edge = [string, string, number];

function parseEdges(input: unknown): { edges: Edge[]; nodes: string[] } {
    const task = (input as { edges?: Edge[]; adjacency?: Record<string, Array<[string, number]>> } | null) ?? {};
    let edges: Edge[] = [];
    if (Array.isArray(task.edges)) {
        edges = task.edges.map(([u, v, w]) => [String(u), String(v), Number(w)]);
    } else if (task.adjacency && typeof task.adjacency === "object") {
        const seen = new Set<string>();
        for (const [u, list] of Object.entries(task.adjacency)) {
            for (const [v, w] of list) {
                const key = [u, String(v)].sort().join("|");
                if (!seen.has(key)) {
                    seen.add(key);
                    edges.push([u, String(v), Number(w)]);
                }
            }
        }
    }
    if (edges.length === 0) {
        edges = [
            ["A", "B", 4],
            ["A", "C", 2],
            ["B", "C", 3],
            ["B", "D", 5],
            ["C", "D", 1],
        ];
    }
    const nodeSet = new Set<string>();
    for (const [u, v] of edges) {
        nodeSet.add(u);
        nodeSet.add(v);
    }
    return { edges, nodes: [...nodeSet].sort() };
}

function makeNodes(nodes: string[]): VisualEntity[] {
    return nodes.map((id, index) => ({
        id: `node-${id}`,
        type: "node" as const,
        label: id,
        value: id,
        state: "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function makeEdges(
    edges: Edge[],
    states: Map<number, EntityState>,
    chosen: Set<number>,
): VisualEdge[] {
    return edges.map(([u, v, w], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${u}`,
        targetId: `node-${v}`,
        label: String(w),
        state: chosen.has(index) ? "sorted" : states.get(index) ?? "idle",
        directed: false,
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const { edges, nodes } = parseEdges(input);
    const frames: VisualFrame[] = [];
    const chosen = new Set<number>();
    const parent = new Map<string, string>(nodes.map((n) => [n, n]));
    const find = (x: string): string => {
        let root = x;
        while (parent.get(root) !== root) root = parent.get(root)!;
        return root;
    };
    const union = (a: string, b: string): boolean => {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return false;
        parent.set(ra, rb);
        return true;
    };

    const push = (states: Map<number, EntityState>, desc: string, line: number, total: number): void => {
        frames.push({
            stepNumber: frames.length,
            entities: makeNodes(nodes),
            edges: makeEdges(edges, states, chosen),
            description: desc,
            codeLineNumber: line,
            layout: "graph",
            meta: { totalWeight: total, chosen: [...chosen], nodeCount: nodes.length, edgeCount: edges.length },
        });
    };

    push(new Map(), `Considering ${edges.length} edges for a maximum spanning tree.`, 0, 0);
    const order = edges
        .map((edge, index) => ({ edge, index }))
        .sort((a, b) => b.edge[2] - a.edge[2]);

    let total = 0;
    for (const { edge, index } of order) {
        const [u, v, w] = edge;
        if (chosen.size >= nodes.length - 1) {
            push(new Map([[index, "idle"]]), `Edge ${u}-${v} (${w}) skipped: tree is complete.`, 4, total);
            continue;
        }
        if (union(u, v)) {
            chosen.add(index);
            total += w;
            push(new Map([[index, "sorted"]]), `Accept edge ${u}-${v} with weight ${w}.`, 3, total);
        } else {
            push(new Map([[index, "error"]]), `Reject edge ${u}-${v}: it would form a cycle.`, 3, total);
        }
    }

    for (const frame of frames) yield frame;
    yield {
        stepNumber: frames.length,
        entities: makeNodes(nodes).map((e) => ({ ...e, state: "sorted" as EntityState })),
        edges: makeEdges(edges, new Map(), chosen),
        description: `Done: maximum spanning tree has total weight ${total}.`,
        codeLineNumber: 5,
        layout: "graph",
        meta: { totalWeight: total, chosen: [...chosen], nodeCount: nodes.length, edgeCount: edges.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "To connect every vertex with the largest possible total edge weight, look at the heaviest edges first and keep each one that does not close a cycle. Union-find tracks which vertices are already connected, so the decision for each edge is immediate.",
        invariants: [
            "The accepted edges never contain a cycle.",
            "After processing edges of weight at least w, the accepted forest is a maximum-weight forest among those edges.",
            "When n-1 edges are accepted, every vertex is connected.",
        ],
        correctness:
            "The cut property for a maximum spanning tree says the heaviest edge crossing any cut belongs to some optimum. Processing edges in descending order and adding one only when it joins two components is exactly Kruskal's algorithm with negated weights, which is proven correct by the cut property. Stopping at n-1 edges leaves a connected acyclic graph of maximum weight.",
        complexityRationale:
            "Sorting the E edges costs O(E log E); each union-find operation is nearly constant, so total time is O(E log E) and the forest uses O(V) space.",
        uses: [
            "Network design that maximizes capacity or reliability",
            "Clustering by merging the strongest similarities first",
            "Baseline comparisons for image segmentation",
        ],
        references: [
            "CLRS, Introduction to Algorithms, chapter on minimum spanning trees",
            "Kruskal, On the Shortest Spanning Subtree of a Graph, 1956",
        ],
        workedExample:
            "With edges A-B(4), A-C(2), B-C(3), B-D(5), C-D(1), descending order accepts B-D(5), A-B(4), B-C(3) and rejects the rest, giving a maximum weight of 12.",
    },
    id: "maximum-spanning-tree",
    name: "Maximum Spanning Tree",
    category: "mst",
    complexity: { time: "O(E log E)", space: "O(V)" },
    defaultInput: {
        edges: [
            ["A", "B", 4],
            ["A", "C", 2],
            ["B", "C", 3],
            ["B", "D", 5],
            ["C", "D", 1],
        ],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "read the weighted undirected graph",
        "sort all edges by descending weight",
        "place every vertex in its own component",
        "for each edge in sorted order, add it if it joins two components",
        "stop once n-1 edges have been accepted",
        "done: report the maximum spanning tree and its weight",
    ],
};

export default module;
