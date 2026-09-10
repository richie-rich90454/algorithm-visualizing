/**
 * replacement-paths.ts – Replacement Paths
 *
 * For each edge of the shortest path, the best route that avoids it: the
 * detour quality of every hop. A–B–C–D edges each detour at cost 6.
 * Time: O(E·(E log V)) naive Space: O(V + E)
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
        `Shortest path: ${base.path.join("→")} (cost ${base.cost}). Avoid each edge in turn.`,
        0,
        { cost: base.cost },
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
            yield snap(`Without ${a}→${b}: detour ${alt.path.join("→")} costs ${alt.cost}.`, 1, {
                detour: alt.cost,
            });
        } else {
            yield snap(`Without ${a}→${b}: no route – ${target} disconnected.`, 1, { detour: -1 });
        }
        step += 1;
    }
    yield snap(`Replacement costs: ${reps.map((r) => `${r.edge}↦${r.cost}`).join(", ")}.`, 2, {
        replacements: reps.map((r) => `${r.edge}↦${r.cost}`),
        baseCost: base.cost,
    });
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
};

export default module;
