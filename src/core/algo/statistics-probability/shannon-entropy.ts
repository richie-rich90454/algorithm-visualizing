/**
 * shannon-entropy.ts - Shannon Entropy of a Discrete Distribution
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Shannon entropy measures the average surprise of outcomes drawn from a
 * discrete probability distribution. For probabilities p_i it is the sum of
 * -p_i log p_i, where a zero probability contributes zero by continuity. With
 * log base 2 the unit is bits; with base e it is nats. Entropy is maximized by
 * the uniform distribution, where it equals log of the number of outcomes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n outcomes
 *   Space: O(n) for the normalized probabilities and contributions
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A two-row grid: the probability of each outcome and its entropy
 *     contribution.
 *   - The column being accumulated is yellow; finished columns are green.
 *   - The final frame reports the total entropy and its maximum.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type LogBase = 2 | "e" | 10;

function logOf(base: LogBase): (x: number) => number {
    if (base === 2) return Math.log2;
    if (base === 10) return Math.log10;
    return Math.log;
}

/** Build the probability and contribution grid. */
function makeCells(
    probs: number[],
    contributions: Array<number | null>,
    current: number,
    done: boolean,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < probs.length; col += 1) {
            let state: EntityState = "idle";
            if (row === 1 && (done || col < current)) state = "sorted";
            if (row === 1 && col === current && !done) state = "comparing";
            const value = row === 0 ? (probs[col] as number) : (contributions[col] ?? 0);
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: row === 0
                    ? `p ${(probs[col] as number).toFixed(3)}`
                    : contributions[col] === null ? "-" : `H ${(contributions[col] as number).toFixed(3)}`,
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col },
            });
        }
    }
    return entities;
}

/** The Shannon entropy generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { weights?: number[]; base?: LogBase } | null) ?? {};
    const raw = Array.isArray(task.weights) && task.weights.length > 0
        ? task.weights.map(Number).map((w) => Math.max(0, w))
        : [0.5, 0.25, 0.125, 0.125];
    const total = raw.reduce((a, b) => a + b, 0);
    const probs = total > 0 ? raw.map((w) => w / total) : raw.map(() => 1 / raw.length);
    const base: LogBase = task.base === "e" || task.base === 10 ? task.base : 2;
    const lg = logOf(base);
    const contributions: Array<number | null> = probs.map(() => null);
    const n = probs.length;
    const maxEntropy = lg(n);

    yield {
        stepNumber: 0,
        entities: makeCells(probs, contributions, -1, false),
        edges: [],
        description: `Shannon entropy over ${n} outcomes in ${base === 2 ? "bits" : base === 10 ? "bans" : "nats"}; normalize the weights first.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 2, cols: n, n, base: String(base), entropy: 0, maxEntropy, efficiency: 0 },
    };
    let step = 1;
    let entropy = 0;

    for (let i = 0; i < n; i += 1) {
        const p = probs[i] as number;
        const contribution = p > 0 ? -p * lg(p) : 0;
        contributions[i] = contribution;
        entropy += contribution;
        yield {
            stepNumber: step,
            entities: makeCells(probs, contributions, i, false),
            edges: [],
            description: `Outcome ${i}: p = ${p.toFixed(3)}, contribution -p log p = ${contribution.toFixed(4)}; running entropy ${entropy.toFixed(4)}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: {
                rows: 2,
                cols: n,
                n,
                base: String(base),
                entropy,
                maxEntropy,
                efficiency: maxEntropy > 0 ? entropy / maxEntropy : 0,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(probs, contributions, n, true),
        edges: [],
        description: `Total entropy ${entropy.toFixed(4)} ${base === 2 ? "bits" : base === 10 ? "bans" : "nats"}, maximum ${maxEntropy.toFixed(4)} for ${n} equally likely outcomes.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 2,
            cols: n,
            n,
            base: String(base),
            entropy,
            maxEntropy,
            efficiency: maxEntropy > 0 ? entropy / maxEntropy : 0,
        },
    };
}

/** The Shannon entropy module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Entropy is the expected amount of surprise when you observe an outcome. Rare outcomes carry more information, so they contribute more, but they occur less often; multiplying probability by the log of its reciprocal balances the two. A fair distribution of many outcomes is maximally uncertain, while a distribution concentrated on one outcome has zero entropy.",
        invariants: [
            "The probabilities are normalized to sum to one.",
            "Every contribution is nonnegative because the log of a probability is at most zero.",
            "Entropy never exceeds the log of the number of outcomes.",
        ],
        correctness:
            "For each outcome the term -p log p is the information content -log p weighted by its probability, so summing over outcomes gives the expected information by definition. The convention 0 log 0 = 0 follows from the limit p log p approaching zero as p approaches zero. By Jensen's inequality the sum is at most log n, with equality only for the uniform distribution, confirming the maximum.",
        complexityRationale:
            "Normalizing scans the n weights once and the accumulation loop visits each outcome once, so the work is O(n). Storing the normalized probabilities and the contribution row uses O(n) space.",
        uses: [
            "Measuring compression limits and source coding efficiency",
            "Information gain and feature selection in decision trees",
            "Quantifying uncertainty in statistical mechanics and language models",
        ],
        references: [
            "Shannon, A Mathematical Theory of Communication, 1948",
            "Cover and Thomas, Elements of Information Theory, Chapter 2",
        ],
        workedExample:
            "For probabilities 0.5, 0.25, 0.125, 0.125, the contributions in bits are 0.5, 0.5, 0.375, and 0.375, which sum to 1.75 bits. The maximum for four outcomes is log2(4) = 2 bits, so this distribution is 87.5 percent as uncertain as a fair four-way choice.",
    },
    id: "shannon-entropy",
    name: "Shannon Entropy",
    category: "statistics-probability",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { weights: [0.5, 0.25, 0.125, 0.125], base: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "read outcome weights and the logarithm base",
        "normalize the weights so they sum to one",
        "set the maximum entropy to log of the outcome count",
        "for each outcome compute minus p times log of p",
        "add the contribution to the running entropy",
        "compare the entropy with the uniform maximum",
        "done: report entropy, maximum, and efficiency",
    ],
};

export default module;
