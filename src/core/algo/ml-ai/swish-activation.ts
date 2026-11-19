/**
 * swish-activation.ts - Swish / SiLU Activation
 *
 * Swish, also called the Sigmoid Linear Unit, is f(x) = x * sigmoid(x) =
 * x / (1 + exp(-x)). It is smooth, non-monotonic, and unbounded above while
 * approaching zero for large negative inputs. It is used in EfficientNet and
 * many modern convolutional networks.
 *
 * Time O(n) for n inputs, space O(n) for the per-input values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface SwishResult {
    x: number;
    sigmoid: number;
    value: number;
    derivative: number;
}

/** Compute the sigmoid, Swish value, and derivative at x. */
export function swishFor(x: number): SwishResult {
    const sigmoid = 1 / (1 + Math.exp(-x));
    const value = x * sigmoid;
    return {
        x,
        sigmoid,
        value,
        derivative: sigmoid + value * (1 - sigmoid),
    };
}

function makeCells(results: SwishResult[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const columns = ["x", "sigmoid", "Swish", "derivative"];
    results.forEach((result, row) => {
        const values = [result.x, result.sigmoid, result.value, result.derivative];
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
        : [-4, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3];
    const results = values.map((x) => swishFor(x));
    const metaBase = { rows: results.length, cols: 4 };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Swish on ${results.length} inputs: multiply each x by its sigmoid gate.`,
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
            description: `x=${(r?.x ?? 0).toFixed(2)}: sigmoid=${(r?.sigmoid ?? 0).toFixed(4)}, Swish=${(r?.value ?? 0).toFixed(4)}, slope ${(r?.derivative ?? 0).toFixed(4)}.`,
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
        description: "Done: Swish is nearly linear for positive inputs and smoothly approaches zero for negative ones.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Swish keeps the identity-like behavior of ReLU on positive inputs but replaces the hard zero with a smooth sigmoid gate. Near zero it dips slightly below zero before rising, giving it a small bump that helps gradients flow. The gate is learned-free and cheap, yet it often matches or beats ReLU in deep networks.",
        invariants: [
            "The gate is the logistic sigmoid 1 / (1 + exp(-x)).",
            "The activation is x times the sigmoid.",
            "The derivative is sigmoid(x) plus Swish(x) times one minus sigmoid(x).",
        ],
        correctness:
            "The value is evaluated directly as x divided by one plus exp(-x), which is the Swish definition. For large positive x the sigmoid approaches one and Swish approaches x; for large negative x the sigmoid approaches zero faster than x grows, so Swish approaches zero from below. The derivative is obtained by the product rule on x times sigmoid(x), giving sigmoid(x) plus x times sigmoid(x) times one minus sigmoid(x); the tests confirm it with finite differences. The function has a single minimum near x around minus 1.28, which the tests also locate approximately.",
        complexityRationale:
            "Each input needs one exponential and a few products, all constant time, so n inputs take O(n) time and O(n) space to keep the values.",
        uses: [
            "Convolutional networks such as EfficientNet",
            "Smooth gated activations in deep models",
            "Mobile and efficient vision architectures",
        ],
        references: [
            "Ramachandran, Zoph, and Le, Searching for Activation Functions, arXiv 2017",
            "Tan and Le, EfficientNet, ICML 2019",
        ],
        workedExample:
            "At x = 0 the sigmoid is 0.5 and Swish is 0. At x = 1 the sigmoid is about 0.731 so Swish is about 0.731. At x = -1 the sigmoid is about 0.269 so Swish is about -0.269, a small negative value; at x = -4 it is only about -0.072, showing the smooth approach to zero.",
    },
    id: "swish-activation",
    name: "Swish Activation",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-4, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3] },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input value x",
        "compute the sigmoid as one divided by one plus exp of minus x",
        "multiply x by the sigmoid to obtain the Swish value",
        "compute the slope as sigmoid plus Swish times one minus sigmoid",
        "store the value and slope for the visualization",
        "done: report the activated values",
    ],
};

export default module;
