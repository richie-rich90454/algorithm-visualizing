/**
 * quantum-generative-adversarial-network.ts - Minimal Quantum GAN
 *
 * A one-qubit exact simulation of adversarial training. The generator prepares
 * a parameterized single-qubit state and a classical discriminator observes
 * the measurement bit and tries to tell generated samples from real samples
 * drawn from a Bernoulli target. Both players are updated with exact analytic
 * gradients of the minimax loss, so no sampling noise enters the demonstration.
 * This ideal model is limited to one qubit, a logistic discriminator, and a
 * fixed number of alternating epochs; it does not model finite-shot sampling,
 * quantum gradients on hardware, or large networks.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface GanInput {
    target?: number;
    epochs?: number;
    lr?: number;
}

function sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, z))));
}

function makeBars(values: number[], highlight: number, final: boolean): VisualEntity[] {
    const labels = ["P_gen(0)", "P_gen(1)", "D(0)", "D(1)"];
    return values.map((value, index) => ({
        id: `value-${labels[index]}`,
        type: "bar" as const,
        label: `${labels[index]}: ${value.toFixed(4)}`,
        value,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, name: labels[index]!, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as GanInput | null) ?? {};
    const target = typeof task.target === "number" && Number.isFinite(task.target)
        ? Math.max(0.05, Math.min(0.95, task.target))
        : 0.3;
    const epochs = typeof task.epochs === "number" ? Math.max(1, Math.min(10, Math.floor(task.epochs))) : 6;
    const lr = typeof task.lr === "number" && Number.isFinite(task.lr) ? Math.max(0.01, Math.min(0.5, task.lr)) : 0.2;
    let theta = 0.8;
    let a = 1;
    let b = 0;
    const clamp = (d: number): number => Math.max(1e-12, Math.min(1 - 1e-12, d));
    const metaFor = (epoch: number, gradA: number, gradB: number, gradTheta: number, done: boolean) => {
        const p0 = Math.cos(theta / 2) ** 2;
        const p1 = Math.sin(theta / 2) ** 2;
        const d0 = clamp(sigmoid(b));
        const d1 = clamp(sigmoid(a + b));
        const discriminatorLoss = -(target * Math.log(d0) + (1 - target) * Math.log(d1) + p0 * Math.log(1 - d0) + p1 * Math.log(1 - d1));
        const generatorLoss = -(p0 * Math.log(d0) + p1 * Math.log(d1));
        return {
            target,
            epochs,
            epoch,
            theta,
            discriminatorWeight: a,
            discriminatorBias: b,
            generatorProbabilities: [p0, p1],
            generatorAmplitudes: [Math.cos(theta / 2), 0, Math.sin(theta / 2), 0],
            discriminatorOutputs: [d0, d1],
            discriminatorLoss,
            generatorLoss,
            gradD: [gradA, gradB],
            gradG: gradTheta,
            done,
        };
    };

    yield {
        stepNumber: 0,
        entities: makeBars([Math.cos(theta / 2) ** 2, Math.sin(theta / 2) ** 2, sigmoid(b), sigmoid(a + b)], -1, false),
        edges: [],
        description: `Initialized a one-qubit generator and a logistic discriminator against a target zero probability of ${target.toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(0, 0, 0, 0, false),
    };

    for (let epoch = 1; epoch <= epochs; epoch += 1) {
        const p0 = Math.cos(theta / 2) ** 2;
        const p1 = Math.sin(theta / 2) ** 2;
        const d0 = clamp(sigmoid(b));
        const d1 = clamp(sigmoid(a + b));
        const gradA = -(1 - target) * (1 - d1) + p1 * d1;
        const gradB = -target * (1 - d0) - (1 - target) * (1 - d1) + p0 * d0 + p1 * d1;
        const gradTheta = 0.5 * Math.sin(theta) * (Math.log(d1) - Math.log(d0));
        a += lr * gradA;
        b += lr * gradB;
        theta = Math.max(0, Math.min(Math.PI, theta + lr * gradTheta));
        yield {
            stepNumber: epoch,
            entities: makeBars([Math.cos(theta / 2) ** 2, Math.sin(theta / 2) ** 2, clamp(sigmoid(b)), clamp(sigmoid(a + b))], 0, false),
            edges: [],
            description: `Epoch ${epoch}: the discriminator ascends its loss gradient and the generator descends its own, moving the generated bit distribution toward the target.`,
            codeLineNumber: 2,
            layout: "array",
            meta: metaFor(epoch, gradA, gradB, gradTheta, false),
        };
    }

    yield {
        stepNumber: epochs + 1,
        entities: makeBars([Math.cos(theta / 2) ** 2, Math.sin(theta / 2) ** 2, clamp(sigmoid(b)), clamp(sigmoid(a + b))], -1, true),
        edges: [],
        description: `After ${epochs} epochs the generator zero probability is ${(Math.cos(theta / 2) ** 2).toFixed(4)} against a target of ${target.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: metaFor(epochs, 0, 0, 0, true),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A generative adversarial network trains two competitors at once. The quantum generator is a single adjustable rotation that produces a bit distribution, and the classical discriminator sees each sampled bit and tries to say whether it came from the generator or from the real target distribution. The generator only succeeds when its distribution matches the target closely enough to fool the discriminator, which is why the two gradients point in opposing directions.",
        invariants: [
            "The generator amplitudes are cos(theta over two) and sin(theta over two), so the two probabilities always sum to one.",
            "Discriminator outputs are logistic values strictly between zero and one.",
            "The discriminator gradient is evaluated before the generator updates in each alternating epoch.",
        ],
        correctness:
            "The discriminator's expected log loss is minus the weighted sum of real and generated log likelihoods. Differentiating through the logistic gives the two reported gradients with respect to the weight and bias, and gradient ascent improves the discriminator objective. The generator's loss is minus the expected log discriminator score on generated samples; differentiating the rotation probabilities gives one half sine theta times the log ratio of the two discriminator outputs, and stepping against it increases the generator's score. Using exact expectations makes each reported gradient the true minimax gradient rather than a stochastic estimate.",
        complexityRationale:
            "Each epoch updates three scalar parameters and evaluates a two-amplitude quantum state, so the simulation is constant time and memory per epoch. A real quantum GAN would pay a measurement cost proportional to the number of shots needed to estimate each gradient, and a deeper generator would scale with its parameter count.",
        uses: [
            "Learning simple target distributions with parameterized quantum circuits",
            "Studying adversarial training dynamics on noisy quantum processors",
            "Benchmarking quantum generative models against born machines",
        ],
        references: [
            "Goodfellow et al., Generative Adversarial Nets, 2014",
            "Rudolph et al., Training a Quantum GAN on Near-Term Quantum Computers, 2022",
        ],
        workedExample:
            "With target zero probability 0.3 and an initial generator probability near 0.85, the discriminator quickly assigns a high score to measured zeros. That pushes the generator rotation toward a smaller angle, lowering its zero probability toward the target as the discriminator becomes less able to separate the two sources.",
    },
    id: "quantum-generative-adversarial-network",
    name: "Quantum Generative Adversarial Network",
    category: "quantum",
    complexity: { time: "O(epochs)", space: "O(1)" },
    defaultInput: { target: 0.3, epochs: 6, lr: 0.2 },
    visualType: "array",
    run,
    pseudocode: [
        "choose the target bit distribution, epoch count, and learning rate",
        "initialize the generator rotation and the logistic discriminator",
        "compute generated probabilities and the discriminator scores on both bits",
        "ascend the discriminator loss gradient with respect to weight and bias",
        "descend the generator loss gradient with respect to the rotation angle",
        "record both losses and the generated distribution for the epoch",
        "done: report the final generator distribution and discriminator scores",
    ],
};

export default module;
