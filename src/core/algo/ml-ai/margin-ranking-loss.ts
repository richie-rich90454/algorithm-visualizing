/**
 * margin-ranking-loss.ts - Margin Ranking Loss
 *
 * Margin ranking loss teaches a scorer to order pairs of items. For each pair
 * it forms the signed difference y times (x1 minus x2) and penalizes it only
 * when it falls below the margin. It is the workhorse of pairwise learning to
 * rank and of siamese comparison heads.
 *
 * Time:  O(n) for n pairs
 * Space: O(n) for the drawn per-pair entities
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RankPair {
    x1: number;
    x2: number;
    y: number;
}

interface RankingInput {
    pairs?: RankPair[];
    margin?: number;
}

function makeBars(pairs: RankPair[], scores: number[], losses: number[], revealed: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < pairs.length; i += 1) {
        const shown = i <= revealed;
        entities.push({
            id: `score-${i}`,
            type: "bar" as const,
            label: shown ? `pair ${i}: y*(x1-x2) = ${(scores[i] ?? 0).toFixed(3)}` : `pair ${i}: ?`,
            value: shown ? scores[i] ?? 0 : 0,
            state: (shown ? "active" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "score", shown },
        });
        entities.push({
            id: `loss-${i}`,
            type: "bar" as const,
            label: shown ? `loss ${(losses[i] ?? 0).toFixed(3)}` : "loss ?",
            value: shown ? losses[i] ?? 0 : 0,
            state: (shown ? (losses[i] ?? 0) > 0 ? "error" : "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, kind: "loss", shown },
        });
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RankingInput | null) ?? {};
    const pairs: RankPair[] =
        task.pairs?.length
            ? task.pairs
            : [
                  { x1: 0.9, x2: 0.2, y: 1 },
                  { x1: 0.1, x2: 0.8, y: 1 },
                  { x1: 0.7, x2: 0.3, y: -1 },
                  { x1: 0.4, x2: 0.6, y: -1 },
              ];
    const margin = typeof task.margin === "number" ? task.margin : 0.5;
    const scores = pairs.map((pair) => pair.y * (pair.x1 - pair.x2));
    const losses = scores.map((score) => Math.max(0, margin - score));
    const meanLoss = losses.reduce((sum, value) => sum + value, 0) / Math.max(1, pairs.length);
    const correct = scores.filter((score) => score >= margin).length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(pairs, scores, losses, -1),
        edges: [],
        description: `Load ${pairs.length} ranked pairs with margin ${margin}; evaluate each signed difference.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { margin, pairCount: pairs.length, meanLoss: 0, correct: 0, scores: scores.slice(), losses: losses.slice() },
    };
    step += 1;

    for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i];
        if (!pair) continue;
        yield {
            stepNumber: step,
            entities: makeBars(pairs, scores, losses, i),
            edges: [],
            description: `Pair ${i}: label ${pair.y}, x1 ${pair.x1}, x2 ${pair.x2}; signed score ${(scores[i] ?? 0).toFixed(3)}, hinge loss ${(losses[i] ?? 0).toFixed(3)}.`,
            codeLineNumber: i === pairs.length - 1 ? 4 : 2,
            layout: "array",
            meta: {
                margin,
                pairCount: pairs.length,
                meanLoss: losses.slice(0, i + 1).reduce((sum, v) => sum + v, 0) / (i + 1),
                correct: scores.slice(0, i + 1).filter((s) => s >= margin).length,
                scores: scores.slice(),
                losses: losses.slice(),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(pairs, scores, losses, pairs.length - 1),
        edges: [],
        description: `Done: ${correct} of ${pairs.length} pairs satisfy the margin; mean ranking loss is ${meanLoss.toFixed(4)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { margin, pairCount: pairs.length, meanLoss, correct, scores: scores.slice(), losses: losses.slice(), done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Ranking loss looks at pairs rather than single items. The label says which of the two scores should be larger, and the signed difference measures how strongly that ordering holds. Anything beyond the required margin is already good enough, so the hinge ignores it and only penalizes pairs that are wrong or too close.",
        invariants: [
            "The signed score is y times x1 minus x2.",
            "A pair is satisfied when its signed score reaches the margin.",
            "Every hinge loss is nonnegative and is zero for a satisfied pair.",
        ],
        correctness:
            "For label plus one the term reduces to max(0, margin minus x1 plus x2), which is positive exactly when x1 fails to exceed x2 by the margin; the label minus one case is symmetric. Averaging the per-pair hinges gives the batch loss. The test computes each score and loss from scratch, checks the reported mean, and verifies that a perfectly ordered batch has zero loss.",
        complexityRationale:
            "Each pair needs constant arithmetic and produces two drawn bars, so time and space are both linear in the number of pairs.",
        uses: [
            "Learning-to-rank with pairwise preferences",
            "Training siamese networks on similar and dissimilar pairs",
            "Metric learning where only relative order matters",
        ],
        references: [
            "Herbrich, Graepel, and Obermayer, Large Margin Rank Boundaries for Ordinal Regression, 2000",
            "PyTorch documentation, nn.MarginRankingLoss",
        ],
        workedExample:
            "With margin 0.5 and a pair x1 0.9, x2 0.2, label plus one, the signed score is 0.7 and the hinge is zero because the margin is met. A second pair with x1 0.1 and x2 0.8 has signed score negative 0.7, so its hinge is 1.2. Averaging the four hinges in the default batch gives 0.6.",
    },
    id: "margin-ranking-loss",
    name: "Margin Ranking Loss",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        pairs: [
            { x1: 0.9, x2: 0.2, y: 1 },
            { x1: 0.1, x2: 0.8, y: 1 },
            { x1: 0.7, x2: 0.3, y: -1 },
            { x1: 0.4, x2: 0.6, y: -1 },
        ],
        margin: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the pair list and the margin",
        "for each pair compute y times x1 minus x2",
        "set the pair loss to max of zero and margin minus that score",
        "mark the pair satisfied when the score reaches the margin",
        "advance to the next pair",
        "done: report the satisfied count and mean loss",
    ],
};

export default module;
