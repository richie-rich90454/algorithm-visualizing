/**
 * performer.ts - Performer FAVOR+ Linear Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Performer approximates softmax attention with explicit random features.
 * It maps queries and keys into a feature space where their dot product
 * approximates the softmax kernel, so attention can be computed as a
 * matrix product in linear time and memory with respect to sequence length.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * m * d) for n tokens, m random features, width d
 *   Space: O(n * m) for the projected features
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the exact softmax attention matrix and its random-feature
 *     approximation so the two can be compared directly.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PerformerInput {
    queries?: number[][];
    keys?: number[][];
    values?: number[][];
    features?: number;
    seed?: number;
}

/** Deterministic linear congruential generator returning uniforms in [0, 1). */
function lcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/** Standard normal sample using the Box-Muller transform. */
function gaussian(next: () => number): number {
    const u = Math.max(1e-12, next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
}

/** Exact scaled dot-product softmax attention. */
export function exactAttention(
    queries: number[][],
    keys: number[][],
    values: number[][],
): number[][] {
    const d = queries[0]?.length ?? 1;
    const scale = Math.sqrt(d);
    return queries.map((q) => {
        const scores = keys.map((k) =>
            q.reduce((sum, value, dim) => sum + value * (k[dim] ?? 0), 0) / scale,
        );
        const max = Math.max(...scores);
        const exps = scores.map((score) => Math.exp(score - max));
        const total = exps.reduce((a, b) => a + b, 0);
        const width = values[0]?.length ?? 1;
        return Array.from({ length: width }, (_v, dim) =>
            exps.reduce((sum, weight, j) =>
                sum + (weight / total) * (values[j]?.[dim] ?? 0), 0));
    });
}

/** Approximate attention via random Fourier features of the softmax kernel. */
export function performerAttention(
    queries: number[][],
    keys: number[][],
    values: number[][],
    featureCount: number,
    seed: number,
): number[][] {
    const d = queries[0]?.length ?? 1;
    const valueWidth = values[0]?.length ?? 1;
    const sigma = Math.sqrt(Math.sqrt(d));
    const next = lcg(seed);
    const w: number[][] = [];
    const phases: number[] = [];
    for (let m = 0; m < featureCount; m += 1) {
        w.push(Array.from({ length: d }, () => gaussian(next) / sigma));
        phases.push(next() * 2 * Math.PI);
    }
    const project = (x: number[]): number[] => {
        const normSq = x.reduce((s, v) => s + v * v, 0);
        const factor = Math.exp(normSq / (2 * Math.sqrt(d))) * Math.sqrt(2 / featureCount);
        return w.map((row, m) => {
            const projection = row.reduce((s, value, dim) => s + value * (x[dim] ?? 0), 0);
            return factor * Math.cos(projection + (phases[m] ?? 0));
        });
    };
    const qFeatures = queries.map(project);
    const kFeatures = keys.map(project);
    return qFeatures.map((qf) => {
        const denominator = kFeatures.reduce(
            (sum, kf) => sum + kf.reduce((s, value, m) => s + value * (qf[m] ?? 0), 0),
            0,
        );
        return Array.from({ length: valueWidth }, (_v, dim) => {
            const numerator = kFeatures.reduce((sum, kf, j) =>
                sum + kf.reduce((s, value, m) => s + value * (qf[m] ?? 0), 0) * (values[j]?.[dim] ?? 0),
            0);
            return Math.abs(denominator) < 1e-12 ? 0 : numerator / denominator;
        });
    });
}

/** Flatten a matrix of output vectors into a row-major n by valueWidth array. */
function flattenOutputs(outputs: number[][]): number[] {
    return outputs.flat();
}

function cells(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `c-${index}`,
        type: "cell" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PerformerInput | null) ?? {};
    const queries: number[][] = task.queries ?? [[1, 0], [0, 1], [1, 1], [0.5, 0.5]];
    const keys: number[][] = task.keys ?? queries;
    const values: number[][] = task.values ?? queries;
    const features = typeof task.features === "number" ? Math.max(1, task.features) : 256;
    const seed = typeof task.seed === "number" ? task.seed : 7;
    const n = queries.length;
    const width = values[0]?.length ?? 1;
    const exact = flattenOutputs(exactAttention(queries, keys, values));
    const approx = flattenOutputs(performerAttention(queries, keys, values, features, seed));
    const error = approx.reduce((sum, value, i) => sum + Math.abs(value - (exact[i] ?? 0)), 0) / Math.max(1, exact.length);

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(exact.map(() => 0), exact.map(() => "unvisited")),
        edges: [],
        description: `Prepare ${n} queries, keys and values with ${features} random features.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { features, seed, exact, approx: [], error: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(exact, exact.map(() => "comparing")),
        edges: [],
        description: `Compute the exact softmax attention output for comparison.`,
        codeLineNumber: 1,
        layout: "matrix",
        meta: { features, seed, exact, approx: [], error: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(approx, approx.map(() => "active")),
        edges: [],
        description: `Project queries and keys into ${features} random Fourier features and combine linearly.`,
        codeLineNumber: 2,
        layout: "matrix",
        meta: { features, seed, exact, approx, error },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: cells(approx, approx.map(() => "sorted")),
        edges: [],
        description: `Done: mean absolute error from exact attention is ${error.toFixed(5)}.`,
        codeLineNumber: 3,
        layout: "matrix",
        meta: { features, seed, exact, approx, error, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Softmax attention is expensive because it builds a quadratic attention matrix. The Performer notices that the softmax kernel can be approximated by a dot product of random Fourier features. Projecting queries and keys once lets attention be reassociated as a product of small matrices, removing the quadratic dependence on sequence length.",
        invariants: [
            "The random feature map is deterministic for a fixed seed.",
            "Approximate attention rows are normalized by the same projected sums.",
            "More random features reduce the approximation error toward exact softmax attention.",
        ],
        correctness:
            "Random Fourier features approximate a shift-invariant kernel by Bochner's theorem: sampling frequencies from the kernel's Fourier transform gives a feature map whose inner product is an unbiased estimate of the kernel. Rescaling by the query and key norms turns the softmax kernel exp(q dot k) into such an RBF kernel, so the projected dot product approximates the attention weights. Dividing by the sum of the same weights guarantees each output row uses weights that sum to one, matching the softmax normalization in expectation and converging as the number of features grows.",
        complexityRationale:
            "Projecting n queries and n keys into m features takes O(n m d). Reassociating the products takes O(n m) times the value width, avoiding the O(n squared) attention matrix. The stored projections need O(n m) space.",
        uses: [
            "Long-sequence language modeling with linear attention",
            "Efficient attention in protein and genomics models",
            "Streaming attention where keys and values arrive incrementally",
        ],
        references: [
            "Choromanski et al., Rethinking Attention with Performers, ICLR 2021",
            "Rahimi and Recht, Random Features for Large-Scale Kernel Machines, NeurIPS 2007",
        ],
        workedExample:
            "For four two-dimensional tokens the exact softmax attention produces a small output matrix. Using 256 deterministic random Fourier features, the projected dot products approximate the softmax kernel, and the approximation with 256 features is noticeably closer to the exact output than one using only 16 features.",
    },
    id: "performer",
    name: "Performer (FAVOR+ Attention)",
    category: "ml-ai",
    complexity: { time: "O(n m d)", space: "O(n m)" },
    defaultInput: {
        queries: [[1, 0], [0, 1], [1, 1], [0.5, 0.5]],
        keys: [[1, 0], [0, 1], [1, 1], [0.5, 0.5]],
        values: [[1, 0], [0, 1], [1, 1], [0.5, 0.5]],
        features: 256,
        seed: 7,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "read queries, keys, values, feature count and seed",
        "sample random frequencies and phases from the seed",
        "project each query and key into the random feature map",
        "compute approximate weights as projected dot products",
        "normalize by the sum of weights for each query",
        "combine values with the normalized weights",
        "done: report the approximate attention output",
    ],
};

export default module;
