/**
 * efficientnet-compound-scaling.ts - EfficientNet Compound Scaling
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * EfficientNet scales a base network along three axes together: depth, width,
 * and input resolution. A single coefficient phi raises fixed constants alpha,
 * beta, and gamma to grow all three at once, under the constraint that their
 * combined effect roughly doubles the compute for each unit of phi. This demo
 * computes the scaled depth, width, and resolution and the resulting FLOP
 * multiplier for a chosen phi, with the rounding rules the paper prescribes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) closed-form computation
 *   Space: O(1) for the few computed dimensions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows the depth, width, and resolution bars.
 *   - The sequence walks from base dimensions to the fully scaled network.
 *   - The final frame reports the FLOP multiplier and its target.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ScalingInput {
    baseDepth: number;
    baseWidth: number;
    baseResolution: number;
    alpha: number;
    beta: number;
    gamma: number;
    phi: number;
}

/** Round a positive number to the nearest multiple of eight. */
function roundToEight(value: number): number {
    return Math.max(8, Math.round(value / 8) * 8);
}

/** Build three bars for depth, width, and resolution. */
function makeBars(depth: number, width: number, resolution: number, active: boolean): VisualEntity[] {
    const values = [depth, width, resolution];
    const labels = ["depth", "width", "resolution"];
    return values.map((value, index) => ({
        id: `dim-${labels[index]}`,
        type: "bar" as const,
        label: `${labels[index]} ${Number(value.toFixed(2))}`,
        value,
        state: (active ? "active" : "idle") as EntityState,
        x: index * 70,
        y: 0,
        width: 40,
        height: 0,
        metadata: { dimension: labels[index], value: Number(value.toFixed(6)) },
    }));
}

/** The compound scaling generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<ScalingInput> | null) ?? {};
    const baseDepth = typeof task.baseDepth === "number" ? task.baseDepth : 1;
    const baseWidth = typeof task.baseWidth === "number" ? task.baseWidth : 16;
    const baseResolution = typeof task.baseResolution === "number" ? task.baseResolution : 32;
    const alpha = typeof task.alpha === "number" ? task.alpha : 1.2;
    const beta = typeof task.beta === "number" ? task.beta : 1.1;
    const gamma = typeof task.gamma === "number" ? task.gamma : 1.15;
    const phi = typeof task.phi === "number" ? task.phi : 1;

    const scaledDepth = Math.max(1, Math.round(baseDepth * Math.pow(alpha, phi)));
    const scaledWidth = roundToEight(baseWidth * Math.pow(beta, phi));
    const scaledResolution = roundToEight(baseResolution * Math.pow(gamma, phi));
    const baseFlops = baseDepth * baseWidth * baseWidth * baseResolution * baseResolution;
    const scaledFlops = scaledDepth * scaledWidth * scaledWidth * scaledResolution * scaledResolution;
    const flopsFactor = scaledFlops / baseFlops;
    const targetFactor = Math.pow(alpha * beta * beta * gamma * gamma, phi);

    yield {
        stepNumber: 0,
        entities: makeBars(baseDepth, baseWidth, baseResolution, false),
        edges: [],
        description: `Base network: depth ${baseDepth}, width ${baseWidth}, resolution ${baseResolution}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "base", depth: baseDepth, width: baseWidth, resolution: baseResolution, phi },
    };
    yield {
        stepNumber: 1,
        entities: makeBars(scaledDepth, baseWidth, baseResolution, false),
        edges: [],
        description: `Depth scaled by alpha to the power phi gives depth ${scaledDepth}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { stage: "depth", depth: scaledDepth, width: baseWidth, resolution: baseResolution, phi },
    };
    yield {
        stepNumber: 2,
        entities: makeBars(scaledDepth, scaledWidth, baseResolution, false),
        edges: [],
        description: `Width scaled by beta to the power phi and rounded to a multiple of eight gives ${scaledWidth}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { stage: "width", depth: scaledDepth, width: scaledWidth, resolution: baseResolution, phi },
    };
    yield {
        stepNumber: 3,
        entities: makeBars(scaledDepth, scaledWidth, scaledResolution, true),
        edges: [],
        description: `Resolution scaled by gamma and rounded to a multiple of eight gives ${scaledResolution}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { stage: "resolution", depth: scaledDepth, width: scaledWidth, resolution: scaledResolution, phi },
    };
    yield {
        stepNumber: 4,
        entities: makeBars(scaledDepth, scaledWidth, scaledResolution, true),
        edges: [],
        description: `Compound scaling raises compute by ${flopsFactor.toFixed(2)}x, near the ${targetFactor.toFixed(2)}x design target.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { stage: "summary", depth: scaledDepth, width: scaledWidth, resolution: scaledResolution, flopsFactor: Number(flopsFactor.toFixed(6)), targetFactor: Number(targetFactor.toFixed(6)) },
    };
}

/** The EfficientNet module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Bigger networks usually work better, but scaling one dimension alone hits diminishing returns. EfficientNet scales depth, width, and resolution together with one knob phi. Depth is rounded to an integer, while width and resolution are rounded to multiples of eight so hardware runs them efficiently. The constants are chosen so each unit of phi spends about twice the compute.",
        invariants: [
            "Width and resolution are always positive multiples of eight.",
            "Depth is a positive integer.",
            "The FLOP multiplier is the product of depth growth and the square of width and resolution growth.",
        ],
        correctness:
            "The generator applies the closed-form scaling equations exactly as given in the paper. The test uses an independent reference implementing the same formulas and rounding, verifies the three dimensions and the FLOP multiplier, checks that phi = 0 leaves the base unchanged, and confirms the multiplier stays near the (alpha * beta^2 * gamma^2)^phi design target.",
        complexityRationale:
            "Scaling is a fixed number of exponentiations, multiplications, and roundings, so time and space are both O(1) regardless of network size.",
        uses: [
            "Choosing model sizes for EfficientNet B0 through B7",
            "Balancing accuracy and compute under a fixed budget",
            "Compound scaling of custom convolution backbones",
        ],
        references: [
            "Tan and Le, EfficientNet: Rethinking Model Scaling, ICML 2019",
            "Tan and Le, EfficientNetV2, ICML 2021",
        ],
        workedExample:
            "With base depth 1, width 16, resolution 32 and phi = 1, depth becomes round(1.2) = 1, width becomes round(17.6 / 8) * 8 = 16, and resolution becomes round(36.8 / 8) * 8 = 40. The FLOP multiplier is about 1.56, in the expected range near the target of roughly 2 before rounding.",
    },
    id: "efficientnet-compound-scaling",
    name: "EfficientNet Compound Scaling",
    category: "ml-ai",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { baseDepth: 1, baseWidth: 16, baseResolution: 32, phi: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read the base depth, width, and resolution",
        "set depth to round of base depth times alpha to the power phi",
        "set width to base width times beta to the power phi, rounded to a multiple of eight",
        "set resolution to base resolution times gamma to the power phi, rounded to a multiple of eight",
        "compute base FLOPs as depth times width squared times resolution squared",
        "compute scaled FLOPs with the new dimensions",
        "report the FLOP multiplier and the design target",
    ],
};

export default module;
