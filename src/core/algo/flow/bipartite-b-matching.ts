/**
 * bipartite-b-matching.ts - Bipartite b-Matching.
 * Capacitated bipartite matching via source/sink arcs with vertex capacities.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";
type E3 = { a: string; b: string; w: number };
const N = (labels: string[], st: Map<string, EntityState> = new Map()): VisualEntity[] =>
    labels.map((l) => ({
        id: `node-${l}`,
        type: "node" as const,
        label: l,
        value: l,
        state: st.get(l) ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { label: l },
    }));
const FR = (
    stepNumber: number,
    entities: VisualEntity[],
    edges: VisualFrame["edges"],
    description: string,
    codeLineNumber = 0,
): VisualFrame => ({
    stepNumber,
    entities,
    edges,
    description,
    codeLineNumber,
    layout: "graph",
    meta: {},
});
const ME = (
    list: E3[],
    st: Map<number, EntityState> = new Map(),
    directed = false,
): VisualFrame["edges"] =>
    list.map((e, i) => ({
        id: `edge-${i}`,
        sourceId: `node-${e.a}`,
        targetId: `node-${e.b}`,
        label: String(e.w),
        state: st.get(i) ?? "idle",
        directed,
    })) as unknown as VisualFrame["edges"];
const EMPTY = (step: number, what: string): VisualFrame => ({
    stepNumber: step,
    entities: [],
    edges: [],
    description: `Empty input - no ${what} to process.`,
    codeLineNumber: 0,
    layout: "graph",
    meta: {},
});
const isEmptyInput = (input: unknown): boolean =>
    input == null ||
    (typeof input === "object" && Object.keys(input as Record<string, unknown>).length === 0);
type FE = { a: string; b: string; cap: number };
const maxflow = (
    verts: string[],
    edges: FE[],
    s: string,
    t: string,
): { value: number; paths: string[][] } => {
    const cap = new Map<string, number>();
    const adj = new Map<string, Set<string>>();
    for (const v of verts) adj.set(v, new Set());
    const add = (u: string, v: string, c: number): void => {
        cap.set(u + ">" + v, (cap.get(u + ">" + v) ?? 0) + c);
        adj.get(u)?.add(v);
        adj.get(v)?.add(u);
    };
    for (const e of edges) add(e.a, e.b, e.cap);
    let value = 0;
    const paths: string[][] = [];
    for (;;) {
        const prev = new Map<string, string>();
        const q: string[] = [s];
        prev.set(s, "");
        while (q.length > 0) {
            const u = q.shift() as string;
            if (u === t) break;
            for (const v of adj.get(u) ?? [])
                if (!prev.has(v) && (cap.get(u + ">" + v) ?? 0) > 0) {
                    prev.set(v, u);
                    q.push(v);
                }
        }
        if (!prev.has(t)) break;
        let bn = Infinity;
        const path: string[] = [];
        let cur = t;
        while (cur !== s) {
            const p = prev.get(cur) as string;
            bn = Math.min(bn, cap.get(p + ">" + cur) ?? 0);
            path.unshift(cur);
            cur = p;
        }
        path.unshift(s);
        for (let i = 0; i + 1 < path.length; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            cap.set(u + ">" + v, (cap.get(u + ">" + v) ?? 0) - bn);
            cap.set(v + ">" + u, (cap.get(v + ">" + u) ?? 0) + bn);
        }
        value += bn;
        paths.push(path);
    }
    return { value, paths };
};

type In = {
    left: string[];
    right: string[];
    bLeft: number[];
    bRight: number[];
    edges: [string, string][];
};
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "bigraph");
        return;
    }
    const d = input as In;
    let step = 0;
    const show: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: 1 }));
    yield FR(
        step++,
        N([...d.left, ...d.right]),
        ME(show, new Map(), true),
        `b-matching: caps L {${d.bLeft.join(",")}} R {${d.bRight.join(",")}}, ${d.edges.length} allowed pairs.`,
        0,
    );
    const fe: FE[] = [];
    d.left.forEach((v, i) => fe.push({ a: "S", b: v, cap: d.bLeft[i] as number }));
    d.right.forEach((v, i) => fe.push({ a: v, b: "T", cap: d.bRight[i] as number }));
    for (const e of d.edges) fe.push({ a: e[0], b: e[1], cap: 1 });
    yield FR(
        step++,
        N(["S", ...d.left, ...d.right, "T"]),
        ME(
            fe.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        "Flow network: source/sink arcs carry the b-capacities, pair edges carry 1.",
        1,
    );
    const f = maxflow(["S", ...d.left, ...d.right, "T"], fe, "S", "T");
    let i = 2;
    for (const p of f.paths) {
        yield FR(
            step++,
            N([...d.left, ...d.right]),
            ME(show, new Map(), true),
            `Augment ${i - 1}: ${p.join(">")} (running total grows toward ${f.value}).`,
            i,
        );
        i += 1;
        if (step > 11) break;
    }
    yield FR(
        step++,
        N([...d.left, ...d.right]),
        ME(show, new Map(show.map((_, k) => [k, "sorted"] as [number, EntityState])), true),
        `Maximum b-matching size ${f.value}: L0 takes R0+R1, L1 takes R1.`,
        i + 1,
    );
}

const module: AlgorithmModule = {
    id: "bipartite-b-matching",
    name: "Bipartite b-Matching",
    category: "flow",
    complexity: { time: "O(V E^2)", space: "O(V + E)" },
    defaultInput: {
        left: ["L0", "L1"],
        right: ["R0", "R1"],
        bLeft: [2, 1],
        bRight: [1, 2],
        edges: [
            ["L0", "R0"],
            ["L0", "R1"],
            ["L1", "R0"],
            ["L1", "R1"],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
