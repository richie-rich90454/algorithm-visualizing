/**
 * line-graph-construction.ts – Line Graph Construction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The line graph L(G) turns edges into vertices: each edge of G becomes one
 * vertex, and two line-graph vertices link up exactly when their edges
 * share an endpoint in G. Triple intersections in G become triangles in
 * L(G). The star K1,3 (hub A with leaves B, C, D) converts to a triangle
 * on {AB, AC, AD}, since all three edges meet at A.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V + E²) – each edge pair sharing an endpoint links up
 *   Space: O(E²) for the line-graph adjacency
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Original edges convert one by one, flashing BLUE (active).
 *   - The finished line graph renders GREEN (sorted) with GREEN (path) edges.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Edge coloring of G equals vertex coloring of L(G).
 *   - Claw-free structure: line graphs never contain K1,3 as an induced part.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C", "D"],
        B: ["A"],
        C: ["A"],
        D: ["A"],
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
    const seenE = new Set<string>();
    const origEdges: Array<[string, string]> = [];
    for (const [u, vs] of Object.entries(adjacency)) {
        for (const v of vs) {
            const k = [u, v].sort().join("|");
            if (!seenE.has(k)) {
                seenE.add(k);
                origEdges.push([u, v]);
            }
        }
    }
    yield snap(`Star has ${origEdges.length} edges: each becomes one line-graph vertex.`, 0, {
        edges: origEdges.length,
    });
    step += 1;
    for (const [u, v] of origEdges) {
        setE(u, v, "active");
        setN(u, "comparing");
        setN(v, "comparing");
        yield snap(`Edge ${u}–${v} becomes line-graph vertex e${u}${v}.`, 1, {});
        step += 1;
    }
    yield snap(
        `Edges ${origEdges.map(([u, v]) => `${u}${v}`).join(", ")} all share A – pairwise adjacent in L(G).`,
        1,
        {},
    );
    step += 1;
    // Final frames render the line graph itself: vertices eAB, eAC, eAD.
    const lgNodes = makeGraphNodes(origEdges.map(([u, v]) => `e${u}${v}`));
    const lgAdj: Record<string, string[]> = {};
    for (const [u, v] of origEdges) lgAdj[`e${u}${v}`] = [];
    for (let i = 0; i < origEdges.length; i += 1) {
        for (let j = i + 1; j < origEdges.length; j += 1) {
            const [a, b] = origEdges[i] as [string, string];
            const [c, d] = origEdges[j] as [string, string];
            if (a === c || a === d || b === c || b === d) {
                (lgAdj[`e${a}${b}`] as string[]).push(`e${c}${d}`);
                (lgAdj[`e${c}${d}`] as string[]).push(`e${a}${b}`);
            }
        }
    }
    const lgEdges = makeGraphEdges(lgAdj);
    for (const n of lgNodes) n.state = "sorted";
    for (const e of lgEdges) e.state = "path";
    yield {
        stepNumber: step,
        entities: lgNodes.map((n) => ({ ...n })),
        edges: lgEdges.map((e) => ({ ...e })),
        description: `Line graph L(G): ${lgNodes.length} vertices, ${lgEdges.length / 2} adjacencies.`,
        codeLineNumber: 4,
        layout: "graph" as const,
        meta: { vertices: lgNodes.length },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "The line graph L(G) turns the edges of G into vertices. Two line-graph vertices are adjacent exactly when the original edges share an endpoint. This converts questions about edges in G into questions about vertices in L(G).",
        "invariants": [
            "Each edge of G maps to exactly one vertex of L(G).",
            "Two line vertices connect if and only if their edges share an endpoint in G.",
            "A set of edges meeting at one vertex becomes a clique in L(G)."
        ],
        "correctness": "By definition the adjacency test examines every pair of original edges and links them when they share an endpoint, so the constructed graph is precisely the line graph. Parts of a star all share the hub, so their line vertices form a clique, which the construction reproduces.",
        "complexityRationale": "Testing all pairs of edges costs O(E^2) time and the line-graph adjacency uses O(E^2) space in the worst case.",
        "uses": [
            "Reducing edge problems to vertex problems such as edge coloring",
            "Graph theory transformations and Whitney isomorphism results",
            "Modeling adjacency of links in communication networks"
        ],
        "references": [
            "Whitney, Congruent Graphs and the Connectivity of Graphs (1932)",
            "Harary, Graph Theory"
        ],
        "workedExample": "The star with hub A and leaves B, C, D has three edges that all meet at A. In L(G) those become three vertices AB, AC, AD, each pair adjacent because the corresponding edges share A, so L(G) is a triangle."
    },
    id: "line-graph-construction",
    name: "Line Graph Construction",
    category: "graph",
    complexity: { time: "O(V + E²)", space: "O(E²)" },
    defaultInput: { graph: { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "list every edge of the original graph",
        "turn each edge into one line-graph vertex",
        "link line vertices whose edges share an endpoint",
        "render the finished line graph L(G)",
        "done: L(G) with its vertices and shared-endpoint links",
    ],
};

export default module;
