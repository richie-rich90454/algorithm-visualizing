/**
 * krasnoselskii-mann.ts - Krasnoselskii-Mann Averaged Iteration
 *
 * For a nonexpansive mapping T with a fixed point, the averaged iteration
 * x(n+1) = (1-alpha) x(n) + alpha T(x(n)) converges to a fixed point of T for
 * any alpha in the open interval (0,1). Here T reflects a point across its
 * projection onto a closed interval, so the fixed-point set is that interval.
 *
 * This is a one-dimensional teaching simulation. It does not cover general
 * Hilbert spaces, varying weights, or the quirks of nonconvex fixed-point sets.
 *
 * Time:  O(iterations)
 * Space: O(1) for the iterate and scalars
 */

import type { AlgorithmModule, VisualEntity, VisualFrame } from "@/types";

interface Task {
    start?: number;
    a?: number;
    b?: number;
    alpha?: number;
    iterations?: number;
}

function makeBars(x: number, tx: number, dist: number, proj: number): VisualEntity[] {
    const labels = ["x", "T(x)", "distance", "projection"];
    const values = [x, tx, dist, proj];
    return values.map((v, i) => ({
        id: `bar-${i}`,
        type: "bar" as const,
        label: `${labels[i]}=${v.toFixed(6)}`,
        value: v,
        state: i === 0 ? "comparing" : "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index: i, role: labels[i] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    let x = Number.isFinite(task.start) ? Number(task.start) : 3;
    const a = Number.isFinite(task.a) ? Number(task.a) : -1;
    const b = Number.isFinite(task.b) ? Number(task.b) : 1;
    const alpha = Number.isFinite(task.alpha) && Number(task.alpha) > 0 && Number(task.alpha) < 1 ? Number(task.alpha) : 0.25;
    const iterations = Math.min(500, Math.max(1, Math.floor(Number(task.iterations ?? 40)) || 40));
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const clamp = (v: number): number => Math.max(lo, Math.min(hi, v));
    const T = (v: number): number => 2 * clamp(v) - v;
    const distance = (v: number): number => Math.max(0, lo - v, v - hi);

    yield {
        stepNumber: 0,
        entities: makeBars(x, T(x), distance(x), clamp(x)),
        edges: [],
        description: `Krasnoselskii-Mann iteration on the interval [${lo}, ${hi}] with alpha ${alpha}, starting at x=${x}.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, tx: T(x), distance: distance(x), projection: clamp(x), alpha, iteration: 0, lo, hi },
    };

    let step = 1;
    for (; step <= iterations; step += 1) {
        const tx = T(x);
        x = (1 - alpha) * x + alpha * tx;
        yield {
            stepNumber: step,
            entities: makeBars(x, T(x), distance(x), clamp(x)),
            edges: [],
            description: `Iteration ${step}: x=${x.toFixed(8)}, distance to the fixed set ${distance(x).toExponential(3)}.`,
            codeLineNumber: step === 1 ? 2 : 3,
            layout: "array",
            meta: { x, tx: T(x), distance: distance(x), projection: clamp(x), alpha, iteration: step, lo, hi },
        };
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, T(x), distance(x), clamp(x)),
        edges: [],
        description: `After ${iterations} iterations x=${x.toFixed(10)} and the distance to the fixed set is ${distance(x).toExponential(3)}.`,
        codeLineNumber: 5,
        layout: "array",
        meta: { x, tx: T(x), distance: distance(x), projection: clamp(x), alpha, iteration: iterations, lo, hi, converged: distance(x) < 1e-6 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A nonexpansive map never stretches distances. Iterating it directly can fail to converge, but averaging each move with the current point damps the motion. With any fixed averaging weight strictly between zero and one, the iterates settle onto a fixed point of the map. Here the map reflects a point through its nearest point in an interval, so its fixed points are exactly the points of that interval.",
        invariants: [
            "The averaging weight lies strictly between zero and one.",
            "The map T is nonexpansive because projection is nonexpansive and reflection preserves the contraction factor.",
            "The iterate stays on the line and moves toward the fixed set without oscillation of increasing size.",
        ],
        correctness:
            "For a nonexpansive T the operator (1-alpha)I + alpha T is averaged, and the Krasnoselskii-Mann theorem says its iterates converge weakly to a fixed point of T when fixed points exist. In one dimension weak and strong convergence coincide. For the reflection about the projection onto [lo,hi], T(x)=x exactly on the interval, and outside it the averaged update is a contraction toward the nearest endpoint, so the distance to the interval falls geometrically.",
        complexityRationale:
            "Each iteration computes a projection, a reflection, and an average using a constant number of arithmetic operations, so time is O(iterations) and working space is O(1).",
        uses: [
            "Finding fixed points in convex feasibility problems",
            "Convergent iteration for nonexpansive operators in signal recovery",
            "A teaching bridge between contractions and general fixed-point methods",
        ],
        references: [
            "Krasnoselskii, Two Remarks on the Method of Successive Approximations, 1955",
            "Mann, Mean Value Methods in Iteration, 1953",
        ],
        workedExample:
            "On the interval [-1,1] with start x=3 and alpha=0.25, T(3)=-1 so the first average is 2. The next is 1.5, then 1.125, and the distance to the interval shrinks by a factor of one half each time, approaching the fixed point 1.",
    },
    id: "krasnoselskii-mann",
    name: "Krasnoselskii-Mann Iteration",
    category: "numerical-optimization",
    complexity: { time: "O(iterations)", space: "O(1)" },
    defaultInput: { start: 3, a: -1, b: 1, alpha: 0.25, iterations: 40 },
    visualType: "array",
    run,
    pseudocode: [
        "read the start point, interval, weight, and iteration count",
        "set the current point to the start point",
        "project the current point onto the interval",
        "reflect it to obtain T of the current point",
        "average the current point with T using the weight",
        "replace the current point by that average",
        "repeat for the required number of iterations",
        "done: report the final point and its distance to the fixed set",
    ],
};

export default module;
