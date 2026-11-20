/**
 * quadratic-equation-solver.ts - Robust Quadratic Equation Solver
 *
 * Computes the real roots of a*x^2 + b*x + c = 0 using the discriminant and a
 * numerically stable reformulation that avoids cancellation when one root is
 * much smaller than the other. A linear or degenerate input is handled too.
 *
 *   Time:  O(samples) frames, O(1) algebra
 *   Space: O(samples) for the plotted parabola points
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface QuadraticInput {
    a?: number;
    b?: number;
    c?: number;
    samples?: number;
}

function parabolaPoints(a: number, b: number, c: number, count: number): Array<[number, number]> {
    const span = 6;
    const points: Array<[number, number]> = [];
    for (let i = 0; i < count; i += 1) {
        const x = -span + (2 * span * i) / Math.max(1, count - 1);
        points.push([x, a * x * x + b * x + c]);
    }
    return points;
}

function makeEntities(
    points: Array<[number, number]>,
    roots: number[],
    vertexX: number,
    vertexY: number,
    phase: "setup" | "vertex" | "roots" | "done",
): VisualEntity[] {
    return points.map(([x, y], index) => {
        let state: EntityState = "idle";
        if (phase !== "setup") {
            const nearVertex = Math.abs(x - vertexX) < 0.35;
            const nearRoot = roots.some((r) => Math.abs(x - r) < 0.35);
            if (nearVertex && phase === "vertex") {
                state = "active";
            }
            if (nearRoot && (phase === "roots" || phase === "done")) {
                state = "sorted";
            }
            if (!nearVertex && !nearRoot) {
                state = "idle";
            }
        }
        return {
            id: `sample-${index}`,
            type: "node" as const,
            label: y.toFixed(2),
            value: y,
            state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { index, sampleX: x, sampleY: y, vertexY },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as QuadraticInput | null) ?? {};
    const a = typeof task.a === "number" && Number.isFinite(task.a) ? task.a : 1;
    const b = typeof task.b === "number" && Number.isFinite(task.b) ? task.b : -3;
    const c = typeof task.c === "number" && Number.isFinite(task.c) ? task.c : 2;
    const count = typeof task.samples === "number" && task.samples >= 4 ? Math.trunc(task.samples) : 24;
    const points = parabolaPoints(a, b, c, count);
    const vertexX = a === 0 ? 0 : -b / (2 * a);
    const vertexY = a * vertexX * vertexX + b * vertexX + c;

    let discriminant: number;
    let roots: number[] = [];
    let nature: string;
    if (a === 0) {
        discriminant = 0;
        if (b === 0) {
            nature = "degenerate: no equation";
        } else {
            roots = [-c / b];
            nature = "linear: one root";
        }
    } else {
        discriminant = b * b - 4 * a * c;
        if (discriminant > 0) {
            const sqrtD = Math.sqrt(discriminant);
            const q = -0.5 * (b + (b >= 0 ? sqrtD : -sqrtD));
            roots = q === 0 ? [0] : [q / a, c / q];
            roots.sort((p, r) => p - r);
            nature = "two distinct real roots";
        } else if (discriminant === 0) {
            roots = [-b / (2 * a)];
            nature = "one repeated real root";
        } else {
            nature = "two complex roots";
        }
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeEntities(points, roots, vertexX, vertexY, "setup"),
        edges: [],
        description: `Plot ${count} samples of ${a}x^2 + ${b}x + ${c} to inspect the parabola.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { rows: 1, cols: count, a, b, c, discriminant, nature, roots: roots.slice(), rootCount: roots.length },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(points, roots, vertexX, vertexY, "vertex"),
        edges: [],
        description: `The vertex is at x = ${vertexX.toFixed(4)}; the discriminant is ${discriminant.toFixed(4)}.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { rows: 1, cols: count, a, b, c, discriminant, nature, vertexX, vertexY, roots: roots.slice() },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeEntities(points, roots, vertexX, vertexY, "roots"),
        edges: [],
        description: `The discriminant gives ${nature}; the real crossings are highlighted.`,
        codeLineNumber: discriminant >= 0 ? 2 : 5,
        layout: "point",
        meta: { rows: 1, cols: count, a, b, c, discriminant, nature, roots: roots.slice(), rootCount: roots.length },
    };
    step += 1;

    const residual = roots.reduce((worst, r) => Math.max(worst, Math.abs(a * r * r + b * r + c)), 0);
    yield {
        stepNumber: step,
        entities: makeEntities(points, roots, vertexX, vertexY, "done"),
        edges: [],
        description: roots.length > 0
            ? `Done: roots ${roots.map((r) => r.toFixed(6)).join(" and ")} with worst residual ${residual.toExponential(2)}.`
            : `Done: ${nature}, so there are no real roots to plot.`,
        codeLineNumber: 6,
        layout: "point",
        meta: { rows: 1, cols: count, a, b, c, discriminant, nature, roots: roots.slice(), rootCount: roots.length, residual },
    };
}

const module: AlgorithmModule = {
    id: "quadratic-equation-solver",
    name: "Quadratic Equation Solver",
    category: "math",
    complexity: { time: "O(1) algebra, O(samples) plotting", space: "O(samples)" },
    defaultInput: { a: 1, b: -3, c: 2, samples: 24 },
    visualType: "point",
    run,
    pseudocode: [
        "read the coefficients a, b, and c",
        "compute the discriminant D = b squared minus 4ac",
        "if D is positive form q = -(b + sign(b) times sqrt(D)) / 2",
        "the two roots are q/a and c/q",
        "if D is zero the single root is -b/(2a)",
        "if D is negative report two complex roots",
        "done: report the real roots and their residuals",
    ],
    education: {
        intuition:
            "The quadratic formula gives the roots of a parabola, but subtracting b from a nearby square root can erase the smaller root. Computing an intermediate quantity q first and forming one root as q/a and the other as c/q keeps both roots accurate even when they have very different sizes.",
        invariants: [
            "The discriminant D equals b squared minus four times a times c.",
            "The two real roots multiply to c/a and add to minus b/a.",
            "Every reported root makes the polynomial evaluate to nearly zero.",
        ],
        correctness:
            "For a nonzero discriminant the identity q/a times c/q equals c/a and q/a plus c/q equals minus b/a, so the pair satisfies Vieta's relations; substituting either expression into the quadratic reduces to the defining equation for q, which is true because q was built from the square root of the discriminant. The repeated-root and linear cases follow directly from factoring, and complex roots are detected by a negative discriminant.",
        complexityRationale:
            "Finding the roots is a fixed number of arithmetic operations, O(1) time and space. The visualization samples a fixed number of parabola points, adding O(samples) work only for drawing.",
        uses: [
            "Locating break-even points in cost and revenue models",
            "Computing intersection times in projectile motion",
            "Solving characteristic equations in engineering analysis",
        ],
        references: [
            "Wikipedia, Quadratic equation, numerically stable formulation",
            "Higham, Accuracy and Stability of Numerical Algorithms, Chapter 1",
        ],
        workedExample:
            "For x squared minus three x plus two the discriminant is 9 minus 8 = 1. With b negative, q = -(-3 - 1)/2 = 2, so the roots are 2/1 = 2 and 2/2 = 1, both of which make the polynomial zero.",
    },
};

export default module;
