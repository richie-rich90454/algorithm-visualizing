/**
 * adafactor.ts - Adafactor: Factored Adaptive Second Moments
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adafactor (Shazeer and Stern, 2018) avoids storing a full second-moment
 * matrix. It keeps one average per row and one per column, reconstructs an
 * approximate second moment as their outer product, and clips the RMS of the
 * resulting update. This makes it much cheaper than Adam for wide layers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * rows * cols)   Space: O(rows + cols)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The 2x2 parameter matrix is shown as four row-major bars.
 *   - Meta exposes the factored moment reconstruction and the RMS clip.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdafactorInput {
    parameters?: number[][];
    gradients?: number[][][];
    learningRate?: number;
    decay?: number;
    epsilon?: number;
    clipThreshold?: number;
}

function makeBars(matrix: number[][], state: EntityState): VisualEntity[] {
    const values = matrix.flat();
    return values.map((value, index) => ({
        id: `param-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, row: Math.floor(index / 2), col: index % 2 },
    }));
}

function lossAt(matrix: number[][]): number {
    let total = 0;
    for (const row of matrix) {
        for (const value of row) {
            total += 0.5 * value * value;
        }
    }
    return total;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AdafactorInput | null) ?? {};
    const theta = (task.parameters ?? [
        [1, -0.5],
        [0.5, -1],
    ]).map((row) => row.slice());
    const gradients = task.gradients ?? [
        [
            [0.8, -0.4],
            [0.3, -0.6],
        ],
        [
            [0.4, -0.2],
            [0.1, -0.3],
        ],
        [
            [0.2, -0.1],
            [0.05, -0.15],
        ],
    ];
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.01;
    const decay = typeof task.decay === "number" ? task.decay : 0.9;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-3;
    const clip = typeof task.clipThreshold === "number" ? task.clipThreshold : 1;

    const rows = theta.length;
    const cols = theta[0]?.length ?? 0;
    const rowFactor = new Array<number>(rows).fill(0);
    const colFactor = new Array<number>(cols).fill(0);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Initializing Adafactor on a ${rows} by ${cols} parameter matrix with factored moments.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, loss: lossAt(theta), learningRate: lr },
    };
    step += 1;

    for (let t = 0; t < gradients.length; t += 1) {
        const gradient = gradients[t];
        if (!gradient) {
            continue;
        }
        for (let i = 0; i < rows; i += 1) {
            let sum = 0;
            for (let j = 0; j < cols; j += 1) {
                const value = gradient[i]?.[j] ?? 0;
                sum += value * value;
            }
            rowFactor[i] = decay * (rowFactor[i] ?? 0) + (1 - decay) * (sum / cols);
        }
        for (let j = 0; j < cols; j += 1) {
            let sum = 0;
            for (let i = 0; i < rows; i += 1) {
                const value = gradient[i]?.[j] ?? 0;
                sum += value * value;
            }
            colFactor[j] = decay * (colFactor[j] ?? 0) + (1 - decay) * (sum / rows);
        }
        const product: number[][] = [];
        let total = 0;
        for (let i = 0; i < rows; i += 1) {
            const line: number[] = [];
            for (let j = 0; j < cols; j += 1) {
                const value = (rowFactor[i] ?? 0) * (colFactor[j] ?? 0);
                line.push(value);
                total += value;
            }
            product.push(line);
        }
        const mean = total / (rows * cols);
        const update: number[][] = [];
        let updateSquareSum = 0;
        for (let i = 0; i < rows; i += 1) {
            const line: number[] = [];
            for (let j = 0; j < cols; j += 1) {
                const v = mean > 0 ? (product[i]?.[j] ?? 0) / mean : 1;
                const raw = (gradient[i]?.[j] ?? 0) / (Math.sqrt(v) + epsilon);
                line.push(raw);
                updateSquareSum += raw * raw;
            }
            update.push(line);
        }
        const rms = Math.sqrt(updateSquareSum / (rows * cols));
        const scale = rms > clip ? clip / rms : 1;
        for (let i = 0; i < rows; i += 1) {
            for (let j = 0; j < cols; j += 1) {
                theta[i]![j] = (theta[i]?.[j] ?? 0) - lr * scale * (update[i]?.[j] ?? 0);
            }
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${t + 1}: factored second moment, RMS ${rms.toFixed(4)} clipped by ${scale.toFixed(4)}.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { step: t + 1, loss: lossAt(theta), rms, scale, rowFactor: rowFactor.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Finished ${gradients.length} Adafactor steps; final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 8,
        layout: "array",
        meta: { step: gradients.length, loss: lossAt(theta), parameters: theta.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A full second-moment matrix is too big for very wide layers. Adafactor keeps only a row average and a column average and multiplies them to approximate the full matrix. It then clips the update so a poorly conditioned factor cannot create a huge step.",
        invariants: [
            "The row and column factors are exponential averages of mean squared gradients.",
            "The reconstructed moment is the outer product normalized to mean one.",
            "The RMS clip keeps the update scale at most the threshold.",
        ],
        correctness:
            "The generator applies the published factored-moment recurrence and RMS clipping. The companion test replays the same steps independently, checks that the clip factor never exceeds one, and verifies that a zero-gradient step leaves the parameters unchanged.",
        complexityRationale:
            "Each step scans the matrix a constant number of times, so O(steps * rows * cols) time, but only rows plus cols moment values are stored, giving O(rows + cols) space.",
        uses: [
            "Pretraining large transformer models with wide matrices",
            "Memory-constrained fine-tuning where Adam state is prohibitive",
            "Machine translation systems with large embedding layers",
        ],
        references: [
            "Shazeer and Stern, Adafactor: Adaptive Learning Rates with Sublinear Memory Cost, ICML 2018",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "For a 2 by 2 gradient with squared row means 0.25 and 0.09, the two row factors and two column factors form four products. Dividing by their mean gives a moment with average one, and each gradient entry is divided by its square root before the RMS clip.",
    },
    id: "adafactor",
    name: "Adafactor Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * rows * cols)", space: "O(rows + cols)" },
    defaultInput: {
        parameters: [
            [1, -0.5],
            [0.5, -1],
        ],
        gradients: [
            [
                [0.8, -0.4],
                [0.3, -0.6],
            ],
            [
                [0.4, -0.2],
                [0.1, -0.3],
            ],
            [
                [0.2, -0.1],
                [0.05, -0.15],
            ],
        ],
        learningRate: 0.01,
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize row and column second-moment factors to zero",
        "for each gradient matrix G do",
        "rowFactor = decay*rowFactor + (1-decay)*mean_j(G_ij^2)",
        "colFactor = decay*colFactor + (1-decay)*mean_i(G_ij^2)",
        "V = outer(rowFactor, colFactor) normalized to mean one",
        "U = G / (sqrt(V) + eps); scale = min(1, clip / rms(U))",
        "theta = theta - lr * scale * U",
        "record parameters, RMS, and clip factor",
        "done: report the final parameter matrix",
    ],
};

export default module;
