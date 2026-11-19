/**
 * tanh-sinh-quadrature.test.ts - Correctness, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./tanh-sinh-quadrature";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Array.isArray(frame.edges)).toBe(true);
        for (const entity of frame.entities) {
            expect(entity.type).toBe("cell");
            expect(Number.isInteger(entity.metadata.row)).toBe(true);
            expect(Number.isInteger(entity.metadata.col)).toBe(true);
        }
    });
}

describe("Tanh-Sinh Quadrature", () => {
    it("converges to the exact integral of x squared", () => {
        const frames = [...mod.run({ a: 0, b: 1, levels: 4 })];
        checkFrames(frames);
        const estimate = Number(frames[frames.length - 1]?.meta["estimate"]);
        expect(Math.abs(estimate - 1 / 3)).toBeLessThan(1e-10);
    });

    it("improves monotonically as the step size shrinks", () => {
        const frames = [...mod.run({ a: 0, b: 1, levels: 4 })];
        const estimates = frames
            .filter((frame) => typeof frame.meta["estimate"] === "number")
            .map((frame) => Number(frame.meta["estimate"]));
        for (let i = 1; i < estimates.length; i += 1) {
            expect(Math.abs((estimates[i] ?? 0) - 1 / 3)).toBeLessThanOrEqual(
                Math.abs((estimates[i - 1] ?? 0) - 1 / 3),
            );
        }
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
