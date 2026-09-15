/**
 * replacement-paths.ts – Replacement Paths
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * For every edge on the shortest path, this finds the best route that avoids
 * that edge, which measures how vulnerable each hop is. The demo shortest
 * path A to B to C to D is recomputed with each of its edges forbidden in
 * turn; every detour here costs 6, showing uniform backup quality.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E x (E log V)) naive with one Dijkstra per edge
 *   Space: O(V + E) for distances and predecessors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The base shortest path is CYAN (path).
 *   - The forbidden edge flashes ORANGE (swapped).
 *   - Each detour is YELLOW (comparing).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Quantifies the detour cost of losing any single road.
 *   - A missing detour means that edge is a bridge for this query.
 *   - Advanced methods beat the naive rerun, but this shows the idea.
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
        } | null) ?? {};
    const wadj: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 5],
        ],
        B: [
            ["C", 1],
            ["D", 4],
        ],
        C: [["D", 1]],
        D: [],
    };

    const labels = [
        ...new Set([
            ...Object.keys(wadj),
            ...Object.values(wadj).flatMap((vs) => vs.map(([v]) => v)),
        ]),
    ];
    const nodes = makeGraphNodes(labels.length > 0 ? labels : ["A"]);
    const edges = makeWeightedEdges(wadj);
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
        meta: Record<string, number | string | boolean | Array<number | string>> = {},
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
        yield snap("Empty graph – nothing to route.", 0);
        return;
    }
    const start = task.start && wadj[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? "D";
    const shortest = (ban: string | null): { path: string[]; cost: number } | null => {
        const d = new Map(labels.map((v) => [v, Infinity]));
        const pr = new Map<string, string | null>(labels.map((v) => [v, null]));
        d.set(start, 0);
        const done = new Set<string>();
        for (;;) {
            let u: string | null = null;
            let bd = Infinity;
            for (const v of labels)
                if (!done.has(v) && (d.get(v) as number) < bd) {
                    bd = d.get(v) as number;
                    u = v;
                }
            if (u === null) break;
            done.add(u);
            if (u === target) break;
            for (const [t, w] of wadj[u] ?? []) {
                if (ban === `${u}|${t}`) continue;
                if ((d.get(u) as number) + w < (d.get(t) as number)) {
                    d.set(t, (d.get(u) as number) + w);
                    pr.set(t, u);
                }
            }
        }
        if ((d.get(target) as number) === Infinity) return null;
        const p: string[] = [];
        let cur: string | null = target;
        while (cur !== null) {
            p.unshift(cur);
            cur = pr.get(cur) as string | null;
        }
        return { path: p, cost: d.get(target) as number };
    };
    const base = shortest(null);
    if (!base) {
        yield snap(`${target} unreachable from ${start}.`, 0, {});
        return;
    }
    for (const v of base.path) setN(v, "path");
    yield snap(
        `Shortest base path from ${start} to ${target}: ${base.path.join(" → ")} with cost ${base.cost}. Avoiding each edge in turn.`,
        0,
        { cost: base.cost, settled: base.path.length, visits: base.path.length },
    );
    step += 1;
    const reps: Array<{ edge: string; cost: number; path: string[] }> = [];
    for (let i = 0; i + 1 < base.path.length; i += 1) {
        const a = base.path[i] as string;
        const b = base.path[i + 1] as string;
        const alt = shortest(`${a}|${b}`);
        clr();
        setE(a, b, "swapped");
        if (alt) {
            reps.push({ edge: `${a}→${b}`, cost: alt.cost, path: alt.path });
            for (const v of alt.path) setN(v, "comparing");
            yield snap(
                `Without edge ${a} to ${b} of the base path: detour ${alt.path.join(" → ")} costs ${alt.cost}.`,
                3,
                {
                    detour: alt.cost,
                    settled: i + 1,
                    visits: i + 1,
                },
            );
        } else {
            yield snap(
                `Without edge ${a} to ${b}: no detour exists and ${target} is disconnected.`,
                3,
                { detour: -1, settled: i + 1, visits: i + 1 },
            );
        }
        step += 1;
    }
    yield snap(
        `Replacement costs from ${start} to ${target}: ${reps.map((r) => `${r.edge} needs ${r.cost}`).join(", ")}.`,
        6,
        {
            replacements: reps.map((r) => `${r.edge}↦${r.cost}`),
            baseCost: base.cost,
            settled: base.path.length,
            visits: reps.length,
            distance: base.cost,
            path: base.path.join("→"),
        },
    );
}

const module: AlgorithmModule = {
    id: "replacement-paths",
    name: "Replacement Paths",
    category: "shortest-path",
    complexity: { time: "O(E·(E log V))", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
            ],
            B: [
                ["C", 1],
                ["D", 4],
            ],
            C: [["D", 1]],
            D: [],
        },
        start: "A",
        target: "D",
    },
    visualType: "graph",
    run,
    pseudocode: [
        "compute shortest path P from s to t via Dijkstra",
        "for each edge e on path P in order",
        "forbid e and rerun Dijkstra from source s",
        "record detour cost or mark target disconnected",
        "restore e before testing the next edge",
        "repeat until every edge of P is tested",
        "done: table of best avoidance cost per edge",
    ],
};

export default module;
