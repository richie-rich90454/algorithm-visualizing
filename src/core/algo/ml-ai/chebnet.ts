/**
 * chebnet.ts - Chebyshev Spectral Graph Convolution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ChebNet approximates a graph convolution with a polynomial of the normalized
 * Laplacian. Chebyshev polynomials are evaluated by a stable three-term
 * recurrence on the scaled Laplacian, so no eigendecomposition is needed. Each
 * polynomial order has its own learnable weight matrix, and their contributions
 * are added to form the node output features.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(K * (n^3 + n * d * d_out)) for K orders and n nodes
 *   Space: O(K * n^2) for the polynomial matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Nodes reveal their output features order by order as the sum is built.
 *   - Metadata exposes each Chebyshev polynomial for inspection.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface ChebInput {
    adjacency?: Matrix;
    features?: Matrix;
    weights?: Matrix[];
    k?: number;
    lambdaMax?: number;
}

/** Standard dense matrix multiplication. */
export function multiply(a: Matrix, b: Matrix): Matrix {
    const inner = b.length;
    const cols = b[0]?.length ?? 0;
    return a.map((row) =>
        Array.from({ length: cols }, (_, j) => {
            let sum = 0;
            for (let k = 0; k < inner; k += 1) sum += (row[k] ?? 0) * (b[k]?.[j] ?? 0);
            return sum;
        }),
    );
}

const identity = (n: number): Matrix =>
    Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

/** Scaled normalized Laplacian Ltilde = 2 L / lambdaMax - I. */
export function scaledLaplacian(adjacency: Matrix, lambdaMax: number): Matrix {
    const n = adjacency.length;
    const degree = adjacency.map((row) => row.reduce((a, b) => a + b, 0));
    const L = identity(n).map((_row, i) =>
        Array.from({ length: n }, (_, j) => {
            const scaled = (adjacency[i]?.[j] ?? 0) / (Math.sqrt(degree[i] || 1) * Math.sqrt(degree[j] || 1));
            return (i === j ? 1 : 0) - scaled;
        }),
    );
    return L.map((row, i) => row.map((v, j) => (2 * v) / lambdaMax - (i === j ? 1 : 0)));
}

/** Chebyshev polynomials T_0 through T_{K-1} evaluated on Ltilde. */
export function chebyshevPolynomials(Ltilde: Matrix, k: number): Matrix[] {
    const n = Ltilde.length;
    const polynomials: Matrix[] = [identity(n)];
    if (k <= 1) return polynomials;
    polynomials.push(Ltilde);
    for (let order = 2; order < k; order += 1) {
        const previous = polynomials[order - 1]!;
        const before = polynomials[order - 2]!;
        const term = multiply(Ltilde, previous);
        polynomials.push(term.map((row, i) => row.map((v, j) => 2 * v - (before[i]?.[j] ?? 0))));
    }
    return polynomials;
}

/** Run a ChebNet layer and return the polynomial sum per order plus the final output. */
export function chebnetForward(adjacency: Matrix, features: Matrix, weights: Matrix[], k: number, lambdaMax: number) {
    const Ltilde = scaledLaplacian(adjacency, lambdaMax);
    const polynomials = chebyshevPolynomials(Ltilde, k);
    const partials: Matrix[] = [];
    let total = identity(features.length).map(() => new Array(weights[0]?.[0]?.length ?? 0).fill(0));
    for (let order = 0; order < k; order += 1) {
        const term = multiply(multiply(polynomials[order] ?? identity(features.length), features), weights[order] ?? []);
        total = total.map((row, i) => row.map((v, j) => v + (term[i]?.[j] ?? 0)));
        partials.push(total.map((row) => row.slice()));
    }
    return { Ltilde, polynomials, partials, output: total };
}

function nodes(features: Matrix, states: EntityState[]): VisualEntity[] {
    return features.map((row, i) => ({
        id: `node-${i}`,
        type: "node" as const,
        label: `${i}: [${row.map((v) => v.toFixed(2)).join(",")}]`,
        value: row.slice(),
        state: states[i] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ChebInput | null) ?? {};
    const adjacency: Matrix = task.adjacency ?? [
        [0, 1, 0],
        [1, 0, 1],
        [0, 1, 0],
    ];
    const features: Matrix = task.features ?? [
        [1, 0],
        [0, 1],
        [2, -1],
    ];
    const k = typeof task.k === "number" && task.k > 0 ? Math.floor(task.k) : 3;
    const lambdaMax = typeof task.lambdaMax === "number" && task.lambdaMax > 0 ? task.lambdaMax : 2;
    const weights: Matrix[] = task.weights ?? [
        [
            [1, 0],
            [0, 1],
        ],
        [
            [0.5, 0],
            [0, 0.5],
        ],
        [
            [0, 0.2],
            [0.2, 0],
        ],
    ].slice(0, k);
    const { Ltilde, polynomials, partials, output } = chebnetForward(adjacency, features, weights, k, lambdaMax);
    const n = adjacency.length;
    const edges: VisualFrame["edges"] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
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

    let step = 0;
    yield {
        stepNumber: step,
        entities: nodes(features, features.map(() => "unvisited")),
        edges,
        description: `Build the scaled Laplacian for a ${n}-node graph and prepare ${k} Chebyshev orders.`,
        codeLineNumber: 0,
        layout: "graph",
        meta: { phase: "init", k, lambdaMax, Ltilde, output: [] },
    };
    step += 1;

    for (let order = 0; order < k; order += 1) {
        yield {
            stepNumber: step,
            entities: nodes(partials[order] ?? output, features.map((_, i) => (i < order + 1 ? "active" : "unvisited"))),
            edges,
            description: `Order ${order}: add T_${order}(Ltilde) times the features times weight ${order} to the output sum.`,
            codeLineNumber: 1,
            layout: "graph",
            meta: { phase: "order", k, order, lambdaMax, polynomials, Ltilde, output: partials[order] ?? output },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: nodes(output, features.map(() => "sorted")),
        edges,
        description: "Done: the Chebyshev polynomial sum is the ChebNet output.",
        codeLineNumber: 4,
        layout: "graph",
        meta: { phase: "done", k, lambdaMax, polynomials, Ltilde, output, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A graph convolution can be viewed as filtering a signal on the graph, and filtering is multiplying by a polynomial of the Laplacian. ChebNet uses Chebyshev polynomials because they can be evaluated by a short recurrence without computing eigenvalues. Each order gets its own weight matrix, so the layer learns which frequency bands to keep.",
        invariants: [
            "T_0 is the identity and T_1 is the scaled Laplacian.",
            "The recurrence T_k = 2 Ltilde T_{k-1} minus T_{k-2} holds for every order beyond one.",
            "The output is the sum of the K weighted polynomial terms.",
        ],
        correctness:
            "The normalized Laplacian is symmetric because the degree normalization divides edge (i,j) and edge (j,i) by the same product. The Chebyshev recurrence is applied directly to the scaled Laplacian, producing the same matrices as evaluating the closed-form polynomial by the three-term identity. Multiplying each polynomial by the features and its weight and summing is the ChebNet layer definition, so the result is exact up to floating point.",
        complexityRationale:
            "Each polynomial step multiplies two n by n matrices, costing O(n cubed), and each feature projection costs O(n d d_out), for O(K (n cubed + n d d_out)) total. Storing K polynomial matrices uses O(K n squared) space.",
        uses: [
            "Spectral graph convolutions on small to medium graphs",
            "Graph signal processing and denoising",
            "A building block for deeper graph neural networks",
        ],
        references: [
            "Defferrard, Bresson and Vandergheynst, ChebNet, NIPS 2016",
            "Hammond et al., Wavelets on Graphs via Spectral Graph Theory, 2011",
        ],
        workedExample:
            "On a three-node path graph the scaled Laplacian has zero diagonal and small off-diagonal weights. T_0 is the identity, so the first term is just the input features times the first weight. T_1 is the Laplacian itself, so the second term spreads each node's features to its neighbors before applying the second weight.",
    },
    id: "chebnet",
    name: "ChebNet Spectral Convolution",
    category: "ml-ai",
    complexity: { time: "O(K * (n^3 + n * d * d_out))", space: "O(K * n^2)" },
    defaultInput: {
        adjacency: [
            [0, 1, 0],
            [1, 0, 1],
            [0, 1, 0],
        ],
        features: [
            [1, 0],
            [0, 1],
            [2, -1],
        ],
        k: 3,
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build the normalized graph Laplacian",
        "scale it into the interval used by Chebyshev polynomials",
        "set T_0 to the identity and T_1 to the scaled Laplacian",
        "for each further order apply the three-term recurrence",
        "multiply each polynomial by the features and its weight and add",
        "done: report the summed node output features",
    ],
};

export default module;
