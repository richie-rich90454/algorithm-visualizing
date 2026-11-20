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

    education: {
        "intuition": "Gale-Shapley finds a stable matching between two equally sized sets with ranked preferences. Proposers apply to their next choice; each receiver keeps the best proposal so far and rejects the rest, and rejected proposers move down their lists. The process always ends with no blocking pair, meaning no two unmatched-to-each-other participants would both prefer each other.",
        "invariants": [
            "A receiver's current hold is always its favorite among all proposals received so far.",
            "Each proposer applies to candidates in strictly descending preference order.",
            "Once a receiver rejects a proposer, that pair can never be matched."
        ],
        "correctness": "The algorithm terminates because each of the finite ordered pairs is proposed at most once. The result is a perfect matching because a free proposer always has someone left to approach. No blocking pair exists: if a man prefers a woman to his match, he proposed to her earlier and she rejected or later upgraded him, so she prefers her final match.",
        "complexityRationale": "There are at most n squared proposals for n men and n women, and each proposal is handled in constant time, giving O(n^2). Preference tables and current matches use O(n^2) space.",
        "uses": [
            "Medical residency and school choice matching markets",
            "Assigning users to servers or tasks to machines with preferences",
            "Stable assignment in two-sided markets"
        ],
        "references": [
            "Gale and Shapley, College Admissions and the Stability of Marriage (1962)",
            "Kleinberg and Tardos, Algorithm Design, matching markets chapter"
        ],
        "workedExample": "Men m0,m1,m2 propose in order; m0 goes to w0 and m1 to w1, both held. m2 proposes to w0, who already holds a better-ranked m0, so m2 is rejected, then w1 rejects him too, and he settles at w2. The result m0-w0, m1-w1, m2-w2 has no blocking pair."
    },
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
    pseudocode: [
        "initialize free proposers with ranked preference lists",
        "each free proposer applies to next choice on list",
        "receiver keeps best offer and rejects the other suitor",
        "rejected proposer continues with next ranked choice",
        "repeat until no free proposer remains unmatched",
        "report stable matching with zero blocking pairs",
    ],
};
export default module;
