/** trapezoidal-distribution.test.ts - closed-form pdf/cdf/mean, unit area, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./trapezoidal-distribution";
import type { VisualFrame } from "@/types";

function pdf(x: number, a: number, b: number, c: number, d: number): number {
    const h = 2 / (b + d - a - c);
    if (x < a || x > b) return 0;
    if (x < c) return (h * (x - a)) / (c - a);
    if (x <= d) return h;
    return (h * (b - x)) / (b - d);
}
function cdf(x: number, a: number, b: number, c: number, d: number): number {
    const h = 2 / (b + d - a - c);
    if (x <= a) return 0;
    if (x >= b) return 1;
    if (x < c) return ((x - a) ** 2 * h) / (2 * (c - a));
    if (x <= d) return ((c - a) * h) / 2 + (x - c) * h;
    return 1 - ((b - x) ** 2 * h) / (2 * (b - d));
}

function checkFrames(frames: VisualFrame[], steps: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(steps + 1);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Trapezoidal Distribution", () => {
    it("matches the closed-form density, cumulative curve, and mean", () => {
        for (const p of [{ a: 0, b: 4, c: 1, d: 3 }, { a: -2, b: 6, c: 0, d: 1 }, { a: 1, b: 9, c: 7, d: 8 }]) {
            const frames = [...mod.run({ ...p, steps: 20 })];
            checkFrames(frames, 20);
            const meta = frames.at(-1)?.meta;
            const xs = meta?.["xs"] as number[];
            const emittedPdf = meta?.["pdf"] as number[];
            const emittedCdf = meta?.["cdf"] as number[];
            xs.forEach((x, i) => {
                expect(emittedPdf[i]).toBeCloseTo(pdf(x, p.a, p.b, p.c, p.d), 9);
                expect(emittedCdf[i]).toBeCloseTo(cdf(x, p.a, p.b, p.c, p.d), 9);
            });
            expect(Number(meta?.["mean"])).toBeCloseTo((p.a + p.b + p.c + p.d) / 4, 9);
        }
    });

    it("integrates to one on a fine grid and has a monotone cumulative curve", () => {
        const meta = [...mod.run({ a: 0, b: 4, c: 1, d: 3, steps: 400 })].at(-1)?.meta;
        expect(Number(meta?.["area"])).toBeCloseTo(1, 3);
        const c = meta?.["cdf"] as number[];
        for (let i = 1; i < c.length; i += 1) expect(c[i] as number).toBeGreaterThanOrEqual(c[i - 1] as number);
        expect(c.at(-1)).toBeCloseTo(1, 9);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
