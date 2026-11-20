/**
 * flash-decoding.ts - Flash Decoding (Split-KV Merge Core)
 *
 * TEACHING MODEL, NOT A PRODUCTION KERNEL. Flash decoding splits a query's
 * attention over many key/value blocks, computes a local softmax summary for
 * each block, and then merges the summaries with the exact log-sum-exp merge
 * rule. This module implements that merge step on a tiny desktop example so
 * the mathematics can be followed by hand.
 *
 * Complexity (teaching instance):
 *   Time:  O(n * d) for n keys of dimension d plus O(block count) to merge
 *   Space: O(n + block count) for the partial summaries
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function fmt(value: number): string {
    return String(Math.round(value * 1000) / 1000);
}

/** Build a rectangular grid; rows at or past `revealed` are hidden. */
function makeCells(matrix: Cell[][], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = row >= revealed || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : row === current
                  ? "active"
                  : "sorted";
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

function dot(a: number[], b: number[]): number {
    return a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
}

/** Exact merge of per-block softmax summaries against a reference full softmax. */
function compute(
    query: number[],
    keys: number[][],
    values: number[][],
    blockSize: number,
) {
    const d = Math.max(1, query.length);
    const scale = Math.sqrt(d);
    const scores = keys.map((key) => dot(query, key) / scale);
    const dv = values[0]?.length ?? 1;
    const blockCount = Math.ceil(scores.length / blockSize);
    const blockMax: number[] = [];
    const blockSum: number[] = [];
    const blockOut: number[][] = [];
    for (let b = 0; b < blockCount; b += 1) {
        const members = [];
        for (let j = b * blockSize; j < Math.min((b + 1) * blockSize, scores.length); j += 1) {
            members.push(j);
        }
        const m = Math.max(...members.map((j) => scores[j] ?? 0));
        const exps = members.map((j) => Math.exp((scores[j] ?? 0) - m));
        const l = exps.reduce((sum, value) => sum + value, 0);
        const out: number[] = [];
        for (let k = 0; k < dv; k += 1) {
            let acc = 0;
            members.forEach((j, idx) => {
                acc += (exps[idx] ?? 0) * (values[j]?.[k] ?? 0);
            });
            out.push(acc / l);
        }
        blockMax.push(m);
        blockSum.push(l);
        blockOut.push(out);
    }
    const M = Math.max(...blockMax, -Infinity);
    let L = 0;
    const merged: number[] = Array.from({ length: dv }, () => 0);
    blockMax.forEach((m, b) => {
        const factor = Math.exp(m - M) * (blockSum[b] ?? 0);
        L += factor;
        const out = blockOut[b] ?? [];
        for (let k = 0; k < dv; k += 1) {
            merged[k] = (merged[k] ?? 0) + factor * (out[k] ?? 0);
        }
    });
    for (let k = 0; k < dv; k += 1) {
        merged[k] = (merged[k] ?? 0) / L;
    }
    return { scores, blockCount, blockMax, blockSum, merged, dv };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            query?: number[];
            keys?: number[][];
            values?: number[][];
            blockSize?: number;
        } | null
    ) ?? {};
    const query = task.query?.length ? task.query : [1, 0.5];
    const keys = task.keys?.length
        ? task.keys
        : [
              [1, 0],
              [0, 1],
              [-1, 0.5],
              [0.5, -0.5],
              [1, 1],
              [-0.5, 1],
          ];
    const values = task.values?.length
        ? task.values
        : [
              [1, 0],
              [0, 1],
              [0, 1],
              [1, 0],
              [0.5, 0.5],
              [1, 1],
          ];
    const blockSize = Math.max(1, Math.floor(task.blockSize ?? 3));
    const result = compute(query, keys, values, blockSize);
    const n = result.scores.length;
    const width = Math.max(n, 1);
    const d = query.length;
    const M = Math.max(...result.blockMax, -Infinity);

    const row0: Cell[] = result.scores.slice(0, width);
    const row1: Cell[] = result.scores.map((_, j) => Math.floor(j / blockSize));
    const row2: Cell[] = result.scores.map((_, j) => result.blockMax[Math.floor(j / blockSize)] ?? 0);
    const row3: Cell[] = result.scores.map((_, j) => result.blockSum[Math.floor(j / blockSize)] ?? 0);
    const totalWeight = result.scores.reduce((sum, score) => sum + Math.exp(score - M), 0) || 1;
    const row4: Cell[] = result.scores.map((score) => Math.exp(score - M) / totalWeight);
    const row5: Cell[] = Array.from({ length: width }, (_, j) =>
        j < result.dv ? (result.merged[j] ?? 0) : null,
    );
    const matrix: Cell[][] = [row0, row1, row2, row3, row4, row5];
    const base = { rows: 6, cols: width, numKeys: n, blockSize, numBlocks: result.blockCount, keyDim: d, valueDim: result.dv };

    const captions = [
        "Split the keys into contiguous blocks; each block gets its own local softmax.",
        `Scaled scores for all ${n} key(s) are computed with query dot key over sqrt(${d}).`,
        `Keys are assigned to ${result.blockCount} block(s) of size ${blockSize}.`,
        "Each block records its own maximum score (local m).",
        "Each block records its local exponent sum (local l) and weighted value sum.",
        "Merge the block summaries using exp(m_b - M) * l_b to form global weights.",
        `The merged output is [${result.merged.map(fmt).join(", ")}].`,
    ];
    const lines = [0, 1, 2, 3, 4, 5, 6];
    for (let frame = 0; frame < captions.length; frame += 1) {
        yield {
            stepNumber: frame,
            entities: makeCells(matrix, frame, frame - 1),
            edges: [],
            description: captions[frame] ?? "",
            codeLineNumber: lines[frame] ?? 0,
            layout: "grid",
            meta: {
                ...base,
                phase: frame === 0 ? "setup" : frame < 6 ? "partial" : "merged",
                mergedOutput: result.merged.slice(0, 12).map(fmt),
                blockMax: result.blockMax.map(fmt).slice(0, 12),
            },
        };
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single query attending over a very long key sequence cannot fit its score matrix in fast memory. Flash decoding splits the keys into blocks, computes a small local softmax summary for each block, and then combines those summaries. The combination is an exact algebraic rewrite of one global softmax, not an approximation.",
        invariants: [
            "Each block stores a local maximum m, a local exponent sum l, and a locally weighted value sum.",
            "The global maximum M is the largest of the block maxima.",
            "The weight of a block in the merge is exp(m minus M) times its local sum l.",
        ],
        correctness:
            "For a block, exp(score minus m) equals exp(score minus M) times exp(m minus M), so the local numerator and denominator factor out cleanly. Summing the factored numerators and denominators over all blocks gives exactly the global softmax output. The merge therefore returns the same result as materializing every score at once.",
        complexityRationale:
            "Computing the local summaries touches each of the n keys once with d-dimensional dot products, so the work is O(n times d) plus O(block count) for the merge. Only the per-block summaries are retained, giving O(n plus block count) space for this teaching instance.",
        uses: [
            "Long-context inference where attention must be split across many key blocks",
            "Batched generation with a very large key-value cache",
            "A teaching model of the online softmax merge used by FlashAttention",
        ],
        references: [
            "Dao, FlashAttention: Fast and Memory-Efficient Exact Attention, 2022",
            "Dao et al., FlashDecoding: Faster Long-Context Inference, 2023",
        ],
        workedExample:
            "With two blocks whose local maxima are 1.0 and 1.4 and local sums are 2.1 and 2.6, the global maximum is 1.4. The first block is weighted by exp(1.0 minus 1.4) times 2.1 and the second by 2.6, and their weighted value sums are added and divided by the total weight.",
    },
    id: "flash-decoding",
    name: "Flash Decoding (Split-KV Merge Core)",
    category: "ml-ai",
    complexity: { time: "O(n * d)", space: "O(n + blocks)" },
    defaultInput: {
        query: [1, 0.5],
        keys: [
            [1, 0],
            [0, 1],
            [-1, 0.5],
            [0.5, -0.5],
            [1, 1],
            [-0.5, 1],
        ],
        values: [
            [1, 0],
            [0, 1],
            [0, 1],
            [1, 0],
            [0.5, 0.5],
            [1, 1],
        ],
        blockSize: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "partition the keys and values into contiguous blocks",
        "compute the scaled dot-product score for every key",
        "assign each key to its block",
        "for each block find its maximum score m",
        "compute the local exponent sum l and weighted value sum",
        "find the global maximum M and weight each block by exp(m - M) * l",
        "done: divide the weighted value sums by their total weight",
    ],
};

export default module;
