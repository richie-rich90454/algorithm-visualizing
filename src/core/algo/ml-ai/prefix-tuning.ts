/**
 * prefix-tuning.ts - Prefix Tuning (continuous prompt attention)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Prefix tuning freezes a pretrained attention layer and learns a short vector
 * prefix that is prepended to the keys and values. Only the prefix vectors are
 * trainable; the tokens and the attention rule stay fixed. This module replays
 * the teachable algorithmic core: a frozen attention pass whose key/value
 * sequence begins with a learned continuous prefix.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the exact attention computation over a prepended prefix, not a full
 * language-model fine-tuning run. No optimizer step is performed: "tuning" is
 * represented by which vectors carry a trainable flag. The arithmetic shown is
 * faithful; there is no claim about downstream model quality.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * (n + p) * d) for n tokens, prefix length p, dimension d
 *   Space: O(n * (n + p)) for the attention matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The attention matrix has n query rows and n + p key columns.
 *   - Prefix columns are highlighted to show they are trainable.
 *   - All drawable objects are grid cells carrying their row and column.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface PrefixInput {
    tokens?: number[][];
    prefix?: number[][];
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

/**
 * Run frozen attention with the prefix prepended to keys and values.
 * Rows are queries (the real tokens); columns are prefix keys then token keys.
 */
export function prefixAttention(tokens: number[][], prefix: number[][]) {
    const n = tokens.length;
    const p = prefix.length;
    const d = tokens[0]?.length ?? 1;
    const keys = [...prefix, ...tokens];
    const values = keys;
    const scale = Math.sqrt(d);
    const scores: number[][] = [];
    const weights: number[][] = [];
    const output: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        const query = tokens[i] ?? [];
        const row: number[] = [];
        for (let j = 0; j < keys.length; j += 1) {
            let dot = 0;
            for (let k = 0; k < d; k += 1) {
                dot += (query[k] ?? 0) * (keys[j]?.[k] ?? 0);
            }
            row.push(dot / scale);
        }
        scores.push(row);
        const w = softmax(row);
        weights.push(w);
        const outRow: number[] = [];
        for (let k = 0; k < d; k += 1) {
            let value = 0;
            for (let j = 0; j < values.length; j += 1) {
                value += (w[j] ?? 0) * (values[j]?.[k] ?? 0);
            }
            outRow.push(value);
        }
        output.push(outRow);
    }
    return { n, p, d, cols: n + p, scores, weights, output };
}

/** Build the attention grid, revealing rows up to `revealed`. */
function makeCells(
    weights: number[][],
    prefixLen: number,
    revealed: number,
    current: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < weights.length; row += 1) {
        for (let col = 0; col < (weights[row]?.length ?? 0); col += 1) {
            const shown = row < revealed;
            const value = weights[row]?.[col] ?? 0;
            const state: EntityState =
                row === current ? "comparing" : shown ? (col < prefixLen ? "highlight" : "sorted") : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: shown ? value.toFixed(3) : "?",
                value: shown ? value : -1,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, trainable: col < prefixLen },
            });
        }
    }
    return entities;
}

/** The prefix-tuning generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as PrefixInput | null) ?? {};
    const tokens = Array.isArray(task.tokens)
        ? task.tokens.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
          ];
    const prefix = Array.isArray(task.prefix)
        ? task.prefix.map((row) => [...row])
        : [
              [0.5, 0.2],
              [-0.1, 0.4],
          ];
    const data = prefixAttention(tokens, prefix);
    const { n, p, d, cols, scores, weights, output } = data;
    const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, p, 0, -1),
        edges: [],
        description: `Frozen attention over ${n} tokens with a trainable continuous prefix of length ${p}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols, n, p, d, prefixLen: p },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(weights, p, i + 1, i),
            edges: [],
            description: `Token ${i}: scores ${(scores[i] ?? []).map((s) => s.toFixed(2)).join(", ")}; the first ${p} columns are the learned prefix.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: n,
                cols,
                n,
                p,
                d,
                current: i,
                scores: flatten(scores.slice(0, i + 1)),
                attention: flatten(weights.slice(0, i + 1)),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(weights, p, n, -1),
        edges: [],
        description: `Done: ${n} frozen-token outputs; only the ${p} prefix vectors would receive gradient updates.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: n,
            cols,
            n,
            p,
            d,
            attention: flatten(weights),
            scores: flatten(scores),
            output: flatten(output),
            trainableVectors: p,
            frozenVectors: n,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Instead of changing the weights of a pretrained model, learn a small set of virtual tokens that sit in front of the real input. Those prefix vectors join the key and value sequence, so every real token can attend to them. Because the rest of the model never changes, a tiny learned prefix can steer a large frozen model.",
        invariants: [
            "The attention rule and all model weights stay frozen.",
            "Only the prefix vectors are marked trainable.",
            "Each attention row is a softmax and therefore sums to one.",
        ],
        correctness:
            "The keys and values passed to attention are exactly the prefix vectors followed by the token vectors. The query for row i is token i, so the score against column j is the dot product divided by the square root of the dimension, and softmax normalizes across all n plus p columns. The output row is the weighted average of the same key/value sequence, which is the defined frozen-layer output under a prepended prefix.",
        complexityRationale:
            "There are n queries and n plus p keys, and each score is a dot product of length d, so scoring costs O(n * (n + p) * d); forming the output has the same order. The attention matrix needs O(n * (n + p)) space, and the trainable prefix needs O(p * d).",
        uses: [
            "Parameter-efficient adaptation of large language models",
            "Per-task continuous prompts kept separate from model weights",
            "Soft prompt tuning when storing many task variants",
        ],
        references: [
            "Li and Liang, Prefix-Tuning: Optimizing Continuous Prompts for Generation, ACL 2021",
            "Lester, Al-Rfou, and Constant, The Power of Scale for Parameter-Efficient Prompt Tuning, 2021",
        ],
        workedExample:
            "With two token vectors and a prefix of length two, the attention matrix has two rows and four columns. The first two columns belong to the learned prefix and are marked trainable; the last two belong to the frozen tokens. Each row sums to one, and the outputs are computed over all four values.",
    },
    id: "prefix-tuning",
    name: "Prefix Tuning",
    category: "ml-ai",
    complexity: { time: "O(n * (n + p) * d)", space: "O(n * (n + p))" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
        ],
        prefix: [
            [0.5, 0.2],
            [-0.1, 0.4],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "freeze the pretrained attention layer",
        "prepend learned prefix vectors to the keys and values",
        "for each real token compute scaled dot products with all keys",
        "apply softmax across prefix keys and token keys",
        "average the values with those weights to form the output",
        "update only the prefix vectors during training",
        "done: report the outputs and which vectors are trainable",
    ],
};

export default module;
