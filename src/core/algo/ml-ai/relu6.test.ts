/** relu6.test.ts - Correctness, frame shape, and termination checks. */

import { describe, expect, it } from "vitest";
import mod, { relu6For } from "./relu6";
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
    });
}

describe("ReLU6", () => {
    it("matches a clamp reference on every input", () => {
        const input = mod.defaultInput as { values: number[]; cap: number };
        const cap = input.cap;
        const frames = [...mod.run(input)];
        checkFrames(frames, input.values.length);
        const final = frames[frames.length - 1]?.meta["values"] as number[];
        input.values.forEach((x, i) => {
            const expected = Math.min(Math.max(0, x), cap);
            expect(final[i]).toBe(expected);
            expect(relu6For(x, cap).value).toBe(expected);
        });
    });

    it("has zero slope in both clamped regions", () => {
        expect(relu6For(-2, 6).derivative).toBe(0);
        expect(relu6For(9, 6).derivative).toBe(0);
        expect(relu6For(3, 6).derivative).toBe(1);
        expect(relu6For(3, 6).value).toBe(3);
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
