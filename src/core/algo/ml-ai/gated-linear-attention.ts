/**
 * gated-linear-attention.ts - Gated Linear Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Gated linear attention replaces the quadratic softmax attention matrix with
 * a fixed-size recurrent state. Each key-value pair writes an outer product
 * into the state, a per-feature forget gate decays old content, and queries
 * read the state back. The result is linear in sequence length at inference.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * dk * dv) for T tokens and state dimensions dk, dv
 *   Space: O(dk * dv) for the recurrent state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The dk by dv state is drawn as a grid that evolves each token.
 *   - The cells written by the newest key-value pair are highlighted.
 *   - Frame meta exposes the state, forget gates, and every output vector.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface GLAInput {
    keys?: number[][];
    values?: number[][];
    queries?: number[][];
    forgetGates?: number[][];
}

/** Run the forget-gated linear attention recurrence. */
export function glaForward(
    keys: number[][],
    values: number[][],
    queries: number[][],
    forgetGates: number[][],
): { states: number[][][]; outputs: number[][] } {
    const dk = keys[0]?.length ?? 1;
    const dv = values[0]?.length ?? 1;
    let state = Array.from({ length: dk }, () => new Array<number>(dv).fill(0));
    const states: number[][][] = [];
    const outputs: number[][] = [];
    for (let t = 0; t < keys.length; t += 1) {
        const key = keys[t] ?? [];
        const value = values[t] ?? [];
        const query = queries[t] ?? [];
        const gate = forgetGates[t] ?? [];
        state = state.map((row, i) =>
            row.map((cell, j) => cell * (gate[i] ?? 0) + (key[i] ?? 0) * (value[j] ?? 0)),
        );
        const output = Array.from({ length: dv }, (_, j) =>
            state.reduce((sum, row, i) => sum + row[j]! * (query[i] ?? 0), 0),
        );
        states.push(state.map((row) => [...row]));
        outputs.push(output);
    }
    return { states, outputs };
}

function makeCells(state: number[][], dk: number, dv: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < dk; row += 1) {
        for (let col = 0; col < dv; col += 1) {
            const value = state[row]?.[col] ?? 0;
            entities.push({
                id: `state-${row}-${col}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: Math.abs(value) > 1e-9 ? "active" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, keyFeature: row, valueFeature: col },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GLAInput | null) ?? {};
    const keys = (task.keys ?? [
        [1, 0],
        [0, 1],
        [1, 1],
    ]).map((row) => [...row]);
    const values = (task.values ?? [
        [0.5, 0],
        [0, 0.7],
        [0.3, -0.2],
    ]).map((row) => [...row]);
    const queries = (task.queries ?? [
        [1, 0],
        [0, 1],
        [1, 1],
    ]).map((row) => [...row]);
    const forgetGates = (task.forgetGates ?? [
        [0.8, 0.9],
        [0.8, 0.9],
        [0.8, 0.9],
    ]).map((row) => [...row]);
    const dk = keys[0]?.length ?? 1;
    const dv = values[0]?.length ?? 1;
    const T = keys.length;
    const zero = Array.from({ length: dk }, () => new Array<number>(dv).fill(0));
    const { states, outputs } = glaForward(keys, values, queries, forgetGates);
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(zero, dk, dv),
        edges: [],
        description: `Gated linear attention with a ${dk} by ${dv} state; no token has been written yet.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: dk, cols: dv, dk, dv, T, t: -1, state: zero.flat(), outputs, forgetGates },
    };
    step += 1;

    for (let t = 0; t < T; t += 1) {
        const state = states[t] ?? zero;
        yield {
            stepNumber: step,
            entities: makeCells(state, dk, dv),
            edges: [],
            description: `Token ${t}: decay by the forget gate, write key ${(keys[t] ?? []).join(",")} with value ${(values[t] ?? []).join(",")}, read output ${(outputs[t] ?? []).join(",")}.`,
            codeLineNumber: t === 0 ? 2 : 4,
            layout: "grid",
            meta: { rows: dk, cols: dv, dk, dv, T, t, state: state.flat(), outputs, forgetGates },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(states[T - 1] ?? zero, dk, dv),
        edges: [],
        description: `Processed ${T} tokens; the recurrent state now summarizes the whole prefix.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: dk, cols: dv, dk, dv, T, t: T - 1, state: (states[T - 1] ?? zero).flat(), outputs, forgetGates },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Softmax attention keeps every past key and compares it with every query. Gated linear attention instead folds the past into one small matrix: keys write associations, gates decide what to forget, and queries read by multiplying into that matrix. The work per token no longer grows with the sequence length.",
        invariants: [
            "The state is always the sum of gated outer products of all keys seen so far.",
            "Each key feature decays at its own rate set by its forget gate.",
            "A query never modifies the state; it only reads from it.",
        ],
        correctness:
            "Unrolling the recurrence gives state entry (i,j) at time t as the sum over past positions r of the product of forget gates from r+1 to t times key_r[i] times value_r[j]. This is exactly the weighted sum of associations that softmax attention would form, with the decay playing the role of the attention weight. The readout multiplies that state by the query, so it equals the corresponding attention output computed without materializing the full matrix.",
        complexityRationale:
            "Each token updates a dk by dv state and reads it with a query, costing O(dk * dv) per token and O(T * dk * dv) overall. Only the state is retained for inference, so space is O(dk * dv).",
        uses: [
            "Linear-time language model attention with constant-size inference cache",
            "Long-context sequence modeling on memory-limited devices",
            "Online summarization of streaming embeddings",
        ],
        references: [
            "Yang, Yang, Zhang et al., Gated Linear Attention Transformers with Hardware-Efficient Training, ICML 2024",
            "Katharopoulos et al., Transformers are RNNs, ICML 2020",
        ],
        workedExample:
            "With one key feature, one value feature, gate 0.8, first key 1 and value 2, the state becomes 2. Reading with query 3 gives 6. A second key 1 with gate 0.8 gives state 0.8*2 + 1 = 2.6, and the new readout is 7.8.",
    },
    id: "gated-linear-attention",
    name: "Gated Linear Attention",
    category: "ml-ai",
    complexity: { time: "O(T * dk * dv)", space: "O(dk * dv)" },
    defaultInput: {
        keys: [[1, 0], [0, 1], [1, 1]],
        values: [[0.5, 0], [0, 0.7], [0.3, -0.2]],
        queries: [[1, 0], [0, 1], [1, 1]],
        forgetGates: [[0.8, 0.9], [0.8, 0.9], [0.8, 0.9]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the key by value state matrix to zero",
        "for each token in the sequence",
        "multiply every state row by its forget gate",
        "add the outer product of the key and value to the state",
        "multiply the state by the query to form the output",
        "store the state and output for this token",
        "continue until all tokens are consumed",
        "done: return the state and output sequence",
    ],
};

export default module;
