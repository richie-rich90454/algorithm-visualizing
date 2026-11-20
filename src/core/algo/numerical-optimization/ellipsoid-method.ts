/**
 * ellipsoid-method.ts - Khachiyan's Ellipsoid Method (2D feasibility)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The ellipsoid method solves a convex feasibility problem without ever
 * visiting a vertex. It starts with an ellipsoid known to contain the feasible
 * region. If the center violates a constraint, that constraint cuts the region
 * in half; the algorithm replaces the ellipsoid with the smallest ellipsoid
 * covering the surviving half. The volume shrinks by a fixed factor on every
 * cut, so after a polynomial number of steps either the center is feasible or
 * the region is too small to exist. This module implements the two-dimensional
 * center-cut update with an explicit shape matrix.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(iterations * constraints) for the violation scan and update
 *   Space: O(constraints + iterations) for the feasible vertices shown
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The center node is the current ellipsoid center.
 *   - Outline nodes are vertices of the feasible polygon.
 *   - The meta reports the center, ellipsoid axes, and the determinant ratio.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Constraint {
    a: [number, number];
    b: number;
}

interface EllipsoidInput {
    constraints?: Constraint[];
    radius?: number;
    iterations?: number;
}

interface Ellipsoid {
    cx: number;
    cy: number;
    q00: number;
    q01: number;
    q11: number;
}

/** Determinant of the 2 by 2 shape matrix. */
function determinant(e: Ellipsoid): number {
    return e.q00 * e.q11 - e.q01 * e.q01;
}

/** Apply the minimum-volume half-ellipsoid cut through the center. */
function cut(e: Ellipsoid, a: [number, number]): Ellipsoid {
    const qa0 = e.q00 * a[0] + e.q01 * a[1];
    const qa1 = e.q01 * a[0] + e.q11 * a[1];
    const tau = a[0] * qa0 + a[1] * qa1;
    const scale = Math.sqrt(Math.max(tau, 1e-18));
    const p0 = qa0 / scale;
    const p1 = qa1 / scale;
    const factor = 4 / 3;
    const shrink = 2 / 3;
    return {
        cx: e.cx - p0 / 3,
        cy: e.cy - p1 / 3,
        q00: factor * (e.q00 - shrink * p0 * p0),
        q01: factor * (e.q01 - shrink * p0 * p1),
        q11: factor * (e.q11 - shrink * p1 * p1),
    };
}

/** First constraint violated at the current center, or null. */
function violated(constraints: Constraint[], e: Ellipsoid): Constraint | null {
    for (const constraint of constraints) {
        if (constraint.a[0] * e.cx + constraint.a[1] * e.cy > constraint.b + 1e-9) {
            return constraint;
        }
    }
    return null;
}

/** Enumerate feasible polygon vertices by intersecting every constraint pair. */
function vertices(constraints: Constraint[]): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    for (let i = 0; i < constraints.length; i += 1) {
        for (let j = i + 1; j < constraints.length; j += 1) {
            const left = constraints[i]!;
            const right = constraints[j]!;
            const det = left.a[0] * right.a[1] - left.a[1] * right.a[0];
            if (Math.abs(det) < 1e-12) continue;
            const x = (left.b * right.a[1] - right.b * left.a[1]) / det;
            const y = (left.a[0] * right.b - right.a[0] * left.b) / det;
            if (constraints.every((c) => c.a[0] * x + c.a[1] * y <= c.b + 1e-9)) {
                points.push([x, y]);
            }
        }
    }
    return points;
}

function inside(e: Ellipsoid, x: number, y: number): boolean {
    const dx = x - e.cx;
    const dy = y - e.cy;
    const det = determinant(e);
    if (det <= 0) return false;
    const form = (dx * dx * e.q11 - 2 * dx * dy * e.q01 + dy * dy * e.q00) / det;
    return form <= 1 + 1e-7;
}

function makeEntities(e: Ellipsoid, points: Array<[number, number]>): VisualEntity[] {
    const center: VisualEntity = {
        id: "center",
        type: "node",
        label: "center",
        value: [e.cx, e.cy],
        state: "active" as EntityState,
        x: e.cx,
        y: e.cy,
        width: 0,
        height: 0,
        metadata: { kind: "center" },
    };
    return [
        center,
        ...points.map((point, index) => ({
            id: `vertex-${index}`,
            type: "node" as const,
            label: `(${point[0].toFixed(1)},${point[1].toFixed(1)})`,
            value: point,
            state: (inside(e, point[0], point[1]) ? "sorted" : "error") as EntityState,
            x: point[0],
            y: point[1],
            width: 0,
            height: 0,
            metadata: { kind: "vertex", col: index },
        })),
    ];
}

/** The ellipsoid method generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as EllipsoidInput | null) ?? {};
    const constraints: Constraint[] =
        Array.isArray(task.constraints) && task.constraints.length > 0
            ? task.constraints
                  .filter((c): c is Constraint =>
                      !!c && Array.isArray(c.a) && c.a.length === 2 && typeof c.b === "number")
                  .map((c) => ({ a: [c.a[0], c.a[1]] as [number, number], b: c.b }))
            : [
                  { a: [-1, 0], b: -1 },
                  { a: [1, 0], b: 4 },
                  { a: [0, -1], b: -1 },
                  { a: [0, 1], b: 3 },
                  { a: [1, 1], b: 6 },
              ];
    const radius = typeof task.radius === "number" && task.radius > 0 ? task.radius : 10;
    const iterations = typeof task.iterations === "number" && task.iterations >= 1 ? Math.floor(task.iterations) : 30;
    const feasibleVertices = vertices(constraints);
    let ellipsoid: Ellipsoid = { cx: 0, cy: 0, q00: radius * radius, q01: 0, q11: radius * radius };
    let step = 0;

    const meta = (iteration: number, done: boolean, feasible: boolean, det: number) => {
        const trace = ellipsoid.q00 + ellipsoid.q11;
        const diff = Math.sqrt((ellipsoid.q00 - ellipsoid.q11) ** 2 + 4 * ellipsoid.q01 ** 2);
        const l1 = (trace + diff) / 2;
        const l2 = Math.max(1e-12, (trace - diff) / 2);
        return {
            cx: ellipsoid.cx,
            cy: ellipsoid.cy,
            axisA: Math.sqrt(Math.max(0, l1)),
            axisB: Math.sqrt(l2),
            angle: 0.5 * Math.atan2(2 * ellipsoid.q01, ellipsoid.q00 - ellipsoid.q11),
            determinant: det,
            iteration,
            iterations,
            feasible,
            done,
            volumeFactor: 16 / 27,
        };
    };

    yield {
        stepNumber: step++,
        entities: makeEntities(ellipsoid, feasibleVertices),
        edges: [],
        description: `Starting with a radius ${radius} ellipsoid covering ${constraints.length} constraint(s).`,
        codeLineNumber: 0,
        layout: "point",
        meta: meta(0, false, false, determinant(ellipsoid)),
    };

    let cutCount = 0;
    for (let iteration = 0; iteration < iterations; iteration += 1) {
        const bad = violated(constraints, ellipsoid);
        if (!bad) {
            yield {
                stepNumber: step++,
                entities: makeEntities(ellipsoid, feasibleVertices),
                edges: [],
                description: `Center (${ellipsoid.cx.toFixed(3)}, ${ellipsoid.cy.toFixed(3)}) satisfies every constraint; feasible point found.`,
                codeLineNumber: 2,
                layout: "point",
                meta: meta(iteration, true, true, determinant(ellipsoid)),
            };
            break;
        }
        ellipsoid = cut(ellipsoid, bad.a);
        cutCount += 1;
        yield {
            stepNumber: step++,
            entities: makeEntities(ellipsoid, feasibleVertices),
            edges: [],
            description: `Cut ${cutCount}: violated constraint (${bad.a[0]}, ${bad.a[1]}) dot x <= ${bad.b}; volume shrank by 16/27.`,
            codeLineNumber: 5,
            layout: "point",
            meta: meta(cutCount, false, false, determinant(ellipsoid)),
        };
    }

    const finalFeasible = !violated(constraints, ellipsoid);
    yield {
        stepNumber: step,
        entities: makeEntities(ellipsoid, feasibleVertices),
        edges: [],
        description: finalFeasible
            ? `Feasible center (${ellipsoid.cx.toFixed(3)}, ${ellipsoid.cy.toFixed(3)}) after ${cutCount} cut(s).`
            : `Stopped after ${cutCount} cut(s) without a feasible center.`,
        codeLineNumber: 7,
        layout: "point",
        meta: meta(cutCount, true, finalFeasible, determinant(ellipsoid)),
    };
}

/** The ellipsoid method module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Rather than searching along the boundary of a feasible region, the ellipsoid method keeps a smooth shape around everything that could be a solution. If its center is illegal, the violated constraint slices the shape in half and a smaller ellipsoid is fitted around the legal half. Each slice removes a fixed fraction of the volume, so after polynomially many steps the remaining shape is tiny and its center must be feasible if any solution exists. The method's importance is theoretical: it was the first polynomial-time algorithm for linear programming.",
        invariants: [
            "The feasible region always stays inside the current ellipsoid.",
            "Each cut keeps only the half where the violated constraint holds.",
            "The determinant of the shape matrix shrinks by exactly 16/27 per cut in two dimensions.",
            "The center is feasible exactly when no constraint is violated.",
        ],
        correctness:
            "The half-ellipsoid update is the minimum-volume ellipsoid containing the intersection of the old ellipsoid with the violated half-space, a classical result from the ellipsoid method. By induction the feasible set remains inside the new ellipsoid. The determinant identity det(Q') = 16/27 det(Q) follows from the matrix determinant lemma and shows the volume decreases geometrically, so a feasible point is found in a number of steps polynomial in the input size and the desired accuracy; if the volume falls below that of any feasible set, infeasibility is certified.",
        complexityRationale:
            "Each iteration scans m constraints to find a violation and performs a constant-size matrix update, giving O(m) work per cut. Only the current shape and the displayed vertices are stored, O(m) space for the constraint list.",
        uses: [
            "Polynomial-time solvability proof for linear programming",
            "Feasibility checks in convex optimization",
            "Integer programming via the ellipsoid method over rational data",
        ],
        references: [
            "Khachiyan, A Polynomial Algorithm in Linear Programming, 1979",
            "Bland, Goldfarb, and Todd, The Ellipsoid Method: A Survey, 1981",
        ],
        workedExample:
            "Start with a circle of radius 10 centered at the origin and the box 1 <= x <= 4, 1 <= y <= 3. The center violates x >= 1, so a cut moves it right and turns the circle into a smaller tilted ellipse. Repeating for the remaining violated bounds walks the center into the box; after finitely many cuts the center satisfies all four bounds and the method stops.",
    },
    id: "ellipsoid-method",
    name: "Ellipsoid Method (2D Feasibility)",
    category: "numerical-optimization",
    complexity: { time: "O(m per cut)", space: "O(m)" },
    defaultInput: {
        constraints: [
            { a: [-1, 0], b: -1 },
            { a: [1, 0], b: 4 },
            { a: [0, -1], b: -1 },
            { a: [0, 1], b: 3 },
            { a: [1, 1], b: 6 },
        ],
        radius: 10,
        iterations: 30,
    },
    visualType: "point",
    run,
    pseudocode: [
        "start with a ball that contains the feasible region",
        "at the center find any violated constraint",
        "if none is found, the center is feasible and stop",
        "compute the shape matrix times the constraint normal",
        "move the center by one third of the normalized direction",
        "fit the minimum ellipsoid around the surviving half",
        "repeat until feasible or the iteration limit is reached",
        "done: report the center and the final volume bound",
    ],
};

export default module;
