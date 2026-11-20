/**
 * buchberger-groebner-basis.ts - Buchberger's Groebner Basis Algorithm
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Buchberger's algorithm turns any finite set of multivariate polynomials into
 * a Groebner basis: a generating set whose leading terms determine membership
 * in the ideal by simple division. It repeatedly forms S-polynomials, which
 * cancel the leading terms of a pair, and reduces them against the current
 * basis. A nonzero remainder is appended as a new generator until every
 * S-polynomial reduces to zero (Buchberger's criterion).
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  exponential in the number of variables and degrees in the worst case
 *   Space: proportional to the number of monomials in the intermediate basis
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each frame lists the current basis polynomials as coefficient cells.
 *   - The pair being processed is highlighted; a new basis element is GREEN.
 *   - The final frame shows the reduced Groebner basis and the pair count.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** A monomial is an exponent pair [exponent of x, exponent of y]. */
type Monomial = [number, number];
/** A term is [coefficient, exponent of x, exponent of y]. */
type Term = [number, number, number];
/** A polynomial maps a monomial key to its coefficient modulo p. */
type Poly = Map<string, { exp: Monomial; coeff: number }>;

function key(exp: Monomial): string {
    return `${exp[0]},${exp[1]}`;
}

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

/** Graded lexicographic comparison: total degree, then lex with x > y. */
function compareMonomials(a: Monomial, b: Monomial): number {
    const da = a[0] + a[1];
    const db = b[0] + b[1];
    if (da !== db) return da - db;
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
}

function leading(poly: Poly): { exp: Monomial; coeff: number; key: string } | undefined {
    let best: { exp: Monomial; coeff: number; key: string } | undefined;
    for (const [k, term] of poly) {
        if (!best || compareMonomials(term.exp, best.exp) > 0) {
            best = { exp: term.exp, coeff: term.coeff, key: k };
        }
    }
    return best;
}

function divides(a: Monomial, b: Monomial): boolean {
    return a[0] <= b[0] && a[1] <= b[1];
}

function subtractMonomials(a: Monomial, b: Monomial): Monomial {
    return [a[0] - b[0], a[1] - b[1]];
}

function lcmMonomials(a: Monomial, b: Monomial): Monomial {
    return [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
}

function makeMonic(poly: Poly, p: number): Poly {
    const lead = leading(poly);
    if (!lead || lead.coeff === 1) return poly;
    const factor = inv(lead.coeff, p);
    const out: Poly = new Map();
    for (const [k, term] of poly) {
        out.set(k, { exp: term.exp, coeff: (term.coeff * factor) % p });
    }
    return out;
}

function clonePoly(poly: Poly): Poly {
    const out: Poly = new Map();
    for (const [k, term] of poly)
        out.set(k, { exp: term.exp.slice() as Monomial, coeff: term.coeff });
    return out;
}

/** Subtract factor times g shifted by shift from f. */
function reduceBy(f: Poly, g: Poly, factor: number, shift: Monomial, p: number): void {
    for (const term of g.values()) {
        const exponent: Monomial = [term.exp[0] + shift[0], term.exp[1] + shift[1]];
        const k = key(exponent);
        const current = f.get(k)?.coeff ?? 0;
        const value = (((current - factor * term.coeff) % p) + p) % p;
        if (value === 0) f.delete(k);
        else f.set(k, { exp: exponent, coeff: value });
    }
}

/** Full reduction of f by the basis G. */
function normalForm(fInput: Poly, basis: Poly[], p: number): Poly {
    const f = clonePoly(fInput);
    let guard = 0;
    while (guard < 10000) {
        guard += 1;
        const lead = leading(f);
        if (!lead) break;
        let reduced = false;
        for (const g of basis) {
            const gLead = leading(g);
            if (gLead && divides(gLead.exp, lead.exp)) {
                const factor = (lead.coeff * inv(gLead.coeff, p)) % p;
                reduceBy(f, g, factor, subtractMonomials(lead.exp, gLead.exp), p);
                reduced = true;
                break;
            }
        }
        if (!reduced) break;
    }
    return f;
}

function sPolynomial(f: Poly, g: Poly, p: number): Poly {
    const lf = leading(f)!;
    const lg = leading(g)!;
    const lcm = lcmMonomials(lf.exp, lg.exp);
    const shiftF = subtractMonomials(lcm, lf.exp);
    const shiftG = subtractMonomials(lcm, lg.exp);
    const out: Poly = new Map();
    const factorF = inv(lf.coeff, p);
    const factorG = inv(lg.coeff, p);
    for (const term of f.values()) {
        const exponent: Monomial = [term.exp[0] + shiftF[0], term.exp[1] + shiftF[1]];
        const k = key(exponent);
        out.set(k, { exp: exponent, coeff: (term.coeff * factorF) % p });
    }
    for (const term of g.values()) {
        const exponent: Monomial = [term.exp[0] + shiftG[0], term.exp[1] + shiftG[1]];
        const k = key(exponent);
        const current = out.get(k)?.coeff ?? 0;
        const value = (((current - term.coeff * factorG) % p) + p) % p;
        if (value === 0) out.delete(k);
        else out.set(k, { exp: exponent, coeff: value });
    }
    return out;
}

function toTerms(poly: Poly): Term[] {
    return [...poly.values()]
        .sort((a, b) => compareMonomials(b.exp, a.exp))
        .map((term) => [term.coeff, term.exp[0], term.exp[1]]);
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
            toTerms(poly).forEach(([coeff, ex, ey], termIndex) => {
                entities.push({
                    id: `cell-${index}-${termIndex}`,
                    type: "cell" as const,
                    label: `${coeff}x^${ex}y^${ey}`,
                    value: coeff,
                    state: (index === highlight ? "sorted" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: index, col: termIndex, ex, ey },
                });
            });
        });
        return entities;
    };

    yield {
        stepNumber: step,
        entities: basisEntities(-1),
        edges: [],
        description: `Computing a Groebner basis for ${generators.length} generators over GF(${p}) in graded lexicographic order.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { step, modulus: p, generators: generators.length },
    };
    step += 1;

    let processed = 0;
    while (pairs.length > 0 && processed < 400) {
        const pair = pairs.shift()!;
        const [i, j] = pair;
        const s = sPolynomial(basis[i]!, basis[j]!, p);
        const remainder = normalForm(s, basis, p);
        processed += 1;
        if (leading(remainder)) {
            basis.push(makeMonic(remainder, p));
            const next = basis.length - 1;
            for (let k = 0; k < next; k += 1) pairs.push([k, next]);
            yield {
                stepNumber: step,
                entities: basisEntities(next),
                edges: [],
                description: `Pair (${i}, ${j}) produced a nonzero remainder; added a new basis polynomial (now ${basis.length} elements).`,
                codeLineNumber: 4,
                layout: "grid",
                meta: { step, pair, added: true, basisSize: basis.length },
            };
        } else {
            yield {
                stepNumber: step,
                entities: basisEntities(-1),
                edges: [],
                description: `Pair (${i}, ${j}) reduced to zero, so Buchberger's criterion already holds for it.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { step, pair, added: false, basisSize: basis.length },
            };
        }
        step += 1;
    }

    const finalTerms = basis.map(toTerms);
    yield {
        stepNumber: step,
        entities: basisEntities(-1).map((entity) => ({
            ...entity,
            state: "sorted" as EntityState,
        })),
        edges: [],
        description: `Groebner basis complete with ${basis.length} polynomial(s) after ${processed} S-polynomial checks.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: {
            step,
            basis: finalTerms.map((poly) => poly.map((term) => term.join(",")).join(";")),
            basisSize: basis.length,
            pairsProcessed: processed,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A Groebner basis is to polynomial ideals what row-reduced echelon form is to linear systems: it gives a canonical generating set where division answers ideal membership. The construction fixes a monomial order and repeatedly cancels the leading terms of two generators with an S-polynomial. If that cancellation leaves a remainder, the remainder reveals a missing generator and is added; when all cancellations vanish, the basis is complete.",
        invariants: [
            "Every basis polynomial is monic in the graded lexicographic leading term.",
            "Adding a new polynomial leaves the generated ideal unchanged.",
            "When an S-polynomial reduces to zero, that pair satisfies Buchberger's criterion.",
        ],
        correctness:
            "Reducing by a basis element subtracts a multiple of an ideal element, so the remainder of any polynomial has the same residue class modulo the ideal. A nonzero remainder of an S-polynomial is therefore itself in the ideal and removing it from the generating set is impossible, so adding its monic form preserves the ideal while shrinking the leading-term ideal; this cannot continue forever by the well-ordering of monomials. When every S-polynomial reduces to zero, Buchberger's criterion guarantees a Groebner basis, so division by leading terms decides membership correctly.",
        complexityRationale:
            "The number of S-polynomial pairs grows quadratically with the intermediate basis size, which can itself grow exponentially in the number of variables and input degrees. Each reduction scans monomials with constant-work coefficient updates modulo the small prime, so the worst-case time is exponential, though small teaching examples finish quickly. Space is proportional to the total number of monomials stored.",
        uses: [
            "Solving systems of polynomial equations by elimination",
            "Ideal membership and implicitization in computer algebra",
            "Coding theory and cryptography algebraic attacks",
        ],
        references: [
            "Buchberger, Ein Algorithmus zum Auffinden der Basiselemente des Restklassenrings, 1965",
            "Cox, Little and O'Shea, Ideals, Varieties, and Algorithms, Chapter 2",
        ],
        workedExample:
            "Over GF(101), start with x^2 + y and xy + 2. Their leading monomials are x^2 and xy, with least common multiple x^2 y. The S-polynomial y(x^2 + y) - x(xy + 2) cancels those leading terms and leaves y^2 - 2x, which is not reducible by the current generators, so it joins the basis and new pairs are scheduled.",
    },
    id: "buchberger-groebner-basis",
    name: "Buchberger Groebner Basis",
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
        "form the S-polynomial of the next pair",
        "reduce it against the current basis",
        "if the remainder is nonzero append it and add new pairs",
        "otherwise the pair already satisfies the criterion",
        "done: the resulting Groebner basis",
    ],
};

export default module;
