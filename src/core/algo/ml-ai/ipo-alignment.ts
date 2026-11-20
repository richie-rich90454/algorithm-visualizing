/**
 * ipo-alignment.ts - Identity Preference Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * IPO aligns a language model with human preferences using a simple squared
 * objective in log-probability space. For a preferred and a dispreferred
 * response it compares their log-probability ratios relative to a reference
 * model and applies a logistic loss that pushes the preferred ratio above the
 * dispreferred one. Unlike DPO it avoids overfitting by not letting the margin
 * grow without bound.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) per preference pair
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the chosen log-ratio, rejected log-ratio, their margin, and
 *     the resulting IPO loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface IpoInput {
    chosenLogRatio?: number;
    rejectedLogRatio?: number;
    beta?: number;
}

/** Numerically stable softplus: log(1 + exp(x)). */
export function softplus(x: number): number {
    return x > 20 ? x : Math.log(1 + Math.exp(x));
}

/** The IPO loss for one preference pair: -log sigmoid(beta * margin). */
export function ipoLoss(
    chosenLogRatio: number,
    rejectedLogRatio: number,
    beta: number,
): { margin: number; loss: number } {
    const margin = beta * (chosenLogRatio - rejectedLogRatio);
    return { margin, loss: softplus(-margin) };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `v-${index}`,
        type: "bar" as const,
        label: value.toFixed(4),
        value: Number(value.toFixed(10)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as IpoInput | null) ?? {};
    const chosen = typeof task.chosenLogRatio === "number" ? task.chosenLogRatio : 0.8;
    const rejected = typeof task.rejectedLogRatio === "number" ? task.rejectedLogRatio : 0.1;
    const beta = typeof task.beta === "number" ? task.beta : 1;
    const { margin, loss } = ipoLoss(chosen, rejected, beta);

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars([chosen, rejected], ["comparing", "comparing"]),
        edges: [],
        description: `Read the chosen and rejected log-probability ratios relative to the reference model.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "ratios", chosen, rejected, beta, margin: 0, loss: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars([chosen - rejected, margin], ["active", "active"]),
        edges: [],
        description: `The log-ratio margin is ${(chosen - rejected).toFixed(4)}; scaled by beta it is ${margin.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { phase: "margin", chosen, rejected, beta, margin, loss: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars([margin, loss], ["sorted", "active"]),
        edges: [],
        description: `Apply the logistic loss -log sigmoid of the margin, giving ${loss.toFixed(4)}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { phase: "loss", chosen, rejected, beta, margin, loss },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: bars([margin, loss], ["sorted", "sorted"]),
        edges: [],
        description: `Done: a larger positive margin yields a smaller IPO loss.`,
        codeLineNumber: 3,
        layout: "array",
        meta: { phase: "done", chosen, rejected, beta, margin, loss, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "IPO turns preference data into a simple margin objective. Each response is scored by how much more likely it is under the trained model than under a frozen reference. The chosen response should have a higher score than the rejected one, and the logistic loss on that gap provides a smooth signal that saturates instead of pushing the gap to infinity.",
        invariants: [
            "The margin is beta times the difference of chosen and rejected log-ratios.",
            "A margin of zero gives a loss of log two, about 0.693.",
            "Increasing the chosen log-ratio while holding the rejected one fixed lowers the loss.",
        ],
        correctness:
            "The logistic sigmoid maps the margin to a probability, and its negative log is softplus of the negated margin, which is computed in a numerically stable way. Because softplus is strictly decreasing in its negated argument, a larger margin always gives a smaller loss, so the minimum is approached as the chosen ratio exceeds the rejected ratio. The reference log-ratios cancel constants that do not depend on the policy, leaving a well-defined preference objective that is bounded and therefore less prone to the runaway behavior of unbounded margin methods.",
        complexityRationale:
            "Each pair needs only a subtraction, a multiplication and a softplus evaluation, all constant time, with no per-example storage beyond a few scalars.",
        uses: [
            "Aligning language models with human preference data",
            "Reducing overfitting compared with DPO-style alignment",
            "Preference tuning when only chosen and rejected pairs are available",
        ],
        references: [
            "Azar et al., A General Theoretical Paradigm to Understand Learning from Human Preferences, AISTATS 2024",
            "Rafailov et al., Direct Preference Optimization, NeurIPS 2023",
        ],
        workedExample:
            "With chosen log-ratio 0.8, rejected log-ratio 0.1 and beta 1, the margin is 0.7. The loss is softplus(-0.7), about 0.403, below the neutral log two of 0.693, showing the preference is satisfied.",
    },
    id: "ipo-alignment",
    name: "IPO Alignment (Identity Preference Optimization)",
    category: "ml-ai",
    complexity: { time: "O(1)", space: "O(1)" },
    defaultInput: { chosenLogRatio: 0.8, rejectedLogRatio: 0.1, beta: 1 },
    visualType: "array",
    run,
    pseudocode: [
        "read chosen and rejected log-ratios and beta",
        "subtract rejected from chosen to get the log margin",
        "multiply the margin by beta",
        "evaluate softplus of the negated margin for the loss",
        "report the margin and loss",
        "done: larger positive margins give smaller loss",
    ],
};

export default module;
