/** ephemeral-diffie-hellman.test.ts - Correctness and frame checks. */

import { describe, expect, it } from "vitest";
import mod from "./ephemeral-diffie-hellman";
import type { VisualFrame } from "@/types";

function modPow(base: number, exponent: number, modulus: number): number {
    let result = 1;
    let current = base % modulus;
    let power = exponent;
    while (power > 0) {
        if (power % 2 === 1) {
            result = (result * current) % modulus;
        }
        current = (current * current) % modulus;
        power = Math.floor(power / 2);
    }
    return result;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Ephemeral Diffie-Hellman", () => {
    it("agrees on g to the power a times b modulo p", () => {
        const cases = [
            { p: 23, g: 5, a: 6, b: 15 },
            { p: 97, g: 5, a: 9, b: 22 },
            { p: 101, g: 2, a: 13, b: 31 },
            { p: 23, g: 11, a: 3, b: 7 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const finalMeta = frames[frames.length - 1]?.meta;
            const expected = modPow(input.g, (input.a * input.b) % (input.p - 1), input.p);
            expect(finalMeta?.["A"]).toBe(modPow(input.g, input.a, input.p));
            expect(finalMeta?.["B"]).toBe(modPow(input.g, input.b, input.p));
            expect(finalMeta?.["secretAlice"]).toBe(expected);
            expect(finalMeta?.["secretBob"]).toBe(expected);
            expect(finalMeta?.["shared"]).toBe(true);
        }
    });

    it("reveals values progressively", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames[0]?.meta["A"]).toBe(-1);
        expect(frames[1]?.meta["A"]).not.toBe(-1);
        expect(frames[1]?.meta["B"]).toBe(-1);
        expect(frames[2]?.meta["B"]).not.toBe(-1);
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
