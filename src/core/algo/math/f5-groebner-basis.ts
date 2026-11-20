/**
 * f5-groebner-basis.ts - F5 Signature-Based Groebner Basis
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Faugere's F5 algorithm computes a Groebner basis of a homogeneous ideal by
 * attaching a signature (a monomial times a generator index) to every
 * intermediate polynomial. A critical pair whose signature is divisible by the
 * leading monomial of an earlier polynomial is discarded by the F5 criterion,
 * and the remaining pairs are reduced with signature-safe row operations. This
 * removes most of the redundant work Buchberger's algorithm performs.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(number of non-singular critical pairs * reduction cost)
 *   Space: O(size of the basis + signatures)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each polynomial in the current basis is one row of coefficient cells.
 *   - The pair being examined is highlighted (comparing); a discarded pair is
 *     marked error; a new basis element is sorted.
 *   - The final frame reports the number of basis elements and skipped pairs.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Mon = number[];
type Poly = Map<string, number>;
type Sig = { mon: Mon; index: number };
type Labeled = { poly: Poly; sig: Sig };
type TermInput = [Mon, number];

const MOD = 32003;
const NV = 3;

function norm(a: number): number {
    const r = a % MOD;
    return r < 0 ? r + MOD : r;
}

function modPow(a: number, e: number): number {
    let result = 1;
    let base = norm(a);
    let exp = e;
    while (exp > 0) {
        if (exp % 2 === 1) result = norm(result * base);
        base = norm(base * base);
        exp = Math.floor(exp / 2);
    }
    return result;
}

function inv(a: number): number {
    return modPow(a, MOD - 2);
}

function keyOf(m: Mon): string {
    return m.join(",");
}

function monOf(key: string): Mon {
    return key.split(",").map(Number);
}

function deg(m: Mon): number {
    return m.reduce((a, b) => a + b, 0);
}

/** Grevlex comparison: negative when a < b. */
function cmp(a: Mon, b: Mon): number {
    const da = deg(a);
    const db = deg(b);
    if (da !== db) return da - db;
    for (let i = NV - 1; i >= 0; i -= 1) {
        if (a[i] !== b[i]) return b[i]! - a[i]!;
    }
    return 0;
}

function le(a: Mon, b: Mon): boolean {
    return cmp(a, b) <= 0;
}

function divides(a: Mon, b: Mon): boolean {
    for (let i = 0; i < NV; i += 1) {
        if (a[i]! > b[i]!) return false;
    }
    return true;
}

function subM(a: Mon, b: Mon): Mon {
    return a.map((x, i) => x - (b[i] ?? 0));
}

function addM(a: Mon, b: Mon): Mon {
    return a.map((x, i) => x + (b[i] ?? 0));
}

function lcmM(a: Mon, b: Mon): Mon {
    return a.map((x, i) => Math.max(x, b[i] ?? 0));
}

function zeroMon(): Mon {
    return Array.from({ length: NV }, () => 0);
}

function addTerm(p: Poly, key: string, value: number): void {
    const next = norm((p.get(key) ?? 0) + value);
    if (next === 0) p.delete(key);
    else p.set(key, next);
}

function fromTerms(terms: TermInput[]): Poly {
    const p = new Map<string, number>();
    for (const [m, c] of terms) addTerm(p, keyOf(m), c);
    return p;
}

function clonePoly(p: Poly): Poly {
    return new Map(p);
}

type LT = { key: string; mon: Mon; coeff: number };

function leading(p: Poly): LT | null {
    let bestKey: string | null = null;
    let bestMon: Mon | null = null;
    for (const [key] of p) {
        const mon = monOf(key);
        if (bestMon === null || cmp(mon, bestMon) > 0) {
            bestMon = mon;
            bestKey = key;
        }
    }
    if (bestKey === null || bestMon === null) return null;
    return { key: bestKey, mon: bestMon, coeff: p.get(bestKey)! };
}

/** dest += scale * shift(src) over GF(MOD). */
function addScaled(dest: Poly, src: Poly, scale: number, shift: Mon): void {
    if (scale === 0) return;
    const s = norm(scale);
    for (const [key, coeff] of src) {
        const shifted = addM(monOf(key), shift);
        addTerm(dest, keyOf(shifted), norm(s * coeff));
    }
}

function sPoly(f: Poly, g: Poly): Poly {
    const lf = leading(f);
    const lg = leading(g);
    if (!lf || !lg) return new Map();
    const lcm = lcmM(lf.mon, lg.mon);
    const tf = subM(lcm, lf.mon);
    const tg = subM(lcm, lg.mon);
    const out = new Map<string, number>();
    addScaled(out, f, inv(lf.coeff), tf);
    addScaled(out, g, -norm(lf.coeff * inv(lg.coeff)), tg);
    return out;
}

/** Larger signature wins; on equal monomials the smaller generator index wins. */
function maxSig(a: Sig, b: Sig): Sig {
    const c = cmp(a.mon, b.mon);
    if (c > 0) return a;
    if (c < 0) return b;
    return a.index <= b.index ? a : b;
}

function sigPair(sig: Sig): [number, number, number] {
    return [deg(sig.mon), sig.index, deg(sig.mon)];
}

function sigLess(a: Sig, b: Sig): boolean {
    const ka = sigPair(a);
    const kb = sigPair(b);
    for (let i = 0; i < 3; i += 1) {
        if (ka[i]! !== kb[i]!) return ka[i]! < kb[i]!;
    }
    // Tie-break by grevlex of the signature monomial.
    return cmp(a.mon, b.mon) < 0;
}

/** F5 criterion: discard a signature divisible by an earlier leading monomial. */
function f5Criterion(sig: Sig, basis: Labeled[]): boolean {
    for (const g of basis) {
        if (g.sig.index >= sig.index) continue;
        const lt = leading(g.poly);
        if (lt && divides(lt.mon, sig.mon)) return true;
    }
    return false;
}

/** Signature-safe reduction: only earlier generators whose multiplier keeps the signature. */
function reduceF5(poly: Poly, sig: Sig, basis: Labeled[]): Poly {
    let cur = clonePoly(poly);
    for (let guard = 0; guard < 5000; guard += 1) {
        const lt = leading(cur);
        if (!lt) break;
        let reducer: Labeled | null = null;
        let reducerLT: LT | null = null;
        let multiplier: Mon | null = null;
        for (const g of basis) {
            if (g.sig.index >= sig.index) continue;
            const glt = leading(g.poly);
            if (!glt || !divides(glt.mon, lt.mon)) continue;
            const t = subM(lt.mon, glt.mon);
            if (!le(addM(t, g.sig.mon), sig.mon)) continue;
            if (!reducerLT || cmp(glt.mon, reducerLT.mon) > 0) {
                reducer = g;
                reducerLT = glt;
                multiplier = t;
            }
        }
        if (!reducer || !reducerLT || !multiplier) break;
        const factor = norm(lt.coeff * inv(reducerLT.coeff));
        addScaled(cur, reducer.poly, -factor, multiplier);
    }
    return cur;
}

function polyToString(poly: Poly): string {
    const terms: string[] = [];
    for (const [key, coeff] of poly) terms.push(`${key}:${coeff}`);
    terms.sort();
    return terms.join(";");
}

function makeBasisEntities(
    basis: Labeled[],
    activeIndex: number,
    states: Map<number, EntityState>,
): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let row = 0; row < basis.length; row += 1) {
        const lt = leading(basis[row]!.poly);
        const mon = lt ? lt.mon : zeroMon();
        const sig = basis[row]!.sig;
        const state = states.get(row) ?? (row === activeIndex ? "comparing" : "idle");
        for (let col = 0; col < NV; col += 1) {
            entities.push({
                id: `cell-${row}-${col}`,
                type: "cell" as const,
                label: `e${mon[col]!}+s${sig.mon[col]!}`,
                value: mon[col]!,
                state,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row, col, exponent: mon[col]!, signature: sig.mon[col]!, generator: sig.index },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { polynomials?: TermInput[][] } | null) ?? {};
    const raw = task.polynomials ?? [
        [[[2, 0, 0], 1], [[0, 1, 1], -1]],
        [[[0, 2, 0], 1], [[1, 0, 1], -1]],
        [[[0, 0, 2], 1], [[1, 1, 0], -1]],
    ];
    const basis: Labeled[] = [];
    for (let i = 0; i < raw.length; i += 1) {
        basis.push({ poly: fromTerms(raw[i] ?? []), sig: { mon: zeroMon(), index: i } });
    }

    let step = 0;
    let skipped = 0;
    let additions = 0;
    yield {
        stepNumber: step,
        entities: makeBasisEntities(basis, -1, new Map()),
        edges: [],
        description: `Starting F5 with ${basis.length} homogeneous generators over GF(${MOD}).`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { basisSize: basis.length, skipped, additions, modulus: MOD },
    };
    step += 1;

    type Pair = { a: number; b: number; sig: Sig };
    const pairs: Pair[] = [];
    for (let i = 0; i < basis.length; i += 1) {
        for (let j = i + 1; j < basis.length; j += 1) {
            pairs.push({ a: i, b: j, sig: maxSig(basis[i]!.sig, basis[j]!.sig) });
        }
    }
    const seen = new Set<string>();

    while (pairs.length > 0) {
        let best = 0;
        for (let i = 1; i < pairs.length; i += 1) {
            if (sigLess(pairs[i]!.sig, pairs[best]!.sig)) best = i;
        }
        const pair = pairs.splice(best, 1)[0]!;
        const fa = basis[pair.a]!;
        const fb = basis[pair.b]!;
        const lf = leading(fa.poly);
        const lg = leading(fb.poly);
        if (!lf || !lg) continue;

        const lcm = lcmM(lf.mon, lg.mon);
        const sigA: Sig = { mon: addM(subM(lcm, lf.mon), fa.sig.mon), index: fa.sig.index };
        const sigB: Sig = { mon: addM(subM(lcm, lg.mon), fb.sig.mon), index: fb.sig.index };
        const sig = maxSig(sigA, sigB);
        const pid = keyOf(sig.mon) + ":" + sig.index;
        if (seen.has(pid)) continue;
        seen.add(pid);

        if (f5Criterion(sig, basis)) {
            skipped += 1;
            const states = new Map<number, EntityState>([[pair.a, "error" as EntityState]]);
            yield {
                stepNumber: step,
                entities: makeBasisEntities(basis, pair.a, states),
                edges: [],
                description: `Discard pair (${pair.a},${pair.b}): signature is divisible by an earlier leading monomial.`,
                codeLineNumber: 3,
                layout: "grid",
                meta: { basisSize: basis.length, skipped, additions, pair: [pair.a, pair.b] },
            };
            step += 1;
            continue;
        }

        const sp = sPoly(fa.poly, fb.poly);
        const remainder = reduceF5(sp, sig, basis);
        if (leading(remainder) === null) {
            yield {
                stepNumber: step,
                entities: makeBasisEntities(basis, pair.a, new Map([[pair.a, "path" as EntityState]])),
                edges: [],
                description: `Pair (${pair.a},${pair.b}) reduces to zero and adds no basis element.`,
                codeLineNumber: 5,
                layout: "grid",
                meta: { basisSize: basis.length, skipped, additions, pair: [pair.a, pair.b] },
            };
            step += 1;
            continue;
        }

        const index = basis.length;
        basis.push({ poly: remainder, sig });
        additions += 1;
        for (let i = 0; i < index; i += 1) {
            pairs.push({ a: i, b: index, sig: maxSig(basis[i]!.sig, sig) });
        }
        yield {
            stepNumber: step,
            entities: makeBasisEntities(basis, index, new Map([[index, "sorted" as EntityState]])),
            edges: [],
            description: `Add a new basis element from pair (${pair.a},${pair.b}); basis size is now ${basis.length}.`,
            codeLineNumber: 6,
            layout: "grid",
            meta: { basisSize: basis.length, skipped, additions, pair: [pair.a, pair.b] },
        };
        step += 1;
        if (step > 400) break;
    }

    yield {
        stepNumber: step,
        entities: makeBasisEntities(basis, -1, new Map(basis.map((_, i) => [i, "sorted" as EntityState]))),
        edges: [],
        description: `F5 finished with a ${basis.length}-element Groebner basis; ${skipped} pair(s) discarded by the signature criterion.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            basisSize: basis.length,
            skipped,
            additions,
            modulus: MOD,
            basisPolynomials: basis.map((g) => polyToString(g.poly)),
            leadingMonomials: basis.map((g) => {
                const lt = leading(g.poly);
                return lt ? keyOf(lt.mon) : "";
            }),
        },
    };
}

/** The F5 signature-based Groebner basis module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Buchberger's algorithm recomputes many reductions that are guaranteed to be useless. F5 attaches a signature to every intermediate polynomial: the monomial multiplier together with the index of the original generator it came from. If that signature is already divisible by a leading monomial produced from an earlier generator, the corresponding critical pair can never contribute a new basis element, so it is skipped before any arithmetic is done.",
        invariants: [
            "Every intermediate polynomial carries a signature m*e_k for a monomial m and generator index k.",
            "A critical pair is discarded only when an earlier leading monomial divides its signature monomial.",
            "Signature-safe reduction uses only earlier generators and never increases the signature.",
            "The ideal generated by the current basis equals the ideal generated by the input generators.",
        ],
        correctness:
            "For homogeneous input the F5 criterion marks exactly those critical pairs whose S-polynomials reduce to zero using earlier generators, so discarding them removes no needed element. Signature-safe reduction keeps each new polynomial's true signature equal to its attached label, which makes every later criterion test sound. The surviving S-polynomials therefore eventually have zero normal form, which by Buchberger's criterion means the final set is a Groebner basis of the same ideal.",
        complexityRationale:
            "Cost is dominated by the number of surviving critical pairs times the cost of reducing each one against the current basis. The signature test is a divisibility check per basis element, and the reductions operate on short coefficient vectors, so F5 wins whenever the criterion eliminates a large fraction of Buchberger's pairs.",
        uses: [
            "Computing Groebner bases in computer algebra systems such as Singular and Magma",
            "Solving polynomial systems in cryptography and coding theory",
            "Elimination and ideal membership tests in symbolic computation",
        ],
        references: [
            "Faugere, A New Efficient Algorithm for Computing Groebner Bases (F5), 2002",
            "Cox, Little and O'Shea, Ideals, Varieties, and Algorithms, Chapter 2",
        ],
        workedExample:
            "For the three homogeneous quadratics x^2-yz, y^2-xz, z^2-xy over GF(32003), the first pairs produce new signature-tagged polynomials. Once a signature such as xz*e_1 is divisible by a leading monomial from generator 0, F5 discards that pair outright. The surviving pairs finish with a small basis whose leading monomials generate the same initial ideal as a full Buchberger run.",
    },
    id: "f5-groebner-basis",
    name: "F5 Groebner Basis",
    category: "math",
    complexity: { time: "O(surviving pairs * reduction)", space: "O(basis + signatures)" },
    defaultInput: {
        polynomials: [
            [[[2, 0, 0], 1], [[0, 1, 1], -1]],
            [[[0, 2, 0], 1], [[1, 0, 1], -1]],
            [[[0, 0, 2], 1], [[1, 1, 0], -1]],
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "tag each input generator with signature e_k and add it to the basis",
        "queue every critical pair ordered by signature degree",
        "take the pair with the smallest signature",
        "discard it if an earlier leading monomial divides its signature",
        "otherwise form the S-polynomial of the pair",
        "reduce it using only earlier signature-safe generators",
        "if the remainder is nonzero append it with its signature",
        "queue new pairs formed with the new basis element",
        "done: return the basis of polynomials",
    ],
};

export default module;
