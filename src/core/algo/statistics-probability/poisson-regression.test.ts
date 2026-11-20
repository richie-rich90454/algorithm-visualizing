/** poisson-regression.test.ts - score equations, positive fitted means, deviance descent, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./poisson-regression";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(2 * n);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Poisson Regression", () => {
    it("satisfies both likelihood score equations at convergence", () => {
        for (const points of [
            [[1, 2], [2, 3], [3, 5], [4, 4], [5, 8], [6, 9], [7, 11], [8, 12]],
            [[0, 1], [1, 2], [2, 1], [3, 4], [4, 6], [5, 5]],
        ]) {
            const frames = [...mod.run({ points, iterations: 40 })];
            checkFrames(frames, points.length);
            const meta = frames.at(-1)?.meta;
            expect(Math.abs(Number(meta?.["score0"]))).toBeLessThan(1e-3);
            expect(Math.abs(Number(meta?.["score1"]))).toBeLessThan(1e-3);
            const fitted = meta?.["fitted"] as number[];
            expect(fitted.every((m) => m > 0)).toBe(true);
            fitted.forEach((m, i) => expect(m).toBeCloseTo(Math.exp(Number(meta?.["b0"]) + Number(meta?.["b1"]) * points[i]![0]), 8));
        }
    });

    it("never increases the deviance across iterations", () => {
        const frames = [...mod.run({ iterations: 12 })];
        const deviances = frames.map((f) => Number(f.meta["deviance"]));
        for (let i = 1; i < deviances.length; i += 1) expect(deviances[i] as number).toBeLessThanOrEqual((deviances[i - 1] as number) + 1e-6);
        expect(deviances.at(-1) as number).toBeLessThan(deviances[0] as number);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
