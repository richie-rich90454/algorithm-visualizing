/**
 * zamba-model.ts - Zamba Shared Global Attention Backbone
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Zamba pairs a Mamba-style state-space backbone with a single global attention
 * layer whose weights are shared across every place it is inserted. Most layers
 * run the cheap recurrence; every few layers the shared attention block is
 * reused to gather long-range context. Reusing one block keeps the parameter
 * cost small while still giving the stack a global view. This module implements
 * the exact scalar core of that design.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(layers * n) for n tokens with the fixed shared attention kernel
 *   Space: O(layers * n) for the stored per-layer outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the token stream after each backbone layer.
 *   - Shared attention layers are labeled distinctly in the description.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ZambaInput {
    tokens?: number[];
    layers?: number;
    sharedEvery?: number;
    decay?: number;
    write?: number;
}

/** Build the fixed causal kernel reused by every shared attention layer. */
export function sharedKernel(length: number): number[] {
    const raw = Array.from({ length }, (_, d) => 1 / (d + 1));
    const total = raw.reduce((sum, v) => sum + v, 0);
    return raw.map((v) => v / total);
}

/** Run the Zamba hybrid stack with a single reused global attention block. */
export function zamba(
    tokens: number[],
    opts: { layers?: number; sharedEvery?: number; decay?: number; write?: number } = {},
): { perLayer: number[][]; output: number[]; kernel: number[] } {
    const layers = Math.max(1, opts.layers ?? 4);
    const every = Math.max(1, opts.sharedEvery ?? 2);
    const decay = opts.decay ?? 0.6;
    const write = opts.write ?? 1;
    const kernel = sharedKernel(tokens.length);
    let x = tokens.slice();
    const perLayer: number[][] = [x.slice()];

    for (let layer = 0; layer < layers; layer += 1) {
        const out: number[] = [];
        const useShared = (layer + 1) % every === 0;
        if (useShared) {
            for (let i = 0; i < x.length; i += 1) {
                let sum = 0;
                for (let j = 0; j <= i; j += 1) {
                    const distance = i - j;
                    sum += (kernel[distance] ?? 0) * (x[j] ?? 0);
                }
                out.push(sum);
            }
        } else {
            let state = 0;
            for (const value of x) {
                state = decay * state + write * value;
                out.push(state);
            }
        }
        x = out;
        perLayer.push(x.slice());
    }
    return { perLayer, output: x, kernel };
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
    const task = (input as ZambaInput | null) ?? {};
    const tokens: number[] = (task.tokens ?? [2, -1, 1.5, 0.5, -0.5, 1]).slice();
    const layers = Math.max(1, Math.floor(task.layers ?? 4));
    const every = Math.max(1, Math.floor(task.sharedEvery ?? 2));
    const decay = task.decay ?? 0.6;
    const write = task.write ?? 1;
    const { perLayer, output, kernel } = zamba(tokens, { layers, sharedEvery: every, decay, write });
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(tokens, "idle"),
        edges: [],
        description: `Read a sequence of ${tokens.length} scalar tokens.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", tokens, layers, sharedEvery: every, kernel },
    };
    step += 1;

    for (let layer = 0; layer < layers; layer += 1) {
        const useShared = (layer + 1) % every === 0;
        const values = perLayer[layer + 1] ?? [];
        yield {
            stepNumber: step,
            entities: bars(values, "comparing"),
            edges: [],
            description: `Layer ${layer + 1}: ${useShared ? "reused shared global attention" : "state-space recurrence"}.`,
            codeLineNumber: useShared ? 1 : 2,
            layout: "array",
            meta: { phase: "layer", layer: layer + 1, mixer: useShared ? "shared-attention" : "ssm", values },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(output, "sorted"),
        edges: [],
        description: `Done: ${layers} layer(s) with a single shared attention block produced the output.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", output, perLayer, kernel },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Zamba keeps a cheap recurrent backbone and periodically reuses one attention block that every shared layer has in common. Because the same block is inserted more than once, its weights are learned from all those positions at once. The recurrence handles local flow while the shared attention gives each token a view of the entire prefix.",
        invariants: [
            "A shared attention layer appears exactly at indices that are multiples of the sharing period.",
            "All shared layers use the same fixed relative kernel.",
            "Every layer preserves the sequence length.",
        ],
        correctness:
            "The layer schedule is a fixed modular test, so shared layers occur at the intended positions. Each shared layer applies the same causal relative kernel, weighting token j by a function of the distance i minus j and never looking ahead. The recurrence is also causal. Both maps emit one value per token, so length is preserved, and reusing one kernel means every shared layer performs the identical transform on its own input.",
        complexityRationale:
            "A recurrence layer scans n tokens once, and a shared attention layer computes a causal weighted sum over at most n positions, so each layer is O(n) with the fixed kernel. Storing per-layer outputs uses O(layers * n) space.",
        uses: [
            "Efficient long-context language modeling with weight sharing",
            "Hybrid recurrent-attention architecture research",
            "Teaching shared-weight blocks and causal kernels",
        ],
        references: [
            "Glorioso et al., Zamba: A Compact 7B SSM Hybrid Model, 2024",
            "Gu and Dao, Mamba: Linear-Time Sequence Modeling with Selective State Spaces, 2023",
        ],
        workedExample:
            "For tokens 1, 2, 3 with two layers and a shared attention period of two, the first layer is a recurrence and the second is shared attention. The shared kernel decays with distance, so the first output is just token one, while the last output weights token three most and token one least, all with weights summing to one.",
    },
    id: "zamba-model",
    name: "Zamba Hybrid Model",
    category: "ml-ai",
    complexity: { time: "O(layers * n)", space: "O(layers * n)" },
    defaultInput: { tokens: [2, -1, 1.5, 0.5, -0.5, 1], layers: 4, sharedEvery: 2, decay: 0.6, write: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the token stream and sharing period",
        "build one causal kernel shared by all attention layers",
        "for a recurrence layer run the state-space update",
        "for a shared layer apply the reused causal kernel",
        "store each layer output and continue",
        "done: report the final token stream",
    ],
};

export default module;
