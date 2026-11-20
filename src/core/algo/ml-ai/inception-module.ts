/**
 * inception-module.ts - Inception Multi-Scale Branch Concatenation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * An inception module applies several differently sized convolutions to the
 * same input in parallel and concatenates their outputs. Small kernels capture
 * local patterns, large kernels capture wider patterns, and a pooling branch
 * summarizes the field, all at once. This demo models each branch as a small
 * affine transform with a fixed channel count, then concatenates the branch
 * outputs into one feature vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(sum of branch matrix sizes)
 *   Space: O(total output channels)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows one branch's output channels as bars.
 *   - The final frame shows the concatenated output of all branches.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface InceptionInput {
    x: number[];
    w1: number[][];
    b1: number[];
    w2: number[][];
    b2: number[];
    w3: number[][];
    b3: number[];
    w4: number[][];
    b4: number[];
}

/** Multiply a matrix by a column vector and add a bias, then apply ReLU. */
function affineRelu(w: number[][], b: number[], x: number[]): number[] {
    return w.map((row, index) => {
        let sum = b[index] ?? 0;
        row.forEach((weight, j) => {
            sum += weight * (x[j] ?? 0);
        });
        return Math.max(0, sum);
    });
}

/** Build bar entities for a channel vector. */
function makeBars(values: number[], stage: string, active: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `channel-${index}`,
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

/** The inception module generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<InceptionInput> | null) ?? {};
    const x: number[] = task.x ?? [1, 0.5];
    const w1 = task.w1 ?? [[0.6, 0.2]];
    const b1 = task.b1 ?? [0.1];
    const w2 = task.w2 ?? [[0.3, -0.1], [0.2, 0.5]];
    const b2 = task.b2 ?? [0.05, -0.05];
    const w3 = task.w3 ?? [[-0.2, 0.7]];
    const b3 = task.b3 ?? [0.0];
    const w4 = task.w4 ?? [[0.5, 0.1], [-0.3, 0.4]];
    const b4 = task.b4 ?? [0.1, 0.0];

    const branches: Array<{ name: string; values: number[] }> = [
        { name: "1x1 branch", values: affineRelu(w1, b1, x) },
        { name: "3x3 branch", values: affineRelu(w2, b2, x) },
        { name: "5x5 branch", values: affineRelu(w3, b3, x) },
        { name: "pool branch", values: affineRelu(w4, b4, x) },
    ];

    for (let step = 0; step < branches.length; step += 1) {
        const branch = branches[step];
        if (!branch) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeBars(branch.values, branch.name, false),
            edges: [],
            description: `${branch.name} produced ${branch.values.length} channel(s) from the shared input.`,
            codeLineNumber: step + 1,
            layout: "array",
            meta: { stage: branch.name, channels: branch.values.length, values: branch.values.map((v) => Number(v.toFixed(6))) },
        };
    }

    const concatenated = branches.flatMap((branch) => branch.values);
    yield {
        stepNumber: branches.length,
        entities: makeBars(concatenated, "concat", true),
        edges: [],
        description: `Concatenated all four branches into ${concatenated.length} output channel(s).`,
        codeLineNumber: 6,
        layout: "array",
        meta: { stage: "concat", channels: concatenated.length, values: concatenated.map((v) => Number(v.toFixed(6))) },
    };
}

/** The Inception module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than guessing one convolution kernel size, an inception module tries several at the same time. A one-by-one branch sees tight local patterns, three-by-three and five-by-five branches see progressively wider context, and a pooling branch summarizes the region. Their channel outputs are stacked side by side so the next layer can use all of those scales at once.",
        invariants: [
            "Every branch reads the same input feature vector.",
            "Each branch applies ReLU before its channels are concatenated.",
            "The output channel count is the sum of the four branch channel counts.",
        ],
        correctness:
            "The generator computes each branch independently and concatenates them in a fixed order. The test recomputes every branch with an independent affine-ReLU reference and verifies that the final vector equals the concatenation in exact order, and that its length equals the sum of branch widths, confirming the multi-scale merge is faithful.",
        complexityRationale:
            "Each branch costs a matrix-vector multiply proportional to its weight count, so the total time is the sum of the branch matrix sizes. The concatenated output holds one value per output channel, giving space linear in that total width.",
        uses: [
            "GoogLeNet and Inception image classification families",
            "Multi-scale feature extraction where object size varies",
            "Network blocks that combine local and wide receptive fields",
        ],
        references: [
            "Szegedy et al., Going Deeper with Convolutions, CVPR 2015",
            "Szegedy et al., Rethinking the Inception Architecture, CVPR 2016",
        ],
        workedExample:
            "For input [1, 0.5] the 1x1 branch produces one channel, the 3x3 and pool branches produce two each, and the 5x5 branch produces one. Concatenating in branch order yields six channels, which the final frame displays as a single grown feature vector.",
    },
    id: "inception-module",
    name: "Inception Module",
    category: "ml-ai",
    complexity: { time: "O(sum of branch sizes)", space: "O(total channels)" },
    defaultInput: { x: [1, 0.5] },
    visualType: "array",
    run,
    pseudocode: [
        "start with the shared input feature vector x",
        "compute the 1x1 branch output channels",
        "compute the 3x3 branch output channels",
        "compute the 5x5 branch output channels",
        "compute the pooling branch output channels",
        "concatenate all branch channels in order",
        "emit the combined multi-scale output",
    ],
};

export default module;
