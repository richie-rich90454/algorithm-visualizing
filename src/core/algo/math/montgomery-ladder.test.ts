import { describe, expect, it } from "vitest";
import mod from "./montgomery-ladder";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function reference(base: number, exponent: number, modulus: number): number {
    let result = 1n;
    let b = BigInt(base) % BigInt(modulus);
    let e = BigInt(exponent);
    const m = BigInt(modulus);
    while (e > 0n) {
        if (e & 1n) result = (result * b) % m;
        b = (b * b) % m;
        e >>= 1n;
    }
    return Number(result);
}

function resultFrom(frames: VisualFrame[]): number {
    return Number(frames[frames.length - 1]?.meta["result"]);
}

describe("Montgomery Ladder", () => {
    it("matches an independent modular exponentiation on random inputs", () => {
        let seed = 20211;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed;
        };
        for (let trial = 0; trial < 50; trial += 1) {
            const modulus = 3 + (next() % 100000);
            const base = next() % 100000;
            const exponent = next() % 100000;
            const frames = [...mod.run({ base, exponent, modulus })];
            checkFrames(frames);
            expect(resultFrom(frames)).toBe(reference(base, exponent, modulus));
        }
    });

    it("handles exponent zero, one, and a base larger than the modulus", () => {
        expect(resultFrom([...mod.run({ base: 7, exponent: 0, modulus: 13 })])).toBe(1);
        expect(resultFrom([...mod.run({ base: 7, exponent: 1, modulus: 13 })])).toBe(7);
        expect(resultFrom([...mod.run({ base: 1000003, exponent: 13, modulus: 1000000007 })])).toBe(
            reference(1000003, 13, 1000000007),
        );
    });

    it("uses one update per exponent bit", () => {
        const frames = [...mod.run({ base: 3, exponent: 255, modulus: 1000 })];
        const steps = Number(frames[frames.length - 1]?.meta["steps"]);
        expect(steps).toBe(8);
        expect(frames.length).toBe(steps + 2);
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
