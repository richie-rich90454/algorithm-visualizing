/** frame-of-reference-encoding.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod from "./frame-of-reference-encoding";
import type { VisualFrame } from "@/types";

/** Independent decoder for the big-endian bit stream. */
function decode(packed: number[], width: number, wordBits: number, count: number): number[] {
    if (width === 0) return new Array<number>(count).fill(0);
    const wordSize = Math.pow(2, wordBits);
    const fieldSize = Math.pow(2, width);
    let buffer = 0;
    let bits = 0;
    let wordIndex = 0;
    const out: number[] = [];
    for (let i = 0; i < count; i += 1) {
        while (bits < width) {
            buffer = buffer * wordSize + (packed[wordIndex] as number);
            wordIndex += 1;
            bits += wordBits;
        }
        bits -= width;
        out.push(Math.floor(buffer / Math.pow(2, bits)) % fieldSize);
        buffer = buffer % Math.pow(2, bits);
    }
    return out;
}

/** Check that a frame sequence is well formed. */
function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Frame-of-Reference Encoding", () => {
    it("round-trips the worked example", () => {
        const values = [1000, 1002, 1005, 1001];
        const frames = [...mod.run({ values, wordBits: 8 })];
        checkFrames(frames, values.length);
        const final = frames[frames.length - 1];
        expect(final?.meta["min"]).toBe(1000);
        expect(final?.meta["width"]).toBe(3);
        expect(final?.meta["residuals"]).toEqual([0, 2, 5, 1]);
        expect(final?.meta["packed"]).toEqual([0x0a, 0x90]);
        const packed = final?.meta["packed"] as number[];
        expect(decode(packed, 3, 8, values.length).map((r) => r + 1000)).toEqual(values);
    });

    it("round-trips random blocks at several word widths", () => {
        let seed = 777;
        const next = (): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % 5000;
        };
        for (const wordBits of [4, 8, 12, 16]) {
            for (let trial = 0; trial < 15; trial += 1) {
                const base = next();
                const values = Array.from({ length: 1 + (trial % 12) }, () => base + (next() % 64));
                const frames = [...mod.run({ values, wordBits })];
                checkFrames(frames, values.length);
                const final = frames[frames.length - 1];
                const min = Number(final?.meta["min"]);
                const width = Number(final?.meta["width"]);
                const residuals = final?.meta["residuals"] as number[];
                const packed = final?.meta["packed"] as number[];
                expect(min).toBe(Math.min(...values));
                expect(residuals).toEqual(values.map((v) => v - min));
                const largest = Math.max(...residuals);
                expect(width).toBe(largest === 0 ? 0 : Math.ceil(Math.log2(largest + 1)));
                expect(decode(packed, width, wordBits, values.length).map((r) => r + min)).toEqual(values);
                const expectedWords = width === 0 ? 0 : Math.ceil((values.length * width) / wordBits);
                expect(packed.length).toBe(expectedWords);
            }
        }
    });

    it("handles empty and constant blocks", () => {
        const empty = [...mod.run({ values: [], wordBits: 8 })];
        checkFrames(empty, 0);
        expect(empty[empty.length - 1]?.meta["packed"]).toEqual([]);
        expect(empty[empty.length - 1]?.meta["width"]).toBe(0);
        const constant = [...mod.run({ values: [7, 7, 7, 7], wordBits: 8 })];
        checkFrames(constant, 4);
        expect(constant[constant.length - 1]?.meta["packed"]).toEqual([]);
        expect(decode([], 0, 8, 4)).toEqual([0, 0, 0, 0]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
