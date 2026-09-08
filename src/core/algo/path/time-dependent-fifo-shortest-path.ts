/**
 * time-dependent-fifo-shortest-path.ts – Time-Dependent FIFO Shortest Path
 *
 * Waiting never helps when arrival functions are FIFO (departing later
 * cannot arrive earlier): earliest-arrival Dijkstra works. Depart t=0:
 * A→B→D arrives t=4, beating A→C→D at t=6.
 * Time: O(E log V) Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            depart?: number;
        } | null) ?? {};
    const wadj: Record<string, Array<[string, number]>> = task.graph ?? {
        A: [
            ["B", 2],
            ["C", 5],
        ],
        B: [["D", 2]],
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
    const t0 = task.depart ?? 0;
    const arr = (u: string, v: string, t: number): number => {
        const w = (wadj[u] ?? []).find(([x]) => x === v)?.[1] ?? Infinity;
        return t + w;
    };
    const best = new Map(labels.map((v) => [v, Infinity]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    best.set(start, t0);
    const done = new Set<string>();
    setN(start, "comparing");
    yield snap(`Time-dependent FIFO from ${start} at t=${t0}: earliest arrival first.`, 0, {
        depart: t0,
    });
    step += 1;
    while (done.size < labels.length) {
        let u: string | null = null;
        let bt = Infinity;
        for (const v of labels)
            if (!done.has(v) && (best.get(v) as number) < bt) {
                bt = best.get(v) as number;
                u = v;
            }
        if (u === null || bt === Infinity) break;
        done.add(u);
        clr();
        setN(u, "comparing");
        for (const [v] of wadj[u] ?? []) {
            const at = arr(u, v, bt);
            if (at < (best.get(v) as number)) {
                best.set(v, at);
                prev.set(v, u);
                setE(u, v, "active");
                setN(v, "visited");
            }
        }
        setN(u, "sorted");
        yield snap(`Settle ${u} at t=${bt}: relax departures from here.`, 1, { time: bt });
        step += 1;
    }
    const path: string[] = [];
    let cur: string | null = target;
    while (cur !== null) {
        path.unshift(cur);
        cur = prev.get(cur) as string | null;
    }
    const ok = path[0] === start;
    clr();
    if (ok) for (const v of path) setN(v, "path");
    yield snap(
        ok
            ? `Earliest arrival at ${target}: t=${best.get(target)} via ${path.join("→")}.`
            : `${target} unreachable.`,
        2,
        { arrival: ok ? (best.get(target) as number) : -1 },
    );
}

const module: AlgorithmModule = {
    id: "time-dependent-fifo-shortest-path",
    name: "Time-Dependent FIFO Shortest Path",
    category: "shortest-path",
    complexity: { time: "O(E log V)", space: "O(V + E)" },
    defaultInput: {
        graph: {
            A: [
                ["B", 2],
                ["C", 5],
            ],
            B: [["D", 2]],
            C: [["D", 1]],
            D: [],
        },
        start: "A",
        target: "D",
        depart: 0,
    },
    visualType: "graph",
    run,
};

export default module;
