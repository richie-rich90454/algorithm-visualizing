/**
 * decision-transformer.ts - Decision Transformer Sequence Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Decision Transformer treats reinforcement learning as sequence modeling. A
 * trajectory becomes a sequence of return-to-go, state, and action tokens. A
 * causal self-attention stack predicts the next action from earlier tokens
 * only, so future information can never leak backward. This module runs one
 * masked attention head over a small trajectory and reports its prediction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T^2 * d) for sequence length T and embedding dimension d
 *   Space: O(T^2) for the attention scores
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the causal attention matrix, one row per query token.
 *   - Masked positions are dim; visible weights are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DecisionTransformerInput {
    tokens?: number[][];
    wq?: number[][];
    wk?: number[][];
    wv?: number[][];
}

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) =>
        row.reduce((sum, weight, i) => sum + weight * (vector[i] ?? 0), 0),
    );
}

function softmax(row: number[]): number[] {
    const max = Math.max(...row);
    const exps = row.map((v) => Math.exp(v - max));
    const total = exps.reduce((a, v) => a + v, 0) || 1;
    return exps.map((v) => v / total);
}

function makeCells(attention: number[][], masked: boolean[][], done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < attention.length; i += 1) {
        for (let j = 0; j < (attention[i] ?? []).length; j += 1) {
            const value = attention[i]?.[j] ?? 0;
            const isMasked = masked[i]?.[j] ?? false;
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: isMasked ? "-" : value.toFixed(3),
                value,
                state: done && !isMasked ? "sorted" : isMasked ? "idle" : "active",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, weight: value, masked: isMasked },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DecisionTransformerInput | null) ?? {};
    const tokens = task.tokens ?? [
        [1, 0],
        [0.8, 0.2],
        [0.5, 0.5],
        [0.2, 0.9],
    ];
    const wq = task.wq ?? [[1, 0], [0, 1]];
    const wk = task.wk ?? [[1, 0], [0, 1]];
    const wv = task.wv ?? [[1, 0], [0, 1]];
    const d = Math.max(1, tokens[0]?.length ?? 1);

    const q = tokens.map((token) => matVec(wq, token));
    const k = tokens.map((token) => matVec(wk, token));
    const v = tokens.map((token) => matVec(wv, token));
    const t = tokens.length;
    const attention: number[][] = [];
    const masked: boolean[][] = [];
    for (let i = 0; i < t; i += 1) {
        const row: number[] = [];
        const maskRow: boolean[] = [];
        for (let j = 0; j < t; j += 1) {
            const isFuture = j > i;
            const score = q[i]!.reduce((s, val, dim) => s + val * (k[j]?.[dim] ?? 0), 0) / Math.sqrt(d);
            row.push(isFuture ? -Infinity : score);
            maskRow.push(isFuture);
        }
        attention.push(softmax(row));
        masked.push(maskRow);
    }
    const output = attention.map((row, i) =>
        row.map((weight, j) => weight * (v[j]?.[0] ?? 0)).reduce((a, value) => a + value, 0),
    );

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(attention, masked, false),
        edges: [],
        description: `Causal self-attention over ${t} trajectory tokens with embedding dimension ${d}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, rows: t, cols: t, embedding: d, maskedFraction: 0 },
    };
    step += 1;

    for (let i = 0; i < t; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(attention, masked, false),
            edges: [],
            description: `Query ${i}: attention is restricted to positions 0 through ${i} so future tokens cannot leak.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                step,
                rows: t,
                cols: t,
                query: i,
                row: attention[i]?.slice() ?? [],
                output: output[i] ?? 0,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(attention, masked, true),
        edges: [],
        description: `Done: causal mask enforced on all ${t} rows and next-token outputs computed.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { step, rows: t, cols: t, output, flatAttention: attention.flat() },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Decision Transformer recasts offline reinforcement learning as next-token prediction. It strings together desired return, state, and action into a sequence, then uses a causal transformer to predict the action that comes next. Because attention is masked to earlier positions, the model can only use history, which matches how a real agent must act without seeing the future.",
        invariants: [
            "Each query attends only to keys at the same or an earlier position.",
            "Every unmasked attention row is a probability distribution summing to one.",
            "The output for a position is a weighted sum of value vectors from visible positions.",
        ],
        correctness:
            "Scaling the query-key dot products by one over the square root of the embedding dimension and applying softmax gives standard scaled dot-product attention. Setting future logits to negative infinity makes their softmax weights exactly zero, which enforces causality. The test checks the triangular mask, row normalization, and that changing a future token leaves earlier outputs unchanged.",
        complexityRationale:
            "Computing all query-key scores needs O(T squared times d) operations and the T by T score matrix is the dominant O(T squared) storage cost.",
        uses: [
            "Offline reinforcement learning from recorded trajectories",
            "Conditional action generation with a target return",
            "Sequence modeling of decision making in games and robotics",
        ],
        references: [
            "Chen et al., Decision Transformer: Reinforcement Learning via Sequence Modeling, 2021",
            "Vaswani et al., Attention Is All You Need, 2017",
        ],
        workedExample:
            "For a four-token trajectory, the second query can attend to tokens zero and one but not two or three. Its attention row sums to one over the first two positions, so its output is a blend of only those earlier values.",
    },
    id: "decision-transformer",
    name: "Decision Transformer",
    category: "ml-ai",
    complexity: { time: "O(T^2 * d)", space: "O(T^2)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0.8, 0.2],
            [0.5, 0.5],
            [0.2, 0.9],
        ],
        wq: [[1, 0], [0, 1]],
        wk: [[1, 0], [0, 1]],
        wv: [[1, 0], [0, 1]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "arrange return, state, and action tokens into a sequence",
        "project tokens into queries, keys, and values",
        "compute scaled query-key attention scores",
        "mask every position that lies in the future",
        "apply softmax to obtain causal attention weights",
        "multiply the weights by the value vectors to form outputs",
        "use the final output to predict the next action",
        "done: report the attention matrix and outputs",
    ],
};

export default module;
