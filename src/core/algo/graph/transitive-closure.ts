/**
 * transitive-closure.ts – Transitive Closure (Warshall)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The transitive closure makes reachability explicit: add edge i→j whenever
 * a path from i to j exists. Warshall's rule drives it: with intermediate
 * vertex k fixed, link i→j whenever i reaches k and k reaches j, then move
 * to the next k. On the chain A→B→C, round B adds the shortcut A→C, so all
 * reachability pairs read off directly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V³) – one inner update per (i, k, j) triple
 *   Space: O(V²) for the reachability sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The intermediate vertex k is PINK (highlight).
 *   - Reachability edges light up BLUE (active) as they appear.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The reachability dual of Floyd–Warshall (same triple loop, no weights).
 *   - Bitsets speed the inner loop by a factor of the word size.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? { A: ["B"], B: ["C"], C: [] };

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
        meta: Record<string, number | string | boolean> = {},
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
    const reach = new Map(labels.map((v) => [v, new Set(adjacency[v] ?? [])]));
    yield snap(`Warshall closure: ${labels.length} vertices, one round per intermediate k.`, 0, {});
    step += 1;
    for (const k of labels) {
        clr();
        setN(k, "highlight");
        let added = 0;
        for (const i of labels) {
            if (!(reach.get(i) as Set<string>).has(k)) continue;
            for (const j of labels) {
                if (
                    (reach.get(k) as Set<string>).has(j) &&
                    !(reach.get(i) as Set<string>).has(j) &&
                    i !== j
                ) {
                    (reach.get(i) as Set<string>).add(j);
                    added += 1;
                }
            }
        }
        for (const i of labels) for (const j of reach.get(i) as Set<string>) setE(i, j, "active");
        yield snap(
            added > 0 ? `Via ${k}: ${added} new reachability edge(s).` : `Via ${k}: nothing new.`,
            1,
            { through: k },
        );
        step += 1;
    }
    const all: string[] = [];
    for (const i of labels) for (const j of reach.get(i) as Set<string>) all.push(`${i}→${j}`);
    yield snap(`Closure complete: reachable pairs ${all.sort().join(", ")}.`, 4, {
        pairs: all.length,
    });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The transitive closure adds an edge from i to j whenever any path exists from i to j, making reachability explicit. Warshall's rule fixes each intermediate vertex k in turn and links i to j whenever i reaches k and k reaches j.",
        "invariants": [
            "After processing intermediate vertices up to k, the matrix records reachability using only those intermediates.",
            "Adding k as an intermediate only adds edges, never removes them.",
            "At the end the matrix is the full reachability relation."
        ],
        "correctness": "Any path using intermediates among the first k vertices either avoids k, already recorded, or passes through k and splits into an i-to-k path and a k-to-j path using smaller intermediates. The update rule adds exactly those split paths, so induction on k shows the matrix is correct at the end.",
        "complexityRationale": "Three nested loops over vertices give O(V^3) time, and the reachability matrix uses O(V^2) space.",
        "uses": [
            "Answering reachability queries quickly after preprocessing",
            "Computing precedence and dependency relations",
            "A building block for transitive reduction and closure queries"
        ],
        "references": [
            "Warshall, A Theorem on Boolean Matrices (1962)",
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, all-pairs shortest paths"
        ],
        "workedExample": "For the chain A to B to C, the initial matrix has A-B and B-C. When B is used as the intermediate, A reaches B and B reaches C, so A-C is added. The final matrix records A-B, B-C, and A-C."
    },
    id: "transitive-closure",
    name: "Transitive Closure (Warshall)",
    category: "graph",
    complexity: { time: "O(V³)", space: "O(V²)" },
    defaultInput: { graph: { A: ["B"], B: ["C"], C: [] } },
    visualType: "graph",
    run,
    pseudocode: [
        "reach[i] ← the direct neighbors of i",
        "via k: link i→j whenever i reaches k and k reaches j",
        "repeat for every intermediate vertex k",
        "collect all reachable pairs i→j",
        "done: full reachability such as A→B, A→C, B→C",
    ],
};

export default module;
