/** pepins-test.test.ts - Known Fermat-number verdicts and independent exponentiation. */

import { describe, expect, it } from "vitest";
import mod, { fermatNumber, pepinTest, powMod } from "./pepins-test";
import type { VisualFrame } from "@/types";

function referencePow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = 1n;
    for (let i = 0n; i < exponent; i += 1n) result = (result * base) % modulus;
    return result;
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

describe("Pepin's test", () => {
    it("builds the known Fermat numbers", () => {
        expect(fermatNumber(0)).toBe(3n);
        expect(fermatNumber(1)).toBe(5n);
        expect(fermatNumber(2)).toBe(17n);
        expect(fermatNumber(3)).toBe(257n);
        expect(fermatNumber(4)).toBe(65537n);
        expect(fermatNumber(5)).toBe(4294967297n);
    });

    it("matches an independent exponentiation on small cases", () => {
        for (const [base, exp, m] of [[3n, 10n, 101n], [2n, 20n, 97n], [7n, 13n, 59n]] as const) {
            expect(powMod(base, exp, m)).toBe(referencePow(base, exp, m));
        }
    });

    it("classifies the first Fermat numbers correctly", () => {
        const knownPrime: Record<number, boolean> = { 1: true, 2: true, 3: true, 4: true, 5: false };
        for (const m of [1, 2, 3, 4, 5]) {
            const result = pepinTest(m);
            expect(result.applicable).toBe(true);
            expect(result.prime).toBe(knownPrime[m]);
            expect(result.residue === result.fermat - 1n).toBe(knownPrime[m]);
        }
    });

    it("emits well-formed frames and terminates", () => {
        const generator = mod.run(mod.defaultInput);
        const frames: VisualFrame[] = [];
        for (const frame of generator) frames.push(frame);
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["prime"]).toBe(false);
        expect(generator.next().done).toBe(true);
    });
});
