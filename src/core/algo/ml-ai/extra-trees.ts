/**
 * extra-trees.ts - Extremely Randomized Trees (Single Tree Demo)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Extra-Trees build decision trees with random split thresholds instead of
 * searching for the best threshold at every node. The extra randomness lowers
 * variance and, when many trees are averaged, often beats ordinary random
 * forests. This demo builds one regression tree whose split thresholds are
 * supplied in breadth-first order, then predicts a few queries exactly.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(d * 2^h) for max depth h over data of dimension d
 *   Space: O(2^h) for the tree nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A tree layout shows each split node labeled with its threshold and each
 *     leaf labeled with the mean of the labels that reached it.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame, VisualEdge } from "@/types";

interface Input {
    xs?: number[];
    ys?: number[];
    thresholds?: number[];
    maxDepth?: number;
    minSize?: number;
    queries?: number[];
}

interface TreeNode {
    id: string;
    parentId: string | null;
    depth: number;
    indices: number[];
    threshold: number | null;
    prediction: number;
    isLeaf: boolean;
}

function mean(values: number[]): number {
    return values.length === 0 ? 0 : values.reduce((a, v) => a + v, 0) / values.length;
}

function buildTree(
    xs: number[],
    ys: number[],
    thresholds: number[],
    maxDepth: number,
    minSize: number,
): TreeNode[] {
    const created: TreeNode[] = [];
    const make = (parentId: string | null, indices: number[], depth: number): TreeNode => {
        const node: TreeNode = {
            id: `node-${created.length}`,
            parentId,
            depth,
            indices,
            threshold: null,
            prediction: mean(indices.map((i) => ys[i] ?? 0)),
            isLeaf: true,
        };
        created.push(node);
        return node;
    };
    const root = make(null, xs.map((_, i) => i), 0);
    const queue: TreeNode[] = [root];
    let tIndex = 0;
    while (queue.length > 0) {
        const node = queue.shift() as TreeNode;
        if (node.depth >= maxDepth || node.indices.length <= minSize) continue;
        const t = thresholds[tIndex];
        tIndex += 1;
        if (t === undefined) continue;
        const left = node.indices.filter((i) => (xs[i] ?? 0) <= t);
        const right = node.indices.filter((i) => (xs[i] ?? 0) > t);
        if (left.length === 0 || right.length === 0) continue;
        node.threshold = t;
        node.isLeaf = false;
        make(node.id, left, node.depth + 1);
        make(node.id, right, node.depth + 1);
        queue.push(created[created.length - 2] as TreeNode, created[created.length - 1] as TreeNode);
    }
    return created;
}

function predict(tree: TreeNode[], xs: number[], query: number): number {
    let node = tree[0] as TreeNode;
    while (!node.isLeaf && node.threshold !== null) {
        const left = tree.find((n) => n.parentId === node.id && (xs[(n.indices[0] ?? 0)] ?? 0) <= node.threshold!);
        const right = tree.find((n) => n.parentId === node.id && (xs[(n.indices[0] ?? 0)] ?? 0) > node.threshold!);
        const next = query <= node.threshold ? left : right;
        if (!next) break;
        node = next;
    }
    return node.prediction;
}

function treeEntities(tree: TreeNode[], upTo: number, final: boolean): VisualEntity[] {
    return tree.slice(0, upTo).map((node) => ({
        id: node.id,
        type: "node" as const,
        label: node.isLeaf
            ? `mean ${node.prediction.toFixed(2)}`
            : `x<=${node.threshold}`,
        value: node.isLeaf ? node.prediction : (node.threshold ?? 0),
        state: final ? "sorted" : node.isLeaf ? "active" : "comparing",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: {
            depth: node.depth,
            parentId: node.parentId ?? "",
            isLeaf: node.isLeaf,
            size: node.indices.length,
        },
    }));
}

function treeEdges(tree: TreeNode[], upTo: number, state: EntityState): VisualEdge[] {
    const present = new Set(tree.slice(0, upTo).map((n) => n.id));
    const edges: VisualEdge[] = [];
    for (const node of tree.slice(0, upTo)) {
        if (node.parentId && present.has(node.parentId)) {
            edges.push({
                id: `edge-${node.parentId}-${node.id}`,
                sourceId: node.parentId,
                targetId: node.id,
                label: "",
                state,
                directed: true,
            });
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Input | null) ?? {};
    const xs = (task.xs ?? [1, 2, 3, 4, 5, 6]).slice();
    const ys = (task.ys ?? [0, 0, 1, 1, 1, 0]).slice();
    const thresholds = (task.thresholds ?? [3.5, 2.5, 4.5]).slice();
    const maxDepth = typeof task.maxDepth === "number" ? task.maxDepth : 2;
    const minSize = typeof task.minSize === "number" ? task.minSize : 1;
    const queries = (task.queries ?? [2, 3.5, 5]).slice();
    const tree = buildTree(xs, ys, thresholds, maxDepth, minSize);
    const predictions = queries.map((q) => predict(tree, xs, q));
    let step = 0;

    yield {
        stepNumber: step,
        entities: treeEntities(tree, 1, false),
        edges: treeEdges(tree, 1, "idle"),
        description: `Growing an Extra-Trees regression tree on ${xs.length} points with random split thresholds.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { points: xs.length, maxDepth, minSize, nodes: tree.length },
    };
    step += 1;

    for (let upTo = 2; upTo <= tree.length; upTo += 1) {
        const node = tree[upTo - 1] as TreeNode;
        yield {
            stepNumber: step,
            entities: treeEntities(tree, upTo, false),
            edges: treeEdges(tree, upTo, "active"),
            description: node.isLeaf
                ? `Leaf ${node.id} predicts the mean ${node.prediction.toFixed(3)} of its ${node.indices.length} points.`
                : `Split node ${node.id} at the random threshold ${node.threshold}.`,
            codeLineNumber: node.isLeaf ? 3 : 2,
            layout: "tree",
            meta: { points: xs.length, nodesPlaced: upTo, thresholdsUsed: Math.min(thresholds.length, upTo) },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: treeEntities(tree, tree.length, true),
        edges: treeEdges(tree, tree.length, "sorted"),
        description: `Tree complete with ${tree.length} nodes; queries ${queries.join(", ")} predict ${predictions.map((v) => v.toFixed(2)).join(", ")}.`,
        codeLineNumber: 5,
        layout: "tree",
        meta: { points: xs.length, nodes: tree.length, queries, predictions, converged: true },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "An ordinary decision tree searches hard for the best split at each node. Extra-Trees instead pick a random threshold and use it anyway, which adds randomness but removes much of the search cost and the risk of overfitting to the training splits. Averaging many such randomized trees gives a forest with very low variance.",
        invariants: [
            "A split threshold is drawn only for nodes that have enough points and depth left.",
            "A leaf predicts the mean of exactly the labels that reached it.",
            "Every non-root node has a parent that was created before it.",
        ],
        correctness:
            "For regression, the mean of the labels in a leaf minimizes squared error over that leaf, so the leaf prediction is optimal for the examples it contains. Random thresholds do not change this: they only decide which examples land together. Because thresholds are drawn independently of the labels, the trees are decorrelated, and averaging their predictions reduces variance without increasing bias, which is the same guarantee that underlies random forests.",
        complexityRationale:
            "A tree of maximum depth h has at most two to the h nodes, and splitting a node scans its points once, so building costs O(d times two to the h) for d dimensions. Storing the nodes uses O(two to the h) space.",
        uses: [
            "Randomized forests for classification and regression",
            "Fast ensemble baselines when split search is expensive",
            "High-dimensional tasks where random splits work as well as learned ones",
        ],
        references: [
            "Geurts, Ernst, and Wehenkel, Extremely Randomized Trees, Machine Learning, 2006",
            "Breiman, Random Forests, Machine Learning, 2001",
        ],
        workedExample:
            "Six points with features 1 through 6 and labels 0,0,1,1,1,0. At the root a random threshold of 3.5 splits them into groups of three. A later random threshold of 2.5 separates the first group into a leaf of mean 0 and a leaf of mean 1. A query at 3.5 falls to the right of 2.5 and predicts 1.",
    },
    id: "extra-trees",
    name: "Extra-Trees",
    category: "ml-ai",
    complexity: { time: "O(d 2^h)", space: "O(2^h)" },
    defaultInput: {
        xs: [1, 2, 3, 4, 5, 6],
        ys: [0, 0, 1, 1, 1, 0],
        thresholds: [3.5, 2.5, 4.5],
        maxDepth: 2,
        minSize: 1,
        queries: [2, 3.5, 5],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "start with all points in the root node",
        "if the node is deep or small enough, make it a leaf",
        "otherwise draw a random threshold for this feature",
        "split points into those below and above the threshold",
        "make each side a leaf labeled with its mean label",
        "recurse until every branch ends in a leaf",
        "done: follow queries down the tree to predict",
    ],
};

export default module;
