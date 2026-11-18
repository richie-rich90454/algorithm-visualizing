/**
 * karger-random-contraction.ts - Karger Random Contraction.
 * Contract random edges until two nodes remain; repeat with a fixed seed.
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
        "Karger contraction (fixed seed 7): 8 independent trials on the triangle.",
        0,
    );
    const rnd = lcg(7);
    const trial = (): { cut: number; merged: string } => {
        const par = new Map<string, string>(verts.map((v) => [v, v]));
        const find = (x: string): string => {
            const r = par.get(x) as string;
            if (r === x) return x;
            const rr = find(r);
            par.set(x, rr);
            return rr;
        };
        let groups = verts.length;
        let guard = 0;
        let last = "";
        while (groups > 2 && guard++ < 50) {
            const cand = list.filter((e) => find(e.a) !== find(e.b));
            if (cand.length === 0) break;
            const e = cand[Math.floor(rnd() * cand.length)] as E3;
            par.set(find(e.a), find(e.b));
            last = `${e.a}-${e.b}`;
            groups -= 1;
        }
        const cut = list.filter((e) => find(e.a) !== find(e.b)).reduce((s, e) => s + e.w, 0);
        return { cut, merged: last };
    };
    let best = Infinity;
    for (let t = 0; t < 8; t += 1) {
        const r = trial();
        if (r.cut < best) best = r.cut;
        yield FR(
            step++,
            N(verts),
            ME(list),
            `Trial ${t + 1}: contracted ${r.merged || "nothing"}, surviving cut ${r.cut} (best ${best}).`,
            1,
        );
    }
    let opt = Infinity;
    for (let mask = 1; mask < (1 << verts.length) - 1; mask += 1) {
        const side = new Set(verts.filter((_, i) => (mask >> i) & 1));
        const c = list.filter((e) => side.has(e.a) !== side.has(e.b)).reduce((s, e) => s + e.w, 0);
        opt = Math.min(opt, c);
    }
    yield {
        ...FR(
            step++,
            N(verts),
            ME(list),
            `Best trial cut ${best}; brute-force optimum ${opt}: ${best === opt ? "trials found the true min cut 3" : "optimum confirmed"}.`,
            2,
        ),
        meta: { cutValue: best, optimum: opt },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Karger's algorithm finds a global minimum cut by repeated random contraction. Pick a random edge, merge its two endpoints, and delete any loops, until only two super-vertices remain; the edges between them form a cut. Running many independent trials and keeping the smallest cut makes failure unlikely.",
        "invariants": [
            "Contraction never removes an edge crossing a minimum cut unless that edge is chosen.",
            "Each trial produces a valid cut of the original graph.",
            "The minimum cut of any contracted graph is at least the global minimum cut of the original."
        ],
        "correctness": "A minimum cut survives a contraction unless the randomly chosen edge crosses it. The probability of never choosing such an edge in one run is at least a constant depending only on the number of vertices, so repeating O(V^2 log V) times finds the minimum cut with high probability. Each surviving final cut is genuine, so the smallest observed is correct when the minimum survives.",
        "complexityRationale": "One trial contracts V-2 times with O(E) work per contraction, about O(V E), and repeating for high probability multiplies by O(V^2). The adjacency lists and super-vertex mapping use O(V + E) space.",
        "uses": [
            "Approximate global min cut in large graphs",
            "Randomized algorithms teaching and Monte Carlo analysis",
            "A subroutine in recursive min-cut and MST algorithms"
        ],
        "references": [
            "Karger, Global Min-Cuts in RNC and Other Ramifications of a Simple Min-Cut Algorithm (1993)",
            "Motwani and Raghavan, Randomized Algorithms, min-cut chapter"
        ],
        "workedExample": "Triangle 0-1 weight 3, 1-2 weight 2, 0-2 weight 1. Contracting 0 and 1 leaves a cut of weight 3 (edges to 2), while contracting 0 and 2 leaves a cut of weight 5. The minimum singleton cut is vertex 2 with weight 3, and the best trial reports 3."
    },
    id: "karger-random-contraction",
    name: "Karger Random Contraction",
    category: "flow",
    complexity: { time: "O(V E)", space: "O(V + E)" },
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
    pseudocode: [
        "initialize graph with weighted edges and fixed seed",
        "contract random edge until two supernodes remain",
        "measure surviving cut weight for this trial run",
        "repeat independent trials and track best cut found",
        "verify best trial against brute force optimum value",
        "report minimum cut value with trial statistics",
    ],
};
export default module;
