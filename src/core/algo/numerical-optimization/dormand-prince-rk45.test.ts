/**
 * dormand-prince-rk45.test.ts - Exact-solution cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dormand-prince-rk45";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Dormand-Prince RK45", () => {
    it("matches the exact exponential solution within tolerance", () => {
        const cases: Array<{ lambda: number; y0: number; t0: number; tEnd: number; tol: number }> = [
            { lambda: 1, y0: 1, t0: 0, tEnd: 1, tol: 1e-6 },
            { lambda: -2, y0: 3, t0: 0, tEnd: 2, tol: 1e-7 },
            { lambda: 0.5, y0: 2, t0: 1, tEnd: 3, tol: 1e-8 },
        ];
        for (const testCase of cases) {
            const frames = [...mod.run({ ...testCase, h0: 0.4, maxSteps: 1000 })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const y = Number(final?.["y"]);
            const exact = testCase.y0 * Math.exp(testCase.lambda * (testCase.tEnd - testCase.t0));
            expect(Math.abs(y - exact)).toBeLessThan(Math.max(1e-6, testCase.tol * 50));
            expect(Math.abs(Number(final?.["t"]) - testCase.tEnd)).toBeLessThan(1e-9);
            expect(Math.abs(Number(final?.["error"]))).toBeLessThan(Math.max(1e-6, testCase.tol * 50));
        }
    });

    it("the error estimate is finite and steps are positive", () => {
        const frames = [...mod.run({ lambda: 1, y0: 1, t0: 0, tEnd: 1, tol: 1e-6, h0: 0.5, maxSteps: 100 })];
        for (const frame of frames) {
            expect(Number.isFinite(Number(frame.meta["error"]))).toBe(true);
            expect(Number(frame.meta["h"])).toBeGreaterThan(0);
            expect(Number.isFinite(Number(frame.meta["y"]))).toBe(true);
        }
    });

    it("reaches the exact solution more accurately with a tighter tolerance", () => {
        const loose = [...mod.run({ lambda: 1, y0: 1, t0: 0, tEnd: 1, tol: 1e-3, h0: 0.5, maxSteps: 1000 })];
        const tight = [...mod.run({ lambda: 1, y0: 1, t0: 0, tEnd: 1, tol: 1e-9, h0: 0.5, maxSteps: 1000 })];
        const exact = Math.E;
        const looseErr = Math.abs(Number(loose[loose.length - 1]?.meta["y"]) - exact);
        const tightErr = Math.abs(Number(tight[tight.length - 1]?.meta["y"]) - exact);
        expect(tightErr).toBeLessThan(looseErr);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
