/**
 * two-level-allreduce.test.ts - Hierarchical all-reduce correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./two-level-allreduce";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Two-Level All-Reduce", () => {
    it("leaves every process with the brute-force total", () => {
        const values = [1, 2, 3, 4, 5, 6, 7, 8];
        const frames = [...mod.run({ values, groupSize: 4 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const brute = values.reduce((a, b) => a + b, 0);
        expect(brute).toBe(36);
        expect(Number(final?.["globalTotal"])).toBe(brute);
        expect(final?.["correct"]).toBe(true);
        const result = final?.["result"] as number[];
        result.forEach((v) => expect(v).toBe(brute));
    });

    it("works for different group sizes and negative values", () => {
        const cases = [
            { values: [5, -2, 3, 9], groupSize: 2 },
            { values: [1, 1, 1, 1, 1, 1], groupSize: 3 },
            { values: [-4, 7, 0, 2], groupSize: 4 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run(testCase)];
            const final = frames[frames.length - 1]?.meta;
            const brute = testCase.values.reduce((a, b) => a + b, 0);
            expect(Number(final?.["globalTotal"])).toBe(brute);
            expect(final?.["correct"]).toBe(true);
        }
    });

    it("emits a local reduce, a leader step, and a broadcast", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const phases = new Set(frames.map((f) => f.meta["phase"]).filter(Boolean));
        expect(phases.has("local-reduce")).toBe(true);
        expect(phases.has("leader-allreduce")).toBe(true);
        expect(phases.has("local-broadcast")).toBe(true);
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
