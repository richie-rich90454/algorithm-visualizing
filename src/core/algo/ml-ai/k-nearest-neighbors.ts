/**
 * k-nearest-neighbors.ts - K-Nearest-Neighbors Classification
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * K-nearest-neighbors (k-NN) classifies a query point by looking at the k
 * labeled training points closest to it. Distances are computed from the query
 * to every point, the k smallest are selected, and the most common label among
 * them wins. Ties are broken by the label of the nearest tied neighbor.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n log n) for sorting n distances (O(n) to scan them)
 *   Space: O(n) for the ordered neighbor list
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Training points are plotted with their class label.
 *   - The query point is a distinct PIVOT marker.
 *   - The k chosen neighbors are green with edges drawn to the query.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

interface Neighbor {
    index: number;
    distance: number;
    label: number;
}

/** Build all point entities plus the query marker. */
function makeEntities(
    points: Point[],
    labels: number[],
    query: Point,
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    const entities: VisualEntity[] = points.map(([x, y], index) => ({
        id: `train-${index}`,
        type: "node" as const,
        label: String(labels[index] ?? 0),
        value: [x, y],
        state: states.get(index) ?? "unvisited",
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, label: labels[index] ?? 0 },
    }));
    entities.push({
        id: "query",
        type: "node",
        label: "?",
        value: query,
        state: "pivot",
        x: query[0],
        y: query[1],
        width: 0,
        height: 0,
        metadata: { index: -1, query: true },
    });
    return entities;
}

/** Rank training points by Euclidean distance, then by index for ties. */
function rankNeighbors(points: Point[], labels: number[], query: Point): Neighbor[] {
    return points
        .map((point, index) => ({
            index,
            distance: Math.hypot(point[0] - query[0], point[1] - query[1]),
            label: labels[index] ?? 0,
        }))
        .sort((left, right) => left.distance - right.distance || left.index - right.index);
}

/** The k-NN generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { points?: Point[]; labels?: number[]; query?: Point; k?: number } | null
    ) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 2],
        [1, 2],
        [2, 2],
    ];
    const labels: number[] = task.labels ?? [-1, -1, -1, 1, 1, 1];
    const query: Point = task.query ?? [1.4, 1.1];
    const k = Math.max(1, Math.min(typeof task.k === "number" ? task.k : 3, points.length));

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(points, labels, query),
        edges: [],
        description: `Classifying query (${query[0]}, ${query[1]}) from ${points.length} points using k = ${k}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { k, measured: 0, prediction: 0 },
    };
    step += 1;

    const ranked = rankNeighbors(points, labels, query);
    for (let i = 0; i < ranked.length; i += 1) {
        const neighbor = ranked[i];
        if (!neighbor) {
            continue;
        }
        const states = new Map<number, EntityState>([[neighbor.index, "comparing"]]);
        yield {
            stepNumber: step,
            entities: makeEntities(points, labels, query, states),
            edges: [],
            description: `Point ${neighbor.index} is ${neighbor.distance.toFixed(2)} away from the query.`,
            codeLineNumber: 2,
            layout: "point",
            meta: { k, measured: i + 1, distance: neighbor.distance, prediction: 0 },
        };
        step += 1;
    }

    const chosen = ranked.slice(0, k);
    const neighborStates = new Map<number, EntityState>();
    const edges: VisualEdge[] = [];
    for (const neighbor of chosen) {
        neighborStates.set(neighbor.index, "path");
        edges.push({
            id: `edge-query-${neighbor.index}`,
            sourceId: "query",
            targetId: `train-${neighbor.index}`,
            label: neighbor.distance.toFixed(2),
            state: "path",
            directed: true,
        });
    }

    const counts = new Map<number, number>();
    for (const neighbor of chosen) {
        counts.set(neighbor.label, (counts.get(neighbor.label) ?? 0) + 1);
    }
    let bestCount = -1;
    let prediction = chosen[0]?.label ?? 0;
    for (const neighbor of chosen) {
        const count = counts.get(neighbor.label) ?? 0;
        if (count > bestCount) {
            bestCount = count;
            prediction = neighbor.label;
        }
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, labels, query, neighborStates),
        edges,
        description: `The ${k} nearest neighbors vote; the query is predicted to be class ${prediction}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: {
            k,
            measured: ranked.length,
            prediction,
            neighbors: chosen.map((neighbor) => neighbor.index),
            distances: chosen.map((neighbor) => Number(neighbor.distance.toFixed(4))),
        },
    };
}

/** The k-NN module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Points that are close together in feature space often share a class. To classify a new point, find the k closest labeled examples and let them vote. The parameter k controls how smooth the decision boundary is.",
        invariants: [
            "Every distance is measured from the query to one training point with the Euclidean metric.",
            "Neighbors are ordered by distance, then by index so ties are deterministic.",
            "Exactly k neighbors contribute to the vote (or all points when k exceeds the sample size).",
        ],
        correctness:
            "Sorting all distances guarantees that the chosen set is exactly the k smallest, so no closer example is ignored. Weighted or unweighted voting then returns the label with the most support, with a fixed tie rule that makes the answer reproducible.",
        complexityRationale:
            "Scanning n points takes O(n) distance computations and sorting them costs O(n log n). Only the ranked neighbor list is kept, so space is O(n).",
        uses: [
            "Recommendation systems based on similar users",
            "Pattern recognition and simple image classifiers",
            "Imputation of missing values from similar records",
        ],
        references: [
            "Fix and Hodges, Discriminatory Analysis: Nonparametric Discrimination, 1951",
            "Cover and Hart, Nearest Neighbor Pattern Classification, 1967",
        ],
        workedExample:
            "With two lower points labeled -1, three upper points labeled +1, and query (1.4, 1.1), the three closest points are the upper ones at about 0.92, 1.06, and 1.52 units, so the vote predicts +1.",
    },
    id: "k-nearest-neighbors",
    name: "K-Nearest Neighbors",
    category: "ml-ai",
    complexity: { time: "O(n log n)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 0],
            [2, 0],
            [0, 2],
            [1, 2],
            [2, 2],
        ],
        labels: [-1, -1, -1, 1, 1, 1],
        query: [1.4, 1.1],
        k: 3,
    },
    visualType: "point",
    run,
    pseudocode: [
        "initialize an empty list of distances",
        "for each labeled training point",
        "compute its Euclidean distance from the query",
        "sort the list by increasing distance",
        "take the first k entries as the neighbors",
        "count votes for each label among those neighbors",
        "return the label with the most votes",
    ],
};

export default module;
