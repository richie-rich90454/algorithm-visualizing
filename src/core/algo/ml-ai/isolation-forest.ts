/**
 * isolation-forest.ts - Isolation Forest Anomaly Scoring
 *
 * Random split trees isolate points by cutting a feature range uniformly at
 * random. Anomalies need few splits to become singleton leaves, so a short
 * average path length across the forest becomes a high anomaly score.
 *
 * Time:  O(trees * n * heightLimit)
 * Space: O(trees * nodes)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface IsolationNode {
    size: number;
    height: number;
    point?: number;
    split?: number;
    left?: IsolationNode;
    right?: IsolationNode;
}

interface ForestInput {
    points: number[];
    trees: number;
    heightLimit: number;
    seed: number;
}

interface Rng {
    state: number;
}

function nextRandom(rng: Rng): number {
    rng.state = (Math.imul(rng.state, 1664525) + 1013904223) >>> 0;
    return rng.state / 4294967296;
}

function buildTree(values: number[], heightLimit: number, rng: Rng, height = 0): IsolationNode {
    if (values.length <= 1 || height >= heightLimit) {
        return { size: values.length, height, point: values[0] };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const v of values) {
        min = Math.min(min, v);
        max = Math.max(max, v);
    }
    if (min === max) {
        return { size: values.length, height, point: values[0] };
    }
    const split = min + nextRandom(rng) * (max - min);
    const left: number[] = [];
    const right: number[] = [];
    for (const v of values) {
        if (v <= split) {
            left.push(v);
        } else {
            right.push(v);
        }
    }
    if (left.length === 0 || right.length === 0) {
        return { size: values.length, height, point: values[0] };
    }
    return {
        size: values.length,
        height,
        split,
        left: buildTree(left, heightLimit, rng, height + 1),
        right: buildTree(right, heightLimit, rng, height + 1),
    };
}

/** Build the forest with a deterministic linear-congruential seed. */
export function buildForest(input: ForestInput): IsolationNode[] {
    const rng: Rng = { state: (input.seed >>> 0) || 1 };
    const trees: IsolationNode[] = [];
    for (let t = 0; t < input.trees; t += 1) {
        trees.push(buildTree(input.points, input.heightLimit, rng));
    }
    return trees;
}

/** Number of edges from the root down to the leaf containing x. */
export function pathLength(node: IsolationNode, x: number): number {
    let current = node;
    let steps = 0;
    while (current.split !== undefined && current.left && current.right) {
        current = x <= current.split ? current.left : current.right;
        steps += 1;
    }
    return steps;
}

/** Average unsuccessful-search path length for a binary search tree of n keys. */
export function expectedPathLength(n: number): number {
    if (n <= 1) {
        return 1;
    }
    const harmonic = Math.log(n - 1) + 0.5772156649015329;
    return 2 * harmonic - (2 * (n - 1)) / n;
}

function makeBars(points: number[], scores: number[], active: number): VisualEntity[] {
    return points.map((value, i) => {
        const state: EntityState = i === active ? "comparing" : (scores[i] ?? 0) > 0.6 ? "error" : "sorted";
        return {
            id: `bar-${i}`,
            type: "bar" as const,
            label: `${value}: ${(scores[i] ?? 0).toFixed(3)}`,
            value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index: i, score: scores[i] ?? 0 },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Partial<ForestInput> | null) ?? {};
    const points: number[] = Array.isArray(task.points) && task.points.length > 0
        ? task.points
        : [1, 1.1, 1.2, 1.3, 1.4, 2, 50];
    const trees = Math.max(1, Math.floor(task.trees ?? 8));
    const heightLimit = Math.max(1, Math.floor(task.heightLimit ?? 4));
    const seed = Math.floor(task.seed ?? 42);
    const forestInput: ForestInput = { points, trees, heightLimit, seed };
    const forest = buildForest(forestInput);
    const n = points.length;
    const cFactor = expectedPathLength(n);

    let running = Array(n).fill(0) as number[];
    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(points, Array(n).fill(0), -1),
        edges: [],
        description: `Building ${trees} isolation trees on ${n} values with height limit ${heightLimit}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { n, trees, heightLimit, rows: 1, cols: n, treesBuilt: 0, pathLengths: running, scores: Array(n).fill(0), cFactor },
    };
    step += 1;

    for (let t = 0; t < forest.length; t += 1) {
        const lengths = points.map((p) => pathLength(forest[t]!, p));
        running = running.map((v, i) => v + lengths[i]!);
        const mean = running.map((v) => v / (t + 1));
        const scores = mean.map((h) => Math.pow(2, -h / cFactor));
        yield {
            stepNumber: step,
            entities: makeBars(points, scores, -1),
            edges: [],
            description: `Tree ${t + 1}: averaged path lengths; the isolated value now scores highest.`,
            codeLineNumber: t === forest.length - 1 ? 5 : 4,
            layout: "array",
            meta: { n, trees, heightLimit, rows: 1, cols: n, treesBuilt: t + 1, pathLengths: mean, scores, cFactor },
        };
        step += 1;
    }

    const mean = running.map((v) => v / forest.length);
    const scores = mean.map((h) => Math.pow(2, -h / cFactor));
    let outlier = 0;
    for (let i = 1; i < scores.length; i += 1) {
        if ((scores[i] ?? 0) > (scores[outlier] ?? 0)) {
            outlier = i;
        }
    }
    yield {
        stepNumber: step,
        entities: makeBars(points, scores, outlier),
        edges: [],
        description: `Done: value ${points[outlier]} has the highest anomaly score ${(scores[outlier] ?? 0).toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { n, trees, heightLimit, rows: 1, cols: n, treesBuilt: trees, pathLengths: mean, scores, cFactor, outlier },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Anomalies are rare and different, so a random axis-aligned cut is likely to separate one from the rest quickly. An isolation forest grows many such random trees and measures how many cuts are needed to isolate each point. Points that reach a leaf after few cuts receive scores near one, while typical points receive scores near one half.",
        invariants: [
            "Every internal node splits uniformly inside the range of values reaching it.",
            "A leaf holds at most one point unless the height cap or an equal-valued range stops the growth.",
            "The average path length across the forest decreases as a point becomes easier to isolate.",
        ],
        correctness:
            "Each tree recursion partitions its input values into two nonempty subsets unless it reaches a leaf condition, so the traversal in pathLength visits exactly the leaf containing the query and counts the correct number of edges. The scoring formula is the standard isolation-forest measure 2 to the power of negative mean path length over c(n), where c(n) is the average unsuccessful-search path length in a binary search tree, so a shorter path maps monotonically to a larger score. The test rebuilds the forest from the same seed and independently walks each tree to verify every reported path length and score.",
        complexityRationale:
            "Building one tree examines the points at each level up to the height cap, costing O(n * heightLimit), and the forest repeats this for each tree. Scoring walks one root-to-leaf path per tree, giving O(trees * heightLimit) per point and O(trees * n) total tree nodes in memory.",
        uses: [
            "Fraud and intrusion detection on high-volume numeric logs",
            "Outlier screening before training a downstream model",
            "Quality control on sensor and manufacturing measurements",
        ],
        references: [
            "Liu, Ting, and Zhou, Isolation Forest, ICDM, 2008",
            "Liu, Ting, and Zhou, On Detecting Clusters and Anomalies with Isolation Forest, ACM TKDD, 2012",
        ],
        workedExample:
            "With values 1, 1.1, 1.2, 1.3, 1.4, 2, and 50, a random cut near 25 separates 50 from the tight cluster in one step. The outlier reaches a leaf after one or two cuts, while members of the cluster need several. Averaged across trees, the outlier's score approaches one and each cluster member's score stays near one half.",
    },
    id: "isolation-forest",
    name: "Isolation Forest",
    category: "ml-ai",
    complexity: { time: "O(trees * n * heightLimit)", space: "O(trees * n)" },
    defaultInput: { points: [1, 1.1, 1.2, 1.3, 1.4, 2, 50], trees: 8, heightLimit: 4, seed: 42 },
    visualType: "array",
    run,
    pseudocode: [
        "seed a deterministic random generator",
        "for each tree recursively pick a random split inside the current value range",
        "recurse into the two nonempty sides until a leaf condition holds",
        "for each point walk every tree and count the edges to its leaf",
        "average the path lengths across all trees",
        "convert the mean to a score using two to the power of negative mean over c of n",
        "done: flag the point with the largest anomaly score",
    ],
};

export default module;
