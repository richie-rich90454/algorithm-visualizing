/**
 * meanshift-clustering.ts - Mean Shift Clustering with a Gaussian Kernel.
 *
 * Mean shift treats every data point as a candidate cluster center and repeatedly
 * slides it toward the weighted average of nearby points. Points vote with a
 * Gaussian weight that fades with distance, so each candidate climbs the local
 * density landscape until it stalls at a mode. Candidates that stall together
 * are merged into one cluster.
 *
 * Time:  O(iterations * n^2)
 * Space: O(n) for the candidate centers
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; bandwidth?: number; maxIterations?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [1, 1], [1.2, 0.8], [0.8, 1.3], [1.4, 1.1], [1.1, 1.4],
        [6, 6], [6.2, 5.8], [5.8, 6.3], [6.4, 6.1], [6.1, 6.4],
    ];
    const bandwidth = typeof task.bandwidth === "number" && task.bandwidth > 0 ? task.bandwidth : 1.5;
    const maxIterations = Math.max(1, Math.min(100, task.maxIterations ?? 50));

    let centers: Point[] = points.map(([x, y]) => [x, y]);
    const shift = (center: Point): Point => {
        let weightSum = 0;
        let sx = 0;
        let sy = 0;
        for (const [px, py] of points) {
            const d2 = (center[0] - px) ** 2 + (center[1] - py) ** 2;
            const weight = Math.exp(-d2 / (2 * bandwidth * bandwidth));
            sx += weight * px;
            sy += weight * py;
            weightSum += weight;
        }
        return weightSum === 0 ? center : [sx / weightSum, sy / weightSum];
    };

    const entityList = (list: Point[], prefix: string, label: (i: number) => string, state: "active" | "unvisited" | "sorted" | "pivot"): VisualEntity[] =>
        list.map(([x, y], i) => ({
            id: `${prefix}-${i}`,
            type: "node" as const,
            label: label(i),
            value: [x, y],
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index: i, x, y },
        }));

    let step = 0;
    const emit = (message: string, codeLine: number, entities: VisualEntity[], meta: Record<string, number | string | boolean | Array<number | string>>): VisualFrame => {
        const frame: VisualFrame = { stepNumber: step, entities, edges: [], description: message, codeLineNumber: codeLine, layout: "point", meta };
        step += 1;
        return frame;
    };

    yield emit(
        `Started ${centers.length} candidate centers, one at each data point, with bandwidth ${bandwidth}.`,
        0,
        [...entityList(points, "p", (i) => String(i), "unvisited"), ...entityList(centers, "c", (i) => "c", "active")],
        { points: points.length, iteration: 0, modes: 0 },
    );

    let iteration = 0;
    for (; iteration < maxIterations; iteration += 1) {
        const next = centers.map(shift);
        let maxMove = 0;
        for (let i = 0; i < next.length; i += 1) {
            maxMove = Math.max(maxMove, Math.hypot((next[i] as Point)[0] - (centers[i] as Point)[0], (next[i] as Point)[1] - (centers[i] as Point)[1]));
        }
        centers = next;
        if (iteration < 12) {
            yield emit(
                `Iteration ${iteration + 1}: every center slid toward its weighted local mean (max move ${maxMove.toFixed(4)}).`,
                3,
                [...entityList(points, "p", (i) => String(i), "unvisited"), ...entityList(centers, "c", (i) => "c", "active")],
                { points: points.length, iteration: iteration + 1, maxMove, modes: 0 },
            );
        }
        if (maxMove < 1e-3) break;
    }

    const modes: Point[] = [];
    for (const center of centers) {
        const duplicate = modes.some((mode) => Math.hypot(mode[0] - center[0], mode[1] - center[1]) < bandwidth * 0.7);
        if (!duplicate) modes.push(center);
    }
    const assign = (point: Point): number => {
        let bestIndex = 0;
        let bestDist = Infinity;
        modes.forEach((mode, i) => {
            const d = Math.hypot(mode[0] - point[0], mode[1] - point[1]);
            if (d < bestDist) {
                bestDist = d;
                bestIndex = i;
            }
        });
        return bestIndex;
    };
    const assignments = points.map(assign);

    yield emit(
        `Converged after ${iteration + 1} iteration(s) to ${modes.length} density mode(s).`,
        6,
        [
            ...points.map(([x, y], i): VisualEntity => ({
                id: `p-${i}`,
                type: "node" as const,
                label: `c${assignments[i]}`,
                value: [x, y],
                state: "sorted",
                x,
                y,
                width: 0,
                height: 0,
                metadata: { index: i, cluster: assignments[i] },
            })),
            ...entityList(modes, "m", (i) => `M${i}`, "pivot"),
        ],
        {
            points: points.length,
            iteration: iteration + 1,
            modes: modes.length,
            modeXs: modes.map((m) => m[0]),
            modeYs: modes.map((m) => m[1]),
            assignments,
        },
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Mean shift climbs a hill of density. Put a candidate at every data point and repeatedly move each one toward the average of the points that are close enough to matter, with nearer points counting more. After enough steps the candidates stop moving at the tops of the hills, and candidates that stopped near each other are merged into a single cluster. The number of clusters is discovered rather than prescribed.",
        invariants: [
            "Each shift moves a center toward the weighted mean of the points within its bandwidth.",
            "The Gaussian weight is largest for the closest points and shrinks with distance.",
            "Converged centers that lie within a fraction of a bandwidth are merged.",
        ],
        correctness:
            "The mean-shift update is a gradient ascent step on the kernel density estimate, so each iteration does not decrease the local density and the sequence converges to a stationary point of that density. Two candidates that converge to the same mode come within a fraction of the bandwidth and are merged, so the final modes are the distinct local maxima and assigning each point to its nearest mode partitions the data consistently.",
        complexityRationale:
            "Each iteration evaluates a weighted mean over all n points for each of the n centers, costing O(n^2); with a bounded number of iterations the total is O(iterations * n^2). Storage is O(n) for the centers plus O(k) for the k discovered modes.",
        uses: [
            "Image segmentation by color and spatial density",
            "Clustering when the number of clusters is unknown ahead of time",
            "Object tracking via the mode of a feature distribution",
        ],
        references: [
            "K. Fukunaga and L. D. Hostetler, The Estimation of the Gradient of a Density Function, 1975",
            "D. Comaniciu and P. Meer, Mean Shift: A Robust Approach Toward Feature Space Analysis, 2002",
        ],
        workedExample:
            "For two tight groups of points near (1,1) and (6,6) with bandwidth 1.5, a candidate starting at (1.2,0.8) is pulled toward the dense core near (1,1) and stalls there, while a candidate near (6,6) stalls near (6,6). After merging nearby stall points, two modes remain and every point is assigned to the closer one.",
    },
    id: "meanshift-clustering",
    name: "Mean Shift Clustering",
    category: "geometry",
    complexity: { time: "O(iterations * n^2)", space: "O(n)" },
    defaultInput: {
        points: [
            [1, 1], [1.2, 0.8], [0.8, 1.3], [1.4, 1.1], [1.1, 1.4],
            [6, 6], [6.2, 5.8], [5.8, 6.3], [6.4, 6.1], [6.1, 6.4],
        ],
        bandwidth: 1.5,
    },
    visualType: "point",
    run,
    pseudocode: [
        "place one candidate center at every data point",
        "repeat until no center moves appreciably",
        "for each center gather points weighted by a Gaussian of distance",
        "move the center to the weighted average of those points",
        "measure the largest movement across all centers",
        "merge converged centers closer than a fraction of the bandwidth",
        "assign every point to its nearest surviving mode",
        "done: report the discovered modes and cluster assignments",
    ],
};

export default module;
