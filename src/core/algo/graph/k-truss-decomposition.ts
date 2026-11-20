/**
 * k-truss-decomposition.ts - K-Truss Subgraph by Edge-Support Peeling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The support of an edge is the number of triangles containing it. The k-truss
 * is the maximal subgraph in which every edge has support at least k - 2. The
 * algorithm repeatedly discards edges whose support is too small, and each
 * removal decrements the support of the neighboring edges that lost a shared
 * triangle. The surviving subgraph is unique regardless of removal order.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E * V) computing initial supports plus O(E) amortized decrements
 *   Space: O(V + E) for adjacency, support counts, and the edge queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Vertices are circles and edges are undirected connections.
 *   - Edges queued for removal are highlighted; survivors are green.
 *   - The current edge supports are reported in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

interface Edge {
    a: string;
    b: string;
    key: string;
}

function keyOf(a: string, b: string): string {
    return [a, b].sort().join("|");
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { adjacency?: Record<string, string[]>; k?: number } | null) ?? {};
    const adjacencyInput = task.adjacency ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D", "E"],
        D: ["A", "B", "C", "E"],
        E: ["C", "D", "F"],
        F: ["E"],
    };
    const k = typeof task.k === "number" ? Math.max(2, Math.floor(task.k)) : 3;
    const vertices = Object.keys(adjacencyInput).sort();
    const neighbors = new Map<string, Set<string>>(
        vertices.map((v) => [
            v,
            new Set((adjacencyInput[v] ?? []).map(String).filter((u) => vertices.includes(u) && u !== v)),
        ]),
    );
    const edges: Edge[] = [];
    const seen = new Set<string>();
    for (const a of vertices) {
        for (const b of neighbors.get(a) ?? []) {
            const key = keyOf(a, b);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            edges.push({ a, b, key });
        }
    }
    const nodes: VisualEntity[] = makeGraphNodes(vertices);
    const support = new Map<string, number>();
    for (const edge of edges) {
        const shared = [...(neighbors.get(edge.a) ?? [])].filter((v) => (neighbors.get(edge.b) ?? new Set()).has(v));
        support.set(edge.key, shared.length);
    }
    const alive = new Set(edges.map((edge) => edge.key));

    const supportsOf = (): string[] =>
        edges.map((edge) => `${edge.key}:${support.get(edge.key) ?? 0}`);

    const snap = (message: string, line: number, flagged: Set<string>, round: number): VisualFrame => {
        for (const node of nodes) {
            node.state = "unvisited";
        }
        const visualEdges: VisualEdge[] = edges.map((edge) => {
            const isAlive = alive.has(edge.key);
            return {
                id: `edge-${edge.key.replace("|", "-")}`,
                sourceId: `node-${edge.a}`,
                targetId: `node-${edge.b}`,
                label: String(support.get(edge.key) ?? 0),
                state: !isAlive ? "error" : flagged.has(edge.key) ? "comparing" : "sorted",
                directed: false,
            };
        });
        return {
            stepNumber: 0,
            entities: nodes.map((node) => ({ ...node })),
            edges: visualEdges,
            description: message,
            codeLineNumber: line,
            layout: "graph",
            meta: {
                k,
                vertexCount: vertices.length,
                edgeCount: edges.length,
                remainingEdges: alive.size,
                removedEdges: edges.length - alive.size,
                round,
                supports: supportsOf(),
            },
        };
    };

    let step = 0;
    yield {
        ...snap(`Peeling the graph down to its ${k}-truss.`, 1, new Set(), 0),
        stepNumber: step,
    };
    step += 1;

    let round = 0;
    while (true) {
        const flagged = new Set<string>();
        for (const edge of edges) {
            if (alive.has(edge.key) && (support.get(edge.key) ?? 0) < k - 2) {
                flagged.add(edge.key);
            }
        }
        if (flagged.size === 0) {
            break;
        }
        round += 1;
        for (const key of flagged) {
            alive.delete(key);
        }
        for (const edge of edges) {
            if (!flagged.has(edge.key)) {
                continue;
            }
            const common = [...(neighbors.get(edge.a) ?? [])].filter((v) =>
                (neighbors.get(edge.b) ?? new Set()).has(v),
            );
            for (const w of common) {
                for (const endpoint of [edge.a, edge.b]) {
                    const neighborKey = keyOf(endpoint, w);
                    if (alive.has(neighborKey)) {
                        support.set(neighborKey, (support.get(neighborKey) ?? 0) - 1);
                    }
                }
            }
        }
        yield {
            ...snap(
                `Round ${round}: removed ${flagged.size} edge(s) whose support fell below ${k - 2}.`,
                3,
                flagged,
                round,
            ),
            stepNumber: step,
        };
        step += 1;
    }

    yield {
        ...snap(
            `The ${k}-truss keeps ${alive.size} of ${edges.length} edge(s); every survivor has support at least ${k - 2}.`,
            6,
            new Set(),
            round,
        ),
        stepNumber: step,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Triangles are the building blocks of a truss. An edge that lies in few triangles is a weak link: once removed, it also weakens the edges that shared those triangles. Peeling such edges away until none are weak leaves a robust core in which every edge has enough triangular support.",
        invariants: [
            "Support of an edge equals the number of triangles currently containing it.",
            "Removed edges are never reconsidered.",
            "At termination every surviving edge has support at least k minus two.",
        ],
        correctness:
            "Deleting an edge can only destroy triangles that contained it, so decrementing exactly the supports of edges that shared a common neighbor keeps all support counts accurate. The peeling loop stops only when no edge violates the threshold. Any subgraph satisfying the threshold cannot contain a removed edge, because each removed edge violated the bound at a time when the remaining subgraph was a subset of the current one; hence the survivors form the unique maximal k-truss.",
        complexityRationale:
            "Initial support computation intersects neighbor sets for each edge, costing O(E V); each edge is removed once and updates only edges that shared a triangle, giving linear amortized work afterward. Adjacency, supports, and the live set use O(V + E) space.",
        uses: [
            "Extracting dense cores from social and collaboration networks",
            "Detecting tightly knit groups in communication graphs",
            "Preprocessing large graphs for community detection",
        ],
        references: [
            "Cohen, Datar, Fujiwara and Gionis, Trusses: Cohesive Subgraphs for Social Network Analysis, 2005",
            "Zhang, Parthasarathy and Wang, Extracting Analyzing and Visualizing Triangle-k Cores, 2012",
        ],
        workedExample:
            "For a triangle A-B-C-A with a pendant edge C-D, the triangle edges each have support one while the pendant has support zero. For k equal to three, threshold one, the pendant is peeled first; the remaining triangle is the 3-truss.",
    },
    id: "k-truss-decomposition",
    name: "K-Truss Decomposition",
    category: "graph",
    complexity: { time: "O(E * V)", space: "O(V + E)" },
    defaultInput: {
        adjacency: {
            A: ["B", "C", "D"],
            B: ["A", "C", "D"],
            C: ["A", "B", "D", "E"],
            D: ["A", "B", "C", "E"],
            E: ["C", "D", "F"],
            F: ["E"],
        },
        k: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected edge list and neighbor sets",
        "compute each edge support as its shared-neighbor count",
        "initialize the live set with every edge",
        "find all live edges whose support is below k minus two",
        "remove those edges and decrement affected supports",
        "repeat until no edge violates the support threshold",
        "report the surviving k-truss edges",
    ],
};

export default module;
