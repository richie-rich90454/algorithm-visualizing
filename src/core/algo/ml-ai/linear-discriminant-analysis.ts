/**
 * linear-discriminant-analysis.ts - Fisher's Linear Discriminant (Two Classes)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fisher's linear discriminant finds the single direction that best separates
 * two classes. It maximizes the distance between the projected class means
 * relative to the spread of the projected points, which leads to the closed
 * form w proportional to the inverse within-class scatter times the difference
 * of the means. Points are projected onto that direction and split at the
 * midpoint of the projected means. This module implements the exact two-class,
 * two-dimensional computation, including the scatter matrices, the direction,
 * and the resulting classifier.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(n * d^2) for scatter accumulation with d = 2, so O(n)
 *   Space: O(n) for the points and their projections
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each training point is placed at its coordinates, colored by class.
 *   - During projection the label shows each point's scalar score on w.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec2 = [number, number];

interface LdaInput {
    class0?: Vec2[];
    class1?: Vec2[];
}

interface Scatter {
    a: number;
    b: number;
    d: number;
}

function mean(points: Vec2[]): Vec2 {
    if (points.length === 0) {
        return [0, 0];
    }
    return [
        points.reduce((s, p) => s + p[0], 0) / points.length,
        points.reduce((s, p) => s + p[1], 0) / points.length,
    ];
}

function withinScatter(points: Vec2[], m: Vec2, acc: Scatter): Scatter {
    let a = acc.a;
    let b = acc.b;
    let d = acc.d;
    for (const p of points) {
        const dx = p[0] - m[0];
        const dy = p[1] - m[1];
        a += dx * dx;
        b += dx * dy;
        d += dy * dy;
    }
    return { a, b, d };
}

function project(w: Vec2, p: Vec2): number {
    return w[0] * p[0] + w[1] * p[1];
}

function makeEntities(
    class0: Vec2[],
    class1: Vec2[],
    projections: number[],
    phase: number,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    const groups: Array<{ points: Vec2[]; cls: number }> = [
        { points: class0, cls: 0 },
        { points: class1, cls: 1 },
    ];
    for (const group of groups) {
        for (let i = 0; i < group.points.length; i += 1) {
            const p = group.points[i]!;
            const index = group.cls === 0 ? i : class0.length + i;
            const state: EntityState = phase >= 3 ? (group.cls === 1 ? "path" : "sorted") : group.cls === 1 ? "comparing" : "active";
            entities.push({
                id: `point-${index}`,
                type: "node",
                label: phase >= 2 ? `y=${(projections[index] ?? 0).toFixed(2)}` : `c${group.cls}`,
                value: Number((projections[index] ?? 0).toFixed(6)),
                state,
                x: p[0],
                y: p[1],
                width: 0,
                height: 0,
                metadata: { index, cls: group.cls, x: p[0], y: p[1] },
            });
        }
    }
    return entities;
}

/** Compute Fisher's two-class linear discriminant and classify the points. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as LdaInput | null) ?? {};
    const class0: Vec2[] = Array.isArray(task.class0) && task.class0.length > 0 ? task.class0.map((p) => [...p]) : [[0, 0], [1, 0], [0, 1], [1, 1]];
    const class1: Vec2[] = Array.isArray(task.class1) && task.class1.length > 0 ? task.class1.map((p) => [...p]) : [[4, 4], [5, 4], [4, 5], [5, 5]];
    const m0 = mean(class0);
    const m1 = mean(class1);
    const diff: Vec2 = [m1[0] - m0[0], m1[1] - m0[1]];

    const sw = withinScatter(class0, m0, withinScatter(class1, m1, { a: 0, b: 0, d: 0 }));
    const det = sw.a * sw.d - sw.b * sw.b;
    let direction: Vec2;
    if (Math.abs(det) > 1e-12) {
        direction = [
            (sw.d * diff[0] - sw.b * diff[1]) / det,
            (-sw.b * diff[0] + sw.a * diff[1]) / det,
        ];
    } else {
        direction = [...diff];
    }
    const norm = Math.hypot(direction[0], direction[1]) || 1;
    const w: Vec2 = [direction[0] / norm, direction[1] / norm];

    const all = [...class0, ...class1];
    const projections = all.map((p) => project(w, p));
    const threshold = (project(w, m0) + project(w, m1)) / 2;
    let correct = 0;
    for (let i = 0; i < all.length; i += 1) {
        const predicted = (projections[i] ?? 0) >= threshold ? 1 : 0;
        if (predicted === (i < class0.length ? 0 : 1)) {
            correct += 1;
        }
    }
    const accuracy = all.length > 0 ? Number((correct / all.length).toFixed(6)) : 0;

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(class0, class1, projections, 0),
        edges: [],
        description: `Fisher LDA on ${all.length} points in two classes with two features each.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { n: all.length, m0, m1, sw: [sw.a, sw.b, sw.b, sw.d], w: [0, 0], threshold: 0, accuracy: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(class0, class1, projections, 1),
        edges: [],
        description: `Class means: c0 = (${m0[0].toFixed(2)}, ${m0[1].toFixed(2)}), c1 = (${m1[0].toFixed(2)}, ${m1[1].toFixed(2)}).`,
        codeLineNumber: 1,
        layout: "point",
        meta: { n: all.length, m0, m1, sw: [sw.a, sw.b, sw.b, sw.d], w: [0, 0], threshold: 0, accuracy: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(class0, class1, projections, 1),
        edges: [],
        description: `Within-class scatter matrix has entries ${sw.a.toFixed(2)}, ${sw.b.toFixed(2)}, ${sw.b.toFixed(2)}, ${sw.d.toFixed(2)}.`,
        codeLineNumber: 2,
        layout: "point",
        meta: { n: all.length, m0, m1, sw: [sw.a, sw.b, sw.b, sw.d], w: [0, 0], threshold: 0, accuracy: 0, det },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(class0, class1, projections, 2),
        edges: [],
        description: `Optimal direction w = inverse(S_W) times (m1 - m0) = (${w[0].toFixed(3)}, ${w[1].toFixed(3)}), normalized.`,
        codeLineNumber: 4,
        layout: "point",
        meta: { n: all.length, m0, m1, sw: [sw.a, sw.b, sw.b, sw.d], w, threshold: 0, accuracy: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(class0, class1, projections, 3),
        edges: [],
        description: `Projected class means are ${project(w, m0).toFixed(3)} and ${project(w, m1).toFixed(3)}; classify above threshold ${threshold.toFixed(3)} as class 1.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { n: all.length, m0, m1, sw: [sw.a, sw.b, sw.b, sw.d], w, threshold: Number(threshold.toFixed(9)), projections, accuracy },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(class0, class1, projections, 3),
        edges: [],
        description: `Done: ${correct} of ${all.length} points classified correctly (accuracy ${(accuracy * 100).toFixed(0)}%).`,
        codeLineNumber: 7,
        layout: "point",
        meta: { n: all.length, m0, m1, sw: [sw.a, sw.b, sw.b, sw.d], w, threshold: Number(threshold.toFixed(9)), projections, accuracy, correct },
    };
}

/** The Fisher LDA module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "If you must collapse several features into one score, choose the axis that pulls the two class centers far apart while keeping each class tight. Fisher's ratio measures exactly that trade-off. Maximizing it reduces to solving a small linear system with the within-class scatter matrix, giving a direction you can project every point onto and then pick a split point between the two class averages.",
        invariants: [
            "The within-class scatter sums the outer products of each point's deviation from its own class mean.",
            "The optimal direction satisfies S_W times w proportional to the difference of class means.",
            "The projection is a scalar and the threshold is the midpoint of the projected class means.",
        ],
        correctness:
            "The Rayleigh quotient of a direction w is (w transpose S_B w) over (w transpose S_W w). Setting its derivative to zero gives S_B w proportional to S_W w, and because S_B is the outer product of the mean difference with itself, w is proportional to the inverse of S_W times that difference. Multiplying by the inverse 2 by 2 matrix via its adjugate over the determinant, then normalizing, yields the reported direction; projecting the means and splitting at their midpoint is the Bayes rule for equal spherical Gaussian classes.",
        complexityRationale:
            "Accumulating scatter visits every point and updates four matrix entries, O(n) in total for d = 2. Inverting a 2 by 2 matrix and projecting the points are constant or linear work, and storing the points and projections uses O(n) space.",
        uses: [
            "Dimensionality reduction before classification",
            "Face recognition and biometric feature extraction",
            "A closed-form baseline for two-class supervised projection",
        ],
        references: [
            "Fisher, The Use of Multiple Measurements in Taxonomic Problems, 1936",
            "Hastie, Tibshirani and Friedman, The Elements of Statistical Learning, Chapter 4, 2009",
        ],
        workedExample:
            "Class 0 has points around (0.5, 0.5) and class 1 around (4.5, 4.5). The mean difference points up and to the right. Because each class is roughly spherical, the within-class scatter is a multiple of the identity, so the inverse leaves the direction unchanged; after normalization w points along (1, 1) divided by the square root of two, and points near (2.5, 2.5) sit at the decision threshold.",
    },
    id: "linear-discriminant-analysis",
    name: "Linear Discriminant Analysis (Fisher, Two Classes)",
    category: "ml-ai",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: {
        class0: [[0, 0], [1, 0], [0, 1], [1, 1]],
        class1: [[4, 4], [5, 4], [4, 5], [5, 5]],
    },
    visualType: "point",
    run,
    pseudocode: [
        "read the two classes of labeled points",
        "compute each class mean m0 and m1",
        "accumulate the within-class scatter matrix S_W",
        "form the mean difference d = m1 minus m0",
        "set w to inverse(S_W) times d and normalize it",
        "project every point onto w",
        "set the threshold to the midpoint of the projected means",
        "classify each point and report accuracy",
    ],
};

export default module;
