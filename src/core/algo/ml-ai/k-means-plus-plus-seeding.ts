/**
 * k-means-plus-plus-seeding.ts - k-means++ Careful Center Initialization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The quality of k-means depends heavily on where the centers start. k-means++
 * spreads them out: the first center is chosen at random, and every later one
 * is sampled with probability proportional to its squared distance from the
 * nearest center already chosen. Far-away points are therefore more likely to
 * become centers. A seeded generator makes the replay deterministic.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n * k) for n points and k centers
 *   Space: O(n) for the squared-distance weights
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - All candidate points are plotted.
 *   - Chosen centers are highlighted as pivots.
 *   - Meta records the squared distance of each point to its nearest center.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Point = [number, number];

/** Deterministic 32-bit pseudo-random generator (mulberry32). */
function mulberry32(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function squaredDistance(a: Point, b: Point): number {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

/** Squared distance from every point to the nearest chosen center. */
function nearestDistances(points: Point[], centers: number[]): number[] {
    return points.map((point) => {
        let best = Infinity;
        for (const centerIndex of centers) {
            const center = points[centerIndex];
            if (center) {
                best = Math.min(best, squaredDistance(point, center));
            }
        }
        return best;
    });
}

function makeEntities(points: Point[], centers: number[]): VisualEntity[] {
    return points.map(([x, y], index) => ({
        id: `point-${index}`,
        type: "node" as const,
        label: centers.includes(index) ? `c${centers.indexOf(index) + 1}` : ".",
        value: [x, y],
        state: (centers.includes(index) ? "pivot" : "unvisited") as EntityState,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { index, isCenter: centers.includes(index) },
    }));
}

/** The k-means++ seeding generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { points?: Point[]; k?: number; seed?: number } | null) ?? {};
    const points: Point[] = task.points ?? [
        [0, 0],
        [1, 0.2],
        [0.3, 1],
        [8, 8],
        [9, 8.4],
        [8.5, 9],
        [-7, 8],
        [-6.5, 8.6],
    ];
    const k = Math.max(1, Math.min(typeof task.k === "number" ? Math.floor(task.k) : 3, points.length));
    const seed = typeof task.seed === "number" ? Math.floor(task.seed) : 7;
    const random = mulberry32(seed);

    const centers: number[] = [];
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(points, centers),
        edges: [],
        description: `k-means++ seeding for ${k} centers among ${points.length} points using seed ${seed}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { k, seed, centers: [], chosen: 0 },
    };
    step += 1;

    if (points.length === 0) {
        return;
    }

    const first = Math.floor(random() * points.length) % points.length;
    centers.push(first);
    yield {
        stepNumber: step,
        entities: makeEntities(points, centers),
        edges: [],
        description: `First center chosen uniformly at random: point ${first}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { k, seed, centers: [...centers], chosen: 1 },
    };
    step += 1;

    while (centers.length < k) {
        const distances = nearestDistances(points, centers);
        const total = distances.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
        let chosen = -1;
        if (total <= 0) {
            chosen = points.findIndex((_point, index) => !centers.includes(index));
        } else {
            let target = random() * total;
            for (let i = 0; i < points.length; i += 1) {
                const weight = Number.isFinite(distances[i]!) ? distances[i]! : 0;
                target -= weight;
                if (target <= 0) {
                    chosen = i;
                    break;
                }
            }
            if (chosen < 0) {
                chosen = points.length - 1;
            }
        }
        if (chosen < 0) {
            break;
        }
        centers.push(chosen);
        yield {
            stepNumber: step,
            entities: makeEntities(points, centers),
            edges: [],
            description: `Selected point ${chosen} with D-squared weight ${distances[chosen]!.toFixed(2)} out of ${total.toFixed(2)}.`,
            codeLineNumber: 4,
            layout: "point",
            meta: {
                k,
                seed,
                centers: [...centers],
                chosen: centers.length,
                squaredDistances: distances.map((value) =>
                    Number.isFinite(value) ? Number(value.toFixed(4)) : 0,
                ),
                totalWeight: Number(total.toFixed(4)),
            },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(points, centers),
        edges: [],
        description: `Chosen ${centers.length} distinct centers: ${centers.join(", ")}.`,
        codeLineNumber: 5,
        layout: "point",
        meta: { k, seed, centers: [...centers], chosen: centers.length },
    };
}

/** The k-means++ seeding module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Random centers can land two of the k clusters on the same spot. k-means++ avoids that by preferring points far from every center already picked. Think of throwing darts where each point's target area grows with its squared distance to the nearest center, so isolated points almost always get chosen.",
        invariants: [
            "Centers are always actual data points and are never repeated.",
            "The first center is drawn uniformly from all points.",
            "For later centers, each point's selection weight is its squared distance to the nearest chosen center.",
        ],
        correctness:
            "The sampling weights are exactly the squared distances to the nearest chosen center, so any point in an uncovered cluster receives probability proportional to how far it is from coverage. This yields the classical O(log k) approximation guarantee on the initial potential, and the seeded generator makes every choice reproducible.",
        complexityRationale:
            "Selecting each of the k centers scans all n points to recompute distances and cumulative weights, so the total is O(n * k). Only the distance array is extra, giving O(n) space.",
        uses: [
            "Initializing k-means clustering in data pipelines",
            "Choosing diverse seeds for document and image clustering",
            "Any iterative partitioning method sensitive to its start",
        ],
        references: [
            "Arthur and Vassilvitskii, k-means++: The Advantages of Careful Seeding, 2007",
            "Bishop, Pattern Recognition and Machine Learning, Chapter 9, 2006",
        ],
        workedExample:
            "With clusters near (0,0), (8,8), and (-7,8) and seed 7, the first center lands in one cluster. Points in the other two clusters have large squared distances to it, so the weighted draws almost certainly pick one point from each remaining cluster.",
    },
    id: "k-means-plus-plus-seeding",
    name: "k-means++ Seeding",
    category: "ml-ai",
    complexity: { time: "O(n * k)", space: "O(n)" },
    defaultInput: {
        points: [
            [0, 0],
            [1, 0.2],
            [0.3, 1],
            [8, 8],
            [9, 8.4],
            [8.5, 9],
            [-7, 8],
            [-6.5, 8.6],
        ],
        k: 3,
        seed: 7,
    },
    visualType: "point",
    run,
    pseudocode: [
        "choose the first center uniformly at random",
        "while fewer than k centers are chosen",
        "compute each point's squared distance to the nearest center",
        "sample a new center with probability proportional to that distance",
        "add the sampled point to the center set",
        "done: report the k distinct centers",
    ],
};

export default module;
