/**
 * soft-moe.ts - Soft Mixture of Experts
 *
 * Soft MoE replaces the discrete expert choice of a sparse mixture with a
 * differentiable soft assignment. Tokens are routed to experts by softmax
 * weights, each expert forms a weighted average of all tokens as its slot, and
 * the token outputs are a softmax-weighted blend of the expert results. Every
 * expert contributes, so the whole layer stays end-to-end differentiable.
 *
 * Time is O(tokens * experts * d); space is O(tokens * experts + experts * d).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Stable softmax of a vector. */
export function softmax(row: number[]): number[] {
    const max = Math.max(...row, 0);
    const exps = row.map((x) => Math.exp(x - max));
    const sum = exps.reduce((s, x) => s + x, 0) || 1;
    return exps.map((x) => x / sum);
}

export interface SoftMoeResult {
    combine: number[][];
    dispatch: number[][];
    slots: number[][];
    expertOutputs: number[][];
    result: number[][];
}

/**
 * Run soft MoE routing and expert transformation.
 * Routing logits are token-dot-router-vector; each expert matrix maps a d-vector to dout.
 */
export function softMoeForward(
    tokens: number[][],
    routerVectors: number[][],
    expertMatrices: number[][][],
): SoftMoeResult {
    const n = tokens.length;
    const e = routerVectors.length;
    const d = tokens[0]?.length ?? 0;
    const dout = expertMatrices[0]?.length ?? 0;

    const logits = tokens.map((token) =>
        routerVectors.map((rv) => token.reduce((s, x, i) => s + x * (rv[i] ?? 0), 0)),
    );
    const combine = logits.map((row) => softmax(row));
    // Dispatch normalizes across tokens for each expert.
    const dispatch = Array.from({ length: n }, () => Array.from({ length: e }, () => 0));
    for (let j = 0; j < e; j += 1) {
        const column = logits.map((row) => row[j] ?? 0);
        const weights = softmax(column);
        for (let t = 0; t < n; t += 1) {
            dispatch[t]![j] = weights[t] ?? 0;
        }
    }

    const slots = Array.from({ length: e }, () => Array.from({ length: d }, () => 0));
    for (let j = 0; j < e; j += 1) {
        for (let i = 0; i < d; i += 1) {
            let sum = 0;
            for (let t = 0; t < n; t += 1) {
                sum += (dispatch[t]![j] ?? 0) * (tokens[t]![i] ?? 0);
            }
            slots[j]![i] = sum;
        }
    }

    const expertOutputs = slots.map((slot, j) =>
        Array.from({ length: dout }, (_, o) =>
            (expertMatrices[j]?.[o] ?? []).reduce(
                (s, weight, i) => s + weight * (slot[i] ?? 0),
                0,
            ),
        ),
    );

    const result = tokens.map((_token, t) =>
        Array.from({ length: dout }, (_, o) =>
            combine[t]!.reduce(
                (s, weight, j) => s + weight * (expertOutputs[j]?.[o] ?? 0),
                0,
            ),
        ),
    );
    return { combine, dispatch, slots, expertOutputs, result };
}

function makeCells(combine: number[][], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const experts = combine[0]?.length ?? 0;
    for (let t = 0; t < combine.length; t += 1) {
        for (let j = 0; j < experts; j += 1) {
            const value = combine[t]![j] ?? 0;
            const shown = t <= revealed;
            entities.push({
                id: `cell-${t}-${j}`,
                type: "cell",
                label: shown ? `token ${t}, expert ${j}: ${value.toFixed(3)}` : "?",
                value: shown ? value : 0,
                state: (t === revealed ? "comparing" : shown ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: t, col: j },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            tokens?: number[][];
            routerVectors?: number[][];
            expertMatrices?: number[][][];
        } | null
    ) ?? {};
    const tokens: number[][] = task.tokens ?? [
        [1, 0],
        [0, 1],
        [1, 1],
        [-1, 0.5],
    ];
    const routerVectors: number[][] = task.routerVectors ?? [
        [1, 0],
        [0, 1],
    ];
    const expertMatrices: number[][][] = task.expertMatrices ?? [
        [
            [1, 0.5],
            [0, 1],
        ],
        [
            [0.5, 0],
            [0.5, 1],
        ],
    ];
    const result = softMoeForward(tokens, routerVectors, expertMatrices);
    const metaBase = { rows: tokens.length, cols: routerVectors.length };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(result.combine, -1),
        edges: [],
        description: `Soft MoE routes ${tokens.length} tokens through ${routerVectors.length} experts with differentiable weights.`,
        codeLineNumber: 0,
        layout: "matrix",
        meta: { ...metaBase, tokens: tokens.length, experts: routerVectors.length },
    };
    step += 1;

    for (let t = 0; t < tokens.length; t += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result.combine, t),
            edges: [],
            description: `Token ${t} uses combine weights [${result.combine[t]!.map((w) => w.toFixed(3)).join(", ")}] and produces output [${result.result[t]!.map((v) => v.toFixed(3)).join(", ")}].`,
            codeLineNumber: t % 2 === 0 ? 1 : 3,
            layout: "matrix",
            meta: { ...metaBase, current: t, combine: JSON.stringify(result.combine) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.combine, tokens.length - 1),
        edges: [],
        description: `Done: all experts blended softly into ${result.result.length} output vectors, with dispatch weights summing to one per expert.`,
        codeLineNumber: 5,
        layout: "matrix",
        meta: { ...metaBase, converged: true, result: JSON.stringify(result.result), combine: JSON.stringify(result.combine) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A sparse mixture of experts sends each token to only the top experts, which is efficient but produces a hard, non-differentiable choice. Soft MoE keeps every expert in play: softmax weights decide how strongly each expert reads each token and how much each expert's output contributes back. Because all the weights are smooth, gradients flow through the whole layer, and every expert can still specialize by learning different parameters.",
        invariants: [
            "Combine weights sum to one for every token.",
            "Dispatch weights sum to one for every expert across tokens.",
            "Each expert slot is the dispatch-weighted average of all tokens.",
        ],
        correctness:
            "Softmax normalizes each row and column to one, so the combine and dispatch weights are valid probability distributions. Each slot is exactly the dispatch-weighted token mean, and each token output is the combine-weighted mean of expert outputs. The tests recompute these quantities with explicit loops, check the normalization of every row and column, and confirm that a single expert reduces the layer to that expert applied to the mean token.",
        complexityRationale:
            "Forming logits costs O(tokens * experts * d), building slots and outputs costs O(experts * tokens * d) and O(experts * d * dout), and blending costs O(tokens * experts * dout). Space is O(tokens * experts + experts * d).",
        uses: [
            "Scaling transformer models with conditionally specialized experts",
            "Differentiable alternatives to top-k routing",
            "Multi-task networks that share a common backbone",
        ],
        references: [
            "Puigcerver et al., From Sparse to Soft Mixtures of Experts, ICLR 2024",
            "Shazeer et al., Outrageously Large Neural Networks, ICLR 2017",
        ],
        workedExample:
            "With two tokens (1, 0) and (0, 1) and router vectors (1, 0) and (0, 1), the first token combines experts with weights about (0.73, 0.27) and the second with (0.27, 0.73). Each expert's slot is a blend of both tokens, and the final output for each token blends the two expert transformations.",
    },
    id: "soft-moe",
    name: "Soft Mixture of Experts",
    category: "ml-ai",
    complexity: { time: "O(tokens * experts * d)", space: "O(tokens * experts + experts * d)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
            [-1, 0.5],
        ],
        routerVectors: [
            [1, 0],
            [0, 1],
        ],
        expertMatrices: [
            [
                [1, 0.5],
                [0, 1],
            ],
            [
                [0.5, 0],
                [0.5, 1],
            ],
        ],
    },
    visualType: "matrix",
    run,
    pseudocode: [
        "compute routing logits as token dot router vector for every expert",
        "form combine weights by softmax over experts for each token",
        "form dispatch weights by softmax over tokens for each expert",
        "build each expert slot as the dispatch-weighted mean of tokens",
        "apply the expert matrix to its slot and blend by combine weights",
        "done: report the blended output for every token",
    ],
};

export default module;
