/**
 * stark-proof.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./stark-proof";
import type { VisualFrame } from "@/types";

const PRIME = 65537;

function powMod(base: number, exponent: number, mod: number): number {
    let result = 1;
    let b = ((base % mod) + mod) % mod;
    let e = exponent;
    while (e > 0) {
        if (e & 1) {
            result = (result * b) % mod;
        }
        b = (b * b) % mod;
        e = Math.floor(e / 2);
    }
    return result;
}

function evalPoly(coeffs: number[], x: number, mod: number): number {
    let result = 0;
    for (let i = coeffs.length - 1; i >= 0; i -= 1) {
        result = ((result * x) + ((coeffs[i] ?? 0) % mod) + mod) % mod;
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("STARK Proof (FRI Folding Step)", () => {
    it("folded values match an independent even/odd coefficient computation", () => {
        const input = mod.defaultInput as { coefficients: number[]; domainSize: number; challenge: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta ?? {};
        const N = Number(final["N"]);
        const w = Number(final["rootOfUnity"]);
        const r = Number(final["challenge"]);
        const coeffs = final["coefficients"] as number[];
        const folded = final["folded"] as number[];
        const gCoeffs = final["gCoeffs"] as number[];

        const ev = Array.from({ length: N }, (_v, k) => evalPoly(coeffs, powMod(w, k, PRIME), PRIME));
        expect(final["evaluations"]).toEqual(ev);
        const even = coeffs.filter((_v, i) => i % 2 === 0);
        const odd = coeffs.filter((_v, i) => i % 2 === 1);
        expect(gCoeffs).toEqual(even.map((value, i) => (value + r * (odd[i] ?? 0)) % PRIME));

        const inv2 = (PRIME + 1) / 2;
        for (let k = 0; k < N / 2; k += 1) {
            const x = powMod(w, k, PRIME);
            const fx = ev[k] ?? 0;
            const fmx = ev[k + N / 2] ?? 0;
            const a = (((fx + fmx) % PRIME) * inv2) % PRIME;
            const diff = ((fx - fmx) % PRIME + PRIME) % PRIME;
            const b = ((((diff * inv2) % PRIME) * powMod(x, PRIME - 2, PRIME)) % PRIME);
            expect(folded[k]).toBe((a + r * b) % PRIME);
            expect(folded[k]).toBe(evalPoly(gCoeffs, powMod(w, 2 * k, PRIME), PRIME));
        }
        expect(final["verified"]).toBe(true);
    });

    it("verifies across several polynomials and challenges", () => {
        const cases = [
            { coefficients: [1, 2], domainSize: 4, challenge: 7 },
            { coefficients: [9, 4, 6, 1], domainSize: 8, challenge: 30000 },
            { coefficients: [2, 0, 0, 5], domainSize: 8, challenge: 1 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            const final = frames[frames.length - 1]?.meta ?? {};
            expect(final["verified"]).toBe(true);
        }
    });

    it("root of unity has the expected order", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta ?? {};
        const N = Number(final["N"]);
        const w = Number(final["rootOfUnity"]);
        expect(powMod(w, N, PRIME)).toBe(1);
        expect(powMod(w, N / 2, PRIME)).toBe(PRIME - 1);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
