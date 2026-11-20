/**
 * mish-activation.ts - Mish Activation
 *
 * Mish is the smooth non-monotonic activation f(x) = x * tanh(softplus(x)),
 * where softplus(x) = ln(1 + exp(x)). It keeps a small negative tail instead of
 * hard-zeroing it, which often helps deep networks train. A stable softplus
 * avoids overflow for large magnitudes.
 *
 * Time O(n) for n inputs, space O(n) for the stored values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Numerically stable softplus: max(x,0) + log(1 + exp(-|x|)). */
export function softplus(x: number): number {
    return Math.max(x, 0) + Math.log1p(Math.exp(-Math.abs(x)));
}

export function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

export interface MishResult {
    x: number;
    softplus: number;
    tanh: number;
    value: number;
    derivative: number;
}

/** Evaluate Mish, its internal gates, and its analytic derivative at x. */
export function mishFor(x: number): MishResult {
    const sp = softplus(x);
    const t = Math.tanh(sp);
    return {
        x,
        softplus: sp,
        tanh: t,
        value: x * t,
        derivative: t + x * sigmoid(x) * (1 - t * t),
    };
}

const COLUMNS = ["x", "softplus", "tanh", "mish", "derivative"];

function makeCells(results: MishResult[], revealed: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    results.forEach((result, row) => {
        const values = [result.x, result.softplus, result.tanh, result.value, result.derivative];
        COLUMNS.forEach((column, col) => {
            const shown = row <= revealed;
            const state: EntityState = row === active ? "comparing" : shown ? "sorted" : "idle";
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
        : [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4];
    const results = values.map(mishFor);
    const base = { rows: results.length, cols: COLUMNS.length };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, -1, -1),
        edges: [],
        description: `Mish on ${results.length} inputs: multiply x by tanh of its softplus and track the slope.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, values: results.map((r) => r.value) },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const r = results[i]!;
        yield {
            stepNumber: step,
            entities: makeCells(results, i, i),
            edges: [],
            description: `x=${r.x.toFixed(2)}: softplus=${r.softplus.toFixed(4)}, tanh=${r.tanh.toFixed(4)}, Mish=${r.value.toFixed(4)}, slope=${r.derivative.toFixed(4)}.`,
            codeLineNumber: r.x < 0 ? 2 : 3,
            layout: "grid",
            meta: { ...base, active: i, values: results.map((v) => v.value) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, results.length - 1, -1),
        edges: [],
        description: "Done: Mish stays near zero for large negative inputs and near linear for large positive inputs.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, values: results.map((r) => r.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Mish smooths the hard gate of ReLU. It scales the input by a soft gate built from tanh of the softplus of x. For large positive inputs the gate is almost one, so Mish behaves like the identity; for large negative inputs the gate is almost zero, but the curve keeps a shallow dip before flattening. That small negative region gives gradients a path through units that would otherwise be dead.",
        invariants: [
            "softplus(x) is ln(1 + exp(x)), evaluated stably as max(x,0) + ln(1 + exp(-|x|)).",
            "The gate tanh(softplus(x)) always lies strictly between zero and one.",
            "Mish(0) is exactly zero because the input factor is zero.",
        ],
        correctness:
            "The implementation applies the defining formula x times tanh of softplus with a stable softplus that is algebraically identical to ln(1 + exp(x)). Differentiating by the product rule gives tanh(softplus) plus x times sigmoid(x) times one minus tanh(softplus) squared, using the identities d/dx softplus = sigmoid(x) and d/dx tanh = 1 - tanh squared. The tests compare values against a direct evaluation, verify the analytic slope against a finite difference, and check the symmetry of the negative tail.",
        complexityRationale:
            "Each input needs one exponential, one logarithm, one tanh, and a few products, all constant time, so n inputs cost O(n) time and O(n) space for the stored rows.",
        uses: [
            "Convolutional backbone networks such as YOLO",
            "Smooth non-monotonic alternative to ReLU and Swish",
            "Deep networks where dead ReLU units are a concern",
        ],
        references: [
            "Misra, Mish: A Self Regularized Non-Monotonic Activation Function, BMVC, 2020",
            "Nair and Hinton, Rectified Linear Units Improve Restricted Boltzmann Machines, 2010",
        ],
        workedExample:
            "At x = 0, softplus is ln 2 about 0.693, tanh of that is about 0.6, but the input factor is zero so Mish is zero. At x = 1, softplus is about 1.313, tanh about 0.865, giving Mish about 0.865. At x = -1, softplus is about 0.313, tanh about 0.304, giving Mish about -0.304, a small nonzero tail.",
    },
    id: "mish-activation",
    name: "Mish Activation",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4] },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input value x",
        "compute softplus as log of one plus exp of x in a stable form",
        "compute the gate as tanh of the softplus value",
        "multiply x by the gate to obtain the Mish value",
        "compute the slope as the gate plus x times sigmoid of x times one minus gate squared",
        "store the value and slope for the visualization",
        "done: report all activated values",
    ],
};

export default module;
