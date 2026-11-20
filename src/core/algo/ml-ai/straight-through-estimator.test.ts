/** straight-through-estimator.test.ts - Reference match, identity-gradient property, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./straight-through-estimator";
import type { VisualFrame } from "@/types";

interface Input {
    values: number[];
    threshold: number;
    upstream: number[];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Straight-Through Estimator", () => {
    it("matches a direct step and passthrough computation", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["hard"]).toEqual(input.values.map((v) => (v >= input.threshold ? 1 : 0)));
        expect(final?.["surrogate"]).toEqual(input.upstream);
        expect(final?.["trueGradient"]).toEqual(new Array(input.values.length).fill(0));
    });

    it("passes upstream gradients through unchanged for any threshold", () => {
        const upstream = [-0.7, 0.2, 0, 1.3, -2];
        const frames = [...mod.run({ values: [-2, -1, 0, 1, 2], threshold: 0, upstream })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["surrogate"]).toEqual(upstream);
        expect(final?.["hard"]).toEqual([0, 0, 1, 1, 1]);
    });

    it("keeps forward outputs binary", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const hard = frames[frames.length - 1]?.meta["hard"] as number[];
        expect(hard.every((h) => h === 0 || h === 1)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
