/** pocklington-primality-criterion.test.ts - Verdicts checked against trial division. */

import { describe, expect, it } from "vitest";
import mod, { gcdBig, pocklington, powModBig, smallFactorization } from "./pocklington-primality-criterion";
import type { VisualFrame } from "@/types";

function isPrimeTrial(n: number): boolean {
    if (n < 2) return false;
    for (let d = 2; d * d <= n; d += 1) if (n % d === 0) return false;
    return true;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Pocklington criterion", () => {
    it("matches an independent BigInt exponentiation and gcd", () => {
        const referencePow = (base: bigint, exp: bigint, mod: bigint): bigint => {
            let result = 1n;
            for (let i = 0n; i < exp; i += 1n) result = (result * base) % mod;
            return result;
        };
        for (const [base, exp, m] of [[2n, 10n, 101n], [3n, 20n, 97n], [5n, 15n, 131n]] as const) {
            expect(powModBig(base, exp, m)).toBe(referencePow(base, exp, m));
        }
        expect(gcdBig(12n, 18n)).toBe(6n);
        expect(smallFactorization(100n, 50)).toEqual([[2n, 2], [5n, 2]]);
    });

    it("gives the correct verdict on numbers with smooth n-1", () => {
        const samples = [
            5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
            73, 79, 83, 89, 97, 101, 103, 109, 113, 127, 131, 137, 139, 149, 151,
            9, 15, 21, 25, 27, 33, 35, 49, 55, 65, 77, 85, 91, 95, 121, 125, 143,
        ];
        for (const n of samples) {
            const result = pocklington(n, 200);
            expect(result.proved).toBe(true);
            expect(result.prime).toBe(isPrimeTrial(n));
        }
    });

    it("emits well-formed frames and terminates with the expected verdict", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["prime"]).toBe(true);
        expect(final?.meta["proved"]).toBe(true);
        expect(generator.next().done).toBe(true);
    });
});
