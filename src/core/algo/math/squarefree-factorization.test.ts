/**
 * squarefree-factorization.test.ts - Brute-force root-multiplicity cross-check,
 * frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./squarefree-factorization";
import type { VisualFrame } from "@/types";

const P = 101;

function polyMul(a: number[], b: number[]): number[] {
    const out = new Array<number>(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i += 1) {
        for (let j = 0; j < b.length; j += 1) out[i + j] = (out[i + j]! + a[i]! * b[j]!) % P;
    }
    return out;
}

function polyFromRoots(roots: number[]): number[] {
    let poly = [1];
    for (const r of roots) poly = polyMul(poly, [(-r % P + P) % P, 1]);
    return poly;
}

function multiplicityOf(poly: number[], root: number): number {
    let current = [...poly];
    let count = 0;
    while (current.length > 1) {
        const remainder = current.reduceRight((acc, c) => (acc * root + c) % P, 0);
        if (remainder !== 0) break;
        const quotient = new Array<number>(current.length - 1).fill(0);
        let carry = 0;
        for (let i = current.length - 1; i > 0; i -= 1) {
            const value = current[i]! + carry;
            quotient[i - 1] = value;
            carry = root * value % P;
        }
        current = quotient;
        count += 1;
    }
    return count;
}

function expectedFactors(poly: number[]): Map<number, number[]> {
    const groups = new Map<number, number[]>();
    for (let r = 0; r < P; r += 1) {
        const m = multiplicityOf(poly, r);
        if (m === 0) continue;
        if (!groups.has(m)) groups.set(m, []);
        groups.get(m)!.push(r);
    }
    const result = new Map<number, number[]>();
    for (const [m, roots] of groups) result.set(m, polyFromRoots(roots));
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode!.length);
        expect(frame.meta).toBeDefined();
    });
}

describe("SquarefreeFactorization", () => {
    it("matches brute-force root multiplicities", () => {
        const cases = [
            polyFromRoots([1, 1, 2]),
            polyFromRoots([3, 3, 3, 5]),
            polyFromRoots([2, 2, 4, 4, 7]),
            polyFromRoots([1, 2, 3, 5, 7]),
        ];
        for (const poly of cases) {
            const frames = [...mod.run({ coefficients: poly, modulus: P })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]!.meta;
            const coeffs = meta["factorCoefficients"] as number[];
            const mults = meta["factorMultiplicities"] as number[];
            const expected = expectedFactors(poly);
            let offset = 0;
            for (let i = 0; i < mults.length; i += 1) {
                const m = mults[i]!;
                const want = expected.get(m);
                expect(want).toBeDefined();
                const got = coeffs.slice(offset, offset + want!.length);
                // Factors are monic; normalize the brute-force product likewise.
                const lead = want![want!.length - 1]!;
                const invLead = lead === 1 ? 1 : Math.pow(lead, P - 2) % P;
                expect(got).toEqual(want!.map((c) => c * invLead % P));
                offset += want!.length;
            }
            expect(offset).toBe(coeffs.length);
        }
    });

    it("reconstructs the input by multiplying factors with multiplicity", () => {
        const poly = polyFromRoots([1, 1, 2]);
        const frames = [...mod.run({ coefficients: poly, modulus: P })];
        const meta = frames[frames.length - 1]!.meta;
        const coeffs = meta["factorCoefficients"] as number[];
        const mults = meta["factorMultiplicities"] as number[];
        const degrees = meta["factorDegrees"] as number[];
        let offset = 0;
        let rebuilt = [1];
        for (let i = 0; i < mults.length; i += 1) {
            const length = degrees[i]! + 1;
            const factor = coeffs.slice(offset, offset + length);
            for (let k = 0; k < mults[i]!; k += 1) rebuilt = polyMul(rebuilt, factor);
            offset += length;
        }
        expect(rebuilt.map((c) => (c % P + P) % P)).toEqual(poly.map((c) => (c % P + P) % P));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
