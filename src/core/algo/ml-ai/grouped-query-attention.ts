/**
 * grouped-query-attention.ts - Grouped-Query Attention (Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Grouped-query attention keeps several query heads but shares one key/value
 * head across each group of query heads. Query head h uses key/value head
 * floor(h * G / H), where H is the number of query heads and G the number of
 * key/value heads. Every score, softmax, and weighted value sum is computed
 * exactly on a tiny input with deterministic weights. G = H reduces to
 * ordinary multi-head attention and G = 1 reduces to multi-query attention.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(H * n^2 * dk) for n tokens and key dimension dk
 *   Space: O(n^2) for one attention map at a time
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows one query head's n by n softmax attention map.
 *   - The header reports which shared key/value head the query head uses.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GqaInput {
    tokens?: number[][];
    qHeads?: number;
    kvHeads?: number;
    dk?: number;
    seed?: number;
}

/** Seeded generator producing weights in [-1, 1] rounded to two decimals. */
function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

function cells(matrix: number[][], active: boolean): VisualEntity[] {
    const n = matrix.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const value = active ? (matrix[i]?.[j] ?? 0) : -1;
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: active ? value.toFixed(3) : "?",
                value: active ? value : -1,
                state: active ? ("comparing" as const) : ("unvisited" as const),
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
    const task = (input as GqaInput | null) ?? {};
    const tokens = Array.isArray(task.tokens) && task.tokens.length > 0
        ? task.tokens.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
          ];
    const n = tokens.length;
    const dModel = tokens[0]?.length ?? 2;
    const H = Math.max(1, typeof task.qHeads === "number" ? Math.trunc(task.qHeads) : 4);
    let G = Math.max(1, typeof task.kvHeads === "number" ? Math.trunc(task.kvHeads) : 2);
    G = Math.min(G, H);
    const dk = Math.max(1, typeof task.dk === "number" ? Math.trunc(task.dk) : 2);
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 11;
    const next = weightStream(seed);

    const Wk: number[][][] = [];
    const Wv: number[][][] = [];
    const Wq: number[][][] = [];
    for (let g = 0; g < G; g += 1) {
        Wk.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, next)));
        Wv.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, next)));
    }
    for (let h = 0; h < H; h += 1) {
        Wq.push(Array.from({ length: dModel }, () => Array.from({ length: dk }, next)));
    }
    const weights = { Wq, Wk, Wv };

    const project = (w: number[][]): number[][] =>
        tokens.map((row) => Array.from({ length: dk }, (_v, k) => row.reduce((s, x, d) => s + x * (w[d]?.[k] ?? 0), 0)));
    const K: number[][][] = [];
    const V: number[][][] = [];
    for (let g = 0; g < G; g += 1) {
        K.push(project(Wk[g] ?? []));
        V.push(project(Wv[g] ?? []));
    }
    const Q: number[][][] = [];
    for (let h = 0; h < H; h += 1) {
        Q.push(project(Wq[h] ?? []));
    }

    const scale = Math.sqrt(dk);
    const maps: Array<{ head: number; kvHead: number; attention: number[][]; rowSums: number[]; output: number[][] }> = [];
    for (let h = 0; h < H; h += 1) {
        const g = Math.floor((h * G) / H);
        const kHead = K[g] ?? [];
        const vHead = V[g] ?? [];
        const qHead = Q[h] ?? [];
        const scores = qHead.map((q) =>
            kHead.map((k) => q.reduce((s, qv, idx) => s + qv * (k[idx] ?? 0), 0) / scale),
        );
        const attention = scores.map((row) => {
            const max = Math.max(...row);
            const exp = row.map((s) => Math.exp(s - max));
            const denom = exp.reduce((a, b) => a + b, 0);
            return exp.map((e) => e / denom);
        });
        const rowSums = attention.map((row) => row.reduce((a, b) => a + b, 0));
        const output = qHead.map((_q, i) =>
            Array.from({ length: dk }, (_unused, k) =>
                (attention[i] ?? []).reduce((s, a, j) => s + a * (vHead[j]?.[k] ?? 0), 0),
            ),
        );
        maps.push({ head: h, kvHead: g, attention, rowSums, output });
    }

    const base = { rows: n, cols: n, n, H, G, dk, weights: JSON.stringify(weights) };
    yield {
        stepNumber: 0,
        entities: cells(Array.from({ length: n }, () => Array(n).fill(0)), false),
        edges: [],
        description: `Preparing ${H} query heads sharing ${G} key/value heads over ${n} tokens.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...base, phase: "setup", head: -1, kvHead: -1, attention: [], rowSums: [] },
    };

    let step = 1;
    for (const m of maps) {
        yield {
            stepNumber: step,
            entities: cells(m.attention, true),
            edges: [],
            description: `Query head ${m.head} reads shared key/value head ${m.kvHead}; its softmax rows sum to ${m.rowSums.map((s) => s.toFixed(3)).join(", ")}.`,
            codeLineNumber: m.head === H - 1 ? 6 : 4,
            layout: "matrix",
            meta: {
                ...base,
                phase: "attention",
                head: m.head,
                kvHead: m.kvHead,
                attention: m.attention.flat(),
                rowSums: m.rowSums,
                output: m.output.flat(),
            },
        };
        step += 1;
    }

    const last = maps[maps.length - 1];
    yield {
        stepNumber: step,
        entities: cells(last?.attention ?? [], true),
        edges: [],
        description: `Done: ${H} query heads share ${G} key/value heads; each output head is a weighted sum over values.`,
        codeLineNumber: 7,
        layout: "matrix",
        meta: {
            ...base,
            phase: "done",
            head: last?.head ?? -1,
            kvHead: last?.kvHead ?? -1,
            attention: (last?.attention ?? []).flat(),
            rowSums: last?.rowSums ?? [],
            output: (last?.output ?? []).flat(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Full multi-head attention gives every head its own key and value projections, which costs a lot of memory for the key/value cache during generation. Grouped-query attention keeps all the query heads but lets groups of them share a single key/value head. A query head still attends normally; it simply reads keys and values from its assigned shared head.",
        invariants: [
            "Query head h uses key/value head floor(h times G divided by H).",
            "Each attention row is a softmax, so its weights are nonnegative and sum to one.",
            "Setting the number of key/value heads equal to the query heads recovers multi-head attention; setting it to one recovers multi-query attention.",
        ],
        correctness:
            "For each query head the module computes Q, then reads the shared K and V of its group, forms scaled dot-product scores, and applies softmax row by row. Because the softmax denominator sums over all keys for that query, each row sums to one and the head output is the exact weighted sum of the shared value vectors. The group index formula assigns every query head to exactly one key/value head, so the shared-head mapping is deterministic and complete.",
        complexityRationale:
            "Each of the H query heads builds an n by n score matrix requiring O(n squared times dk) operations, so the total is O(H n squared dk). Only one attention map is materialized per frame, giving O(n squared) working space plus the fixed projections.",
        uses: [
            "Large language models with a smaller key/value cache for fast generation",
            "Long-context inference where memory bandwidth dominates",
            "Serving many concurrent requests with limited GPU memory",
        ],
        references: [
            "Ainslie et al., GQA: Training Generalized Multi-Query Transformer Models, 2023",
            "Shazeer, Fast Transformer Decoding: One Write-Head is All You Need, 2019",
        ],
        workedExample:
            "With four query heads, two key/value heads, and three tokens, heads 0 and 1 share key/value head 0 while heads 2 and 3 share head 1. Head 1 still builds a three-by-three softmax map; a row such as (0.6, 0.3, 0.1) means it takes 60 percent of its value from the first token and the rest from the other two.",
    },
    id: "grouped-query-attention",
    name: "Grouped-Query Attention (Teachable Core)",
    category: "ml-ai",
    complexity: { time: "O(H * n^2 * dk)", space: "O(n^2)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
        ],
        qHeads: 4,
        kvHeads: 2,
        dk: 2,
        seed: 11,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "build Wq for every query head and Wk, Wv for every key/value head",
        "project tokens into queries, keys, and values",
        "for each query head find its shared key/value head index",
        "score every query against every shared key and scale by square root of dk",
        "softmax each score row to get attention weights",
        "multiply the weights by the shared values to get the head output",
        "move to the next query head",
        "done: report all head outputs and attention maps",
    ],
};

export default module;
