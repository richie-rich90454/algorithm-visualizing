/**
 * poisson-binomial-distribution.ts - Poisson-Binomial Distribution by DP
 *
 * The Poisson-binomial distribution is the sum of independent Bernoulli trials
 * that may each have a different success probability. When all probabilities
 * are equal it reduces to the ordinary binomial. This module builds the mass
 * function with a dynamic-programming convolution, showing one DP row per
 * processed trial.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PBInput {
    probabilities?: number[];
}

/** Clip a probability into [0, 1]. */
function probability(value: unknown, fallback: number): number {
    const x = Number(value);
    if (!Number.isFinite(x)) return fallback;
    return Math.min(1, Math.max(0, x));
}

/** Build the evolving DP rows of the sum distribution. */
function buildRows(ps: number[]): number[][] {
    let row = [1];
    const rows: number[][] = [[...row]];
    for (const p of ps) {
        const next = new Array<number>(row.length + 1).fill(0);
        for (let s = 0; s < row.length; s += 1) {
            next[s] = (next[s] ?? 0) + (row[s] ?? 0) * (1 - p);
            next[s + 1] = (next[s + 1] ?? 0) + (row[s] ?? 0) * p;
        }
        row = next;
        rows.push([...row]);
    }
    return rows;
}

function makeCells(row: number[], active: number, done: boolean): VisualEntity[] {
    return row.map((p, s) => {
        let state: EntityState = "idle";
        if (done) state = "sorted";
        else if (s === active) state = "highlight";
        return {
            id: `cell-${s}`,
            type: "cell" as const,
            label: p.toFixed(5),
            value: p,
            state,
            x: s,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: s, sum: s, probability: p },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PBInput | null) ?? {};
    const raw = Array.isArray(task.probabilities) ? task.probabilities : [0.1, 0.2, 0.3, 0.4, 0.5];
    const ps = raw.slice(0, 20).map((p) => probability(p, 0.5));
    const rows = buildRows(ps);
    const pmf = rows[rows.length - 1] ?? [1];
    const mean = ps.reduce((sum, p) => sum + p, 0);
    const variance = ps.reduce((sum, p) => sum + p * (1 - p), 0);
    const total = pmf.reduce((sum, p) => sum + p, 0);

    yield {
        stepNumber: 0,
        entities: makeCells(rows[0] ?? [1], -1, false),
        edges: [],
        description: `Poisson-binomial: convolving ${ps.length} independent Bernoulli trials with unequal probabilities.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { trials: ps.length, probabilities: ps, mean, variance, total, pmf: [...pmf], activeTrial: 0 },
    };

    let step = 1;
    for (let i = 1; i < rows.length; i += 1) {
        const row = rows[i] ?? [];
        const peak = row.indexOf(Math.max(...row));
        yield {
            stepNumber: step,
            entities: makeCells(row, peak, false),
            edges: [],
            description: `After trial ${i} with p = ${ps[i - 1]!.toFixed(3)}, the probability of a sum of s successes is updated by a two-point convolution.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                trials: ps.length,
                probabilities: ps,
                mean,
                variance,
                total,
                pmf: [...pmf],
                activeTrial: i,
                rows,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(pmf, -1, true),
        edges: [],
        description: `Final distribution over sums 0..${ps.length}: masses sum to ${total.toFixed(9)}, mean ${mean.toFixed(4)}, variance ${variance.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { trials: ps.length, probabilities: ps, mean, variance, total, pmf: [...pmf], rows, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When independent trials have different success chances there is no single binomial formula. Instead, track the probability of each possible number of successes and update it one trial at a time: a new trial either fails and leaves the count alone, or succeeds and raises it by one. After all trials the table is the full distribution of the total.",
        invariants: [
            "Each DP row sums to one.",
            "Row i has i plus one entries, for totals zero through i.",
            "The mean of the final row is the sum of the trial probabilities, and its variance is the sum of p times one minus p.",
        ],
        correctness:
            "The recurrence P_i(s) = (1 - p_i) P_{i-1}(s) + p_i P_{i-1}(s-1) conditions on the outcome of trial i, which is independent of the earlier trials. By induction over i every row equals the true distribution of the partial sum. The mean and variance follow from linearity of expectation and from independence, which makes the variances of the indicators add.",
        complexityRationale:
            "Trial i touches i plus one states, so the total work is the sum from one to n, O(n squared) time, and keeping the final row and all displayed rows uses O(n squared) space for the animation.",
        uses: [
            "Summing risks with different default probabilities",
            "Exact p-values for weighted sums of binary indicators",
            "Reliability of systems with nonidentical components",
        ],
        references: [
            "Hong, An Introduction to Random Vectors and Probability Theory",
            "Fernandez and Williams, Closed-Form Expressibility for the Poisson Binomial, 2010",
        ],
        workedExample:
            "For probabilities 0.2 and 0.6, the first row is [0.8, 0.2]. After the second trial the row is [0.32, 0.56, 0.12], which sums to one, has mean 0.8 (the sum of 0.2 and 0.6), and variance 0.2 times 0.8 plus 0.6 times 0.4, equal to 0.4.",
    },
    id: "poisson-binomial-distribution",
    name: "Poisson-Binomial Distribution",
    category: "statistics-probability",
    complexity: { time: "O(n^2)", space: "O(n^2)" },
    defaultInput: { probabilities: [0.1, 0.2, 0.3, 0.4, 0.5] },
    visualType: "grid",
    run,
    pseudocode: [
        "read the list of trial probabilities",
        "start a distribution row with P(0) = 1",
        "for each trial probability p",
        "extend the row by one state and set all entries to zero",
        "add (1-p) times the old entry and p times the shifted old entry",
        "accumulate the mean and variance of the trials",
        "done: report the final sum distribution",
    ],
};

export default module;
