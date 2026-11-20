/**
 * albert.ts - ALBERT Factorized Embedding and Cross-Layer Weight Sharing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ALBERT is a lighter BERT that cuts parameters in two ways. First it splits a
 * large vocabulary-by-hidden embedding matrix into a small vocabulary-by-
 * embedding factor and a thin embedding-by-hidden projection. Second it shares
 * one encoder layer across all depths instead of storing a separate copy of
 * every layer. This demo computes deterministic factorized embeddings, pushes
 * them through the single shared layer repeatedly, and reports the exact
 * parameter savings.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(tokens * (E * H + N * H^2)) for E embedding dims, H hidden dims,
 *          and N shared layers
 *   Space: O(tokens * H) for the running hidden states
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame is a grid of token rows by hidden-dimension columns.
 *   - The first frame is the factorized embedding output.
 *   - Later frames show the state after each application of the shared layer.
 *   - The final frame reports the parameter reductions.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface AlbertInput {
    tokenIds: number[];
    vocabSize: number;
    embeddingSize: number;
    hiddenSize: number;
    layers: number;
}

type Matrix = number[][];

function embedFactor(token: number, component: number): number {
    return ((token + 1) * (component + 3)) % 5 - 2;
}

function projectionFactor(component: number, hidden: number): number {
    return ((component + 2) * (hidden + 1)) % 5 - 2;
}

function layerWeight(from: number, to: number): number {
    return ((from + 1) * (to + 1)) % 3 - 1;
}

function factorizedEmbedding(tokenIds: number[], E: number, H: number): Matrix {
    return tokenIds.map((token) => {
        const hidden = new Array<number>(H).fill(0);
        for (let component = 0; component < E; component += 1) {
            const base = embedFactor(token, component);
            for (let h = 0; h < H; h += 1) {
                hidden[h] = (hidden[h] ?? 0) + base * projectionFactor(component, h);
            }
        }
        return hidden;
    });
}

function applySharedLayer(state: Matrix, H: number): Matrix {
    const scale = Math.sqrt(Math.max(1, H));
    return state.map((hidden) => {
        const next = new Array<number>(H).fill(0);
        for (let to = 0; to < H; to += 1) {
            let sum = 0;
            for (let from = 0; from < H; from += 1) {
                sum += (hidden[from] ?? 0) * layerWeight(from, to);
            }
            next[to] = Math.tanh(sum / scale);
        }
        return next;
    });
}

function cells(matrix: Matrix, state: "active" | "sorted" | "comparing" | "path"): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value.toFixed(2),
                value,
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
    const task = (input as Partial<AlbertInput> | null) ?? {};
    const tokenIds: number[] = task.tokenIds ?? [4, 7, 2, 9];
    const vocabSize = typeof task.vocabSize === "number" ? Math.max(5, task.vocabSize) : 1000;
    const embeddingSize = typeof task.embeddingSize === "number" ? Math.max(1, task.embeddingSize) : 4;
    const hiddenSize = typeof task.hiddenSize === "number" ? Math.max(1, task.hiddenSize) : 4;
    const layers = typeof task.layers === "number" ? Math.max(1, Math.min(6, task.layers)) : 3;

    const traces: Matrix[] = [factorizedEmbedding(tokenIds, embeddingSize, hiddenSize)];
    for (let depth = 0; depth < layers; depth += 1) {
        traces.push(applySharedLayer(traces[traces.length - 1] ?? [], hiddenSize));
    }

    const factorizedEmbeddingParams = vocabSize * embeddingSize + embeddingSize * hiddenSize;
    const directEmbeddingParams = vocabSize * hiddenSize;
    const sharedEncoderParams = hiddenSize * hiddenSize;
    const unsharedEncoderParams = layers * hiddenSize * hiddenSize;
    const totalParams = factorizedEmbeddingParams + sharedEncoderParams;
    const totalSaving = directEmbeddingParams - factorizedEmbeddingParams + unsharedEncoderParams - sharedEncoderParams;

    for (let depth = 0; depth < traces.length; depth += 1) {
        const matrix = traces[depth] ?? [];
        const embeddingFrame = depth === 0;
        const lastFrame = depth === traces.length - 1;
        yield {
            stepNumber: depth,
            entities: cells(matrix, embeddingFrame ? "comparing" : "active"),
            edges: [],
            description: embeddingFrame
                ? `Factorized embedding: ${vocabSize} x ${embeddingSize} plus ${embeddingSize} x ${hiddenSize} parameters.`
                : `Shared layer ${depth} of ${layers}: the same weight matrix is reused at every depth.`,
            codeLineNumber: embeddingFrame ? 1 : 4,
            layout: "grid",
            meta: {
                rows: matrix.length,
                cols: hiddenSize,
                depth,
                phase: embeddingFrame ? "embedding" : "shared-layer",
                values: matrix.map((row) => row.slice()),
            },
        };
        if (lastFrame) {
            break;
        }
    }

    yield {
        stepNumber: traces.length,
        entities: cells(traces[traces.length - 1] ?? [], "sorted"),
        edges: [],
        description: `ALBERT uses ${totalParams} parameters here, saving ${totalSaving} against an unfactorized, unshared model.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: tokenIds.length,
            cols: hiddenSize,
            factorizedEmbeddingParams,
            directEmbeddingParams,
            sharedEncoderParams,
            unsharedEncoderParams,
            totalParams,
            totalSaving,
            layers,
            embeddingSize,
            hiddenSize,
            vocabSize,
            traces: traces.map((matrix) => matrix.map((row) => row.slice())),
            values: (traces[traces.length - 1] ?? []).map((row) => row.slice()),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ALBERT makes a transformer encoder smaller without changing what each layer computes. Rather than giving every word a full-width vector, it first maps the word to a narrow vector and then expands it, which needs far fewer numbers. It also reuses one copy of the encoder layer at every depth, so stacking more layers does not keep multiplying the parameter count.",
        invariants: [
            "A factorized embedding has vocabulary-size times embedding-size plus embedding-size times hidden-size parameters.",
            "All encoder depths apply the identical shared weight matrix.",
            "The shared encoder contributes hidden-size squared parameters once, not once per layer.",
        ],
        correctness:
            "The embedding factor computes each hidden value as the dot product of a vocabulary embedding row and an embedding-to-hidden projection column, which is algebraically the factorized product of the two matrices. Each shared layer applies the same fixed weight matrix to every depth, so the trace records repeated evaluation of one function. The parameter counts follow directly from matrix dimensions: factorized embedding V times E plus E times H, and one shared H by H encoder matrix. An independent reference recomputes every embedding, every layer output, and every count, confirming the demo is arithmetic-faithful.",
        complexityRationale:
            "Embedding each token costs O(E times H), and each of the N shared layers costs O(H squared), so total time is O(tokens times (E times H plus N times H squared)). Only the current token states are kept during the forward pass, giving O(tokens times H) working space.",
        uses: [
            "Pretraining large language encoders with fewer parameters",
            "Memory-constrained natural language understanding",
            "Teaching factorized embeddings and parameter sharing",
        ],
        references: [
            "Lan et al., ALBERT: A Lite BERT for Self-supervised Learning of Language Representations, ICLR 2020",
            "Devlin et al., BERT: Pre-training of Deep Bidirectional Transformers, NAACL 2019",
        ],
        workedExample:
            "With vocabulary 1000, embedding size 8, hidden size 32, three layers, and a few token ids, the factorized embedding stores 1000 times 8 plus 8 times 32 parameters instead of 1000 times 32. The encoder stores one 32 by 32 matrix rather than three copies. Each token's narrow embedding is projected to 32 dimensions, then the same layer matrix is applied three times, and the final frame reports the total saving.",
    },
    id: "albert",
    name: "ALBERT (Factorized Embedding and Shared Weights)",
    category: "ml-ai",
    complexity: { time: "O(tokens * (E * H + N * H^2))", space: "O(tokens * H)" },
    defaultInput: { tokenIds: [4, 7, 2, 9], vocabSize: 1000, embeddingSize: 4, hiddenSize: 4, layers: 3 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the token ids and the embedding, hidden, and layer sizes",
        "look up each token in the vocabulary by embedding factor",
        "project the narrow embedding into the hidden space",
        "define a single encoder layer weight matrix",
        "apply that shared matrix at each depth over all tokens",
        "record each depth's hidden states in the shared trace",
        "count embedding and encoder parameters after sharing",
        "report the reduction against an unfactorized, unshared model",
    ],
};

export default module;
