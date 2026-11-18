/**
 * retnet.ts - RetNet Retention: Recurrent State Versus Parallel Form
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * RetNet replaces softmax attention with a decaying retention mechanism. The
 * teachable core is the equivalence between its recurrent form and its parallel
 * form. The recurrent update keeps a state S, applying S = gamma times the old
 * S plus the outer product of key and value, then reads out o = q times S. The
 * parallel form sums gamma raised to (t - i) over all earlier positions. This
 * module shows the scalar version so both forms can be checked by hand; it is a
 * teaching model, not a full multi-head RetNet layer.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) recurrent per token, O(n squared) parallel reference
 *   Space: O(1) recurrent state, O(n) to store the outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars are the retention output at each position, revealed left to right.
 *   - The current output is ACTIVE; earlier outputs are SORTED.
 *   - The decay gamma, running state S, and all outputs are reported in meta.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RetNetInput {
    q?: number[];
    k?: number[];
    v?: number[];
    gamma?: number;
}

function sequence(value: number[] | undefined, fallback: number[]): number[] {
    return Array.isArray(value) && value.length > 0 ? value : fallback;
}

/** Build the output bars for a frame. */
function makeBars(outputs: number[], count: number): VisualEntity[] {
    return outputs.map((value, index) => {
        let state: EntityState = "idle";
        if (index < count - 1) {
            state = "sorted";
        } else if (index === count - 1) {
            state = "active";
        }
        return {
            id: `out-${index}`,
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

/** Run the retention recurrence. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RetNetInput | null) ?? {};
    const q = sequence(task.q, [1, 0.5, 2]);
    const k = sequence(task.k, [2, 1, 3]);
    const v = sequence(task.v, [1, 2, 0.5]);
    const gamma = typeof task.gamma === "number" && task.gamma > 0 && task.gamma <= 1
        ? task.gamma
        : 0.5;
    const n = Math.min(q.length, k.length, v.length);

    const outputs: number[] = new Array(n).fill(0);
    let state = 0;
    let count = 0;
    let step = 0;

    const frame = (description: string, codeLineNumber: number): VisualFrame => ({
        stepNumber: step++,
        entities: makeBars(outputs, count),
        edges: [],
        description,
        codeLineNumber,
        layout: "array",
        meta: { gamma, state, n, outputs: [...outputs] },
    });

    yield frame(`Retention with decay ${gamma} over ${n} position(s); recurrent and parallel forms agree.`, 0);

    for (let t = 0; t < n; t += 1) {
        state = gamma * state + (k[t] ?? 0) * (v[t] ?? 0);
        outputs[t] = (q[t] ?? 0) * state;
        count = t + 1;
        yield frame(
            `Position ${t}: state = ${gamma} * previous + k*v = ${state}, output = q*state = ${outputs[t]}.`,
            2,
        );
    }

    yield frame(`All ${n} retention outputs computed with a single decaying state.`, 5);
}

/** The RetNet teaching-core module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Retention is an attention mechanism whose influence fades with distance. Instead of storing a full key/value table and comparing a query to every entry, it carries one running state that decays by gamma each step and absorbs the current key/value product. Reading the state with the query gives the same answer as a weighted sum over all past positions, but in constant time per token.",
        invariants: [
            "The state after position t equals the sum over i up to t of gamma to the power (t - i) times k_i times v_i.",
            "The output at position t is q_t times that state.",
            "A smaller gamma discounts older positions more heavily.",
        ],
        correctness:
            "Expanding the recurrence gives S_t = gamma S_{t-1} + k_t v_t, which unrolls to the sum over i of gamma^(t-i) k_i v_i. Multiplying by q_t yields the parallel definition of retention output. The two forms are therefore algebraically identical; the module computes the recurrent form and a test compares it to the parallel sum.",
        complexityRationale:
            "The recurrence performs a constant number of operations per token, so O(n) time and O(1) working state, compared with the O(n squared) naive parallel sum. Real RetNet computes this in parallel with matrix operations but preserves the same recurrence.",
        uses: [
            "Language modeling with linear-time sequence mixing",
            "Streaming inference where state can be carried across tokens",
            "A recurrent alternative to softmax attention",
        ],
        references: [
            "Sun et al., Retentive Network: A Successor to Transformer for Large Language Models, 2023",
            "Katharopoulos et al., Transformers are RNNs: Fast Autoregressive Transformers, 2020",
        ],
        workedExample:
            "With gamma = 0.5, q = [1, 0.5, 2], k = [2, 1, 3], v = [1, 2, 0.5], the first state is 2 and output 2. The second state is 0.5*2 + 1*2 = 3 and output 1.5. The third state is 0.5*3 + 3*0.5 = 3 and output 6, which matches the parallel sum gamma^(t-i) weighted over all three positions.",
    },
    id: "retnet",
    name: "RetNet (Retention Recurrence)",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(1)" },
    defaultInput: { q: [1, 0.5, 2], k: [2, 1, 3], v: [1, 2, 0.5], gamma: 0.5 },
    visualType: "array",
    run,
    pseudocode: [
        "initialize the retention state to zero",
        "for each position t in the sequence",
        "decay the state by gamma and add key_t times value_t",
        "read out output_t as query_t times the state",
        "store the output and advance to the next position",
        "done: report all outputs from the single recurrent state",
    ],
};

export default module;
