/**
 * flash-attention-2.ts - Tiled Online Softmax Attention (FlashAttention Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * FlashAttention-2 avoids ever materializing the full n by n attention matrix
 * in fast memory. It streams the keys and values in tiles and keeps a running
 * softmax for each query row: a running maximum m, a running denominator l,
 * and a running output accumulator o. When a new tile has a larger row maximum,
 * the previous accumulator is rescaled by exp(m_old - m_new) before the tile is
 * added. This is mathematically identical to ordinary softmax attention but
 * uses only linear extra memory. This module implements that exact online
 * softmax computation; it is the teachable arithmetic core of FlashAttention,
 * not the fused CUDA kernel itself.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n^2 * d) to score every query-key pair
 *   Space: O(n * d) for Q, K, V and the accumulators (no n by n matrix kept)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the n by n query-key score matrix, revealed tile by tile.
 *   - The current tile is highlighted; the final frame reports the output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AttentionInput {
    Q?: number[][];
    K?: number[][];
    V?: number[][];
    block?: number;
}

type Vec = number[];

/** Dot product of two equal-length vectors. */
function dot(a: Vec, b: Vec): number {
    let total = 0;
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
}

/** Deterministic fallback Q, K, V when the caller supplies none. */
function fallback(): { Q: number[][]; K: number[][]; V: number[][] } {
    return {
        Q: [[1, 0], [0, 1], [1, 1], [1, -1]],
        K: [[1, 0.5], [0.5, 1], [1, 1], [-0.5, 1]],
        V: [[1, 0], [0, 1], [1, 1], [0.5, -0.5]],
    };
}

/** One cell per score entry; a cell is shown only once its tile has arrived. */
function makeCells(scores: number[][], revealedColumns: number, activeColumns: Set<number>): VisualEntity[] {
    const n = scores.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const shown = j < revealedColumns;
            const active = activeColumns.has(j);
            const state: EntityState = active ? "highlight" : shown ? "comparing" : "idle";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: shown ? (scores[i]?.[j] ?? 0).toFixed(2) : "?",
                value: shown ? (scores[i]?.[j] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, revealed: shown },
            });
        }
    }
    return entities;
}

/** Run tiled online softmax attention and emit one frame per key tile. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AttentionInput | null) ?? {};
    const base = fallback();
    const Q: number[][] = Array.isArray(task.Q) && task.Q.length > 0 ? task.Q.map((r) => [...r]) : base.Q;
    const K: number[][] = Array.isArray(task.K) && task.K.length > 0 ? task.K.map((r) => [...r]) : base.K;
    const V: number[][] = Array.isArray(task.V) && task.V.length > 0 ? task.V.map((r) => [...r]) : base.V;
    const block = Math.max(1, Math.min(typeof task.block === "number" ? Math.trunc(task.block) : 2, K.length));
    const n = Q.length;
    const d = K[0]?.length ?? 1;
    const dv = V[0]?.length ?? 1;
    const scale = Math.sqrt(d);

    const scores: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        scores.push(Array.from({ length: K.length }, (_v, j) => dot(Q[i] ?? [], K[j] ?? []) / scale));
    }

    const m = new Array<number>(n).fill(-Infinity);
    const l = new Array<number>(n).fill(0);
    const o: number[][] = Array.from({ length: n }, () => new Array<number>(dv).fill(0));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(scores, 0, new Set()),
        edges: [],
        description: `Streaming ${K.length} keys in tiles of ${block} with an online softmax; no full attention matrix is stored.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: K.length, block, tile: 0, m: m.map(() => 0), l: l.slice(), output: [] },
    };
    step += 1;

    for (let j0 = 0; j0 < K.length; j0 += block) {
        const j1 = Math.min(j0 + block, K.length);
        for (let i = 0; i < n; i += 1) {
            let tileMax = -Infinity;
            for (let j = j0; j < j1; j += 1) {
                tileMax = Math.max(tileMax, scores[i]?.[j] ?? -Infinity);
            }
            const mNew = Math.max(m[i] ?? -Infinity, tileMax);
            const alpha = Math.exp((m[i] ?? -Infinity) - mNew);
            let psum = 0;
            const nextO = new Array<number>(dv).fill(0);
            for (let j = j0; j < j1; j += 1) {
                const p = Math.exp((scores[i]?.[j] ?? 0) - mNew);
                psum += p;
                const vj = V[j] ?? [];
                for (let k = 0; k < dv; k += 1) {
                    nextO[k] = (nextO[k] ?? 0) + p * (vj[k] ?? 0);
                }
            }
            m[i] = mNew;
            l[i] = alpha * (l[i] ?? 0) + psum;
            for (let k = 0; k < dv; k += 1) {
                o[i]![k] = alpha * (o[i]?.[k] ?? 0) + (nextO[k] ?? 0);
            }
        }
        const active = new Set<number>();
        for (let j = j0; j < j1; j += 1) {
            active.add(j);
        }
        yield {
            stepNumber: step,
            entities: makeCells(scores, j1, active),
            edges: [],
            description: `Tile columns ${j0}-${j1 - 1}: rescale the accumulator by exp(m_old - m_new), then add this tile's weighted values.`,
            codeLineNumber: j1 >= K.length ? 7 : 5,
            layout: "matrix",
            meta: {
                rows: n,
                cols: K.length,
                block,
                tile: j1,
                m: m.map((v) => (Number.isFinite(v) ? Number(v.toFixed(6)) : 0)),
                l: l.map((v) => Number(v.toFixed(6))),
                output: [],
            },
        };
        step += 1;
    }

    const output = o.map((row, i) => row.map((value) => Number((value / (l[i] ?? 1)).toFixed(9))));
    yield {
        stepNumber: step,
        entities: makeCells(scores, K.length, new Set()),
        edges: [],
        description: `Done: divide each accumulator by its row sum to recover the exact softmax attention output.`,
        codeLineNumber: 7,
        layout: "matrix",
        meta: {
            rows: n,
            cols: K.length,
            block,
            tile: K.length,
            m: m.map((v) => Number(v.toFixed(6))),
            l: l.map((v) => Number(v.toFixed(6))),
            output: output.flat(),
            outputWidth: dv,
        },
    };
}

/** The FlashAttention online-softmax module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Softmax attention needs the maximum score of a row before it can normalize, which normally forces you to hold the whole score matrix. FlashAttention streams keys in tiles and tracks a running maximum and denominator. When a larger maximum appears, it multiplies the accumulated output by a correction factor, so the final answer is the same as if you had seen everything at once.",
        invariants: [
            "After each tile, l holds the sum of exp(score minus m) over all keys seen so far.",
            "The accumulator o is always exp(m_old - m_new) rescaled before a new tile is added.",
            "Dividing the final accumulator by l gives the ordinary softmax-weighted sum of values.",
        ],
        correctness:
            "For a row, let m_t and l_t be the running maximum and sum after t tiles and o_t the rescaled accumulator. The update sets l_new = exp(m_old - m_new) l_old plus the new tile's exponentials and o_new likewise. By induction exp(m_t) l_t equals the true sum of exp(score) over seen keys and exp(m_t) o_t equals the true weighted value sum, so o_t / l_t equals the exact softmax output. The final frame therefore matches naive attention to floating-point precision.",
        complexityRationale:
            "Scoring each of the n query-key pairs costs O(d) and each tile update is linear in the tile size, giving O(n squared times d) time. Keeping only Q, K, V, m, l, and o uses O(n times d) extra space instead of the O(n squared) attention matrix.",
        uses: [
            "Memory-efficient training and inference of long-context transformers",
            "Exact attention on GPUs with limited high-bandwidth memory",
            "The attention kernel inside modern large language model serving stacks",
        ],
        references: [
            "Dao et al., FlashAttention: Fast and Memory-Exact Exact Attention, 2022",
            "Dao, FlashAttention-2: Faster Attention with Better Parallelism, 2023",
        ],
        workedExample:
            "With four queries, four keys and a tile size of two, the first tile sets m to the larger of the two scores in columns zero and one. When the second tile contains a higher score, every accumulated value is multiplied by exp(m_old - m_new) before the new weighted values are added. Dividing the final accumulator by l reproduces the row of a full softmax computed in one shot.",
    },
    id: "flash-attention-2",
    name: "FlashAttention-2 (Tiled Online Softmax)",
    category: "ml-ai",
    complexity: { time: "O(n^2 * d)", space: "O(n * d)" },
    defaultInput: {
        Q: [[1, 0], [0, 1], [1, 1], [1, -1]],
        K: [[1, 0.5], [0.5, 1], [1, 1], [-0.5, 1]],
        V: [[1, 0], [0, 1], [1, 1], [0.5, -0.5]],
        block: 2,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "scale queries and keys by one over square root of key dimension",
        "initialize row maximum m to minus infinity, row sum l to zero, output o to zero",
        "for each tile of keys and values",
        "compute tile scores and the new row maximum m_new",
        "rescale o and l by exp(m_old minus m_new)",
        "add exp(score minus m_new) times each value to o and to l",
        "after all tiles divide o by l to get the attention output",
        "done: report the exact softmax output",
    ],
};

export default module;
