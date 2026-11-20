/**
 * predictor-corrector.test.ts - Reference cross-check, accuracy against the
 * closed-form solution, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./predictor-corrector";
import type { VisualFrame } from "@/types";

interface Input {
    lambda: number;
    y0: number;
    h: number;
    steps: number;
    corrections: number;
}

/** Independent Adams-Bashforth-Moulton predictor-corrector loop. */
function reference(p: Input) {
    const deriv = (y: number): number => p.lambda * y;
    const exact = (t: number): number => p.y0 * Math.exp(p.lambda * t);
    const values: number[] = [p.y0, exact(p.h)];
    for (let n = 1; n < p.steps; n += 1) {
        const yn = values[n] as number;
        const yPrev = values[n - 1] as number;
        const predicted = yn + (p.h / 2) * (3 * deriv(yn) - deriv(yPrev));
        let corrected = yn + (p.h / 2) * (deriv(predicted) + deriv(yn));
        for (let k = 1; k < p.corrections; k += 1) {
            corrected = yn + (p.h / 2) * (deriv(corrected) + deriv(yn));
        }
        values[n + 1] = corrected;
    }
    const final = values[p.steps] as number;
    return { final, exact: exact(p.steps * p.h), error: Math.abs(final - exact(p.steps * p.h)) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(4);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Adams-Bashforth-Moulton predictor-corrector", () => {
    it("matches an independent reference and stays close to the exact solution", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const finalMeta = frames[frames.length - 1]?.meta;
        expect(Number(finalMeta?.["corrected"])).toBeCloseTo(expected.final, 10);
        expect(Number(finalMeta?.["exact"])).toBeCloseTo(expected.exact, 10);
        expect(Number(finalMeta?.["error"])).toBeCloseTo(expected.error, 10);
        expect(Number(finalMeta?.["error"])).toBeLessThan(0.01);
    });

    it("improves accuracy when the step size is halved", () => {
        const base: Input = { lambda: -2, y0: 1, h: 0.2, steps: 10, corrections: 2 };
        const fine: Input = { ...base, h: 0.1, steps: 20 };
        const errorAt = (p: Input): number => {
            const frames = [...mod.run(p)];
            return Number(frames[frames.length - 1]?.meta["error"]);
        };
        expect(errorAt(fine)).toBeLessThan(errorAt(base));
    });

    it("agrees with the closed form for a growing solution", () => {
        const input: Input = { lambda: 1, y0: 0.5, h: 0.05, steps: 20, corrections: 3 };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const finalMeta = frames[frames.length - 1]?.meta;
        const exact = input.y0 * Math.exp(input.lambda * input.steps * input.h);
        expect(Number(finalMeta?.["corrected"])).toBeCloseTo(exact, 3);
        expect(Number(finalMeta?.["error"])).toBeLessThan(0.01);
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
