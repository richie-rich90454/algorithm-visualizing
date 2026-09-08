/**
 * yen-k-shortest-paths.ts – Yen's K Shortest Paths
 *
 * Takes the best path, then deviates: for each spur node, forbid the used
 * edge and re-run Dijkstra. k=3: costs 4, 6, 6.
 * Time: O(k·V·(E log V)) Space: O(k·V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            k?: number;
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
    const k = task.k ?? 3;
    const cost = (p: string[]): number => {
        let s = 0;
        for (let i = 0; i + 1 < p.length; i += 1)
            s += (wadj[p[i] as string] ?? []).find(([v]) => v === p[i + 1])?.[1] ?? Infinity;
        return s;
    };
    const dijkstra = (banN: Set<string>, banE: Set<string>): string[] | null => {
        const d = new Map(labels.map((v) => [v, Infinity]));
        const pr = new Map<string, string | null>(labels.map((v) => [v, null]));
        d.set(start, 0);
        const done = new Set<string>();
        for (;;) {
            let u: string | null = null;
            let bd = Infinity;
            for (const v of labels)
                if (!done.has(v) && !banN.has(v) && (d.get(v) as number) < bd) {
                    bd = d.get(v) as number;
                    u = v;
                }
            if (u === null) break;
            done.add(u);
            if (u === target) break;
            for (const [v, w] of wadj[u] ?? []) {
                if (banN.has(v) || banE.has(`${u}|${v}`)) continue;
                if ((d.get(u) as number) + w < (d.get(v) as number)) {
                    d.set(v, (d.get(u) as number) + w);
                    pr.set(v, u);
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
        return p[0] === start ? p : null;
    };
    yield snap(`Yen's algorithm: ${k} shortest loopless paths ${start}→${target}.`, 0, { k });
    step += 1;
    const first = dijkstra(new Set(), new Set());
    if (!first) {
        yield snap(`${target} unreachable from ${start}.`, 1, {});
        return;
    }
    const A: string[][] = [first];
    clr();
    for (const v of first) setN(v, "path");
    yield snap(`P1 = ${first.join("→")} (cost ${cost(first)}).`, 1, { paths: 1 });
    step += 1;
    const seenP = new Set([first.join(",")]);
    const cands: Array<{ p: string[]; c: number }> = [];
    for (let ki = 1; ki < k; ki += 1) {
        const prev = A[A.length - 1] as string[];
        for (let i = 0; i + 1 < prev.length; i += 1) {
            const root = prev.slice(0, i + 1);
            const banE = new Set<string>();
            const banN = new Set<string>(root.slice(0, -1));
            for (const p of A) {
                if (p.length > i && root.join(",") === p.slice(0, i + 1).join(","))
                    banE.add(`${p[i]}|${p[i + 1]}`);
            }
            const spur = dijkstra(banN, banE);
            if (spur && spur[0] === root[root.length - 1]) {
                const full = [...root.slice(0, -1), ...spur];
                const key = full.join(",");
                if (!seenP.has(key)) {
                    seenP.add(key);
                    cands.push({ p: full, c: cost(full) });
                }
            }
        }
        if (cands.length === 0) break;
        cands.sort((x, y) => x.c - y.c);
        const next = cands.shift() as { p: string[]; c: number };
        A.push(next.p);
        clr();
        for (const v of next.p) setN(v, "comparing");
        yield snap(
            `P${ki + 1} = ${next.p.join("→")} (cost ${next.c}) – best surviving spur candidate.`,
            2,
            { paths: A.length },
        );
        step += 1;
    }
    yield snap(`${k} shortest: ${A.map((p) => `${p.join("→")}(${cost(p)})`).join("; ")}.`, 3, {
        paths: A.length,
    });
}

const module: AlgorithmModule = {
    id: "yen-k-shortest-paths",
    name: "Yen's K Shortest Paths",
    category: "shortest-path",
    complexity: { time: "O(k·V·(E log V))", space: "O(k·V + E)" },
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
        k: 3,
    },
    visualType: "graph",
    run,
};

export default module;
