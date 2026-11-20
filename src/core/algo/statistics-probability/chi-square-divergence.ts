/**
 * chi-square-divergence.ts - Pearson Chi-Square Divergence
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Pearson chi-square divergence measures how far one probability
 * distribution sits from another. For distributions P and Q over the same bins
 * it sums (p_i - q_i)^2 / q_i. It is nonnegative, zero only when P equals Q, and
 * asymmetric: the divergence from P to Q generally differs from Q to P. The
 * module normalizes both inputs and floors Q away from zero so the value stays
 * finite even when Q assigns a bin no probability.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m bins
 *   Space: O(m) for the displayed per-bin contributions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per bin shows its contribution (p_i - q_i)^2 / q_i.
 *   - The current bin is yellow; the final total is green.
 *   - The final frame reports the total divergence.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DivergenceInput {
    p?: number[];
    q?: number[];
}

const FLOOR = 1e-9;

function normalize(values: number[], floor = 0): number[] {
    const raw = values.map((v) => Math.max(0, Number(v) || 0) + floor);
    const sum = raw.reduce((a, b) => a + b, 0);
    if (sum <= 0) return raw.map(() => (raw.length === 0 ? 0 : 1 / raw.length));
    return raw.map((v) => v / sum);
}

function makeBars(contributions: number[], current: number, done: boolean): VisualEntity[] {
    return contributions.map((value, index) => {
        let state: EntityState = "idle";
        if (done) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(5),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, contribution: value },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DivergenceInput | null) ?? {};
    const rawP: number[] = Array.isArray(task.p) ? task.p : [0.5, 0.25, 0.25, 0];
    const rawQ: number[] = Array.isArray(task.q) ? task.q : [0.1, 0.2, 0.3, 0.4];
    const m = Math.max(rawP.length, rawQ.length);
    const p = normalize(Array.from({ length: m }, (_, i) => rawP[i] ?? 0));
    const q = normalize(Array.from({ length: m }, (_, i) => rawQ[i] ?? 0), FLOOR);
    const contributions: number[] = [];
    let step = 0;

    const frame = (current: number, done: boolean, description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step,
        entities: makeBars(
            contributions.length === 0
                ? new Array<number>(m).fill(0)
                : [...contributions, ...new Array<number>(m - contributions.length).fill(0)],
            current,
            done,
        ),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            bins: m,
            p,
            q,
            contributions: [...contributions],
            divergence: contributions.reduce((a, b) => a + b, 0),
        },
    });

    yield frame(-1, false, `Accumulating Pearson chi-square divergence over ${m} bin(s).`, 0);
    step += 1;

    for (let i = 0; i < m; i += 1) {
        const pi = p[i] ?? 0;
        const qi = q[i] ?? FLOOR;
        const contribution = ((pi - qi) ** 2) / qi;
        contributions.push(contribution);
        yield frame(i, false, `Bin ${i}: p=${pi.toFixed(4)}, q=${qi.toFixed(4)}; contribution ${contribution.toFixed(5)}.`, 3);
        step += 1;
    }

    const divergence = contributions.reduce((a, b) => a + b, 0);
    yield frame(-1, true, `Pearson chi-square divergence is ${divergence.toFixed(5)}.`, 5);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Chi-square divergence asks, bin by bin, how far the observed distribution is from the reference and divides that gap by the reference probability. Bins where the reference is rare therefore count much more. The result is a nonnegative score that vanishes only for identical distributions and grows as the two drift apart, but it is not symmetric, so the order of the arguments matters.",
        invariants: [
            "Both displayed distributions are nonnegative and sum to one.",
            "Every bin contribution is nonnegative.",
            "The divergence is zero exactly when the two distributions match.",
        ],
        correctness:
            "Normalizing makes the inputs valid probability vectors, and flooring Q keeps every denominator positive. Each term (p_i - q_i)^2 / q_i is nonnegative and vanishes exactly when p_i equals q_i, so the total is nonnegative and is zero only when all bins match. The expression is Pearson's chi-square divergence up to a factor of one half in some conventions; summing the per-bin terms computes its definition directly, and swapping P and Q changes the denominators and hence generally the value.",
        complexityRationale:
            "After normalizing both vectors, one pass over the m bins computes a constant number of arithmetic operations per bin, so time is O(m); storing one contribution bar per bin uses O(m) space.",
        uses: [
            "Goodness-of-fit comparison of observed counts with expected counts",
            "Measuring categorical distribution shift in monitoring pipelines",
            "Building blocks for chi-square independence tests and feature selection",
        ],
        references: [
            "Pearson, On the Criterion That a Given System of Deviations from the Probable in the Case of a Correlated System of Variables Is Such That It Can Be Reasonably Supposed to Have Arisen from Random Sampling, 1900",
            "Cover and Thomas, Elements of Information Theory, Chapter 11",
        ],
        workedExample:
            "For P = (0.5, 0.5) and Q = (0.25, 0.75), the contributions are (0.25)^2 / 0.25 = 0.25 and (0.25)^2 / 0.75 about 0.083, giving a divergence near 0.333. Swapping the roles of P and Q gives a different total, illustrating the asymmetry.",
    },
    id: "chi-square-divergence",
    name: "Chi-Square Divergence",
    category: "statistics-probability",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { p: [0.5, 0.25, 0.25, 0], q: [0.1, 0.2, 0.3, 0.4] },
    visualType: "array",
    run,
    pseudocode: [
        "read two nonnegative vectors and normalize each to sum to one",
        "floor the reference vector away from zero",
        "set the divergence total to zero",
        "for each bin square p minus q and divide by q",
        "add the term to the divergence total",
        "done: report the accumulated chi-square divergence",
    ],
};

export default module;
