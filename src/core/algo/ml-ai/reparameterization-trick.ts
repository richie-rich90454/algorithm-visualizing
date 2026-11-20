/**
 * reparameterization-trick.ts - The Reparameterization Trick
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The reparameterization trick moves randomness out of the parameters of a
 * distribution and into a fixed noise source. A sample from a normal
 * distribution with mean mu and standard deviation sigma is written as
 * z = mu + sigma times epsilon, where epsilon is drawn from a standard normal.
 * That makes z a differentiable function of mu and sigma, so gradients can flow
 * through a stochastic node. This demo accepts explicit standard-normal draws
 * for reproducibility.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n dimensions
 *   Space: O(n) for the resulting samples
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per dimension showing mu, sigma, epsilon, and the final sample z.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    mu?: number[];
    sigma?: number[];
    epsilon?: number[];
}

function bars(values: number[], states: EntityState[], labels?: string[]): VisualEntity[] {
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: labels?.[i] ?? v.toFixed(3),
        value: v,
        state: states[i] ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value: v },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const mu = (task.mu ?? [0, 1, -1]).slice();
    const sigma = (task.sigma ?? [1, 0.5, 2]).slice();
    const epsilon = (task.epsilon ?? [0.5, -1, 1.5]).slice();
    const n = Math.max(mu.length, sigma.length, epsilon.length);
    const at = (a: number[], i: number): number => a[i] ?? 0;
    const z = mu.map((m, i) => m + at(sigma, i) * at(epsilon, i));
    const state = (s: EntityState): EntityState[] => new Array<EntityState>(n).fill(s);
    let step = 0;

    yield {
        stepNumber: step,
        entities: bars(mu, state("idle"), mu.map((v) => v.toFixed(3))),
        edges: [],
        description: `Reparameterization over ${n} dimensions: z = mu + sigma times epsilon.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, mu, sigma, epsilon },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(sigma, state("comparing"), sigma.map((v) => v.toFixed(3))),
        edges: [],
        description: "Read the learned standard deviations that scale the noise.",
        codeLineNumber: 1,
        layout: "array",
        meta: { n, mu, sigma, epsilon },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(epsilon, state("active"), epsilon.map((v) => v.toFixed(3))),
        edges: [],
        description: "Draw fixed standard-normal noise epsilon, independent of the learned parameters.",
        codeLineNumber: 2,
        layout: "array",
        meta: { n, mu, sigma, epsilon },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars(z, state("sorted"), z.map((v) => v.toFixed(3))),
        edges: [],
        description: "Combine them: the sample is now a differentiable function of mu and sigma.",
        codeLineNumber: 3,
        layout: "array",
        meta: {
            n,
            mu,
            sigma,
            epsilon,
            z,
            dzdmu: new Array<number>(n).fill(1),
            dzsigma: epsilon.slice(0, n),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Drawing z directly from a distribution whose mean and variance are learned makes the sampling step opaque to gradients. Rewriting the draw as a deterministic function of the parameters and an independent noise variable fixes this. Because z equals mu plus sigma times epsilon, the derivative with respect to mu is one and the derivative with respect to sigma is simply epsilon.",
        invariants: [
            "The noise epsilon is drawn from a fixed standard normal and does not depend on mu or sigma.",
            "The resulting sample z has mean mu and standard deviation sigma when epsilon is standard normal.",
            "The gradient of z with respect to mu is exactly one in every dimension.",
        ],
        correctness:
            "If epsilon has mean zero and unit variance, then the expectation of mu plus sigma times epsilon is mu and its variance is sigma squared, so the transformed variable has exactly the intended normal distribution. The transformation is a smooth deterministic function of mu and sigma, which means the chain rule provides low-variance gradients through what was previously a stochastic node, giving the variational autoencoder its trainable encoder.",
        complexityRationale:
            "Reading the three vectors and forming one multiply and one add per dimension is constant work per dimension, so the time is O(n). The output sample and the derivative arrays occupy O(n) space.",
        uses: [
            "Variational autoencoders and other latent-variable models",
            "Stochastic policy gradients in continuous control",
            "Bayesian neural networks with Gaussian weight posteriors",
        ],
        references: [
            "Kingma and Welling, Auto-Encoding Variational Bayes, ICLR 2014",
            "Rezende, Mohamed, and Wierstra, Stochastic Backpropagation, ICML 2014",
        ],
        workedExample:
            "With mu of 1, sigma of 0.5, and a standard-normal draw epsilon of 2, the sample is 1 plus 0.5 times 2, which equals 2. If the loss asks for a larger sample, the gradient with respect to mu is 1 and with respect to sigma is 2, so both parameters move in the helpful direction.",
    },
    id: "reparameterization-trick",
    name: "Reparameterization Trick",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { mu: [0, 1, -1], sigma: [1, 0.5, 2], epsilon: [0.5, -1, 1.5] },
    visualType: "array",
    run,
    pseudocode: [
        "read the mean mu, standard deviation sigma, and standard-normal noise epsilon",
        "for each dimension take the learned scale sigma",
        "draw an independent standard-normal value epsilon",
        "form the sample z equal to mu plus sigma times epsilon",
        "record the derivative of z with respect to mu as one",
        "record the derivative of z with respect to sigma as epsilon",
        "done: emit the sample and its gradients",
    ],
};

export default module;
