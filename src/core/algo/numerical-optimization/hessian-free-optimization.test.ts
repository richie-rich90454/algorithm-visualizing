/** hessian-free-optimization.test.ts - Exact Newton cross-check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./hessian-free-optimization";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        expect(frame.entities.some((entity) => entity.id === "current")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Hessian-Free Optimization", () => {
    it("reaches the exact quadratic minimizer in one Newton step", () => {
        const frames = [...mod.run({ objective: "quadratic", x0: -2, y0: 2, damping: 0, outer: 1 })];
        checkFrames(frames);
        const point = frames[frames.length - 1]?.meta["x"] as number[];
        expect(point[0] ?? 0).toBeCloseTo(8 / 7, 6);
        expect(point[1] ?? 0).toBeCloseTo(10 / 7, 6);
        expect(Number(frames[frames.length - 1]?.meta["gradientNorm"])).toBeLessThan(1e-6);
    });

    it("minimizes Rosenbrock without a stored Hessian", () => {
        const frames = [...mod.run({ objective: "rosenbrock", x0: -1.2, y0: 1, damping: 1, outer: 80 })];
        checkFrames(frames);
        const first = Number(frames[0]?.meta["objective"]);
        const last = Number(frames[frames.length - 1]?.meta["objective"]);
        expect(last).toBeLessThan(first);
        expect(last).toBeLessThan(0.5);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(9);
        expect(generator.next().done).toBe(true);
    });
});
