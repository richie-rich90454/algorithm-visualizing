/**
 * friends-pairing-count.ts - Friends Pairing (Count)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: f[i] <- f[i-1] + (i-1) * f[i-2].
 *
 * Why DP works: optimal substructure lets larger answers build on smaller
 * ones, and overlapping subproblems mean each state is solved once and reused.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n)
 *   Space: O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
   - The cell being computed is YELLOW (comparing).
   - Updated entries flash BLUE (active).
   - The optimal choices are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - States build in dependency order so every transition reads final values.
 *   - The recurrence above is the single idea to memorize.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(arr: number[], states: Map<number, EntityState> = new Map()): VisualEntity[] {
    return arr.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: String(value),
        value,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { n?: number } | null) ?? {};
    const n = typeof task.n === "number" ? task.n : 4;
    let step = 0;
    if (n < 0) {
        yield {
            stepNumber: step,
            entities: makeBars([0]),
            edges: [],
            description: "Negative n \u2013 nothing to pair.",
            codeLineNumber: 0,
            layout: "array",
            meta: { step },
        };
        return;
    }
    const f: number[] = new Array<number>(n + 1).fill(0);
    f[0] = 1;
    if (n >= 1) f[1] = 1;
    yield {
        stepNumber: step,
        entities: makeBars(f),
        edges: [],
        description: `Pair ${n} friends (single or pairs). f[0] = 1.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        if (i >= 2) f[i] = (f[i - 1] ?? 0) + (i - 1) * (f[i - 2] ?? 0);
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        const how = i < 2 ? "base" : `${f[i - 1]} + ${i - 1}*${f[i - 2]} = ${f[i]}`;
        yield {
            stepNumber: step,
            entities: makeBars(f, states),
            edges: [],
            description: `f[${i}] = ${how}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n },
        };
        step += 1;
    }
    const done = new Map<number, EntityState>([[n, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeBars(f, done),
        edges: [],
        description: `Traceback: ${f[n]} ways to pair ${n} friends.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { answer: f[n] },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "Friends pairing counts how n friends can each stay single or pair up with one other friend. For friend i, either they stay single, giving f[i-1] arrangements, or they pair with any of the i-1 others, giving (i-1)*f[i-2]. Adding the two cases yields f[i] = f[i-1] + (i-1)*f[i-2].",
        "invariants": [
            "f[0] = 1 and f[1] = 1.",
            "Every arrangement is partitioned by the status of friend i.",
            "The pair case chooses one distinct partner and then arranges the remaining i-2 friends."
        ],
        "correctness": "If friend i is single, the other i-1 friends can be arranged in f[i-1] ways. If paired, there are i-1 choices of partner and f[i-2] ways for the rest, and these arrangements are disjoint. Summing counts every configuration exactly once, so the recurrence is correct by induction.",
        "complexityRationale": "Computing up to n uses one multiplication per index, so time is O(n). A single array of counts uses O(n) space, reducible to O(1) with rolling values.",
        "uses": [
            "Counting matchings in a complete graph",
            "Modeling partnership and pairing combinatorics",
            "Counting involutions with a fixed-point rule"
        ],
        "references": [
            "Stanley, Enumerative Combinatorics, Vol. 1, Chapter 1",
            "Graham, Knuth and Patashnik, Concrete Mathematics, Chapter 7"
        ],
        "workedExample": "From f[0]=1, f[1]=1: f[2]=1+1=2, f[3]=2+2*1=4, f[4]=4+3*2=10. Four friends have 10 single-or-pair arrangements."
    },
    id: "friends-pairing-count",
    name: "Friends Pairing (Count)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 4 },
    visualType: "array",
    run,
    pseudocode: [
        "set up f[0] <- 1 and f[1] <- 1 as pairing bases",
        "f[i] holds ways for i friends to stay single or pair",
        "f[i] <- f[i-1] + (i-1) * f[i-2]",
        "iterate i from 2 up to n using two prior counts",
        "either friend i stays single or picks one of i-1 partners",
        "multiply pair subcase by the partner choices available",
        "answer <- f[n] as total single-or-pair arrangements",
    ],
};

export default module;
