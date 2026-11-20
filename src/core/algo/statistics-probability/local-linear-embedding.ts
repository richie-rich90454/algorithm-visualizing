/**
 * local-linear-embedding.ts - Locally Linear Embedding
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Locally linear embedding assumes that each data point can be reconstructed
 * as a weighted average of its nearest neighbors. The weights are found by a
 * constrained least-squares fit, and a low-dimensional embedding is then
 * derived from the weight matrix so that the same local reconstructions hold.
 * This module computes the neighbor weights, their reconstruction errors, and
 * a one-dimensional embedding by power iteration on the deflated weight matrix.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * d + n * k^3 + iterations * n^2)
 *   Space: O(n^2) for the weight matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per point shows its local reconstruction error.
 *   - The point currently being fitted is highlighted.
 *   - The final frame reports the total error and the embedding values.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

/** Solve A z = b by Gauss-Jordan with partial pivoting. */
function solve(A: Matrix, b: number[]): number[] {
    const n = b.length;
    const aug = A.map((row, i) => [...row, b[i] as number]);
    for (let col = 0; col < n; col += 1) {
        let pivot = col;
        for (let r = col + 1; r < n; r += 1) {
            if (Math.abs(aug[r]?.[col] as number) > Math.abs(aug[pivot]?.[col] as number)) pivot = r;
        }
        const temp = aug[col];
        aug[col] = aug[pivot] as number[];
        aug[pivot] = temp as number[];
        const div = aug[col]?.[col] as number || 1e-12;
        for (let c = col; c <= n; c += 1) aug[col]![c] = (aug[col]![c] as number) / div;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const factor = aug[r]?.[col] as number;
            if (factor === 0) continue;
            for (let c = col; c <= n; c += 1) aug[r]![c] = (aug[r]![c] as number) - factor * (aug[col]![c] as number);
        }
    }
    return aug.map((row) => row[n] as number);
}

/** Squared Euclidean distance between two points. */
function distance2(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += ((a[i] as number) - (b[i] as number)) ** 2;
    return sum;
}

function makeBars(values: number[], current: number, done: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(6),
        value,
        state: done || index < current ? "sorted" : index === current ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, error: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: number[][]; k?: number } | null) ?? {};
    const points = task.points ?? [
        [0, 0], [1, 0.05], [2, -0.05], [3, 0.1], [4, 0], [5, -0.1],
    ];
    const n = points.length;
    const dim = points[0]?.length ?? 0;
    const k = typeof task.k === "number" ? Math.max(2, Math.min(Math.max(2, n - 1), Math.floor(task.k))) : Math.min(2, Math.max(2, n - 1));

    const neighbors: number[][] = [];
    const weights: number[][] = [];
    const errors: number[] = [];
    const W: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));

    yield {
        stepNumber: 0,
        entities: makeBars(new Array<number>(n).fill(0), -1, false),
        edges: [],
        description: `Fitting locally linear weights for ${n} points using ${k} neighbors each.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, k, neighbors: [], weights: [], errors: [], embedding: [], totalError: 0, complete: false },
    };
    let step = 1;
    for (let i = 0; i < n; i += 1) {
        const ordered = points
            .map((point, index) => ({ index, distance: index === i ? Infinity : distance2(point, points[i] as number[]) }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, k)
            .map((entry) => entry.index);
        const diffs = ordered.map((index) => (points[i] as number[]).map((value, d) => value - (points[index]?.[d] as number)));
        const gram: Matrix = diffs.map((a) => diffs.map((b) => a.reduce((sum, value, d) => sum + value * (b[d] as number), 0) + (a === b ? 1e-9 : 0)));
        const raw = solve(gram, new Array<number>(k).fill(1));
        const rawSum = raw.reduce((a, b) => a + b, 0) || 1;
        const w = raw.map((value) => value / rawSum);
        let error = 0;
        for (let d = 0; d < dim; d += 1) {
            let reconstructed = 0;
            for (let j = 0; j < k; j += 1) reconstructed += (w[j] as number) * (points[ordered[j] as number]?.[d] as number);
            error += ((points[i]?.[d] as number) - reconstructed) ** 2;
        }
        error = Math.sqrt(error);
        neighbors.push(ordered);
        weights.push(w);
        errors.push(error);
        for (let j = 0; j < k; j += 1) W[i]![ordered[j] as number] = w[j] as number;

        yield {
            stepNumber: step,
            entities: makeBars([...errors, ...new Array<number>(n - i - 1).fill(0)], i, false),
            edges: [],
            description: `Point ${i}: reconstruction error ${error.toFixed(6)} from ${k} neighbors.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { n, k, neighbors: neighbors.map((row) => [...row]), weights: weights.map((row) => [...row]), errors: [...errors], embedding: [], totalError: 0, complete: false },
        };
        step += 1;
    }

    const deflated: Matrix = W.map((row) => row.map((value) => value - 1 / n));
    let vector = Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * i) / Math.max(2, n)));
    for (let iter = 0; iter < 120; iter += 1) {
        const next = deflated.map((row) => row.reduce((sum, value, j) => sum + value * (vector[j] as number), 0));
        const norm = Math.sqrt(next.reduce((sum, value) => sum + value * value, 0)) || 1;
        vector = next.map((value) => value / norm);
    }
    const vecMean = vector.reduce((a, b) => a + b, 0) / n;
    const embedding = vector.map((value) => value - vecMean);
    const totalError = errors.reduce((a, b) => a + b, 0);
    yield {
        stepNumber: step,
        entities: makeBars(errors, n, true),
        edges: [],
        description: `Embedding complete: total reconstruction error ${totalError.toFixed(6)} across ${n} points.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { n, k, neighbors, weights, errors, embedding, totalError, complete: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Locally linear embedding assumes that a point can be rebuilt from its nearby neighbors by a fixed weighted average. If those weights are chosen well, they capture the local geometry of a curved surface. A low-dimensional map is then found by asking which coordinates preserve the same neighbor relationships, unfolding the surface without needing to know the global shape.",
        invariants: [
            "Each point uses exactly k nearest neighbors, excluding itself.",
            "The reconstruction weights for a point sum to one.",
            "The reported error is the distance between a point and its weighted reconstruction.",
        ],
        correctness:
            "For each point the weights minimize the squared reconstruction error subject to summing to one. Introducing a Lagrange multiplier gives the linear system C w = 1 with C built from dot products of neighbor displacement vectors; a tiny ridge term keeps the solve stable for collinear neighbors, and renormalizing the solution preserves the constraint. The embedding comes from the dominant eigenvector of the mean-centered weight matrix, which is the coordinate direction least shrunk by local averaging.",
        complexityRationale:
            "Finding k neighbors for all n points costs O(n squared times d). Each k by k least-squares solve costs O(k cubed), and power iteration on the n by n deflated matrix costs O(iterations times n squared). The weight matrix uses O(n squared) space.",
        uses: [
            "Unfolding nonlinear manifolds in high-dimensional data",
            "Visualizing clusters that linear projection cannot separate",
            "Preprocessing for recognition and retrieval systems",
        ],
        references: [
            "Roweis and Saul, Nonlinear Dimensionality Reduction by Locally Linear Embedding, Science 290, 2000",
            "Saul and Roweis, Think Globally, Fit Locally, Journal of Machine Learning Research 4, 2003",
        ],
        workedExample:
            "For points placed along a straight line at positions 0, 1, 2, and 3, the point at 1 has neighbors 0 and 2. Solving the constrained fit gives weights 0.5 and 0.5, reconstructing 1 exactly with zero error. The same holds for every interior point, so the total reconstruction error is zero.",
    },
    id: "local-linear-embedding",
    name: "Locally Linear Embedding",
    category: "statistics-probability",
    complexity: { time: "O(n^2 * d + n * k^3 + iterations * n^2)", space: "O(n^2)" },
    defaultInput: {
        points: [
            [0, 0], [1, 0.05], [2, -0.05], [3, 0.1], [4, 0], [5, -0.1],
        ],
        k: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the point cloud and neighbor count k",
        "for each point find its k nearest neighbors by squared distance",
        "form the Gram matrix of neighbor displacement vectors",
        "solve the constrained least-squares system and normalize weights to sum to one",
        "measure the distance from each point to its weighted reconstruction",
        "build the deflated weight matrix and find its dominant eigenvector by power iteration",
        "center that vector to obtain the embedding",
        "done: report neighbor weights, errors, and the embedding",
    ],
};

export default module;
