/**
 * relu6.ts - ReLU6 Activation
 *
 * ReLU6 clamps the rectified linear unit at an upper bound of six:
 * f(x) = min(max(0, x), 6). The cap keeps activations bounded, which is useful
 * for low-precision fixed-point inference where large values would overflow.
 * Its derivative is one strictly between zero and six and zero outside.
 *
 * Time O(n) for n inputs; space O(n) for the result table.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface Relu6Result {
    x: number;
    value: number;
    derivative: number;
}

/** Evaluate ReLU6 and its derivative at x with the given upper bound. */
export function relu6For(x: number, cap: number): Relu6Result {
    if (x <= 0) {
        return { x, value: 0, derivative: 0 };
    }
    if (x >= cap) {
        return { x, value: cap, derivative: 0 };
    }
    return { x, value: x, derivative: 1 };
}

function makeCells(results: Relu6Result[], cap: number, revealed: number, current: number): VisualEntity[] {
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
    const task = (input as { values?: number[]; cap?: number } | null) ?? {};
    const values: number[] = Array.isArray(task.values) && task.values.length > 0
        ? task.values
        : [-3, -1, 0, 1, 3, 5, 6, 7, 9];
    const cap = typeof task.cap === "number" ? task.cap : 6;
    const results = values.map((x) => relu6For(x, cap));
    const metaBase = { rows: results.length, cols: 3, cap };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(results, cap, -1, -1),
        edges: [],
        description: `ReLU6 on ${results.length} inputs with upper bound ${cap}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value) },
    };
    step += 1;

    for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        const branch = (r?.x ?? 0) <= 0 ? "clamped at zero" : (r?.x ?? 0) >= cap ? "clamped at the cap" : "linear region";
        yield {
            stepNumber: step,
            entities: makeCells(results, cap, i, i),
            edges: [],
            description: `x=${(r?.x ?? 0).toFixed(2)}, ${branch}: output ${(r?.value ?? 0).toFixed(4)}, slope ${(r?.derivative ?? 0).toFixed(4)}.`,
            codeLineNumber: (r?.x ?? 0) <= 0 ? 1 : (r?.x ?? 0) >= cap ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, current: i, values: results.map((v) => v.value) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(results, cap, results.length - 1, -1),
        edges: [],
        description: `Done: outputs are confined to the interval from zero to ${cap}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, values: results.map((r) => r.value), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ReLU6 is the ordinary rectified linear unit with a ceiling. Negative inputs become zero, inputs between zero and six pass through, and anything above six is clipped to six. The upper bound keeps activations in a small range, which makes the model friendly to quantization and mobile inference.",
        invariants: [
            "Every output lies in the closed interval from zero to the cap.",
            "Inside the linear region the output equals the input and the slope is one.",
            "Both clamped regions have zero slope.",
        ],
        correctness:
            "The branch selection is a direct translation of min(max(0, x), cap), so the output is exact by construction. The derivative is one only in the open interval where the function is the identity and zero in each saturated region; the tests verify the value against the clamp formula and the derivative against a centered finite difference away from the two breakpoints.",
        complexityRationale:
            "Each input takes two comparisons and no loops, so n inputs require O(n) time and O(n) space for the result table.",
        uses: [
            "Mobile and embedded vision models such as MobileNet",
            "Quantized networks where bounded activations prevent overflow",
            "Feature extraction with a hard saturation point",
        ],
        references: [
            "Courbariaux, Bengio, and David, BinaryConnect, NIPS 2015",
            "Howard et al., MobileNets, arXiv 2017",
        ],
        workedExample:
            "With the default cap of six, an input of -2 becomes 0, an input of 3 stays 3, an input of 6 stays 6, and an input of 9 is clipped to 6. The corresponding slopes are 0, 1, 0, and 0 because the last two inputs sit at or beyond the cap.",
    },
    id: "relu6",
    name: "ReLU6",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [-3, -1, 0, 1, 3, 5, 6, 7, 9], cap: 6 },
    visualType: "grid",
    run,
    pseudocode: [
        "for each input value x",
        "if x is at most zero then output zero and slope zero",
        "otherwise if x is at least the cap then output the cap and slope zero",
        "otherwise output x and slope one",
        "store the output and slope for the visualization",
        "done: report all activated values",
    ],
};

export default module;
