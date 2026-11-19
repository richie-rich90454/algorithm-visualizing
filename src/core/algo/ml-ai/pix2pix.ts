/**
 * pix2pix.ts - Pix2Pix Paired Conditional GAN Objective
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Pix2Pix learns image-to-image translation from paired examples. A generator
 * maps an input image to the target domain, and a PatchGAN discriminator tries
 * to tell real target images from translated ones. The generator is trained to
 * fool the discriminator while also matching the paired target with an L1
 * reconstruction term, which keeps the output sharp and structurally correct.
 * This demo uses an affine generator and a per-component discriminator so every
 * term of the conditional GAN objective is computed exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d) for n input components and d output components
 *   Space: O(d) for the generated vector and its per-component losses
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - Bars show the generated output, its absolute error, and discriminator scores.
 *   - The final frame reports the L1, adversarial, and combined generator losses.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Pix2PixInput {
    inputA?: number[];
    targetB?: number[];
    generatorWeights?: number[][]; // d by n
    generatorBias?: number[];
    discriminatorWeights?: number[];
    discriminatorBias?: number;
    lambdaL1?: number;
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

function sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Pix2PixInput | null) ?? {};
    const inputA: number[] = task.inputA ? [...task.inputA] : [1, 0.5, -0.3];
    const targetB: number[] = task.targetB ? [...task.targetB] : [0.8, -0.2, 0.6];
    const generatorWeights: number[][] = Array.isArray(task.generatorWeights)
        ? task.generatorWeights.map((row) => [...row])
        : [
              [0.9, 0.2, -0.1],
              [0.1, -0.6, 0.3],
              [0.2, 0.4, 0.7],
          ];
    const generatorBias: number[] = task.generatorBias ? [...task.generatorBias] : [0.05, -0.1, 0.02];
    const d = generatorWeights.length;
    const discriminatorWeights: number[] = task.discriminatorWeights
        ? [...task.discriminatorWeights]
        : [0.7, -0.4, 0.5];
    const discriminatorBias = typeof task.discriminatorBias === "number" ? task.discriminatorBias : 0.1;
    const lambdaL1 = typeof task.lambdaL1 === "number" ? task.lambdaL1 : 10;

    const generated: number[] = Array.from({ length: d }, (_, j) => {
        let sum = generatorBias[j] ?? 0;
        for (let i = 0; i < inputA.length; i += 1) {
            sum += (generatorWeights[j]?.[i] ?? 0) * (inputA[i] ?? 0);
        }
        return sum;
    });
    const absErrors = generated.map((g, j) => Math.abs(g - (targetB[j] ?? 0)));
    const l1Loss = absErrors.reduce((a, b) => a + b, 0) / Math.max(1, d);
    const scores = generated.map((g) => sigmoid((discriminatorWeights[0] ?? 0) * g + discriminatorBias));
    const advLoss = -scores.reduce((sum, s) => sum + Math.log(s + 1e-12), 0) / Math.max(1, d);
    const totalLoss = advLoss + lambdaL1 * l1Loss;
    const components = [l1Loss, advLoss, totalLoss];

    const commonMeta = {
        n: inputA.length,
        d,
        lambdaL1,
        generated: [...generated],
        absErrors: [...absErrors],
        scores: [...scores],
        l1Loss,
        advLoss,
        totalLoss,
        components,
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(inputA, "idle", "in"),
        edges: [],
        description: `Paired input from domain A with ${inputA.length} components for a ${d}-component generator.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...commonMeta, phase: "input" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(generated, "active", "gen"),
        edges: [],
        description: `Generator maps the input to [${generated.map((v) => v.toFixed(3)).join(", ")}] in domain B.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { ...commonMeta, phase: "generate" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(absErrors, "comparing", "err"),
        edges: [],
        description: `Per-component reconstruction error; mean L1 loss is ${l1Loss.toFixed(5)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...commonMeta, phase: "reconstruct" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(scores, "highlight", "disc"),
        edges: [],
        description: `PatchGAN scores the translation real with probability [${scores.map((v) => v.toFixed(3)).join(", ")}]; adversarial loss ${advLoss.toFixed(5)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { ...commonMeta, phase: "discriminate" },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(components, "sorted", "loss"),
        edges: [],
        description: `Done: generator loss ${totalLoss.toFixed(5)} = adversarial ${advLoss.toFixed(5)} plus ${lambdaL1} times L1 ${l1Loss.toFixed(5)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...commonMeta, phase: "done", converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "When paired images exist, image translation can be supervised directly: the generator should produce the paired target. Pix2pix combines that L1 reconstruction loss with an adversarial loss from a PatchGAN discriminator that judges local patches rather than the whole image. The L1 term keeps the output aligned with the target while the adversarial term pushes fine texture toward the real distribution.",
        invariants: [
            "The generator is a deterministic affine map of the input in this teaching model.",
            "The reconstruction term is the mean absolute error against the paired target.",
            "The generator's adversarial loss is the mean negative log probability that the discriminator calls its output real.",
        ],
        correctness:
            "The generator output, per-component absolute error, discriminator score, and negative log-likelihood are each closed-form arithmetic expressions. The test recomputes every term independently, verifies that a generator matching the target gives zero L1 loss, and confirms that a higher discriminator score lowers the adversarial loss while the lambda weight scales only the reconstruction term.",
        complexityRationale:
            "Forming each of the d output components touches the n input components, costing O(n d); the loss terms and discriminator scores are a further O(d). Only the generated vector and its per-component arrays are stored, O(d) space.",
        uses: [
            "Paired image-to-image translation such as map to satellite",
            "Image colorization, inpainting, and style transfer with aligned data",
            "Any supervised generative task needing both structure and realism",
        ],
        references: [
            "Isola, Zhu, Zhou, and Efros, Image-to-Image Translation with Conditional Adversarial Networks, CVPR 2017",
            "Goodfellow et al., Generative Adversarial Nets, NeurIPS 2014",
        ],
        workedExample:
            "With input [1, 0.5], target [0.9, 0.2], and a generator that outputs [0.95, 0.18], the absolute errors are [0.05, 0.02] and the L1 loss is 0.035. If the discriminator gives those outputs real-probabilities 0.7 and 0.6, the adversarial loss is about 0.46, and with lambda ten the combined generator loss is about 0.81.",
    },
    id: "pix2pix",
    name: "Pix2Pix Conditional GAN",
    category: "ml-ai",
    complexity: { time: "O(n * d)", space: "O(d)" },
    defaultInput: {
        inputA: [1, 0.5, -0.3],
        targetB: [0.8, -0.2, 0.6],
        generatorWeights: [
            [0.9, 0.2, -0.1],
            [0.1, -0.6, 0.3],
            [0.2, 0.4, 0.7],
        ],
        generatorBias: [0.05, -0.1, 0.02],
        discriminatorWeights: [0.7, -0.4, 0.5],
        discriminatorBias: 0.1,
        lambdaL1: 10,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the paired source and target vectors and both networks",
        "compute the generator output as weights times the source plus bias",
        "measure the mean absolute error against the paired target",
        "score the generated output with the discriminator sigmoid",
        "compute the mean negative log real-probability as the adversarial loss",
        "add lambda times the L1 loss to the adversarial loss",
        "done: report the generator, loss terms, and combined objective",
    ],
};

export default module;
