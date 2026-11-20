/**
 * spectral-convolution.ts - Spectral Graph Convolution in the Laplacian Basis
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A spectral graph convolution diagonalizes the normalized graph Laplacian and
 * applies a learnable gain to each frequency before transforming back. Given
 * the eigenvectors U, eigenvalues lambda, and a filter g, the output is
 * U diag(g(lambda)) U transpose x. This module computes the eigendecomposition
 * with the Jacobi rotation method and replays one frequency contribution at a
 * time. It is the exact spectral operation that Chebyshev polynomial networks
 * approximate without an eigendecomposition.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sweeps * n^2 + n^3) for the eigendecomposition
 *   Space: O(n^2) for the eigenvectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Graph nodes are placed on a circle and labeled with their output value.
 *   - The highlighted nodes receive the current frequency contribution.
 *   - The final frame shows the summed filtered signal.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SpectralInput {
    adjacency?: number[][];
    signal?: number[];
    lowWeight?: number;
    highWeight?: number;
    cutoff?: number;
}

type Matrix = number[][];

/** Normalized graph Laplacian L = I - D^(-1/2) A D^(-1/2). */
export function normalizedLaplacian(adjacency: Matrix): Matrix {
    const n = adjacency.length;
    const degree = adjacency.map((row) => row.reduce((sum, value) => sum + value, 0));
    return adjacency.map((row, i) =>
        Array.from({ length: n }, (_, j) => {
            if (i === j) {
                return degree[i] > 0 ? 1 : 0;
            }
            const denom = Math.sqrt((degree[i] || 1) * (degree[j] || 1));
            return -(row[j] ?? 0) / denom;
        }),
    );
}

/** Symmetric eigendecomposition by cyclic Jacobi rotations. Columns of vectors are eigenvectors. */
export function jacobiEigen(matrix: Matrix, sweeps = 60): { values: number[]; vectors: Matrix } {
    const n = matrix.length;
    const a: Matrix = matrix.map((row) => [...row]);
    const vectors: Matrix = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
    for (let sweep = 0; sweep < sweeps; sweep += 1) {
        let p = 0;
        let q = 1;
        let largest = 0;
        for (let i = 0; i < n; i += 1) {
            for (let j = i + 1; j < n; j += 1) {
                const value = Math.abs(a[i]?.[j] ?? 0);
                if (value > largest) {
                    largest = value;
                    p = i;
                    q = j;
                }
            }
        }
        if (largest < 1e-12) {
            break;
        }
        const app = a[p]?.[p] ?? 0;
        const aqq = a[q]?.[q] ?? 0;
        const apq = a[p]?.[q] ?? 0;
        const theta = (aqq - app) / (2 * apq);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        const h = t * apq;
        a[p][p] = app - h;
        a[q][q] = aqq + h;
        a[p][q] = 0;
        a[q][p] = 0;
        for (let k = 0; k < n; k += 1) {
            if (k === p || k === q) {
                continue;
            }
            const akp = a[k]?.[p] ?? 0;
            const akq = a[k]?.[q] ?? 0;
            a[k][p] = a[p][k] = c * akp - s * akq;
            a[k][q] = a[q][k] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k += 1) {
            const vkp = vectors[k]?.[p] ?? 0;
            const vkq = vectors[k]?.[q] ?? 0;
            vectors[k][p] = c * vkp - s * vkq;
            vectors[k][q] = s * vkp + c * vkq;
        }
    }
    const order = Array.from({ length: n }, (_, i) => i).sort(
        (x, y) => (a[x]?.[x] ?? 0) - (a[y]?.[y] ?? 0),
    );
    const values = order.map((i) => a[i]?.[i] ?? 0);
    const sorted = order.map((i) => vectors.map((row) => row[i] ?? 0));
    return { values, vectors: transpose(sorted) };
}

function transpose(matrix: Matrix): Matrix {
    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    return Array.from({ length: cols }, (_, i) => Array.from({ length: rows }, (_, j) => matrix[j]?.[i] ?? 0));
}

/** Apply a piecewise spectral gain to a signal. */
export function spectralConvolve(
    adjacency: Matrix,
    signal: number[],
    lowWeight: number,
    highWeight: number,
    cutoff = 1e-6,
): { values: number[]; gains: number[]; output: number[]; contributions: Matrix } {
    const laplacian = normalizedLaplacian(adjacency);
    const eigen = jacobiEigen(laplacian);
    const gains = eigen.values.map((lambda) => (lambda < cutoff ? lowWeight : highWeight));
    const contributions: Matrix = [];
    for (let k = 0; k < eigen.values.length; k += 1) {
        const vector = eigen.vectors.map((row) => row[k] ?? 0);
        const coefficient = vector.reduce((sum, value, i) => sum + value * (signal[i] ?? 0), 0);
        contributions.push(vector.map((value) => value * coefficient * (gains[k] ?? 0)));
    }
    const output = signal.map((_, i) => contributions.reduce((sum, row) => sum + (row[i] ?? 0), 0));
    return { values: eigen.values, gains, output, contributions };
}

function makeNodes(
    output: number[],
    active: boolean,
): VisualEntity[] {
    const n = output.length;
    return output.map((value, i) => {
        const angle = (2 * Math.PI * i) / n;
        return {
            id: `node-${i}`,
            type: "node" as const,
            label: value.toFixed(2),
            value,
            state: active ? "active" : "unvisited",
            x: Math.cos(angle),
            y: Math.sin(angle),
            width: 0,
            height: 0,
            metadata: { index: i, output: value },
        };
    });
}

function makeEdges(adjacency: Matrix): Array<{
    id: string;
    sourceId: string;
    targetId: string;
    label: string;
    state: EntityState;
    directed: boolean;
}> {
    const edges: Array<{
        id: string;
        sourceId: string;
        targetId: string;
        label: string;
        state: EntityState;
        directed: boolean;
    }> = [];
    for (let i = 0; i < adjacency.length; i += 1) {
        for (let j = i + 1; j < (adjacency[i]?.length ?? 0); j += 1) {
            if ((adjacency[i]?.[j] ?? 0) !== 0) {
                edges.push({
                    id: `edge-${i}-${j}`,
                    sourceId: `node-${i}`,
                    targetId: `node-${j}`,
                    label: "",
                    state: "idle",
                    directed: false,
                });
            }
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SpectralInput | null) ?? {};
    const adjacency: Matrix = task.adjacency ?? [
        [0, 1, 1, 1],
        [1, 0, 1, 1],
        [1, 1, 0, 1],
        [1, 1, 1, 0],
    ];
    const signal: number[] = task.signal ?? [1, 2, 3, 4];
    const lowWeight = typeof task.lowWeight === "number" ? task.lowWeight : 1;
    const highWeight = typeof task.highWeight === "number" ? task.highWeight : 0;
    const cutoff = typeof task.cutoff === "number" ? task.cutoff : 1e-6;
    const result = spectralConvolve(adjacency, signal, lowWeight, highWeight, cutoff);
    const edges = makeEdges(adjacency);
    const zeros = signal.map(() => 0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeNodes(zeros, false),
        edges,
        description: `Spectral convolution on ${signal.length} nodes: diagonalize the Laplacian and filter each frequency.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: {
            eigenvalues: result.values,
            gains: result.gains,
            output: zeros,
            contributions: result.contributions,
        },
    };
    step += 1;

    for (let k = 0; k < result.values.length; k += 1) {
        const current = result.contributions[k] ?? zeros;
        yield {
            stepNumber: step,
            entities: makeNodes(current, true),
            edges,
            description: `Frequency ${k}: eigenvalue ${result.values[k]?.toFixed(4)}, gain ${result.gains[k]?.toFixed(3)} added to every node.`,
            codeLineNumber: 1 + (k % 5),
            layout: "graph",
            meta: {
                frequency: k,
                eigenvalue: result.values[k] ?? 0,
                gain: result.gains[k] ?? 0,
                eigenvalues: result.values,
                gains: result.gains,
                output: current,
                contributions: result.contributions,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeNodes(result.output, false),
        edges,
        description: `Done: summed ${result.values.length} filtered frequencies into the final node outputs.`,
        codeLineNumber: 7,
        layout: "graph",
        meta: {
            eigenvalues: result.values,
            gains: result.gains,
            output: result.output,
            contributions: result.contributions,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A graph signal can be decomposed into smooth and oscillatory patterns using the eigenvectors of the graph Laplacian, just as a time signal decomposes into sine waves. A spectral convolution scales each pattern by a chosen gain and adds them back together. Low frequencies capture slowly varying structure and high frequencies capture sharp differences between neighboring nodes.",
        invariants: [
            "The normalized Laplacian is symmetric and its eigenvalues are nonnegative.",
            "The eigenvectors form an orthonormal basis, so the transform preserves energy before filtering.",
            "Each frequency contributes a rank-one outer product scaled by its gain.",
        ],
        correctness:
            "Jacobi rotations are orthogonal similarity transforms that drive the off-diagonal entries to zero, so the resulting columns are orthonormal eigenvectors and the diagonal entries are eigenvalues. Expanding the signal in that basis, applying the gain, and summing the rank-one contributions reconstructs U diag(g) U transpose x exactly, which is the definition of spectral graph convolution.",
        complexityRationale:
            "Each Jacobi sweep scans n squared off-diagonal entries and updates n entries, and a constant number of sweeps converges for moderate matrices, giving roughly O(n cubed) time overall. Storing the eigenvectors takes O(n squared) space.",
        uses: [
            "Graph neural networks with learnable spectral filters",
            "Smoothing or denoising signals defined on networks",
            "Graph-based clustering and spectral embedding",
        ],
        references: [
            "Bruna, Zaremba, Szlam and LeCun, Spectral Networks and Deep Locally Connected Networks, 2013",
            "Defferrard, Bresson and Vandergheynst, Convolutional Neural Networks on Graphs, 2016",
        ],
        workedExample:
            "On the complete graph with four nodes the Laplacian eigenvalues are zero, one point three three, one point three three, and one point three three. A low-pass filter with gain one at zero and zero elsewhere keeps only the constant component, so every node receives the mean of the input signal.",
    },
    id: "spectral-convolution",
    name: "Spectral Graph Convolution",
    category: "ml-ai",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        adjacency: [
            [0, 1, 1, 1],
            [1, 0, 1, 1],
            [1, 1, 0, 1],
            [1, 1, 1, 0],
        ],
        signal: [1, 2, 3, 4],
        lowWeight: 1,
        highWeight: 0,
        cutoff: 0.000001,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "form the normalized graph Laplacian",
        "diagonalize it with Jacobi rotations",
        "choose a gain for each eigenvalue",
        "project the signal onto each eigenvector",
        "scale the projection by the gain",
        "reconstruct that frequency contribution",
        "sum all contributions into the output",
        "done: report eigenvalues, gains, and node outputs",
    ],
};

export default module;
