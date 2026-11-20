/**
 * center-loss.ts - Center Loss
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Center loss pulls each feature vector toward a learned center for its
 * class. It is used alongside a softmax loss to make deep embeddings compact:
 * every sample contributes half its squared distance to its class center, and
 * each center moves by the learning rate times the mean offset of its samples.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * d) for n features of dimension d
 *   Space: O(n + C * d) for the samples and class centers
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Feature points are drawn as nodes, one per training sample.
 *   - Class centers are drawn as highlighted pivot nodes.
 *   - An edge links a feature to its center while its distance is measured.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface CenterLossInput {
    features?: number[][];
    labels?: number[];
    centers?: number[][];
    learningRate?: number;
}

const SAMPLE_STATES: EntityState[] = ["active", "comparing", "path", "highlight", "sorted", "visited"];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as CenterLossInput | null) ?? {};
    const features: number[][] = Array.isArray(task.features) && task.features.length > 0
        ? task.features
        : [[0.2, 0.1], [0.1, -0.2], [3.1, 3], [2.8, 3.2]];
    const labels: number[] = Array.isArray(task.labels) && task.labels.length > 0
        ? task.labels
        : [0, 0, 1, 1];
    const centers: number[][] = Array.isArray(task.centers) && task.centers.length > 0
        ? task.centers.map((center) => center.slice())
        : [[0, 0], [3, 3]];
    const learningRate = typeof task.learningRate === "number" && task.learningRate >= 0 ? task.learningRate : 0.3;
    const classCount = centers.length;

    const sampleNodes = (activeIndex: number): VisualEntity[] =>
        features.map((point, i) => ({
            id: `sample-${i}`,
            type: "node" as const,
            label: `s${i}`,
            value: point,
            state: i === activeIndex ? "active" : (SAMPLE_STATES[(labels[i] ?? 0) % SAMPLE_STATES.length] ?? "idle"),
            x: point[0] ?? 0,
            y: point[1] ?? 0,
            width: 0,
            height: 0,
            metadata: { kind: "sample", index: i, label: labels[i] ?? 0 },
        }));

    const centerNodes = (): VisualEntity[] =>
        centers.map((center, j) => ({
            id: `center-${j}`,
            type: "node" as const,
            label: `c${j}`,
            value: center,
            state: "pivot" as const,
            x: center[0] ?? 0,
            y: center[1] ?? 0,
            width: 0,
            height: 0,
            metadata: { kind: "center", index: j },
        }));

    const edgesFor = (activeIndex: number): VisualEdge[] =>
        activeIndex < 0
            ? []
            : [{
                id: `pull-${activeIndex}`,
                sourceId: `sample-${activeIndex}`,
                targetId: `center-${Math.max(0, Math.min(classCount - 1, labels[activeIndex] ?? 0))}`,
                label: "distance",
                state: "active" as const,
                directed: true,
            }];

    const squaredDistance = (point: number[], center: number[]): number => {
        const dim = Math.min(point.length, center.length);
        let total = 0;
        for (let i = 0; i < dim; i += 1) {
            const diff = (point[i] ?? 0) - (center[i] ?? 0);
            total += diff * diff;
        }
        return total;
    };

    let step = 0;
    yield {
        stepNumber: step,
        entities: [...sampleNodes(-1), ...centerNodes()],
        edges: [],
        description: `Start with ${features.length} samples and ${classCount} class centers.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { phase: "setup", learningRate, features, labels, centers: centers.map((c) => c.slice()), distances: [], loss: 0 },
    };
    step += 1;

    const distances: number[] = [];
    for (let i = 0; i < features.length; i += 1) {
        const label = Math.max(0, Math.min(classCount - 1, labels[i] ?? 0));
        const distance = squaredDistance(features[i] ?? [], centers[label] ?? []);
        distances.push(distance);
        yield {
            stepNumber: step,
            entities: [...sampleNodes(i), ...centerNodes()],
            edges: edgesFor(i),
            description: `Sample ${i} lies ${distance.toFixed(4)} squared units from center ${label}.`,
            codeLineNumber: 1,
            layout: "point",
            meta: { phase: "distance", learningRate, features, labels, centers: centers.map((c) => c.slice()), distances: distances.slice(), loss: 0, activeSample: i },
        };
        step += 1;
    }

    const loss = 0.5 * distances.reduce((sum, value) => sum + value, 0);
    const sums: number[][] = centers.map((center) => center.map(() => 0));
    const counts = new Array<number>(classCount).fill(0);
    for (let i = 0; i < features.length; i += 1) {
        const label = Math.max(0, Math.min(classCount - 1, labels[i] ?? 0));
        counts[label] = (counts[label] ?? 0) + 1;
        const dim = Math.max(sums[label]?.length ?? 0, features[i]?.length ?? 0);
        for (let d = 0; d < dim; d += 1) {
            sums[label] = sums[label] ?? [];
            sums[label]![d] = (sums[label]![d] ?? 0) + (features[i]?.[d] ?? 0);
        }
    }
    const updated = centers.map((center, j) => {
        const count = counts[j] ?? 0;
        if (count === 0) return center.slice();
        return center.map((value, d) => value + learningRate * ((sums[j]?.[d] ?? 0) / count - value));
    });

    yield {
        stepNumber: step,
        entities: [...sampleNodes(-1), ...centerNodes()],
        edges: [],
        description: `Total center loss is ${loss.toFixed(4)} before the center update.`,
        codeLineNumber: 3,
        layout: "point",
        meta: { phase: "loss", learningRate, features, labels, centers: centers.map((c) => c.slice()), distances, loss, counts },
    };
    step += 1;

    centers.splice(0, centers.length, ...updated);
    yield {
        stepNumber: step,
        entities: [...sampleNodes(-1), ...centerNodes()],
        edges: [],
        description: `Done: moved each center by the learning rate times its mean sample offset.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { phase: "done", learningRate, features, labels, centers: centers.map((c) => c.slice()), distances, loss, updatedCenters: updated, counts },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A softmax separates classes but can leave samples of the same class spread out. Center loss adds a second goal: every sample should sit close to a learned center for its own class. Joint training therefore produces compact clusters, which makes the resulting features better for retrieval and face matching.",
        invariants: [
            "Only samples of a class contribute to that class's center update.",
            "The loss is half the sum of squared distances to the assigned centers.",
            "A class with no samples in the batch keeps its center unchanged.",
        ],
        correctness:
            "Squared Euclidean distance is computed dimension by dimension from each sample to its assigned center. The derivative of half a squared distance with respect to the center is the center minus the sample, so averaging over a class gives the mean offset and gradient descent moves the center by minus the learning rate times that mean. Classes with no samples have a zero gradient and stay put; replaying the frames reports exactly these distances, loss and updated centers.",
        complexityRationale:
            "Each of the n samples is compared with one d dimensional center, costing O(n d); the aggregation pass has the same order. Storing samples and C centers uses O(n + C d) space.",
        uses: [
            "Compact face embeddings for recognition",
            "Discriminative feature learning alongside a softmax loss",
            "Nearest neighbor retrieval with tighter class clusters",
        ],
        references: [
            "Wen et al., A Discriminative Feature Learning Approach for Deep Face Recognition, ECCV 2016",
            "Goodfellow et al., Maxout Networks, ICML 2013, for the feature collapse motivation",
        ],
        workedExample:
            "Samples (0,0) and (2,0) share class zero with center (1,0). Their squared distances are both 1, so the loss is 1. The mean offset is zero and the center stays put. If a third sample (4,0) joins, the mean is (5/3,0) and with learning rate 0.2 the center moves to (1+0.2*2/3, 0), about (1.133, 0).",
    },
    id: "center-loss",
    name: "Center Loss",
    category: "ml-ai",
    complexity: { time: "O(n * d)", space: "O(n + C * d)" },
    defaultInput: {
        features: [[0.2, 0.1], [0.1, -0.2], [3.1, 3], [2.8, 3.2], [-0.2, 0.3], [3.3, 2.9]],
        labels: [0, 0, 1, 1, 0, 1],
        centers: [[0, 0], [3, 3]],
        learningRate: 0.3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the samples, labels, class centers and learning rate",
        "for each sample measure its squared distance to its center",
        "sum the distances and halve them to get the loss",
        "for each class average the offsets from its center to its samples",
        "move the center by the learning rate times that mean offset",
        "leave empty classes unchanged",
        "done: report the loss and the updated centers",
    ],
};

export default module;
