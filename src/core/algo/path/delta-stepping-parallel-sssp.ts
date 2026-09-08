/**
 * delta-stepping-parallel-sssp.ts – Delta-Stepping (Parallel SSSP)
 *
 * Buckets of width Δ group vertices by distance so each bucket relaxes in
 * parallel; light edges stay inside, heavy edges jump ahead. Δ=2 on the
 * demo graph settles A, B, C, D at 0, 2, 3, 4.
 * Time: O(E + V·(L/Δ)) Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            delta?: number;
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
    const delta = task.delta ?? 2;
    const dist = new Map(labels.map((v) => [v, Infinity]));
    const prev = new Map<string, string | null>(labels.map((v) => [v, null]));
    dist.set(start, 0);
    const buckets = new Map<number, Set<string>>();
    const put = (v: string): void => {
        const b = Math.floor((dist.get(v) as number) / delta);
        if (!buckets.has(b)) buckets.set(b, new Set());
        (buckets.get(b) as Set<string>).add(v);
    };
    put(start);
    yield snap(`Delta-stepping Δ=${delta} from ${start}: buckets hold [kΔ, (k+1)Δ).`, 0, { delta });
    step += 1;
    let guard = 0;
    for (;;) {
        guard += 1;
        if (guard > 12) break;
        const keys = [...buckets.keys()].filter((k) => (buckets.get(k) as Set<string>).size > 0);
        if (keys.length === 0) break;
        const b = Math.min(...keys);
        const bucket = new Set(buckets.get(b) as Set<string>);
        buckets.set(b, new Set());
        clr();
        for (const v of bucket) setN(v, "comparing");
        const light = [...bucket];
        for (const u of light) {
            for (const [v, w] of wadj[u] ?? []) {
                if (w > delta) continue;
                if ((dist.get(u) as number) + w < (dist.get(v) as number)) {
                    const ob = Math.floor((dist.get(v) as number) / delta);
                    if (buckets.has(ob)) (buckets.get(ob) as Set<string>).delete(v);
                    dist.set(v, (dist.get(u) as number) + w);
                    prev.set(v, u);
                    put(v);
                    setE(u, v, "active");
                }
            }
        }
        for (const u of light) {
            for (const [v, w] of wadj[u] ?? []) {
                if (w <= delta) continue;
                if ((dist.get(u) as number) + w < (dist.get(v) as number)) {
                    const ob = Math.floor((dist.get(v) as number) / delta);
                    if (buckets.has(ob)) (buckets.get(ob) as Set<string>).delete(v);
                    dist.set(v, (dist.get(u) as number) + w);
                    prev.set(v, u);
                    put(v);
                    setE(u, v, "highlight");
                }
            }
        }
        for (const v of bucket) setN(v, "sorted");
        yield snap(
            `Bucket ${b} [${b * delta}, ${(b + 1) * delta}): relax light edges in parallel, then heavy.`,
            1,
            { bucket: b },
        );
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
            ? `Shortest ${start}→${target} = ${dist.get(target)} via ${path.join("→")}.`
            : `${target} unreachable.`,
        2,
        { distance: ok ? (dist.get(target) as number) : -1 },
    );
}

const module: AlgorithmModule = {
    id: "delta-stepping-parallel-sssp",
    name: "Delta-Stepping (Parallel SSSP)",
    category: "shortest-path",
    complexity: { time: "O(E + V·(L/Δ))", space: "O(V + E)" },
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
        delta: 2,
    },
    visualType: "graph",
    run,
};

export default module;
