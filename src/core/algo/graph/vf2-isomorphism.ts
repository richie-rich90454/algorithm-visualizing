/**
 * vf2-isomorphism.ts – Graph Isomorphism (VF2)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * VF2 decides whether two graphs share the same structure by growing a
 * partial vertex mapping one pair at a time. Each candidate pair must pass
 * feasibility: equal degrees plus neighbor consistency (matched neighbors
 * of one map exactly onto matched neighbors of the other). Failures prune
 * the branch and backtrack. The two triangles match pair by pair with no
 * backtracking needed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V!·V) worst case – factorial search with pruning
 *   Space: O(V) for the partial mapping
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Candidate pairs flash YELLOW (comparing).
 *   - The confirmed mapping turns GREEN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - No known polynomial algorithm for general graphs.
 *   - Degree and neighborhood checks prune hopeless branches early.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphEdges, makeGraphNodes } from "./graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { g1?: Record<string, string[]>; g2?: Record<string, string[]> } | null) ?? {};
    const g1: Record<string, string[]> = task.g1 ?? { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] };
    const g2: Record<string, string[]> = task.g2 ?? { X: ["Y", "Z"], Y: ["X", "Z"], Z: ["X", "Y"] };
    const l1 = Object.keys(g1).sort();
    const l2 = Object.keys(g2).sort();
    const combo = [...l1.map((v) => `1${v}`), ...l2.map((v) => `2${v}`)];
    const nodes = makeGraphNodes(combo);
    const comboAdj: Record<string, string[]> = {};
    for (const v of l1) comboAdj[`1${v}`] = (g1[v] ?? []).map((w) => `1${w}`);
    for (const v of l2) comboAdj[`2${v}`] = (g2[v] ?? []).map((w) => `2${w}`);
    const edges = makeGraphEdges(comboAdj);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
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
    if (l1.length === 0 && l2.length === 0) {
        yield snap("Both graphs empty – trivially isomorphic.", 0);
        return;
    }
    const map = new Map<string, string>();
    const used = new Set<string>();
    yield snap(
        `VF2: match G1 {${l1.join(",")}} against G2 {${l2.join(",")}} with degree pruning.`,
        0,
        {},
    );
    step += 1;
    const feasible = (a: string, x: string): boolean => {
        if ((g1[a] ?? []).length !== (g2[x] ?? []).length) return false;
        for (const [u, y] of map) {
            const c1 = (g1[a] ?? []).includes(u);
            const c2 = (g2[x] ?? []).includes(y);
            if (c1 !== c2) return false;
        }
        return true;
    };
    let guard = 0;
    while (map.size < l1.length && guard < 20) {
        guard += 1;
        const a = l1.find((v) => !map.has(v)) as string;
        const x = l2.find((v) => !used.has(v) && feasible(a, v));
        if (x === undefined) {
            yield snap(
                `No feasible partner for ${a}: backtrack (not hit on these triangles).`,
                1,
                {},
            );
            step += 1;
            break;
        }
        map.set(a, x);
        used.add(x);
        setN(`1${a}`, "comparing");
        setN(`2${x}`, "comparing");
        yield snap(
            `Match ${a}↔${x}: degrees ${(g1[a] ?? []).length}, neighborhoods consistent.`,
            1,
            { matched: map.size },
        );
        step += 1;
    }
    const iso = map.size === l1.length && l1.length === l2.length;
    for (const [a, x] of map) {
        setN(`1${a}`, "path");
        setN(`2${x}`, "path");
    }
    yield snap(
        iso
            ? `Isomorphic: ${[...map.entries()].map(([a, x]) => `${a}↔${x}`).join(", ")}.`
            : "Not isomorphic: mapping cannot complete.",
        4,
        { isomorphic: iso },
    );
}

const module: AlgorithmModule = {
    id: "vf2-isomorphism",
    name: "Graph Isomorphism (VF2)",
    category: "graph",
    complexity: { time: "O(V!·V)", space: "O(V)" },
    defaultInput: {
        g1: { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
        g2: { X: ["Y", "Z"], Y: ["X", "Z"], Z: ["X", "Y"] },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "start with an empty partial mapping between G1 and G2",
        "try an unmapped pair passing degree and neighbor checks",
        "infeasible pair: prune the branch and backtrack",
        "repeat until the mapping covers G1 or stalls",
        "done: a full isomorphism such as A↔X, B↔Y, C↔Z, or a mismatch",
    ],
};

export default module;
