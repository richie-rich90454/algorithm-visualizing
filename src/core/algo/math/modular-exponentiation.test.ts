/** modular-exponentiation.test.ts - Correctness, frame shape, and termination. */

import { describe, expect, it } from "vitest";
import mod from "./modular-exponentiation";
import type { VisualFrame } from "@/types";

/** Independent BigInt reference: repeated multiplication, never the module logic. */
function bigPow(base: number, exponent: number, modulus: number): number {
    const m = BigInt(modulus);
    let result = 1n;
    const b = BigInt(((base % modulus) + modulus) % modulus);
    for (let i = 0; i < exponent; i += 1) {
        result = (result * b) % m;
    }
    return Number(result);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    const pc = mod.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(pc);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) {
            expect(entity.metadata.row).toBeDefined();
            expect(entity.metadata.col).toBeDefined();
        }
    });
}

describe("Modular exponentiation", () => {
    it("matches an independent BigInt reference on several inputs", () => {
        const cases: Array<[number, number, number]> = [
            [2, 10, 1000],
            [7, 13, 1000],
            [3, 0, 17],
            [5, 1, 23],
            [11, 27, 97],
            [123456, 31, 1000003],
        ];
        for (const [base, exponent, modulus] of cases) {
            const frames = [...mod.run({ base, exponent, modulus })];
            checkFrames(frames);
            const result = Number(frames[frames.length - 1]?.meta["result"]);
            expect(result).toBe(bigPow(base, exponent, modulus));
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(modulus);
        }
    });

    it("agrees with the modular multiplication invariant at every step", () => {
        const frames = [...mod.run({ base: 6, exponent: 19, modulus: 101 })];
        const bits = (19).toString(2).split("").reverse().join("");
        expect(frames[0]?.meta["bits"]).toBe(bits);
        for (const frame of frames) {
            const result = Number(frame.meta["result"]);
            expect(result).toBeGreaterThanOrEqual(0);
            expect(result).toBeLessThan(101);
        }
        expect(Number(frames[frames.length - 1]?.meta["result"])).toBe(bigPow(6, 19, 101));
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
