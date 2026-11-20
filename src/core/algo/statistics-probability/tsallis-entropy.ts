/**
 * tsallis-entropy.ts - Tsallis Entropy of Index q
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Tsallis entropy is a non-extensive generalization of Shannon entropy. It
 * raises each probability to the index q, sums those powers, subtracts the sum
 * from one, and divides by q minus one. The index one limit is ordinary
 * Shannon entropy, and other indices model systems where entropies add in a
 * modified way.
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
 *   - The bar whose q power is being accumulated is highlighted.
 *   - The final frame reports the Tsallis entropy.
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

function powerOf(p: number, q: number): number {
    if (p <= 0) {
        return 0;
    }
    return p ** q;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { probabilities?: number[]; q?: number } | null) ?? {};
    const raw: number[] = Array.isArray(task.probabilities)
        ? task.probabilities.slice()
        : [0.5, 0.25, 0.15, 0.1];
    const q = typeof task.q === "number" && Number.isFinite(task.q) ? task.q : 2;
    const total = raw.reduce((sum, value) => sum + Math.max(0, value), 0);
    const probabilities = total > 0 ? raw.map((value) => Math.max(0, value) / total) : raw.map(() => 0);
    const n = probabilities.length;

    yield {
        stepNumber: 0,
        entities: makeBars(probabilities, -1, false),
        edges: [],
        description: `Tsallis entropy of index ${q.toFixed(3)} over ${n} outcome(s).`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, q, powerSum: 0, entropy: 0 },
    };
    let step = 1;

    let powerSum = 0;
    for (let i = 0; i < n; i += 1) {
        const contribution = powerOf(probabilities[i] ?? 0, q);
        powerSum += contribution;
        yield {
            stepNumber: step,
            entities: makeBars(probabilities, i, false),
            edges: [],
            description: `Outcome ${i + 1} has probability ${(probabilities[i] ?? 0).toFixed(3)} and contributes ${contribution.toFixed(4)} to the power sum.`,
            codeLineNumber: 3,
            layout: "array",
            meta: { n, q, powerSum, entropy: 0 },
        };
        step += 1;
    }

    const entropy =
        n === 0
            ? 0
            : Math.abs(q - 1) < 1e-12
              ? -probabilities.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0)
              : (1 - powerSum) / (q - 1);
    yield {
        stepNumber: step,
        entities: makeBars(probabilities, -1, true),
        edges: [],
        description: `Power sum is ${powerSum.toFixed(4)}; Tsallis entropy is ${entropy.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, q, powerSum, entropy },
    };
}

/** The Tsallis entropy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Tsallis entropy changes how uncertainties combine. The parameter q stretches the tail of the distribution: q greater than one emphasizes common outcomes, q less than one emphasizes rare ones, and q equal to one gives the familiar Shannon formula.",
        invariants: [
            "The probabilities are normalized to sum to one before powers are taken.",
            "A point mass has zero Tsallis entropy for every positive index.",
            "At index one the value matches Shannon entropy.",
        ],
        correctness:
            "Each power is accumulated once, so the power sum is exact. Substituting q equal to one and applying L'Hopital's rule to one minus the sum of p to the q over q minus one yields minus the sum of p log p, the Shannon entropy. At q zero each supported outcome contributes one, giving support size minus one, as the definition requires.",
        complexityRationale:
            "A power and an addition per outcome make the run linear in n, and the probability bars are the only linear storage.",
        uses: [
            "Modeling nonextensive systems in statistical mechanics",
            "Measuring complexity in financial time series",
            "Image thresholding and feature selection",
        ],
        references: [
            "Tsallis, Possible Generalization of Boltzmann-Gibbs Statistics, 1988",
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
        ],
        workedExample:
            "For a fair coin at q equals two, the power sum is 0.25 plus 0.25, or 0.5. One minus 0.5 divided by one gives 0.5, so the Tsallis entropy is one half, which equals the Shannon entropy of one bit when converted through the natural-log convention.",
    },
    id: "tsallis-entropy",
    name: "Tsallis Entropy",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { probabilities: [0.5, 0.25, 0.15, 0.1], q: 2 },
    visualType: "array",
    run,
    pseudocode: [
        "read the probability vector and the entropic index q",
        "normalize the probabilities so they sum to one",
        "initialize the power sum to zero",
        "for each probability add its q power to the sum",
        "subtract the power sum from one",
        "divide by q minus one, or use Shannon entropy when q is one",
        "done: report the Tsallis entropy",
    ],
};

export default module;
