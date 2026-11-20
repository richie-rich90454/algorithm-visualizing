/**
 * glow.ts - Glow ActNorm and Invertible 1x1 Convolution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Glow is a normalizing flow whose signature steps are activation
 * normalization (a learned per-channel affine map) and an invertible 1x1
 * convolution that mixes channels through a learnable square matrix. ActNorm
 * contributes one log absolute scale per channel to the log determinant and
 * the 1x1 convolution contributes the log absolute determinant of its weight
 * matrix. Both steps have exact inverses, so the composition is reversible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2) for a d by d mixing matrix
 *   Space: O(d^2) for the matrix plus O(d) for the vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per coordinate after each step.
 *   - The final frame reports the matrix determinant and total log determinant.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    x?: number[];
    matrix?: number[];
    actScale?: number[];
    actBias?: number[];
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels?.[index] ?? value.toFixed(3),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const x = (task.x ?? [1, 2]).slice(0, 2);
    while (x.length < 2) {
        x.push(0);
    }
    const matrix = (task.matrix ?? [1.2, 0.4, -0.3, 0.9]).slice(0, 4);
    while (matrix.length < 4) {
        matrix.push(0);
    }
    const scale = (task.actScale ?? [1.5, 0.8]).slice(0, 2);
    while (scale.length < 2) {
        scale.push(1);
    }
    const bias = (task.actBias ?? [0.2, -0.1]).slice(0, 2);
    while (bias.length < 2) {
        bias.push(0);
    }

    const a = matrix[0] ?? 1;
    const b = matrix[1] ?? 0;
    const c = matrix[2] ?? 0;
    const d = matrix[3] ?? 1;
    const det = a * d - b * c;

    // ActNorm.
    const y = x.map((v, i) => v * (scale[i] ?? 1) + (bias[i] ?? 0));
    let logDet = scale.reduce((sum, s) => sum + Math.log(Math.abs(s) || 1e-12), 0);

    yield {
        stepNumber: 0,
        entities: bars(x, ["idle", "idle"]),
        edges: [],
        description: `Start from (${x[0]?.toFixed(3)}, ${x[1]?.toFixed(3)}) with a 2x2 mixing matrix of determinant ${det.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { vector: x.slice(), det, logDet: 0 },
    };

    yield {
        stepNumber: 1,
        entities: bars(y, ["comparing", "comparing"]),
        edges: [],
        description: `ActNorm scales and shifts each channel to (${y[0]?.toFixed(3)}, ${y[1]?.toFixed(3)}); log determinant ${logDet.toFixed(3)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { vector: y.slice(), det, logDet },
    };

    // Invertible 1x1 convolution: z = W y.
    const z = [a * (y[0] ?? 0) + b * (y[1] ?? 0), c * (y[0] ?? 0) + d * (y[1] ?? 0)];
    logDet += Math.log(Math.abs(det) || 1e-12);

    yield {
        stepNumber: 2,
        entities: bars(z, ["active", "active"]),
        edges: [],
        description: `The 1x1 convolution mixes channels to (${z[0]?.toFixed(3)}, ${z[1]?.toFixed(3)}) and adds log|det W| = ${Math.log(Math.abs(det) || 1e-12).toFixed(3)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { vector: z.slice(), det, logDet },
    };

    // Inverse: y = W^-1 z, then undo ActNorm.
    const yBack = [
        (d * (z[0] ?? 0) - b * (z[1] ?? 0)) / det,
        (-c * (z[0] ?? 0) + a * (z[1] ?? 0)) / det,
    ];
    const xBack = yBack.map((v, i) => (v - (bias[i] ?? 0)) / (scale[i] ?? 1));
    const inverseError = Math.max(
        Math.abs((xBack[0] ?? 0) - (x[0] ?? 0)),
        Math.abs((xBack[1] ?? 0) - (x[1] ?? 0)),
    );

    yield {
        stepNumber: 3,
        entities: bars(z, ["sorted", "sorted"]),
        edges: [],
        description: `Total log determinant ${logDet.toFixed(3)}; reversing the 1x1 convolution and ActNorm reproduces the input within ${inverseError.toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { vector: z.slice(), det, logDet, inverseError, converged: inverseError < 1e-8 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ActNorm gives each channel its own scale and bias so activations start with sensible statistics, while the 1x1 convolution is a learnable rotation and stretch that lets channels exchange information. Unlike a general matrix multiply, both operations are designed so the inverse and the change in volume are cheap to compute. Glow stacks these reversible steps to model complex distributions without losing exact likelihoods.",
        invariants: [
            "ActNorm changes the log determinant by the sum of the log absolute scales.",
            "The 1x1 convolution changes the log determinant by the log absolute determinant of its matrix.",
            "The inverse passes recover the original input exactly when the matrix is nonsingular.",
        ],
        correctness:
            "The Jacobian of ActNorm is diagonal with entries equal to the per-channel scales, so its determinant is their product and its log is the sum of log absolute scales. The Jacobian of the 1x1 convolution with respect to the input vector is exactly the weight matrix, whose determinant for a 2 by 2 matrix is a d minus b c. Because a nonsingular matrix has an inverse, applying the inverse matrix and then undoing the affine ActNorm restores each coordinate, making the round trip exact up to floating-point error.",
        complexityRationale:
            "ActNorm touches each of the d coordinates once, while the 1x1 convolution multiplies a d by d matrix by a vector, costing O(d squared). The matrix and the running vector dominate memory at O(d squared) plus O(d), and no intermediate activations need to be stored for the inverse.",
        uses: [
            "Exact-density generative models and likelihood evaluation",
            "Reversible image normalization inside flow architectures",
            "Invertible preprocessing that keeps information for downstream layers",
        ],
        references: [
            "Kingma and Dhariwal, Glow: Generative Flow with Invertible 1x1 Convolutions, NeurIPS 2018",
            "Dinh, Sohl-Dickstein and Bengio, Density Estimation Using Real NVP, ICLR 2017",
        ],
        workedExample:
            "With x equal to (1, 2), scales (1.5, 0.8) and biases (0.2, -0.1), ActNorm gives (1.7, 1.5) and adds log(1.5) plus log(0.8). For matrix entries a=1.2, b=0.4, c=-0.3, d=0.9 the determinant is 1.2*0.9 minus 0.4*(-0.3), about 1.2, adding log(1.2). Dividing by that determinant and undoing ActNorm returns (1, 2).",
    },
    id: "glow",
    name: "Glow Invertible 1x1 Convolution",
    category: "ml-ai",
    complexity: { time: "O(d^2)", space: "O(d^2)" },
    defaultInput: {
        x: [1, 2],
        matrix: [1.2, 0.4, -0.3, 0.9],
        actScale: [1.5, 0.8],
        actBias: [0.2, -0.1],
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the input, actnorm parameters, and 2x2 mixing matrix",
        "apply actnorm: y equals x times scale plus bias",
        "add the sum of log absolute scales to the log determinant",
        "apply the 1x1 convolution z equals the matrix times y",
        "add the log absolute determinant of the matrix",
        "invert the matrix and undo actnorm to verify the round trip",
        "done: report the mixed vector and total log determinant",
    ],
};

export default module;
