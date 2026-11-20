/**
 * mamba-2.ts - Selective State-Space Duality (SSD) Scan Core
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Mamba-2 frames selective state-space models through the SSD duality: the same
 * linear recurrence can be computed either sequentially or as a structured
 * (semiseparable) matrix product. At each time step the state is updated by a
 * data-dependent decay a_t and input b_t times x_t, then read out by c_t. The
 * decay being input-dependent is what makes the model selective. This module
 * computes the output by the closed-form SSD sum
 *     y_i = c_i * (P_i * h0 + sum_{j<=i} (P_i / P_j) * b_j * x_j),
 * where P_i is the product of decays up to i. A brute-force sequential scan
 * reproduces exactly the same values. This is the teachable algorithmic core
 * of Mamba-2, not the full GPU chunked-scan implementation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n^2) for the direct pairwise SSD sum (O(n) for the sequential scan)
 *   Space: O(n) for the input, decay gates, state, and output sequences
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Two bars per time step show the state h_t and the readout y_t.
 *   - The current step is active; earlier steps are marked as computed.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface MambaInput {
    x?: number[];
    a?: number[];
    b?: number[];
    c?: number[];
    h0?: number;
}

function makeBars(h: number[], y: number[], current: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < h.length; i += 1) {
        const state: EntityState = i === current ? "active" : i < current ? "sorted" : "unvisited";
        entities.push({
            id: `h-${i}`,
            type: "bar" as const,
            label: `h${i}=${(h[i] ?? 0).toFixed(2)}`,
            value: Number((h[i] ?? 0).toFixed(6)),
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, series: "state" },
        });
        entities.push({
            id: `y-${i}`,
            type: "bar" as const,
            label: `y${i}=${(y[i] ?? 0).toFixed(2)}`,
            value: Number((y[i] ?? 0).toFixed(6)),
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, series: "output" },
        });
    }
    return entities;
}

/** Compute the selective scan output through the closed-form SSD sum. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as MambaInput | null) ?? {};
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [1, 2, 3, 4];
    const n = x.length;
    const a: number[] = Array.isArray(task.a) && task.a.length === n ? task.a.slice() : x.map((_v, i) => 0.9 - i * 0.1);
    const b: number[] = Array.isArray(task.b) && task.b.length === n ? task.b.slice() : x.map(() => 1);
    const c: number[] = Array.isArray(task.c) && task.c.length === n ? task.c.slice() : x.map(() => 1);
    const h0 = typeof task.h0 === "number" ? task.h0 : 0;

    const prefix: number[] = new Array<number>(n).fill(1);
    for (let i = 0; i < n; i += 1) {
        prefix[i] = (i === 0 ? 1 : (prefix[i - 1] ?? 1)) * (a[i] ?? 0);
    }

    const h = new Array<number>(n).fill(0);
    const y = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        let contribution = (prefix[i] ?? 0) * h0;
        for (let j = 0; j <= i; j += 1) {
            const pj = prefix[j] ?? 0;
            if (Math.abs(pj) < 1e-12) {
                continue;
            }
            contribution += ((prefix[i] ?? 0) / pj) * (b[j] ?? 0) * (x[j] ?? 0);
        }
        h[i] = Number(contribution.toFixed(9));
        y[i] = Number(((c[i] ?? 0) * contribution).toFixed(9));
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(h.map(() => 0), y.map(() => 0), -1),
        edges: [],
        description: `Selective scan over ${n} steps using the SSD closed form; decays are data dependent.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, x: x.slice(), a: a.slice(), b: b.slice(), c: c.slice(), h0, h: [], y: [] },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeBars(h, y, i),
            edges: [],
            description: `Step ${i}: decay a=${(a[i] ?? 0).toFixed(2)}, input b*x=${((b[i] ?? 0) * (x[i] ?? 0)).toFixed(2)}; state h=${(h[i] ?? 0).toFixed(3)}, readout y=${(y[i] ?? 0).toFixed(3)}.`,
            codeLineNumber: i === n - 1 ? 6 : 4,
            layout: "array",
            meta: {
                n,
                x: x.slice(),
                a: a.slice(),
                b: b.slice(),
                c: c.slice(),
                h0,
                h: h.slice(0, i + 1),
                y: y.slice(0, i + 1),
                step: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(h, y, -1),
        edges: [],
        description: `Done: ${n} state and output values computed; the sequential scan gives the same sequence.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, x: x.slice(), a: a.slice(), b: b.slice(), c: c.slice(), h0, h: h.slice(), y: y.slice() },
    };
}

/** The Mamba-2 SSD module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A state-space model keeps a hidden state that decays a little each step and absorbs a scaled input. Mamba makes the decay depend on the current input, which lets the model decide what to remember or forget. Mamba-2 notices that unrolling this recurrence produces a structured matrix where each output is a weighted sum of earlier inputs, so the same computation can be done as a parallel sum instead of a strict loop.",
        invariants: [
            "The state update is h_t = a_t times h_{t-1} plus b_t times x_t.",
            "The readout is y_t = c_t times h_t, with no nonlinear activation.",
            "The closed-form product of decays gives the same output as the sequential recurrence.",
        ],
        correctness:
            "Let P_i be the product of decays a_0 through a_i. Unrolling the recurrence gives h_i = P_i h0 plus the sum over j at most i of P_i over P_j times b_j x_j, which is exactly the SSD sum computed by the module. Multiplying by c_i yields y_i. A direct step-by-step scan applies the same updates in a different order; by induction on i both produce identical states and outputs.",
        complexityRationale:
            "The displayed closed form sums over all earlier steps for each output, costing O(n squared) time and O(n) space for the prefix products. The equivalent sequential recurrence needs only O(n) time and O(1) working state, which is the form an optimized chunked implementation accelerates on hardware.",
        uses: [
            "Long-context language models with linear-time inference",
            "Selective sequence modeling where the model gates memory by content",
            "Teaching the equivalence of recurrences and structured matrix products",
        ],
        references: [
            "Dao and Gu, Transformers are SSMs: Generalized Models and Efficient Algorithms, 2024",
            "Gu and Dao, Mamba: Linear-Time Sequence Modeling with Selective State Spaces, 2023",
        ],
        workedExample:
            "With x = 1, 2, 3, 4, decays 0.9, 0.8, 0.7, 0.6 and all b and c equal to one, the prefix products are 0.9, 0.72, 0.504, 0.3024. The first state is 1 and the second is 0.9 times 1 plus 2, giving 2.9; the closed-form sum produces the same value, and the readout c times h equals the state.",
    },
    id: "mamba-2",
    name: "Mamba-2 (SSD Scan Core)",
    category: "ml-ai",
    complexity: { time: "O(n^2)", space: "O(n)" },
    defaultInput: {
        x: [1, 2, 3, 4],
        a: [0.9, 0.8, 0.7, 0.6],
        b: [1, 1, 1, 1],
        c: [1, 1, 1, 1],
        h0: 0,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the input, decays a, input gates b, and readouts c",
        "compute prefix products P of the decays",
        "for each time step i",
        "sum P_i over P_j times b_j times x_j for all j at most i",
        "add P_i times the initial state to get state h_i",
        "set output y_i to c_i times h_i",
        "done: report the state and output sequences",
    ],
};

export default module;
