/**
 * concatenated-code.test.ts - Exhaustive error-pattern and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./concatenated-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Concatenated code", () => {
    it("corrects every pattern of zero, one, or two physical flips", () => {
        let checked = 0;
        for (const logical of [0, 1]) {
            for (let i = -1; i < 9; i += 1) {
                for (let j = i + 1; j < 9; j += 1) {
                    const errors = [i, j].filter((e) => e >= 0);
                    const frames = [...mod.run({ logical, errors })];
                    const final = frames[frames.length - 1]?.meta;
                    expect(final?.["decoded"]).toBe(logical);
                    expect(final?.["success"]).toBe(true);
                    checked += 1;
                }
            }
        }
        expect(checked).toBe(2 * 45);
    });

    it("corrects one flip in each of the three inner blocks", () => {
        const frames = [...mod.run({ logical: 1, errors: [0, 4, 8] })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["decoded"]).toBe(1);
        expect(final?.["success"]).toBe(true);
        expect(final?.["blockValues"]).toEqual([1, 1, 1]);
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
