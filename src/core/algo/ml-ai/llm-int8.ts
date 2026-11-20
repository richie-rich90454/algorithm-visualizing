/**
 * llm-int8.ts - LLM.int8() Vector-wise Quantization
 *
 * LLM.int8() keeps large language model matrix multiplies in 8-bit integers
 * except for a small set of outlier feature dimensions, which it computes in
 * half precision. Each row of the activation and each column of the weight is
 * scaled independently, so the integer ranges are used efficiently and the
 * outliers do not destroy the quantization resolution of normal values.
 *
 * Time O(rows * in * out), space O(rows * out) for the result.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface Int8Input {
    x: Matrix;
    w: Matrix;
    threshold: number;
}

export interface Int8Result {
    outlierCols: number[];
    rowScales: number[];
    output: Matrix;
    maxAbsError: number;
}

function quantizeRow(row: number[]): { ints: number[]; scale: number } {
    const maxAbs = Math.max(...row.map(Math.abs), 0);
    const scale = maxAbs / 127 || 1;
    return { ints: row.map((v) => Math.round(v / scale)), scale };
}

/** Emulate an int8 matrix multiply with outlier separation. */
export function llmInt8(input: Int8Input): Int8Result {
    const { x, w, threshold } = input;
    const rows = x.length;
    const inDim = w.length;
    const outDim = w[0]?.length ?? 0;
    const outlierCols: number[] = [];
    for (let j = 0; j < inDim; j += 1) {
        if (x.some((row) => Math.abs(row[j] ?? 0) > threshold)) outlierCols.push(j);
    }
    const outlierSet = new Set(outlierCols);
    const regularCols = Array.from({ length: inDim }, (_, j) => j).filter((j) => !outlierSet.has(j));

    const wColScales = regularCols.map((j) => {
        const col = w[j] ?? [];
        const maxAbs = Math.max(...col.map(Math.abs), 0);
        return maxAbs / 127 || 1;
    });
    const wInts = regularCols.map((j, idx) => (w[j] ?? []).map((val) => Math.round(val / (wColScales[idx] ?? 1))));

    const output: Matrix = Array.from({ length: rows }, () => new Array(outDim).fill(0));
    const rowScales: number[] = [];
    for (let i = 0; i < rows; i += 1) {
        const row = x[i] ?? [];
        const regularRow = regularCols.map((j) => row[j] ?? 0);
        const q = quantizeRow(regularRow);
        rowScales.push(q.scale);
        for (let o = 0; o < outDim; o += 1) {
            let value = 0;
            for (let k = 0; k < regularCols.length; k += 1) {
                value += (q.ints[k] ?? 0) * (wInts[k]?.[o] ?? 0) * q.scale * (wColScales[k] ?? 1);
            }
            for (const j of outlierCols) {
                value += (row[j] ?? 0) * (w[j]?.[o] ?? 0);
            }
            output[i]![o] = value;
        }
    }
    let maxAbsError = 0;
    for (let i = 0; i < rows; i += 1) {
        for (let o = 0; o < outDim; o += 1) {
            let exact = 0;
            for (let j = 0; j < inDim; j += 1) exact += (x[i]?.[j] ?? 0) * (w[j]?.[o] ?? 0);
            maxAbsError = Math.max(maxAbsError, Math.abs(exact - (output[i]?.[o] ?? 0)));
        }
    }
    return { outlierCols, rowScales, output, maxAbsError };
}

function makeCells(result: Int8Result, revealedFrom: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    result.rowScales.forEach((scale, i) => {
        const shown = i >= revealedFrom;
        entities.push({
            id: `cell-${i}-0`,
            type: "cell",
            label: shown ? `row ${i}: scale ${scale.toFixed(4)}` : "?",
            value: shown ? scale : 0,
            state: shown ? "sorted" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: i, col: 0 },
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<Int8Input> | null) ?? {};
    const x = task.x ?? [[1, 2, 0.1], [0.5, 20, -1]];
    const w = task.w ?? [[1, 0], [0, 1], [2, -1]];
    const threshold = typeof task.threshold === "number" ? task.threshold : 6;
    const result = llmInt8({ x, w, threshold });
    const rows = x.length;
    const outDim = w[0]?.length ?? 0;
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result, rows),
        edges: [],
        description: `LLM.int8 on ${rows} rows: ${result.outlierCols.length} outlier column(s) kept in half precision.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows, cols: 1, outlierCols: result.outlierCols, output: result.output.flat(), outCols: outDim, maxAbsError: result.maxAbsError },
    };
    step += 1;
    for (let i = 0; i < rows; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result, i),
            edges: [],
            description: `Row ${i}: per-row scale ${(result.rowScales[i] ?? 0).toFixed(4)}, quantize regular columns to int8 and add outlier products.`,
            codeLineNumber: i === 0 ? 2 : 5,
            layout: "grid",
            meta: { rows, cols: 1, current: i, outlierCols: result.outlierCols, output: result.output.flat(), outCols: outDim, maxAbsError: result.maxAbsError },
        };
        step += 1;
    }
    yield {
        stepNumber: step,
        entities: makeCells(result, 0),
        edges: [],
        description: `Done: int8 product with outlier correction; max absolute error ${result.maxAbsError.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { rows, cols: 1, outlierCols: result.outlierCols, output: result.output.flat(), outCols: outDim, maxAbsError: result.maxAbsError, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Activations in large language models contain a few huge outlier values that would force a coarse scale for every other number. LLM.int8() splits the computation: outlier feature columns are multiplied in half precision, while all remaining values are quantized to signed 8-bit integers with a separate scale per row and per weight column. The integer product is dequantized and added to the exact outlier contribution.",
        invariants: [
            "A column is an outlier when any activation magnitude in it exceeds the threshold.",
            "Every quantized integer lies near the range from minus 127 to 127 after row scaling.",
            "Outlier contributions are computed exactly and never quantized.",
        ],
        correctness:
            "The program marks outlier columns, quantizes each regular activation row by its maximum absolute value divided by 127, quantizes each regular weight column by its own scale, accumulates the integer products, and rescales before adding exact products for outliers. The result approximates the full-precision matrix product; the test recomputes that product directly and checks the reported maximum error, and also verifies the outlier mask and integer range.",
        complexityRationale:
            "Scanning for outliers is O(rows * in), quantization is O(rows * in + in * out), and the integer accumulation is O(rows * in * out), giving O(rows * in * out) time. The output matrix uses O(rows * out) space.",
        uses: [
            "Memory-efficient inference for large language models",
            "Quantized matrix multiplication on integer tensor cores",
            "Keeping outliers accurate in low-precision transformers",
        ],
        references: [
            "Dettmers et al., LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale, NeurIPS 2022",
            "Dettmers, Lewis, Belkada, and Zettlemoyer, GPTQ and quantization surveys, 2022-2023",
        ],
        workedExample:
            "With activations [[1, 2], [0.5, 20]] and threshold 6, the second column is an outlier because of the value 20. The first column is quantized to int8 with a per-row scale, the integer product with the weight matrix is dequantized, and the term 20 times the matching weight row is added exactly, keeping the large value from coarsening the first column's scale.",
    },
    id: "llm-int8",
    name: "LLM.int8 Quantization",
    category: "ml-ai",
    complexity: { time: "O(rows * in * out)", space: "O(rows * out)" },
    defaultInput: {
        x: [[1, 2, 0.1], [0.5, 20, -1]],
        w: [[1, 0], [0, 1], [2, -1]],
        threshold: 6,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "mark each activation column containing a value above the threshold as an outlier",
        "quantize each row of regular activations to int8 with its own scale",
        "quantize each regular weight column to int8 with its own scale",
        "accumulate integer products and dequantize by the row and column scales",
        "add exact half-precision products for the outlier columns",
        "done: report the corrected output and maximum error",
    ],
};

export default module;
