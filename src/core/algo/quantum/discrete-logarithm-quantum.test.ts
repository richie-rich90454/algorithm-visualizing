/**
 * discrete-logarithm-quantum.test.ts - Brute-force exponent recovery over every
 * secret for small primes, distribution normalization, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./discrete-logarithm-quantum";
import type { VisualFrame } from "@/types";

function powMod(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = ((base % modulus) + modulus) % modulus;
    let power = exponent;
    while (power > 0) {
        if (power % 2 === 1) result = (result * current) % modulus;
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("quantum discrete logarithm", () => {
    it("recovers every secret by brute force for small primes", () => {
        for (const [p, g] of [[5, 2], [17, 3]] as const) {
            const q = p - 1;
            const t = Math.ceil(Math.log2(q)) + 2;
            for (let secret = 0; secret < q; secret += 1) {
                const frames = [...mod.run({ p, g, x: secret, t })];
                checkFrames(frames, q);
                const final = frames[frames.length - 1]!.meta;
                expect(final["verified"]).toBe(true);
                expect(Number(final["recovered"])).toBe(secret);

                const h = powMod(g, secret, p);
                const candidates: number[] = [];
                for (let guess = 0; guess < q; guess += 1) {
                    if (powMod(g, guess, p) === h) candidates.push(guess);
                }
                expect(candidates).toEqual([secret]);
                expect(Number(final["h"])).toBe(h);

                const distribution = final["distribution"] as number[];
                expect(distribution.length).toBe(q);
                for (const probability of distribution) expect(probability).toBeCloseTo(1 / q, 10);
                expect(distribution.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 10);
            }
        }
    });

    it("reports an unusable Fourier size without crashing", () => {
        const frames = [...mod.run({ p: 7, g: 3, x: 2, t: 4 })];
        checkFrames(frames, 0);
        const final = frames[frames.length - 1]!.meta;
        expect(final["usable"]).toBe(false);
        expect(final["verified"]).toBe(false);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
