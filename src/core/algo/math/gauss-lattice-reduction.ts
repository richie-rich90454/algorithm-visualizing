/**
 * gauss-lattice-reduction.ts - Lagrange-Gauss Lattice Reduction in 2D
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given two independent integer vectors in the plane, Lagrange-Gauss
 * reduction repeatedly shortens the longer vector by an integer multiple of
 * the shorter one and swaps them when necessary. It terminates with a basis
 * whose first vector is the shortest nonzero lattice vector and whose second
 * vector is the next shortest independent one. It is the two-dimensional
 * ancestor of the LLL algorithm.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log max norm) arithmetic operations
 *   Space: O(1) beyond the two basis vectors
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - A small window of lattice points is drawn as nodes.
 *   - The current short vector is GREEN (sorted), the long one BLUE (active).
 *   - Edges connect the origin to both basis vectors; the final frame reports
 *     the squared length of the shortest vector found.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec = [number, number];

function dot(a: Vec, b: Vec): number {
    return a[0] * b[0] + a[1] * b[1];
}

function sqNorm(a: Vec): number {
    return dot(a, a);
}

function cloneVec(v: Vec): Vec {
    return [v[0], v[1]];
}

function makePoints(
    b1: Vec,
    b2: Vec,
    states: Map<string, EntityState>,
    radius: number,
): { entities: VisualEntity[]; edges: VisualFrame["edges"] } {
    const entities: VisualEntity[] = [];
    const seen = new Set<string>();
    const pts: Vec[] = [[0, 0], cloneVec(b1), cloneVec(b2)];
    for (let x = -radius; x <= radius; x += 1) {
        for (let y = -radius; y <= radius; y += 1) pts.push([x, y]);
    }
    for (const [x, y] of pts) {
        const id = `point-${x}-${y}`;
        if (seen.has(id)) continue;
        seen.add(id);
        let state: EntityState = "unvisited";
        if (x === 0 && y === 0) state = "idle";
        if (x === b2[0] && y === b2[1]) state = "active";
        if (x === b1[0] && y === b1[1]) state = "sorted";
        const key = `${x},${y}`;
        entities.push({
            id,
            type: "node" as const,
            label: `(${x},${y})`,
            value: [x, y],
            state: states.get(key) ?? state,
            x,
            y,
            width: 0,
            height: 0,
            metadata: { x, y, squareNorm: x * x + y * y },
        });
    }
    const edges: VisualFrame["edges"] = [];
    if (b1[0] !== 0 || b1[1] !== 0) {
        edges.push({
            id: "edge-origin-b1",
            sourceId: "point-0-0",
            targetId: `point-${b1[0]}-${b1[1]}`,
            label: "b1",
            state: "path",
            directed: true,
        });
    }
    if (b2[0] !== 0 || b2[1] !== 0) {
        edges.push({
            id: "edge-origin-b2",
            sourceId: "point-0-0",
            targetId: `point-${b2[0]}-${b2[1]}`,
            label: "b2",
            state: "active",
            directed: true,
        });
    }
    return { entities, edges };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { basis?: Vec[]; radius?: number } | null) ?? {};
    const raw = task.basis ?? [[1, 3], [4, 1]];
    let b1: Vec = cloneVec(raw[0] ?? [1, 0]);
    let b2: Vec = cloneVec(raw[1] ?? [0, 1]);
    const radius = typeof task.radius === "number" ? Math.max(3, task.radius) : 6;

    let step = 0;
    let swaps = 0;
    let sizeReductions = 0;
    if (sqNorm(b1) > sqNorm(b2)) {
        const t = b1;
        b1 = b2;
        b2 = t;
        swaps += 1;
    }
    let view = makePoints(b1, b2, new Map(), radius);
    yield {
        stepNumber: step,
        entities: view.entities,
        edges: view.edges,
        description: `Reducing the lattice basis (${b1[0]},${b1[1]}), (${b2[0]},${b2[1]}) with Lagrange-Gauss.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { b1: [...b1], b2: [...b2], norm1: sqNorm(b1), norm2: sqNorm(b2), swaps, sizeReductions },
    };
    step += 1;

    for (let guard = 0; guard < 200; guard += 1) {
        if (sqNorm(b2) < sqNorm(b1)) {
            const t = b1;
            b1 = b2;
            b2 = t;
            swaps += 1;
            view = makePoints(b1, b2, new Map(), radius);
            yield {
                stepNumber: step,
                entities: view.entities,
                edges: view.edges,
                description: `Swap: the second vector is shorter, so it becomes b1.`,
                codeLineNumber: 1,
                layout: "point",
                meta: { b1: [...b1], b2: [...b2], norm1: sqNorm(b1), norm2: sqNorm(b2), swaps, sizeReductions },
            };
            step += 1;
        }
        const mu = dot(b2, b1) / sqNorm(b1);
        const q = Math.round(mu);
        if (q !== 0) {
            b2 = [b2[0] - q * b1[0], b2[1] - q * b1[1]];
            sizeReductions += 1;
            view = makePoints(b1, b2, new Map(), radius);
            yield {
                stepNumber: step,
                entities: view.entities,
                edges: view.edges,
                description: `Size reduction: b2 <- b2 - ${q}*b1, giving (${b2[0]},${b2[1]}).`,
                codeLineNumber: 2,
                layout: "point",
                meta: { b1: [...b1], b2: [...b2], norm1: sqNorm(b1), norm2: sqNorm(b2), swaps, sizeReductions, quotient: q },
            };
            step += 1;
            continue;
        }
        break;
    }

    view = makePoints(b1, b2, new Map(), radius);
    yield {
        stepNumber: step,
        entities: view.entities,
        edges: view.edges,
        description: `Gauss-reduced basis: shortest vector (${b1[0]},${b1[1]}) has squared length ${sqNorm(b1)}.`,
        codeLineNumber: 3,
        layout: "point",
        meta: {
            b1: [...b1],
            b2: [...b2],
            norm1: sqNorm(b1),
            norm2: sqNorm(b2),
            determinant: Math.abs(b1[0] * b2[1] - b1[1] * b2[0]),
            swaps,
            sizeReductions,
            reduced: sqNorm(b1) <= sqNorm(b2) && Math.abs(2 * dot(b1, b2)) <= sqNorm(b1),
        },
    };
}

/** The Lagrange-Gauss 2D lattice reduction module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "A lattice basis can be very skewed even though it spans the same grid of points. Lagrange-Gauss repeatedly takes the longer vector and subtracts the largest possible integer multiple of the shorter one, which is just the division algorithm applied to vectors. When subtracting no longer helps, the shorter vector is swapped in. The process mirrors Euclid's gcd algorithm and stops at the shortest possible basis.",
        invariants: [
            "The two basis vectors always generate the same lattice as the input.",
            "The absolute determinant of the basis is unchanged by every step.",
            "After a size reduction the projection of b2 onto b1 has magnitude at most half the length of b1.",
            "The squared length of b1 never increases and strictly drops on a productive step.",
        ],
        correctness:
            "Each size reduction replaces b2 by b2 minus q*b1, an integer unimodular operation that preserves the lattice and the determinant. Choosing the nearest integer q makes the absolute inner product at most half of the squared length of b1. Swapping enforces the ordering of lengths. Because the squared length of the shorter vector strictly decreases whenever work is done and is a positive integer, the loop terminates. At termination the Gauss conditions hold, and the first vector is the shortest nonzero lattice vector.",
        complexityRationale:
            "The algorithm is the Euclidean algorithm on vector lengths, so the number of iterations is logarithmic in the size of the input coordinates; each iteration is a constant number of integer multiplications and additions, giving O(log max norm) time and O(1) extra space.",
        uses: [
            "Finding the shortest vector in a two-dimensional lattice",
            "Reducing bases before lattice-based cryptographic attacks",
            "Computing best approximations and closest lattice points in the plane",
        ],
        references: [
            "Lagrange, Recherches d'arithmetique, 1773",
            "Gauss, Disquisitiones Arithmeticae, Article 171",
        ],
        workedExample:
            "Starting from b1=(1,3) and b2=(4,1), the squared lengths are 10 and 17. The projection of b2 onto b1 is 7/10, so the nearest integer is 1 and b2 becomes (3,-2). Now the squared length is 13, still larger, and the projection rounds to zero, so reduction stops. The vector (1,3) of length squared 10 is the shortest lattice vector.",
    },
    id: "gauss-lattice-reduction",
    name: "Lagrange-Gauss Reduction",
    category: "math",
    complexity: { time: "O(log max norm)", space: "O(1)" },
    defaultInput: { basis: [[1, 3], [4, 1]], radius: 6 },
    visualType: "point",
    run,
    pseudocode: [
        "input two integer vectors b1 and b2 in the plane",
        "if the squared length of b2 is smaller, swap b1 and b2",
        "compute q as the nearest integer to the dot product of b2 and b1 over the norm of b1",
        "replace b2 by b2 minus q times b1",
        "repeat swapping and reducing until q is zero and b1 is no longer than b2",
        "done: return the reduced basis and the shortest squared length",
    ],
};

export default module;
