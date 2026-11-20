/**
 * simpo.ts - Simple Preference Optimization Loss
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SimPO aligns a model with a single reference-free loss. It divides each
 * response's log probability by its length so longer answers are not favored
 * for being long, takes the difference between the chosen and normalized
 * rejected rewards, subtracts a target margin, and applies a log sigmoid. The
 * target margin separates the two responses by a desired amount at optimum.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n preference pairs
 *   Space: O(n) for the per-pair losses
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each pair's normalized reward margin and loss.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface SimpoInput {
    chosenLogp?: number[];
    rejectedLogp?: number[];
    chosenLengths?: number[];
    rejectedLengths?: number[];
    beta?: number;
    gamma?: number;
}

/** Numerically stable logistic sigmoid. */
export function sigmoid(v: number): number {
    return v >= 0 ? 1 / (1 + Math.exp(-v)) : Math.exp(v) / (1 + Math.exp(v));
}

/** Compute the SimPO reward and loss for one pair. */
export function simpoExample(
    chosenLogp: number,
    rejectedLogp: number,
    chosenLength: number,
    rejectedLength: number,
    beta: number,
    gamma: number,
) {
    const chosenReward = (beta / Math.max(1, chosenLength)) * chosenLogp;
    const rejectedReward = (beta / Math.max(1, rejectedLength)) * rejectedLogp;
    const margin = chosenReward - rejectedReward - gamma;
    return {
        chosenReward,
        rejectedReward,
        margin,
        loss: -Math.log(Math.max(1e-12, sigmoid(margin))),
    };
}

/** Run SimPO over a batch of preference pairs. */
export function simpoBatch(input: Required<SimpoInput>) {
    const examples = input.chosenLogp.map((_, i) =>
        simpoExample(
            input.chosenLogp[i] ?? 0,
            input.rejectedLogp[i] ?? 0,
            input.chosenLengths[i] ?? 1,
            input.rejectedLengths[i] ?? 1,
            input.beta,
            input.gamma,
        ),
    );
    const losses = examples.map((e) => e.loss);
    return { examples, losses, mean: losses.reduce((a, b) => a + b, 0) / Math.max(1, losses.length) };
}

function bars(values: number[], states: string[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `pair-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state: (states[index] ?? "unvisited") as VisualEntity["state"],
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SimpoInput | null) ?? {};
    const chosen: number[] = task.chosenLogp ?? [-0.3, -0.6, -1.0];
    const rejected: number[] = task.rejectedLogp ?? [-1.8, -1.2, -2.2];
    const chosenLengths: number[] = task.chosenLengths ?? chosen.map(() => 8);
    const rejectedLengths: number[] = task.rejectedLengths ?? rejected.map(() => 12);
    const beta = typeof task.beta === "number" && task.beta > 0 ? task.beta : 2;
    const gamma = typeof task.gamma === "number" ? task.gamma : 0.5;
    const { examples, losses, mean } = simpoBatch({
        chosenLogp: chosen,
        rejectedLogp: rejected,
        chosenLengths,
        rejectedLengths,
        beta,
        gamma,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(chosen, chosen.map(() => "idle")),
        edges: [],
        description: `Score ${chosen.length} preference pairs with reference-free SimPO.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", beta, gamma, chosen, rejected, chosenLengths, rejectedLengths, loss: [] },
    };
    step += 1;

    for (let i = 0; i < examples.length; i += 1) {
        yield {
            stepNumber: step,
            entities: bars(losses, examples.map((_, k) => (k === i ? "comparing" : "unvisited"))),
            edges: [],
            description: `Pair ${i}: length-normalized margin ${examples[i]!.margin.toFixed(3)} gives loss ${examples[i]!.loss.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "pair", beta, gamma, index: i, examples, loss: losses },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars([...losses, mean], examples.map(() => "sorted").concat("active")),
        edges: [],
        description: `Done: mean SimPO loss ${mean.toFixed(4)} with target margin ${gamma}.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", beta, gamma, examples, loss: losses, mean, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SimPO removes both the reference model and the length bias from preference tuning. It scores each answer by its average log probability per token, so a long answer cannot win simply by accumulating more tokens. The chosen reward minus the rejected reward must exceed a target margin, and a log sigmoid turns that gap into a smooth loss.",
        invariants: [
            "Each reward divides the log probability by the response length.",
            "The margin subtracts the target separation gamma from the reward gap.",
            "The loss decreases strictly as the margin grows.",
        ],
        correctness:
            "Dividing by a length of at least one is well defined for every pair. The margin is the chosen reward minus the rejected reward minus gamma, matching the SimPO definition. Negative log sigmoid is monotonically decreasing in its argument, so a model that separates chosen from rejected by more than gamma has a small loss and one that fails to separate them has a loss near log two. Averaging gives the batch objective exactly.",
        complexityRationale:
            "Each pair uses a constant number of arithmetic operations and one sigmoid, so n pairs cost O(n) time and O(n) space for the stored losses.",
        uses: [
            "Reference-free preference alignment of language models",
            "Instruction tuning that avoids favoring verbose answers",
            "A lightweight alternative to RLHF-style objectives",
        ],
        references: [
            "Meng et al., SimPO: Simple Preference Optimization with a Reference-Free Reward, NeurIPS 2024",
            "Rafailov et al., Direct Preference Optimization, NeurIPS 2023",
        ],
        workedExample:
            "With beta two, a chosen answer of length eight and log probability negative 0.3 has reward negative 0.075, while a rejected answer of length twelve and log probability negative 1.8 has reward negative 0.3. Their gap is 0.225; with gamma 0.5 the margin is negative 0.275 and the loss a little above log two, which drops as the chosen reward improves.",
    },
    id: "simpo",
    name: "SimPO Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        chosenLogp: [-0.3, -0.6, -1],
        rejectedLogp: [-1.8, -1.2, -2.2],
        chosenLengths: [8, 8, 8],
        rejectedLengths: [12, 12, 12],
        beta: 2,
        gamma: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read chosen and rejected log probabilities with their lengths",
        "divide each log probability by its response length",
        "scale the values by beta to form the two rewards",
        "subtract the rejected reward from the chosen reward",
        "subtract the target margin gamma",
        "take the negative log sigmoid of the result",
        "done: report the mean SimPO loss",
    ],
};

export default module;
