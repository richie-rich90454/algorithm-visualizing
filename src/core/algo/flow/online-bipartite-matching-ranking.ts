/**
 * online-bipartite-matching-ranking.ts - Online Bipartite Matching (Ranking).
 * Fixed-seed random ranks, greedy online matches: 1-1/e competitive.
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
const lcg = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 4294967296;
    };
};
type In = { left: string[]; arrivals: string[]; edges: [string, string][] };
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
        N([...d.arrivals, ...d.left]),
        ME(show, new Map(), true),
        "Ranking: offline vertices draw random ranks (fixed seed 11), buyers arrive online.",
        0,
    );
    const rnd = lcg(11);
    const keyed = d.left.map((v) => ({ v, r: rnd() }));
    keyed.sort((a, b) => a.r - b.r);
    const rank = new Map(keyed.map((k, i) => [k.v, i]));
    yield FR(
        step++,
        N([...d.arrivals, ...d.left]),
        ME(show, new Map(), true),
        `Ranks (seed 11): ${keyed.map((k) => `${k.v}#${rank.get(k.v)}`).join(", ")}.`,
        1,
    );
    const taken = new Set<string>();
    const matched: Array<[string, string]> = [];
    for (const x of d.arrivals) {
        const cands = d.edges
            .filter((e) => e[0] === x && !taken.has(e[1]))
            .sort((p, q) => (rank.get(p[1]) as number) - (rank.get(q[1]) as number));
        if (cands.length > 0) {
            const c = cands[0] as [string, string];
            taken.add(c[1]);
            matched.push([x, c[1]]);
            yield FR(
                step++,
                N([...d.arrivals, ...d.left]),
                ME(show, new Map(), true),
                `Arrival ${x}: matched to highest free rank ${c[1]} (size ${matched.length}).`,
                2,
            );
        } else {
            yield FR(
                step++,
                N([...d.arrivals, ...d.left]),
                ME(show, new Map(), true),
                `Arrival ${x}: no free neighbor, skipped.`,
                2,
            );
        }
        if (step > 11) break;
    }
    yield {
        ...FR(
            step++,
            N([...d.arrivals, ...d.left]),
            ME(show, new Map(), true),
            `Online matching size ${matched.length}: ${matched.map((m) => m.join("-")).join(", ")} (offline optimum is 2).`,
            3,
        ),
        meta: { matching: matched.length, pairs: matched.map((m) => m.join("-")), optimum: 2 },
    };
}

const module: AlgorithmModule = {
    id: "online-bipartite-matching-ranking",
    name: "Online Bipartite Matching (Ranking)",
    category: "flow",
    complexity: { time: "O(V E)", space: "O(V + E)" },
    defaultInput: {
        left: ["a", "b"],
        arrivals: ["x", "y"],
        edges: [
            ["x", "a"],
            ["y", "a"],
            ["y", "b"],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
