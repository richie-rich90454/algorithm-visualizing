/**
 * big-bird-attention.ts - Big Bird Sparse Attention Pattern
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Big Bird keeps attention sparse by letting each query see only three kinds
 * of keys: a fixed set of global tokens, a short local window around the
 * query, and a few deterministically chosen random tokens. Global tokens act
 * as information hubs, the window captures local structure, and the random
 * links give the graph good connectivity with only O(n) edges per query.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * (g + w + r) * d) for n tokens, globals g, window w, random r
 *   Space: O(n * (g + w + r)) for the sparse attention weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The n by n attention grid shows the sparse mask; masked cells stay zero.
 *   - Global, local, and random connections are distinguished in metadata.
 */

import type { EntityState, VisualEntity, VisualFrame, AlgorithmModule } from "@/types";

interface BigBirdInput {
    queries?: number[][];
    keys?: number[][];
    values?: number[][];
    globalTokens?: number;
    window?: number;
    randomTokens?: number;
    seed?: number;
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

/** The sorted set of key positions that query i is allowed to attend to. */
export function allowedPositions(
    i: number,
    n: number,
    globals: number,
    window: number,
    random: number,
    seed: number,
): number[] {
    const set = new Set<number>();
    for (let g = 0; g < globals && g < n; g += 1) {
        set.add(g);
        set.add(n - 1 - g);
    }
    for (let offset = -window; offset <= window; offset += 1) {
        const j = i + offset;
        if (j >= 0 && j < n) {
            set.add(j);
        }
    }
    for (let t = 0; t < random; t += 1) {
        set.add(((i + 1) * 31 + (t + 1) * 17 + seed) % n);
    }
    return [...set].sort((a, b) => a - b);
}

/** Sparse Big Bird attention over the union of global, local, and random keys. */
export function bigBirdAttention(
    Q: number[][],
    K: number[][],
    V: number[][],
    globals: number,
    window: number,
    random: number,
    seed: number,
) {
    const n = Q.length;
    const d = K[0]?.length ?? 1;
    const dv = V[0]?.length ?? 0;
    const scale = Math.sqrt(d);
    const weights: number[][] = [];
    const output: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        const allowed = allowedPositions(i, n, globals, window, random, seed);
        const raw = allowed.map((j) => dot(Q[i] ?? [], K[j] ?? []) / scale);
        const max = raw.length > 0 ? Math.max(...raw) : 0;
        const exps = raw.map((v) => Math.exp(v - max));
        const total = exps.reduce((sum, v) => sum + v, 0);
        const row = new Array<number>(n).fill(0);
        allowed.forEach((j, k) => {
            row[j] = total === 0 ? 0 : (exps[k] ?? 0) / total;
        });
        weights.push(row);
        output.push(
            Array.from({ length: dv }, (_, c) =>
                allowed.reduce((sum, j, k) => sum + (total === 0 ? 0 : (exps[k] ?? 0) / total) * (V[j]?.[c] ?? 0), 0),
            ),
        );
    }
    return { n, d, dv, weights, output };
}

function makeCells(weights: number[][], revealed: number, current: number): VisualEntity[] {
    const cols = weights[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let row = 0; row < weights.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const shown = row < revealed;
            const value = weights[row]?.[col] ?? 0;
            const state: EntityState = row === current ? "comparing" : shown && value > 0 ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? value.toFixed(2) : "?",
                value: shown ? value : 0,
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
    const task = (input as BigBirdInput | null) ?? {};
    const Q: number[][] = task.queries ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, -1],
        [1, -1],
        [0.5, 0.5],
    ];
    const K: number[][] = task.keys ?? Q;
    const V: number[][] = task.values ?? Q;
    const globals = typeof task.globalTokens === "number" ? Math.max(0, Math.trunc(task.globalTokens)) : 1;
    const window = typeof task.window === "number" ? Math.max(0, Math.trunc(task.window)) : 1;
    const random = typeof task.randomTokens === "number" ? Math.max(0, Math.trunc(task.randomTokens)) : 1;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 3;
    const { n, d, dv, weights, output } = bigBirdAttention(Q, K, V, globals, window, random, seed);
    const flatten = (m: number[][]): number[] => m.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, 0, -1),
        edges: [],
        description: `Big Bird attention over ${n} tokens: ${globals} global, window ${window}, ${random} random per query.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, d, dv, globals, window, random, seed, phase: "mask" },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const allowed = allowedPositions(i, n, globals, window, random, seed);
        yield {
            stepNumber: step,
            entities: makeCells(weights, i + 1, i),
            edges: [],
            description: `Query ${i} attends to ${allowed.length} keys: global, local window, and seeded random positions.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: n,
                cols: n,
                n,
                d,
                dv,
                globals,
                window,
                random,
                seed,
                phase: "weights",
                current: i,
                allowed: allowed,
                attention: flatten(weights.slice(0, i + 1)),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, n, -1),
        edges: [],
        description: `Done: ${n} outputs, each mixing only its sparse set of value vectors.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: n,
            cols: dv,
            n,
            d,
            dv,
            globals,
            window,
            random,
            seed,
            phase: "done",
            attention: flatten(weights),
            output: flatten(output),
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Big Bird makes long-sequence attention affordable by giving every token only a handful of connections. A few tokens are global hubs that everyone can see, each token sees its immediate neighbors through a sliding window, and a few seeded random links give the whole graph good connectivity. Together these three patterns are enough to approximate full attention while keeping the number of edges per token constant.",
        invariants: [
            "Every allowed position is in the union of the global, local, and random sets.",
            "Masked cells carry exactly zero weight and allowed weights sum to one.",
            "Random links are deterministic for a fixed query index and seed.",
        ],
        correctness:
            "For each query the allowed set is built as a set union, so no position is counted twice and the global, local, and random rules are all honored. Softmax is applied only over the allowed scores, producing a valid distribution over that set, and the output is the weighted average of exactly those value rows. When the global count reaches the sequence length, every query sees every key and the sparse result equals full attention.",
        complexityRationale:
            "Each query touches at most g global, 2w local, and r random keys of dimension d, so scoring and mixing cost O(n*(g+w+r)*d) time. The stored attention matrix has at most that many nonzero entries per row, giving O(n*(g+w+r)) space rather than O(n squared).",
        uses: [
            "Long-document language models with sparse attention",
            "Genomic sequence modeling over very long inputs",
            "A teaching example of structured sparse attention patterns",
        ],
        references: [
            "Zaheer et al., Big Bird: Transformers for Longer Sequences, NeurIPS 2020",
            "Beltagy, Peters, and Cohan, Longformer, 2020",
        ],
        workedExample:
            "With six tokens, one global at each end, a window of one, and one random link, a middle query sees the first and last tokens, itself and its two neighbors, plus one seeded random token. Its attention row has zeros everywhere else and sums to one over the allowed positions.",
    },
    id: "big-bird-attention",
    name: "Big Bird Attention",
    category: "ml-ai",
    complexity: { time: "O(n * (g + w + r) * d)", space: "O(n * (g + w + r))" },
    defaultInput: {
        queries: [[1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [0.5, 0.5]],
        keys: [[1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [0.5, 0.5]],
        values: [[1, 0], [0, 1], [1, 1], [0, -1], [1, -1], [0.5, 0.5]],
        globalTokens: 1,
        window: 1,
        randomTokens: 1,
        seed: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "for each query build the set of global token positions",
        "add the local window positions around the query",
        "add deterministically seeded random positions",
        "score the query against only the allowed keys",
        "apply softmax over the allowed scores and zero the rest",
        "mix the allowed values with those weights",
        "done: emit all sparse attention outputs",
    ],
};

export default module;
