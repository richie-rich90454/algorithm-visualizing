/**
 * k-medoids-pam.ts - Partitioning Around Medoids with Manhattan distance.
 *
 * PAM chooses k actual data points as cluster centers so the total distance
 * from every point to its nearest medoid is minimal. It builds an initial set
 * greedily and then repeatedly tries every medoid/candidate swap, keeping the
 * best strictly improving swap until none remains.
 *
 * Time: O(t k (n - k) n) for t swap rounds. Space: O(n^2).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Pt = [number, number];

function manhattan(a: Pt, b: Pt): number {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function distanceMatrix(points: Pt[]): number[][] {
    return points.map((p) => points.map((q) => manhattan(p, q)));
}

/** Total cost of a medoid set: sum of nearest-medoid distances. */
function totalCost(medoids: number[], dist: number[][]): number {
    let total = 0;
    for (let i = 0; i < dist.length; i += 1) {
        let best = Infinity;
        for (const m of medoids) best = Math.min(best, dist[i]![m]!);
        total += best;
    }
    return total;
}

function assignmentsOf(medoids: number[], dist: number[][]): number[] {
    return dist.map((row) => {
        let best = medoids[0]!;
        let bestD = Infinity;
        for (const m of medoids) {
            if (row[m]! < bestD) {
                bestD = row[m]!;
                best = m;
            }
        }
        return best;
    });
}

/** The PAM generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Pt[]; k?: number; maxIterations?: number } | null) ?? {};
    const points: Pt[] = task.points ?? [
        [0, 0], [1, 0], [2, 0], [8, 8], [9, 8], [8, 9], [9, 9], [1, 1],
    ];
    const k = Math.max(1, Math.min(points.length, Math.floor(task.k ?? 2)));
    const maxIterations = Math.max(1, Math.min(50, Math.floor(task.maxIterations ?? 20)));
    const dist = distanceMatrix(points);
    let step = 0;

    const emit = (
        medoids: number[],
        cost: number,
        description: string,
        codeLineNumber: number,
        final: boolean,
    ): VisualFrame => {
        const assignment = assignmentsOf(medoids, dist);
        const medoidSet = new Set(medoids);
        const entities: VisualEntity[] = points.map((p, i) => ({
            id: `p-${i}`,
            type: "node",
            label: String(i),
            value: p,
            state: medoidSet.has(i) ? "pivot" : final ? "sorted" : "visited",
            x: p[0],
            y: -p[1],
            width: 0,
            height: 0,
            metadata: { index: i, medoid: medoidSet.has(i), cluster: assignment[i] },
        }));
        const edges: VisualEdge[] = [];
        for (let i = 0; i < points.length; i += 1) {
            if (medoidSet.has(i)) continue;
            edges.push({
                id: `assign-${i}`,
                sourceId: `p-${i}`,
                targetId: `p-${assignment[i]!}`,
                label: String(dist[i]![assignment[i]!]!),
                state: "path",
                directed: true,
            });
        }
        const flatPoints: number[] = [];
        for (const p of points) flatPoints.push(p[0], p[1]);
        return {
            stepNumber: step++,
            entities,
            edges,
            description,
            codeLineNumber,
            layout: "point",
            meta: {
                medoids,
                cost,
                assignments: assignment,
                points: flatPoints,
                k,
            },
        };
    };

    if (points.length === 0) {
        yield emit([], 0, "PAM: an empty data set has no medoids to choose.", 0, true);
        return;
    }

    // BUILD: start with the most central point, then greedily add the point
    // that lowers total cost the most.
    let first = 0;
    for (let i = 1; i < points.length; i += 1) {
        let sumI = 0;
        let sumFirst = 0;
        for (let j = 0; j < points.length; j += 1) {
            sumI += dist[i]![j]!;
            sumFirst += dist[first]![j]!;
        }
        if (sumI < sumFirst) first = i;
    }
    let medoids = [first];
    yield emit(medoids, totalCost(medoids, dist), `PAM: first medoid is point ${first}, the most central point.`, 1, false);

    while (medoids.length < k) {
        let bestPoint = -1;
        let bestCost = Infinity;
        for (let c = 0; c < points.length; c += 1) {
            if (medoids.includes(c)) continue;
            const cost = totalCost([...medoids, c], dist);
            if (cost < bestCost) {
                bestCost = cost;
                bestPoint = c;
            }
        }
        medoids = [...medoids, bestPoint];
        yield emit(medoids, bestCost, `PAM: added point ${bestPoint} as medoid ${medoids.length}.`, 2, false);
    }

    // SWAP: repeatedly apply the single best improving medoid/candidate swap.
    let currentCost = totalCost(medoids, dist);
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
        let bestFrom = -1;
        let bestTo = -1;
        let bestCost = currentCost;
        for (let m = 0; m < medoids.length; m += 1) {
            for (let c = 0; c < points.length; c += 1) {
                if (medoids.includes(c)) continue;
                const candidate = [...medoids];
                candidate[m] = c;
                const cost = totalCost(candidate, dist);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestFrom = m;
                    bestTo = c;
                }
            }
        }
        if (bestFrom < 0) break;
        medoids = [...medoids];
        medoids[bestFrom] = bestTo;
        currentCost = bestCost;
        yield emit(medoids, currentCost, `PAM: swapped medoid ${bestFrom} to point ${bestTo}, cost ${currentCost}.`, 4, false);
    }

    yield emit(medoids, currentCost, `PAM: settled on ${k} medoids with total cost ${currentCost}.`, 5, true);
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "K-medoids clustering is like k-means except every center must be a real data point. PAM starts by greedily picking central points, then asks a simple question over and over: if I replaced this medoid with that ordinary point, would the total distance to the nearest medoid go down? It applies the best improving swap until no swap helps.",
        invariants: [
            "Every medoid is one of the original data points and all medoids are distinct.",
            "Each swap strictly lowers the total Manhattan cost.",
            "Every point is assigned to its nearest current medoid.",
        ],
        correctness:
            "The cost of a medoid set is the sum over points of their distance to the closest medoid, so evaluating a swap only requires recomputing those nearest distances. PAM examines every one-medoid replacement at each round and applies the best strictly improving one, so the cost decreases monotonically until the local search reaches a state where no single swap helps. That state is a local optimum of the k-medoid objective, which is the guarantee PAM provides.",
        complexityRationale:
            "A BUILD step scans candidates and recomputes O(n) nearest distances, giving O(k n^2). Each SWAP round tries O(k(n-k)) pairs at O(n) cost each, so t rounds take O(t k n^2); the distance matrix uses O(n^2) space.",
        uses: [
            "Clustering with meaningful, observable representatives",
            "Robust clustering with outlier-resistant Manhattan distance",
            "Segmenting customers or documents when centers must be real examples",
        ],
        references: [
            "Kaufman and Rousseeuw, Finding Groups in Data: An Introduction to Cluster Analysis, 1990",
            "Han, Kamber and Pei, Data Mining: Concepts and Techniques, Chapter 10",
        ],
        workedExample:
            "With points (0,0), (1,0), (2,0), (8,8), (9,8), (9,9) and k = 2, the most central point is (2,0) or (9,8). BUILD adds a medoid from the far cluster, giving cost near 4. Swapping a medoid to another point in the same tight cluster lowers the cost slightly; once no single swap helps, the two medoids sit near the middle of each group.",
    },
    id: "k-medoids-pam",
    name: "K-Medoids PAM Clustering",
    category: "geometry",
    complexity: { time: "O(t k n^2)", space: "O(n^2)" },
    defaultInput: {
        points: [[0, 0], [1, 0], [2, 0], [8, 8], [9, 8], [8, 9], [9, 9], [1, 1]],
        k: 2,
    },
    visualType: "point",
    run,
    pseudocode: [
        "compute all pairwise Manhattan distances",
        "choose the most central point as the first medoid",
        "while fewer than k medoids, add the point that lowers cost most",
        "for every medoid and every candidate evaluate the swap cost",
        "apply the best strictly improving swap and repeat",
        "done: no single swap improves the medoid set",
    ],
};

export default module;
