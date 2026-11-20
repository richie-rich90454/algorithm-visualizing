/**
 * gemma-3n.ts - Gemma 3n Per-Layer Embedding and AltUp Core
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gemma 3n keeps a small active model by giving every layer its own embedding
 * table instead of one shared table, so a token can be represented differently
 * at different depths. It also maintains two residual streams and updates them
 * in alternation (AltUp), and injects a rank-one low-rank residual (LAuReL) to
 * add expressive capacity cheaply. This module implements the exact scalar
 * teaching core of those three mechanisms.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(layers * d) for the rank-one residuals at width d
 *   Space: O(layers * d) for the stored per-layer streams
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the combined two-stream state after each layer.
 *   - The final frame marks the model output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GemmaInput {
    tokenId?: number;
    layers?: number;
    dim?: number;
    rankScale?: number;
}

/** Run the per-layer embedding, alternating update, and low-rank residual core. */
export function gemma3n(
    tokenId: number,
    opts: { layers?: number; dim?: number; rankScale?: number } = {},
): { embeddings: number[][]; perLayer: number[][]; output: number[] } {
    const layers = Math.max(1, opts.layers ?? 4);
    const d = Math.max(1, opts.dim ?? 4);
    const rankScale = opts.rankScale ?? 1;
    let a = new Array(d).fill(0);
    let b = new Array(d).fill(0);
    const embeddings: number[][] = [];
    const perLayer: number[][] = [a.map((v, i) => v + b[i])];

    for (let layer = 0; layer < layers; layer += 1) {
        const emb = Array.from({ length: d }, (_, i) => Math.sin((tokenId + 1) * (i + 1) + layer * 0.5));
        const u = Array.from({ length: d }, (_, i) => Math.sin(layer + i) * rankScale);
        const v = Array.from({ length: d }, (_, i) => Math.cos(layer + i));
        const dot = b.reduce((sum, value, i) => sum + value * (v[i] ?? 0), 0);
        const lowRank = u.map((value) => value * dot);

        if (layer % 2 === 0) {
            a = a.map((value, i) => value + (emb[i] ?? 0) + (lowRank[i] ?? 0));
        } else {
            const dotA = a.reduce((sum, value, i) => sum + value * (v[i] ?? 0), 0);
            b = b.map((value, i) => value + (emb[i] ?? 0) + u[i] * dotA);
        }
        embeddings.push(emb);
        perLayer.push(a.map((value, i) => value + (b[i] ?? 0)));
    }
    return { embeddings, perLayer, output: a.map((value, i) => value + (b[i] ?? 0)) };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `dim-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GemmaInput | null) ?? {};
    const tokenId = typeof task.tokenId === "number" ? Math.floor(task.tokenId) : 3;
    const layers = Math.max(1, Math.floor(task.layers ?? 4));
    const dim = Math.max(1, Math.floor(task.dim ?? 4));
    const rankScale = task.rankScale ?? 1;
    const { embeddings, perLayer, output } = gemma3n(tokenId, { layers, dim, rankScale });
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(new Array(dim).fill(0), "idle"),
        edges: [],
        description: `Token ${tokenId} enters a ${layers}-layer per-layer embedding stack of width ${dim}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", tokenId, layers, dim, rankScale },
    };
    step += 1;

    for (let layer = 0; layer < layers; layer += 1) {
        const values = perLayer[layer + 1] ?? [];
        yield {
            stepNumber: step,
            entities: bars(values, "comparing"),
            edges: [],
            description: `Layer ${layer + 1}: ${layer % 2 === 0 ? "AltUp updates stream A" : "AltUp updates stream B"} with a low-rank residual.`,
            codeLineNumber: layer % 2 === 0 ? 1 : 2,
            layout: "array",
            meta: { phase: "layer", layer: layer + 1, stream: layer % 2 === 0 ? "A" : "B", values, embedding: embeddings[layer] },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(output, "sorted"),
        edges: [],
        description: `Done: the two alternating streams combine into a width-${dim} output.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", output, perLayer, tokenId },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Most language models look up one embedding for a token and reuse it at every depth. Gemma 3n instead stores a separate embedding per layer, letting the same token mean something different early and late in the network. Two residual streams are updated in alternation, and a small rank-one term adds capacity without a large matrix. Together these keep the active model compact.",
        invariants: [
            "Each layer has its own embedding vector for the token.",
            "Even layers update stream A and odd layers update stream B.",
            "The low-rank residual is an outer product of two width-d vectors.",
        ],
        correctness:
            "The per-layer embedding is computed from a fixed deterministic formula, so it is reproducible and distinct across layers. The alternating rule touches exactly one stream per layer, leaving the other intact, which is the defining behavior of AltUp. The low-rank term is the vector u scaled by the dot product of v with the untouched stream, which is a rank-one update, and setting rankScale to zero removes it entirely. The output is the elementwise sum of the two streams.",
        complexityRationale:
            "Each layer computes a width-d embedding, a rank-one outer product requiring O(d) work after the dot product, and one stream update, so total time is O(layers * d). Storing the embedding and stream snapshots uses O(layers * d) space.",
        uses: [
            "On-device language models with a small active parameter count",
            "Teaching per-layer embeddings and alternating residual streams",
            "Low-rank residual capacity in compact architectures",
        ],
        references: [
            "Google, Gemma 3 Technical Report, 2025",
            "Baker et al., Alternating Updates for Efficient Transformers, 2024",
        ],
        workedExample:
            "With token id 3, four dimensions and four layers, layer one builds its own sine-based embedding and adds it to stream A along with a rank-one term from stream B. Layer two builds a different embedding and updates stream B instead. After all layers the combined stream is the reported output; with rankScale zero the low-rank terms vanish and only the embeddings remain.",
    },
    id: "gemma-3n",
    name: "Gemma 3n Core Mechanisms",
    category: "ml-ai",
    complexity: { time: "O(layers * d)", space: "O(layers * d)" },
    defaultInput: { tokenId: 3, layers: 4, dim: 4, rankScale: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the token id, layer count, width, and rank scale",
        "initialize two residual streams to zero",
        "for each layer build its own token embedding",
        "form a rank-one residual from the other stream",
        "on even layers add embedding and residual to stream A",
        "on odd layers add them to stream B",
        "done: report the combined two-stream output",
    ],
};

export default module;
