/**
 * samba-model.ts - Samba Hybrid SSM and Sliding-Window Attention
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Samba interleaves two sequence mixers. A state-space layer carries a running
 * recurrent state with a decay and a write gate, giving linear-time long-range
 * memory. A sliding-window attention layer averages each token with a small
 * number of recent tokens, giving sharp local context. Alternating the two
 * layers captures both kinds of dependency. This module implements the exact
 * scalar teaching core of that hybrid stack.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(layers * sequence * (window + 1))
 *   Space: O(layers * sequence) for the stored per-layer outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the token stream after each hybrid layer.
 *   - The final frame marks the stack output.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SambaInput {
    tokens?: number[];
    layers?: number;
    window?: number;
    decay?: number;
    write?: number;
}

/** Run an alternating stack of SSM and sliding-window attention layers. */
export function samba(
    tokens: number[],
    opts: { layers?: number; window?: number; decay?: number; write?: number } = {},
): { perLayer: number[][]; output: number[] } {
    const layers = Math.max(1, opts.layers ?? 2);
    const window = Math.max(1, opts.window ?? 3);
    const decay = opts.decay ?? 0.5;
    const write = opts.write ?? 1;
    let x = tokens.slice();
    const perLayer: number[][] = [x.slice()];

    for (let layer = 0; layer < layers; layer += 1) {
        const out: number[] = [];
        if (layer % 2 === 0) {
            let state = 0;
            for (const value of x) {
                state = decay * state + write * value;
                out.push(state);
            }
        } else {
            for (let i = 0; i < x.length; i += 1) {
                const start = Math.max(0, i - window + 1);
                let sum = 0;
                for (let j = start; j <= i; j += 1) {
                    sum += x[j] ?? 0;
                }
                out.push(sum / (i - start + 1));
            }
        }
        x = out;
        perLayer.push(x.slice());
    }
    return { perLayer, output: x };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `tok-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SambaInput | null) ?? {};
    const tokens: number[] = (task.tokens ?? [1, 2, 0.5, -1, 1.5, 0]).slice();
    const layers = Math.max(1, Math.floor(task.layers ?? 2));
    const window = Math.max(1, Math.floor(task.window ?? 3));
    const decay = task.decay ?? 0.5;
    const write = task.write ?? 1;
    const { perLayer, output } = samba(tokens, { layers, window, decay, write });
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(tokens, "idle"),
        edges: [],
        description: `Read a sequence of ${tokens.length} scalar tokens.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", tokens, layers, window, decay, write },
    };
    step += 1;

    for (let layer = 0; layer < layers; layer += 1) {
        const isSsm = layer % 2 === 0;
        const values = perLayer[layer + 1] ?? [];
        yield {
            stepNumber: step,
            entities: bars(values, "comparing"),
            edges: [],
            description: `Layer ${layer + 1}: ${isSsm ? "state-space recurrence" : "sliding-window attention"}.`,
            codeLineNumber: isSsm ? 1 : 2,
            layout: "array",
            meta: { phase: "layer", layer: layer + 1, mixer: isSsm ? "ssm" : "window-attention", values },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(output, "sorted"),
        edges: [],
        description: `Done: ${layers} hybrid layer(s) produced the final token stream.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", output, perLayer },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Long sequences need both wide context and fine local detail. Samba gets them by alternating a state-space mixer, which compresses the whole past into one recurrent state, with a sliding-window attention mixer, which looks closely at a few recent tokens. The stack is cheap because both mixers scale linearly with sequence length.",
        invariants: [
            "Even-indexed layers use the state-space recurrence; odd-indexed layers use windowed averaging.",
            "The state-space layer reads its output from the updated recurrent state.",
            "Every layer preserves the sequence length.",
        ],
        correctness:
            "The state-space layer applies the recurrence state equals decay times the previous state plus write times the current token, so it is a causal linear map whose output at each position depends only on tokens up to that position. The window layer averages the current token with the previous window minus one tokens, which is also causal. Alternating causal maps keeps every output causal, and both maps emit exactly one value per input token, so the sequence length is preserved at every layer.",
        complexityRationale:
            "A state-space layer scans the sequence once, and a window layer examines at most window tokens per position, so each layer is O(sequence * window) in the worst case and O(sequence) when the window is fixed. Storing outputs for all layers uses O(layers * sequence) space.",
        uses: [
            "Language modeling with long context and linear-time mixing",
            "Hybrid architectures combining recurrence and attention",
            "Teaching causal sequence mixers and state-space models",
        ],
        references: [
            "Ren et al., Samba: Simple Hybrid State Space Models for Efficient Unlimited Context, 2024",
            "Gu and Dao, Mamba: Linear-Time Sequence Modeling with Selective State Spaces, 2023",
        ],
        workedExample:
            "For tokens 1, 2, 0.5 with decay 0.5, write 1, and one state-space layer, the state after token one is 1, after token two is 2, and after token 0.5 is 1.5, giving output 1, 2, 1.5. A following window layer with window two averages adjacent pairs, producing 1, 1.75, 1.25.",
    },
    id: "samba-model",
    name: "Samba Hybrid Model",
    category: "ml-ai",
    complexity: { time: "O(layers * n * window)", space: "O(layers * n)" },
    defaultInput: { tokens: [1, 2, 0.5, -1, 1.5, 0], layers: 2, window: 3, decay: 0.5, write: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the token stream and hybrid layer settings",
        "for an even layer run the state-space recurrence",
        "for an odd layer average each token with its recent window",
        "store the output as the input to the next layer",
        "done: report the final mixed token stream",
    ],
};

export default module;
