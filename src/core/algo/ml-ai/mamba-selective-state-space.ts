/**
 * mamba-selective-state-space.ts - Selective State-Space Scan (Teachable Core)
 *
 * This module implements the input-dependent recurrence at the heart of Mamba:
 * a discrete state h_t = a_t*h_{t-1} + delta_t*x_t whose step size delta_t and
 * decay a_t depend on the current input. It is a scalar teaching model of the
 * selective scan, not a full Mamba block with convolutions and learned gates.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const FIELDS = ["x", "delta", "decay", "state h", "output y"] as const;

export interface ScanStep {
    x: number;
    delta: number;
    decay: number;
    h: number;
    y: number;
}

/** Run the scalar selective scan: delta = sigmoid(x), decay = exp(-delta). */
export function selectiveScan(xs: number[]): ScanStep[] {
    const steps: ScanStep[] = [];
    let h = 0;
    for (const x of xs) {
        const delta = 1 / (1 + Math.exp(-x));
        const decay = Math.exp(-delta);
        h = decay * h + delta * x;
        steps.push({ x, delta, decay, h, y: h });
    }
    return steps;
}

/** Build one grid row per timestep with its five fields. */
function makeCells(steps: ScanStep[], revealed: number, current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let t = 0; t < steps.length; t += 1) {
        const step = steps[t];
        if (!step) {
            continue;
        }
        const values = [step.x, step.delta, step.decay, step.h, step.y];
        for (let c = 0; c < FIELDS.length; c += 1) {
            const shown = t <= revealed;
            const state: EntityState = t === current ? "comparing" : shown ? "sorted" : "idle";
            entities.push({
                id: `cell-${t}-${c}`,
                type: "cell",
                label: shown ? (values[c] ?? 0).toFixed(3) : "?",
                value: shown ? (values[c] ?? 0) : 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: t, col: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { sequence?: number[] } | null) ?? {};
    const xs: number[] = Array.isArray(task.sequence) && task.sequence.length > 0
        ? task.sequence
        : [1, -0.5, 2, -1.5, 0.5, -2];
    const steps = selectiveScan(xs);
    const metaBase = { rows: steps.length, cols: FIELDS.length };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(steps, -1, -1),
        edges: [],
        description: `Selective scan over ${xs.length} inputs: each step size depends on the current token (teaching core of Mamba).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...metaBase, sequence: xs },
    };
    step += 1;

    for (let t = 0; t < steps.length; t += 1) {
        const s = steps[t];
        yield {
            stepNumber: step,
            entities: makeCells(steps, t, t),
            edges: [],
            description: `t=${t}: x=${(s?.x ?? 0).toFixed(2)}, delta=sigmoid(x)=${(s?.delta ?? 0).toFixed(3)}, decay=exp(-delta)=${(s?.decay ?? 0).toFixed(3)}, new state=${(s?.h ?? 0).toFixed(3)}.`,
            codeLineNumber: t === 0 ? 1 : 2,
            layout: "grid",
            meta: { ...metaBase, sequence: xs, delta: s?.delta, decay: s?.decay, state: s?.h, output: s?.y },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(steps, steps.length - 1, -1),
        edges: [],
        description: `Done: emitted ${steps.length} outputs from the selective recurrence.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { ...metaBase, sequence: xs, outputs: steps.map((s) => s.y), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A state-space model carries a hidden state forward by repeatedly applying a decay and adding the current input. Mamba makes the step size depend on the input itself, so the model can choose to keep or forget information at each token. Large inputs produce a larger step size and a shorter memory; small ones let the state persist.",
        invariants: [
            "The step size delta is sigmoid(x) and always lies in (0, 1).",
            "The decay exp(-delta) also lies in (0, 1), so the state is a stable contraction plus a drive.",
            "The output y_t equals the hidden state h_t for this scalar model.",
        ],
        correctness:
            "The scan is a direct sequential evaluation of the recurrence h_t = exp(-delta_t)*h_{t-1} + delta_t*x_t with h_0 driven by the first input. Because each step uses only the previous state and the current input, an independent loop that applies the same formula reproduces every stored state and output exactly; there is no hidden approximation in the teaching model.",
        complexityRationale:
            "A single pass over the sequence performs O(1) work per token, so the time is O(L) for length L and the stored state is O(1). Real Mamba parallelizes this associative scan across L tokens on hardware, but the sequential semantics are identical.",
        uses: [
            "Efficient long-sequence modeling in Mamba language models",
            "Linear-time alternatives to attention for audio and genomics",
            "A teaching model for input-dependent (selective) state updates",
        ],
        references: [
            "Gu and Dao, Mamba: Linear-Time Sequence Modeling with Selective State Spaces, 2023",
            "Gu et al., Efficiently Modeling Long Sequences with Structured State Spaces (S4), ICLR 2022",
        ],
        workedExample:
            "For x = 1 the step size is sigmoid(1) about 0.73 and the decay about 0.48, so h = 0.48*0 + 0.73*1 = 0.73. A following x = -0.5 gives delta about 0.38 and decay about 0.68, so the new state is 0.68*0.73 + 0.38*(-0.5) about 0.31, showing the input-dependent forgetting.",
    },
    id: "mamba-selective-state-space",
    name: "Mamba Selective State Space",
    category: "ml-ai",
    complexity: { time: "O(L)", space: "O(1)" },
    defaultInput: { sequence: [1, -0.5, 2, -1.5, 0.5, -2] },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize hidden state h to zero",
        "for the first input compute delta as sigmoid of x",
        "for later inputs recompute delta from the current x",
        "set the decay to exp of negative delta",
        "update h to decay times h plus delta times x",
        "emit the output y equal to the new state h",
        "done: report all emitted outputs",
    ],
};

export default module;
