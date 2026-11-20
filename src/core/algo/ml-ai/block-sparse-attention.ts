/**
 * block-sparse-attention.ts - Block Sparse Attention
 *
 * This attention pattern groups tokens into fixed-size blocks and lets a query
 * see only a few chosen key blocks: its own block, the immediately preceding
 * block, and the last block as a global sink. The mask is defined at block
 * granularity rather than per token, so it can be expressed as a small set of
 * block-to-block links and applied cheaply by a tiled kernel.
 *
 * Time O(n^2) in this dense reference build, space O(n^2) for the weights.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface BlockSparseResult {
    weights: number[][];
    outputs: number[];
    allowedBlocks: number[][];
}

/** The block index of token i. */
export function blockOf(i: number, blockSize: number): number {
    return Math.floor(i / blockSize);
}

/** The key blocks a query block is allowed to attend to. */
export function allowedBlocks(queryBlock: number, numBlocks: number): number[] {
    const set = new Set<number>();
    set.add(queryBlock);
    if (queryBlock > 0) set.add(queryBlock - 1);
    if (numBlocks > 1) set.add(numBlocks - 1);
    return [...set].sort((a, b) => a - b);
}

function softmax(scores: number[]): number[] {
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const total = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / total);
}

/** Compute block-sparse scalar attention over query, key, and value vectors. */
export function blockSparseAttention(
    queries: number[],
    keys: number[],
    values: number[],
    blockSize: number,
): BlockSparseResult {
    const n = queries.length;
    const numBlocks = Math.ceil(n / blockSize);
    const weights: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    const outputs: number[] = [];
    const perBlock: number[][] = [];

    for (let qb = 0; qb < numBlocks; qb += 1) {
        perBlock[qb] = allowedBlocks(qb, numBlocks);
    }

    for (let i = 0; i < n; i += 1) {
        const qb = blockOf(i, blockSize);
        const allowedSet = new Set(perBlock[qb] ?? []);
        const indices: number[] = [];
        for (let j = 0; j < n; j += 1) {
            if (allowedSet.has(blockOf(j, blockSize))) indices.push(j);
        }
        const probs = softmax(indices.map((j) => (queries[i] ?? 0) * (keys[j] ?? 0)));
        indices.forEach((j, idx) => { weights[i][j] = probs[idx] ?? 0; });
        let out = 0;
        indices.forEach((j, idx) => { out += (probs[idx] ?? 0) * (values[j] ?? 0); });
        outputs.push(out);
    }
    return { weights, outputs, allowedBlocks: perBlock };
}

function makeCells(weights: number[][], blockSize: number, revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    weights.forEach((row, r) => {
        row.forEach((weight, c) => {
            const shown = r <= revealed;
            const state: EntityState = !shown ? "idle" : weight > 0 ? "sorted" : "unvisited";
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell",
                label: shown ? weight.toFixed(3) : "?",
                value: shown ? weight : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, queryBlock: blockOf(r, blockSize), keyBlock: blockOf(c, blockSize) },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<{ queries: number[]; keys: number[]; values: number[]; blockSize: number }> | null) ?? {};
    const queries: number[] = Array.isArray(task.queries) ? task.queries : [1, 0.5, -0.5, -1, 0.8, 0.2];
    const keys: number[] = Array.isArray(task.keys) ? task.keys : [1, 0.8, 0.5, 0.3, -0.5, -0.9];
    const values: number[] = Array.isArray(task.values) ? task.values : [2, 1, 0, -1, 3, 4];
    const n = Math.min(queries.length, keys.length, values.length);
    const q = queries.slice(0, n);
    const k = keys.slice(0, n);
    const v = values.slice(0, n);
    const blockSize = typeof task.blockSize === "number" ? Math.max(1, task.blockSize) : 2;
    const result = blockSparseAttention(q, k, v, blockSize);
    const numBlocks = Math.ceil(n / blockSize);
    const baseMeta = { rows: n, cols: n, blockSize, numBlocks };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result.weights, blockSize, -1),
        edges: [],
        description: `Split ${n} tokens into ${numBlocks} blocks of size ${blockSize} and build the sparse mask.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, outputs: result.outputs, allowedBlocks: result.allowedBlocks.map((b) => b.join(",")) },
    };
    step += 1;

    for (let b = 0; b < numBlocks; b += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result.weights, blockSize, Math.min(n - 1, b * blockSize)),
            edges: [],
            description: `Query block ${b} attends to key blocks ${(result.allowedBlocks[b] ?? []).join(", ")}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...baseMeta, currentBlock: b, outputs: result.outputs },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.weights, blockSize, n - 1),
        edges: [],
        description: "Done: each output averages only values from the allowed key blocks.",
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...baseMeta, outputs: result.outputs, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Block sparse attention trades a little flexibility for speed by deciding which keys a query may see at the level of whole blocks. A query block looks at its own block for local context, the previous block for continuity, and the final block as a global sink that lets information travel across the sequence. Only the selected block pairs are ever scored.",
        invariants: [
            "A query can attend to a key only when their block indices are in the allowed set for that query block.",
            "The unmasked weights in each row form a softmax and sum to one.",
            "Each output is a convex combination of the allowed values.",
        ],
        correctness:
            "The mask is built from the block link set, and scores are computed only for pairs whose block indices are allowed. The softmax over that permitted set gives weights that sum to one, and the output is their weighted average of values; the tests recompute the same masked attention independently and confirm that masked weights are exactly zero. Including the last block as a global sink guarantees every block has at least itself and the sink to attend to.",
        complexityRationale:
            "A dense reference materializes the n by n weight matrix, costing O(n^2) time and space. A tiled implementation only computes allowed block pairs, reducing the work to O(n^2 / blockSize * links) with a small constant number of links per block.",
        uses: [
            "Long-document language models with tiled attention kernels",
            "Sparse transformers that need a fixed predictable mask",
            "Hardware-friendly attention with block-level locality",
        ],
        references: [
            "Child et al., Generating Long Sequences with Sparse Transformers, arXiv 2019",
            "Beltagy, Peters, and Cohan, Longformer, arXiv 2020",
        ],
        workedExample:
            "With six tokens and blocks of size two there are three blocks. Query block one attends to key blocks zero, one, and two, so every query in positions two and three sees all six keys; query block zero attends only to key blocks zero and two, leaving columns two and three masked to zero.",
    },
    id: "block-sparse-attention",
    name: "Block Sparse Attention",
    category: "ml-ai",
    complexity: { time: "O(n^2) dense, O(n^2 k / blockSize) tiled", space: "O(n^2) dense" },
    defaultInput: {
        queries: [1, 0.5, -0.5, -1, 0.8, 0.2],
        keys: [1, 0.8, 0.5, 0.3, -0.5, -0.9],
        values: [2, 1, 0, -1, 3, 4],
        blockSize: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split the sequence into fixed-size blocks",
        "for each query block choose the allowed key blocks",
        "gather all keys that belong to those blocks",
        "compute scores and softmax over the gathered keys",
        "average the gathered values into the output",
        "done: report weights and outputs",
    ],
};

export default module;
