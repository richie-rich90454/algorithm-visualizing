/**
 * contrastive-loss-ntxent.ts - NT-Xent Contrastive Loss
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * NT-Xent (normalized temperature-scaled cross entropy) is the loss used by
 * SimCLR and related contrastive learners. A batch of N images produces two
 * augmented views each. For every anchor view, the other view of the same
 * image is the positive and all remaining views are negatives. The loss is the
 * softmax cross entropy over cosine similarities divided by a temperature.
 * This demo computes the full similarity matrix and the per-anchor losses
 * exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(M^2 * d) for M = 2N views of dimension d
 *   Space: O(M^2) for the similarity matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The similarity matrix is drawn as a grid of cells.
 *   - The active anchor row is highlighted; positive pairs are marked green.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vector = number[];

interface Input {
    embeddings?: Vector[];
    temperature?: number;
}

const cosine = (a: Vector, b: Vector): number => {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let d = 0; d < Math.min(a.length, b.length); d += 1) {
        dot += (a[d] ?? 0) * (b[d] ?? 0);
        na += (a[d] ?? 0) ** 2;
        nb += (b[d] ?? 0) ** 2;
    }
    if (na === 0 || nb === 0) {
        return 0;
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

/** Similarity matrix with the temperature already applied. */
function similarityMatrix(embeddings: Vector[], tau: number): number[][] {
    return embeddings.map((a) => embeddings.map((b) => cosine(a, b) / tau));
}

function makeCells(sim: number[][], pairOf: number[], anchor: number, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < sim.length; i += 1) {
        for (let j = 0; j < sim.length; j += 1) {
            let state: EntityState = "idle";
            if (done) {
                if (pairOf[i] === j && i !== j) {
                    state = "sorted";
                }
            } else if (i === anchor) {
                state = pairOf[i] === j ? "sorted" : j === anchor ? "idle" : "comparing";
            }
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: sim[i]?.[j]?.toFixed(2) ?? "0",
                value: sim[i]?.[j] ?? 0,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, similarity: sim[i]?.[j] ?? 0 },
            });
        }
    }
    return cells;
}

/** The NT-Xent generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const embeddings: Vector[] = task.embeddings ?? [
        [1, 0],
        [0.9, 0.1],
        [-1, 0],
        [-0.9, -0.1],
    ];
    const tau = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 0.5;
    const m = embeddings.length;
    const pairOf = embeddings.map((_v, i) => (i % 2 === 0 ? i + 1 : i - 1));
    const sim = similarityMatrix(embeddings, tau);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(sim, pairOf, -1, false),
        edges: [],
        description: `NT-Xent on ${m / 2} image pairs (${m} views) with temperature ${tau}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: m, cols: m, views: m, temperature: tau, loss: 0, anchorLosses: [] },
    };
    step += 1;

    const anchorLosses: number[] = [];
    for (let i = 0; i < m; i += 1) {
        const row = sim[i] ?? [];
        let maxLogit = -Infinity;
        for (let j = 0; j < m; j += 1) {
            if (j !== i) {
                maxLogit = Math.max(maxLogit, row[j] ?? 0);
            }
        }
        let denom = 0;
        for (let j = 0; j < m; j += 1) {
            if (j !== i) {
                denom += Math.exp((row[j] ?? 0) - maxLogit);
            }
        }
        const positive = row[pairOf[i] ?? 0] ?? 0;
        const anchorLoss = -((positive - maxLogit) - Math.log(denom));
        anchorLosses.push(anchorLoss);
        yield {
            stepNumber: step,
            entities: makeCells(sim, pairOf, i, false),
            edges: [],
            description: `Anchor ${i}: positive view ${pairOf[i]}, similarity ${positive.toFixed(3)}, loss ${anchorLoss.toFixed(4)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                rows: m,
                cols: m,
                views: m,
                temperature: tau,
                anchor: i,
                positive: pairOf[i],
                positiveSimilarity: positive,
                anchorLoss,
                anchorLosses: anchorLosses.slice(),
            },
        };
        step += 1;
    }

    const totalLoss = anchorLosses.reduce((a, v) => a + v, 0) / Math.max(1, m);
    yield {
        stepNumber: step,
        entities: makeCells(sim, pairOf, -1, true),
        edges: [],
        description: `Done: mean NT-Xent loss over ${m} anchors = ${totalLoss.toFixed(6)}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { rows: m, cols: m, views: m, temperature: tau, loss: totalLoss, anchorLosses },
    };
}

/** The NT-Xent module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Contrastive learning pulls together two different augmented views of the same image and pushes apart views of different images. For one anchor view, NT-Xent treats its paired view as the single positive and every other view in the batch as a negative, then asks a softmax over cosine similarities to pick the positive. The loss is the negative log probability it assigns.",
        invariants: [
            "Every view has exactly one positive partner, the other augmentation of its image.",
            "Similarities are cosine similarities divided by a positive temperature, which sharpens or softens the distribution.",
            "The softmax denominator for an anchor includes every view except the anchor itself.",
        ],
        correctness:
            "With similarities s_ij and paired index p(i), the probability assigned to the positive is exp(s_i,p) divided by the sum of exp(s_ij) over all j not equal to i. Taking minus the log gives the cross-entropy contribution of anchor i, and averaging over all anchors yields the NT-Xent loss. Computing the softmax with a max shift is algebraically identical to the unshifted form, so the result is numerically stable and exact.",
        complexityRationale:
            "Building the M by M similarity matrix takes O(M squared times d) work for embedding dimension d, and each anchor's softmax scans M entries, so the total is O(M squared times d). The matrix itself occupies O(M squared) space.",
        uses: [
            "Self-supervised visual representation learning with SimCLR",
            "Contrastive pretraining of text and multimodal embeddings",
            "Learning similarity metrics without labeled examples",
        ],
        references: [
            "Chen et al., A Simple Framework for Contrastive Learning of Visual Representations, 2020",
            "Sohn, Improved Deep Metric Learning with Multi-class N-pair Loss, 2016",
        ],
        workedExample:
            "With two image pairs, embeddings (1,0) and (0.9,0.1) form one positive pair while (-1,0) and (-0.9,-0.1) form the other. At temperature 0.5 the positive cosine similarity is nearly 1, so the softmax gives the positive most of the mass and the per-anchor loss is small.",
    },
    id: "contrastive-loss-ntxent",
    name: "NT-Xent Contrastive Loss",
    category: "ml-ai",
    complexity: { time: "O(M^2 * d)", space: "O(M^2)" },
    defaultInput: {
        embeddings: [
            [1, 0],
            [0.9, 0.1],
            [-1, 0],
            [-0.9, -0.1],
        ],
        temperature: 0.5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "collect the two views of each image into a batch",
        "compute every pairwise cosine similarity divided by temperature",
        "for each anchor view identify its positive partner",
        "form a softmax over all other views in the batch",
        "take the negative log of the probability on the positive",
        "average the per-anchor losses over the batch",
        "done: report the mean NT-Xent loss",
    ],
};

export default module;
