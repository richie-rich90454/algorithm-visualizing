/**
 * box-cox-transformation.test.ts - Independent formula at several lambdas,
 * the log limit, domain clamping, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./box-cox-transformation";
import type { VisualFrame } from "@/types";

function reference(values: number[], lambda: number): number[] {
    return values.map((v) => (Math.abs(lambda) < 1e-12 ? Math.log(v) : (v ** lambda - 1) / lambda));
}

function checkFrames(frames: VisualFrame[], n: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(n);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("BoxCoxTransformation", () => {
    it("matches an independent formula at several lambdas", () => {
        const values = [0.5, 1, 2.5, 7, 20];
        for (const lambda of [-1, 0, 0.5, 1, 2]) {
            const frames = [...mod.run({ values, lambda })];
            checkFrames(frames, values.length);
            const actual = frames[frames.length - 1].meta["transformed"] as number[];
            const expected = reference(values, lambda);
            actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i] ?? 0, 10));
        }
    });

    it("reproduces the unit and log special cases", () => {
        const values = [1, 2, 4, 8];
        const unitMod = [...mod.run({ values, lambda: 1 })].at(-1)?.meta["transformed"] as number[];
        unitMod.forEach((v, i) => expect(v).toBeCloseTo((values[i] ?? 0) - 1, 10));
        const logMod = [...mod.run({ values, lambda: 0 })].at(-1)?.meta["transformed"] as number[];
        logMod.forEach((v, i) => expect(v).toBeCloseTo(Math.log(values[i] ?? 1), 10));
    });

    it("clamps nonpositive values into the valid domain", () => {
        const frames = [...mod.run({ values: [0, -3, 2], lambda: 0 })];
        expect(Number.isFinite(Number((frames.at(-1)?.meta["transformed"] as number[])[0]))).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(8);
        expect(generator.next().done).toBe(true);
    });
});
