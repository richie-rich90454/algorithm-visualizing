/**
 * quadruplet-loss.ts - Quadruplet Loss
 *
 * Quadruplet loss extends triplet loss with a second negative. For an anchor,
 * a positive, and two negatives it applies two hinge terms, each with its own
 * margin. Using two negatives makes the embedding pull the positive closer than
 * both negatives and gives a richer training signal than a single triplet.
 *
 * Time:  O(d) for d embedding dimensions
 * Space: O(d) for the four embeddings
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QuadInput {
    anchor?: number[];
    positive?: number[];
    negative1?: number[];
    negative2?: number[];
    margin1?: number;
    margin2?: number;
}

type Vec = number[];

function sqDist(a: Vec, b: Vec): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        total += diff * diff;
    }
    return total;
}

function hinge(value: number): number {
    return Math.max(0, value);
}

function makeBars(vectors: Vec[], labels: string[], highlight: number): VisualEntity[] {
    const dim = vectors[0]?.length ?? 0;
    const entities: VisualEntity[] = [];
    for (let v = 0; v < vectors.length; v += 1) {
        const vector = vectors[v] ?? [];
        for (let i = 0; i < dim; i += 1) {
            entities.push({
                id: `vec-${v}-dim-${i}`,
                type: "bar" as const,
                label: `${labels[v]}${i}: ${(vector[i] ?? 0).toFixed(2)}`,
                value: vector[i] ?? 0,
                state: (v === highlight ? "active" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { vector: v, dim: i, name: labels[v] ?? "" },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as QuadInput | null) ?? {};
    const anchor = task.anchor?.length ? task.anchor.slice() : [0, 0, 0];
    const positive = task.positive?.length ? task.positive.slice() : [1, 0.2, 0];
    const negative1 = task.negative1?.length ? task.negative1.slice() : [0.5, 0.1, 0.2];
    const negative2 = task.negative2?.length ? task.negative2.slice() : [2, -0.3, 0.5];
    const margin1 = typeof task.margin1 === "number" ? task.margin1 : 1;
    const margin2 = typeof task.margin2 === "number" ? task.margin2 : 0.5;
    const vectors = [anchor, positive, negative1, negative2];
    const labels = ["anchor", "positive", "negative1", "negative2"];
    const dAP = sqDist(anchor, positive);
    const dAN1 = sqDist(anchor, negative1);
    const dAN2 = sqDist(anchor, negative2);
    const term1 = hinge(dAP - dAN1 + margin1);
    const term2 = hinge(dAP - dAN2 + margin2);
    const total = term1 + term2;
    const base = { dAP, dAN1, dAN2, margin1, margin2, term1, term2, total };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(vectors, labels, -1),
        edges: [],
        description: `Load an anchor, a positive and two negatives in ${anchor.length} dimensions; compute squared Euclidean distances.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { ...base, phase: 0 },
    };
    step += 1;

    const phases: Array<{ text: string; line: number; highlight: number; extra: Record<string, number> }> = [
        { text: `Distance anchor to positive is ${dAP.toFixed(4)}.`, line: 1, highlight: 1, extra: { dAP } },
        { text: `Distance anchor to first negative is ${dAN1.toFixed(4)}.`, line: 2, highlight: 2, extra: { dAN1 } },
        { text: `Distance anchor to second negative is ${dAN2.toFixed(4)}.`, line: 3, highlight: 3, extra: { dAN2 } },
        {
            text: `First hinge with margin ${margin1}: max(0, ${dAP.toFixed(3)} - ${dAN1.toFixed(3)} + ${margin1}) = ${term1.toFixed(4)}.`,
            line: 4,
            highlight: 2,
            extra: { term1 },
        },
        {
            text: `Second hinge with margin ${margin2}: max(0, ${dAP.toFixed(3)} - ${dAN2.toFixed(3)} + ${margin2}) = ${term2.toFixed(4)}.`,
            line: 5,
            highlight: 3,
            extra: { term2 },
        },
    ];
    for (let p = 0; p < phases.length; p += 1) {
        const phase = phases[p];
        if (!phase) continue;
        yield {
            stepNumber: step,
            entities: makeBars(vectors, labels, phase.highlight),
            edges: [],
            description: phase.text,
            codeLineNumber: phase.line,
            layout: "array",
            meta: { ...base, phase: p + 1, ...phase.extra },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(vectors, labels, -1),
        edges: [],
        description: `Done: quadruplet loss is ${term1.toFixed(4)} + ${term2.toFixed(4)} = ${total.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...base, phase: 6, done: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A triplet compares the positive against one negative. A quadruplet adds a second negative and pays a separate penalty for each, so the model must keep the positive closer than both. This doubles the constraint at little extra cost and tends to produce embeddings with cleaner class separation.",
        invariants: [
            "Distances are squared Euclidean distances between embeddings.",
            "Each hinge term is nonnegative and is zero once its margin is satisfied.",
            "The total loss is the sum of the two independent hinge terms.",
        ],
        correctness:
            "For each negative the term max(0, d(anchor, positive) minus d(anchor, negative) plus margin) vanishes only when the positive is closer by at least the margin. Summing the two terms therefore enforces both constraints simultaneously. The test recomputes all three distances and both hinges directly from the vectors and confirms the reported total, including a case where the loss is zero.",
        complexityRationale:
            "Each squared distance scans d dimensions and a constant number of distances are needed, so time is O(d). Four embeddings of length d are held in memory, giving O(d) space.",
        uses: [
            "Metric learning for face and person re-identification",
            "Training embedding spaces with multiple negative examples",
            "Nearest-neighbor retrieval with margin constraints",
        ],
        references: [
            "Chen, Chen, and Huang, Beyond Triplet Loss, arXiv, 2017",
            "Schroff, Kalenichenko, and Philbin, FaceNet, CVPR, 2015",
        ],
        workedExample:
            "With anchor at the origin, positive at (1, 0.2, 0) and first negative at (0.5, 0.1, 0.2), the squared distances are 1.04 and 0.30. With margin one the first hinge is 1.04 minus 0.30 plus 1, or 1.74. The second negative is far away, so its hinge is zero and the total loss is 1.74.",
    },
    id: "quadruplet-loss",
    name: "Quadruplet Loss",
    category: "ml-ai",
    complexity: { time: "O(d)", space: "O(d)" },
    defaultInput: {
        anchor: [0, 0, 0],
        positive: [1, 0.2, 0],
        negative1: [0.5, 0.1, 0.2],
        negative2: [2, -0.3, 0.5],
        margin1: 1,
        margin2: 0.5,
    },
    visualType: "array",
    run,
    pseudocode: [
        "read the anchor, positive and two negative embeddings",
        "compute squared distance from anchor to positive",
        "compute squared distance from anchor to first negative",
        "compute squared distance from anchor to second negative",
        "set term one to max of zero and dAP minus dAN1 plus margin1",
        "set term two to max of zero and dAP minus dAN2 plus margin2",
        "done: report the sum of the two hinge terms",
    ],
};

export default module;
