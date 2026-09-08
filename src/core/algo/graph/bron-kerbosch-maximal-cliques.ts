/**
 * bron-kerbosch-maximal-cliques.ts – Maximal Cliques (Bron–Kerbosch)
 *
 * Recursive backtracking with pivoting: R grows a clique, P holds
 * candidates, X holds excluded vertices. Triangle+tail: {A,B,C} and {C,D}.
 * Time: O(3^(V/3)) Space: O(V²)
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
    yield* bk([...labels].sort(), [...labels].sort(), []);
    clr();
    for (const c of cliques.flat()) setN(c, "sorted");
    yield snap(`Maximal cliques: ${cliques.map((c) => `{${c.join(",")}}`).join(" ")}.`, 3, {
        cliques: cliques.length,
    });
}

const module: AlgorithmModule = {
    id: "bron-kerbosch-maximal-cliques",
    name: "Maximal Cliques (Bron–Kerbosch)",
    category: "graph",
    complexity: { time: "O(3^(V/3))", space: "O(V²)" },
    defaultInput: { graph: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B", "D"], D: ["C"] } },
    visualType: "graph",
    run,
};

export default module;
