/**
 * tiling-dp-domino-tromino.ts - Tiling (Domino + Tromino)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i] <- 2*dp[i-1] + dp[i-3] via domino and tromino fills.
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
    const n = typeof task.n === "number" ? task.n : 3;
    let step = 0;
    if (n < 0) {
        yield {
            stepNumber: step,
            entities: makeBars([0]),
            edges: [],
            description: "Negative n \u2013 nothing to tile.",
            codeLineNumber: 0,
            layout: "array",
            meta: { step },
        };
        return;
    }
    const dp: number[] = new Array<number>(n + 1).fill(0);
    dp[0] = 1;
    if (n >= 1) dp[1] = 1;
    if (n >= 2) dp[2] = 2;
    yield {
        stepNumber: step,
        entities: makeBars(dp),
        edges: [],
        description: `Tile 2x${n} with dominoes + trominoes. dp[0] = 1.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        if (i >= 3) dp[i] = 2 * (dp[i - 1] ?? 0) + (dp[i - 3] ?? 0);
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        const how = i < 3 ? "base" : `2*${dp[i - 1]} + ${dp[i - 3]} = ${dp[i]}`;
        yield {
            stepNumber: step,
            entities: makeBars(dp, states),
            edges: [],
            description: `dp[${i}] = ${how}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n },
        };
        step += 1;
    }
    const done = new Map<number, EntityState>([[n, "sorted"]]);
    yield {
        stepNumber: step,
        entities: makeBars(dp, done),
        edges: [],
        description: `Traceback: ${dp[n]} tilings of 2x${n}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { answer: dp[n] },
    };
}

const module: AlgorithmModule = {

    education: {
        "intuition": "This tiling DP counts ways to cover a 2-by-n board with dominoes and L-shaped trominoes. The recurrence dp[i] = 2*dp[i-1] + dp[i-3] comes from extending a shorter tiling in the possible local configurations at the right edge. The factor two reflects the two orientations of the tromino pair that fills a gap.",
        "invariants": [
            "dp[i] counts tilings of the 2-by-i board.",
            "dp[0] = 1 and dp[1] = 1 are the base tilings.",
            "Every tiling of width i ends in one of the local patterns accounted for by the recurrence."
        ],
        "correctness": "Examining the rightmost column, a tiling either ends with a vertical domino, giving dp[i-1], or with horizontal pieces and trominoes in the two mirrored arrangements, contributing another 2*dp[i-1] component through the profile, plus the tromino-gap case dp[i-3]. The local case analysis is exhaustive and disjoint, so the recurrence counts every tiling once.",
        "complexityRationale": "Computing each width from three earlier values is constant work, so time is O(n). Storing the dp array uses O(n) space, reducible to O(1) with rolling variables.",
        "uses": [
            "Counting tilings of small boards with mixed pieces",
            "Combinatorial enumeration with local patterns",
            "Profile and recurrence DP teaching examples"
        ],
        "references": [
            "Graham, Knuth and Patashnik, Concrete Mathematics, Chapter 7",
            "Stanley, Enumerative Combinatorics, Vol. 1, Chapter 1"
        ],
        "workedExample": "With dp[0]=1 and dp[1]=1, dp[2]=2 and dp[3]=2*2+1=5. There are five ways to tile a 2-by-3 board with dominoes and L-trominoes."
    },
    id: "tiling-dp-domino-tromino",
    name: "Tiling (Domino + Tromino)",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { n: 3 },
    visualType: "array",
    run,
    pseudocode: [
        "set up dp[0] <- 1 and dp[1] <- 1 as tiling bases",
        "dp[i] holds tilings of the 2 x i board",
        "dp[i] <- 2*dp[i-1] + dp[i-3] via domino and tromino fills",
        "iterate widths from 2 up to n accumulating counts",
        "each width extends prior tilings plus gapped tromino pairs",
        "combine full and partial profile contributions per step",
        "answer <- dp[n] as tilings of the 2 x n board",
    ],
};

export default module;
