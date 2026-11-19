/**
 * lll-lattice-reduction.ts - Lenstra-Lenstra-Lovasz Lattice Reduction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The LLL algorithm turns any integer lattice basis into a reduced basis whose
 * vectors are short and nearly orthogonal. It repeatedly projects each vector
 * onto the Gram-Schmidt vectors of earlier ones and subtracts the nearest
 * integer multiple (size reduction), then swaps adjacent vectors when they
 * violate the Lovasz condition. Every operation is unimodular, so the lattice
 * itself never changes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^4 log B) for an n-dimensional basis with coordinate bound B
 *   Space: O(n^2) for the basis, transform, and Gram-Schmidt data
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each basis row is a row of grid cells showing its integer coordinates.
 *   - The row undergoing size reduction is YELLOW; a swap highlights both rows.
 *   - The final frame reports the reduced basis and the unimodular transform.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec = number[];

function dot(a: Vec, b: Vec): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += (a[i] ?? 0) * (b[i] ?? 0);
    return sum;
}

function cloneMatrix(m: Vec[]): Vec[] {
    return m.map((row) => row.slice());
}

function identity(n: number): Vec[] {
    return Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    );
}

function gramSchmidt(basis: Vec[]): { bstar: Vec[]; mu: number[][]; norm: number[] } {
    const n = basis.length;
    const bstar: Vec[] = [];
    const mu: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
    const norm = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
        let v = basis[i]!.slice();
        for (let j = 0; j < i; j += 1) {
            mu[i]![j] = dot(basis[i]!, bstar[j]!) / norm[j]!;
            const factor = mu[i]![j]!;
            v = v.map((x, k) => x - factor * (bstar[j]![k] ?? 0));
        }
        bstar.push(v);
        norm[i] = dot(v, v);
    }
    return { bstar, mu, norm };
}

function matrixString(m: Vec[]): string {
    return m.map((row) => row.join(",")).join(";");
}

function makeCells(basis: Vec[], states: Map<number, EntityState>, active: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < basis.length; r += 1) {
        for (let c = 0; c < (basis[r]?.length ?? 0); c += 1) {
            const value = basis[r]![c]!;
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: states.get(r) ?? (r === active ? "comparing" : "idle"),
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, value },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { basis?: Vec[]; delta?: number } | null) ?? {};
    const source = task.basis ?? [[1, 1, 1], [-2, 0, 1], [4, 1, 0]];
    let basis = cloneMatrix(source);
    const n = basis.length;
    const U = identity(n);
    const delta = typeof task.delta === "number" ? task.delta : 0.75;

    if (n === 0 || basis.some((row) => row.length !== n)) {
        yield {
            stepNumber: 0,
            entities: [],
            edges: [],
            description: "LLL expects a square matrix whose rows are the lattice basis vectors.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { valid: false, reducedBasis: "", transform: "" },
        };
        return;
    }

    let step = 0;
    let reductions = 0;
    let swaps = 0;
    yield {
        stepNumber: step,
        entities: makeCells(basis, new Map(), -1),
        edges: [],
        description: `Reducing a ${n}-dimensional lattice basis with delta = ${delta}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { reducedBasis: matrixString(basis), transform: matrixString(U), reductions, swaps, delta },
    };
    step += 1;

    let k = 1;
    let guard = 0;
    while (k < n && guard < 2000) {
        guard += 1;
        let gs = gramSchmidt(basis);
        for (let j = k - 1; j >= 0; j -= 1) {
            const q = Math.round(gs.mu[k]![j]!);
            if (q === 0) continue;
            for (let c = 0; c < n; c += 1) {
                basis[k]![c] = basis[k]![c]! - q * basis[j]![c]!;
                U[k]![c] = U[k]![c]! - q * U[j]![c]!;
            }
            reductions += 1;
            gs = gramSchmidt(basis);
            if (step < 120) {
                yield {
                    stepNumber: step,
                    entities: makeCells(basis, new Map([[k, "comparing" as EntityState]]), k),
                    edges: [],
                    description: `Size reduction: b_${k} <- b_${k} - ${q}*b_${j}.`,
                    codeLineNumber: 2,
                    layout: "grid",
                    meta: { reducedBasis: matrixString(basis), transform: matrixString(U), reductions, swaps, k, j, quotient: q },
                };
                step += 1;
            }
        }

        gs = gramSchmidt(basis);
        const left = gs.norm[k]!;
        const right = (delta - gs.mu[k]![k - 1]! ** 2) * gs.norm[k - 1]!;
        if (left + 1e-9 >= right) {
            k += 1;
            continue;
        }

        const tmpB = basis[k]!;
        basis[k] = basis[k - 1]!;
        basis[k - 1] = tmpB;
        const tmpU = U[k]!;
        U[k] = U[k - 1]!;
        U[k - 1] = tmpU;
        swaps += 1;
        if (step < 120) {
            yield {
                stepNumber: step,
                entities: makeCells(basis, new Map([[k, "active" as EntityState], [k - 1, "active" as EntityState]]), -1),
                edges: [],
                description: `Lovasz condition failed: swap b_${k} with b_${k - 1} and step back.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { reducedBasis: matrixString(basis), transform: matrixString(U), reductions, swaps, k },
            };
            step += 1;
        }
        k = Math.max(k - 1, 1);
    }

    const finalGs = gramSchmidt(basis);
    let reduced = true;
    for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < i; j += 1) {
            if (Math.abs(finalGs.mu[i]![j]!) > 0.500001) reduced = false;
        }
        if (i > 0) {
            const ok = finalGs.norm[i]! + 1e-9 >= (delta - finalGs.mu[i]![i - 1]! ** 2) * finalGs.norm[i - 1]!;
            if (!ok) reduced = false;
        }
    }
    yield {
        stepNumber: step,
        entities: makeCells(basis, new Map(basis.map((_, i) => [i, "sorted" as EntityState])), -1),
        edges: [],
        description: `LLL produced a reduced basis with shortest squared norm ${Math.min(...finalGs.norm).toFixed(2)}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: {
            reducedBasis: matrixString(basis),
            transform: matrixString(U),
            reductions,
            swaps,
            delta,
            reduced,
            shortestNorm: Math.round(Math.min(...finalGs.norm) * 1e6) / 1e6,
        },
    };
}

/** The LLL lattice reduction module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "LLL makes a lattice basis short and nearly orthogonal with two local moves. Size reduction subtracts the nearest integer multiple of an earlier vector so the projection onto it is small. The Lovasz test compares consecutive projected lengths; when a later vector is too short relative to its predecessor, the two are swapped. Repeating these moves converges to a basis where no local improvement remains.",
        invariants: [
            "Every row operation on the basis is mirrored on the transform matrix U.",
            "U is unimodular, so U times the original basis equals the current basis and the lattice is unchanged.",
            "Size reduction leaves every Gram-Schmidt projection magnitude at most one half.",
            "The determinant magnitude of the basis is preserved by all operations.",
        ],
        correctness:
            "Each size reduction and swap is an integer row operation with determinant minus one or one, so the lattice and determinant magnitude are invariant. The algorithm decreases the potential function built from the Gram-Schmidt lengths whenever it performs a swap; size reduction does not increase it. Because that potential has finitely many values for an integer lattice, the loop terminates. At termination all projection bounds and the Lovasz inequalities hold, which is the definition of an LLL-reduced basis.",
        complexityRationale:
            "The number of iterations is polynomial in the dimension and the logarithm of the coordinate bound, and each iteration recomputes Gram-Schmidt data in O(n^3). The standard bound is O(n^4 log B) time with O(n^2) space for the basis, transform, and projections.",
        uses: [
            "Finding short vectors in lattice cryptography and cryptanalysis",
            "Solving integer linear programs and closest-vector problems approximately",
            "Reducing the basis of a lattice before Babai's nearest-plane decoding",
        ],
        references: [
            "Lenstra, Lenstra and Lovasz, Factoring Polynomials with Rational Coefficients, 1982",
            "Cohen, A Course in Computational Algebraic Number Theory, Section 2.6",
        ],
        workedExample:
            "For the basis (1,1,1), (-2,0,1), (4,1,0) the first vector is already short but the others are skewed. LLL subtracts suitable multiples to shrink projections, swaps when the Lovasz inequality fails, and ends with a basis whose Gram-Schmidt vectors satisfy every bound while spanning exactly the same lattice.",
    },
    id: "lll-lattice-reduction",
    name: "LLL Lattice Reduction",
    category: "math",
    complexity: { time: "O(n^4 log B)", space: "O(n^2)" },
    defaultInput: { basis: [[1, 1, 1], [-2, 0, 1], [4, 1, 0]], delta: 0.75 },
    visualType: "grid",
    run,
    pseudocode: [
        "compute the Gram-Schmidt lengths and projection coefficients of the basis",
        "for each vector k from one to n-1",
        "subtract the nearest integer multiple of every earlier vector",
        "if the Lovasz inequality holds advance to the next vector",
        "otherwise swap vectors k and k-1 and repeat from the previous index",
        "record each operation in the unimodular transform matrix",
        "done: return the reduced basis and the transform",
    ],
};

export default module;
