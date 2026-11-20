/**
 * tree-all-reduce.test.ts - Sum correctness, round count, and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./tree-all-reduce";
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

describe("Tree all-reduce", () => {
    it("gives every process the sum for several value arrays", () => {
        const cases = [
            [1, 2, 3, 4, 5, 6, 7, 8],
            [-2, 5, 0, 9, -1, 3, 4, -6],
            [1, 2],
            [10, -10, 7, -7, 3, -3, 8, -8, 1, 2, 3, 4, 5, 6, 7, 8],
        ];
        for (const values of cases) {
            const frames = [...mod.run({ values })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const result = final?.["values"] as number[];
            const expected = values.reduce((sum, value) => sum + value, 0);
            expect(new Set(result).size).toBe(1);
            expect(result[0]).toBe(expected);
            expect(final?.["total"]).toBe(expected);
        }
    });

    it("uses two logarithmic phases", () => {
        const frames = [...mod.run({ values: [1, 2, 3, 4, 5, 6, 7, 8] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["rounds"]).toBe(6);
        const reduce = frames.filter((f) => f.meta["phase"] === "reduce").length;
        const broadcast = frames.filter((f) => f.meta["phase"] === "broadcast").length;
        expect(reduce).toBe(3);
        expect(broadcast).toBe(3);
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
