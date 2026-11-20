/**
 * sidak-correction.ts - Sidak Family-Wise Error Correction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * When m independent hypotheses are each tested at level alpha, the chance of
 * at least one false rejection grows to 1 - (1 - alpha)^m. Sidak's correction
 * keeps that family-wise error rate exactly alpha under independence by using
 * the per-test threshold 1 - (1 - alpha)^(1/m). Equivalently, each raw p value
 * is reported as the adjusted value 1 - (1 - p)^m. It is slightly less
 * conservative than Bonferroni, whose threshold is alpha / m.
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
 *   - The final frame reports the shared threshold and the exact FWER bound.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SidakInput {
    pValues?: number[];
    alpha?: number;
}

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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SidakInput | null) ?? {};
    const pValues: number[] = Array.isArray(task.pValues)
        ? task.pValues.map((p) => Math.min(1, Math.max(0, Number(p))))
        : [0.001, 0.01, 0.04, 0.2, 0.6];
    const m = Math.max(1, pValues.length);
    const alpha = typeof task.alpha === "number" ? Math.min(1, Math.max(0, task.alpha)) : 0.05;
    const threshold = 1 - Math.pow(1 - alpha, 1 / m);
    const adjustedP = pValues.map((p) => 1 - Math.pow(1 - p, m));
    const rejected: number[] = pValues.map((p) => (p <= threshold ? 1 : 0));
    const rejectCount = rejected.reduce((a, b) => a + b, 0);
    const fwer = 1 - Math.pow(1 - threshold, m);
    const bonferroniThreshold = alpha / m;

    yield {
        stepNumber: 0,
        entities: makeBars(pValues, -1, rejected, false),
        edges: [],
        description: `Testing ${m} independent hypotheses at family-wise level ${alpha.toFixed(4)}; Sidak threshold ${threshold.toFixed(6)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { m, alpha, threshold, adjustedP, rejected, rejectCount, fwer, bonferroniThreshold },
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
            meta: { m, alpha, threshold, adjustedP, rejected, rejectCount, fwer, bonferroniThreshold, current: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pValues, -1, rejected, true),
        edges: [],
        description: `${rejectCount} of ${m} hypotheses rejected; under independence family-wise error is exactly ${fwer.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { m, alpha, threshold, adjustedP, rejected, rejectCount, fwer, bonferroniThreshold },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Testing many hypotheses at the five percent level makes a false alarm somewhere surprisingly likely. Sidak spends the family-wise budget by asking what per-test threshold makes the chance of any false rejection come back to alpha. Under independence that threshold is slightly more permissive than Bonferroni's simple division, so it rejects a little more often at the same guaranteed error rate.",
        invariants: [
            "The per-test threshold is 1 minus (1 minus alpha) to the power 1 over m.",
            "Each adjusted p value is at least the raw p value and at most one.",
            "Under independence the family-wise error rate equals alpha exactly.",
        ],
        correctness:
            "If the m tests are independent and each falsely rejects with probability alpha prime, the probability of no false rejection is (1 - alpha prime)^m, so the family-wise error rate is 1 - (1 - alpha prime)^m. Setting alpha prime to 1 - (1 - alpha)^(1/m) makes that expression equal alpha. The adjusted p value 1 - (1 - p)^m satisfies adjusted p at most alpha exactly when p is at most the threshold, so the two decision rules agree. Bernoulli's inequality gives 1 - (1 - p)^m at most m p, which is why Sidak is never more conservative than Bonferroni.",
        complexityRationale:
            "One pass over the m p values computes each adjusted value and decision with a constant number of power operations, so time is O(m); storing an adjusted value and a decision per hypothesis uses O(m) space.",
        uses: [
            "Controlling family-wise error across independent A/B test metrics",
            "Multiplicity correction in genome-wide association studies",
            "A sharper alternative to Bonferroni when test independence is plausible",
        ],
        references: [
            "Sidak, On Multivariate Normal and Related Probabilities, 1967",
            "Hochberg and Tamhane, Multiple Comparison Procedures, Chapter 2",
        ],
        workedExample:
            "With five independent tests and alpha 0.05 the threshold is 1 - 0.95^(1/5), about 0.0102, which is a little above the Bonferroni threshold of 0.01. A p value of 0.009 is rejected, and its adjusted value is 1 - 0.991^5, about 0.044, below 0.05. The five individual tests together reject falsely with probability about 0.05.",
    },
    id: "sidak-correction",
    name: "Sidak Correction",
    category: "statistics-probability",
    complexity: { time: "O(m)", space: "O(m)" },
    defaultInput: { pValues: [0.001, 0.01, 0.04, 0.2, 0.6], alpha: 0.05 },
    visualType: "array",
    run,
    pseudocode: [
        "read the m raw p values and the family-wise level alpha",
        "set the per-test threshold to 1 minus (1 - alpha) raised to 1 over m",
        "for each hypothesis set adjusted p to 1 minus (1 - p) raised to m",
        "reject the hypothesis when p is at most the threshold",
        "count the rejected hypotheses",
        "bound family-wise error by 1 minus (1 - threshold) raised to m",
        "done: report adjusted p values, decisions, and the FWER bound",
    ],
};

export default module;
