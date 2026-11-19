/** buchberger-groebner-basis.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./buchberger-groebner-basis";
import type { VisualFrame } from "@/types";

type Term = [number, number, number];
type Poly = Map<string, [number, number, number]>;

const P = 101;

function k(ex: number, ey: number): string {
    return `${ex},${ey}`;
}

function toPoly(terms: Term[]): Poly {
    const m: Poly = new Map();
    for (const [c, ex, ey] of terms) {
        const coeff = ((c % P) + P) % P;
        if (coeff === 0) continue;
        const key = k(ex, ey);
        const next = (m.get(key)?.[0] ?? 0) + coeff;
        if (next % P === 0) m.delete(key);
        else m.set(key, [next % P, ex, ey]);
    }
    return m;
}

function compare(a: [number, number], b: [number, number]): number {
    if (a[0] + a[1] !== b[0] + b[1]) return a[0] + a[1] - (b[0] + b[1]);
    return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
}

function leading(poly: Poly): Term | undefined {
    let best: Term | undefined;
    for (const term of poly.values()) {
        if (!best || compare([term[1], term[2]], [best[1], best[2]]) > 0) best = term;
    }
    return best;
}

function inv(a: number): number {
    let e = P - 2;
    let base = ((a % P) + P) % P;
    let r = 1;
    while (e > 0) {
        if (e % 2 === 1) r = (r * base) % P;
        base = (base * base) % P;
        e = Math.floor(e / 2);
    }
    return r;
}

function normalForm(input: Poly, basis: Poly[]): Poly {
    const f = new Map(input);
    for (let guard = 0; guard < 5000; guard += 1) {
        const lead = leading(f);
        if (!lead) break;
        let done = false;
        for (const g of basis) {
            const gl = leading(g);
            if (!gl || gl[1] > lead[1] || gl[2] > lead[2]) continue;
            const factor = (lead[0] * inv(gl[0])) % P;
            const sx = lead[1] - gl[1];
            const sy = lead[2] - gl[2];
            for (const term of g.values()) {
                const ex = term[1] + sx;
                const ey = term[2] + sy;
                const key = k(ex, ey);
                const value = ((((f.get(key)?.[0] ?? 0) - factor * term[0]) % P) + P) % P;
                if (value === 0) f.delete(key);
                else f.set(key, [value, ex, ey]);
            }
            done = true;
            break;
        }
        if (!done) break;
    }
    return f;
}

function spoly(f: Poly, g: Poly): Poly {
    const lf = leading(f)!;
    const lg = leading(g)!;
    const lx = Math.max(lf[1], lg[1]);
    const ly = Math.max(lf[2], lg[2]);
    const out: Poly = new Map();
    const put = (term: Term, sx: number, sy: number, factor: number) => {
        const ex = term[1] + sx;
        const ey = term[2] + sy;
        const key = k(ex, ey);
        const value = ((((out.get(key)?.[0] ?? 0) + factor * term[0]) % P) + P) % P;
        if (value === 0) out.delete(key);
        else out.set(key, [value, ex, ey]);
    };
    for (const term of f.values()) put(term, lx - lf[1], ly - lf[2], inv(lf[0]));
    for (const term of g.values()) put(term, lx - lg[1], ly - lg[2], -inv(lg[0]));
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Buchberger Groebner basis", () => {
    it("returns a Groebner basis that reduces every generator and all S-polynomials to zero", () => {
        const cases: Term[][][] = [
            [
                [
                    [1, 2, 0],
                    [1, 0, 1],
                ],
                [
                    [1, 1, 1],
                    [2, 0, 0],
                ],
            ],
            [
                [
                    [1, 1, 0],
                    [1, 0, 1],
                ],
                [
                    [1, 1, 0],
                    [P - 1, 0, 1],
                ],
            ],
            [
                [
                    [1, 2, 0],
                    [P - 1, 0, 0],
                ],
                [
                    [1, 1, 1],
                    [P - 1, 0, 0],
                ],
            ],
            [
                [
                    [3, 2, 1],
                    [5, 0, 0],
                ],
            ],
        ];
        for (const generators of cases) {
            const frames = [...mod.run({ generators, modulus: P })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const basisTerms = ((final?.["basis"] as unknown as string[]) ?? []).map((poly) =>
                poly
                    .split(";")
                    .filter(Boolean)
                    .map((term) => term.split(",").map(Number) as Term),
            );
            expect(basisTerms).toBeDefined();
            const basis = basisTerms.map(toPoly);

            // Every basis polynomial is monic.
            for (const poly of basis) {
                expect(leading(poly)![0]).toBe(1);
            }
            // Every original generator reduces to zero by the basis.
            for (const generator of generators) {
                expect(normalForm(toPoly(generator), basis).size).toBe(0);
            }
            // Buchberger criterion: all pairwise S-polynomials reduce to zero.
            for (let i = 0; i < basis.length; i += 1) {
                for (let j = i + 1; j < basis.length; j += 1) {
                    expect(normalForm(spoly(basis[i]!, basis[j]!), basis).size).toBe(0);
                }
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
