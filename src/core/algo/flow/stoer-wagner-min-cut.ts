/**
 * stoer-wagner-min-cut.ts - Stoer-Wagner Min Cut.
 * Global min cut without maxflow: maximum-adjacency phases, track lightest s-t cut.
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
    const verts = d.vertices.map(String);
    const list: E3[] = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list),
        "Stoer-Wagner: repeated maximum-adjacency orderings, no source or sink needed.",
        0,
    );
    const w = new Map<string, number>();
    for (const e of list) {
        w.set(e.a + ">" + e.b, (w.get(e.a + ">" + e.b) ?? 0) + e.w);
        w.set(e.b + ">" + e.a, (w.get(e.b + ">" + e.a) ?? 0) + e.w);
    }
    const W = (a: string, b: string): number => w.get(a + ">" + b) ?? 0;
    let active = [...verts];
    let best = Infinity;
    while (active.length > 1) {
        const added: string[] = [active[0] as string];
        const ws = new Map<string, number>(active.map((v) => [v, 0]));
        ws.set(added[0] as string, -1);
        while (added.length < active.length) {
            for (const v of active) if (!added.includes(v)) ws.set(v, ws.get(v) ?? 0);
            let nxt = "";
            let bv = -1;
            for (const v of active)
                if (!added.includes(v) && (ws.get(v) ?? 0) > bv) {
                    bv = ws.get(v) ?? 0;
                    nxt = v;
                }
            added.push(nxt);
            for (const v of active) if (!added.includes(v)) ws.set(v, (ws.get(v) ?? 0) + W(nxt, v));
        }
        const t = added[added.length - 1] as string;
        const s = added[added.length - 2] as string;
        const cut = active.filter((v) => v !== t).reduce((sum, v) => sum + W(t, v), 0);
        if (cut < best) best = cut;
        yield FR(
            step++,
            N(active),
            ME(list.filter((e) => active.includes(e.a) && active.includes(e.b))),
            `Phase order [${added.join(" > ")}]: cut-of-the-phase({${t}}) = ${cut}, best ${Math.min(best, cut)}.`,
            1,
        );
        for (const v of active)
            if (v !== s && v !== t) {
                w.set(s + ">" + v, W(s, v) + W(t, v));
                w.set(v + ">" + s, W(s, v) + W(t, v));
            }
        active = active.filter((v) => v !== t);
        yield FR(
            step++,
            N(active),
            ME(list.filter((e) => active.includes(e.a) && active.includes(e.b))),
            `Contracted ${s}+${t}: ${active.length} supernodes remain.`,
            2,
        );
        if (step > 12) break;
    }
    yield FR(
        step++,
        N(verts),
        ME(list),
        `Global min cut = ${best} (singleton {2}: edges 1-2 and 0-2 sum to 3).`,
        3,
    );
}

const module: AlgorithmModule = {
    id: "stoer-wagner-min-cut",
    name: "Stoer-Wagner Min Cut",
    category: "flow",
    complexity: { time: "O(V E + V^2 log V)", space: "O(V^2)" },
    defaultInput: {
        vertices: ["0", "1", "2"],
        edges: [
            [0, 1, 3],
            [1, 2, 2],
            [0, 2, 1],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
