/**
 * detr.ts - DETR Set Prediction with Bipartite Matching
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * DETR treats object detection as a set-prediction problem. A fixed set of
 * predictions is matched one-to-one with the ground-truth objects using the
 * Hungarian assignment of a cost that combines class probability, box L1
 * distance, and generalized IoU. Predictions with no object are matched to a
 * "no object" slot. The matched pairs then define the training loss.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n! * n) for n predictions with exhaustive assignment on small n
 *   Space: O(n^2) for the cost matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells show the prediction-versus-slot matching cost matrix.
 *   - The cost row of the prediction under consideration is highlighted.
 *   - The final frame marks the chosen one-to-one assignment.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Box = [number, number, number, number]; // center x, center y, width, height

interface Prediction {
    logits: number[]; // last entry is the "no object" class
    box: Box;
}
interface Target {
    cls: number;
    box: Box;
}
interface DetrInput {
    predictions?: Prediction[];
    targets?: Target[];
    lambdaL1?: number;
    lambdaGiou?: number;
}

function softmax(logits: number[]): number[] {
    const max = Math.max(...logits);
    const exp = logits.map((v) => Math.exp(v - max));
    const total = exp.reduce((a, b) => a + b, 0) || 1;
    return exp.map((v) => v / total);
}

function boxL1(a: Box, b: Box): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs(a[3] - b[3]);
}

/** Generalized IoU for axis-aligned boxes stored as center, center, width, height. */
function giou(a: Box, b: Box): number {
    const ax1 = a[0] - a[2] / 2;
    const ax2 = a[0] + a[2] / 2;
    const ay1 = a[1] - a[3] / 2;
    const ay2 = a[1] + a[3] / 2;
    const bx1 = b[0] - b[2] / 2;
    const bx2 = b[0] + b[2] / 2;
    const by1 = b[1] - b[3] / 2;
    const by2 = b[1] + b[3] / 2;
    const interW = Math.max(0, Math.min(ax2, bx2) - Math.max(ax1, bx1));
    const interH = Math.max(0, Math.min(ay2, by2) - Math.max(ay1, by1));
    const inter = interW * interH;
    const areaA = Math.max(0, a[2]) * Math.max(0, a[3]);
    const areaB = Math.max(0, b[2]) * Math.max(0, b[3]);
    const union = areaA + areaB - inter;
    const iou = union > 0 ? inter / union : 0;
    const ex1 = Math.min(ax1, bx1);
    const ex2 = Math.max(ax2, bx2);
    const ey1 = Math.min(ay1, by1);
    const ey2 = Math.max(ay2, by2);
    const enclosing = Math.max(0, ex2 - ex1) * Math.max(0, ey2 - ey1);
    return enclosing > 0 ? iou - (enclosing - union) / enclosing : iou;
}

function permutations(n: number): number[][] {
    const result: number[][] = [];
    const used = new Array<boolean>(n).fill(false);
    const current: number[] = [];
    const build = (): void => {
        if (current.length === n) {
            result.push([...current]);
            return;
        }
        for (let j = 0; j < n; j += 1) {
            if (used[j]) {
                continue;
            }
            used[j] = true;
            current.push(j);
            build();
            current.pop();
            used[j] = false;
        }
    };
    build();
    return result;
}

function makeCells(cost: number[][], highlight: number, assignment: number[] | null): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let i = 0; i < cost.length; i += 1) {
        for (let j = 0; j < (cost[i] ?? []).length; j += 1) {
            const value = cost[i]?.[j] ?? 0;
            const chosen = assignment !== null && assignment[i] === j;
            const state: EntityState = chosen
                ? "sorted"
                : i === highlight
                  ? "active"
                  : "idle";
            entities.push({
                id: `cell-${i}-${j}`,
                type: "cell",
                label: value.toFixed(3),
                value,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: i, col: j, chosen },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as DetrInput | null) ?? {};
    const predictions: Prediction[] = (task.predictions ?? [
        { logits: [3, 0.2, 0.1], box: [1, 1, 0.4, 0.4] },
        { logits: [0.1, 3.5, 0.2], box: [4, 4, 0.5, 0.5] },
        { logits: [0.2, 0.1, 4], box: [2, 5, 0.3, 0.3] },
    ]).map((p) => ({ logits: [...p.logits], box: [...p.box] as Box }));
    const n = Math.min(predictions.length, 7);
    const preds = predictions.slice(0, n);
    const targets: Target[] = (task.targets ?? [
        { cls: 0, box: [1, 1, 0.4, 0.4] },
        { cls: 1, box: [4, 4, 0.5, 0.5] },
    ]).slice(0, n);
    const m = targets.length;
    const lambdaL1 = typeof task.lambdaL1 === "number" ? task.lambdaL1 : 5;
    const lambdaGiou = typeof task.lambdaGiou === "number" ? task.lambdaGiou : 2;

    const probs = preds.map((p) => softmax(p.logits));
    const noObj = preds[0] ? Math.max(0, preds[0].logits.length - 1) : 0;
    const cost: number[][] = preds.map((p, i) => {
        const row: number[] = [];
        for (let j = 0; j < n; j += 1) {
            if (j < m) {
                const target = targets[j] ?? { cls: 0, box: [0, 0, 1, 1] as Box };
                const cls = Math.min(noObj - 1, Math.max(0, target.cls));
                row.push(
                    -(probs[i]?.[cls] ?? 0)
                        + lambdaL1 * boxL1(p.box, target.box)
                        + lambdaGiou * (1 - giou(p.box, target.box)),
                );
            } else {
                row.push(-(probs[i]?.[noObj] ?? 0));
            }
        }
        return row;
    });

    let best = permutations(n)[0] ?? [];
    let bestCost = Infinity;
    for (const perm of permutations(n)) {
        let total = 0;
        for (let i = 0; i < n; i += 1) {
            total += cost[i]?.[perm[i] ?? 0] ?? 0;
        }
        if (total < bestCost) {
            bestCost = total;
            best = perm;
        }
    }

    const flatCost = cost.reduce<number[]>((acc, row) => acc.concat(row), []);
    const commonMeta = { n, m, lambdaL1, lambdaGiou, cost: flatCost };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeCells(cost, -1, null),
        edges: [],
        description: `Build a ${n} by ${n} matching cost from class score, box L1, and generalized IoU.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...commonMeta, rows: n, cols: n, phase: "cost" },
    };
    step += 1;

    for (let i = 0; i < n; i += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(cost, i, null),
            edges: [],
            description: `Prediction ${i}: cost across ${m} object slots and ${n - m} no-object slots; the cheapest slot is ${(cost[i] ?? []).indexOf(Math.min(...(cost[i] ?? [0])))}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { ...commonMeta, rows: n, cols: n, phase: "scan", prediction: i },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeCells(cost, -1, best),
        edges: [],
        description: `Optimal one-to-one assignment found with total matching cost ${bestCost.toFixed(4)}.`,
        codeLineNumber: 3,
        layout: "grid",
        meta: { ...commonMeta, rows: n, cols: n, phase: "assign", assignment: [...best], matchingCost: bestCost },
    };
    step += 1;

    let clsLoss = 0;
    let l1Loss = 0;
    let giouLoss = 0;
    for (let i = 0; i < n; i += 1) {
        const slot = best[i] ?? 0;
        if (slot < m) {
            const target = targets[slot] ?? { cls: 0, box: [0, 0, 1, 1] as Box };
            const cls = Math.min(noObj - 1, Math.max(0, target.cls));
            clsLoss += -Math.log((probs[i]?.[cls] ?? 0) + 1e-12);
            l1Loss += lambdaL1 * boxL1(preds[i]?.box ?? [0, 0, 1, 1], target.box);
            giouLoss += lambdaGiou * (1 - giou(preds[i]?.box ?? [0, 0, 1, 1], target.box));
        } else {
            clsLoss += -Math.log((probs[i]?.[noObj] ?? 0) + 1e-12);
        }
    }
    const totalLoss = clsLoss + l1Loss + giouLoss;

    yield {
        stepNumber: step,
        entities: makeCells(cost, -1, best),
        edges: [],
        description: `Done: total set-prediction loss ${totalLoss.toFixed(4)} = class ${clsLoss.toFixed(4)} plus box L1 ${l1Loss.toFixed(4)} plus box IoU ${giouLoss.toFixed(4)}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            ...commonMeta,
            rows: n,
            cols: n,
            phase: "done",
            assignment: [...best],
            matchingCost: bestCost,
            clsLoss,
            l1Loss,
            giouLoss,
            totalLoss,
            components: [clsLoss, l1Loss, giouLoss, totalLoss],
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An image can contain any number of objects, but a detector must still produce a fixed output. DETR sidesteps hand-tuned anchors and non-maximum suppression by treating detection as set prediction: a fixed set of learned queries each proposes one object, and a one-to-one matching assigns each ground-truth box to exactly one proposal. Everything else is trained to predict no object.",
        invariants: [
            "Every ground-truth object is matched to exactly one prediction and vice versa.",
            "The matching cost rewards correct classes, small box L1 distance, and high generalized IoU.",
            "Predictions matched past the number of objects are trained on the no-object class.",
        ],
        correctness:
            "The assignment minimizes the sum of the matching costs over all one-to-one matchings, so it is the Hungarian optimum; for small sets the generator checks every permutation. Once the matching is fixed, the loss is a sum of standard cross-entropy on the matched class and L1 plus generalized IoU regression on matched boxes. The test recomputes the cost matrix and optimum independently, verifies the loss terms, and confirms the total loss is invariant to permuting the prediction order.",
        complexityRationale:
            "Building the cost matrix touches every prediction-slot pair, O(n squared). The exhaustive assignment tries n factorial permutations, each O(n), which is fine for the tiny teaching inputs; a real deployment uses the Hungarian algorithm in O(n cubed). Only the cost matrix is stored, O(n squared) space.",
        uses: [
            "End-to-end object detection without anchors or non-maximum suppression",
            "Set prediction tasks such as instance segmentation and keypoint detection",
            "Any problem needing a canonical one-to-one assignment of outputs to targets",
        ],
        references: [
            "Carion et al., End-to-End Object Detection with Transformers, ECCV 2020",
            "Kuhn, The Hungarian Method for the Assignment Problem, 1955",
        ],
        workedExample:
            "With two predictions and two objects, prediction zero sits on the class-zero box and prediction one on the class-one box. Their diagonal costs are near negative one from the class term plus almost zero box error, while off-diagonal costs are large, so the optimum matches each prediction to its nearby object and the set loss is small.",
    },
    id: "detr",
    name: "DETR Set Prediction",
    category: "ml-ai",
    complexity: { time: "O(n! * n)", space: "O(n^2)" },
    defaultInput: {
        predictions: [
            { logits: [3, 0.2, 0.1], box: [1, 1, 0.4, 0.4] },
            { logits: [0.1, 3.5, 0.2], box: [4, 4, 0.5, 0.5] },
            { logits: [0.2, 0.1, 4], box: [2, 5, 0.3, 0.3] },
        ],
        targets: [
            { cls: 0, box: [1, 1, 0.4, 0.4] },
            { cls: 1, box: [4, 4, 0.5, 0.5] },
        ],
        lambdaL1: 5,
        lambdaGiou: 2,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "read predicted boxes with class logits and ground-truth boxes",
        "compute softmax class probabilities for every prediction",
        "build a matching cost from class score, box L1 distance, and generalized IoU",
        "find the minimum-cost one-to-one assignment by bipartite matching",
        "for each matched prediction choose the classification target",
        "add box regression loss for predictions matched to a real object",
        "sum the classification and box terms into the total set-prediction loss",
        "done: report the optimal assignment and total loss",
    ],
};

export default module;
