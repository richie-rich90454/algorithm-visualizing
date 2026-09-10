/**
 * baseball-elimination.ts - Baseball Elimination.
 * Can team C still finish first? A max-flow over remaining game distributions decides.
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
type FE = { a: string; b: string; cap: number };
const maxflow = (
    verts: string[],
    edges: FE[],
    s: string,
    t: string,
): { value: number; paths: string[][] } => {
    const cap = new Map<string, number>();
    const adj = new Map<string, Set<string>>();
    for (const v of verts) adj.set(v, new Set());
    const add = (u: string, v: string, c: number): void => {
        cap.set(u + ">" + v, (cap.get(u + ">" + v) ?? 0) + c);
        adj.get(u)?.add(v);
        adj.get(v)?.add(u);
    };
    for (const e of edges) add(e.a, e.b, e.cap);
    let value = 0;
    const paths: string[][] = [];
    for (;;) {
        const prev = new Map<string, string>();
        const q: string[] = [s];
        prev.set(s, "");
        while (q.length > 0) {
            const u = q.shift() as string;
            if (u === t) break;
            for (const v of adj.get(u) ?? [])
                if (!prev.has(v) && (cap.get(u + ">" + v) ?? 0) > 0) {
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
            bn = Math.min(bn, cap.get(p + ">" + cur) ?? 0);
            path.unshift(cur);
            cur = p;
        }
        path.unshift(s);
        for (let i = 0; i + 1 < path.length; i += 1) {
            const u = path[i] as string;
            const v = path[i + 1] as string;
            cap.set(u + ">" + v, (cap.get(u + ">" + v) ?? 0) - bn);
            cap.set(v + ">" + u, (cap.get(v + ">" + u) ?? 0) + bn);
        }
        value += bn;
        paths.push(path);
    }
    return { value, paths };
};

type In = { teams: string[]; wins: number[]; remaining: number[][]; query: string };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "league");
        return;
    }
    const d = input as In;
    const qi = d.teams.indexOf(d.query);
    const maxW = (d.wins[qi] as number) + (d.remaining[qi] as number[]).reduce((s, x) => s + x, 0);
    let step = 0;
    const labels = [...d.teams, "S", "T"];
    yield FR(
        step++,
        N(labels),
        [],
        `${d.query} can reach ${maxW} wins; rivals capped at ${d.teams
            .filter((t) => t !== d.query)
            .map((t) => `${t}:${maxW - (d.wins[d.teams.indexOf(t)] as number)}`)
            .join(", ")}.`,
        0,
    );
    const others = d.teams.filter((t) => t !== d.query);
    const oi = others.map((t) => d.teams.indexOf(t));
    const caps = oi.map((i) => maxW - (d.wins[i] as number));
    const trivial = caps.some((c) => c < 0);
    yield FR(
        step++,
        N(labels),
        [],
        trivial
            ? "A rival already exceeds the cap: trivially eliminated."
            : `No trivial elimination: caps are ${caps.join(", ")} (all >= 0).`,
        1,
    );
    const gAB = (d.remaining[oi[0] as number] as number[])[oi[1] as number] as number;
    const fe: FE[] = [
        { a: "S", b: "g", cap: gAB },
        { a: "g", b: others[0] as string, cap: 999 },
        { a: "g", b: others[1] as string, cap: 999 },
        { a: others[0] as string, b: "T", cap: caps[0] as number },
        { a: others[1] as string, b: "T", cap: caps[1] as number },
    ];
    yield FR(
        step++,
        N([...others, "g", "S", "T"]),
        ME(
            fe.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        `Game node g(A,B) must distribute ${gAB} wins into caps ${caps[0]} + ${caps[1]} = ${(caps[0] as number) + (caps[1] as number)}.`,
        2,
    );
    const f = maxflow([...others, "g", "S", "T"], fe, "S", "T");
    yield FR(
        step++,
        N([...others, "g", "S", "T"]),
        ME(
            fe.map((e) => ({ a: e.a, b: e.b, w: e.cap })),
            new Map(),
            true,
        ),
        `Flow distributes ${f.value} of ${gAB} game wins.`,
        3,
    );
    const elim = f.value < gAB;
    yield {
        ...FR(
            step++,
            N(d.teams, new Map([[d.query, "swapped"]] as [string, EntityState][])),
            [],
            elim
                ? `${d.query} is eliminated: games between {${others.join(", ")}} (${gAB}) exceed their combined cap ${(caps[0] as number) + (caps[1] as number)}.`
                : `${d.query} can still finish first.`,
            4,
        ),
        meta: { eliminated: elim, flow: f.value, required: gAB },
    };
}

const module: AlgorithmModule = {
    id: "baseball-elimination",
    name: "Baseball Elimination",
    category: "flow",
    complexity: { time: "O(T^2 G)", space: "O(T^2)" },
    defaultInput: {
        teams: ["A", "B", "C"],
        wins: [10, 9, 8],
        remaining: [
            [0, 2, 1],
            [2, 0, 1],
            [1, 1, 0],
        ],
        query: "C",
    },
    visualType: "graph",
    run,
};
export default module;
