/**
 * resource-constrained-shortest-path.ts – Resource Constrained Shortest Path
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Finds the cheapest route that fits inside a resource budget such as fuel.
 * Dynamic programming tracks dp[v][f], the cheapest cost to reach vertex v
 * burning exactly f fuel. With budget 3 the thirsty route A to B to D needs
 * 4 fuel and is rejected, while A to C to D costs 5 on only 2 fuel and wins.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(R x (V + E)) expanding one layer per fuel level
 *   Space: O(R x V) for the cost table and parents
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex relaxed in the current fuel layer is YELLOW (comparing).
 *   - Affordable relaxed edges are BLUE (active).
 *   - The best feasible route is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Generalizes shortest paths with an extra knapsack-style dimension.
 *   - The problem is NP-hard in general, polynomial for fixed budgets.
 *   - Fuel layers make the resource trade-off visually explicit.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number, number]>>;
            start?: string;
            target?: string;
            budget?: number;
        } | null) ?? {};
    const wadj: Record<string, Array<[string, number, number]>> = task.graph ?? {
        A: [
            ["B", 2, 3],
            ["C", 4, 1],
        ],
        B: [["D", 2, 1]],
        C: [["D", 1, 1]],
        D: [],
    };
    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((vs) => vs.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeWeightedEdges(
        Object.fromEntries(
            Object.entries(wadj).map(([u, vs]) => [
                u,
                vs.map(([v, c]) => [v, c] as [string, number]),
            ]),
        ),
    );
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const setN = (v: string, s: EntityState): void => {
        const n = byId.get(`node-${v}`);
        if (n) n.state = s;
    };
    const clr = (): void => {
        for (const n of nodes) n.state = "unvisited";
        for (const e of edges) e.state = "idle";
    };
    const setE = (a: string, b: string, s: EntityState): void => {
        const e = edges.find((x) => x.sourceId === `node-${a}` && x.targetId === `node-${b}`);
        if (e) e.state = s;
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
        yield snap("Empty graph – nothing to spend fuel on.", 0);
        return;
    }
    const start = task.start && wadj[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? "D";
    const R = task.budget ?? 3;
    const dp = new Map(labels.map((v) => [v, new Array<number>(R + 1).fill(Infinity)]));
    const par = new Map<string, Array<string | null>>(
        labels.map((v) => [v, new Array<string | null>(R + 1).fill(null)]),
    );
    (dp.get(start) as number[])[0] = 0;
    yield snap(
        `Constrained shortest path from ${start} to ${target}: fuel budget ${R}, table dp[vertex][fuel] holds minimum cost.`,
        0,
        {
            budget: R,
            settled: 0,
            visits: 0,
        },
    );
    step += 1;
    for (let f = 0; f <= R; f += 1) {
        clr();
        let any = false;
        for (const u of labels) {
            const base = (dp.get(u) as number[])[f] as number;
            if (base === Infinity) continue;
            setN(u, "comparing");
            for (const [v, cost, fuel] of wadj[u] ?? []) {
                const nf = f + fuel;
                if (nf > R) continue;
                if (base + cost < ((dp.get(v) as number[])[nf] as number)) {
                    (dp.get(v) as number[])[nf] = base + cost;
                    (par.get(v) as Array<string | null>)[nf] = u;
                    setE(u, v, "active");
                    any = true;
                }
            }
        }
        const bestT = Math.min(...(dp.get(target) as number[]));
        yield snap(
            any
                ? `Fuel layer ${f}: relaxing all affordable edges from vertices reachable on fuel ${f}.`
                : `Fuel layer ${f}: no vertex is reachable on this fuel level.`,
            3,
            { fuel: f, settled: f + 1, visits: f + 1 },
        );
        step += 1;
        void bestT;
        if (step > 12) break;
    }
    let bf = 0;
    let bc = Infinity;
    (dp.get(target) as number[]).forEach((c, f) => {
        if (c < bc) {
            bc = c;
            bf = f;
        }
    });
    const path: string[] = [];
    if (bc < Infinity) {
        let cv: string | null = target;
        let cf = bf;
        while (cv !== null) {
            path.unshift(cv);
            const pv = (par.get(cv) as Array<string | null>)[cf];
            if (pv !== null && pv !== undefined && cv !== start) {
                const e = (wadj[pv] ?? []).find(([t]) => t === cv) as [string, number, number];
                cf -= e[2];
            }
            cv = pv as string | null;
        }
    }
    clr();
    for (const v of path) setN(v, "path");
    yield snap(
        bc < Infinity
            ? `Best feasible route ${path.join(" → ")} costs ${bc} on fuel ${bf} within budget ${R}.`
            : `No path from ${start} to ${target} fits inside fuel budget ${R}.`,
        6,
        {
            cost: bc < Infinity ? bc : -1,
            distance: bc < Infinity ? bc : -1,
            path: path.join("→"),
            settled: labels.length,
            visits: R + 1,
        },
    );
}

const module: AlgorithmModule = {
    id: "resource-constrained-shortest-path",
    name: "Resource Constrained Shortest Path",
    category: "shortest-path",
    complexity: { time: "O(R·(V + E))", space: "O(R·V)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2, 3],
                ["C", 4, 1],
            ],
            B: [["D", 2, 1]],
            C: [["D", 1, 1]],
            D: [],
        },
        start: "A",
        target: "D",
        budget: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "dp[s][0] ← 0, all other dp entries ← infinite",
        "for fuel f ← 0 to budget R in order",
        "for each vertex u reachable on fuel f",
        "for each edge u→v needing fuel q: relax edge",
        "if f+q ≤ R: dp[v][f+q] ← min cost via u",
        "repeat until every fuel layer is expanded",
        "done: cheapest feasible cost to t over all fuel",
    ],
};

export default module;
