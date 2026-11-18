/**
 * direct-preference-optimization.ts - Direct Preference Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Direct Preference Optimization trains a policy from pairwise preferences
 * without a separate reward model. The difference between the policy's and the
 * reference model's log-probability ratios defines an implicit reward margin.
 * DPO maximizes the sigmoid of that margin, which makes the preferred response
 * more likely than the dispreferred one relative to the reference policy.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations)
 *   Space: O(iterations) for the plotted loss history
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame adds a point (iteration, loss) to the DPO loss curve.
 *   - meta exposes the policy log-odds, the implicit reward margin, and the
 *     preference accuracy implied by the current margin.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Numerically stable sigmoid. */
function sigmoid(z: number): number {
    return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/** Numerically stable softplus, equal to -log(sigmoid(x)). */
function softplus(x: number): number {
    return x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x));
}

/** Log softmax of a two-response logit vector [z, 0]. */
function logProbs(z: number): [number, number] {
    const max = Math.max(z, 0);
    const e0 = Math.exp(z - max);
    const e1 = Math.exp(0 - max);
    const total = e0 + e1;
    return [Math.log(e0 / total), Math.log(e1 / total)];
}

/** Build the loss-curve points seen so far. */
function makeEntities(history: number[], current: number): VisualEntity[] {
    return history.map((loss, index) => ({
        id: `loss-${index}`,
        type: "node" as const,
        label: loss.toFixed(3),
        value: loss,
        state: (index === current ? "comparing" : "visited") as EntityState,
        x: index,
        y: loss,
        width: 0,
        height: 0,
        metadata: { iteration: index, loss },
    }));
}

/** The DPO generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as {
            beta?: number;
            refLogOdds?: number;
            startLogOdds?: number;
            iterations?: number;
            learningRate?: number;
        } | null
    ) ?? {};
    const beta = typeof task.beta === "number" ? task.beta : 0.1;
    const refZ = typeof task.refLogOdds === "number" ? task.refLogOdds : 0;
    let z = typeof task.startLogOdds === "number" ? task.startLogOdds : 0;
    const iterations = typeof task.iterations === "number" ? Math.max(1, task.iterations) : 40;
    const rate = typeof task.learningRate === "number" ? task.learningRate : 0.5;

    const refLog = logProbs(refZ);
    const refChosen = refLog[0] ?? 0;
    const refRejected = refLog[1] ?? 0;

    let margin = beta * (z - refZ);
    let loss = softplus(-margin);
    const history: number[] = [loss];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(history, 0),
        edges: [],
        description: `DPO with beta ${beta}: moving the policy log-odds from ${z} away from reference ${refZ}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { iteration: 0, z, margin, loss, accuracy: sigmoid(margin), refZ, beta },
    };
    step += 1;

    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const policyLog = logProbs(z);
        const rChosen = beta * ((policyLog[0] ?? 0) - refChosen);
        const rRejected = beta * ((policyLog[1] ?? 0) - refRejected);
        margin = rChosen - rRejected;
        loss = softplus(-margin);
        const gradient = -beta * sigmoid(-margin);
        z -= rate * gradient;
        history.push(loss);
        yield {
            stepNumber: step,
            entities: makeEntities(history, history.length - 1),
            edges: [],
            description: `Iteration ${iteration}: margin ${margin.toFixed(4)}, DPO loss ${loss.toFixed(4)}, policy log-odds ${z.toFixed(3)}.`,
            codeLineNumber: 6,
            layout: "point",
            meta: {
                iteration,
                z,
                margin,
                loss,
                gradient,
                accuracy: sigmoid(margin),
                rChosen,
                rRejected,
                refZ,
                beta,
            },
        };
        step += 1;
    }

    const finalLog = logProbs(z);
    const finalRChosen = beta * ((finalLog[0] ?? 0) - refChosen);
    const finalRRejected = beta * ((finalLog[1] ?? 0) - refRejected);
    const finalMargin = finalRChosen - finalRRejected;
    const finalLoss = softplus(-finalMargin);
    yield {
        stepNumber: step,
        entities: makeEntities(history, -1),
        edges: [],
        description: `Done: final margin ${finalMargin.toFixed(3)} and loss ${finalLoss.toFixed(4)} after ${iterations} steps.`,
        codeLineNumber: 7,
        layout: "point",
        meta: {
            iteration: iterations,
            z,
            margin: finalMargin,
            loss: finalLoss,
            accuracy: sigmoid(finalMargin),
            rChosen: finalRChosen,
            rRejected: finalRRejected,
            refZ,
            beta,
            converged: true,
        },
    };
}

/** The DPO module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Start with a reference model you trust and nudge a copy of it so that it assigns higher probability to the response people preferred. DPO folds the reward model into the policy itself: the implicit reward is how much more likely the policy makes the chosen answer than the reference does.",
        invariants: [
            "The implicit reward of a response is beta times the policy-minus-reference log-probability difference.",
            "The DPO loss is the negative log-sigmoid of the reward margin between chosen and rejected responses.",
            "Each gradient step increases the policy's log-odds in favor of the chosen response.",
        ],
        correctness:
            "Under the Bradley-Terry preference model, the optimal reward is proportional to the policy's log ratio against the reference, which turns the preference likelihood into a direct loss on the policy. Its gradient is the negative beta times the sigmoid of the negative margin, so gradient descent raises the margin and therefore the implied preference probability.",
        complexityRationale:
            "Each iteration evaluates a two-response softmax and one scalar update, so time is O(iterations). The optimizer state is constant and the plot stores one loss point per iteration, giving O(iterations) space.",
        uses: [
            "Aligning language models with human preference data",
            "Fine-tuning chat assistants without a separate reward model",
            "Ranking responses from pairwise comparison feedback",
        ],
        references: [
            "Rafailov et al., Direct Preference Optimization: Your Language Model Is Secretly a Reward Model, NeurIPS 2023",
            "Bradley and Terry, Rank Analysis of Incomplete Block Designs, 1952",
        ],
        workedExample:
            "With beta 0.1 and a reference log-odds of 0, starting the policy at 0 gives a margin of zero and a loss of about 0.693. Each step raises the policy log-odds, the margin grows positive, and the loss falls toward zero as the preferred response becomes more likely.",
    },
    id: "direct-preference-optimization",
    name: "Direct Preference Optimization",
    category: "ml-ai",
    complexity: { time: "O(iterations)", space: "O(iterations)" },
    defaultInput: { beta: 0.1, refLogOdds: 0, startLogOdds: 0, iterations: 40, learningRate: 0.5 },
    visualType: "point",
    run,
    pseudocode: [
        "initialize policy log-odds and read the reference log-odds",
        "for each iteration",
        "compute policy log probabilities for chosen and rejected responses",
        "form implicit rewards relative to the reference log probabilities",
        "set loss to negative log sigmoid of the reward margin",
        "compute the gradient with respect to the policy log-odds",
        "take a step that raises the preference margin",
        "done: report the final margin and DPO loss",
    ],
};

export default module;
