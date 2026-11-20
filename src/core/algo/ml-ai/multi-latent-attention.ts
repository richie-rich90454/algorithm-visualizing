/**
 * multi-latent-attention.ts - Multi-Head Latent Attention (teachable core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Multi-head latent attention compresses each token's key and value into a
 * short latent vector before attention. A down-projection maps the token to a
 * c-dimensional latent, then two up-projections reconstruct the keys and
 * values from that same latent. Standard scaled dot-product attention follows.
 * Storing one small latent per token shrinks the key-value cache substantially.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d * c + n^2 * d) for n tokens, dimension d, latent width c
 *   Space: O(n * c) for the compressed cache instead of O(n * d)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The attention matrix is shown as a grid revealed one query row at a time.
 *   - The compressed latent codes and the reconstructed keys and values are
 *     reported in metadata so the cache reduction is visible.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MlaInput {
    tokens?: number[][];
    queries?: number[][];
    down?: number[][];
    upKeys?: number[][];
    upValues?: number[][];
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

function matmul(a: number[][], b: number[][]): number[][] {
    const inner = b.length;
    const cols = b[0]?.length ?? 0;
    return a.map((row) =>
        Array.from({ length: cols }, (_, c) => {
            let sum = 0;
            for (let i = 0; i < inner; i += 1) {
                sum += (row[i] ?? 0) * (b[i]?.[c] ?? 0);
            }
            return sum;
        }),
    );
}

function transpose(a: number[][]): number[][] {
    return a[0] ? a[0].map((_, c) => a.map((row) => row[c] ?? 0)) : [];
}

function softmax(row: number[]): number[] {
    if (row.length === 0) {
        return [];
    }
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const total = exps.reduce((sum, value) => sum + value, 0);
    return exps.map((value) => value / total);
}

/** Compress tokens to a latent cache, reconstruct keys and values, then attend. */
export function latentAttention(
    tokens: number[][],
    queries: number[][],
    down: number[][],
    upKeys: number[][],
    upValues: number[][],
) {
    const n = tokens.length;
    const latent = matmul(tokens, down);
    const keys = matmul(latent, transpose(upKeys));
    const values = matmul(latent, transpose(upValues));
    const d = keys[0]?.length ?? 1;
    const dv = values[0]?.length ?? 0;
    const scale = Math.sqrt(d);
    const weights: number[][] = [];
    const output: number[][] = [];
    for (const query of queries) {
        const raw = keys.map((key) => dot(query, key) / scale);
        const w = softmax(raw);
        weights.push(w);
        output.push(
            Array.from({ length: dv }, (_, c) =>
                w.reduce((sum, p, j) => sum + p * (values[j]?.[c] ?? 0), 0),
            ),
        );
    }
    return { n, c: down[0]?.length ?? 0, d, dv, latent, keys, values, weights, output };
}

function makeCells(weights: number[][], revealed: number, current: number): VisualEntity[] {
    const cols = weights[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let row = 0; row < weights.length; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const shown = row < revealed;
            const state: EntityState = row === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: shown ? (weights[row]?.[col] ?? 0).toFixed(3) : "?",
                value: shown ? weights[row]?.[col] ?? 0 : 0,
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
    const task = (input as MlaInput | null) ?? {};
    const tokens: number[][] = task.tokens ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [0, -1],
    ];
    const queries: number[][] = task.queries ?? tokens;
    const down: number[][] = task.down ?? [
        [1],
        [1],
    ];
    const upKeys: number[][] = task.upKeys ?? [
        [1],
        [0],
    ];
    const upValues: number[][] = task.upValues ?? [
        [0],
        [1],
    ];
    const r = latentAttention(tokens, queries, down, upKeys, upValues);
    const { n, c, d, dv, latent, weights, output } = r;
    const flatten = (m: number[][]): number[] => m.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(weights, 0, -1),
        edges: [],
        description: `Compress ${n} tokens of width ${d} into a latent cache of width ${c}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: n, cols: n, n, c, d, dv, phase: "compress", latent: flatten(latent) },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(weights, i + 1, i),
            edges: [],
            description: `Query ${i} attends over keys and values reconstructed from the shared latent cache.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: n,
                cols: n,
                n,
                c,
                d,
                dv,
                phase: "weights",
                current: i,
                latent: flatten(latent),
                attention: flatten(weights.slice(0, i + 1)),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(output, n, -1),
        edges: [],
        description: `Done: ${n} outputs from a cache of ${n} by ${c} latent codes instead of ${n} by ${d}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            rows: n,
            cols: dv,
            n,
            c,
            d,
            dv,
            phase: "done",
            latent: flatten(latent),
            attention: flatten(weights),
            output: flatten(output),
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "During generation a transformer stores a key and a value for every past token, which can become very large. Latent attention instead stores one short compressed code per token. When attention is needed, two small up-projections rebuild the keys and values from those codes. Because the keys and values share the same compressed origin, the cache is much smaller while attention still uses the familiar scaled dot-product rule.",
        invariants: [
            "Each latent code has width c, which is smaller than the token width d.",
            "Keys and values are both reconstructed from the same latent codes.",
            "Every attention row is a softmax and therefore sums to one.",
        ],
        correctness:
            "The down-projection maps each token to a c-vector by matrix multiplication, and the two up-projections map that c-vector back to d-dimensional keys and values. Attention then scores each query against the reconstructed keys with the one over square root of d scaling, normalizes by softmax, and mixes the reconstructed values. This is exactly ordinary attention applied to the reconstructed sequences, so the output is correct by direct evaluation, and the stored cache has n times c entries.",
        complexityRationale:
            "Compression costs O(n*d*c) and reconstruction costs O(n*c*d). The attention itself is O(n^2*d). Space for the cache is O(n*c) rather than O(n*d), which is the point of the method when c is much smaller than d.",
        uses: [
            "Reducing the key-value cache in large language model inference",
            "Serving long-context models with limited memory",
            "A teaching example of latent compression inside attention",
        ],
        references: [
            "DeepSeek-AI, DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model, 2024",
            "Vaswani et al., Attention Is All You Need, 2017",
        ],
        workedExample:
            "With four two-dimensional tokens and a latent width of one, the down-projection maps each token to a single number. Up-projections place that number into the first coordinate of the key and the second coordinate of the value. Attention then proceeds over four reconstructed keys, while the cache stores only four numbers.",
    },
    id: "multi-latent-attention",
    name: "Multi-Head Latent Attention",
    category: "ml-ai",
    complexity: { time: "O(n * d * c + n^2 * d)", space: "O(n * c)" },
    defaultInput: {
        tokens: [[1, 0], [0, 1], [1, 1], [0, -1]],
        queries: [[1, 0], [0, 1], [1, 1], [0, -1]],
        down: [[1], [1]],
        upKeys: [[1], [0]],
        upValues: [[0], [1]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "compress each token with the down-projection into a latent code",
        "reconstruct keys from the latent with the key up-projection",
        "reconstruct values from the latent with the value up-projection",
        "for each query score against the reconstructed keys",
        "apply softmax and mix the reconstructed values",
        "done: report outputs and the compressed cache",
    ],
};

export default module;
