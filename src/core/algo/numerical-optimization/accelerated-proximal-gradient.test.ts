/**
 * accelerated-proximal-gradient.test.ts - Closed-form minimizer check,
 * accelerated-versus-plain comparison, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./accelerated-proximal-gradient";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Same problem run with plain proximal gradient (no momentum). */
function plainProximalGradient(iterations: number, lambda: number): number {
    const L = (3 + Math.sqrt(5)) / 2;
    const step = 1 / L;
    const soft = (v: number): number => (v > lambda * step ? v - lambda * step : v < -lambda * step ? v + lambda * step : 0);
    let x0 = 0;
    let x1 = 0;
    for (let k = 0; k < iterations; k += 1) {
        const g0 = x0 + x1 - 3;
        const g1 = x0 + 2 * x1 - 5;
        const n0 = soft(x0 - step * g0);
        const n1 = soft(x1 - step * g1);
        x0 = n0;
        x1 = n1;
    }
    const r0 = x0 + x1 - 3;
    const r1 = x1 - 2;
    return 0.5 * (r0 * r0 + r1 * r1) + lambda * (Math.abs(x0) + Math.abs(x1));
}

describe("Accelerated Proximal Gradient", () => {
    it("converges to the closed-form minimizer", () => {
        const frames = [...mod.run({ lambda: 0.5, iterations: 400 })];
        checkFrames(frames);
        const last = frames[frames.length - 1]!.meta;
        const x = last["x"] as number[];
        expect(x[0]).toBeCloseTo(0.5, 3);
        expect(x[1]).toBeCloseTo(2, 3);
        expect(Number(last["objective"])).toBeCloseTo(1.375, 3);
    });

    it("beats plain proximal gradient at the same iteration budget", () => {
        const frames = [...mod.run({ lambda: 0.5, iterations: 10 })];
        checkFrames(frames);
        const fista = Number(frames[frames.length - 1]!.meta["objective"]);
        const plain = plainProximalGradient(10, 0.5);
        expect(fista).toBeLessThan(plain);
    });

    it("keeps the step size at the reciprocal Lipschitz constant", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const expected = 1 / ((3 + Math.sqrt(5)) / 2);
        for (const frame of frames) {
            expect(Number(frame.meta["stepSize"])).toBeCloseTo(expected, 12);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
