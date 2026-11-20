/**
 * projected-gradient-descent-adversarial.ts - PGD Adversarial Attack
 *
 * Projected Gradient Descent is an iterative extension of the fast gradient
 * sign method. Each step moves the input along the sign of the loss gradient to
 * increase the model's error, then projects the result back into an L-infinity
 * ball around the original input so the perturbation stays within a budget.
 *
 * Time is O(iterations * d) for a linear model; space is O(d).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Score of a linear classifier at an input. */
export function linearScore(input: number[], weights: number[], bias: number): number {
    return input.reduce((sum, x, i) => sum + x * (weights[i] ?? 0), bias);
}

/** Clip each coordinate into the L-infinity ball of radius epsilon around x. */
export function projectToBall(
    candidate: number[],
    original: number[],
    epsilon: number,
): number[] {
    return candidate.map((x, i) => {
        const center = original[i] ?? 0;
        return Math.min(center + epsilon, Math.max(center - epsilon, x));
    });
}

export interface PgdResult {
    perturbed: number[];
    perturbation: number[];
    initialScore: number;
    finalScore: number;
    scores: number[];
}

/** Maximize a linear score under an L-infinity budget by signed gradient steps. */
export function pgdAttack(
    input: number[],
    weights: number[],
    bias: number,
    epsilon: number,
    stepSize: number,
    iterations: number,
): PgdResult {
    const initialScore = linearScore(input, weights, bias);
    let current = [...input];
    const scores = [initialScore];
    for (let _i = 0; _i < iterations; _i += 1) {
        const candidate = current.map((x, i) => x + stepSize * Math.sign(weights[i] ?? 0));
        current = projectToBall(candidate, input, epsilon);
        scores.push(linearScore(current, weights, bias));
    }
    return {
        perturbed: current,
        perturbation: current.map((x, i) => x - (input[i] ?? 0)),
        initialScore,
        finalScore: scores[scores.length - 1]!,
        scores,
    };
}

function makeBars(perturbation: number[], weights: number[]): VisualEntity[] {
    return perturbation.map((p, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: p.toFixed(3),
        value: p,
        state: (Math.abs(p) > 1e-12 ? "swapped" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, weight: weights[i] ?? 0 },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            input?: number[];
            weights?: number[];
            bias?: number;
            epsilon?: number;
            stepSize?: number;
            iterations?: number;
        } | null
    ) ?? {};
    const sample: number[] = task.input ?? [0.2, -0.4, 0.1, 0.5];
    const weights: number[] = task.weights ?? [1, -2, 0.5, 1.5];
    const bias = typeof task.bias === "number" ? task.bias : 0;
    const epsilon = typeof task.epsilon === "number" && task.epsilon >= 0 ? task.epsilon : 0.3;
    const stepSize =
        typeof task.stepSize === "number" && task.stepSize > 0 ? task.stepSize : 0.1;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 6;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(sample.map(() => 0), weights),
        edges: [],
        description: `PGD attack with L-infinity budget ${epsilon} and step ${stepSize}; initial classifier score ${linearScore(sample, weights, bias).toFixed(3)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { iteration: 0, epsilon, score: linearScore(sample, weights, bias) },
    };
    step += 1;

    const result = pgdAttack(sample, weights, bias, epsilon, stepSize, iterations);
    for (let i = 0; i < iterations; i += 1) {
        // Recompute the intermediate perturbation to show progress frame by frame.
        let current = [...sample];
        for (let k = 0; k <= i; k += 1) {
            const candidate = current.map((x, j) => x + stepSize * Math.sign(weights[j] ?? 0));
            current = projectToBall(candidate, sample, epsilon);
        }
        const perturbation = current.map((x, j) => x - (sample[j] ?? 0));
        yield {
            stepNumber: step,
            entities: makeBars(perturbation, weights),
            edges: [],
            description: `Iteration ${i + 1}: move along the gradient sign and clip to the ball, score now ${result.scores[i + 1]!.toFixed(3)}.`,
            codeLineNumber: i % 2 === 0 ? 2 : 3,
            layout: "array",
            meta: { iteration: i + 1, epsilon, score: result.scores[i + 1]!, perturbation },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(result.perturbation, weights),
        edges: [],
        description: `Attack raised the score from ${result.initialScore.toFixed(3)} to ${result.finalScore.toFixed(3)}, reaching the budget limit at every coordinate.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { converged: true, epsilon, initialScore: result.initialScore, finalScore: result.finalScore, perturbation: result.perturbation },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single gradient-sign step often produces a weak adversarial example. PGD repeats that step many times, each time following the direction that most increases the model's error, and after every move it clips the input back into a small ball around the original. The clipping makes the attack a constrained optimization: find the worst-case input an allowed perturbation can produce.",
        invariants: [
            "Every intermediate input remains inside the L-infinity ball of radius epsilon.",
            "Each step moves a coordinate only in the direction of the sign of its gradient contribution.",
            "The classifier score never decreases across iterations for a linear model.",
        ],
        correctness:
            "For a linear score the gradient is the weight vector, so the signed step is optimal per coordinate and repeated clipping drives each perturbed coordinate to the ball boundary at sign(weight) times epsilon. That is exactly the closed-form worst case max over the ball, which the tests compute independently. The tests also check the budget on every intermediate frame and verify the score is nondecreasing.",
        complexityRationale:
            "Each iteration touches d coordinates for the step and the clip, so the attack costs O(iterations * d) for a linear model, plus one O(d) score evaluation. It keeps only the current and original inputs, using O(d) space.",
        uses: [
            "Robustness evaluation of image and text classifiers",
            "Adversarial training inner loop for robust models",
            "Stress testing safety-critical perception systems",
        ],
        references: [
            "Madry et al., Towards Deep Learning Models Resistant to Adversarial Attacks, ICLR 2018",
            "Goodfellow et al., Explaining and Harnessing Adversarial Examples, ICLR 2015",
        ],
        workedExample:
            "With input (0, 0), weights (1, -2), epsilon 0.1 and step 0.05, the first step gives (0.05, -0.05). The next step would give (0.1, -0.1), exactly the budget boundary, and further steps are clipped back to the same point, raising the score from 0 to 0.3.",
    },
    id: "projected-gradient-descent-adversarial",
    name: "Projected Gradient Descent Adversarial Attack",
    category: "ml-ai",
    complexity: { time: "O(iterations * d)", space: "O(d)" },
    defaultInput: {
        input: [0.2, -0.4, 0.1, 0.5],
        weights: [1, -2, 0.5, 1.5],
        bias: 0,
        epsilon: 0.3,
        stepSize: 0.1,
        iterations: 6,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start from the original input and set a perturbation budget epsilon",
        "for each attack iteration",
        "compute the sign of the gradient of the loss at the current input",
        "move the input by step size times that sign",
        "clip every coordinate into an epsilon ball around the original input",
        "done: report the worst-case perturbation and the final score",
    ],
};

export default module;
