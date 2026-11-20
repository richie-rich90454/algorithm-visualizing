/**
 * swav.ts - Swapped Assignment Clustering
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * SwAV clusters images online instead of comparing every pair. Prototypes are
 * learned, and each view is softly assigned to them with Sinkhorn normalization
 * so that clusters are used evenly. The loss then asks each view to predict the
 * assignment of the other view, which is why it is called swapped prediction.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(I * B * K + B * K * d) for I Sinkhorn iterations
 *   Space: O(B * K) for the assignment matrices
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the soft assignment matrix, one row per view.
 *   - The final frame highlights the evenly spread cluster assignments.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface SwavInput {
    view1?: number[][];
    view2?: number[][];
    prototypes?: number[][];
    temperature?: number;
    sinkhornIters?: number;
}

function dot(a: number[], b: number[]): number {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
        total += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return total;
}

function logits(views: number[][], prototypes: number[][], tau: number): number[][] {
    return views.map((v) => prototypes.map((p) => dot(v, p) / tau));
}

/** Sinkhorn rows sum to one and columns sum to B/K (equipartition). */
function sinkhorn(scores: number[][], iters: number): number[][] {
    const b = scores.length;
    const k = scores[0]?.length ?? 0;
    if (b === 0 || k === 0) {
        return [];
    }
    const q = scores.map((row) => {
        const max = Math.max(...row);
        return row.map((v) => Math.exp(v - max));
    });
    const columnTarget = b / k;
    for (let it = 0; it < iters; it += 1) {
        for (let i = 0; i < b; i += 1) {
            const row = q[i] ?? [];
            const sum = row.reduce((s, v) => s + v, 0) || 1;
            for (let j = 0; j < k; j += 1) {
                q[i]![j] = (q[i]![j] ?? 0) / sum;
            }
        }
        for (let j = 0; j < k; j += 1) {
            let colSum = 0;
            for (let i = 0; i < b; i += 1) {
                colSum += q[i]?.[j] ?? 0;
            }
            const scale = columnTarget / (colSum || 1);
            for (let i = 0; i < b; i += 1) {
                q[i]![j] = (q[i]![j] ?? 0) * scale;
            }
        }
    }
    return q;
}

function logSoftmax(row: number[]): number[] {
    const max = Math.max(...row);
    const denom = row.reduce((s, v) => s + Math.exp(v - max), 0);
    return row.map((v) => v - max - Math.log(denom));
}

function makeCells(q: number[][], highlightRow: number, done: boolean): VisualEntity[] {
    const cells: VisualEntity[] = [];
    for (let i = 0; i < q.length; i += 1) {
        const row = q[i] ?? [];
        for (let j = 0; j < row.length; j += 1) {
            const value = row[j] ?? 0;
            cells.push({
                id: `cell-${i}-${j}`,
                type: "cell" as const,
                label: value.toFixed(3),
                value,
                state: done ? "sorted" : i === highlightRow ? "active" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, assignment: value },
            });
        }
    }
    return cells;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SwavInput | null) ?? {};
    const view1 = task.view1 ?? [
        [1, 0],
        [0, 1],
        [-1, 0],
    ];
    const view2 = task.view2 ?? [
        [0.9, 0.1],
        [0.1, 0.9],
        [-0.9, 0.1],
    ];
    const prototypes = task.prototypes ?? [
        [1, 0],
        [0, 1],
        [-1, 0],
    ];
    const tau = typeof task.temperature === "number" && task.temperature > 0 ? task.temperature : 0.1;
    const iters = typeof task.sinkhornIters === "number" ? Math.max(1, task.sinkhornIters) : 5;

    const b = Math.min(view1.length, view2.length);
    const k = prototypes.length;
    const scores1 = logits(view1.slice(0, b), prototypes, tau);
    const scores2 = logits(view2.slice(0, b), prototypes, tau);
    const q1 = sinkhorn(scores1, iters);
    const q2 = sinkhorn(scores2, iters);
    const ls1 = scores1.map(logSoftmax);
    const ls2 = scores2.map(logSoftmax);

    const sampleLosses: number[] = [];
    for (let i = 0; i < b; i += 1) {
        let total = 0;
        for (let j = 0; j < k; j += 1) {
            total += (q1[i]?.[j] ?? 0) * (ls2[i]?.[j] ?? 0);
            total += (q2[i]?.[j] ?? 0) * (ls1[i]?.[j] ?? 0);
        }
        sampleLosses.push(-0.5 * total);
    }
    const loss = sampleLosses.reduce((a, v) => a + v, 0) / Math.max(1, b);

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(q1, -1, false),
        edges: [],
        description: `SwAV with ${b} views and ${k} prototypes normalized by ${iters} Sinkhorn iterations.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, rows: b, cols: k, temperature: tau, sinkhornIters: iters, loss: 0 },
    };
    step += 1;

    for (let i = 0; i < b; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(q1, i, false),
            edges: [],
            description: `Sample ${i}: softly assigned across ${k} prototypes with row sum held at one and columns at ${(b / k).toFixed(2)}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                step,
                rows: b,
                cols: k,
                sample: i,
                assignments: (q1[i] ?? []).slice(),
                loss: sampleLosses[i] ?? 0,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(q2, -1, true),
        edges: [],
        description: `Done: mean swapped-prediction loss ${loss.toFixed(6)} over ${b} samples.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            step,
            rows: b,
            cols: k,
            loss,
            sampleLosses,
            assignments: q1.flat(),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "SwAV replaces pairwise comparison with online clustering. A set of prototype vectors acts like cluster centers, and every image view is softly assigned to them with Sinkhorn normalization so no cluster hogs the batch. The learning signal is swapped: view one must predict the cluster assignment of view two and vice versa, which forces the two augmentations to carry the same high-level content.",
        invariants: [
            "Each Sinkhorn row sums to one, making a view's assignments a distribution.",
            "Each Sinkhorn column sums to the batch size divided by the prototype count, spreading usage evenly.",
            "The loss averages the two swapped cross-entropy directions.",
        ],
        correctness:
            "Sinkhorn alternates row and column scaling, which converges to a matrix with the prescribed marginals, so assignments are a valid soft distribution with balanced cluster usage. The swapped loss is the cross entropy of one view's assignment against the other view's log-softmax scores; summing both directions and dividing by two gives the symmetric objective. The test verifies the marginals and recomputes the loss independently.",
        complexityRationale:
            "Building the scores costs O(B K d), Sinkhorn costs O(I B K), and the swapped loss costs O(B K), giving the stated combined bound with O(B K) storage for the assignments.",
        uses: [
            "Self-supervised pretraining with online clustering",
            "Large-scale visual representation learning without negatives",
            "Unsupervised discovery of image categories",
        ],
        references: [
            "Caron et al., Unsupervised Learning of Visual Features by Contrasting Cluster Assignments, 2020",
            "Cuturi, Sinkhorn Distances: Lightspeed Computation of Optimal Transport, 2013",
        ],
        workedExample:
            "With three samples and three prototypes, Sinkhorn drives each column sum to one. If view one is assigned mostly to prototype zero, its log-softmax score for prototype zero on the other view is compared against that assignment, so matching augmentations are rewarded.",
    },
    id: "swav",
    name: "Swapped Assignment Clustering",
    category: "ml-ai",
    complexity: { time: "O(I * B * K + B * K * d)", space: "O(B * K)" },
    defaultInput: {
        view1: [
            [1, 0],
            [0, 1],
            [-1, 0],
        ],
        view2: [
            [0.9, 0.1],
            [0.1, 0.9],
            [-0.9, 0.1],
        ],
        prototypes: [
            [1, 0],
            [0, 1],
            [-1, 0],
        ],
        temperature: 0.1,
        sinkhornIters: 5,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize prototypes and take two views of each image",
        "compute view-to-prototype scores divided by temperature",
        "apply Sinkhorn iterations to obtain balanced soft assignments",
        "build log-softmax scores for each view over the prototypes",
        "score each assignment against the other view's distribution",
        "average the two swapped directions into the loss",
        "record the assignment matrix and per-sample losses",
        "done: report the mean swapped-prediction loss",
    ],
};

export default module;
