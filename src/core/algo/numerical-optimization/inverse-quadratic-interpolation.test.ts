/**
 * inverse-quadratic-interpolation.test.ts - Root-finding correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./inverse-quadratic-interpolation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

const ROOTS: Record<string, number> = {
    "x2-2": Math.SQRT2,
    "x3-x-2": 1.5213797068045676,
    "cos-x": 0.7390851332151607,
    "exp-2": Math.LN2,
};

describe("Inverse Quadratic Interpolation", () => {
    it("converges to the true root of each named function", () => {
        for (const name of Object.keys(ROOTS)) {
            const frames = [...mod.run({ func: name, a: 0, b: 2, tol: 1e-12, iterations: 60 })];
            checkFrames(frames);
            const root = Number(frames[frames.length - 1]?.meta["root"]);
            expect(Number.isFinite(root)).toBe(true);
            expect(Math.abs(root - (ROOTS[name] as number))).toBeLessThan(1e-8);
        }
    });

    it("brute-force checks the final residual is close to zero", () => {
        const f = (x: number) => x * x - 2;
        const frames = [...mod.run({ func: "x2-2", a: 0, b: 2, tol: 1e-12, iterations: 60 })];
        const root = Number(frames[frames.length - 1]?.meta["root"]);
        let best = Number.POSITIVE_INFINITY;
        for (let x = 1; x <= 2; x += 1e-4) {
            best = Math.min(best, Math.abs(f(x)));
        }
        expect(Math.abs(f(root))).toBeLessThan(1e-10);
        expect(Math.abs(f(root))).toBeLessThanOrEqual(best + 1e-2);
    });

    it("reports an unbracketed input instead of diverging", () => {
        const frames = [...mod.run({ func: "x2-2", a: 2, b: 3 })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["bracketed"]).toBe(false);
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
