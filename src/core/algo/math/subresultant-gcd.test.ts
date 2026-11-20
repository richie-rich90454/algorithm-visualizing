/** subresultant-gcd.test.ts - Independent rational-GCD reference, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./subresultant-gcd";
import type { VisualFrame } from "@/types";

type Rat = { n: bigint; d: bigint };
type QPoly = Rat[];

const mk = (n: bigint, d: bigint = 1n): Rat => {
    if (d === 0n) throw new Error("zero denominator");
    const g = (a: bigint, b: bigint): bigint => {
        let x = a < 0n ? -a : a;
        let y = b < 0n ? -b : b;
        while (y !== 0n) { const t = x % y; x = y; y = t; }
        return x;
    };
    const divisor = g(n, d);
    let nn = n / divisor;
    let dd = d / divisor;
    if (dd < 0n) { nn = -nn; dd = -dd; }
    return { n: nn, d: dd };
};
const add = (a: Rat, b: Rat): Rat => mk(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Rat, b: Rat): Rat => mk(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Rat, b: Rat): Rat => mk(a.n * b.n, a.d * b.d);
const div = (a: Rat, b: Rat): Rat => mk(a.n * b.d, a.d * b.n);
const zero: Rat = { n: 0n, d: 1n };
const isZeroRat = (r: Rat): boolean => r.n === 0n;

const trimQ = (p: QPoly): QPoly => {
    const q = p.slice();
    while (q.length > 1 && isZeroRat(q[q.length - 1] ?? zero)) q.pop();
    return q;
};
const degQ = (p: QPoly): number => trimQ(p).length - 1;
const lcQ = (p: QPoly): Rat => trimQ(p)[trimQ(p).length - 1] ?? zero;
const isZeroQ = (p: QPoly): boolean => trimQ(p).length === 1 && isZeroRat(trimQ(p)[0] ?? zero);

function remQ(a: QPoly, b: QPoly): QPoly {
    let r = trimQ(a);
    const bp = trimQ(b);
    let guard = 0;
    while (!isZeroQ(r) && degQ(r) >= degQ(bp) && guard < 1000) {
        const factor = div(lcQ(r), lcQ(bp));
        const shift = degQ(r) - degQ(bp);
        const next: QPoly = [];
        for (let i = 0; i < Math.max(r.length, shift + bp.length); i += 1) {
            const shifted = i >= shift ? mul(factor, bp[i - shift] ?? zero) : zero;
            next.push(sub(r[i] ?? zero, shifted));
        }
        r = trimQ(next);
        guard += 1;
    }
    return r;
}

/** Independent Euclidean gcd over the rationals, returned monic. */
function referenceGcd(a: number[], b: number[]): QPoly {
    let A: QPoly = a.map((n) => mk(BigInt(n)));
    let B: QPoly = b.map((n) => mk(BigInt(n)));
    let guard = 0;
    while (!isZeroQ(B) && guard < 1000) {
        const R = remQ(A, B);
        A = B;
        B = R;
        guard += 1;
    }
    const monic = A.map((c) => div(c, lcQ(A)));
    return trimQ(monic);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.entities.every((e) => typeof e.metadata["row"] === "number" && typeof e.metadata["col"] === "number")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBeDefined();
        expect(frame.meta["cols"]).toBeDefined();
    });
}

describe("Subresultant Polynomial GCD", () => {
    it("matches an independent rational gcd on random polynomial pairs", () => {
        let seed = 11;
        const rand = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return (seed % 9) - 4;
        };
        for (let t = 0; t < 20; t += 1) {
            const a = Array.from({ length: 2 + (t % 4) }, () => rand());
            const b = Array.from({ length: 2 + ((t + 1) % 4) }, () => rand());
            if (a.every((n) => n === 0) || b.every((n) => n === 0)) continue;
            const frames = [...mod.run({ a, b })];
            checkFrames(frames);
            const coeffs = frames[frames.length - 1]?.meta["gcdCoeffs"] as string[];
            expect(Array.isArray(coeffs)).toBe(true);
            const moduleGcd: QPoly = coeffs.map((c) => mk(BigInt(c), 1n));
            const monic = trimQ(moduleGcd.map((c) => div(c, lcQ(moduleGcd))));
            const expected = referenceGcd(a, b);
            expect(monic.length).toBe(expected.length);
            for (let i = 0; i < monic.length; i += 1) {
                expect(monic[i]?.n).toBe(expected[i]?.n);
                expect(monic[i]?.d).toBe(expected[i]?.d);
            }
        }
    });

    it("reports a constant gcd for a known coprime pair", () => {
        const frames = [...mod.run({ a: [1, 0, 1], b: [0, 1] })];
        expect(frames[frames.length - 1]?.meta["gcdCoeffs"]).toEqual(["1"]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
