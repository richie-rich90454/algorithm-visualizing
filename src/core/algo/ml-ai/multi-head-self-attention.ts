/**
 * multi-head-self-attention.ts - Multi-Head Self-Attention
 *
 * Applies several independent scaled dot-product attention heads to a short
 * token sequence, concatenates their outputs, and mixes them with an output
 * projection. Weights are generated from a fixed seed so the arithmetic is
 * fully reproducible; this is the exact transformer attention computation.
 *
 * Time:  O(heads * n^2 * dk + n * dModel * heads * dk)
 * Space: O(n^2 * heads) for the attention maps
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AttentionInput {
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

function makeAttentionCells(matrix: number[][], active: boolean): VisualEntity[] {
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AttentionInput | null) ?? {};
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
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 11;
    const nextWeight = weightStream(seed);

    const Wq: number[][][] = [];
    const Wk: number[][][] = [];
    const Wv: number[][][] = [];
    for (let h = 0; h < heads; h += 1) {
        Wq.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, nextWeight)));
        Wk.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, nextWeight)));
        Wv.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, nextWeight)));
    }
    const Wo = Array.from({ length: heads * dk }, () => Array.from({ length: dModel }, nextWeight));
    const weights = { Wq, Wk, Wv, Wo };

    const attentionMaps: number[][][] = [];
    const concat: number[][] = Array.from({ length: n }, () => Array(heads * dk).fill(0));
    for (let h = 0; h < heads; h += 1) {
        const Q: number[][] = [];
        const K: number[][] = [];
        const V: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            Q.push(Array.from({ length: dk }, (_v, k) => tokens[i].reduce((s, x, d) => s + x * Wq[h][d][k], 0)));
            K.push(Array.from({ length: dk }, (_v, k) => tokens[i].reduce((s, x, d) => s + x * Wk[h][d][k], 0)));
            V.push(Array.from({ length: dk }, (_v, k) => tokens[i].reduce((s, x, d) => s + x * Wv[h][d][k], 0)));
        }
        const scores: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            scores.push(
                Array.from({ length: n }, (_v, j) =>
                    Q[i].reduce((s, q, k) => s + q * K[j][k], 0) / Math.sqrt(dk),
                ),
            );
        }
        const attention: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            const row = scores[i];
            const max = Math.max(...row);
            const exp = row.map((s) => Math.exp(s - max));
            const denom = exp.reduce((a, b) => a + b, 0);
            attention.push(exp.map((e) => e / denom));
        }
        attentionMaps.push(attention);
        for (let i = 0; i < n; i += 1) {
            for (let k = 0; k < dk; k += 1) {
                concat[i][h * dk + k] = attention[i].reduce((s, a, j) => s + a * V[j][k], 0);
            }
        }
    }
    const output: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        output.push(
            Array.from({ length: dModel }, (_v, o) =>
                concat[i].reduce((s, c, p) => s + c * Wo[p][o], 0),
            ),
        );
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeAttentionCells(Array.from({ length: n }, () => Array(n).fill(0)), false),
        edges: [],
        description: `Preparing ${heads} attention heads over ${n} tokens with key dimension ${dk}.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n, heads, dk, weights: JSON.stringify(weights) },
    };
    step += 1;

    for (let h = 0; h < heads; h += 1) {
        const attention = attentionMaps[h] ?? [];
        const sums = attention.map((row) => row.reduce((a, b) => a + b, 0));
        yield {
            stepNumber: step,
            entities: makeAttentionCells(attention, true),
            edges: [],
            description: `Head ${h}: softmax attention rows sum to ${sums.map((s) => s.toFixed(3)).join(", ")}.`,
            codeLineNumber: h === heads - 1 ? 5 : 3,
            layout: "matrix",
            meta: {
                rows: n,
                cols: n,
                heads,
                dk,
                head: h,
                weights: JSON.stringify(weights),
                attention: attention.flat(),
                rowSums: sums,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeAttentionCells(attentionMaps[0] ?? [], true),
        edges: [],
        description: `Concatenated ${heads} heads and projected to ${dModel} dimensions; first output token is [${(output[0] ?? []).map((x) => x.toFixed(3)).join(", ")}].`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: {
            rows: n,
            cols: n,
            heads,
            dk,
            weights: JSON.stringify(weights),
            attention: (attentionMaps[0] ?? []).flat(),
            output: output.flat(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Self-attention lets each token look at every other token and decide how much information to gather from each. A head computes query, key, and value vectors, scores every query-key pair, scales by the square root of the key dimension, and softmaxes the scores into weights. Running several heads in parallel lets the model attend to different relationships at once.",
        invariants: [
            "Scores are query-key dot products divided by the square root of the key dimension.",
            "Each attention row is a softmax, so its weights are nonnegative and sum to one.",
            "Head outputs are concatenated and linearly projected to produce the final vectors.",
        ],
        correctness:
            "The softmax denominator is the sum of exponentials over all keys for a given query, which by construction makes the weights sum to one. Each head output is the weighted sum of value vectors with those weights, and the final projection is a fixed linear map, so recomputing the same formulas from the reported weights reproduces the output exactly.",
        complexityRationale:
            "For n tokens, each head forms an n by n score matrix requiring O(n^2 * dk) work, and projecting all heads costs O(n * dModel * heads * dk). Storing the attention maps uses O(heads * n^2) space.",
        uses: [
            "Transformer language models and machine translation",
            "Document and image encoders",
            "Any task needing pairwise interactions among a set of items",
        ],
        references: [
            "Vaswani et al., Attention Is All You Need, 2017",
            "Bahdanau, Cho and Bengio, Neural Machine Translation by Jointly Learning to Align, 2015",
        ],
        workedExample:
            "With three two-dimensional tokens and two heads, each head builds a three-by-three score matrix, scales it, and applies softmax row by row. A row such as (0.5, 0.3, 0.2) means the first token draws half its value from itself, 0.3 from the second, and 0.2 from the third; the two heads' outputs are concatenated and projected.",
    },
    id: "multi-head-self-attention",
    name: "Multi-Head Self-Attention",
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
        seed: 11,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "generate query, key, and value projections for every head",
        "for each head compute queries, keys, and values from the tokens",
        "score every query against every key and scale by square root of key dimension",
        "apply softmax to each row of scores to get attention weights",
        "multiply the weights by the values to get the head output",
        "concatenate all head outputs",
        "project the concatenation to the model dimension",
        "done: report attention maps and output tokens",
    ],
};

export default module;
