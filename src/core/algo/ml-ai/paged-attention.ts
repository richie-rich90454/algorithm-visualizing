/**
 * paged-attention.ts - Paged Attention over a Block-Table KV Cache
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Serving systems such as vLLM store a sequence's keys and values in fixed-size
 * blocks that need not be contiguous in memory. A block table maps each logical
 * block of the sequence to the physical block that currently holds it. Paged
 * attention gathers the key and value rows through that table, then performs the
 * ordinary scaled dot-product attention. The result is identical to dense
 * attention while allowing the cache to be allocated on demand.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^2 * d + n * d_v) for n key/value rows of dimension d
 *   Space: O(n * d) for the gathered rows plus O(n^2) for the weight matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The physical cache is shown as a grid of block rows by block-size columns.
 *   - Each logical block is highlighted while its table entry is resolved.
 *   - The attention-weight matrix is then revealed one query row at a time.
 *   - meta carries the block table, gathered keys, weights, and output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Numerically stable softmax over one row. */
export function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

/** Reconstruct logical key (or value) rows from physically scattered storage. */
export function gatherLogical(
    physical: number[][],
    table: number[],
    blockSize: number,
    logicalLength: number,
): number[][] {
    const rows: number[][] = [];
    for (let r = 0; r < logicalLength; r += 1) {
        const logicalBlock = Math.floor(r / blockSize);
        const offset = r % blockSize;
        const physicalBlock = table[logicalBlock] ?? 0;
        rows.push(physical[physicalBlock * blockSize + offset] ?? []);
    }
    return rows;
}

/** Gather paged keys and values, then compute scaled dot-product attention. */
export function pagedAttentionCompute(
    queries: number[][],
    physicalKeys: number[][],
    physicalValues: number[][],
    table: number[],
    blockSize: number,
    logicalLength: number,
) {
    const keys = gatherLogical(physicalKeys, table, blockSize, logicalLength);
    const values = gatherLogical(physicalValues, table, blockSize, logicalLength);
    const scale = Math.sqrt(keys[0]?.length ?? 1);
    const outDim = values[0]?.length ?? 0;
    const scores: number[][] = [];
    const weights: number[][] = [];
    const output: number[][] = [];
    for (const query of queries) {
        const row: number[] = [];
        for (const key of keys) {
            let dot = 0;
            for (let k = 0; k < (key.length ?? 0); k += 1) {
                dot += (query[k] ?? 0) * (key[k] ?? 0);
            }
            row.push(dot / scale);
        }
        scores.push(row);
        const w = softmax(row);
        weights.push(w);
        const outRow: number[] = [];
        for (let k = 0; k < outDim; k += 1) {
            let value = 0;
            for (let j = 0; j < values.length; j += 1) {
                value += (w[j] ?? 0) * ((values[j] ?? [])[k] ?? 0);
            }
            outRow.push(value);
        }
        output.push(outRow);
    }
    return { keys, scores, weights, output };
}

const flatten = (matrix: number[][]): number[] =>
    matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

/** The paged-attention generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            queries?: number[][];
            keys?: number[][];
            values?: number[][];
            blockSize?: number;
        } | null
    ) ?? {};
    const queries: number[][] = task.queries ?? [
        [1, 0],
        [0, 1],
    ];
    const keys: number[][] = task.keys ?? [
        [1, 0],
        [0, 1],
        [0.5, 0.5],
    ];
    const values: number[][] = task.values ?? [
        [1, 0],
        [0, 1],
        [0.5, 0.5],
    ];
    const blockSize = Math.max(1, Math.floor(task.blockSize ?? 2));
    const n = keys.length;
    const blocks = Math.ceil(n / blockSize);
    const table = Array.from({ length: blocks }, (_, i) => (blocks === 0 ? 0 : (i + 1) % blocks));
    const physicalKeys: number[][] = Array.from({ length: blocks * blockSize }, () => []);
    const physicalValues: number[][] = Array.from({ length: blocks * blockSize }, () => []);
    for (let r = 0; r < n; r += 1) {
        const logicalBlock = Math.floor(r / blockSize);
        const offset = r % blockSize;
        const physicalBlock = table[logicalBlock] ?? 0;
        physicalKeys[physicalBlock * blockSize + offset] = keys[r] ?? [];
        physicalValues[physicalBlock * blockSize + offset] = values[r] ?? [];
    }
    const inverse: number[] = [];
    for (let lb = 0; lb < blocks; lb += 1) inverse[table[lb] ?? 0] = lb;

    const result = pagedAttentionCompute(queries, physicalKeys, physicalValues, table, blockSize, n);
    const nQ = queries.length;
    const nKV = result.keys.length;

    const cacheCells = (highlightBlock: number): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        for (let idx = 0; idx < blocks * blockSize; idx += 1) {
            const physicalBlock = Math.floor(idx / blockSize);
            const offset = idx % blockSize;
            const logicalBlock = inverse[physicalBlock] ?? 0;
            const logicalRow = logicalBlock * blockSize + offset;
            const present = logicalRow < n;
            cells.push({
                id: `slot-${idx}`,
                type: "cell",
                label: present ? `L${logicalRow}` : "-",
                value: present ? physicalKeys[idx] ?? [] : [],
                state: present && physicalBlock === highlightBlock ? "active" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: physicalBlock, col: offset, physical: idx, logical: present ? logicalRow : -1 },
            });
        }
        return cells;
    };
    const weightCells = (revealed: number): VisualEntity[] => {
        const cells: VisualEntity[] = [];
        for (let r = 0; r < nQ; r += 1) {
            for (let c = 0; c < nKV; c += 1) {
                cells.push({
                    id: `w-${r}-${c}`,
                    type: "cell",
                    label: r < revealed ? (result.weights[r]?.[c] ?? 0).toFixed(2) : "?",
                    value: r < revealed ? result.weights[r]?.[c] ?? 0 : 0,
                    state: r < revealed ? "sorted" : "idle",
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: r, col: c },
                });
            }
        }
        return cells;
    };

    const baseMeta = {
        rows: blocks,
        cols: blockSize,
        n,
        blocks,
        blockSize,
        table,
        nQ,
        nKV,
    };
    let step = 0;
    yield {
        stepNumber: step,
        entities: cacheCells(-1),
        edges: [],
        description: `KV cache of ${n} rows in ${blocks} physical block(s) of size ${blockSize}; block table ${table.join(", ")}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...baseMeta, phase: "cache", gathered: flatten(result.keys) },
    };
    step += 1;

    for (let b = 0; b < blocks; b += 1) {
        const physicalBlock = table[b] ?? 0;
        yield {
            stepNumber: step,
            entities: cacheCells(physicalBlock),
            edges: [],
            description: `Logical block ${b} resolves through the table to physical block ${physicalBlock}.`,
            codeLineNumber: 1,
            layout: "grid",
            meta: { ...baseMeta, phase: "gather", currentBlock: b, physicalBlock, gathered: flatten(result.keys) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: weightCells(0),
        edges: [],
        description: "All key rows are gathered; begin scaled dot-product attention over the logical sequence.",
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...baseMeta, rows: nQ, cols: nKV, phase: "weights", weights: flatten(result.weights) },
    };
    step += 1;

    for (let i = 0; i < nQ; i += 1) {
        yield {
            stepNumber: step,
            entities: weightCells(i + 1),
            edges: [],
            description: `Query ${i}: weights ${(result.weights[i] ?? []).map((w) => w.toFixed(2)).join(", ")}.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                ...baseMeta,
                rows: nQ,
                cols: nKV,
                phase: "weights",
                weights: flatten(result.weights),
                output: flatten(result.output),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: weightCells(nQ),
        edges: [],
        description: `Done: paged attention output shape ${nQ} by ${result.output[0]?.length ?? 0} matches dense attention.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            ...baseMeta,
            rows: nQ,
            cols: nKV,
            phase: "done",
            weights: flatten(result.weights),
            output: flatten(result.output),
            gathered: flatten(result.keys),
            converged: true,
        },
    };
}

/** The paged-attention module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A serving engine cannot keep every request's key and value vectors in one long contiguous array, because generated sequences grow at different rates. Paged attention borrows virtual memory: the sequence is cut into fixed-size logical blocks, a block table points each one at a physical block, and attention simply gathers through that table. The mathematics of attention never change; only the addressing does.",
        invariants: [
            "The block table maps every logical block to exactly one physical block.",
            "Gathering keys and values through the table reproduces the contiguous sequence order.",
            "Every row of the attention-weight matrix sums to one.",
        ],
        correctness:
            "For logical row r, the physical slot is table[floor(r / blockSize)] * blockSize + (r mod blockSize), which the scatter step used to store that row, so the gather step recovers it exactly. After gathering, the scores, softmax weights, and weighted value average are the standard attention computation. Therefore paged attention produces the same output as dense attention with the same queries, keys, and values, independent of the block layout.",
        complexityRationale:
            "Gathering reads n key rows and n value rows once, O(n * d). Computing all query-key scores and the output costs O(nQ * nKV * d + nQ * nKV * d_v), which is O(n^2 * d) when query and key counts match. Storage holds the gathered rows, O(n * d), plus the weight matrix, O(n^2).",
        uses: [
            "High-throughput large-language-model serving with shared KV caches",
            "Batched decoding where sequences grow by one token at a time",
            "Memory management for long-context inference",
        ],
        references: [
            "Kwon et al., Efficient Memory Management for Large Language Model Serving with PagedAttention, SOSP 2023",
            "Vaswani et al., Attention Is All You Need, NeurIPS 2017",
        ],
        workedExample:
            "With three key rows, block size two, and table [1, 0], logical block zero lives in physical block one while logical block one lives in physical block zero. Gathering in logical order yields rows 0, 1, 2 again, so attention over the paged cache gives exactly the dense result.",
    },
    id: "paged-attention",
    name: "Paged Attention",
    category: "ml-ai",
    complexity: { time: "O(n^2 * d)", space: "O(n * d + n^2)" },
    defaultInput: {
        queries: [
            [1, 0],
            [0, 1],
        ],
        keys: [
            [1, 0],
            [0, 1],
            [0.5, 0.5],
        ],
        values: [
            [1, 0],
            [0, 1],
            [0.5, 0.5],
        ],
        blockSize: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "split the logical key/value sequence into fixed-size blocks",
        "map each logical block to a physical block via the block table",
        "gather key and value rows in logical order through the table",
        "compute scaled dot products of every query with every gathered key",
        "softmax each score row into attention weights",
        "multiply the weights by the gathered values",
        "done: report the attention output and the block table",
    ],
};

export default module;
