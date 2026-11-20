/**
 * lwr.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./lwr";
import type { VisualFrame } from "@/types";

interface Input {
    q: number;
    p: number;
    secret: number[];
    a: number[];
    bit: number;
}

/** Independent inner product and rounding reference. */
function reference(input: Input) {
    const total = input.a.reduce((sum, value, i) => sum + value * (input.secret[i] ?? 0), 0);
    const inner = ((total % input.q) + input.q) % input.q;
    const scaled = (input.p / input.q) * inner;
    const rounded = Math.floor(scaled + 0.5);
    const b = rounded % input.p;
    const cipher = (b + input.bit * Math.floor(input.p / 2)) % input.p;
    const distance = ((cipher - b) % input.p + input.p) % input.p;
    const bit = distance >= input.p / 2 ? 1 : 0;
    return { inner, scaled, rounded, b, cipher, distance, bit, error: scaled - rounded };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(3);
        expect(frame.entities.every((entity) => entity.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Learning With Rounding Encryption", () => {
    const input = mod.defaultInput as Input;

    it("matches an independent rounding reference and decrypts the bit", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input);
        expect(final?.["inner"]).toBe(expected.inner);
        expect(final?.["rounded"]).toBe(expected.b);
        expect(final?.["ciphertext"]).toBe(expected.cipher);
        expect(final?.["decrypted"]).toBe(expected.bit);
        expect(final?.["match"]).toBe(1);
        expect(final?.["error"]).toBeCloseTo(expected.error, 9);
    });

    it("round-trips every bit across randomized parameters with error at most one half", () => {
        let seed = 5150;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed;
        };
        for (let trial = 0; trial < 50; trial += 1) {
            const q = 16 + (rand() % 200);
            const p = 4 * (1 + (rand() % 8));
            const dimension = 2 + (rand() % 5);
            const secret = Array.from({ length: dimension }, () => rand() % q);
            const a = Array.from({ length: dimension }, () => rand() % q);
            const bit = rand() % 2;
            const testInput: Input = { q, p, secret, a, bit };
            const frames = [...mod.run(testInput)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(testInput);
            expect(final?.["ciphertext"]).toBe(expected.cipher);
            expect(final?.["decrypted"]).toBe(bit);
            expect(final?.["match"]).toBe(1);
            expect(Math.abs(expected.error)).toBeLessThanOrEqual(0.5);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
