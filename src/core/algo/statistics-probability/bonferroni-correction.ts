/**
 * bonferroni-correction.ts - Bonferroni Family-Wise Error Correction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When many hypotheses are tested at once, using a significance level alpha
 * for each test inflates the chance of at least one false rejection. The
 * Bonferroni correction spends the family-wise budget evenly: a raw p value is
 * declared significant only when it is at most alpha divided by the number of
 * tests. Equivalently, each p value is reported as min(1, m times p). The union
 * bound guarantees the family-wise error rate stays at or below alpha.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m) for m hypotheses
 *   Space: O(m) for the adjusted p values and decisions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per hypothesis shows its raw p value.
 *   - A rejected hypothesis turns green; a retained one stays idle.
 *   - The final frame reports the shared threshold and the FWER bound.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface BonferroniInput {
    pValues?: number[];
    alpha?: number;
}

/** Build one bar per p value. */
function makeBars(pValues: number[], current: number, rejected: number[], done: boolean): VisualEntity[] {
    return pValues.map((p, index) => {
        let state: EntityState = "idle";
        if (done || rejected[index] === 1) {
            state = "sorted";
        } else if (index === current) {
            state = "comparing";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: `H${index + 1}: p=${p.toFixed(4)}${rejected[index] === 1 ? " reject" : ""}`,
            value: p,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, p, rejected: rejected[index] === 1 },
        };
    });
}

/** The Bonferroni correction generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BonferroniInput | null) ?? {};
    const pValues: number[] = Array.isArray(task.pValues)
        ? task.pValues.map((p) => Math.min(1, Math.max(0, Number(p))))
        : [0.001, 0.01, 0.04, 0.2, 0.6];
    const m = Math.max(1, pValues.length);
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.05;
    const threshold = alpha / m;
    const adjustedP = pValues.map((p) => Math.min(1, m * p));
    const rejected: number[] = pValues.map((p) => (p <= threshold ? 1 : 0));
    const rejectCount = rejected.reduce((a, b) => a + b, 0);
    const fwerBound = Math.min(1, m * threshold);
    const uncorrectedCount = pValues.filter((p) => p <= alpha).length;

    yield {
        stepNumber: 0,
        entities: makeBars(pValues, -1, rejected, false),
        edges: [],
        description: `Testing ${m} hypotheses with family-wise level ${alpha.toFixed(4)}; per-test threshold ${threshold.toFixed(6)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { m, alpha, threshold, adjustedP: [...adjustedP], rejected: [...rejected], rejectCount, fwerBound, uncorrectedCount },
    };
    let step = 1;

    for (let i = 0; i < pValues.length; i += 1) {
        const p = pValues[i] ?? 0;
        yield {
            stepNumber: step,
            entities: makeBars(pValues, i, rejected, false),
            edges: [],
            description: `H${i + 1}: p=${p.toFixed(5)} ${rejected[i] === 1 ? "at or below" : "above"} ${threshold.toFixed(6)}, adjusted p=${(adjustedP[i] ?? 0).toFixed(5)}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { m, alpha, threshold, adjustedP: [...adjustedP], rejected: [...rejected], rejectCount, fwerBound, uncorrectedCount, current: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pValues, -1, rejected, true),
        edges: [],
        description: `${rejectCount} of ${m} hypotheses rejected; the union bound keeps family-wise error at or below ${fwerBound.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { m, alpha, threshold, adjustedP, rejected, rejectCount, fwerBound, uncorrectedCount },
    };
}

/** The Bonferroni correction module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Testing twenty hypotheses each at the five percent level makes a false alarm somewhere quite likely. Bonferroni splits the overall error budget equally, so each test must clear a stricter bar of alpha divided by the number of tests. The same result can be stated by inflating every p value by the number of tests and capping at one.",
        invariants: [
            "The shared threshold is alpha divided by the number of hypotheses.",
            "Each adjusted p value is at least the raw p value and at most one.",
            "A hypothesis is rejected exactly when its raw p value is at most the threshold.",
        ],
        correctness:
            "Let E_i be the event that test i falsely rejects under its null. The probability that any of the m tests falsely rejects is at most the sum of the individual probabilities by the union bound. Each is bounded by alpha over m, so the sum is at most alpha regardless of dependence among tests. Declaring significance when p is at most alpha over m therefore controls the family-wise error rate, and reporting min(1, m p) gives the same decisions by an equivalent inequality.",
        complexityRationale:
            "The module makes one pass over the p values to form adjusted values and decisions, so time is O(m). It stores an adjusted value and a decision per hypothesis, giving O(m) space.",
        uses: [
            "Correcting a panel of genome-wide association tests",
            "Controlling false positives across many A/B test metrics",
            "A conservative baseline before applying false discovery rate methods",
        ],
        references: [
            "Bonferroni, Teoria statistica delle classi e calcolo delle probabilita, 1936",
            "Benjamini and Hochberg, Controlling the False Discovery Rate, 1995",
        ],
        workedExample:
            "With ten hypotheses and alpha 0.05 the threshold is 0.005. A p value of 0.001 is rejected because it clears the threshold, while 0.01 is not. The adjusted p values are 0.01 and 0.1 respectively, so comparing them with 0.05 gives the same verdicts.",
    },
    id: "bonferroni-correction",
    name: "Bonferroni Correction",
    category: "statistics-probability",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { pValues: [0.001, 0.01, 0.04, 0.2, 0.6], alpha: 0.05 },
    visualType: "array",
    run,
    pseudocode: [
        "read the m raw p values and the family-wise level alpha",
        "set the per-test threshold to alpha divided by m",
        "for each hypothesis compute adjusted p as the smaller of one and m times p",
        "reject the hypothesis when p is at most the threshold",
        "count the rejected hypotheses",
        "bound the family-wise error rate by m times the threshold",
        "done: report adjusted p values, decisions, and the FWER bound",
    ],
};

export default module;
