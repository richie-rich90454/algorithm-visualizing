/**
 * ia3-tuning.ts - IA3 Activation Scaling (teachable core)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * IA3 fine-tunes a frozen layer by learning one small scaling vector that is
 * multiplied elementwise into the layer's activations. Instead of changing the
 * weight matrix, only the scale factors move. At zero scale the module reduces
 * exactly to the frozen base, and training adjusts the scales to reduce the
 * loss while the weights remain fixed.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * d) for an m-output, d-input linear layer
 *   Space: O(m * d) for frozen weights plus O(m) trainable scale factors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the frozen base output, the scaled IA3 output, and the output
 *     after one gradient step on the scale vector.
 *   - Metadata reports trainable scale count versus frozen weight count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Ia3Input {
    weights?: number[][];
    x?: number[];
    alpha?: number[];
    target?: number[];
    lr?: number;
}

const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);

/** Frozen base output multiplied by the learned IA3 scale vector. */
export function ia3Forward(weights: number[][], x: number[], alpha: number[]) {
    const base = weights.map((row) => dot(row, x));
    const output = base.map((value, i) => value * (1 + (alpha[i] ?? 0)));
    return { base, output };
}

/** One gradient step on the scale factors with the weight matrix frozen. */
export function ia3Step(
    weights: number[][],
    x: number[],
    alpha: number[],
    target: number[],
    lr: number,
) {
    const { base, output } = ia3Forward(weights, x, alpha);
    const gradAlpha = output.map((value, i) => (value - (target[i] ?? 0)) * (base[i] ?? 0));
    const alphaAfter = alpha.map((value, i) => value - lr * (gradAlpha[i] ?? 0));
    const outputAfter = base.map((value, i) => value * (1 + (alphaAfter[i] ?? 0)));
    const lossBefore = 0.5 * output.reduce((sum, value, i) => sum + (value - (target[i] ?? 0)) ** 2, 0);
    const lossAfter = 0.5 * outputAfter.reduce((sum, value, i) => sum + (value - (target[i] ?? 0)) ** 2, 0);
    return { base, output, gradAlpha, alphaAfter, outputAfter, lossBefore, lossAfter };
}

function bars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, index) => ({
        id: `out-${index}`,
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
    const task = (input as Ia3Input | null) ?? {};
    const weights: number[][] = task.weights ?? [
        [1, 0.5, -0.5],
        [0.2, -1, 0.8],
    ];
    const x: number[] = Array.isArray(task.x) && task.x.length > 0 ? task.x.slice() : [1, 2, -1];
    const alpha: number[] = Array.isArray(task.alpha) && task.alpha.length === weights.length
        ? task.alpha.slice()
        : new Array<number>(weights.length).fill(0);
    const target: number[] = Array.isArray(task.target) ? task.target.slice() : [2.5, -0.5];
    const lr = typeof task.lr === "number" && task.lr > 0 ? task.lr : 0.05;
    const r = ia3Step(weights, x, alpha, target, lr);
    const m = weights.length;
    const d = weights[0]?.length ?? 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(r.base, "idle"),
        edges: [],
        description: `Frozen ${m} by ${d} layer with ${m} trainable IA3 scale factors.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, base: r.base, frozenWeights: m * d, trainableScales: m, phase: "base" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.output, "comparing"),
        edges: [],
        description: "Multiply each frozen base activation by one plus its learned scale factor.",
        codeLineNumber: 1,
        layout: "array",
        meta: { x, base: r.base, output: r.output, frozenWeights: m * d, trainableScales: m, phase: "scaled" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.gradAlpha, "active"),
        edges: [],
        description: "The scale gradient is the output error times the frozen base activation.",
        codeLineNumber: 2,
        layout: "array",
        meta: { x, gradAlpha: r.gradAlpha, phase: "gradient", frozenWeights: m * d, trainableScales: m },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(r.outputAfter, "sorted"),
        edges: [],
        description: `Loss moved from ${r.lossBefore.toFixed(4)} to ${r.lossAfter.toFixed(4)} by scaling only the activations.`,
        codeLineNumber: 4,
        layout: "array",
        meta: {
            x,
            output: r.outputAfter,
            alphaAfter: r.alphaAfter,
            lossBefore: Number(r.lossBefore.toFixed(8)),
            lossAfter: Number(r.lossAfter.toFixed(8)),
            frozenWeights: m * d,
            trainableScales: m,
            phase: "done",
            converged: r.lossAfter <= r.lossBefore,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "IA3 learns to rescale the activations of a frozen network instead of rewriting its weights. Each layer gets a single small vector whose entries multiply the output channels. When those factors start at zero the model behaves like the untouched base, and training simply adjusts the knobs until the predictions improve.",
        invariants: [
            "The weight matrix is frozen and never changes during the step.",
            "Each output channel has exactly one trainable scale factor.",
            "At zero scale the output equals the frozen base output.",
        ],
        correctness:
            "The scaled output is defined as the frozen base output times one plus alpha. Squared-error training gives a gradient for alpha equal to the output error times the base output, since the base is constant with respect to alpha. Taking one steepest-descent step on those factors and leaving the weights fixed is exactly the IA3 update rule, and setting alpha to zero recovers the base model by definition.",
        complexityRationale:
            "Forming the base output scans the m by d matrix once and the scaling touches m channels, so time is O(m*d). Storage is O(m*d) for the frozen weights plus O(m) for the trainable scale vector.",
        uses: [
            "Parameter-efficient adaptation of large transformer models",
            "Learning per-channel rescaling without touching base weights",
            "A teaching example of multiplicative fine-tuning",
        ],
        references: [
            "Liu et al., Few-Shot Parameter-Efficient Fine-Tuning is Better and Cheaper than In-Context Learning, NeurIPS 2022",
            "Houlsby et al., Parameter-Efficient Transfer Learning for NLP, 2019",
        ],
        workedExample:
            "For a two-output layer, base outputs of 2 and -3 with alpha of 0.1 and -0.2 give scaled outputs of 2.2 and -2.4. The gradient for each scale is the output error times its base value, and a small step nudges the scales toward better targets while the weight matrix stays fixed.",
    },
    id: "ia3-tuning",
    name: "IA3 Tuning",
    category: "ml-ai",
    complexity: { time: "O(m * d)", space: "O(m * d)" },
    defaultInput: {
        weights: [
            [1, 0.5, -0.5],
            [0.2, -1, 0.8],
        ],
        x: [1, 2, -1],
        alpha: [0.1, -0.2],
        target: [2.5, -0.5],
        lr: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "freeze the weight matrix",
        "compute the frozen base output",
        "scale each output channel by one plus its alpha",
        "compute the scale gradient from the output error",
        "move each scale factor against its gradient",
        "recompute the scaled output and the loss",
        "done: report the updated scales and loss",
    ],
};

export default module;
