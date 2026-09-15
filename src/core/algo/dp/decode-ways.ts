/**
 * decode-ways.ts - Decode Ways
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Textbook dynamic programming: dp[i] <- (valid 1-digit) * dp[i-1] + (valid 2-digit) * dp[i-2].
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
    const task = (input as { s?: string } | null) ?? {};
    const s = typeof task.s === "string" ? task.s : "226";
    let step = 0;
    if (s.length === 0) {
        yield {
            stepNumber: step,
            entities: makeBars([1]),
            edges: [],
            description: "Empty string \u2013 one (empty) decoding.",
            codeLineNumber: 0,
            layout: "array",
            meta: { step },
        };
        return;
    }
    const n = s.length;
    const dp: number[] = new Array<number>(n + 1).fill(0);
    dp[0] = 1;
    yield {
        stepNumber: step,
        entities: makeBars(dp),
        edges: [],
        description: `Decodings of "${s}" (A=1..Z=26). dp[0] = 1.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n },
    };
    step += 1;
    for (let i = 1; i <= n; i += 1) {
        let total = 0;
        const one = s[i - 1] ?? "";
        const two = i >= 2 ? s.slice(i - 2, i) : "";
        if (one !== "0") total += dp[i - 1] ?? 0;
        if (two.length === 2 && two[0] !== "0" && Number(two) <= 26) total += dp[i - 2] ?? 0;
        dp[i] = total;
        const states = new Map<number, EntityState>([[i, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeBars(dp, states),
            edges: [],
            description: `dp[${i}] = ${total} ("${one}"${two ? `, "${two}"` : ""}).`,
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
        description: `Traceback: ${dp[n]} decodings of "${s}".`,
        codeLineNumber: 6,
        layout: "array",
        meta: { answer: dp[n] },
    };
}

const module: AlgorithmModule = {
    id: "decode-ways",
    name: "Decode Ways",
    category: "dynamic-programming",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { s: "226" },
    visualType: "array",
    run,
    pseudocode: [
        "set up string s of length n with dp[0] <- 1",
        "dp[i] holds decodings of prefix ending at position i",
        "dp[i] <- (valid 1-digit) * dp[i-1] + (valid 2-digit) * dp[i-2]",
        "iterate positions from 1 to n checking one and two chars",
        "single digit valid for 1..9, pair valid for 10..26",
        "add contributions of each valid chunk length separately",
        "answer <- dp[n] with decodings reconstructed from chunk picks",
    ],};

export default module;
