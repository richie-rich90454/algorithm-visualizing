/**
 * elu-activation.ts - Exponential Linear Unit
 *
 * The exponential linear unit keeps the identity on the positive side but
 * replaces the negative side with alpha times (exp(x) - 1). It saturates to
 * -alpha for very negative inputs, which pushes the mean activation toward
 * zero and often speeds up learning. Its derivative is 1 for positive inputs
 * and alpha times exp(x) otherwise.
 *
 * Time O(n) for n inputs; space O(n) for the result table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface EluResult {
    x: number;
    value: number;
    derivative: number;
}

/** Evaluate the exponential linear unit and its derivative at x. */
export function eluFor(x: number, alpha: number): EluResult {
    if (x > 0) {
        return { x, value: x, derivative: 1 };
    }
    const exp = Math.exp(x);
    return { x, value: alpha * (exp - 1), derivative: alpha * exp };
}

function makeCells(results: EluResult[], alpha: number, revealed: number, current: number): VisualEntity[] {
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
        : [-4, -3, -2, -1, -0.5, 0, 0.5, 1, 2];
    const alpha = typeof task.alpha === "number" ? task.alpha : 1;
    const results = values.map((x) => eluFor(x, alpha));
    const metaBase = { rows: results.length, cols: 3, alpha };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, alpha, -1, -1),
        edges: [],
        description: `Exponential linear unit on ${results.length} inputs with alpha ${alpha}.`,
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
            description: `x=${(r?.x ?? 0).toFixed(2)}, ${(r?.x ?? 0) > 0 ? "linear branch" : "exponential branch"}: output ${(r?.value ?? 0).toFixed(4)}, slope ${(r?.derivative ?? 0).toFixed(4)}.`,
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
        description: `Done: negative inputs saturate smoothly near minus alpha (${-alpha}).`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ELU behaves like ReLU for positive inputs but curves smoothly below zero instead of snapping to a flat line. The negative tail approaches a fixed value of minus alpha, so large negative activations carry a consistent signal rather than a hard zero. This often makes networks learn faster and generalize better than plain ReLU.",
        invariants: [
            "For x greater than zero the output equals x and the derivative equals 1.",
            "For x at most zero the output is alpha times exp(x) minus one.",
            "As x goes to negative infinity the output approaches minus alpha while the derivative approaches zero.",
        ],
        correctness:
            "The value and derivative are evaluated from the two analytic branches of the definition, so they are exact by construction. The branches meet at zero because alpha times exp(0) minus one is zero, matching the positive branch. The derivative formula alpha times exp(x) is the derivative of the negative branch; the tests verify it against a centered finite difference at every input away from zero.",
        complexityRationale:
            "Each input needs at most one exponential and a few products, all constant time, so n inputs take O(n) time and O(n) space for the result table.",
        uses: [
            "Hidden layers of deep convolutional networks",
            "Models where pushing mean activations toward zero helps learning",
            "Alternatives to ReLU that avoid dead units",
        ],
        references: [
            "Clevert, Unterthiner, and Hochreiter, Fast and Accurate Deep Network Learning by Exponential Linear Units, ICLR 2016",
            "Xu et al., Empirical Evaluation of Rectified Activations in Convolutional Network, 2015",
        ],
        workedExample:
            "With alpha = 1, an input of 2 passes through as 2. An input of -1 gives exp(-1) minus 1, about -0.632, with slope exp(-1), about 0.368. An input of -4 gives about -0.982, already close to the -1 floor.",
    },
    id: "elu-activation",
    name: "Exponential Linear Unit",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-4, -3, -2, -1, -0.5, 0, 0.5, 1, 2], alpha: 1 },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input value x",
        "if x is positive then output x and slope one",
        "otherwise compute exp of x",
        "set output to alpha times exp of x minus one",
        "set slope to alpha times exp of x",
        "done: report all activated values",
    ],
};

export default module;
