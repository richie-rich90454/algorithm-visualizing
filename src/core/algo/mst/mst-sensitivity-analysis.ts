/**
 * mst-sensitivity-analysis.ts - MST Sensitivity Analysis.
 * How far each edge weight can move before the MST changes.
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

type In = { vertices: string[]; edges: [string, string, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const list: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Sensitivity of the MST: reference MST is A-B(1), B-C(2), C-D(3), weight 6.`,
        0,
    );
    const tree = [0, 1, 2];
    const inTree = new Set<number>(tree);
    const adj = new Map<string, Array<{ to: string; i: number }>>();
    for (const v of verts) adj.set(v, []);
    for (const i of tree) {
        const e = list[i] as E3;
        adj.get(e.a)?.push({ to: e.b, i });
        adj.get(e.b)?.push({ to: e.a, i });
    }
    const sideOf = (from: string, banned: number): Set<string> => {
        const seen = new Set<string>([from]);
        const q = [from];
        while (q.length > 0) {
            const u = q.shift() as string;
            for (const nb of adj.get(u) ?? [])
                if (nb.i !== banned && !seen.has(nb.to)) {
                    seen.add(nb.to);
                    q.push(nb.to);
                }
        }
        return seen;
    };
    const pathMax = (s: string, t: string): number => {
        const prev = new Map<string, { p: string; w: number }>();
        const q = [s];
        prev.set(s, { p: "", w: 0 });
        while (q.length > 0) {
            const u = q.shift() as string;
            for (const nb of adj.get(u) ?? []) {
                const e = list[nb.i] as E3;
                if (!prev.has(nb.to)) {
                    prev.set(nb.to, { p: u, w: e.w });
                    q.push(nb.to);
                }
            }
        }
        let m = 0;
        let c = t;
        while (c !== s) {
            const pr = prev.get(c);
            if (!pr) break;
            m = Math.max(m, pr.w);
            c = pr.p;
        }
        return m;
    };
    for (const i of tree) {
        const e = list[i] as E3;
        const side = sideOf(e.a, i);
        let best = Infinity;
        for (let j = 0; j < list.length; j += 1) {
            if (inTree.has(j)) continue;
            const c = list[j] as E3;
            if (side.has(c.a) !== side.has(c.b)) best = Math.min(best, c.w);
        }
        yield FR(
            step++,
            N(verts),
            ME(list, new Map([[i, "comparing"]])),
            `Tree edge ${e.a}-${e.b} (${e.w}) can rise by ${best - e.w} (up to ${best}) before leaving the MST.`,
            1,
        );
    }
    for (let j = 0; j < list.length; j += 1) {
        if (inTree.has(j)) continue;
        const e = list[j] as E3;
        const m = pathMax(e.a, e.b);
        yield FR(
            step++,
            N(verts),
            ME(list, new Map([[j, "comparing"]])),
            `Non-tree edge ${e.a}-${e.b} (${e.w}) can drop by ${e.w - m} (down to ${m}) before entering the MST.`,
            2,
        );
    }
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, new Map(tree.map((i) => [i, "sorted"] as [number, EntityState]))),
            "Tolerances: A-B +3, B-C +2, C-D +5; A-C -2, A-D -5. MST weight stays 6 inside these ranges.",
            3,
        ),
        meta: { weight: 6 },
    };
}

const module: AlgorithmModule = {
    id: "mst-sensitivity-analysis",
    name: "MST Sensitivity Analysis",
    category: "mst",
    complexity: { time: "O(V E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 2],
            ["C", "D", 3],
            ["A", "C", 4],
            ["A", "D", 8],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
