/** f5-groebner-basis.test.ts - Brute-force Buchberger cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./f5-groebner-basis";
import type { VisualFrame } from "@/types";

type Mon = number[];
type Poly = Map<string, number>;

const MOD = 32003;
const NV = 3;

function norm(a: number): number {
    const r = a % MOD;
    return r < 0 ? r + MOD : r;
}
function modPow(a: number, e: number): number {
    let r = 1;
    let b = norm(a);
    let x = e;
    while (x > 0) {
        if (x % 2 === 1) r = norm(r * b);
        b = norm(b * b);
        x = Math.floor(x / 2);
    }
    return r;
}
function inv(a: number): number {
    return modPow(a, MOD - 2);
}
function keyOf(m: Mon): string {
    return m.join(",");
}
function monOf(k: string): Mon {
    return k.split(",").map(Number);
}
function deg(m: Mon): number {
    return m.reduce((a, b) => a + b, 0);
}
function cmp(a: Mon, b: Mon): number {
    const da = deg(a);
    const db = deg(b);
    if (da !== db) return da - db;
    for (let i = NV - 1; i >= 0; i -= 1) if (a[i] !== b[i]) return b[i]! - a[i]!;
    return 0;
}
function divides(a: Mon, b: Mon): boolean {
    for (let i = 0; i < NV; i += 1) if (a[i]! > b[i]!) return false;
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
function addTerm(p: Poly, k: string, v: number): void {
    const n = norm((p.get(k) ?? 0) + v);
    if (n === 0) p.delete(k);
    else p.set(k, n);
}
function fromTerms(terms: Array<[Mon, number]>): Poly {
    const p = new Map<string, number>();
    for (const [m, c] of terms) addTerm(p, keyOf(m), c);
    return p;
}
function leading(p: Poly): { key: string; mon: Mon; coeff: number } | null {
    let bk: string | null = null;
    let bm: Mon | null = null;
    for (const [k] of p) {
        const m = monOf(k);
        if (bm === null || cmp(m, bm) > 0) {
            bm = m;
            bk = k;
        }
    }
    if (bk === null || bm === null) return null;
    return { key: bk, mon: bm, coeff: p.get(bk)! };
}
function addScaled(dest: Poly, src: Poly, scale: number, shift: Mon): void {
    if (scale === 0) return;
    const s = norm(scale);
    for (const [k, c] of src) {
        addTerm(dest, keyOf(addM(monOf(k), shift)), norm(s * c));
    }
}
function sPoly(f: Poly, g: Poly): Poly {
    const lf = leading(f)!;
    const lg = leading(g)!;
    const lcm = lcmM(lf.mon, lg.mon);
    const out = new Map<string, number>();
    addScaled(out, f, inv(lf.coeff), subM(lcm, lf.mon));
    addScaled(out, g, -norm(lf.coeff * inv(lg.coeff)), subM(lcm, lg.mon));
    return out;
}
function reduce(poly: Poly, basis: Poly[]): Poly {
    let cur = new Map(poly);
    for (let guard = 0; guard < 5000; guard += 1) {
        const lt = leading(cur);
        if (!lt) break;
        let chosen: Poly | null = null;
        let chosenLT: ReturnType<typeof leading> = null;
        for (const g of basis) {
            const glt = leading(g);
            if (!glt || !divides(glt.mon, lt.mon)) continue;
            if (!chosenLT || cmp(glt.mon, chosenLT.mon) > 0) {
                chosen = g;
                chosenLT = glt;
            }
        }
        if (!chosen || !chosenLT) break;
        const factor = norm(lt.coeff * inv(chosenLT.coeff));
        addScaled(cur, chosen, -factor, subM(lt.mon, chosenLT.mon));
    }
    return cur;
}
/** Independent brute-force Buchberger basis. */
function buchberger(gens: Poly[]): Poly[] {
    const basis = gens.map((g) => new Map(g));
    const done = new Set<string>();
    for (let guard = 0; guard < 20000; guard += 1) {
        let work = false;
        for (let i = 0; i < basis.length; i += 1) {
            for (let j = i + 1; j < basis.length; j += 1) {
                const ltI = leading(basis[i]!);
                const ltJ = leading(basis[j]!);
                if (!ltI || !ltJ) continue;
                const id = keyOf(ltI.mon) + "|" + keyOf(ltJ.mon);
                if (done.has(id)) continue;
                done.add(id);
                work = true;
                const rem = reduce(sPoly(basis[i]!, basis[j]!), basis);
                if (leading(rem)) basis.push(rem);
            }
        }
        if (!work) break;
    }
    return basis;
}
function leadingMonomials(basis: Poly[]): Set<string> {
    const set = new Set<string>();
    for (const p of basis) {
        const lt = leading(p);
        if (lt) set.add(keyOf(lt.mon));
    }
    return set;
}
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const gens: Array<Array<[Mon, number]>> = [
    [[[2, 0, 0], 1], [[0, 1, 1], -1]],
    [[[0, 2, 0], 1], [[1, 0, 1], -1]],
    [[[0, 0, 2], 1], [[1, 1, 0], -1]],
];

describe("F5 Groebner basis", () => {
    it("produces the same leading monomial ideal as brute-force Buchberger", () => {
        const frames = [...mod.run({ polynomials: gens })];
        checkFrames(frames);
        const final = frames[frames.length - 1]!.meta;
        const lm = (final["leadingMonomials"] as string[]).filter(Boolean);
        const parsePoly = (s: string): Poly => {
            const p = new Map<string, number>();
            if (!s) return p;
            for (const part of s.split(";")) {
                const [k, c] = part.split(":");
                p.set(k!, Number(c));
            }
            return p;
        };
        const f5Basis = (final["basisPolynomials"] as string[]).map(parsePoly);
        const reference = buchberger(gens.map(fromTerms));
        const refLM = leadingMonomials(reference);
        expect(new Set(lm)).toEqual(refLM);

        // The two bases generate the same ideal: membership holds both ways.
        for (const p of f5Basis) expect(leading(reduce(p, reference))).toBeNull();
        for (const p of reference) expect(leading(reduce(p, f5Basis))).toBeNull();
    });

    it("returns a Groebner basis: every S-polynomial reduces to zero", () => {
        const frames = [...mod.run({ polynomials: gens })];
        const final = frames[frames.length - 1]!.meta;
        const parsePoly = (s: string): Poly => {
            const p = new Map<string, number>();
            if (!s) return p;
            for (const part of s.split(";")) {
                const [k, c] = part.split(":");
                p.set(k!, Number(c));
            }
            return p;
        };
        const basis = (final["basisPolynomials"] as string[]).map(parsePoly);
        for (let i = 0; i < basis.length; i += 1) {
            for (let j = i + 1; j < basis.length; j += 1) {
                expect(leading(reduce(sPoly(basis[i]!, basis[j]!), basis))).toBeNull();
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
