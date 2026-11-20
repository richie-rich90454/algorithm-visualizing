/**
 * bron-kerbosch-maximal-cliques.ts – Maximal Cliques (Bron–Kerbosch)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A clique is a set of pairwise adjacent vertices; it is maximal when no
 * outsider connects to all of it. Bron–Kerbosch grows cliques by recursive
 * backtracking with three sets: R (the clique under construction), P
 * (candidates that extend R), and X (excluded vertices that prevent
 * duplicates). A pivot from P ∪ X that covers the most candidates shrinks
 * the branching to P ∖ N(pivot). When P and X are both empty, R is maximal.
 * On the triangle-plus-tail graph it reports {A,B,C} and {C,D}.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(3^(V/3)) worst case – optimal for clique enumeration
 *   Space: O(V²) for adjacency sets and recursion
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pivot vertex is PINK (highlight).
 *   - The growing clique R is YELLOW (comparing).
 *   - A reported maximal clique flashes GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Maximal (cannot grow) is weaker than maximum (largest possible).
 *   - Pivoting prunes the search without missing any clique.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { graph?: Record<string, string[]> } | null) ?? {};
    const adjacency: Record<string, string[]> = task.graph ?? {
        A: ["B", "C"],
        B: ["A", "C"],
        C: ["A", "B", "D"],
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
    const nbr = (v: string): Set<string> => new Set(adjacency[v] ?? []);
    const cliques: string[][] = [];
    yield snap("Bron–Kerbosch with pivot: grow R, shrink P, track X.", 0, {});
    step += 1;
    function* bk(R: string[], P: string[], X: string[]): Generator<VisualFrame, void, unknown> {
        if (P.length === 0 && X.length === 0) {
            if (R.length > 0) {
                cliques.push([...R].sort());
                clr();
                for (const v of R) setN(v, "path");
                yield snap(
                    `Maximal clique {${[...R].sort().join(",")}} – no vertex can extend it.`,
                    2,
                    { cliques: cliques.length },
                );
                step += 1;
            }
            return;
        }
        const union = [...P, ...X];
        let pivot = union[0] as string;
        let best = -1;
        for (const u of union) {
            const n = P.filter((v) => nbr(u).has(v)).length;
            if (n > best) {
                best = n;
                pivot = u;
            }
        }
        clr();
        setN(pivot, "highlight");
        for (const v of R) setN(v, "comparing");
        yield snap(`Pivot ${pivot}: branch over P ∖ N(${pivot}).`, 1, { cliques: cliques.length });
        step += 1;
        for (const v of P.filter((x) => !nbr(pivot).has(x))) {
            yield* bk(
                [...R, v],
                P.filter((x) => nbr(v).has(x)),
                X.filter((x) => nbr(v).has(x)),
            );
            P = P.filter((x) => x !== v);
            X = [...X, v];
        }
    }
    yield* bk([], [...labels].sort(), []);
    clr();
    for (const c of cliques.flat()) setN(c, "sorted");
    yield snap(`Maximal cliques: ${cliques.map((c) => `{${c.join(",")}}`).join(" ")}.`, 4, {
        cliques: cliques.length,
    });
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Bron-Kerbosch enumerates all maximal cliques by backtracking with three sets: R is the clique being built, P holds candidates that can extend it, and X holds vertices already tried to prevent duplicates. Choosing a pivot from P union X that covers the most candidates shrinks the branching to only those candidates not adjacent to the pivot.",
        "invariants": [
            "R is always a clique in the original graph.",
            "Every maximal clique is reachable by some sequence of extensions from the current state.",
            "A vertex moved into X is never reconsidered for the same R, avoiding duplicate reports."
        ],
        "correctness": "When P and X are both empty no vertex can extend R without duplicating an already explored clique, so R is maximal. The pivot is safe because any maximal clique extending R must contain a vertex outside the pivot's neighborhood or the pivot itself, and the algorithm branches on exactly those cases, so no clique is missed.",
        "complexityRationale": "The worst-case number of maximal cliques is about 3^(V/3), and the pivot version meets that bound up to polynomial factors. Recursion plus adjacency sets use O(V^2) space.",
        "uses": [
            "Enumerating maximal cliques in social and biological networks",
            "Finding maximal complete subgraphs in constraint systems",
            "A subroutine for some graph coloring and clustering methods"
        ],
        "references": [
            "Bron and Kerbosch, Algorithm 457: Finding All Cliques of an Undirected Graph (1973)",
            "Tomita, Tanaka, and Takahashi, The Worst-Case Time Complexity for Generating All Maximal Cliques (2006)"
        ],
        "workedExample": "The triangle-plus-tail graph starts with R empty and P all vertices. Pivoting at C limits branching to vertices outside its neighborhood; the search records maximal clique {A,B,C}, then moves on to record {C,D}. Both are maximal and neither is reported twice."
    },
    id: "bron-kerbosch-maximal-cliques",
    name: "Maximal Cliques (Bron–Kerbosch)",
    category: "graph",
    complexity: { time: "O(3^(V/3))", space: "O(V²)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B", "D"], D: ["C"] } },
    visualType: "graph",
    run,
    pseudocode: [
        "start with R empty, P all vertices, X empty",
        "pick the pivot covering the most candidates; branch over P ∖ N(pivot)",
        "P and X empty: R is maximal, so record it",
        "move v from P into R for the call, then into X, and repeat",
        "done: every maximal clique such as {A,B,C} is listed",
    ],
};

export default module;
