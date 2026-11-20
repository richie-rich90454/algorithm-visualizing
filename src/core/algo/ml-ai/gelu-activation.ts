/**
 * gelu-activation.ts - Gaussian Error Linear Unit (GELU)
 *
 * GELU multiplies its input by the probability that a standard normal variable
 * is below it: f(x) = x * Phi(x) = 0.5*x*(1 + erf(x / sqrt(2))). It is a smooth,
 * non-monotonic alternative to ReLU used in Transformer feed-forward layers.
 *
 * An Abramowitz-Stegun approximation to erf keeps the evaluation elementary.
 * Time O(n) for n inputs, space O(n) for the per-input values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Abramowitz and Stegun 7.1.26 approximation of the error function. */
export function erf(x: number): number {
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    if (ax === 0) {
        return 0;
    }
    const t = 1 / (1 + 0.3275911 * ax);
    const poly = (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t);
    return sign * (1 - poly * Math.exp(-ax * ax));
}

/** Standard normal cumulative distribution function via erf. */
export function normalCdf(x: number): number {
    return 0.5 * (1 + erf(x / Math.SQRT2));
}

/** Standard normal probability density function. */
function normalPdf(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export interface GeluResult {
    x: number;
    value: number;
    derivative: number;
    probability: number;
}

/** Evaluate GELU, its derivative, and the gate probability at x. */
export function geluFor(x: number): GeluResult {
    const probability = normalCdf(x);
    return {
        x,
        value: x * probability,
        derivative: probability + x * normalPdf(x),
        probability,
    };
}

function makeCells(results: GeluResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["x", "Phi(x)", "GELU", "derivative"];
    results.forEach((result, row) => {
        const values = [result.x, result.probability, result.value, result.derivative];
        columns.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? `${column} ${(values[col] ?? 0).toFixed(4)}` : "?",
                value: shown ? (values[col] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[] } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values
        : [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3];
    const results = values.map((x) => geluFor(x));
    const metaBase = { rows: results.length, cols: 4 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `GELU on ${results.length} inputs: multiply each x by the Gaussian gate probability Phi(x).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value) },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        yield {
            stepNumber: step,
            entities: makeCells(results, i, i),
            edges: [],
            description: `x=${(r?.x ?? 0).toFixed(2)}: Phi(x)=${(r?.probability ?? 0).toFixed(4)}, GELU=${(r?.value ?? 0).toFixed(4)}, slope ${(r?.derivative ?? 0).toFixed(4)}.`,
            codeLineNumber: r && r.x < 0 ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, values: results.map((v) => v.value) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: "Done: GELU behaves like x for large positive inputs and near zero for large negative inputs.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ReLU decides whether to pass an input with a hard zero-one gate. GELU softens that decision with a probability: it scales x by how likely a standard normal draw is to fall below x. The result is a smooth curve that looks almost linear for positive inputs and gently saturates for negative ones, which works well in large language models.",
        invariants: [
            "The gate is Phi(x), the standard normal cumulative distribution at x.",
            "The activation is x times Phi(x).",
            "The identity GELU(x) - GELU(-x) = x holds because Phi(x) + Phi(-x) = 1.",
        ],
        correctness:
            "The value is x times Phi(x) with Phi computed from erf, exactly the GELU definition. Since Phi(x) approaches one for large positive x, GELU approaches the identity; since it approaches zero for large negative x, GELU approaches zero. The reflection identity follows from the symmetry of the normal distribution and is checked in the tests. The analytic derivative is Phi(x) plus x times the normal density; a finite-difference check in the tests confirms it. An independent numerical integration of the normal density further verifies the gate values.",
        complexityRationale:
            "Each input needs one exponential, one approximation to erf, and a few products, all constant time, so n inputs cost O(n) time and O(n) space for the stored values.",
        uses: [
            "Feed-forward layers of GPT-style Transformers",
            "Smooth alternatives to ReLU in deep networks",
            "Language model architectures such as BERT",
        ],
        references: [
            "Hendrycks and Gimpel, Gaussian Error Linear Units, arXiv 2016",
            "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
        ],
        workedExample:
            "At x = 0, Phi(0) = 0.5 and GELU = 0. At x = 1, Phi(1) is about 0.8413 so GELU is about 0.841. At x = -1, Phi(-1) is about 0.1587 so GELU is about -0.159, much closer to zero than a linear unit would be.",
    },
    id: "gelu-activation",
    name: "GELU Activation",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input value x",
        "compute Phi(x) from the error function as half of one plus erf of x over square root two",
        "multiply x by Phi(x) to obtain the GELU value",
        "compute the slope as Phi(x) plus x times the normal density",
        "store the value and slope for the visualization",
        "done: report the activated values",
    ],
};

export default module;
