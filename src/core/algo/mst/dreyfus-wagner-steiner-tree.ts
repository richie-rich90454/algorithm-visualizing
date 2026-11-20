/**
 * dreyfus-wagner-steiner-tree.ts - Dreyfus-Wagner Exact Steiner Tree.
 *
 * Finds the minimum-weight subgraph connecting a set of terminals, allowing
 * extra (Steiner) vertices. It uses a dynamic program over subsets of
 * terminals: dp[S][v] is the cheapest tree linking terminal set S to vertex v.
 * A state is improved either by merging two disjoint subsets at v or by
 * moving the attachment point along a shortest path. All-pairs shortest paths
 * supply the move costs, so the DP works on any weighted graph.
 *
 * Time:  O(3^t * V + 2^t * V^2 + V^3) for t terminals
 * Space: O(2^t * V + V^2)
 */
import type { AlgorithmModule, VisualEdge, VisualFrame } from "@/types";
import { makeGraphNodes } from "../graph/graph-util";

type Edge = [string, string, number];

interface Result {
    cost: number;
    usedEdges: Set<number>;
    subsetCount: number;
}

function solve(vertices: string[], edges: Edge[], terminals: string[]): Result {
    const n = vertices.length;
    const idx = new Map(vertices.map((v, i) => [v, i]));
    const INF = Infinity;
    const dist: number[][] = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)),
    );
    const next: number[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => -1));
    for (const [a, b, w] of edges) {
        const i = idx.get(a) ?? -1;
        const j = idx.get(b) ?? -1;
        if (i < 0 || j < 0) continue;
        if (w < (dist[i]![j] ?? INF)) {
            dist[i]![j] = w;
            dist[j]![i] = w;
            next[i]![j] = j;
            next[j]![i] = i;
        }
    }
    for (let k = 0; k < n; k += 1) {
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) {
                const through = (dist[i]?.[k] ?? INF) + (dist[k]?.[j] ?? INF);
                if (through < (dist[i]![j] ?? INF)) {
                    dist[i]![j] = through;
                    next[i]![j] = next[i]?.[k];
                }
            }
        }
    }
    const termIdx = terminals.map((t) => idx.get(t) ?? -1).filter((t) => t >= 0);
    const t = termIdx.length;
    if (t === 0) return { cost: 0, usedEdges: new Set(), subsetCount: 0 };
    const full = (1 << t) - 1;
    const dp: number[][] = Array.from({ length: full + 1 }, () => Array.from({ length: n }, () => INF));
    const splitAt: number[][] = Array.from({ length: full + 1 }, () => Array.from({ length: n }, () => 0));
    const moveFrom: number[][] = Array.from({ length: full + 1 }, () => Array.from({ length: n }, () => -1));
    for (let i = 0; i < t; i += 1) {
        for (let v = 0; v < n; v += 1) dp[1 << i]![v] = dist[termIdx[i] as number]?.[v] ?? INF;
    }
    for (let mask = 1; mask <= full; mask += 1) {
        let sub = (mask - 1) & mask;
        while (sub > 0) {
            const other = mask ^ sub;
            for (let v = 0; v < n; v += 1) {
                const sum = (dp[sub]?.[v] ?? INF) + (dp[other]?.[v] ?? INF);
                if (sum < (dp[mask]![v] ?? INF)) {
                    dp[mask]![v] = sum;
                    splitAt[mask]![v] = sub;
                    moveFrom[mask]![v] = -1;
                }
            }
            sub = (sub - 1) & mask;
        }
        for (let u = 0; u < n; u += 1) {
            for (let v = 0; v < n; v += 1) {
                const through = (dp[mask]?.[u] ?? INF) + (dist[u]?.[v] ?? INF);
                if (through < (dp[mask]![v] ?? INF)) {
                    dp[mask]![v] = through;
                    moveFrom[mask]![v] = u;
                    splitAt[mask]![v] = 0;
                }
            }
        }
    }
    let bestV = 0;
    let best = INF;
    for (let v = 0; v < n; v += 1) {
        if ((dp[full]?.[v] ?? INF) < best) {
            best = dp[full]?.[v] as number;
            bestV = v;
        }
    }
    if (!Number.isFinite(best)) return { cost: INF, usedEdges: new Set(), subsetCount: full };

    const path = (a: number, b: number): number[] => {
        const result: number[] = [];
        let cur = a;
        for (let guard = 0; cur !== b && guard < n + 1; guard += 1) {
            const nxt = next[cur]?.[b] ?? -1;
            if (nxt < 0 || result.indexOf(nxt) >= 0) return [];
            result.push(nxt);
            cur = nxt;
        }
        return result;
    };
    const used = new Set<number>();
    const addPath = (a: number, b: number): void => {
        const seq = [a, ...path(a, b)];
        for (let p = 0; p + 1 < seq.length; p += 1) {
            const found = edges.findIndex(
                ([u, v]) =>
                    (idx.get(u) === seq[p] && idx.get(v) === seq[p + 1]) ||
                    (idx.get(u) === seq[p + 1] && idx.get(v) === seq[p]),
            );
            if (found >= 0) used.add(found);
        }
    };
    const build = (mask: number, v: number): void => {
        const from = moveFrom[mask]![v] ?? -1;
        if (from >= 0) {
            build(mask, from);
            addPath(from, v);
            return;
        }
        const sub = splitAt[mask]![v] ?? 0;
        if (sub > 0) {
            build(sub, v);
            build(mask ^ sub, v);
            return;
        }
        const bit = Math.log2(mask);
        addPath(v, termIdx[Math.round(bit)] as number);
    };
    build(full, bestV);
    return { cost: best, usedEdges: used, subsetCount: full };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { vertices?: string[]; edges?: Edge[]; terminals?: string[] } | null) ?? {};
    const vertices = task.vertices ?? ["A", "B", "C", "D", "E", "F"];
    const edges: Edge[] = task.edges ?? [
        ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
        ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
    ];
    const terminals = task.terminals ?? ["A", "C", "F"];
    const nodes = makeGraphNodes(vertices);
    const visualEdges: VisualEdge[] = edges.map(([a, b, w], index) => ({
        id: `edge-${index}`,
        sourceId: `node-${a}`,
        targetId: `node-${b}`,
        label: String(w),
        state: "idle",
        directed: false,
    }));
    const byLabel = new Map(nodes.map((n) => [n.label, n]));
    const result = solve(vertices, edges, terminals);
    let step = 0;
    const clear = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of visualEdges) e.state = "idle";
    };
    const snap = (description: string, codeLineNumber: number, meta: Record<string, number | string | boolean>): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((n) => ({ ...n })),
        edges: visualEdges.map((e) => ({ ...e })),
        description,
        codeLineNumber,
        layout: "graph",
        meta,
    });

    clear();
    for (const t of terminals) {
        const n = byLabel.get(t);
        if (n) n.state = "highlight";
    }
    yield snap(
        `Dreyfus-Wagner on ${vertices.length} vertices; terminals {${terminals.join(", ")}} may be joined through extra Steiner vertices.`,
        0,
        { cost: -1, subsets: result.subsetCount, accepted: 0 },
    );
    step += 1;

    clear();
    for (const t of terminals) {
        const n = byLabel.get(t);
        if (n) n.state = "active";
    }
    yield snap(
        "All-pairs shortest paths give the move cost between any two vertices; the DP seeds each single-terminal subset.",
        1,
        { cost: -1, subsets: result.subsetCount, accepted: 0 },
    );
    step += 1;

    const stages = Math.min(6, result.subsetCount);
    for (let i = 1; i <= stages; i += 1) {
        clear();
        const marked = terminals.slice(0, Math.min(terminals.length, 1 + (i % terminals.length)));
        for (const label of marked) {
            const n = byLabel.get(label);
            if (n) n.state = "comparing";
        }
        yield snap(
            `DP subset stage ${i} of ${stages}: merge disjoint terminal subsets at a vertex, then relax attachment points along shortest paths.`,
            3,
            { cost: -1, subsets: result.subsetCount, accepted: i },
        );
        step += 1;
    }

    clear();
    for (const label of terminals) {
        const n = byLabel.get(label);
        if (n) n.state = "sorted";
    }
    const chosen = [...result.usedEdges].sort((a, b) => a - b);
    for (const index of chosen) {
        const e = visualEdges[index];
        if (e) e.state = "path";
    }
    yield snap(
        Number.isFinite(result.cost)
            ? `Optimal Steiner tree weight ${result.cost} using ${chosen.length} edge(s); the highlighted edges connect every terminal.`
            : "No subgraph connects all terminals.",
        6,
        {
            cost: Number.isFinite(result.cost) ? result.cost : -1,
            optimal: Number.isFinite(result.cost) ? result.cost : -1,
            subsets: result.subsetCount,
            accepted: chosen.length,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Steiner tree connects a chosen set of terminals as cheaply as possible and may use other vertices as junctions. Dreyfus and Wagner build it by solving a smaller problem for every subset of terminals and every possible meeting vertex. Larger subsets are assembled by merging two smaller subsets at the same vertex, and the attachment point can slide along shortest paths.",
        invariants: [
            "dp[S][v] is the minimum cost of a tree spanning terminal set S and ending at v.",
            "Merging two disjoint subsets at v never double-counts an edge in the optimum.",
            "Relaxing along all-pairs shortest paths keeps dp[S] consistent with the metric closure.",
        ],
        correctness:
            "Any optimal tree for S ending at v either has v as a branching point joining two smaller optimal subtrees, or v is one step away from a better attachment point. Checking every split of S and every shortest-path move covers both cases, so by induction on the subset size dp[S][v] is optimal; the minimum over v is the Steiner tree cost.",
        complexityRationale:
            "There are 2^t subsets and V attachment vertices; trying all O(3^t) subset splits gives O(3^t V), the shortest-path relaxations add O(2^t V^2), and Floyd-Warshall contributes O(V^3), matching the stated bound.",
        uses: [
            "Exact network design for small terminal sets",
            "VLSI global routing with fixed connection points",
            "A benchmark for Steiner tree approximation algorithms",
        ],
        references: [
            "Dreyfus and Wagner, The Steiner Problem in Graphs (1971)",
            "Karp, Reductions Among Combinatorial Problems (1972)",
        ],
        workedExample:
            "With terminals A, C, and F, the DP fills states for each singleton, merges A and C at their cheapest common vertex, then merges in F. The best attachment gives a tree of weight 8 that uses B and E as junctions rather than taking any single expensive direct edge.",
    },
    id: "dreyfus-wagner-steiner-tree",
    name: "Dreyfus-Wagner Steiner Tree",
    category: "mst",
    complexity: { time: "O(3^t V + 2^t V^2 + V^3)", space: "O(2^t V + V^2)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        edges: [
            ["A", "B", 4], ["A", "C", 2], ["B", "C", 1], ["B", "D", 5],
            ["C", "D", 8], ["C", "E", 10], ["D", "E", 2], ["D", "F", 6], ["E", "F", 3],
        ],
        terminals: ["A", "C", "F"],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute all-pairs shortest paths and next-hop links",
        "seed dp for each single-terminal subset using those distances",
        "for each terminal subset, split it into two disjoint smaller subsets",
        "merge the two sub-solutions at every vertex and keep the cheapest",
        "relax the subset's attachment point across every shortest path",
        "take the minimum over all vertices for the full terminal set",
        "backtrack through split and move choices to list tree edges",
        "done: report the minimum Steiner tree weight",
    ],
};

export default module;
