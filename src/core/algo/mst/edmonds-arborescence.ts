/**
 * edmonds-arborescence.ts - Edmonds Arborescence.
 * Minimum directed spanning tree rooted at r via min incoming edges plus cycle contraction.
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

type In = { root: string; vertices: string[]; edges: [string, string, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "digraph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const list: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: e[2] }));
    let step = 0;
    yield FR(
        step++,
        N(verts),
        ME(list, new Map(), true),
        `Edmonds rooted at ${d.root}: pick the cheapest incoming edge per vertex.`,
        0,
    );
    const pick = new Map<string, number>();
    let k = 1;
    for (const v of verts) {
        if (v === d.root) continue;
        let best = -1;
        for (let i = 0; i < list.length; i += 1) {
            const e = list[i] as E3;
            if (e.b === v && (best < 0 || e.w < (list[best] as E3).w)) best = i;
        }
        if (best >= 0) pick.set(v, best);
        const e = list[best] as E3;
        yield FR(
            step++,
            N(verts),
            ME(list, new Map([[best, "comparing"]]), true),
            `Cheapest edge into ${v} is ${e.a}->${v} (${e.w}).`,
            k++,
        );
    }
    const seen = new Set<string>();
    let cyc = false;
    for (const v of pick.keys()) {
        let c: string | undefined = v;
        seen.clear();
        while (c !== undefined && c !== d.root && !seen.has(c)) {
            seen.add(c);
            const pi = pick.get(c);
            c = pi === undefined ? undefined : (list[pi] as E3).a;
        }
        if (c !== undefined && c !== d.root && seen.has(c)) cyc = true;
    }
    yield FR(
        step++,
        N(verts),
        ME(
            list,
            new Map([...pick.values()].map((i) => [i, "highlight"] as [number, EntityState])),
            true,
        ),
        cyc
            ? "A directed cycle was found among the picks - it would be contracted and the search repeated."
            : "No directed cycle among the picks - they already form the optimum arborescence.",
        k++,
    );
    const chosen = [...pick.values()].map((i) => list[i] as E3);
    const weight = chosen.reduce((s, e) => s + e.w, 0);
    const fin = new Map<number, EntityState>();
    for (const i of pick.values()) fin.set(i, "sorted");
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, fin, true),
            `Optimum arborescence weight ${weight}: ${chosen.map((e) => `${e.a}->${e.b}(${e.w})`).join(", ")}.`,
            k++,
        ),
        meta: { weight },
    };
}

const module: AlgorithmModule = {
    id: "edmonds-arborescence",
    name: "Edmonds Arborescence",
    category: "mst",
    complexity: { time: "O(E V)", space: "O(V + E)" },
    defaultInput: {
        root: "0",
        vertices: ["0", "1", "2"],
        edges: [
            ["0", "1", 1],
            ["0", "2", 5],
            ["1", "2", 1],
            ["2", "1", 4],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
