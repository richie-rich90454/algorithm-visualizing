/**
 * betweenness-centrality-brandes.ts – Betweenness Centrality (Brandes)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Betweenness centrality measures how often a vertex sits on shortest paths
 * between other pairs: a bridge vertex that every route must cross scores
 * high, while a leaf scores zero. Brandes' algorithm computes it with one
 * breadth-first search per source vertex. Each BFS builds a shortest-path
 * DAG (layers plus predecessor lists and path counts), then pushes
 * dependency scores back from the farthest layer to the source. On the path
 * A–B–C–D, B and C each sit on 2 shortest paths, so they outscore A and D.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V·E) – one BFS per source over an unweighted graph
 *   Space: O(V + E) for distances, predecessors, and path counts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current source vertex is PINK (highlight).
 *   - All other vertices are ORANGE (visited) while its DAG is processed.
 *   - Final scores peak on bridge vertices, painted YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The standard centrality for finding brokers and bottlenecks.
 *   - Scores are halved on undirected graphs (each pair counted twice).
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B"],
        B: ["A", "C"],
        C: ["B", "D"],
        D: ["C"],
    };

    const labels = [...new Set([...Object.keys(adjacency), ...Object.values(adjacency).flat()])];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeGraphEdges(adjacency);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    let step = 0;
    const snap = (
        description: string,
        codeLineNumber: number,
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: edges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph" as const,
        meta,
    });
    if (labels.length === 0) {
        yield snap("Empty graph – nothing to explore.", 0);
        return;
    }
    const cb = new Map(labels.map((v) => [v, 0]));
    yield snap("Brandes: one BFS per source, uniqueness via shortest-path DAG.", 0, {
        sources: labels.length,
    });
    step += 1;
    for (const s of labels) {
        const stack: string[] = [];
        const pred = new Map(labels.map((v) => [v, [] as string[]]));
        const sigma = new Map(labels.map((v) => [v, 0]));
        const dist = new Map(labels.map((v) => [v, -1]));
        sigma.set(s, 1);
        dist.set(s, 0);
        const queue = [s];
        while (queue.length > 0) {
            const v = queue.shift() as string;
            stack.push(v);
            for (const w of adjacency[v] ?? []) {
                if ((dist.get(w) as number) < 0) {
                    queue.push(w);
                    dist.set(w, (dist.get(v) as number) + 1);
                }
                if ((dist.get(w) as number) === (dist.get(v) as number) + 1) {
                    sigma.set(w, (sigma.get(w) as number) + (sigma.get(v) as number));
                    (pred.get(w) as string[]).push(v);
                }
            }
        }
        const dep = new Map(labels.map((v) => [v, 0]));
        while (stack.length > 0) {
            const w = stack.pop() as string;
            for (const v of pred.get(w) as string[]) {
                dep.set(
                    v,
                    (dep.get(v) as number) +
                        ((sigma.get(v) as number) / (sigma.get(w) as number)) *
                            (1 + (dep.get(w) as number)),
                );
            }
            if (w !== s) cb.set(w, (cb.get(w) as number) + (dep.get(w) as number));
        }
        clr();
        setN(s, "highlight");
        for (const v of labels) if (v !== s) setN(v, "visited");
        yield snap(`Source ${s}: dependencies pushed back through its shortest-path DAG.`, 1, {
            source: s,
        });
        step += 1;
    }
    for (const v of labels) cb.set(v, (cb.get(v) as number) / 2);
    const mx = Math.max(...cb.values());
    for (const [v, c] of cb) setN(v, c === mx ? "comparing" : "visited");
    yield snap(
        `Betweenness (undirected): ${labels.map((v) => `${v}=${cb.get(v)}`).join(", ")}.`,
        4,
        { scores: labels.map((v) => `${v}:${cb.get(v)}`), count: labels.length },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Betweenness centrality scores a vertex by how often it lies on a shortest path between other pairs. A bridge that every route must cross scores high while a leaf scores zero. Brandes' algorithm computes all scores with one breadth-first search per source, building a shortest-path DAG and then pushing dependency contributions back toward the source.",
        "invariants": [
            "After a BFS from source s, predecessor lists and path counts describe every shortest path from s.",
            "A vertex's dependency is the fraction of source-to-other shortest paths that pass through it.",
            "Accumulating dependencies over all sources gives each vertex's betweenness score."
        ],
        "correctness": "The BFS layers form a DAG of shortest paths, so a dependency can be computed in reverse layer order by splitting each successor's dependency among its predecessors in proportion to path counts. Summing these per-source dependencies over all sources counts, for each pair, every vertex on a shortest path exactly once, which is the definition of betweenness.",
        "complexityRationale": "One BFS plus one dependency pass costs O(V + E) on an unweighted graph, and there are V sources, giving O(V E). Distances, predecessors, path counts, and scores use O(V + E) space.",
        "uses": [
            "Identifying bottlenecks and important connectors in social and transport networks",
            "Girvan-Newman community detection edge scoring",
            "Routing and infrastructure criticality analysis"
        ],
        "references": [
            "Brandes, A Faster Algorithm for Betweenness Centrality (2001)",
            "Freeman, A Set of Measures of Centrality Based on Betweenness (1977)"
        ],
        "workedExample": "On the path A-B-C-D, BFS from A finds paths to C and D through B, so B collects dependency from both; BFS from D similarly credits B and C. After halving scores for the undirected graph, B and C each sit on two shortest paths and outscore the endpoints A and D."
    },
    id: "betweenness-centrality-brandes",
    name: "Betweenness Centrality (Brandes)",
    category: "graph",
    complexity: { time: "O(V·E)", space: "O(V + E)" },
    defaultInput: { graph: { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "cb[v] ← 0 for all v; handle one source s at a time",
        "BFS from s to build layers, then push dependencies back through the DAG",
        "add the accumulated dependency of each vertex into cb",
        "halve every score on undirected graphs",
        "done: bridge vertices like B and C score highest",
    ],
};

export default module;
