/**
 * s4-structured-state-space.ts - Discretized Structured State-Space Recurrence
 *
 * Scope: S4 (Structured State Space Sequence model) uses a structured state
 * matrix plus an FFT-based convolution to model long sequences in O(N log N)
 * time. This teaches the exact linear core: a diagonal continuous-time state
 * space discretized with zero-order hold, then run as a recurrence. It does NOT
 * implement the HiPPO-Legendre structured matrix in full, the Cauchy kernel, or
 * the CUDA convolution kernels; those are implementation details of the paper.
 *
 * Time:  O(T * N) for sequence length T and state size N
 * Space: O(N) for the state vector
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface S4Input {
    stateSize?: number;
    steps?: number;
    dt?: number;
    seed?: number;
}

/** Seeded values in [-1, 1]. */
function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 1000) / 1000;
    };
}

/** One state-vector bar chart for a frame. */
function makeBars(state: number[], output: number): VisualEntity[] {
    return state.map((value, index) => ({
        id: `state-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: "active" as const,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, output },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as S4Input | null) ?? {};
    const N = Math.max(1, Math.min(Math.trunc(task.stateSize ?? 4), 8));
    const T = Math.max(1, Math.min(Math.trunc(task.steps ?? 8), 24));
    const dt = typeof task.dt === "number" && task.dt > 0 ? task.dt : 0.1;
    const seed = typeof task.seed === "number" ? Math.trunc(task.seed) : 7;
    const next = weightStream(seed);

    const A = Array.from({ length: N }, (_v, i) => -(i + 1));
    const B = Array.from({ length: N }, next);
    const C = Array.from({ length: N }, next);
    const D = next();
    const u = Array.from({ length: T }, (_v, t) => (((t * 3) % 7) - 3) / 3);

    // Zero-order-hold discretization of a diagonal continuous system.
    const Abar = A.map((a) => Math.exp(a * dt));
    const Bbar = A.map((a, i) => (Math.abs(a) < 1e-12 ? (B[i] ?? 0) * dt : ((B[i] ?? 0) * ((Abar[i] ?? 0) - 1)) / a));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(Array(N).fill(0), 0),
        edges: [],
        description: `Discretizing a diagonal state space of size ${N} with zero-order hold and step ${dt}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { N, T, dt, A, B, C, D, u, Abar, Bbar, x: Array(N).fill(0), y: 0, ySequence: [] },
    };
    step += 1;

    const x = Array(N).fill(0);
    const ySequence: number[] = [];
    for (let t = 0; t < T; t += 1) {
        const y = x.reduce((sum, xi, i) => sum + (C[i] ?? 0) * xi, 0) + D * (u[t] ?? 0);
        ySequence.push(y);
        yield {
            stepNumber: step,
            entities: makeBars([...x], y),
            edges: [],
            description: `Step ${t}: output y = C dot x + D u = ${y.toFixed(4)}; state advanced by the discretized recurrence.`,
            codeLineNumber: t === T - 1 ? 4 : 3,
            layout: "array",
            meta: { N, T, dt, A, B, C, D, u, Abar, Bbar, x: [...x], y, ySequence: [...ySequence] },
        };
        step += 1;

        for (let i = 0; i < N; i += 1) {
            x[i] = (Abar[i] ?? 0) * (x[i] ?? 0) + (Bbar[i] ?? 0) * (u[t] ?? 0);
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars([...x], 0),
        edges: [],
        description: `Done: ${T} outputs produced from an ${N}-dimensional recurrent state.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { N, T, dt, A, B, C, D, u, Abar, Bbar, x: [...x], y: 0, ySequence: [...ySequence] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A state-space model keeps a small hidden state that summarizes the past and updates it with each input. S4 chooses a structured state matrix so the whole sequence can be processed as a fast convolution, but the underlying computation is still the same linear recurrence. Zero-order hold converts the continuous-time system into discrete steps we can run exactly.",
        invariants: [
            "Each state component follows x(t+1) = Abar * x(t) + Bbar * u(t).",
            "Each output is y(t) = C dot x(t) + D * u(t).",
            "The state starts at zero and depends only on inputs seen so far.",
        ],
        correctness:
            "Zero-order hold gives Abar = exp(A dt) and Bbar = B (exp(A dt) - 1) / A for a diagonal system, which is the exact integral of the continuous dynamics over one step. Unrolling the recurrence shows y(t) is the convolution of the input with the kernel C Abar^k Bbar plus the direct term D u(t); computing that convolution independently reproduces every output.",
        complexityRationale:
            "Each of the T steps updates N state components and forms one output, so time is O(T * N). Only the N-dimensional state vector is carried between steps, giving O(N) space.",
        uses: [
            "Long-sequence modeling in structured state-space neural networks",
            "Efficient sequence encoders with linear or near-linear scaling",
            "Teaching the connection between differential equations and recurrences",
        ],
        references: [
            "Gu et al., Combining Recurrent, Convolutional, and Continuous-Time Models with Linear State Space Layers, 2021",
            "Gu, Goel and Re, Efficiently Modeling Long Sequences with Structured State Spaces, 2022",
        ],
        workedExample:
            "With a two-dimensional state, A = (-1, -2) and dt = 0.1 gives Abar about (0.905, 0.819). A constant input raises each state component toward its steady value Bbar u / (1 - Abar), and the output at each step is the weighted sum C dot x plus the direct contribution D u.",
    },
    id: "s4-structured-state-space",
    name: "S4 Structured State Space (Recurrence)",
    category: "ml-ai",
    complexity: { time: "O(T * N)", space: "O(N)" },
    defaultInput: { stateSize: 4, steps: 8, dt: 0.1, seed: 7 },
    visualType: "array",
    run,
    pseudocode: [
        "choose a diagonal state matrix and discretize with zero-order hold",
        "compute Abar equals exp of A times dt and Bbar from Abar",
        "initialize the state vector to zero",
        "for each input step compute output as C dot x plus D times u",
        "advance the state with Abar times x plus Bbar times u",
        "done: report the full output sequence",
    ],
};

export default module;
