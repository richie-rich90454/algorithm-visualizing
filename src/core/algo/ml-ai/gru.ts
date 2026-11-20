/**
 * gru.ts - Gated Recurrent Unit Cell Step
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A GRU cell updates a hidden state with two learned gates. The reset gate
 * decides how much of the previous state to expose to a candidate update, and
 * the update gate decides how much of the candidate to blend into the new
 * state. This module runs one cell over a short input sequence and exposes the
 * exact gate values, candidate, and hidden state at every time step.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * d_h * (d_h + d_x)) for T steps
 *   Space: O(T * d_h) for the stored hidden trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows the hidden state as two grid cells.
 *   - meta carries the update gate, reset gate, candidate, and new state.
 *   - The final frame reports the full hidden trajectory.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Input {
    h0?: number[];
    sequence?: number[][];
}

export const GRU_PARAMS = {
    Wz: [
        [1, 0, 0.5, -0.5],
        [0, 1, -0.3, 0.4],
    ],
    Wr: [
        [0, -1, 0.8, 0.2],
        [1, 0, -0.6, 0.5],
    ],
    Wh: [
        [0.6, 0, 1, 0.2],
        [0, 0.7, -0.1, 1],
    ],
    bz: [0, 0],
    br: [0, 0],
    bh: [0, 0],
};

const sigmoid = (v: number): number => 1 / (1 + Math.exp(-v));
const dot = (row: number[], v: number[]): number => row.reduce((sum, w, i) => sum + w * (v[i] ?? 0), 0);

/** One GRU cell update: reset, candidate, update, and blend. */
export function gruStep(hPrev: number[], x: number[]) {
    const concat = [...hPrev, ...x];
    const z = GRU_PARAMS.Wz.map((row, i) => sigmoid(dot(row, concat) + (GRU_PARAMS.bz[i] ?? 0)));
    const r = GRU_PARAMS.Wr.map((row, i) => sigmoid(dot(row, concat) + (GRU_PARAMS.br[i] ?? 0)));
    const resetState = hPrev.map((value, i) => value * (r[i] ?? 0));
    const candidateInput = [...resetState, ...x];
    const hTilde = GRU_PARAMS.Wh.map((row, i) => Math.tanh(dot(row, candidateInput) + (GRU_PARAMS.bh[i] ?? 0)));
    const h = hPrev.map((value, i) => (1 - (z[i] ?? 0)) * value + (z[i] ?? 0) * (hTilde[i] ?? 0));
    return { h, z, r, hTilde };
}

const flatten = (rows: number[][]): number[] => rows.reduce<number[]>((acc, row) => acc.concat(row), []);

function makeCells(state: number[]): VisualEntity[] {
    return state.map((value, i) => ({
        id: `hidden-${i}`,
        type: "cell" as const,
        label: value.toFixed(2),
        value,
        state: "active" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i, dim: i },
    }));
}

/** The GRU cell generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const h0 = task.h0 ?? [0, 0];
    const sequence = task.sequence ?? [
        [1, 0],
        [0, 1],
        [-1, 0.5],
    ];
    let h = h0.slice();
    const trajectory: number[][] = [h.slice()];
    const gates: number[][] = [];
    const resets: number[][] = [];
    const candidates: number[][] = [];

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(h),
        edges: [],
        description: `Initialize the ${h.length}-unit hidden state and process ${sequence.length} input step(s).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: 1,
            cols: h.length,
            d: h.length,
            steps: sequence.length,
            phase: "setup",
            trajectory: flatten(trajectory),
            gates: [],
            resets: [],
            candidates: [],
        },
    };
    step += 1;

    for (let t = 0; t < sequence.length; t += 1) {
        const result = gruStep(h, sequence[t] ?? []);
        h = result.h;
        trajectory.push(h.slice());
        gates.push(result.z);
        resets.push(result.r);
        candidates.push(result.hTilde);
        yield {
            stepNumber: step,
            entities: makeCells(h),
            edges: [],
            description: `Step ${t}: update gate [${result.z.map((v) => v.toFixed(2)).join(", ")}], reset gate [${result.r.map((v) => v.toFixed(2)).join(", ")}], hidden [${h.map((v) => v.toFixed(2)).join(", ")}].`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: 1,
                cols: h.length,
                d: h.length,
                steps: sequence.length,
                phase: "step",
                t,
                trajectory: flatten(trajectory),
                gates: flatten(gates),
                resets: flatten(resets),
                candidates: flatten(candidates),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(h),
        edges: [],
        description: `Done: final hidden state [${h.map((v) => v.toFixed(2)).join(", ")}] after ${sequence.length} GRU step(s).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: 1,
            cols: h.length,
            d: h.length,
            steps: sequence.length,
            phase: "done",
            trajectory: flatten(trajectory),
            gates: flatten(gates),
            resets: flatten(resets),
            candidates: flatten(candidates),
            converged: true,
        },
    };
}

/** The GRU module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A plain recurrent network multiplies the previous hidden state by a weight matrix at every step, which makes long dependencies hard to keep. A GRU adds gates: one decides what to forget from the old state, another decides how much of a fresh candidate to write. The new state is a convex blend of the old state and the candidate, so the cell can choose to hold information across many time steps.",
        invariants: [
            "Both gates are sigmoid outputs and therefore lie strictly between zero and one.",
            "The candidate is a tanh output and therefore lies between minus one and one.",
            "Each new hidden unit is a convex combination of its old value and its candidate.",
        ],
        correctness:
            "The reset gate multiplies the previous state before it enters the candidate, exactly as in the GRU equations. The update gate then forms h_t = (1 - z_t) * h_{t-1} + z_t * h~_t. Since z_t is in (0, 1), this is a convex combination; if the previous state and candidate are both in [-1, 1], the new state stays there. Replaying the same matrix products and nonlinearities independently yields every reported gate and hidden value exactly.",
        complexityRationale:
            "Each step multiplies three matrices of shape d_h by (d_h + d_x), costing O(d_h * (d_h + d_x)), and T steps multiply that by T. Storing the hidden trajectory and gate values takes O(T * d_h) space.",
        uses: [
            "Sequence modeling where long-range dependencies matter",
            "Language modeling and machine translation before transformers",
            "A compact recurrent alternative to LSTM in small models",
        ],
        references: [
            "Cho et al., Learning Phrase Representations using RNN Encoder-Decoder, 2014",
            "Chung et al., Empirical Evaluation of Gated Recurrent Neural Networks, 2014",
        ],
        workedExample:
            "From a hidden state of (0, 0) with input (1, 0), the update gate computed from the concatenated vector is about 0.62 in the first unit and 0.43 in the second. The candidate is a tanh of a linear combination, and the new state blends the old zeros with that candidate by those gate amounts.",
    },
    id: "gru",
    name: "GRU Cell Step",
    category: "ml-ai",
    complexity: { time: "O(T * d_h * (d_h + d_x))", space: "O(T * d_h)" },
    defaultInput: { h0: [0, 0], sequence: [[1, 0], [0, 1], [-1, 0.5]] },
    visualType: "grid",
    run,
    pseudocode: [
        "start from the initial hidden state",
        "concatenate the previous state with the current input",
        "compute the update gate with a sigmoid",
        "compute the reset gate with a sigmoid",
        "form the candidate with tanh over the reset state and input",
        "blend old state and candidate with the update gate",
        "advance to the next input step",
        "done: report the final hidden state and trajectory",
    ],
};

export default module;
