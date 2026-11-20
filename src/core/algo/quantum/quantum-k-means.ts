/**
 * quantum-k-means.ts - K-Means with Quantum Kernel Overlap Distances
 *
 * A small exact simulation of quantum k-means: data points are amplitude
 * encoded as unit vectors, the distance from a point to a cluster center is
 * obtained from the overlap of those two states (the quantity a SWAP test
 * would estimate), and Lloyd's assignment and update steps then proceed
 * classically. This model reports ideal overlaps rather than finite-shot
 * estimates and is limited to two-dimensional points and two clusters; it does
 * not model state-preparation cost, sampling error, or hardware noise.
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface KMeansInput {
    points?: number[][];
    iterations?: number;
}

const DEFAULT_POINTS: number[][] = [
    [0.1, 0.1], [0.2, 0.0], [0.0, 0.2], [1.0, 1.0], [0.9, 1.1], [1.1, 0.9],
];

function norm(point: number[]): number {
    return Math.hypot(point[0] ?? 0, point[1] ?? 0) || 1;
}

function unit(point: number[]): [number, number] {
    const length = norm(point);
    return [(point[0] ?? 0) / length, (point[1] ?? 0) / length];
}

function overlap(point: number[], center: number[]): number {
    const p = unit(point);
    const c = unit(center);
    return p[0] * c[0] + p[1] * c[1];
}

function squaredDistance(point: number[], center: number[]): number {
    const pointNorm = norm(point);
    const centerNorm = norm(center);
    return pointNorm * pointNorm + centerNorm * centerNorm - 2 * pointNorm * centerNorm * overlap(point, center);
}

function makeBars(values: number[], labels: string[], highlight: number, final: boolean): VisualEntity[] {
    return values.map((value, index) => ({
        id: `point-${index}`,
        type: "bar" as const,
        label: labels[index] ?? String(index),
        value,
        state: final ? "sorted" : index === highlight ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as KMeansInput | null) ?? {};
    const points = Array.isArray(task.points) && task.points.length >= 2
        ? task.points.map((p) => [Number(p?.[0] ?? 0), Number(p?.[1] ?? 0)])
        : DEFAULT_POINTS.map((p) => [...p]);
    const iterations = typeof task.iterations === "number" ? Math.max(1, Math.min(5, Math.floor(task.iterations))) : 3;
    let centers: number[][] = [[...points[0]!], [...points[points.length - 1]!]];
    const labels = points.map((p) => `(${p[0]!.toFixed(2)}, ${p[1]!.toFixed(2)})`);
    const metaFor = (iteration: number, overlaps: number[], assignments: number[], distances: number[], converged: boolean, done: boolean) => ({
        iterations,
        iteration,
        count: points.length,
        overlaps,
        assignments,
        distances,
        centers: centers.flat(),
        objective: distances.reduce((sum, d) => sum + d, 0),
        converged,
        done,
    });

    const initialDistances = points.map((point) => Math.min(...centers.map((center) => squaredDistance(point, center))));
    yield {
        stepNumber: 0,
        entities: makeBars(points.map((p) => overlap(p, centers[0]!)), labels, -1, false),
        edges: [],
        description: `Encoded ${points.length} points as quantum states and chose the first and last points as the two initial centers.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaFor(0, [], [], initialDistances, false, false),
    };

    let step = 1;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const overlaps: number[] = [];
        const assignments: number[] = [];
        const distances: number[] = [];
        for (const point of points) {
            const candidates = centers.map((center) => overlap(point, center));
            const distance0 = squaredDistance(point, centers[0]!);
            const distance1 = squaredDistance(point, centers[1]!);
            const chosen = distance0 <= distance1 ? 0 : 1;
            overlaps.push(candidates[chosen]!);
            assignments.push(chosen);
            distances.push(chosen === 0 ? distance0 : distance1);
        }
        yield {
            stepNumber: step,
            entities: makeBars(overlaps, labels, overlaps.indexOf(Math.max(...overlaps)), false),
            edges: [],
            description: `Iteration ${iteration}: quantum overlaps assign each point to its nearest center, with squared distance derived from the overlap.`,
            codeLineNumber: 2,
            layout: "array",
            meta: metaFor(iteration, overlaps, assignments, distances, false, false),
        };
        step += 1;

        const nextCenters: number[][] = [];
        let converged = true;
        for (let cluster = 0; cluster < 2; cluster += 1) {
            const members = points.filter((_point, index) => assignments[index] === cluster);
            if (members.length === 0) {
                nextCenters.push([...centers[cluster]!]);
                continue;
            }
            const average = [
                members.reduce((sum, p) => sum + (p[0] ?? 0), 0) / members.length,
                members.reduce((sum, p) => sum + (p[1] ?? 0), 0) / members.length,
            ];
            if (Math.hypot(average[0]! - centers[cluster]![0]!, average[1]! - centers[cluster]![1]!) > 1e-10) converged = false;
            nextCenters.push(average);
        }
        centers = nextCenters;
        yield {
            stepNumber: step,
            entities: makeBars(distances, labels, -1, false),
            edges: [],
            description: `Iteration ${iteration}: centers move to the mean of their assigned points; the objective is ${metaFor(iteration, overlaps, assignments, distances, converged, false).objective.toFixed(4)}.`,
            codeLineNumber: 4,
            layout: "array",
            meta: metaFor(iteration, overlaps, assignments, distances, converged, false),
        };
        step += 1;
        if (converged) break;
    }

    const finalOverlaps = points.map((point) => overlap(point, centers[0]!));
    const finalDistances = points.map((point) => {
        const candidates = centers.map((center) => squaredDistance(point, center));
        return Math.min(candidates[0]!, candidates[1]!);
    });
    const finalObjective = finalDistances.reduce((sum, d) => sum + d, 0);
    yield {
        stepNumber: step,
        entities: makeBars(finalOverlaps, labels, -1, true),
        edges: [],
        description: `K-means finished with two centers and total squared distance ${finalObjective.toFixed(4)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { ...metaFor(iterations, finalOverlaps, [], finalDistances, true, true), objective: finalObjective },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Quantum k-means replaces the usual distance calculation with an overlap measurement between quantum states that encode a point and a center. For unit vectors the squared Euclidean distance is determined by their inner product, and a SWAP test estimates that inner product. Once distances are known the clustering loop is the familiar Lloyd iteration: assign each point to the closest center, then move each center to the mean of its points.",
        invariants: [
            "Every overlap lies between minus one and one, and each squared distance is nonnegative.",
            "The reconstruction distance squared equals the norm of the point minus the center, so it matches ordinary Euclidean distance.",
            "The sum of squared distances never increases after an assignment and update step.",
        ],
        correctness:
            "Amplitude encoding maps a point to a unit vector whose components are its coordinates divided by their norm. The inner product of two such vectors is the cosine of the angle between them, so the identity distance squared equals the point norm squared plus the center norm squared minus twice the product of norms times the overlap recovers the ordinary squared Euclidean distance. The assignment chooses the center with the smallest reconstructed distance rather than the raw overlap, because centers can have different norms. Lloyd's monotonicity argument then applies: assignment minimizes the objective for fixed centers and the mean minimizes it for fixed assignments.",
        complexityRationale:
            "For this simulation each of the n points is compared with two centers in constant time, so an iteration costs O(n) and the full run costs O(iterations times n). On a quantum device each overlap is estimated to precision epsilon with O(1 over epsilon squared) SWAP tests, which is the part that can beat a classical high-dimensional distance calculation.",
        uses: [
            "Clustering high-dimensional feature vectors in quantum machine learning",
            "Kernel-based data analysis with quantum kernels",
            "Near-medium-scale demonstrations of quantum subroutine speedups",
        ],
        references: [
            "Buhrman, Cleve, Watrous, and de Wolf, Quantum Fingerprinting, 2001",
            "Lloyd, Mohseni, and Shapiro, Quantum Principal Component Analysis, 2014",
        ],
        workedExample:
            "For the point (0.1, 0.1) and center (1, 1) the overlap is 1, so the reconstructed squared distance is about 1.62, matching ordinary coordinate subtraction. The nearby center (0.1, 0.1) has overlap 1 and squared distance zero, so the point joins that cluster immediately.",
    },
    id: "quantum-k-means",
    name: "Quantum K-Means (Overlap Distances)",
    category: "quantum",
    complexity: { time: "O(iterations * n)", space: "O(n)" },
    defaultInput: {
        points: [[0.1, 0.1], [0.2, 0.0], [0.0, 0.2], [1.0, 1.0], [0.9, 1.1], [1.1, 0.9]],
        iterations: 3,
    },
    visualType: "array",
    run,
    pseudocode: [
        "amplitude encode each data point as a unit quantum state",
        "choose the first and last points as the two initial centers",
        "for each point estimate its overlap with each center",
        "reconstruct squared distance from overlaps and vector norms",
        "assign the point to the center with the smallest distance",
        "move each center to the mean of its assigned points",
        "done: report converged centers and total squared distance",
    ],
};

export default module;
