/**
 * greedy-percolation.ts - Greedy Percolation Community Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Greedy percolation starts with every vertex in its own community and lets a
 * vertex migrate to a neighboring community when that move raises modularity
 * the most. Unlike clique percolation it does not rely on fully connected
 * groups, so it can discover communities in sparse graphs. Passes repeat until
 * no single vertex move improves the score, yielding a disjoint partition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(passes * V * d * V) for the scoring used here on V vertices
 *   Space: O(V + E) for the graph and community labels
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes are colored by their current community label.
 *   - Internal edges are GREEN, cross-community edges stay gray.
 *   - The vertex being evaluated is YELLOW; meta reports modularity over time.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

const STATES: EntityState[] = ["active", "visited", "comparing", "path", "sorted", "pivot", "highlight", "error"];

const defaultEdges: Array<[string, string]> = [
    ["A", "B"],
    ["A", "C"],
    ["B", "C"],
    ["D", "E"],
    ["D", "F"],
    ["E", "F"],
    ["C", "D"],
];

function modularity(nodes: string[], edges: Array<[string, string]>, labels: Map<string, number>): number {
    const m = edges.length;
    if (m === 0) {
        return 0;
    }
    const degree = new Map(nodes.map((v) => [v, 0]));
    const internal = new Map<number, number>();
    const commDegree = new Map<number, number>();
    for (const [u, v] of edges) {
        degree.set(u, (degree.get(u) ?? 0) + 1);
        degree.set(v, (degree.get(v) ?? 0) + 1);
    }
    for (const v of nodes) {
        const c = labels.get(v) ?? 0;
        commDegree.set(c, (commDegree.get(c) ?? 0) + (degree.get(v) ?? 0));
    }
    for (const [u, v] of edges) {
        const cu = labels.get(u) ?? 0;
        const cv = labels.get(v) ?? 0;
        if (cu === cv) {
            internal.set(cu, (internal.get(cu) ?? 0) + 1);
        }
    }
    let q = 0;
    for (const c of commDegree.keys()) {
        q += (internal.get(c) ?? 0) / m - ((commDegree.get(c) ?? 0) / (2 * m)) ** 2;
    }
    return q;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { edges?: Array<[string, string]>; maxPasses?: number } | null) ?? {};
    const raw = Array.isArray(task.edges) ? task.edges : defaultEdges;
    const edges = raw
        .filter((e) => Array.isArray(e) && e.length >= 2)
        .map((e) => [String(e[0]), String(e[1])] as [string, string]);
    const nodes = [...new Set(edges.flat())];
    const maxPasses = Math.max(1, Math.min(20, Math.floor(task.maxPasses ?? 10)));

    const labels = new Map<string, number>(nodes.map((v, i) => [v, i]));
    const neighbors = new Map<string, Set<string>>(nodes.map((v) => [v, new Set<string>()]));
    for (const [u, v] of edges) {
        neighbors.get(u)?.add(v);
        neighbors.get(v)?.add(u);
    }

    let step = 0;
    let moves = 0;
    let q = modularity(nodes, edges, labels);

    const snapshot = (description: string, codeLineNumber: number, active: string, pass: number): VisualFrame => {
        const entities: VisualEntity[] = nodes.map((v) => ({
            id: `node-${v}`,
            type: "node" as const,
            label: v,
            value: labels.get(v) ?? 0,
            state: (v === active ? "comparing" : STATES[(labels.get(v) ?? 0) % STATES.length]) as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label: v, community: labels.get(v) ?? 0 },
        }));
        const visualEdges: VisualEdge[] = edges.map(([u, v], i) => ({
            id: `edge-${i}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: "",
            state: (labels.get(u) === labels.get(v) ? "path" : "idle") as EntityState,
            directed: false,
        }));
        return {
            stepNumber: step++,
            entities,
            edges: visualEdges,
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                q: Math.round(q * 100000) / 100000,
                moves,
                pass,
                communities: nodes.map((v) => labels.get(v) ?? 0),
                active,
            },
        };
    };

    if (nodes.length === 0) {
        yield snapshot("Empty graph - no communities to detect.", 0, "", 0);
        return;
    }

    yield snapshot(`Greedy percolation on ${nodes.length} node(s) and ${edges.length} edge(s); initial modularity ${q.toFixed(3)}.`, 0, "", 0);

    for (let pass = 1; pass <= maxPasses; pass += 1) {
        let improved = false;
        for (const v of nodes) {
            const own = labels.get(v) ?? 0;
            const candidates = new Set<number>();
            for (const u of neighbors.get(v) ?? []) {
                const c = labels.get(u) ?? 0;
                if (c !== own) {
                    candidates.add(c);
                }
            }
            let bestLabel = own;
            let bestQ = q;
            for (const candidate of candidates) {
                labels.set(v, candidate);
                const trial = modularity(nodes, edges, labels);
                labels.set(v, own);
                if (trial > bestQ + 1e-12) {
                    bestQ = trial;
                    bestLabel = candidate;
                }
            }
            if (bestLabel !== own) {
                labels.set(v, bestLabel);
                q = bestQ;
                moves += 1;
                improved = true;
                yield snapshot(`Pass ${pass}: move ${v} into community ${bestLabel}; modularity rises to ${q.toFixed(3)}.`, 3, v, pass);
            }
        }
        yield snapshot(
            `Pass ${pass} complete with ${moves} total move(s); modularity is ${q.toFixed(3)}.`,
            5,
            "",
            pass,
        );
        if (!improved) {
            break;
        }
    }

    yield snapshot(`Converged after ${moves} move(s) with modularity ${q.toFixed(3)}; the partition is a union of connected communities.`, 6, "", maxPasses);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Start with every vertex alone and let a vertex hop to a neighboring group when doing so makes the grouping clearer. Clarity is measured by modularity: a good group has many internal edges and few edges leaving it. Repeating the best local hop eventually settles into a partition where no single vertex wants to move.",
        invariants: [
            "Every vertex belongs to exactly one community at all times.",
            "A move is applied only if it strictly increases modularity.",
            "Only hops to a community of an actual neighbor are considered.",
        ],
        correctness:
            "The greedy step evaluates every neighboring community by recomputing modularity after the hypothetical move, so it selects the locally best migration and never accepts a worsening one. Modularities are bounded above by 1 and each accepted move increases the score, so the sequence cannot cycle and the process terminates. At termination no single vertex move to a neighboring community improves modularity, which is the local-optimality condition defining the returned partition.",
        complexityRationale:
            "A pass considers at most V vertices, each testing at most its degree d candidate communities, and each test recomputes modularity in O(V + E). That is O(passes * V * d * (V + E)) time with this straightforward scoring, and O(V + E) space for labels and adjacency.",
        uses: [
            "Finding groups in social and communication networks",
            "Detecting modules in biological interaction networks",
            "A simple baseline for comparing more elaborate community detectors",
        ],
        references: [
            "Kumpula, Onnela, Saramaki, Kaski, and Kertesz, Characterization of Community Structure in Complex Networks, 2007",
            "Newman and Girvan, Finding and Evaluating Community Structure in Networks, 2004",
        ],
        workedExample:
            "Two triangles joined by a single edge start with six communities. Moving B into A's group gains internal edges, then C follows, and similarly for E and F. The algorithm settles on two communities linked by one cross edge, with a higher modularity than the all-singleton partition.",
    },
    id: "greedy-percolation",
    name: "Greedy Percolation Community Detection",
    category: "graph",
    complexity: { time: "O(passes * V * d * (V + E))", space: "O(V + E)" },
    defaultInput: { edges: defaultEdges, maxPasses: 10 },
    visualType: "graph",
    run,
    pseudocode: [
        "put every vertex in its own community",
        "compute the modularity of the current partition",
        "for each vertex, list the communities of its neighbors",
        "try moving the vertex to each of those communities",
        "keep the move with the largest modularity increase",
        "apply it only when the increase is positive",
        "repeat passes until no vertex move helps",
        "done: report the connected communities and final modularity",
    ],
};

export default module;
