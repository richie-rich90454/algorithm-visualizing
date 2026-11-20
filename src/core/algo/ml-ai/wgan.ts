/**
 * wgan.ts - Wasserstein GAN Critic Update with Weight Clipping
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A Wasserstein GAN replaces the discriminator with a critic that outputs an
 * unbounded real score. Its loss is the mean critic score on fake samples minus
 * the mean score on real samples, which approximates the Wasserstein distance
 * when the critic is Lipschitz. The original implementation enforces that
 * constraint by clipping the critic weights to a small interval after each
 * gradient step. This demo shows one critic update and the generator gradient.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n real and fake samples
 *   Space: O(n) for the critic outputs
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show real samples, fake samples, and their critic scores.
 *   - The final frames show the Wasserstein estimate and the clipped weight.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    real?: number[];
    fake?: number[];
    w?: number;
    b?: number;
    clip?: number;
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
    const real = (task.real ?? [2, 3, 2.5]).slice();
    const fake = (task.fake ?? [0, 1, -1]).slice();
    const w = typeof task.w === "number" ? task.w : 0.3;
    const b = typeof task.b === "number" ? task.b : 0;
    const clip = typeof task.clip === "number" ? Math.max(1e-6, task.clip) : 0.01;
    const lr = typeof task.lr === "number" ? task.lr : 0.05;

    const critic = (x: number): number => w * x + b;
    const realScores = real.map(critic);
    const fakeScores = fake.map(critic);
    const meanReal = realScores.reduce((a, v) => a + v, 0) / Math.max(1, realScores.length);
    const meanFake = fakeScores.reduce((a, v) => a + v, 0) / Math.max(1, fakeScores.length);
    const wasserstein = meanReal - meanFake;
    const criticLoss = -wasserstein;
    const dW = -real.reduce((a, v) => a + v, 0) / Math.max(1, real.length)
        + fake.reduce((a, v) => a + v, 0) / Math.max(1, fake.length);
    const wUpdated = Math.max(-clip, Math.min(clip, w - lr * dW));
    const genLoss = -meanFake;

    yield {
        stepNumber: 0,
        entities: bars(real, new Array<EntityState>(real.length).fill("idle")),
        edges: [],
        description: `Real batch of ${real.length} sample(s); critic initially w=${w.toFixed(3)}, b=${b.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { wasserstein, criticLoss, w, wUpdated, dW, genLoss },
    };

    yield {
        stepNumber: 1,
        entities: bars(fake, new Array<EntityState>(fake.length).fill("comparing")),
        edges: [],
        description: `Fake batch of ${fake.length} sample(s) from the generator.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { wasserstein, criticLoss, w, wUpdated, dW, genLoss },
    };

    yield {
        stepNumber: 2,
        entities: bars([...realScores, ...fakeScores], [
            ...new Array<EntityState>(real.length).fill("active"),
            ...new Array<EntityState>(fake.length).fill("swapped"),
        ]),
        edges: [],
        description: `Critic scores: real mean ${meanReal.toFixed(3)}, fake mean ${meanFake.toFixed(3)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { wasserstein, criticLoss, w, wUpdated, dW, genLoss, realScores, fakeScores },
    };

    yield {
        stepNumber: 3,
        entities: bars([wasserstein], ["active"]),
        edges: [],
        description: `Estimated Wasserstein distance (real mean minus fake mean) = ${wasserstein.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { wasserstein, criticLoss, w, wUpdated, dW, genLoss },
    };

    yield {
        stepNumber: 4,
        entities: bars([wUpdated], ["sorted"]),
        edges: [],
        description: `Gradient step gives w=${(w - lr * dW).toFixed(4)}, clipped to ${wUpdated.toFixed(4)} in [-${clip}, ${clip}].`,
        codeLineNumber: 5,
        layout: "array",
        meta: { wasserstein, criticLoss, w, wUpdated, dW, genLoss, clipped: Math.abs(wUpdated) <= clip + 1e-12 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A vanilla GAN discriminator becomes saturated once it separates the two distributions perfectly, leaving no useful gradient. The Wasserstein GAN instead trains a critic whose score need not be a probability, and asks it to assign higher values to real data than to generated data. The gap between those averages is a measure of distance between distributions that keeps giving meaningful gradients.",
        invariants: [
            "The critic is linear here, so the score of x is w times x plus b.",
            "The critic loss is the fake mean minus the real mean.",
            "After the update the weight lies inside the clipping interval.",
        ],
        correctness:
            "For a linear critic the gradient of the loss with respect to w is the fake mean minus the real mean, so a gradient descent step increases w when real values exceed fake values and the critic scores real data higher. The height of the gap, real mean minus fake mean, equals the empirical Wasserstein-1 estimate for the one-dimensional projection. Clipping w to a fixed interval bounds the critic's Lipschitz constant for inputs in that range, which is the constraint required by the Kantorovich dual.",
        complexityRationale:
            "Evaluating the critic on n real and n fake samples takes O(n) time, and the means and gradient are accumulated in the same pass. Only the score arrays are stored, so space is O(n).",
        uses: [
            "Stable generative adversarial training with meaningful loss curves",
            "Distribution matching in image and audio generation",
            "Learning critics that estimate a distance between sample sets",
        ],
        references: [
            "Arjovsky, Chintala and Bottou, Wasserstein GAN, ICML 2017",
            "Gulrajani, Ahmed, Arjovsky, Dumoulin and Courville, Improved Training of Wasserstein GANs, NeurIPS 2017",
        ],
        workedExample:
            "With real samples (2, 3, 2.5) and fake samples (0, 1, -1), the real mean is 2.5 and the fake mean is 0, so the Wasserstein estimate is 2.5 and the critic loss is -2.5. The gradient with respect to w is 0 minus 2.5, so a step with learning rate 0.05 raises w by 0.125 before it is clipped back into the small allowed interval.",
    },
    id: "wgan",
    name: "Wasserstein GAN Critic",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        real: [2, 3, 2.5],
        fake: [0, 1, -1],
        w: 0.3,
        b: 0,
        clip: 0.01,
        lr: 0.05,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the real and fake batches, critic weights, and clip bound",
        "score every real sample with the critic",
        "score every fake sample with the critic",
        "set the Wasserstein estimate to real mean minus fake mean",
        "take a gradient step on the critic weight",
        "clip the weight back into the allowed interval",
        "done: report the distance and generator loss",
    ],
};

export default module;
