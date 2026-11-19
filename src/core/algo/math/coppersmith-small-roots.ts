/**
 * coppersmith-small-roots.ts - Coppersmith's Small Root Method
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Coppersmith's method finds small roots of a monic polynomial modulo a
 * composite N. For a quadratic f(x) = x^2 + a*x + b it builds the lattice
 * spanned by N, N*x and f(x), with columns scaled by powers of a bound X,
 * reduces it with the LLL algorithm, and turns a short vector into an integer
 * polynomial that has the same small root over the integers.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log N) lattice operations for the fixed 3-dimensional lattice
 *   Space: O(1)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the current lattice rows after each LLL step.
 *   - The final frame reports the recovered small root in meta.root.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Vec = number[];

function dot(a: Vec, b: Vec): number {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += a[i]! * b[i]!;
    return sum;
}

/** Gram-Schmidt orthogonalization of a full-rank row basis. */
function gramSchmidt(basis: Vec[]): Vec[] {
    const out: Vec[] = [];
    for (let i = 0; i < basis.length; i += 1) {
        let v = basis[i]!.slice();
        for (let j = 0; j < i; j += 1) {
            const mu = dot(basis[i]!, out[j]!) / dot(out[j]!, out[j]!);
            v = v.map((x, k) => x - mu * out[j]![k]!);
        }
        out.push(v);
    }
    return out;
}

/** Lenstra-Lenstra-Lovasz reduction with delta = 3/4, recording each step. */
function lll(basis: Vec[]): Vec[][] {
    const b = basis.map((row) => row.slice());
    const snapshots: Vec[][] = [b.map((row) => row.slice())];
    let k = 1;
    let guard = 0;
    while (k < b.length && guard < 2000) {
        guard += 1;
        const gs = gramSchmidt(b);
        for (let j = k - 1; j >= 0; j -= 1) {
            const mu = dot(b[k]!, gs[j]!) / dot(gs[j]!, gs[j]!);
            const q = Math.round(mu);
            if (q !== 0) b[k] = b[k]!.map((value, idx) => value - q * b[j]![idx]!);
        }
        const after = gramSchmidt(b);
        const normK = dot(after[k]!, after[k]!);
        const normPrev = dot(after[k - 1]!, after[k - 1]!);
        const muK = dot(b[k]!, after[k - 1]!) / normPrev;
        if (normK >= (0.75 - muK * muK) * normPrev) {
            k += 1;
        } else {
            const tmp = b[k]!;
            b[k] = b[k - 1]!;
            b[k - 1] = tmp;
            k = Math.max(k - 1, 1);
        }
        snapshots.push(b.map((row) => row.slice()));
    }
    return snapshots;
}

function makeCells(values: number[], labels: string[], active = -1): VisualEntity[] {
    return values.map((value, i) => ({
        id: `cell-${i}`,
        type: "cell" as const,
        label: labels[i] ?? String(value),
        value,
        state: (i === active ? "comparing" : "unvisited") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: i },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { a?: number; b?: number; n?: number; x?: number } | null) ?? {};
    const a = typeof task.a === "number" ? task.a : 7;
    const N = typeof task.n === "number" && task.n > 1 ? task.n : 1009;
    const X = typeof task.x === "number" && task.x >= 1 ? task.x : 25;
    const b = typeof task.b === "number"
        ? task.b
        : (((17 * 17 + a * 17) % N) + N) % N;
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeCells([N, a, b, X], ["N", "a", "b", "X"]),
        edges: [],
        description: `Finding a small root of x^2 + ${a}x + ${b} mod ${N} with bound ${X}.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, N, a, b, X },
    };
    step += 1;

    // Rows are coefficient vectors of N, N*x and f(x), each column scaled by X^i.
    const basis: Vec[] = [
        [N, 0, 0],
        [0, N * X, 0],
        [b, a * X, X * X],
    ];
    yield {
        stepNumber: step,
        entities: makeCells(basis.flat(), basis.flat().map((v) => String(v))),
        edges: [],
        description: "Built the scaled lattice basis from N, N*x and f(x).",
        codeLineNumber: 2,
        layout: "grid",
        meta: { step, basis: basis.map((row) => row.join(",")) },
    };
    step += 1;

    const snapshots = lll(basis);
    for (let idx = 1; idx < snapshots.length; idx += 1) {
        yield {
            stepNumber: step,
            entities: makeCells(snapshots[idx]!.flat(), snapshots[idx]!.flat().map((v) => String(v))),
            edges: [],
            description: `LLL step ${idx}: lattice basis after reduction step.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: { step, iteration: idx, basis: snapshots[idx]!.map((row) => row.join(",")) },
        };
        step += 1;
    }

    const reduced = snapshots[snapshots.length - 1]!;
    let root = Number.NaN;
    let coeffs: number[] | null = null;
    for (const vector of reduced) {
        const c1 = vector[1]! / X;
        const c2 = vector[2]! / (X * X);
        if (!Number.isInteger(c1) || !Number.isInteger(c2)) continue;
        const candidate = [vector[0]!, c1, c2];
        for (let x = -X; x <= X; x += 1) {
            const value = candidate[0]! + candidate[1]! * x + candidate[2]! * x * x;
            if (value === 0) {
                const check = ((x * x + a * x + b) % N + N) % N;
                if (check === 0) {
                    root = x;
                    coeffs = candidate;
                    break;
                }
            }
        }
        if (!Number.isNaN(root)) break;
    }

    if (Number.isNaN(root)) {
        yield {
            stepNumber: step,
            entities: makeCells([0], ["none"]),
            edges: [],
            description: "No small root was found inside the given bound; try a larger X.",
            codeLineNumber: 5,
            layout: "grid",
            meta: { step, root: -1 },
        };
        return;
    }

    yield {
        stepNumber: step,
        entities: makeCells([root, X], ["root", "bound"], 0),
        edges: [],
        description: `Found small root x = ${root}; f(${root}) mod ${N} = 0 with |x| <= ${X}.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { step, root, bound: X, coefficients: coeffs ?? [] },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Coppersmith's method turns a modular equation into an ordinary integer equation when the unknown is small. For a quadratic it builds a three-dimensional lattice whose short vectors correspond to polynomials that vanish at the root modulo N but have such small coefficients that they must vanish over the integers. LLL finds a short vector, and its polynomial can be solved directly.",
        invariants: [
            "The lattice rows generate polynomials that vanish at any root of f modulo N.",
            "Scaling column i by X^i makes the Euclidean norm bound the polynomial's value at roots below X.",
            "A short enough vector yields an integer polynomial h with h(root) = 0 over the integers.",
        ],
        correctness:
            "Every lattice vector is a combination of N, N*x and f(x), so it evaluates to a multiple of N at any root of f modulo N. Howgrave-Graham's lemma says an integer polynomial whose scaled coefficient norm is below N/sqrt(dim) cannot be a nonzero multiple of N at a small root, so it must be exactly zero there. LLL returns a short vector meeting that bound, producing h over the integers; scanning the small interval finds its root, which is then verified against f modulo N.",
        complexityRationale:
            "The lattice has fixed dimension three, so each LLL step is constant work on numbers with O(log N) bits, and the number of steps is bounded by a constant times log N. The final root scan runs over at most 2X integers; with the small teaching bounds this is fast. Space is constant.",
        uses: [
            "RSA attacks with partially known plaintext or small exponents",
            "Finding small solutions of modular polynomial equations",
            "Cryptanalysis of padding and key-generation schemes",
        ],
        references: [
            "Coppersmith, Finding Small Solutions to Low Degree Polynomials, 1996",
            "Howgrave-Graham, Finding Small Roots of Univariate Modular Equations, 1997",
        ],
        workedExample:
            "For N = 1009 and f(x) = x^2 + 7x + 601, the root 17 satisfies f(17) = 1009, which is zero modulo N. The lattice spanned by 1009, 1009*x and f(x), scaled by X = 25, reduces to a short vector whose integer polynomial vanishes at a small value; scanning -25 to 25 recovers a valid small root.",
    },
    id: "coppersmith-small-roots",
    name: "Coppersmith Small Roots",
    category: "math",
    complexity: { time: "O(log N)", space: "O(1)" },
    defaultInput: { a: 7, b: 601, n: 1009, x: 25 },
    visualType: "grid",
    run,
    pseudocode: [
        "input monic quadratic f and modulus N with bound X",
        "build rows for the polynomials N, N*x and f(x)",
        "scale column i by X^i",
        "run LLL reduction on the three-dimensional lattice",
        "turn the short vector into integer polynomial coefficients",
        "scan roots below X and verify them against f mod N",
        "done: a small root of f modulo N",
    ],
};

export default module;
