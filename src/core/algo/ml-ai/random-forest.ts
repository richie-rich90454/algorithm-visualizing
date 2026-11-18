/**
 * random-forest.ts - Toy Random Forest (Bagged Classification Trees)
 *
 * Builds several small CART-style trees on bootstrap samples of a one-
 * dimensional labeled data set and classifies by majority vote. Feature
 * subsampling is meaningless with one feature, so randomness comes from the
 * bootstrap; the seeded generator makes every tree reproducible.
 *
 * Time:  O(trees * depth * n log n)  Space: O(trees * nodes + n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface RFInput {
    xs?: number[];
    labels?: number[];
    numTrees?: number;
    maxDepth?: number;
    seed?: number;
    sampleRatio?: number;
}

interface TreeNode {
    threshold?: number;
    left?: TreeNode;
    right?: TreeNode;
    label?: number;
}

/** Linear congruential generator: returns the advanced state and a unit draw. */
function nextRandom(state: number): [number, number] {
    const s = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return [s, s / 4294967296];
}

/** Majority label of a set of indices; ties resolve to zero. */
function majority(labels: number[], indices: number[]): number {
    let ones = 0;
    for (const i of indices) {
        if (labels[i] === 1) {
            ones += 1;
        }
    }
    return ones * 2 > indices.length ? 1 : 0;
}

/** Impurity of a two-class node. */
function gini(labels: number[], indices: number[]): number {
    if (indices.length === 0) {
        return 0;
    }
    let ones = 0;
    for (const i of indices) {
        if (labels[i] === 1) {
            ones += 1;
        }
    }
    const p = ones / indices.length;
    return 1 - p * p - (1 - p) * (1 - p);
}

/** Grow one depth-limited CART tree on the supplied example indices. */
function buildTree(xs: number[], labels: number[], indices: number[], depth: number, maxDepth: number): TreeNode {
    const leaf = (): TreeNode => ({ label: majority(labels, indices) });
    if (indices.length <= 1 || depth >= maxDepth || gini(labels, indices) === 0) {
        return leaf();
    }
    const values = [...new Set(indices.map((i) => xs[i] ?? 0))].sort((a, b) => a - b);
    if (values.length < 2) {
        return leaf();
    }
    let bestThreshold = values[0] ?? 0;
    let bestScore = Infinity;
    for (let k = 0; k < values.length - 1; k += 1) {
        const threshold = ((values[k] ?? 0) + (values[k + 1] ?? 0)) / 2;
        const left: number[] = [];
        const right: number[] = [];
        for (const i of indices) {
            if ((xs[i] ?? 0) <= threshold) {
                left.push(i);
            } else {
                right.push(i);
            }
        }
        const score =
            (left.length / indices.length) * gini(labels, left) +
            (right.length / indices.length) * gini(labels, right);
        if (score < bestScore) {
            bestScore = score;
            bestThreshold = threshold;
        }
    }
    const leftIndices: number[] = [];
    const rightIndices: number[] = [];
    for (const i of indices) {
        if ((xs[i] ?? 0) <= bestThreshold) {
            leftIndices.push(i);
        } else {
            rightIndices.push(i);
        }
    }
    return {
        threshold: bestThreshold,
        left: buildTree(xs, labels, leftIndices, depth + 1, maxDepth),
        right: buildTree(xs, labels, rightIndices, depth + 1, maxDepth),
    };
}

/** Follow a tree's split tests down to a leaf and return its class. */
function predictTree(tree: TreeNode, x: number): number {
    let node = tree;
    while (node.threshold !== undefined && node.left && node.right) {
        node = x <= node.threshold ? node.left : node.right;
    }
    return node.label ?? 0;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as RFInput | null) ?? {};
    const xs = Array.isArray(task.xs) ? [...task.xs] : [0, 1, 2, 3, 4, 5, 6, 7];
    const labels = Array.isArray(task.labels) ? [...task.labels] : [0, 0, 0, 1, 1, 1, 1, 1];
    const n = Math.min(xs.length, labels.length);
    const numTrees = Math.max(1, typeof task.numTrees === "number" ? Math.trunc(task.numTrees) : 3);
    const maxDepth = Math.max(1, typeof task.maxDepth === "number" ? Math.trunc(task.maxDepth) : 2);
    const sampleRatio =
        typeof task.sampleRatio === "number" && task.sampleRatio > 0
            ? Math.min(1, task.sampleRatio)
            : 1;
    let state = (typeof task.seed === "number" ? Math.trunc(task.seed) : 7) >>> 0;
    const drawSize = Math.max(1, Math.round(n * sampleRatio));

    const bootstraps: number[][] = [];
    const trees: TreeNode[] = [];
    for (let t = 0; t < numTrees; t += 1) {
        const sample: number[] = [];
        for (let k = 0; k < drawSize; k += 1) {
            const [next, u] = nextRandom(state);
            state = next;
            sample.push(Math.floor(u * n));
        }
        bootstraps.push(sample);
        trees.push(buildTree(xs, labels, sample, 0, maxDepth));
    }

    const votes: number[][] = trees.map((tree) => xs.slice(0, n).map((x) => predictTree(tree, x)));
    const predictions = xs.slice(0, n).map((_x, i) => {
        let ones = 0;
        for (let t = 0; t < numTrees; t += 1) {
            if (votes[t]?.[i] === 1) {
                ones += 1;
            }
        }
        return ones * 2 > numTrees ? 1 : 0;
    });

    const cols = numTrees + 1;
    const makeEntities = (revealed: number, showFinal: boolean): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        for (let i = 0; i < n; i += 1) {
            for (let c = 0; c < cols; c += 1) {
                let label = "?";
                let stateValue: EntityState = "idle";
                if (c < revealed) {
                    const vote = votes[c]?.[i] ?? 0;
                    label = String(vote);
                    stateValue = vote === labels[i] ? "sorted" : "swapped";
                } else if (c === numTrees && showFinal) {
                    label = String(predictions[i] ?? 0);
                    stateValue = "path";
                }
                entities.push({
                    id: `cell-${i}-${c}`,
                    type: "cell",
                    label,
                    value: label === "?" ? -1 : Number(label),
                    state: stateValue,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: i, col: c },
                });
            }
        }
        return entities;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(0, false),
        edges: [],
        description: `Building ${numTrees} trees of depth at most ${maxDepth} from bootstrap samples of ${n} points.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: {
            rows: n,
            cols,
            numTrees,
            bootstraps: JSON.stringify(bootstraps),
            predictions,
        },
    };
    step += 1;

    for (let t = 0; t < numTrees; t += 1) {
        yield {
            stepNumber: step,
            entities: makeEntities(t + 1, false),
            edges: [],
            description: `Tree ${t + 1} votes ${votes[t]?.join("") ?? ""} on the ${n} training points.`,
            codeLineNumber: 4,
            layout: "grid",
            meta: {
                rows: n,
                cols,
                numTrees,
                treesBuilt: t + 1,
                bootstraps: JSON.stringify(bootstraps),
                votes: votes.slice(0, t + 1).flat(),
                predictions,
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(numTrees, true),
        edges: [],
        description: `Majority vote of ${numTrees} trees gives predictions ${predictions.join("")}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            rows: n,
            cols,
            numTrees,
            treesBuilt: numTrees,
            bootstraps: JSON.stringify(bootstraps),
            votes: votes.flat(),
            predictions,
            accuracy: predictions.filter((p, i) => p === labels[i]).length / n,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A single decision tree can be unstable: a small change in the data produces a very different tree. A random forest grows many trees on slightly different bootstrap samples and lets them vote. Averaging many noisy but roughly unbiased trees reduces variance while keeping bias low.",
        invariants: [
            "Every tree is trained on a bootstrap sample drawn with the same seeded generator.",
            "Each split uses the threshold with the lowest weighted Gini impurity among midpoints.",
            "A point's forest prediction is the majority class among all tree votes.",
        ],
        correctness:
            "Each tree is a deterministic function of its bootstrap sample because the best split is chosen by an explicit impurity scan. The forest prediction is defined as the majority vote of those functions, and the visualization reports exactly that vote, so replaying the same seed reconstructs the same ensemble and the same classifications.",
        complexityRationale:
            "Growing one tree scans sorted thresholds at each of at most maxDepth levels, costing O(n log n) per level; with T trees the total is O(T * maxDepth * n log n). Storing T trees plus the vote grid uses O(T * nodes + n) space.",
        uses: [
            "Tabular classification in finance and medicine",
            "Feature importance estimation",
            "A robust baseline before trying boosting or deep models",
        ],
        references: [
            "Breiman, Random Forests, Machine Learning, 2001",
            "Breiman et al., Classification and Regression Trees, 1984",
        ],
        workedExample:
            "On the points 0,1,2 labeled 0 and 3,4,5 labeled 1, a seed of 7 draws bootstrap indices that lean toward the second class. A depth-two tree splits near x=2.5, sending low values to class 0 and high values to class 1. Three such trees vote, and the majority class for each point becomes the forest prediction.",
    },
    id: "random-forest",
    name: "Random Forest (Toy)",
    category: "ml-ai",
    complexity: { time: "O(trees * depth * n log n)", space: "O(trees * nodes + n)" },
    defaultInput: {
        xs: [0, 1, 2, 3, 4, 5, 6, 7],
        labels: [0, 0, 0, 1, 1, 1, 1, 1],
        numTrees: 3,
        maxDepth: 2,
        seed: 7,
        sampleRatio: 1,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "seed a pseudo-random generator",
        "for each tree draw a bootstrap sample of the training points",
        "at a node choose the threshold with the lowest weighted Gini impurity",
        "recurse on both sides until the depth limit or a pure node",
        "predict each training point by following splits to a leaf",
        "combine all tree predictions with a majority vote",
        "done: report the forest predictions and training accuracy",
    ],
};

export default module;
