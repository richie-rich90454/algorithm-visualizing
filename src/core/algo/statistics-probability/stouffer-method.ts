/**
 * stouffer-method.ts - Stouffer's Combined Z Score Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Stouffer's method combines independent p values by converting each one to a
 * standard normal score, weighting and summing those scores, and dividing by
 * the square root of the sum of squared weights. The result is a single Z score
 * that can be turned back into a combined p value.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k * I) for k studies and I bisection steps per score
 *   Space: O(k) for the displayed contribution bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each study contributes one bar of height weight times normal score.
 *   - The study currently being converted is highlighted.
 *   - The final frame reports the combined Z and its p value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function erf(x: number): number {
    const sign = x >= 0 ? 1 : -1;
    const ax = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * ax);
    const poly =
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
            0.254829592) *
        t;
    return sign * (1 - poly * Math.exp(-ax * ax));
}

function normalCdf(z: number): number {
    return 0.5 * (1 + erf(z / Math.SQRT2));
}

function clampP(value: number): number {
    if (!Number.isFinite(value)) {
        return 0.5;
    }
    return Math.min(1 - 1e-12, Math.max(1e-12, value));
}

function inverseNormal(upperTail: number): number {
    const target = 1 - clampP(upperTail);
    let low = -12;
    let high = 12;
    for (let i = 0; i < 80; i += 1) {
        const mid = (low + high) / 2;
        if (normalCdf(mid) < target) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return (low + high) / 2;
}

function makeBars(scores: number[], active: number, done: boolean): VisualEntity[] {
    return scores.map((score, index) => {
        let state: EntityState = done ? "sorted" : "idle";
        if (!done && index === active) {
            state = "active";
        }
        return {
            id: `study-${index}`,
            type: "bar" as const,
            label: score.toFixed(3),
            value: score,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, score },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { pValues?: number[]; weights?: number[] } | null) ?? {};
    const pValues: number[] = Array.isArray(task.pValues) ? task.pValues.slice() : [0.03, 0.2, 0.005];
    const weights: number[] =
        Array.isArray(task.weights) && task.weights.length === pValues.length
            ? task.weights.slice()
            : pValues.map(() => 1);
    const k = pValues.length;
    const scores = pValues.map((p, i) => inverseNormal(p) * (weights[i] ?? 1));

    yield {
        stepNumber: 0,
        entities: makeBars(scores, -1, false),
        edges: [],
        description: `Combining ${k} p value(s) with Stouffer's weighted Z method.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { k, Z: 0, combinedP: 0.5 },
    };
    let step = 1;

    for (let i = 0; i < k; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(scores, i, false),
            edges: [],
            description: `Study ${i + 1} has p = ${(pValues[i] ?? 0.5).toFixed(4)}; its weighted normal score is ${(scores[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { k, Z: 0, combinedP: 0.5 },
        };
        step += 1;
    }

    const sumScores = scores.reduce((sum, value) => sum + value, 0);
    const sumSquaredWeights = weights.reduce((sum, value) => sum + value * value, 0);
    const denominator = Math.sqrt(sumSquaredWeights);
    const Z = denominator > 0 ? sumScores / denominator : 0;
    yield {
        stepNumber: step,
        entities: makeBars(scores, -1, true),
        edges: [],
        description: `Weighted score sum is ${sumScores.toFixed(4)}; divisor is ${denominator.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { k, Z, combinedP: 0.5, sumScores, denominator },
    };
    step += 1;

    const combinedP = 1 - normalCdf(Z);
    yield {
        stepNumber: step,
        entities: makeBars(scores, -1, true),
        edges: [],
        description: `Stouffer's Z is ${Z.toFixed(4)} with one sided combined p value ${combinedP.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { k, Z, combinedP },
    };
}

/** The Stouffer method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than multiplying p values, Stouffer's method turns each into a distance from the middle of a normal curve and averages those distances in a weighted way. Studies that agree push the combined score in the same direction, and a study with more weight counts for more.",
        invariants: [
            "A p value of one half maps to a normal score of zero.",
            "The combined Z has a standard normal distribution under the global null.",
            "Reversing every p value around one half negates the combined Z.",
        ],
        correctness:
            "For a uniform null p value, one minus p is also uniform and its inverse normal transform is a standard normal variate. A weighted sum of independent standard normals divided by the square root of the sum of squared weights is again standard normal, so the resulting Z and its tail probability form a valid combined test.",
        complexityRationale:
            "Each study needs one inverse normal transform, done here by binary search with a fixed iteration count, plus one pass for the sums; the work is linear in k up to that constant factor.",
        uses: [
            "Meta-analysis when study directions and weights differ",
            "Combining dependent or weighted signals in genomics",
            "Pooling evidence from several quality control checks",
        ],
        references: [
            "Stouffer, The American Soldier: Adjustment During Army Life, 1949",
            "Hedges and Olkin, Statistical Methods for Meta-Analysis, 1985",
        ],
        workedExample:
            "Three studies with p values 0.03, 0.20 and 0.005 have normal scores near 1.88, 0.84 and 2.58. With equal weights the numerator is about 5.30, the divisor is the square root of three, and the combined Z is about 3.06, corresponding to a small combined p value.",
    },
    id: "stouffer-method",
    name: "Stouffer's Combined Z Method",
    category: "statistics-probability",
    complexity: { time: "O(k * I)", space: "O(k)" },
    defaultInput: { pValues: [0.03, 0.2, 0.005] },
    visualType: "array",
    run,
    pseudocode: [
        "read the p values and optional study weights",
        "for each study convert the p value to a standard normal score",
        "multiply each score by its study weight",
        "sum the weighted scores",
        "divide the sum by the square root of the sum of squared weights",
        "convert the combined Z back to a one sided p value",
        "done: report Stouffer's combined Z",
    ],
};

export default module;
