/**
 * multi-query-attention.ts - Multi-Query Attention (MQA)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multi-query attention keeps one shared key head and one shared value head
 * while every query head keeps its own projection. The attention math is the
 * same as multi-head attention, but the shared key/value cache is smaller by a
 * factor of the number of heads, which speeds up autoregressive decoding.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(heads * n^2 * dk + n * heads * dk * dModel)
 *   Space: O(heads * n^2) for the attention maps, O(n * dk) for the KV cache
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One attention matrix is shown per query head.
 *   - Every head uses the SAME key and value vectors, exposed in the frame meta.
 *   - All drawable objects are grid cells carrying their row and column.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MqaInput {
    tokens?: number[][];
    heads?: number;
    dk?: number;
    seed?: number;
}

/** Seeded generator producing weights in [-1, 1] rounded to two decimals. */
function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

/** Numerically stable softmax over one row of scores. */
function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

function makeCells(matrix: number[][], active: boolean): VisualEntity[] {
    const n = matrix.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const value = matrix[i]?.[j] ?? 0;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: active ? value.toFixed(3) : "?",
                value: active ? value : -1,
                state: (active ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

/** The multi-query attention generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MqaInput | null) ?? {};
    const tokens = Array.isArray(task.tokens)
        ? task.tokens.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
          ];
    const n = tokens.length;
    const dModel = tokens[0]?.length ?? 2;
    const heads = Math.max(1, typeof task.heads === "number" ? Math.trunc(task.heads) : 2);
    const dk = Math.max(1, typeof task.dk === "number" ? Math.trunc(task.dk) : 2);
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 23;
    const nextWeight = weightStream(seed);

    const Wq: number[][][] = [];
    for (let h = 0; h < heads; h += 1) {
        Wq.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, nextWeight)));
    }
    const Wk = Array.from({ length: dModel }, () => Array.from({ length: dk }, nextWeight));
    const Wv = Array.from({ length: dModel }, () => Array.from({ length: dk }, nextWeight));
    const Wo = Array.from({ length: heads * dk }, () => Array.from({ length: dModel }, nextWeight));

    const project = (W: number[][]): number[][] =>
        tokens.map((token) =>
            Array.from({ length: dk }, (_v, k) =>
                token.reduce((sum, x, d) => sum + x * (W[d]?.[k] ?? 0), 0),
            ),
        );
    const Q = Wq.map(project);
    const K = project(Wk);
    const V = project(Wv);
    const scale = Math.sqrt(dk);

    const maps: number[][][] = [];
    const concat: number[][] = Array.from({ length: n }, () => Array(heads * dk).fill(0));
    for (let h = 0; h < heads; h += 1) {
        const scores: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            scores.push(
                Array.from({ length: n }, (_v, j) =>
                    (Q[h]?.[i] ?? []).reduce(
                        (sum, q, k) => sum + q * (K[j]?.[k] ?? 0),
                        0,
                    ) / scale,
                ),
            );
        }
        const attention = scores.map(softmax);
        maps.push(attention);
        for (let i = 0; i < n; i += 1) {
            for (let k = 0; k < dk; k += 1) {
                concat[i][h * dk + k] = attention[i].reduce(
                    (sum, weight, j) => sum + weight * (V[j]?.[k] ?? 0),
                    0,
                );
            }
        }
    }
    const output: number[][] = tokens.map((_token, i) =>
        Array.from({ length: dModel }, (_v, o) =>
            concat[i].reduce((sum, value, p) => sum + value * (Wo[p]?.[o] ?? 0), 0),
        ),
    );

    const flatten = (matrix: number[][]): number[] =>
        matrix.reduce<number[]>((acc, row) => acc.concat(row), []);
    const weights = JSON.stringify({ Wq, Wk, Wv, Wo });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(Array.from({ length: n }, () => Array(n).fill(0)), false),
        edges: [],
        description: `Preparing ${heads} query heads over ${n} tokens with one shared key/value head of dimension ${dk}.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n, heads, dk, weights },
    };
    step += 1;

    for (let h = 0; h < heads; h += 1) {
        const attention = maps[h] ?? [];
        const sums = attention.map((row) => row.reduce((a, b) => a + b, 0));
        yield {
            stepNumber: step,
            entities: makeCells(attention, true),
            edges: [],
            description: `Query head ${h}: attention rows sum to ${sums.map((s) => s.toFixed(3)).join(", ")}; keys and values are shared with every other head.`,
            codeLineNumber: h === heads - 1 ? 4 : 3,
            layout: "matrix",
            meta: {
                rows: n,
                cols: n,
                heads,
                head: h,
                dk,
                weights,
                attention: flatten(attention),
                q: flatten(Q[h] ?? []),
                k: flatten(K),
                v: flatten(V),
                rowSums: sums,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output.map((row) => row.slice(0, n)), true),
        edges: [],
        description: `Concatenated ${heads} heads and projected to ${dModel} dimensions; the KV cache holds only n by ${dk} values instead of heads times that size.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: {
            rows: n,
            cols: n,
            heads,
            dk,
            weights,
            output: flatten(output),
            kvCacheEntries: n * dk,
            naiveKvCacheEntries: heads * n * dk,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A transformer head needs its own queries, but the keys and values it reads can be shared. Give every query head a private projection and use one common key and value projection for all of them. The attention computation is unchanged, while the cache of past keys and values shrinks by a factor of the head count.",
        invariants: [
            "Every query head has its own learned query projection.",
            "All heads read the same key and value vectors at every position.",
            "Each attention row is a softmax and therefore sums to one.",
        ],
        correctness:
            "For any query head h the score is q_h dot k_j divided by the square root of the key dimension, and the weights are the softmax of those scores. Because K and V are computed once from the shared projections, the attention map for h is exactly the map that multi-head attention would produce with a head-specific K and V replaced by that shared pair. The final output is the concatenation of head outputs passed through a fixed linear projection.",
        complexityRationale:
            "Each head forms an n by n score matrix with dot products of length dk, costing O(heads * n^2 * dk), and the output projection costs O(n * heads * dk * dModel). Sharing removes a factor of heads from the key/value cache, which needs only O(n * dk) space.",
        uses: [
            "Fast autoregressive decoding in large language models",
            "Serving models with a long conversation context",
            "Reducing memory bandwidth during batched generation",
        ],
        references: [
            "Shazeer, Fast Transformer Decoding: One Write-Head is All You Need, 2019",
            "Ainslie et al., GQA: Training Generalized Multi-Query Transformer Models, 2023",
        ],
        workedExample:
            "With three two-dimensional tokens, two query heads, and key dimension two, both heads build a three-by-three attention matrix from the same two key vectors. The key/value cache stores six numbers instead of twelve, yet each head still produces its own output through its private query projection.",
    },
    id: "multi-query-attention",
    name: "Multi-Query Attention",
    category: "ml-ai",
    complexity: { time: "O(heads * n^2 * dk)", space: "O(heads * n^2)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
        ],
        heads: 2,
        dk: 2,
        seed: 23,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "project private queries for every head",
        "project one shared key vector and one shared value vector per token",
        "for each head score every query against every shared key",
        "scale the scores and apply softmax row by row",
        "average the shared values with each head's weights",
        "concatenate the head outputs",
        "project the concatenation to the model dimension",
        "done: report the attention maps and the smaller KV cache size",
    ],
};

export default module;
