/**
 * exponential-mechanism-differential-privacy.ts - Exponential Mechanism
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The exponential mechanism picks one item from a finite set while preserving
 * differential privacy. Each candidate gets a weight that grows exponentially
 * with its utility, scaled by the privacy budget and sensitivity. Higher-utility
 * items are more likely, but the randomness hides any single record's influence.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k candidates
 *   Space: O(k) for the weights and probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One grid row per candidate shows utility, weight, and probability.
 *   - The selected candidate is green; the rest are idle.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Task {
    utilities?: number[];
    epsilon?: number;
    sensitivity?: number;
    draw?: number;
}

/** Build the three-column candidate grid. */
function makeCells(
    utilities: number[],
    weights: number[],
    probabilities: number[],
    selected: number,
    revealed: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < utilities.length; row += 1) {
        const columns = [utilities[row] ?? 0, weights[row] ?? 0, probabilities[row] ?? 0];
        for (let col = 0; col < columns.length; col += 1) {
            let state: EntityState = "idle";
            if (row === selected) state = "sorted";
            else if (row < revealed) state = "visited";
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: col === 2 ? (columns[col] ?? 0).toFixed(4) : (columns[col] ?? 0).toFixed(3),
                value: columns[col] ?? 0,
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

/** The exponential mechanism generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const utilities = Array.isArray(task.utilities) && task.utilities.length > 0
        ? task.utilities.map(Number)
        : [1, 2, 3, 2];
    const epsilon = typeof task.epsilon === "number" && task.epsilon > 0 ? task.epsilon : 1;
    const sensitivity = typeof task.sensitivity === "number" && task.sensitivity > 0 ? task.sensitivity : 1;
    const draw = typeof task.draw === "number" ? Math.min(0.999999999, Math.max(0, task.draw)) : 0.55;

    const maxUtility = Math.max(...utilities);
    // Shift by the maximum utility for numerical stability; probabilities are unchanged.
    const weights = utilities.map((u) => Math.exp((epsilon * (u - maxUtility)) / (2 * sensitivity)));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const probabilities = weights.map((w) => w / totalWeight);

    let cumulative = 0;
    let selected = 0;
    for (let i = 0; i < probabilities.length; i += 1) {
        cumulative += probabilities[i] ?? 0;
        if (draw < cumulative) {
            selected = i;
            break;
        }
    }

    const summary = (revealed: number, pick: number) => ({
        rows: utilities.length,
        cols: 3,
        epsilon,
        sensitivity,
        draw,
        utilities: utilities.slice(),
        weights: weights.slice(),
        probabilities: probabilities.slice(),
        selected: pick,
        revealed,
    });

    yield {
        stepNumber: 0,
        entities: makeCells(utilities, weights, probabilities, -1, 0),
        edges: [],
        description: `Exponential mechanism over ${utilities.length} candidates with epsilon ${epsilon}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: summary(0, -1),
    };
    let step = 1;

    for (let i = 0; i < utilities.length; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(utilities, weights, probabilities, -1, i + 1),
            edges: [],
            description: `Candidate ${i}: utility ${(utilities[i] ?? 0).toFixed(2)} gives weight ${(weights[i] ?? 0).toFixed(4)} and probability ${(probabilities[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: summary(i + 1, -1),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(utilities, weights, probabilities, selected, utilities.length),
        edges: [],
        description: `With draw ${draw.toFixed(3)}, the mechanism selects candidate ${selected} with utility ${(utilities[selected] ?? 0).toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: summary(utilities.length, selected),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you must choose one option from a menu while keeping each person's data secret, do not always take the top-scoring option. Instead, give every option a chance proportional to an exponential of its score. The better an option, the more likely it is, but the randomness means no single record can be inferred from the final choice.",
        invariants: [
            "Each candidate's weight is positive and at most one.",
            "The probabilities are nonnegative and sum to one.",
            "Higher utility always gives at least as high a selection probability.",
        ],
        correctness:
            "The mechanism assigns weight exp(epsilon * u / (2 * delta)) to each candidate and normalizes by the total. Shifting every utility by a constant multiplies all weights by the same factor, so the shifted computation yields identical probabilities. The privacy guarantee follows because changing one record alters any utility by at most delta, multiplying the numerator by at most exp(epsilon/2) and the denominator by at most the reciprocal, bounding the output-ratio by exp(epsilon).",
        complexityRationale:
            "Computing the shifted weights, their sum, the probabilities, and the cumulative draw each scan the k candidates once, so time is O(k). Storing weights and probabilities uses O(k) space.",
        uses: [
            "Releasing a private summary statistic with a utility score",
            "Choosing a model or feature under a privacy budget",
            "Private mechanism design in recommendation systems",
        ],
        references: [
            "McSherry and Talwar, Mechanism Design via Differential Privacy, FOCS 2007",
            "Dwork and Roth, The Algorithmic Foundations of Differential Privacy, Chapter 3",
        ],
        workedExample:
            "With utilities 1, 2, 3, 2, epsilon 1 and sensitivity 1, the shifted exponent differences are -1, -0.5, 0, -0.5, giving weights about 0.368, 0.607, 1, 0.607. These normalize to probabilities near 0.13, 0.22, 0.36, 0.22, and a draw of 0.55 selects the third candidate.",
    },
    id: "exponential-mechanism-differential-privacy",
    name: "Exponential Mechanism (Differential Privacy)",
    category: "production-systems",
    complexity: { time: "O(k)", space: "O(k)" },
    defaultInput: { utilities: [1, 2, 3, 2], epsilon: 1, sensitivity: 1, draw: 0.55 },
    visualType: "grid",
    run,
    pseudocode: [
        "set the privacy budget and utility sensitivity",
        "shift utilities by their maximum for stability",
        "set each weight to exp of epsilon times shifted utility over twice sensitivity",
        "divide each weight by the total to get a probability",
        "draw a uniform value and walk the cumulative probabilities",
        "select the candidate whose cumulative interval contains the draw",
        "done: report the probabilities and selected candidate",
    ],
};

export default module;
