/**
 * masked-autoregressive-flow.ts - Masked Autoregressive Flow (MAF)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MAF turns an autoregressive density model into an invertible normalizing
 * flow. A masked network predicts each coordinate's mean and log scale from
 * only the earlier coordinates, so the Jacobian is triangular and its
 * determinant is simply the product of the scales. Sampling is sequential,
 * while density evaluation is parallel.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2) for d coordinates with a masked linear conditioner
 *   Space: O(d^2) for the two triangular weight matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero shows the input coordinates; row one shows the latent codes.
 *   - Row two shows the scale assigned to each coordinate.
 *   - Frame meta carries means, scales, the latent vector and log determinant.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MAFInput {
    x?: number[];
    meanWeights?: number[][];
    scaleWeights?: number[][];
}

/** Strictly-lower-triangular masked linear conditioner output. */
export function maskedLinear(weights: number[][], x: number[]): number[] {
    return weights.map((row, i) => {
        let sum = 0;
        for (let j = 0; j < i; j += 1) sum += (row[j] ?? 0) * (x[j] ?? 0);
        return sum;
    });
}

/** Forward map to a unit Gaussian latent, plus the inverse scales. */
export function mafForward(x: number[], meanWeights: number[][], scaleWeights: number[][]): { z: number[]; means: number[]; scales: number[]; logDet: number } {
    const means = maskedLinear(meanWeights, x);
    const logScales = maskedLinear(scaleWeights, x);
    const scales = logScales.map((ls) => Math.exp(ls));
    const z = x.map((v, i) => (v - (means[i] ?? 0)) / (scales[i] ?? 1));
    const logDet = -logScales.reduce((s, ls) => s + ls, 0);
    return { z, means, scales, logDet };
}

/** Inverse map: rebuild x coordinate by coordinate from the latent code. */
export function mafInverse(z: number[], meanWeights: number[][], scaleWeights: number[][]): number[] {
    const x = new Array<number>(z.length).fill(0);
    for (let i = 0; i < z.length; i += 1) {
        let mean = 0;
        let logScale = 0;
        for (let j = 0; j < i; j += 1) {
            mean += (meanWeights[i]?.[j] ?? 0) * (x[j] ?? 0);
            logScale += (scaleWeights[i]?.[j] ?? 0) * (x[j] ?? 0);
        }
        x[i] = mean + Math.exp(logScale) * (z[i] ?? 0);
    }
    return x;
}

function makeCells(x: number[], z: number[], scales: number[], d: number, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const rows = [x, z, scales];
    const names = ["x", "z", "scale"];
    for (let r = 0; r < rows.length; r += 1) {
        for (let col = 0; col < d; col += 1) {
            const value = rows[r]?.[col] ?? 0;
            entities.push({
                id: `cell-${r}-${col}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: col === active ? "active" : r === 2 ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col, kind: names[r] ?? "value" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MAFInput | null) ?? {};
    const x = (task.x ?? [1, -0.5, 2]).map(Number);
    const meanWeights = (task.meanWeights ?? [
        [0, 0, 0],
        [0.5, 0, 0],
        [-0.2, 0.3, 0],
    ]).map((row) => [...row]);
    const scaleWeights = (task.scaleWeights ?? [
        [0, 0, 0],
        [0.1, 0, 0],
        [0.05, -0.1, 0],
    ]).map((row) => [...row]);
    const d = x.length;
    const result = mafForward(x, meanWeights, scaleWeights);
    const recovered = mafInverse(result.z, meanWeights, scaleWeights);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(x, x.map(() => 0), x.map(() => 1), d, -1),
        edges: [],
        description: `MAF over ${d} coordinates with a strictly triangular autoregressive conditioner.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: d, d, x, z: result.z, means: result.means, scales: result.scales, logDet: result.logDet },
    };
    step += 1;

    for (let i = 0; i < d; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(x, result.z, result.scales, d, i),
            edges: [],
            description: `Coordinate ${i}: mean ${(result.means[i] ?? 0).toFixed(3)}, scale ${(result.scales[i] ?? 0).toFixed(3)}, latent ${(result.z[i] ?? 0).toFixed(3)}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                rows: 3,
                cols: d,
                d,
                x,
                z: result.z,
                means: result.means,
                scales: result.scales,
                logDet: result.logDet,
                coordinate: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(recovered, result.z, result.scales, d, d - 1),
        edges: [],
        description: `Inverse map recovers the input; log determinant is ${result.logDet.toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: 3, cols: d, d, x, z: result.z, recovered, means: result.means, scales: result.scales, logDet: result.logDet },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An autoregressive model already gives a chain-rule factorization of a joint density. MAF makes that model invertible by turning each conditional mean and scale into an affine transform. Because coordinate i depends only on earlier coordinates, the Jacobian is triangular and its determinant is easy to compute even for high dimensions.",
        invariants: [
            "Both conditioner weight matrices are strictly lower triangular, so no coordinate depends on itself or later coordinates.",
            "Scales are positive because they are exponentials of predicted log scales.",
            "The forward and inverse maps are exact mutual inverses.",
        ],
        correctness:
            "Forward transformation divides each residual by its conditional scale, giving a unit Gaussian latent when the conditioner is correct. The Jacobian of the full map is lower triangular with diagonal entries equal to the scales, so its log determinant is the sum of the log scales. Inverting coordinate by coordinate is valid because each coordinate's parameters use only earlier coordinates that have already been reconstructed.",
        complexityRationale:
            "A masked linear conditioner computes each coordinate from all predecessors, costing O(d squared) for both mean and scale. The stored matrices and vectors use O(d squared) space.",
        uses: [
            "Flexible density estimation for tabular and image data",
            "Variational inference with invertible transforms",
            "Anomaly detection through exact likelihood scoring",
        ],
        references: [
            "Papamakarios, Murray, Pavlakou, Masked Autoregressive Flow for Density Estimation, NeurIPS 2017",
            "Germain et al., MADE: Masked Autoencoder for Distribution Estimation, ICML 2015",
        ],
        workedExample:
            "For x = [1, 2] with mean of coordinate one equal to 0.5*x0 and scale exp(0.1*x0), the second coordinate's mean is 0.5 and its scale is exp(0.1). Its latent is (2 - 0.5)/exp(0.1), and the log determinant is -0.1, coming only from the second coordinate because the first has scale one.",
    },
    id: "masked-autoregressive-flow",
    name: "Masked Autoregressive Flow",
    category: "ml-ai",
    complexity: { time: "O(d^2)", space: "O(d^2)" },
    defaultInput: {
        x: [1, -0.5, 2],
        meanWeights: [[0, 0, 0], [0.5, 0, 0], [-0.2, 0.3, 0]],
        scaleWeights: [[0, 0, 0], [0.1, 0, 0], [0.05, -0.1, 0]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build strictly lower triangular mean and scale weights",
        "compute each coordinate's conditional mean from earlier inputs",
        "compute each coordinate's conditional log scale from earlier inputs",
        "exponentiate log scales to obtain positive scales",
        "map each coordinate to its latent by subtracting mean and dividing by scale",
        "sum the log scales with a negative sign for the log determinant",
        "reconstruct each coordinate in order using the latent and its parameters",
        "done: return latent codes and log determinant",
    ],
};

export default module;
