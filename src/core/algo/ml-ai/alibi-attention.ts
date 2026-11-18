/**
 * alibi-attention.ts - ALiBi Attention (attention with linear biases)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ALiBi removes the need for learned positional embeddings by adding a linear
 * penalty to each attention score based on the distance between query and key.
 * The penalty slope is fixed per head: nearby keys keep their score, while
 * distant keys lose score in proportion to their distance. Combined with a
 * causal mask, this teaches the model to prefer recent tokens.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the exact scoring and masking rule on a small token sequence with
 * direct query, key, and value vectors. It does not train slopes, run a full
 * transformer layer, or reproduce a particular pretrained model.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(heads * n^2 * d)
 *   Space: O(n^2) per head for the attention matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each head gets a causal n by n attention grid.
 *   - Masked future positions stay idle; allowed positions are revealed.
 *   - The frame meta exposes the slope, weights, and outputs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AlibiInput {
    tokens?: number[][];
    heads?: number;
}

/** The fixed geometric slope for head h: 1 / 2^(h+1). */
function headSlope(head: number): number {
    return Math.pow(2, -(head + 1));
}

/** Softmax over only the allowed prefix of a row. */
function maskedSoftmax(scores: number[], allowed: number): number[] {
    const prefix = scores.slice(0, allowed);
    const max = Math.max(...prefix);
    const exps = prefix.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return scores.map((_value, j) => (j < allowed ? (exps[j] ?? 0) / total : 0));
}

function makeCells(weights: number[][], revealed: boolean, current: number): VisualEntity[] {
    const n = weights.length;
    const entities: VisualEntity[] = [];
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
            const masked = j > i;
            const value = weights[i]?.[j] ?? 0;
            const state: EntityState = masked
                ? "idle"
                : i === current
                  ? "comparing"
                  : revealed
                    ? "sorted"
                    : "unvisited";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: masked ? "X" : revealed ? value.toFixed(3) : "?",
                value: masked ? -1 : revealed ? value : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, masked },
            });
        }
    }
    return entities;
}

/** The ALiBi attention generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AlibiInput | null) ?? {};
    const tokens = Array.isArray(task.tokens)
        ? task.tokens.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
          ];
    const n = tokens.length;
    const d = tokens[0]?.length ?? 2;
    const heads = Math.max(1, typeof task.heads === "number" ? Math.trunc(task.heads) : 2);
    const scale = Math.sqrt(d);

    const maps: number[][][] = [];
    const outputs: number[][][] = [];
    const slopes: number[] = [];
    for (let h = 0; h < heads; h += 1) {
        const slope = headSlope(h);
        slopes.push(slope);
        const scores: number[][] = [];
        for (let i = 0; i < n; i += 1) {
            scores.push(
                Array.from({ length: n }, (_v, j) => {
                    if (j > i) {
                        return Number.NEGATIVE_INFINITY;
                    }
                    const dot = (tokens[i] ?? []).reduce(
                        (sum, x, k) => sum + x * (tokens[j]?.[k] ?? 0),
                        0,
                    );
                    return dot / scale - slope * (i - j);
                }),
            );
        }
        const attention = scores.map((row, i) => maskedSoftmax(row, i + 1));
        maps.push(attention);
        outputs.push(
            attention.map((row) =>
                Array.from({ length: d }, (_v, k) =>
                    row.reduce((sum, weight, j) => sum + weight * (tokens[j]?.[k] ?? 0), 0),
                ),
            ),
        );
    }

    const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);
    const blank = Array.from({ length: n }, () => Array(n).fill(0));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(blank, false, -1),
        edges: [],
        description: `Causal attention over ${n} tokens with ${heads} fixed distance-penalty slopes.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { rows: n, cols: n, heads, head: -1, n, d, slopes, causal: true },
    };
    step += 1;

    for (let h = 0; h < heads; h += 1) {
        const attention = maps[h] ?? [];
        const sums = attention.map((row) => row.reduce((a, b) => a + b, 0));
        const diagonal = attention.map((row, i) => row[i] ?? 0);
        yield {
            stepNumber: step,
            entities: makeCells(attention, true, -1),
            edges: [],
            description: `Head ${h} slope ${slopes[h]?.toFixed(4)}: a key ${n - 1} steps back pays ${((slopes[h] ?? 0) * (n - 1)).toFixed(3)} in score.`,
            codeLineNumber: h === heads - 1 ? 6 : 4,
            layout: "matrix",
            meta: {
                rows: n,
                cols: n,
                heads,
                head: h,
                n,
                d,
                slope: slopes[h],
                slopes,
                attention: flatten(attention),
                output: flatten(outputs[h] ?? []),
                rowSums: sums,
                diagonal,
                causal: true,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(maps[0] ?? blank, true, -1),
        edges: [],
        description: `Done: ${heads} heads, each causal with a geometric slope; no learned position vectors needed.`,
        codeLineNumber: 6,
        layout: "matrix",
        meta: {
            rows: n,
            cols: n,
            heads,
            head: heads,
            n,
            d,
            slopes,
            attention: flatten(maps[0] ?? blank),
            output: flatten(outputs[0] ?? []),
            causal: true,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Give each attention head a fixed rule for how much it dislikes distance: the farther a key is from the current token, the more its score is reduced. The slope of that penalty is different for each head, so some heads focus sharply on recent tokens while others keep a longer view. No learned position vectors are required.",
        invariants: [
            "A query never attends to a future key; the upper triangle is masked to zero.",
            "The distance penalty for head h is slope times the number of positions back.",
            "Each allowed attention row is a softmax and therefore sums to one.",
        ],
        correctness:
            "For query i and key j with j at most i, the score is the scaled dot product minus slope times (i minus j). Softmax over the allowed prefix j from 0 to i makes those rows sum to one, and masked positions receive exactly zero. Each output row is the weighted average of the values with those weights, so replaying the scoring rule reproduces every reported weight and output.",
        complexityRationale:
            "Each head computes an n by n score matrix with dot products of length d, costing O(heads * n^2 * d); the softmaxes and weighted sums stay within the same bound. Storing the attention matrices uses O(heads * n^2) space.",
        uses: [
            "Language models that generalize to longer contexts",
            "Removing learned positional embeddings from transformers",
            "Causal generation with a recency bias",
        ],
        references: [
            "Press, Smith, and Lewis, Train Short, Test Long: Attention with Linear Biases, ICLR 2022",
            "Vaswani et al., Attention Is All You Need, 2017",
        ],
        workedExample:
            "With four tokens and a head slope of 0.5, a key three positions back loses 1.5 from its score while the current key loses nothing. A second head with slope 0.25 penalizes the same distant key by only 0.75, so it spreads attention more broadly.",
    },
    id: "alibi-attention",
    name: "ALiBi Attention",
    category: "ml-ai",
    complexity: { time: "O(heads * n^2 * d)", space: "O(heads * n^2)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
            [0.5, 0.5],
        ],
        heads: 2,
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "assign each head a fixed geometric distance slope",
        "for each head score every query against every earlier key",
        "subtract the slope times the distance from each score",
        "mask all future key positions to zero weight",
        "apply softmax over the allowed prefix of each row",
        "average the values with those weights to form the output",
        "done: report the causal attention maps and per-head slopes",
    ],
};

export default module;
