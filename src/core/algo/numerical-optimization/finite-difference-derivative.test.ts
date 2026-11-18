/**
 * finite-difference-derivative.test.ts - Formula reference, order-of-error checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./finite-difference-derivative";
import type { VisualFrame } from "@/types";

const F: Record<string, (x: number) => number> = {
    x2: (x) => x * x,
    sin: (x) => Math.sin(x),
    exp: (x) => Math.exp(x),
};
const D: Record<string, (x: number) => number> = {
    x2: (x) => 2 * x,
    sin: (x) => Math.cos(x),
    exp: (x) => Math.exp(x),
};

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(5);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function lastMeta(func: string, x: number, h: number) {
    const frames = [...mod.run({ func, x, h })];
    checkFrames(frames);
    return frames[frames.length - 1]?.meta ?? {};
}

describe("Finite-difference derivative", () => {
    it("reproduces each formula from the sampled function values", () => {
        for (const func of ["x2", "sin", "exp"]) {
            const x = 0.7;
            const h = 0.05;
            const meta = lastMeta(func, x, h);
            const f = F[func]!;
            const forward = (f(x + h) - f(x)) / h;
            const backward = (f(x) - f(x - h)) / h;
            const central = (f(x + h) - f(x - h)) / (2 * h);
            expect(Number(meta["forward"])).toBeCloseTo(forward, 12);
            expect(Number(meta["backward"])).toBeCloseTo(backward, 12);
            expect(Number(meta["central"])).toBeCloseTo(central, 12);
            expect(Number(meta["analytic"])).toBeCloseTo(D[func]!(x), 12);
        }
    });

    it("is exact for quadratics and improves with smaller steps", () => {
        const meta = lastMeta("x2", 2, 0.1);
        expect(Number(meta["analytic"])).toBe(4);
        expect(Math.abs(Number(meta["central"]) - 4)).toBeLessThan(1e-9);
        expect(Math.abs(Number(meta["richardson"]) - 4)).toBeLessThan(1e-9);
        expect(Math.abs(Number(meta["forward"]) - 4)).toBeCloseTo(0.1, 9);
    });

    it("centered differences beat one-sided differences on smooth functions", () => {
        for (const func of ["sin", "exp"]) {
            const x = 1;
            const h = 0.1;
            const meta = lastMeta(func, x, h);
            const analytic = D[func]!(x);
            const forwardError = Math.abs(Number(meta["forward"]) - analytic);
            const centralError = Math.abs(Number(meta["central"]) - analytic);
            const richardsonError = Math.abs(Number(meta["richardson"]) - analytic);
            expect(centralError).toBeLessThan(forwardError);
            expect(richardsonError).toBeLessThan(centralError);
            const smaller = lastMeta(func, x, h / 2);
            expect(Math.abs(Number(smaller["central"]) - analytic)).toBeLessThan(centralError);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
