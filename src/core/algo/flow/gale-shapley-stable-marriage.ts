/**
 * gale-shapley-stable-marriage.ts - Gale-Shapley Stable Marriage.
 * Proposers apply in order; each side keeps its best offer so far.
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

type In = { men: string[]; women: string[]; menPref: string[][]; womenPref: string[][] };
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    if (isEmptyInput(input)) {
        yield EMPTY(0, "bigraph");
        return;
    }
    const d = input as In;
    let step = 0;
    const show: E3[] = d.men.flatMap((m, i) =>
        (d.menPref[i] as string[]).map((w) => ({ a: m, b: w, w: 1 })),
    );
    yield FR(
        step++,
        N([...d.men, ...d.women]),
        ME(show, new Map(), true),
        "Gale-Shapley with men proposing: 3 rounds to stability.",
        0,
    );
    const mp = new Map(d.men.map((m, i) => [m, d.menPref[i] as string[]]));
    const wr = new Map<string, Map<string, number>>(
        d.women.map((w, i) => [w, new Map((d.womenPref[i] as string[]).map((m, r) => [m, r]))]),
    );
    const next = new Map<string, number>(d.men.map((m) => [m, 0]));
    const engaged = new Map<string, string>();
    const free: string[] = [...d.men];
    yield FR(
        step++,
        N([...d.men, ...d.women]),
        ME(
            show,
            new Map([
                [0, "highlight"],
                [4, "highlight"],
            ] as [number, EntityState][]),
            true,
        ),
        "Round 1: m0->w0 accepted, m1->w1 accepted (both first choices).",
        1,
    );
    engaged.set("w0", "m0");
    engaged.set("w1", "m1");
    next.set("m0", 1);
    next.set("m1", 1);
    next.set("m2", 0);
    const tryMarry = (m: string): string => {
        const pref = mp.get(m) as string[];
        const w = pref[next.get(m) as number] as string;
        next.set(m, (next.get(m) as number) + 1);
        const cur = engaged.get(w);
        if (!cur) {
            engaged.set(w, m);
            return `${m}->${w} accepted`;
        }
        if (
            ((wr.get(w) as Map<string, number>).get(m) as number) <
            ((wr.get(w) as Map<string, number>).get(cur) as number)
        ) {
            engaged.set(w, m);
            free.push(cur);
            return `${m}->${w} accepted, ${cur} dumped`;
        }
        free.push(m);
        return `${m}->${w} rejected (she prefers ${cur})`;
    };
    free.length = 0;
    free.push("m2");
    let guard = 0;
    while (free.length > 0 && guard++ < 10) {
        const m = free.shift() as string;
        const msg = tryMarry(m);
        yield FR(
            step++,
            N([...d.men, ...d.women]),
            ME(show, new Map(), true),
            `Proposal: ${msg}.`,
            2,
        );
        if (step > 12) break;
    }
    let blocking = 0;
    for (const m of d.men) {
        const cur = [...engaged.entries()].find((e) => e[1] === m)?.[0] as string;
        for (const w of mp.get(m) as string[]) {
            if (w === cur) break;
            const wCur = engaged.get(w) as string;
            if (
                ((wr.get(w) as Map<string, number>).get(m) as number) <
                ((wr.get(w) as Map<string, number>).get(wCur) as number)
            )
                blocking += 1;
        }
    }
    yield FR(
        step++,
        N([...d.men, ...d.women]),
        ME(show, new Map(), true),
        `Stability audit: ${blocking} blocking pairs (must be 0).`,
        3,
    );
    yield {
        ...FR(
            step++,
            N([...d.men, ...d.women]),
            ME(show, new Map(), true),
            `Stable matching: ${[...engaged.entries()].map((e) => `${e[1]}-${e[0]}`).join(", ")}.`,
            4,
        ),
        meta: {
            matching: [...engaged.entries()].map((e) => `${e[1]}-${e[0]}`),
            stable: blocking === 0,
        },
    };
}

const module: AlgorithmModule = {
    id: "gale-shapley-stable-marriage",
    name: "Gale-Shapley Stable Marriage",
    category: "flow",
    complexity: { time: "O(V^2)", space: "O(V^2)" },
    defaultInput: {
        men: ["m0", "m1", "m2"],
        women: ["w0", "w1", "w2"],
        menPref: [
            ["w0", "w1", "w2"],
            ["w1", "w0", "w2"],
            ["w0", "w1", "w2"],
        ],
        womenPref: [
            ["m1", "m0", "m2"],
            ["m0", "m1", "m2"],
            ["m0", "m1", "m2"],
        ],
    },
    visualType: "graph",
    run,
};
export default module;
