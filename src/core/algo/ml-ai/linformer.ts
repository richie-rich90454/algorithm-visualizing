/**
 * linformer.ts - Linformer Low-Rank Projected Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Linformer observes that the attention matrix of a long sequence is often
 * close to low rank. It projects the keys and values from sequence length n
 * down to a small dimension k using learned matrices, then performs ordinary
 * scaled dot-product attention in the projected space. The attention matrix
 * becomes n by k instead of n by n, cutting both time and memory.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * k * d + n * k * d_v) for n tokens, rank k, key dimension d
 *   Space: O(n * k) for the projected attention matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The projected attention matrix has n query rows and k projected columns.
 *   - Rows are revealed one at a time with the projected keys and values in
 *     metadata so the low-rank reduction is visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LinformerInput {
    queries?: number[][];
    keys?: number[][];
    values?: number[][];
    projKeys?: number[][];
    projValues?: number[][];
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function matmul(a: number[][], b: number[][]): number[][] {
    const inner = b.length;
    const cols = b[0]?.length ?? 0;
    return a.map((row) =>
        Array.from({ length: cols }, (_, c) => {
            let sum = 0;
            for (let i = 0; i < inner; i += 1) {
                sum += (row[i] ?? 0) * (b[i]?.[c] ?? 0);
            }
            return sum;
        }),
    );
}

function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

/** Attention after projecting keys and values to rank k. */
export function linformerAttention(
    Q: number[][],
    K: number[][],
    V: number[][],
    E: number[][],
    F: number[][],
) {
    const k = E.length;
    const d = K[0]?.length ?? 1;
    const dv = V[0]?.length ?? 0;
    const scale = Math.sqrt(d);
    const projectedKeys = matmul(E, K);
    const projectedValues = matmul(F, V);
    const scores: number[][] = [];
    const weights: number[][] = [];
    const output: number[][] = [];
    for (const query of Q) {
        const row = projectedKeys.map((key) => dot(query, key) / scale);
        scores.push(row);
        const w = softmax(row);
        weights.push(w);
        output.push(
            Array.from({ length: dv }, (_, c) =>
                w.reduce((sum, weight, a) => sum + weight * (projectedValues[a]?.[c] ?? 0), 0),
            ),
        );
    }
    return { k, d, dv, projectedKeys, projectedValues, scores, weights, output };
}

function makeCells(weights: number[][], revealed: number, current: number): VisualEntity[] {
    const cols = weights[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let row = 0; row < weights.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const shown = row < revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? (weights[row]?.[col] ?? 0).toFixed(3) : "?",
                value: shown ? weights[row]?.[col] ?? 0 : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LinformerInput | null) ?? {};
    const Q: number[][] = task.queries ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, -1],
    ];
    const K: number[][] = task.keys ?? Q;
    const V: number[][] = task.values ?? Q;
    const E: number[][] = task.projKeys ?? [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
    ];
    const F: number[][] = task.projValues ?? [
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ];
    const result = linformerAttention(Q, K, V, E, F);
    const { k, d, dv, scores, weights, output } = result;
    const flatten = (m: number[][]): number[] => m.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, 0, -1),
        edges: [],
        description: `Project ${K.length} keys and values down to rank ${k} before attention.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: Q.length, cols: k, n: Q.length, k, d, dv, phase: "project" },
    };
    step += 1;

    for (let i = 0; i < Q.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(weights, i + 1, i),
            edges: [],
            description: `Query ${i}: scaled scores ${(scores[i] ?? []).map((s) => s.toFixed(2)).join(", ")} over ${k} projected keys.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: Q.length,
                cols: k,
                n: Q.length,
                k,
                d,
                dv,
                phase: "weights",
                current: i,
                scores: flatten(scores.slice(0, i + 1)),
                attention: flatten(weights.slice(0, i + 1)),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, Q.length, -1),
        edges: [],
        description: `Done: ${Q.length} outputs of width ${dv} from an n-by-${k} attention matrix.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: Q.length,
            cols: dv,
            n: Q.length,
            k,
            d,
            dv,
            phase: "done",
            attention: flatten(weights),
            output: flatten(output),
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Full attention stores a score for every query against every key, which grows quadratically with sequence length. Linformer assumes that matrix is effectively low rank, so it first squeezes the sequence of keys and values down to a short learned summary. Each query then attends to that short summary instead of to every original position, making attention linear in the sequence length for a fixed rank.",
        invariants: [
            "Projected keys and values have exactly k rows, independent of the sequence length n.",
            "Every attention row is a softmax and therefore sums to one.",
            "Each output row is a convex combination of the projected values.",
        ],
        correctness:
            "The projection matrices E and F map the n original keys and values to k rows by ordinary matrix multiplication. Attention then scores each query against the projected keys with the usual one over square root of d scaling, normalizes with softmax, and mixes the projected values. This is the standard attention formula applied to the projected sequences, so the result is exactly the defined Linformer output; when k equals n and the projections are the identity, it reduces to full attention.",
        complexityRationale:
            "Projecting keys and values costs O(n * k * d) and O(n * k * d_v). Scoring and mixing cost O(n * k * d) and O(n * k * d_v). The attention matrix holds n times k entries, so time is O(n*k*d + n*k*d_v) and space is O(n*k), both linear in n for fixed rank.",
        uses: [
            "Long-sequence language modeling with linear attention cost",
            "Document understanding where full attention is too large",
            "A teaching example of low-rank approximations in transformers",
        ],
        references: [
            "Wang et al., Linformer: Self-Attention with Linear Complexity, 2020",
            "Vaswani et al., Attention Is All You Need, 2017",
        ],
        workedExample:
            "With four tokens of dimension two and rank two, the projections keep the first two keys and the last two values. Each of the four queries scores against only two keys, producing a four-by-two attention grid. With identity projections of rank four the outputs match ordinary full attention exactly.",
    },
    id: "linformer",
    name: "Linformer Attention",
    category: "ml-ai",
    complexity: { time: "O(n * k * d + n * k * d_v)", space: "O(n * k)" },
    defaultInput: {
        queries: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0, -1],
        ],
        keys: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0, -1],
        ],
        values: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0, -1],
        ],
        projKeys: [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
        ],
        projValues: [
            [0, 0, 1, 0],
            [0, 0, 0, 1],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "project keys with matrix E from n rows to k rows",
        "project values with matrix F from n rows to k rows",
        "for each query scale dot products with the k projected keys",
        "apply softmax across the k projected key positions",
        "mix the projected values with those weights",
        "done: emit all n output rows",
    ],
};

export default module;
