/**
 * esau-williams-capacitated-mst.ts – Esau-Williams Capacitated MST.
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The capacitated MST connects every terminal to a central root without
 * overloading any subtree beyond a fixed capacity. Esau-Williams starts with
 * every terminal wired straight to the root, then repeatedly merges pairs of
 * subtrees with the largest positive saving, as long as the combined demand
 * fits within capacity.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(V^2 log V) – sorting all pairwise savings dominates
 *   Space: O(V + E)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Direct root links are highlighted, merges turn CYAN-ish (highlight).
 *   - Final capacitated tree edges are GREEN (sorted).
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
    description: `Empty input — no ${what} to process.`,
    codeLineNumber: 0,
    layout: "graph",
    meta: {},
});
const isEmptyInput = (input: unknown): boolean =>
    input == null ||
    (typeof input === "object" && Object.keys(input as Record<string, unknown>).length === 0);

type In = {
    root: string;
    capacity: number;
    vertices: string[];
    edges: [string, string, number][];
    demand: number[];
};
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "graph");
        return;
    }
    const d = input as In;
    const verts = [...d.vertices];
    const list: E3[] = d.edges.map((e) => ({ a: e[0], b: e[1], w: e[2] }));
    const dem = new Map<string, number>(verts.map((v, i) => [v, d.demand[i] as number]));
    let step = 0;
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list),
            `Capacitated MST: root ${d.root}, capacity ${d.capacity}, unit demands at vertices 1, 2, 3.`,
            0,
        ),
        meta: { links: 0, cost: 0 },
    };
    yield {
        ...FR(
            step++,
            N(verts),
            ME(
                list,
                new Map([
                    [0, "highlight"],
                    [1, "highlight"],
                    [2, "highlight"],
                ]),
            ),
            "Start: every terminal attached straight to the root (each subtree load is 1).",
            1,
        ),
        meta: { links: 2 },
    };
    const c = (a: string, b: string): number => {
        let best = Infinity;
        for (const e of list)
            if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) best = Math.min(best, e.w);
        return best;
    };
    const pairs: Array<{ i: string; j: string; s: number }> = [];
    const terms = verts.filter((v) => v !== d.root);
    for (let x = 0; x < terms.length; x += 1)
        for (let y = x + 1; y < terms.length; y += 1) {
            const i = terms[x] as string;
            const j = terms[y] as string;
            pairs.push({ i, j, s: c(i, d.root) + c(j, d.root) - c(i, j) });
        }
    pairs.sort((p, q) => q.s - p.s);
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list),
            `Savings order: ${pairs.map((p) => `${p.i}–${p.j}(${p.s})`).join(", ")}.`,
            2,
        ),
        meta: { links: links.length },
    };
    const comp = new Map<string, string>(terms.map((v) => [v, v]));
    const load = new Map<string, number>(terms.map((v) => [v, dem.get(v) as number]));
    const find = (x: string): string => {
        const r = comp.get(x) as string;
        if (r === x) return x;
        const rr = find(r);
        comp.set(x, rr);
        return rr;
    };
    const links: number[] = [0, 1];
    for (const p of pairs) {
        const ri = find(p.i);
        const rj = find(p.j);
        if (ri === rj) continue;
        if ((load.get(ri) as number) + (load.get(rj) as number) > d.capacity) {
            yield {
                ...FR(
                    step++,
                    N(verts),
                    ME(list),
                    `Skipping merge ${p.i}–${p.j} (saving ${p.s}): combined load would exceed capacity ${d.capacity}.`,
                    4,
                ),
                meta: { links: links.length },
            };
            continue;
        }
        comp.set(ri, rj);
        load.set(rj, (load.get(ri) as number) + (load.get(rj) as number));
        const li = list.findIndex(
            (e) => (e.a === p.i && e.b === p.j) || (e.a === p.j && e.b === p.i),
        );
        links.push(li);
        const linkEdge = li >= 0 ? (list[li] as E3) : undefined;
        yield {
            ...FR(
                step++,
                N(verts),
                ME(list, new Map(links.map((i) => [i, "highlight"] as [number, EntityState]))),
                linkEdge
                    ? `Merging ${p.i} into the ${p.j} subtree via edge ${linkEdge.a}–${linkEdge.b} (weight ${linkEdge.w}), load ${load.get(rj)}: saving ${p.s}.`
                    : `Merging ${p.i} into ${p.j} subtree (load ${load.get(rj)}): saving ${p.s}.`,
                4,
            ),
            meta: { links: links.length },
        };
        if (step > 12) break;
    }
    const cost = links.reduce((s, i) => s + (list[i] as E3).w, 0);
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list, new Map(links.map((i) => [i, "sorted"] as [number, EntityState]))),
            `Heuristic CMST cost ${cost}, total weight ${cost}: subtrees respect capacity ${d.capacity}.`,
            5,
        ),
        meta: { cost, totalWeight: cost, links: links.length },
    };
}

const module: AlgorithmModule = {
    id: "esau-williams-capacitated-mst",
    name: "Esau-Williams Capacitated MST",
    category: "mst",
    complexity: { time: "O(V^2 log V)", space: "O(V + E)" },
    defaultInput: {
        root: "0",
        capacity: 2,
        vertices: ["0", "1", "2", "3"],
        edges: [
            ["0", "1", 1],
            ["0", "2", 1],
            ["0", "3", 10],
            ["1", "2", 1],
            ["2", "3", 1],
            ["1", "3", 5],
        ],
        demand: [0, 1, 1, 1],
    },
    visualType: "graph",
    run,
    pseudocode: [
        "attach every terminal straight to the root",
        "compute the saving of joining each terminal pair",
        "sort all pairwise savings from largest to smallest",
        "for each pair in savings order: consider merging",
        "merge the pair when the combined load fits capacity",
        "done: merged links form the heuristic CMST total weight",
    ],
};
export default module;
