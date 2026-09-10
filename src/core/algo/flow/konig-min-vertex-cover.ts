/**
 * konig-min-vertex-cover.ts - Konig Min Vertex Cover.
 * From a maximum matching, Konig's alternating BFS yields a minimum vertex cover.
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

type In = { left: string[]; right: string[]; edges: [string, string][] };
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
        "Konig: maximum matching first, then the cover from alternating reachability.",
        0,
    );
    const adj = new Map<string, string[]>(d.left.map((v) => [v, []]));
    for (const e of d.edges) adj.get(e[0])?.push(e[1]);
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
    for (const u of d.left) {
        seen.clear();
        const ok = aug(u);
        yield FR(
            step++,
            N([...d.left, ...d.right]),
            ME(show, new Map(), true),
            ok
                ? `Matched ${u}-${matchL.get(u)} (size ${matchL.size}).`
                : `${u} found no augmenting path.`,
            1,
        );
    }
    const Z = new Set<string>();
    const q: string[] = d.left.filter((u) => !matchL.has(u));
    for (const u of q) Z.add(u);
    while (q.length > 0) {
        const u = q.shift() as string;
        if (d.left.includes(u)) {
            for (const v of adj.get(u) ?? [])
                if (matchL.get(u) !== v && !Z.has(v)) {
                    Z.add(v);
                    q.push(v);
                }
        } else {
            const m = matchR.get(u);
            if (m && !Z.has(m)) {
                Z.add(m);
                q.push(m);
            }
        }
    }
    yield FR(
        step++,
        N(
            [...d.left, ...d.right],
            new Map([...Z].map((v) => [v, "highlight"] as [string, EntityState])),
        ),
        ME(show, new Map(), true),
        `Alternating reachable set Z = {${[...Z].join(", ") || "empty"}} from free left vertices.`,
        2,
    );
    const cover = [...d.left.filter((u) => !Z.has(u)), ...d.right.filter((v) => Z.has(v))];
    yield FR(
        step++,
        N(
            [...d.left, ...d.right],
            new Map(cover.map((v) => [v, "visited"] as [string, EntityState])),
        ),
        ME(show, new Map(), true),
        `Cover C = (L\\Z) u (R cap Z) = {${cover.join(", ")}}: every edge touches it.`,
        3,
    );
    yield {
        ...FR(
            step++,
            N(
                [...d.left, ...d.right],
                new Map(cover.map((v) => [v, "visited"] as [string, EntityState])),
            ),
            ME(show, new Map(), true),
            `Minimum vertex cover size ${cover.length} = matching size ${matchL.size} (Konig equality).`,
            4,
        ),
        meta: { size: cover.length, matching: matchL.size },
    };
}

const module: AlgorithmModule = {
    id: "konig-min-vertex-cover",
    name: "Konig Min Vertex Cover",
    category: "flow",
    complexity: { time: "O(V E)", space: "O(V + E)" },
    defaultInput: {
        left: ["a", "b"],
        right: ["x", "y"],
        edges: [
            ["a", "x"],
            ["a", "y"],
            ["b", "x"],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
