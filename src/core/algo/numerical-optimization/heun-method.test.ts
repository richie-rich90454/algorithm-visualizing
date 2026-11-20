/**
 * heun-method.test.ts - Independent reference, second-order convergence, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./heun-method";
import type { VisualFrame } from "@/types";

type Input = { fn: string; t0: number; y0: number; tEnd: number; n: number };

const FNS: Record<string, (t: number, y: number) => number> = {
    exp: (_t, y) => y,
    linear: (t) => t,
    cos: (t) => Math.cos(t),
    constant: () => 3,
};
const EXACT: Record<string, (t: number, t0: number, y0: number) => number> = {
    exp: (t, t0, y0) => y0 * Math.exp(t - t0),
    linear: (t, t0, y0) => y0 + (t * t - t0 * t0) / 2,
    cos: (t, t0, y0) => y0 + Math.sin(t) - Math.sin(t0),
    constant: (t, t0, y0) => y0 + 3 * (t - t0),
};

function reference(input: Input): { ts: number[]; ys: number[] } {
    const f = FNS[input.fn]!;
    const t0 = Math.min(input.t0, input.tEnd);
    const tEnd = Math.max(input.t0, input.tEnd);
    const h = (tEnd - t0) / input.n;
    const ts = [t0];
    const ys = [input.y0];
    for (let i = 0; i < input.n; i += 1) {
        const t = t0 + i * h;
        const y = ys[ys.length - 1]!;
        const k1 = f(t, y);
        const k2 = f(t + h, y + h * k1);
        ys.push(y + (h / 2) * (k1 + k2));
        ts.push(t + h);
    }
    return { ts, ys };
}

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBe(n + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["rows"]).toBe(n + 1);
        expect(frame.meta["cols"]).toBe(6);
        expect(frame.entities.length).toBe((n + 1) * 6);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.meta["order"]).toBe(2);
    });
}

describe("HeunMethod", () => {
    it("matches an independent predictor-corrector reference", () => {
        const cases: Input[] = [
            { fn: "exp", t0: 0, y0: 1, tEnd: 1, n: 10 },
            { fn: "linear", t0: -1, y0: 2, tEnd: 2, n: 12 },
            { fn: "cos", t0: 0, y0: 0.5, tEnd: 1.5, n: 9 },
            { fn: "constant", t0: 3, y0: -2, tEnd: 1, n: 7 },
        ];
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.n);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            expect((final?.["ys"] as number[]).length).toBe(expected.ys.length);
            expected.ys.forEach((y, i) => {
                expect((final?.["ys"] as number[])[i]).toBeCloseTo(y, 12);
            });
            expected.ts.forEach((t, i) => {
                expect((final?.["ts"] as number[])[i]).toBeCloseTo(t, 12);
            });
        }
    });

    it("is exact for a constant derivative and second order for exponential growth", () => {
        const linearInput: Input = { fn: "constant", t0: 0, y0: 4, tEnd: 3, n: 5 };
        const linearFinal = [...mod.run(linearInput)].pop()?.meta;
        expect(linearFinal?.["error"] as number).toBeLessThan(1e-12);
        expect(linearFinal?.["approximation"] as number).toBeCloseTo(EXACT.constant(3, 0, 4), 12);

        const base: Input = { fn: "exp", t0: 0, y0: 1, tEnd: 1, n: 10 };
        const coarse = [...mod.run(base)].pop()?.meta["error"] as number;
        const fine = [...mod.run({ ...base, n: 40 })].pop()?.meta["error"] as number;
        expect(fine).toBeLessThan(coarse / 8);
        expect(coarse).toBeLessThan(0.01);
    });

    it("matches the closed form on smooth derivatives", () => {
        const input: Input = { fn: "cos", t0: 0, y0: 1, tEnd: 2, n: 40 };
        const final = [...mod.run(input)].pop()?.meta;
        expect(final?.["error"] as number).toBeLessThan(1e-3);
        expect(final?.["exact"] as number).toBeCloseTo(EXACT.cos(2, 0, 1), 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(12);
        expect(generator.next().done).toBe(true);
    });
});
