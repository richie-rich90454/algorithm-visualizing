/** hamming-code.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./hamming-code";
import type { VisualFrame } from "@/types";

/** Independent Hamming(7,4) encoder. */
function encode(data: number[]): number[] {
    const word = [0, 0, data[0] as number, 0, data[1] as number, data[2] as number, data[3] as number];
    word[0] = ((word[0] as number) + (word[2] as number) + (word[4] as number) + (word[6] as number)) % 2;
    word[1] = ((word[1] as number) + (word[2] as number) + (word[5] as number) + (word[6] as number)) % 2;
    word[3] = ((word[3] as number) + (word[4] as number) + (word[5] as number) + (word[6] as number)) % 2;
    return word;
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(7);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hamming(7,4) Code", () => {
    it("corrects every single-bit error for all 16 data words", () => {
        for (let value = 0; value < 16; value += 1) {
            const data = [(value >> 3) & 1, (value >> 2) & 1, (value >> 1) & 1, value & 1];
            const expected = encode(data);
            for (let error = -1; error <= 7; error += 1) {
                const frames = [...mod.run({ bits: data, errorBit: error })];
                checkFrames(frames);
                const final = frames[frames.length - 1];
                expect(final?.meta["codeword"]).toEqual(expected);
                expect(final?.meta["syndrome"]).toBe(error < 0 || error === 0 ? 0 : error);
                expect(final?.meta["corrected"]).toEqual(data);
                expect(final?.meta["syndromeValid"]).toBe(true);
            }
        }
    });

    it("produces codewords with even parity in all three check groups", () => {
        for (let value = 0; value < 16; value += 1) {
            const data = [(value >> 3) & 1, (value >> 2) & 1, (value >> 1) & 1, value & 1];
            const frames = [...mod.run({ bits: data, errorBit: -1 })];
            const codeword = frames[frames.length - 1]?.meta["codeword"] as number[];
            expect(codeword).toEqual(encode(data));
            expect((codeword[0] as number) + (codeword[2] as number) + (codeword[4] as number) + (codeword[6] as number)).toBeGreaterThanOrEqual(0);
            expect(((codeword[0] as number) + (codeword[2] as number) + (codeword[4] as number) + (codeword[6] as number)) % 2).toBe(0);
            expect(((codeword[1] as number) + (codeword[2] as number) + (codeword[5] as number) + (codeword[6] as number)) % 2).toBe(0);
            expect(((codeword[3] as number) + (codeword[4] as number) + (codeword[5] as number) + (codeword[6] as number)) % 2).toBe(0);
        }
    });

    it("handles missing or padded input", () => {
        const frames = [...mod.run({})];
        checkFrames(frames);
        const final = frames[frames.length - 1];
        expect(final?.meta["data"]).toEqual([1, 0, 1, 1]);
        const padded = [...mod.run({ bits: [1, 0], errorBit: 4 })];
        checkFrames(padded);
        expect(padded[padded.length - 1]?.meta["corrected"]).toEqual([1, 0, 0, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
