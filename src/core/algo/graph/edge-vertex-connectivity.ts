/**
 * edge-vertex-connectivity.ts - Edge and Vertex Connectivity
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The edge connectivity of a graph is the fewest edges whose removal
 * disconnects it; the vertex connectivity is the fewest vertices whose
 * removal disconnects it or leaves a single vertex. Both equal a minimum cut,
 * so this module computes them with max-flow (Edmonds-Karp). Edge
 * connectivity gives unit capacity to every edge and minimizes over all
 * source-target pairs. Vertex connectivity splits each vertex v into an
 * in-node and an out-node joined by a unit-capacity arc, then minimizes the
 * in-out cut over all non-adjacent pairs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V * E * maxflow) per metric
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current source is GREEN (path), the sink PINK (highlight).
 *   - The smallest cut found so far is reported in the caption.
 *   - The final frame marks both connectivity values in meta.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";
import { makeGraphNodes } from "./graph-util";

type Adj = Record<string, string[]>;
type Arc = [number, number, number];

function normalize(input: unknown): Adj {
    const raw = (input as { graph?: Adj } | null) ?? {};
    const source: Adj =
        raw.graph && typeof raw.graph === "object"
            ? raw.graph
            : { A: ["B", "C"], B: ["C", "D"], C: ["D"], D: ["E"], E: ["F"], F: [] };
    const adj: Adj = {};
    for (const v of Object.keys(source)) {
        adj[v] = [];
    }
    for (const [u, ns] of Object.entries(source)) {
        for (const v of ns) {
            adj[u] ??= [];
            adj[v] ??= [];
            if (!(adj[u] as string[]).includes(v)) {
                (adj[u] as string[]).push(v);
            }
            if (!(adj[v] as string[]).includes(u)) {
                (adj[v] as string[]).push(u);
            }
        }
    }
    return adj;
}

function uniqueEdges(adj: Adj): Array<[string, string]> {
    const edges: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const [u, ns] of Object.entries(adj)) {
        for (const v of ns) {
            const key = [u, v].sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                edges.push([u, v]);
            }
        }
    }
    return edges;
}

/** Edmonds-Karp maximum flow on a 0-indexed capacity network. */
function maxflow(n: number, arcs: Arc[], s: number, t: number): number {
    const cap: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
    for (const [u, v, c] of arcs) {
        cap[u] = cap[u] ?? [];
        cap[v] = cap[v] ?? [];
        cap[u][v] = (cap[u][v] ?? 0) + c;
    }
    let flow = 0;
    const big = 1e9;
    for (;;) {
        const parent = Array<number>(n).fill(-1);
        parent[s] = s;
        const queue = [s];
        for (let head = 0; head < queue.length; head += 1) {
            const u = queue[head] as number;
            for (let v = 0; v < n; v += 1) {
                if (parent[v] === -1 && (cap[u][v] ?? 0) > 0) {
                    parent[v] = u;
                    queue.push(v);
                }
            }
        }
        if (parent[t] === -1) {
            break;
        }
        let aug = big;
        for (let v = t; v !== s; v = parent[v] as number) {
            aug = Math.min(aug, cap[parent[v] as number][v] as number);
        }
        for (let v = t; v !== s; v = parent[v] as number) {
            const u = parent[v] as number;
            cap[u][v] = (cap[u][v] as number) - aug;
            cap[v][u] = (cap[v][u] as number) + aug;
        }
        flow += aug;
    }
    return flow;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const adj = normalize(input);
    const vertices = Object.keys(adj).sort();
    const n = vertices.length;
    const index = new Map<string, number>(vertices.map((v, i) => [v, i]));
    const edges = uniqueEdges(adj);
    const edgeList: Array<[number, number]> = edges.map(
        ([u, v]) => [index.get(u) as number, index.get(v) as number],
    );

    const visualEdges: VisualEdge[] = edges.map(([u, v]) => ({
        id: `edge-${u}-${v}`,
        sourceId: `node-${u}`,
        targetId: `node-${v}`,
        label: "",
        state: "idle",
        directed: false,
    }));

    function nodesWith(source: string, target: string): VisualEntity[] {
        return makeGraphNodes(vertices).map((node) => {
            const label = String(node.label);
            const state = label === source ? "path" : label === target ? "highlight" : "unvisited";
            return { ...node, state, metadata: { label } };
        });
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodesWith("", ""),
        edges: visualEdges,
        description: "Computing edge and vertex connectivity by minimum cuts over all pairs.",
        codeLineNumber: 0,
        layout: "graph",
        meta: { n, edges: edges.length, edgeConnectivity: "pending", vertexConnectivity: "pending" },
    };
    step += 1;

    if (n < 2) {
        yield {
            stepNumber: step,
            entities: nodesWith("", ""),
            edges: visualEdges,
            description: "A graph with fewer than two vertices has connectivity zero.",
            codeLineNumber: 6,
            layout: "graph",
            meta: { n, edges: edges.length, edgeConnectivity: 0, vertexConnectivity: 0 },
        };
        return;
    }

    // Edge connectivity: unit capacity on each undirected edge.
    let edgeConn = Number.POSITIVE_INFINITY;
    const edgeArcs: Arc[] = [];
    for (const [u, v] of edgeList) {
        edgeArcs.push([u, v, 1], [v, u, 1]);
    }
    for (let s = 0; s < n; s += 1) {
        for (let t = s + 1; t < n; t += 1) {
            const flow = maxflow(n, edgeArcs, s, t);
            edgeConn = Math.min(edgeConn, flow);
            yield {
                stepNumber: step,
                entities: nodesWith(vertices[s] as string, vertices[t] as string),
                edges: visualEdges,
                description: `Edge cut between ${vertices[s]} and ${vertices[t]} is ${flow}; best so far ${edgeConn}.`,
                codeLineNumber: 2,
                layout: "graph",
                meta: { n, edges: edges.length, edgeConnectivity: edgeConn, pair: [vertices[s], vertices[t]] },
            };
            step += 1;
        }
    }
    if (!Number.isFinite(edgeConn)) {
        edgeConn = 0;
    }

    // Vertex connectivity: split each vertex, unit arc through non-terminals.
    const adjSet = new Map<string, Set<string>>(vertices.map((v) => [v, new Set(adj[v] ?? [])]));
    let vertexConn = Number.POSITIVE_INFINITY;
    let testedPairs = 0;
    for (let s = 0; s < n; s += 1) {
        for (let t = s + 1; t < n; t += 1) {
            const sv = vertices[s] as string;
            const tv = vertices[t] as string;
            if ((adjSet.get(sv) ?? new Set()).has(tv)) {
                continue;
            }
            testedPairs += 1;
            const big = n + edges.length + 1;
            const arcs: Arc[] = [];
            for (let v = 0; v < n; v += 1) {
                const capThrough = v === s || v === t ? big : 1;
                arcs.push([v, v + n, capThrough]);
            }
            for (const [u, v] of edgeList) {
                arcs.push([u + n, v, big], [v + n, u, big]);
            }
            const flow = maxflow(2 * n, arcs, (s as number) + n, t as number);
            vertexConn = Math.min(vertexConn, flow);
            yield {
                stepNumber: step,
                entities: nodesWith(sv, tv),
                edges: visualEdges,
                description: `Vertex cut between ${sv} and ${tv} is ${flow}; best so far ${vertexConn}.`,
                codeLineNumber: 4,
                layout: "graph",
                meta: { n, edges: edges.length, vertexConnectivity: vertexConn, pair: [sv, tv] },
            };
            step += 1;
        }
    }
    if (testedPairs === 0) {
        vertexConn = n - 1; // complete graph
    } else if (!Number.isFinite(vertexConn)) {
        vertexConn = 0;
    }

    yield {
        stepNumber: step,
        entities: makeGraphNodes(vertices).map((node) => ({ ...node, state: "sorted" as const })),
        edges: visualEdges,
        description: `Edge connectivity ${edgeConn}, vertex connectivity ${vertexConn}.`,
        codeLineNumber: 6,
        layout: "graph",
        meta: { n, edges: edges.length, edgeConnectivity: edgeConn, vertexConnectivity: vertexConn },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Connectivity measures how hard a graph is to break apart. The fewest edges you can cut follows from min-flow min-cut if every edge has unit capacity. The fewest internal vertices follows from the same idea after splitting every vertex into an entrance and exit joined by a unit link, so cutting that link removes the vertex. Trying every pair of terminals and keeping the smallest cut gives both measures.",
        invariants: [
            "A unit-capacity edge cut equals the number of edges crossing a partition.",
            "Splitting a vertex turns vertex deletion into a unit-capacity arc cut.",
            "Source and sink vertices get infinite capacity so they are never removed.",
        ],
        correctness:
            "By the max-flow min-cut theorem, the minimum s-t flow equals the capacity of the minimum s-t cut. With unit edge capacities this is the smallest set of edges separating s from t, so the minimum over all pairs is the edge connectivity. In the split network, a finite cut must sever unit vertex arcs, so its capacity is the number of removed vertices; minimizing over non-adjacent pairs yields the vertex connectivity, with a complete graph giving n minus one.",
        complexityRationale:
            "There are O(V^2) terminal pairs and each Edmonds-Karp flow costs O(V E^2), giving a practical bound of O(V^3 E^2) for this straightforward implementation on small graphs. The residual graph and split network store O(V + E) data.",
        uses: [
            "Network robustness and fault-tolerance analysis",
            "Reliability of communication and power grids",
            "Graph decomposition and structural graph theory",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 26 (flow and cut)",
            "West, Introduction to Graph Theory, connectivity chapter",
        ],
        workedExample:
            "For a chain of triangles joined by single links and a pendant vertex, every bridge is a one-edge cut, so edge connectivity is one. Removing the articulation vertex that joins the triangles also disconnects the graph, so vertex connectivity is one.",
    },
    id: "edge-vertex-connectivity",
    name: "Edge and Vertex Connectivity",
    category: "graph",
    complexity: { time: "O(V^3 E^2)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["C", "D"], C: ["D"], D: ["E"], E: ["F"], F: [] } },
    visualType: "graph",
    run,
    pseudocode: [
        "build the undirected graph and list all vertex pairs",
        "for edge connectivity give every edge unit capacity",
        "for each pair compute the max-flow minimum edge cut",
        "for vertex connectivity split each vertex into in and out nodes",
        "join them by a unit arc except at the terminal pair",
        "for each non-adjacent pair compute the minimum vertex cut",
        "done: report the smallest edge cut and vertex cut",
    ],
};

export default module;
