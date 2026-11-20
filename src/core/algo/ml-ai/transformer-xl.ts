/**
 * transformer-xl.ts - Transformer-XL Segment Recurrence
 *
 * Transformer-XL extends self-attention with a memory of hidden states from
 * the previous segment. A query in the current segment attends to keys from
 * both the cached memory and the current segment, and a learned relative
 * positional bias is added to each score based on the distance between query
 * and key. This gives the model a longer effective context without recomputing
 * the previous segment on every step.
 *
 * Time O(n * (m + n) * d), space O(n * (m + n)) for the weight matrix.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Vec { q: number[]; k: number[]; v: number[] }
interface SegmentMemory { keys: number[][]; values: number[][] }

export interface TransformerXlResult {
    weights: number[][];
    outputs: number[][];
    relativeIndices: number[][];
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function softmax(scores: number[]): number[] {
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / total);
}

/** Run segment-level attention with cached memory and relative position bias. */
export function transformerXlAttention(
    current: Vec[],
    memory: SegmentMemory,
    relativeBias: number[],
): TransformerXlResult {
    const dim = (current[0]?.q ?? []).length;
    const memKeys = memory.keys;
    const memVals = memory.values;
    const allKeys = [...memKeys, ...current.map((t) => t.k)];
    const allVals = [...memVals, ...current.map((t) => t.v)];
    const m = memKeys.length;
    const totalKeys = allKeys.length;
    const weights: number[][] = [];
    const outputs: number[][] = [];
    const relativeIndices: number[][] = [];

    for (let i = 0; i < current.length; i += 1) {
        const query = current[i]?.q ?? [];
        const scores: number[] = [];
        const rels: number[] = [];
        for (let j = 0; j < totalKeys; j += 1) {
            const distance = (m + i) - j;
            const relIndex = Math.min(relativeBias.length - 1, Math.max(0, distance));
            rels.push(relIndex);
            const bias = relativeBias[relIndex] ?? 0;
            scores.push(dot(query, allKeys[j] ?? []) / Math.sqrt(dim || 1) + bias);
        }
        const probs = softmax(scores);
        weights.push(probs);
        relativeIndices.push(rels);
        const out = new Array(dim).fill(0);
        probs.forEach((p, j) => {
            const val = allVals[j] ?? [];
            for (let d = 0; d < dim; d += 1) out[d] += p * (val[d] ?? 0);
        });
        outputs.push(out);
    }
    return { weights, outputs, relativeIndices };
}

function makeCells(result: TransformerXlResult, memoryLength: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    result.weights.forEach((row, r) => {
        row.forEach((weight, c) => {
            const isMemory = c < memoryLength;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: `${weight.toFixed(3)}`,
                value: weight,
                state: isMemory ? "visited" : "sorted",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, fromMemory: isMemory, relative: result.relativeIndices[r]?.[c] ?? 0 },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<{
        current: Vec[];
        memory: SegmentMemory;
        relativeBias: number[];
    }> | null) ?? {};
    const current: Vec[] = Array.isArray(task.current) && task.current.length > 0
        ? task.current
        : [
            { q: [1, 0], k: [1, 0.2], v: [1, 0] },
            { q: [0.2, 1], k: [0.1, 1], v: [0, 1] },
        ];
    const memory: SegmentMemory = task.memory ?? {
        keys: [[0.8, 0.4], [-0.5, 0.9]],
        values: [[2, 0], [0, 3]],
    };
    const relativeBias: number[] = Array.isArray(task.relativeBias)
        ? task.relativeBias
        : [0.1, 0.05, 0, -0.05, -0.1, -0.2];
    const result = transformerXlAttention(current, memory, relativeBias);
    const n = current.length;
    const m = memory.keys.length;
    const baseMeta = { rows: n, cols: m + n, memoryLength: m };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result, m),
        edges: [],
        description: `Attend ${n} current queries over ${m} cached memory keys plus the current segment.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, outputs: result.outputs.flat() },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result, m),
            edges: [],
            description: `Query ${i} adds relative bias by distance, then softmaxes over memory and current keys.`,
            codeLineNumber: i === 0 ? 2 : 3,
            layout: "grid",
            meta: { ...baseMeta, current: i, outputs: result.outputs.flat() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result, m),
        edges: [],
        description: "Done: each output averages memory and current values under relative-position-aware weights.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...baseMeta, outputs: result.outputs.flat(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain transformer forgets everything outside the current segment. Transformer-XL keeps a cache of the previous segment's key and value vectors and lets current queries attend to them, so information can flow across segment boundaries. Because absolute positions would be ambiguous across segments, it adds a bias that depends only on the relative distance between query and key.",
        invariants: [
            "Each query attends to every cached memory key plus every key in the current segment.",
            "The score for a key is the scaled dot product plus a bias looked up by relative distance.",
            "The weights in each row form a softmax and sum to one.",
        ],
        correctness:
            "The key and value sequence is the concatenation of memory then current, so attention covers exactly the cached and current tokens. The relative distance for key j is (memory length plus query index) minus j, clamped into the bias table, which reproduces the published relative-position scheme used here. Scores, softmax, and the weighted value average are computed directly, and the tests rebuild the same recurrence independently. The output is therefore a convex combination of memory and current values.",
        complexityRationale:
            "Each of n queries is compared with m plus n keys across d dimensions, giving O(n (m+n) d) time and O(n (m+n)) space for the displayed weights, independent of how long the cached prefix actually was.",
        uses: [
            "Language models with long documents split into segments",
            "Sequence tasks that benefit from a recurrent memory cache",
            "Relative-position attention without absolute position ids",
        ],
        references: [
            "Dai et al., Transformer-XL: Attentive Language Models Beyond a Fixed-Length Context, ACL 2019",
            "Shaw, Uszkoreit, and Vaswani, Self-Attention with Relative Position Representations, 2018",
        ],
        workedExample:
            "With two memory keys and two current queries, query zero compares against four keys. Its key at memory position one has distance (2 + 0) - 1 = 1, so it receives bias from relative index one; the softmax over all four scores yields weights that average the four values into the output.",
    },
    id: "transformer-xl",
    name: "Transformer-XL",
    category: "ml-ai",
    complexity: { time: "O(n (m+n) d)", space: "O(n (m+n))" },
    defaultInput: {
        current: [
            { q: [1, 0], k: [1, 0.2], v: [1, 0] },
            { q: [0.2, 1], k: [0.1, 1], v: [0, 1] },
        ],
        memory: { keys: [[0.8, 0.4], [-0.5, 0.9]], values: [[2, 0], [0, 3]] },
        relativeBias: [0.1, 0.05, 0, -0.05, -0.1, -0.2],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "concatenate cached memory keys and values with the current segment",
        "for each current query compute the distance to every key",
        "look up the relative bias by clamped distance",
        "add the scaled dot product and the bias to form a score",
        "softmax the scores and average the concatenated values",
        "done: report outputs and attention weights",
    ],
};

export default module;
