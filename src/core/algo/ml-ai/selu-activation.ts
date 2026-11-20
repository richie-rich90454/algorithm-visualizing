/**
 * selu-activation.ts - Scaled Exponential Linear Unit
 *
 * SELU multiplies the exponential linear unit by a fixed scale greater than
 * one: f(x) = scale * x for positive x and scale * alpha * (exp(x) - 1)
 * otherwise. With alpha about 1.673 and scale about 1.051, the activation has
 * a self-normalizing property: with the matching initialization, layer outputs
 * keep a mean of zero and a variance of one across depth.
 *
 * Time O(n) for n inputs; space O(n) for the result table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export const SELU_ALPHA = 1.6732632423543772;
export const SELU_SCALE = 1.0507009873554805;

export interface SeluResult {
    x: number;
    value: number;
    derivative: number;
}

/** Evaluate SELU and its derivative at x using the canonical constants. */
export function seluFor(x: number): SeluResult {
    const inner = x > 0 ? x : SELU_ALPHA * (Math.exp(x) - 1);
    const slope = x > 0 ? SELU_SCALE : SELU_SCALE * SELU_ALPHA * Math.exp(x);
    return { x, value: SELU_SCALE * inner, derivative: slope };
}

function makeCells(results: SeluResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["x", "output", "slope"];
    results.forEach((result, row) => {
        const values = [result.x, result.value, result.derivative];
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
    const results = values.map((x) => seluFor(x));
    const metaBase = { rows: results.length, cols: 3, alpha: SELU_ALPHA, scale: SELU_SCALE };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `SELU on ${results.length} inputs with fixed self-normalizing constants.`,
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
            description: `x=${(r?.x ?? 0).toFixed(2)}, ${(r?.x ?? 0) > 0 ? "scaled linear" : "scaled exponential"}: output ${(r?.value ?? 0).toFixed(4)}, slope ${(r?.derivative ?? 0).toFixed(4)}.`,
            codeLineNumber: (r?.x ?? 0) > 0 ? 1 : 2,
            layout: "grid",
            meta: { ...metaBase, current: i, values: results.map((v) => v.value) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: "Done: the scale and alpha constants keep activations near zero mean and unit variance.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SELU is an exponential linear unit rescaled so that, when paired with the matching weight initialization, activations automatically return toward zero mean and unit variance after every layer. This self-normalizing behavior reduces the need for batch normalization in deep feedforward networks. The two constants are derived from the requirement that the fixed point of the activation distribution has unit variance.",
        invariants: [
            "For x greater than zero the output is scale times x.",
            "For x at most zero the output is scale times alpha times exp(x) minus one.",
            "The constants satisfy alpha times scale plus the positive-branch variance condition that gives self-normalization.",
        ],
        correctness:
            "The value and slope come directly from the two analytic branches multiplied by the fixed scale, so they are exact by construction. The branches meet at zero because both evaluate to zero there. The self-normalizing constants are the published analytic solution; the tests verify the formula and its derivative against a centered finite difference on every input away from zero.",
        complexityRationale:
            "Each input needs one comparison, at most one exponential, and a few products, so n inputs take O(n) time and O(n) space to keep the result table.",
        uses: [
            "Deep feedforward networks without explicit normalization layers",
            "Self-normalizing neural networks",
            "Tasks where stable activation statistics across layers matter",
        ],
        references: [
            "Klambauer, Unterthiner, Mayr, and Hochreiter, Self-Normalizing Neural Networks, NeurIPS 2017",
            "Xu et al., Empirical Evaluation of Rectified Activations in Convolutional Network, 2015",
        ],
        workedExample:
            "At x = 1 the output is scale times one, about 1.0507. At x = -1 the inner exponential linear unit is alpha times exp(-1) minus one, about -0.5486, and multiplying by scale gives about -0.5766; the slope there is scale times alpha times exp(-1), about 0.6462.",
    },
    id: "selu-activation",
    name: "Scaled Exponential Linear Unit",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input value x",
        "if x is positive set inner to x",
        "otherwise set inner to alpha times exp of x minus one",
        "multiply inner by the fixed scale to get the output",
        "multiply branch slope by scale to get the derivative",
        "done: report all activated values",
    ],
};

export default module;
