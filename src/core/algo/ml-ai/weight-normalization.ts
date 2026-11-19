/**
 * weight-normalization.ts - Weight Normalization Reparameterization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Weight normalization reparameterizes each weight vector of a layer into a
 * scalar magnitude and a direction vector. During training the magnitude and
 * direction are optimized separately, which decouples the length of the
 * weight from its angle and often speeds up convergence. The forward pass
 * uses the reconstructed vector, so at initialization the reconstruction is
 * exactly the original weight.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(m * d) for an m-by-d weight matrix
 *   Space: O(m * d) for the magnitude and direction parameters
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Bars show the current row's original or reconstructed weight values.
 *   - The row being reparameterized is highlighted.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Input {
    weights?: number[][];
}

function makeBars(values: number[], state: EntityState): VisualEntity[] {
    return values.map((value, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: value.toFixed(3),
        value,
        state,
        x: i,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const weights = (task.weights ?? [
        [3, 4],
        [1, 1],
        [-2, 2],
    ]).map((row) => row.slice());
    const rows = weights.length;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(weights[0] ?? [], "idle"),
        edges: [],
        description: `Reparameterize ${rows} weight vectors into a magnitude and a unit direction.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { rows, cols: (weights[0]?.length ?? 0), row: 0, norm: 0, maxError: 0 },
    };
    step += 1;

    for (let r = 0; r < rows; r += 1) {
        const row = weights[r] ?? [];
        const norm = Math.sqrt(row.reduce((a, v) => a + v * v, 0));
        const direction = row.map((v) => (norm > 0 ? v / norm : 0));
        const reconstructed = direction.map((v) => norm * v);
        const maxError = row.reduce((max, v, i) => Math.max(max, Math.abs(v - (reconstructed[i] ?? 0))), 0);

        yield {
            stepNumber: step,
            entities: makeBars(row, "comparing"),
            edges: [],
            description: `Row ${r}: original weight vector with Euclidean magnitude ${norm.toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: { rows, row: r, norm, direction, reconstructed, maxError },
        };
        step += 1;

        yield {
            stepNumber: step,
            entities: makeBars(reconstructed, "sorted"),
            edges: [],
            description: `Row ${r}: direction has unit length; magnitude times direction reconstructs the weight (max error ${maxError.toExponential(1)}).`,
            codeLineNumber: 4,
            layout: "array",
            meta: { rows, row: r, norm, direction, reconstructed, maxError },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(weights[rows - 1] ?? [], "sorted"),
        edges: [],
        description: `Done: all ${rows} weight vectors split into magnitude and unit direction with exact reconstruction.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { rows, reconstructedRows: rows, norm: 0, maxError: 0 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Write a weight vector as its length times a unit vector pointing in its direction. Training can then adjust how big the weight is and which way it points as two separate decisions. The direction always stays normalized, so a large update to one component cannot silently inflate the whole vector.",
        invariants: [
            "The direction vector is the original weight divided by its Euclidean norm.",
            "The direction has unit length whenever the weight is nonzero.",
            "Multiplying the magnitude back by the direction reproduces the original weight.",
        ],
        correctness:
            "For a nonzero vector w with norm g, the direction v = w / g satisfies ||v|| = sqrt(sum((w_i / g)^2)) = sqrt(g^2 / g^2) = 1, and g * v = g * (w / g) = w exactly. For a zero vector the direction is defined as zero and the reconstruction is still zero, so the reparameterization is faithful in every case.",
        complexityRationale:
            "For an m-by-d matrix each row needs one pass to compute its norm and one pass to build its direction and reconstruction, so the total work is O(m * d); storing the new parameters also takes O(m * d) space.",
        uses: [
            "Faster convergence in deep convolutional networks",
            "Normalizing flows such as Real NVP",
            "Reinforcement learning policies with stable action scales",
        ],
        references: [
            "Salimans & Kingma, Weight Normalization, NeurIPS 2016",
            "Goodfellow, Bengio & Courville, Deep Learning, Section 8.7",
        ],
        workedExample:
            "The weight vector [3, 4] has magnitude 5 and direction [0.6, 0.8]. The direction has length 1, and 5 times [0.6, 0.8] returns [3, 4] with zero error. The optimizer now stores the scalar 5 and the pair [0.6, 0.8] instead of the raw pair [3, 4].",
    },
    id: "weight-normalization",
    name: "Weight Normalization",
    category: "ml-ai",
    complexity: { time: "O(m * d)", space: "O(m * d)" },
    defaultInput: {
        weights: [
            [3, 4],
            [1, 1],
            [-2, 2],
        ],
    },
    visualType: "array",
    run,
    pseudocode: [
        "for each output weight vector w in the layer",
        "compute the Euclidean norm g of w",
        "set the direction v to w divided by g",
        "keep g as the learned magnitude parameter",
        "replace the forward computation by g times v",
        "store the reconstructed weight for this row",
        "done: return all magnitude-normalized weights",
    ],
};

export default module;
