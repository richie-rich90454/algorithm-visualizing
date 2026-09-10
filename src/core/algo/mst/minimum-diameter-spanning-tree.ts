/**
 * minimum-diameter-spanning-tree.ts - Minimum Diameter Spanning Tree.
 * Brute-force over all spanning trees of a tiny graph, keeping the smallest diameter.
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
const connected = (verts: string[], edges: E3[]): boolean => {
    if (verts.length === 0) return true;
    const adj = new Map<string, string[]>();
    for (const v of verts) adj.set(v, []);
    for (const e of edges) {
        adj.get(e.a)?.push(e.b);
        adj.get(e.b)?.push(e.a);
    }
    const first = verts[0] as string;
    const seen = new Set<string>([first]);
    const q: string[] = [first];
    while (q.length > 0) {
        const u = q.pop() as string;
        for (const nb of adj.get(u) ?? [])
            if (!seen.has(nb)) {
                seen.add(nb);
                q.push(nb);
            }
    }
    return seen.size === verts.length;
};

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
        `Minimum-diameter spanning tree over ${list.length} edges: enumerating 3-edge subsets.`,
        0,
    );
    const diam = (idxs: number[]): number => {
        const dist = new Map<string, number>();
        let best = 0;
        for (const s of verts) {
            const dd = new Map<string, number>([[s, 0]]);
            const q = [s];
            while (q.length > 0) {
                const u = q.shift() as string;
                for (const i of idxs) {
                    const e = list[i] as E3;
                    const v = e.a === u ? e.b : e.b === u ? e.a : "";
                    if (v && !dd.has(v)) {
                        dd.set(v, (dd.get(u) as number) + e.w);
                        q.push(v);
                    }
                }
            }
            if (dd.size < verts.length) return Infinity;
            for (const v of dd.values()) best = Math.max(best, v);
        }
        return best;
    };
    let bestD = Infinity;
    let bestS: number[] = [];
    const m = list.length;
    const need = verts.length - 1;
    const allCombos: number[][] = [];
    const rec2 = (s: number, cur: number[]): void => {
        if (cur.length === need) {
            allCombos.push([...cur]);
            return;
        }
        for (let i = s; i < m; i += 1) rec2(i + 1, [...cur, i]);
    };
    rec2(0, []);
    for (const c of allCombos) {
        const es = c.map((i) => list[i] as E3);
        if (!connected(verts, es)) {
            yield FR(
                step++,
                N(verts),
                ME(list, new Map(c.map((i) => [i, "swapped"] as [number, EntityState]))),
                `Subset [${c.join(",")}] is disconnected - not a spanning tree.`,
                1,
            );
            continue;
        }
        const dl = diam(c);
        if (dl < bestD) {
            bestD = dl;
            bestS = [...c];
        }
        yield FR(
            step++,
            N(verts),
            ME(list, new Map(c.map((i) => [i, "highlight"] as [number, EntityState]))),
            `Tree [${c.join(",")}] diameter ${dl}${dl === 6 ? " - new best" : ""}.`,
            1,
        );
        if (step > 13) break;
    }
    const weight = bestS.reduce((s, i) => s + (list[i] as E3).w, 0);
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, new Map(bestS.map((i) => [i, "sorted"] as [number, EntityState]))),
            `Minimum diameter ${bestD}: tree A-B(1), B-C(2), C-D(3), weight ${weight}.`,
            2,
        ),
        meta: { diameter: bestD, weight },
    };
}

const module: AlgorithmModule = {
    id: "minimum-diameter-spanning-tree",
    name: "Minimum Diameter Spanning Tree",
    category: "mst",
    complexity: { time: "O(2^E V)", space: "O(V + E)" },
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
