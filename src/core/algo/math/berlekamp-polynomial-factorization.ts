/**
 * berlekamp-polynomial-factorization.ts - Berlekamp Factorization over GF(p)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Berlekamp's algorithm factors a monic square-free polynomial over a small
 * prime field. It builds the Berlekamp matrix whose i-th row is x^(p*i) reduced
 * modulo the polynomial, then finds the nullspace of matrix minus identity.
 * Each nullspace vector represents a polynomial g with g^p = g modulo f; taking
 * gcd(g - c, f) for field elements c splits f into smaller factors. The process
 * is repeated until every piece is irreducible.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 + p n^2) field operations for degree n and field size p
 *   Space: O(n^2) for the Berlekamp matrix and nullspace
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Coefficient rows show the input, the Berlekamp matrix, and each factor.
 *   - The row currently being split is GREEN; finished factors are SORTED.
 *   - The final frame lists all irreducible factors found.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Coefficients are stored low degree first: [a0, a1, ..., ad]. */
type Poly = number[];

function modPow(base: number, exp: number, p: number): number {
    let result = 1;
    let b = ((base % p) + p) % p;
    let e = exp;
    while (e > 0) {
        if (e % 2 === 1) result = (result * b) % p;
        b = (b * b) % p;
        e = Math.floor(e / 2);
    }
    return result;
}

function inv(a: number, p: number): number {
    return modPow(a, p - 2, p);
}

function trim(poly: Poly): Poly {
    const copy = poly.slice();
    while (copy.length > 1 && copy[copy.length - 1] === 0) copy.pop();
    return copy;
}

function normalize(poly: Poly, p: number): Poly {
    return poly.map((v) => ((v % p) + p) % p);
}

function degree(poly: Poly): number {
    return trim(poly).length - 1;
}

function polyAdd(a: Poly, b: Poly, p: number): Poly {
    const out = new Array<number>(Math.max(a.length, b.length)).fill(0);
    for (let i = 0; i < a.length; i += 1) out[i] = (out[i]! + a[i]!) % p;
    for (let i = 0; i < b.length; i += 1) out[i] = (out[i]! + b[i]!) % p;
    return normalize(trim(out), p);
}

function polyMul(a: Poly, b: Poly, p: number): Poly {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            out[i + j] = (out[i + j]! + a[i]! * b[j]!) % p;
        }
    }
    return normalize(trim(out), p);
}

function polyDivMod(a: Poly, b: Poly, p: number): { quotient: Poly; remainder: Poly } {
    const divisor = trim(b);
    const dividend = trim(a);
    const dDeg = degree(divisor);
    const quotient = new Array<number>(Math.max(1, dividend.length - dDeg)).fill(0);
    let remainder = dividend.slice();
    const leadInv = inv(divisor[dDeg]!, p);
    while (!(remainder.length === 1 && remainder[0] === 0) && degree(remainder) >= dDeg) {
        const shift = degree(remainder) - dDeg;
        const factor = (remainder[degree(remainder)]! * leadInv) % p;
        quotient[shift] = factor;
        for (let i = 0; i <= dDeg; i += 1) {
            remainder[shift + i] = ((remainder[shift + i] ?? 0) - factor * divisor[i]!) % p;
        }
        remainder = trim(remainder);
    }
    return { quotient: normalize(trim(quotient), p), remainder: normalize(trim(remainder), p) };
}

function polyMod(a: Poly, f: Poly, p: number): Poly {
    return polyDivMod(a, f, p).remainder;
}

function polyGcd(a: Poly, b: Poly, p: number): Poly {
    let x = trim(a);
    let y = trim(b);
    while (degree(y) > 0 || (y.length === 1 && y[0] !== 0)) {
        const r = polyDivMod(x, y, p).remainder;
        x = y;
        y = r;
    }
    return makeMonic(x, p);
}

/** Monic normalization for an explicit prime. */
function makeMonic(poly: Poly, p: number): Poly {
    const t = trim(poly);
    const lead = t[t.length - 1]!;
    if (lead === 1) return t;
    return normalize(trim(t.map((v) => (v * inv(lead, p)) % p)), p);
}

function nullspace(matrix: number[][], p: number): number[][] {
    const rows = matrix.length;
    const cols = matrix[0]?.length ?? 0;
    const mat = matrix.map((row) => row.slice());
    const pivots: number[] = [];
    let r = 0;
    for (let c = 0; c < cols && r < rows; c += 1) {
        let sel = -1;
        for (let k = r; k < rows; k += 1) {
            if (mat[k]![c] !== 0) {
                sel = k;
                break;
            }
        }
        if (sel === -1) continue;
        [mat[r], mat[sel]] = [mat[sel]!, mat[r]!];
        const scale = inv(mat[r]![c]!, p);
        mat[r] = mat[r]!.map((v) => (v * scale) % p);
        for (let k = 0; k < rows; k += 1) {
            if (k === r) continue;
            const factor = mat[k]![c]!;
            if (factor === 0) continue;
            mat[k] = mat[k]!.map((v, j) => (((v - factor * mat[r]![j]!) % p) + p) % p);
        }
        pivots.push(c);
        r += 1;
    }
    const pivotSet = new Set(pivots);
    const basis: number[][] = [];
    for (let c = 0; c < cols; c += 1) {
        if (pivotSet.has(c)) continue;
        const vec = new Array<number>(cols).fill(0);
        vec[c] = 1;
        for (let i = 0; i < pivots.length; i += 1) {
            const pc = pivots[i]!;
            vec[pc] = ((-mat[i]![c]! % p) + p) % p;
        }
        basis.push(vec);
    }
    return basis;
}

interface FactorStep {
    phase: "matrix" | "nullspace" | "split";
    rows: number[][];
    description: string;
}

/** Full factorization of a monic square-free polynomial over GF(p). */
function factorize(fInput: Poly, p: number, steps: FactorStep[]): Poly[] {
    const f = makeMonic(fInput, p);
    const n = degree(f);
    const rows: number[][] = [];
    if (n <= 1) {
        return [f];
    }

    // Berlekamp matrix rows: x^(p*i) - x^i reduced modulo f.
    let xPoll = [0, 1];
    for (let k = 1; k < p; k += 1) {
        xPoll = polyMod(polyMul(xPoll, [0, 1], p), f, p);
    }
    let power = [1];
    const matrix: number[][] = [];
    for (let i = 0; i < n; i += 1) {
        if (i > 0) power = polyMod(polyMul(power, xPoll, p), f, p);
        const reduced = power.slice();
        while (reduced.length < n) reduced.push(0);
        const row = new Array<number>(n).fill(0);
        for (let j = 0; j < n; j += 1) {
            row[j] = ((((reduced[j] ?? 0) - (i === j ? 1 : 0)) % p) + p) % p;
        }
        matrix.push(row);
        rows.push(row.slice());
    }
    steps.push({
        phase: "matrix",
        rows: rows.map((row) => row.slice()),
        description: `Built the Berlekamp matrix of ${n} rows from x^(p*i) minus x^i modulo f.`,
    });

    // Solve M c = 0 where M[j][i] = row_i[j].
    const transposed: number[][] = [];
    for (let j = 0; j < n; j += 1) {
        const trow: number[] = [];
        for (let i = 0; i < n; i += 1) trow.push(matrix[i]![j]!);
        transposed.push(trow);
    }
    const basis = nullspace(transposed, p);
    steps.push({
        phase: "nullspace",
        rows: basis.map((vec) => vec.slice()),
        description: `Nullspace of (matrix minus identity) has dimension ${basis.length}, the number of irreducible factors.`,
    });

    let work: Poly[] = [f];
    for (const vec of basis) {
        const g = trim(vec);
        if (degree(g) < 1) continue;
        let changed = true;
        while (changed) {
            changed = false;
            const next: Poly[] = [];
            for (const current of work) {
                let split = false;
                for (let c = 0; c < p; c += 1) {
                    const gMinusC = polyAdd(g, [-c], p);
                    const d = polyGcd(gMinusC, current, p);
                    if (degree(d) > 0 && degree(d) < degree(current)) {
                        const quotient = polyDivMod(current, d, p).quotient;
                        next.push(makeMonic(d, p), makeMonic(quotient, p));
                        steps.push({
                            phase: "split",
                            rows: [d.slice(), quotient.slice()],
                            description: `gcd(g - ${c}, current) splits a factor of degree ${degree(d)} from degree ${degree(current)}.`,
                        });
                        split = true;
                        changed = true;
                        break;
                    }
                }
                if (!split) next.push(current);
            }
            work = next;
        }
    }
    return work;
}

function coefficientEntities(rows: number[][], highlightRow: number): VisualEntity[] {
    const entities: VisualEntity[] = [];
    rows.forEach((row, r) => {
        row.forEach((value, c) => {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(value),
                value,
                state: (r === highlightRow ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c },
            });
        });
    });
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polynomial?: number[]; modulus?: number } | null) ?? {};
    const p = typeof task.modulus === "number" && task.modulus > 2 ? task.modulus : 2;
    const polynomial = task.polynomial ?? [1, 0, 1, 1, 0, 0, 1]; // x^6 + x^3 + x + 1
    let step = 0;

    yield {
        stepNumber: step,
        entities: coefficientEntities([polynomial], -1),
        edges: [],
        description: `Factoring a degree ${degree(polynomial)} polynomial over GF(${p}) with Berlekamp's algorithm.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, modulus: p, degree: degree(polynomial) },
    };
    step += 1;

    const steps: FactorStep[] = [];
    const factors = factorize(polynomial, p, steps);
    for (const s of steps) {
        yield {
            stepNumber: step,
            entities: coefficientEntities(s.rows, s.phase === "matrix" ? -1 : s.rows.length - 1),
            edges: [],
            description: s.description,
            codeLineNumber: s.phase === "matrix" ? 2 : s.phase === "nullspace" ? 4 : 6,
            layout: "grid",
            meta: { step, phase: s.phase },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: coefficientEntities(factors, -1),
        edges: [],
        description: `Factorization complete: ${factors.length} irreducible factor(s) of degrees ${factors.map(degree).join(", ")}.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            step,
            factors: factors.map((f) => f.join(",")),
            degrees: factors.map(degree),
            count: factors.length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Over a finite field, the polynomials g with g raised to the p-th power equal g form a small vector space whose dimension counts the irreducible factors. Berlekamp's matrix computes that space by linear algebra. Once you have a polynomial in the space, subtracting each field constant and taking a gcd with the input peels off factors, just as a well-chosen gcd separates the roots of a polynomial over the reals.",
        invariants: [
            "Every row of the Berlekamp matrix is x^(p*i) minus x^i reduced modulo f.",
            "A nullspace vector represents a polynomial g with g^p = g modulo f.",
            "Each gcd split produces two polynomials whose product is the current one.",
        ],
        correctness:
            "Because c^p = c in GF(p), a polynomial g satisfies g^p = g modulo f exactly when its coefficient vector lies in the nullspace of (matrix minus identity); the dimension of that space equals the number of distinct irreducible factors. For such a g, gcd(g - c, f) is a product of some of those factors, and varying c separates factors that are not yet split. By induction over the nullspace basis and the field elements, the algorithm ends with irreducible pieces whose product is the original square-free polynomial.",
        complexityRationale:
            "Computing the n by n Berlekamp matrix needs O(n) modular polynomial multiplications costing O(n^2) each, and Gaussian elimination is O(n^3). Trying p constants per gcd adds O(p n^2). Space is O(n^2) for the matrix and nullspace basis.",
        uses: [
            "Factoring polynomials over finite fields in coding theory",
            "Decoding BCH and Reed-Solomon codes via error-locator polynomials",
            "Computing in algebraic number fields and cryptanalysis",
        ],
        references: [
            "Berlekamp, Algebraic Coding Theory, Chapter 6",
            "Knuth, The Art of Computer Programming, Vol. 2, Section 4.6.2",
        ],
        workedExample:
            "Over GF(2), take f = x^4 + x^3 + x^2 + x + 1, which is irreducible. The Berlekamp matrix minus identity has full rank, so its nullspace is only the constants and the algorithm returns the single factor f. For f = (x^2 + x + 1)(x^2 + 1), the nullspace has dimension two and a gcd step separates the two quadratic factors.",
    },
    id: "berlekamp-polynomial-factorization",
    name: "Berlekamp Polynomial Factorization",
    category: "math",
    complexity: { time: "O(n^3 + p n^2)", space: "O(n^2)" },
    defaultInput: { polynomial: [1, 0, 1, 1, 0, 0, 1], modulus: 2 },
    visualType: "grid",
    run,
    pseudocode: [
        "input a monic square-free polynomial f over GF(p)",
        "for i from 0 to n-1 compute x^(p*i) modulo f",
        "form the matrix of those rows minus the identity",
        "compute a basis for the nullspace of that matrix",
        "for each nonconstant nullspace polynomial g",
        "for each field element c compute gcd(g - c, current)",
        "when the gcd is proper, split current into two factors",
        "done: the list of irreducible factors",
    ],
};

export default module;
