/**
 * babai-nearest-plane.ts - Babai's Nearest Plane CVP Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Given a basis of a lattice and a target point, Babai's nearest-plane method
 * finds a close lattice vector. It orthogonalizes the basis (Gram-Schmidt),
 * then walks from the last vector to the first, rounding the projection of the
 * current residual onto each orthogonal direction and subtracting the matching
 * lattice vector. The residual shrinks at every step, leaving a close point.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3) for Gram-Schmidt plus O(n^2) rounding in dimension n
 *   Space: O(n^2) for the orthogonalized basis
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Lattice points are small GREY nodes; the target is an amber node.
 *   - The orthogonalized directions appear as comparing edges.
 *   - The residual point moves each step; the final lattice point is GREEN.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec = number[];

function dot(a: Vec, b: Vec): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        sum += (a[i] ?? 0) * (b[i] ?? 0);
    }
    return sum;
}

function scale(v: Vec, s: number): Vec {
    return v.map((x) => x * s);
}

function sub(a: Vec, b: Vec): Vec {
    return a.map((x, i) => x - (b[i] ?? 0));
}

function add(a: Vec, b: Vec): Vec {
    return a.map((x, i) => x + (b[i] ?? 0));
}

function norm(v: Vec): number {
    return Math.sqrt(dot(v, v));
}

/** Gram-Schmidt orthogonalization with the mu coefficients. */
function gramSchmidt(basis: Vec[]): { bstar: Vec[]; mu: number[][] } {
    const bstar: Vec[] = [];
    const mu: number[][] = [];
    for (let i = 0; i < basis.length; i += 1) {
        let v = (basis[i] ?? []).slice();
        mu.push(new Array<number>(basis.length).fill(0));
        for (let j = 0; j < i; j += 1) {
            const bj = bstar[j];
            if (!bj) {
                continue;
            }
            const coefficient = dot(basis[i] ?? [], bj) / dot(bj, bj);
            mu[i]![j] = coefficient;
            v = sub(v, scale(bj, coefficient));
        }
        bstar.push(v);
    }
    return { bstar, mu };
}

/** Run nearest plane; return the close lattice point, coefficients, and residual. */
function nearestPlane(
    basis: Vec[],
    target: Vec,
): {
    point: Vec;
    coefficients: number[];
    residual: Vec;
    bstar: Vec[];
} {
    const { bstar } = gramSchmidt(basis);
    let residual = target.slice();
    let point = new Array<number>(target.length).fill(0);
    const coefficients = new Array<number>(basis.length).fill(0);
    for (let i = basis.length - 1; i >= 0; i -= 1) {
        const bi = bstar[i];
        if (!bi) {
            continue;
        }
        const c = Math.round(dot(residual, bi) / dot(bi, bi));
        coefficients[i] = c;
        residual = sub(residual, scale(basis[i] ?? [], c));
        point = add(point, scale(basis[i] ?? [], c));
    }
    return { point, coefficients, residual, bstar };
}

function node(id: string, x: number, y: number, label: string, state: EntityState): VisualEntity {
    return {
        id,
        type: "node" as const,
        label,
        value: [x, y],
        state,
        x,
        y,
        width: 0,
        height: 0,
        metadata: { x, y },
    };
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { basis?: Vec[]; target?: Vec; displayRange?: number } | null) ?? {};
    const basis: Vec[] = task.basis ?? [
        [3, 1],
        [1, 2],
    ];
    const target: Vec = task.target ?? [4.1, 3.7];
    const range = typeof task.displayRange === "number" ? task.displayRange : 2;

    const dim = Math.min(basis.length, 2) || 1;
    const latticeNodes = (states: Map<string, EntityState>): VisualEntity[] => {
        const nodes: VisualEntity[] = [];
        const b0 = basis[0] ?? [1, 0];
        const b1 = basis[1] ?? [0, 1];
        for (let i = -range; i <= range; i += 1) {
            for (let j = -range; j <= range; j += 1) {
                if (dim === 1 && j !== 0) {
                    continue;
                }
                const x = i * (b0[0] ?? 0) + j * (b1[0] ?? 0);
                const y = i * (b0[1] ?? 0) + j * (b1[1] ?? 0);
                const id = `lattice-${i}-${j}`;
                nodes.push(node(id, x, y, "", states.get(id) ?? "unvisited"));
            }
        }
        return nodes;
    };

    const result = nearestPlane(basis, target);
    const { bstar } = result;
    const tx = target[0] ?? 0;
    const ty = target[1] ?? 0;
    let step = 0;

    yield {
        stepNumber: step,
        entities: [
            ...latticeNodes(new Map()),
            node("target", tx, ty, "target", "pivot"),
            node("origin", 0, 0, "0", "idle"),
        ],
        edges: [],
        description: `Closest-vector search for target (${tx.toFixed(2)}, ${ty.toFixed(2)}) in a lattice of rank ${basis.length}.`,
        codeLineNumber: 0,
        layout: "point",
        meta: { step, target, dim },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: [
            ...latticeNodes(new Map()),
            node("target", tx, ty, "target", "pivot"),
            node("gso-0", bstar[0]?.[0] ?? 0, bstar[0]?.[1] ?? 0, "b*0", "comparing"),
            node("gso-1", bstar[1]?.[0] ?? 0, bstar[1]?.[1] ?? 0, "b*1", "comparing"),
        ],
        edges: [],
        description: `Gram-Schmidt gives orthogonal directions b*0 and b*1 for the rounding projections.`,
        codeLineNumber: 1,
        layout: "point",
        meta: { step, orthogonal: true },
    };
    step += 1;

    let residual = target.slice();
    for (let i = basis.length - 1; i >= 0; i -= 1) {
        const c = result.coefficients[i] ?? 0;
        residual = sub(residual, scale(basis[i] ?? [], c));
        yield {
            stepNumber: step,
            entities: [
                ...latticeNodes(new Map()),
                node("target", tx, ty, "target", "pivot"),
                node("residual", residual[0] ?? 0, residual[1] ?? 0, `r${i}`, "active"),
            ],
            edges: [],
            description: `Round the projection on b*${i} to ${c}; subtract ${c} times basis vector ${i}. Residual is now (${(residual[0] ?? 0).toFixed(2)}, ${(residual[1] ?? 0).toFixed(2)}).`,
            codeLineNumber: 2,
            layout: "point",
            meta: { step, index: i, coefficient: c, residualDistance: norm(residual) },
        };
        step += 1;
    }

    const px = result.point[0] ?? 0;
    const py = result.point[1] ?? 0;
    const states = new Map<string, EntityState>();
    for (let i = -range; i <= range; i += 1) {
        for (let j = -range; j <= range; j += 1) {
            if ((result.coefficients[0] ?? 0) === i && (result.coefficients[1] ?? 0) === j) {
                states.set(`lattice-${i}-${j}`, "sorted");
            }
        }
    }
    yield {
        stepNumber: step,
        entities: [
            ...latticeNodes(states),
            node("target", tx, ty, "target", "pivot"),
            node("closest", px, py, "closest", "sorted"),
        ],
        edges: [
            {
                id: "edge-target-closest",
                sourceId: "target",
                targetId: "closest",
                label: norm(result.residual).toFixed(2),
                state: "path",
                directed: false,
            },
        ],
        description: `Nearest plane returns lattice point (${px.toFixed(2)}, ${py.toFixed(2)}) at distance ${norm(result.residual).toFixed(3)} from the target.`,
        codeLineNumber: 3,
        layout: "point",
        meta: {
            step,
            closest: result.point,
            coefficients: result.coefficients,
            distance: norm(result.residual),
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Imagine the lattice as a stack of parallel planes, each spanned by all but one basis vector. Start at the target and look at the last plane: snap to the lattice layer nearest the target, then repeat with the next plane. The orthogonalized basis tells you exactly where each plane sits, so each snap only requires rounding one number.",
        invariants: [
            "Gram-Schmidt vectors b*_i are mutually orthogonal.",
            "Each rounding subtracts an integer combination of the original basis vectors.",
            "The reported point is always an exact lattice vector with integer coefficients.",
        ],
        correctness:
            "Subtracting c_i times b_i keeps the residual in the same coset of the lattice as the target, so after all steps the accumulated point is in the lattice and the residual equals target minus that point. Because b*_i is orthogonal to the earlier directions, rounding its coordinate minimizes the distance to the current plane in that direction; later steps cannot increase the distance already achieved. With an LLL-reduced basis the result is a provably close vector (within a dimension-dependent factor of optimal).",
        complexityRationale:
            "Gram-Schmidt orthogonalization costs O(n^3) for an n by n basis, and the rounding pass costs O(n^2). Storing the orthogonalized vectors and coefficients uses O(n^2) space.",
        uses: [
            "Approximate closest-vector search in lattice cryptography",
            "Decoding-noise removal for lattice codes",
            "Finding short representations in integer relation problems",
        ],
        references: [
            "Babai, On Lovasz' Lattice Reduction and the Nearest Lattice Point Problem, 1986",
            "Cohen, A Course in Computational Algebraic Number Theory, Chapter 2",
        ],
        workedExample:
            "For basis (3,1), (1,2) and target (4.1, 3.7), Gram-Schmidt yields two orthogonal directions. Rounding the projection on the last direction gives coefficient 1, then rounding on the first gives 1, so the returned lattice point is (3,1) + (1,2) = (4,3), within about 0.72 of the target.",
    },
    id: "babai-nearest-plane",
    name: "Babai Nearest Plane",
    category: "math",
    complexity: { time: "O(n^3)", space: "O(n^2)" },
    defaultInput: {
        basis: [
            [3, 1],
            [1, 2],
        ],
        target: [4.1, 3.7],
        displayRange: 2,
    },
    visualType: "point",
    run,
    pseudocode: [
        "orthogonalize the basis by Gram-Schmidt",
        "set the residual to the target vector",
        "for i from the last basis vector down to the first",
        "round the residual projection on b* i to an integer",
        "subtract that integer times b i from the residual",
        "accumulate the same integer times b i in the answer",
        "done: the accumulated lattice point is a close vector",
    ],
};

export default module;
