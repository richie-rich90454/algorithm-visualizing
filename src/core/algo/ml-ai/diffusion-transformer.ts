/**
 * diffusion-transformer.ts - Diffusion Transformer (adaLN Conditioning Core)
 *
 * TEACHING MODEL, NOT A FULL DiT BLOCK. A diffusion transformer conditions its
 * tokens on the noise timestep with adaptive layer normalization (adaLN): a
 * conditioning vector predicts a scale, shift, and gate that modulate each
 * normalized token before a gated residual. This module implements exactly
 * that modulation on a tiny feature table with a supplied conditioning vector.
 *
 * Complexity:
 *   Time:  O(T * D) for T tokens of width D
 *   Space: O(T * D) for the staged feature table
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function fmt(value: number): string {
    return String(Math.round(value * 1000) / 1000);
}

function makeCells(matrix: Cell[][], revealedRows: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealedRows || value === null;
            const state: EntityState = hidden ? "unvisited" : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : fmt(value),
                value: value ?? -1,
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

function sigmoid(value: number): number {
    return 1 / (1 + Math.exp(-value));
}

/** Compute the four adaLN stages for a table of tokens. */
function compute(tokens: number[][], cond: number[]) {
    const normalized: number[][] = [];
    const modulated: number[][] = [];
    const output: number[][] = [];
    for (const token of tokens) {
        const mean = token.reduce((sum, value) => sum + value, 0) / (token.length || 1);
        const variance =
            token.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (token.length || 1);
        const std = Math.sqrt(variance + 1e-5);
        const normRow: number[] = [];
        const modRow: number[] = [];
        const outRow: number[] = [];
        for (let d = 0; d < token.length; d += 1) {
            const x = token[d] ?? 0;
            const c = cond[d] ?? 0;
            const norm = (x - mean) / std;
            const mod = norm * (1 + c) + c * 0.5;
            normRow.push(norm);
            modRow.push(mod);
            outRow.push(x + sigmoid(c) * mod);
        }
        normalized.push(normRow);
        modulated.push(modRow);
        output.push(outRow);
    }
    return { normalized, modulated, output };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { tokens?: number[][]; cond?: number[] } | null
    ) ?? {};
    const tokens = task.tokens?.length
        ? task.tokens
        : [
              [1, 2],
              [-1, 0.5],
              [3, -2],
          ];
    const cond = task.cond?.length ? task.cond : [0.8, -0.3];
    const width = Math.max(1, ...tokens.map((row) => row.length));
    const padded = tokens.map((row) => Array.from({ length: width }, (_, d) => row[d] ?? 0));
    const result = compute(padded, cond);
    const T = padded.length;

    const stage = (rows: number[][]): Cell[][] => rows.map((row) => row.slice(0, width));
    const matrix: Cell[][] = [
        ...stage(padded),
        ...stage(result.normalized),
        ...stage(result.modulated),
        ...stage(result.output),
    ];
    const base = { rows: 4 * T, cols: width, tokens: T, width, cond: cond.slice(0, 12) };
    const captions = [
        "Start with a table of token features and a timestep conditioning vector.",
        "Show the raw token features before any conditioning is applied.",
        "Layer-normalize each token to zero mean and unit variance.",
        "Apply the predicted scale and shift to every normalized feature.",
        `Add a gated residual; all ${T} token(s) are now conditioned on the timestep.`,
    ];
    const lines = [0, 1, 2, 3, 4];
    for (let frame = 0; frame < captions.length; frame += 1) {
        const revealed = Math.min(matrix.length, frame * T);
        yield {
            stepNumber: frame,
            entities: makeCells(matrix, revealed),
            edges: [],
            description: captions[frame] ?? "",
            codeLineNumber: lines[frame] ?? 0,
            layout: "grid",
            meta: {
                ...base,
                phase: frame === 0 ? "setup" : frame === 4 ? "done" : "modulate",
                output: result.output.flat().map(fmt).slice(0, 24),
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A diffusion transformer must tell each block how noisy the current image is. It embeds the timestep into a vector and uses it to predict a scale, a shift, and a gate for every feature channel. Those three values modulate layer-normalized tokens before a residual connection, so the same network can behave differently at different noise levels.",
        invariants: [
            "Layer normalization gives each token zero mean and approximately unit variance before modulation.",
            "The conditioning vector supplies one scale, shift, and gate per feature channel.",
            "The final update is a gated residual, so features can pass through unchanged when the gate is small.",
        ],
        correctness:
            "Layer normalization subtracts the token mean and divides by the standard deviation plus a small constant, which centers and scales the features exactly. The adaLN map then applies an affine transform with the supplied scale and shift, and the gated residual adds a sigmoid-weighted version of that transform to the original token. Every operation is defined channel by channel, so the output is determined uniquely by the input and conditioning vector.",
        complexityRationale:
            "Each token's mean and variance are computed over D channels and each channel then needs a constant number of operations, so the time is O(T times D). Storing the four feature stages uses O(T times D) space for this teaching instance.",
        uses: [
            "Class-conditional and text-conditional image generation",
            "Video and audio diffusion backbones",
            "A teaching model of adaLN modulation used in diffusion transformers",
        ],
        references: [
            "Peebles and Xie, Scalable Diffusion Models with Transformers, 2023",
            "Ho et al., Denoising Diffusion Probabilistic Models, 2020",
        ],
        workedExample:
            "For token [1, 2] and conditioning [0.8, minus 0.3], the normalized features are about minus 1 and plus 1. Multiplying by 1 plus the conditioning and adding half the conditioning modulates them, and a sigmoid gate blends the result back into the original token.",
    },
    id: "diffusion-transformer",
    name: "Diffusion Transformer (adaLN Conditioning Core)",
    category: "ml-ai",
    complexity: { time: "O(T * D)", space: "O(T * D)" },
    defaultInput: {
        tokens: [
            [1, 2],
            [-1, 0.5],
            [3, -2],
        ],
        cond: [0.8, -0.3],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "start with token features and a timestep conditioning vector",
        "for each token compute its feature mean and variance",
        "normalize the token by subtracting the mean and dividing by the standard deviation",
        "predict scale, shift, and gate from the conditioning vector",
        "modulate the normalized token with scale and shift",
        "add the gated residual to the original token",
        "done: return the conditioned token features",
    ],
};

export default module;
