/**
 * s5-model.ts - S5 Simplified State Space Layer
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * S5 replaces the structured state matrix of S4 with a diagonal one and uses a
 * parallel scan over the sequence. Each state channel is an independent first
 * order system whose step size can depend on the input ("liquid" discretization).
 * The output is a learned readout of the state plus a skip connection.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * d) sequentially, O(log T * d) with a parallel associative scan
 *   Space: O(T * d) for the full scanned trajectory
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each row is a state channel and each column a time step.
 *   - The newest column is highlighted as the scan proceeds.
 *   - The frame meta carries the full state and output trajectory.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface S5Input {
    sequence?: number[];
    diagA?: number[];
    B?: number[];
    C?: number[];
    D?: number;
    dt?: number;
    dtSlope?: number;
}

/** Zero-order-hold discretization of a single diagonal channel. */
export function s5Discrete(a: number, b: number, dt: number): { aBar: number; bBar: number } {
    const aBar = Math.exp(a * dt);
    const bBar = Math.abs(a) < 1e-12 ? dt * b : ((aBar - 1) / a) * b;
    return { aBar, bBar };
}

/** One recurrence step: advance the state, then read out the output. */
export function s5Step(state: number[], aBar: number[], bBar: number[], u: number, C: number[], D: number): { state: number[]; output: number } {
    const next = state.map((s, i) => (s * (aBar[i] ?? 1)) + (bBar[i] ?? 0) * u);
    let output = D * u;
    for (let i = 0; i < next.length; i += 1) {
        output += (C[i] ?? 0) * (next[i] ?? 0);
    }
    return { state: next, output };
}

/** Full sequential scan; equivalent to the associative scan used in S5. */
export function s5Scan(input: S5Input): { states: number[][]; outputs: number[]; steps: number[] } {
    const sequence = input.sequence ?? [1, -0.5, 2, -1.5, 0.5, 0.8];
    const diagA = input.diagA ?? [-1, -2, -3, -4];
    const B = input.B ?? diagA.map(() => 1);
    const C = input.C ?? diagA.map((_, i) => 1 / (i + 1));
    const D = input.D ?? 0;
    const dt = input.dt ?? 0.2;
    const dtSlope = input.dtSlope ?? 0.05;
    let state = diagA.map(() => 0);
    const states: number[][] = [];
    const outputs: number[] = [];
    const steps: number[] = [];
    for (const u of sequence) {
        const currentDt = Math.max(0.01, dt + dtSlope * u);
        const disc = diagA.map((a, i) => s5Discrete(a, B[i] ?? 1, currentDt));
        const result = s5Step(state, disc.map((d) => d.aBar), disc.map((d) => d.bBar), u, C, D);
        state = result.state;
        states.push([...state]);
        outputs.push(result.output);
        steps.push(currentDt);
    }
    return { states, outputs, steps };
}

function makeCells(states: number[][], diagA: number[], d: number, T: number, t: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < d; row += 1) {
        for (let col = 0; col < T; col += 1) {
            const value = states[col]?.[row] ?? 0;
            entities.push({
                id: `state-${row}-${col}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state: col === t ? "active" : col < t ? "visited" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, channel: row, time: col, rate: diagA[row] ?? 0 },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as S5Input | null) ?? {};
    const sequence = Array.isArray(task.sequence) && task.sequence.length > 0
        ? task.sequence.map(Number)
        : [1, -0.5, 2, -1.5, 0.5, 0.8];
    const diagA = Array.isArray(task.diagA) && task.diagA.length > 0
        ? task.diagA.map(Number)
        : [-1, -2, -3, -4];
    const d = diagA.length;
    const T = sequence.length;
    const result = s5Scan({ ...task, sequence, diagA });
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(result.states, diagA, d, T, -1),
        edges: [],
        description: `S5 scan over ${T} steps with ${d} diagonal state channels; all states are zero.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: d, cols: T, d, T, t: -1, states: result.states, outputs: result.outputs, rates: diagA },
    };
    step += 1;

    for (let t = 0; t < T; t += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result.states, diagA, d, T, t),
            edges: [],
            description: `Step ${t}: u=${sequence[t]?.toFixed(2)}, dt=${(result.steps[t] ?? 0).toFixed(3)}, output=${(result.outputs[t] ?? 0).toFixed(3)}.`,
            codeLineNumber: t === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                rows: d,
                cols: T,
                d,
                T,
                t,
                steps: result.steps,
                states: result.states,
                outputs: result.outputs,
                rates: diagA,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.states, diagA, d, T, T - 1),
        edges: [],
        description: `Completed the scan; final readout y=${(result.outputs[T - 1] ?? 0).toFixed(3)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: d, cols: T, d, T, t: T - 1, states: result.states, outputs: result.outputs, rates: diagA },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "S5 makes the state-space recurrence cheap by giving each hidden channel its own scalar decay. Because channels do not interact, a long sequence can be scanned with an associative parallel prefix operation instead of a slow loop. An input-dependent step size lets the model choose how much history to keep at each moment.",
        invariants: [
            "Each state channel evolves independently under its own scalar decay.",
            "The discrete update is the exact zero-order-hold solution of the continuous system for a fixed step.",
            "With a fixed step the whole system is linear in the input sequence.",
        ],
        correctness:
            "For a diagonal A the matrix exponential is the elementwise exponential exp(a dt), and the zero-order-hold input coefficient is (exp(a dt) - 1) / a times b. Each recurrence step therefore equals the exact solution of x' = a x + b u over that interval. A parallel associative scan composes these affine updates in the same order as the sequential loop, preserving the result.",
        complexityRationale:
            "A sequential pass does O(d) work at each of T steps, giving O(T d). The associative scan reduces the depth to O(log T) while keeping O(T d) work, and the stored trajectory uses O(T d) space.",
        uses: [
            "Long-sequence language modeling with linear-time inference",
            "Time-series forecasting with input-dependent memory",
            "Audio and sensor stream processing",
        ],
        references: [
            "Smith, Warrington, Smolensky, Simplified State Space Layers for Sequence Modeling, ICLR 2023",
            "Blelloch, Prefix Sums and Their Applications, 1990",
        ],
        workedExample:
            "For a channel with a=-1, b=1 and dt=0.2, exp(-0.2)=0.8187 and b-bar=(0.8187-1)/(-1)=0.1813. A single input of 2 from a zero state gives state 0.3627 and, with readout C=1, an output of 0.3627.",
    },
    id: "s5-model",
    name: "S5 Simplified State Space Layer",
    category: "ml-ai",
    complexity: { time: "O(T * d)", space: "O(T * d)" },
    defaultInput: {
        sequence: [1, -0.5, 2, -1.5, 0.5, 0.8],
        diagA: [-1, -2, -3, -4],
        B: [1, 1, 1, 1],
        C: [1, 0.5, 0.25, 0.125],
        D: 0,
        dt: 0.2,
        dtSlope: 0.05,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "choose a decay and input coefficient for every state channel",
        "initialize all hidden states to zero",
        "for each input sample in the sequence",
        "compute the liquid step size from the current sample",
        "discretize each channel with exp(a times dt)",
        "advance every state with its own decay and input gate",
        "read out a weighted sum of the states plus a skip term",
        "done: return the full state and output trajectory",
    ],
};

export default module;
