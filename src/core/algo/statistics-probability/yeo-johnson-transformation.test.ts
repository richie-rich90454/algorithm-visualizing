/**
 * yeo-johnson-transformation.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./yeo-johnson-transformation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], expectedBars: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(expectedBars);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent inverse used to check the module's forward mapping by round trip. */
function inverse(y: number, lambda: number): number {
    if (y >= 0) {
        return Math.abs(lambda) < 1e-12 ? Math.expm1(y) : Math.pow(lambda * y + 1, 1 / lambda) - 1;
    }
    return Math.abs(lambda - 2) < 1e-12
        ? 1 - Math.exp(-y)
        : 1 - Math.pow((2 - lambda) * -y + 1, 1 / (2 - lambda));
}

describe("Yeo-Johnson Transformation", () => {
    it("round-trips signed values for several power parameters", () => {
        const values = [-10, -3.5, -1, 0, 0.5, 2, 7.25];
        for (const lambda of [-1, 0, 0.5, 1, 2, 3]) {
            const frames = [...mod.run({ values, lambda })];
            checkFrames(frames, values.length);
            const transformed = frames[frames.length - 1]?.meta["transformed"] as number[];
            expect(transformed.length).toBe(values.length);
            for (let i = 0; i < values.length; i += 1) {
                const x = values[i] ?? 0;
                const y = transformed[i] ?? 0;
                expect(inverse(y, lambda)).toBeCloseTo(x, 6);
            }
        }
    });

    it("is strictly increasing and honors the identity case", () => {
        const lambda = 0.5;
        const grid = [-10, -5, -1, 0, 1, 5, 10];
        const frames = [...mod.run({ values: grid, lambda })];
        const transformed = frames[frames.length - 1]?.meta["transformed"] as number[];
        for (let i = 1; i < transformed.length; i += 1) {
            expect(transformed[i] ?? 0).toBeGreaterThan(transformed[i - 1] ?? 0);
        }
        const identity = [...mod.run({ values: grid, lambda: 1 })];
        const identityValues = identity[identity.length - 1]?.meta["transformed"] as number[];
        for (let i = 0; i < grid.length; i += 1) {
            expect(identityValues[i]).toBeCloseTo(grid[i] ?? 0, 9);
        }
        const logCase = [...mod.run({ values: [1, 2, 4], lambda: 0 })];
        const logs = logCase[logCase.length - 1]?.meta["transformed"] as number[];
        expect(logs[2]).toBeCloseTo(Math.log1p(4), 9);
    });

    it("terminates", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
