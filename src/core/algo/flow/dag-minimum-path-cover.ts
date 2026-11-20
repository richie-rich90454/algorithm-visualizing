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

    education: {
        "intuition": "A path cover partitions the vertices of a DAG into vertex-disjoint directed paths. The key fact is that the minimum number of paths equals the number of vertices minus the size of a maximum matching in a bipartite split of the graph. Splitting each vertex into an in-copy and an out-copy turns each original edge into a matching opportunity.",
        "invariants": [
            "A matched pair corresponds to two consecutive vertices on some path.",
            "Each vertex has at most one outgoing and one incoming matched edge.",
            "Paths formed by chaining matched pairs are vertex-disjoint."
        ],
        "correctness": "Every path cover of k paths induces a matching of size n-k by linking consecutive vertices, so maximum matching gives at least the minimum cover. Conversely, any matching of size m chains the matched pairs into n-m paths, giving a cover of that size. The two bounds meet, so n minus maximum matching is exactly the minimum path cover.",
        "complexityRationale": "The split graph has O(V) vertices and O(E) edges, and one maximum matching run costs O(V E) with a simple augmenting-path method. The split graph and matching arrays use O(V + E) space.",
        "uses": [
            "Scheduling tasks into the fewest chains of dependent jobs",
            "Minimum number of tests to cover program execution paths",
            "DAG compression for evolutionary and version-history analysis"
        ],
        "references": [
            "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, dynamic programming on DAGs",
            "Kleinberg and Tardos, Algorithm Design, matching chapter"
        ],
        "workedExample": "DAG 0->1, 1->2, 0->2. Split each vertex and match left0-right1 and left1-right2, a matching of size 2. The cover size is 3 minus 2, namely 1: the single path 0->1->2 covers all three vertices."
    },
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
    pseudocode: [
        "initialize directed acyclic graph with given vertices",
        "split each vertex into left copy and right copy nodes",
        "compute maximum bipartite matching across split copies",
        "chain matched pairs into vertex disjoint paths",
        "cover size equals vertices minus matching size",
        "report minimum path cover with maximum flow value",
    ],
};
export default module;
