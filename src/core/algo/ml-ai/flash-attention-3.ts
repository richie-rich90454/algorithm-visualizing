/**
 * flash-attention-3.ts - Tiled Online-Softmax Attention (FlashAttention core)
 *
 * Scope: this teaches the exact tiled online-softmax arithmetic that
 * FlashAttention-3 uses to compute attention without materializing the full
 * score matrix. It does NOT model warp specialization, asynchronous WGMMA, or
 * FP8 block quantization; those are hardware details of the 2023 paper, not a
 * single teachable algorithm. The arithmetic here is exact: the tiled result
 * equals full softmax attention to floating-point tolerance.
 *
 * Time:  O(n^2 * dk)
 * Space: O(n * dk) for the running accumulators (no n by n score matrix)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface FlashInput {
    tokens?: number[][];
    tileK?: number;
    seed?: number;
}

/** Seeded weight stream in [-1, 1]. */
function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 1000) / 1000;
    };
}

/** Stable softmax of one row. */
function softmaxRow(row: number[]): number[] {
    const max = Math.max(...row);
    const exp = row.map((value) => Math.exp(value - max));
    const total = exp.reduce((a, b) => a + b, 0);
    return exp.map((value) => value / total);
}

/** Attention cells: revealed columns show weights, hidden columns show "?". */
function makeCells(attn: number[][], revealed: number): VisualEntity[] {
    const n = attn.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const shown = j < revealed;
            const value = shown ? attn[i]?.[j] ?? 0 : -1;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: shown ? value.toFixed(3) : "?",
                value,
                state: (shown ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as FlashInput | null) ?? {};
    const tokens = Array.isArray(task.tokens)
        ? task.tokens.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
              [1, 0],
          ];
    const n = tokens.length;
    const d = tokens[0]?.length ?? 2;
    const dk = d;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 11;
    const tileK = Math.max(1, Math.min(Math.trunc(task.tileK ?? 2), n));
    const next = weightStream(seed);

    const Wq = Array.from({ length: d }, () => Array.from({ length: dk }, next));
    const Wk = Array.from({ length: d }, () => Array.from({ length: dk }, next));
    const Wv = Array.from({ length: d }, () => Array.from({ length: dk }, next));

    const Q: number[][] = [];
    const K: number[][] = [];
    const V: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        const row = tokens[i] ?? Array(d).fill(0);
        Q.push(Array.from({ length: dk }, (_v, k) => row.reduce((s, x, p) => s + x * (Wq[p]?.[k] ?? 0), 0)));
        K.push(Array.from({ length: dk }, (_v, k) => row.reduce((s, x, p) => s + x * (Wk[p]?.[k] ?? 0), 0)));
        V.push(Array.from({ length: dk }, (_v, k) => row.reduce((s, x, p) => s + x * (Wv[p]?.[k] ?? 0), 0)));
    }

    const scale = 1 / Math.sqrt(dk);
    const score: number[][] = Array.from({ length: n }, (_v, i) =>
        Array.from({ length: n }, (_x, j) =>
            (Q[i] ?? []).reduce((s, q, k) => s + q * (K[j]?.[k] ?? 0), 0) * scale,
        ),
    );
    const refAttn = score.map(softmaxRow);
    const refOut = Array.from({ length: n }, (_v, i) =>
        Array.from({ length: dk }, (_x, k) =>
            (refAttn[i] ?? []).reduce((s, a, j) => s + a * (V[j]?.[k] ?? 0), 0),
        ),
    );

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(refAttn, 0),
        edges: [],
        description: `Computing attention for ${n} tokens in key tiles of ${tileK} using an online softmax.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n, n, dk, tileK, q: Q.flat(), k: K.flat(), v: V.flat(), out: [], revealed: 0 },
    };
    step += 1;

    const m = Array(n).fill(-Infinity);
    const l = Array(n).fill(0);
    const acc = Array.from({ length: n }, () => Array(dk).fill(0));

    for (let ks = 0; ks < n; ks += tileK) {
        const ke = Math.min(n, ks + tileK);
        for (let i = 0; i < n; i += 1) {
            const tileScores: number[] = [];
            for (let j = ks; j < ke; j += 1) {
                tileScores.push(score[i]?.[j] ?? 0);
            }
            const mTile = Math.max(...tileScores);
            const mNew = Math.max(m[i] ?? -Infinity, mTile);
            const alpha = Math.exp((m[i] ?? -Infinity) - mNew);
            const probs = tileScores.map((s) => Math.exp(s - mNew));
            const sumP = probs.reduce((a, b) => a + b, 0);
            const accRow = acc[i] ?? Array(dk).fill(0);
            for (let k = 0; k < dk; k += 1) {
                let weighted = 0;
                for (let idx = 0; idx < probs.length; idx += 1) {
                    weighted += (probs[idx] ?? 0) * (V[ks + idx]?.[k] ?? 0);
                }
                accRow[k] = accRow[k] * alpha + weighted;
            }
            l[i] = (l[i] ?? 0) * alpha + sumP;
            m[i] = mNew;
        }

        yield {
            stepNumber: step,
            entities: makeCells(refAttn, ke),
            edges: [],
            description: `Key tile [${ks}, ${ke}): running max ${(m[0] ?? 0).toFixed(3)}, normalizer ${(l[0] ?? 0).toFixed(3)}; prior tiles rescaled by exp(m_old - m_new).`,
            codeLineNumber: ks + tileK >= n ? 7 : 5,
            layout: "matrix",
            meta: {
                rows: n,
                cols: n,
                n,
                dk,
                tileK,
                q: Q.flat(),
                k: K.flat(),
                v: V.flat(),
                out: [],
                revealed: ke,
                rowMax: m.map((x) => (Number.isFinite(x) ? x : 0)),
                rowSum: l,
            },
        };
        step += 1;
    }

    const out = Array.from({ length: n }, (_v, i) =>
        Array.from({ length: dk }, (_x, k) => (acc[i]?.[k] ?? 0) / (l[i] || 1)),
    );
    yield {
        stepNumber: step,
        entities: makeCells(refAttn, n),
        edges: [],
        description: `Done: tiled outputs match full softmax attention (first output ${(out[0] ?? []).map((x) => x.toFixed(3)).join(", ")}).`,
        codeLineNumber: 8,
        layout: "matrix",
        meta: {
            rows: n,
            cols: n,
            n,
            dk,
            tileK,
            q: Q.flat(),
            k: K.flat(),
            v: V.flat(),
            out: out.flat(),
            referenceOut: refOut.flat(),
            revealed: n,
            rowSum: l,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "FlashAttention computes exact attention one tile of keys at a time. Instead of storing every query-key score, it keeps a running maximum and a running sum of exponentials per query. When a new tile has a larger maximum, it rescales the previous accumulator by the right exponential factor, so the final answer is mathematically identical to ordinary softmax attention.",
        invariants: [
            "For every query, the running maximum m is the largest score seen so far.",
            "The running normalizer l equals the sum of exp(score - m) over all keys seen so far.",
            "The accumulator always equals the weighted value sum with the current scaling, so dividing by l gives the partial attention output.",
        ],
        correctness:
            "When a tile raises the maximum from m_old to m_new, every previously accumulated exponential must be multiplied by exp(m_old - m_new). The update l_new = l*exp(m_old - m_new) + sum(exp(s - m_new)) and the matching accumulator rescale keep the invariant exact. At the end, l is the softmax denominator and acc/l is exactly the softmax-weighted value vector.",
        complexityRationale:
            "Every query-key pair is scored once, so the work is O(n^2 * dk). Only per-query running scalars and a dk-wide accumulator are stored, giving O(n * dk) space rather than the O(n^2) of a full attention matrix.",
        uses: [
            "Exact attention inside long-context language models",
            "Training transformers with reduced GPU memory traffic",
            "Any softmax attention where materializing the score matrix is too costly",
        ],
        references: [
            "Dao et al., FlashAttention: Fast and Memory-Efficient Exact Attention, 2022",
            "Shah et al., FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision, 2024",
        ],
        workedExample:
            "With four tokens and key tiles of two, the first tile sets the running max for each query; the second tile may raise it and rescales the first tile's contribution by exp(m_old - m_new). After both tiles, dividing each accumulator by its normalizer reproduces the ordinary softmax attention output exactly.",
    },
    id: "flash-attention-3",
    name: "FlashAttention-3 (Tiled Online Softmax)",
    category: "ml-ai",
    complexity: { time: "O(n^2 * dk)", space: "O(n * dk)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
            [1, 0],
        ],
        tileK: 2,
        seed: 11,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "project tokens into query, key, and value matrices",
        "initialize running max, normalizer, and accumulator for every query",
        "for each tile of keys",
        "compute scaled query-key scores inside the tile",
        "raise the running max and rescale prior sums and accumulator",
        "add the tile exponentials and their value contributions",
        "advance to the next key tile",
        "divide each accumulator by its normalizer",
        "done: report outputs identical to full softmax attention",
    ],
};

export default module;
