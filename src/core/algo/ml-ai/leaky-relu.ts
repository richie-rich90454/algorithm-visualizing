/**
 * leaky-relu.ts - Leaky Rectified Linear Unit
 *
 * Leaky ReLU avoids the "dying ReLU" problem by giving negative inputs a small
 * nonzero slope instead of flattening them to zero: f(x) = x when x > 0 and
 * f(x) = alpha * x otherwise, with a tiny default alpha of 0.01. Its derivative
 * is 1 on the positive side and alpha on the negative side, so gradients still
 * flow through units whose preactivation is negative.
 *
 * Time O(n) for n inputs; space O(n) for the tabulated results.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface LeakyReluResult {
    x: number;
    value: number;
    derivative: number;
}

/** Evaluate Leaky ReLU and its derivative at x. */
export function leakyReluFor(x: number, alpha: number): LeakyReluResult {
    const positive = x > 0;
    return {
        x,
        value: positive ? x : alpha * x,
        derivative: positive ? 1 : alpha,
    };
}

function makeCells(results: LeakyReluResult[], alpha: number, revealed: number, current: number): VisualEntity[] {
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
    const task = (input as { values?: number[]; alpha?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values
        : [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3];
    const alpha = typeof task.alpha === "number" ? task.alpha : 0.01;
    const results = values.map((x) => leakyReluFor(x, alpha));
    const metaBase = { rows: results.length, cols: 3, alpha };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, alpha, -1, -1),
        edges: [],
        description: `Leaky ReLU on ${results.length} inputs with negative slope ${alpha}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value) },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        yield {
            stepNumber: step,
            entities: makeCells(results, alpha, i, i),
            edges: [],
            description: `x=${(r?.x ?? 0).toFixed(2)}, ${(r?.x ?? 0) > 0 ? "positive pass-through" : "leaky branch"}: output ${(r?.value ?? 0).toFixed(4)}, slope ${(r?.derivative ?? 0).toFixed(4)}.`,
            codeLineNumber: (r?.x ?? 0) > 0 ? 1 : 2,
            layout: "grid",
            meta: { ...metaBase, current: i, values: results.map((v) => v.value) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, alpha, results.length - 1, -1),
        edges: [],
        description: "Done: positive inputs pass through unchanged and negative inputs keep a small slope.",
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain ReLU outputs zero for every negative input, which can kill a neuron permanently if its weights push it into that region. Leaky ReLU replaces the flat zero with a shallow ramp of slope alpha, so the unit still produces a small negative value and its gradient remains nonzero. The positive side is left untouched.",
        invariants: [
            "For x greater than zero the output equals x and the derivative equals 1.",
            "For x at most zero the output equals alpha times x and the derivative equals alpha.",
            "The function is continuous at zero because both branches meet at zero.",
        ],
        correctness:
            "The output is chosen directly from the two branches of the definition, so it is exact by construction. Continuity holds because the positive branch tends to zero from above and the negative branch tends to zero from below as x approaches zero. The derivative is piecewise constant because each branch is linear; the tests compare it with a centered finite difference on every input away from zero.",
        complexityRationale:
            "Evaluating one input needs a single comparison and a couple of products, so n inputs take O(n) time and O(n) space to retain the result table.",
        uses: [
            "Convolutional neural networks that suffer from dead ReLU units",
            "Hidden layers of generative adversarial networks",
            "Any network where a small negative gradient is preferable to zero",
        ],
        references: [
            "Maas, Hannun, and Ng, Rectifier Nonlinearities Improve Neural Network Acoustic Models, 2013",
            "Xu et al., Empirical Evaluation of Rectified Activations in Convolutional Network, 2015",
        ],
        workedExample:
            "With alpha = 0.01, an input of 2 passes through as 2 with slope 1, while an input of -3 becomes -0.03 with slope 0.01. At exactly zero the negative branch gives 0, so the two branches join smoothly.",
    },
    id: "leaky-relu",
    name: "Leaky ReLU",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-3, -2, -1, -0.5, 0, 0.5, 1, 2, 3], alpha: 0.01 },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input value x",
        "if x is positive then output x and slope one",
        "otherwise output alpha times x and slope alpha",
        "store the output and slope for the visualization",
        "done: report all activated values",
    ],
};

export default module;
