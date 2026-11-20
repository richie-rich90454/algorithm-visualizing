/**
 * test-time-training.ts - Test-Time Training (Teachable Core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Test-time training adapts a model to unlabeled input during inference by
 * turning the input itself into a self-supervised learning signal. This module
 * shows the teachable core: a small hidden weight matrix is updated at each
 * token by gradient descent on a reconstruction objective, and the updated
 * state produces the token's output. The projections are fixed and the
 * arithmetic is fully reproducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d^2) for n tokens of dimension d
 *   Space: O(d^2) for the hidden weight matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the hidden weight matrix before each token update.
 *   - Loss before and after the update is reported in metadata.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface TttInput {
    tokens?: number[][];
    eta?: number;
    seed?: number;
}

function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

function cells(matrix: number[][]): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        for (let col = 0; col < (matrix[row]?.length ?? 0); col += 1) {
            const value = matrix[row]?.[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: "comparing" as const,
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

function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((s, v, i) => s + v * (vector[i] ?? 0), 0));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as TttInput | null) ?? {};
    const tokens = Array.isArray(task.tokens) && task.tokens.length > 0
        ? task.tokens.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
          ];
    const d = tokens[0]?.length ?? 2;
    const eta = typeof task.eta === "number" && task.eta > 0 ? task.eta : 0.05;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 3;
    const next = weightStream(seed);
    const makeMatrix = (): number[][] => Array.from({ length: d }, () => Array.from({ length: d }, next));
    const Wk = makeMatrix();
    const Wq = makeMatrix();
    const Wv = makeMatrix();
    const weights = JSON.stringify({ Wk, Wq, Wv });

    let W: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
    const base = { rows: d, cols: d, n: tokens.length, d, eta, weights };

    yield {
        stepNumber: 0,
        entities: cells(W),
        edges: [],
        description: `Hidden state starts at zero; ${tokens.length} tokens will each trigger one self-supervised update.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "setup", tokenIndex: -1, lossBefore: 0, lossAfter: 0 },
    };

    let step = 1;
    for (let i = 0; i < tokens.length; i += 1) {
        const x = tokens[i] ?? [];
        const z = matVec(Wk, x);
        const target = matVec(Wv, x);
        const predBefore = matVec(W, z);
        const lossBefore = predBefore.reduce((s, v, k) => s + (v - (target[k] ?? 0)) ** 2, 0);
        W = W.map((row, r) => row.map((value, k) => value - eta * ((predBefore[r] ?? 0) - (target[r] ?? 0)) * (z[k] ?? 0)));
        const predAfter = matVec(W, z);
        const lossAfter = predAfter.reduce((s, v, k) => s + (v - (target[k] ?? 0)) ** 2, 0);
        const output = matVec(Wq, predAfter);
        yield {
            stepNumber: step,
            entities: cells(W),
            edges: [],
            description: `Token ${i}: reconstruction loss falls from ${lossBefore.toFixed(4)} to ${lossAfter.toFixed(4)} after one gradient step.`,
            codeLineNumber: i === tokens.length - 1 ? 6 : 4,
            layout: "grid",
            meta: {
                ...base,
                phase: "update",
                tokenIndex: i,
                z,
                target,
                predBefore,
                predAfter,
                lossBefore,
                lossAfter,
                output,
                W: W.flat(),
            },
        };
        step += 1;
    }
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Normally a model is frozen at test time. Test-time training instead lets each input tune the model slightly by solving a small self-supervised task built from that input. Here a hidden weight matrix predicts a fixed projection of each token; the prediction error is a loss, and one gradient step on that loss updates the matrix before the token's output is produced.",
        invariants: [
            "The key, query, and value projections are fixed during the run.",
            "The hidden state is updated by one gradient step per token.",
            "For a small enough step size the reconstruction loss does not increase.",
        ],
        correctness:
            "The reconstruction loss is the squared distance between the hidden state applied to the key vector and the value target. Its gradient with respect to the hidden matrix is the outer product of the error and the key vector, so subtracting the step size times that gradient is a valid gradient descent step. Writing the new error as the old error scaled by one minus the step size times the squared key norm shows the loss decreases whenever that product lies between zero and two.",
        complexityRationale:
            "Each token requires two matrix-vector products for projections, one for the prediction, an outer-product update, and one for the output, all O(d squared). Across n tokens the time is O(n d squared) and the stored hidden state is O(d squared).",
        uses: [
            "Adapting a model to a new domain from unlabeled data",
            "Test-time augmentation for robust vision and language models",
            "Continual learning from a stream of inputs",
        ],
        references: [
            "Sun et al., Test-Time Training with Self-Supervision for Generalization under Distribution Shifts, 2020",
            "Wang et al., Test-Time Training with Masked Autoencoders, 2022",
        ],
        workedExample:
            "With a two-dimensional token, a zero hidden state predicts zero, so the initial loss is the squared norm of the value target. One gradient step moves the hidden matrix toward mapping the key vector to that target; the recomputed loss is smaller, and the updated matrix produces the token's output.",
    },
    id: "test-time-training",
    name: "Test-Time Training (Teachable Core)",
    category: "ml-ai",
    complexity: { time: "O(n * d^2)", space: "O(d^2)" },
    defaultInput: {
        tokens: [
            [1, 0],
            [0, 1],
            [1, 1],
        ],
        eta: 0.05,
        seed: 3,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize key, query, and value projection matrices",
        "start the hidden weight matrix at zero",
        "for each token compute its key and value target",
        "predict the target from the current hidden state",
        "take one gradient step on the squared prediction error",
        "produce the output from the updated hidden state",
        "move to the next token",
        "done: report the final state and all losses",
    ],
};

export default module;
