/**
 * lstm.ts - Long Short-Term Memory Cell Step
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * LSTM is a recurrent network whose cell state carries information across many
 * time steps. This module implements one scalar LSTM cell: the forget, input,
 * and output gates plus a candidate cell value, followed by the cell update
 * c = f times c previous plus i times candidate and the hidden update
 * h = o times tanh(c). It is the exact cell equation on scalar inputs with
 * scalar weights, shown so every gate can be checked by hand; it is not a full
 * stacked or bidirectional LSTM.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for a sequence of n scalar steps
 *   Space: O(1) cell state and hidden state
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are the hidden state h at each time step, revealed left to right.
 *   - The current step is ACTIVE; earlier steps are SORTED.
 *   - All four gates, the cell state, and hidden state are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LstmInput {
    sequence?: number[];
    weights?: [number, number, number, number];
    biases?: [number, number, number, number];
    h0?: number;
    c0?: number;
}

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

function pick<T>(value: T[] | undefined, fallback: T[]): T[] {
    return Array.isArray(value) && value.length > 0 ? value : fallback;
}

/** Build the hidden-state bars for a frame. */
function makeBars(outputs: number[], count: number): VisualEntity[] {
    return outputs.map((value, index) => {
        let state: EntityState = "idle";
        if (index < count - 1) {
            state = "sorted";
        } else if (index === count - 1) {
            state = "active";
        }
        return {
            id: `h-${index}`,
            type: "bar" as const,
            label: index < count ? value.toFixed(3) : "?",
            value: index < count ? value : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index },
        };
    });
}

/** Run the scalar LSTM cell over a short sequence. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LstmInput | null) ?? {};
    const sequence = pick(task.sequence, [0.5, 1, -0.5]);
    const weights = pick(task.weights as number[] | undefined, [1, 1, 1, 1]);
    const biases = pick(task.biases as number[] | undefined, [0, 0, 0, 0]);
    let h = typeof task.h0 === "number" ? task.h0 : 0;
    let c = typeof task.c0 === "number" ? task.c0 : 0;
    const outputs: number[] = new Array(sequence.length).fill(0);
    let gates = { f: 0, i: 0, o: 0, g: 0 };
    let count = 0;
    let step = 0;

    const frame = (description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(outputs, count),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: {
            n: sequence.length,
            h,
            c,
            f: gates.f,
            i: gates.i,
            o: gates.o,
            g: gates.g,
            outputs: [...outputs],
        },
    });

    yield frame(`Scalar LSTM cell processes ${sequence.length} step(s), starting from h and c.`, 0);

    for (let t = 0; t < sequence.length; t += 1) {
        const x = sequence[t] ?? 0;
        const combined = h + x;
        const f = sigmoid((weights[0] ?? 0) * combined + (biases[0] ?? 0));
        const i = sigmoid((weights[1] ?? 0) * combined + (biases[1] ?? 0));
        const o = sigmoid((weights[2] ?? 0) * combined + (biases[2] ?? 0));
        const g = Math.tanh((weights[3] ?? 0) * combined + (biases[3] ?? 0));
        c = f * c + i * g;
        h = o * Math.tanh(c);
        gates = { f, i, o, g };
        outputs[t] = h;
        count = t + 1;
        yield frame(
            `Step ${t}: forget ${f.toFixed(3)}, input ${i.toFixed(3)}, output ${o.toFixed(3)}, candidate ${g.toFixed(3)}; h = ${h.toFixed(3)}.`,
            2,
        );
    }

    yield frame(`Sequence finished with cell state ${c.toFixed(3)} and hidden state ${h.toFixed(3)}.`, 6);
}

/** The LSTM cell module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "An LSTM keeps two values: a long-lived cell state and a short hidden state. Three gates decide what to forget from the cell, what new candidate to write, and what to reveal as the output. Because the forget gate can stay near one, gradients and information can flow across many steps without vanishing as quickly as in a plain recurrent network.",
        invariants: [
            "Each sigmoid gate lies strictly between zero and one.",
            "The cell state update is the sum of the retained old cell and the gated new candidate.",
            "The hidden state is the output gate times the tanh of the cell state.",
        ],
        correctness:
            "The module applies the standard LSTM equations in order: compute f, i, o, and candidate g from the previous hidden state and current input, update c with f times c previous plus i times g, then set h to o times tanh(c). These definitions are the specification of an LSTM cell, and a test recomputes them independently and checks gate bounds.",
        complexityRationale:
            "Each time step performs a constant number of gate evaluations, so O(n) time for n steps. Only the cell and hidden states are carried between steps, giving O(1) working space apart from the stored outputs.",
        uses: [
            "Sequence modeling for speech recognition and language tasks",
            "Time-series forecasting with long-range dependencies",
            "A baseline recurrent layer for teaching and small datasets",
        ],
        references: [
            "Hochreiter and Schmidhuber, Long Short-Term Memory, 1997",
            "Gers, Schmidhuber, and Cummins, Learning to Forget, 2000",
        ],
        workedExample:
            "Starting from h = 0 and c = 0 with all weights one and zero biases, an input of 0.5 gives combined 0.5. Every sigmoid gate is about 0.622 and the candidate is about 0.462, so the new cell is about 0.287 and the hidden state is about 0.166, which the next step then reads.",
    },
    id: "lstm",
    name: "LSTM Cell Step",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { sequence: [0.5, 1, -0.5], weights: [1, 1, 1, 1], biases: [0, 0, 0, 0], h0: 0, c0: 0 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize hidden state h and cell state c",
        "for each input value in the sequence",
        "compute forget, input, and output gates with sigmoid",
        "compute the candidate cell value with tanh",
        "update the cell state as forget times old plus input times candidate",
        "set the hidden state to output gate times tanh of cell state",
        "done: report the final hidden and cell states",
    ],
};

export default module;
