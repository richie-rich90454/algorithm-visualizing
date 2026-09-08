/**
 * pareto-bicriteria-shortest-path.ts – Pareto Bicriteria Shortest Path
 *
 * Labels carry (time, cost) pairs; dominated labels are pruned, the rest
 * form the skyline. A→D: (4,6) via B and (6,1) direct; (5,6) is dominated.
 * Time: O(L·(V + E)) Space: O(L·V)
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
        `Bicriteria labels (time, cost) from ${start}: prune dominated, keep the skyline.`,
        0,
        {},
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
        yield snap(`Extend ${u}: skyline at ${target} so far {${atT || "∅"}}.`, 1, {});
        step += 1;
    }
    const sky = sets.get(target) as Label[];
    clr();
    for (const l of sky) for (const v of l.path) setN(v, "path");
    yield snap(
        `Pareto frontier at ${target}: ${sky.map((l) => `(${l.t},${l.c}) via ${l.path.join("→")}`).join("; ")}.`,
        2,
        { frontier: sky.length },
    );
}

const module: AlgorithmModule = {
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
};

export default module;
