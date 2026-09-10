/**
 * dag-minimum-path-cover.ts - DAG Minimum Path Cover.
 * Split each vertex left/right, match, and chain the pairs into paths.
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

type In = { vertices: string[]; edges: [number, number][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "dag");
        return;
    }
    const d = input as In;
    const verts = d.vertices.map(String);
    let step = 0;
    const show: E3[] = d.edges.map((e) => ({ a: String(e[0]), b: String(e[1]), w: 1 }));
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        "Path cover of a 3-node DAG via bipartite matching.",
        0,
    );
    const L = verts.map((v) => "L" + v);
    const R = verts.map((v) => "R" + v);
    const bedges = d.edges.map((e) => ({ a: "L" + String(e[0]), b: "R" + String(e[1]), w: 1 }));
    yield FR(
        step++,
        N([...L, ...R]),
        ME(bedges, new Map(), true),
        "Bipartite copy: edge u->v becomes L-u to R-v.",
        1,
    );
    const adj = new Map<string, string[]>(L.map((v) => [v, []]));
    for (const e of bedges) adj.get(e.a)?.push(e.b);
    const matchL = new Map<string, string>();
    const matchR = new Map<string, string>();
    const seen = new Set<string>();
    const aug = (u: string): boolean => {
        for (const v of adj.get(u) ?? []) {
            if (seen.has(v)) continue;
            seen.add(v);
            if (!matchR.has(v) || aug(matchR.get(v) as string)) {
                matchL.set(u, v);
                matchR.set(v, u);
                return true;
            }
        }
        return false;
    };
    for (const u of L) {
        seen.clear();
        const ok = aug(u);
        yield FR(
            step++,
            N([...L, ...R]),
            ME(bedges, new Map(), true),
            ok ? `Matched ${u}-${matchL.get(u)} (size ${matchL.size}).` : `${u} unmatched.`,
            2,
        );
    }
    const next = new Map<string, string>();
    for (const [l, r] of matchL) next.set(l.slice(1), r.slice(1));
    const started = new Set(next.values());
    const paths: string[][] = [];
    for (const v of verts) {
        if (started.has(v)) continue;
        const p = [v];
        while (next.has(p[p.length - 1] as string))
            p.push(next.get(p[p.length - 1] as string) as string);
        if (p.length > 0) paths.push(p);
    }
    yield FR(
        step++,
        N(verts),
        ME(show, new Map(), true),
        `Chained ${matchL.size} matched pairs into paths: ${paths.map((p) => p.join("->")).join(" | ")}.`,
        3,
    );
    yield {
        ...FR(
            step++,
            N(verts, new Map(verts.map((v) => [v, "sorted"] as [string, EntityState]))),
            ME(show, new Map(), true),
            `Minimum path cover size ${verts.length} - ${matchL.size} = ${paths.length}: [${(paths[0] ?? []).join("->")}].`,
            4,
        ),
        meta: { size: paths.length, matching: matchL.size },
    };
}

const module: AlgorithmModule = {
    id: "dag-minimum-path-cover",
    name: "DAG Minimum Path Cover",
    category: "flow",
    complexity: { time: "O(V E)", space: "O(V + E)" },
    defaultInput: {
        vertices: ["0", "1", "2"],
        edges: [
            [0, 1],
            [1, 2],
            [0, 2],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
