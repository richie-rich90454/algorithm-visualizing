/**
 * controlnet.ts - ControlNet Zero-Initialized Conditioning Branch
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ControlNet adds spatial control to a frozen diffusion model by cloning its
 * encoder into a trainable side branch. The branch's output convolutions are
 * initialized to zero, so at the start of training the branch contributes
 * nothing and the model behaves exactly as before. As training proceeds the
 * learned control signal is added to the base output, scaled by a conditioning
 * strength. This demo computes that additive conditioning exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T * k * d) for T steps, control width k, and output width d
 *   Space: O(T * d) for the reported output table
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the control-branch contribution and the combined output.
 *   - Each denoising step is replayed with its base and control vectors.
 *   - Meta exposes the zero-initialization identity and every output vector.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface ControlInput {
    baseOutputs?: number[][];
    controlSignals?: number[][];
    controlWeights?: number[][]; // k by d matrix
    scale?: number;
}

function bars(values: number[], state: EntityState, prefix: string): VisualEntity[] {
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

function flatten(rows: number[][]): number[] {
    return rows.reduce<number[]>((acc, row) => acc.concat(row), []);
}

/** Apply the control branch: a k-vector times a k by d matrix gives a d-vector. */
function branch(signal: number[], weights: number[][], d: number): number[] {
    return Array.from({ length: d }, (_, j) => {
        let sum = 0;
        for (let k = 0; k < signal.length; k += 1) {
            sum += (signal[k] ?? 0) * (weights[k]?.[j] ?? 0);
        }
        return sum;
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ControlInput | null) ?? {};
    const baseOutputs: number[][] = Array.isArray(task.baseOutputs) && task.baseOutputs.length > 0
        ? task.baseOutputs.map((row) => [...row])
        : [
              [0.2, -0.1, 0.4],
              [0.5, 0.3, -0.2],
              [-0.1, 0.6, 0.2],
          ];
    const controlSignals: number[][] = Array.isArray(task.controlSignals) && task.controlSignals.length === baseOutputs.length
        ? task.controlSignals.map((row) => [...row])
        : baseOutputs.map((_, t) => [0.4 + 0.1 * t, -0.2 + 0.05 * t]);
    const d = baseOutputs[0]?.length ?? 0;
    const controlWeights: number[][] = Array.isArray(task.controlWeights)
        ? task.controlWeights.map((row) => [...row])
        : [
              [0.8, -0.3, 0.5],
              [0.2, 0.9, -0.4],
          ];
    const scale = typeof task.scale === "number" ? task.scale : 1.5;
    const T = baseOutputs.length;

    const controlOuts: number[][] = [];
    const outputs: number[][] = [];
    for (let t = 0; t < T; t += 1) {
        const contribution = branch(controlSignals[t] ?? [], controlWeights, d);
        controlOuts.push(contribution);
        outputs.push((baseOutputs[t] ?? []).map((v, j) => v + scale * (contribution[j] ?? 0)));
    }

    const zeroInitWeights = controlWeights.map((row) => row.map(() => 0));
    const identityCheck = baseOutputs.every((base, t) =>
        branch(controlSignals[t] ?? [], zeroInitWeights, d).every((v, j) => Math.abs(base[j]! + scale * v - (base[j] ?? 0)) < 1e-12),
    );

    const commonMeta = {
        T,
        d,
        scale,
        base: flatten(baseOutputs),
        control: flatten(controlSignals),
        controlOut: flatten(controlOuts),
        outputs: flatten(outputs),
        zeroInitIdentity: identityCheck,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(controlWeights[0] ?? [], "idle", "w"),
        edges: [],
        description: `ControlNet side branch with zero-initialized convolutions; at initialization the output equals the frozen base model.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...commonMeta, t: -1, phase: "init" },
    };
    step += 1;

    for (let t = 0; t < T; t += 1) {
        yield {
            stepNumber: step,
            entities: bars(controlOuts[t] ?? [], "comparing", "ctrl"),
            edges: [],
            description: `Step ${t}: the control branch maps the conditioning signal to contribution [${(controlOuts[t] ?? []).map((v) => v.toFixed(3)).join(", ")}].`,
            codeLineNumber: 2,
            layout: "array",
            meta: { ...commonMeta, t, phase: "branch" },
        };
        step += 1;

        yield {
            stepNumber: step,
            entities: bars(outputs[t] ?? [], "active", "out"),
            edges: [],
            description: `Step ${t}: combined output equals base plus ${scale} times the control contribution.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { ...commonMeta, t, phase: "combine" },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars(outputs[T - 1] ?? [], "sorted", "out"),
        edges: [],
        description: `Done: replayed ${T} steps; zero-initialized weights leave the base output unchanged (verified: ${identityCheck}).`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...commonMeta, t: T, phase: "done", converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Fine-tuning a whole diffusion model on a new spatial condition can destroy what it already learned. ControlNet copies the encoder into a side branch and initializes that branch with zero-weight convolutions, so training starts as a perfect identity: the output is the original model's. Gradients still flow through the zero convolutions, letting the branch gradually learn a residual that is added back at a chosen strength.",
        invariants: [
            "With all branch weights zero, every output equals the frozen base output.",
            "A scale of zero also makes the output equal the base output.",
            "The combined output is base plus scale times the control branch contribution, componentwise.",
        ],
        correctness:
            "The branch is a linear map from the control signal to a same-width feature vector, and the combined output adds a scalar multiple of it to the base feature. When the matrix is zero the product vanishes exactly, recovering the base output, which is the defining zero-initialization property. The test recomputes every contribution and output independently and verifies both identity properties and the linear scaling of the residual.",
        complexityRationale:
            "For each of T steps the branch multiplies a k-vector by a k by d matrix, costing O(k d), and adds d components, so total time is O(T k d). Storing one output vector per step uses O(T d) space.",
        uses: [
            "Edge, pose, and depth conditioned image generation",
            "Controllable diffusion without retraining the base model",
            "Structural guidance in architectural and medical imaging",
        ],
        references: [
            "Zhang, Rao, and Agrawala, Adding Conditional Control to Text-to-Image Diffusion Models, ICCV 2023",
            "Rombach et al., High-Resolution Image Synthesis with Latent Diffusion Models, CVPR 2022",
        ],
        workedExample:
            "For a base feature [0.2, -0.1, 0.4], a control signal [0.4, -0.2], weights mapping it to [0.36, -0.30, 0.28], and scale 1.5, the added residual is [0.54, -0.45, 0.42], so the combined output is [0.74, -0.55, 0.82]. If the weights were zero, the output would stay [0.2, -0.1, 0.4].",
    },
    id: "controlnet",
    name: "ControlNet Zero-Initialized Conditioning",
    category: "ml-ai",
    complexity: { time: "O(T * k * d)", space: "O(T * d)" },
    defaultInput: {
        baseOutputs: [
            [0.2, -0.1, 0.4],
            [0.5, 0.3, -0.2],
            [-0.1, 0.6, 0.2],
        ],
        controlSignals: [
            [0.4, -0.2],
            [0.5, -0.15],
            [0.6, -0.1],
        ],
        controlWeights: [
            [0.8, -0.3, 0.5],
            [0.2, 0.9, -0.4],
        ],
        scale: 1.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "clone a frozen model's encoder into a trainable control branch",
        "initialize every branch convolution weight to zero",
        "for each step map the conditioning signal through the branch",
        "multiply the branch contribution by the conditioning scale",
        "add the scaled contribution to the frozen base output",
        "done: report the conditioned outputs and identity check",
    ],
};

export default module;
