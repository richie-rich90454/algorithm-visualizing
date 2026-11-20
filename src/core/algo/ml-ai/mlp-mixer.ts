/**
 * mlp-mixer.ts - MLP-Mixer Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * MLP-Mixer processes a token-by-channel table with two kinds of multilayer
 * perceptron. A token-mixing MLP runs on each channel column and is shared by
 * all channels, so it mixes information across positions. A channel-mixing MLP
 * runs on each token row and is shared by all tokens, so it mixes features.
 * Residual connections surround both stages. No attention is used.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(S * C * (H_t + H_c)) for S tokens, C channels, hidden widths H
 *   Space: O(S * C) for the two mixed tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grids reveal the input table, the token-mixed table, and the output.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Matrix = number[][];

interface MixerMLP {
    w1: Matrix;
    b1: number[];
    w2: Matrix;
    b2: number[];
}

interface MixerInput {
    x?: Matrix;
    token?: MixerMLP;
    channel?: MixerMLP;
}

/** Smooth GELU activation used by the mixer layers. */
export function gelu(v: number): number {
    return 0.5 * v * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (v + 0.044715 * v * v * v)));
}

const dot = (a: number[], b: number[]): number => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);

/** Apply a two-layer MLP with GELU to one vector. */
export function applyMLP(vector: number[], mlp: MixerMLP): number[] {
    const hidden = mlp.w1.map((row, i) => gelu(dot(vector, row) + (mlp.b1[i] ?? 0)));
    return mlp.w2.map((row, i) => dot(hidden, row) + (mlp.b2[i] ?? 0));
}

/** Run a full mixer block: shared token MLP then shared channel MLP with residuals. */
export function mlpMixerForward(X: Matrix, token: MixerMLP, channel: MixerMLP) {
    const S = X.length;
    const C = X[0]?.length ?? 0;
    const tokenMixed: Matrix = X.map((row) => row.slice());
    for (let c = 0; c < C; c += 1) {
        const column = X.map((row) => row[c] ?? 0);
        const mixed = applyMLP(column, token);
        for (let t = 0; t < S; t += 1) tokenMixed[t]![c] = (X[t]?.[c] ?? 0) + (mixed[t] ?? 0);
    }
    const output: Matrix = tokenMixed.map((row) => row.slice());
    for (let t = 0; t < S; t += 1) {
        const row = tokenMixed[t] ?? [];
        const mixed = applyMLP(row, channel);
        for (let c = 0; c < C; c += 1) output[t]![c] = (row[c] ?? 0) + (mixed[c] ?? 0);
    }
    return { tokenMixed, output };
}

function grid(matrix: Matrix, state: "idle" | "comparing" | "sorted"): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let r = 0; r < matrix.length; r += 1) {
        for (let c = 0; c < (matrix[r]?.length ?? 0); c += 1) {
            cells.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: (matrix[r]?.[c] ?? 0).toFixed(3),
                value: Number((matrix[r]?.[c] ?? 0).toFixed(8)),
                state,
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

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MixerInput | null) ?? {};
    const X: Matrix = task.x ?? [
        [1, -0.5],
        [0.3, 2],
    ];
    const token: MixerMLP = task.token ?? {
        w1: [
            [1, 0.5],
            [-0.5, 1],
            [0.2, 0.2],
        ],
        b1: [0, 0.1, -0.1],
        w2: [
            [0.5, -0.2, 0.1],
            [0.3, 0.4, -0.1],
        ],
        b2: [0, 0],
    };
    const channel: MixerMLP = task.channel ?? {
        w1: [
            [1, -0.5],
            [0.5, 1],
            [0.2, 0.3],
        ],
        b1: [0, 0, 0.1],
        w2: [
            [0.4, 0.2, -0.1],
            [-0.2, 0.5, 0.3],
        ],
        b2: [0, 0],
    };
    const { tokenMixed, output } = mlpMixerForward(X, token, channel);
    const S = X.length;
    const C = X[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: grid(X, "idle"),
        edges: [],
        description: `Start from a ${S} by ${C} token-by-channel table.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: S, cols: C, phase: "input", x: X },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: grid(tokenMixed, "comparing"),
        edges: [],
        description: "Apply the channel-shared token MLP to each column and add the residual.",
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: S, cols: C, phase: "token-mixed", x: X, tokenMixed },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: grid(output, "sorted"),
        edges: [],
        description: "Apply the token-shared channel MLP to each row and add the residual.",
        codeLineNumber: 2,
        layout: "grid",
        meta: { rows: S, cols: C, phase: "output", x: X, tokenMixed, output, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A transformer mixes tokens with attention and channels with a feed-forward network. MLP-Mixer uses the same simple multilayer perceptron for both jobs. It applies one MLP down each column to let positions talk, then one MLP across each row to let features talk, sharing weights so the parameter count stays independent of sequence length.",
        invariants: [
            "The token MLP weights are shared by every channel column.",
            "The channel MLP weights are shared by every token row.",
            "Each residual leaves the input table shape unchanged.",
        ],
        correctness:
            "The token stage treats each column independently with one fixed function, so it mixes across tokens while keeping channels separate. The channel stage treats each row independently with another fixed function, so it mixes across channels. Adding the original table as a residual preserves the identity path, and both stages are evaluated directly from their weight matrices, so the computed output is exactly the layer definition.",
        complexityRationale:
            "Each column MLP costs O(C S H_t) work across all channels and each row MLP costs O(S C H_c), giving O(S C (H_t + H_c)) total. Two tables of size S by C are stored for the intermediates, so space is O(S C).",
        uses: [
            "Image and text classifiers without attention",
            "A simple baseline for studying token mixing",
            "Efficient backbones where parameter count must not grow with sequence length",
        ],
        references: [
            "Tolstikhin et al., MLP-Mixer: An all-MLP Architecture for Vision, NeurIPS 2021",
            "Hendrycks and Gimpel, Gaussian Error Linear Units, 2016",
        ],
        workedExample:
            "For a two-token, two-channel table, the token MLP reads column zero across both tokens and produces two new numbers that are added back to that column. It repeats the same weights on column one. Then the channel MLP reads each resulting row, transforms its two features through a hidden layer, and adds the result back, producing the final two by two table.",
    },
    id: "mlp-mixer",
    name: "MLP-Mixer",
    category: "ml-ai",
    complexity: { time: "O(S * C * (H_t + H_c))", space: "O(S * C)" },
    defaultInput: {
        x: [
            [1, -0.5],
            [0.3, 2],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read the token-by-channel input table",
        "for each channel column apply the shared token MLP and add a residual",
        "store the token-mixed table",
        "for each token row apply the shared channel MLP and add a residual",
        "store the output table",
        "done: report the mixed table",
    ],
};

export default module;
