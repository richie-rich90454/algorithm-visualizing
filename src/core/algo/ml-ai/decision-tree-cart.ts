/**
 * decision-tree-cart.ts - Classification and Regression Trees (CART)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * CART grows a binary tree by repeatedly choosing the feature and threshold
 * that reduce Gini impurity the most. For each numeric feature it considers
 * every midpoint between consecutive distinct values as a candidate split.
 * Recursion stops when a node is pure, a depth limit is hit, or no split
 * improves impurity.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(depth * features * n log n) per level of splitting
 *   Space: O(nodes) for the tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes show the split condition or the majority class of a leaf.
 *   - Edges connect a parent split to its left and right children.
 *   - One node is revealed per frame, in creation order.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface TreeNode {
    parent: number;
    depth: number;
    indices: number[];
    ones: number;
    count: number;
    gini: number;
    weightedGini: number;
    feature: number;
    threshold: number;
    prediction: number;
    isLeaf: boolean;
    left: number;
    right: number;
}

/** Gini impurity of a binary node with `ones` positive examples out of `count`. */
function giniOf(ones: number, count: number): number {
    if (count === 0) {
        return 0;
    }
    const p = ones / count;
    return 1 - p * p - (1 - p) * (1 - p);
}

/** Find the split with the lowest weighted Gini; returns null when none helps. */
function bestSplit(points: Point[], labels: number[], indices: number[], currentGini: number) {
    let best: { feature: number; threshold: number; weighted: number; left: number[]; right: number[] } | null = null;
    const n = indices.length;
    for (let feature = 0; feature < 2; feature += 1) {
        const values = indices
            .map((index) => (points[index] ?? [0, 0])[feature])
            .slice()
            .sort((a, b) => a - b);
        for (let i = 0; i + 1 < values.length; i += 1) {
            const a = values[i] ?? 0;
            const b = values[i + 1] ?? 0;
            if (a === b) {
                continue;
            }
            const threshold = (a + b) / 2;
            let leftOnes = 0;
            let rightOnes = 0;
            for (const index of indices) {
                const point = points[index] ?? [0, 0];
                const label = labels[index] ?? 0;
                if (point[feature] <= threshold) {
                    leftOnes += label;
                } else {
                    rightOnes += label;
                }
            }
            const nLeft = indices.filter((index) => (points[index] ?? [0, 0])[feature] <= threshold).length;
            const nRight = n - nLeft;
            if (nLeft === 0 || nRight === 0) {
                continue;
            }
            const weighted = (nLeft / n) * giniOf(leftOnes, nLeft) + (nRight / n) * giniOf(rightOnes, nRight);
            if (weighted < currentGini - 1e-12 && (best === null || weighted < best.weighted - 1e-12)) {
                const left: number[] = [];
                const right: number[] = [];
                for (const index of indices) {
                    const point = points[index] ?? [0, 0];
                    if (point[feature] <= threshold) {
                        left.push(index);
                    } else {
                        right.push(index);
                    }
                }
                best = { feature, threshold, weighted, left, right };
            }
        }
    }
    return best;
}

/** Convert a node into a drawable tree entity. */
function toEntity(node: TreeNode, id: number, revealed: boolean): VisualEntity {
    const label = node.isLeaf
        ? `class ${node.prediction}`
        : `x${node.feature} <= ${node.threshold.toFixed(2)}`;
    const state: EntityState = revealed ? "comparing" : node.isLeaf ? "sorted" : "visited";
    return {
        id: `node-${id}`,
        type: "node",
        label,
        value: node.gini,
        state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: {
            depth: node.depth,
            parentId: node.parent >= 0 ? `node-${node.parent}` : "",
            feature: node.feature,
            threshold: node.threshold,
            gini: node.gini,
            weightedGini: node.weightedGini,
            prediction: node.prediction,
            count: node.count,
            ones: node.ones,
            isLeaf: node.isLeaf,
            left: node.left,
            right: node.right,
        },
    };
}

/** Build edges for all revealed nodes. */
function toEdges(nodes: TreeNode[], revealed: number): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (let i = 1; i < revealed; i += 1) {
        const node = nodes[i];
        if (!node) {
            continue;
        }
        edges.push({
            id: `edge-${node.parent}-${i}`,
            sourceId: `node-${node.parent}`,
            targetId: `node-${i}`,
            label: "",
            state: "visited",
            directed: true,
        });
    }
    return edges;
}

/** The CART generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; labels?: number[]; maxDepth?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
        [2, 1],
        [2, 2],
    ];
    const labels: number[] = task.labels ?? [0, 0, 0, 1, 1, 1];
    const maxDepth = typeof task.maxDepth === "number" ? Math.max(1, task.maxDepth) : 4;
    const allIndices = points.map((_point, index) => index);
    const nodes: TreeNode[] = [];

    // Build the tree breadth-first so each revealed node already has its parent.
    const queue: Array<{ id: number; parent: number; depth: number; indices: number[] }> = [];
    let nextId = 0;
    const enqueue = (parent: number, depth: number, indices: number[]): number => {
        const id = nextId;
        nextId += 1;
        queue.push({ id, parent, depth, indices });
        return id;
    };
    enqueue(-1, 0, allIndices);
    while (queue.length > 0) {
        const job = queue.shift();
        if (!job) {
            break;
        }
        let ones = 0;
        for (const index of job.indices) {
            ones += labels[index] ?? 0;
        }
        const count = job.indices.length;
        const prediction = ones * 2 >= count ? 1 : 0;
        const nodeGini = giniOf(ones, count);
        const split = bestSplit(points, labels, job.indices, nodeGini);
        const canSplit = job.depth < maxDepth && split !== null && nodeGini > 1e-12;

        const node: TreeNode = {
            parent: job.parent,
            depth: job.depth,
            indices: job.indices,
            ones,
            count,
            gini: nodeGini,
            weightedGini: split ? split.weighted : nodeGini,
            feature: split ? split.feature : -1,
            threshold: split ? split.threshold : 0,
            prediction,
            isLeaf: !canSplit,
            left: -1,
            right: -1,
        };
        nodes[job.id] = node;

        if (canSplit && split) {
            node.left = enqueue(job.id, job.depth + 1, split.left);
            node.right = enqueue(job.id, job.depth + 1, split.right);
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: [],
        edges: [],
        description: `Growing a CART tree on ${points.length} points, maximum depth ${maxDepth}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { nodes: 0, maxDepth, totalNodes: nodes.length },
    };
    step += 1;

    for (let revealed = 1; revealed <= nodes.length; revealed += 1) {
        const node = nodes[revealed - 1];
        if (!node) {
            continue;
        }
        yield {
            stepNumber: step,
            entities: nodes.slice(0, revealed).map((current, index) => toEntity(current, index, index === revealed - 1)),
            edges: toEdges(nodes, revealed),
            description: node.isLeaf
                ? `Node ${revealed - 1} is a leaf: predict class ${node.prediction} (Gini ${node.gini.toFixed(3)}).`
                : `Node ${revealed - 1} splits on x${node.feature} <= ${node.threshold.toFixed(2)}; weighted Gini ${node.weightedGini.toFixed(3)}.`,
            codeLineNumber: node.isLeaf ? 4 : 7,
            layout: "tree",
            meta: {
                nodes: revealed,
                totalNodes: nodes.length,
                maxDepth,
                currentGini: node.gini,
                currentPrediction: node.prediction,
                currentFeature: node.feature,
                currentThreshold: node.threshold,
                currentIsLeaf: node.isLeaf,
            },
        };
        step += 1;
    }

    let correct = 0;
    for (let i = 0; i < points.length; i += 1) {
        const point = points[i] ?? [0, 0];
        let cursor = 0;
        while (true) {
            const node = nodes[cursor];
            if (!node || node.isLeaf) {
                break;
            }
            cursor = (point[node.feature] ?? 0) <= node.threshold ? node.left : node.right;
            if (cursor < 0) {
                break;
            }
        }
        if ((nodes[cursor]?.prediction ?? -1) === (labels[i] ?? 0)) {
            correct += 1;
        }
    }

    yield {
        stepNumber: step,
        entities: nodes.map((node, index) => toEntity(node, index, false)),
        edges: toEdges(nodes, nodes.length),
        description: `Done: ${nodes.length} nodes, training accuracy ${points.length > 0 ? ((correct / points.length) * 100).toFixed(0) : 0}%.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: {
            nodes: nodes.length,
            totalNodes: nodes.length,
            maxDepth,
            accuracy: points.length > 0 ? correct / points.length : 0,
            leaves: nodes.filter((node) => node.isLeaf).length,
        },
    };
}

/** The CART module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Ask a sequence of yes-or-no questions about the features, each one chosen to make the resulting groups as pure as possible. A pure group contains only one class, so it becomes a leaf that predicts that class. The questions form a binary tree you can follow to classify any new point.",
        invariants: [
            "Gini impurity is 1 minus the squared class proportions and is zero for a pure node.",
            "A node's split is the candidate with the smallest weighted Gini impurity.",
            "The left child holds examples at or below the threshold; the right child holds the rest.",
        ],
        correctness:
            "At each node the algorithm evaluates every midpoint threshold on every feature and keeps the split that most reduces weighted impurity, so no locally better split is missed. Recursion stops only at pure nodes, the depth limit, or when no split helps; therefore each leaf is either pure or a forced majority vote, and following the recorded tests reproduces the fitted classifier exactly.",
        complexityRationale:
            "At each level of the tree, sorting each feature's values costs O(n log n) and scanning candidate thresholds costs O(n) each, so total time is O(depth * features * n log n). The tree stores one node per split, giving O(nodes) space.",
        uses: [
            "Tabular classification such as loan approval and churn prediction",
            "Interpretable models where the decision path can be shown to a user",
            "The base learner inside random forests and gradient boosting",
        ],
        references: [
            "Breiman, Friedman, Olshen, and Stone, Classification and Regression Trees, 1984",
            "Hastie, Tibshirani, and Friedman, The Elements of Statistical Learning, Chapter 9",
        ],
        workedExample:
            "On six points with class 1 in the upper right, the root considers midpoints on x0 and x1 and finds that x0 <= 1.5 gives the lowest weighted Gini. The left group is still mixed, so a second split on x1 <= 0.5 isolates the remaining class 0 point, leaving pure leaves.",
    },
    id: "decision-tree-cart",
    name: "Decision Tree (CART)",
    category: "ml-ai",
    complexity: { time: "O(depth * d * n log n)", space: "O(nodes)" },
    defaultInput: {
        points: [
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
            [2, 1],
            [2, 2],
        ],
        labels: [0, 0, 0, 1, 1, 1],
        maxDepth: 4,
    },
    visualType: "tree",
    run,
    pseudocode: [
        "create the root node with all training examples",
        "compute the node Gini impurity from its class counts",
        "for each feature and each midpoint threshold",
        "partition examples and compute the weighted child Gini",
        "keep the split with the smallest weighted Gini",
        "if pure, out of depth, or no gain, make a leaf",
        "otherwise recurse on the left and right partitions",
        "done: report the tree and its training accuracy",
    ],
};

export default module;
