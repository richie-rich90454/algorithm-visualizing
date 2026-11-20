/**
 * simclr.ts - SimCLR NT-Xent Contrastive Loss
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SimCLR learns visual representations by pulling two augmented views of the
 * same image together and pushing views of different images apart. The NT-Xent
 * loss is a softmax over cosine similarities divided by a temperature: the
 * positive pair is the target class and all other pairs in the batch are
 * negatives. Lower temperatures sharpen the distribution, giving the hardest
 * negatives more influence. This module evaluates that normalized temperature-
 * scaled cross-entropy from a positive similarity and its negatives.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N) for one positive and N negative similarities
 *   Space: O(N) for the scaled logits and exponentials
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show each similarity divided by the temperature (the logits).
 *   - The positive pair is green; negatives are highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    positiveSimilarity?: number;
    negativeSimilarities?: number[];
    temperature?: number;
}

function makeBars(logits: number[], positiveIndex: number): VisualEntity[] {
    return logits.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state: i === positiveIndex ? "sorted" : "highlight",
        x: i,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, role: i === positiveIndex ? "positive" : "negative", logit: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const positive = typeof task.positiveSimilarity === "number" ? task.positiveSimilarity : 0.9;
    const negatives = (task.negativeSimilarities ?? [0.2, 0.1, -0.3, 0.4]).slice();
    const temperature = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 0.5;
    const all = [positive, ...negatives];
    const logits = all.map((value) => value / temperature);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(logits, 0),
        edges: [],
        description: `Score one positive pair against ${negatives.length} negatives at temperature ${temperature.toFixed(2)}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows: 1, cols: all.length, temperature, pairs: all.length, positive, negatives },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(logits, 0),
        edges: [],
        description: `Divide each cosine similarity by the temperature to obtain the logits.`,
        codeLineNumber: 1,
        layout: "array",
        meta: { rows: 1, cols: all.length, temperature, logits: logits.map((v) => Number(v.toFixed(6))) },
    };
    step += 1;

    const maxLogit = Math.max(...logits);
    const exponentials = logits.map((value) => Math.exp(value - maxLogit));
    const sumExp = exponentials.reduce((a, v) => a + v, 0);
    const probability = (exponentials[0] ?? 0) / sumExp;
    const loss = -Math.log(probability);

    yield {
        stepNumber: step,
        entities: makeBars(logits, 0),
        edges: [],
        description: `Softmax gives the positive pair probability ${probability.toFixed(4)} of the ${all.length} pairs.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { rows: 1, cols: all.length, temperature, probability: Number(probability.toFixed(6)), probabilityLabel: probability.toFixed(6) },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeBars(logits, 0),
        edges: [],
        description: `Done: NT-Xent loss is ${loss.toFixed(4)}; a sharper temperature raises the positive probability.`,
        codeLineNumber: 4,
        layout: "array",
        meta: { rows: 1, cols: all.length, temperature, probability: Number(probability.toFixed(6)), loss: Number(loss.toFixed(6)), positive, negatives },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Take two random crops of the same image and treat them as a positive pair; every other crop in the batch is a negative. The model scores pairs with cosine similarity and runs a softmax that picks the positive. Because the similarities are divided by a temperature, turning the temperature down magnifies differences and emphasizes hard negatives, which produces more useful visual features.",
        invariants: [
            "Every similarity is scaled by the same positive temperature.",
            "The softmax denominator includes the positive and all negatives.",
            "The loss is the negative log probability assigned to the positive pair.",
        ],
        correctness:
            "With logits z_i = sim_i / tau, the softmax probability of the positive is exp(z_pos) / sum_j exp(z_j). Computing this with a max shift, exp(z_i - M) / sum_j exp(z_j - M), is algebraically identical because the common factor exp(M) cancels. The NT-Xent loss is minus the log of that probability, which decreases exactly when the positive logit rises relative to the negatives, so gradient descent pulls augmented views together and pushes others apart.",
        complexityRationale:
            "Scaling the N + 1 similarities and evaluating the stabilized exponentials each take one pass, so the loss costs O(N) time; storing the logits and exponentials uses O(N) space.",
        uses: [
            "Self-supervised pretraining of image encoders",
            "Contrastive representation learning without labels",
            "Transfer learning from unlabeled image corpora",
        ],
        references: [
            "Chen et al., A Simple Framework for Contrastive Learning of Visual Representations, ICML 2020",
            "Sohn, Improved Deep Metric Learning with Multi-class N-pair Loss, NeurIPS 2016",
        ],
        workedExample:
            "With positive similarity 0.9, negatives [0.2, 0.1, -0.3, 0.4] and temperature 0.5, the logits are [1.8, 0.4, 0.2, -0.6, 0.8]. The positive exponentials dominate, giving a probability near 0.70 and a loss near 0.36. Lowering the temperature to 0.2 pushes the positive probability above 0.9 and lowers the loss, showing the sharpening effect.",
    },
    id: "simclr",
    name: "SimCLR NT-Xent Loss",
    category: "ml-ai",
    complexity: { time: "O(N)", space: "O(N)" },
    defaultInput: {
        positiveSimilarity: 0.9,
        negativeSimilarities: [0.2, 0.1, -0.3, 0.4],
        temperature: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "collect the positive cosine similarity and negative similarities",
        "divide every similarity by the temperature",
        "exponentiate each logit with a max shift for stability",
        "divide the positive exponential by their sum",
        "take the negative logarithm as the loss",
        "done: return the normalized temperature-scaled loss",
    ],
};

export default module;
