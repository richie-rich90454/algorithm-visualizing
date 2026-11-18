/**
 * pareto-bicriteria-shortest-path.ts – Pareto Bicriteria Shortest Path
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Some routes trade time against cost, so no single path is best on both
 * measures. Each vertex keeps a set of nondominated (time, cost) labels;
 * a label is pruned when another label beats it on both criteria. The
 * surviving skyline at the target is the Pareto frontier. From A to D the
 * frontier holds (4,6) via B and (6,1) direct, while (5,6) is dominated.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L x (V + E)) where L is the frontier size
 *   Space: O(L x V) for the label sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being extended is YELLOW (comparing).
 *   - Extended edges are BLUE (active), reached vertices ORANGE (visited).
 *   - Final frontier paths are CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Dominance pruning keeps only trade-offs worth considering.
 *   - Reduces to Dijkstra when one criterion is ignored.
 *   - Frontier size can explode, which is why the problem is hard.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number, number]>>;
            start?: string;
            target?: string;
        } | null) ?? {};
    const wadj: Record<string, Array<[string, number, number]>> = task.graph ?? {
        A: [
            ["B", 2, 5],
            ["C", 4, 1],
            ["D", 6, 1],
        ],
        B: [["D", 2, 1]],
        C: [["D", 1, 5]],
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
                vs.map(([v, t]) => [v, t] as [string, number]),
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
        yield snap("Empty graph – no trade-offs to explore.", 0);
        return;
    }
    const start = task.start && wadj[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? "D";
    type Label = { t: number; c: number; path: string[] };
    const dom = (a: Label, b: Label): boolean =>
        a.t <= b.t && a.c <= b.c && (a.t < b.t || a.c < b.c);
    const sets = new Map(labels.map((v) => [v, [] as Label[]]));
    (sets.get(start) as Label[]).push({ t: 0, c: 0, path: [start] });
    yield snap(
        `Bicriteria setup from ${start}: labels hold (time, cost) pairs, dominated labels are pruned to keep the skyline.`,
        0,
        { settled: 0, visits: 0 },
    );
    step += 1;
    const order = [start, ...labels.filter((v) => v !== start)];
    for (const u of order) {
        const cur = sets.get(u) as Label[];
        if (cur.length === 0) continue;
        clr();
        setN(u, "comparing");
        for (const [v, dt, dc] of wadj[u] ?? []) {
            for (const l of cur) {
                const nl: Label = { t: l.t + dt, c: l.c + dc, path: [...l.path, v] };
                const vs = sets.get(v) as Label[];
                if (vs.some((x) => dom(x, nl))) continue;
                sets.set(v, [...vs.filter((x) => !dom(nl, x)), nl]);
                setE(u, v, "active");
            }
            setN(v, "visited");
        }
        const atT = (sets.get(target) as Label[]).map((l) => `(${l.t},${l.c})`).join(" ");
        yield snap(
            `Extend labels from ${u} along each outgoing edge: skyline at ${target} so far holds {${atT || "empty"}}.`,
            3,
            { settled: order.indexOf(u) + 1, visits: order.indexOf(u) + 1 },
        );
        step += 1;
    }
    const sky = sets.get(target) as Label[];
    clr();
    for (const l of sky) for (const v of l.path) setN(v, "path");
    yield snap(
        `Pareto frontier at ${target} with ${sky.length} trade-offs: ${sky.map((l) => `(${l.t},${l.c}) via ${l.path.join(" → ")}`).join("; ")}.`,
        6,
        {
            frontier: sky.length,
            settled: labels.length,
            visits: labels.length,
            distance: sky.length,
            path: sky[0]?.path.join("→") ?? "",
        },
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "When routes trade time against cost, no single path is best on both measures. Each vertex keeps a set of nondominated labels, where a label is a pair of criteria values. A label is pruned when another dominates it by being no worse on both and better on at least one, and the surviving skyline at the target is the Pareto frontier.",
        "invariants": [
            "No stored label at a vertex is dominated by another stored label.",
            "Every label corresponds to a real path from the source.",
            "Dominated labels can be dropped without losing any Pareto-optimal path."
        ],
        "correctness": "If a label is dominated, any continuation of it is also dominated by the corresponding continuation of the better label, so pruning it cannot remove a Pareto-optimal path. Extending all surviving labels and pruning again therefore leaves exactly the nondominated labels, and the target's set is the Pareto frontier.",
        "complexityRationale": "With frontier size L, each of V vertices and E edges may process L labels, giving O(L(V + E)) time and O(L V) space for label sets.",
        "uses": [
            "Route planning balancing travel time and toll cost",
            "Multi-objective logistics and supply chain optimization",
            "Trade-off analysis in network design"
        ],
        "references": [
            "Ehrgott, Multicriteria Optimization",
            "Martins, On a Multicriteria Shortest Path Problem (1984)"
        ],
        "workedExample": "From A to D the frontier holds (4,6) via B and (6,1) direct. A label (5,6) is dominated by (4,6) because it is worse in time and equal in cost, so it is pruned and never reaches the target skyline."
    },
    id: "pareto-bicriteria-shortest-path",
    name: "Pareto Bicriteria Shortest Path",
    category: "shortest-path",
    complexity: { time: "O(L·(V + E))", space: "O(L·V)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2, 5],
                ["C", 4, 1],
                ["D", 6, 1],
            ],
            B: [["D", 2, 1]],
            C: [["D", 1, 5]],
            D: [],
        },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "labels[s] ← {(0,0)} with empty skyline elsewhere",
        "process next vertex u holding surviving labels",
        "extend each label over edge u→v adding time, cost",
        "drop new label when an old label dominates it",
        "remove old labels dominated by the new label",
        "repeat until every vertex has been extended",
        "done: labels[t] form the Pareto frontier",
    ],
};

export default module;
