/**
 * orpo.ts - Odds Ratio Preference Optimization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * ORPO folds preference alignment into supervised fine-tuning. For every pair
 * it keeps the usual negative log likelihood of the chosen answer and adds an
 * odds-ratio term that pushes the chosen answer's odds above the rejected one's
 * relative to a frozen reference. No separate reward model or reference-heavy
 * KL term is needed, so training is a single stable objective.
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
 *   - Bars show each pair's odds-ratio margin and total loss.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface OrpoInput {
    chosenLogp?: number[];
    rejectedLogp?: number[];
    chosenRefLogp?: number[];
    rejectedRefLogp?: number[];
    beta?: number;
}

/** Stable logistic sigmoid. */
export function sigmoid(v: number): number {
    return v >= 0 ? 1 / (1 + Math.exp(-v)) : Math.exp(v) / (1 + Math.exp(v));
}

/** Convert a log probability into a log odds, clamped away from zero and one. */
export function logOdds(logp: number): number {
    const p = Math.max(1e-6, Math.min(1 - 1e-6, Math.exp(logp)));
    return Math.log(p) - Math.log1p(-p);
}

/** Compute the ORPO loss for one preference pair. */
export function orpoExample(
    chosenLogp: number,
    rejectedLogp: number,
    chosenRefLogp: number,
    rejectedRefLogp: number,
    beta: number,
) {
    const nll = -chosenLogp;
    const policyOdds = logOdds(chosenLogp) - logOdds(rejectedLogp);
    const refOdds = logOdds(chosenRefLogp) - logOdds(rejectedRefLogp);
    const logRatio = policyOdds - refOdds;
    const oddsLoss = -Math.log(Math.max(1e-12, sigmoid(logRatio)));
    return { nll, policyOdds, refOdds, logRatio, oddsLoss, total: nll + beta * oddsLoss };
}

/** Run ORPO over a batch of preference pairs. */
export function orpoBatch(input: Required<OrpoInput>) {
    const examples = input.chosenLogp.map((_, i) =>
        orpoExample(
            input.chosenLogp[i] ?? 0,
            input.rejectedLogp[i] ?? 0,
            input.chosenRefLogp[i] ?? 0,
            input.rejectedRefLogp[i] ?? 0,
            input.beta,
        ),
    );
    const totals = examples.map((e) => e.total);
    return { examples, totals, mean: totals.reduce((a, b) => a + b, 0) / Math.max(1, totals.length) };
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
    const task = (input as OrpoInput | null) ?? {};
    const chosen: number[] = task.chosenLogp ?? [-0.2, -0.5, -0.8];
    const rejected: number[] = task.rejectedLogp ?? [-1.5, -1.0, -2.0];
    const chosenRef: number[] = task.chosenRefLogp ?? chosen.map(() => -1);
    const rejectedRef: number[] = task.rejectedRefLogp ?? rejected.map(() => -1);
    const beta = typeof task.beta === "number" && task.beta > 0 ? task.beta : 0.1;
    const { examples, totals, mean } = orpoBatch({
        chosenLogp: chosen,
        rejectedLogp: rejected,
        chosenRefLogp: chosenRef,
        rejectedRefLogp: rejectedRef,
        beta,
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(chosen, chosen.map(() => "idle")),
        edges: [],
        description: `Score ${chosen.length} preference pairs with ORPO at beta ${beta}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", beta, chosen, rejected, total: [] },
    };
    step += 1;

    for (let i = 0; i < examples.length; i += 1) {
        yield {
            stepNumber: step,
            entities: bars(totals, examples.map((_, k) => (k === i ? "comparing" : "unvisited"))),
            edges: [],
            description: `Pair ${i}: odds-ratio margin ${examples[i]!.logRatio.toFixed(3)}, total loss ${examples[i]!.total.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "pair", beta, index: i, examples, total: totals },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: bars([...totals, mean], examples.map(() => "sorted").concat("active")),
        edges: [],
        description: `Done: mean ORPO loss ${mean.toFixed(4)} = likelihood loss plus weighted odds-ratio loss.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", beta, examples, total: totals, mean, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "ORPO adds a preference signal directly to ordinary supervised fine-tuning. Besides teaching the model to write the chosen answer, it compares the odds of choosing the good answer over the bad one against a frozen reference. When the policy favors the chosen answer more than the reference does, the extra term shrinks, so the two goals reinforce each other in one pass.",
        invariants: [
            "The supervised term is the negative log probability of the chosen answer.",
            "The odds ratio cancels the reference's preference so only the policy's improvement counts.",
            "A larger chosen-over-rejected margin always lowers the odds-ratio loss.",
        ],
        correctness:
            "Log odds are computed as log p minus log(1-p) with p clamped inside the open unit interval, so they are finite. The odds-ratio margin subtracts the reference margin from the policy margin, making a frozen reference contribute zero. The term negative log sigmoid is strictly decreasing in its argument, so raising the chosen margin lowers the loss, and the total is the exact ORPO sum of the likelihood term and the weighted odds term.",
        complexityRationale:
            "Each pair needs a constant number of logarithms and exponentials, so n pairs take O(n) time and O(n) space to store the losses.",
        uses: [
            "Instruction tuning with chosen and rejected responses",
            "A single-stage replacement for supervised fine-tuning plus RLHF",
            "Preference alignment without a separate reward model",
        ],
        references: [
            "Hong et al., ORPO: Monolithic Preference Optimization without Reference Model, EMNLP 2024",
            "Christiano et al., Deep Reinforcement Learning from Human Preferences, 2017",
        ],
        workedExample:
            "For a chosen log probability of negative 0.2 and a rejected one of negative 1.5, the policy odds margin is positive because the chosen answer is much likelier. If the reference already had the same margin, the odds-ratio term is about log two and the total loss is the small likelihood loss plus a modest preference penalty; improving the margin shrinks that penalty.",
    },
    id: "orpo",
    name: "ORPO Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        chosenLogp: [-0.2, -0.5, -0.8],
        rejectedLogp: [-1.5, -1, -2],
        beta: 0.1,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read chosen and rejected log probabilities with a frozen reference",
        "compute the supervised negative log likelihood of the chosen answer",
        "convert each probability to log odds",
        "subtract the reference odds margin from the policy odds margin",
        "compute the negative log sigmoid of that margin",
        "add the weighted odds term to the likelihood term",
        "done: report the mean ORPO loss",
    ],
};

export default module;
