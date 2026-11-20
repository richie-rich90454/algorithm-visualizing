/** midpoint-method.test.ts - Independent RK2 reference, order check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./midpoint-method";
import type { VisualFrame } from "@/types";

function derivative(t: number, y: number): number {
    return -2 * t * y;
}

/** Independent explicit midpoint reference over a fixed step count. */
function reference(steps: number): number[] {
    const h = 1 / steps;
    const values = [1];
    for (let i = 0; i < steps; i += 1) {
        const t = i * h;
        const y = values[i] ?? 0;
        const k1 = derivative(t, y);
        const k2 = derivative(t + h / 2, y + (h * k1) / 2);
        values.push(y + h * k2);
    }
    return values;
}

function checkFrames(frames: VisualFrame[], codeLines: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(codeLines);
        expect(frame.meta).toBeDefined();
        frame.entities.forEach((entity) => {
            expect(Number.isFinite(entity.x)).toBe(true);
            expect(Number.isFinite(entity.y)).toBe(true);
        });
    });
}

describe("Explicit midpoint method", () => {
    it("matches an independent second-order Runge-Kutta loop", () => {
        const frames = [...mod.run({ t0: 0, t1: 1, y0: 1, steps: 8 })];
        checkFrames(frames, mod.pseudocode?.length ?? 0);
        const meta = frames[frames.length - 1]?.meta;
        const values = meta?.["values"] as number[];
        const expected = reference(8);
        expect(values).toHaveLength(9);
        for (let i = 0; i < expected.length; i += 1) {
            expect(values[i]).toBeCloseTo(expected[i] ?? 0, 12);
        }
        expect(Math.abs((values[8] ?? 0) - Math.exp(-1))).toBeLessThan(0.01);
    });

    it("shows second-order convergence when the step size is halved", () => {
        const coarse = [...mod.run({ steps: 10 })];
        const fine = [...mod.run({ steps: 20 })];
        const coarseError = Math.abs(Number(coarse[coarse.length - 1]?.meta["globalError"]));
        const fineError = Math.abs(Number(fine[fine.length - 1]?.meta["globalError"]));
        expect(coarseError).toBeGreaterThan(fineError);
        const ratio = coarseError / fineError;
        expect(ratio).toBeGreaterThan(3);
        expect(ratio).toBeLessThan(5);
    });

    it("handles a nonzero initial condition and interval", () => {
        const frames = [...mod.run({ t0: 1, t1: 2, y0: 2, steps: 40 })];
        const meta = frames[frames.length - 1]?.meta;
        const exact = 2 * Math.exp(1 - 4);
        expect(Math.abs(Number(meta?.["finalValue"]) - exact)).toBeLessThan(0.001);
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
