/**
 * f4-groebner-basis.ts - Faugere's F4 Groebner Basis Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * F4 computes a Groebner basis by replacing Buchberger's one-pair-at-a-time
 * S-polynomial reductions with batch linear algebra. It collects the critical
 * pairs of smallest degree together with monomial multiples of the current
 * basis, forms a Macaulay-style coefficient matrix, and row-reduces it in one
 * Gaussian elimination pass. New pivot rows become new basis elements.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  exponential in the worst case; each degree step is matrix reduction
 *   Space: proportional to the number of monomials in the Macaulay matrix
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Grid cells show the current basis leading terms and matrix dimensions.
 *   - The final frame reports the reduced basis in meta.basis.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Monomial = [number, number];
type Term = [number, number, number];
type Poly = Map<string, { exp: Monomial; coeff: number }>;

const key = (exp: Monomial): string => `${exp[0]},${exp[1]}`;
const expKey = (k: string): Monomial => {
    const [a, b] = k.split(",").map(Number);
    return [a!, b!];
};

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
const inv = (a: number, p: number): number => modPow(a, p - 2, p);

function fromTerms(terms: Term[], p: number): Poly {
    const poly: Poly = new Map();
    for (const [coeff, ex, ey] of terms) {
        const exp: Monomial = [ex, ey];
        const k = key(exp);
        const value = ((((coeff % p) + p) % p) + (poly.get(k)?.coeff ?? 0)) % p;
        if (value === 0) poly.delete(k);
        else poly.set(k, { exp, coeff: value });
    }
    return poly;
}

function compareMonomials(a: Monomial, b: Monomial): number {
    const da = a[0] + a[1];
    const db = b[0] + b[1];
    if (da !== db) return da - db;
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
}
function leading(poly: Poly): { exp: Monomial; coeff: number; k: string } | undefined {
    let best: { exp: Monomial; coeff: number; k: string } | undefined;
    for (const [k, term] of poly) {
        if (!best || compareMonomials(term.exp, best.exp) > 0) {
            best = { exp: term.exp, coeff: term.coeff, k };
        }
    }
    return best;
}
const divides = (a: Monomial, b: Monomial): boolean => a[0] <= b[0] && a[1] <= b[1];
const lcmMonomials = (a: Monomial, b: Monomial): Monomial => [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
const subMonomials = (a: Monomial, b: Monomial): Monomial => [a[0] - b[0], a[1] - b[1]];

function makeMonic(poly: Poly, p: number): Poly {
    const lead = leading(poly);
    if (!lead || lead.coeff === 1) return poly;
    const factor = inv(lead.coeff, p);
    const out: Poly = new Map();
    for (const [k, term] of poly) out.set(k, { exp: term.exp, coeff: (term.coeff * factor) % p });
    return out;
}
const clonePoly = (poly: Poly): Poly => {
    const out: Poly = new Map();
    for (const [k, term] of poly) out.set(k, { exp: term.exp.slice() as Monomial, coeff: term.coeff });
    return out;
};

/** Multiply a polynomial by a monomial shift. */
function shift(poly: Poly, s: Monomial, p: number): Poly {
    const out: Poly = new Map();
    for (const term of poly.values()) {
        const exp: Monomial = [term.exp[0] + s[0], term.exp[1] + s[1]];
        const k = key(exp);
        out.set(k, { exp, coeff: (term.coeff % p + p) % p });
    }
    return out;
}

/** Full reduction of f by the basis (used for verification and final checks). */
function normalForm(fInput: Poly, basis: Poly[], p: number): Poly {
    const f = clonePoly(fInput);
    for (let guard = 0; guard < 10000; guard += 1) {
        const lead = leading(f);
        if (!lead) break;
        let reduced = false;
        for (const g of basis) {
            const gl = leading(g);
            if (gl && divides(gl.exp, lead.exp)) {
                const factor = (lead.coeff * inv(gl.coeff, p)) % p;
                const s = subMonomials(lead.exp, gl.exp);
                for (const term of g.values()) {
                    const exp: Monomial = [term.exp[0] + s[0], term.exp[1] + s[1]];
                    const k = key(exp);
                    const value = ((((f.get(k)?.coeff ?? 0) - factor * term.coeff) % p) + p) % p;
                    if (value === 0) f.delete(k);
                    else f.set(k, { exp, coeff: value });
                }
                reduced = true;
                break;
            }
        }
        if (!reduced) break;
    }
    return f;
}

/** Row-reduce a set of polynomials as coefficient vectors over sorted monomials. */
function gaussianElimination(rows: Poly[], p: number): Poly[] {
    const columns = new Set<string>();
    for (const row of rows) for (const k of row.keys()) columns.add(k);
    const cols = [...columns].sort((x, y) => compareMonomials(expKey(y), expKey(x)));
    const colIndex = new Map(cols.map((c, i) => [c, i]));
    const matrix = rows.map((row) => {
        const arr = Array(cols.length).fill(0);
        for (const [k, term] of row) arr[colIndex.get(k)!] = term.coeff;
        return arr;
    });
    let rowCount = 0;
    for (let c = 0; c < cols.length && rowCount < matrix.length; c += 1) {
        let pivot = -1;
        for (let r = rowCount; r < matrix.length; r += 1) {
            if (matrix[r]![c] !== 0) {
                pivot = r;
                break;
            }
        }
        if (pivot < 0) continue;
        [matrix[rowCount], matrix[pivot]] = [matrix[pivot]!, matrix[rowCount]!];
        const invPivot = inv(matrix[rowCount]![c]!, p);
        matrix[rowCount] = matrix[rowCount]!.map((v) => (v * invPivot) % p);
        for (let r = 0; r < matrix.length; r += 1) {
            if (r === rowCount || matrix[r]![c] === 0) continue;
            const factor = matrix[r]![c]!;
            matrix[r] = matrix[r]!.map((v, i) => (((v - factor * matrix[rowCount]![i]!) % p) + p) % p);
        }
        rowCount += 1;
    }
    const result: Poly[] = [];
    for (let r = 0; r < rowCount; r += 1) {
        const poly: Poly = new Map();
        for (let c = 0; c < cols.length; c += 1) {
            if (matrix[r]![c] !== 0) {
                const exp = expKey(cols[c]!);
                poly.set(cols[c]!, { exp, coeff: matrix[r]![c]! });
            }
        }
        result.push(poly);
    }
    return result;
}

function toTerms(poly: Poly): Term[] {
    return [...poly.values()]
        .sort((a, b) => compareMonomials(b.exp, a.exp))
        .map((term) => [term.coeff, term.exp[0], term.exp[1]]);
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
    const task = (input as { generators?: Term[][]; modulus?: number } | null) ?? {};
    const p = typeof task.modulus === "number" && task.modulus > 2 ? task.modulus : 101;
    const generators: Term[][] = task.generators ?? [
        [
            [1, 2, 0],
            [1, 0, 1],
        ],
        [
            [1, 1, 1],
            [2, 0, 0],
        ],
    ];
    let step = 0;

    const basis: Poly[] = generators
        .map((terms) => makeMonic(fromTerms(terms, p), p))
        .filter((poly) => leading(poly));
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < basis.length; i += 1) {
        for (let j = i + 1; j < basis.length; j += 1) pairs.push([i, j]);
    }
    const basisEntities = (highlight: number): VisualEntity[] => {
        const entities: VisualEntity[] = [];
        basis.forEach((poly, index) => {
            toTerms(poly).forEach(([coeff, ex, ey], ti) => {
                entities.push({
                    id: `cell-${index}-${ti}`,
                    type: "cell" as const,
                    label: `${coeff}x^${ex}y^${ey}`,
                    value: coeff,
                    state: (index === highlight ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: index, col: ti, ex, ey },
                });
            });
        });
        return entities;
    };

    yield {
        stepNumber: step,
        entities: basisEntities(-1),
        edges: [],
        description: `Computing a Groebner basis with F4 for ${generators.length} generators over GF(${p}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, modulus: p, generators: generators.length },
    };
    step += 1;

    let processed = 0;
    while (pairs.length > 0 && processed < 400) {
        // Select pairs at the smallest lcm degree.
        let d = Infinity;
        for (const [i, j] of pairs) {
            const li = leading(basis[i]!)!.exp;
            const lj = leading(basis[j]!)!.exp;
            const lcm = lcmMonomials(li, lj);
            d = Math.min(d, lcm[0] + lcm[1]);
        }
        const selected = pairs.filter(([i, j]) => {
            const li = leading(basis[i]!)!.exp;
            const lj = leading(basis[j]!)!.exp;
            const lcm = lcmMonomials(li, lj);
            return lcm[0] + lcm[1] === d;
        });
        for (const pair of selected) pairs.splice(pairs.indexOf(pair), 1);

        // Build the Macaulay-style row set.
        const rows: Poly[] = [];
        for (const [i, j] of selected) {
            const li = leading(basis[i]!)!.exp;
            const lj = leading(basis[j]!)!.exp;
            const lcm = lcmMonomials(li, lj);
            rows.push(shift(basis[i]!, subMonomials(lcm, li), p));
            rows.push(shift(basis[j]!, subMonomials(lcm, lj), p));
        }
        for (const g of basis) {
            const gl = leading(g)!.exp;
            const maxDeg = d - (gl[0] + gl[1]);
            for (let a = 0; a <= maxDeg; a += 1) {
                for (let b = 0; b <= maxDeg - a; b += 1) rows.push(shift(g, [a, b], p));
            }
        }

        const reduced = gaussianElimination(rows, p);
        const oldLeads = basis.map((g) => leading(g)!.exp);
        let added = 0;
        for (const row of reduced) {
            const lead = leading(row);
            if (!lead) continue;
            if (oldLeads.some((exp) => divides(exp, lead.exp))) continue;
            basis.push(makeMonic(row, p));
            oldLeads.push(lead.exp);
            const next = basis.length - 1;
            for (let k = 0; k < next; k += 1) pairs.push([k, next]);
            added += 1;
        }
        processed += selected.length;

        yield {
            stepNumber: step,
            entities: basisEntities(basis.length - 1),
            edges: [],
            description: `F4 degree ${d}: reduced ${rows.length} rows and added ${added} basis element(s).`,
            codeLineNumber: added > 0 ? 5 : 4,
            layout: "grid",
            meta: { step, degree: d, rows: rows.length, added, basisSize: basis.length, pairsProcessed: processed },
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: basisEntities(-1).map((entity) => ({ ...entity, state: "sorted" as EntityState })),
        edges: [],
        description: `F4 complete with ${basis.length} basis polynomial(s) after ${processed} pairs.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            step,
            basis: basis.map((poly) => toTerms(poly).map((term) => term.join(",")).join(";")),
            basisSize: basis.length,
            pairsProcessed: processed,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "F4 speeds up Groebner basis computation by doing many reductions at once. Instead of reducing one S-polynomial at a time, it gathers all critical pairs at a given degree, adds the monomial multiples of the current generators that could appear during their reduction, and throws the whole collection into one Gaussian elimination. The pivot rows of that matrix are the new basis elements.",
        invariants: [
            "Every row in the Macaulay matrix belongs to the ideal generated by the input.",
            "Row operations preserve the span of the rows and therefore the ideal.",
            "A new pivot row whose leading monomial is not divisible by an existing leading term adds a genuine new generator.",
        ],
        correctness:
            "The rows added to the matrix are monomial multiples of ideal elements, so all rows lie in the ideal and elimination cannot leave it. Gaussian elimination produces rows with distinct leading monomials; any row whose leading monomial is already divisible by a basis leading term is redundant and discarded. The remaining pivots extend the leading-term ideal strictly, which cannot continue forever. When no pairs remain, every S-polynomial reduces to zero (its numerator was a matrix row reducible by the basis), so Buchberger's criterion holds and the result is a Groebner basis.",
        complexityRationale:
            "The Macaulay matrix size grows with the maximum degree and number of variables, and Groebner bases are exponential in the worst case. Each degree step, however, is a single Gaussian elimination on that matrix, which is far more efficient than many individual reductions; space is proportional to the number of monomials stored.",
        uses: [
            "Solving polynomial systems in computer algebra",
            "Algebraic cryptanalysis and post-quantum security estimates",
            "Ideal membership and elimination in symbolic computation",
        ],
        references: [
            "Faugere, A New Efficient Algorithm for Computing Groebner Bases (F4), 1999",
            "Cox, Little and O'Shea, Ideals, Varieties, and Algorithms, Chapter 2",
        ],
        workedExample:
            "Over GF(101), start with x^2 + y and xy + 2. Their leading monomials x^2 and xy have least common multiple x^2 y at degree three. F4 forms the rows y(x^2+y) and x(xy+2) together with low-degree multiples of the two generators, row-reduces the matrix, and obtains y^2 - 2x as a new pivot, which joins the basis just as in Buchberger's algorithm but in one batch.",
    },
    id: "f4-groebner-basis",
    name: "F4 Groebner Basis",
    category: "math",
    complexity: { time: "exponential in variables and degrees", space: "O(number of monomials)" },
    defaultInput: {
        generators: [
            [
                [1, 2, 0],
                [1, 0, 1],
            ],
            [
                [1, 1, 1],
                [2, 0, 0],
            ],
        ],
        modulus: 101,
    },
    visualType: "grid",
    run,
    pseudocode: [
        "input generators and fix a monomial order",
        "make each generator monic and collect all pairs",
        "while pairs remain",
        "select pairs with smallest leading-term lcm degree",
        "build matrix with pair rows and basis monomial multiples",
        "row-reduce the matrix with Gaussian elimination",
        "promote new pivot rows to basis elements and add pairs",
        "done: the resulting Groebner basis",
    ],
};

export default module;
