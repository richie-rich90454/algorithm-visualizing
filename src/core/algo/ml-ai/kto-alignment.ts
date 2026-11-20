/**
 * kto-alignment.ts - Kahneman-Tversky Optimization Loss
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * KTO aligns a model from simple desirable or undesirable labels instead of
 * paired comparisons. It compares each example's policy-to-reference log ratio
 * with a baseline derived from the same kind of examples, then applies an
 * asymmetric value curve: desirable examples are rewarded and undesirable ones
 * are penalized. A single scalar loss is produced for the whole batch.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) for n labeled examples
 *   Space: O(n) for the per-example loss values
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each example's loss, colored by label.
 *   - The final bar set includes the batch mean.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface KtoInput {
    policyLogp?: number[];
    referenceLogp?: number[];
    desirable?: boolean[];
    beta?: number;
}

/** Numerically stable logistic sigmoid. */
export function sigmoid(v: number): number {
    return v >= 0 ? 1 / (1 + Math.exp(-v)) : Math.exp(v) / (1 + Math.exp(v));
}

/** Compute the KTO loss for one example given its group's baseline risk. */
export function ktoExample(policyLogp: number, referenceLogp: number, desirable: boolean, groupBaseline: number, beta: number) {
    const logRatio = Math.max(-20, Math.min(20, policyLogp - referenceLogp));
    const value = desirable ? logRatio - groupBaseline : groupBaseline - logRatio;
    return { logRatio, value, loss: 1 - sigmoid(beta * value) };
}

/** Run KTO over a batch, using each label group's mean log ratio as baseline. */
export function ktoBatch(policy: number[], reference: number[], desirable: boolean[], beta: number) {
    const groups = [true, false];
    const baselines: Record<string, number> = {};
    for (const flag of groups) {
        const ratios: number[] = [];
        for (let i = 0; i < policy.length; i += 1) {
            if ((desirable[i] ?? false) === flag) ratios.push((policy[i] ?? 0) - (reference[i] ?? 0));
        }
        baselines[String(flag)] = ratios.length === 0
            ? 0
            : ratios.reduce((a, b) => a + b, 0) / ratios.length;
    }
    const examples = policy.map((_, i) => {
        const flag = desirable[i] ?? false;
        return ktoExample(policy[i] ?? 0, reference[i] ?? 0, flag, baselines[String(flag)] ?? 0, beta);
    });
    const losses = examples.map((e) => e.loss);
    return { baselines, examples, losses, total: losses.reduce((a, b) => a + b, 0) / Math.max(1, losses.length) };
}

function bars(values: number[], states: EntityState[]): VisualEntity[] {
    return values.map((value, index) => ({
        id: `ex-${index}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value: Number(value.toFixed(8)),
        state: states[index] ?? "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KtoInput | null) ?? {};
    const policy: number[] = task.policyLogp ?? [-0.8, -0.3, -1.1, -0.5];
    const reference: number[] = task.referenceLogp ?? [-1.0, -1.0, -1.0, -1.0];
    const desirable: boolean[] = task.desirable ?? [true, true, false, false];
    const beta = typeof task.beta === "number" && task.beta > 0 ? task.beta : 0.5;
    const { baselines, examples, losses, total } = ktoBatch(policy, reference, desirable, beta);
    const states: EntityState[] = desirable.map((flag) => (flag ? "sorted" : "swapped"));

    let step = 0;
    yield {
        stepNumber: step,
        entities: bars(reference, states),
        edges: [],
        description: `Score ${policy.length} examples with KTO: desirable and undesirable labels use different baselines.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { phase: "input", beta, desirable, policy, reference, baselines, losses: [] },
    };
    step += 1;

    for (let i = 0; i < examples.length; i += 1) {
        const example = examples[i]!;
        yield {
            stepNumber: step,
            entities: bars(losses, desirable.map((flag, k) => (k === i ? "comparing" : flag ? "sorted" : "swapped"))),
            edges: [],
            description: `Example ${i} (${desirable[i] ? "desirable" : "undesirable"}): log ratio ${example.logRatio.toFixed(3)}, KTO loss ${example.loss.toFixed(3)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { phase: "example", beta, index: i, desirable, baselines, losses, total: 0 },
        };
        step += 1;
    }

    const finalStates: EntityState[] = desirable.map((flag) => (flag ? "sorted" : "swapped"));
    finalStates.push("active");
    yield {
        stepNumber: step,
        entities: bars([...losses, total], finalStates),
        edges: [],
        description: `Done: mean KTO loss ${total.toFixed(4)} over the batch.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { phase: "done", beta, desirable, baselines, losses, total, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Preference data often arrives as a plain thumbs up or thumbs down rather than a chosen and rejected pair. KTO treats a language model like a utility function: it measures how much more likely the policy makes an example than a frozen reference, compares that with a baseline from similar examples, and pushes desirable examples up and undesirable ones down through a bounded value curve.",
        invariants: [
            "The log ratio is clipped so a single extreme example cannot dominate.",
            "Desirable and undesirable examples use separate baselines.",
            "Every per-example loss lies strictly between zero and one.",
        ],
        correctness:
            "The baseline for each label group is the arithmetic mean of its log ratios. For a desirable example the KTO value is its log ratio minus that baseline; for an undesirable example the sign is reversed, so improving an undesirable example reduces its value. The logistic sigmoid maps any value into (0,1), therefore one minus sigmoid is also in (0,1). Averaging these per-example losses is the batch objective, so the reported scalar is exactly KTO.",
        complexityRationale:
            "Computing the two group means and the per-example losses each makes one pass over n examples, so time is O(n). Storing the n losses and baselines uses O(n) space.",
        uses: [
            "Alignment from binary human feedback without paired comparisons",
            "Fine-tuning when only thumbs up and thumbs down signals exist",
            "A simpler data requirement than preference-pair methods",
        ],
        references: [
            "Ethayarajh et al., KTO: Model Alignment as Prospect Theoretic Optimization, ICML 2024",
            "Kahneman and Tversky, Prospect Theory, Econometrica 1979",
        ],
        workedExample:
            "With two desirable examples whose log ratios are 0.2 and 0.4, the desirable baseline is 0.3. The first example has value negative 0.1 and the second positive 0.1; with beta 0.5 their losses are slightly above and below one half. Undesirable examples are scored with the reversed sign so raising their log ratio lowers their loss.",
    },
    id: "kto-alignment",
    name: "KTO Alignment Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        policyLogp: [-0.8, -0.3, -1.1, -0.5],
        referenceLogp: [-1, -1, -1, -1],
        desirable: [true, true, false, false],
        beta: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read policy and reference log probabilities with binary labels",
        "for each label group compute its mean log ratio baseline",
        "for each example compute the clipped policy-to-reference log ratio",
        "form the KTO value with a sign set by the label",
        "map the value through a logistic to get the example loss",
        "average all example losses for the batch loss",
        "done: report the batch KTO loss",
    ],
};

export default module;
