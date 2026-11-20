/**
 * supervised-contrastive.ts - Supervised Contrastive (SupCon) Loss
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SupCon extends contrastive learning to labeled data. Every example with the
 * same label as an anchor is treated as a positive, and all other examples are
 * negatives. A temperature-scaled softmax over pairwise similarities pushes
 * positives together while repelling negatives, using all positive pairs in
 * the batch rather than just one.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(N^2 * d) for N normalized features of dimension d
 *   Space: O(N^2) for the similarity matrix and positive mask
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The pairwise similarity matrix is drawn as a grid.
 *   - Positive pairs are green, negatives are idle, the diagonal is gray.
 *   - Frame meta exposes the logits, mask, and running loss.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SupConInput {
    features?: number[][];
    labels?: number[];
    temperature?: number;
}

/** L2-normalize each row; zero rows stay zero. */
export function normalizeRows(rows: number[][]): number[][] {
    return rows.map((row) => {
        const norm = Math.sqrt(row.reduce((s, v) => s + v * v, 0));
        return norm === 0 ? row.map(() => 0) : row.map((v) => v / norm);
    });
}

/** Full SupCon computation: normalized cosine logits, positive mask, and mean loss. */
export function supConLoss(
    features: number[][],
    labels: number[],
    temperature: number,
): { logits: number[][]; positives: boolean[][]; perAnchor: number[]; loss: number } {
    const z = normalizeRows(features);
    const N = z.length;
    const logits: number[][] = [];
    const positives: boolean[][] = [];
    const perAnchor: number[] = [];
    let total = 0;
    let anchors = 0;
    for (let i = 0; i < N; i += 1) {
        const row: number[] = [];
        const posRow: boolean[] = [];
        for (let j = 0; j < N; j += 1) {
            let dot = 0;
            for (let k = 0; k < (z[i]?.length ?? 0); k += 1) {
                dot += (z[i]?.[k] ?? 0) * (z[j]?.[k] ?? 0);
            }
            row.push(dot / temperature);
            posRow.push(j !== i && labels[j] === labels[i]);
        }
        logits.push(row);
        positives.push(posRow);
        const pairIndices = posRow.map((p, j) => (p ? j : -1)).filter((j) => j >= 0);
        if (pairIndices.length === 0) {
            perAnchor.push(0);
            continue;
        }
        const maxLogit = Math.max(...row.filter((_, j) => j !== i));
        const expRow = row.map((v, j) => (j === i ? 0 : Math.exp(v - maxLogit)));
        const denom = expRow.reduce((a, b) => a + b, 0);
        let anchorLoss = 0;
        for (const p of pairIndices) {
            anchorLoss += -Math.log((expRow[p] ?? 0) / denom);
        }
        anchorLoss /= pairIndices.length;
        perAnchor.push(anchorLoss);
        total += anchorLoss;
        anchors += 1;
    }
    return { logits, positives, perAnchor, loss: anchors === 0 ? 0 : total / anchors };
}

function makeCells(logits: number[][], positives: boolean[][], anchor: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < logits.length; row += 1) {
        for (let col = 0; col < (logits[row]?.length ?? 0); col += 1) {
            const value = logits[row]?.[col] ?? 0;
            let state: EntityState = "idle";
            if (row === col) state = "unvisited";
            else if (row === anchor && positives[row]?.[col]) state = "sorted";
            entities.push({
                id: `logit-${row}-${col}`,
                type: "cell",
                label: value.toFixed(2),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, positive: positives[row]?.[col] ?? false },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SupConInput | null) ?? {};
    const features = (task.features ?? [
        [1, 0, 0],
        [0.9, 0.1, 0],
        [0.8, 0.2, 0],
        [0, 1, 0],
        [0.1, 0.9, 0],
        [0, 0.8, 0.2],
    ]).map((row) => [...row]);
    const labels = task.labels ?? [0, 0, 0, 1, 1, 1];
    const temperature = typeof task.temperature === "number" && task.temperature > 0
        ? task.temperature
        : 0.5;
    const result = supConLoss(features, labels, temperature);
    const N = features.length;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells(result.logits, result.positives, -1),
        edges: [],
        description: `SupCon over ${N} examples; compute normalized cosine logits at temperature ${temperature}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: N, cols: N, N, temperature, logits: result.logits, positives: result.positives, loss: 0 },
    };
    step += 1;

    for (let i = 0; i < N; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(result.logits, result.positives, i),
            edges: [],
            description: `Anchor ${i}: ${result.positives[i]?.filter(Boolean).length ?? 0} positive pair(s), anchor loss ${(result.perAnchor[i] ?? 0).toFixed(4)}.`,
            codeLineNumber: i === 0 ? 2 : 4,
            layout: "grid",
            meta: {
                rows: N,
                cols: N,
                N,
                temperature,
                logits: result.logits,
                positives: result.positives,
                perAnchor: result.perAnchor,
                anchor: i,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(result.logits, result.positives, -1),
        edges: [],
        description: `Mean SupCon loss over the batch is ${result.loss.toFixed(5)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: N, cols: N, N, temperature, logits: result.logits, positives: result.positives, loss: result.loss },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "If you know the labels, you know which pairs should be close. SupCon treats every same-label example as a positive for an anchor and every other example as a negative. The loss is a softmax over pairwise similarities, so one gradient step pulls all members of a class together instead of pairing them up one at a time.",
        invariants: [
            "Features are L2-normalized before scoring, so logits are cosine similarities scaled by temperature.",
            "A positive pair has the same label and distinct indices.",
            "The reported loss is the mean over anchors that have at least one positive.",
        ],
        correctness:
            "The implementation forms all N squared cosine similarities, masks self-pairs and mismatched labels, and computes the cross-entropy of each positive against a softmax denominator that excludes the anchor. Summing those cross-entropies over all positives and averaging over valid anchors is precisely the SupCon objective; the log-sum-exp shift leaves the value unchanged while avoiding overflow.",
        complexityRationale:
            "Computing every feature pair takes O(N squared times d) operations, and the mask and logit matrices occupy O(N squared) space. Averaging over anchors adds only O(N squared) work.",
        uses: [
            "Learning embedding spaces for image classification",
            "Fine-grained retrieval with labeled training data",
            "Robust representation learning under domain shift",
        ],
        references: [
            "Khosla et al., Supervised Contrastive Learning, NeurIPS 2020",
            "Chen et al., A Simple Framework for Contrastive Learning of Visual Representations, ICML 2020",
        ],
        workedExample:
            "With four identical normalized features and labels [0,0,1,1], anchor 0 has one positive. Every non-self logit equals 1/tau, so the softmax weight on the positive is 1/3 and its loss is log(3), independent of the overall scale.",
    },
    id: "supervised-contrastive",
    name: "Supervised Contrastive Loss",
    category: "ml-ai",
    complexity: { time: "O(N^2 * d)", space: "O(N^2)" },
    defaultInput: {
        features: [[1, 0, 0], [0.9, 0.1, 0], [0.8, 0.2, 0], [0, 1, 0], [0.1, 0.9, 0], [0, 0.8, 0.2]],
        labels: [0, 0, 0, 1, 1, 1],
        temperature: 0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "L2-normalize every feature vector",
        "compute scaled cosine logits for all ordered pairs",
        "mark a pair positive when labels match and indices differ",
        "for each anchor with at least one positive",
        "softmax the logits over all other examples",
        "sum negative log probabilities of the positives",
        "average those anchor losses over the batch",
        "done: return the supervised contrastive loss",
    ],
};

export default module;
