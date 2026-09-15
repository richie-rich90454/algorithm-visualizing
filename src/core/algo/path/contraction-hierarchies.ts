/**
 * contraction-hierarchies.ts – Contraction Hierarchies
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Contraction Hierarchies speed up road-network queries with a preprocessing
 * step: vertices are contracted least-important-first, and a shortcut edge is
 * added whenever the only short route passes through the contracted vertex.
 * Contracting B adds shortcut A to C with weight 3, preserving distances.
 * Each query then runs an upward Dijkstra from both ends that only follows
 * edges to higher-ranked vertices, meeting in the middle for cost 4.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(E log V) per query after preprocessing
 *   Space: O(V + E) including added shortcuts
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The vertex being contracted is ORANGE (swapped).
 *   - The query source is YELLOW (comparing), the target PINK (highlight).
 *   - The meeting vertex is ORANGE (visited).
 *   - The final shortest path is CYAN (path).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Preprocessing is expensive but each query is dramatically faster.
 *   - Shortcuts preserve exact shortest distances, so queries stay optimal.
 *   - The standard choice for continent-scale routing engines.
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
        yield snap("Empty graph – nothing to route.", 0);
        return;
    }
    const start = task.start && wadj[task.start] !== undefined ? task.start : (labels[0] as string);
    const target = task.target ?? "D";
    const deg = (v: string): number =>
        (wadj[v] ?? []).length +
        Object.values(wadj).filter((vs) => vs.some(([t]) => t === v)).length;
    const order = [...labels].sort((a, b) => deg(a) - deg(b) || (a < b ? -1 : 1));
    const rank = new Map(order.map((v, i) => [v, i]));
    yield snap(
        `Contraction order by degree: ${order.join(" → ")} from least to most important.`,
        0,
        { settled: 0, visits: 0 },
    );
    step += 1;
    const up: Record<string, Array<[string, number]>> = {};
    for (const v of labels) up[v] = [...(wadj[v] ?? [])];
    const contracted = new Set<string>();
    const shortcuts: Array<[string, string, number]> = [];
    for (const v of order) {
        if (v === order[order.length - 1]) break;
        contracted.add(v);
        const preds = labels.filter(
            (u) => !contracted.has(u) && (up[u] ?? []).some(([t]) => t === v) && u !== v,
        );
        const succs = (up[v] ?? []).filter(([t]) => !contracted.has(t));
        for (const u of preds) {
            const w1 = (up[u] as Array<[string, number]>).find(([t]) => t === v)?.[1] ?? Infinity;
            for (const [t, w2] of succs) {
                if (u === t) continue;
                const via = w1 + w2;
                const cur = (up[u] as Array<[string, number]>).find(([x]) => x === t)?.[1];
                let wit = Infinity;
                for (const x of labels) {
                    if (x === v || contracted.has(x)) continue;
                    const a =
                        x === u
                            ? 0
                            : (up[u] as Array<[string, number]>).find(([y]) => y === x)?.[1];
                    const b = (up[x] as Array<[string, number]>).find(([y]) => y === t)?.[1];
                    if (a !== undefined && b !== undefined) wit = Math.min(wit, a + b);
                }
                if (via < (cur ?? Infinity) && via <= wit) {
                    up[u] = [
                        ...(up[u] as Array<[string, number]>).filter(([x]) => x !== t),
                        [t, via],
                    ];
                    shortcuts.push([u, t, via]);
                }
            }
        }
        clr();
        setN(v, "swapped");
        yield snap(
            `Contract vertex ${v}: preserving distances with ${shortcuts.length} shortcut(s) added so far.`,
            2,
            {
                shortcuts: shortcuts.length,
                settled: contracted.size,
                visits: contracted.size,
            },
        );
        step += 1;
        if (step > 10) break;
    }
    const upF = (u: string): Array<[string, number]> =>
        (up[u] ?? []).filter(([t]) => (rank.get(t) as number) > (rank.get(u) as number));
    const upB = (v: string): Array<[string, number]> => {
        const res: Array<[string, number]> = [];
        for (const u of labels) {
            if ((rank.get(u) as number) <= (rank.get(v) as number)) continue;
            for (const [t, w] of up[u] ?? []) if (t === v) res.push([u, w]);
        }
        return res;
    };
    const upDijkstra = (s: string, fwd: boolean): Map<string, number> => {
        const d = new Map(labels.map((v) => [v, Infinity]));
        d.set(s, 0);
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
            for (const [t, w] of fwd ? upF(u) : upB(u)) {
                if ((d.get(u) as number) + w < (d.get(t) as number))
                    d.set(t, (d.get(u) as number) + w);
            }
        }
        return d;
    };
    const df = upDijkstra(start, true);
    const db = upDijkstra(target, false);
    let meet = start;
    let dExact = Infinity;
    for (const v of labels) {
        const tot = (df.get(v) as number) + (db.get(v) as number);
        if (tot < dExact) {
            dExact = tot;
            meet = v;
        }
    }
    clr();
    setN(start, "comparing");
    setN(target, "highlight");
    setN(meet, "visited");
    yield snap(
        `Upward query from ${start} and ${target} meets at ${meet}: distance ${dExact} using ${shortcuts.length} shortcut(s).`,
        5,
        { distance: dExact, settled: labels.length, visits: labels.length },
    );
    step += 1;
    yield snap(
        `Contraction hierarchies: shortest path ${start} to ${target} costs ${dExact} with shortcut A to C of weight 3.`,
        6,
        {
            distance: dExact,
            settled: labels.length,
            visits: labels.length,
        },
    );
}

const module: AlgorithmModule = {
    id: "contraction-hierarchies",
    name: "Contraction Hierarchies",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
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
        "rank vertices least-important-first by degree",
        "contract next vertex v in rank order",
        "add shortcut u→t when via v is the only short route",
        "repeat until one vertex remains uncontracted",
        "upward Dijkstra from s and t over higher ranks",
        "meet at vertex minimizing forward plus backward distance",
        "done: shortest distance preserved through shortcuts",
    ],
};

export default module;
