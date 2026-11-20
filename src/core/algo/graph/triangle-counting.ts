/**
 * triangle-counting.ts – Triangle Counting (Node Ordering)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Orienting each edge from the smaller to the larger vertex turns every
 * triangle into exactly one directed wedge u→v, u→w closed by v→w – so each
 * triangle is counted once, at its smallest vertex. The scan walks vertices
 * in order and checks pairs of higher neighbors for the closing edge. The
 * diamond holds triangles ABC (closed at A) and ABD (closed at A): 2 total.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m·√m) – orientation bounds the wedge checks per vertex
 *   Space: O(V + E) for adjacency sets and ranks
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The wedge root is YELLOW (comparing); higher neighbors ORANGE.
 *   - Closing edges flash GREEN (path); wedge arms BLUE (active).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Triangle counts feed clustering coefficients and community scores.
 *   - Orientation is the trick that avoids triple-counting.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B"],
        D: ["A", "B"],
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
    const adj = new Map(labels.map((v) => [v, new Set(adjacency[v] ?? [])]));
    const ord = [...labels].sort();
    const rank = new Map(ord.map((v, i) => [v, i]));
    let total = 0;
    yield snap("Orient edges low→high; each triangle is one directed wedge + closing edge.", 0, {});
    step += 1;
    for (const u of ord) {
        const higher = [...(adj.get(u) as Set<string>)]
            .filter((v) => (rank.get(v) as number) > (rank.get(u) as number))
            .sort();
        clr();
        setN(u, "comparing");
        for (const v of higher) setN(v, "visited");
        let found = 0;
        for (let i = 0; i < higher.length; i += 1) {
            for (let j = i + 1; j < higher.length; j += 1) {
                const v = higher[i] as string;
                const w = higher[j] as string;
                if ((adj.get(v) as Set<string>).has(w)) {
                    total += 1;
                    found += 1;
                    setE(u, v, "active");
                    setE(u, w, "active");
                    setE(v, w, "path");
                    setE(w, v, "path");
                }
            }
        }
        yield snap(
            found > 0
                ? `${u} closes ${found} triangle(s) through higher neighbors.`
                : `${u} closes no triangle.`,
            1,
            { triangles: total },
        );
        step += 1;
    }
    yield snap(`Total triangles: ${total}.`, 4, { triangles: total });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Triangle counting can avoid expensive intersection tests by orienting every edge from the smaller-ranked vertex to the larger. Each triangle then becomes exactly one directed wedge from its lowest-ranked vertex to the other two, closed by an edge between them, so counting closed wedges counts each triangle once.",
        "invariants": [
            "Every undirected edge is oriented from lower to higher rank.",
            "Each triangle has a unique smallest-ranked vertex that closes it.",
            "Counting closed wedges at that vertex adds one per triangle."
        ],
        "correctness": "Orienting edges imposes a total order, so in any triangle exactly one vertex has two outgoing edges to the other two. The edge between those two closes the wedge and can be tested in a set, so every triangle is counted once at its minimum vertex and never elsewhere.",
        "complexityRationale": "The oriented wedge scan costs about O(m sqrt(m)) time for m edges using the standard degree-based bound, with O(V + E) space for adjacency and ranks.",
        "uses": [
            "Counting triangles in social and biological networks",
            "Computing clustering coefficients at scale",
            "A subroutine in community detection and spam detection"
        ],
        "references": [
            "Chiba and Nishizeki, Arboricity and Subgraph Listing Algorithms (1985)",
            "Schank and Wagner, Finding, Counting and Listing All Triangles in Large Graphs (2005)"
        ],
        "workedExample": "The diamond with vertices A, B, C, D and triangles A-B-C and A-B-D orients edges outward from A. At A, the pairs of higher neighbors (B,C) and (B,D) are both closed by edges, so two closed wedges are found and the triangle count is 2."
    },
    id: "triangle-counting",
    name: "Triangle Counting",
    category: "graph",
    complexity: { time: "O(m·√m)", space: "O(V + E)" },
    defaultInput: {
        graph: { A: ["B", "C", "D"], B: ["A", "C", "D"], C: ["A", "B"], D: ["A", "B"] },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "rank vertices and orient each edge from smaller to larger",
        "for u: check pairs of higher neighbors for the closing edge",
        "each closed wedge counts one triangle at its smallest vertex",
        "repeat for every vertex u in order",
        "done: the total triangle count",
    ],
};

export default module;
