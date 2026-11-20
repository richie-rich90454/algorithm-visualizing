/**
 * zigzag-encoding.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod, { zigzagDecode, zigzagEncode } from "./zigzag-encoding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * 3);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["rows"]).toBe(rows);
        expect(frame.meta["cols"]).toBe(3);
    });
}

describe("ZigZag Signed Integer Encoding", () => {
    it("matches the canonical small-value mapping", () => {
        const expected = new Map<number, number>([
            [0, 0], [-1, 1], [1, 2], [-2, 3], [2, 4], [-3, 5], [3, 6],
        ]);
        for (const [value, mapped] of expected) {
            expect(zigzagEncode(value)).toBe(mapped);
            expect(zigzagDecode(mapped)).toBe(value);
        }
    });

    it("round-trips every integer in a large range", () => {
        for (let value = -20000; value <= 20000; value += 1) {
            expect(zigzagDecode(zigzagEncode(value))).toBe(value);
        }
        for (const value of [
            Math.floor(Number.MIN_SAFE_INTEGER / 4),
            Math.floor(Number.MAX_SAFE_INTEGER / 4),
        ]) {
            expect(zigzagDecode(zigzagEncode(value))).toBe(value);
        }
    });

    it("keeps mapped values nonnegative and parity-correct", () => {
        for (let value = -100; value <= 100; value += 1) {
            const mapped = zigzagEncode(value);
            expect(mapped).toBeGreaterThanOrEqual(0);
            expect(mapped % 2 === 0).toBe(value >= 0);
        }
    });

    it("emits well-formed frames with an exact decoded final meta", () => {
        const input = mod.defaultInput as { values: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const finalMeta = frames[frames.length - 1]!.meta;
        expect(finalMeta["mapped"]).toEqual(input.values.map(zigzagEncode));
        expect(finalMeta["decoded"]).toEqual(input.values);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
