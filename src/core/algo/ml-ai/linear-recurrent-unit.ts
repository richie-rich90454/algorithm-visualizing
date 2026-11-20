/**
 * linear-recurrent-unit.ts - Linear Recurrent Unit
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Linear Recurrent Unit (LRU) is a state-space sequence model with a
 * diagonal linear recurrence. Each channel keeps a hidden state that decays by
 * a learned factor and is driven by the input; the output mixes the state and
 * the current input. Because the recurrence is linear it can be computed
 * either step by step or as a parallel scan.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L * d) for sequence length L and width d
 *   Space: O(d) for the hidden state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the hidden state and output at each time step, so the decay
 *     and drive of the recurrence are visible over the sequence.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LruInput {
    sequence?: number[];
    a?: number;
    b?: number;
    c?: number;
    d?: number;
}

/** Run a scalar LRU recurrence and return hidden states and outputs. */
export function lruRun(
    sequence: number[],
    a: number,
    b: number,
    c: number,
    d: number,
): { states: number[]; outputs: number[] } {
    const states: number[] = [];
    const outputs: number[] = [];
    let h = 0;
    for (const x of sequence) {
        h = a * h + b * x;
        states.push(h);
        outputs.push(c * h + d * x);
    }
    return { states, outputs };
}

/** Closed-form contribution of each past input to the current state. */
export function lruClosedFormState(sequence: number[], a: number, b: number): number[] {
    return sequence.map((_x, t) => {
        let sum = 0;
        for (let s = 0; s <= t; s += 1) sum += Math.pow(a, t - s) * b * (sequence[s] ?? 0);
        return sum;
    });
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LruInput | null) ?? {};
    const sequence: number[] = task.sequence ?? [1, 0.5, -0.5, 1, 0];
    const a = typeof task.a === "number" ? task.a : 0.8;
    const b = typeof task.b === "number" ? task.b : 1;
    const c = typeof task.c === "number" ? task.c : 1;
    const d = typeof task.d === "number" ? task.d : 0.2;
    const { states, outputs } = lruRun(sequence, a, b, c, d);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(sequence, sequence.map(() => "unvisited")),
        edges: [],
        description: `Read a length-${sequence.length} sequence with decay a=${a} and drive b=${b}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", a, b, c, d, states: [], outputs: [] },
    };
    step += 1;

    for (let t = 0; t < sequence.length; t += 1) {
        yield {
            stepNumber: step,
            entities: bars(states.slice(0, t + 1), states.slice(0, t + 1).map((_v, i) => i === t ? "active" : "sorted")),
            edges: [],
            description: `Step ${t}: state h = a*h + b*x = ${(states[t] ?? 0).toFixed(4)}; output y = ${(outputs[t] ?? 0).toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "step", a, b, c, d, t, states: states.slice(0, t + 1), outputs: outputs.slice(0, t + 1) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(outputs, outputs.map(() => "sorted")),
        edges: [],
        description: `Done: the LRU produced one output per input token.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "done", a, b, c, d, states, outputs },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An LRU is a simple memory cell. At each step it keeps a fraction of its old state and adds a fraction of the new input, then reads out a mixture of state and input. Because the update is linear, the state at any time is just a weighted sum of all past inputs, with older inputs faded by repeated multiplication by the decay factor.",
        invariants: [
            "The hidden state starts at zero before the first token.",
            "The state update h = a*h + b*x is linear in the state and input.",
            "The state at time t equals the sum over past inputs of b times a to the power of the age times the input.",
        ],
        correctness:
            "Unrolling the recurrence gives h_t = a h_{t-1} + b x_t = a squared h_{t-2} + a b x_{t-1} + b x_t, and continuing to the start yields the closed form h_t = sum of b a to the power of (t minus s) times x_s for s up to t. The output y_t = c h_t + d x_t is then a linear readout of that state and the current input. Since the recurrence and the closed form are algebraically identical, the step-by-step computation is correct, and the linear structure is what enables a parallel prefix-scan implementation.",
        complexityRationale:
            "Each of the L time steps performs a constant number of arithmetic operations per channel, giving O(L d) time. Only the current d-dimensional hidden state must be retained, so space is O(d).",
        uses: [
            "Long-sequence modeling as a efficient recurrent alternative to attention",
            "Time-series forecasting with learned decay",
            "State-space model backbones for language and audio",
        ],
        references: [
            "Orvieto et al., Resurrecting Recurrent Neural Networks for Long Sequences, ICML 2023",
            "Gu et al., Combining Recurrent, Convolutional, and Continuous-Time Models, ICLR 2021",
        ],
        workedExample:
            "With sequence (1, 0.5, -0.5), a=0.8, b=1, c=1 and d=0.2, the first state is 1 and output 1.2. The second state is 0.8*1 + 0.5 = 1.3, and the closed form gives b*a*x0 + b*x1 = 0.8 + 0.5 = 1.3, confirming the two views agree.",
    },
    id: "linear-recurrent-unit",
    name: "Linear Recurrent Unit",
    category: "ml-ai",
    complexity: { time: "O(L d)", space: "O(d)" },
    defaultInput: { sequence: [1, 0.5, -0.5, 1, 0], a: 0.8, b: 1, c: 1, d: 0.2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the input sequence and the four scalar parameters",
        "initialize the hidden state to zero",
        "for each input token update state to a times state plus b times input",
        "compute output as c times state plus d times input",
        "record the state and output for this step",
        "done: report the full output sequence",
    ],
};

export default module;
