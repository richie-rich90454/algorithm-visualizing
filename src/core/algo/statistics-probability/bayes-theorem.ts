/**
 * bayes-theorem.ts - Bayes' Theorem
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Bayes' theorem updates a belief in a hypothesis after seeing evidence. The
 * posterior probability of the hypothesis given the evidence equals the
 * likelihood of the evidence under the hypothesis times the prior, divided by
 * the total probability of the evidence. The denominator adds the contribution
 * from the hypothesis and from its complement.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) for a binary hypothesis
 *   Space: O(1) for the intermediate probabilities
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A three-by-two grid reveals priors, likelihoods, and the posterior.
 *   - The newly revealed row is yellow; finished values are green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Build one grid cell for the given row and column. */
function cell(
    row: number,
    col: number,
    label: string,
    value: number,
    state: EntityState,
): VisualEntity {
    return {
        id: `cell-${row}-${col}`,
        type: "cell",
        label,
        value,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row, col },
    };
}

/** Build the probability grid, revealing one row at a time. */
function makeCells(
    prior: number,
    likelihood: number,
    falsePositive: number,
    evidence: number,
    posterior: number,
    revealed: number,
): VisualEntity[] {
    const rowState = (row: number): EntityState =>
        row < revealed ? "sorted" : row === revealed ? "comparing" : "idle";
    const show = (row: number, value: number): string =>
        row <= revealed ? value.toFixed(4) : "?";
    return [
        cell(0, 0, show(0, prior), prior, rowState(0)),
        cell(0, 1, show(0, 1 - prior), 1 - prior, rowState(0)),
        cell(1, 0, show(1, likelihood), likelihood, rowState(1)),
        cell(1, 1, show(1, falsePositive), falsePositive, rowState(1)),
        cell(2, 0, show(2, evidence), evidence, rowState(2)),
        cell(2, 1, show(2, posterior), posterior, rowState(2)),
    ];
}

/** The Bayes theorem generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { prior?: number; likelihood?: number; falsePositive?: number } | null
    ) ?? {};
    const prior = typeof task.prior === "number" ? task.prior : 0.01;
    const likelihood = typeof task.likelihood === "number" ? task.likelihood : 0.95;
    const falsePositive = typeof task.falsePositive === "number" ? task.falsePositive : 0.05;
    const numerator = likelihood * prior;
    const evidence = numerator + falsePositive * (1 - prior);
    const posterior = evidence === 0 ? 0 : numerator / evidence;

    yield {
        stepNumber: 0,
        entities: makeCells(prior, likelihood, falsePositive, evidence, posterior, 0),
        edges: [],
        description: `Start with a prior probability of ${prior.toFixed(4)} for the hypothesis.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 3, cols: 2, prior, likelihood, falsePositive, evidence: 0, posterior: 0 },
    };

    yield {
        stepNumber: 1,
        entities: makeCells(prior, likelihood, falsePositive, evidence, posterior, 1),
        edges: [],
        description: `The evidence occurs with likelihood ${likelihood.toFixed(4)} under the hypothesis and ${falsePositive.toFixed(4)} otherwise.`,
        codeLineNumber: 2,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 2,
            prior,
            likelihood,
            falsePositive,
            evidence: 0,
            posterior: 0,
        },
    };

    yield {
        stepNumber: 2,
        entities: makeCells(prior, likelihood, falsePositive, evidence, posterior, 2),
        edges: [],
        description: `Total evidence probability is ${evidence.toFixed(4)}, so the posterior is ${posterior.toFixed(4)}.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: {
            rows: 3,
            cols: 2,
            prior,
            likelihood,
            falsePositive,
            numerator,
            evidence,
            posterior,
        },
    };
}

/** The Bayes theorem module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Start with how common you believe something is, then weigh how much more likely the observation is when it is true than when it is false. A rare condition with a fairly accurate test can still be unlikely after a positive result, because the large healthy group produces many false positives.",
        invariants: [
            "The total probability of the evidence is the weighted sum over the hypothesis and its complement.",
            "The posterior is a number between zero and one whenever the inputs are valid probabilities.",
            "Posterior odds equal prior odds multiplied by the likelihood ratio.",
        ],
        correctness:
            "By the definition of conditional probability, P(A and B) equals P(A given B) times P(B) and also P(B given A) times P(A). Equating the two and solving for P(A given B) gives the theorem. Expanding P(B) with the law of total probability gives the denominator used here.",
        complexityRationale:
            "Only a handful of multiplications and one division are needed, so time and space are both O(1) for a binary hypothesis.",
        uses: [
            "Medical test result interpretation",
            "Spam filtering with naive Bayes models",
            "Updating risk estimates as new evidence arrives",
        ],
        references: [
            "Bayes, An Essay towards Solving a Problem in the Doctrine of Chances, 1763",
            "Jaynes, Probability Theory: The Logic of Science, Chapter 4",
        ],
        workedExample:
            "With a disease rate of 1 percent, a test that catches 95 percent of cases and falsely alarms on 5 percent of healthy people, the evidence rate is 0.0095 plus 0.0495 = 0.059. The chance of disease after a positive result is 0.0095 over 0.059, about 16.1 percent.",
    },
    id: "bayes-theorem",
    name: "Bayes' Theorem",
    category: "statistics-probability",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { prior: 0.01, likelihood: 0.95, falsePositive: 0.05 },
    visualType: "grid",
    run,
    pseudocode: [
        "read the prior probability of the hypothesis",
        "read the likelihood of the evidence under the hypothesis",
        "read the likelihood of the evidence without it",
        "multiply the prior by the first likelihood",
        "add the weighted likelihood of the complement",
        "divide the numerator by that total evidence",
        "done: report the posterior probability",
    ],
};

export default module;
