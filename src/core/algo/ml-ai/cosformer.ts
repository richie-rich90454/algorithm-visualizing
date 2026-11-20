/**
 * cosformer.ts - CosFormer Linear Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CosFormer makes linear attention position aware without a softmax. Each
 * query and key is reweighted by a cosine function of its position and passed
 * through a nonnegative activation. The key-value outer products are summed
 * into a compact summary, and every query reads from that summary. The result
 * is identical to the explicit pairwise kernel form but costs linear time in
 * the sequence length.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d * d_v) for n tokens, key dimension d, value dimension d_v
 *   Space: O(d * d_v + n * d_v) for the summary and outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The key-value summary S is revealed one key at a time on a grid.
 *   - The final grid shows the attention outputs for every query.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface CosFormerInput {
    queries?: Matrix;
    keys?: Matrix;
    values?: Matrix;
}

const relu = (v: number): number => (v > 0 ? v : 0);

/** CosFormer feature map: rectify each component then modulate by position. */
export function phi(row: number[], position: number, theta: number): number[] {
    return row.map((v) => relu(v) * Math.cos(position * theta));
}

/** Fast summary form of CosFormer attention. */
export function cosformerFast(Q: Matrix, K: Matrix, V: Matrix, theta: number) {
    const d = K[0]?.length ?? 0;
    const dv = V[0]?.length ?? 0;
    const S: Matrix = Array.from({ length: d }, () => Array.from({ length: dv }, () => 0));
    const z: number[] = Array.from({ length: d }, () => 0);
    for (let j = 0; j < K.length; j += 1) {
        const k = phi(K[j] ?? [], j, theta);
        for (let a = 0; a < d; a += 1) {
            z[a] = (z[a] ?? 0) + (k[a] ?? 0);
            for (let b = 0; b < dv; b += 1) {
                S[a]![b] = (S[a]![b] ?? 0) + (k[a] ?? 0) * ((V[j] ?? [])[b] ?? 0);
            }
        }
    }
    const output: Matrix = Q.map((query, i) => {
        const q = phi(query, i, theta);
        const den = q.reduce((sum, value, a) => sum + value * (z[a] ?? 0), 0);
        return Array.from({ length: dv }, (_, b) => {
            const num = S.reduce((sum, row, a) => sum + (q[a] ?? 0) * (row[b] ?? 0), 0);
            return den === 0 ? 0 : num / den;
        });
    });
    return { S, z, output };
}

/** Explicit pairwise reference form of CosFormer attention. */
export function cosformerSlow(Q: Matrix, K: Matrix, V: Matrix, theta: number): Matrix {
    const dot = (a: number[], b: number[]): number =>
        a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
    const dv = V[0]?.length ?? 0;
    return Q.map((query, i) => {
        const q = phi(query, i, theta);
        const kernels = K.map((key, j) => dot(q, phi(key, j, theta)));
        const den = kernels.reduce((a, b) => a + b, 0);
        return Array.from({ length: dv }, (_, b) => {
            const num = V.reduce((sum, value, j) => sum + (kernels[j] ?? 0) * (value[b] ?? 0), 0);
            return den === 0 ? 0 : num / den;
        });
    });
}

const flat = (m: Matrix): number[] => m.reduce<number[]>((acc, row) => acc.concat(row), []);

function cells(matrix: Matrix, shownRows: number, state: EntityState): VisualEntity[] {
    const result: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            const value = matrix[r]?.[c] ?? 0;
            result.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: r < shownRows ? value.toFixed(3) : "?",
                value: r < shownRows ? Number(value.toFixed(8)) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        }
    }
    return result;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CosFormerInput | null) ?? {};
    const Q: Matrix = task.queries ?? [
        [1, 0.5],
        [0.2, 1],
    ];
    const K: Matrix = task.keys ?? [
        [1, 0],
        [0.4, 0.8],
        [0, 1],
    ];
    const V: Matrix = task.values ?? [
        [2, 0],
        [0, 3],
        [1, 1],
    ];
    const theta = (Math.PI / 2) / Math.max(1, K.length);
    const { S, z, output } = cosformerFast(Q, K, V, theta);
    const d = S.length;
    const dv = S[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: cells(S, 0, "idle"),
        edges: [],
        description: `Reweight queries and keys by position, then accumulate a ${d} by ${dv} summary S and normalizer z.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: d, cols: dv, phase: "summary", theta, S: flat(S), z },
    };
    step += 1;

    for (let j = 0; j < K.length; j += 1) {
        yield {
            stepNumber: step,
            entities: cells(S, 0, "comparing"),
            edges: [],
            description: `Add the position-aware outer product of key ${j} with value ${j} into S.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { rows: d, cols: dv, phase: "summary", theta, currentKey: j, S: flat(S), z },
        };
        step += 1;
    }

    for (let i = 0; i < Q.length; i += 1) {
        yield {
            stepNumber: step,
            entities: cells(output, i + 1, "sorted"),
            edges: [],
            description: `Query ${i}: read S with the reweighted query and divide by its normalizer.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: Q.length,
                cols: dv,
                phase: "output",
                theta,
                S: flat(S),
                z,
                output: flat(output),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: cells(output, Q.length, "sorted"),
        edges: [],
        description: "Done: the summary form equals the explicit pairwise cosine-kernel attention.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { rows: Q.length, cols: dv, phase: "done", theta, S: flat(S), z, output: flat(output), converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "CosFormer keeps the cheap summarize-then-read trick of linear attention but adds a positional signal. Before comparing a query with a key, it rectifies both and multiplies each coordinate by a cosine that depends on the token position. Nearby positions line up constructively while far ones damp out, so the model gets order information for free.",
        invariants: [
            "The feature map is nonnegative, so every normalizer is nonnegative.",
            "S is the sum of phi(key_j) outer product with value_j over all keys.",
            "The summary form equals the explicit sum of pairwise cosine kernels.",
        ],
        correctness:
            "Writing kernel(i,j) as phi(q_i) dot phi(k_j), the output is sum_j kernel(i,j) v_j divided by sum_j kernel(i,j). Because phi(q_i) is independent of j it factors out of both sums, giving phi(q_i)^T S over phi(q_i)^T z with S and z accumulated once. This is an algebraic rearrangement of the pairwise definition, so the two forms are exactly equal.",
        complexityRationale:
            "Accumulating S costs d times d_v work per key and reading each query costs d times d_v, so the total is O(n d d_v) rather than O(n^2 d). Storing S, z and the outputs uses O(d d_v + n d_v) space.",
        uses: [
            "Long-sequence language modeling with linear-time attention",
            "Efficient vision backbones that need positional awareness",
            "A teaching example of kernel attention with positional encoding",
        ],
        references: [
            "Qin et al., CosFormer: Rethinking Softmax in Attention, ICLR 2022",
            "Katharopoulos et al., Transformers are RNNs, ICML 2020",
        ],
        workedExample:
            "With two-dimensional keys and theta set to pi divided by twice the length, the key at position one is scaled by cosines of its two coordinates. Its rectified outer product with its value is added to the two by two matrix S. A query reads the corresponding row of S and divides by its normalizer, matching the four explicit kernel comparisons.",
    },
    id: "cosformer",
    name: "CosFormer Attention",
    category: "ml-ai",
    complexity: { time: "O(n * d * d_v)", space: "O(d * d_v + n * d_v)" },
    defaultInput: {
        queries: [
            [1, 0.5],
            [0.2, 1],
        ],
        keys: [
            [1, 0],
            [0.4, 0.8],
            [0, 1],
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
        "set the cosine scale from the sequence length",
        "for each key add its position-weighted outer product with its value into S",
        "accumulate the weighted key into the normalizer z",
        "for each query reweight by its position",
        "compute the numerator as the reweighted query times S",
        "compute the denominator as the reweighted query times z",
        "divide to obtain the output row",
        "done: report all output rows",
    ],
};

export default module;
