/**
 * densenet.ts - Dense Block Feature Concatenation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A dense block connects every layer directly to every later layer. Each layer
 * produces k new feature channels from the concatenation of all earlier
 * features, so the channel count grows by k per layer instead of staying fixed.
 * The repeated concatenation reuses features and gives short gradient paths.
 * This demo runs a three-layer dense block on a tiny feature vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(L * c^2) for L layers over a growing c-channel feature map
 *   Space: O(c) for the concatenated feature vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows the concatenated feature vector after a layer.
 *   - New channels are appended to the right of existing ones.
 *   - The final frame reports the grown channel count and values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface DenseInput {
    x0: number[];
    weights: number[][];
    biases: number[];
}

/** Build bar entities for a concatenated feature vector. */
function makeBars(values: number[], stage: string, active: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `feature-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: (active ? "active" : "idle") as EntityState,
        x: index * 34,
        y: 0,
        width: 18,
        height: 0,
        metadata: { index, stage, value },
    }));
}

/** The dense block generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<DenseInput> | null) ?? {};
    const x0: number[] = task.x0 ?? [0.5, -0.3];
    const weights: number[][] = task.weights ?? [
        [0.4, -0.2],
        [0.2, 0.5, -0.1],
        [-0.3, 0.7, 0.2, 0.6],
    ];
    const biases: number[] = task.biases ?? [0.1, -0.05, 0.05];

    const features: number[] = x0.slice();
    yield {
        stepNumber: 0,
        entities: makeBars(features, "input", false),
        edges: [],
        description: `Dense block input with ${features.length} initial channel(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { stage: "input", channels: features.length, values: features.map((v) => Number(v.toFixed(6))) },
    };

    let step = 1;
    for (let layer = 0; layer < weights.length; layer += 1) {
        const weight = weights[layer];
        const bias = biases[layer] ?? 0;
        if (!weight) {
            continue;
        }
        let sum = bias;
        for (let index = 0; index < features.length; index += 1) {
            sum += (weight[index] ?? 0) * (features[index] ?? 0);
        }
        features.push(Math.max(0, sum));
        const isLast = layer === weights.length - 1;
        yield {
            stepNumber: step,
            entities: makeBars(features, `layer-${layer + 1}`, isLast),
            edges: [],
            description: `Layer ${layer + 1} appended one channel; concatenated vector now has ${features.length} channel(s).`,
            codeLineNumber: isLast ? 6 : 5,
            layout: "array",
            meta: { stage: `layer-${layer + 1}`, channels: features.length, values: features.map((v) => Number(v.toFixed(6))) },
        };
        step += 1;
    }
}

/** The DenseNet module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "DenseNet turns the usual layer-to-layer chain into a web where every layer sees all earlier feature maps. Each layer reads the full concatenation of prior features and writes one new channel, so information from the input reaches deep layers with almost no attenuation. Think of it as accumulating notes in a shared notebook rather than passing a single rewritten page down a line.",
        invariants: [
            "Each layer appends exactly one new channel, the growth rate k = 1 here.",
            "A layer reads every feature produced before it and never changes them.",
            "The channel count after L layers equals the initial count plus L.",
        ],
        correctness:
            "The generator computes each new channel as ReLU of a dot product between the layer weight and the full current feature vector plus a bias, then appends it. The test reproduces the same recurrence independently and confirms both the exact values and the linear channel growth c0 + L, so the defining dense concatenation is verified rather than assumed.",
        complexityRationale:
            "With c current channels, a layer performs O(c) multiply-adds, and summing over L layers with c growing to c0 + L gives O(L * c^2) overall time. The retained feature vector grows to O(c) space.",
        uses: [
            "DenseNet image classifiers where feature reuse improves accuracy",
            "Dense prediction tasks such as segmentation that need multiscale features",
            "Architectures that benefit from direct gradient paths to early layers",
        ],
        references: [
            "Huang et al., Densely Connected Convolutional Networks, CVPR 2017",
            "Huang et al., CondenseNet, CVPR 2018",
        ],
        workedExample:
            "Starting from two channels [0.5, -0.3], layer one computes 0.4*0.5 + (-0.2)*(-0.3) + 0.1 = 0.36 and appends it. Layer two reads all three channels, produces a negative weighted sum that ReLU clamps to zero, and appends it. After three layers the vector has grown from two channels to five.",
    },
    id: "densenet",
    name: "DenseNet Dense Block",
    category: "ml-ai",
    complexity: { time: "O(L * c^2)", space: "O(c)" },
    defaultInput: { x0: [0.5, -0.3] },
    visualType: "array",
    run,
    pseudocode: [
        "start with the initial feature vector x0",
        "for each dense layer take the concatenated features so far",
        "compute a weighted sum of those features plus a bias",
        "apply ReLU to obtain one new feature channel",
        "append the new channel to the feature vector",
        "emit the growing concatenated vector",
        "done: report the final channel count and features",
    ],
};

export default module;
