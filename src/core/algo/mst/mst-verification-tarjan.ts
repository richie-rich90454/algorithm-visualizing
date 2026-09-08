/**
 * mst-verification-tarjan.ts - MST Verification (Tarjan).
 * Checks a candidate tree: every non-tree edge must be heaviest on its tree cycle.
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

type In = { vertices: string[]; edges: [string, string, number][]; tree: number[] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const list: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: e[2] }));
    const inTree = new Set<number>(d.tree);
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(d.tree.map((i) => [i, "highlight"] as [number, EntityState]))),
        `Verifying candidate tree of ${d.tree.length} edges against ${list.length - d.tree.length} non-tree edges.`,
        0,
    );
    const adj = new Map<string, Array<{ to: string; w: number }>>();
    for (const v of verts) adj.set(v, []);
    for (const i of d.tree) {
        const e = list[i] as E3;
        adj.get(e.a)?.push({ to: e.b, w: e.w });
        adj.get(e.b)?.push({ to: e.a, w: e.w });
    }
    const pathMax = (s: string, t: string): number => {
        const prev = new Map<string, { p: string; w: number }>();
        const q = [s];
        prev.set(s, { p: "", w: 0 });
        while (q.length > 0) {
            const u = q.shift() as string;
            if (u === t) break;
            for (const nb of adj.get(u) ?? [])
                if (!prev.has(nb.to)) {
                    prev.set(nb.to, { p: u, w: nb.w });
                    q.push(nb.to);
                }
        }
        let m = 0;
        let c = t;
        while (c !== s) {
            const pr = prev.get(c);
            if (!pr) return Infinity;
            m = Math.max(m, pr.w);
            c = pr.p;
        }
        return m;
    };
    let ok = d.tree.length === verts.length - 1;
    for (let i = 0; i < list.length; i += 1) {
        if (inTree.has(i)) continue;
        const e = list[i] as E3;
        const m = pathMax(e.a, e.b);
        yield FR(
            step++,
            N(verts),
            ME(list, new Map([[i, "comparing"]])),
            `Non-tree edge ${e.a}-${e.b} (${e.w}): heaviest tree-path edge is ${m}.`,
            1,
        );
        const good = m <= e.w;
        ok = ok && good;
        yield FR(
            step++,
            N(verts),
            ME(list, new Map([[i, good ? "sorted" : "swapped"]])),
            good
                ? `${e.a}-${e.b} (${e.w}) >= path max ${m}: cycle property holds.`
                : `${e.a}-${e.b} (${e.w}) < path max ${m}: NOT minimum.`,
            2,
        );
    }
    const weight = d.tree.reduce((s, i) => s + (list[i] as E3).w, 0);
    yield FR(
        step++,
        N(verts),
        ME(
            list,
            new Map(d.tree.map((i) => [i, ok ? "sorted" : "swapped"] as [number, EntityState])),
        ),
        ok
            ? `Valid MST of weight ${weight}: every non-tree edge is heaviest on its cycle.`
            : `Invalid: candidate weight ${weight} is not minimum.`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "mst-verification-tarjan",
    name: "MST Verification (Tarjan)",
    category: "mst",
    complexity: { time: "O(E alpha(V))", space: "O(V + E)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D"],
        edges: [
            ["A", "B", 1],
            ["B", "C", 2],
            ["C", "D", 3],
            ["A", "C", 4],
            ["A", "D", 8],
        ],
        tree: [0, 1, 2],
    },
    visualType: "graph",
    run,
};
export default module;
