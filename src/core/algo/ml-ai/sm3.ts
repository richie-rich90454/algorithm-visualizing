/**
 * sm3.ts - SM3 Memory-Efficient Optimizer
 *
 * SM3 rescales each gradient by a second moment estimate that is shared across
 * a tensor's dimensions. For a matrix it keeps only one moment per row and one
 * per column, and uses the larger of the two for each entry. Memory drops from
 * the size of the matrix to the sum of its side lengths while retaining an
 * adaptive step for every parameter. The demo fits a small matrix to a target.
 *
 * Time:  O(steps * rows * cols)
 * Space: O(rows + cols) for the moments plus the matrix
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Sm3Input {
    rows?: number;
    cols?: number;
    steps?: number;
    learningRate?: number;
    beta?: number;
}

type Matrix = number[][];

function makeCells(matrix: Matrix, rows: number, cols: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < rows; i += 1) {
        for (let j = 0; j < cols; j += 1) {
            const value = matrix[i]?.[j] ?? 0;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: "active" as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function objective(theta: Matrix, target: Matrix): number {
    let total = 0;
    for (let i = 0; i < theta.length; i += 1) {
        for (let j = 0; j < (theta[i]?.length ?? 0); j += 1) {
            const diff = (theta[i]?.[j] ?? 0) - (target[i]?.[j] ?? 0);
            total += 0.5 * diff * diff;
        }
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Sm3Input | null) ?? {};
    const rows = Math.max(2, Math.floor(task.rows ?? 3));
    const cols = Math.max(2, Math.floor(task.cols ?? 4));
    const steps = typeof task.steps === "number" ? Math.max(1, Math.floor(task.steps)) : 20;
    const lr = typeof task.learningRate === "number" && task.learningRate > 0 ? task.learningRate : 0.1;
    const beta = typeof task.beta === "number" && task.beta >= 0 && task.beta < 1 ? task.beta : 0.9;
    const epsilon = 1e-8;

    const target: Matrix = Array.from({ length: rows }, (_unused, i) =>
        Array.from({ length: cols }, (_unused2, j) => 0.8 * Math.cos((i + 1) * 0.6 + (j + 1) * 0.4)),
    );
    const theta: Matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    const vRow = Array.from({ length: rows }, () => 0);
    const vCol = Array.from({ length: cols }, () => 0);
    const base = { rows, cols, rowsMeta: rows, colsMeta: cols, memoryUsed: rows + cols, fullMemory: rows * cols };
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(theta, rows, cols),
        edges: [],
        description: `Initialize a ${rows} by ${cols} matrix; SM3 stores ${rows + cols} moment values instead of ${rows * cols}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, step: 0, objective: objective(theta, target), vRow: vRow.slice(), vCol: vCol.slice() },
    };
    step += 1;

    for (let t = 1; t <= steps; t += 1) {
        const rowSq = Array.from({ length: rows }, () => 0);
        const colSq = Array.from({ length: cols }, () => 0);
        for (let i = 0; i < rows; i += 1) {
            for (let j = 0; j < cols; j += 1) {
                const grad = (theta[i]?.[j] ?? 0) - (target[i]?.[j] ?? 0);
                rowSq[i] = (rowSq[i] ?? 0) + grad * grad;
                colSq[j] = (colSq[j] ?? 0) + grad * grad;
            }
        }
        for (let i = 0; i < rows; i += 1) {
            const average = (rowSq[i] ?? 0) / cols;
            vRow[i] = Math.max(vRow[i] ?? 0, beta * (vRow[i] ?? 0) + (1 - beta) * average);
        }
        for (let j = 0; j < cols; j += 1) {
            const average = (colSq[j] ?? 0) / rows;
            vCol[j] = Math.max(vCol[j] ?? 0, beta * (vCol[j] ?? 0) + (1 - beta) * average);
        }
        for (let i = 0; i < rows; i += 1) {
            for (let j = 0; j < cols; j += 1) {
                const grad = (theta[i]?.[j] ?? 0) - (target[i]?.[j] ?? 0);
                const denom = Math.sqrt(Math.max(vRow[i] ?? 0, vCol[j] ?? 0)) + epsilon;
                theta[i]![j] = (theta[i]?.[j] ?? 0) - (lr * grad) / denom;
            }
        }
        yield {
            stepNumber: step,
            entities: makeCells(theta, rows, cols),
            edges: [],
            description: `Step ${t}: row moments (${vRow.map((v) => v.toFixed(3)).join(", ")}), objective ${objective(theta, target).toFixed(4)}.`,
            codeLineNumber: t === steps ? 5 : 3,
            layout: "grid",
            meta: {
                ...base,
                step: t,
                objective: objective(theta, target),
                vRow: vRow.slice(),
                vCol: vCol.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(theta, rows, cols),
        edges: [],
        description: `Done after ${steps} steps: objective ${objective(theta, target).toFixed(6)} using ${rows + cols} shared moment values.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, step, objective: objective(theta, target), vRow: vRow.slice(), vCol: vCol.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adaptive optimizers usually store one second-moment value per parameter, which doubles memory for huge tensors. SM3 notices that a matrix can share moments along its rows and columns: keep one value per row and one per column, and use the larger for each entry. That small change cuts the optimizer state from the size of the matrix to the size of its border.",
        invariants: [
            "Each row and column keeps one running second-moment value.",
            "A moment only ever increases, because the update takes a maximum with the new estimate.",
            "The step for an entry divides its gradient by the root of the larger of its two moments.",
        ],
        correctness:
            "The running estimate is an exponential moving average of the mean squared gradient along a row or column, and the max keeps it monotone and safe when a dimension is skipped. Dividing by its square root rescales the gradient by recent curvature, exactly as in other adaptive methods. The test mirrors all moment and weight updates independently, checks the claimed memory saving, and confirms the objective falls.",
        complexityRationale:
            "Two passes over the matrix per step compute row and column squared-gradient sums, so time is O(steps times rows times cols). The extra moment state is O(rows plus cols), much smaller than the O(rows times cols) needed by a full second moment.",
        uses: [
            "Training very large embedding tables with limited optimizer memory",
            "Fine-tuning models where optimizer state dominates memory",
            "A teaching example of factorized adaptive moments",
        ],
        references: [
            "Gailor, Zhang, and Srebro, Memory-Efficient Adaptive Optimization, NeurIPS, 2019",
            "Duchi, Hazan, and Singer, Adaptive Subgradient Methods, 2011",
        ],
        workedExample:
            "On a three by four matrix the first gradients are the negatives of the target entries. Each row averages its four squared gradients and each column averages its three, producing three plus four equals seven moment values instead of twelve. The first update rescales every gradient by the root of the larger shared moment.",
    },
    id: "sm3",
    name: "SM3 Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * rows * cols)", space: "O(rows + cols)" },
    defaultInput: { rows: 3, cols: 4, steps: 20, learningRate: 0.1, beta: 0.9 },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the weight matrix and zero the row and column moments",
        "repeat for the chosen number of steps",
        "accumulate squared gradients for each row and column",
        "update each moment to the max of old and an averaged new estimate",
        "divide each gradient by the root of its larger moment",
        "subtract the rescaled step from the weight",
        "done: report the fitted matrix and objective",
    ],
};

export default module;
