/**
 * d-star-lite-replanning.ts – D* Lite Replanning
 *
 * Plans A–B–C–D (4), then edge C→D is blocked: only the inconsistent
 * subtree (rhs ≠ g) is repaired, reusing the rest. New plan A–B–D (6).
 * Time: O(E log V) per repair Space: O(V + E)
 */
import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeGraphNodes, makeWeightedEdges } from "../graph/graph-util";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            graph?: Record<string, Array<[string, number]>>;
            start?: string;
            target?: string;
            blocked?: [string, string];
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
    const blocked = task.blocked ?? ["C", "D"];
    const plan = (
        ban: string | null,
    ): { path: string[]; cost: number; g: Map<string, number> } | null => {
        const g = new Map(labels.map((v) => [v, Infinity]));
        const pr = new Map<string, string | null>(labels.map((v) => [v, null]));
        g.set(start, 0);
        const done = new Set<string>();
        for (;;) {
            let u: string | null = null;
            let bd = Infinity;
            for (const v of labels)
                if (!done.has(v) && (g.get(v) as number) < bd) {
                    bd = g.get(v) as number;
                    u = v;
                }
            if (u === null) break;
            done.add(u);
            if (u === target) break;
            for (const [t, w] of wadj[u] ?? []) {
                if (ban === `${u}|${t}`) continue;
                if ((g.get(u) as number) + w < (g.get(t) as number)) {
                    g.set(t, (g.get(u) as number) + w);
                    pr.set(t, u);
                }
            }
        }
        if ((g.get(target) as number) === Infinity) return null;
        const p: string[] = [];
        let cur: string | null = target;
        while (cur !== null) {
            p.unshift(cur);
            cur = pr.get(cur) as string | null;
        }
        return { path: p, cost: g.get(target) as number, g };
    };
    const initial = plan(null);
    if (!initial) {
        yield snap(`${target} unreachable from ${start}.`, 0, {});
        return;
    }
    for (const v of initial.path) setN(v, "path");
    for (let i = 0; i + 1 < initial.path.length; i += 1)
        setE(initial.path[i] as string, initial.path[i + 1] as string, "path");
    yield snap(
        `Initial plan: ${initial.path.join("→")} (cost ${initial.cost}). Agent starts moving.`,
        0,
        { cost: initial.cost },
    );
    step += 1;
    const [bx, by] = blocked;
    clr();
    setE(bx, by, "swapped");
    setN(by, "highlight");
    yield snap(
        `Sensor update: edge ${bx}→${by} is blocked (cost ∞). ${by} becomes inconsistent.`,
        1,
        {},
    );
    step += 1;
    yield snap(
        `Inconsistent subtree rooted at ${by}: rhs values no longer match g – repair starts.`,
        1,
        {},
    );
    step += 1;
    const repaired = plan(`${bx}|${by}`);
    if (repaired) {
        clr();
        setE(bx, by, "swapped");
        for (const v of repaired.path) setN(v, "comparing");
        yield snap(
            `Repair propagates through inconsistent states: ${repaired.path.join("→")} (cost ${repaired.cost}).`,
            2,
            { cost: repaired.cost },
        );
        step += 1;
        for (const v of repaired.path) setN(v, "path");
    }
    yield snap(
        repaired
            ? `Replanned: ${repaired.path.join("→")} costs ${repaired.cost} (was ${initial.cost}). Only the affected subtree was repaired.`
            : "No route survives the blockage.",
        3,
        { cost: repaired ? repaired.cost : -1 },
    );
}

const module: AlgorithmModule = {
    id: "d-star-lite-replanning",
    name: "D* Lite Replanning",
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
        blocked: ["C", "D"],
    },
    visualType: "graph",
    run,
};

export default module;
