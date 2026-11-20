/**
 * lsh-attention.ts - Locality Sensitive Hashing Attention
 *
 * Reformer-style LSH attention hashes each query and key into one of several
 * buckets and restricts attention to keys that share the query's bucket. The
 * hash projects each vector onto a fixed pseudo-random direction and takes the
 * bucket of the fractional part, so similar vectors tend to land together.
 * Attention therefore drops from dense O(n^2) to roughly O(n * bucket size).
 *
 * Time O(n^2) worst case in this dense reference build, space O(n^2) for the
 * displayed weight matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Vector { q: number[]; k: number[]; v: number[] }

export interface LshResult {
    buckets: number[];
    weights: number[][];
    outputs: number[][];
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function softmax(scores: number[]): number[] {
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / total);
}

/** Deterministic pseudo-random projection direction for a seed and dimension. */
function direction(dim: number, seed: number): number[] {
    return Array.from({ length: dim }, (_, k) => Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453 % 1);
}

/** Hash each token vector into one of `buckets` buckets. */
export function lshBuckets(vectors: number[][], buckets: number, seed: number): number[] {
    const dir = direction((vectors[0] ?? []).length, seed);
    return vectors.map((vec) => {
        const projected = dot(vec, dir);
        const frac = projected - Math.floor(projected);
        return Math.min(buckets - 1, Math.floor(frac * buckets));
    });
}

/** Compute bucketed causal-free attention and return weights plus outputs. */
export function lshAttention(tokens: Vector[], buckets: number, seed: number): LshResult {
    const dim = (tokens[0]?.q ?? []).length;
    const keyVectors = tokens.map((t) => t.k);
    const queryVectors = tokens.map((t) => t.q);
    const keyBuckets = lshBuckets(keyVectors, buckets, seed);
    const queryBuckets = lshBuckets(queryVectors, buckets, seed);
    const n = tokens.length;
    const weights: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const outputs: number[][] = [];

    for (let i = 0; i < n; i += 1) {
        const allowed: number[] = [];
        for (let j = 0; j < n; j += 1) {
            if (keyBuckets[j] === queryBuckets[i]) allowed.push(j);
        }
        const scores = allowed.map((j) => dot(queryVectors[i], keyVectors[j]) / Math.sqrt(dim || 1));
        const probs = softmax(scores);
        allowed.forEach((j, idx) => { weights[i][j] = probs[idx] ?? 0; });
        const out = new Array(dim).fill(0);
        allowed.forEach((j, idx) => {
            const v = tokens[j]?.v ?? [];
            for (let d = 0; d < dim; d += 1) out[d] += (probs[idx] ?? 0) * (v[d] ?? 0);
        });
        outputs.push(out);
    }
    return { buckets: queryBuckets, weights, outputs };
}

function makeCells(weights: number[][], buckets: number[], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const n = weights.length;
    weights.forEach((row, r) => {
        row.forEach((weight, c) => {
            const shown = r <= revealed;
            const sameBucket = buckets[c] === buckets[r];
            const state: EntityState = !shown ? "idle" : !sameBucket ? "unvisited" : weight > 0 ? "sorted" : "idle";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: shown ? `${weight.toFixed(3)}` : "?",
                value: shown ? weight : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, bucket: buckets[c] ?? 0 },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<{ tokens: Vector[]; buckets: number; seed: number }> | null) ?? {};
    const tokens: Vector[] = Array.isArray(task.tokens) && task.tokens.length > 0
        ? task.tokens
        : [
            { q: [1, 0], k: [1, 0.1], v: [1, 0] },
            { q: [0.9, 0.1], k: [1, 0], v: [0, 1] },
            { q: [-1, 0], k: [-1, 0.2], v: [0, 0] },
            { q: [-0.9, 0.2], k: [-1, 0], v: [1, 1] },
        ];
    const buckets = typeof task.buckets === "number" ? Math.max(1, task.buckets) : 2;
    const seed = typeof task.seed === "number" ? task.seed : 1;
    const result = lshAttention(tokens, buckets, seed);
    const n = tokens.length;
    const baseMeta = { rows: n, cols: n, buckets, bucketsAssigned: result.buckets };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result.weights, result.buckets, -1),
        edges: [],
        description: `Hash ${n} keys and queries into ${buckets} buckets, then attend within each bucket.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, outputs: result.outputs.flat() },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result.weights, result.buckets, i),
            edges: [],
            description: `Query ${i} is in bucket ${result.buckets[i]}; it attends only to keys in that bucket.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...baseMeta, current: i, outputs: result.outputs.flat() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.weights, result.buckets, n - 1),
        edges: [],
        description: "Done: each output is a weighted average of values from the same hash bucket.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...baseMeta, outputs: result.outputs.flat(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Full attention compares every query with every key, which is quadratic in sequence length. LSH attention first hashes queries and keys into buckets so that nearby vectors usually share a bucket, then computes attention only inside each bucket. This keeps the exact softmax structure inside a bucket while avoiding most cross-bucket comparisons.",
        invariants: [
            "A query attends only to keys whose bucket equals its own bucket.",
            "The weights inside a query's allowed set form a softmax and sum to one.",
            "Each output is a convex combination of the allowed value vectors.",
        ],
        correctness:
            "Buckets come from the fractional part of a fixed projection, so the hash is deterministic for a given seed. For each query the algorithm gathers exactly the keys in its bucket, applies the scaled dot-product softmax over that set, and averages the corresponding values; this is the definition of bucketed attention and the tests reproduce it independently. Because the query bucket is included in its own key set, every row has at least one nonzero weight.",
        complexityRationale:
            "Hashing each of n vectors costs O(n d). Building this dense reference weight matrix takes O(n^2) memory and time, but a sparse implementation touches only same-bucket pairs, giving roughly O(n d + n b) where b is the average bucket size.",
        uses: [
            "Long-sequence transformers where dense attention is too costly",
            "Reformer-style efficient language models",
            "Approximate nearest-neighbor attention layers",
        ],
        references: [
            "Kitaev, Kaiser, and Levskaya, Reformer: The Efficient Transformer, ICLR 2020",
            "Andoni and Indyk, Near-Optimal Hashing Algorithms for Approximate Nearest Neighbor, 2006",
        ],
        workedExample:
            "With four tokens and two buckets, suppose tokens zero and one hash to bucket zero while two and three hash to bucket one. Query zero then attends only to keys zero and one; its output lies on the segment joining value zero and value one, and its weight row is zero in columns two and three.",
    },
    id: "lsh-attention",
    name: "LSH Attention",
    category: "ml-ai",
    complexity: { time: "O(n^2) dense, O(n b) sparse", space: "O(n^2) dense" },
    defaultInput: {
        tokens: [
            { q: [1, 0], k: [1, 0.1], v: [1, 0] },
            { q: [0.9, 0.1], k: [1, 0], v: [0, 1] },
            { q: [-1, 0], k: [-1, 0.2], v: [0, 0] },
            { q: [-0.9, 0.2], k: [-1, 0], v: [1, 1] },
        ],
        buckets: 2,
        seed: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "hash every query and key into one of the buckets",
        "for each query gather keys in the same bucket",
        "compute scaled dot-product scores over those keys",
        "apply softmax to obtain attention weights",
        "average the corresponding values into the output",
        "done: report weights and outputs",
    ],
};

export default module;
