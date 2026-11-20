/** berlekamp-polynomial-factorization.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./berlekamp-polynomial-factorization";
import type { VisualFrame } from "@/types";

type Poly = number[];

function trim(p: Poly): Poly {
    const c = p.slice();
    while (c.length > 1 && c[c.length - 1] === 0) c.pop();
    return c;
}

function multiply(a: Poly, b: Poly, p: number): Poly {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) {
            out[i + j] = (out[i + j]! + a[i]! * b[j]!) % p;
        }
    }
    return trim(out);
}

function remainder(a: Poly, b: Poly, p: number): Poly {
    const divisor = trim(b);
    let rest = trim(a);
    const leadInv = (v: number) => {
        let e = p - 2;
        let base = ((v % p) + p) % p;
        let result = 1;
        while (e > 0) {
            if (e % 2 === 1) result = (result * base) % p;
            base = (base * base) % p;
            e = Math.floor(e / 2);
        }
        return result;
    };
    while (rest.length >= divisor.length && !(rest.length === 1 && rest[0] === 0)) {
        const shift = rest.length - divisor.length;
        const factor = (rest[rest.length - 1]! * leadInv(divisor[divisor.length - 1]!)) % p;
        for (let i = 0; i < divisor.length; i += 1) {
            rest[shift + i] = ((((rest[shift + i] ?? 0) - factor * divisor[i]!) % p) + p) % p;
        }
        rest = trim(rest);
    }
    return rest;
}

function product(factors: Poly[], p: number): Poly {
    let acc = [1];
    for (const f of factors) acc = multiply(acc, f, p);
    return acc;
}

/** Brute-force irreducibility: no monic divisor of degree 1..floor(d/2). */
function isIrreducible(poly: Poly, p: number): boolean {
    const f = trim(poly);
    const d = f.length - 1;
    if (d <= 0) return false;
    for (let k = 1; k <= Math.floor(d / 2); k += 1) {
        const total = p ** k;
        for (let code = 0; code < total; code += 1) {
            const coeffs = new Array<number>(k + 1).fill(0);
            coeffs[k] = 1;
            let value = code;
            for (let i = 0; i < k; i += 1) {
                coeffs[i] = value % p;
                value = Math.floor(value / p);
            }
            const r = remainder(f, coeffs, p);
            if (r.length === 1 && r[0] === 0) return false;
        }
    }
    return true;
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

describe("Berlekamp polynomial factorization", () => {
    it("factors products of irreducibles into verified irreducible pieces", () => {
        const cases: Array<{ factors: Poly[]; p: number }> = [
            {
                factors: [
                    [0, 1],
                    [1, 1],
                    [1, 1, 1],
                ],
                p: 2,
            },
            {
                factors: [
                    [1, 1, 1],
                    [1, 1, 0, 1],
                ],
                p: 2,
            },
            {
                factors: [
                    [1, 1, 0, 1],
                    [1, 0, 1, 1],
                ],
                p: 2,
            },
            {
                factors: [
                    [1, 1],
                    [2, 1],
                    [2, 1, 1],
                ],
                p: 3,
            },
        ];
        for (const testCase of cases) {
            const original = product(testCase.factors, testCase.p);
            const frames = [...mod.run({ polynomial: original, modulus: testCase.p })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const found = (final?.["factors"] as unknown as string[] | undefined)?.map((s) =>
                s.split(",").map(Number),
            );
            expect(found).toBeDefined();
            expect(found!.length).toBe(testCase.factors.length);
            expect(product(found!, testCase.p)).toEqual(original);
            for (const f of found!) {
                expect(isIrreducible(f, testCase.p)).toBe(true);
            }
        }
    });

    it("returns a single irreducible polynomial unchanged", () => {
        const irreducible = [1, 1, 0, 0, 1]; // x^4 + x + 1 over GF(2)
        expect(isIrreducible(irreducible, 2)).toBe(true);
        const frames = [...mod.run({ polynomial: irreducible, modulus: 2 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["count"]).toBe(1);
        expect(
            ((final?.["factors"] as unknown as string[])[0] ?? "").split(",").map(Number),
        ).toEqual(irreducible);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
