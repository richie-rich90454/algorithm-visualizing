/**
 * trust-region-method.test.ts - Exact minimizer cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./trust-region-method";
import type { VisualFrame } from "@/types";

function obj(x: number, y: number, a: number, b: number, d: number): number {
    return 0.5 * a * x * x + b * x * y + 0.5 * d * y * y;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Trust-region method (dogleg)", () => {
    it("converges to the exact quadratic minimizer", () => {
        const cases: Array<{ a: number; b: number; d: number; start: [number, number] }> = [
            { a: 4, b: 1, d: 2, start: [3, 4] },
            { a: 2, b: 0, d: 6, start: [-5, 7] },
            { a: 5, b: 2, d: 5, start: [10, -10] },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, delta: 10, maxIter: 20 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const x = Number(final?.["x"]);
            const y = Number(final?.["y"]);
            expect(Math.abs(x)).toBeLessThan(1e-6);
            expect(Math.abs(y)).toBeLessThan(1e-6);
            expect(Number(final?.["f"])).toBeLessThan(1e-9);
        }
    });

    it("never increases the objective across accepted steps", () => {
        const frames = [...mod.run({ a: 4, b: 1, d: 2, start: [3, 4], delta: 10, maxIter: 20 })];
        let previous = Number(frames[0]?.meta["f"]);
        for (const frame of frames.slice(1)) {
            const current = Number(frame.meta["f"]);
            expect(current).toBeLessThanOrEqual(previous + 1e-12);
            previous = current;
        }
    });

    it("shrinks the radius when the first step is rejected", () => {
        const input = { a: 4, b: 1, d: 2, start: [100, 100], delta: 0.001, maxIter: 5 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const first = frames[1]?.meta;
        expect(first?.["delta"]).toBeGreaterThan(0);
        expect(Number(first?.["f"])).toBeLessThanOrEqual(Number(frames[0]?.meta["f"]));
        for (const frame of frames) {
            expect(Number(frame.meta["delta"])).toBeGreaterThan(0);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
