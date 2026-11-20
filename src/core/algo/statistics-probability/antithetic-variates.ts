/**
 * antithetic-variates.ts - Antithetic Variates
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Antithetic variates reduce Monte Carlo variance by pairing each uniform draw
 * u with its mirror 1-u. For a monotone payoff the two values move in opposite
 * directions, so their average fluctuates less than an unpaired average. The
 * estimator stays unbiased because both members are uniform draws.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n uniform draws
 *   Space: O(n) for the per-pair results
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per pair shows u, f(u), f(1-u), and the pair average.
 *   - The row being accumulated is yellow; finished rows are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    uniforms?: number[];
    fn?: "square" | "exponential" | "identity" | "call";
    strike?: number;
}

/** Evaluate the chosen monotone payoff at a uniform draw. */
function payoff(u: number, fn: string, strike: number): number {
    if (fn === "exponential") return Math.exp(u);
    if (fn === "identity") return u;
    if (fn === "call") return Math.max(0, u - strike);
    return u * u;
}

/** Sample variance with n minus one in the denominator. */
function sampleVariance(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, x) => s + x, 0) / values.length;
    return values.reduce((s, x) => s + (x - mean) ** 2, 0) / (values.length - 1);
}

/** Build the four-column grid for each antithetic pair. */
function makeCells(
    rows: Array<{ u: number; a: number; b: number; pair: number }>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < rows.length; row += 1) {
        const item = rows[row];
        const columns = [item?.u ?? 0, item?.a ?? 0, item?.b ?? 0, item?.pair ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (done || row < current) state = "sorted";
            else if (row === current) state = "comparing";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: columns[col]?.toFixed(3) ?? "0",
                value: columns[col] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** The antithetic variates generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const uniforms = Array.isArray(task.uniforms) && task.uniforms.length > 0
        ? task.uniforms.map(Number)
        : [0.05, 0.15, 0.28, 0.42, 0.55, 0.68, 0.81, 0.93];
    const fn = typeof task.fn === "string" ? task.fn : "square";
    const strike = typeof task.strike === "number" ? task.strike : 0.5;
    const rows = uniforms.map((u) => {
        const mirror = 1 - u;
        const a = payoff(u, fn, strike);
        const b = payoff(mirror, fn, strike);
        return { u, a, b, pair: 0.5 * (a + b) };
    });
    let completed = 0;

    const mean = (values: number[]) => values.reduce((s, x) => s + x, 0) / Math.max(1, values.length);
    const summary = () => {
        const view = rows.slice(0, completed);
        const a = view.map((r) => r.a);
        const pairs = view.map((r) => r.pair);
        return {
            rows: rows.length,
            cols: 4,
            naiveMean: mean(a),
            antitheticMean: mean(pairs),
            naiveVariance: sampleVariance(a),
            antitheticVariance: sampleVariance(pairs),
            reduced: sampleVariance(pairs) <= sampleVariance(a) + 1e-12,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeCells(rows, completed, false),
        edges: [],
        description: `Pairing ${uniforms.length} uniform draws with their mirrors to estimate a ${fn} payoff.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(),
    };
    let step = 1;

    for (let i = 0; i < uniforms.length; i += 1) {
        completed = i + 1;
        const row = rows[i];
        yield {
            stepNumber: step,
            entities: makeCells(rows, completed, false),
            edges: [],
            description: `Pair ${i}: u=${(row?.u ?? 0).toFixed(3)}, 1-u=${(1 - (row?.u ?? 0)).toFixed(3)}, payoffs ${(row?.a ?? 0).toFixed(3)} and ${(row?.b ?? 0).toFixed(3)}; pair average ${(row?.pair ?? 0).toFixed(3)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: summary(),
        };
        step += 1;
    }
    const final = summary();
    yield {
        stepNumber: step,
        entities: makeCells(rows, completed, true),
        edges: [],
        description: `Antithetic mean ${final.antitheticMean.toFixed(4)}; pair variance ${final.antitheticVariance.toFixed(4)} versus ${final.naiveVariance.toFixed(4)} unpaired.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: final,
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If a payoff rises whenever the random draw rises, then pairing a draw with its mirror tends to put one high value and one low value in the same pair. Averaging inside the pair cancels part of the swing before the overall average is taken, so the estimate settles down faster while remaining unbiased.",
        invariants: [
            "Every paired draw and its mirror both lie in the unit interval.",
            "Each pair average is the mean of one payoff and its mirrored payoff.",
            "The antithetic and naive estimators have the same expected value.",
        ],
        correctness:
            "If U is uniform on (0,1), then 1-U is also uniform, so f(U) and f(1-U) have the same expectation and the paired average remains unbiased for E[f(U)]. For a monotone f the covariance of f(U) and f(1-U) is nonpositive, so the variance of their average is at most the variance of a single payoff, which is the variance reduction observed in the grid.",
        complexityRationale:
            "Each of the n pairs needs one payoff evaluation at u and one at 1-u, so time is O(n). Storing the four values per pair uses O(n) space.",
        uses: [
            "Monte Carlo option pricing with monotone payoffs",
            "Reducing noise in rendered-light transport simulations",
            "Variance reduction for numerical integration of monotone functions",
        ],
        references: [
            "Hammersley and Morton, Poor Man's Monte Carlo, Journal of the Royal Statistical Society, 1954",
            "Glasserman, Monte Carlo Methods in Financial Engineering, Chapter 4",
        ],
        workedExample:
            "For f(u)=u squared with draws 0.05 and 0.93, the mirrors are 0.95 and 0.07. The payoffs 0.0025 and 0.8649 pair with 0.9025 and 0.0049, giving pair averages near 0.45 instead of a single payoff that can be almost zero or almost one.",
    },
    id: "antithetic-variates",
    name: "Antithetic Variates",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { uniforms: [0.05, 0.15, 0.28, 0.42, 0.55, 0.68, 0.81, 0.93], fn: "square", strike: 0.5 },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a monotone payoff and a list of uniform draws",
        "for each uniform draw u",
        "form the mirror draw one minus u",
        "evaluate the payoff at u and at the mirror",
        "store the average of the two payoffs as the pair value",
        "compare paired variance against unpaired variance",
        "done: report the antithetic mean and both variances",
    ],
};

export default module;
