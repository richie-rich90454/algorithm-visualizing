/**
 * broydens-method.ts - Broyden's Good Method for Nonlinear Systems
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Broyden's method solves F(x) = 0 without recomputing a full Jacobian at every
 * iterate. It starts from an approximate Jacobian (often the identity), takes a
 * quasi-Newton step, and applies a rank-one update that makes the new Jacobian
 * satisfy the secant condition on the step just taken. This is the "good"
 * Broyden update, using the displacement in the denominator.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * d^2) for a d-dimensional system
 *   Space: O(d^2) for the Jacobian approximation
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Three bars show the current x, y, and residual norm.
 *   - The residual bar starts yellow and turns green when the root is found.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mat2 = [number, number, number, number]; // [a11, a12, a21, a22]

/** Linear system F(x,y) = A [x,y] - b with a known root. */
const A: Mat2 = [1, 2, 3, -1];
const B: [number, number] = [3, 1];

function residual(x: number, y: number): [number, number] {
    return [A[0] * x + A[1] * y - B[0], A[2] * x + A[3] * y - B[1]];
}

function norm(r: [number, number]): number {
    return Math.hypot(r[0], r[1]);
}

/** Solve a 2 by 2 linear system M s = rhs. */
function solve2(m: Mat2, rhs: [number, number]): [number, number] {
    const det = m[0] * m[3] - m[1] * m[2];
    if (det === 0) {
        return [0, 0];
    }
    return [
        (rhs[0] * m[3] - m[1] * rhs[1]) / det,
        (m[0] * rhs[1] - rhs[0] * m[2]) / det,
    ];
}

function makeBars(x: number, y: number, converged: boolean): VisualEntity[] {
    const values = [x, y, norm(residual(x, y))];
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: value.toFixed(5),
        value,
        state: (index === 2 ? (converged ? "sorted" : "comparing") : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, role: index === 0 ? "x" : index === 1 ? "y" : "residual" },
    }));
}

/** Replay the good Broyden update on a two-dimensional system. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { x0?: number; y0?: number; iterations?: number } | null) ?? {};
    let x = typeof task.x0 === "number" ? task.x0 : 0;
    let y = typeof task.y0 === "number" ? task.y0 : 0;
    const iterations =
        typeof task.iterations === "number" ? Math.max(1, Math.floor(task.iterations)) : 12;

    let j: Mat2 = [1, 0, 0, 1];
    let r = residual(x, y);

    yield {
        stepNumber: 0,
        entities: makeBars(x, y, false),
        edges: [],
        description: `Start at (${x}, ${y}) with residual norm ${norm(r).toFixed(5)} and identity Jacobian.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { x, y, residual: norm(r), iteration: 0 },
    };

    let step = 1;
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
        const stepVec = solve2(j, [-r[0], -r[1]]);
        const sx = stepVec[0];
        const sy = stepVec[1];
        x += sx;
        y += sy;
        const newR = residual(x, y);

        const denominator = sx * sx + sy * sy;
        if (denominator !== 0) {
            // Good Broyden: A_new = A + (F_new - A s) s^T / (s^T s).
            // Since A s = -F, the numerator simplifies to F_new s^T.
            const next: Mat2 = [
                j[0] + (newR[0] * sx) / denominator,
                j[1] + (newR[0] * sy) / denominator,
                j[2] + (newR[1] * sx) / denominator,
                j[3] + (newR[1] * sy) / denominator,
            ];
            j = next;
        }

        r = newR;
        const converged = norm(r) < 1e-10;
        yield {
            stepNumber: step,
            entities: makeBars(x, y, converged),
            edges: [],
            description: `Iteration ${iteration}: quasi-Newton step reaches (${x.toFixed(6)}, ${y.toFixed(6)}) with residual ${norm(r).toExponential(2)}.`,
            codeLineNumber: 2,
            layout: "array",
            meta: { x, y, residual: norm(r), iteration },
        };
        step += 1;
        if (converged) {
            break;
        }
    }

    yield {
        stepNumber: step,
        entities: makeBars(x, y, true),
        edges: [],
        description: `Root approximated as (${x.toFixed(8)}, ${y.toFixed(8)}) with residual ${norm(r).toExponential(2)}.`,
        codeLineNumber: 6,
        layout: "array",
        meta: { x, y, residual: norm(r), iteration: step - 1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Newton's method for systems needs a fresh Jacobian each step, which is costly. Broyden instead keeps one Jacobian and nudges it after each step so that it correctly predicts the gradient change just observed. Only a rank-one correction is applied, so the method gets much of Newton's speed without repeatedly differentiating the system.",
        invariants: [
            "The Jacobian approximation satisfies the secant condition after each update.",
            "Each step solves the linearized system using the current Jacobian.",
            "The residual norm decreases toward zero near a simple root.",
        ],
        correctness:
            "The good Broyden update is the rank-one change of smallest norm that makes the new Jacobian map the step onto the observed residual change, so the secant condition holds exactly. The resulting quasi-Newton steps are locally superlinearly convergent for a continuously differentiable system with a nonsingular Jacobian. Here the system is linear, so once the approximation has learned the true Jacobian the next step solves it exactly.",
        complexityRationale:
            "Each iteration solves a d by d linear system and performs a rank-one outer-product update, both O(d^2) time. The Jacobian approximation occupies O(d^2) space.",
        uses: [
            "Solving nonlinear equations in scientific simulation",
            "Root finding inside physics and chemistry solvers",
            "Large systems where forming a full Jacobian is too expensive",
        ],
        references: [
            "Broyden, A Class of Quasi-Newton Methods for the Solution of Nonlinear Equations, 1965",
            "Nocedal and Wright, Numerical Optimization, Chapter 11",
        ],
        workedExample:
            "For the linear system x + 2y = 3 and 3x - y = 1, starting at (0, 0) with the identity Jacobian, Broyden steps toward the root. Within a few updates the Jacobian matches [[1, 2], [3, -1]], and the iterates converge to (5/7, 8/7), where the residual is zero.",
    },
    id: "broydens-method",
    name: "Broyden's Method",
    category: "numerical-optimization",
    complexity: { time: "O(iterations * d^2)", space: "O(d^2)" },
    defaultInput: { x0: 0, y0: 0, iterations: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "start with a point and an approximate Jacobian",
        "for each iteration evaluate the residual at the current point",
        "solve the linearized system for the quasi-Newton step",
        "move to the new point and measure the residual change",
        "apply the rank-one good Broyden update to the Jacobian",
        "stop when the residual norm is tiny",
        "done: report the approximate root and residual",
    ],
};

export default module;
