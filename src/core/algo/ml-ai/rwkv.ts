/**
 * rwkv.ts - RWKV (WKV Linear-Attention Core)
 *
 * TEACHING MODEL, NOT A FULL RWKV BLOCK. The defining operation of RWKV is
 * the weighted key-value (WKV) computation: a causal attention with an
 * exponential time decay that can be computed with a constant-size recurrent
 * state. This module implements that recurrence on one channel and shows that
 * it equals the direct sum over all previous timesteps.
 *
 * Complexity:
 *   Time:  O(t) for t timesteps with the recurrence, O(t^2) for the direct form
 *   Space: O(1) recurrent state for a single channel
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Cell = number | null;

function fmt(value: number): string {
    return String(Math.round(value * 1000) / 1000);
}

function makeCells(matrix: Cell[][], revealedCols: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < matrix.length; row += 1) {
        const cells = matrix[row] ?? [];
        for (let col = 0; col < cells.length; col += 1) {
            const value = cells[col] ?? null;
            const hidden = col >= revealedCols || value === null;
            const state: EntityState = hidden
                ? "unvisited"
                : col === current
                  ? "active"
                  : "sorted";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell",
                label: hidden ? "?" : fmt(value),
                value: value ?? -1,
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

/** Run the constant-state WKV recurrence, one timestep at a time. */
function recurrent(keys: number[], values: number[], decay: number) {
    const numerator: number[] = [];
    const denominator: number[] = [];
    const output: number[] = [];
    let num = 0;
    let den = 0;
    for (let t = 0; t < keys.length; t += 1) {
        num = Math.exp(decay) * num + Math.exp(keys[t] ?? 0) * (values[t] ?? 0);
        den = Math.exp(decay) * den + Math.exp(keys[t] ?? 0);
        numerator.push(num);
        denominator.push(den);
        output.push(num / den);
    }
    return { numerator, denominator, output };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { keys?: number[]; values?: number[]; decay?: number } | null
    ) ?? {};
    const keys = task.keys?.length
        ? task.keys
        : [0.5, -0.3, 0.8, 0.1, -0.6, 0.4];
    const values = task.values?.length
        ? task.values
        : [1, 0.2, 0.7, -0.4, 0.5, 0.9];
    const decay = typeof task.decay === "number" ? Math.min(0, task.decay) : -0.5;
    const n = Math.min(keys.length, values.length);
    const k = keys.slice(0, n);
    const v = values.slice(0, n);
    const result = recurrent(k, v, decay);

    const matrix: Cell[][] = [k, v, result.numerator, result.denominator, result.output];
    const base = { rows: 5, cols: n, timesteps: n, decay };
    yield {
        stepNumber: 0,
        entities: makeCells(matrix, 0, -1),
        edges: [],
        description: `Initialize the WKV recurrent state to zero with decay ${decay}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", outputs: result.output.map(fmt) },
    };
    for (let t = 0; t < n; t += 1) {
        yield {
            stepNumber: t + 1,
            entities: makeCells(matrix, t + 1, t),
            edges: [],
            description: `Step ${t}: num = exp(w) * num + exp(k) * v = ${fmt(result.numerator[t] ?? 0)}, den = ${fmt(result.denominator[t] ?? 0)}, so wkv = ${fmt(result.output[t] ?? 0)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                ...base,
                phase: "recurrence",
                timestep: t,
                outputs: result.output.map(fmt),
            },
        };
    }
    yield {
        stepNumber: n + 1,
        entities: makeCells(matrix, n, -1),
        edges: [],
        description: `Final WKV outputs: [${result.output.map(fmt).join(", ")}].`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { ...base, phase: "done", outputs: result.output.map(fmt) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "RWKV replaces quadratic attention with a recurrence that carries a running weighted sum of past keys and values. Each new token is mixed in, older contributions are multiplied by a fixed decay, and the ratio of the two running sums is the output. This gives attention-like mixing with constant state per channel.",
        invariants: [
            "The numerator accumulates exp(key) times value with exponential decay on older terms.",
            "The denominator accumulates exp(key) with the same decay, so each output is a weighted average.",
            "The decay is nonpositive, preventing old contributions from growing without bound.",
        ],
        correctness:
            "Unrolling the recurrence gives numerator at time t as the sum over i up to t of exp(decay times (t minus i) plus key_i) times value_i, and the denominator as the same sum without value_i. The ratio is exactly a causal softmax attention with an exponential distance penalty, so the recurrent form and the direct O(t squared) form agree at every step.",
        complexityRationale:
            "Each timestep performs a constant number of updates to the numerator and denominator, so the recurrence runs in O(t) time with O(1) state per channel. The equivalent direct sum would touch all earlier timesteps and cost O(t squared).",
        uses: [
            "Language modeling with linear-time attention-like mixing",
            "Streaming inference with a fixed-size recurrent state",
            "A teaching model of the WKV operator inside RWKV blocks",
        ],
        references: [
            "Peng et al., RWKV: Reinventing RNNs for the Transformer Era, 2023",
            "Peng et al., RWKV 7: An Open Source Large Language Model, 2024",
        ],
        workedExample:
            "With decay minus 0.5, key 0.5 and value 1 give num = 1.65 and den = 1.65, so the first output is 1. At the next step the old state is multiplied by exp minus 0.5 and the new key and value are added, producing a weighted average of the two values.",
    },
    id: "rwkv",
    name: "RWKV (WKV Linear-Attention Core)",
    category: "ml-ai",
    complexity: { time: "O(t)", space: "O(1)" },
    defaultInput: {
        keys: [0.5, -0.3, 0.8, 0.1, -0.6, 0.4],
        values: [1, 0.2, 0.7, -0.4, 0.5, 0.9],
        decay: -0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "set the numerator and denominator state to zero",
        "for each timestep with key k and value v",
        "multiply the state by the decay factor exp(w)",
        "add exp(k) times v to the numerator and exp(k) to the denominator",
        "emit the ratio of numerator to denominator as the output",
        "done: report the WKV output at every timestep",
    ],
};

export default module;
