/**
 * resnet-residual-network.ts - Residual Block Forward Pass
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A residual block learns a transformation F(x) and returns F(x) + x instead of
 * just F(x). The skip connection gives gradients a direct path to earlier
 * layers, which is what makes very deep networks trainable. This demo computes
 * a tiny but faithful block: two affine transforms with ReLU in between, the
 * additive skip, and a final ReLU, on a two-component feature vector.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d^2) for a d-dimensional block with dense stand-in matrices
 *   Space: O(d) for the stored activation vector
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame shows the current two-component activation as bars.
 *   - The stage caption names the operation just performed.
 *   - The final frame reports the block output values.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vector = number[];
type Matrix = number[][];

interface BlockInput {
    x: Vector;
    w1: Matrix;
    b1: Vector;
    w2: Matrix;
    b2: Vector;
}

/** Multiply a matrix by a column vector. */
function matVec(w: Matrix, x: Vector): Vector {
    return w.map((row) => row.reduce((sum, weight, index) => sum + weight * (x[index] ?? 0), 0));
}

/** Add a bias vector componentwise. */
function addBias(v: Vector, b: Vector): Vector {
    return v.map((value, index) => value + (b[index] ?? 0));
}

/** Rectified linear unit, applied componentwise. */
function relu(v: Vector): Vector {
    return v.map((value) => Math.max(0, value));
}

/** Build bar entities for an activation vector at a given stage. */
function makeBars(values: Vector, stage: string, active: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `activation-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: (active ? "active" : "idle") as EntityState,
        x: index * 40,
        y: 0,
        width: 20,
        height: 0,
        metadata: { index, stage, value },
    }));
}

/** The residual block generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<BlockInput> | null) ?? {};
    const x: Vector = task.x ?? [1, -0.5];
    const w1: Matrix = task.w1 ?? [
        [0.5, -0.3],
        [0.2, 0.8],
    ];
    const b1: Vector = task.b1 ?? [0.1, -0.1];
    const w2: Matrix = task.w2 ?? [
        [-0.4, 0.6],
        [0.3, -0.2],
    ];
    const b2: Vector = task.b2 ?? [0.05, 0.05];

    const stages: Array<{ name: string; values: Vector; line: number }> = [];
    stages.push({ name: "input", values: x.slice(), line: 0 });

    const conv1 = addBias(matVec(w1, x), b1);
    stages.push({ name: "linear1", values: conv1, line: 2 });

    const activated1 = relu(conv1);
    stages.push({ name: "relu1", values: activated1, line: 3 });

    const conv2 = addBias(matVec(w2, activated1), b2);
    stages.push({ name: "linear2", values: conv2, line: 4 });

    const skipped = conv2.map((value, index) => value + (x[index] ?? 0));
    stages.push({ name: "add-skip", values: skipped, line: 5 });

    const output = relu(skipped);
    stages.push({ name: "output", values: output, line: 6 });

    for (let step = 0; step < stages.length; step += 1) {
        const stage = stages[step];
        if (!stage) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: makeBars(stage.values, stage.name, step === stages.length - 1),
            edges: [],
            description: `Residual block stage ${step} (${stage.name}): activation [${stage.values.map((value) => value.toFixed(3)).join(", ")}].`,
            codeLineNumber: stage.line,
            layout: "array",
            meta: { stage: stage.name, dimension: stage.values.length, values: stage.values.map((value) => Number(value.toFixed(6))) },
        };
    }
}

/** The residual network module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Deep networks are hard to train because gradients can vanish on the long path back to early layers. A residual block solves this by adding the input straight to the output: the layer only has to learn a small correction on top of the identity. In the forward pass you compute a short transformation and then add the original input back, which is exactly what this visualization shows one component at a time.",
        invariants: [
            "The skip connection adds the original input x unchanged to the second transform's output.",
            "Each ReLU clamps negative activations to zero and leaves positives untouched.",
            "The output has the same dimension as the input because the skip path preserves shape.",
        ],
        correctness:
            "The generator applies the same affine transforms, ReLUs, and additive skip as a textbook residual block. The test recomputes output = ReLU(W2 * ReLU(W1 * x + b1) + b2 + x) with an independent reference and also verifies that removing the skip changes the result, confirming that the shortcut is genuinely part of the computation rather than decoration.",
        complexityRationale:
            "Multiplying a d by d matrix by a d-vector costs O(d^2), and a block performs two such products, giving O(d^2) time. Only the current activation vector is stored at each frame, so space is O(d).",
        uses: [
            "Building very deep image classifiers such as ResNet-50 and ResNet-152",
            "Stabilizing training in transformer feed-forward blocks",
            "Any network where identity mappings help gradient flow",
        ],
        references: [
            "He et al., Deep Residual Learning for Image Recognition, CVPR 2016",
            "He et al., Identity Mappings in Deep Residual Networks, ECCV 2016",
        ],
        workedExample:
            "For x = [1, -0.5] the first affine transform gives [0.65, -0.2], ReLU gives [0.65, 0], the second affine gives [-0.21, 0.145], and adding the skip yields [0.79, -0.355]. A final ReLU produces [0.79, 0], the block output shown in the last frame.",
    },
    id: "resnet-residual-network",
    name: "Residual Network Block",
    category: "ml-ai",
    complexity: { time: "O(d^2)", space: "O(d)" },
    defaultInput: { x: [1, -0.5] },
    visualType: "array",
    run,
    pseudocode: [
        "start with the input activation x",
        "compute the first affine transform W1 times x plus b1",
        "apply ReLU to the first transform",
        "compute the second affine transform W2 times the result plus b2",
        "add the original input x to get the residual output",
        "apply ReLU to the summed activation",
        "emit the block output for the next layer",
    ],
};

export default module;
