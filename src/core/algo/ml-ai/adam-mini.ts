/**
 * adam-mini.ts - Adam-mini Blockwise Learning Rates
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Adam keeps a second-moment estimate for every parameter, which is large for
 * modern models. Adam-mini replaces those millions of estimates with one
 * shared second moment per parameter block, chosen as the mean squared
 * gradient in that block. The first moment stays per parameter, so the update
 * keeps its direction but uses far fewer statistics.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(steps * d) for d parameters
 *   Space: O(d + blocks) instead of O(2d) for full Adam
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the parameter vector after each step.
 *   - Meta exposes each block's shared second-moment value.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AdamMiniInput {
    parameters?: number[];
    gradients?: number[][];
    blockSize?: number;
    learningRate?: number;
    beta1?: number;
    beta2?: number;
    epsilon?: number;
}

function makeBars(values: number[], state: EntityState, prefix = "p"): VisualEntity[] {
    return values.map((value, index) => ({
        id: `${prefix}-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function lossAt(params: number[]): number {
    return params.reduce((total, v) => total + 0.5 * v * v, 0);
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AdamMiniInput | null) ?? {};
    const theta = [...(task.parameters ?? [1, -1, 0.5, -0.5, 2, -2])];
    const gradients = task.gradients ?? [
        [0.6, -0.5, 0.2, -0.2, 0.8, -0.7],
        [0.3, -0.2, 0.1, -0.1, 0.4, -0.3],
    ];
    const blockSize = typeof task.blockSize === "number" && task.blockSize > 0 ? task.blockSize : 2;
    const lr = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const beta1 = typeof task.beta1 === "number" ? task.beta1 : 0.9;
    const beta2 = typeof task.beta2 === "number" ? task.beta2 : 0.999;
    const epsilon = typeof task.epsilon === "number" ? task.epsilon : 1e-8;

    const blockCount = Math.ceil(theta.length / blockSize);
    const m = theta.map(() => 0);
    const v = new Array<number>(blockCount).fill(0);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(theta, "idle"),
        edges: [],
        description: `Adam-mini with ${blockCount} block(s) of size ${blockSize} over ${theta.length} parameters.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { step: 0, blockCount, blockSize, loss: lossAt(theta), learningRate: lr },
    };
    step += 1;

    for (let t = 0; t < gradients.length; t += 1) {
        const gradient = gradients[t];
        if (!gradient) {
            continue;
        }
        const timeStep = t + 1;
        for (let i = 0; i < theta.length; i += 1) {
            m[i] = beta1 * (m[i] ?? 0) + (1 - beta1) * (gradient[i] ?? 0);
        }
        const blockV: number[] = [];
        for (let b = 0; b < blockCount; b += 1) {
            let sumSq = 0;
            let count = 0;
            for (let i = b * blockSize; i < Math.min((b + 1) * blockSize, theta.length); i += 1) {
                const g = gradient[i] ?? 0;
                sumSq += g * g;
                count += 1;
            }
            const meanSq = count === 0 ? 0 : sumSq / count;
            v[b] = beta2 * (v[b] ?? 0) + (1 - beta2) * meanSq;
            blockV.push(v[b] ?? 0);
        }
        const correction1 = 1 - Math.pow(beta1, timeStep);
        const correction2 = 1 - Math.pow(beta2, timeStep);
        for (let i = 0; i < theta.length; i += 1) {
            const b = Math.floor(i / blockSize);
            const mHat = (m[i] ?? 0) / correction1;
            const vHat = (v[b] ?? 0) / correction2;
            theta[i] = (theta[i] ?? 0) - (lr * mHat) / (Math.sqrt(vHat) + epsilon);
        }
        yield {
            stepNumber: step,
            entities: makeBars(theta, "active"),
            edges: [],
            description: `Step ${timeStep}: updated all parameters using ${blockCount} shared block second moments.`,
            codeLineNumber: 5,
            layout: "array",
            meta: { step, blockV, loss: lossAt(theta), parameters: theta.slice() },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(theta, "sorted"),
        edges: [],
        description: `Done: ${gradients.length} Adam-mini steps, final loss ${lossAt(theta).toFixed(6)}.`,
        codeLineNumber: 7,
        layout: "array",
        meta: { step, parameters: theta.slice(), loss: lossAt(theta), blockCount },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Adam is effective but memory-hungry because it keeps a second moment for every single parameter. Adam-mini observes that parameters in a natural block, such as a query head, can share one scale. It keeps the per-parameter first moment for direction but collapses the second moments to one average per block, cutting the optimizer state roughly in half with little loss of quality.",
        invariants: [
            "Every parameter in a block uses the same bias-corrected second moment.",
            "The first moment remains per parameter and is updated exactly as in Adam.",
            "The shared second moment is the running average of the block's mean squared gradient.",
        ],
        correctness:
            "For a block, the update divides each parameter's corrected momentum by the square root of the same corrected block statistic, so the direction is per parameter while the scale is shared. The recurrence used here is the exponential moving average of the block mean squared gradient, which is exactly Adam's second moment applied to a block-averaged signal. The test replays the block computation independently and verifies that coordinates sharing a block share the same denominator.",
        complexityRationale:
            "Each step scans the d parameters once for the first moments and once for the block statistics, so the time is linear in d; the state is d first moments plus one value per block, which is O(d + blocks).",
        uses: [
            "Memory-efficient pretraining of large language models",
            "Fine-tuning on accelerators with limited high-bandwidth memory",
            "Optimizing embedding tables with many redundant scales",
        ],
        references: [
            "Zhang et al., Adam-mini: Use Fewer Learning Rates To Gain More, 2024",
            "Kingma and Ba, Adam: A Method for Stochastic Optimization, ICLR 2015",
        ],
        workedExample:
            "With block size two and gradients 0.6 and -0.5 in the first block, the mean squared gradient is about 0.30. That single value becomes the second moment for both parameters, so they share one denominator while their separate first moments preserve distinct update directions.",
    },
    id: "adam-mini",
    name: "Adam-mini Optimizer",
    category: "ml-ai",
    complexity: { time: "O(steps * d)", space: "O(d + blocks)" },
    defaultInput: {
        parameters: [1, -1, 0.5, -0.5, 2, -2],
        gradients: [
            [0.6, -0.5, 0.2, -0.2, 0.8, -0.7],
            [0.3, -0.2, 0.1, -0.1, 0.4, -0.3],
        ],
        blockSize: 2,
        learningRate: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "split the parameters into contiguous blocks",
        "initialize a first moment per parameter and one second moment per block",
        "for each step update the first moments from the gradients",
        "set each block second moment to the running mean squared gradient in the block",
        "bias-correct both moments for the current step",
        "update each parameter with its momentum over the square root of its block moment",
        "record the block moments and the loss",
        "done: report the final parameters",
    ],
};

export default module;
