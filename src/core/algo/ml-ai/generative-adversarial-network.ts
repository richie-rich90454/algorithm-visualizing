/**
 * generative-adversarial-network.ts - Vanilla GAN Minimax Training Step
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A generative adversarial network trains two networks against each other. The
 * discriminator tries to assign high probability to real samples and low
 * probability to generated samples, while the generator tries to fool it. This
 * demo uses a linear discriminator and a generator that shifts a fixed noise
 * value, then shows one minimax gradient step using binary cross-entropy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n real and fake samples
 *   Space: O(n) for the discriminator scores
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show real and fake data, discriminator scores, and the two losses.
 *   - The final frame shows the gradient and the updated parameters.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    real?: number[];
    noise?: number[];
    w?: number;
    b?: number;
    gBias?: number;
    lr?: number;
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: labels?.[index] ?? value.toFixed(3),
        value,
        state: states[index] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const real = (task.real ?? [1.5, 2, 2.5]).slice();
    const noise = (task.noise ?? [0, 0.5, 1]).slice();
    const w = typeof task.w === "number" ? task.w : 0.5;
    const b = typeof task.b === "number" ? task.b : 0;
    const gBias = typeof task.gBias === "number" ? task.gBias : 0;
    const lr = typeof task.lr === "number" ? task.lr : 0.1;

    const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x));
    const fake = noise.map((v) => v + gBias);
    const dReal = real.map((v) => sigmoid(w * v + b));
    const dFake = fake.map((v) => sigmoid(w * v + b));
    const safe = (x: number): number => Math.max(1e-12, Math.min(1 - 1e-12, x));

    const dLoss = -(
        dReal.reduce((sum, d) => sum + Math.log(safe(d)), 0) +
        dFake.reduce((sum, d) => sum + Math.log(1 - safe(d)), 0)
    ) / Math.max(1, dReal.length + dFake.length);
    const gLoss = -dFake.reduce((sum, d) => sum + Math.log(safe(d)), 0) / Math.max(1, dFake.length);

    const dDw = -(
        real.reduce((sum, x, i) => sum + (1 - (dReal[i] ?? 0)) * x, 0) -
        fake.reduce((sum, x, i) => sum + (dFake[i] ?? 0) * x, 0)
    ) / Math.max(1, real.length + fake.length);
    const dDb = -(
        dReal.reduce((sum, d) => sum + 1 - d, 0) -
        dFake.reduce((sum, d) => sum + d, 0)
    ) / Math.max(1, real.length + fake.length);
    const dGbias = -dFake.reduce((sum, d) => sum + (1 - d), 0) / Math.max(1, dFake.length);

    const wNew = w - lr * dDw;
    const bNew = b - lr * dDb;
    const gBiasNew = gBias - lr * dGbias;

    yield {
        stepNumber: 0,
        entities: bars(real, new Array<EntityState>(real.length).fill("idle")),
        edges: [],
        description: `Real batch of ${real.length} sample(s); discriminator w=${w.toFixed(3)}, b=${b.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { dReal: dReal.slice(), dFake: dFake.slice(), dLoss, gLoss, dDw, dDb, dGbias, wNew, bNew, gBiasNew },
    };

    yield {
        stepNumber: 1,
        entities: bars(fake, new Array<EntityState>(fake.length).fill("comparing")),
        edges: [],
        description: `Generator shifts noise into fake samples (${fake.map((x) => x.toFixed(2)).join(", ")}).`,
        codeLineNumber: 1,
        layout: "array",
        meta: { dReal: dReal.slice(), dFake: dFake.slice(), dLoss, gLoss, dDw, dDb, dGbias, wNew, bNew, gBiasNew },
    };

    yield {
        stepNumber: 2,
        entities: bars([...dReal, ...dFake], [
            ...new Array<EntityState>(dReal.length).fill("active"),
            ...new Array<EntityState>(dFake.length).fill("swapped"),
        ]),
        edges: [],
        description: `Discriminator scores real and fake samples between zero and one.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { dReal: dReal.slice(), dFake: dFake.slice(), dLoss, gLoss, dDw, dDb, dGbias, wNew, bNew, gBiasNew },
    };

    yield {
        stepNumber: 3,
        entities: bars([dLoss, gLoss], ["active", "swapped"]),
        edges: [],
        description: `Binary cross-entropy losses: discriminator ${dLoss.toFixed(4)}, generator ${gLoss.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { dReal: dReal.slice(), dFake: dFake.slice(), dLoss, gLoss, dDw, dDb, dGbias, wNew, bNew, gBiasNew },
    };

    yield {
        stepNumber: 4,
        entities: bars([dDw, dDb, dGbias], ["comparing", "comparing", "comparing"]),
        edges: [],
        description: `Minimax gradients for discriminator weight, bias, and generator shift.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { dReal: dReal.slice(), dFake: dFake.slice(), dLoss, gLoss, dDw, dDb, dGbias, wNew, bNew, gBiasNew },
    };

    yield {
        stepNumber: 5,
        entities: bars([wNew, bNew, gBiasNew], ["sorted", "sorted", "sorted"]),
        edges: [],
        description: `After one step: w=${wNew.toFixed(4)}, b=${bNew.toFixed(4)}, generator shift=${gBiasNew.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { dReal: dReal.slice(), dFake: dFake.slice(), dLoss, gLoss, dDw, dDb, dGbias, wNew, bNew, gBiasNew },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Two players compete in a game. The discriminator is a classifier that scores how real a sample looks, and the generator turns random noise into samples meant to look real. Each improves against the other: better discrimination creates a sharper learning signal for generation, and better generation forces the discriminator to keep adapting. At equilibrium the generated data matches the real distribution.",
        invariants: [
            "Discriminator outputs are sigmoid scores strictly between zero and one.",
            "The generator loss depends only on how the discriminator scores fake samples.",
            "Both players descend their own loss with a gradient step.",
        ],
        correctness:
            "The discriminator minimizes binary cross-entropy: minus log D on real data and minus log(1 minus D) on fake data. Its gradients follow from the sigmoid derivative D times (1 minus D): the weight gradient is minus the average of (1 minus D_real) times real minus D_fake times fake, and the bias gradient is D_real plus D_fake minus one. The generator maximizes log D on fake samples, so its gradient with respect to its shift is minus the average of (1 minus D_fake), a negative value that gradient descent uses to move fake samples toward the real region.",
        complexityRationale:
            "Scoring n real and n fake samples and accumulating the two losses and gradients is a single linear pass, so time is O(n). Only the score arrays are kept, giving O(n) space.",
        uses: [
            "Image synthesis and photorealistic generation",
            "Data augmentation and learned loss functions",
            "Domain translation and style transfer pipelines",
        ],
        references: [
            "Goodfellow, Pouget-Abadie, Mirza and others, Generative Adversarial Nets, NeurIPS 2014",
            "Goodfellow, GANs in Action and the original NVIDIA tutorial notes, 2014",
        ],
        workedExample:
            "For real samples around 2 and fake samples near 0.5 with discriminator w=0.5, the real scores are above 0.7 and the fake scores near 0.56. The discriminator loss rewards separating them while the generator loss rewards raising the fake scores. The generator gradient with respect to its shift is negative, so a step increases the shift and moves fake samples toward the real values.",
    },
    id: "generative-adversarial-network",
    name: "Generative Adversarial Network",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        real: [1.5, 2, 2.5],
        noise: [0, 0.5, 1],
        w: 0.5,
        b: 0,
        gBias: 0,
        lr: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the real batch, noise, and both network parameters",
        "generate fake samples by shifting the noise",
        "score real and fake samples with the discriminator",
        "compute discriminator and generator cross-entropy losses",
        "differentiate the losses with respect to each parameter",
        "apply one gradient step to both networks",
        "done: report the losses and updated parameters",
    ],
};

export default module;
