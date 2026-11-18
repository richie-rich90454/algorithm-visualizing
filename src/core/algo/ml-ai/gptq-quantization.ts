/**
 * gptq-quantization.ts - GPTQ Post-Training Quantization (Exact Teachable Core)
 *
 * GPTQ compresses a weight matrix by quantizing one row at a time while
 * compensating the rounding error of each weight into the still-unquantized
 * weights, using the inverse Hessian of the layer's squared error. This module
 * implements that one-row algorithm exactly for small inputs; it is the
 * mathematical core, not a full model-level quantizer.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface QuantResult {
    quantized: number[];
    error: number[];
    scale: number;
    zeroPoint: number;
    hessianInv: number[][];
}

/** Invert a small square matrix by Gauss-Jordan elimination with pivoting. */
export function invert(matrix: number[][]): number[][] {
    const n = matrix.length;
    const aug: number[][] = matrix.map((row, i) =>
        row.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))),
    );
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]?.[col] ?? 0) > Math.abs(aug[pivot]?.[col] ?? 0)) {
                pivot = r;
            }
        }
        const temp = aug[col];
        aug[col] = aug[pivot] as number[];
        aug[pivot] = temp as number[];
        const diag = aug[col]?.[col] ?? 1;
        for (let c = 0; c < 2 * n; c += 1) {
            aug[col]![c] = (aug[col]![c] ?? 0) / diag;
        }
        for (let r = 0; r < n; r += 1) {
            if (r === col) {
                continue;
            }
            const factor = aug[r]?.[col] ?? 0;
            for (let c = 0; c < 2 * n; c += 1) {
                aug[r]![c] = (aug[r]![c] ?? 0) - factor * (aug[col]![c] ?? 0);
            }
        }
    }
    return aug.map((row) => row.slice(n));
}

/** Uniform affine quantization of one number onto a bits-wide integer grid. */
export function quantizeValue(value: number, scale: number, zeroPoint: number, bits: number): number {
    const levels = Math.pow(2, bits) - 1;
    const step = scale === 0 ? 0 : Math.round((value - zeroPoint) / scale);
    const clamped = Math.max(0, Math.min(levels, step));
    return clamped * scale + zeroPoint;
}

/** Run GPTQ on a single row of weights given its error Hessian. */
export function gptqQuantize(weights: number[], hessian: number[][], bits: number): QuantResult {
    const n = weights.length;
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const levels = Math.pow(2, bits) - 1;
    const scale = levels === 0 ? 0 : (max - min) / levels;
    const zeroPoint = min;
    const hessianInv = invert(hessian);
    const error: number[] = Array(n).fill(0);
    const quantized: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        const corrected = (weights[i] ?? 0) + (error[i] ?? 0);
        const q = quantizeValue(corrected, scale, zeroPoint, bits);
        quantized[i] = q;
        const hii = hessianInv[i]?.[i] ?? 1;
        const compensation = (corrected - q) / hii;
        for (let j = i + 1; j < n; j += 1) {
            error[j] = (error[j] ?? 0) + compensation * (hessianInv[i]?.[j] ?? 0);
        }
    }
    return { quantized, error, scale, zeroPoint, hessianInv };
}

function makeCells(
    weights: number[],
    quantized: number[],
    revealed: number,
    current: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows = ["weight w", "quantized q"];
    rows.forEach((label, row) => {
        weights.forEach((_value, col) => {
            const shown = col <= revealed;
            const state: EntityState = col === current ? "comparing" : shown ? "sorted" : "idle";
            const text = row === 0 ? (weights[col] ?? 0).toFixed(3) : shown ? (quantized[col] ?? 0).toFixed(3) : "?";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: `${label} ${text}`,
                value: text,
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
    const task = (
        input as { weights?: number[]; hessian?: number[][]; bits?: number } | null
    ) ?? {};
    const weights: number[] = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights
        : [0.2, -0.5, 0.8, -0.1];
    const hessian: number[][] = Array.isArray(task.hessian) && task.hessian.length > 0
        ? task.hessian
        : [
              [2, 0.3, 0.1, 0],
              [0.3, 2, 0.2, 0.1],
              [0.1, 0.2, 2, 0.3],
              [0, 0.1, 0.3, 2],
          ];
    const bits = typeof task.bits === "number" ? Math.max(1, Math.min(8, Math.floor(task.bits))) : 2;
    const result = gptqQuantize(weights, hessian, bits);
    const n = weights.length;
    const metaBase = { rows: 2, cols: n, n, bits, scale: result.scale, zeroPoint: result.zeroPoint };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, result.quantized, -1, -1),
        edges: [],
        description: `GPTQ on one row of ${n} weights at ${bits} bits: scale ${result.scale.toFixed(4)} (teaching core of error-compensated quantization).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, weights, quantized: result.quantized },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(weights, result.quantized, i, i),
            edges: [],
            description: `Column ${i}: quantize the corrected weight to ${(result.quantized[i] ?? 0).toFixed(3)}, then push its error into later columns through the inverse Hessian row.`,
            codeLineNumber: i === 0 ? 2 : 3,
            layout: "grid",
            meta: { ...metaBase, weights, quantized: result.quantized, error: result.error, current: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(weights, result.quantized, n - 1, -1),
        edges: [],
        description: `Done: all ${n} weights quantized onto a ${Math.pow(2, bits)}-level grid.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...metaBase, weights, quantized: result.quantized, error: result.error, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Rounding each weight independently ignores how weights interact in a layer. GPTQ quantizes one weight, measures the rounding error, and redistributes that error across the weights that have not been quantized yet, weighted by the inverse Hessian. Later weights are therefore chosen to cancel the damage done earlier.",
        invariants: [
            "Every quantized value lies exactly on the uniform affine grid.",
            "The error compensation for column i uses row i of the inverse Hessian divided by its diagonal.",
            "Once a column is quantized its value is never changed again.",
        ],
        correctness:
            "For each column the corrected weight equals the original weight plus the accumulated error from earlier columns. The rounded value is the nearest grid point, and the residual divided by the Hessian inverse diagonal is spread to later columns in exact proportion to the corresponding inverse-Hessian entries. An independent replay of this loop produces identical values; with a diagonal Hessian the off-diagonal compensation vanishes and GPTQ reduces exactly to round-to-nearest.",
        complexityRationale:
            "Inverting the d by d Hessian costs O(d^3), and the quantization loop updates up to d remaining entries per column for O(d^2) work. The stored quantized row and error buffer use O(d) space beyond the matrix inverse.",
        uses: [
            "Post-training quantization of large language models to 3 or 4 bits",
            "Memory and bandwidth reduction for model inference",
            "A teaching model for error-compensated quantization",
        ],
        references: [
            "Frantar, Ashkboos, Turcekov, and Alistarh, GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers, 2022",
            "Nagel et al., A White Paper on Neural Network Quantization, 2021",
        ],
        workedExample:
            "Quantizing weights [0.2, -0.5, 0.8, -0.1] to two bits uses four levels between -0.5 and 0.8. The first weight rounds to a grid point; its residual is divided by the inverse Hessian's first diagonal entry and distributed to columns two through four. With an identity Hessian there is no distribution, so every weight simply rounds to its nearest level.",
    },
    id: "gptq-quantization",
    name: "GPTQ Quantization",
    category: "ml-ai",
    complexity: { time: "O(d^3)", space: "O(d^2)" },
    defaultInput: {
        weights: [0.2, -0.5, 0.8, -0.1],
        hessian: [
            [2, 0.3, 0.1, 0],
            [0.3, 2, 0.2, 0.1],
            [0.1, 0.2, 2, 0.3],
            [0, 0.1, 0.3, 2],
        ],
        bits: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the inverse Hessian of the layer error",
        "choose a uniform grid from the weight range and bit width",
        "initialize an error buffer to zero",
        "for each weight in order add its buffered error",
        "round the corrected weight to the nearest grid level",
        "divide the residual by the inverse Hessian diagonal",
        "add this compensation to every later error entry",
        "done: report the fully quantized row",
    ],
};

export default module;
