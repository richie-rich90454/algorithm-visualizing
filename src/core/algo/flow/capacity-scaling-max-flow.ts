/**
 * capacity-scaling-max-flow.ts - Capacity Scaling Max Flow.
 * Push flow along >= Delta bottlenecks while halving Delta: fewer big augments.
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
        yield EMPTY(0, "network");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    const list = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), cap: e[2] }));
    const s = verts[0] as string;
    const t = verts[verts.length - 1] as string;
    let step = 0;
    const show: E3[] = list.map((e) => ({ a: e.a, b: e.b, w: e.cap }));
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        "Capacity scaling: Delta phases 4, 2, 1 on this 4-node network.",
        0,
    );
    const cap = new Map<string, number>();
    const adj = new Map<string, Set<string>>(verts.map((v) => [v, new Set()]));
    for (const e of list) {
        cap.set(e.a + ">" + e.b, e.cap);
        adj.get(e.a)?.add(e.b);
        adj.get(e.b)?.add(e.a);
    }
    const get = (u: string, v: string): number => cap.get(u + ">" + v) ?? 0;
    let total = 0;
    let delta = 4;
    while (delta >= 1) {
        let pushed = 0;
        for (;;) {
            const prev = new Map<string, string>();
            const q = [s];
            prev.set(s, "");
            while (q.length > 0) {
                const u = q.shift() as string;
                if (u === t) break;
                for (const v of adj.get(u) ?? [])
                    if (!prev.has(v) && get(u, v) >= delta) {
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
                bn = Math.min(bn, get(p, cur));
                path.unshift(cur);
                cur = p;
            }
            path.unshift(s);
            for (let i = 0; i + 1 < path.length; i += 1) {
                const u = path[i] as string;
                const v = path[i + 1] as string;
                cap.set(u + ">" + v, get(u, v) - bn);
                cap.set(v + ">" + u, get(v, u) + bn);
            }
            total += bn;
            pushed += bn;
        }
        yield FR(
            step++,
            N(verts),
            ME(show, new Map(), true),
            `Delta=${delta}: pushed ${pushed} (total ${total}).`,
            4 - delta,
        );
        delta = Math.floor(delta / 2);
    }
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(show.map((_, i) => [i, "sorted"] as [number, EntityState])), true),
        `Max flow ${total} (saturates 1->3 and 2->3 into the sink).`,
        4,
    );
}

const module: AlgorithmModule = {
    id: "capacity-scaling-max-flow",
    name: "Capacity Scaling Max Flow",
    category: "flow",
    complexity: { time: "O(E^2 log U)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2", "3"],
        edges: [
            [0, 1, 5],
            [0, 2, 4],
            [1, 2, 2],
            [1, 3, 3],
            [2, 3, 6],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
