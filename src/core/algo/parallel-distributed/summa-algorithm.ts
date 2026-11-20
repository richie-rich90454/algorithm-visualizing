/**
 * summa-algorithm.ts - SUMMA Distributed Matrix Multiplication
 *
 * SUMMA multiplies two matrices on a two-dimensional process grid by
 * broadcasting panels along process rows and columns. Each process accumulates
 * the product of the A panel it received within its row and the B panel it
 * received within its column, then stores one block of the result. The name
 * stands for Scalable Universal Matrix Multiplication Algorithm.
 *
 * Limits of the demo: square matrix dimensions that are exact multiples of the
 * process grid dimensions, one block per process per panel step, no
 * communication latency, no network topology modeling, and matrices supplied
 * explicitly as dense arrays. Only the canonical panel broadcast order is shown.
 *
 * Time: O(n^3 / sqrt(p)) on a p-process square grid. Space: O(n^2 / p) per process.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

/** Classical dense matrix multiplication used as an independent reference. */
export function denseMultiply(A: Matrix, B: Matrix): Matrix {
    const n = A.length;
    const m = (B[0] as number[]).length;
    const k = (A[0] as number[]).length;
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: m }, (_, j) => {
            let sum = 0;
            for (let t = 0; t < k; t += 1) {
                sum += (A[i] as number[])[t] as number * ((B[t] as number[])[j] as number);
            }
            return sum;
        }),
    );
}

function block(matrix: Matrix, r0: number, r1: number, c0: number, c1: number): Matrix {
    return Array.from({ length: r1 - r0 }, (_, i) =>
        Array.from({ length: c1 - c0 }, (_, j) => (matrix[r0 + i] as number[])[c0 + j] as number),
    );
}

function addInto(target: Matrix, source: Matrix): void {
    for (let i = 0; i < target.length; i += 1) {
        for (let j = 0; j < (target[0] as number[]).length; j += 1) {
            (target[i] as number[])[j] = (target[i] as number[])[j] as number + (source[i] as number[])[j] as number;
        }
    }
}

/** SUMMA panel broadcasts and local multiply-accumulate steps. */
export function summaTrace(A: Matrix, B: Matrix, grid: number): Array<{
    process: number;
    panel: number;
    local: Matrix;
}> {
    const n = A.length;
    const width = n / grid;
    const localResults: Matrix[] = Array.from({ length: grid * grid }, () =>
        Array.from({ length: width }, () => new Array<number>(width).fill(0)));
    const trace: Array<{ process: number; panel: number; local: Matrix }> = [];
    for (let panel = 0; panel < grid; panel += 1) {
        for (let pr = 0; pr < grid; pr += 1) {
            const aPanel = block(A, pr * width, (pr + 1) * width, panel * width, (panel + 1) * width);
            for (let pc = 0; pc < grid; pc += 1) {
                const bPanel = block(B, panel * width, (panel + 1) * width, pc * width, (pc + 1) * width);
                const process = pr * grid + pc;
                const local = denseMultiply(aPanel, bPanel);
                addInto(localResults[process] as Matrix, local);
                trace.push({
                    process,
                    panel,
                    local: local.map((row) => row.slice()),
                });
            }
        }
    }
    return trace;
}

/** Assemble the per-process blocks into the full product matrix. */
export function assembleResult(trace: Array<{ process: number; panel: number; local: Matrix }>, grid: number): Matrix {
    const width = (trace[0]?.local.length ?? 1);
    const n = grid * width;
    const C: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    for (const step of trace) {
        const pr = Math.floor(step.process / grid);
        const pc = step.process % grid;
        for (let i = 0; i < width; i += 1) {
            for (let j = 0; j < width; j += 1) {
                (C[pr * width + i] as number[])[pc * width + j] =
                    (C[pr * width + i] as number[])[pc * width + j] as number + (step.local[i] as number[])[j] as number;
            }
        }
    }
    return C;
}

function makeCells(trace: Array<{ process: number; panel: number; local: Matrix }>, active: number): VisualEntity[] {
    return trace.map((step, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label: `P${step.process} k${step.panel}`,
        value: step.local.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0),
        state: index === active ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, process: step.process, panel: step.panel },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { dimension?: number; grid?: number } | null) ?? {};
    const grid = Math.min(4, Math.max(1, Math.floor(Number(task.grid ?? 2)) || 2));
    const dimension = Math.min(12, Math.max(grid, Math.floor(Number(task.dimension ?? 4)) || 4));
    const size = Math.ceil(dimension / grid) * grid;
    const A: Matrix = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => (i === j ? 2 : (i + j) % 3) - 1));
    const B: Matrix = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => (i + 2 * j) % 4 - 1));
    const trace = summaTrace(A, B, grid);
    const result = assembleResult(trace, grid);
    const reference = denseMultiply(A, B);
    let maxError = 0;
    for (let i = 0; i < size; i += 1) {
        for (let j = 0; j < size; j += 1) {
            maxError = Math.max(maxError, Math.abs((result[i] as number[])[j] as number - (reference[i] as number[])[j] as number));
        }
    }
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(trace, -1),
        edges: [],
        description: `Multiply two ${size} by ${size} matrices on a ${grid} by ${grid} SUMMA process grid.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { size, grid, processCount: grid * grid, steps: trace.length, result: null, maxError },
    };
    step += 1;

    for (let i = 0; i < trace.length; i += 1) {
        const stepInfo = trace[i] as { process: number; panel: number };
        yield {
            stepNumber: step,
            entities: makeCells(trace, i),
            edges: [],
            description: `Panel ${stepInfo.panel}: process ${stepInfo.process} multiplies its local A and B blocks.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                size, grid, steps: trace.length, activeStep: i,
                process: stepInfo.process, panel: stepInfo.panel, maxError,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(trace, -1),
        edges: [],
        description: `Assembled product matches classical multiplication with maximum error ${maxError}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            size, grid, steps: trace.length, result,
            reference, maxError, correct: maxError === 0,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SUMMA organizes matrix multiplication as a sequence of panel broadcasts on a two-dimensional grid of processes. In each panel step, a row of processes shares an A panel and a column shares a B panel. Every process multiplies the two panels it received and adds the product into its own output block. Because each process only ever holds panels and one result block, the algorithm scales to large matrices.",
        invariants: [
            "Each process owns exactly one block of the output matrix.",
            "A panel step multiplies matching A and B strips of the shared inner dimension.",
            "Accumulating all panel steps yields the full block product.",
        ],
        correctness:
            "Partitioning the inner dimension into panels writes the matrix product as a sum over panels of A-panel times B-panel. In a panel step, every process receives the same A strip within its process row and the same B strip within its process column, so its local product is exactly one term of that sum. Summing the terms over all panels gives the classical product entry by entry, which the test checks against dense multiplication.",
        complexityRationale:
            "With an n by n matrix on a square grid of p processes, each process multiplies blocks of size n over sqrt(p) panel steps, costing O(n^3 / p) arithmetic and O(n^2 / sqrt(p) ) communication per process in the standard analysis; the total is O(n^3 / sqrt(p)) including broadcasts. Local storage is one output block, O(n^2 / p).",
        uses: [
            "Distributed dense linear algebra libraries",
            "Training large models on compute clusters",
            "Scientific simulation kernels that need scalable GEMM",
        ],
        references: [
            "van de Geijn and Watts, SUMMA: Scalable Universal Matrix Multiplication Algorithm, 1997",
            "Dongarra et al., A Portable Linear Algebra Library for Parallel Machines, 1990",
        ],
        workedExample:
            "On a two by two process grid with four by four matrices, each process owns a two by two output block. Over two panel steps it receives two by two panels, multiplies them, and accumulates. After both steps the four blocks assemble into the same product a classical triple loop computes.",
    },
    id: "summa-algorithm",
    name: "SUMMA Matrix Multiplication",
    category: "parallel-distributed",
    complexity: { time: "O(n^3 / sqrt(p))", space: "O(n^2 / p)" },
    defaultInput: { dimension: 4, grid: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "partition A and B into process-grid blocks",
        "initialize each process result block to zero",
        "for each panel along the inner dimension",
        "broadcast the A panel across each process row",
        "broadcast the B panel down each process column",
        "multiply the received panels locally and accumulate",
        "assemble all process blocks into the final product",
        "done: report the matrix product and max error",
    ],
};

export default module;
