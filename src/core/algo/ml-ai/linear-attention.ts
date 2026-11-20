/**
 * linear-attention.ts - Linear Attention via a Positive Feature Map
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Softmax attention forms an n by n score matrix, which is quadratic in the
 * sequence length. Linear attention replaces the softmax kernel with a positive
 * feature map phi and uses associativity to reorder the computation: accumulate
 * the outer products of mapped keys and values into one d by d_v summary, then
 * read it out with each mapped query. The result equals the pairwise kernel
 * computation but costs O(n * d * d_v) rather than O(n^2 * d).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d * d_v) for n rows, key dimension d, value dimension d_v
 *   Space: O(d * d_v + n * d_v) for the summary and the outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The accumulated key-value summary F is revealed one key at a time.
 *   - The normalization vector Z is shown beside it in the metadata.
 *   - Each output row is then revealed after dividing by its normalizer.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Positive feature map phi(x) = ELU(x) + 1. */
export function featureMap(x: number[]): number[] {
    return x.map((v) => (v >= 0 ? v + 1 : Math.exp(v)));
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

/**
 * Fast linear attention: build the key-value summary and the key normalizer,
 * then read out every query in one pass.
 */
export function linearAttentionFast(Q: number[][], K: number[][], V: number[][]) {
    const d = K[0]?.length ?? 0;
    const dv = V[0]?.length ?? 0;
    const F: number[][] = Array.from({ length: d }, () => Array.from({ length: dv }, () => 0));
    const Z: number[] = Array.from({ length: d }, () => 0);
    for (let j = 0; j < K.length; j += 1) {
        const phiK = featureMap(K[j] ?? []);
        for (let a = 0; a < d; a += 1) {
            Z[a] = (Z[a] ?? 0) + (phiK[a] ?? 0);
            for (let b = 0; b < dv; b += 1) {
                F[a]![b] = (F[a]![b] ?? 0) + (phiK[a] ?? 0) * ((V[j] ?? [])[b] ?? 0);
            }
        }
    }
    const output: number[][] = Q.map((query) => {
        const phiQ = featureMap(query);
        const den = dot(phiQ, Z);
        return Array.from({ length: dv }, (_, b) => {
            const num = F.reduce((sum, row, a) => sum + (phiQ[a] ?? 0) * (row[b] ?? 0), 0);
            return den === 0 ? 0 : num / den;
        });
    });
    return { F, Z, output };
}

/** Slow pairwise reference: sum over explicit query-key kernel values. */
export function linearAttentionSlow(Q: number[][], K: number[][], V: number[][]): number[][] {
    const dv = V[0]?.length ?? 0;
    return Q.map((query) => {
        const phiQ = featureMap(query);
        const kernels = K.map((key) => dot(phiQ, featureMap(key)));
        const den = kernels.reduce((a, b) => a + b, 0);
        return Array.from({ length: dv }, (_, b) => {
            const num = V.reduce((sum, value, j) => sum + (kernels[j] ?? 0) * (value[b] ?? 0), 0);
            return den === 0 ? 0 : num / den;
        });
    });
}

const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

function makeCells(matrix: number[][], shown: number, label: (r: number, c: number) => string): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            const visible = r < shown;
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: visible ? label(r, c) : "?",
                value: visible ? matrix[r]?.[c] ?? 0 : 0,
                state: visible ? "sorted" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return cells;
}

/** The linear-attention generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { queries?: number[][]; keys?: number[][]; values?: number[][] } | null
    ) ?? {};
    const Q = task.queries ?? [
        [1, 0],
        [0, 1],
    ];
    const K = task.keys ?? [
        [1, 0],
        [0, 1],
        [0.5, 0.5],
    ];
    const V = task.values ?? [
        [2, 0],
        [0, 3],
        [1, 1],
    ];
    const { F, Z, output } = linearAttentionFast(Q, K, V);
    const d = F.length;
    const dv = F[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(F, 0, (r, c) => (F[r]?.[c] ?? 0).toFixed(2)),
        edges: [],
        description: `Map keys and values into a ${d} by ${dv} summary F and a ${d}-length normalizer Z.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: d, cols: dv, phase: "summary", d, dv, n: K.length, F: flatten(F), Z },
    };
    step += 1;

    for (let j = 0; j < K.length; j += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(F, 0, (r, c) => (F[r]?.[c] ?? 0).toFixed(2)).map((cell) => ({
                ...cell,
                state: "comparing" as EntityState,
            })),
            edges: [],
            description: `Add phi(key ${j}) outer product with value ${j} into F and into Z.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: {
                rows: d,
                cols: dv,
                phase: "summary",
                d,
                dv,
                n: K.length,
                currentKey: j,
                F: flatten(F),
                Z,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, 0, (r, c) => (output[r]?.[c] ?? 0).toFixed(2)),
        edges: [],
        description: "Summary complete; read out each query as (F^T phi(q)) divided by (Z dot phi(q)).",
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: Q.length, cols: dv, phase: "output", d, dv, n: K.length, F: flatten(F), Z },
    };
    step += 1;

    for (let i = 0; i < Q.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(output, i + 1, (r, c) => (output[r]?.[c] ?? 0).toFixed(2)),
            edges: [],
            description: `Query ${i}: output ${(output[i] ?? []).map((v) => v.toFixed(3)).join(", ")}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: Q.length,
                cols: dv,
                phase: "output",
                d,
                dv,
                n: K.length,
                F: flatten(F),
                Z,
                output: flatten(output),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, Q.length, (r, c) => (output[r]?.[c] ?? 0).toFixed(2)),
        edges: [],
        description: `Done: linear attention output shape ${Q.length} by ${dv} matches the pairwise kernel form.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: Q.length,
            cols: dv,
            phase: "done",
            d,
            dv,
            n: K.length,
            F: flatten(F),
            Z,
            output: flatten(output),
            converged: true,
        },
    };
}

/** The linear-attention module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Softmax attention compares every query with every key, so doubling the sequence length quadruples the work. Linear attention notices that if the similarity is written as a product of feature vectors, the key-value products can be summed first into one compact summary. Each query then reads from that summary, turning a quadratic scan into a single matrix-vector readout.",
        invariants: [
            "The feature map phi is strictly positive, so the normalizer Z is nonzero when keys exist.",
            "F is the sum of phi(key_j) outer product with value_j over all keys.",
            "The fast summary form equals the explicit pairwise kernel sum.",
        ],
        correctness:
            "Expanding the fast form gives (sum_j phi(q)^T phi(k_j) v_j) / (sum_j phi(q)^T phi(k_j)). Because phi(q)^T is constant across j, it factors out of both sums and yields the same result as computing each kernel phi(q)^T phi(k_j) separately. The denominator is the dot product of phi(q) with Z, and the numerator is F^T phi(q), so associativity is the only step and no approximation beyond the choice of feature map is made.",
        complexityRationale:
            "Building F costs d times d_v multiply-adds per key, O(n * d * d_v). Each query reads F and Z in O(d * d_v). Storage is O(d * d_v) for the summary plus O(n * d_v) for the outputs, independent of n squared.",
        uses: [
            "Long-sequence transformers where quadratic attention is too costly",
            "Efficient vision and language models with linear complexity",
            "A teaching bridge between kernel methods and attention",
        ],
        references: [
            "Transformers are RNNs: Fast Autoregressive Transformers with Linear Attention, ICML 2020",
            "Katharopoulos et al., Linear Attention, 2020",
        ],
        workedExample:
            "With two-dimensional identity-like keys and values, phi turns each key into a positive vector. Summing their outer products fills a two by two matrix F. A query such as (1, 0) reads the first row of F and divides by the first entry of Z, giving the same answer as the four explicit kernel comparisons.",
    },
    id: "linear-attention",
    name: "Linear Attention",
    category: "ml-ai",
    complexity: { time: "O(n * d * d_v)", space: "O(d * d_v + n * d_v)" },
    defaultInput: {
        queries: [
            [1, 0],
            [0, 1],
        ],
        keys: [
            [1, 0],
            [0, 1],
            [0.5, 0.5],
        ],
        values: [
            [2, 0],
            [0, 3],
            [1, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize summary F to zeros and normalizer Z to zeros",
        "for each key compute phi(key) with the positive feature map",
        "add outer product of phi(key) and value into F",
        "add phi(key) into Z",
        "for each query compute denominator as phi(query) dot Z",
        "compute numerator as F transpose times phi(query)",
        "divide numerator by denominator to get the output row",
        "done: report all output rows",
    ],
};

export default module;
