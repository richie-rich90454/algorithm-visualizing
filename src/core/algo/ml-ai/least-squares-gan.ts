/**
 * least-squares-gan.ts - Least-Squares GAN Objective
 *
 * LSGAN replaces the saturating log loss of a standard GAN with squared error.
 * The discriminator is pushed toward one on real samples and zero on generated
 * samples, while the generator is pushed toward one on its own samples. The
 * squared objective gives non-vanishing gradients away from the targets. This
 * teaching core uses a linear discriminator so one gradient step is exact.
 *
 * Time:  O(n + m) per step, space O(n + m)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface LsganInput {
    real: number[];
    fake: number[];
    slope: number;
    lr: number;
}

function discriminatorLoss(real: number[], fake: number[], slope: number): number {
    const realPart = real.reduce((sum, x) => sum + Math.pow(slope * x - 1, 2), 0) / (2 * real.length);
    const fakePart = fake.reduce((sum, x) => sum + Math.pow(slope * x, 2), 0) / (2 * fake.length);
    return realPart + fakePart;
}

function generatorLoss(fake: number[], slope: number): number {
    return fake.reduce((sum, x) => sum + Math.pow(slope * x - 1, 2), 0) / (2 * fake.length);
}

function gradient(real: number[], fake: number[], slope: number): number {
    const realPart = real.reduce((sum, x) => sum + (slope * x - 1) * x, 0) / real.length;
    const fakePart = fake.reduce((sum, x) => sum + slope * x * x, 0) / fake.length;
    return realPart + fakePart;
}

function makeBars(values: number[], fakeStart: number, active: number): VisualEntity[] {
    return values.map((value, i) => {
        const state: EntityState = i === active ? "comparing" : (i >= fakeStart ? "active" : "sorted");
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `${i >= fakeStart ? "fake" : "real"}${i}: ${value.toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: i >= fakeStart ? "fake" : "real" },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<LsganInput> | null) ?? {};
    const real: number[] = Array.isArray(task.real) && task.real.length > 0 ? task.real.slice() : [0.8, 1.0, 1.2];
    const fake: number[] = Array.isArray(task.fake) && task.fake.length > 0 ? task.fake.slice() : [0.2, 0.4, 0.6];
    const slope = typeof task.slope === "number" ? task.slope : 0.4;
    const lr = Math.max(0, task.lr ?? 0.1);
    const n = real.length + fake.length;

    const dLoss = discriminatorLoss(real, fake, slope);
    const gLoss = generatorLoss(fake, slope);
    const grad = gradient(real, fake, slope);
    const nextSlope = slope - lr * grad;
    const dLossAfter = discriminatorLoss(real, fake, nextSlope);
    const gLossAfter = generatorLoss(fake, nextSlope);
    const scores = real.map((x) => slope * x).concat(fake.map((x) => slope * x));
    const nextScores = real.map((x) => nextSlope * x).concat(fake.map((x) => nextSlope * x));
    const base = { realCount: real.length, fakeCount: fake.length, n, slope, nextSlope, grad, lr, dLoss, gLoss, dLossAfter, gLossAfter, rows: 1, cols: n };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(scores, real.length, -1),
        edges: [],
        description: `LSGAN with ${real.length} real and ${fake.length} fake samples; discriminator loss ${dLoss.toFixed(4)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, scores },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(scores, real.length, 0),
        edges: [],
        description: `Real scores are pulled toward one and fake scores toward zero with squared error.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { ...base, scores },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(nextScores, real.length, -1),
        edges: [],
        description: `One discriminator step changes the slope from ${slope.toFixed(3)} to ${nextSlope.toFixed(3)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { ...base, scores: nextScores },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(nextScores, real.length, -1),
        edges: [],
        description: `Done: discriminator loss ${dLossAfter.toFixed(4)}, generator loss ${gLossAfter.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, scores: nextScores, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A standard GAN uses a log loss that can saturate when the discriminator is confident, leaving the generator with almost no gradient. LSGAN swaps in squared error: real samples should score one, fake samples should score zero, and the generator tries to make its own samples score one. Because squared error keeps growing with distance from the target, training signals stay informative.",
        invariants: [
            "The discriminator loss averages half the squared distance to one on real data and to zero on fake data.",
            "The generator loss averages half the squared distance to one on fake data.",
            "For a linear discriminator the loss is a convex quadratic, so a small gradient step cannot increase it.",
        ],
        correctness:
            "Differentiating the half-squared discriminator objective with respect to the slope gives the mean of the residual times the sample value on real data plus the mean of the score times the sample value on fake data, exactly the update used here. The objective is a positive quadratic in the slope, so its unique stationary point is the global minimum and a sufficiently small step decreases it. The test recomputes both losses and the gradient independently, confirms the descent, and verifies the fixed point moves real scores toward one and fake scores toward zero.",
        complexityRationale:
            "Each loss and the gradient scan the real and fake samples once, so one update is O(n + m) in the sample counts. Storing the score arrays uses O(n + m) space.",
        uses: [
            "Stable image generation with less vanishing gradient",
            "Semantic segmentation and super-resolution GAN training",
            "A simple baseline objective for comparing GAN loss functions",
        ],
        references: [
            "Mao et al., Least Squares Generative Adversarial Networks, ICCV, 2017",
            "Goodfellow et al., Generative Adversarial Networks, NeurIPS, 2014",
        ],
        workedExample:
            "With real samples 0.8, 1.0, 1.2 and fake samples 0.2, 0.4, 0.6, slope 0.4, and learning rate 0.1, the discriminator scores real samples below one and fake samples near zero. The gradient of the squared objective is positive, so the slope increases toward about 0.82. At that optimum the average real score is about 0.82 and the average fake score about 0.33, so the two groups are clearly separated and the discriminator loss is minimized.",
    },
    id: "least-squares-gan",
    name: "Least-Squares GAN",
    category: "ml-ai",
    complexity: { time: "O(n + m)", space: "O(n + m)" },
    defaultInput: {
        real: [0.8, 1.0, 1.2],
        fake: [0.2, 0.4, 0.6],
        slope: 0.4,
        lr: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the real samples, fake samples, initial slope, and learning rate",
        "score each sample as the slope times its value",
        "compute half the squared distance to one on real scores",
        "compute half the squared fake score on generated samples",
        "differentiate the combined objective with respect to the slope",
        "take one gradient step and recompute both losses",
        "done: report the updated scores and the two losses",
    ],
};

export default module;
