/**
 * grandpa-consensus.test.ts - Supermajority finality property, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateGrandpa } from "./grandpa-consensus";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], validators: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(validators);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("GRANDPA Consensus", () => {
    it("finds the highest block with two-thirds chain support", () => {
        for (let n = 1; n <= 7; n += 1) {
            for (let trial = 0; trial < 200; trial += 1) {
                const heights = Array.from({ length: n }, (_, i) => (trial * 3 + i * 5) % 8);
                const threshold = Math.floor(2 * n / 3) + 1;
                let expected = -1;
                for (let h = 0; h <= 7; h += 1) {
                    if (heights.filter((x) => x >= h).length >= threshold) expected = h;
                }
                const data = simulateGrandpa(heights);
                expect(data.threshold).toBe(threshold);
                expect(data.finalized).toBe(expected);
                if (expected >= 0) {
                    expect(heights.filter((x) => x >= expected).length).toBeGreaterThanOrEqual(threshold);
                    expect(heights.filter((x) => x >= expected + 1).length).toBeLessThan(threshold);
                }
            }
        }
    });

    it("finalizes a clear supermajority and stops below a deep fork point", () => {
        const clear = simulateGrandpa([5, 4, 5, 5, 3, 5]);
        expect(clear.finalized).toBe(4);
        const split = simulateGrandpa([1, 1, 1, 7, 7, 7]);
        expect(split.finalized).toBe(1);
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 6);
        expect(frames[frames.length - 1]?.meta["finalized"]).toBe(4);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 6);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
