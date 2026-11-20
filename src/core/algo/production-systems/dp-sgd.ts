/**
 * dp-sgd.ts - Differentially Private Stochastic Gradient Descent
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DP-SGD makes gradient descent private by clipping every per-example gradient
 * to a fixed norm and adding Gaussian noise to the summed batch gradient before
 * the parameter update. Clipping bounds each example's influence; the noise
 * masks the remaining difference, giving a formal differential-privacy guarantee.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(total number of gradient coordinates)
 *   Space: O(number of batches) for the recorded trace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid cell per batch shows the clipped sum, noise, and new parameter.
 *   - The current batch is yellow; completed batches are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec = [number, number];

interface Task {
    batches?: Vec[][];
    clipNorm?: number;
    noiseStd?: number;
    noises?: Vec[];
    learningRate?: number;
    initial?: Vec;
}

/** Clip a vector's L2 norm to at most the given limit. */
function clip(gradient: Vec, limit: number): Vec {
    const norm = Math.hypot(gradient[0], gradient[1]);
    if (norm <= limit || norm === 0) return [gradient[0], gradient[1]];
    const scale = limit / norm;
    return [gradient[0] * scale, gradient[1] * scale];
}

/** Build one cell per batch from the recorded trace. */
function makeCells(
    batches: Vec[][],
    trace: Array<{ clipped: Vec; noise: Vec; noisyGradient: Vec; parameter: Vec }>,
    current: number,
    done: boolean,
): VisualEntity[] {
    return batches.map((_, index) => {
        const item = trace[index];
        let state: EntityState = "unvisited";
        if (item) state = "sorted";
        if (index === current && !done) state = "comparing";
        return {
            id: `cell-${index}`,
            type: "cell" as const,
            label: item
                ? `g=(${item.noisyGradient[0].toFixed(2)},${item.noisyGradient[1].toFixed(2)}) p=(${item.parameter[0].toFixed(2)},${item.parameter[1].toFixed(2)})`
                : `batch ${index}`,
            value: item ? item.noisyGradient[0] : 0,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: index },
        };
    });
}

/** The DP-SGD generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const batches: Vec[][] = Array.isArray(task.batches) && task.batches.length > 0
        ? task.batches
        : [
            [[3, 4], [1, 0]],
            [[0, 2], [1, 1]],
            [[2, 1], [0, -1]],
        ];
    const clipNorm = typeof task.clipNorm === "number" && task.clipNorm > 0 ? task.clipNorm : 2;
    const noiseStd = typeof task.noiseStd === "number" && task.noiseStd >= 0 ? task.noiseStd : 0.1;
    const noises: Vec[] = Array.isArray(task.noises) ? task.noises : [[0.5, -0.3], [-0.2, 0.4], [0.1, 0.2]];
    const learningRate = typeof task.learningRate === "number" ? task.learningRate : 0.1;
    const initial: Vec = Array.isArray(task.initial) ? task.initial : [1, 1];

    let parameter: Vec = [initial[0], initial[1]];
    const trace: Array<{ clipped: Vec; noise: Vec; noisyGradient: Vec; parameter: Vec }> = [];
    let maxClippedNorm = 0;

    const summary = () => ({
        rows: 1,
        cols: batches.length,
        steps: trace.length,
        clipNorm,
        noiseStd,
        maxClippedNorm,
        parameterX: trace.map((t) => t.parameter[0]),
        parameterY: trace.map((t) => t.parameter[1]),
        finalX: parameter[0],
        finalY: parameter[1],
    });

    yield {
        stepNumber: 0,
        entities: makeCells(batches, trace, -1, false),
        edges: [],
        description: `DP-SGD for ${batches.length} batches with clipping norm ${clipNorm} and noise ${noiseStd}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(),
    };
    let step = 1;

    for (let b = 0; b < batches.length; b += 1) {
        const batch = batches[b] ?? [];
        let sumX = 0;
        let sumY = 0;
        for (const gradient of batch) {
            const clipped = clip(gradient, clipNorm);
            maxClippedNorm = Math.max(maxClippedNorm, Math.hypot(clipped[0], clipped[1]));
            sumX += clipped[0];
            sumY += clipped[1];
        }
        const noise = noises[b] ?? [0, 0];
        const noiseX = noise[0] * noiseStd * clipNorm;
        const noiseY = noise[1] * noiseStd * clipNorm;
        const size = Math.max(1, batch.length);
        const noisyGradient: Vec = [(sumX + noiseX) / size, (sumY + noiseY) / size];
        parameter = [
            parameter[0] - learningRate * noisyGradient[0],
            parameter[1] - learningRate * noisyGradient[1],
        ];
        trace.push({ clipped: [sumX, sumY], noise: [noiseX, noiseY], noisyGradient, parameter: [parameter[0], parameter[1]] });
        yield {
            stepNumber: step,
            entities: makeCells(batches, trace, b, false),
            edges: [],
            description: `Batch ${b}: clipped sum (${sumX.toFixed(2)}, ${sumY.toFixed(2)}), noisy gradient (${noisyGradient[0].toFixed(2)}, ${noisyGradient[1].toFixed(2)}).`,
            codeLineNumber: 3,
            layout: "grid",
            meta: summary(),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(batches, trace, batches.length, true),
        edges: [],
        description: `Training complete: final parameter (${parameter[0].toFixed(4)}, ${parameter[1].toFixed(4)}).`,
        codeLineNumber: 6,
        layout: "grid",
        meta: summary(),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single training example can otherwise pull the gradient arbitrarily far and leak information about itself. DP-SGD first caps how far any example can push by clipping its gradient, then blurs the batch average with random noise. The clip sets a known sensitivity; the noise scaled to that sensitivity is what buys privacy.",
        invariants: [
            "Every per-example gradient has L2 norm at most the clipping threshold.",
            "Noise is scaled by the noise multiplier times the clipping norm.",
            "The update subtracts the learning rate times the noisy average gradient.",
        ],
        correctness:
            "Clipping guarantees that replacing one example changes the summed clipped gradient by at most the threshold, so the batch gradient has sensitivity at most clipNorm divided by batch size. Adding Gaussian noise with standard deviation noiseStd times clipNorm to the sum gives the Gaussian mechanism at that noise multiplier, and composing it over the steps yields the usual DP-SGD privacy accounting. The parameter update is otherwise ordinary SGD on the noisy gradient.",
        complexityRationale:
            "Per step the work is proportional to the number of per-example gradient coordinates being clipped and summed, so total time is linear in the total coordinate count. Recording one trace row per batch uses space linear in the number of batches.",
        uses: [
            "Training neural networks on sensitive user data",
            "Federated learning with formal privacy budgets",
            "Releasing models without memorizing individual records",
        ],
        references: [
            "Abadi et al., Deep Learning with Differential Privacy, ACM CCS 2016",
            "Dwork and Roth, The Algorithmic Foundations of Differential Privacy, Chapter 3",
        ],
        workedExample:
            "With clip norm 2, a gradient (3,4) has norm 5 and is clipped to (1.2,1.6), while (1,0) is unchanged. The batch sum (2.2,1.6) gets noise, is divided by two, and the parameter moves by one tenth of that result.",
    },
    id: "dp-sgd",
    name: "Differentially Private SGD",
    category: "production-systems",
    complexity: { time: "O(total coordinates)", space: "O(batches)" },
    defaultInput: {
        batches: [[[3, 4], [1, 0]], [[0, 2], [1, 1]], [[2, 1], [0, -1]]],
        clipNorm: 2,
        noiseStd: 0.1,
        noises: [[0.5, -0.3], [-0.2, 0.4], [0.1, 0.2]],
        learningRate: 0.1,
        initial: [1, 1],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize the parameter and clip threshold",
        "for each batch of per-example gradients",
        "clip each gradient to the threshold norm and sum them",
        "add Gaussian noise scaled by the multiplier times the threshold",
        "divide by the batch size to get the noisy gradient",
        "subtract the learning rate times that gradient from the parameter",
        "done: report the final parameter",
    ],
};

export default module;
