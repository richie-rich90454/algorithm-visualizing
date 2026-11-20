/**
 * renyi-entropy.ts - Renyi Entropy of Order Alpha
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Renyi entropy generalizes Shannon entropy with a single order parameter. It
 * raises each probability to the power alpha, sums those powers, takes a
 * logarithm, and divides by one minus alpha. At alpha one the limiting value
 * is ordinary Shannon entropy; at alpha zero it counts the support size.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n probabilities
 *   Space: O(n) for the displayed probability bars
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each bar shows one normalized probability.
 *   - The bar whose power is being accumulated is highlighted.
 *   - The final frame reports the Renyi entropy.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function makeBars(probabilities: number[], active: number, done: boolean): VisualEntity[] {
    return probabilities.map((value, index) => {
        let state: EntityState = done ? "sorted" : "idle";
        if (!done && index === active) {
            state = "active";
        }
        return {
            id: `bar-${index}`,
            type: "bar" as const,
            label: value.toFixed(3),
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, probability: value },
        };
    });
}

function powerOf(p: number, alpha: number): number {
    if (p <= 0) {
        return 0;
    }
    return p ** alpha;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { probabilities?: number[]; alpha?: number } | null) ?? {};
    const raw: number[] = Array.isArray(task.probabilities)
        ? task.probabilities.slice()
        : [0.4, 0.25, 0.15, 0.1, 0.1];
    const alpha = typeof task.alpha === "number" && Number.isFinite(task.alpha) ? task.alpha : 2;
    const total = raw.reduce((sum, value) => sum + Math.max(0, value), 0);
    const probabilities = total > 0 ? raw.map((value) => Math.max(0, value) / total) : raw.map(() => 0);
    const n = probabilities.length;

    yield {
        stepNumber: 0,
        entities: makeBars(probabilities, -1, false),
        edges: [],
        description: `Renyi entropy of order ${alpha.toFixed(3)} over ${n} outcome(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, alpha, powerSum: 0, entropy: 0 },
    };
    let step = 1;

    let powerSum = 0;
    for (let i = 0; i < n; i += 1) {
        const contribution = powerOf(probabilities[i] ?? 0, alpha);
        powerSum += contribution;
        yield {
            stepNumber: step,
            entities: makeBars(probabilities, i, false),
            edges: [],
            description: `Outcome ${i + 1} has probability ${(probabilities[i] ?? 0).toFixed(3)} and contributes ${contribution.toFixed(4)} to the power sum.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, alpha, powerSum, entropy: 0 },
        };
        step += 1;
    }

    const entropy =
        n === 0
            ? 0
            : Math.abs(alpha - 1) < 1e-12
              ? -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0)
              : powerSum > 0
                ? Math.log(powerSum) / (1 - alpha)
                : 0;
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, -1, true),
        edges: [],
        description: `Power sum is ${powerSum.toFixed(4)}; Renyi entropy is ${entropy.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, alpha, powerSum, entropy },
    };
}

/** The Renyi entropy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Renyi entropy is a family of uncertainty measures tuned by an order parameter. Higher orders emphasize the most likely outcomes, while order zero ignores probabilities and just counts how many outcomes are possible. Order one recovers ordinary Shannon entropy.",
        invariants: [
            "The probabilities are normalized to sum to one before powers are taken.",
            "The entropy is non-increasing as the order alpha grows.",
            "A distribution concentrated on one outcome has entropy zero for every positive order.",
        ],
        correctness:
            "Each term p to the alpha is added exactly once, so the power sum is exact. For alpha not equal to one the logarithm divided by one minus alpha is the Renyi definition; as alpha approaches one, L'Hopital's rule reduces it to minus the sum of p log p, which is Shannon entropy, and at alpha zero each supported outcome contributes one so the result is log of the support size.",
        complexityRationale:
            "One power and one accumulation per outcome gives linear time, and the displayed probability bars are the only linear storage.",
        uses: [
            "Quantifying diversity in ecology and economics",
            "Measuring uncertainty in quantum information",
            "Comparing collision probabilities in hashing and randomization",
        ],
        references: [
            "Renyi, On Measures of Entropy and Information, 1961",
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
        ],
        workedExample:
            "For probabilities 0.5 and 0.5 the power sum at order two is 0.25 plus 0.25, or 0.5. The logarithm is negative 0.693 and dividing by one minus two gives 0.693, so the collision entropy is one bit, the same as the Shannon entropy of a fair coin.",
    },
    id: "renyi-entropy",
    name: "Renyi Entropy",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { probabilities: [0.4, 0.25, 0.15, 0.1, 0.1], alpha: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the probability vector and the order alpha",
        "normalize the probabilities so they sum to one",
        "initialize the power sum to zero",
        "for each probability add its alpha power to the sum",
        "take the natural logarithm of the power sum",
        "divide by one minus alpha, or use Shannon entropy when alpha is one",
        "done: report the Renyi entropy",
    ],
};

export default module;
