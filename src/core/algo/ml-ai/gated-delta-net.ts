/**
 * gated-delta-net.ts - Gated Delta Net (delta-rule state recurrence)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A gated delta net replaces attention with a fixed-size recurrent state. Each
 * token writes a key-value association into a d by d matrix using the delta
 * rule: remove the old value predicted for the key, then write the difference.
 * A decay gate shrinks old memories and a write gate controls how much of the
 * delta is stored. Outputs are read from the state before each write.
 *
 * ---------------------------------------------------------------------------
 * Scope of the model
 * ---------------------------------------------------------------------------
 * This is the exact teachable core: a single head, scalar decay and write
 * gates, and small hand-chosen vectors. It is not a full gated DeltaNet layer
 * with chunked parallel scan, normalization, or multiple heads, and it makes no
 * claim about language-model quality.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * d^2) for T tokens and state width d
 *   Space: O(d^2) for the recurrent state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The d by d recurrent state is drawn as a grid.
 *   - The cell written most recently is highlighted.
 *   - The frame meta exposes the full state and each output vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DeltaInput {
    keys?: number[][];
    values?: number[][];
    queries?: number[][];
    alpha?: number;
    beta?: number;
}

/** Multiply a d by d matrix by a d vector. */
function matVec(matrix: number[][], vector: number[]): number[] {
    return matrix.map((row) => row.reduce((sum, value, k) => sum + value * (vector[k] ?? 0), 0));
}

function makeCells(state: number[][], d: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < d; row += 1) {
        for (let col = 0; col < d; col += 1) {
            const value = state[row]?.[col] ?? 0;
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: (Math.abs(value) > 1e-9 ? "comparing" : "idle") as EntityState,
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

/** The gated delta-rule generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DeltaInput | null) ?? {};
    const keys = Array.isArray(task.keys)
        ? task.keys.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
          ];
    const values = Array.isArray(task.values)
        ? task.values.map((row) => [...row])
        : [
              [0.5, 0],
              [0, 0.7],
              [0.3, -0.2],
          ];
    const queries = Array.isArray(task.queries)
        ? task.queries.map((row) => [...row])
        : [
              [1, 0],
              [0, 1],
              [1, 1],
          ];
    const T = keys.length;
    const d = keys[0]?.length ?? 2;
    const alpha = typeof task.alpha === "number" ? task.alpha : 0.9;
    const beta = typeof task.beta === "number" ? task.beta : 0.8;

    let state: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
    const flatten = (matrix: number[][]): number[] => matrix.reduce<number[]>((acc, row) => acc.concat(row), []);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(state, d),
        edges: [],
        description: `Initial ${d} by ${d} state is zero; decay ${alpha}, write gate ${beta}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: d, cols: d, d, T, alpha, beta, t: -1, state: flatten(state), output: Array(d).fill(0) },
    };
    step += 1;

    for (let t = 0; t < T; t += 1) {
        const key = keys[t] ?? Array(d).fill(0);
        const value = values[t] ?? Array(d).fill(0);
        const query = queries[t] ?? Array(d).fill(0);
        const output = matVec(state, query);
        const predicted = matVec(state, key);
        const delta = value.map((v, i) => v - (predicted[i] ?? 0));
        const next: number[][] = Array.from({ length: d }, (_, i) =>
            Array.from({ length: d }, (_, j) => alpha * (state[i]?.[j] ?? 0) + beta * (delta[i] ?? 0) * (key[j] ?? 0)),
        );
        state = next;
        yield {
            stepNumber: step,
            entities: makeCells(state, d),
            edges: [],
            description: `Token ${t}: read output [${output.map((x) => x.toFixed(3)).join(", ")}]; delta [${delta.map((x) => x.toFixed(3)).join(", ")}] written into the state.`,
            codeLineNumber: t === T - 1 ? 6 : 4,
            layout: "grid",
            meta: {
                rows: d,
                cols: d,
                d,
                T,
                alpha,
                beta,
                t,
                state: flatten(state),
                output,
                delta,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(state, d),
        edges: [],
        description: `Done: final state after ${T} delta updates with decay ${alpha} and write gate ${beta}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: d,
            cols: d,
            d,
            T,
            alpha,
            beta,
            t: T,
            state: flatten(state),
            output: T > 0 ? matVec(state, queries[T - 1] ?? Array(d).fill(0)) : Array(d).fill(0),
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Think of the state as a small memory table that maps keys to values. To store a new pair, ask the table what it currently predicts for that key, compare with the true value, and write only the difference. A decay gate forgets a little on every step, and a write gate decides how strongly the difference is stored.",
        invariants: [
            "The state always has size d by d, independent of sequence length.",
            "The output is read from the state before the current token writes to it.",
            "With a zero write gate and a zero initial state, the state stays zero.",
        ],
        correctness:
            "Write S_t = alpha * S_{t-1} + beta * (v_t - S_{t-1} k_t) k_t^T, which is the delta rule plus a decay term. The output o_t = S_{t-1} q_t is a linear read from the same state, so replaying the recurrence from the reported gates and token vectors reproduces every frame exactly. Setting beta to zero removes all writes, leaving pure exponential decay.",
        complexityRationale:
            "Each token forms a matrix-vector product, an outer product, and a matrix update, each costing O(d^2); over T tokens the time is O(T * d^2). Only the d by d state is kept, so space is O(d^2) rather than growing with the sequence.",
        uses: [
            "Linear-time sequence modeling with constant-size memory",
            "Long-context alternatives to quadratic attention",
            "Streaming state updates in recurrent language models",
        ],
        references: [
            "Yang et al., Gated Delta Networks: Improving Mamba2 with Delta Rule, 2024",
            "Schlag, Irie, and Schmidhuber, Linear Transformers Are Faster Transformers, 2021",
        ],
        workedExample:
            "With two-dimensional keys [1,0] and [0,1], values [0.5,0] and [0,0.7], decay 0.9, and write gate 0.8, the first token writes 0.4 into state cell (0,0). The second token reads a zero output for query [0,1] and then writes 0.56 into cell (1,1); earlier entries are multiplied by 0.9.",
    },
    id: "gated-delta-net",
    name: "Gated Delta Net",
    category: "ml-ai",
    complexity: { time: "O(T * d^2)", space: "O(d^2)" },
    defaultInput: {
        keys: [
            [1, 0],
            [0, 1],
            [1, 1],
        ],
        values: [
            [0.5, 0],
            [0, 0.7],
            [0.3, -0.2],
        ],
        queries: [
            [1, 0],
            [0, 1],
            [1, 1],
        ],
        alpha: 0.9,
        beta: 0.8,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize a d by d state matrix to zero",
        "for each token read output as state times query",
        "predict the current key with state times key",
        "form the delta between the true value and the prediction",
        "decay the state by the decay gate",
        "add the write gate times the outer product of delta and key",
        "done: report the final recurrent state and outputs",
    ],
};

export default module;
