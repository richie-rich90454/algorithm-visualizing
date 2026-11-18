/**
 * adams-bashforth.test.ts - Independent integrator reference, fourth-order
 * error scaling, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./adams-bashforth";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBe(steps + 1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference integrator for y' = lambda y. */
function reference(lambda: number, y0: number, h: number, steps: number): number[] {
    const f = (y: number) => lambda * y;
    const values = [y0];
    const rk = (y: number) => {
        const a = f(y);
        const b = f(y + (h * a) / 2);
        const c = f(y + (h * b) / 2);
        const d = f(y + h * c);
        return y + (h / 6) * (a + 2 * b + 2 * c + d);
    };
    for (let i = 1; i <= steps; i += 1) {
        if (i <= 3) {
            values.push(rk(values[i - 1]!));
        } else {
            const [f3, f2, f1, f0] = [
                f(values[i - 1]!),
                f(values[i - 2]!),
                f(values[i - 3]!),
                f(values[i - 4]!),
            ];
            values.push(values[i - 1]! + (h / 24) * (55 * f3 - 59 * f2 + 37 * f1 - 9 * f0));
        }
    }
    return values;
}

describe("AdamsBashforth", () => {
    it("matches an independent integrator step by step", () => {
        const cases = [
            { lambda: 1, y0: 1, h: 0.1, steps: 8 },
            { lambda: -2, y0: 3, h: 0.05, steps: 10 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.steps);
            const expected = reference(input.lambda, input.y0, input.h, input.steps);
            const series = frames[frames.length - 1]?.meta["series"] as number[];
            expect(series).toHaveLength(input.steps + 1);
            for (let i = 0; i <= input.steps; i += 1) {
                expect(series[i]).toBeCloseTo(expected[i]!, 10);
            }
        }
    });

    it("shows fourth-order error reduction when the step size is halved", () => {
        const coarse = [...mod.run({ lambda: 1, y0: 1, h: 0.2, steps: 10 })];
        const fine = [...mod.run({ lambda: 1, y0: 1, h: 0.1, steps: 20 })];
        checkFrames(coarse, 10);
        checkFrames(fine, 20);
        const coarseError = Number(coarse[coarse.length - 1]?.meta["error"]);
        const fineError = Number(fine[fine.length - 1]?.meta["error"]);
        expect(coarseError).toBeGreaterThan(fineError);
        expect(coarseError / fineError).toBeGreaterThan(8);
    });

    it("tracks the exact exponential and terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        checkFrames(frames, 8);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["time"])).toBeCloseTo(0.8, 10);
        expect(Number(final?.["exact"])).toBeCloseTo(Math.exp(0.8), 10);
        expect(Number(final?.["error"])).toBeLessThan(1e-4);
        expect(generator.next().done).toBe(true);
    });
});
