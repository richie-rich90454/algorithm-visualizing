/**
 * principal-component-analysis.ts - Principal Component Analysis (power iteration)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PCA finds the directions along which a data set varies most. After centering
 * the data, the first principal component is the leading eigenvector of the
 * covariance matrix. Power iteration repeatedly multiplies a vector by that
 * matrix and renormalizes, which converges to the dominant eigenvector. A
 * second component is found by deflating the covariance and iterating again.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the teachable algorithmic core for two-dimensional data: centering,
 * covariance, power iteration, and deflation. It is not a full SVD solver with
 * sign and convergence heuristics, and it does not scale to high dimensions.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d^2 + k * d^2) per component for n points, width d, k steps
 *   Space: O(n * d) for the centered data and O(d^2) for the covariance
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Data points are drawn at their coordinates and colored by projection sign.
 *   - Two extra nodes mark the endpoints of the current principal direction.
 *   - The frame meta exposes the covariance, vector, and eigenvalue.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface PcaInput {
    points?: Point[];
    iterations?: number;
}

/** Center the points and return the 2 by 2 scatter matrix X transposed times X. */
function centerAndScatter(points: Point[]): { centered: Point[]; mean: Point; C: number[][] } {
    const n = points.length;
    const mean: Point = [
        points.reduce((sum, p) => sum + (p[0] ?? 0), 0) / Math.max(1, n),
        points.reduce((sum, p) => sum + (p[1] ?? 0), 0) / Math.max(1, n),
    ];
    const centered: Point[] = points.map((p) => [(p[0] ?? 0) - mean[0], (p[1] ?? 0) - mean[1]]);
    let a = 0;
    let b = 0;
    let c = 0;
    for (const [x, y] of centered) {
        a += x * x;
        b += x * y;
        c += y * y;
    }
    return { centered, mean, C: [[a, b], [b, c]] };
}

/** One power-iteration step: multiply by a matrix and normalize the result. */
function powerStep(matrix: number[][], vector: number[]): number[] {
    const next = matrix.map((row) => row.reduce((sum, value, k) => sum + value * (vector[k] ?? 0), 0));
    const norm = Math.hypot(next[0] ?? 0, next[1] ?? 0);
    if (norm < 1e-12) {
        return vector.slice();
    }
    return [(next[0] ?? 0) / norm, (next[1] ?? 0) / norm];
}

/** Rayleigh quotient for a unit vector. */
function rayleigh(matrix: number[][], vector: number[]): number {
    const Av = matrix.map((row) => row.reduce((sum, value, k) => sum + value * (vector[k] ?? 0), 0));
    return vector.reduce((sum, value, k) => sum + value * (Av[k] ?? 0), 0);
}

function makeEntities(
    points: Point[],
    centered: Point[],
    mean: Point,
    vector: number[],
    iteration: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < points.length; i += 1) {
        const point = points[i] ?? [0, 0];
        const center = centered[i] ?? [0, 0];
        const projection = center[0] * (vector[0] ?? 0) + center[1] * (vector[1] ?? 0);
        entities.push({
            id: `point-${i}`,
            type: "node",
            label: projection >= 0 ? "+" : "-",
            value: [point[0], point[1]],
            state: (Math.abs(projection) < 1e-9 ? "unvisited" : projection >= 0 ? "sorted" : "highlight") as EntityState,
            x: point[0] ?? 0,
            y: point[1] ?? 0,
            width: 0,
            height: 0,
            metadata: { index: i, projection },
        });
    }
    const radius = Math.max(
        1,
        ...points.map((p) => Math.hypot((p[0] ?? 0) - mean[0], (p[1] ?? 0) - mean[1])),
    );
    const scale = radius * 0.9;
    for (const sign of [-1, 1]) {
        entities.push({
            id: `component-end-${sign}`,
            type: "node",
            label: sign > 0 ? "PC+" : "PC-",
            value: [mean[0] + sign * scale * (vector[0] ?? 0), mean[1] + sign * scale * (vector[1] ?? 0)],
            state: "active" as EntityState,
            x: mean[0] + sign * scale * (vector[0] ?? 0),
            y: mean[1] + sign * scale * (vector[1] ?? 0),
            width: 0,
            height: 0,
            metadata: { index: sign, iteration },
        });
    }
    return entities;
}

/** The PCA generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PcaInput | null) ?? {};
    const points: Point[] = Array.isArray(task.points)
        ? task.points.map((p) => [Number(p?.[0] ?? 0), Number(p?.[1] ?? 0)] as Point)
        : [
              [0, 0],
              [1, 0.8],
              [2, 1.6],
              [3, 2.5],
              [4, 3.1],
              [1, 2.2],
          ];
    const iterations = Math.max(1, Math.min(100, typeof task.iterations === "number" ? Math.trunc(task.iterations) : 12));
    const { centered, mean, C } = centerAndScatter(points);
    const trace = (C[0]?.[0] ?? 0) + (C[1]?.[1] ?? 0);

    let v = [1, 0];
    let step = 0;
    const baseMeta = {
        n: points.length,
        iterations,
        rows: points.length + 2,
        covariance: C.reduce<number[]>((acc, row) => acc.concat(row), []),
        trace,
    };
    yield {
        stepNumber: step,
        entities: makeEntities(points, centered, mean, v, 0),
        edges: [],
        description: `Centered ${points.length} points; scatter matrix trace ${trace.toFixed(3)}. Starting power iteration from [1, 0].`,
        codeLineNumber: 0,
        layout: "point",
        meta: { ...baseMeta, iteration: 0, vector: v, eigenvalue: 0, variance: 0 },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        v = powerStep(C, v);
        const eigenvalue = rayleigh(C, v);
        yield {
            stepNumber: step,
            entities: makeEntities(points, centered, mean, v, iteration),
            edges: [],
            description: `Iteration ${iteration}: direction [${v.map((x) => x.toFixed(4)).join(", ")}], captured variance ${trace > 0 ? ((eigenvalue / trace) * 100).toFixed(1) : "0.0"}.`,
            codeLineNumber: iteration === iterations ? 5 : 3,
            layout: "point",
            meta: {
                ...baseMeta,
                iteration,
                vector: v,
                eigenvalue,
                variance: trace > 0 ? eigenvalue / trace : 0,
            },
        };
        step += 1;
    }

    const lambda1 = rayleigh(C, v);
    const deflated: number[][] = [
        [(C[0]?.[0] ?? 0) - lambda1 * (v[0] ?? 0) * (v[0] ?? 0), (C[0]?.[1] ?? 0) - lambda1 * (v[0] ?? 0) * (v[1] ?? 0)],
        [(C[1]?.[0] ?? 0) - lambda1 * (v[1] ?? 0) * (v[0] ?? 0), (C[1]?.[1] ?? 0) - lambda1 * (v[1] ?? 0) * (v[1] ?? 0)],
    ];
    let v2 = [1, 0];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        v2 = powerStep(deflated, v2);
        const overlap = (v2[0] ?? 0) * (v[0] ?? 0) + (v2[1] ?? 0) * (v[1] ?? 0);
        let orth0 = (v2[0] ?? 0) - overlap * (v[0] ?? 0);
        let orth1 = (v2[1] ?? 0) - overlap * (v[1] ?? 0);
        const norm = Math.hypot(orth0, orth1);
        if (norm < 1e-9) {
            orth0 = -(v[1] ?? 0);
            orth1 = v[0] ?? 0;
        } else {
            orth0 /= norm;
            orth1 /= norm;
        }
        v2 = [orth0, orth1];
    }
    const lambda2 = rayleigh(deflated, v2);
    yield {
        stepNumber: step,
        entities: makeEntities(points, centered, mean, v, iterations),
        edges: [],
        description: `Done: first component captures ${trace > 0 ? ((lambda1 / trace) * 100).toFixed(1) : "0.0"} percent of the variance; the deflated second component captures ${trace > 0 ? ((lambda2 / trace) * 100).toFixed(1) : "0.0"} percent.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            ...baseMeta,
            iteration: iterations,
            vector: v,
            eigenvalue: lambda1,
            variance: trace > 0 ? lambda1 / trace : 0,
            secondVector: v2,
            secondEigenvalue: lambda2,
            mean,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "PCA looks for the line through the data that spreads the points out the most. After shifting the cloud so its center sits at the origin, repeatedly multiplying a trial direction by the covariance matrix stretches it toward the direction of greatest variance. Normalizing after each multiplication stops the vector from growing, and the process settles on the leading eigenvector.",
        invariants: [
            "The centered points have mean zero in every coordinate.",
            "Each power iteration keeps the direction vector at unit length.",
            "The Rayleigh quotient approaches the leading eigenvalue from below.",
        ],
        correctness:
            "The scatter matrix equals X transposed times X, whose eigenvectors are the principal directions and whose eigenvalues measure variance along them. Decomposing an arbitrary starting vector in the eigenbasis, each power step multiplies the component along eigenvector i by lambda_i; the largest eigenvalue dominates the ratio, so the normalized vector converges to the leading eigenvector. Deflating by lambda times the outer product removes that direction and the same argument yields the second component.",
        complexityRationale:
            "Forming the scatter matrix scans n points with d coordinates, costing O(n * d^2). Each of k power steps multiplies a d by d matrix by a vector, costing O(d^2), so total time is O(n * d^2 + k * d^2). Storing centered data and covariance uses O(n * d + d^2) space.",
        uses: [
            "Dimensionality reduction before visualization or clustering",
            "Noise filtering and data compression",
            "Feature extraction in image and signal processing",
        ],
        references: [
            "Pearson, On Lines and Planes of Closest Fit to Systems of Points in Space, 1901",
            "Hotelling, Analysis of a Complex of Statistical Variables into Principal Components, 1933",
        ],
        workedExample:
            "For points near the line y equals 2x the scatter matrix has a dominant eigenvector close to [1, 2] divided by its length. Starting from [1, 0], a few power iterations rotate the direction until it points along that line, and the Rayleigh quotient approaches the variance measured along it.",
    },
    id: "principal-component-analysis",
    name: "Principal Component Analysis",
    category: "ml-ai",
    complexity: { time: "O(n * d^2 + k * d^2)", space: "O(n * d + d^2)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 0.8],
            [2, 1.6],
            [3, 2.5],
            [4, 3.1],
            [1, 2.2],
        ],
        iterations: 12,
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute the mean and center every point",
        "form the scatter matrix X transposed times X",
        "start the direction vector at the first axis",
        "repeat k times: multiply the vector by the scatter matrix",
        "normalize the vector back to unit length",
        "compute the Rayleigh quotient as the variance captured",
        "deflate the matrix and repeat for the second component",
        "done: report both components and their variances",
    ],
};

export default module;
